/**
 * ui/PageHeader.jsx — 页面头（T5-3 primitive）：24-28px 标题 + 副标题 + 右侧操作
 */
export default function PageHeader({ title, subtitle, actions, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-[24px] font-semibold leading-tight tracking-[-0.01em] text-workspace-text">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-workspace-text-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
