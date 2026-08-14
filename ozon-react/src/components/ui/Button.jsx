/**
 * ui/Button.jsx — 统一按钮（T5-3 primitive）
 */
export default function Button({ variant = 'primary', size = 'md', className = '', disabled, children, ...rest }) {
  const variants = {
    primary: 'bg-workspace-primary text-white hover:bg-[#2a50d6] border border-transparent',
    secondary: 'bg-white text-workspace-text border border-workspace-border-strong hover:bg-workspace-surface-subtle',
    ghost: 'bg-transparent text-workspace-text-secondary border border-transparent hover:bg-workspace-surface-subtle',
    danger: 'bg-workspace-danger text-white hover:bg-[#b42318] border border-transparent',
  }
  const sizes = {
    sm: 'h-7 px-2.5 text-xs',
    md: 'h-8 px-3 text-[13px]',
  }
  return (
    <button
      type="button"
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-workspace-primary disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
