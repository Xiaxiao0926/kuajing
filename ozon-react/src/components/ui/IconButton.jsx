/**
 * ui/IconButton.jsx — 图标按钮（T5-3 primitive）
 */
export default function IconButton({ className = '', title, children, ...rest }) {
  return (
    <button
      type="button"
      title={title}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-workspace-text-secondary transition-colors hover:bg-workspace-surface-subtle hover:text-workspace-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-workspace-primary ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
