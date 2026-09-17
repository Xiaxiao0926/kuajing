/**
 * tests/mi-acceptance-pipeline.test.mjs
 * KUAIJING-WB-MARKET-INTELLIGENCE-V1.1
 * DataHub Pipeline End-to-End Acceptance Test
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..')

const NICHE_FILE = 'D:/FYZSXNB/市场分析wb/WB--16-9-2026 利基分析(付费版) 从 18-06-2026 到 15-09-2026.xlsx'
const SEARCH_FILE = 'D:/FYZSXNB/市场分析wb/WB--16-9-2026 在WB上的搜索请求. Jam 从 18-06-2026 到 15-09-2026.xlsx'

const MI_DIR = path.resolve(REPO_ROOT, 'ozon-react/public/data/market_intelligence')
const RUNS_DIR = path.resolve(MI_DIR, 'runs')
const ACTIVE_RUN_FILE = path.resolve(MI_DIR, 'active_run.json')
const STATUS_FILE = path.resolve(MI_DIR, 'status.json')

const TEST_RUN_ID = 'RUN-20261217-001'
const BASELINE_RUN_ID = 'RUN-20260917-001'

function getPythonCmd() {
  const candidates = [
    { cmd: 'py', args: ['-3'] },
    { cmd: 'python3', args: [] },
    { cmd: 'python', args: [] },
  ]
  for (const c of candidates) {
    const res = spawnSync(c.cmd, [...c.args, '--version'], { stdio: 'ignore' })
    if (res.status === 0) return c
  }
  throw new Error('No Python interpreter found')
}

describe('KUAIJING-WB-MARKET-INTELLIGENCE-V1.1 数据更新管道验收', () => {
  const py = getPythonCmd()

  it('1. 前置字段审计与 Schema 结构守卫 (field_audit.py)', () => {
    console.log('\n--- 1.1 校验真实有效 WB 文件结构 ---')
    const testCode = `
import sys
from market_intelligence.field_audit import audit_input_files, SchemaChangeReviewRequired

niche_f = sys.argv[1]
search_f = sys.argv[2]
res = audit_input_files(niche_f, search_f)
assert res["status"] == "PASS"
assert "2026" in res["data_period"]
assert res["niche_fields_count"] >= 23
assert res["search_fields_count"] >= 18
print("PASS: 正常文件审计通过，周期:", res["data_period"])
`
    const proc = spawnSync(py.cmd, [...py.args, '-c', testCode, NICHE_FILE, SEARCH_FILE], {
      cwd: path.resolve(REPO_ROOT, 'scripts'),
      encoding: 'utf-8',
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    })
    assert.equal(proc.status, 0, `Audit check failed: ${proc.stderr}`)
    console.log('✓ 正式数据文件结构、工作表与必要字段审计全部通过！')

    console.log('\n--- 1.2 注入模拟表头篡改文件，验证 SCHEMA_CHANGE_REVIEW_REQUIRED 阻断 ---')
    const faultCode = `
import sys
import tempfile
import openpyxl
from market_intelligence.field_audit import audit_input_files, SchemaChangeReviewRequired

search_f = sys.argv[1]
wb = openpyxl.Workbook()
ws = wb.active
ws.title = "详细信息"
ws.append(["非法列名1", "非法列名2"]) # 缺失必要字段
temp_file = tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False)
wb.save(temp_file.name)
wb.close()

try:
    audit_input_files(temp_file.name, search_f)
    sys.exit(2) # 不应执行到这里
except SchemaChangeReviewRequired as e:
    print("PASS: 成功捕获架构变更异常:", str(e))
    sys.exit(0)
`
    const procFault = spawnSync(py.cmd, [...py.args, '-c', faultCode, SEARCH_FILE], {
      cwd: path.resolve(REPO_ROOT, 'scripts'),
      encoding: 'utf-8',
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    })
    assert.equal(procFault.status, 0, `Schema change guard failed: ${procFault.stderr}`)
    console.log('✓ 成功验证：当 WB 导出文件发生结构变更时，系统强制触发 SCHEMA_CHANGE_REVIEW_REQUIRED 并中止，杜绝静默错误！')
  })

  it('2. 管道全流程执行与原子化 Staging 发布 (pipeline.py)', () => {
    console.log(`\n--- 2.1 执行管道全流程编译生成批次 ${TEST_RUN_ID} ---`)
    const pipelineScript = path.resolve(REPO_ROOT, 'scripts/market_intelligence/pipeline.py')

    const procRun = spawnSync(py.cmd, [
      ...py.args,
      pipelineScript,
      '--niche-file', NICHE_FILE,
      '--search-file', SEARCH_FILE,
      '--run-id', TEST_RUN_ID,
      '--run-title', '2026 Q4 俄罗斯市场选品决策基线',
      '--runs-dir', RUNS_DIR,
      '--active-run-file', ACTIVE_RUN_FILE,
      '--status-file', STATUS_FILE,
    ], {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      maxBuffer: 50 * 1024 * 1024,
    })

    if (procRun.status !== 0) {
      console.error(procRun.stderr)
      console.error(procRun.stdout)
    }
    assert.equal(procRun.status, 0, `Pipeline failed: ${procRun.stderr}`)

    // 检查最终生成的文件
    const testRunDir = path.join(RUNS_DIR, TEST_RUN_ID)
    assert.ok(fs.existsSync(testRunDir), `Target run directory ${testRunDir} must exist`)
    assert.ok(fs.existsSync(path.join(testRunDir, 'niches_compact.json')))
    assert.ok(fs.existsSync(path.join(testRunDir, 'keywords_top.json')))
    assert.ok(fs.existsSync(path.join(testRunDir, 'validation_pool.json')))
    assert.ok(fs.existsSync(path.join(testRunDir, 'audit_summary.json')))
    assert.ok(fs.existsSync(path.join(testRunDir, 'run_meta.json')))
    assert.ok(fs.existsSync(path.join(testRunDir, 'RUN_DIFF_REPORT.json')))

    // 验证 staging 已被清理/原子转移（不存在半成品泄漏）
    const stagingDir = path.join(RUNS_DIR, '_staging', TEST_RUN_ID)
    assert.ok(!fs.existsSync(stagingDir), `Staging dir must be cleanly promoted`)

    console.log(`✓ 管道端到端运行成功，已原子发布为 ${testRunDir}`)
  })

  it('3. 算法事实源与核心指标对拍校验 (对齐 RUN-20260917-001)', () => {
    console.log('\n--- 3.1 校验新批次与基准批次指标严格一致性 ---')
    const baseNichesPath = path.join(RUNS_DIR, BASELINE_RUN_ID, 'niches_compact.json')
    const testNichesPath = path.join(RUNS_DIR, TEST_RUN_ID, 'niches_compact.json')

    const baseNiches = JSON.parse(fs.readFileSync(baseNichesPath, 'utf-8'))
    const testNiches = JSON.parse(fs.readFileSync(testNichesPath, 'utf-8'))

    assert.equal(testNiches.length, baseNiches.length, `利基数量必须一致 (${baseNiches.length})`)

    const baseMap = new Map(baseNiches.map(n => [n.name, n]))
    const canonicalNames = ['发泡胶枪', '热缩管', '拖车支轮', '中控锁', '锯链']

    for (const name of canonicalNames) {
      const b = baseMap.get(name)
      const t = testNiches.find(n => n.name === name)
      assert.ok(b, `Baseline must have ${name}`)
      assert.ok(t, `Test run must have ${name}`)

      assert.equal(t.mos, b.mos, `${name} MOS 机会分必须严格一致 (${b.mos})`)
      assert.equal(t.cfs, b.cfs, `${name} CFS 可行性分必须严格一致 (${b.cfs})`)
      assert.equal(t.gmv, b.gmv, `${name} GMV 必须严格一致 (${b.gmv})`)
      assert.equal(t.buyout, b.buyout, `${name} 签收率必须严格一致 (${b.buyout})`)
      assert.equal(t.verdict, b.verdict, `${name} 定级判定必须严格一致 (${b.verdict})`)
      assert.deepEqual(t.risks.sort(), b.risks.sort(), `${name} 风险标签必须严格一致`)
      console.log(`  ✓ 标杆品「${name}」全部核心指标 (MOS: ${t.mos}, CFS: ${t.cfs}, GMV: ¥${t.gmv.toLocaleString()}, 判定: ${t.verdict}) 100% 对齐！`)
    }
  })

  it('4. 人工业务数据跨批次无损继承 (State Inheritance)', () => {
    console.log('\n--- 4.1 校验人工修改与备注在重跑中得以保留 ---')
    const testNichesPath = path.join(RUNS_DIR, TEST_RUN_ID, 'niches_compact.json')
    const testNiches = JSON.parse(fs.readFileSync(testNichesPath, 'utf-8'))

    // 之前我们在验收中给发泡胶枪设置过 manual override，验证是否继承
    const gun = testNiches.find(n => n.name === '发泡胶枪')
    assert.ok(gun, '发泡胶枪必须存在')
    assert.equal(gun.verdict, 'TEST')
    console.log(`✓ 单品「发泡胶枪」人工改判状态完整继承: verdict=${gun.verdict}`)
  })

  it('5. 周期差异报告生成 (RUN_DIFF_REPORT.json)', () => {
    console.log('\n--- 5.1 校验差异报告结构与有效性 ---')
    const diffPath = path.join(RUNS_DIR, TEST_RUN_ID, 'RUN_DIFF_REPORT.json')
    assert.ok(fs.existsSync(diffPath), 'RUN_DIFF_REPORT.json 必须生成')

    const diff = JSON.parse(fs.readFileSync(diffPath, 'utf-8'))
    assert.equal(diff.run_id, TEST_RUN_ID)
    assert.ok(diff.summary, '差异报告必须包含 summary 概览')
    assert.ok(Array.isArray(diff.new_test_candidates), '必须包含 new_test_candidates 数组')
    assert.ok(Array.isArray(diff.mos_surged), '必须包含 mos_surged 数组')
    assert.ok(Array.isArray(diff.booming_keywords), '必须包含 booming_keywords 数组')

    console.log('✓ 差异报告有效，对比基线:', diff.compared_against, '概览:', diff.summary)
  })

  it('6. active_run.json 活跃批次维护与多批次切换完整性', () => {
    console.log('\n--- 6.1 校验活跃批次索引 ---')
    const active = JSON.parse(fs.readFileSync(ACTIVE_RUN_FILE, 'utf-8'))
    assert.equal(active.active_run_id, TEST_RUN_ID, '新生成的批次必须原子更新为 active_run_id')

    const runIds = active.available_runs.map(r => r.run_id)
    assert.ok(runIds.includes(TEST_RUN_ID), 'available_runs 必须包含新批次')
    assert.ok(runIds.includes(BASELINE_RUN_ID), 'available_runs 必须保留历史基线批次')

    console.log('✓ active_run.json 完整维护所有可用批次:', runIds)
  })
})
