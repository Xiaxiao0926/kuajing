/**
 * t6/stageModel.js — 阶段唯一事实源（T6-2A hardening）
 * Store / Gate / UI 统一引用；禁止各自维护一份阶段列表。
 * 顺序冻结：PIPELINE(0) … REVIEW(8)；SAMPLING 为物流 hard block 的界点。
 */
export const PROJECT_STAGES = [
  'PIPELINE',
  'RESEARCH',
  'COSTING',
  'SAMPLING',
  'COMPLIANCE',
  'PRODUCTION',
  'LAUNCH',
  'OPERATIONS',
  'REVIEW',
]

export const SAMPLING_STAGE = 'SAMPLING'
export const SAMPLING_INDEX = PROJECT_STAGES.indexOf(SAMPLING_STAGE) // 3

export function stageIndex(stage) {
  return PROJECT_STAGES.indexOf(stage)
}

export function isValidStage(stage) {
  return PROJECT_STAGES.includes(stage)
}

/** SAME | FORWARD | BACKWARD；非法阶段 throw（fail-close） */
export function transitionDirection(from, to) {
  const i = stageIndex(from)
  const j = stageIndex(to)
  if (i < 0 || j < 0) {
    throw new Error(`T6_STAGE: 非法阶段 "${from}" → "${to}"（fail-close）`)
  }
  if (i === j) return 'SAME'
  return i < j ? 'FORWARD' : 'BACKWARD'
}
