import { ClipboardList, AlertTriangle } from 'lucide-react'
import {
  toNum, round2, roundUpWeight, selectTariffVersion, selectTariffTier,
  validateParcel, calculateParcelLogistics, calculateOrderLogistics,
  calculatePlatformSettlement, calculateOperatingProfit, compareRoutes, calculateReturnLoss,
  calculateReverseCompensation, calculateTotalLogisticsCost, calculateOperatingProfitV2,
  inferReverseEventType, getOrderLabels,
} from '../../../utils/wbEngine'
import { fmtCny, fmtRub, fmtPct } from '../format'
import { MetricCard } from '../MetricCard'

// ===================== 总览 =====================
export function OverviewTab({ orders, settings }) {
  if (!orders || orders.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
        <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">暂无订单数据</p>
        <p className="text-xs text-gray-400 mt-1">请前往「单订单核算器」保存订单，或在「订单与对账」导入CSV</p>
      </div>
    )
  }
  const rubPerCny = toNum(settings.rubPerCny)
  const totalOrders = orders.length
  const totalRevenueRub = orders.reduce((s, o) => s + toNum(o.sellerRevenueBaseRub), 0)
  const totalRevenueCny = rubPerCny > 0 ? totalRevenueRub / rubPerCny : 0
  const totalLogistics = orders.reduce((s, o) => s + (toNum(o.actualLogisticsCny) || toNum(o.estimatedLogisticsCny)), 0)
  const avgLogistics = totalLogistics / totalOrders
  const logisticsRatio = totalRevenueCny > 0 ? (totalLogistics / totalRevenueCny) * 100 : 0
  const totalProfit = orders.reduce((s, o) => s + toNum(o.operatingProfitCny), 0)
  const negCount = orders.filter((o) => toNum(o.operatingProfitCny) < 0).length
  const abnormal = orders.filter((o) => ['买家拒收', '超期未领取', '签收后退货', '丢失/破损'].includes(o.status))

  const metrics = [
    { label: '订单数', value: totalOrders, color: 'text-blue-700', bg: 'bg-blue-50' },
    { label: '销售收入', value: fmtCny(totalRevenueCny), sub: fmtRub(totalRevenueRub), color: 'text-green-700', bg: 'bg-green-50' },
    { label: '总物流费', value: fmtCny(totalLogistics), color: 'text-purple-700', bg: 'bg-purple-50' },
    { label: '平均每单物流', value: fmtCny(avgLogistics), color: 'text-indigo-700', bg: 'bg-indigo-50' },
    { label: '物流费率', value: fmtPct(logisticsRatio), color: 'text-orange-700', bg: 'bg-orange-50' },
    { label: '经营利润', value: fmtCny(totalProfit), color: totalProfit >= 0 ? 'text-emerald-700' : 'text-red-700', bg: 'bg-emerald-50' },
  ]

  // 状态分布
  const statusMap = {}
  orders.forEach((o) => { statusMap[o.status || '未知'] = (statusMap[o.status || '未知'] || 0) + 1 })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className={`rounded-xl border border-gray-100 ${m.bg} p-3`}>
            <p className="text-xs text-gray-500 mb-0.5">{m.label}</p>
            <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
            {m.sub && <p className="text-xs text-gray-400">{m.sub}</p>}
          </div>
        ))}
      </div>

      {(negCount > 0 || abnormal.length > 0) && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <span className="text-xs text-red-700">
            {negCount > 0 && <span className="font-semibold">{negCount}</span>} 单负毛利
            {abnormal.length > 0 && <>，{abnormal.length} 单异常（拒收/未领取/退货/破损）</>}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h4 className="text-sm font-semibold text-morandi-text mb-3">订单状态分布</h4>
          <div className="space-y-2">
            {Object.entries(statusMap).map(([status, count]) => (
              <div key={status} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-32 truncate">{status}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-5 relative">
                  <div className="bg-blue-400 h-5 rounded-full" style={{ width: `${(count / totalOrders) * 100}%` }} />
                  <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-semibold text-gray-700">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h4 className="text-sm font-semibold text-morandi-text mb-3">线路订单分布</h4>
          <div className="space-y-2">
            {Object.entries(orders.reduce((acc, o) => { const r = o.routeId || '未知'; acc[r] = (acc[r] || 0) + 1; return acc }, {})).map(([route, count]) => (
              <div key={route} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-40 truncate">{route}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-5 relative">
                  <div className="bg-orange-400 h-5 rounded-full" style={{ width: `${(count / totalOrders) * 100}%` }} />
                  <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-semibold text-gray-700">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
          <h4 className="text-sm font-semibold text-morandi-text">订单明细</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                {['订单号', '日期', '状态', 'SKU', '线路', '收入(₽)', '物流(¥)', '利润(¥)', '利润率'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold border-b border-gray-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => {
                const profit = toNum(o.operatingProfitCny)
                return (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                    <td className="px-3 py-2 border-b border-gray-100 text-gray-700">{o.orderId || '—'}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-gray-600">{o.orderDate || '—'}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-gray-600">{o.status || '—'}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-gray-600">{o.skuId || '—'}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-gray-600">{o.routeId || '—'}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-right text-gray-700">{toNum(o.sellerRevenueBaseRub).toFixed(0)}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-right text-gray-700">{(toNum(o.actualLogisticsCny) || toNum(o.estimatedLogisticsCny)).toFixed(2)}</td>
                    <td className={`px-3 py-2 border-b border-gray-100 text-right font-semibold ${profit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{profit.toFixed(2)}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-right text-gray-600">{o.profitMargin !== null && o.profitMargin !== undefined ? `${o.profitMargin.toFixed(1)}%` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

