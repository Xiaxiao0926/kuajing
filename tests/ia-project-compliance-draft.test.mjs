/**
 * tests/ia-project-compliance-draft.test.mjs
 * 
 * 任务：KJ-GEMINI-20260920-001 (Compliance Panel Unsaved Input Protection)
 * 专项测试套件：合规面板草稿独立保护、脏检查、冲突隔离与生命周期测试
 * 
 * 严格覆盖 TASK.md §5 验收用例 A ~ H：
 * - Scenario A: 编辑未保存计划，再保存评估，计划内容仍在且保持未保存。
 * - Scenario B: 编辑未保存评估，再保存计划，评估内容仍在且保持未保存。
 * - Scenario C: 两块均有未保存输入，依次新增/编辑/删除一个事项，输入不丢失。
 * - Scenario D: 模拟保存抛错，输入保留、错误可见、无成功反馈。
 * - Scenario E: 成功保存后该区块 dirty 清除，规范化值正确；另一块 dirty 不变。
 * - Scenario F: 项目 A/B 切换无串写；对离开时提醒的覆盖范围如实说明。
 * - Scenario G: 同项目外部数据更新时，干净区块刷新，dirty 区块不被覆盖且冲突提示准确。
 * - Scenario H: 桌面及移动端（约 390px）响应式无横向溢出、按键遮挡与标签重叠静态契约检查。
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  extractAssessmentState,
  extractPlanState,
  isAssessmentDirty,
  isPlanDirty,
  detectAssessmentConflict,
  detectPlanConflict,
  resolveSyncOnProjectUpdate,
} from '../ozon-react/src/utils/t6/complianceDraftState.js'

import {
  _setAdapterForTests,
  ensureCandidate,
  createSnapshot,
  createProject,
  getProject,
  updateProjectCompliance,
  createProjectComplianceRequirement,
  updateProjectComplianceRequirement,
  removeProjectComplianceRequirement,
  COMPLIANCE_ASSESSMENT_STATUS,
  normalizeApplicableStandards,
} from '../ozon-react/src/utils/t6/t6Store.js'

console.log('===== IA Project Compliance Draft & Unsaved Input Protection Test Suite (KJ-GEMINI-20260920-001) =====\n')

const ROOT = path.resolve('.')
const PANEL_PATH = path.join(ROOT, 'ozon-react/src/components/t6/ProjectCompliancePanel.jsx')
const HELPER_PATH = path.join(ROOT, 'ozon-react/src/utils/t6/complianceDraftState.js')

// ==========================================
// PART 1: 静态源码与组件契约检查
// ==========================================
console.log('--- PART 1: 静态源码与架构契约检查 ---')

assert(fs.existsSync(HELPER_PATH), 'TEST 1.1: complianceDraftState.js 必须存在')
console.log('  ✅ TEST 1.1: complianceDraftState.js 存在')

assert(fs.existsSync(PANEL_PATH), 'TEST 1.2: ProjectCompliancePanel.jsx 必须存在')
const panelCode = fs.readFileSync(PANEL_PATH, 'utf-8')

assert(panelCode.includes("from '../../utils/t6/complianceDraftState.js'"), 'TEST 1.3: Panel 必须引入 complianceDraftState 辅助函数')
console.log('  ✅ TEST 1.3: Panel 引入 complianceDraftState 辅助函数')

assert(panelCode.includes('beforeunload'), 'TEST 1.4: Panel 必须包含 beforeunload 窗口监听')
assert(panelCode.includes('removeEventListener'), 'TEST 1.5: Panel 必须清理 beforeunload 监听器')
console.log('  ✅ TEST 1.4 & 1.5: beforeunload 监听与清理已实现')

assert(panelCode.includes('data-testid="global-unsaved-badge"'), 'TEST 1.6: Panel 必须包含全局未保存修改标记')
assert(panelCode.includes('data-testid="assessment-unsaved-badge"'), 'TEST 1.7: Panel 必须包含 Assessment 未保存草稿标记')
assert(panelCode.includes('data-testid="plan-unsaved-badge"'), 'TEST 1.8: Panel 必须包含 Plan 未保存草稿标记')
console.log('  ✅ TEST 1.6 ~ 1.8: 未保存可视化标记（Badge）就绪')

assert(panelCode.includes('data-testid="assessment-conflict-banner"'), 'TEST 1.9: Panel 必须包含 Assessment 外部数据冲突提示横幅')
assert(panelCode.includes('data-testid="plan-conflict-banner"'), 'TEST 1.10: Panel 必须包含 Plan 外部数据冲突提示横幅')
console.log('  ✅ TEST 1.9 & 1.10: 外部数据冲突提示横幅已就绪')

// 验证无“已备份到服务器”等未经确认的虚假提示
assert(!panelCode.includes('已备份到服务器'), 'TEST 1.11: 严禁出现“已备份到服务器”提示')
assert(!panelCode.includes('服务器保存成功'), 'TEST 1.12: 严禁出现“服务器保存成功”提示')
console.log('  ✅ TEST 1.11 & 1.12: 无服务器保存虚假提示')

// ==========================================
// PART 2: 纯草稿状态管理引擎单元测试
// ==========================================
console.log('\n--- PART 2: complianceDraftState 纯状态引擎单元测试 ---')

const defaultAssessment = extractAssessmentState(null)
assert.equal(defaultAssessment.assessmentStatus, COMPLIANCE_ASSESSMENT_STATUS.NOT_STARTED)
assert.equal(defaultAssessment.riskLevel, '')
assert.equal(defaultAssessment.notes, '')
console.log('  ✅ TEST 2.1: extractAssessmentState 空值安全返回默认结构')

const defaultPlan = extractPlanState(null)
assert.equal(defaultPlan.standardsText, '')
assert.equal(defaultPlan.certificationPlan, '')
console.log('  ✅ TEST 2.2: extractPlanState 空值安全返回默认结构')

// Dirty 检查
const baseA = { assessmentStatus: 'NOT_STARTED', riskLevel: '', notes: '' }
assert.equal(isAssessmentDirty(baseA, baseA), false)
assert.equal(isAssessmentDirty({ ...baseA, notes: 'new' }, baseA), true)
assert.equal(isAssessmentDirty({ ...baseA, riskLevel: 'HIGH' }, baseA), true)
assert.equal(isAssessmentDirty({ ...baseA, assessmentStatus: 'COMPLETED' }, baseA), true)
console.log('  ✅ TEST 2.3: isAssessmentDirty 准确捕获任意字段改动')

const baseP = { standardsText: 'TR CU 004/2011', certificationPlan: 'DoC' }
assert.equal(isPlanDirty(baseP, baseP), false)
assert.equal(isPlanDirty({ ...baseP, standardsText: 'TR CU 020/2011' }, baseP), true)
assert.equal(isPlanDirty({ ...baseP, certificationPlan: 'Exempt' }, baseP), true)
console.log('  ✅ TEST 2.4: isPlanDirty 准确捕获法规标准与计划文本改动')

// 冲突检测 (Revision 002 规则)
// 1. baseline 与 incoming 一致时无冲突
assert.equal(detectAssessmentConflict({ draft: baseA, baseline: baseA, incoming: baseA }), false)
// 2. dirty 但外部未变时无冲突
assert.equal(detectAssessmentConflict({ draft: { ...baseA, notes: 'local' }, baseline: baseA, incoming: baseA }), false)
// 3. dirty 且外部已变时有冲突
assert.equal(detectAssessmentConflict({ draft: { ...baseA, notes: 'local' }, baseline: baseA, incoming: { ...baseA, notes: 'ext' } }), true)
// 4. dirty 且外部变动恰好与本地草稿相同时无冲突
assert.equal(detectAssessmentConflict({ draft: { ...baseA, notes: 'same' }, baseline: baseA, incoming: { ...baseA, notes: 'same' } }), false)
// 5. 草稿回退到旧基准，但外部已发生变更：必须保持冲突告警 (R4 / G2)
assert.equal(detectAssessmentConflict({ draft: baseA, baseline: baseA, incoming: { ...baseA, notes: 'ext' } }), true)
console.log('  ✅ TEST 2.5: detectAssessmentConflict 冲突规则符合契约 (含 G2 回退基准冲突防护)')

// Plan 冲突检测对称性检查
assert.equal(detectPlanConflict({ draft: baseP, baseline: baseP, incoming: baseP }), false)
assert.equal(detectPlanConflict({ draft: { ...baseP, certificationPlan: 'local' }, baseline: baseP, incoming: baseP }), false)
assert.equal(detectPlanConflict({ draft: { ...baseP, certificationPlan: 'local' }, baseline: baseP, incoming: { ...baseP, certificationPlan: 'ext' } }), true)
assert.equal(detectPlanConflict({ draft: { ...baseP, certificationPlan: 'same' }, baseline: baseP, incoming: { ...baseP, certificationPlan: 'same' } }), false)
assert.equal(detectPlanConflict({ draft: baseP, baseline: baseP, incoming: { ...baseP, certificationPlan: 'ext' } }), true)
console.log('  ✅ TEST 2.6: detectPlanConflict 冲突规则对称性与 G2 防护就绪')

// ==========================================
// PART 3: 验收场景 A ~ G 行为模拟集成测试
// ==========================================
console.log('\n--- PART 3: 验收场景 A ~ G 真实状态流转测试 ---')

// 内存适配器隔离测试数据
const mockStorage = new Map()
_setAdapterForTests({
  get: (k) => (mockStorage.has(k) ? JSON.parse(mockStorage.get(k)) : null),
  set: (k, v) => mockStorage.set(k, JSON.stringify(v)),
  keys: () => Array.from(mockStorage.keys()),
})

// 创建临时测试项目
const { candidate } = ensureCandidate({
  sourceProductId: 'cand-draft-1',
  name: '草稿保护测试商品',
  categoryLeaf: '个人护理',
})
const snap = createSnapshot({
  candidateId: candidate.id,
  sourceProductId: candidate.sourceProductId,
  sourceInputs: { name: '草稿保护测试商品', category_leaf: '个人护理', price_rub: 2000 },
  scoreResult: { totalScore: 80, grade: 'B', status: 'RECOMMENDED' },
  marketContext: { matchMethod: 'exact' },
  marketEvidence: { eacStatus: 'EAC Required', certificationStatus: 'DoC' },
})
const projA = createProject({
  candidateId: candidate.id,
  creationSnapshotId: snap.id,
  name: '测试项目 A',
})
const projB = createProject({
  candidateId: candidate.id,
  creationSnapshotId: snap.id,
  name: '测试项目 B',
})

// --- 场景 A: 编辑未保存计划，再保存评估，计划内容仍在且保持未保存 ---
console.log('\n[场景 A] 编辑未保存计划，再保存评估，计划草稿不受影响：')
{
  const initialComp = getProject(projA.id).compliance || {}
  let aDraft = extractAssessmentState(initialComp)
  let aBaseline = { ...aDraft }
  let pDraft = extractPlanState(initialComp)
  let pBaseline = { ...pDraft }

  // 1. 用户编辑 Plan (未保存)
  pDraft.standardsText = 'TR CU 004/2011 (LVD)\nTR CU 020/2011 (EMC)'
  pDraft.certificationPlan = '拟申请 EAC 符合性声明 (DoC)'
  assert.equal(isPlanDirty(pDraft, pBaseline), true, 'Plan 此时应处于 dirty')

  // 2. 用户修改并保存 Assessment
  aDraft.assessmentStatus = COMPLIANCE_ASSESSMENT_STATUS.IN_ASSESSMENT
  aDraft.riskLevel = 'MEDIUM'
  aDraft.notes = '初审通过，准备标准核对'
  
  // 执行 Assessment 保存写入 Store
  updateProjectCompliance(projA.id, {
    assessmentStatus: aDraft.assessmentStatus,
    riskLevel: aDraft.riskLevel,
    notes: aDraft.notes,
  })
  aBaseline = { ...aDraft }

  // 3. 触发 project 刷新同步
  const refreshedProject = getProject(projA.id)
  const syncResult = resolveSyncOnProjectUpdate({
    prevProjectId: projA.id,
    nextProjectId: projA.id,
    currentAssessmentDraft: aDraft,
    currentAssessmentBaseline: aBaseline,
    currentPlanDraft: pDraft,
    currentPlanBaseline: pBaseline,
    nextCompliance: refreshedProject.compliance,
  })

  // 断言：
  // Assessment 已保存，dirty 为 false
  assert.equal(syncResult.isAssessmentDirty, false, 'Assessment 保存后 dirty 必须清除')
  assert.equal(refreshedProject.compliance.assessmentStatus, 'IN_ASSESSMENT')
  assert.equal(refreshedProject.compliance.riskLevel, 'MEDIUM')

  // Plan 草稿完全保留且仍为 dirty，且 Store 中 Plan 未被意外写入
  assert.equal(syncResult.planDraft.standardsText, 'TR CU 004/2011 (LVD)\nTR CU 020/2011 (EMC)', 'Plan standardsText 必须完好保留')
  assert.equal(syncResult.planDraft.certificationPlan, '拟申请 EAC 符合性声明 (DoC)', 'Plan certificationPlan 必须完好保留')
  assert.equal(syncResult.isPlanDirty, true, 'Plan 必须保持未保存 dirty 状态')
  assert.equal(syncResult.planConflict, false, '不应误报 Plan 冲突')
  assert.deepEqual(refreshedProject.compliance.applicableStandards || [], [], 'Store 中的 Plan 不应被提前写入')
  console.log('  ✅ 场景 A 通过：保存评估未覆盖未保存的计划草稿，计划保持 dirty')
}

// --- 场景 B: 编辑未保存评估，再保存计划，评估内容仍在且保持未保存 ---
console.log('\n[场景 B] 编辑未保存评估，再保存计划，评估草稿不受影响：')
{
  const currentProject = getProject(projA.id)
  let aDraft = {
    assessmentStatus: COMPLIANCE_ASSESSMENT_STATUS.COMPLETED,
    riskLevel: 'LOW',
    notes: '用户在界面中新输入的未保存评估备注',
  }
  let aBaseline = extractAssessmentState(currentProject.compliance)
  let pDraft = {
    standardsText: 'TR CU 004/2011\nTR CU 020/2011',
    certificationPlan: '已确认为正式方案',
  }
  let pBaseline = extractPlanState(currentProject.compliance)

  assert.equal(isAssessmentDirty(aDraft, aBaseline), true, 'Assessment 此时应处于 dirty')

  // 1. 用户保存 Plan
  const normalizedStandards = normalizeApplicableStandards(pDraft.standardsText)
  updateProjectCompliance(projA.id, {
    applicableStandards: normalizedStandards,
    certificationPlan: pDraft.certificationPlan,
  })
  pBaseline = {
    standardsText: normalizedStandards.join('\n'),
    certificationPlan: pDraft.certificationPlan.trim(),
  }
  pDraft = { ...pBaseline }

  // 2. 触发 project 刷新同步
  const refreshedProject = getProject(projA.id)
  const syncResult = resolveSyncOnProjectUpdate({
    prevProjectId: projA.id,
    nextProjectId: projA.id,
    currentAssessmentDraft: aDraft,
    currentAssessmentBaseline: aBaseline,
    currentPlanDraft: pDraft,
    currentPlanBaseline: pBaseline,
    nextCompliance: refreshedProject.compliance,
  })

  // 断言：
  // Plan 已保存，dirty 为 false
  assert.equal(syncResult.isPlanDirty, false, 'Plan 保存后 dirty 必须清除')
  assert.deepEqual(refreshedProject.compliance.applicableStandards, ['TR CU 004/2011', 'TR CU 020/2011'])

  // Assessment 草稿完全保留且仍为 dirty，Store 中 Assessment 保持不变
  assert.equal(syncResult.assessmentDraft.assessmentStatus, COMPLIANCE_ASSESSMENT_STATUS.COMPLETED)
  assert.equal(syncResult.assessmentDraft.riskLevel, 'LOW')
  assert.equal(syncResult.assessmentDraft.notes, '用户在界面中新输入的未保存评估备注')
  assert.equal(syncResult.isAssessmentDirty, true, 'Assessment 必须保持未保存 dirty 状态')
  assert.equal(syncResult.assessmentConflict, false, '不应误报 Assessment 冲突')
  assert.equal(refreshedProject.compliance.assessmentStatus, 'IN_ASSESSMENT', 'Store 中评估状态未被意外覆盖')
  console.log('  ✅ 场景 B 通过：保存计划未覆盖未保存的评估草稿，评估保持 dirty')
}

// --- 场景 C: 两块均有未保存输入，依次新增/编辑/删除一个事项，输入不丢失 ---
console.log('\n[场景 C] 两块均有未保存输入，进行 Requirement CRUD，草稿保持完整：')
{
  const currentProject = getProject(projA.id)
  let aBaseline = extractAssessmentState(currentProject.compliance)
  let pBaseline = extractPlanState(currentProject.compliance)

  let aDraft = { ...aBaseline, notes: '重要未保存评估意见 ABC' }
  let pDraft = { ...pBaseline, certificationPlan: '重要未保存计划方案 XYZ' }

  assert.equal(isAssessmentDirty(aDraft, aBaseline), true)
  assert.equal(isPlanDirty(pDraft, pBaseline), true)

  // 1. 新增事项
  const projAfterCreate = createProjectComplianceRequirement(projA.id, {
    category: 'LABELING',
    name: '俄语标签与 EAC 图标核实',
    required: true,
    status: 'PENDING',
    risk: 'MEDIUM',
    desc: '外包装必须包含符合规格的 EAC 标志',
  })
  const req = projAfterCreate.compliance.requirements.find((r) => r.name === '俄语标签与 EAC 图标核实')
  assert(req && req.id, '事项创建成功')

  // 同步刷新
  let refreshedProject = getProject(projA.id)
  let syncResult = resolveSyncOnProjectUpdate({
    prevProjectId: projA.id,
    nextProjectId: projA.id,
    currentAssessmentDraft: aDraft,
    currentAssessmentBaseline: aBaseline,
    currentPlanDraft: pDraft,
    currentPlanBaseline: pBaseline,
    nextCompliance: refreshedProject.compliance,
  })
  assert.equal(syncResult.assessmentDraft.notes, '重要未保存评估意见 ABC', '新增事项后 aDraft 不丢')
  assert.equal(syncResult.planDraft.certificationPlan, '重要未保存计划方案 XYZ', '新增事项后 pDraft 不丢')
  assert.equal(syncResult.isAssessmentDirty, true)
  assert.equal(syncResult.isPlanDirty, true)

  // 2. 修改事项
  updateProjectComplianceRequirement(projA.id, req.id, {
    status: 'DONE',
    desc: '已通过俄语说明书与标志终审',
  })

  refreshedProject = getProject(projA.id)
  syncResult = resolveSyncOnProjectUpdate({
    prevProjectId: projA.id,
    nextProjectId: projA.id,
    currentAssessmentDraft: aDraft,
    currentAssessmentBaseline: aBaseline,
    currentPlanDraft: pDraft,
    currentPlanBaseline: pBaseline,
    nextCompliance: refreshedProject.compliance,
  })
  assert.equal(syncResult.assessmentDraft.notes, '重要未保存评估意见 ABC', '修改事项后 aDraft 不丢')
  assert.equal(syncResult.planDraft.certificationPlan, '重要未保存计划方案 XYZ', '修改事项后 pDraft 不丢')
  assert.equal(syncResult.isAssessmentDirty, true)
  assert.equal(syncResult.isPlanDirty, true)

  // 3. 删除事项
  removeProjectComplianceRequirement(projA.id, req.id)

  refreshedProject = getProject(projA.id)
  syncResult = resolveSyncOnProjectUpdate({
    prevProjectId: projA.id,
    nextProjectId: projA.id,
    currentAssessmentDraft: aDraft,
    currentAssessmentBaseline: aBaseline,
    currentPlanDraft: pDraft,
    currentPlanBaseline: pBaseline,
    nextCompliance: refreshedProject.compliance,
  })
  assert.equal(syncResult.assessmentDraft.notes, '重要未保存评估意见 ABC', '删除事项后 aDraft 不丢')
  assert.equal(syncResult.planDraft.certificationPlan, '重要未保存计划方案 XYZ', '删除事项后 pDraft 不丢')
  assert.equal(syncResult.isAssessmentDirty, true)
  assert.equal(syncResult.isPlanDirty, true)
  assert.equal(refreshedProject.compliance.requirements.length, 0, '事项已确认删除')
  console.log('  ✅ 场景 C 通过：Requirement 增删改全程两块未保存草稿均完好保留')
}

// --- 场景 D: 模拟保存抛错，输入保留、错误可见、无成功反馈 ---
console.log('\n[场景 D] 模拟保存抛错，草稿保留且 dirty 保持，DOM 错误容器就绪：')
{
  const currentProject = getProject(projA.id)
  let aBaseline = extractAssessmentState(currentProject.compliance)
  let aDraft = {
    assessmentStatus: 'INVALID_STATUS', // 非法状态，将触发 Store 校验抛错
    riskLevel: 'HIGH',
    notes: '用户精心编写的合规备忘',
  }

  let caughtError = null
  let notice = ''

  try {
    updateProjectCompliance(projA.id, {
      assessmentStatus: aDraft.assessmentStatus,
      riskLevel: aDraft.riskLevel,
      notes: aDraft.notes,
    })
    notice = '合规评估已保存'
  } catch (err) {
    caughtError = err
  }

  assert(caughtError, '保存非法数据时必须抛错')
  assert.equal(notice, '', '抛错时绝不能设置成功通知')
  assert.equal(isAssessmentDirty(aDraft, aBaseline), true, '草稿必须仍然为 dirty')
  assert.equal(aDraft.notes, '用户精心编写的合规备忘', '草稿输入必须完全保留')

  // 验证组件 DOM 级错误反馈容器与项目身份拦截契约 (R1 / R3)
  assert(panelCode.includes('{errorMsg && ('), '组件 DOM 必须包含 errorMsg 条件渲染容器')
  assert(panelCode.includes('text-workspace-danger'), '组件 DOM 错误提示必须具备危险状态样式')
  assert(panelCode.includes('草稿所属项目与当前项目不一致，已阻止保存'), '组件必须包含跨项目保存拦截防护错误')
  console.log('  ✅ 场景 D 通过：保存失败抛错后草稿与 dirty 完好，无成功提示，组件 DOM 错误容器与项目身份拦截契约已就绪')
}

// --- 场景 E: 成功保存后该区块 dirty 清除，规范化值正确；另一块 dirty 不变 ---
console.log('\n[场景 E] 成功保存规范化回填，本区块 dirty 清除，另一区块不受影响：')
{
  const currentProject = getProject(projA.id)
  let aBaseline = extractAssessmentState(currentProject.compliance)
  let pBaseline = extractPlanState(currentProject.compliance)

  let aDraft = { ...aBaseline, notes: '待保留的未保存评估' }
  let pDraft = {
    standardsText: '  TR CU 004/2011  \n\n  TR CU 004/2011  \n  TR CU 020/2011  ',
    certificationPlan: '   去前后空格方案   ',
  }

  // 保存 Plan
  const normalizedStandards = normalizeApplicableStandards(pDraft.standardsText)
  assert.deepEqual(normalizedStandards, ['TR CU 004/2011', 'TR CU 020/2011'], '规范化自动去重去空')

  updateProjectCompliance(projA.id, {
    applicableStandards: normalizedStandards,
    certificationPlan: pDraft.certificationPlan,
  })

  // 回填规范化值
  pDraft = {
    standardsText: normalizedStandards.join('\n'),
    certificationPlan: pDraft.certificationPlan.trim(),
  }
  pBaseline = { ...pDraft }

  const refreshedProject = getProject(projA.id)
  const syncResult = resolveSyncOnProjectUpdate({
    prevProjectId: projA.id,
    nextProjectId: projA.id,
    currentAssessmentDraft: aDraft,
    currentAssessmentBaseline: aBaseline,
    currentPlanDraft: pDraft,
    currentPlanBaseline: pBaseline,
    nextCompliance: refreshedProject.compliance,
  })

  assert.equal(syncResult.isPlanDirty, false, 'Plan 保存后 dirty 清除')
  assert.equal(syncResult.planDraft.certificationPlan, '去前后空格方案', 'Plan certificationPlan 规范化回填')
  assert.equal(syncResult.isAssessmentDirty, true, 'Assessment 保持 dirty')
  assert.equal(syncResult.assessmentDraft.notes, '待保留的未保存评估', 'Assessment 草稿内容完好')
  console.log('  ✅ 场景 E 通过：规范化值正确回填，本区块 dirty 清除，另一区块保持 dirty')
}

// --- 场景 F: 项目 A/B 切换无串写；对离开时提醒的覆盖范围如实说明 ---
console.log('\n[场景 F] 项目 A/B 切换草稿隔离与重置（包含 A->B、B->A 及快速切换）：')
{
  const projAData = getProject(projA.id)
  const projBData = getProject(projB.id)

  // 1. 假设在项目 A 中留有未保存草稿
  let aDraftA = { assessmentStatus: 'COMPLETED', riskLevel: 'HIGH', notes: '项目 A 独有草稿' }
  let pDraftA = { standardsText: 'TR CU 010/2011', certificationPlan: '项目 A 计划' }

  // 2. 切换到项目 B
  const switchedSync = resolveSyncOnProjectUpdate({
    prevProjectId: projA.id,
    nextProjectId: projB.id,
    currentAssessmentDraft: aDraftA,
    currentAssessmentBaseline: extractAssessmentState(projAData.compliance),
    currentPlanDraft: pDraftA,
    currentPlanBaseline: extractPlanState(projAData.compliance),
    nextCompliance: projBData.compliance,
  })

  assert.equal(switchedSync.projectId, projB.id)
  assert.equal(switchedSync.isAssessmentDirty, false, '切到新项目后 Assessment dirty 必须重置为 false')
  assert.equal(switchedSync.isPlanDirty, false, '切到新项目后 Plan dirty 必须重置为 false')
  assert.notEqual(switchedSync.assessmentDraft.notes, '项目 A 独有草稿', '严禁将项目 A 的评估草稿带入项目 B')
  assert.notEqual(switchedSync.planDraft.standardsText, 'TR CU 010/2011', '严禁将项目 A 的计划草稿带入项目 B')

  // 3. 切换回项目 A (B -> A)
  const switchedBackSync = resolveSyncOnProjectUpdate({
    prevProjectId: projB.id,
    nextProjectId: projA.id,
    currentAssessmentDraft: extractAssessmentState(projBData.compliance),
    currentAssessmentBaseline: extractAssessmentState(projBData.compliance),
    currentPlanDraft: extractPlanState(projBData.compliance),
    currentPlanBaseline: extractPlanState(projBData.compliance),
    nextCompliance: projAData.compliance,
  })
  assert.equal(switchedBackSync.projectId, projA.id)
  assert.equal(switchedBackSync.isAssessmentDirty, false)
  assert.equal(switchedBackSync.isPlanDirty, false)
  console.log('  ✅ 场景 F 通过：项目切换时草稿彻底隔离重置，A->B 及 B->A 无串写风险')
}

// --- 场景 G: 同项目外部数据更新时，干净区块刷新，dirty 区块不被覆盖且冲突提示准确 ---
console.log('\n[场景 G] 同项目外部数据变更，未编辑区块刷新，dirty 区块冲突隔离与自动解除：')
{
  const currentProject = getProject(projA.id)
  let aBaseline = extractAssessmentState(currentProject.compliance)
  let pBaseline = extractPlanState(currentProject.compliance)

  // Plan 处于 clean 状态；Assessment 处于 dirty 状态
  let pDraft = { ...pBaseline }
  let aDraft = { ...aBaseline, notes: '本地正在编写的评估意见' }

  // 模拟外部（其他终端或后台）更新了 Store 中的 Plan 和 Assessment
  updateProjectCompliance(projA.id, {
    applicableStandards: ['TR CU 004/2011', 'TR CU 020/2011', 'GOST R 50571'],
    certificationPlan: '外部最新审核计划',
    assessmentStatus: 'COMPLETED',
    notes: '外部已由主管直接批准',
  })

  const updatedExternalProject = getProject(projA.id)

  const syncResult = resolveSyncOnProjectUpdate({
    prevProjectId: projA.id,
    nextProjectId: projA.id,
    currentAssessmentDraft: aDraft,
    currentAssessmentBaseline: aBaseline,
    currentPlanDraft: pDraft,
    currentPlanBaseline: pBaseline,
    nextCompliance: updatedExternalProject.compliance,
  })

  // 断言：
  // 1. 干净的 Plan 安全刷新到外部最新数据
  assert.equal(syncResult.isPlanDirty, false)
  assert.equal(syncResult.planConflict, false)
  assert.equal(syncResult.planDraft.certificationPlan, '外部最新审核计划', '干净区块必须自动同步外部最新数据')

  // 2. 已编辑的 Assessment 严禁静默覆盖，草稿完好保留，并准确标记冲突
  assert.equal(syncResult.isAssessmentDirty, true)
  assert.equal(syncResult.assessmentConflict, true, 'Assessment 必须标记冲突')
  assert.equal(syncResult.assessmentDraft.notes, '本地正在编写的评估意见', '用户草稿严禁被静默覆盖')

  // 3. 用户修改草稿使其与外部最新数据一致时，冲突自动解除 (R3)
  const resolvedSync = detectAssessmentConflict({
    draft: { ...aDraft, assessmentStatus: 'COMPLETED', notes: '外部已由主管直接批准' },
    baseline: aBaseline,
    incoming: extractAssessmentState(updatedExternalProject.compliance),
  })
  assert.equal(resolvedSync, false, '草稿修改与外部一致时冲突自动消除')

  // 4. [G2 模拟] 用户将草稿改回旧 baseline，外部仍然不同，必须保留冲突 (R4 / G2)
  const g2Sync = detectAssessmentConflict({
    draft: { ...aBaseline },
    baseline: aBaseline,
    incoming: extractAssessmentState(updatedExternalProject.compliance),
  })
  assert.equal(g2Sync, true, '草稿回到旧基准但外部已变时必须保留冲突')

  // 5. [G3 模拟] 草稿匹配外部最新数据时，resolveSyncOnProjectUpdate 自动采纳新基准并清除 dirty
  const g3Sync = resolveSyncOnProjectUpdate({
    prevProjectId: projA.id,
    nextProjectId: projA.id,
    currentAssessmentDraft: extractAssessmentState(updatedExternalProject.compliance),
    currentAssessmentBaseline: aBaseline,
    currentPlanDraft: pDraft,
    currentPlanBaseline: pBaseline,
    nextCompliance: updatedExternalProject.compliance,
  })
  assert.equal(g3Sync.isAssessmentDirty, false, '草稿匹配外部最新值后 dirty 必须清除')
  assert.equal(g3Sync.assessmentConflict, false, '草稿匹配外部最新值后 conflict 必须清除')
  assert.deepEqual(g3Sync.assessmentBaseline, extractAssessmentState(updatedExternalProject.compliance), '基准必须 rebase 为外部最新数据')

  console.log('  ✅ 场景 G 通过：干净区块安全刷新，已编辑区块冲突隔离，草稿匹配时冲突自动消除，G2/G3 流转健全')
}

// --- 场景 H: 桌面及移动端（约 390px）宽度布局检查（如实标记 not_run） ---
console.log('\n[场景 H] 桌面与移动端 (390px) 响应式样式契约与真实渲染检查：')
{
  // 验证关键 header 均具备 flex-wrap，防止窄屏下按钮与标题横向溢出
  const section1HeaderMatch = panelCode.match(/SECTION 1[\s\S]*?<Surface[\s\S]*?<div className="([^"]*)"/)
  assert(section1HeaderMatch && section1HeaderMatch[1].includes('flex-wrap'), 'Section 1 头部必须使用 flex-wrap')

  // 验证 Layer A / Layer B header 父容器使用 flex-wrap 与 gap-2
  assert(panelCode.includes('mb-3 flex flex-wrap items-center justify-between gap-2 border-b'), 'Layer A/B 头部必须使用 flex-wrap 与 gap-2')

  // 验证无任何写死的过大 min-width 导致手机宽度溢出
  assert(!panelCode.includes('min-w-[500px]'), '严禁写死大于 390px 的固定 min-width')
  assert(!panelCode.includes('min-w-[600px]'), '严禁写死大于 390px 的固定 min-width')
  assert(!panelCode.includes('min-w-[800px]'), '严禁写死大于 390px 的固定 min-width')
  console.log('  ⚠️ 场景 H 状态：静态 flex-wrap 与自适应栅格检查通过；按 REVISION-001 铁律，静态检查不等于真实浏览器渲染，标记为 not_run，交由 Codex 独立验收环节在加载完整 CSS 的真实浏览器下测量复核。')
}

// ==========================================
// PART 4: 真实 React 组件浏览器端集成测试 (Playwright Headless)
// ==========================================
console.log('\n--- PART 4: 真实 React 组件浏览器端集成测试 (Playwright) ---')

// 4.0 环境依赖预检 (R6: 绝不硬编码本机路径；R5: 缺失时干净跳过并如实汇报 not_run)
const codexModulesPath = process.env.CODEX_NODE_MODULES
if (!codexModulesPath) {
  console.log('  ⚠️ CODEX_NODE_MODULES 环境变量未设置，跳过真实组件 headless 浏览器集成测试。')
  console.log('     如需在本机运行真实组件集成测试，请设置：')
  console.log('     $env:CODEX_NODE_MODULES=\'<bundled node_modules path>\'')
  console.log('\n[TEST REPORT] Unit & static contract tests PASSED.')
  console.log('              Headless browser tests: not_run.')
  console.log('              Scenario H responsive visual layout: not_run.')
  process.exit(0)
}

let chromium, build
try {
  const { createRequire } = await import('node:module')
  const runtimeReq = createRequire(path.join(codexModulesPath, '_review.cjs'))
  const pw = runtimeReq('playwright')
  chromium = pw.chromium
  const appDir = path.join(ROOT, 'ozon-react')
  const reqApp = createRequire(path.join(appDir, 'package.json'))
  build = reqApp('esbuild').build
} catch (envErr) {
  console.log('  ⚠️ Playwright 或 esbuild 运行时依赖加载失败，跳过真实组件 headless 测试:', envErr.message)
  console.log('\n[TEST REPORT] Unit & static contract tests PASSED.')
  console.log('              Headless browser tests: not_run.')
  console.log('              Scenario H responsive visual layout: not_run.')
  process.exit(0)
}

console.log('  正在打包真实 React 组件测试 Bundle...')
const appDir = path.join(ROOT, 'ozon-react')
const bundle = await build({
  stdin: {
    resolveDir: appDir,
    loader: 'jsx',
    sourcefile: 'real-component-test.jsx',
    contents: `
import React from 'react';
import { createRoot } from 'react-dom/client';
import Panel from './src/components/t6/ProjectCompliancePanel.jsx';
import * as store from './src/utils/t6/t6Store.js';

const memory = new Map();
store._setAdapterForTests({
  get: k => memory.has(k) ? JSON.parse(memory.get(k)) : null,
  set: (k, v) => memory.set(k, JSON.stringify(v)),
  keys: () => [...memory.keys()]
});

const { candidate } = store.ensureCandidate({ sourceProductId: 'real-comp-test', name: 'Synthetic review', categoryLeaf: 'test' });
const snap = store.createSnapshot({
  candidateId: candidate.id,
  sourceProductId: candidate.sourceProductId,
  sourceInputs: { name: 'test' },
  scoreResult: { totalScore: 80, grade: 'B', status: 'RECOMMENDED' },
  marketContext: { matchMethod: 'exact' },
  marketEvidence: {}
});

const a = store.createProject({ candidateId: candidate.id, creationSnapshotId: snap.id, name: 'Synthetic A' });
const b = store.createProject({ candidateId: candidate.id, creationSnapshotId: snap.id, name: 'Synthetic B' });

store.updateProjectCompliance(a.id, {
  notes: 'A ORIGINAL NOTES',
  certificationPlan: 'A ORIGINAL PLAN',
  applicableStandards: ['TR CU 004/2011']
});
store.updateProjectCompliance(b.id, {
  notes: 'B ORIGINAL NOTES',
  certificationPlan: 'B ORIGINAL PLAN',
  applicableStandards: ['TR CU 020/2011']
});

const view = createRoot(document.getElementById('root'));

window.harness = {
  aId: a.id,
  bId: b.id,
  render: (id) => view.render(<Panel projectId={id} />),
  read: (id) => store.getProject(id),
  update: (id, patch) => store.updateProjectCompliance(id, patch)
};

window.harness.render(a.id);
`
  },
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"' }
})

// 故障注入测试钩子 (Requirement 39: 验证测试断言失败时 runner 绝不吞错且以非零码退出)
if (process.env.TEST_INJECT_FAILURE === '1') {
  assert.fail('[FAULT INJECTION] Intentional failure triggered by TEST_INJECT_FAILURE=1')
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' })
try {
  async function freshPage() {
    const page = await browser.newPage()
    await page.route('**/*', route => route.abort())
    await page.setContent('<html><body><div id="root"></div></body></html>')
    await page.addScriptTag({ content: bundle.outputFiles[0].text })
    await page.getByRole('button', { name: '保存评估状态', exact: true }).waitFor()
    return page
  }

  const page = await freshPage()
  const notes = page.locator('textarea').nth(0)
  const plan = page.locator('textarea').nth(2)

  // 4.1 场景 A
  await plan.fill('A DRAFT PLAN')
  await notes.fill('A SAVED NOTES')
  await page.getByRole('button', { name: '保存评估状态', exact: true }).click()
  assert.equal(await plan.inputValue(), 'A DRAFT PLAN')
  console.log('  ✅ [真实组件] 场景 A: 保存评估完好保留计划草稿')

  // 4.2 场景 B
  await notes.fill('A DRAFT NOTES 2')
  await page.getByRole('button', { name: '保存合规计划', exact: true }).click()
  assert.equal(await notes.inputValue(), 'A DRAFT NOTES 2')
  console.log('  ✅ [真实组件] 场景 B: 保存计划完好保留评估草稿')

  // 4.3 场景 C
  await notes.fill('UNSAVED NOTES FOR REQ TEST')
  await plan.fill('UNSAVED PLAN FOR REQ TEST')
  await page.getByRole('button', { name: '新增事项', exact: true }).click()
  await page.locator('input[placeholder*="低电压安全核验"]').fill('测试事项 1')
  await page.getByRole('button', { name: '确认添加', exact: true }).click()
  assert.equal(await notes.inputValue(), 'UNSAVED NOTES FOR REQ TEST')
  assert.equal(await plan.inputValue(), 'UNSAVED PLAN FOR REQ TEST')
  console.log('  ✅ [真实组件] 场景 C: 事项 CRUD 不影响草稿')

  // 4.4 场景 F: A -> B -> A 及快速切换
  await page.evaluate(() => window.harness.render(window.harness.bId))
  await page.waitForFunction(() => document.querySelector('textarea')?.value === 'B ORIGINAL NOTES')
  assert.equal(await notes.inputValue(), 'B ORIGINAL NOTES')
  assert.equal(await plan.inputValue(), 'B ORIGINAL PLAN')

  await page.getByRole('button', { name: '保存评估状态', exact: true }).click()
  const bData = await page.evaluate(() => window.harness.read(window.harness.bId))
  const aData = await page.evaluate(() => window.harness.read(window.harness.aId))
  assert.equal(bData.compliance.notes, 'B ORIGINAL NOTES')
  assert.equal(aData.compliance.notes, 'A SAVED NOTES')
  console.log('  ✅ [真实组件] 场景 F: A -> B 切换无串写，保存 B 不污染 A')

  await page.evaluate(() => window.harness.render(window.harness.aId))
  await page.waitForFunction(() => document.querySelector('textarea')?.value === 'A SAVED NOTES')
  assert.equal(await notes.inputValue(), 'A SAVED NOTES')
  console.log('  ✅ [真实组件] 场景 F: B -> A 切换正确显示 A 原始值')

  await page.evaluate(() => {
    window.harness.render(window.harness.bId)
    window.harness.render(window.harness.aId)
    window.harness.render(window.harness.bId)
  })
  await page.waitForFunction(() => document.querySelector('textarea')?.value === 'B ORIGINAL NOTES')
  assert.equal(await notes.inputValue(), 'B ORIGINAL NOTES')
  console.log('  ✅ [真实组件] 场景 F: 快速切换最终平稳稳定在目标项目')
  await page.close()

  // 4.5 场景 G / G2 / G3: Assessment 深入测试（旧值回退、匹配外部值后再编辑、外部连续两次变更、重复 render、显式载入）
  const extPage = await freshPage()
  const extNotes = extPage.locator('textarea').nth(0)
  const extPlan = extPage.locator('textarea').nth(2)

  await extNotes.fill('LOCAL UNSAVED NOTE')
  await extPage.evaluate(() => {
    window.harness.update(window.harness.aId, {
      notes: 'EXTERNAL CONFLICT NOTE',
      certificationPlan: 'EXTERNAL UPDATED PLAN'
    })
    window.harness.render(window.harness.aId)
  })
  await extPage.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))

  assert.equal(await extPlan.inputValue(), 'EXTERNAL UPDATED PLAN', '未编辑 Plan 安全自动同步')
  assert.equal(await extNotes.inputValue(), 'LOCAL UNSAVED NOTE', '已编辑 Assessment 草稿保留')
  assert.equal(await extPage.locator('[data-testid="assessment-conflict-banner"]').count(), 1, '产生冲突提示')
  console.log('  ✅ [真实组件] 场景 G: 干净区块自动刷新，dirty 区块提示冲突')

  // G.2 (旧值回退): 回退到旧基准 'A SAVED NOTES'，外部仍然为 EXTERNAL CONFLICT NOTE，必须保留冲突
  await extNotes.fill('A SAVED NOTES')
  await extPage.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
  assert.equal(await extPage.locator('[data-testid="assessment-conflict-banner"]').count(), 1, '回退到旧基准必须保留冲突')
  console.log('  ✅ [真实组件] 场景 G2: Assessment 回退到旧基准保留冲突提示')

  // G.3 (匹配外部值后再编辑): 改为与外部一致
  await extNotes.fill('EXTERNAL CONFLICT NOTE')
  await extPage.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
  assert.equal(await extPage.locator('[data-testid="assessment-conflict-banner"]').count(), 0, '匹配外部值时冲突消除')
  assert.equal(await extPage.locator('[data-testid="assessment-unsaved-badge"]').count(), 0, '基准 rebase 后 dirty 清除')

  // 匹配外部值后再编辑
  await extNotes.fill('LOCAL AGAIN')
  await extPage.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
  assert.equal(await extPage.locator('[data-testid="assessment-unsaved-badge"]').count(), 1, '再次编辑重新变为 dirty')
  assert.equal(await extPage.locator('[data-testid="assessment-conflict-banner"]').count(), 0, '相对新基准无新外部变化，不误报冲突')
  console.log('  ✅ [真实组件] 场景 G3: Assessment 匹配外部值后基准 rebase，再次编辑正常 dirty 且无误报冲突')

  // G.4 (外部连续两次变更)
  await extPage.evaluate(() => {
    window.harness.update(window.harness.aId, { notes: 'EXTERNAL CONFLICT NOTE 2' })
    window.harness.render(window.harness.aId)
  })
  await extPage.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
  assert.equal(await extPage.locator('[data-testid="assessment-conflict-banner"]').count(), 1, '外部再次变更时重新出现冲突')
  console.log('  ✅ [真实组件] 场景 G: Assessment 外部连续两次变更准确检测冲突')

  // G.5 (重复 render)
  await extPage.evaluate(() => {
    window.harness.render(window.harness.aId)
    window.harness.render(window.harness.aId)
    window.harness.render(window.harness.aId)
  })
  await extPage.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
  assert.equal(await extPage.locator('[data-testid="assessment-conflict-banner"]').count(), 1, '重复 render 稳定无异常')
  console.log('  ✅ [真实组件] 场景 G: Assessment 重复 render 状态稳定')

  // G.6 (点击显式载入)
  await extPage.locator('[data-testid="assessment-discard-btn"]').click()
  assert.equal(await extNotes.inputValue(), 'EXTERNAL CONFLICT NOTE 2', '显式载入最新外部数据')
  assert.equal(await extPage.locator('[data-testid="assessment-conflict-banner"]').count(), 0, '冲突提示清除')
  assert.equal(await extPage.locator('[data-testid="assessment-unsaved-badge"]').count(), 0, 'dirty 清除')
  console.log('  ✅ [真实组件] 场景 G: Assessment 点击显式载入外部数据成功')
  await extPage.close()

  // 4.6 场景 G-Plan: Plan 独立对称深入验证（旧值回退、匹配外部值后再编辑、外部连续两次变更、重复 render、显式载入）
  const planPage = await freshPage()
  const pNotes = planPage.locator('textarea').nth(0)
  const pPlan = planPage.locator('textarea').nth(2)

  // Plan 产生本地草稿
  await pPlan.fill('LOCAL PLAN DRAFT')
  await planPage.evaluate(() => {
    window.harness.update(window.harness.aId, { certificationPlan: 'EXTERNAL PLAN UPDATE 1' })
    window.harness.render(window.harness.aId)
  })
  await planPage.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
  assert.equal(await planPage.locator('[data-testid="plan-conflict-banner"]').count(), 1, 'Plan dirty 时外部更新提示冲突')

  // Plan 旧值回退
  await pPlan.fill('EXTERNAL UPDATED PLAN') // 此前在 a 中保存的基准
  await planPage.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
  assert.equal(await planPage.locator('[data-testid="plan-conflict-banner"]').count(), 1, 'Plan 回退到旧基准必须保留冲突')
  console.log('  ✅ [真实组件] 场景 G2-Plan: Plan 回退到旧基准保留冲突提示')

  // Plan 匹配外部值后再编辑
  await pPlan.fill('EXTERNAL PLAN UPDATE 1')
  await planPage.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
  assert.equal(await planPage.locator('[data-testid="plan-conflict-banner"]').count(), 0, 'Plan 匹配外部值时冲突消除')
  assert.equal(await planPage.locator('[data-testid="plan-unsaved-badge"]').count(), 0, 'Plan 基准 rebase 后 dirty 清除')

  await pPlan.fill('LOCAL PLAN AGAIN')
  await planPage.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
  assert.equal(await planPage.locator('[data-testid="plan-unsaved-badge"]').count(), 1, 'Plan 再次编辑重新变为 dirty')
  assert.equal(await planPage.locator('[data-testid="plan-conflict-banner"]').count(), 0, 'Plan 相对新基准无误报冲突')
  console.log('  ✅ [真实组件] 场景 G3-Plan: Plan 匹配外部值后基准 rebase，再次编辑正常 dirty 且无误报冲突')

  // Plan 外部连续两次变更
  await planPage.evaluate(() => {
    window.harness.update(window.harness.aId, { certificationPlan: 'EXTERNAL PLAN UPDATE 2' })
    window.harness.render(window.harness.aId)
  })
  await planPage.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
  assert.equal(await planPage.locator('[data-testid="plan-conflict-banner"]').count(), 1, 'Plan 外部再次变更时重新出现冲突')
  console.log('  ✅ [真实组件] 场景 G-Plan: Plan 外部连续两次变更准确检测冲突')

  // Plan 重复 render
  await planPage.evaluate(() => {
    window.harness.render(window.harness.aId)
    window.harness.render(window.harness.aId)
    window.harness.render(window.harness.aId)
  })
  await planPage.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
  assert.equal(await planPage.locator('[data-testid="plan-conflict-banner"]').count(), 1, 'Plan 重复 render 状态稳定')
  console.log('  ✅ [真实组件] 场景 G-Plan: Plan 重复 render 状态稳定')

  // Plan 点击显式载入
  await planPage.locator('[data-testid="plan-discard-btn"]').click()
  assert.equal(await pPlan.inputValue(), 'EXTERNAL PLAN UPDATE 2', 'Plan 显式载入最新外部数据')
  assert.equal(await planPage.locator('[data-testid="plan-conflict-banner"]').count(), 0, 'Plan 冲突提示清除')
  assert.equal(await planPage.locator('[data-testid="plan-unsaved-badge"]').count(), 0, 'Plan dirty 清除')
  console.log('  ✅ [真实组件] 场景 G-Plan: Plan 点击显式载入外部数据成功')
  await planPage.close()

} finally {
  await browser.close()
}

console.log('\n🎉 ALL SCENARIOS (A, B, C, F, G, G2, G3 & EXTENDED BROWSER TESTS) PASSED')
console.log('   (Scenario H responsive visual layout deferred as not_run to styled browser acceptance)')


