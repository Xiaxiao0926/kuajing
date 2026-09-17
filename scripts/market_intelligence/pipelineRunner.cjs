/**
 * scripts/market_intelligence/pipelineRunner.cjs
 * Node.js bridge for running scripts/market_intelligence/pipeline.py
 * Production Hardening (V1.1.1):
 * - Concurrency Lock (.pipeline.lock & HTTP 409)
 * - SHA256 Dataset Deduplication & Idempotency
 * - Audit Log Management
 * - Active Run Rollback
 */
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '../..');
const MI_DATA_DIR = path.resolve(REPO_ROOT, 'ozon-react/public/data/market_intelligence');
const RUNS_DIR = path.resolve(MI_DATA_DIR, 'runs');
const UPLOADS_DIR = path.resolve(MI_DATA_DIR, 'uploads');
const STATUS_FILE = path.resolve(MI_DATA_DIR, 'status.json');
const ACTIVE_RUN_FILE = path.resolve(MI_DATA_DIR, 'active_run.json');
const LOCK_FILE = path.resolve(RUNS_DIR, '.pipeline.lock');
const AUDIT_LOG_FILE = path.resolve(MI_DATA_DIR, 'audit_log.json');
const PIPELINE_SCRIPT = path.resolve(__dirname, 'pipeline.py');

// Python detection
const CANDIDATES = [
  { cmd: 'py', args: ['-3'] },
  { cmd: 'python3', args: [] },
  { cmd: 'python', args: [] },
];

let cachedPython = null;
function getPythonInterpreter() {
  if (cachedPython) return cachedPython;
  for (const c of CANDIDATES) {
    try {
      const probe = spawnSync(c.cmd, [...c.args, '--version'], {
        stdio: 'ignore',
      });
      if (probe.status === 0) {
        cachedPython = c;
        return c;
      }
    } catch (e) {
      // Continue searching
    }
  }
  throw new Error('未找到可用的 Python 解释器 (请安装 Python 3.10+ 并加入 PATH)');
}

let activeProcess = null;

// ---------- 1. 并发锁 (Concurrency Lock) ----------

function isPipelineLocked() {
  if (activeProcess !== null) {
    return {
      locked: true,
      pid: activeProcess.pid,
      runId: activeProcess.runId,
      startTime: activeProcess.startTime,
    };
  }

  if (fs.existsSync(LOCK_FILE)) {
    try {
      const lockData = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf-8'));
      // Check if process still alive
      if (lockData.pid) {
        try {
          process.kill(lockData.pid, 0);
          return { locked: true, ...lockData };
        } catch (err) {
          // Process not found / dead, lock is stale
          console.warn('[PipelineRunner] Releasing stale lock file from dead pid:', lockData.pid);
          fs.unlinkSync(LOCK_FILE);
        }
      }
    } catch (e) {
      try { fs.unlinkSync(LOCK_FILE); } catch {}
    }
  }

  return { locked: false };
}

