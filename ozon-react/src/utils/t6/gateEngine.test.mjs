/**
 * t6/gateEngine.test.mjs — Stage Gate 引擎测试（T6-2A hardening + T6-2B1 真实成本场景 Gate）
 * 运行: node --experimental-vm-modules src/utils/t6/gateEngine.test.mjs
 * 覆盖：
 *  G1-G6 业务语义（RESEARCH/模块/硬阻断/优先级/REVIEW 无检查/override）
 *  G-C1..C5 成本场景 Gate：无场景→FAIL(RED)、基线毛利≥15→PASS、<15→WARN(YELLOW)、无基线→FAIL、供应商仍 NOT_EVALUATED
 *  I18  非法目标阶段 fail-close
 *  I19  非法当前阶段 fail-close
 *  I20  SAME 不执行前向检查
 *  I21  BACKWARD 不执行前向 Gate（stage_change 默认理由，无 gate_override）
 *  I22  RED 推进必填理由：为空 throw、stage 不变、不产生任何日志
 */
import { evaluateProjectGate, GATE_VERDICTS, GATE_RESULTS } from './gateEngine.js'
import { transitionProjectStage } from './stageTransition.js'
import * as store from './t6Store.js'

let pass = 0, fail = 0
const assert = (cond, msg) => { if (cond) { pass++; console.log(`  ✅ ${msg}`) } else { fail++; console.log(`  ❌ ${msg}`) } }

console.log('\n===== Stage Gate 引擎测试（路径 Gate + 成本场景） =====\n')

const mem = new Map()
store._setAdapterForTests({
  get: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null),
  set: (k, v) => mem.set(k, JSON.stringify(v)),
  keys: () => [...mem.keys()],
})

function makeProject(overrides = {}) {
  return {
    id: 'p1', projectCode: 'RU-2026-001', marketCode: 'RU', schemaVersion: 1, name: '测试项目',
    source: { kind: 'candidate', candidateId: 'c1', sourceProductId: 'P-1', candidateName: 'x', category: 'x', creationSnapshotId: 's1' },
    lifecycleStatus: 'ACTIVE', stage: 'PIPELINE', goLiveAt: null,
    workflow: { templateVersion: 'roadmap-v1', states: [{ nodeId: 'n20', status: 'pending', updatedAt: null, updatedBy: null, note: null }] },
    product: {}, suppliers: [], samples: [], compliance: {},
    costing: { scenarios: [], baselineScenarioId: null },
    logistics: {}, listing: {}, launch: {}, operations: {}, settlement: {},
    decisionLog: [], createdAt: '', updatedAt: '',
    ...overrides,
  }
}

/** 纯 fixture 成本场景（模拟 store 中的 CostScenario 记录） */
function makeScenario({ id = 'sc1', projectId = 'p1', price = 5000, profitRate = 20 } = {}) {
  return {
    id, projectId, platform: 'OZON', name: `场景-${id}`, sourceSnapshotId: 's1',
    inputPayload: { price },
    outputPayload: { profit: 100, profitRate },
    resolvedConfig: { calculatorVersion: 'ozon-rfbs-single-v1', selectedChannel: { id: 'standard_small', name: 'Standard Small' } },
    createdAt: '',
  }
}

function makeRealProject(sourceProductId = 'P-GATE-001') {
  const { candidate } = store.ensureCandidate({ sourceProductId, candidateIndex: 0, name: 'x', categoryLeaf: 'x', categoryFull: 'x' })
  const snap = store.buildScoringSnapshot({
    scored: { index: 0, name: 'x', leaf: 'x', categoryFull: 'x', kind: 'exact', totalScore: 70, grade: 'B', gradeTentative: false, context: 'HIGH', evidenceCoverage: 1, dimensions: { demand: { score: 70, weight: 25, available: true, coverage: 1, marketScaleScore: 60, candidateStrengthScore: 80 } }, supplyGap: null, status: [], decision: { status: 'ELIGIBLE', action: 'PILOT_TEST', reason: 'x' }, ruleVersion: '1.0', matchedProductType: null, benchmarkSampleSize: null, strengths: [], risks: [], missingMetrics: [] },
    canonical: { source_product_id: sourceProductId, category_leaf: 'x', category_full: 'x', price_rub: 100, avg_price_rub: 100, sales_rub_28d: 1, units_28d: 1, conv_rate: 0, cart_add_rate: 0, exposure: 0, card_visits: 0, reviews: 0, gross_margin: 10, commission_fbs: null, commission_fbo: null, commission_rfbs: null, commission_fbp: null, ad_share: null, weight_kg: 0.1, dims: [10, 10, 10], ship_mode: 'FBO', sign_rate: null, oos_days_share: null, stock: null, turnover: null, revenue_loss_rate: null },
    benchmarkMeta: { version: '1.0', generated_at: 't' },
    benchmarkDoc: { product_types: {} },
    rules: { version: '1.0' },
    datasetVersion: 't',
    candidateId: candidate.id,
  })
  store.refreshCandidateSnapshot(candidate.id, snap.id)
  return store.createProject({ candidateId: candidate.id, creationSnapshotId: snap.id })
}

