/**
 * ui/StatusBadge.jsx — 状态徽标（T5-3 primitive）：语义色 + 状态点
 */
import Badge from './Badge'

export default function StatusBadge({ tone = 'neutral', dot = true, className = '', children }) {
  return (
    <Badge tone={tone} className={className}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </Badge>
  )
}
