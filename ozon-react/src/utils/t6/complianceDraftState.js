/**
 * utils/t6/complianceDraftState.js — Project Compliance 独立草稿状态管理与冲突检测纯函数
 * 
 * 任务：KJ-GEMINI-20260920-001 (Compliance Panel Unsaved Input Protection)
 * 契约：
 * 1. 纯函数状态计算，零 DOM / React 依赖，零 Store / 本地持久化副作用。
 * 2. 独立跟踪 Assessment 与 Plan 两大表单区块的 draft 与 baseline。
 * 3. 严格判定 dirty 状态与外部数据并发更新冲突（detectAssessmentConflict, detectPlanConflict）。
 * 4. 项目切换（projectId 变化）提供干净重置，杜绝跨项目草稿串入。
 * 5. 外部更新时，干净区块安全刷新，dirty 区块严禁静默覆盖，准确标出冲突。
 */

import { COMPLIANCE_ASSESSMENT_STATUS } from './complianceProfile.js'

/**
 * 从 compliance 对象提取 Assessment 规范化状态
 * @param {object|null|undefined} compliance
 * @returns {{ assessmentStatus: string, riskLevel: string, notes: string }}
 */
export function extractAssessmentState(compliance) {
  const comp = compliance || {}
  return {
    assessmentStatus: comp.assessmentStatus || COMPLIANCE_ASSESSMENT_STATUS.NOT_STARTED,
    riskLevel: comp.riskLevel || '',
    notes: comp.notes || '',
    certificationApplicability: comp.certificationApplicability,
    certificationApplicabilityNotes: comp.certificationApplicabilityNotes || '',
  }
}

/**
 * 从 compliance 对象提取 Plan 规范化状态
 * @param {object|null|undefined} compliance
 * @returns {{ standardsText: string, certificationPlan: string }}
 */
export function extractPlanState(compliance) {
  const comp = compliance || {}
  const standardsText = Array.isArray(comp.applicableStandards)
    ? comp.applicableStandards.join('\n')
    : (typeof comp.applicableStandards === 'string' ? comp.applicableStandards : '')
  return {
    standardsText,
    certificationPlan: comp.certificationPlan || '',
  }
}

/**
 * 判定 Assessment 表单草稿是否包含未保存修改
 * @param {object} draft
 * @param {object} baseline
 * @returns {boolean}
 */
export function isAssessmentDirty(draft, baseline) {
  if (!draft || !baseline) return false
  return (
    draft.assessmentStatus !== baseline.assessmentStatus ||
    draft.riskLevel !== baseline.riskLevel ||
    draft.notes !== baseline.notes ||
    draft.certificationApplicability !== baseline.certificationApplicability ||
    (draft.certificationApplicabilityNotes || '') !== (baseline.certificationApplicabilityNotes || '')
  )
}

/**
 * 判定 Plan 表单草稿是否包含未保存修改
 * @param {object} draft
 * @param {object} baseline
 * @returns {boolean}
 */
export function isPlanDirty(draft, baseline) {
  if (!draft || !baseline) return false
  return (
    draft.standardsText !== baseline.standardsText ||
    draft.certificationPlan !== baseline.certificationPlan
  )
}

/**
 * 判定两份 Assessment 数据状态值是否完全一致
 * @param {object} a
 * @param {object} b
 * @returns {boolean}
 */
export function isAssessmentEqual(a, b) {
  if (!a || !b) return false
  return (
    a.assessmentStatus === b.assessmentStatus &&
    a.riskLevel === b.riskLevel &&
    a.notes === b.notes &&
    a.certificationApplicability === b.certificationApplicability &&
    (a.certificationApplicabilityNotes || '') === (b.certificationApplicabilityNotes || '')
  )
}

/**
 * 判定两份 Plan 数据状态值是否完全一致
 * @param {object} a
 * @param {object} b
 * @returns {boolean}
 */
export function isPlanEqual(a, b) {
  if (!a || !b) return false
  return (
    a.standardsText === b.standardsText &&
    a.certificationPlan === b.certificationPlan
  )
}

/**
 * 检测外部合规评估数据更新是否与当前本地草稿冲突
 * 规则（Revision 002）：
 * - 外部最新数据与 baseline 相比发生变更（incoming !== baseline）
 * - 且当前本地草稿未采纳外部数据（draft !== incoming）
 * - 无论当前本地草稿是自由编辑值还是回退到了旧 baseline，只要外部已产生未采纳的新值，均判定为冲突 (R4 / G2)
 * - 当草稿修改为与 incoming 一致时，冲突消除 (G3)
 * @param {object} param0
 * @param {object} param0.draft 本地草稿
 * @param {object} param0.baseline 上次同步/保存基准
 * @param {object} param0.incoming 外部最新数据
 * @returns {boolean}
 */
export function detectAssessmentConflict({ draft, baseline, incoming }) {
  if (!incoming || !baseline || !draft) return false

  const externalChanged = !isAssessmentEqual(incoming, baseline)
  if (!externalChanged) return false

  // 若外部数据正好与当前草稿完全一致，则无实质冲突
  const matchesIncoming = isAssessmentEqual(draft, incoming)
  return !matchesIncoming
}

/**
 * 检测外部合规计划数据更新是否与当前本地草稿冲突
 * 规则（Revision 002，与 Assessment 保持完全一致策略）：
 * - 外部最新数据与 baseline 相比发生变更（incoming !== baseline）
 * - 且当前本地草稿未采纳外部数据（draft !== incoming）
 * @param {object} param0
 * @param {object} param0.draft 本地草稿
 * @param {object} param0.baseline 上次同步/保存基准
 * @param {object} param0.incoming 外部最新数据
 * @returns {boolean}
 */