console.log('G1: RESEARCH 有立项快照 → GREEN；无快照 → RED')
{
  const g = evaluateProjectGate(makeProject(), 'RESEARCH')
  assert(g.direction === 'FORWARD' && g.path.join(',') === 'RESEARCH', `路径 (from,to] = [RESEARCH] (实际 ${g.path.join(',')})`)
  assert(g.verdict === GATE_VERDICTS.GREEN, `有快照 → GREEN (实际 ${g.verdict})`)
  const noSnap = evaluateProjectGate(makeProject({ source: { ...makeProject().source, creationSnapshotId: null } }), 'RESEARCH')
  assert(noSnap.verdict === GATE_VERDICTS.RED && noSnap.blockingReasons.length > 0, '无快照 → RED + blockingReasons')
}

console.log('G2: 未实现依赖模块 → NOT_EVALUATED（不伪装 PASS，也不当 FAIL；check 带 stage 归属）')
{
  // 项目已在 COSTING 且基线场景就绪，目标 COMPLIANCE：路径 SAMPLING/COMPLIANCE 上的 supplier/samples/compliance 均为未实现模块
  const project = makeProject({
    stage: 'COSTING',
    costing: { scenarios: ['sc1'], baselineScenarioId: 'sc1' },
  })
  const g = evaluateProjectGate(project, 'COMPLIANCE', { scenarios: [makeScenario({ id: 'sc1', projectId: 'p1' })] })
  assert(g.verdict === GATE_VERDICTS.NOT_EVALUATED, `未实现模块 → NOT_EVALUATED (实际 ${g.verdict})`)
  const moduleChecks = g.checks.filter((c) => ['supplier_quote', 'samples_record', 'compliance_pending'].includes(c.id))
  assert(moduleChecks.length === 3 && moduleChecks.every((c) => c.result === GATE_RESULTS.NOT_EVALUATED), 'supplier/samples/compliance 检查全部 NOT_EVALUATED')
  assert(g.checks.every((c) => c.stage && typeof c.stage === 'string'), '每个 check 都标注所属 stage')
  assert(g.blockingReasons.length === 0 && g.warnings.length === 0, 'NOT_EVALUATED 不产生 blocking/warning')
}

console.log('G-C1: COSTING 无成本场景 → FAIL → RED（fail-close，不伪装通过）')
{
  const g = evaluateProjectGate(makeProject(), 'COSTING', { scenarios: [] })
  assert(g.verdict === GATE_VERDICTS.RED, `无场景 → RED (实际 ${g.verdict})`)
  assert(g.blockingReasons.some((r) => r.includes('尚无成本场景')), '阻塞理由含「尚无成本场景」')
}

console.log('G-C2: 基线毛利 ≥15 → COSTING 全 PASS → GREEN')
{
  const project = makeProject({ costing: { scenarios: ['sc1'], baselineScenarioId: 'sc1' } })
  const g = evaluateProjectGate(project, 'COSTING', { scenarios: [makeScenario({ id: 'sc1', projectId: 'p1', profitRate: 22 })] })
  assert(g.verdict === GATE_VERDICTS.GREEN, `基线毛利 22% → GREEN (实际 ${g.verdict})`)
  assert(g.checks.every((c) => c.result === GATE_RESULTS.PASS), 'cost_scenario/target_price 均 PASS')
}

console.log('G-C3: 基线毛利 <15 → WARN → YELLOW')
{
  const project = makeProject({ costing: { scenarios: ['sc1'], baselineScenarioId: 'sc1' } })
  const g = evaluateProjectGate(project, 'COSTING', { scenarios: [makeScenario({ id: 'sc1', projectId: 'p1', profitRate: 10 })] })
  assert(g.verdict === GATE_VERDICTS.YELLOW, `基线毛利 10% → YELLOW (实际 ${g.verdict})`)
  assert(g.warnings.some((w) => w.includes('10%') && w.includes('15%')), '警告含「基线毛利率 10% < 15%」')
}

