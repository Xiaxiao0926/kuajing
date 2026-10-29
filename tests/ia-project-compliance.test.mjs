/**
 * tests/ia-project-compliance.test.mjs
 * 
 * TASK 07A-4B: Project Compliance Assessment & Plan Workspace V1 — 专项测试套件
 * 
 * 覆盖：
 * 1. 静态源码与组件挂载契约（Panel、Detail Tab、不破坏 Legacy 与 Gate）
 * 2. complianceProfile 纯函数事实源与边界校验（Whitelist、Fail-close、类型保护、三层解耦）
 * 3. normalizeComplianceRequirement 与事项模型校验
 * 4. t6Store 合规档案 updateProjectCompliance 行为、事务一致性、DecisionLog 审计与项目隔离
 * 5. t6Store 合规事项 CRUD（create/update/remove）行为、唯一性保护与 DecisionLog 留痕
 * 6. 跨领域只读引用契约（快照市场证据、商品物理档案、打样实测数据绝不复制/篡改）
 * 7. 历史项目与空容器兼容性（初始 compliance: {}）
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
  COMPLIANCE_RISK_LEVELS,
  COMPLIANCE_REQUIREMENT_CATEGORIES,
  COMPLIANCE_REQUIREMENT_STATUS,
  isProjectComplianceEmpty,
  normalizeApplicableStandards,
  buildInitialComplianceDraft,
  buildNextProjectCompliance,
  normalizeComplianceRequirement,
} from '../ozon-react/src/utils/t6/t6Store.js'

console.log('===== IA Project Compliance Assessment & Plan V1 Test Suite (TASK 07A-4B) =====\n')

const ROOT = path.resolve('.')
const COMPLIANCE_UTILS_PATH = path.join(ROOT, 'ozon-react/src/utils/t6/complianceProfile.js')
const PANEL_PATH = path.join(ROOT, 'ozon-react/src/components/t6/ProjectCompliancePanel.jsx')
const DETAIL_PATH = path.join(ROOT, 'ozon-react/src/components/t6/ProjectDetailPage.jsx')
const GATE_PATH = path.join(ROOT, 'ozon-react/src/utils/t6/gateEngine.js')
const STAGE_TRANS_PATH = path.join(ROOT, 'ozon-react/src/utils/t6/stageTransition.js')
const STAGE_MODEL_PATH = path.join(ROOT, 'ozon-react/src/utils/t6/stageModel.js')
const PRODUCT_EDITOR_PATH = path.join(ROOT, 'ozon-react/src/components/t6/ProductProfileEditor.jsx')
const SUPPLY_PANEL_PATH = path.join(ROOT, 'ozon-react/src/components/t6/ProjectSupplyChainPanel.jsx')
const COST_ADAPTER_PATH = path.join(ROOT, 'ozon-react/src/utils/t6/costScenarioAdapter.js')
const LEGACY_COMPLIANCE_PATH = path.join(ROOT, 'ozon-react/src/components/ComplianceAssessment.jsx')

// ==========================================
// PART 1: 静态源码与组件契约测试
// ==========================================
console.log('--- PART 1: 静态源码与组件契约测试 ---')

// 1. complianceProfile.js 存在
assert(fs.existsSync(COMPLIANCE_UTILS_PATH), 'TEST 1: complianceProfile.js 文件必须存在')
console.log('  ✅ TEST 1: complianceProfile.js 存在')

// 2. ProjectCompliancePanel 存在
assert(fs.existsSync(PANEL_PATH), 'TEST 2: ProjectCompliancePanel.jsx 文件必须存在')
console.log('  ✅ TEST 2: ProjectCompliancePanel.jsx 存在')

// 3. ProjectDetailPage 挂载 ProjectCompliancePanel
assert(fs.existsSync(DETAIL_PATH), 'TEST 3: ProjectDetailPage.jsx 文件必须存在')
const detailCode = fs.readFileSync(DETAIL_PATH, 'utf-8')
assert(detailCode.includes("import ProjectCompliancePanel from './ProjectCompliancePanel'"), 'TEST 3A: ProjectDetailPage 必须导入 ProjectCompliancePanel')
assert(/tab === 'compliance' &&\s*\(\s*<ProjectCompliancePanel/.test(detailCode), 'TEST 3B: compliance Tab 必须挂载 ProjectCompliancePanel')
assert(detailCode.includes("compliance_update: '合规记录更新'"), 'TEST 3C: LOG_KIND_ZH 必须包含 compliance_update')
console.log('  ✅ TEST 3: ProjectDetailPage 挂载 ProjectCompliancePanel 且注册合规日志')

// 4. Legacy ComplianceAssessment 未被破坏且未被混用
assert(fs.existsSync(LEGACY_COMPLIANCE_PATH), 'TEST 4: ComplianceAssessment.jsx 必须保留')
const legacyCode = fs.readFileSync(LEGACY_COMPLIANCE_PATH, 'utf-8')
assert(!detailCode.includes('ComplianceAssessment'), 'TEST 4A: ProjectDetailPage 严禁引入 Legacy ComplianceAssessment')
assert(!legacyCode.includes('updateProjectCompliance'), 'TEST 4B: Legacy ComplianceAssessment 严禁直接调用 updateProjectCompliance')
console.log('  ✅ TEST 4: Legacy ComplianceAssessment 未被破坏且保持独立')

// 5. Gate 与其他核心模块未受任何未授权改动
const gateCode = fs.readFileSync(GATE_PATH, 'utf-8')
assert(!gateCode.includes('updateProjectCompliance'), 'TEST 5A: gateEngine 严禁改动或调用合规更新 API')
const costAdapterCode = fs.readFileSync(COST_ADAPTER_PATH, 'utf-8')
assert(!costAdapterCode.includes('project.compliance'), 'TEST 5B: costScenarioAdapter 严禁读取 project.compliance')
const stageTransCode = fs.readFileSync(STAGE_TRANS_PATH, 'utf-8')
assert(!stageTransCode.includes('project.compliance'), 'TEST 5C: stageTransition 严禁改动')
console.log('  ✅ TEST 5: Gate、Stage 与 Costing 核心模块未受任何未授权修改')

// 6. 禁止添加独立 Entity 表前缀
const storeCode = fs.readFileSync(path.join(ROOT, 'ozon-react/src/utils/t6/t6Store.js'), 'utf-8')
assert(!storeCode.includes("compliance: 't6.compliance.'"), 'TEST 6A: 严禁添加 t6.compliance. 独立实体表')
assert(!storeCode.includes("certificate: 't6.certificate.'"), 'TEST 6B: 严禁添加 t6.certificate. 独立实体表')
assert(!storeCode.includes("document: 't6.document.'"), 'TEST 6C: 严禁添加 t6.document. 独立实体表')
console.log('  ✅ TEST 6: 无多余独立实体表前缀，Requirements 规范内嵌')

// ==========================================
// PART 2: complianceProfile 纯函数事实源测试
// ==========================================
console.log('\n--- PART 2: complianceProfile 纯函数事实源测试 ---')

// 7. PROJECT_COMPLIANCE_FIELDS 白名单包含 8 个字段
assert.deepEqual(
  [...PROJECT_COMPLIANCE_FIELDS],
  ['assessmentStatus', 'riskLevel', 'applicableStandards', 'certificationPlan', 'requirements', 'notes', 'certificationApplicability', 'certificationApplicabilityNotes'],
  'TEST 7: PROJECT_COMPLIANCE_FIELDS 必须包含指定的 8 个白名单字段'
)
console.log('  ✅ TEST 7: PROJECT_COMPLIANCE_FIELDS 白名单包含指定的 8 个字段')

// 8. 枚举定义测试
assert.equal(COMPLIANCE_ASSESSMENT_STATUS.NOT_STARTED, 'NOT_STARTED')
assert.equal(COMPLIANCE_ASSESSMENT_STATUS.IN_ASSESSMENT, 'IN_ASSESSMENT')
assert.equal(COMPLIANCE_ASSESSMENT_STATUS.COMPLETED, 'COMPLETED')
assert.deepEqual([...COMPLIANCE_RISK_LEVELS], ['', 'LOW', 'MEDIUM', 'HIGH'])
assert.deepEqual([...COMPLIANCE_REQUIREMENT_CATEGORIES], ['REGULATION', 'INGREDIENT', 'LABELING', 'RISK', 'CERTIFICATION', 'OTHER'])
assert.equal(COMPLIANCE_REQUIREMENT_STATUS.PENDING, 'PENDING')
assert.equal(COMPLIANCE_REQUIREMENT_STATUS.IN_PROGRESS, 'IN_PROGRESS')
assert.equal(COMPLIANCE_REQUIREMENT_STATUS.DONE, 'DONE')
console.log('  ✅ TEST 8: 合规评估状态与事项类别枚举完整正确')

// 9. isProjectComplianceEmpty 判断
assert.equal(isProjectComplianceEmpty({}), true, 'TEST 9A: 空对象判定为空')
assert.equal(isProjectComplianceEmpty(null), true, 'TEST 9B: null 判定为空')
assert.equal(isProjectComplianceEmpty(undefined), true, 'TEST 9C: undefined 判定为空')
assert.equal(isProjectComplianceEmpty({ assessmentStatus: '', applicableStandards: [], requirements: [] }), true, 'TEST 9D: 全空字段判定为空')
assert.equal(isProjectComplianceEmpty({ assessmentStatus: 'IN_ASSESSMENT' }), false, 'TEST 9E: 有 assessmentStatus 判定非空')
assert.equal(isProjectComplianceEmpty({ requirements: [{ id: '1', name: 'CCC' }] }), false, 'TEST 9F: 有 requirements 判定非空')
console.log('  ✅ TEST 9: isProjectComplianceEmpty 判定准确')

// 10. normalizeApplicableStandards 规范化
assert.deepEqual(
  normalizeApplicableStandards([' TR CU 004/2011 ', 'TR CU 020/2011', '', '  ', 'TR CU 004/2011']),
  ['TR CU 004/2011', 'TR CU 020/2011'],
  'TEST 10A: 数组输入 trim、去空、去重并保持顺序'
)
assert.deepEqual(
  normalizeApplicableStandards('TR CU 004/2011\n\nTR CU 020/2011\n TR CU 004/2011 \n'),
  ['TR CU 004/2011', 'TR CU 020/2011'],
  'TEST 10B: 多行文本输入换行拆分、去空、去重'
)
assert.deepEqual(normalizeApplicableStandards(null), [], 'TEST 10C: null 返回空数组')
console.log('  ✅ TEST 10: normalizeApplicableStandards 规范化正确')

// 11. buildInitialComplianceDraft 构建初始草稿
const initDraft = buildInitialComplianceDraft()
assert.equal(initDraft.assessmentStatus, 'NOT_STARTED')
assert.equal(initDraft.riskLevel, '')
assert.deepEqual(initDraft.applicableStandards, [])
assert.equal(initDraft.certificationPlan, '')
assert.deepEqual(initDraft.requirements, [])
assert.equal(initDraft.notes, '')
console.log('  ✅ TEST 11: buildInitialComplianceDraft 初始草稿完备')

// 12. Fail-close 防御：禁止字段校验
assert.throws(
  () => buildNextProjectCompliance({ current: {}, patch: { requirements: [] } }),
  /禁止直接通过 updateProjectCompliance 修改 requirements/,
  'TEST 12A: 严禁通过 Profile patch 修改 requirements'
)
assert.throws(
  () => buildNextProjectCompliance({ current: {}, patch: { certificateNumber: 'RU C-CN.AB01.B.12345' } }),
  /结果层字段 "certificateNumber" 在 V1 阶段尚未接入/,
  'TEST 12B: 严禁混入 Result 字段 certificateNumber'
)
assert.throws(
  () => buildNextProjectCompliance({ current: {}, patch: { resultType: 'EXEMPTION_CONFIRMED' } }),
  /结果层字段 "resultType" 在 V1 阶段尚未接入/,
  'TEST 12C: 严禁混入 Result 字段 resultType'
)
assert.throws(
  () => buildNextProjectCompliance({ current: {}, patch: { documents: ['doc1'] } }),
  /附件字段 "documents" 受 P6 架构落差限制/,
  'TEST 12D: 严禁混入 Attachment 字段 documents'
)
assert.throws(
  () => buildNextProjectCompliance({ current: {}, patch: { eacStatus: 'EAC' } }),
  /市场证据字段 "eacStatus" 为 Snapshot 只读引用/,
  'TEST 12E: 严禁混入 Market Evidence 字段 eacStatus'
)
assert.throws(
  () => buildNextProjectCompliance({ current: {}, patch: { nameZh: '高压吹风机' } }),
  /商品物理属性 "nameZh" 属于 project\.product/,
  'TEST 12F: 严禁混入 Product 字段 nameZh'
)
assert.throws(
  () => buildNextProjectCompliance({ current: {}, patch: { sampleStatus: 'approved' } }),
  /供应链样品属性 "sampleStatus" 属于 SampleRecord/,
  'TEST 12G: 严禁混入 Sample 字段 sampleStatus'
)
assert.throws(
  () => buildNextProjectCompliance({ current: {}, patch: { unknownProp: 'value' } }),
  /未知或非法合规档案字段 "unknownProp"/,
  'TEST 12H: 严禁未知字段'
)
console.log('  ✅ TEST 12: buildNextProjectCompliance Fail-close 边界防御全拦截')

// 13. 枚举与类型 Fail-close 校验
assert.throws(
  () => buildNextProjectCompliance({ current: {}, patch: { assessmentStatus: 'PASSED' } }),
  /assessmentStatus 必须是有效的评估状态/,
  'TEST 13A: 非法 assessmentStatus 抛出'
)
assert.throws(
  () => buildNextProjectCompliance({ current: {}, patch: { riskLevel: 'EXTREME' } }),
  /riskLevel 必须是有效的风险等级/,
  'TEST 13B: 非法 riskLevel 抛出'
)
assert.throws(
  () => buildNextProjectCompliance({ current: {}, patch: { applicableStandards: 123 } }),
  /applicableStandards 必须是字符串数组/,
  'TEST 13C: 非法 applicableStandards 类型抛出'
)
console.log('  ✅ TEST 13: 字段类型与枚举 Fail-close 校验通过')

// 14. buildNextProjectCompliance 合法合并并保持 requirements
const prevCompliance = {
  assessmentStatus: 'NOT_STARTED',
  riskLevel: 'LOW',
  applicableStandards: ['TR CU 004/2011'],
  certificationPlan: '无需办证',
  requirements: [{ id: 'req-1', name: '绝缘测试', category: 'REGULATION', required: true, status: 'PENDING' }],
  notes: '旧备忘',
}
const nextComp = buildNextProjectCompliance({
  current: prevCompliance,
  patch: {
    assessmentStatus: 'IN_ASSESSMENT',
    riskLevel: 'MEDIUM',
    certificationPlan: '工厂提供报告申请豁免',
    notes: '新备忘',
  },
})
assert.equal(nextComp.assessmentStatus, 'IN_ASSESSMENT')
assert.equal(nextComp.riskLevel, 'MEDIUM')
assert.equal(nextComp.certificationPlan, '工厂提供报告申请豁免')
assert.equal(nextComp.notes, '新备忘')
assert.deepEqual(nextComp.requirements, prevCompliance.requirements, 'TEST 14: requirements 数组完全保留不可变')
console.log('  ✅ TEST 14: buildNextProjectCompliance 合法合并且保护 requirements')

// 15. normalizeComplianceRequirement 事项规范化校验
assert.throws(() => normalizeComplianceRequirement(null), /requirement 必须是普通对象/)
assert.throws(() => normalizeComplianceRequirement({ id: '', name: '测试' }), /事项 id 必须是非空字符串/)
assert.throws(() => normalizeComplianceRequirement({ id: 'r1', category: 'INVALID', name: '测试' }), /category 必须是有效的合规事项类别/)
assert.throws(() => normalizeComplianceRequirement({ id: 'r1', category: 'REGULATION', name: '' }), /事项名称 name 必须是非空字符串/)
assert.throws(() => normalizeComplianceRequirement({ id: 'r1', category: 'REGULATION', name: '测试', required: 'true' }), /required 必须为布尔值/)
assert.throws(() => normalizeComplianceRequirement({ id: 'r1', category: 'REGULATION', name: '测试', required: true, status: 'APPROVED' }), /status 必须是有效的状态/)
assert.throws(() => normalizeComplianceRequirement({ id: 'r1', category: 'REGULATION', name: '测试', required: true, status: 'PENDING', risk: 'FATAL' }), /risk 必须是有效的风险等级/)

const validReq = normalizeComplianceRequirement({
  id: ' req-123 ',
  category: 'REGULATION',
  name: '  低电压指令核查  ',
  required: true,
  status: 'PENDING',
  risk: 'MEDIUM',
  desc: '  核对说明书绝缘警示  ',
})
assert.equal(validReq.id, 'req-123')
assert.equal(validReq.category, 'REGULATION')
assert.equal(validReq.name, '低电压指令核查')
assert.equal(validReq.required, true)
assert.equal(validReq.status, 'PENDING')
assert.equal(validReq.risk, 'MEDIUM')
assert.equal(validReq.desc, '核对说明书绝缘警示')
assert.ok(validReq.createdAt)
assert.ok(validReq.updatedAt)
console.log('  ✅ TEST 15: normalizeComplianceRequirement 规范化与类型安全测试通过')

// ==========================================
// PART 3: t6Store 合规档案与事项持久化测试
// ==========================================
console.log('\n--- PART 3: t6Store 合规档案与事项持久化测试 ---')

// 注入测试内存适配器
const testDB = new Map()
_setAdapterForTests({
  get: (k) => (testDB.has(k) ? JSON.parse(testDB.get(k)) : null),
  set: (k, v) => testDB.set(k, JSON.stringify(v)),
  keys: () => Array.from(testDB.keys()),
})

// 创建测试候选与快照
const { candidate } = ensureCandidate({
  sourceProductId: 'cand-comp-001',
  name: '负离子电吹风-俄规款',
  categoryLeaf: '电吹风',
})
const snap = createSnapshot({
  candidateId: candidate.id,
  sourceProductId: candidate.sourceProductId,
  sourceInputs: { name: '负离子电吹风-俄规款', category_leaf: '电吹风', price_rub: 2500 },
  scoreResult: { totalScore: 88, grade: 'A', status: 'RECOMMENDED' },
  marketContext: { matchMethod: 'exact' },
  marketEvidence: {
    eacStatus: 'EAC Certificate Required',
    certificationStatus: 'ТР ТС 004/2011, 020/2011',
  },
})

// 创建项目 A
const projectA = createProject({
  candidateId: candidate.id,
  creationSnapshotId: snap.id,
  name: '电吹风合规专项项目',
})
assert.ok(projectA.id)
assert.deepEqual(projectA.compliance, { certificationApplicability: 'UNASSESSED' }, 'TEST 16: 新建项目初始 compliance 为 { certificationApplicability: "UNASSESSED" }')
console.log('  ✅ TEST 16: 新建项目初始 compliance 包含 UNASSESSED')

// 17. updateProjectCompliance 更新合规档案
const pA1 = updateProjectCompliance(projectA.id, {
  assessmentStatus: 'IN_ASSESSMENT',
  riskLevel: 'LOW',
  notes: '已安排工程师检索法规',
}, { by: 'compliance_officer', reason: '启动合规初审' })

assert.equal(pA1.compliance.assessmentStatus, 'IN_ASSESSMENT')
assert.equal(pA1.compliance.riskLevel, 'LOW')
assert.equal(pA1.compliance.notes, '已安排工程师检索法规')
assert.deepEqual(pA1.compliance.requirements || [], [])

// 检查 DecisionLog 审计记录
const logsA = pA1.decisionLog.map((id) => getLog(id))
const compLog1 = logsA.find((l) => l.kind === 'compliance_update')
assert.ok(compLog1, 'TEST 17A: 必须生成 compliance_update 审计日志')
assert.equal(compLog1.subjectType, 'project')
assert.equal(compLog1.subjectId, projectA.id)
assert.equal(compLog1.by, 'compliance_officer')
assert.equal(compLog1.reason, '启动合规初审')
const fromDiff1 = JSON.parse(compLog1.from)
const toDiff1 = JSON.parse(compLog1.to)
assert.equal(fromDiff1.assessmentStatus, null)
assert.equal(toDiff1.assessmentStatus, 'IN_ASSESSMENT')
assert.equal(toDiff1.riskLevel, 'LOW')
console.log('  ✅ TEST 17: updateProjectCompliance 档案更新与决策审计留痕通过')

// 18. updateProjectCompliance 更新适用标准与计划
const pA2 = updateProjectCompliance(projectA.id, {
  applicableStandards: ['TR CU 004/2011', 'TR CU 020/2011'],
  certificationPlan: '代工厂已持有 EAC DoC，仅需核对俄语说明书',
})
assert.deepEqual(pA2.compliance.applicableStandards, ['TR CU 004/2011', 'TR CU 020/2011'])
assert.equal(pA2.compliance.certificationPlan, '代工厂已持有 EAC DoC，仅需核对俄语说明书')
assert.equal(pA2.compliance.assessmentStatus, 'IN_ASSESSMENT', '保留先前的评估状态')
console.log('  ✅ TEST 18: updateProjectCompliance 更新适用法规标准与认证方案计划')

// 19. updateProjectCompliance No-op 幂等性测试（无变更不写 Store，不写 Log）
const logCountBefore = pA2.decisionLog.length
const pA2_noop = updateProjectCompliance(projectA.id, {
  assessmentStatus: 'IN_ASSESSMENT',
  riskLevel: 'LOW',
  notes: '已安排工程师检索法规',
})
assert.equal(pA2_noop.decisionLog.length, logCountBefore, 'TEST 19A: 无变更时禁止追加决策日志')
console.log('  ✅ TEST 19: updateProjectCompliance 无变更时严格执行 No-op')

// 20. createProjectComplianceRequirement 创建事项
const pA3 = createProjectComplianceRequirement(projectA.id, {
  category: 'REGULATION',
  name: '低电压安全符合性确认',
  required: true,
  status: 'IN_PROGRESS',
  risk: 'MEDIUM',
  desc: '要求工厂出具最新安规测试报告',
}, { by: 'qa_lead', reason: '追加安规事项' })

assert.equal(pA3.compliance.requirements.length, 1)
const r1 = pA3.compliance.requirements[0]
assert.ok(r1.id)
assert.equal(r1.name, '低电压安全符合性确认')
assert.equal(r1.category, 'REGULATION')
assert.equal(r1.required, true)
assert.equal(r1.status, 'IN_PROGRESS')

// 检查事项创建决策日志
const logReqCreate = getLog(pA3.decisionLog[pA3.decisionLog.length - 1])
assert.equal(logReqCreate.kind, 'compliance_update')
assert.equal(logReqCreate.from, null)
const toReqCreate = JSON.parse(logReqCreate.to)
assert.equal(toReqCreate.id, r1.id)
assert.equal(toReqCreate.name, '低电压安全符合性确认')
console.log('  ✅ TEST 20: createProjectComplianceRequirement 事项创建成功且日志完整')

// 21. createProjectComplianceRequirement 唯一性保护
assert.throws(
  () => createProjectComplianceRequirement(projectA.id, { id: r1.id, category: 'LABELING', name: '重名' }),
  /合规事项 ID .* 已存在/,
  'TEST 21: 重复事项 ID 必须被拒绝（Fail-close）'
)
console.log('  ✅ TEST 21: 事项 ID 重复检测防御生效')

// 22. updateProjectComplianceRequirement 更新事项
const pA4 = updateProjectComplianceRequirement(projectA.id, r1.id, {
  status: 'DONE',
  desc: '工厂已提供报告编号 TR-2026-888 并核验无误',
}, { by: 'qa_lead', reason: '安规报告确认通过' })

const r1Updated = pA4.compliance.requirements.find((r) => r.id === r1.id)
assert.equal(r1Updated.status, 'DONE')
assert.equal(r1Updated.desc, '工厂已提供报告编号 TR-2026-888 并核验无误')
assert.equal(r1Updated.name, r1.name, '未修改字段保持不变')

// 检查事项更新决策日志
const logReqUpdate = getLog(pA4.decisionLog[pA4.decisionLog.length - 1])
assert.equal(logReqUpdate.kind, 'compliance_update')
const fromReqUp = JSON.parse(logReqUpdate.from)
const toReqUp = JSON.parse(logReqUpdate.to)
assert.equal(fromReqUp.status, 'IN_PROGRESS')
assert.equal(toReqUp.status, 'DONE')
console.log('  ✅ TEST 22: updateProjectComplianceRequirement 事项更新成功且差异留痕')

// 23. updateProjectComplianceRequirement No-op 幂等性测试
const logCountBeforeReqNoop = pA4.decisionLog.length
const pA4_noop = updateProjectComplianceRequirement(projectA.id, r1.id, {
  status: 'DONE',
  desc: '工厂已提供报告编号 TR-2026-888 并核验无误',
})
assert.equal(pA4_noop.decisionLog.length, logCountBeforeReqNoop, '无变更禁止追加日志')
console.log('  ✅ TEST 23: updateProjectComplianceRequirement No-op 幂等性通过')

// 24. updateProjectComplianceRequirement 禁止修改 id 与 createdAt
assert.throws(
  () => updateProjectComplianceRequirement(projectA.id, r1.id, { id: 'other-id' }),
  /禁止修改合规事项 id/,
  'TEST 24A: 禁止篡改事项 id'
)
assert.throws(
  () => updateProjectComplianceRequirement(projectA.id, r1.id, { createdAt: '2020-01-01T00:00:00.000Z' }),
  /禁止修改合规事项 createdAt/,
  'TEST 24B: 禁止篡改事项 createdAt'
)
console.log('  ✅ TEST 24: 事项 id 与 createdAt 不可变保护生效')

// 25. removeProjectComplianceRequirement 删除事项
const pA5 = removeProjectComplianceRequirement(projectA.id, r1.id, { by: 'qa_lead', reason: '复核后取消该事项' })
assert.equal(pA5.compliance.requirements.length, 0, '事项已从数组中移除')

// 检查删除日志
const logReqDelete = getLog(pA5.decisionLog[pA5.decisionLog.length - 1])
assert.equal(logReqDelete.kind, 'compliance_update')
assert.equal(logReqDelete.to, null)
const fromReqDel = JSON.parse(logReqDelete.from)
assert.equal(fromReqDel.id, r1.id)
assert.equal(fromReqDel.name, '低电压安全符合性确认')
console.log('  ✅ TEST 25: removeProjectComplianceRequirement 删除成功且日志闭环')

// 26. 项目间数据隔离测试
const projectB = createProject({
  candidateId: candidate.id,
  creationSnapshotId: snap.id,
  name: '电吹风B项目',
})
updateProjectCompliance(projectB.id, {
  assessmentStatus: 'COMPLETED',
  riskLevel: 'HIGH',
  notes: 'B 项目高风险备忘',
})
const refreshedA = getProject(projectA.id)
const refreshedB = getProject(projectB.id)
assert.equal(refreshedA.compliance.assessmentStatus, 'IN_ASSESSMENT', 'A 项目评估状态不受 B 影响')
assert.equal(refreshedA.compliance.riskLevel, 'LOW', 'A 项目风险等级不受 B 影响')
assert.equal(refreshedB.compliance.assessmentStatus, 'COMPLETED')
assert.equal(refreshedB.compliance.riskLevel, 'HIGH')
console.log('  ✅ TEST 26: 多项目合规档案完全隔离，互不干扰')

// 27. 跨领域只读引用契约验证
assert.equal(snap.marketEvidence.eacStatus, 'EAC Certificate Required', '快照市场 EAC 状态保持不变')
assert.equal(refreshedA.compliance.eacStatus, undefined, '合规档案绝未复制 eacStatus')
assert.equal(refreshedA.product.nameZh, undefined, '商品档案物理属性未被污染')
console.log('  ✅ TEST 27: 跨领域数据所有权隔离验证通过，零跨域复制')

// ==========================================
// PART 4: 细粒度边界与异常保护测试
// ==========================================
console.log('\n--- PART 4: 细粒度边界与异常保护测试 ---')

// 28. 项目不存在时抛错
assert.throws(() => updateProjectCompliance('non-existent-proj', { riskLevel: 'LOW' }), /项目 non-existent-proj 不存在/, 'TEST 28A: updateProjectCompliance 项目不存在抛错')
assert.throws(() => createProjectComplianceRequirement('non-existent-proj', { name: 'X', category: 'OTHER' }), /项目 non-existent-proj 不存在/, 'TEST 28B: createProjectComplianceRequirement 项目不存在抛错')
assert.throws(() => updateProjectComplianceRequirement('non-existent-proj', 'req-1', { name: 'X' }), /项目 non-existent-proj 不存在/, 'TEST 28C: updateProjectComplianceRequirement 项目不存在抛错')
assert.throws(() => removeProjectComplianceRequirement('non-existent-proj', 'req-1'), /项目 non-existent-proj 不存在/, 'TEST 28D: removeProjectComplianceRequirement 项目不存在抛错')
console.log('  ✅ TEST 28: 项目不存在时所有 Store 方法 Fail-close 抛错')

// 29. 事项不存在时抛错
assert.throws(() => updateProjectComplianceRequirement(projectA.id, 'non-existent-req', { name: 'X' }), /合规事项 non-existent-req 不存在/, 'TEST 29A: update 事项不存在抛错')
assert.throws(() => removeProjectComplianceRequirement(projectA.id, 'non-existent-req'), /合规事项 non-existent-req 不存在/, 'TEST 29B: remove 事项不存在抛错')
console.log('  ✅ TEST 29: 事项不存在时 Fail-close 抛错')

// 30. patch 类型非对象抛错
assert.throws(() => updateProjectCompliance(projectA.id, null), /patch 必须为普通对象/, 'TEST 30A: patch 为 null 抛错')
assert.throws(() => updateProjectCompliance(projectA.id, 'string'), /patch 必须为普通对象/, 'TEST 30B: patch 为 string 抛错')
assert.throws(() => updateProjectCompliance(projectA.id, [1, 2]), /patch 必须为普通对象/, 'TEST 30C: patch 为 array 抛错')
assert.throws(() => createProjectComplianceRequirement(projectA.id, null), /requirement 输入必须为普通对象/, 'TEST 30D: input 为 null 抛错')
assert.throws(() => updateProjectComplianceRequirement(projectA.id, 'r-1', null), /patch 必须为普通对象/, 'TEST 30E: patch 为 null 抛错')
console.log('  ✅ TEST 30: 非普通对象输入全被 Fail-close 拦截')

// 31. 在全新的空项目上直接创建事项（自动初始化 draft 并追加 requirements）
const projectC = createProject({
  candidateId: candidate.id,
  creationSnapshotId: snap.id,
  name: '电吹风C项目-空白合规直接建事项',
})
assert.deepEqual(projectC.compliance, { certificationApplicability: 'UNASSESSED' })
const pC1 = createProjectComplianceRequirement(projectC.id, {
  category: 'INGREDIENT',
  name: '外壳环保阻燃材料核查',
  required: false,
  status: 'PENDING',
  risk: 'LOW',
  desc: 'ROHS 环保检测报告',
})
assert.equal(pC1.compliance.assessmentStatus, undefined, '创建事项绝不自动建立评估状态')
assert.equal(pC1.compliance.requirements.length, 1)
assert.equal(pC1.compliance.requirements[0].category, 'INGREDIENT')
assert.equal(pC1.compliance.requirements[0].required, false)
console.log('  ✅ TEST 31: 空白合规项目直接创建事项，自动保留容器且不隐式建立评估状态')

// 32. 完整保留已有事项，仅更新档案 Profile 字段
const pC2 = updateProjectCompliance(projectC.id, {
  assessmentStatus: 'COMPLETED',
  riskLevel: 'LOW',
  applicableStandards: ['GB 4706.1', 'TR CU 004/2011'],
  certificationPlan: '已有国内 3C 与 ROHS，可作为基础资料申请 EAC',
  notes: '审核完毕，准入风险低',
})
assert.equal(pC2.compliance.assessmentStatus, 'COMPLETED')
assert.equal(pC2.compliance.requirements.length, 1, '现有事项未丢失')
assert.equal(pC2.compliance.requirements[0].name, '外壳环保阻燃材料核查')
console.log('  ✅ TEST 32: updateProjectCompliance 更新档案完全保留已有事项')

console.log('\n🎉 ALL 32 TEST GROUPS PASSED (TASK 07A-4B SUCCESS)!\n')

