/**
 * ui/DataTable.jsx — 统一数据表容器（T5-3 primitive）
 * sticky header、内部滚动、行高由调用方控制；表格数字列右对齐建议配合 tabular-nums。
 */
export default function DataTable({ head, children, maxHeight = 'calc(100vh - 420px)', minHeight = 480, className = '' }) {
  return (
    <div className="overflow-auto" style={{ maxHeight, minHeight }}>
      <table className={`w-full min-w-[1080px] border-collapse text-[13px] ${className}`}>
        <thead className="sticky top-0 z-10 bg-workspace-surface-subtle">
          <tr className="border-b border-workspace-border text-left text-xs font-medium text-workspace-text-secondary">
            {head}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
