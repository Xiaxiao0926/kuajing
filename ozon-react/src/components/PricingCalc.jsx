import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { persistGet, persistSet } from '../utils/persist'
import { calcRow, rubPerCny } from '../utils/ozonEngine'

const PRICING_KEY = 'product-pricing-v2'

const PRODUCT_COLORS = {
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', bar: 'bg-purple-400', dot: 'bg-purple-500', light: 'bg-purple-100' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', bar: 'bg-indigo-400', dot: 'bg-indigo-500', light: 'bg-indigo-100' },
  teal: { bg: 'bg-teal-50', text: 'text-teal-700', bar: 'bg-teal-400', dot: 'bg-teal-500', light: 'bg-teal-100' },
}

const PRICING_PRODUCTS = [
  { id: 'hairmask', name: '发膜', color: 'purple' },
  { id: 'spray', name: '精油喷雾', color: 'indigo' },
  { id: 'gloves', name: '家用手套', color: 'teal' },
]

export default function PricingCalc() {
  const [pricingData, setPricingData] = useState(() => persistGet(PRICING_KEY) || {})

  const savePricing = (data) => {
    setPricingData(data)
    persistSet(PRICING_KEY, data)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-morandi-text">定价计算</h2>
        <p className="text-[10px] text-morandi-text-light mt-0.5">按产品规格对比成本、定价与利润（汇率 1¥ = {rubPerCny}₽）</p>
      </div>

      <div className="space-y-4">
        {PRICING_PRODUCTS.map(product => {
          const pc = PRODUCT_COLORS[product.color]
          const pd = pricingData[product.id] || {}
          const skus = pd.skus || [{}]
          const commission = pd.commission !== undefined && pd.commission !== '' ? Number(pd.commission) : 12
          const adRate = pd.adRate !== undefined && pd.adRate !== '' ? Number(pd.adRate) : 10
          const paymentFee = pd.paymentFee !== undefined && pd.paymentFee !== '' ? Number(pd.paymentFee) : 1
          const agencyFee = pd.agencyFee !== undefined && pd.agencyFee !== '' ? Number(pd.agencyFee) : 2
          const returnLoss = pd.returnLoss !== undefined && pd.returnLoss !== '' ? Number(pd.returnLoss) : 4
          const discountRate = pd.discountRate !== undefined && pd.discountRate !== '' ? Number(pd.discountRate) : 0.6
          const common = { commission, adRate, paymentFee, agencyFee, returnLoss, discountRate }

          const updateSku = (idx, key, val) => {
            const newSkus = [...skus]
            newSkus[idx] = { ...newSkus[idx], [key]: val }
            savePricing({ ...pricingData, [product.id]: { ...pd, skus: newSkus, commission, adRate, paymentFee, agencyFee, returnLoss, discountRate } })
          }
          const addSku = () => {
            savePricing({ ...pricingData, [product.id]: { ...pd, skus: [...skus, {}], commission, adRate, paymentFee, agencyFee, returnLoss, discountRate } })
          }
          const removeSku = (idx) => {
            const newSkus = skus.filter((_, i) => i !== idx)
            savePricing({ ...pricingData, [product.id]: { ...pd, skus: newSkus, commission, adRate, paymentFee, agencyFee, returnLoss, discountRate } })
          }
          const updateCommon = (key, val) => {
            savePricing({ ...pricingData, [product.id]: { ...pd, skus, commission, adRate, paymentFee, agencyFee, returnLoss, discountRate, [key]: val } })
          }

          return (
            <div key={product.id} className={`rounded-xl border ${pc.dot.replace('bg-', 'border-').replace(/-\d+/, '-200')} bg-white overflow-hidden`}>
              <div className={`px-4 py-2.5 ${pc.bg} border-b ${pc.dot.replace('bg-', 'border-').replace(/-\d+/, '-200')} flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${pc.dot}`} />
                  <span className={`text-sm font-bold ${pc.text}`}>{product.name}</span>
                </div>
                <button onClick={addSku} className="text-xs px-2 py-1 rounded bg-white/80 hover:bg-white text-morandi-text flex items-center gap-1">
                  <Plus className="w-3 h-3" />添加规格
                </button>
              </div>

              <div className="p-4">
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <span className="text-xs text-morandi-text-light">公共费率：</span>
                  {[
                    ['佣金', 'commission', '%', commission],
                    ['广告', 'adRate', '%', adRate],
                    ['支付费', 'paymentFee', '%', paymentFee],
                    ['代理费', 'agencyFee', '%', agencyFee],
                    ['退货', 'returnLoss', '%', returnLoss],
                    ['折扣系数', 'discountRate', '折', Math.round(discountRate * 10 * 10) / 10],
                  ].map(([label, key, unit, val]) => (
                    <div key={key} className="flex items-center gap-1">
                      <span className="text-[10px] text-morandi-text-light">{label}</span>
                      <input type="number" step={key === 'discountRate' ? '0.1' : '1'} value={key === 'discountRate' ? val : val} onChange={e => {
                        const v = e.target.value
                        updateCommon(key, key === 'discountRate' ? (v === '' ? '' : Number(v) / 10) : v)
                      }}
                        className="w-12 text-xs text-center border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-green-200 bg-white" />
                      <span className="text-[10px] text-gray-400">{unit}</span>
                    </div>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse min-w-[1500px]">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 px-2 py-1.5 text-left text-morandi-text-light font-semibold w-20">规格</th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-14">重量<br/><span className="text-[9px]">KG</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-28">长×宽×高<br/><span className="text-[9px]">CM</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-16">上架价格<br/><span className="text-[9px]">₽</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-16">上架价格<br/><span className="text-[9px]">¥</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-16">折后成交价<br/><span className="text-[9px]">₽({Math.round(discountRate * 100)}%)</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-16">折后成交价<br/><span className="text-[9px]">¥</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-16">采购成本<br/><span className="text-[9px]">¥</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-14">国内运费<br/><span className="text-[9px]">¥</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-14">贴标费<br/><span className="text-[9px]">¥</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-16">国内成本<br/><span className="text-[9px]">¥</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-20">跨境物流<br/><span className="text-[9px]">¥</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-16">平台成本<br/><span className="text-[9px]">¥</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-14">退货损失<br/><span className="text-[9px]">¥</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-16">毛利<br/><span className="text-[9px]">¥</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-14">利润率<br/><span className="text-[9px]">%</span></th>
                        <th className="border border-gray-200 px-1 py-1.5 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {skus.map((sku, idx) => {
                        const calc = calcRow(sku, common)
                        return (
                          <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                            <td className="border border-gray-200 px-1.5 py-1">
                              <input type="text" value={sku.spec || ''} onChange={e => updateSku(idx, 'spec', e.target.value)} placeholder="如500ml"
                                className="w-full text-xs border-0 bg-transparent focus:outline-none text-morandi-text" />
                            </td>
                            <td className="border border-gray-200 px-1 py-1">
                              <input type="number" value={sku.weight || ''} onChange={e => updateSku(idx, 'weight', e.target.value)} placeholder="0.5" step="any"
                                className="w-full text-xs border-0 bg-transparent focus:outline-none text-center text-morandi-text" />
                            </td>
                            <td className="border border-gray-200 px-1 py-1">
                              <div className="flex items-center gap-0.5">
                                <input type="number" value={sku.length || ''} onChange={e => updateSku(idx, 'length', e.target.value)} placeholder="52" step="any"
                                  className="w-10 text-xs border-0 bg-transparent focus:outline-none text-center text-morandi-text" />
                                <span className="text-gray-300">×</span>
                                <input type="number" value={sku.width || ''} onChange={e => updateSku(idx, 'width', e.target.value)} placeholder="45" step="any"
                                  className="w-10 text-xs border-0 bg-transparent focus:outline-none text-center text-morandi-text" />
                                <span className="text-gray-300">×</span>
                                <input type="number" value={sku.height || ''} onChange={e => updateSku(idx, 'height', e.target.value)} placeholder="28" step="any"
                                  className="w-10 text-xs border-0 bg-transparent focus:outline-none text-center text-morandi-text" />
                              </div>
                            </td>
                            <td className="border border-gray-200 px-1 py-1">
                              <input type="number" value={sku.listPrice || ''} onChange={e => updateSku(idx, 'listPrice', e.target.value)} placeholder="8600" step="any"
                                className="w-full text-xs border-0 bg-transparent focus:outline-none text-center text-morandi-text" />
                            </td>
                            <td className="border border-gray-200 px-1.5 py-1 text-center text-morandi-text">{calc.listPriceRMB || '-'}</td>
                            <td className="border border-gray-200 px-1.5 py-1 text-center text-blue-600 font-medium">{calc.price || '-'}</td>
                            <td className="border border-gray-200 px-1.5 py-1 text-center text-blue-600 font-medium">{calc.priceRMB || '-'}</td>
                            <td className="border border-gray-200 px-1 py-1">
                              <input type="number" value={sku.purchaseCost || ''} onChange={e => updateSku(idx, 'purchaseCost', e.target.value)} placeholder="35" step="any"
                                className="w-full text-xs border-0 bg-transparent focus:outline-none text-center text-morandi-text" />
                            </td>
                            <td className="border border-gray-200 px-1 py-1">
                              <input type="number" value={sku.domesticShip || ''} onChange={e => updateSku(idx, 'domesticShip', e.target.value)} placeholder="3" step="any"
                                className="w-full text-xs border-0 bg-transparent focus:outline-none text-center text-morandi-text" />
                            </td>
                            <td className="border border-gray-200 px-1 py-1">
                              <input type="number" value={sku.labelFee || ''} onChange={e => updateSku(idx, 'labelFee', e.target.value)} placeholder="2" step="any"
                                className="w-full text-xs border-0 bg-transparent focus:outline-none text-center text-morandi-text" />
                            </td>
                            <td className="border border-gray-200 px-1.5 py-1 text-center text-red-500">{calc.domesticCost || '-'}</td>
                            <td className="border border-gray-200 px-1.5 py-1 text-center text-red-500">
                              {calc.crossBorderCost !== null ? Math.round(calc.crossBorderCost * 100) / 100 : '-'}
                              {calc.bestShip && <div className="text-[8px] text-gray-400">{calc.bestShip.name}</div>}
                            </td>
                            <td className="border border-gray-200 px-1.5 py-1 text-center text-red-500">{Math.round(calc.platformCost * 100) / 100 || '-'}</td>
                            <td className="border border-gray-200 px-1.5 py-1 text-center text-red-500">{Math.round(calc.returnAmt * 100) / 100 || '-'}</td>
                            <td className={`border border-gray-200 px-1.5 py-1 text-center font-bold ${calc.profit !== null ? (calc.profit >= 0 ? 'text-green-600' : 'text-red-500') : 'text-gray-300'}`}>
                              {calc.profit !== null ? calc.profit : '-'}
                            </td>
                            <td className={`border border-gray-200 px-1.5 py-1 text-center font-bold ${calc.profitRate !== null ? (calc.profitRate >= 0 ? 'text-green-600' : 'text-red-500') : 'text-gray-300'}`}>
                              {calc.profitRate !== null ? calc.profitRate : '-'}
                            </td>
                            <td className="border border-gray-200 px-1 py-1 text-center">
                              {skus.length > 1 && (
                                <button onClick={() => removeSku(idx)} className="p-0.5 hover:bg-red-50 rounded text-gray-300 hover:text-red-400">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
