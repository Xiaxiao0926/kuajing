/**
 * ui/Drawer.jsx — 右侧抽屉（T5-3 primitive）
 * 420-460px overlay；关闭：右上 X / 点击遮罩 / ESC。
 */
import { useEffect } from 'react'
import { X } from 'lucide-react'
import IconButton from './IconButton'

export default function Drawer({ open, onClose, title, children, width = 440 }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-[#101828]/30" onClick={onClose} aria-hidden="true" />
      <aside
        className="absolute right-0 top-0 flex h-full flex-col border-l border-workspace-border bg-workspace-surface shadow-[0_8px_40px_rgba(16,24,40,0.12)]"
        style={{ width }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-workspace-border px-5">
          <span className="text-sm font-semibold text-workspace-text">{title}</span>
          <IconButton onClick={onClose} title="关闭 (ESC)"><X className="h-4 w-4" /></IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  )
}
