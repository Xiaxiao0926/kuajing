/**
 * ui/Badge.jsx — 统一徽标（T5-3 primitive；radius 5-6px，语义色只在状态上使用）
 */
export default function Badge({ tone = 'neutral', className = '', children, ...rest }) {
  const tones = {
    neutral: 'bg-workspace-surface-subtle text-workspace-text-secondary border border-workspace-border',
    primary: 'bg-workspace-primary-soft text-workspace-primary border border-transparent',
    success: 'bg-workspace-success-soft text-workspace-success border border-transparent',
    warning: 'bg-workspace-warning-soft text-workspace-warning border border-transparent',
    danger: 'bg-workspace-danger-soft text-workspace-danger border border-transparent',
    info: 'bg-workspace-primary-soft text-workspace-info border border-transparent',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-xs font-medium leading-none ${tones[tone]} ${className}`} {...rest}>
      {children}
    </span>
  )
}