function acquireLock(runId, pid) {
  const lockData = {
    locked: true,
    runId,
    pid,
    startTime: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
  fs.writeFileSync(LOCK_FILE, JSON.stringify(lockData, null, 2), 'utf-8');
}

function releaseLock() {
  if (fs.existsSync(LOCK_FILE)) {
    try {
      fs.unlinkSync(LOCK_FILE);
    } catch (e) {
      console.warn('[PipelineRunner] Error removing lock file:', e.message);
    }
  }
}

// ---------- 2. 数据集 SHA256 计算与去重检测 ----------

function computeFileSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

function checkDuplicateDataset(nichePath, searchPath) {
  if (!fs.existsSync(nichePath) || !fs.existsSync(searchPath)) return null;
  const nicheSha = computeFileSha256(nichePath);
  const searchSha = computeFileSha256(searchPath);

  if (fs.existsSync(ACTIVE_RUN_FILE)) {
    try {
      const activeData = JSON.parse(fs.readFileSync(ACTIVE_RUN_FILE, 'utf-8'));
      for (const run of activeData.available_runs || []) {
        const metaPath = path.join(RUNS_DIR, run.run_id, 'run_meta.json');
        if (fs.existsSync(metaPath)) {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          const m = meta.manifest || {};
          if (m.niche_file?.sha256 === nicheSha && m.keyword_file?.sha256 === searchSha) {
            return {
              duplicate: true,
              existing_run_id: run.run_id,
              title: run.title,
              niche_sha256: nicheSha,
              keyword_sha256: searchSha,
            };
          }
        }
      }
    } catch (e) {
      console.error('[PipelineRunner] Duplicate check error:', e.message);
    }
  }
  return null;
}

// ---------- 3. 状态与执行控制 ----------

function getPipelineStatus() {
  if (!fs.existsSync(STATUS_FILE)) {
    return {
      status: 'IDLE',
      progress: 0,
      step: '等待启动',
      updated_at: null,
      error: null,
    };
  }
  try {
    const raw = fs.readFileSync(STATUS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return {
      status: 'UNKNOWN',
      progress: 0,
      step: '状态读取异常',
      error: err.message,
    };
  }
}

function writeStatus(status, progress, step, error = null) {
  const data = {
    status,
    progress,
    step,
    updated_at: new Date().toISOString(),
    error,
  };
  fs.mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
  fs.writeFileSync(STATUS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  return data;
}

function startPipeline({ nicheFile, searchFile, runId, runTitle, dryRun = false, forceRerun = false }) {
  // Check concurrency lock FIRST before any other parameter validation
  const lockInfo = isPipelineLocked();
  if (lockInfo.locked) {
    const err = new Error(`当前已有分析任务 [${lockInfo.runId || 'RUNNING'}] 正在后台运行中，系统禁止并发启动多个管道以防数据冲突。`);
    err.code = 'PIPELINE_LOCKED';
    err.active_job = lockInfo;
    err.running_job = lockInfo;
    throw err;
  }

  if (!nicheFile || !searchFile) {
    throw new Error('启动分析管道必须同时提供利基总表 (nicheFile) 与搜索词需求表 (searchFile)');
  }

  // Resolve absolute or relative paths
  const resolvedNiche = path.isAbsolute(nicheFile) ? nicheFile : path.resolve(REPO_ROOT, nicheFile);
  const resolvedSearch = path.isAbsolute(searchFile) ? searchFile : path.resolve(REPO_ROOT, searchFile);

  if (!fs.existsSync(resolvedNiche)) {
    throw new Error(`利基文件未找到: ${resolvedNiche}`);
  }
  if (!fs.existsSync(resolvedSearch)) {
    throw new Error(`搜索词文件未找到: ${resolvedSearch}`);
  }

  // Check dataset duplicate (unless forceRerun is true)
  if (!forceRerun) {
    const dup = checkDuplicateDataset(resolvedNiche, resolvedSearch);
    if (dup && dup.duplicate) {
      return {
        success: false,
        duplicate: true,
        status: 'DUPLICATE_DATASET',
        existing_run_id: dup.existing_run_id,
        title: dup.title,
        message: `该数据集已生成批次 [${dup.existing_run_id}]，无需重复计算。`,
      };
    }
  }

  const py = getPythonInterpreter();
  const targetRunId = runId || `RUN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-001`;

  const args = [
    ...py.args,
    PIPELINE_SCRIPT,
    '--niche-file', resolvedNiche,
    '--search-file', resolvedSearch,
    '--runs-dir', RUNS_DIR,
    '--active-run-file', ACTIVE_RUN_FILE,
    '--status-file', STATUS_FILE,
  ];

  if (runId) args.push('--run-id', runId);
  if (runTitle) args.push('--run-title', runTitle);
  if (dryRun) args.push('--dry-run');

  writeStatus('UPLOADED', 5, '文件已就绪，正在唤醒后台计算管道...');

  const child = spawn(py.cmd, args, {
    cwd: REPO_ROOT,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.runId = targetRunId;
  child.startTime = new Date().toISOString();
  activeProcess = child;
  acquireLock(targetRunId, child.pid);

  let stdoutBuf = '';
  let stderrBuf = '';

  child.stdout.on('data', (d) => {
    const txt = d.toString();
    stdoutBuf += txt;
    process.stdout.write(`[PipelinePy] ${txt}`);
  });

  child.stderr.on('data', (d) => {
    const txt = d.toString();
    stderrBuf += txt;
    process.stderr.write(`[PipelinePy Error] ${txt}`);
  });

  child.on('close', (code) => {
    activeProcess = null;
    releaseLock();

    if (code !== 0) {
      console.error(`[PipelinePy] Exited with failure code: ${code}`);
      const cur = getPipelineStatus();
      if (cur.status !== 'SCHEMA_CHANGE_REVIEW_REQUIRED' && cur.status !== 'FAILED') {
        writeStatus('FAILED', 0, '后台计算管道异常退出', stderrBuf || `Exited with code ${code}`);
      }
    } else {
      console.log(`[PipelinePy] Completed successfully (code 0).`);
    }
  });

  return {
    success: true,
    message: '管道已在后台成功拉起',
    status: 'UPLOADED',
    run_id: targetRunId,
  };
}

// ---------- 4. Active Run 回滚与差异报告 ----------

function rollbackActiveRun() {
  if (!fs.existsSync(ACTIVE_RUN_FILE)) throw new Error('active_run.json 不存在');
  const activeData = JSON.parse(fs.readFileSync(ACTIVE_RUN_FILE, 'utf-8'));
  const prevId = activeData.previous_active_run_id;
  if (!prevId) throw new Error('当前没有可回滚的历史活跃批次 (previous_active_run_id 为空)');

  const curId = activeData.active_run_id;
  activeData.previous_active_run_id = curId;
  activeData.active_run_id = prevId;

  const tempP = ACTIVE_RUN_FILE + '.tmp';
  fs.writeFileSync(tempP, JSON.stringify(activeData, null, 2), 'utf-8');
  fs.renameSync(tempP, ACTIVE_RUN_FILE);

  // Record audit log
  appendAuditLog({
    action: 'RUN_ROLLBACK',
    old_value: curId,
    new_value: prevId,
    source: 'DATAHUB_ROLLBACK_ACTION',
  });

  return {
    success: true,
    active_run_id: prevId,
    previous_active_run_id: curId,
    message: `已成功将活跃批次从 ${curId} 回滚至 ${prevId}`,
  };
}

function getDiffReport(runId) {
  if (!runId) return null;
  const diffFile = path.join(RUNS_DIR, runId, 'RUN_DIFF_REPORT.json');
  if (!fs.existsSync(diffFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(diffFile, 'utf-8'));
  } catch (e) {
    return null;
  }
}

// ---------- 5. 审计日志持久化 ----------

function getAuditLogs() {
  if (!fs.existsSync(AUDIT_LOG_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(AUDIT_LOG_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function appendAuditLog(entry) {
  const logs = getAuditLogs();
  const newEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  logs.unshift(newEntry);
  if (logs.length > 500) logs.length = 500; // retain latest 500 records
  fs.mkdirSync(path.dirname(AUDIT_LOG_FILE), { recursive: true });
  fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify(logs, null, 2), 'utf-8');
  return newEntry;
}

// ---------- 6. HTTP API 请求处理器 ----------

function saveUploadedBuffer(filename, buffer) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const safeName = path.basename(filename);
  const dest = path.join(UPLOADS_DIR, safeName);
  fs.writeFileSync(dest, buffer);
  return dest;
}

function handleUploadRequest(req, res) {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('application/json')) {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, ...body }));
      } catch (err) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // multipart/form-data
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = match ? (match[1] || match[2]).trim() : null;
  if (!boundary) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: '缺少 boundary 标头' }));
    return;
  }

  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    try {
      const raw = Buffer.concat(chunks);
      const boundaryBuf = Buffer.from(`--${boundary}`);
      const parts = [];
      let start = 0;
      while (start < raw.length) {
        const idx = raw.indexOf(boundaryBuf, start);
        if (idx === -1) break;
        if (start > 0) parts.push(raw.slice(start, idx - 2));
        start = idx + boundaryBuf.length + 2;
      }

      let nicheFile = null;
      let searchFile = null;
      const uploadedFiles = [];

      for (const part of parts) {
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;
        const header = part.slice(0, headerEnd).toString();
        const nameMatch = header.match(/name="([^"]+)"/);
        const filenameMatch = header.match(/filename="([^"]+)"/);
        if (!filenameMatch) continue;

        let filename = filenameMatch[1];
        try {
          filename = Buffer.from(filename, 'latin1').toString('utf8');
        } catch (e) {}

        const fieldName = nameMatch ? nameMatch[1] : '';
        const body = part.slice(headerEnd + 4);

        const savedPath = saveUploadedBuffer(filename, body);
        uploadedFiles.push({ field: fieldName, name: filename, path: savedPath });

        if (fieldName === 'nicheFile' || filename.includes('利基')) {
          nicheFile = savedPath;
        } else if (fieldName === 'searchFile' || filename.includes('搜索') || filename.includes('Jam')) {
          searchFile = savedPath;
        }
      }

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        success: true,
        nicheFile,
        searchFile,
        uploadedFiles,
      }));
    } catch (err) {
      console.error('[Upload Handler Error]:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

function handleRunPipelineRequest(req, res) {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
      const result = startPipeline(body);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(result));
    } catch (err) {
      console.error('[Run Pipeline Error]:', err.message);
      if (err.code === 'PIPELINE_LOCKED') {
        res.statusCode = 409;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          error: 'PIPELINE_LOCKED',
          message: err.message,
          active_job: err.active_job,
          running_job: err.active_job,
        }));
        return;
      }
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

