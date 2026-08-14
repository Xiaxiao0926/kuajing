/**
 * ui/SearchInput.jsx — 搜索输入（T5-3 primitive）：第一筛选入口，280-360px
 */
import { Search, X } from 'lucide-react'

export default function SearchInput({ value, onChange, placeholder = '搜索商品 / SKU / 类目', className = '' }) {
  return (
    <div className={`relative w-[280px] max-w-full lg:w-[320px] ${className}`}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-workspace-text-tertiary" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 w-full rounded-md border border-workspace-border-strong bg-workspace-surface pl-8 pr-7 text-[13px] text-workspace-text outline-none transition-colors placeholder:text-workspace-text-tertiary focus:border-workspace-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-workspace-primary"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-workspace-text-tertiary hover:text-workspace-text"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
