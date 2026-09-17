/**
 * tests/mi-acceptance-hardening.test.mjs
 * KUAIJING-WB-MARKET-INTELLIGENCE-V1.1.1
 * Production Hardening Acceptance Test Suite
 *
 * Verifies the 6 Hardening Pillars:
 * 1. Stable Niche UID & State Inheritance across Alias / Name Drift
 * 2. SHA256 Dataset Lineage & Duplicate Rejection Guard
 * 3. Pipeline Concurrency Lock & HTTP 409 Mutex
 * 4. Decision Audit Trail (audit_log.json)
 * 5. Atomic Run Rollback & State Restoration
 * 6. Canonical Metric Invariance & Zero Scoring Drift
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const runner = require('../scripts/market_intelligence/pipelineRunner.cjs')

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..')

const NICHE_FILE = 'D:/FYZSXNB/市场分析wb/WB--16-9-2026 利基分析(付费版) 从 18-06-2026 到 15-09-2026.xlsx'
const SEARCH_FILE = 'D:/FYZSXNB/市场分析wb/WB--16-9-2026 在WB上的搜索请求. Jam 从 18-06-2026 到 15-09-2026.xlsx'

const MI_DIR = path.resolve(REPO_ROOT, 'ozon-react/public/data/market_intelligence')
const RUNS_DIR = path.resolve(MI_DIR, 'runs')
const ACTIVE_RUN_FILE = path.resolve(MI_DIR, 'active_run.json')
const AUDIT_LOG_FILE = path.resolve(MI_DIR, 'audit_log.json')
const ALIAS_FILE = path.resolve(MI_DIR, 'niche_aliases.json')
const LOCK_FILE = path.resolve(RUNS_DIR, '.pipeline.lock')

function getPythonCmd() {
  const candidates = [
    { cmd: 'py', args: ['-3'] },
    { cmd: 'python3', args: [] },
    { cmd: 'python', args: [] },
  ]
  for (const c of candidates) {
    try {
      const res = spawnSync(c.cmd, [...c.args, '--version'], { stdio: 'ignore' })
      if (res.status === 0) return c
    } catch {}
  }
  throw new Error('No Python interpreter found')
}

describe('KUAIJING-WB-MARKET-INTELLIGENCE-V1.1.1 生产级加固验收', () => {
  const py = getPythonCmd()

  it('1. Stable Niche UID 稳定哈希与跨别名状态继承', () => {
    console.log('\n--- 1.1 验证 Python 端确定性 UID 生成与别名注册解析 ---')
    const testCode = `
import sys, os, json, tempfile
from market_intelligence.niche_uid import generate_niche_uid, resolve_niche_uid, register_niche_alias, load_alias_registry
from market_intelligence.asset_compiler import inherit_manual_state

# 验证确定性哈希
uid_gun = generate_niche_uid('wb', '手动工具及配件', '发泡胶枪')
uid_tube = generate_niche_uid('wb', '电工电气', '热缩管')

assert uid_gun == 'wb_niche_d0198d600bed', f"Unexpected UID for 发泡胶枪: {uid_gun}"
assert uid_tube == 'wb_niche_95bbf0baa514', f"Unexpected UID for 热缩管: {uid_tube}"

# 验证别名映射机制
alias_dict = {
    "version": "1.0",
    "aliases": {
        "手动工具及配件::发泡枪专业款": uid_gun,
        "发泡枪专业款": uid_gun
    },
    "uid_map": {
        uid_gun: {
            "canonical_name": "发泡胶枪",
            "category": "手动工具及配件",
            "aliases": ["发泡枪专业款"]
        }
    }
}
resolved_uid, resolved_name = resolve_niche_uid('wb', '手动工具及配件', '发泡枪专业款', alias_dict)
assert resolved_uid == uid_gun
assert resolved_name == '发泡胶枪'

# 验证状态继承：即便输入表名称漂移为「发泡枪专业款」，人工标记仍可无损继承
with tempfile.TemporaryDirectory() as tmp_dir:
    prev_dir = os.path.join(tmp_dir, 'RUN-BASELINE')
    os.makedirs(prev_dir, exist_ok=True)
    prev_niches = [
        {
            'uid': uid_gun,
            'name': '发泡胶枪',
            'cat': '手动工具及配件',
            'verdict': 'TEST',
            'manual_override': True,
            'userNote': '重点开发带特氟龙涂层发泡胶枪',
            'procurement': {'cny_cost': 24.5, 'selling_price_rub': 1250}
        }
    ]
    with open(os.path.join(prev_dir, 'niches_compact.json'), 'w', encoding='utf-8') as f:
        json.dump(prev_niches, f)

    new_niches = [
        {
            'uid': uid_gun,
            'name': '发泡枪专业款',
            'cat': '手动工具及配件',
            'verdict': 'WATCHLIST'
        }
    ]
    inherited, count, reviews = inherit_manual_state(new_niches, prev_dir)
    assert count == 1
    assert inherited[0]['verdict'] == 'TEST'
    assert inherited[0]['userNote'] == '重点开发带特氟龙涂层发泡胶枪'
    assert inherited[0]['procurement']['cny_cost'] == 24.5
    assert inherited[0]['uid'] == uid_gun

print("PASS: Python UID hash, alias resolution, and state inheritance 100% verified.")
`
    const proc = spawnSync(py.cmd, [...py.args, '-c', testCode], {
      cwd: path.resolve(REPO_ROOT, 'scripts'),
      encoding: 'utf-8',
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    })
    assert.equal(proc.status, 0, `Niche UID test failed: ${proc.stderr}`)
    console.log('✓ Stable Niche UID 稳定哈希与别名字典穿透校验通过！')
  })

  it('2. SHA256 数据集血缘追溯与重复上传幂等拦截', () => {
    console.log('\n--- 2.1 校验基准文件 SHA256 与 checkDuplicateDataset 拦截 ---')
    assert.ok(fs.existsSync(NICHE_FILE), `Niche file must exist: ${NICHE_FILE}`)
    assert.ok(fs.existsSync(SEARCH_FILE), `Search file must exist: ${SEARCH_FILE}`)

    const expectedNicheSha = crypto.createHash('sha256').update(fs.readFileSync(NICHE_FILE)).digest('hex')
    const expectedSearchSha = crypto.createHash('sha256').update(fs.readFileSync(SEARCH_FILE)).digest('hex')

    const dupCheck = runner.checkDuplicateDataset(NICHE_FILE, SEARCH_FILE)
    assert.ok(dupCheck, 'Duplicate check must return match for existing baseline run')
    assert.equal(dupCheck.duplicate, true)
    assert.equal(dupCheck.existing_run_id, 'RUN-20260917-001')
    assert.equal(dupCheck.niche_sha256, expectedNicheSha)
    assert.equal(dupCheck.keyword_sha256, expectedSearchSha)

    console.log(`✓ 成功拦截相同数据集重复提交: 已匹配已有批次 [${dupCheck.existing_run_id}] (${dupCheck.title})`)
  })

  it('3. 管道并发锁互斥与 HTTP 409 异常阻断', () => {
    console.log('\n--- 3.1 校验 .pipeline.lock 获取、状态识别与释放 ---')
    // 确保初始未锁
    runner.releaseLock()
    const initialLock = runner.isPipelineLocked()
    assert.equal(initialLock.locked, false)

    // 获取锁
    runner.acquireLock('TEST-LOCK-RUN-999', process.pid)
    const lockedStatus = runner.isPipelineLocked()
    assert.equal(lockedStatus.locked, true)
    assert.equal(lockedStatus.runId, 'TEST-LOCK-RUN-999')
    assert.equal(lockedStatus.pid, process.pid)
    assert.ok(fs.existsSync(LOCK_FILE), '.pipeline.lock file must exist')

    // 模拟 HTTP 触发管道请求时的互斥拦截 (409)
    let resStatus = null
    let resBody = null
    const mockReq = {
      method: 'POST',
      on: (evt, cb) => {
        if (evt === 'data') cb(Buffer.from(JSON.stringify({ runId: 'NEW-RUN-FAIL' })))
        if (evt === 'end') cb()
      }
    }
    const mockRes = {
      setHeader: () => {},
      end: (data) => {
        resBody = JSON.parse(data || '{}')
      },
      set statusCode(code) {
        resStatus = code
      },
      get statusCode() {
        return resStatus
      }
    }

    runner.handleRunPipelineRequest(mockReq, mockRes)
    assert.equal(resStatus, 409, 'Must respond with HTTP 409 when pipeline is locked')
    assert.equal(resBody.error, 'PIPELINE_LOCKED')
    assert.equal(resBody.running_job.runId, 'TEST-LOCK-RUN-999')

    // 释放锁
    runner.releaseLock()
    assert.equal(runner.isPipelineLocked().locked, false)
    assert.ok(!fs.existsSync(LOCK_FILE), '.pipeline.lock must be cleaned up')
    console.log('✓ 并发锁与 HTTP 409 互斥拦截机制完全验证！')
  })

  it('4. 决策审计日志全程追溯 (audit_log.json)', () => {
    console.log('\n--- 4.1 写入与检索人工决策审计日志 ---')
    const testLogEntry = {
      action: 'OVERRIDE_STATUS',
      niche_uid: 'wb_niche_d0198d600bed',
      niche_name: '发泡胶枪',
      old_value: { status: 'WATCHLIST' },
      new_value: { status: 'SHORTLISTED', reason: '跨境头程空运利润达标' },
      source: 'acceptance_test',
      user: 'test_hardening_agent'
    }

    const recorded = runner.appendAuditLog(testLogEntry)
    assert.ok(recorded.id, 'Audit entry must have unique id')
    assert.ok(recorded.timestamp, 'Audit entry must have ISO timestamp')
    assert.equal(recorded.action, 'OVERRIDE_STATUS')
    assert.equal(recorded.niche_uid, 'wb_niche_d0198d600bed')

    const logs = runner.getAuditLogs()
    assert.ok(Array.isArray(logs), 'Audit logs must be an array')
    assert.ok(logs.length > 0, 'Audit logs must contain appended entry')
    const matched = logs.find(l => l.id === recorded.id)
    assert.ok(matched, 'Appended log must be readable from disk')
    assert.equal(matched.user, 'test_hardening_agent')

    console.log(`✓ 决策审计日志成功落盘，当前履历条数: ${logs.length}`)
  })

  it('5. 活跃批次一键原子回滚与状态恢复 (Rollback)', () => {
    console.log('\n--- 5.1 验证 active_run.json 回滚与双向防错 ---')
    const activeRaw = JSON.parse(fs.readFileSync(ACTIVE_RUN_FILE, 'utf-8'))
    const originalActive = activeRaw.active_run_id
    const originalPrev = activeRaw.previous_active_run_id

    assert.ok(originalActive, 'active_run_id must exist')
    assert.ok(originalPrev, 'previous_active_run_id must exist')

    // 执行第一次回滚
    const res1 = runner.rollbackActiveRun()
    assert.equal(res1.success, true)
    assert.equal(res1.active_run_id, originalPrev)
    assert.equal(res1.previous_active_run_id, originalActive)

    const updated1 = JSON.parse(fs.readFileSync(ACTIVE_RUN_FILE, 'utf-8'))
    assert.equal(updated1.active_run_id, originalPrev)

    // 再次回滚（恢复为原活跃批次）
    const res2 = runner.rollbackActiveRun()
    assert.equal(res2.success, true)
    assert.equal(res2.active_run_id, originalActive)
    assert.equal(res2.previous_active_run_id, originalPrev)

    const updated2 = JSON.parse(fs.readFileSync(ACTIVE_RUN_FILE, 'utf-8'))
    assert.equal(updated2.active_run_id, originalActive)

    console.log(`✓ 批次回滚与恢复成功闭环: [${originalActive}] ↔ [${originalPrev}]`)
  })

  it('6. 核心算法版本事实源与指标零漂移 (Zero Scoring Drift)', () => {
    console.log('\n--- 6.1 校验算法版本与黄金单品评分严格未变 ---')
    const activeMeta = JSON.parse(fs.readFileSync(ACTIVE_RUN_FILE, 'utf-8'))
    const curRun = activeMeta.available_runs.find(r => r.run_id === activeMeta.active_run_id)
    assert.ok(curRun, 'Active run entry must exist in available_runs')

    // 验证模型版本字符串冻结
    assert.equal(curRun.models.market_model, 'WB-MARKET-MODEL-V1')
    assert.equal(curRun.models.risk_model, 'WB-CROSSBORDER-RISK-V1')
    assert.equal(curRun.models.keyword_model, 'WB-DSI-V1')

    // 验证标杆品评分严格一致
    const baseRunDir = path.join(RUNS_DIR, 'RUN-20260917-001')
    const testRunDir = path.join(RUNS_DIR, activeMeta.active_run_id)

    const baseNiches = JSON.parse(fs.readFileSync(path.join(baseRunDir, 'niches_compact.json'), 'utf-8'))
    const testNiches = JSON.parse(fs.readFileSync(path.join(testRunDir, 'niches_compact.json'), 'utf-8'))

    const baseGun = baseNiches.find(n => n.name === '发泡胶枪')
    const testGun = testNiches.find(n => n.name === '发泡胶枪')
    assert.ok(baseGun && testGun)
    assert.equal(testGun.mos, baseGun.mos, 'MOS 必须 100% 保持一致')
    assert.equal(testGun.cfs, baseGun.cfs, 'CFS 必须 100% 保持一致')
    assert.equal(testGun.gmv, baseGun.gmv, 'GMV 必须 100% 保持一致')
    assert.equal(testGun.buyout, baseGun.buyout, '签收率必须 100% 保持一致')

    const baseTube = baseNiches.find(n => n.name === '热缩管')
    const testTube = testNiches.find(n => n.name === '热缩管')
    assert.ok(baseTube && testTube)
    assert.equal(testTube.mos, baseTube.mos)
    assert.equal(testTube.cfs, baseTube.cfs)

    console.log('✓ 算法模型版本事实源冻结且核心标杆品评分零漂移！')
  })
})
