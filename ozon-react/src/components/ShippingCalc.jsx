import { useState } from 'react'
import { persistGet, persistSet } from '../utils/persist'
import { Calculator, Package, DollarSign, TrendingUp, Info } from 'lucide-react'
import { CHANNEL_GROUPS, calcChannelProfit, toCNY, rubPerCny, TARIFF_VERSION } from '../utils/ozonEngine'

const SHIPPING_KEY = 'shipping-calc-rfbs-v2'

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
  const commission = Number(params.commission) || 0
  const adRate = Number(params.adRate) || 0
  const paymentFee = Number(params.paymentFee) || 0
  const agencyFee = Number(params.agencyFee) || 0
  const returnLoss = Number(params.returnLoss) || 0

  const sumDim = length + width + height
  const density = (length && width && height) ? (weight / (length * width * height / 1000000)).toFixed(1) : 0
  const priceRMB = toCNY(price)
  const platformCostRate = commission + adRate + paymentFee

  const results = CHANNEL_GROUPS.map(cat => ({
    category: cat.category,
    categoryZh: cat.categoryZh,
    channels: cat.channels.map(ch => {
      const calc = calcChannelProfit(ch, price, weight, length, width, height, params)
      return {
        ...ch,
        result: calc ? calc.result : null,
        profit: calc ? calc.profit : null,
        profitRate: calc ? calc.profitRate : null,
        costBreakdown: calc ? calc.costBreakdown : null,
      }
    }),
  }))

  const bestChannel = results.flatMap(c => c.channels).filter(ch => ch.result && ch.profit !== null).sort((a, b) => b.profit - a.profit)[0]

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
        <span className="text-xs text-blue-500">CEL产品资费表 {TARIFF_VERSION}</span>
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
            <span className="text-sm text-morandi-text-light">汇率: 1¥ = {rubPerCny}₽ (1₽ ≈ ¥{(1/rubPerCny).toFixed(4)})</span>
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
        </div>
      </div>
    </div>
  )
}
