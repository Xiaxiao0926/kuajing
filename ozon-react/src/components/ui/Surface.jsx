/**
 * ui/Surface.jsx — 页面主 Surface（T5-3 primitive）
 * 白底 1px 边框，radius 10px；一页最多 2-4 个大 Surface，禁止卡片套卡片。
 */
export default function Surface({ className = '', children, ...rest }) {
  return (
    <div className={`rounded-[10px] border border-workspace-border bg-workspace-surface ${className}`} {...rest}>
      {children}
    </div>
  )
}
