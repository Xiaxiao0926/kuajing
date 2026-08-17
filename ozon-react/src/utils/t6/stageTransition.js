/**
 * t6/stageTransition.js — 阶段流转 domain action（T6-2A hardening）
 * React 页面不再自行拼装 evaluate+log+set 流程；统一走本函数。
 * - SAME：throw（拒绝/no-op）
 * - BACKWARD：不执行前向 Gate，允许回退；reason 为空默认 "阶段回退"
 * - FORWARD + GREEN / NOT_EVALUATED：允许，reason 可为空
 * - FORWARD + YELLOW / RED：必须填写 reason；为空 throw（stage 不变、不产生 gate_override）
 * 有 reason 的 YELLOW/RED：写 gate_override + stage_change 两条日志
 */
import { getProject, setProjectStage, appendLog } from './t6Store.js'
import { evaluateProjectGate, GATE_VERDICTS } from './gateEngine.js'
import { transitionDirection } from './stageModel.js'

export function transitionProjectStage({ projectId, targetStage, deps = {}, reason = '', by = 'user' }) {
  const project = getProject(projectId)
  if (!project) throw new Error('T6_STORE: 项目不存在')

  const direction = transitionDirection(project.stage, targetStage)
  if (direction === 'SAME') throw new Error('T6_STAGE: 目标阶段与当前阶段相同')

  let gate = null
  if (direction === 'FORWARD') {
    gate = evaluateProjectGate(project, targetStage, deps)
    if (gate.verdict === GATE_VERDICTS.YELLOW || gate.verdict === GATE_VERDICTS.RED) {
      if (!reason.trim()) {
        throw new Error(`T6_GATE: ${gate.verdict} 推进必须填写理由（stage 未改变，未产生 override 日志）`)
      }
      appendLog({ subjectType: 'project', subjectId: projectId, projectId, kind: 'gate_override', from: project.stage, to: targetStage, reason, by })
    }
  }

  const logReason = reason.trim() || (direction === 'BACKWARD' ? '阶段回退' : `Gate ${gate?.verdict || '—'} 推进`)
  setProjectStage(projectId, targetStage, logReason)
  return { project: getProject(projectId), direction, gate }
}
