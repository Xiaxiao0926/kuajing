import { CHANNEL_PRESETS } from './data'
import { InputField } from './InputField'

export function PlanPanel({ title, plan, onChange, color }) {
  return (
    <div className={`rounded-xl border ${color.border} overflow-hidden`}>
      <div className={`px-4 py-3 ${color.bg} border-b ${color.border}`}>
        <h4 className={`text-xs font-bold ${color.text}`}>{title}</h4>
      </div>
      <div className="p-4 space-y-2.5">
        <InputField label="出厂价" value={plan.factoryPrice} onChange={v => onChange({ ...plan, factoryPrice: v })} suffix="元/瓶" />
        <InputField label="建议零售价" value={plan.retailPrice} onChange={v => onChange({ ...plan, retailPrice: v })} suffix="元" />
        <InputField label="包材成本" value={plan.packageCost} onChange={v => onChange({ ...plan, packageCost: v })} suffix="元" />
        <InputField label="物流费用" value={plan.shipping} onChange={v => onChange({ ...plan, shipping: v })} suffix="元/单" />
        <InputField label="广告费占比" value={(plan.adRate * 100).toFixed(0)} onChange={v => onChange({ ...plan, adRate: v / 100 })} suffix="%" step={1} min={0} max={50} />
        <InputField label="售后损耗率" value={(plan.returnRate * 100).toFixed(0)} onChange={v => onChange({ ...plan, returnRate: v / 100 })} suffix="%" step={1} min={0} max={30} />
        <div>
          <label className="text-xs font-medium text-morandi-text-light mb-1 block">销售渠道</label>
          <select value={plan.channel} onChange={e => onChange({ ...plan, channel: e.target.value })} className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-morandi-primary">
            {Object.entries(CHANNEL_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.name}(费率{(v.rate * 100).toFixed(1)}%)</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}
