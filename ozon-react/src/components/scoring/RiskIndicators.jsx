/**
 * scoring/RiskIndicators.jsx — 风险列（T5-4）：最多 2 个核心阻塞风险，超出 +N，无风险 —
 * 只消费引擎已输出的 status 数组（标签映射，不新增判断规则）。
 */
const RISK_META = [
  { key: 'BLOCKED_LOGISTICS', label: '物流', tone: 'danger' },
  { key: 'MARGIN_RISK', label: '毛利', tone: 'warning' },
  { key: 'REVIEW_REQUIRED', label: '合规', tone: 'warning' },
  { key: 'NEEDS_DATA', label: '数据', tone: 'neutral' },
]

export default function RiskIndicators({ status }) {
  const hits = RISK_META.filter((r) => status?.includes(r.key))
  if (hits.length === 0) return <span className="text-xs text-workspace-text-tertiary">—</span>
  const shown = hits.slice(0, 2)
  const rest = hits.length - shown.length
  return (
    <span className="inline-flex items-center gap-1">
      {shown.map((r) => (
        <span
          key={r.key}
          title={r.key}
          className={`rounded-[5px] px-1.5 py-0.5 text-xs font-medium leading-none ${
            r.tone === 'danger' ? 'bg-workspace-danger-soft text-workspace-danger'
            : r.tone === 'warning' ? 'bg-workspace-warning-soft text-workspace-warning'
            : 'bg-workspace-surface-subtle text-workspace-text-secondary'
          }`}
        >
          {r.label}
        </span>
      ))}
      {rest > 0 && <span className="text-xs text-workspace-text-tertiary">+{rest}</span>}
    </span>
  )
}
