import { useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { calculateOperatingProfit, compareRoutes } from '../../../utils/wbEngine'
import { effectiveWbRoutes, isEnteredNumber, localDateString } from '../../../utils/platformCosting'
import { fmtCny } from '../format'

// ===================== 线路对比 =====================
export function CompareTab({ tariffs, settings, projectContext = null }) {
  const [form, setForm] = useState(() => ({
    date: localDateString(),
    weight: projectContext?.prefill?.actualWeightG || (projectContext ? '' : 500),
    length: projectContext?.prefill?.lengthCm || (projectContext ? '' : 20),
    width: projectContext?.prefill?.widthCm || (projectContext ? '' : 15),
    height: projectContext?.prefill?.heightCm || (projectContext ? '' : 10),
    revenue: projectContext?.prefill?.sellerRevenueRub || (projectContext ? '' : 1000),
    commission: '', promotion: '', purchase: '', packaging: '', inbound: '',
  }))
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const parcel = { actualWeightG: Number(form.weight), lengthCm: Number(form.length), widthCm: Number(form.width), heightCm: Number(form.height) }
  const routes = effectiveWbRoutes(tariffs, form.date)
  const missingCosts = [
    ['revenue', '卖家收入', { positive: true }], ['commission', '佣金率', { max: 100 }],
    ['promotion', '促销费', {}], ['purchase', '采购成本', {}],
    ['packaging', '包装成本', {}], ['inbound', '国内送仓费', {}],
  ].filter(([key, , options]) => !isEnteredNumber(form[key], options)).map(([, label]) => label)
  const validParcel = ['weight', 'length', 'width', 'height'].every((key) => isEnteredNumber(form[key], { positive: true }))
  const profitReady = validParcel && missingCosts.length === 0 && isEnteredNumber(settings?.rubPerCny, { positive: true })
  const results = compareRoutes(parcel, routes).map((row) => ({
    ...row,
    profitCalc: profitReady && row.valid && row.feeCny !== null
      ? calculateOperatingProfit({
          sellerRevenueBaseRub: Number(form.revenue), commissionBaseRub: Number(form.revenue),
          commissionRate: Number(form.commission), promotionCostRub: Number(form.promotion),
          acquiringFeeRub: 0, platformOtherDeductionRub: 0, otherOperatingCostCny: 0, taxCostCny: 0,
        }, {
          purchaseCostCny: Number(form.purchase), packagingCostCny: Number(form.packaging),
          chinaInboundCostCny: Number(form.inbound), certificationAllocationCny: 0,
        }, settings, row.feeCny)
      : null,
  }))
  const validResults = results.filter((r) => r.valid && r.feeCny !== null)
  const cheapest = validResults.length > 0 ? validResults.reduce((min, r) => r.feeCny < min.feeCny ? r : min) : null
  const fastest = validResults.length > 0 ? validResults.reduce((min, r) => (r.tariff.etaMaxDays || 999) < (min.tariff.etaMaxDays || 999) ? r : min) : null
  const bestProfit = results.filter((r) => r.profitCalc?.operatingProfitCny !== null && r.profitCalc?.operatingProfitCny !== undefined)
    .reduce((best, row) => !best || row.profitCalc.operatingProfitCny > best.profitCalc.operatingProfitCny ? row : best, null)

  const inputField = (label, key, unit) => (
    <div>
      <label className="text-xs font-medium text-gray-500 mb-1 block">{label}</label>
      <div className="relative">
        <input type="number" value={form[key]} onChange={(e) => update(key, e.target.value)} step="any"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 pr-8 bg-white" />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">{unit}</span>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h4 className="text-sm font-semibold text-morandi-text mb-3">输入</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">测算日期</label>
            <input type="date" value={form.date} onChange={(e) => update('date', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5" />
          </div>
          {inputField('包裹重量', 'weight', 'g')}
          <div className="grid grid-cols-3 gap-2 sm:col-span-2">
            {inputField('长', 'length', 'cm')}
            {inputField('宽', 'width', 'cm')}
            {inputField('高', 'height', 'cm')}
          </div>
          <p className="col-span-full border-t border-gray-100 pt-3 text-xs font-semibold text-gray-600">同一订单假设 · 利润对比</p>
          <div className="col-span-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {inputField('卖家收入', 'revenue', '₽')}
            {inputField('佣金率', 'commission', '%')}
            {inputField('促销费', 'promotion', '₽')}
            {inputField('采购成本', 'purchase', '¥')}
            {inputField('包装成本', 'packaging', '¥')}
            {inputField('国内送仓', 'inbound', '¥')}
          </div>
          <p className="col-span-full text-[11px] text-gray-500">按单件已签收订单估算；汇率 1¥ = {settings?.rubPerCny}₽。零成本请明确填 0。</p>
          {!profitReady && <p className="col-span-full text-[11px] text-amber-700">补齐 {missingCosts.length ? missingCosts.join('、') : '有效尺寸、重量或汇率'} 后显示利润。</p>}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
          <h4 className="text-sm font-semibold text-morandi-text">对比结果</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-xs">
            <thead className="bg-gray-50">
              <tr>
                {['线路', '版本', '时效(天)', '运费(¥)', '与最低差价', '预计利润(¥)', '利润率', '尺寸合规', '提示'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold border-b border-gray-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                  <td className="px-3 py-2 border-b border-gray-100 text-gray-700">{r.tariff.routeName}</td>
                  <td className="px-3 py-2 border-b border-gray-100 text-gray-500">{r.tariff.effectiveFrom || '—'}</td>
                  <td className="px-3 py-2 border-b border-gray-100 text-gray-600">{r.tariff.etaMinDays}-{r.tariff.etaMaxDays}</td>
                  <td className="px-3 py-2 border-b border-gray-100 text-right font-semibold text-gray-700">{r.feeCny !== null ? fmtCny(r.feeCny) : '—'}</td>
                  <td className="px-3 py-2 border-b border-gray-100 text-right text-gray-600">{r.diffToMin !== null ? fmtCny(r.diffToMin) : '—'}</td>
                  <td className="px-3 py-2 border-b border-gray-100 text-right font-medium text-gray-800">{r.profitCalc?.operatingProfitCny !== null && r.profitCalc?.operatingProfitCny !== undefined ? fmtCny(r.profitCalc.operatingProfitCny) : '—'}</td>
                  <td className="px-3 py-2 border-b border-gray-100 text-right text-gray-600">{r.profitCalc?.profitMargin !== null && r.profitCalc?.profitMargin !== undefined ? `${r.profitCalc.profitMargin}%` : '—'}</td>
                  <td className="px-3 py-2 border-b border-gray-100">{r.valid ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-500" />}</td>
                  <td className="px-3 py-2 border-b border-gray-100 text-gray-500 text-[10px]">{r.messages?.join('; ') || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {routes.length === 0 && <p className="p-3 text-xs text-amber-700">该日期没有生效的线路版本。</p>}
        {cheapest && fastest && (
          <div className="p-3 space-y-1 border-t border-gray-100 bg-blue-50/50">
            <p className="text-xs text-blue-700">💡 最便宜: <span className="font-bold">{cheapest.tariff.routeName}</span> {fmtCny(cheapest.feeCny)} ({cheapest.tariff.etaMinDays}-{cheapest.tariff.etaMaxDays}天)</p>
            <p className="text-xs text-blue-700">⚡ 最快速: <span className="font-bold">{fastest.tariff.routeName}</span> {fmtCny(fastest.feeCny)} ({fastest.tariff.etaMinDays}-{fastest.tariff.etaMaxDays}天)</p>
            {bestProfit && <p className="text-xs text-emerald-700">预计利润最高: <span className="font-bold">{bestProfit.tariff.routeName}</span> {fmtCny(bestProfit.profitCalc.operatingProfitCny)}。仅为同一输入下的估算，不代表实际结算。</p>}
            {cheapest !== fastest && (() => {
              const diff = fastest.feeCny - cheapest.feeCny
              const daysSaved = (cheapest.tariff.etaMaxDays || 0) - (fastest.tariff.etaMaxDays || 0)
              if (daysSaved > 0 && diff > 0) {
                return <p className="text-xs text-blue-700">📈 选择 {fastest.tariff.routeName} 可省 {daysSaved} 天，每单增加 {fmtCny(diff)}（每缩短1天约 {fmtCny(diff / daysSaved)}）</p>
              }
              return null
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