export function detectPlanConflict({ draft, baseline, incoming }) {
  if (!incoming || !baseline || !draft) return false

  const externalChanged = !isPlanEqual(incoming, baseline)
  if (!externalChanged) return false

  const matchesIncoming = isPlanEqual(draft, incoming)
  return !matchesIncoming
}

/**
 * 当 project / compliance 发生变动（或 project 切换）时，计算各区块的下一步同步状态
 * 
 * @param {object} params
 * @param {string|null} params.prevProjectId 上次挂载/执行的 projectId
 * @param {string|null} params.nextProjectId 本次接收的 projectId
 * @param {object} params.currentAssessmentDraft
 * @param {object} params.currentAssessmentBaseline
 * @param {object} params.currentPlanDraft
 * @param {object} params.currentPlanBaseline
 * @param {object|null|undefined} params.nextCompliance
 * @returns {object} 计算后的全面状态
 */
export function resolveSyncOnProjectUpdate({
  prevProjectId,
  nextProjectId,
  currentAssessmentDraft,
  currentAssessmentBaseline,
  currentPlanDraft,
  currentPlanBaseline,
  nextCompliance,
}) {
  const incomingAssessment = extractAssessmentState(nextCompliance)
  const incomingPlan = extractPlanState(nextCompliance)

  // 1. 项目切换：全面清空并初始化为目标项目数据，绝不带入上一个项目的草稿
  if (nextProjectId !== prevProjectId || !prevProjectId) {
    return {
      projectId: nextProjectId,
      assessmentDraft: incomingAssessment,
      assessmentBaseline: incomingAssessment,
      isAssessmentDirty: false,
      assessmentConflict: false,
      planDraft: incomingPlan,
      planBaseline: incomingPlan,
      isPlanDirty: false,
      planConflict: false,
      incomingAssessment,
      incomingPlan,
    }
  }

  // 2. 同一项目内的更新同步
  // Layer A: Assessment
  const assessmentDirty = isAssessmentDirty(currentAssessmentDraft, currentAssessmentBaseline)
  let nextAssessmentDraft = currentAssessmentDraft
  let nextAssessmentBaseline = currentAssessmentBaseline
  let nextAssessmentConflict = false

  if (isAssessmentEqual(currentAssessmentDraft, incomingAssessment)) {
    // 草稿匹配外部最新数据：接受 incoming 为新基准，清除 dirty 与冲突 (G3)
    nextAssessmentDraft = incomingAssessment
    nextAssessmentBaseline = incomingAssessment
    nextAssessmentConflict = false
  } else if (assessmentDirty) {
    const conflict = detectAssessmentConflict({
      draft: currentAssessmentDraft,
      baseline: currentAssessmentBaseline,
      incoming: incomingAssessment,
    })
    nextAssessmentConflict = conflict
    nextAssessmentDraft = currentAssessmentDraft
    nextAssessmentBaseline = currentAssessmentBaseline
  } else {
    // 未编辑（clean）：若外部发生变动则安全刷新
    if (!isAssessmentEqual(incomingAssessment, currentAssessmentBaseline)) {
      nextAssessmentDraft = incomingAssessment
      nextAssessmentBaseline = incomingAssessment
      nextAssessmentConflict = false
    } else {
      nextAssessmentDraft = currentAssessmentDraft
      nextAssessmentBaseline = currentAssessmentBaseline
      nextAssessmentConflict = false
    }
  }

  // Layer B: Plan
  const planDirty = isPlanDirty(currentPlanDraft, currentPlanBaseline)
  let nextPlanDraft = currentPlanDraft
  let nextPlanBaseline = currentPlanBaseline
  let nextPlanConflict = false

  if (isPlanEqual(currentPlanDraft, incomingPlan)) {
    // 草稿匹配外部最新数据：接受 incoming 为新基准，清除 dirty 与冲突 (G3)
    nextPlanDraft = incomingPlan
    nextPlanBaseline = incomingPlan
    nextPlanConflict = false
  } else if (planDirty) {
    const conflict = detectPlanConflict({
      draft: currentPlanDraft,
      baseline: currentPlanBaseline,
      incoming: incomingPlan,
    })
    nextPlanConflict = conflict
    nextPlanDraft = currentPlanDraft
    nextPlanBaseline = currentPlanBaseline
  } else {
    // 未编辑（clean）：若外部发生变动则安全刷新
    if (!isPlanEqual(incomingPlan, currentPlanBaseline)) {
      nextPlanDraft = incomingPlan
      nextPlanBaseline = incomingPlan
      nextPlanConflict = false
    } else {
      nextPlanDraft = currentPlanDraft
      nextPlanBaseline = currentPlanBaseline
      nextPlanConflict = false
    }
  }

  return {
    projectId: nextProjectId,
    assessmentDraft: nextAssessmentDraft,
    assessmentBaseline: nextAssessmentBaseline,
    isAssessmentDirty: isAssessmentDirty(nextAssessmentDraft, nextAssessmentBaseline),
    assessmentConflict: nextAssessmentConflict,
    planDraft: nextPlanDraft,
    planBaseline: nextPlanBaseline,
    isPlanDirty: isPlanDirty(nextPlanDraft, nextPlanBaseline),
    planConflict: nextPlanConflict,
    incomingAssessment,
    incomingPlan,
  }
}
