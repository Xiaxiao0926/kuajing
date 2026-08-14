import { useState } from 'react'
import { persistGet, persistSet } from '../utils/persist'
import { Calculator, Package, DollarSign, TrendingUp, Info } from 'lucide-react'

const SHIPPING_KEY = 'shipping-calc-rfbs-v2'

const R = 0.09

const CHANNELS = [
  {
    category: 'Extra Small',
    categoryZh: '超级轻小件',
    channels: [
      { id: 'express_xs', name: 'Express Extra Small', speed: '5-10天', rate: 46.8, base: 3.12, weightMax: 0.5, sumMax: 90, sideMax: 60, priceMax: 1500, volumetric: false },
      { id: 'standard_xs', name: 'Standard Extra Small', speed: '10-15天', rate: 36.4, base: 3.12, weightMax: 0.5, sumMax: 90, sideMax: 60, priceMax: 1500, volumetric: false },
      { id: 'economy_xs', name: 'Economy Extra Small', speed: '15-25天', rate: 26, base: 3.12, weightMax: 0.5, sumMax: 90, sideMax: 60, priceMax: 1500, volumetric: false },
    ]
  },
  {
    category: 'Budget',
    categoryZh: '低客单价标准件',
    channels: [
      { id: 'express_budget', name: 'Express Budget', speed: '5-10天', rate: 34.32, base: 23.92, weightMin: 0.5, weightMax: 30, sumMax: 150, sideMax: 60, priceMax: 1500, volumetric: false },
      { id: 'standard_budget', name: 'Standard Budget', speed: '10-15天', rate: 26, base: 23.92, weightMin: 0.5, weightMax: 30, sumMax: 150, sideMax: 60, priceMax: 1500, volumetric: false },
      { id: 'economy_budget', name: 'Economy Budget', speed: '15-25天', rate: 17.68, base: 23.92, weightMin: 0.5, weightMax: 30, sumMax: 150, sideMax: 60, priceMax: 1500, volumetric: false },
    ]
  },
  {
    category: 'Small',
    categoryZh: '小件',
    channels: [
      { id: 'express_small', name: 'Express Small', speed: '5-10天', rate: 46.8, base: 16.64, weightMax: 2, sumMax: 150, sideMax: 60, priceMin: 1501, priceMax: 7000, volumetric: false },
      { id: 'standard_small', name: 'Standard Small', speed: '10-15天', rate: 36.4, base: 16.64, weightMax: 2, sumMax: 150, sideMax: 60, priceMin: 1501, priceMax: 7000, volumetric: false },
      { id: 'economy_small', name: 'Economy Small', speed: '15-25天', rate: 26, base: 16.64, weightMax: 2, sumMax: 150, sideMax: 60, priceMin: 1501, priceMax: 7000, volumetric: false },
    ]
  },
  {
    category: 'Big',
    categoryZh: '大件',
    channels: [
      { id: 'standard_big', name: 'Standard Big', speed: '10-15天', rate: 26, base: 37.44, weightMin: 2, weightMax: 30, sumMax: 310, sideMax: 150, priceMin: 1501, priceMax: 7000, volumetric: true, volDiv: 12000, chargeWeightMax: 31 },
      { id: 'economy_big', name: 'Economy Big', speed: '15-25天', rate: 17.68, base: 37.44, weightMin: 2, weightMax: 30, sumMax: 310, sideMax: 150, priceMin: 1501, priceMax: 7000, volumetric: true, volDiv: 12000, chargeWeightMax: 31 },
    ]
  },
  {
    category: 'Premium Small',
    categoryZh: '高客单价小件',
    channels: [
      { id: 'express_psmall', name: 'Express Premium Small', speed: '5-10天', rate: 46.8, base: 22.88, weightMax: 5, sumMax: 250, sideMax: 150, priceMin: 7001, priceMax: 250000, volumetric: false },
      { id: 'standard_psmall', name: 'Standard Premium Small', speed: '10-15天', rate: 36.4, base: 22.88, weightMax: 5, sumMax: 250, sideMax: 150, priceMin: 7001, priceMax: 250000, volumetric: false },
      { id: 'economy_psmall', name: 'Economy Premium Small', speed: '15-25天', rate: 26, base: 22.88, weightMax: 5, sumMax: 250, sideMax: 150, priceMin: 7001, priceMax: 250000, volumetric: false },
    ]
  },
  {
    category: 'Premium Big',
    categoryZh: '高客单价大件',
    channels: [
      { id: 'standard_pbig', name: 'Standard Premium Big', speed: '10-15天', rate: 29.12, base: 64.48, weightMin: 5, weightMax: 30, sumMax: 310, sideMax: 150, priceMin: 7001, priceMax: 250000, volumetric: true, volDiv: 12000, chargeWeightMax: 80 },
      { id: 'economy_pbig', name: 'Economy Premium Big', speed: '15-25天', rate: 23.92, base: 64.48, weightMin: 5, weightMax: 30, sumMax: 310, sideMax: 150, priceMin: 7001, priceMax: 250000, volumetric: true, volDiv: 12000, chargeWeightMax: 80 },
    ]
  },
  {
    category: 'HK',
    categoryZh: '中国香港',
    channels: [
      { id: 'express_hk', name: 'Express HK 香港空运', speed: '7-12天', rate: 96, base: 19, rateUnit: 'per100g', weightMax: 25, sumMax: 310, sideMax: 150, priceMin: 1, priceMax: 500000, volumetric: 'conditional', volDiv: 6000, volThreshold: 60 },
    ]
  },
]

