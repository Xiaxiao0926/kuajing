/**
 * tests/ia-project-supply-gate.test.mjs
 * 
 * TASK 07A-2B: Project Supply Chain -> Stage Gate Context Integration
 * 
 * 覆盖：
 * 1. gateEngine.js 架构纯度契约（纯领域评估器，零 Store 导入，零直接数据读取）
 * 2. supplier_quote 检查（未注入 -> NOT_EVALUATED；evaluated:true & quoteCount===0 -> FAIL；quoteCount>0 -> PASS；边界防御）
 * 3. samples_record 检查（未注入 -> NOT_EVALUATED；evaluated:true & sampleCount===0 -> FAIL；sampleCount>0 -> PASS；边界防御）
 * 4. 其他未实现模块严格保持 NOT_EVALUATED（合规/认证/Listing/库存/冷启动）
 * 5. 阶段推进 Gate 判定综合测试（COSTING -> SAMPLING, SAMPLING -> COMPLIANCE, 跨阶段聚合）
 * 6. 调用层 ProjectDetailPage 静态与运行时集成契约（Store 事实解析、gateDeps 统一注入、推进一致性）
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  evaluateProjectGate,
  GATE_RESULTS,
  GATE_VERDICTS,
} from '../ozon-react/src/utils/t6/gateEngine.js'
import { transitionProjectStage } from '../ozon-react/src/utils/t6/stageTransition.js'
import * as store from '../ozon-react/src/utils/t6/t6Store.js'

console.log('===== IA Project Supply Chain Stage Gate Test Suite (TASK 07A-2B) =====\n')

const ROOT = path.resolve('.')
const GATE_PATH = path.join(ROOT, 'ozon-react/src/utils/t6/gateEngine.js')
const DETAIL_PATH = path.join(ROOT, 'ozon-react/src/components/t6/ProjectDetailPage.jsx')

// ==========================================
// PART 1: gateEngine.js 纯领域评估器架构纯度检查
// ==========================================
console.log('--- PART 1: gateEngine.js 纯度与契约检查 ---')

const gateCode = fs.readFileSync(GATE_PATH, 'utf-8')

// 1. gateEngine 严禁导入 t6Store 或直接读取 Store
assert(!gateCode.includes('t6Store'), 'TEST 1A: gateEngine 严禁导入 t6Store')
assert(!gateCode.includes('getProjectSuppliers'), 'TEST 1B: gateEngine 严禁调用 getProjectSuppliers')
assert(!gateCode.includes('getSupplierQuotes'), 'TEST 1C: gateEngine 严禁调用 getSupplierQuotes')
assert(!gateCode.includes('getProjectSamples'), 'TEST 1D: gateEngine 严禁调用 getProjectSamples')
console.log('  ✅ TEST 1: gateEngine 保持纯领域评估器原则（零 Store 导入，零直接数据读取）')

// Helper fixtures
function createMockProject(overrides = {}) {
  return {
    id: 'p-test-101',
    projectCode: 'RU-2026-TEST',
    marketCode: 'RU',
    schemaVersion: 1,
    name: '测试项目',
    source: {
      kind: 'candidate',
      candidateId: 'c1',
      sourceProductId: 'PID-101',
      candidateName: '测试商品',
      category: '日用品',
      creationSnapshotId: 's1',
    },
    lifecycleStatus: 'ACTIVE',
    stage: 'COSTING',
    goLiveAt: null,
    workflow: { templateVersion: 'roadmap-v1', states: [] },
    product: {},
    costing: { scenarios: ['sc1'], baselineScenarioId: 'sc1' },
    logistics: {},
    listing: {},
    launch: {},
    operations: {},
    settlement: {},
    decisionLog: [],
    ...overrides,
  }
}

function createMockScenario({ id = 'sc1', profitRate = 25, price = 1000 } = {}) {
  return {
    id,
    projectId: 'p-test-101',
    platform: 'OZON',
    name: `成本场景-${id}`,
    inputPayload: { price },
    outputPayload: { profit: 200, profitRate },
    resolvedConfig: { calculatorVersion: 'v1' },
  }
}

// ==========================================
// PART 2: supplier_quote 检查行为
// ==========================================
console.log('\n--- PART 2: supplier_quote 检查行为 ---')

// 2. availableModules 未提供 supplier -> NOT_EVALUATED
{
  const proj = createMockProject()
  const g = evaluateProjectGate(proj, 'SAMPLING', {
    scenarios: [createMockScenario()],
  })
  const quoteCheck = g.checks.find((c) => c.id === 'supplier_quote')
  assert(quoteCheck, 'checks 中必须包含 supplier_quote')
  assert.equal(quoteCheck.result, GATE_RESULTS.NOT_EVALUATED, '未注入 supplier 事实时必须返回 NOT_EVALUATED')
  console.log('  ✅ TEST 2: availableModules 未提供时 supplier_quote 返回 NOT_EVALUATED')
}

// 3. availableModules.supplier.evaluated !== true -> NOT_EVALUATED
{
  const proj = createMockProject()
  const g = evaluateProjectGate(proj, 'SAMPLING', {
    availableModules: {
      supplier: { evaluated: false, quoteCount: 0 },
    },
    scenarios: [createMockScenario()],
  })
  const quoteCheck = g.checks.find((c) => c.id === 'supplier_quote')
  assert.equal(quoteCheck.result, GATE_RESULTS.NOT_EVALUATED, 'evaluated !== true 时返回 NOT_EVALUATED')
  console.log('  ✅ TEST 3: evaluated !== true 时 supplier_quote 返回 NOT_EVALUATED')
}

// 4. evaluated: true 且 quoteCount === 0 -> FAIL + 尚无供应商报价
{
  const proj = createMockProject()
  const g = evaluateProjectGate(proj, 'SAMPLING', {
    availableModules: {
      supplier: { evaluated: true, quoteCount: 0 },
    },
    scenarios: [createMockScenario()],
  })
  const quoteCheck = g.checks.find((c) => c.id === 'supplier_quote')
  assert.equal(quoteCheck.result, GATE_RESULTS.FAIL, 'quoteCount === 0 时必须 FAIL')
  assert.equal(quoteCheck.message, '尚无供应商报价')
  assert.equal(g.verdict, GATE_VERDICTS.RED, 'quoteCount === 0 导致 Gate 裁决为 RED')
  assert(g.blockingReasons.includes('尚无供应商报价'), 'blockingReasons 必须包含尚无供应商报价')
  console.log('  ✅ TEST 4: evaluated: true 且 quoteCount === 0 时返回 FAIL 及明确阻断原因')
}

// 5. quoteCount 畸变（undefined / null / NaN / 负数）安全防御 (Fail-close)
{
  for (const invalidCount of [undefined, null, NaN, -1]) {
    const proj = createMockProject()
    const g = evaluateProjectGate(proj, 'SAMPLING', {
      availableModules: {
        supplier: { evaluated: true, quoteCount: invalidCount },
      },
      scenarios: [createMockScenario()],
    })
    const quoteCheck = g.checks.find((c) => c.id === 'supplier_quote')
    assert.equal(quoteCheck.result, GATE_RESULTS.FAIL, `quoteCount = ${invalidCount} 必须判定为 FAIL (Fail-close)`)
  }
  console.log('  ✅ TEST 5: quoteCount 畸变数据安全 Fail-close，不误判 PASS')
}

// 6. evaluated: true 且 quoteCount === 1 -> PASS
{
  const proj = createMockProject()
  const g = evaluateProjectGate(proj, 'SAMPLING', {
    availableModules: {
      supplier: { evaluated: true, quoteCount: 1 },
    },
    scenarios: [createMockScenario()],
  })
  const quoteCheck = g.checks.find((c) => c.id === 'supplier_quote')
  assert.equal(quoteCheck.result, GATE_RESULTS.PASS, 'quoteCount === 1 时必须 PASS')
  console.log('  ✅ TEST 6: evaluated: true 且 quoteCount === 1 时返回 PASS')
}

// 7. evaluated: true 且 quoteCount > 1 -> PASS
{
  const proj = createMockProject()
  const g = evaluateProjectGate(proj, 'SAMPLING', {
    availableModules: {
      supplier: { evaluated: true, quoteCount: 4 },
    },
    scenarios: [createMockScenario()],
  })
  const quoteCheck = g.checks.find((c) => c.id === 'supplier_quote')
  assert.equal(quoteCheck.result, GATE_RESULTS.PASS, 'quoteCount === 4 时必须 PASS')
  console.log('  ✅ TEST 7: evaluated: true 且 quoteCount > 1 时返回 PASS')
}

// ==========================================
// PART 3: samples_record 检查行为
// ==========================================
console.log('\n--- PART 3: samples_record 检查行为 ---')

// 8. availableModules 未提供 samples -> NOT_EVALUATED
{
  const proj = createMockProject({ stage: 'SAMPLING' })
  const g = evaluateProjectGate(proj, 'COMPLIANCE')
  const sampleCheck = g.checks.find((c) => c.id === 'samples_record')
  assert(sampleCheck, 'checks 中必须包含 samples_record')
  assert.equal(sampleCheck.result, GATE_RESULTS.NOT_EVALUATED, '未注入 samples 事实时必须返回 NOT_EVALUATED')
  console.log('  ✅ TEST 8: availableModules 未提供时 samples_record 返回 NOT_EVALUATED')
}

// 9. availableModules.samples.evaluated !== true -> NOT_EVALUATED
{
  const proj = createMockProject({ stage: 'SAMPLING' })
  const g = evaluateProjectGate(proj, 'COMPLIANCE', {
    availableModules: {
      samples: { evaluated: false, sampleCount: 0 },
    },
  })
  const sampleCheck = g.checks.find((c) => c.id === 'samples_record')
  assert.equal(sampleCheck.result, GATE_RESULTS.NOT_EVALUATED, 'evaluated !== true 时返回 NOT_EVALUATED')
  console.log('  ✅ TEST 9: evaluated !== true 时 samples_record 返回 NOT_EVALUATED')
}

// 10. evaluated: true 且 sampleCount === 0 -> FAIL + 尚无打样记录
{
  const proj = createMockProject({ stage: 'SAMPLING' })
  const g = evaluateProjectGate(proj, 'COMPLIANCE', {
    availableModules: {
      samples: { evaluated: true, sampleCount: 0 },
    },
  })
  const sampleCheck = g.checks.find((c) => c.id === 'samples_record')
  assert.equal(sampleCheck.result, GATE_RESULTS.FAIL, 'sampleCount === 0 时必须 FAIL')
  assert.equal(sampleCheck.message, '尚无打样记录')
  assert.equal(g.verdict, GATE_VERDICTS.RED, 'sampleCount === 0 导致 Gate 裁决为 RED')
  assert(g.blockingReasons.includes('尚无打样记录'), 'blockingReasons 必须包含尚无打样记录')
  console.log('  ✅ TEST 10: evaluated: true 且 sampleCount === 0 时返回 FAIL 及明确阻断原因')
}

// 11. sampleCount 畸变数据安全防御 (Fail-close)
{
  for (const invalidCount of [undefined, null, NaN, -2]) {
    const proj = createMockProject({ stage: 'SAMPLING' })
    const g = evaluateProjectGate(proj, 'COMPLIANCE', {
      availableModules: {
        samples: { evaluated: true, sampleCount: invalidCount },
      },
    })
    const sampleCheck = g.checks.find((c) => c.id === 'samples_record')
    assert.equal(sampleCheck.result, GATE_RESULTS.FAIL, `sampleCount = ${invalidCount} 必须判定为 FAIL (Fail-close)`)
  }
  console.log('  ✅ TEST 11: sampleCount 畸变数据安全 Fail-close，不误判 PASS')
}

// 12. evaluated: true 且 sampleCount === 1 -> PASS
{
  const proj = createMockProject({ stage: 'SAMPLING' })
  const g = evaluateProjectGate(proj, 'COMPLIANCE', {
    availableModules: {
      samples: { evaluated: true, sampleCount: 1 },
    },
  })
  const sampleCheck = g.checks.find((c) => c.id === 'samples_record')
  assert.equal(sampleCheck.result, GATE_RESULTS.PASS, 'sampleCount === 1 时必须 PASS')
  console.log('  ✅ TEST 12: evaluated: true 且 sampleCount === 1 时返回 PASS')
}

// 13. evaluated: true 且 sampleCount > 1 -> PASS
{
  const proj = createMockProject({ stage: 'SAMPLING' })
  const g = evaluateProjectGate(proj, 'COMPLIANCE', {
    availableModules: {
      samples: { evaluated: true, sampleCount: 3 },
    },
  })
  const sampleCheck = g.checks.find((c) => c.id === 'samples_record')
  assert.equal(sampleCheck.result, GATE_RESULTS.PASS, 'sampleCount === 3 时必须 PASS')
  console.log('  ✅ TEST 13: evaluated: true 且 sampleCount > 1 时返回 PASS')
}

// ==========================================
// PART 4: 其他未实现模块状态保持
// ==========================================
console.log('\n--- PART 4: 未实现依赖域保护测试 ---')

// 14. 即使 supplier/samples 注入，合规/认证/Listing/库存/冷启动依然 NOT_EVALUATED
{
  const proj = createMockProject({ stage: 'COSTING' })
  const g = evaluateProjectGate(proj, 'OPERATIONS', {
    availableModules: {
      supplier: { evaluated: true, quoteCount: 2 },
      samples: { evaluated: true, sampleCount: 2 },
    },
    scenarios: [createMockScenario()],
  })

  const otherModuleChecks = g.checks.filter((c) => [
    'compliance_pending', 'compliance_done', 'cert_plan',
    'listing_draft', 'stock_plan', 'cold_start',
  ].includes(c.id))

  assert.equal(otherModuleChecks.length, 6, '必须包含 6 个其他模块 checks')
  assert(
    otherModuleChecks.every((c) => c.result === GATE_RESULTS.NOT_EVALUATED),
    '所有后续未实现模块必须严格保持 NOT_EVALUATED，不可伪造 PASS 或误判 FAIL'
  )
  console.log('  ✅ TEST 14: 未实现模块（合规、Listing、运营等）严格保持 NOT_EVALUATED')
}

// ==========================================
// PART 5: 综合阶段推进判定与路径聚合测试
// ==========================================
console.log('\n--- PART 5: 综合阶段推进与路径聚合测试 ---')

// 15. COSTING -> SAMPLING: quoteCount === 0 -> RED
{
  const proj = createMockProject({ stage: 'COSTING' })
  const g = evaluateProjectGate(proj, 'SAMPLING', {
    availableModules: {
      supplier: { evaluated: true, quoteCount: 0 },
    },
    scenarios: [createMockScenario({ profitRate: 20 })],
  })
  assert.equal(g.verdict, GATE_VERDICTS.RED)
  assert(g.blockingReasons.includes('尚无供应商报价'))
  console.log('  ✅ TEST 15: COSTING -> SAMPLING 在无报价时整条路径阻断为 RED')
}

// 16. COSTING -> SAMPLING: quoteCount >= 1 且 毛利率 >= 15% -> GREEN
{
  const proj = createMockProject({ stage: 'COSTING' })
  const g = evaluateProjectGate(proj, 'SAMPLING', {
    availableModules: {
      supplier: { evaluated: true, quoteCount: 1 },
    },
    scenarios: [createMockScenario({ profitRate: 20 })],
  })
  assert.equal(g.verdict, GATE_VERDICTS.GREEN, '报价存在且毛利达标时直通 GREEN')
  assert.equal(g.blockingReasons.length, 0)
  assert.equal(g.warnings.length, 0)
  console.log('  ✅ TEST 16: COSTING -> SAMPLING 在报价就绪且毛利达标时判定为 GREEN')
}

// 17. COSTING -> SAMPLING: quoteCount >= 1 但 毛利率 < 15% -> YELLOW
{
  const proj = createMockProject({ stage: 'COSTING' })
  const g = evaluateProjectGate(proj, 'SAMPLING', {
    availableModules: {
      supplier: { evaluated: true, quoteCount: 1 },
    },
    scenarios: [createMockScenario({ profitRate: 12 })],
  })
  assert.equal(g.verdict, GATE_VERDICTS.YELLOW, '毛利率不足 15% 降级为 YELLOW')
  assert(g.warnings.some(w => w.includes('12% < 15%')))
  console.log('  ✅ TEST 17: COSTING -> SAMPLING 在报价就绪但毛利偏低时准确触发 YELLOW 警示')
}

// 18. SAMPLING -> COMPLIANCE: sampleCount === 0 -> RED
{
  const proj = createMockProject({ stage: 'SAMPLING' })
  const g = evaluateProjectGate(proj, 'COMPLIANCE', {
    availableModules: {
      supplier: { evaluated: true, quoteCount: 2 },
      samples: { evaluated: true, sampleCount: 0 },
    },
  })
  assert.equal(g.verdict, GATE_VERDICTS.RED, '样品记录不存在时判定为 RED')
  assert(g.blockingReasons.includes('尚无打样记录'))
  console.log('  ✅ TEST 18: SAMPLING -> COMPLIANCE 在无打样记录时判定为 RED')
}

// 19. SAMPLING -> COMPLIANCE: sampleCount >= 1, 但 compliance 模块未实现 -> NOT_EVALUATED
{
  const proj = createMockProject({ stage: 'SAMPLING' })
  const g = evaluateProjectGate(proj, 'COMPLIANCE', {
    availableModules: {
      supplier: { evaluated: true, quoteCount: 2 },
      samples: { evaluated: true, sampleCount: 1 },
    },
  })
  assert.equal(g.verdict, GATE_VERDICTS.NOT_EVALUATED, '下游合规模块未实现时，总裁决应为 NOT_EVALUATED（不伪装通过）')
  assert.equal(g.blockingReasons.length, 0, '无 FAIL 项，不产生阻断原因')
  const sampleCheck = g.checks.find(c => c.id === 'samples_record')
  const complianceCheck = g.checks.find(c => c.id === 'compliance_pending')
  assert.equal(sampleCheck.result, GATE_RESULTS.PASS, '样品检查通过')
  assert.equal(complianceCheck.result, GATE_RESULTS.NOT_EVALUATED, '合规检查待实现')
  console.log('  ✅ TEST 19: SAMPLING -> COMPLIANCE 在样品通过但后续域未接入时稳健保持 NOT_EVALUATED')
}

// 20. 跨阶段推进 PIPELINE -> SAMPLING: 路径聚合 [RESEARCH, COSTING, SAMPLING]
{
  const proj = createMockProject({ stage: 'PIPELINE' })
  const g = evaluateProjectGate(proj, 'SAMPLING', {
    snapshot: { scoreResult: { status: [] } },
    scenarios: [createMockScenario({ profitRate: 18 })],
    availableModules: {
      supplier: { evaluated: true, quoteCount: 0 }, // 缺少报价
    },
  })
  assert.equal(g.direction, 'FORWARD')
  assert.deepEqual(g.path, ['RESEARCH', 'COSTING', 'SAMPLING'])
  assert.equal(g.verdict, GATE_VERDICTS.RED)
  assert(g.blockingReasons.includes('尚无供应商报价'))
  console.log('  ✅ TEST 20: 跨阶段长推进路径 [RESEARCH, COSTING, SAMPLING] 正确聚合且捕获供应商报价缺失阻断')
}

// ==========================================
// PART 6: 调用层 ProjectDetailPage 契约与运行时全链路测试
// ==========================================
console.log('\n--- PART 6: 调用层 ProjectDetailPage 契约与运行时测试 ---')

const detailCode = fs.readFileSync(DETAIL_PATH, 'utf-8')

// 21. 静态检查：ProjectDetailPage 必须导入并使用 Store 供应链 API
assert(detailCode.includes('getProjectSuppliers'), 'TEST 21A: ProjectDetailPage 必须导入 getProjectSuppliers')
assert(detailCode.includes('getSupplierQuotes'), 'TEST 21B: ProjectDetailPage 必须导入 getSupplierQuotes')
assert(detailCode.includes('getProjectSamples'), 'TEST 21C: ProjectDetailPage 必须导入 getProjectSamples')
console.log('  ✅ TEST 21: ProjectDetailPage 正确从 t6Store 导入供应链事实查询函数')

// 22. 静态检查：ProjectDetailPage 构造 gateDeps 包含 supplier 与 samples
assert(/supplier:\s*\{\s*evaluated:\s*true,\s*supplierCount:\s*projectSuppliers\.length,\s*quoteCount\b/.test(detailCode), 'TEST 22A: gateDeps.availableModules.supplier 正确装配')
assert(/samples:\s*\{\s*evaluated:\s*true,\s*sampleCount\b/.test(detailCode), 'TEST 22B: gateDeps.availableModules.samples 正确装配')
console.log('  ✅ TEST 22: ProjectDetailPage gateDeps 构造符合 evaluated: true 与统计字段契约')

// 23. 静态检查：advanceStage (transitionProjectStage) 与 evaluateProjectGate 共享同一 gateDeps
assert(/const gate = direction === 'FORWARD'\s*\?\s*evaluateProjectGate\(project,\s*targetStage,\s*gateDeps\)/.test(detailCode), 'TEST 23A: evaluateProjectGate 使用 gateDeps')
assert(/transitionProjectStage\(\{\s*projectId:\s*project\.id,\s*targetStage,\s*deps:\s*gateDeps,\s*reason,\s*\}\)/.test(detailCode), 'TEST 23B: transitionProjectStage 使用相同 gateDeps')
console.log('  ✅ TEST 23: ProjectDetailPage 预览与执行完全使用一致的 gateDeps')

// 24. 运行时行为与阶段推进闭环测试（内存适配器模拟）
{
  const mem = new Map()
  store._setAdapterForTests({
    get: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null),
    set: (k, v) => mem.set(k, JSON.stringify(v)),
    keys: () => [...mem.keys()],
  })

  // 1) 建立项目与快照
  const { candidate } = store.ensureCandidate({
    sourceProductId: 'PID-FULL-01',
    candidateIndex: 0,
    name: '全链路项目商品',
    categoryLeaf: '日用品',
    categoryFull: '家居>日用品',
  })
  const snap = store.createSnapshot({
    candidateId: candidate.id,
    sourceProductId: candidate.sourceProductId,
    sourceInputs: { weight_kg: 0.3, price_rub: 1200 },
    versions: { rulesVersion: '1.0' },
  })
  store.refreshCandidateSnapshot(candidate.id, snap.id)
  const project = store.createProject({ candidateId: candidate.id, creationSnapshotId: snap.id, name: '全链路测试项目' })

  // 2) 创建基线成本场景并推进到 COSTING
  const sc = store.createCostScenario({
    projectId: project.id,
    sourceSnapshotId: snap.id,
    platform: 'OZON',
    name: '场景1',
    inputPayload: { price: 1200 },
    outputPayload: { profit: 300, profitRate: 25 },
    resolvedConfig: { selectedChannel: { id: 'standard', name: '标准渠道' } },
  })
  store.setProjectBaselineScenario(project.id, sc.id)
  store.setProjectStage(project.id, 'COSTING')

  // 3) 此时供应商数量为 0，尝试推进 SAMPLING（模拟 ProjectDetailPage 调用层逻辑）
  const suppliers0 = store.getProjectSuppliers(project.id)
  const quoteCount0 = suppliers0.reduce((sum, sup) => sum + store.getSupplierQuotes(sup.id).length, 0)
  const sampleCount0 = store.getProjectSamples(project.id).length

  const deps0 = {
    availableModules: {
      supplier: { evaluated: true, supplierCount: suppliers0.length, quoteCount: quoteCount0 },
      samples: { evaluated: true, sampleCount: sampleCount0 },
    },
    snapshot: store.getSnapshot(snap.id),
    scenarios: store.getProjectScenarios(project.id),
  }

  // 无理由推进必抛出错误
  let blockedError = null
  try {
    transitionProjectStage({
      projectId: project.id,
      targetStage: 'SAMPLING',
      deps: deps0,
      reason: '',
    })
  } catch (e) {
    blockedError = e
  }
  assert(blockedError, '无报价时无理由推进必须被拦截')
  assert(/RED 推进必须填写理由/.test(blockedError.message), '报错信息必须要求填写理由')

  // 4) 录入供应商与报价
  const sup = store.createSupplier({ projectId: project.id, name: '优质工厂A' })
  store.createSupplierQuote({ supplierId: sup.id, unitPriceCny: 35, currency: 'CNY', moq: 500 })

  // 重新计算调用层事实
  const suppliers1 = store.getProjectSuppliers(project.id)
  const quoteCount1 = suppliers1.reduce((sum, sup) => sum + store.getSupplierQuotes(sup.id).length, 0)
  const sampleCount1 = store.getProjectSamples(project.id).length

  assert.equal(suppliers1.length, 1)
  assert.equal(quoteCount1, 1)

  const deps1 = {
    availableModules: {
      supplier: { evaluated: true, supplierCount: suppliers1.length, quoteCount: quoteCount1 },
      samples: { evaluated: true, sampleCount: sampleCount1 },
    },
    snapshot: store.getSnapshot(snap.id),
    scenarios: store.getProjectScenarios(project.id),
  }

  // 现在有报价且毛利 25%，Gate 为 GREEN，可以无理由平滑推进！
  const result = transitionProjectStage({
    projectId: project.id,
    targetStage: 'SAMPLING',
    deps: deps1,
    reason: '',
  })
  assert.equal(result.project.stage, 'SAMPLING', '项目成功推进至 SAMPLING 阶段')
  assert.equal(result.gate.verdict, GATE_VERDICTS.GREEN, 'Stage Gate 顺利通过（GREEN）')
  console.log('  ✅ TEST 24: 运行时全链路闭环：无报价拦截 (RED) -> 录入报价 -> 顺利推进 SAMPLING (GREEN)')
}

console.log('\n===== All 24 IA Project Supply Gate Tests Passed Successfully! =====\n')
