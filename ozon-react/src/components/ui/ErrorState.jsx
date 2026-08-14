/**
 * ui/ErrorState.jsx — 错误态（T5-3 primitive）：可见错误信息 + 重试，永不白屏
 */
import { AlertTriangle } from 'lucide-react'
import Button from './Button'

export default function ErrorState({ title = '加载失败', message, onRetry }) {
  return (
    <div className="rounded-lg border border-workspace-danger/30 bg-workspace-danger-soft px-6 py-10">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-workspace-danger" />
        <h3 className="text-sm font-semibold text-workspace-danger">{title}</h3>
      </div>
      {message && <p className="mt-2 break-all font-mono text-xs text-workspace-danger">{message}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>重试</Button>
      )}
    </div>
  )
}