console.log('G-C4: 有场景但未设基线 → FAIL')
{
  const project = makeProject({ costing: { scenarios: ['sc1'], baselineScenarioId: null } })
  const g = evaluateProjectGate(project, 'COSTING', { scenarios: [makeScenario({ id: 'sc1', projectId: 'p1' })] })
  assert(g.verdict === GATE_VERDICTS.RED && g.blockingReasons.some((r) => r.includes('未设置基线')), '未设基线 → RED + 阻塞理由')
}

console.log('G-C5: SAMPLING 供应商仍 NOT_EVALUATED（成本已真实，供应商未实现）')
{
  const project = makeProject({ stage: 'COSTING', costing: { scenarios: ['sc1'], baselineScenarioId: 'sc1' } })
  const g = evaluateProjectGate(project, 'SAMPLING', { scenarios: [makeScenario({ id: 'sc1', projectId: 'p1', profitRate: 20 })] })
  const supplier = g.checks.find((c) => c.id === 'supplier_quote')
  const margin = g.checks.find((c) => c.id === 'margin_warning')
  assert(supplier && supplier.result === GATE_RESULTS.NOT_EVALUATED, 'supplier_quote NOT_EVALUATED')
  assert(margin && margin.result === GATE_RESULTS.PASS, 'margin_warning 用真实基线 → PASS')
  assert(g.verdict === GATE_VERDICTS.NOT_EVALUATED, `整体 → NOT_EVALUATED (实际 ${g.verdict})`)
}

console.log('G3: hard block——立项快照 BLOCKED_LOGISTICS 且 当前<SAMPLING、目标>=SAMPLING 才触发一次')
{
  const snap = { status: ['BLOCKED_LOGISTICS'] }
  const g = evaluateProjectGate(makeProject(), 'SAMPLING', { availableModules: {}, snapshot: snap })
  assert(g.verdict === GATE_VERDICTS.RED, `PIPELINE→SAMPLING → RED (实际 ${g.verdict})`)
  assert(g.blockingReasons.some((r) => r.includes('不建议进入样品阶段')), '提示不建议进入样品阶段')
  assert(g.checks.filter((c) => c.id === 'blocked_logistics').length === 1, 'hard block 只触发一次')

  const g2 = evaluateProjectGate(makeProject(), 'RESEARCH', { availableModules: {}, snapshot: snap })
  assert(g2.verdict === GATE_VERDICTS.GREEN, '目标未越过 SAMPLING（RESEARCH）→ 不受 hard block 影响')

  const g3 = evaluateProjectGate(makeProject({ stage: 'SAMPLING' }), 'COMPLIANCE', { availableModules: {}, snapshot: snap })
  assert(g3.verdict === GATE_VERDICTS.NOT_EVALUATED, '当前已是 SAMPLING → 不再触发 hard block（只提示模块）')
}

console.log('G4: 混合结果优先级——OPERATIONS（n20 未完成 FAIL + 模块 NOT_EVALUATED）→ RED；场景就绪后只剩模块 → NOT_EVALUATED')
{
  const g = evaluateProjectGate(makeProject(), 'OPERATIONS', { scenarios: [] })
  assert(g.verdict === GATE_VERDICTS.RED, `无场景时 → RED (实际 ${g.verdict})`)
  assert(g.blockingReasons.includes('尚未完成「商品上架」节点'), '包含 n20 阻塞理由')

  const ready = makeProject({
    workflow: { templateVersion: 'roadmap-v1', states: [{ nodeId: 'n20', status: 'done', updatedAt: null, updatedBy: null, note: null }] },
    costing: { scenarios: ['sc1'], baselineScenarioId: 'sc1' },
  })
  const g2 = evaluateProjectGate(ready, 'OPERATIONS', { scenarios: [makeScenario({ id: 'sc1', projectId: 'p1', profitRate: 20 })] })
  assert(g2.verdict === GATE_VERDICTS.NOT_EVALUATED, '场景就绪 + n20 完成 → 只剩未实现模块 → NOT_EVALUATED')
}

