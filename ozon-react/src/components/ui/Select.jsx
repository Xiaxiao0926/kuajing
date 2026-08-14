/**
 * ui/Select.jsx — 统一下拉（T5-3 primitive）
 */
export default function Select({ label, value, onChange, options, className = '' }) {
  return (
    <label className={`flex items-center gap-1.5 text-xs text-workspace-text-secondary ${className}`}>
      {label && <span className="whitespace-nowrap">{label}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label || undefined}
        className="h-8 rounded-md border border-workspace-border-strong bg-workspace-surface px-2 text-[13px] text-workspace-text outline-none transition-colors focus:border-workspace-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-workspace-primary"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )
}
