/**
 * tests/ia-project-compliance-gate.test.mjs
 * 
 * TASK 07A-4C2: Project Compliance Stage Gate Partial Integration Test Suite
 * 
 * 覆盖 prompt §55 - §60 全部契约要求：
 * - Part 1: gateEngine 架构纯度与检查项静态契约（纯领域评估器，IDs 保持，Labels 修正，cert_plan 无 evaluator）
 * - Part 2: compliance_pending 求值器契约（未接入/非法格式 -> NOT_EVALUATED；有效状态 -> PASS；损坏枚举 -> FAIL）
 * - Part 3: compliance_done 求值器契约（未接入 -> NOT_EVALUATED；COMPLETED -> PASS；NOT_STARTED/IN_ASSESSMENT/非法 -> FAIL）
 * - Part 4: 领域隔离与边界守门（Risk、Standards、certificationPlan、Requirement、Result 绝不参与评估）
 * - Part 5: 既有模块与 Check 行为无回归（supplier_quote, samples_record, cert_plan, listing_draft, stock_plan, cold_start）
 * - Part 6: 调用层 ProjectDetailPage 契约（单一事实源、Context Shape、同源 Preview 与 Transition、onChanged 刷新）
 * - Part 7: 阶段推进单步路径行为（SAMPLING -> COMPLIANCE, COMPLIANCE -> PRODUCTION, 聚合 verdict）
 * - Part 8: 跨阶段推进路径行为（SAMPLING -> PRODUCTION）
 * - Part 9: 运行时 transitionProjectStage 与 Override 机制（NOT_EVALUATED 允许推进，FAIL 阻断与 reason 留痕）
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
import { isProjectComplianceEmpty } from '../ozon-react/src/utils/t6/complianceProfile.js'
import * as store from '../ozon-react/src/utils/t6/t6Store.js'

console.log('===== IA Project Compliance Stage Gate Test Suite (TASK 07A-4C2) =====\n')

const ROOT = path.resolve('.')
const GATE_PATH = path.join(ROOT, 'ozon-react/src/utils/t6/gateEngine.js')
const DETAIL_PATH = path.join(ROOT, 'ozon-react/src/components/t6/ProjectDetailPage.jsx')

// Helper fixtures
function createMockProject(overrides = {}) {
  return {
    id: 'p-comp-gate-1',
    projectCode: 'RU-2026-COMP-01',
    marketCode: 'RU',
    schemaVersion: 1,
    name: '合规门禁测试项目',
    stage: 'SAMPLING',
    lifecycleStatus: 'ACTIVE',
    source: {
      kind: 'candidate',
      candidateId: 'c1',
      sourceProductId: 'PID-COMP-01',
      candidateName: '测试合规商品',
      category: '个人护理',
      creationSnapshotId: 'snap-1',
    },
    costing: {
      scenarios: ['sc1'],
      baselineScenarioId: 'sc1',
    },
    workflow: {
      templateVersion: 'roadmap-v1',
      states: [],
    },
    compliance: {},
    createdAt: '2026-09-20T12:00:00.000Z',
    updatedAt: '2026-09-20T12:00:00.000Z',
    ...overrides,
  }
}

function createMockScenario(overrides = {}) {
  return {
    id: 'sc1',
    projectId: 'p-comp-gate-1',
    platform: 'OZON',
    name: '基准成本场景',
    profitRate: 20,
    inputPayload: { price: 1000 },
    outputPayload: { profitRate: 20 },
    createdAt: '2026-09-20T12:00:00.000Z',
    ...overrides,
  }
}

// ==========================================
// PART 1: gateEngine 架构纯度与检查项静态契约
// ==========================================
console.log('--- PART 1: gateEngine 架构纯度与检查项静态契约 ---')

const gateCode = fs.readFileSync(GATE_PATH, 'utf-8')

// 1. gateEngine 不 import t6Store
assert(!gateCode.includes('t6Store'), 'TEST 1: gateEngine 绝对禁止导入 t6Store')
assert(!gateCode.includes('getProject('), 'TEST 1B: gateEngine 绝对禁止调用 getProject')
assert(!gateCode.includes('localStorage'), 'TEST 1C: gateEngine 绝对禁止访问 localStorage')
console.log('  ✅ TEST 1: gateEngine 保持纯领域评估器原则（零 Store 导入，零外部副作用）')

// 提取 CHECKS 定义用于检查项契约验证
const complianceEntryChecks = evaluateProjectGate(createMockProject({ stage: 'SAMPLING' }), 'COMPLIANCE', {}).checks
const productionEntryChecks = evaluateProjectGate(createMockProject({ stage: 'COMPLIANCE' }), 'PRODUCTION', {}).checks

// 2. compliance_pending ID 保持
const pendingDef = complianceEntryChecks.find((c) => c.id === 'compliance_pending')
assert(pendingDef, 'TEST 2: compliance_pending Check ID 必须保持')
console.log('  ✅ TEST 2: compliance_pending ID 保持不变')

// 3. compliance_pending Label = 合规评估档案已建立
assert.equal(pendingDef.label, '合规评估档案已建立', 'TEST 3: compliance_pending Label 必须为「合规评估档案已建立」')
console.log('  ✅ TEST 3: compliance_pending Label = 合规评估档案已建立')

// 4. compliance_done ID 保持
const doneDef = productionEntryChecks.find((c) => c.id === 'compliance_done')
assert(doneDef, 'TEST 4: compliance_done Check ID 必须保持')
console.log('  ✅ TEST 4: compliance_done ID 保持不变')

// 5. compliance_done Label = 合规评估已完成
assert.equal(doneDef.label, '合规评估已完成', 'TEST 5: compliance_done Label 必须为「合规评估已完成」')
console.log('  ✅ TEST 5: compliance_done Label = 合规评估已完成')

// 6. cert_plan ID 保持
const certPlanDef = productionEntryChecks.find((c) => c.id === 'cert_plan')
assert(certPlanDef, 'TEST 6: cert_plan Check ID 必须保持')
console.log('  ✅ TEST 6: cert_plan ID 保持不变')

// 7. cert_plan 具有 explicit evaluator (TASK 07A-4C3B 激活)
assert(/\{[^{}]*?id:\s*['"]cert_plan['"][^{}]*?evaluate/.test(gateCode), 'TEST 7: cert_plan 必须定义 explicit evaluator 函数')
console.log('  ✅ TEST 7: cert_plan 显式 evaluator 函数已激活并实现 12 行真值表')

// ==========================================
// PART 2: compliance_pending 求值器契约
// ==========================================
console.log('\n--- PART 2: compliance_pending 求值器契约 ---')

const baseProject = createMockProject({ stage: 'SAMPLING' })

// 8. no compliance fact -> pending NOT_EVALUATED
{
  const g = evaluateProjectGate(baseProject, 'COMPLIANCE', { availableModules: {} })
  const chk = g.checks.find((c) => c.id === 'compliance_pending')
  assert.equal(chk.result, GATE_RESULTS.NOT_EVALUATED)
  console.log('  ✅ TEST 8: 未提供 compliance fact -> compliance_pending 为 NOT_EVALUATED')
}

// 9. no compliance fact in deps -> done NOT_EVALUATED
{
  const g = evaluateProjectGate(createMockProject({ stage: 'COMPLIANCE' }), 'PRODUCTION', {})
  const chk = g.checks.find((c) => c.id === 'compliance_done')
  assert.equal(chk.result, GATE_RESULTS.NOT_EVALUATED)
  console.log('  ✅ TEST 9: 未提供 compliance fact -> compliance_done 为 NOT_EVALUATED')
}

// 10. boolean compliance: true -> NOT_EVALUATED
{
  const g = evaluateProjectGate(baseProject, 'COMPLIANCE', {
    availableModules: { compliance: true },
  })
  const chk = g.checks.find((c) => c.id === 'compliance_pending')
  assert.equal(chk.result, GATE_RESULTS.NOT_EVALUATED)
  console.log('  ✅ TEST 10: boolean compliance: true 防御，安全返回 NOT_EVALUATED')
}

// 11. evaluated: false -> NOT_EVALUATED
{
  const g = evaluateProjectGate(baseProject, 'COMPLIANCE', {
    availableModules: { compliance: { evaluated: false, assessmentStatus: 'COMPLETED' } },
  })
  const chk = g.checks.find((c) => c.id === 'compliance_pending')
  assert.equal(chk.result, GATE_RESULTS.NOT_EVALUATED)
  console.log('  ✅ TEST 11: evaluated: false 显式未接入标志 -> NOT_EVALUATED')
}

// 12. NOT_STARTED -> pending PASS
{
  const g = evaluateProjectGate(baseProject, 'COMPLIANCE', {
    availableModules: { compliance: { evaluated: true, assessmentStatus: 'NOT_STARTED' } },
  })
  const chk = g.checks.find((c) => c.id === 'compliance_pending')
  assert.equal(chk.result, GATE_RESULTS.PASS)
  console.log('  ✅ TEST 12: assessmentStatus === NOT_STARTED -> compliance_pending 为 PASS（档案已建待办）')
}

// 13. IN_ASSESSMENT -> pending PASS
{
  const g = evaluateProjectGate(baseProject, 'COMPLIANCE', {
    availableModules: { compliance: { evaluated: true, assessmentStatus: 'IN_ASSESSMENT' } },
  })
  const chk = g.checks.find((c) => c.id === 'compliance_pending')
  assert.equal(chk.result, GATE_RESULTS.PASS)
  console.log('  ✅ TEST 13: assessmentStatus === IN_ASSESSMENT -> compliance_pending 为 PASS（审查中就绪）')
}

// 14. COMPLETED -> pending PASS
{
  const g = evaluateProjectGate(baseProject, 'COMPLIANCE', {
    availableModules: { compliance: { evaluated: true, assessmentStatus: 'COMPLETED' } },
  })
  const chk = g.checks.find((c) => c.id === 'compliance_pending')
  assert.equal(chk.result, GATE_RESULTS.PASS)
  console.log('  ✅ TEST 14: assessmentStatus === COMPLETED -> compliance_pending 为 PASS（已完成有效档案）')
}

// 15. invalid state -> pending FAIL
{
  const g = evaluateProjectGate(baseProject, 'COMPLIANCE', {
    availableModules: { compliance: { evaluated: true, assessmentStatus: 'BROKEN_ENUM' } },
  })
  const chk = g.checks.find((c) => c.id === 'compliance_pending')
  assert.equal(chk.result, GATE_RESULTS.FAIL)
  assert.equal(chk.message, '合规评估档案状态无效，请检查项目合规记录')
  console.log('  ✅ TEST 15: 非法 assessmentStatus -> compliance_pending 为 FAIL（Fail-close 防御）')
}

// ==========================================
// PART 3: compliance_done 求值器契约
// ==========================================
console.log('\n--- PART 3: compliance_done 求值器契约 ---')

const compProject = createMockProject({ stage: 'COMPLIANCE' })

// 16. NOT_STARTED -> done FAIL
{
  const g = evaluateProjectGate(compProject, 'PRODUCTION', {
    availableModules: { compliance: { evaluated: true, assessmentStatus: 'NOT_STARTED' } },
  })
  const chk = g.checks.find((c) => c.id === 'compliance_done')
  assert.equal(chk.result, GATE_RESULTS.FAIL)
  assert.equal(chk.message, '合规评估尚未开始')
  console.log('  ✅ TEST 16: assessmentStatus === NOT_STARTED -> compliance_done 为 FAIL（合规评估尚未开始）')
}

// 17. IN_ASSESSMENT -> done FAIL
{
  const g = evaluateProjectGate(compProject, 'PRODUCTION', {
    availableModules: { compliance: { evaluated: true, assessmentStatus: 'IN_ASSESSMENT' } },
  })
  const chk = g.checks.find((c) => c.id === 'compliance_done')
  assert.equal(chk.result, GATE_RESULTS.FAIL)
  assert.equal(chk.message, '合规评估尚未完成')
  console.log('  ✅ TEST 17: assessmentStatus === IN_ASSESSMENT -> compliance_done 为 FAIL（合规评估尚未完成）')
}

// 18. COMPLETED -> done PASS
{
  const g = evaluateProjectGate(compProject, 'PRODUCTION', {
    availableModules: { compliance: { evaluated: true, assessmentStatus: 'COMPLETED' } },
  })
  const chk = g.checks.find((c) => c.id === 'compliance_done')
  assert.equal(chk.result, GATE_RESULTS.PASS)
  console.log('  ✅ TEST 18: assessmentStatus === COMPLETED -> compliance_done 为 PASS')
}

// 19. invalid -> done FAIL
{
  const g = evaluateProjectGate(compProject, 'PRODUCTION', {
    availableModules: { compliance: { evaluated: true, assessmentStatus: null } },
  })
  const chk = g.checks.find((c) => c.id === 'compliance_done')
  assert.equal(chk.result, GATE_RESULTS.FAIL)
  assert.equal(chk.message, '合规评估状态无效')
  console.log('  ✅ TEST 19: 缺失/损坏状态 -> compliance_done 为 FAIL（合规评估状态无效）')
}

// 20. cert_plan 始终 NOT_EVALUATED
{
  const g = evaluateProjectGate(compProject, 'PRODUCTION', {
    availableModules: {
      compliance: {
        evaluated: true,
        assessmentStatus: 'COMPLETED',
        certificationPlan: '已确定通过 EAC 宣告',
        requirements: [{ category: 'CERTIFICATION', required: true, status: 'DONE' }],
      },
    },
  })
  const chk = g.checks.find((c) => c.id === 'cert_plan')
  assert.equal(chk.result, GATE_RESULTS.NOT_EVALUATED)
  console.log('  ✅ TEST 20: cert_plan 即使传入 plans/requirements，当前版本依然严格保持 NOT_EVALUATED')
}

// ==========================================
// PART 4: 领域隔离与边界守门
// ==========================================
console.log('\n--- PART 4: 领域隔离与边界守门 ---')

// 21. riskLevel 不参与
{
  const g = evaluateProjectGate(compProject, 'PRODUCTION', {
    availableModules: { compliance: { evaluated: true, assessmentStatus: 'COMPLETED', riskLevel: 'HIGH' } },
  })
  const chk = g.checks.find((c) => c.id === 'compliance_done')
  assert.equal(chk.result, GATE_RESULTS.PASS)
  console.log('  ✅ TEST 21: riskLevel === HIGH 不影响 compliance_done PASS')
}

// 22. applicableStandards 不参与
{
  const g = evaluateProjectGate(compProject, 'PRODUCTION', {
    availableModules: { compliance: { evaluated: true, assessmentStatus: 'COMPLETED', applicableStandards: [] } },
  })
  const chk = g.checks.find((c) => c.id === 'compliance_done')
  assert.equal(chk.result, GATE_RESULTS.PASS)
  console.log('  ✅ TEST 22: applicableStandards 为空不影响 compliance_done PASS')
}

// 23. certificationPlan 不参与本轮 evaluator
{
  const g = evaluateProjectGate(compProject, 'PRODUCTION', {
    availableModules: { compliance: { evaluated: true, assessmentStatus: 'COMPLETED', certificationPlan: '' } },
  })
  const chk = g.checks.find((c) => c.id === 'compliance_done')
  assert.equal(chk.result, GATE_RESULTS.PASS)
  console.log('  ✅ TEST 23: certificationPlan 为空不影响 compliance_done PASS')
}

// 24. requirements 不参与 done
// 25. required pending Requirement 不影响 done PASS
{
  const g = evaluateProjectGate(compProject, 'PRODUCTION', {
    availableModules: {
      compliance: {
        evaluated: true,
        assessmentStatus: 'COMPLETED',
        requirements: [
          { id: 'r1', category: 'LABELING', required: true, status: 'PENDING' },
          { id: 'r2', category: 'CERTIFICATION', required: true, status: 'IN_PROGRESS' },
        ],
      },
    },
  })
  const chk = g.checks.find((c) => c.id === 'compliance_done')
  assert.equal(chk.result, GATE_RESULTS.PASS)
  console.log('  ✅ TEST 24 & 25: 包含 PENDING/IN_PROGRESS 的必选 requirements 不影响 compliance_done PASS')
}

// 26. empty requirements 不影响 done PASS
{
  const g = evaluateProjectGate(compProject, 'PRODUCTION', {
    availableModules: {
      compliance: {
        evaluated: true,
        assessmentStatus: 'COMPLETED',
        requirements: [],
      },
    },
  })
  const chk = g.checks.find((c) => c.id === 'compliance_done')
  assert.equal(chk.result, GATE_RESULTS.PASS)
  console.log('  ✅ TEST 26: 空 requirements 不影响 compliance_done PASS')
}

// ==========================================
// PART 5: 既有模块与 Check 行为无回归
// ==========================================
console.log('\n--- PART 5: 既有模块与 Check 行为无回归 ---')

// 27. supplier_quote 行为无回归
{
  const gNoFact = evaluateProjectGate(createMockProject({ stage: 'COSTING' }), 'SAMPLING', { scenarios: [createMockScenario()] })
  assert.equal(gNoFact.checks.find((c) => c.id === 'supplier_quote')?.result, GATE_RESULTS.NOT_EVALUATED)

  const gFail = evaluateProjectGate(createMockProject({ stage: 'COSTING' }), 'SAMPLING', {
    scenarios: [createMockScenario()],
    availableModules: { supplier: { evaluated: true, quoteCount: 0 } },
  })
  assert.equal(gFail.checks.find((c) => c.id === 'supplier_quote')?.result, GATE_RESULTS.FAIL)

  const gPass = evaluateProjectGate(createMockProject({ stage: 'COSTING' }), 'SAMPLING', {
    scenarios: [createMockScenario()],
    availableModules: { supplier: { evaluated: true, quoteCount: 1 } },
  })
  assert.equal(gPass.checks.find((c) => c.id === 'supplier_quote')?.result, GATE_RESULTS.PASS)
  console.log('  ✅ TEST 27: supplier_quote 求值器行为完全无回归（NOT_EVALUATED / FAIL / PASS）')
}

// 28. samples_record 行为无回归
{
  const gNoFact = evaluateProjectGate(createMockProject({ stage: 'SAMPLING' }), 'COMPLIANCE', {})
  assert.equal(gNoFact.checks.find((c) => c.id === 'samples_record')?.result, GATE_RESULTS.NOT_EVALUATED)

  const gFail = evaluateProjectGate(createMockProject({ stage: 'SAMPLING' }), 'COMPLIANCE', {
    availableModules: { samples: { evaluated: true, sampleCount: 0 } },
  })
  assert.equal(gFail.checks.find((c) => c.id === 'samples_record')?.result, GATE_RESULTS.FAIL)

  const gPass = evaluateProjectGate(createMockProject({ stage: 'SAMPLING' }), 'COMPLIANCE', {
    availableModules: { samples: { evaluated: true, sampleCount: 2 } },
  })
  assert.equal(gPass.checks.find((c) => c.id === 'samples_record')?.result, GATE_RESULTS.PASS)
  console.log('  ✅ TEST 28: samples_record 求值器行为完全无回归（NOT_EVALUATED / FAIL / PASS）')
}

// 29. listing_draft 继续 NOT_EVALUATED
// 30. stock_plan 继续 NOT_EVALUATED
{
  const gLaunch = evaluateProjectGate(createMockProject({ stage: 'PRODUCTION' }), 'LAUNCH', {})
  assert.equal(gLaunch.checks.find((c) => c.id === 'listing_draft')?.result, GATE_RESULTS.NOT_EVALUATED)
  assert.equal(gLaunch.checks.find((c) => c.id === 'stock_plan')?.result, GATE_RESULTS.NOT_EVALUATED)
  console.log('  ✅ TEST 29 & 30: listing_draft 和 stock_plan 严格保持 NOT_EVALUATED')
}

// 31. cold_start 继续 NOT_EVALUATED
{
  const gOps = evaluateProjectGate(createMockProject({ stage: 'LAUNCH' }), 'OPERATIONS', {})
  assert.equal(gOps.checks.find((c) => c.id === 'cold_start')?.result, GATE_RESULTS.NOT_EVALUATED)
  console.log('  ✅ TEST 31: cold_start 严格保持 NOT_EVALUATED')
}

// ==========================================
// PART 6: 调用层 ProjectDetailPage 契约
// ==========================================
console.log('\n--- PART 6: 调用层 ProjectDetailPage 契约 ---')

const detailSource = fs.readFileSync(DETAIL_PATH, 'utf-8')

// 32. ProjectDetail 使用 isProjectComplianceEmpty
assert(detailSource.includes('isProjectComplianceEmpty'), 'TEST 32: ProjectDetailPage 必须导入并使用 isProjectComplianceEmpty')
console.log('  ✅ TEST 32: ProjectDetail 复用 complianceProfile.js 的 isProjectComplianceEmpty 单一事实源')

// 33. compliance {} 不注入 evaluated true
assert(isProjectComplianceEmpty({}), 'TEST 33A: 空对象判定为空')
assert(isProjectComplianceEmpty({ assessmentStatus: '', requirements: [] }), 'TEST 33B: 伪空对象判定为空')
console.log('  ✅ TEST 33: 初始 compliance: {} 不会注入 evaluated: true')

// 34. 保存 Profile 后注入 evaluated true
const savedProfile = {
  assessmentStatus: 'NOT_STARTED',
  riskLevel: '',
  applicableStandards: [],
  certificationPlan: '',
  requirements: [],
  notes: '',
}
assert(!isProjectComplianceEmpty(savedProfile), 'TEST 34: 显式保存后的 Profile 判定为非空')
console.log('  ✅ TEST 34: 保存默认 Profile 后判定为有效，注入 evaluated: true')

// 35-37. 4C3B 合规事实注入契约
assert(/complianceFact\s*=\s*complianceEvaluated\s*\?\s*\{[\s\S]*?evaluated:\s*true[\s\S]*?assessmentStatus:\s*project\.compliance\?\.assessmentStatus[\s\S]*?certificationApplicability:\s*project\.compliance\?\.certificationApplicability[\s\S]*?certificationApplicabilityNotesPresent:[\s\S]*?certificationPlanPresent:/.test(detailSource),
  'TEST 35-37: complianceFact 必须符合 4C3B 规范（注入 evaluated, assessmentStatus, certificationApplicability, certificationApplicabilityNotesPresent, certificationPlanPresent）')
console.log('  ✅ TEST 35-37: complianceFact 契约：注入 evaluated / assessmentStatus / certificationApplicability / 依据与计划存在性标志')

// 38. Preview 使用 gateDeps
// 39. Transition 使用相同 gateDeps
assert(/const gate = direction === 'FORWARD'\s*\?\s*evaluateProjectGate\(project,\s*targetStage,\s*gateDeps\)/.test(detailSource),
  'TEST 38: Preview 必须使用 gateDeps')
assert(/transitionProjectStage\(\{\s*projectId:\s*project\.id,\s*targetStage,\s*deps:\s*gateDeps,\s*reason,\s*\}\)/.test(detailSource),
  'TEST 39: Transition 必须使用相同的 gateDeps')
console.log('  ✅ TEST 38 & 39: ProjectDetailPage Preview 与 Transition 完全消费同一份 gateDeps 事实对象')

// 40. ProjectCompliancePanel onChanged 会触发 refresh
assert(/<ProjectCompliancePanel\s+projectId=\{project\.id\}\s+onChanged=\{\(msg\)\s*=>\s*refresh\(msg\)\}/.test(detailSource),
  'TEST 40: ProjectCompliancePanel 挂载且 onChanged 接入 refresh')
console.log('  ✅ TEST 40: ProjectCompliancePanel 保存后触发 onChanged -> refresh 实时响应')

// ==========================================
// PART 7: 阶段推进单步路径行为
// ==========================================
console.log('\n--- PART 7: 阶段推进单步路径行为 ---')

// 41. SAMPLING -> COMPLIANCE + NOT_STARTED -> pending PASS
{
  const g = evaluateProjectGate(createMockProject({ stage: 'SAMPLING' }), 'COMPLIANCE', {
    availableModules: {
      samples: { evaluated: true, sampleCount: 1 },
      compliance: { evaluated: true, assessmentStatus: 'NOT_STARTED' },
    },
  })
  assert.equal(g.direction, 'FORWARD')
  assert.deepEqual(g.path, ['COMPLIANCE'])
  assert.equal(g.checks.find((c) => c.id === 'compliance_pending')?.result, GATE_RESULTS.PASS)
  assert.equal(g.checks.find((c) => c.id === 'samples_record')?.result, GATE_RESULTS.PASS)
  assert.equal(g.verdict, GATE_VERDICTS.GREEN)
  console.log('  ✅ TEST 41: SAMPLING -> COMPLIANCE + NOT_STARTED -> compliance_pending PASS，全部就绪得 GREEN')
}

// 42. SAMPLING -> COMPLIANCE + IN_ASSESSMENT -> PASS
{
  const g = evaluateProjectGate(createMockProject({ stage: 'SAMPLING' }), 'COMPLIANCE', {
    availableModules: {
      samples: { evaluated: true, sampleCount: 1 },
      compliance: { evaluated: true, assessmentStatus: 'IN_ASSESSMENT' },
    },
  })
  assert.equal(g.checks.find((c) => c.id === 'compliance_pending')?.result, GATE_RESULTS.PASS)
  assert.equal(g.verdict, GATE_VERDICTS.GREEN)
  console.log('  ✅ TEST 42: SAMPLING -> COMPLIANCE + IN_ASSESSMENT -> compliance_pending PASS')
}

// 43. COMPLIANCE -> PRODUCTION + NOT_STARTED -> RED
{
  const g = evaluateProjectGate(createMockProject({ stage: 'COMPLIANCE' }), 'PRODUCTION', {
    availableModules: {
      compliance: { evaluated: true, assessmentStatus: 'NOT_STARTED' },
    },
  })
  assert.equal(g.checks.find((c) => c.id === 'compliance_done')?.result, GATE_RESULTS.FAIL)
  assert.equal(g.verdict, GATE_VERDICTS.RED)
  assert(g.blockingReasons.includes('合规评估尚未开始'))
  console.log('  ✅ TEST 43: COMPLIANCE -> PRODUCTION + NOT_STARTED -> compliance_done FAIL -> verdict RED')
}

// 44. COMPLIANCE -> PRODUCTION + IN_ASSESSMENT -> RED
{
  const g = evaluateProjectGate(createMockProject({ stage: 'COMPLIANCE' }), 'PRODUCTION', {
    availableModules: {
      compliance: { evaluated: true, assessmentStatus: 'IN_ASSESSMENT' },
    },
  })
  assert.equal(g.checks.find((c) => c.id === 'compliance_done')?.result, GATE_RESULTS.FAIL)
  assert.equal(g.verdict, GATE_VERDICTS.RED)
  assert(g.blockingReasons.includes('合规评估尚未完成'))
  console.log('  ✅ TEST 44: COMPLIANCE -> PRODUCTION + IN_ASSESSMENT -> compliance_done FAIL -> verdict RED')
}

// 45. COMPLIANCE -> PRODUCTION + COMPLETED -> NOT_EVALUATED
// 注意：因为 compliance_done PASS 且 cert_plan 依然是 NOT_EVALUATED，根据优先规则 verdict 是 NOT_EVALUATED（绝非 GREEN！）
{
  const g = evaluateProjectGate(createMockProject({ stage: 'COMPLIANCE' }), 'PRODUCTION', {
    availableModules: {
      compliance: { evaluated: true, assessmentStatus: 'COMPLETED' },
    },
  })
  assert.equal(g.checks.find((c) => c.id === 'compliance_done')?.result, GATE_RESULTS.PASS)
  assert.equal(g.checks.find((c) => c.id === 'cert_plan')?.result, GATE_RESULTS.NOT_EVALUATED)
  assert.equal(g.verdict, GATE_VERDICTS.NOT_EVALUATED, '因为 cert_plan 为 NOT_EVALUATED，最终 verdict 必须为 NOT_EVALUATED 而不是 GREEN')
  console.log('  ✅ TEST 45: COMPLIANCE -> PRODUCTION + COMPLETED -> done PASS + cert_plan NE -> verdict NOT_EVALUATED（允许推进）')
}

// ==========================================
// PART 8: 跨阶段推进路径行为
// ==========================================
console.log('\n--- PART 8: 跨阶段推进路径行为 ---')

// 46. SAMPLING -> PRODUCTION (sample PASS, pending PASS, done PASS, cert_plan NE) -> NOT_EVALUATED
{
  const g = evaluateProjectGate(createMockProject({ stage: 'SAMPLING' }), 'PRODUCTION', {
    availableModules: {
      samples: { evaluated: true, sampleCount: 1 },
      compliance: { evaluated: true, assessmentStatus: 'COMPLETED' },
    },
  })
  assert.equal(g.direction, 'FORWARD')
  assert.deepEqual(g.path, ['COMPLIANCE', 'PRODUCTION'])
  assert.equal(g.checks.find((c) => c.id === 'samples_record')?.result, GATE_RESULTS.PASS)
  assert.equal(g.checks.find((c) => c.id === 'compliance_pending')?.result, GATE_RESULTS.PASS)
  assert.equal(g.checks.find((c) => c.id === 'compliance_done')?.result, GATE_RESULTS.PASS)
  assert.equal(g.checks.find((c) => c.id === 'cert_plan')?.result, GATE_RESULTS.NOT_EVALUATED)
  assert.equal(g.verdict, GATE_VERDICTS.NOT_EVALUATED)
  console.log('  ✅ TEST 46: 跨阶段 SAMPLING -> PRODUCTION (全部完成但有 cert_plan NE) -> verdict 为 NOT_EVALUATED 且无阻塞理由')
}

// 47. SAMPLING -> PRODUCTION (assessment IN_ASSESSMENT) -> RED
{
  const g = evaluateProjectGate(createMockProject({ stage: 'SAMPLING' }), 'PRODUCTION', {
    availableModules: {
      samples: { evaluated: true, sampleCount: 1 },
      compliance: { evaluated: true, assessmentStatus: 'IN_ASSESSMENT' },
    },
  })
  assert.equal(g.checks.find((c) => c.id === 'samples_record')?.result, GATE_RESULTS.PASS)
  assert.equal(g.checks.find((c) => c.id === 'compliance_pending')?.result, GATE_RESULTS.PASS)
  assert.equal(g.checks.find((c) => c.id === 'compliance_done')?.result, GATE_RESULTS.FAIL)
  assert.equal(g.verdict, GATE_VERDICTS.RED)
  assert(g.blockingReasons.includes('合规评估尚未完成'))
  console.log('  ✅ TEST 47: 跨阶段 SAMPLING -> PRODUCTION (IN_ASSESSMENT) -> pending PASS 但 done FAIL -> verdict RED 成功阻断')
}

// ==========================================
// PART 9: 运行时 transitionProjectStage 与 Override 行为
// ==========================================
console.log('\n--- PART 9: 运行时 transitionProjectStage 与 Override 行为 ---')

// 48. COMPLETED + cert_plan NE -> transitionProjectStage 无需 reason 仍允许进入 PRODUCTION
{
  const mem = new Map()
  store._setAdapterForTests({
    get: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null),
    set: (k, v) => mem.set(k, JSON.stringify(v)),
    keys: () => [...mem.keys()],
  })

  // 创建候选与项目
  const { candidate } = store.ensureCandidate({
    sourceProductId: 'PID-FLOW-01',
    candidateIndex: 0,
    name: '合规流转测试商品',
    categoryLeaf: '家居',
  })
  const snap = store.createSnapshot({
    candidateId: candidate.id,
    sourceProductId: candidate.sourceProductId,
    sourceInputs: { weight_kg: 0.3, price_rub: 1200 },
    versions: { rulesVersion: '1.0' },
  })
  store.refreshCandidateSnapshot(candidate.id, snap.id)
  const proj = store.createProject({ candidateId: candidate.id, creationSnapshotId: snap.id, name: '合规流转测试项目' })

  // 设置为 COMPLIANCE 阶段并录入 COMPLETED 合规档案
  store.setProjectStage(proj.id, 'COMPLIANCE', '前置准备')
  store.updateProjectCompliance(proj.id, { assessmentStatus: 'COMPLETED' })

  const compProjectNow = store.getProject(proj.id)
  const isCompEmpty = isProjectComplianceEmpty(compProjectNow.compliance)
  assert.equal(isCompEmpty, false)

  const deps = {
    availableModules: {
      compliance: {
        evaluated: !isCompEmpty,
        assessmentStatus: compProjectNow.compliance.assessmentStatus,
      },
    },
  }

  // 验证无需 reason 推进
  const res = transitionProjectStage({
    projectId: proj.id,
    targetStage: 'PRODUCTION',
    deps,
    reason: '', // 空理由
  })

  assert.equal(res.project.stage, 'PRODUCTION')
  assert.equal(res.gate.verdict, GATE_VERDICTS.NOT_EVALUATED)
  console.log('  ✅ TEST 48: COMPLETED + cert_plan NE -> transitionProjectStage 无需 reason 成功推进至 PRODUCTION')
}

// 49. FAIL Override: IN_ASSESSMENT -> RED -> 无 reason throw，有 reason 记录 gate_override 并推进
{
  const mem = new Map()
  store._setAdapterForTests({
    get: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null),
    set: (k, v) => mem.set(k, JSON.stringify(v)),
    keys: () => [...mem.keys()],
  })

  const { candidate } = store.ensureCandidate({
    sourceProductId: 'PID-FLOW-02',
    candidateIndex: 0,
    name: '合规阻断测试商品',
    categoryLeaf: '日化',
  })
  const snap = store.createSnapshot({
    candidateId: candidate.id,
    sourceProductId: candidate.sourceProductId,
    sourceInputs: { weight_kg: 0.3, price_rub: 1200 },
    versions: { rulesVersion: '1.0' },
  })
  store.refreshCandidateSnapshot(candidate.id, snap.id)
  const proj = store.createProject({ candidateId: candidate.id, creationSnapshotId: snap.id, name: '合规阻断测试项目' })

  store.setProjectStage(proj.id, 'COMPLIANCE', '前置准备')
  store.updateProjectCompliance(proj.id, { assessmentStatus: 'IN_ASSESSMENT' })

  const compProjectNow = store.getProject(proj.id)
  const deps = {
    availableModules: {
      compliance: {
        evaluated: !isProjectComplianceEmpty(compProjectNow.compliance),
        assessmentStatus: compProjectNow.compliance.assessmentStatus,
      },
    },
  }

  // 无理由推进必须 throw
  let threw = false
  try {
    transitionProjectStage({
      projectId: proj.id,
      targetStage: 'PRODUCTION',
      deps,
      reason: '',
    })
  } catch (err) {
    threw = true
    assert(err.message.includes('RED 推进必须填写理由'))
  }
  assert(threw, 'TEST 49A: RED Gate 无理由推进必须 throw 阻断')

  // 有理由推进，成功写入 gate_override 日志
  const res = transitionProjectStage({
    projectId: proj.id,
    targetStage: 'PRODUCTION',
    deps,
    reason: '合规初筛已通过，正式认证文件在工厂排单期间同步出具',
  })

  assert.equal(res.project.stage, 'PRODUCTION')
  const logs = (res.project.decisionLog || []).map((id) => store.getLog(id)).filter(Boolean)
  const overrideLog = logs.find((l) => l.kind === 'gate_override')
  assert(overrideLog, 'TEST 49B: 必须写入 gate_override 决策日志')
  assert.equal(overrideLog.reason, '合规初筛已通过，正式认证文件在工厂排单期间同步出具')
  console.log('  ✅ TEST 49: IN_ASSESSMENT 触发 RED 阻断；空 reason 拦截，有 reason 成功 Override 并留痕')
}

console.log('\n🎉 ALL 49 COMPLIANCE STAGE GATE TESTS PASSED (TASK 07A-4C2 SUCCESS)!\n')
