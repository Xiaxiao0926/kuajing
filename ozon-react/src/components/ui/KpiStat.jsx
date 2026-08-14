/**
 * ui/KpiStat.jsx — KPI 统计块（T5-3 primitive）
 * LABEL / VALUE / 辅助说明；1px border、白底、radius 8px、高 72-84px；
 * 不用多彩背景，仅状态数字可用轻微语义色。
 */
export default function KpiStat({ label, value, sub, tone = 'default', className = '' }) {
  const valueTone = {
    default: 'text-workspace-text',
    success: 'text-workspace-success',
    warning: 'text-workspace-warning',
    danger: 'text-workspace-danger',
    primary: 'text-workspace-primary',
  }
  return (
    <div className={`rounded-lg border border-workspace-border bg-workspace-surface px-4 py-3 ${className}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-workspace-text-tertiary">{label}</div>
      <div className={`tabular-nums mt-1 text-[22px] font-semibold leading-tight ${valueTone[tone]}`}>{value}</div>
      {sub != null && <div className="tabular-nums mt-0.5 text-xs text-workspace-text-tertiary">{sub}</div>}
    </div>
  )
}
