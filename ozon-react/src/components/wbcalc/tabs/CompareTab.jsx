import { useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import {
  toNum, round2, roundUpWeight, selectTariffVersion, selectTariffTier,
  validateParcel, calculateParcelLogistics, calculateOrderLogistics,
  calculatePlatformSettlement, calculateOperatingProfit, compareRoutes, calculateReturnLoss,
  calculateReverseCompensation, calculateTotalLogisticsCost, calculateOperatingProfitV2,
  inferReverseEventType, getOrderLabels,
} from '../../../utils/wbEngine'
import { fmtCny } from '../format'

// ===================== 线路对比 =====================
export function CompareTab({ tariffs }) {
  const [form, setForm] = useState({ weight: 500, length: 20, width: 15, height: 10 })
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const parcel = { actualWeightG: toNum(form.weight), lengthCm: toNum(form.length), widthCm: toNum(form.width), heightCm: toNum(form.height) }
  const results = compareRoutes(parcel, tariffs)
  const validResults = results.filter((r) => r.valid && r.feeCny !== null)
  const cheapest = validResults.length > 0 ? validResults.reduce((min, r) => r.feeCny < min.feeCny ? r : min) : null
  const fastest = validResults.length > 0 ? validResults.reduce((min, r) => (r.tariff.etaMaxDays || 999) < (min.tariff.etaMaxDays || 999) ? r : min) : null

  const inputField = (label, key, unit) => (
    <div>
      <label className="text-xs font-medium text-gray-500 mb-1 block">{label}</label>
      <div className="relative">
        <input type="number" value={form[key]} onChange={(e) => update(key, e.target.value)} step="any"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 pr-8 bg-white" />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{unit}</span>
      </div>
    </div>
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h4 className="text-sm font-semibold text-morandi-text mb-3">输入</h4>
        <div className="space-y-3">
          {inputField('包裹重量', 'weight', 'g')}
          <div className="grid grid-cols-3 gap-2">
            {inputField('长', 'length', 'cm')}
            {inputField('宽', 'width', 'cm')}
            {inputField('高', 'height', 'cm')}
          </div>
        </div>
      </div>
      <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
          <h4 className="text-sm font-semibold text-morandi-text">对比结果</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                {['线路', '时效(天)', '运费(¥)', '与最低差价', '尺寸合规', '提示'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold border-b border-gray-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                  <td className="px-3 py-2 border-b border-gray-100 text-gray-700">{r.tariff.routeName}</td>
                  <td className="px-3 py-2 border-b border-gray-100 text-gray-600">{r.tariff.etaMinDays}-{r.tariff.etaMaxDays}</td>
                  <td className="px-3 py-2 border-b border-gray-100 text-right font-semibold text-gray-700">{r.feeCny !== null ? fmtCny(r.feeCny) : '—'}</td>
                  <td className="px-3 py-2 border-b border-gray-100 text-right text-gray-600">{r.diffToMin !== null ? fmtCny(r.diffToMin) : '—'}</td>
                  <td className="px-3 py-2 border-b border-gray-100">{r.valid ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-500" />}</td>
                  <td className="px-3 py-2 border-b border-gray-100 text-gray-500 text-xs">{r.messages?.join('; ') || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {cheapest && fastest && (
          <div className="p-3 space-y-1 border-t border-gray-100 bg-blue-50/50">
            <p className="text-xs text-blue-700">💡 最便宜: <span className="font-bold">{cheapest.tariff.routeName}</span> {fmtCny(cheapest.feeCny)} ({cheapest.tariff.etaMinDays}-{cheapest.tariff.etaMaxDays}天)</p>
            <p className="text-xs text-blue-700">⚡ 最快速: <span className="font-bold">{fastest.tariff.routeName}</span> {fmtCny(fastest.feeCny)} ({fastest.tariff.etaMinDays}-{fastest.tariff.etaMaxDays}天)</p>
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