function calcShipping(ch, price, weight, length, width, height) {
  const sum = length + width + height
  const sideCheck = length <= ch.sideMax && width <= ch.sideMax && height <= ch.sideMax
  const sumCheck = sum <= ch.sumMax
  const priceCheck = price >= (ch.priceMin || 0) && price <= ch.priceMax
  const weightMin = ch.weightMin || 0
  const weightCheck = weight >= weightMin && weight <= ch.weightMax

  if (!sideCheck || !sumCheck || !priceCheck || !weightCheck) return null

  let chargeWeight = weight
  let volumetricWeight = null

  if (ch.volumetric === true) {
    volumetricWeight = (length * width * height) / ch.volDiv
    chargeWeight = Math.max(weight, volumetricWeight)
    if (chargeWeight > ch.chargeWeightMax) return null
  } else if (ch.volumetric === 'conditional') {
    if (sum > ch.volThreshold) {
      volumetricWeight = Math.ceil((length * width * height) / ch.volDiv * 10) / 10
      chargeWeight = Math.max(weight, volumetricWeight)
    }
    chargeWeight = Math.ceil(chargeWeight * 10) / 10
  }

  let cost
  if (ch.rateUnit === 'per100g') {
    cost = Math.ceil(chargeWeight * 10) / 10 * ch.rate + ch.base
  } else {
    cost = chargeWeight * ch.rate + ch.base
  }

  return {
    cost: Math.round(cost * 100) / 100,
    chargeWeight: Math.round(chargeWeight * 1000) / 1000,
    volumetricWeight: volumetricWeight ? Math.round(volumetricWeight * 1000) / 1000 : null
  }
}

