/**
 * ui/SectionHeader.jsx — 区块标题（T5-3 primitive）：16-18px/600
 */
export default function SectionHeader({ title, extra, className = '' }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <h3 className="text-base font-semibold text-workspace-text">{title}</h3>
      {extra != null && <div className="text-xs text-workspace-text-secondary">{extra}</div>}
    </div>
  )
}