console.log('G5: REVIEW 段无检查 → 单段推进 GREEN；Gate 只建议不自动改 stage')
{
  const project = makeProject({ stage: 'OPERATIONS', workflow: { templateVersion: 'roadmap-v1', states: [{ nodeId: 'n20', status: 'done', updatedAt: null, updatedBy: null, note: null }] } })
  const g = evaluateProjectGate(project, 'REVIEW')
  assert(g.path.join(',') === 'REVIEW' && g.checks.length === 0, 'REVIEW 段自身无检查')
  assert(g.verdict === GATE_VERDICTS.GREEN, `REVIEW 单段 → GREEN (实际 ${g.verdict})`)
  const before = mem.get('t6.project.p1')
  assert(!before, 'evaluateProjectGate 不产生任何写入')
}

console.log('G6: override 流程——RED 下人工强制推进必须写理由 → DecisionLog(gate_override)')
{
  const project = makeRealProject()
  const res = transitionProjectStage({
    projectId: project.id,
    targetStage: 'OPERATIONS',
    deps: { availableModules: {}, scenarios: [] },
    reason: '强制推进：物流风险已知，先做成本测算',
  })
  const logs = store.listLogs().filter((l) => l.projectId === project.id)
  assert(logs.some((l) => l.kind === 'gate_override'), '存在 gate_override 日志')
  assert(store.getProject(project.id).stage === 'OPERATIONS', 'stage 已推进（Gate 只建议，人工决定）')
  assert(res.direction === 'FORWARD' && res.gate?.verdict === GATE_VERDICTS.RED, '返回 direction+gate 供 UI 展示')
}

console.log('I18: 非法目标阶段 fail-close（绝不把未知 stage 当空 checks → GREEN）')
{
  let threw = false
  try { evaluateProjectGate(makeProject(), 'NOPE') } catch { threw = true }
  assert(threw, 'evaluateProjectGate(非法目标) throw')
}

console.log('I19: 非法当前阶段 fail-close')
{
  let threw = false
  try { evaluateProjectGate(makeProject({ stage: 'NOPE' }), 'RESEARCH') } catch { threw = true }
  assert(threw, 'evaluateProjectGate(非法当前) throw')
}

console.log('I20: SAME 不执行前向检查（verdict=SAME，checks 空）')
{
  const g = evaluateProjectGate(makeProject(), 'PIPELINE')
  assert(g.direction === 'SAME' && g.verdict === 'SAME' && g.checks.length === 0, 'SAME → verdict=SAME, checks 空')
}

console.log('I21: BACKWARD 不执行前向 Gate；store 流转写 stage_change 默认理由，无 gate_override')
{
  const g = evaluateProjectGate(makeProject({ stage: 'OPERATIONS' }), 'COSTING')
  assert(g.direction === 'BACKWARD' && g.verdict === 'BACKWARD' && g.checks.length === 0, 'BACKWARD → verdict=BACKWARD, checks 空（无前向 Gate）')

  const project = makeRealProject('P-GATE-BACK')
  store.setProjectStage(project.id, 'OPERATIONS', '推到运营')
  const before = store.listLogs().filter((l) => l.projectId === project.id && l.kind === 'gate_override').length
  const res = transitionProjectStage({ projectId: project.id, targetStage: 'COSTING' })
  const logs = store.listLogs().filter((l) => l.projectId === project.id)
  assert(res.direction === 'BACKWARD' && store.getProject(project.id).stage === 'COSTING', '回退成功')
  const change = logs.filter((l) => l.kind === 'stage_change')
  const last = change[change.length - 1]
  assert(last && last.to === 'COSTING' && last.reason === '阶段回退', 'stage_change 默认理由「阶段回退」（最新一条）')
  assert(logs.filter((l) => l.kind === 'gate_override').length === before, '回退不产生 gate_override')
}

console.log('I22: RED 推进必填理由——为空 throw、stage 不变、不产生任何日志')
{
  const project = makeRealProject('P-GATE-RED')
  let threw = false
  try {
    transitionProjectStage({ projectId: project.id, targetStage: 'OPERATIONS', deps: { availableModules: {}, scenarios: [] } })
  } catch (e) {
    threw = true
    assert(String(e.message).includes('T6_GATE') && String(e.message).includes('RED'), `错误信息含 T6_GATE/RED (实际 ${e.message})`)
  }
  assert(threw, 'RED 无理由 → throw')
  assert(store.getProject(project.id).stage === 'PIPELINE', 'stage 未改变')
  const extra = store.listLogs().filter((l) => l.projectId === project.id && (l.kind === 'gate_override' || l.kind === 'stage_change'))
  assert(extra.length === 0, '不产生 gate_override / stage_change 日志')
}

console.log(`\n===== Gate 引擎测试结果: ${pass} 通过 / ${fail} 失败 =====\n`)
if (fail > 0) process.exit(1)
