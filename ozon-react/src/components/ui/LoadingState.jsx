/**
 * ui/LoadingState.jsx — 加载态（T5-3 primitive）：不用巨大 spinner
 */
export default function LoadingState({ text = '正在载入…' }) {
  return (
    <div className="flex items-center gap-2.5 px-6 py-14 text-sm text-workspace-text-secondary">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-workspace-border border-t-workspace-primary" />
      {text}
    </div>
  )
}
