export function InputField({ label, value, onChange, suffix, step, min, max }) {
  return (
    <div>
      <label className="text-xs font-medium text-morandi-text-light mb-1 block">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          step={step}
          min={min}
          max={max}
          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-morandi-primary"
        />
        {suffix && <span className="text-xs text-morandi-text-light flex-shrink-0">{suffix}</span>}
      </div>
    </div>
  )
}