function handleStatusRequest(req, res) {
  try {
    const status = getPipelineStatus();
    const lock = isPipelineLocked();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ...status, locked: lock.locked, lock_info: lock }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: err.message }));
  }
}

function handleDiffReportRequest(req, res, runId) {
  try {
    const report = getDiffReport(runId);
    if (!report) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: `未找到 Run ${runId} 的差异报告` }));
      return;
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(report));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: err.message }));
  }
}

function handleRollbackRequest(req, res) {
  try {
    const result = rollbackActiveRun();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(result));
  } catch (err) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: err.message }));
  }
}

function handleAuditLogRequest(req, res) {
  if (req.method === 'GET') {
    try {
      const logs = getAuditLogs();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(logs));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (req.method === 'POST') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
        const recorded = appendAuditLog(body);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, entry: recorded }));
      } catch (err) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.statusCode = 405;
  res.end();
}

module.exports = {
  getPipelineStatus,
  writeStatus,
  startPipeline,
  isPipelineLocked,
  acquireLock,
  releaseLock,
  checkDuplicateDataset,
  rollbackActiveRun,
  getAuditLogs,
  appendAuditLog,
  getDiffReport,
  saveUploadedBuffer,
  getPythonInterpreter,
  handleUploadRequest,
  handleRunPipelineRequest,
  handleStatusRequest,
  handleDiffReportRequest,
  handleRollbackRequest,
  handleAuditLogRequest,
  UPLOADS_DIR,
  STATUS_FILE,
  RUNS_DIR,
  LOCK_FILE,
  AUDIT_LOG_FILE,
};
