/**
 * t6/gateEngine.test.mjs — Stage Gate 引擎测试（T6-2A）
 * 运行: node --experimental-vm-modules src/utils/t6/gateEngine.test.mjs
 */
import { evaluateProjectGate, GATE_VERDICTS, GATE_RESULTS } from './gateEngine.js'
import * as store from './t6Store.js'

let pass = 0, fail = 0
const assert = (cond, msg) => { if (cond) { pass++; console.log(`  ✅ ${msg}`) } else { fail++; console.log(`  ❌ ${msg}`) } }

console.log('\n===== Stage Gate 引擎测试 =====\n')

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

console.log('G1: RESEARCH 有立项快照 → GREEN；无快照 → RED')
{
  const g = evaluateProjectGate(makeProject(), 'RESEARCH')
  assert(g.verdict === GATE_VERDICTS.GREEN, `有快照 → GREEN (实际 ${g.verdict})`)
  const noSnap = evaluateProjectGate(makeProject({ source: { ...makeProject().source, creationSnapshotId: null } }), 'RESEARCH')
  assert(noSnap.verdict === GATE_VERDICTS.RED && noSnap.blockingReasons.length > 0, '无快照 → RED + blockingReasons')
}

console.log('G2: 依赖模块未实现 → NOT_EVALUATED（不伪装 PASS，也不当 FAIL）')
{
  const g = evaluateProjectGate(makeProject(), 'COSTING', { availableModules: {} })
  assert(g.verdict === GATE_VERDICTS.NOT_EVALUATED, `COSTING 无模块 → NOT_EVALUATED (实际 ${g.verdict})`)
  assert(g.checks.every((c) => c.result === GATE_RESULTS.NOT_EVALUATED), '全部检查 NOT_EVALUATED')
  assert(g.blockingReasons.length === 0 && g.warnings.length === 0, 'NOT_EVALUATED 不产生 blocking/warning')
}

console.log('G3: hard block——立项快照 BLOCKED_LOGISTICS → 越 PIPELINE 一律 RED')
{
  const snap = { status: ['BLOCKED_LOGISTICS'] }
  const g = evaluateProjectGate(makeProject(), 'SAMPLING', { availableModules: {}, snapshot: snap })
  assert(g.verdict === GATE_VERDICTS.RED, `RED (实际 ${g.verdict})`)
  assert(g.blockingReasons.some((r) => r.includes('不建议进入样品阶段')), '提示不建议进入样品阶段')
  const pip = evaluateProjectGate(makeProject(), 'PIPELINE', { availableModules: {}, snapshot: snap })
  assert(pip.verdict !== GATE_VERDICTS.RED, 'PIPELINE 本身不受 hard block 影响')
}

console.log('G4: 混合结果优先级——OPERATIONS（n20 未完成 FAIL + 模块 NOT_EVALUATED）→ RED')
{
  const g = evaluateProjectGate(makeProject(), 'OPERATIONS', { availableModules: {} })
  assert(g.verdict === GATE_VERDICTS.RED, `RED 优先于 NOT_EVALUATED (实际 ${g.verdict})`)
  assert(g.blockingReasons.includes('尚未完成「商品上架」节点'), '包含 n20 阻塞理由')
  const done = makeProject({ workflow: { templateVersion: 'roadmap-v1', states: [{ nodeId: 'n20', status: 'done', updatedAt: null, updatedBy: null, note: null }] } })
  const g2 = evaluateProjectGate(done, 'OPERATIONS', { availableModules: {} })
  assert(g2.verdict === GATE_VERDICTS.NOT_EVALUATED, 'n20 完成后只剩模块 → NOT_EVALUATED')
}

console.log('G5: REVIEW 无检查 → GREEN；Gate 只建议不自动改 stage')
{
  const project = makeProject()
  const g = evaluateProjectGate(project, 'REVIEW')
  assert(g.verdict === GATE_VERDICTS.GREEN, 'REVIEW → GREEN')
  const before = mem.get('t6.project.p1')
  assert(!before, 'evaluateProjectGate 不产生任何写入')
}

console.log('G6: override 流程——RED 下人工强制推进必须写理由 → DecisionLog(gate_override)')
{
  // 写入一个真实项目走 store 流程
  const { candidate } = store.ensureCandidate({ sourceProductId: 'P-GATE-001', candidateIndex: 0, name: 'x', categoryLeaf: 'x', categoryFull: 'x' })
  const snap = store.buildScoringSnapshot({
    scored: { index: 0, name: 'x', leaf: 'x', categoryFull: 'x', kind: 'exact', totalScore: 70, grade: 'B', gradeTentative: false, context: 'HIGH', evidenceCoverage: 1, dimensions: { demand: { score: 70, weight: 25, available: true, coverage: 1, marketScaleScore: 60, candidateStrengthScore: 80 } }, supplyGap: null, status: [], decision: { status: 'ELIGIBLE', action: 'PILOT_TEST', reason: 'x' }, ruleVersion: '1.0', matchedProductType: null, benchmarkSampleSize: null, strengths: [], risks: [], missingMetrics: [] },
    canonical: { source_product_id: 'P-GATE-001', category_leaf: 'x', category_full: 'x', price_rub: 100, avg_price_rub: 100, sales_rub_28d: 1, units_28d: 1, conv_rate: 0, cart_add_rate: 0, exposure: 0, card_visits: 0, reviews: 0, gross_margin: 10, commission_fbs: null, commission_fbo: null, commission_rfbs: null, commission_fbp: null, ad_share: null, weight_kg: 0.1, dims: [10, 10, 10], ship_mode: 'FBO', sign_rate: null, oos_days_share: null, stock: null, turnover: null, revenue_loss_rate: null },
    benchmarkMeta: { version: '1.0', generated_at: 't' },
    benchmarkDoc: { product_types: {} },
    rules: { version: '1.0' },
    datasetVersion: 't',
    candidateId: candidate.id,
  })
  store.refreshCandidateSnapshot(candidate.id, snap.id)
  const project = store.createProject({ candidateId: candidate.id, creationSnapshotId: snap.id })
  // RED 路径强制推进：写理由
  store.appendLog({ subjectType: 'project', subjectId: project.id, projectId: project.id, kind: 'gate_override', from: project.stage, to: 'COSTING', reason: '强制推进：物流风险已知，先做成本测算' })
  store.setProjectStage(project.id, 'COSTING', '强制推进：物流风险已知，先做成本测算')
  const logs = store.listLogs().filter((l) => l.projectId === project.id)
  assert(logs.some((l) => l.kind === 'gate_override'), '存在 gate_override 日志')
  assert(store.getProject(project.id).stage === 'COSTING', 'stage 已推进（Gate 只建议，人工决定）')
}

console.log(`\n===== Gate 引擎测试结果: ${pass} 通过 / ${fail} 失败 =====\n`)
if (fail > 0) process.exit(1)
