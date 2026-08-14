/**
 * scoring/ContextBadge.jsx — 市场置信度（T5-4）：克制圆点，不铺彩色
 */
const CONTEXT_META = {
  HIGH: { label: '高', dot: 'bg-workspace-success' },
  MEDIUM: { label: '中', dot: 'bg-workspace-info' },
  LOW: { label: '低', dot: 'bg-workspace-text-tertiary' },
  LOW_MARKET_CONTEXT: { label: '缺市场数据', dot: 'bg-transparent ring-1 ring-workspace-text-tertiary' },
}

export default function ContextBadge({ context }) {
  const meta = CONTEXT_META[context] || { label: context || '—', dot: 'bg-workspace-text-tertiary' }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-workspace-text-secondary" title={context}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  )
}
