/**
 * tests/ia-certification-applicability.test.mjs
 * 
 * TASK 07A-4C3B: Certification Applicability Implementation Test Suite
 * 
 * 强制落实 docs/ia/TASK07A4C3A_CERTIFICATION_APPLICABILITY_CONTRACT.md (Revision 5)
 * §11.2 强制验收测试矩阵全部 13 项场景，以及 Gate 12 行真值表全覆盖测试。
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  _setAdapterForTests,
  ensureCandidate,
  createSnapshot,
  createProject,
  getProject,
  getSnapshot,
  getLog,
  updateProjectCompliance,
  createProjectComplianceRequirement,
  updateProjectComplianceRequirement,
  removeProjectComplianceRequirement,
  PROJECT_COMPLIANCE_FIELDS,
  COMPLIANCE_ASSESSMENT_STATUS,
  COMPLIANCE_CERTIFICATION_APPLICABILITY,
  COMPLIANCE_RISK_LEVELS,
  isProjectComplianceEmpty,
  buildNextProjectCompliance,
} from '../ozon-react/src/utils/t6/t6Store.js'

import {
  extractAssessmentState,
  isAssessmentDirty,
  isAssessmentEqual,
  detectAssessmentConflict,
} from '../ozon-react/src/utils/t6/complianceDraftState.js'

import {
  evaluateProjectGate,
  GATE_RESULTS,
  GATE_VERDICTS,
} from '../ozon-react/src/utils/t6/gateEngine.js'

console.log('===== IA Certification Applicability Test Suite (TASK 07A-4C3B) =====\n')

// In-memory test adapter setup
const memoryStorage = new Map()
_setAdapterForTests({
  get: (k) => (memoryStorage.has(k) ? JSON.parse(memoryStorage.get(k)) : null),
  set: (k, v) => memoryStorage.set(k, JSON.stringify(v)),
  keys: () => Array.from(memoryStorage.keys()),
})

// Setup base candidate & snapshot
const { candidate } = ensureCandidate({
  sourceProductId: 'PROD-4C3B-001',
  candidateName: '俄规负离子造型吹风机',
  categoryLeaf: '个人护理/电吹风',
})

const snap = createSnapshot({
  candidateId: candidate.id,
  sourceProductId: candidate.sourceProductId,
  sourceInputs: { name: '电吹风', category_leaf: '个人护理/电吹风', price_rub: 1800 },
  scoreResult: { totalScore: 85, grade: 'A', status: 'RECOMMENDED' },
  marketEvidence: { eacStatus: 'EAC Required', certificationStatus: 'TR CU 004/2011' },
})

// Helper to evaluate gate deps
function makeGateDeps(project) {
  const complianceEvaluated = !isProjectComplianceEmpty(project.compliance)
  const complianceFact = complianceEvaluated
    ? {
        evaluated: true,
        assessmentStatus: project.compliance?.assessmentStatus,
        certificationApplicability: project.compliance?.certificationApplicability,
        certificationApplicabilityNotesPresent: Boolean(
          typeof project.compliance?.certificationApplicabilityNotes === 'string' &&
          project.compliance.certificationApplicabilityNotes.trim().length >= 2
        ),
        certificationPlanPresent: Boolean(
          typeof project.compliance?.certificationPlan === 'string' &&
          project.compliance.certificationPlan.trim() !== ''
        ),
      }
    : undefined

  return {
    availableModules: {
      supplier: { evaluated: true, supplierCount: 2, quoteCount: 1 },
      samples: { evaluated: true, sampleCount: 1 },
      ...(complianceFact ? { compliance: complianceFact } : {}),
    },
    snapshot: snap,
    scenarios: [],
  }
}

// ==============================================================================
// 场景 1: 新建 Project
// ==============================================================================
console.log('--- 场景 1: 新建 Project 初始化 ---')
const p1 = createProject({
  candidateId: candidate.id,
  creationSnapshotId: snap.id,
  name: '场景1测试项目',
})
assert.equal(p1.compliance.certificationApplicability, 'UNASSESSED', '新建项目初始化生成 certificationApplicability: UNASSESSED')
assert.equal(p1.compliance.assessmentStatus, undefined, '新建项目严禁生成 assessmentStatus')
assert.equal(isProjectComplianceEmpty(p1.compliance), false, '新项目 compliance 绝非空容器（确保进入 Gate 审查）')

const gate1_sampling = evaluateProjectGate(p1, 'COMPLIANCE', makeGateDeps(p1))
const chk1_pending = gate1_sampling.checks.find((c) => c.id === 'compliance_pending')
assert.equal(chk1_pending.result, GATE_RESULTS.FAIL, '新项目初始 compliance_pending 必须为 FAIL（因 assessmentStatus 缺失）')

const gate1_prod = evaluateProjectGate({ ...p1, stage: 'COMPLIANCE' }, 'PRODUCTION', makeGateDeps(p1))
const chk1_done = gate1_prod.checks.find((c) => c.id === 'compliance_done')
const chk1_plan = gate1_prod.checks.find((c) => c.id === 'cert_plan')
assert.equal(chk1_done.result, GATE_RESULTS.FAIL, '新项目初始 compliance_done 必须为 FAIL')
assert.equal(chk1_plan.result, GATE_RESULTS.FAIL, '新项目初始 cert_plan 必须为 FAIL（因值为 UNASSESSED）')
assert.equal(chk1_plan.message, '认证适用性尚未判断，请在合规面板确认')
console.log('  ✅ 场景 1 通过：新建项目正确初始化 UNASSESSED，且门禁三连 FAIL')

// ==============================================================================
// 场景 2: 新项目仅修改 notes
// ==============================================================================
console.log('\n--- 场景 2: 新项目仅修改 notes ---')
const p2 = updateProjectCompliance(p1.id, {
  notes: '合规团队初步查阅类目法规',
})
assert.equal(p2.compliance.notes, '合规团队初步查阅类目法规')
assert.equal(p2.compliance.certificationApplicability, 'UNASSESSED', '保留原有的 UNASSESSED')
assert.equal(p2.compliance.assessmentStatus, undefined, '仅修改 notes 严禁自动写入 assessmentStatus: NOT_STARTED')

const gate2_sampling = evaluateProjectGate(p2, 'COMPLIANCE', makeGateDeps(p2))
const chk2_pending = gate2_sampling.checks.find((c) => c.id === 'compliance_pending')
assert.equal(chk2_pending.result, GATE_RESULTS.FAIL, '仅修改 notes 绝对不得让 compliance_pending 变成 PASS')
console.log('  ✅ 场景 2 通过：新项目仅更新备注，不写入 assessmentStatus，门禁保持 FAIL')

// ==============================================================================
// 场景 3: 新项目仅操作 Requirements
// ==============================================================================
console.log('\n--- 场景 3: 新项目仅操作 Requirements ---')
const p3 = createProjectComplianceRequirement(p1.id, {
  category: 'REGULATION',
  name: '电磁兼容性标准核对',
  required: true,
  status: 'PENDING',
})
assert.equal(p3.compliance.requirements.length, 1)
assert.equal(p3.compliance.requirements[0].name, '电磁兼容性标准核对')
assert.equal(p3.compliance.assessmentStatus, undefined, '操作 Requirements 严禁自动写入 assessmentStatus')
assert.equal(p3.compliance.certificationApplicability, 'UNASSESSED', '保留原有的 UNASSESSED')
console.log('  ✅ 场景 3 通过：Requirement CRUD 绝不自动建立 Assessment 状态')

// ==============================================================================
// 场景 4: 新项目首次显式保存 Assessment
// ==============================================================================
console.log('\n--- 场景 4: 新项目首次显式保存 Assessment ---')
const p4 = updateProjectCompliance(p1.id, {
  assessmentStatus: 'IN_ASSESSMENT',
  riskLevel: 'LOW',
})
assert.equal(p4.compliance.assessmentStatus, 'IN_ASSESSMENT')
assert.equal(p4.compliance.riskLevel, 'LOW')
assert.equal(p4.compliance.certificationApplicability, 'UNASSESSED', '首次显式保存 Assessment 完整保留 UNASSESSED')

const gate4_sampling = evaluateProjectGate(p4, 'COMPLIANCE', makeGateDeps(p4))
const chk4_pending = gate4_sampling.checks.find((c) => c.id === 'compliance_pending')
assert.equal(chk4_pending.result, GATE_RESULTS.PASS, '显式建立评估档案后 compliance_pending 变 PASS')
console.log('  ✅ 场景 4 通过：显式保存 Assessment 正确建立状态并保留 UNASSESSED')

// ==============================================================================
// 场景 5: 历史空档案
// ==============================================================================
console.log('\n--- 场景 5: 历史空档案 zero-migration ---')
// 模拟历史创建的项目（compliance 为 {}）
const legacyProjRaw = {
  id: 'legacy-p-001',
  projectCode: 'RU-2025-LEGACY-01',
  marketCode: 'RU',
  schemaVersion: 1,
  name: '历史遗留空合规项目',
  stage: 'SAMPLING',
  lifecycleStatus: 'ACTIVE',
  workflow: { templateVersion: 'roadmap-v1', states: [] },
  source: { kind: 'candidate', candidateId: candidate.id, sourceProductId: 'PID-LEGACY', candidateName: '历史品', category: '工具', creationSnapshotId: snap.id },
  product: {}, suppliers: [], samples: [],
  compliance: {}, // 历史空档案
  costing: { scenarios: [], baselineScenarioId: null },
  decisionLog: [],
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
}
memoryStorage.set(`t6.project.${legacyProjRaw.id}`, JSON.stringify(legacyProjRaw))

const loadedLegacy = getProject('legacy-p-001')
assert.deepEqual(loadedLegacy.compliance, {}, '读取历史档案保持 {}')
assert.equal(loadedLegacy.compliance.certificationApplicability, undefined, '历史档案无 certificationApplicability')

// 在历史项目上创建事项
const legacyWithReq = createProjectComplianceRequirement('legacy-p-001', {
  category: 'OTHER',
  name: '历史事项',
  required: false,
  status: 'DONE',
})
assert.equal(legacyWithReq.compliance.certificationApplicability, undefined, '创建事项绝不自动补齐 certificationApplicability')
assert.equal(legacyWithReq.compliance.assessmentStatus, undefined, '创建事项绝不自动补齐 assessmentStatus')
console.log('  ✅ 场景 5 通过：历史空档案零迁移，普通操作绝不自动补齐')

// ==============================================================================
// 场景 6: 历史档案仅修改 notes
// ==============================================================================
console.log('\n--- 场景 6: 历史档案仅修改 notes ---')
const legacyWithNote = updateProjectCompliance('legacy-p-001', {
  notes: '历史项目仅追加备注',
})
assert.equal(legacyWithNote.compliance.notes, '历史项目仅追加备注')
assert.equal(legacyWithNote.compliance.certificationApplicability, undefined, '历史项目仅改 notes 保持缺失（undefined）')
assert.equal(legacyWithNote.compliance.assessmentStatus, undefined, '历史项目仅改 notes 不补齐 assessmentStatus')
console.log('  ✅ 场景 6 通过：历史档案仅修改 notes 保持新字段缺失')

// ==============================================================================
// 场景 7: 历史档案仅保存 Plan
// ==============================================================================
console.log('\n--- 场景 7: 历史档案仅保存 Plan ---')
const legacyWithPlan = updateProjectCompliance('legacy-p-001', {
  applicableStandards: ['GOST R 12345'],
  certificationPlan: '沿用旧版通用符合性声明',
})
assert.deepEqual(legacyWithPlan.compliance.applicableStandards, ['GOST R 12345'])
assert.equal(legacyWithPlan.compliance.certificationPlan, '沿用旧版通用符合性声明')
assert.equal(legacyWithPlan.compliance.certificationApplicability, undefined, 'Layer B 保存保持新字段缺失')
console.log('  ✅ 场景 7 通过：历史档案仅保存 Plan 保持新字段缺失')

// ==============================================================================
// 场景 8: 显式保存 NOT_REQUIRED 和依据
// ==============================================================================
console.log('\n--- 场景 8: 显式保存 NOT_REQUIRED 和依据 ---')
const logCountBeforeP1 = getProject(p1.id).decisionLog.length
const p1_not_req = updateProjectCompliance(p1.id, {
  certificationApplicability: 'NOT_REQUIRED',
  certificationApplicabilityNotes: '纯五金机械结构螺丝刀，不含电气或无线电发射组件',
}, { by: 'compliance_lead', reason: '合规定性：免办认证' })

assert.equal(p1_not_req.compliance.certificationApplicability, 'NOT_REQUIRED')
assert.equal(p1_not_req.compliance.certificationApplicabilityNotes, '纯五金机械结构螺丝刀，不含电气或无线电发射组件')
assert.equal(p1_not_req.decisionLog.length, logCountBeforeP1 + 1, '产生单条决策日志')

const latestLog = getLog(p1_not_req.decisionLog[p1_not_req.decisionLog.length - 1])
assert.equal(latestLog.kind, 'compliance_update')
assert.equal(latestLog.by, 'compliance_lead')
assert.equal(latestLog.reason, '合规定性：免办认证')
const fromD = JSON.parse(latestLog.from)
const toD = JSON.parse(latestLog.to)
assert.equal(fromD.certificationApplicability, 'UNASSESSED')
assert.equal(toD.certificationApplicability, 'NOT_REQUIRED')
assert.equal(toD.certificationApplicabilityNotes, '纯五金机械结构螺丝刀，不含电气或无线电发射组件')

// Gate 检查：当 NOT_REQUIRED 且依据充足时，cert_plan 必须 PASS
const gate1_not_req = evaluateProjectGate({ ...p1_not_req, stage: 'COMPLIANCE' }, 'PRODUCTION', makeGateDeps(p1_not_req))
const chk1_not_req_plan = gate1_not_req.checks.find((c) => c.id === 'cert_plan')
assert.equal(chk1_not_req_plan.result, GATE_RESULTS.PASS, 'NOT_REQUIRED + 依据充足 -> cert_plan PASS')
assert.equal(chk1_not_req_plan.message, '已明确判定无需办理认证（依据已留存）')

// 同值保存 No-op 验证
const logCountSame = p1_not_req.decisionLog.length
const p1_same = updateProjectCompliance(p1.id, {
  certificationApplicability: 'NOT_REQUIRED',
  certificationApplicabilityNotes: '纯五金机械结构螺丝刀，不含电气或无线电发射组件',
})
assert.equal(p1_same.decisionLog.length, logCountSame, '同值重复保存 No-op，不新增日志')
console.log('  ✅ 场景 8 通过：显式保存 NOT_REQUIRED + 依据原子成功，产生单条日志，同值保存 No-op')

// ==============================================================================
// 场景 9: NOT_REQUIRED 缺少依据
// ==============================================================================
console.log('\n--- 场景 9: NOT_REQUIRED 缺少依据校验拦截 ---')
const pNew = createProject({
  candidateId: candidate.id,
  creationSnapshotId: snap.id,
  name: '场景9测试项目',
})
const logCountPNew = getProject(pNew.id).decisionLog.length

// A: 完全不传依据
assert.throws(
  () => updateProjectCompliance(pNew.id, { certificationApplicability: 'NOT_REQUIRED' }),
  /判定无需办理认证时必须填写判断依据/,
  '缺少依据抛错拦截'
)
// 验证全失败零写入
const pNewRefreshedA = getProject(pNew.id)
assert.equal(pNewRefreshedA.compliance.certificationApplicability, 'UNASSESSED', '拦截后项目零写入，保持 UNASSESSED')
assert.equal(pNewRefreshedA.decisionLog.length, logCountPNew, '拦截后决策日志零新增')

// B: 传入过短依据（trim 长度 < 2）
assert.throws(
  () => updateProjectCompliance(pNew.id, {
    certificationApplicability: 'NOT_REQUIRED',
    certificationApplicabilityNotes: ' 无 ',
  }),
  /判定无需办理认证时必须填写判断依据/,
  '依据过短抛错拦截'
)
const pNewRefreshedB = getProject(pNew.id)
assert.equal(pNewRefreshedB.decisionLog.length, logCountPNew, '依据过短拦截后决策日志零新增')
console.log('  ✅ 场景 9 通过：NOT_REQUIRED 缺少依据或依据过短坚决拦截，全过程零写入零日志')

// ==============================================================================
// 场景 10: 非法 Applicability
// ==============================================================================
console.log('\n--- 场景 10: 非法 Applicability 拦截与 Gate Fail-close ---')
// Store 写入拦截
assert.throws(
  () => updateProjectCompliance(pNew.id, { certificationApplicability: 'EXEMPT' }),
  /certificationApplicability 必须为有效适用性状态/,
  '拦截非法枚举 EXEMPT'
)
assert.throws(
  () => updateProjectCompliance(pNew.id, { certificationApplicability: null }),
  /certificationApplicability 必须为有效适用性状态/,
  '拦截 null'
)
assert.throws(
  () => updateProjectCompliance(pNew.id, { certificationApplicability: '' }),
  /certificationApplicability 必须为有效适用性状态/,
  '拦截空串'
)

// Gate 层 Fail-close 测试（测试真值表行 4, 5, 6, 7）
const testGateIllegal = (illegalVal) => {
  const mockP = {
    ...pNew,
    stage: 'COMPLIANCE',
    compliance: { certificationApplicability: illegalVal },
  }
  const g = evaluateProjectGate(mockP, 'PRODUCTION', {
    availableModules: {
      supplier: { evaluated: true, supplierCount: 2, quoteCount: 1 },
      samples: { evaluated: true, sampleCount: 1 },
      compliance: { evaluated: true, certificationApplicability: illegalVal },
    },
    snapshot: snap,
  })
  const chk = g.checks.find((c) => c.id === 'cert_plan')
  assert.equal(chk.result, GATE_RESULTS.FAIL, `非法值 ${illegalVal} 必须被 Gate 判定为 FAIL`)
  assert.equal(chk.message, '认证适用性状态无效（Fail-close）')
  assert.equal(g.verdict, GATE_VERDICTS.RED, '非法值必须使阶段总评成为 RED')
}

testGateIllegal(null)
testGateIllegal('')
testGateIllegal(false)
testGateIllegal(0)
testGateIllegal('EXEMPT')
testGateIllegal('UNKNOWN_VAL')
console.log('  ✅ 场景 10 通过：null、空串、false、0、EXEMPT 及未知枚举在 Store 抛错并在 Gate 一票否决为 FAIL (RED)')

// ==============================================================================
// 场景 11: 缺失 Applicability
// ==============================================================================
console.log('\n--- 场景 11: 缺失 Applicability 兼容处理与提示 ---')
const mockLegacyProj = {
  ...pNew,
  stage: 'COMPLIANCE',
  compliance: { assessmentStatus: 'COMPLETED' }, // 缺少 certificationApplicability
}
const gateLegacy = evaluateProjectGate(mockLegacyProj, 'PRODUCTION', {
  availableModules: {
    supplier: { evaluated: true, supplierCount: 2, quoteCount: 1 },
    samples: { evaluated: true, sampleCount: 1 },
    compliance: { evaluated: true, assessmentStatus: 'COMPLETED' }, // 未包含 certificationApplicability 字段
  },
  snapshot: snap,
})
const chkLegacyCertPlan = gateLegacy.checks.find((c) => c.id === 'cert_plan')
assert.equal(chkLegacyCertPlan.result, GATE_RESULTS.NOT_EVALUATED, '历史缺失项目单项返回 NOT_EVALUATED')
assert.equal(chkLegacyCertPlan.message, '该项目尚未记录认证适用性，目前该项采用兼容处理，不代表认证判断已经完成。')
console.log('  ✅ 场景 11 通过：历史缺失项目兼容返回 NOT_EVALUATED 并输出准确兼容警示')

// ==============================================================================
// 场景 12: Candidate → Project 一键立项链路
// ==============================================================================
console.log('\n--- 场景 12: Candidate → Project 一键立项链路完整性 ---')
const { candidate: cand12 } = ensureCandidate({
  sourceProductId: 'PROD-4C3B-012',
  candidateName: '户外露营便携风扇',
  categoryLeaf: '家用电器/风扇',
})
const snap12 = createSnapshot({
  candidateId: cand12.id,
  sourceProductId: cand12.sourceProductId,
  sourceInputs: { name: '便携风扇', price_rub: 1200 },
  scoreResult: { totalScore: 78, grade: 'B', status: 'RECOMMENDED' },
})
const p12 = createProject({
  candidateId: cand12.id,
  creationSnapshotId: snap12.id,
  name: '便携风扇一键立项项目',
})
assert.equal(p12.source.candidateId, cand12.id)
assert.equal(p12.source.creationSnapshotId, snap12.id)
assert.equal(p12.compliance.certificationApplicability, 'UNASSESSED', '一键立项默认写入 UNASSESSED')
assert.equal(p12.compliance.assessmentStatus, undefined, '无 assessmentStatus')
console.log('  ✅ 场景 12 通过：一键立项数据拓扑完整，合规初值符合规范')

// ==============================================================================
// 场景 13: 快照行为不变与领域隔离
// ==============================================================================
console.log('\n--- 场景 13: 快照行为不变与领域隔离 ---')
const loadedSnap = getSnapshot(snap.id)
assert.equal(loadedSnap.marketEvidence.eacStatus, 'EAC Required')
assert.equal(loadedSnap.marketEvidence.certificationStatus, 'TR CU 004/2011')
// 项目中绝未包含快照证据字段
assert.equal(p12.compliance.eacStatus, undefined)
assert.equal(p12.compliance.certificationStatus, undefined)
console.log('  ✅ 场景 13 通过：快照不可变，市场情报与合规决策绝对隔离')

// ==============================================================================
// 真值表全部 12 行专项穷举验证 (Contract §9.1 Truth Table Matrix)
// ==============================================================================
console.log('\n--- 真值表 12 行全量穷举验证 ---')

const evalTruthTableRow = (fact) => {
  const p = { ...pNew, stage: 'COMPLIANCE' }
  const deps = {
    availableModules: {
      supplier: { evaluated: true, supplierCount: 2, quoteCount: 1 },
      samples: { evaluated: true, sampleCount: 1 },
      ...(fact !== undefined ? { compliance: fact } : {}),
    },
    snapshot: snap,
  }
  const g = evaluateProjectGate(p, 'PRODUCTION', deps)
  return g.checks.find((c) => c.id === 'cert_plan')
}

// Row 1: fact missing / evaluated !== true
const r1 = evalTruthTableRow(undefined)
assert.equal(r1.result, GATE_RESULTS.NOT_EVALUATED)
assert.equal(r1.message, '合规数据域尚未接入')

// Row 2: fact.evaluated = true, certificationApplicability absent
const r2 = evalTruthTableRow({ evaluated: true })
assert.equal(r2.result, GATE_RESULTS.NOT_EVALUATED)
assert.equal(r2.message, '该项目尚未记录认证适用性，目前该项采用兼容处理，不代表认证判断已经完成。')

// Row 3: fact.evaluated = true, certificationApplicability === undefined
const r3 = evalTruthTableRow({ evaluated: true, certificationApplicability: undefined })
assert.equal(r3.result, GATE_RESULTS.NOT_EVALUATED)
assert.equal(r3.message, '该项目尚未记录认证适用性，目前该项采用兼容处理，不代表认证判断已经完成。')

// Row 4: null
const r4 = evalTruthTableRow({ evaluated: true, certificationApplicability: null })
assert.equal(r4.result, GATE_RESULTS.FAIL)
assert.equal(r4.message, '认证适用性状态无效（Fail-close）')

// Row 5: ""
const r5 = evalTruthTableRow({ evaluated: true, certificationApplicability: '' })
assert.equal(r5.result, GATE_RESULTS.FAIL)
assert.equal(r5.message, '认证适用性状态无效（Fail-close）')

// Row 6: false / 0
const r6a = evalTruthTableRow({ evaluated: true, certificationApplicability: false })
assert.equal(r6a.result, GATE_RESULTS.FAIL)
assert.equal(r6a.message, '认证适用性状态无效（Fail-close）')
const r6b = evalTruthTableRow({ evaluated: true, certificationApplicability: 0 })
assert.equal(r6b.result, GATE_RESULTS.FAIL)
assert.equal(r6b.message, '认证适用性状态无效（Fail-close）')

// Row 7: 'EXEMPT' / unknown
const r7 = evalTruthTableRow({ evaluated: true, certificationApplicability: 'EXEMPT' })
assert.equal(r7.result, GATE_RESULTS.FAIL)
assert.equal(r7.message, '认证适用性状态无效（Fail-close）')

// Row 8: 'UNASSESSED'
const r8 = evalTruthTableRow({ evaluated: true, certificationApplicability: 'UNASSESSED' })
assert.equal(r8.result, GATE_RESULTS.FAIL)
assert.equal(r8.message, '认证适用性尚未判断，请在合规面板确认')

// Row 9: 'REQUIRED' + no plan
const r9 = evalTruthTableRow({ evaluated: true, certificationApplicability: 'REQUIRED', certificationPlanPresent: false })
assert.equal(r9.result, GATE_RESULTS.FAIL)
assert.equal(r9.message, '商品需要办理认证，但尚未制定认证处理计划')

// Row 10: 'REQUIRED' + plan present
const r10 = evalTruthTableRow({ evaluated: true, certificationApplicability: 'REQUIRED', certificationPlanPresent: true })
assert.equal(r10.result, GATE_RESULTS.PASS)
assert.equal(r10.message, '认证处理路径已明确')

// Row 11: 'NOT_REQUIRED' + no notes
const r11 = evalTruthTableRow({ evaluated: true, certificationApplicability: 'NOT_REQUIRED', certificationApplicabilityNotesPresent: false })
assert.equal(r11.result, GATE_RESULTS.FAIL)
assert.equal(r11.message, '判定无需认证时必须填写判断依据')

// Row 12: 'NOT_REQUIRED' + notes present
const r12 = evalTruthTableRow({ evaluated: true, certificationApplicability: 'NOT_REQUIRED', certificationApplicabilityNotesPresent: true })
assert.equal(r12.result, GATE_RESULTS.PASS)
assert.equal(r12.message, '已明确判定无需办理认证（依据已留存）')

console.log('  ✅ 真值表全部 12 行单项求值与消息文本 100% 吻合！')

// ==============================================================================
// 综合评定优先级验证 (RED > YELLOW > NOT_EVALUATED > GREEN)
// ==============================================================================
console.log('\n--- 综合阶段总评优先级验证 ---')
// 即使 cert_plan 是 PASS（Row 10 或 12），若 compliance_done 为 FAIL，总评必须为 RED
const gProdRow10 = evaluateProjectGate(
  { ...pNew, stage: 'COMPLIANCE' },
  'PRODUCTION',
  {
    availableModules: {
      supplier: { evaluated: true, supplierCount: 2, quoteCount: 1 },
      samples: { evaluated: true, sampleCount: 1 },
      compliance: {
        evaluated: true,
        assessmentStatus: 'IN_ASSESSMENT', // compliance_done 会判 FAIL
        certificationApplicability: 'REQUIRED',
        certificationPlanPresent: true,    // cert_plan 判 PASS
      },
    },
    snapshot: snap,
  }
)
assert.equal(gProdRow10.verdict, GATE_VERDICTS.RED, '单项 PASS 绝不独家决定整体通过，存在其他 FAIL 则总评必为 RED')
console.log('  ✅ 综合总评验证通过：严格遵循 RED > YELLOW > NOT_EVALUATED > GREEN 铁律')

// ==============================================================================
// 草稿状态引擎纯函数单元测试
// ==============================================================================
console.log('\n--- 草稿状态引擎纯函数单元测试 ---')
const emptyA = extractAssessmentState({})
assert.equal(emptyA.certificationApplicability, undefined, '空档案提取适用性为 undefined')
assert.equal(emptyA.certificationApplicabilityNotes, '', '空档案提取依据为空串')

const dirtyCheck1 = isAssessmentDirty(
  { assessmentStatus: 'NOT_STARTED', riskLevel: '', notes: '', certificationApplicability: undefined, certificationApplicabilityNotes: '' },
  { assessmentStatus: 'NOT_STARTED', riskLevel: '', notes: '', certificationApplicability: undefined, certificationApplicabilityNotes: '' }
)
assert.equal(dirtyCheck1, false, '同为 undefined 时 clean')

const dirtyCheck2 = isAssessmentDirty(
  { assessmentStatus: 'NOT_STARTED', riskLevel: '', notes: '', certificationApplicability: 'REQUIRED', certificationApplicabilityNotes: '' },
  { assessmentStatus: 'NOT_STARTED', riskLevel: '', notes: '', certificationApplicability: undefined, certificationApplicabilityNotes: '' }
)
assert.equal(dirtyCheck2, true, '适用性由 undefined 变为 REQUIRED 为 dirty')

console.log('  ✅ 草稿状态引擎新增字段单元测试通过')

console.log('\n🎉 ALL 13 ACCEPTANCE MATRIX SCENARIOS & 12 TRUTH TABLE ROWS PASSED (TASK 07A-4C3B SUCCESS)!\n')
