/**
 * ui/EmptyState.jsx — 空状态（T5-3 primitive）
 */
import { Inbox } from 'lucide-react'

export default function EmptyState({ title = '暂无数据', description }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <Inbox className="h-8 w-8 text-workspace-text-tertiary" />
      <p className="mt-3 text-sm font-medium text-workspace-text">{title}</p>
      {description && <p className="mt-1 text-xs text-workspace-text-secondary">{description}</p>}
    </div>
  )
}
