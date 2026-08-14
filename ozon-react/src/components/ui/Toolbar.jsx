/**
 * ui/Toolbar.jsx — 工具条容器（T5-3 primitive）：1px 上/下边框，扁平排列筛选与操作
 */
export default function Toolbar({ left, right, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 border-b border-workspace-border px-4 py-2.5 ${className}`}>
      <div className="flex flex-1 flex-wrap items-center gap-2">{left}</div>
      {right && <div className="flex flex-shrink-0 items-center gap-2">{right}</div>}
    </div>
  )
}
