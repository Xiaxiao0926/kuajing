/**
 * scoring/DecisionBadge.jsx — Decision 状态徽标（T5-4）
 * 中文主显示；英文 status/action 保留在 title tooltip。
 * 视觉优先级铁律：Decision 比 Score 更重要；85A+BLOCKED 必须显示"阻塞"而非绿色推荐。
 */
import Badge from '../ui/Badge'

const DECISION_META = {
  ELIGIBLE: { label: '可推进', tone: 'success' },
  RESEARCH: { label: '补市场数据', tone: 'info' },
  REVIEW: { label: '合规复核', tone: 'warning' },
  HOLD: { label: '暂缓', tone: 'hold' },
  BLOCKED: { label: '阻塞', tone: 'danger' },
}

const ACTION_ZH = {
  SAMPLE_VALIDATION: '样品验证',
  PILOT_TEST: '小批试销',
  WATCH: '观望',
  DEPRIORITIZE: '暂不优先',
  COLLECT_MARKET_DATA: '补充市场数据',
  COMPLIANCE_REVIEW: '合规复核',
  VERIFY_COST: '核实成本',
  NEEDS_DATA: '补充数据',
  DO_NOT_SAMPLE: '禁止样品',
}

export function decisionMeta(status) {
  return DECISION_META[status] || { label: status, tone: 'neutral' }
}

export function actionLabel(action) {
  return ACTION_ZH[action] || action || ''
}

export default function DecisionBadge({ status, action, withAction = false, className = '' }) {
  const meta = decisionMeta(status)
  const act = withAction ? actionLabel(action) : ''
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} title={`${status}${act ? ` / ${action}` : ''}`}>
      <Badge tone={meta.tone}>{meta.label}</Badge>
      {act && <span className="text-xs text-workspace-text-secondary">{act}</span>}
    </span>
  )
}