export default function ShippingCalc() {
  const [params, setParams] = useState(() => persistGet(SHIPPING_KEY) || {
    price: 5200,
    weight: 1.55,
    length: 52,
    width: 45,
    height: 28,
    purchaseCost: 35,
    domesticShipping: 3,
    labelingFee: 2,
    commission: 12,
    adRate: 10,
    paymentFee: 1,
    agencyFee: 2,
    returnLoss: 4,
  })

  const updateParam = (key, val) => {
    const newData = { ...params, [key]: val }
    setParams(newData)
    persistSet(SHIPPING_KEY, newData)
  }

  const price = Number(params.price) || 0
  const weight = Number(params.weight) || 0
  const length = Number(params.length) || 0
  const width = Number(params.width) || 0
  const height = Number(params.height) || 0
  const purchaseCost = Number(params.purchaseCost) || 0
  const domesticShipping = Number(params.domesticShipping) || 0
  const labelingFee = Number(params.labelingFee) || 0
  const commission = Number(params.commission) || 0
  const adRate = Number(params.adRate) || 0
  const paymentFee = Number(params.paymentFee) || 0
  const agencyFee = Number(params.agencyFee) || 0
  const returnLoss = Number(params.returnLoss) || 0

  const sumDim = length + width + height
  const density = (length && width && height) ? (weight / (length * width * height / 1000000)).toFixed(1) : 0
  const priceRMB = Math.round(price * R * 100) / 100

  const domesticCost = purchaseCost + domesticShipping + labelingFee
  const platformCostRate = commission + adRate + paymentFee

  const results = CHANNELS.map(cat => ({
    ...cat,
    channels: cat.channels.map(ch => {
      const res = calcShipping(ch, price, weight, length, width, height)
      let profit = null
      let profitRate = null
      let costBreakdown = null
      if (res) {
        const agencyAmtRub = Math.min(200, Math.max(15, price * agencyFee / 100))
        const agencyAmt = Math.round(agencyAmtRub * R * 100) / 100
        const crossBorderCost = res.cost + agencyAmt
        const platformAmt = priceRMB * platformCostRate / 100
        const returnAmt = priceRMB * returnLoss / 100
        profit = Math.round((priceRMB - domesticCost - crossBorderCost - platformAmt - returnAmt) * 100) / 100
        profitRate = priceRMB > 0 ? Math.round(profit / priceRMB * 1000) / 10 : 0
        costBreakdown = {
          domesticCost,
          celShipping: res.cost,
          agencyAmt: Math.round(agencyAmt * 100) / 100,
          crossBorderCost: Math.round(crossBorderCost * 100) / 100,
          commissionAmt: Math.round(priceRMB * commission / 100 * 100) / 100,
          adAmt: Math.round(priceRMB * adRate / 100 * 100) / 100,
          paymentAmt: Math.round(priceRMB * paymentFee / 100 * 100) / 100,
          platformAmt: Math.round(platformAmt * 100) / 100,
          returnAmt: Math.round(returnAmt * 100) / 100,
        }
      }
      return { ...ch, result: res, profit, profitRate, costBreakdown }
    })
  }))

  const bestChannel = results.flatMap(c => c.channels).filter(ch => ch.result).sort((a, b) => b.profit - a.profit)[0]

  const inputField = (label, key, unit, placeholder) => (
    <div>
      <label className="text-sm font-medium text-morandi-text-light mb-1 block">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={params[key]}
          onChange={e => updateParam(key, e.target.value)}
          placeholder={placeholder}
          step="any"
          className="w-full text-sm text-morandi-text border border-gray-200 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300 bg-white"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{unit}</span>
      </div>
    </div>
  )

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-3 flex items-center justify-between bg-blue-50 border-b border-blue-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-100">
            <Calculator className="w-4 h-4 text-blue-700" />
          </div>
          <h3 className="text-base font-bold text-blue-700">运费利润计算</h3>
          <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-600 border border-blue-200">OZON rFBS 自发货</span>
        </div>
        <span className="text-xs text-blue-500">CEL产品资费表 V5.23</span>
      </div>

      <div className="p-5">
        <div className="space-y-5 mb-5">
          <div>
            <p className="text-sm font-semibold text-morandi-text mb-2">📦 商品与物流参数</p>
            <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
              {inputField('售价', 'price', '₽', '如5200')}
              {inputField('实重', 'weight', 'KG', '如1.55')}
              {inputField('长', 'length', 'CM', '如52')}
              {inputField('宽', 'width', 'CM', '如45')}
              {inputField('高', 'height', 'CM', '如28')}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-morandi-text mb-2">🏭 国内物流费用</p>
            <div className="grid grid-cols-3 gap-3">
              {inputField('采购成本', 'purchaseCost', '¥', '如35')}
              {inputField('国内段运费', 'domesticShipping', '¥', '如3')}
              {inputField('贴标费', 'labelingFee', '¥', '如2')}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-morandi-text mb-2">💰 平台与跨境费用（占售价%）</p>
            <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
              {inputField('佣金', 'commission', '%', '12')}
              {inputField('广告费用', 'adRate', '%', '10')}
              {inputField('支付工具费', 'paymentFee', '%', '1')}
              {inputField('交付代理费', 'agencyFee', '%', '2')}
              {inputField('退货损失', 'returnLoss', '%', '4')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-5 mb-5 px-1 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Package className="w-4 h-4 text-morandi-text-light" />
            <span className="text-sm text-morandi-text-light">三边和: <span className="font-semibold text-morandi-text">{sumDim}CM</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-morandi-text-light" />
            <span className="text-sm text-morandi-text-light">密度: <span className="font-semibold text-morandi-text">{density} KG/M³</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-morandi-text-light" />
            <span className="text-sm text-morandi-text-light">售价折合: <span className="font-semibold text-morandi-text">¥{priceRMB}</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Info className="w-4 h-4 text-morandi-text-light" />
            <span className="text-sm text-morandi-text-light">汇率: 1₽ = ¥{R}</span>
          </div>
        </div>

        {bestChannel && bestChannel.costBreakdown && (
          <div className="mb-5 p-4 rounded-lg bg-green-50 border border-green-200">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-green-700">🏆 最优渠道</span>
              <span className="text-sm font-bold text-green-800">{bestChannel.name}</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
              <div><span className="text-green-600">售价</span><br /><span className="font-bold text-green-800">¥{priceRMB}</span></div>
              <div><span className="text-green-600">国内成本</span><br /><span className="font-bold text-green-800">-¥{bestChannel.costBreakdown.domesticCost}</span></div>
              <div><span className="text-green-600">跨境物流</span><br /><span className="font-bold text-green-800">-¥{bestChannel.costBreakdown.crossBorderCost}</span></div>
              <div><span className="text-green-600">平台成本</span><br /><span className="font-bold text-green-800">-¥{bestChannel.costBreakdown.platformAmt}</span></div>
              <div><span className="text-green-600">退货损失</span><br /><span className="font-bold text-green-800">-¥{bestChannel.costBreakdown.returnAmt}</span></div>
            </div>
            <div className="mt-3 pt-3 border-t border-green-200 flex items-center gap-5">
              <span className="text-sm text-green-700">毛利 <span className={`font-bold text-lg ${bestChannel.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>¥{bestChannel.profit}</span></span>
              <span className="text-sm text-green-700">利润率 <span className={`font-bold text-lg ${bestChannel.profitRate >= 0 ? 'text-green-700' : 'text-red-600'}`}>{bestChannel.profitRate}%</span></span>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {results.map(cat => {
            const available = cat.channels.filter(ch => ch.result)
            if (available.length === 0) return null
            return (
              <div key={cat.category} className="border border-gray-100 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                  <span className="text-sm font-semibold text-morandi-text">{cat.categoryZh}</span>
                  <span className="text-xs text-morandi-text-light">{cat.category}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {cat.channels.map(ch => {
                    const res = ch.result
                    const isAvailable = !!res
                    const isBest = bestChannel && ch.id === bestChannel.id
                    return (
                      <div key={ch.id} className={`px-4 py-3 flex items-center gap-4 ${isAvailable ? (isBest ? 'bg-green-50/50' : '') : 'opacity-30'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-morandi-text truncate">{ch.name}</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-morandi-text-light flex-shrink-0">{ch.speed}</span>
                            {isBest && <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 border border-green-200 flex-shrink-0">最优</span>}
                          </div>
                          <div className="text-xs text-morandi-text-light mt-1">
                            {ch.rateUnit === 'per100g' ? `${ch.rate/10}元/KG(${ch.rate}元/100g)` : `${ch.rate}元/KG`} + {ch.base}元/票
                            {ch.volumetric === true && <span className="ml-1 text-amber-600">· 计抛(÷{ch.volDiv})</span>}
                            {ch.volumetric === 'conditional' && <span className="ml-1 text-amber-600">· 三边和&gt;{ch.volThreshold}cm计抛(÷{ch.volDiv})</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-5 flex-shrink-0">
                          {res && (
                            <>
                              {res.volumetricWeight !== null && (
                                <div className="text-right">
                                  <div className="text-xs text-morandi-text-light">体积重</div>
                                  <div className="text-sm font-medium text-morandi-text">{res.volumetricWeight}KG</div>
                                </div>
                              )}
                              <div className="text-right">
                                <div className="text-xs text-morandi-text-light">计费重</div>
                                <div className="text-sm font-medium text-morandi-text">{res.chargeWeight}KG</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-morandi-text-light">跨境物流</div>
                                <div className="text-sm font-bold text-blue-600">¥{ch.costBreakdown?.crossBorderCost}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-morandi-text-light">毛利</div>
                                <div className={`text-sm font-bold ${ch.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                  ¥{ch.profit}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-morandi-text-light">利润率</div>
                                <div className={`text-sm font-bold ${ch.profitRate >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                  {ch.profitRate}%
                                </div>
                              </div>
                            </>
                          )}
                          {!isAvailable && (
                            <span className="text-xs text-gray-300">不适用</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-5 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-1.5 mb-2">
            <Info className="w-4 h-4 text-morandi-text-light" />
            <span className="text-sm font-semibold text-morandi-text-light">rFBS自发货毛利公式</span>
          </div>
          <div className="text-sm text-morandi-text-light leading-relaxed space-y-1">
            <p>• 毛利 = 售价 - 国内物流费用 - 跨境物流费用 - 平台销售成本 - 退货损失</p>
            <p>• 国内物流 = 采购成本 + 国内段运费 + 贴标费</p>
            <p>• 跨境物流 = 国际物流费(CEL) + 货物交付代理费({agencyFee}%售价)</p>
            <p>• 平台成本 = 佣金({commission}%) + 广告({adRate}%) + 支付工具({paymentFee}%) = {platformCostRate}%</p>
            <p>• 退货损失 = 预估销售额的{returnLoss}%</p>
            <p>• Big/Premium Big计抛：体积重 = 长×宽×高 ÷ 12000；HK：三边和&gt;60cm计抛(÷6000)</p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-1.5 mb-2">
            <Info className="w-4 h-4 text-morandi-text-light" />
            <span className="text-sm font-semibold text-morandi-text-light">货物交付代理费备注</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">2026.3.1 - 2026.5.3</span>
          </div>
          <div className="text-sm text-morandi-text-light leading-relaxed space-y-2 bg-gray-50/50 rounded-lg p-4 border border-gray-100">
            <p className="font-medium text-morandi-text">Ozon合作配送服务的费用包括：</p>
            <p>1. <span className="font-medium text-morandi-text">Ozon代理费</span>：占卖家个人中心价格的2%，但不少于15卢布，且不超过每个货件200卢布。</p>
            <p>2. <span className="font-medium text-morandi-text">配送给买家的费用</span>：根据承运商设定的公式计算，计算基础是货件的实际重量或体积重量。配送方式取决于下单日期时的商品价格。配送费用从应付款项中扣除，以订单创建当日俄罗斯中央银行汇率为准折算为合同货币。</p>
            <p>3. <span className="font-medium text-morandi-text">Ozon费用赔偿</span>（China Post to PUDO Economy / Standard渠道）：因收件人委托，Ozon将订单运往自提点的费用，该订单内每件商品售价的4-6%。</p>
            <p>4. <span className="font-medium text-morandi-text">退回费用</span>：因取消和退货将商品退回给卖家的费用，直接支付给承运商。</p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-1.5 mb-2">
            <Info className="w-4 h-4 text-morandi-text-light" />
            <span className="text-sm font-semibold text-morandi-text-light">Ozon商品销售佣金</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">2025.12.1起</span>
          </div>
          <p className="text-sm text-morandi-text-light mb-3">销售佣金金额取决于卖家个人中心价格及下单日汇率：≤1500₽ / 1501-5000₽ / &gt;5000₽</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-200 px-2 py-1.5 text-left text-morandi-text-light font-semibold" rowSpan={2}>类目模块</th>
                  <th className="border border-gray-200 px-2 py-1.5 text-left text-morandi-text-light font-semibold" rowSpan={2}>商品类目</th>
                  <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold" colSpan={2}>≤1500₽</th>
                  <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold" colSpan={2}>≤5000₽</th>
                  <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold" colSpan={2}>&gt;5000₽</th>
                </tr>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-1.5 py-1 text-center text-blue-600 font-semibold">rFBS</th>
                  <th className="border border-gray-200 px-1.5 py-1 text-center text-purple-600 font-semibold">FBP</th>
                  <th className="border border-gray-200 px-1.5 py-1 text-center text-blue-600 font-semibold">rFBS</th>
                  <th className="border border-gray-200 px-1.5 py-1 text-center text-purple-600 font-semibold">FBP</th>
                  <th className="border border-gray-200 px-1.5 py-1 text-center text-blue-600 font-semibold">rFBS</th>
                  <th className="border border-gray-200 px-1.5 py-1 text-center text-purple-600 font-semibold">FBP</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['药房商品','药店','12%','11%','14%','13%','18%','17%'],
                  ['','矫形用品','12%','11%','17%','16%','17%','16%'],
                  ['','成人用品','12%','11%','14%','13%','21%','20%'],
                  ['','辅助药品','12%','11%','15%','14%','15%','14%'],
                  ['','电子烟及配件','12%','11%','24%','23%','24%','23%'],
                  ['','维生素和膳食补充剂','12%','11%','18%','17%','18%','17%'],
                  ['家居与汽车用品','装饰、清洁与储物','12%','11%','14%','13%','18%','17%'],
                  ['','住宅和花园','12%','11%','14%','13%','20%','19%'],
                  ['','汽车用品','12%','11%','17%','16%','17%','16%'],
                  ['','手动工具和测量仪器','12%','11%','17%','16%','17%','16%'],
                  ['','建筑和装修','12%','11%','18%','17%','18%','17%'],
                  ['','康复设备','12%','11%','14%','13%','17%','16%'],
                  ['','重型建筑','11%','10%','11%','10%','11%','10%'],
                  ['','儿童餐具','12%','11%','14%','13%','18%','17%'],
                  ['','家具','10%','9%','10%','9%','10%','9%'],
                  ['','轮胎','10%','9%','10%','9%','10%','9%'],
                  ['','装饰材料','12%','11%','14%','13%','14%','13%'],
                  ['','卫浴设备','12%','11%','14%','13%','14%','13%'],
                  ['','日化','12%','11%','18%','17%','18%','17%'],
                  ['','建筑装修和园艺设备','12%','11%','16%','15%','16%','15%'],
                  ['','新年装饰用品','12%','11%','14%','13%','20%','19%'],
                  ['','电动滑板车','12%','11%','17%','16%','17%','16%'],
                  ['','船只马达和充气艇','12%','11%','15%','14%','15%','14%'],
                  ['','自行车','12%','11%','15%','14%','15%','14%'],
                  ['','水过滤器','12%','11%','17%','16%','17%','16%'],
                  ['','运动手表','12%','11%','12%','11%','12%','11%'],
                  ['','成品房','12%','11%','14.5%','13.5%','14.5%','13.5%'],
                  ['','汽车/汽车房/特种设备','10%','9%','10%','9%','10%','9%'],
                  ['美容','服装和配饰','12%','11%','14%','13%','20.5%','19.5%'],
                  ['','鞋类','12%','11%','12%','11%','12%','11%'],
                  ['','美容与健康','12%','11%','14%','13%','18%','17%'],
                  ['','专业口腔护理','12%','11%','17%','16%','17%','16%'],
                  ['','外衣','10%','9%','10%','9%','10%','9%'],
                  ['','专业医疗设备','12%','11%','17%','16%','17%','16%'],
                  ['其它','包装袋','10%','9%','10%','9%','10%','9%'],
                  ['儿童用品','儿童纺织品','12%','11%','19%','18%','19%','18%'],
                  ['','儿童运动用品','12%','11%','14%','13%','14%','13%'],
                  ['','儿童电子/家具/配件','12%','11%','14%','13%','20%','19%'],
                  ['','玩具','12%','11%','14%','13%','17.5%','16.5%'],
                  ['','儿童卫生用品','12%','11%','18%','17%','18%','17%'],
                  ['','婴儿推车和汽车安全座椅','12%','11%','14%','13%','20%','19%'],
                  ['宠物用品','宠物饲料与农场用品','12%','11%','13%','12%','13%','12%'],
                  ['','宠物用品','12%','11%','14%','13%','15%','14%'],
                  ['','宠物卫生与护理','12%','11%','13%','12%','13%','12%'],
                  ['快速消费品','食品','11%','10%','11%','10%','11%','10%'],
                  ['','新鲜食品','11%','10%','11%','10%','11%','10%'],
                  ['','个人卫生用品','12%','11%','18%','17%','18%','17%'],
                  ['','隐形眼镜','12%','11%','18%','17%','18%','17%'],
                  ['爱好与运动','运动和休闲用品','12%','11%','19%','18%','19%','18%'],
                  ['','兴趣/创意与文具','12%','11%','14%','13%','16%','15%'],
                  ['','书籍','12%','11%','22%','21%','22%','21%'],
                  ['','蹦床/游泳池/立式桨板','12%','11%','16%','15%','16%','15%'],
                  ['','运动营养','12%','11%','15%','14%','15%','14%'],
                  ['','运动员营养补充剂','12%','11%','18%','17%','18%','17%'],
                  ['电子产品','电子产品配饰','12%','11%','20%','19%','20%','19%'],
                  ['','音视频设备配件','12%','11%','14.5%','13.5%','14.5%','13.5%'],
                  ['','家用电器','10%','9%','10%','9%','10%','9%'],
                  ['','电视机','9%','8%','9%','8%','9%','8%'],
                  ['','美容设备','12%','11%','14%','13%','16%','15%'],
                  ['','办公电脑/收银/仓储设备','12%','11%','16%','15%','16%','15%'],
                  ['','游戏主机/摄影器材','12%','11%','12.5%','11.5%','12.5%','11.5%'],
                  ['','电脑外设及耗材','12%','11%','14.5%','13.5%','14.5%','13.5%'],
                  ['','非内置大型家电','9%','8%','9%','8%','9%','8%'],
                  ['','智能手机和平板','11.5%','10.5%','11.5%','10.5%','11.5%','10.5%'],
                  ['','电脑及笔记本配件','12%','11%','12.5%','11.5%','12.5%','11.5%'],
                  ['','Yandex智能音箱','12%','11%','14.5%','13.5%','14.5%','13.5%'],
                  ['','嵌入式大型家电','9%','8%','9%','8%','9%','8%'],
                  ['','显示器','12%','11%','12.5%','11.5%','12.5%','11.5%'],
                  ['','智能手表/健身手环','11.5%','10.5%','11.5%','10.5%','11.5%','10.5%'],
                  ['','电子游戏','12%','11%','14.5%','13.5%','14.5%','13.5%'],
                  ['','台式电脑','9%','8%','9%','8%','9%','8%'],
                  ['','电脑设备配件','12%','11%','13.5%','12.5%','13.5%','12.5%'],
                  ['','笔记本电脑','8%','7%','8%','7%','8%','7%'],
                  ['','戴森配件','6%','5%','6%','5%','6%','5%'],
                  ['','索尼耳机','8%','7%','8%','7%','8%','7%'],
                  ['','三星TWS耳机','8%','7%','8%','7%','8%','7%'],
                  ['','三星智能手表/手环','8%','7%','8%','7%','8%','7%'],
                  ['','三星智能手机/平板','8%','7%','8%','7%','8%','7%'],
                  ['','苹果设备','7%','6%','7%','6%','7%','6%'],
                  ['','戴森设备','8%','7%','8%','7%','8%','7%'],
                ].map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="border border-gray-200 px-2 py-1 text-morandi-text font-medium">{row[0]}</td>
                    <td className="border border-gray-200 px-2 py-1 text-morandi-text">{row[1]}</td>
                    <td className="border border-gray-200 px-1.5 py-1 text-center text-blue-600 font-medium">{row[2]}</td>
                    <td className="border border-gray-200 px-1.5 py-1 text-center text-purple-600">{row[3]}</td>
                    <td className="border border-gray-200 px-1.5 py-1 text-center text-blue-600 font-medium">{row[4]}</td>
                    <td className="border border-gray-200 px-1.5 py-1 text-center text-purple-600">{row[5]}</td>
                    <td className="border border-gray-200 px-1.5 py-1 text-center text-blue-600 font-medium">{row[6]}</td>
                    <td className="border border-gray-200 px-1.5 py-1 text-center text-purple-600">{row[7]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-morandi-text-light mt-2">根据俄罗斯联邦法律及其他适用法规，禁止或限制销售的商品不得在平台上销售。</p>
        </div>
      </div>
    </div>
  )
}
