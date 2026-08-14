import { useState } from 'react'
import { Download, Plus, Trash2 } from 'lucide-react'
import {
  toNum, round2, roundUpWeight, selectTariffVersion, selectTariffTier,
  validateParcel, calculateParcelLogistics, calculateOrderLogistics,
  calculatePlatformSettlement, calculateOperatingProfit, compareRoutes, calculateReturnLoss,
  calculateReverseCompensation, calculateTotalLogisticsCost, calculateOperatingProfitV2,
  inferReverseEventType, getOrderLabels,
} from '../../../utils/wbEngine'
import { CategoryProductPicker } from '../CategoryProductPicker'

// ===================== SKU利润表 =====================
export function SkuTab({ skus, tariffs, settings, onSaveSkus }) {
  const [showForm, setShowForm] = useState(false)
  const [editingIdx, setEditingIdx] = useState(-1) // -1=新增，>=0=编辑对应索引
  const [newSku, setNewSku] = useState({
    skuId: '', productNameCn: '', category: '', actualUnitWeightG: 0, purchaseCostCny: 0,
    packagingCostCny: 0, chinaInboundCostCny: 0, targetSalePriceRub: 0, commissionRate: 25,
    adCostRate: 0,
    commissionAutoMatched: false,
    productLengthCm: 0, productWidthCm: 0, productHeightCm: 0, defaultRouteId: tariffs[0]?.routeId || '',
  })

  // 打开新增
  const openAdd = () => {
    setEditingIdx(-1)
    setNewSku({ skuId: '', productNameCn: '', category: '', actualUnitWeightG: 0, purchaseCostCny: 0, packagingCostCny: 0, chinaInboundCostCny: 0, targetSalePriceRub: 0, commissionRate: 25, adCostRate: 0, commissionAutoMatched: false, productLengthCm: 0, productWidthCm: 0, productHeightCm: 0, defaultRouteId: tariffs[0]?.routeId || '' })
    setShowForm(true)
  }
  // 打开编辑
  const openEdit = (idx) => {
    const s = skus[idx] || {}
    setEditingIdx(idx)
    setNewSku({
      skuId: s.skuId || '', productNameCn: s.productNameCn || '', category: s.category || '',
      actualUnitWeightG: s.actualUnitWeightG ?? 0, purchaseCostCny: s.purchaseCostCny ?? 0,
      packagingCostCny: s.packagingCostCny ?? 0, chinaInboundCostCny: s.chinaInboundCostCny ?? 0,
      targetSalePriceRub: s.targetSalePriceRub ?? 0, commissionRate: s.commissionRate ?? 25,
      adCostRate: s.adCostRate ?? 0, commissionAutoMatched: !!s.commissionAutoMatched,
      productLengthCm: s.productLengthCm ?? 0, productWidthCm: s.productWidthCm ?? 0, productHeightCm: s.productHeightCm ?? 0,
      defaultRouteId: s.defaultRouteId || tariffs[0]?.routeId || '',
    })
    setShowForm(true)
  }

  const rows = skus.map((sku) => {
    const weight = toNum(sku.actualUnitWeightG)
    const tariff = tariffs.find((t) => t.routeId === (sku.defaultRouteId || settings.defaultRouteId)) || tariffs[0]
    const calc = tariff && weight > 0 ? calculateParcelLogistics(weight, tariff) : null
    const logisticsCny = calc?.feeCny || 0
    const priceRub = toNum(sku.targetSalePriceRub)
    const priceCny = toNum(settings.rubPerCny) > 0 ? priceRub / toNum(settings.rubPerCny) : 0
    const commissionCny = (priceCny * toNum(sku.commissionRate)) / 100
    const adCostCny = (priceCny * toNum(sku.adCostRate)) / 100
    const profit = priceCny - logisticsCny - commissionCny - adCostCny - toNum(sku.purchaseCostCny) - toNum(sku.packagingCostCny) - toNum(sku.chinaInboundCostCny)
    const profitMargin = priceCny > 0 ? (profit / priceCny) * 100 : null
    const logisticsRatio = priceCny > 0 ? (logisticsCny / priceCny) * 100 : null
    return { sku, calc, logisticsCny, priceCny, commissionCny, adCostCny, profit, profitMargin, logisticsRatio }
  })

  const exportCsv = () => {
    const header = 'SKU,商品,类目,重量(g),计费重量(kg),线路,售价(₽),售价(¥),运费(¥),佣金(¥),广告费(¥),采购(¥),利润(¥),利润率(%),物流费率(%)\n'
    const rows = rows.map((r) =>
      [r.sku.skuId, r.sku.productNameCn, r.sku.category, r.sku.actualUnitWeightG, r.calc?.billableWeightKg || '',
       r.sku.defaultRouteId, r.sku.targetSalePriceRub, r.priceCny.toFixed(2), r.logisticsCny.toFixed(2),
       r.commissionCny.toFixed(2), r.adCostCny.toFixed(2), r.sku.purchaseCostCny, r.profit.toFixed(2),
       r.profitMargin !== null ? r.profitMargin.toFixed(1) : '', r.logisticsRatio !== null ? r.logisticsRatio.toFixed(1) : ''].join(',')
    ).join('\n')
    const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'wb_sku_profit.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-morandi-text">SKU利润表 ({skus.length})</h4>
          <div className="flex gap-2">
            <button onClick={exportCsv} className="text-xs px-2 py-1 rounded bg-white border border-gray-200 hover:bg-gray-50 flex items-center gap-1">
              <Download className="w-3 h-3" />导出
            </button>
            <button onClick={openAdd} className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-700 hover:bg-orange-200 flex items-center gap-1">
              <Plus className="w-3 h-3" />新增
            </button>
          </div>
        </div>
        {skus.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">暂无SKU，点击「新增」添加</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  {['SKU', '商品', '重量(g)', '计费(kg)', '线路', '售价(₽)', '售价(¥)', '运费(¥)', '佣金(¥)', '广告费(¥)', '采购(¥)', '利润(¥)', '利润率', '物流费率', ''].map((h) => (
                    <th key={h} className="px-2 py-2 text-left text-gray-500 font-semibold border-b border-gray-200 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                    <td className="px-2 py-1.5 border-b border-gray-100 text-gray-700">{r.sku.skuId}</td>
                    <td className="px-2 py-1.5 border-b border-gray-100 text-gray-600">{r.sku.productNameCn}</td>
                    <td className="px-2 py-1.5 border-b border-gray-100 text-right text-gray-600">{r.sku.actualUnitWeightG}</td>
                    <td className="px-2 py-1.5 border-b border-gray-100 text-right text-gray-600">{r.calc?.billableWeightKg || '—'}</td>
                    <td className="px-2 py-1.5 border-b border-gray-100 text-gray-600">{r.sku.defaultRouteId}</td>
                    <td className="px-2 py-1.5 border-b border-gray-100 text-right text-gray-600">{toNum(r.sku.targetSalePriceRub).toFixed(0)}</td>
                    <td className="px-2 py-1.5 border-b border-gray-100 text-right text-gray-600">{r.priceCny.toFixed(2)}</td>
                    <td className="px-2 py-1.5 border-b border-gray-100 text-right text-gray-600">{r.logisticsCny.toFixed(2)}</td>
                    <td className="px-2 py-1.5 border-b border-gray-100 text-right text-gray-600">{r.commissionCny.toFixed(2)}</td>
                    <td className="px-2 py-1.5 border-b border-gray-100 text-right text-gray-600">{r.adCostCny.toFixed(2)}</td>
                    <td className="px-2 py-1.5 border-b border-gray-100 text-right text-gray-600">{toNum(r.sku.purchaseCostCny).toFixed(2)}</td>
                    <td className={`px-2 py-1.5 border-b border-gray-100 text-right font-semibold ${r.profit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{r.profit.toFixed(2)}</td>
                    <td className={`px-2 py-1.5 border-b border-gray-100 text-right ${r.profitMargin !== null && r.profitMargin < settings.profitMarginThreshold ? 'text-orange-600' : 'text-gray-600'}`}>{r.profitMargin !== null ? `${r.profitMargin.toFixed(1)}%` : '—'}</td>
                    <td className="px-2 py-1.5 border-b border-gray-100 text-right text-gray-600">{r.logisticsRatio !== null ? `${r.logisticsRatio.toFixed(1)}%` : '—'}</td>
                    <td className="px-2 py-1.5 border-b border-gray-100">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => openEdit(i)} className="text-gray-400 hover:text-blue-600" title="编辑">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button onClick={() => onSaveSkus(skus.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600" title="删除">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h4 className="text-sm font-semibold text-morandi-text mb-3">{editingIdx >= 0 ? '编辑SKU' : '新增SKU'}</h4>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">SKU ID *</label>
              <input type="text" value={newSku.skuId} onChange={(e) => setNewSku({ ...newSku, skuId: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                佣金率(%)
                {newSku.commissionAutoMatched && <span className="ml-2 text-orange-600">✓ 自动匹配</span>}
              </label>
              <input
                type="number"
                value={newSku.commissionRate}
                onChange={(e) => setNewSku({ ...newSku, commissionRate: e.target.value, commissionAutoMatched: false })}
                step="any"
                className={`w-full text-sm border rounded-lg px-2 py-1.5 ${newSku.commissionAutoMatched ? 'border-orange-300 bg-orange-50/50' : 'border-gray-200'}`}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">广告费率(%)</label>
              <input
                type="number"
                value={newSku.adCostRate}
                onChange={(e) => setNewSku({ ...newSku, adCostRate: e.target.value })}
                step="any"
                placeholder="如10"
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">默认线路</label>
              <select value={newSku.defaultRouteId} onChange={(e) => setNewSku({ ...newSku, defaultRouteId: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                {tariffs.map((t) => <option key={t.routeId} value={t.routeId}>{t.routeName}</option>)}
              </select>
            </div>
          </div>

          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-1">商品类目与名称（自动匹配佣金）</p>
            <CategoryProductPicker
              value={{ category: newSku.category || '', product: newSku.productNameCn || '', commission: newSku.commissionAutoMatched ? toNum(newSku.commissionRate) : null }}
              onChange={(v) => setNewSku((s) => ({
                ...s,
                category: v.category,
                productNameCn: v.product,
                commissionRate: v.commission !== null ? v.commission : s.commissionRate,
                commissionAutoMatched: v.commission !== null,
              }))}
              compact
            />
          </div>

          <div className="grid grid-cols-3 gap-3 mb-3">
            {[
              ['含包装重量(g)', 'actualUnitWeightG'], ['采购成本(¥)', 'purchaseCostCny'], ['包装成本(¥)', 'packagingCostCny'],
              ['国内送仓费(¥)', 'chinaInboundCostCny'], ['目标售价(₽)', 'targetSalePriceRub'],
              ['长(cm)', 'productLengthCm'], ['宽(cm)', 'productWidthCm'], ['高(cm)', 'productHeightCm'],
            ].map(([label, key]) => (
              <div key={key}>
                <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                <input type="text" value={newSku[key]} onChange={(e) => setNewSku({ ...newSku, [key]: e.target.value })}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5" />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => {
                if (!newSku.skuId || !newSku.productNameCn) { alert('请填写SKU ID和商品名称'); return }
                const payload = {
                  ...newSku,
                  actualUnitWeightG: toNum(newSku.actualUnitWeightG),
                  purchaseCostCny: toNum(newSku.purchaseCostCny),
                  packagingCostCny: toNum(newSku.packagingCostCny),
                  chinaInboundCostCny: toNum(newSku.chinaInboundCostCny),
                  targetSalePriceRub: toNum(newSku.targetSalePriceRub),
                  commissionRate: toNum(newSku.commissionRate),
                  adCostRate: toNum(newSku.adCostRate),
                  productLengthCm: toNum(newSku.productLengthCm),
                  productWidthCm: toNum(newSku.productWidthCm),
                  productHeightCm: toNum(newSku.productHeightCm),
                  commissionAutoMatched: !!newSku.commissionAutoMatched,
                  active: true,
                  updatedAt: new Date().toISOString(),
                }
                if (editingIdx >= 0) {
                  // 编辑：保留原 createdAt
                  payload.createdAt = skus[editingIdx]?.createdAt || new Date().toISOString()
                  const newSkus = [...skus]
                  newSkus[editingIdx] = payload
                  onSaveSkus(newSkus)
                  alert(`SKU ${payload.skuId} 已更新`)
                } else {
                  // 新增
                  payload.createdAt = new Date().toISOString()
                  onSaveSkus([...skus, payload])
                  alert(`SKU ${payload.skuId} 已保存`)
                }
                setShowForm(false)
              }}
              className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-4 py-1.5 rounded-lg"
            >{editingIdx >= 0 ? '保存修改' : '保存'}</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs px-4 py-1.5 rounded-lg">取消</button>
          </div>
        </div>
      )}
    </div>
  )
}

