import { ClipboardList, Download, Upload, Trash2 } from 'lucide-react'
import {
  toNum, round2, roundUpWeight, selectTariffVersion, selectTariffTier,
  validateParcel, calculateParcelLogistics, calculateOrderLogistics,
  calculatePlatformSettlement, calculateOperatingProfit, compareRoutes, calculateReturnLoss,
  calculateReverseCompensation, calculateTotalLogisticsCost, calculateOperatingProfitV2,
  inferReverseEventType, getOrderLabels,
} from '../../../utils/wbEngine'
import {
  DEFAULT_SETTINGS, DEFAULT_TARIFFS, CSV_COLUMNS,
  REVERSE_EVENT_TYPE, REVERSE_EVENT_LABEL, DEFAULT_REVERSE_MULTIPLIER, NEEDS_BILL_CONFIRMATION,
} from '../../../utils/wbConfig'

// ===================== 订单与对账 =====================
export function OrdersTab({ orders, tariffs, settings, onSaveOrders }) {
  const downloadTemplate = () => {
    const csv = CSV_COLUMNS.join(',') + '\n'
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'wb_orders_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }
  const exportOrders = () => {
    const header = CSV_COLUMNS.join(',')
    const rows = orders.map((o) => CSV_COLUMNS.map((c) => {
      const key = c.replace(/_([a-z])/g, (_, l) => l.toUpperCase())
      return o[key] !== undefined && o[key] !== null ? o[key] : ''
    }).join(','))
    const csv = header + '\n' + rows.join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'wb_orders.csv'; a.click()
    URL.revokeObjectURL(url)
  }
  const importCsv = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result.replace(/^\ufeff/, '')
      const lines = text.split('\n').filter((l) => l.trim())
      if (lines.length < 2) { alert('CSV为空'); return }
      const header = lines[0].split(',').map((h) => h.trim())
      const imported = []
      const errors = []
      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(',')
        const row = {}
        header.forEach((h, idx) => { row[h] = cells[idx]?.trim() || '' })
        // 转换为camelCase
        const order = {}
        Object.entries(row).forEach(([k, v]) => {
          const camelKey = k.replace(/_([a-z])/g, (_, l) => l.toUpperCase())
          if (v === '') order[camelKey] = null
          else if (!isNaN(Number(v)) && v !== '') order[camelKey] = Number(v)
          else order[camelKey] = v
        })
        if (!order.orderId) { errors.push(`行${i + 1}: orderId为空`); continue }
        imported.push({ ...order, createdAt: new Date().toISOString() })
      }
      if (errors.length > 0) alert(`导入完成，${errors.length} 行有错误:\n${errors.slice(0, 5).join('\n')}`)
      onSaveOrders([...orders, ...imported])
      alert(`成功导入 ${imported.length} 条订单`)
    }
    reader.readAsText(file)
  }

  // 对账
  const hasActual = orders.filter((o) => o.actualLogisticsCny !== null && o.actualLogisticsCny !== undefined)
  const reconRows = hasActual.map((o) => {
    const est = toNum(o.estimatedLogisticsCny)
    const act = toNum(o.actualLogisticsCny)
    const diff = act - est
    return { orderId: o.orderId, est, act, diff, diffRate: est > 0 ? (diff / est) * 100 : null, status: o.status }
  })

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-2 flex-wrap">
        <button onClick={downloadTemplate} className="text-xs px-3 py-1.5 rounded bg-white border border-gray-200 hover:bg-gray-50 flex items-center gap-1">
          <Download className="w-3 h-3" />下载CSV模板
        </button>
        <label className="text-xs px-3 py-1.5 rounded bg-white border border-gray-200 hover:bg-gray-50 flex items-center gap-1 cursor-pointer">
          <Upload className="w-3 h-3" />导入订单CSV
          <input type="file" accept=".csv" onChange={importCsv} className="hidden" />
        </label>
        {orders.length > 0 && (
          <button onClick={exportOrders} className="text-xs px-3 py-1.5 rounded bg-white border border-gray-200 hover:bg-gray-50 flex items-center gap-1">
            <Download className="w-3 h-3" />导出全部订单
          </button>
        )}
        <span className="text-xs text-gray-400 ml-auto">共 {orders.length} 单</span>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">暂无订单</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
              <h4 className="text-sm font-semibold text-morandi-text">订单明细</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {['订单号', '日期', '状态', '标签', 'SKU', '线路', '收入(₽)', '预计物流(¥)', '实际物流(¥)', '物流总成本(¥)', '利润(¥)', '利润率', ''].map((h) => (
                      <th key={h} className="px-2 py-2 text-left text-gray-500 font-semibold border-b border-gray-200 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o, i) => {
                    const labels = getOrderLabels(o)
                    const labelColorMap = {
                      green: 'bg-green-100 text-green-700 border-green-300',
                      orange: 'bg-orange-100 text-orange-700 border-orange-300',
                      red: 'bg-red-100 text-red-700 border-red-300',
                      yellow: 'bg-yellow-100 text-yellow-700 border-yellow-300',
                      gray: 'bg-gray-100 text-gray-700 border-gray-300',
                    }
                    return (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                        <td className="px-2 py-1.5 border-b border-gray-100 text-gray-700">{o.orderId}</td>
                        <td className="px-2 py-1.5 border-b border-gray-100 text-gray-600">{o.orderDate}</td>
                        <td className="px-2 py-1.5 border-b border-gray-100 text-gray-600">{o.status}</td>
                        <td className="px-2 py-1.5 border-b border-gray-100">
                          <div className="flex gap-1 flex-wrap">
                            {labels.map((lbl, j) => (
                              <span key={j} className={`text-xs px-1.5 py-0.5 rounded border ${labelColorMap[lbl.color] || labelColorMap.gray}`}>
                                {lbl.text}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 border-b border-gray-100 text-gray-600">{o.skuId}</td>
                        <td className="px-2 py-1.5 border-b border-gray-100 text-gray-600">{o.routeId}</td>
                        <td className="px-2 py-1.5 border-b border-gray-100 text-right text-gray-600">{toNum(o.sellerRevenueBaseRub).toFixed(0)}</td>
                        <td className="px-2 py-1.5 border-b border-gray-100 text-right text-gray-600">{toNum(o.estimatedLogisticsCny || o.estimatedForwardLogisticsCny).toFixed(2)}</td>
                        <td className="px-2 py-1.5 border-b border-gray-100 text-right text-gray-600">{(o.actualLogisticsCny ?? o.actualForwardLogisticsCny) !== null && (o.actualLogisticsCny ?? o.actualForwardLogisticsCny) !== undefined ? toNum(o.actualLogisticsCny ?? o.actualForwardLogisticsCny).toFixed(2) : '—'}</td>
                        <td className="px-2 py-1.5 border-b border-gray-100 text-right text-orange-700 font-semibold">{toNum(o.totalLogisticsCostCny || o.estimatedLogisticsCny).toFixed(2)}</td>
                        <td className={`px-2 py-1.5 border-b border-gray-100 text-right font-semibold ${toNum(o.operatingProfitCny) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{toNum(o.operatingProfitCny).toFixed(2)}</td>
                        <td className="px-2 py-1.5 border-b border-gray-100 text-right text-gray-600">{o.profitMargin !== null && o.profitMargin !== undefined ? `${Number(o.profitMargin).toFixed(1)}%` : '—'}</td>
                        <td className="px-2 py-1.5 border-b border-gray-100">
                          <button onClick={() => onSaveOrders(orders.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {reconRows.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
                <h4 className="text-sm font-semibold text-morandi-text">物流费对账（预计 vs 实际）</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {['订单号', '预计(¥)', '实际(¥)', '差异(¥)', '差异率', '状态'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold border-b border-gray-200">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reconRows.map((r, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                        <td className="px-3 py-1.5 border-b border-gray-100 text-gray-700">{r.orderId}</td>
                        <td className="px-3 py-1.5 border-b border-gray-100 text-right text-gray-600">{r.est.toFixed(2)}</td>
                        <td className="px-3 py-1.5 border-b border-gray-100 text-right text-gray-600">{r.act.toFixed(2)}</td>
                        <td className={`px-3 py-1.5 border-b border-gray-100 text-right ${r.diff > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{r.diff.toFixed(2)}</td>
                        <td className="px-3 py-1.5 border-b border-gray-100 text-right text-gray-600">{r.diffRate !== null ? `${r.diffRate.toFixed(1)}%` : '—'}</td>
                        <td className="px-3 py-1.5 border-b border-gray-100 text-gray-600">{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
