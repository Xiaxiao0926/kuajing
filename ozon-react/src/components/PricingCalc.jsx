import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { persistGet, persistSet } from '../utils/persist'

const PRICING_KEY = 'product-pricing-v2'
const R = 0.09

const PRODUCT_COLORS = {
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', bar: 'bg-purple-400', dot: 'bg-purple-500', light: 'bg-purple-100' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', bar: 'bg-indigo-400', dot: 'bg-indigo-500', light: 'bg-indigo-100' },
  teal: { bg: 'bg-teal-50', text: 'text-teal-700', bar: 'bg-teal-400', dot: 'bg-teal-500', light: 'bg-teal-100' },
}

const ALL_CHANNELS = [
  { name: 'Economy Extra Small', rate: 25, base: 3, weightMax: 0.5, sumMax: 90, sideMax: 60, priceMax: 1500 },
  { name: 'Standard Extra Small', rate: 35, base: 3, weightMax: 0.5, sumMax: 90, sideMax: 60, priceMax: 1500 },
  { name: 'Express Extra Small', rate: 45, base: 3, weightMax: 0.5, sumMax: 90, sideMax: 60, priceMax: 1500 },
  { name: 'Economy Budget', rate: 17, base: 23, weightMin: 0.5, weightMax: 30, sumMax: 150, sideMax: 60, priceMax: 1500 },
  { name: 'Standard Budget', rate: 25, base: 23, weightMin: 0.5, weightMax: 30, sumMax: 150, sideMax: 60, priceMax: 1500 },
  { name: 'Express Budget', rate: 33, base: 23, weightMin: 0.5, weightMax: 30, sumMax: 150, sideMax: 60, priceMax: 1500 },
  { name: 'Economy Small', rate: 25, base: 16, weightMax: 2, sumMax: 150, sideMax: 60, priceMin: 1501, priceMax: 7000 },
  { name: 'Standard Small', rate: 35, base: 16, weightMax: 2, sumMax: 150, sideMax: 60, priceMin: 1501, priceMax: 7000 },
  { name: 'Express Small', rate: 45, base: 16, weightMax: 2, sumMax: 150, sideMax: 60, priceMin: 1501, priceMax: 7000 },
  { name: 'Economy Big', rate: 17, base: 36, weightMin: 2, weightMax: 30, sumMax: 250, sideMax: 150, priceMin: 1501, priceMax: 7000, volumetric: true, volDiv: 12000, chargeWeightMax: 31 },
  { name: 'Standard Big', rate: 25, base: 36, weightMin: 2, weightMax: 30, sumMax: 250, sideMax: 150, priceMin: 1501, priceMax: 7000, volumetric: true, volDiv: 12000, chargeWeightMax: 31 },
  { name: 'Economy Premium Small', rate: 25, base: 22, weightMax: 5, sumMax: 250, sideMax: 150, priceMin: 7001, priceMax: 250000 },
  { name: 'Standard Premium Small', rate: 35, base: 22, weightMax: 5, sumMax: 250, sideMax: 150, priceMin: 7001, priceMax: 250000 },
  { name: 'Express Premium Small', rate: 45, base: 22, weightMax: 5, sumMax: 250, sideMax: 150, priceMin: 7001, priceMax: 250000 },
  { name: 'Economy Premium Big', rate: 23, base: 62, weightMin: 5, weightMax: 30, sumMax: 310, sideMax: 150, priceMin: 7001, priceMax: 250000, volumetric: true, volDiv: 12000, chargeWeightMax: 80 },
  { name: 'Standard Premium Big', rate: 28, base: 62, weightMin: 5, weightMax: 30, sumMax: 310, sideMax: 150, priceMin: 7001, priceMax: 250000, volumetric: true, volDiv: 12000, chargeWeightMax: 80 },
  { name: 'Express HK 香港空运', rate: 96, base: 19, rateUnit: 'per100g', weightMax: 25, sumMax: 310, sideMax: 150, priceMin: 1, priceMax: 500000, volumetric: 'conditional', volDiv: 6000, volThreshold: 60 },
]

const calcShipping = (ch, price, weight, length, width, height) => {
  const sum = length + width + height
  if (length > ch.sideMax || width > ch.sideMax || height > ch.sideMax) return null
  if (sum > ch.sumMax) return null
  if (price < (ch.priceMin || 0) || price > ch.priceMax) return null
  const weightMin = ch.weightMin || 0
  if (weight < weightMin || weight > ch.weightMax) return null
  let chargeWeight = weight
  if (ch.volumetric === true) {
    const volW = (length * width * height) / ch.volDiv
    chargeWeight = Math.max(weight, volW)
    if (chargeWeight > ch.chargeWeightMax) return null
  } else if (ch.volumetric === 'conditional') {
    if (sum > ch.volThreshold) {
      const volW = Math.ceil((length * width * height) / ch.volDiv * 10) / 10
      chargeWeight = Math.max(weight, volW)
    }
    chargeWeight = Math.ceil(chargeWeight * 10) / 10
  }
  let cost
  if (ch.rateUnit === 'per100g') {
    cost = Math.ceil(chargeWeight * 10) / 10 * ch.rate + ch.base
  } else {
    cost = chargeWeight * ch.rate + ch.base
  }
  return Math.round(cost * 100) / 100
}

const getBestShipping = (price, weight, length, width, height) => {
  let best = null
  let bestCost = Infinity
  for (const ch of ALL_CHANNELS) {
    const cost = calcShipping(ch, price, weight, length, width, height)
    if (cost !== null && cost < bestCost) {
      bestCost = cost
      best = { name: ch.name, cost }
    }
  }
  return best
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
        <p className="text-[10px] text-morandi-text-light mt-0.5">按产品规格对比成本、定价与利润</p>
      </div>

      <div className="space-y-4">
        {PRICING_PRODUCTS.map(product => {
          const pc = PRODUCT_COLORS[product.color]
          const pd = pricingData[product.id] || {}
          const skus = pd.skus || [{}]
          const commission = Number(pd.commission) || 12
          const adRate = Number(pd.adRate) || 10
          const paymentFee = Number(pd.paymentFee) || 1
          const agencyFee = Number(pd.agencyFee) || 2
          const returnLoss = Number(pd.returnLoss) || 4
          const platformRate = commission + adRate + paymentFee

          const updateSku = (idx, key, val) => {
            const newSkus = [...skus]
            newSkus[idx] = { ...newSkus[idx], [key]: val }
            savePricing({ ...pricingData, [product.id]: { ...pd, skus: newSkus, commission, adRate, paymentFee, agencyFee, returnLoss } })
          }
          const addSku = () => {
            savePricing({ ...pricingData, [product.id]: { ...pd, skus: [...skus, {}], commission, adRate, paymentFee, agencyFee, returnLoss } })
          }
          const removeSku = (idx) => {
            const newSkus = skus.filter((_, i) => i !== idx)
            savePricing({ ...pricingData, [product.id]: { ...pd, skus: newSkus, commission, adRate, paymentFee, agencyFee, returnLoss } })
          }
          const updateCommon = (key, val) => {
            savePricing({ ...pricingData, [product.id]: { ...pd, skus, commission, adRate, paymentFee, agencyFee, returnLoss, [key]: val } })
          }

          const calcRow = (sku) => {
            const price = Number(sku.price) || 0
            const weight = Number(sku.weight) || 0
            const length = Number(sku.length) || 0
            const width = Number(sku.width) || 0
            const height = Number(sku.height) || 0
            const purchaseCost = Number(sku.purchaseCost) || 0
            const domesticShip = Number(sku.domesticShip) || 0
            const labelFee = Number(sku.labelFee) || 0
            const priceRMB = Math.round(price * R * 100) / 100
            const domesticCost = purchaseCost + domesticShip + labelFee
            const bestShip = price && weight && length && width && height ? getBestShipping(price, weight, length, width, height) : null
            const crossBorderCost = bestShip ? bestShip.cost + priceRMB * agencyFee / 100 : null
            const platformCost = priceRMB * platformRate / 100
            const returnAmt = priceRMB * returnLoss / 100
            const profit = crossBorderCost !== null ? Math.round((priceRMB - domesticCost - crossBorderCost - platformCost - returnAmt) * 100) / 100 : null
            const profitRate = profit !== null && priceRMB > 0 ? Math.round(profit / priceRMB * 1000) / 10 : null
            return { priceRMB, domesticCost, bestShip, crossBorderCost, platformCost, returnAmt, profit, profitRate }
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
                  ].map(([label, key, unit, val]) => (
                    <div key={key} className="flex items-center gap-1">
                      <span className="text-[10px] text-morandi-text-light">{label}</span>
                      <input type="number" value={val} onChange={e => updateCommon(key, e.target.value)}
                        className="w-12 text-xs text-center border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-green-200 bg-white" />
                      <span className="text-[10px] text-gray-400">{unit}</span>
                    </div>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse min-w-[1200px]">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 px-2 py-1.5 text-left text-morandi-text-light font-semibold w-20">规格</th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-14">重量<br/><span className="text-[9px]">KG</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-28">长×宽×高<br/><span className="text-[9px]">CM</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-16">售价<br/><span className="text-[9px]">₽</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-16">采购成本<br/><span className="text-[9px]">¥</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-14">国内运费<br/><span className="text-[9px]">¥</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-14">贴标费<br/><span className="text-[9px]">¥</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-16">售价<br/><span className="text-[9px]">¥</span></th>
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
                        const calc = calcRow(sku)
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
                              <input type="number" value={sku.price || ''} onChange={e => updateSku(idx, 'price', e.target.value)} placeholder="5200" step="any"
                                className="w-full text-xs border-0 bg-transparent focus:outline-none text-center text-morandi-text" />
                            </td>
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
                            <td className="border border-gray-200 px-1.5 py-1 text-center font-medium text-morandi-text">{calc.priceRMB || '-'}</td>
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
