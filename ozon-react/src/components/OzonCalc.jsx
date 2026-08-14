import { useState } from 'react'
import { Calculator, Package, DollarSign, TrendingUp, Info, Table as TableIcon } from 'lucide-react'
import { persistGet, persistSet } from '../utils/persist'
import {
  R, CHANNEL_GROUPS, ALL_CHANNELS,
  calcShipping, getBestShipping, calcRow, calcChannelProfit,
  PRICING_PRODUCTS, PRODUCT_COLORS, COMMISSION_TABLE,
} from '../utils/ozonEngine'
import { Plus, Trash2 } from 'lucide-react'

const SHIPPING_KEY = 'shipping-calc-rfbs-v2'
const PRICING_KEY = 'product-pricing-v2'

const TABS = [
  { id: 'single', name: '单规格测算', icon: Calculator },
  { id: 'multi', name: '多规格对比', icon: Package },
  { id: 'commission', name: '佣金费率表', icon: TableIcon },
]

export default function OzonCalc() {
  const [tab, setTab] = useState('single')

  return (
    <div className="space-y-4">
      {/* 标题区 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 flex items-center justify-between bg-blue-50 border-b border-blue-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-100">
              <Calculator className="w-4 h-4 text-blue-700" />
            </div>
            <div>
              <h3 className="text-base font-bold text-blue-700">Ozon 跨境核算面板</h3>
              <p className="text-[10px] text-blue-600">OZON rFBS 自发货 · CEL产品资费表 V5.23 · 汇率 1₽ = ¥{R}</p>
            </div>
          </div>
          <span className="text-xs px-2 py-1 rounded bg-white border border-blue-200 text-blue-700">融合利润测算与定价计算</span>
        </div>
        {/* Tab栏 */}
        <div className="flex border-b border-gray-200 bg-white overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                  active ? 'border-blue-500 text-blue-700 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* 内容区 */}
      {tab === 'single' && <SingleTab />}
      {tab === 'multi' && <MultiTab />}
      {tab === 'commission' && <CommissionTab />}
    </div>
  )
}

// ===================== Tab1: 单规格测算（原 ShippingCalc） =====================
function SingleTab() {
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
  const density = length && width && height ? (weight / ((length * width * height) / 1000000)).toFixed(1) : 0
  const priceRMB = Math.round(price * R * 100) / 100

  const domesticCost = purchaseCost + domesticShipping + labelingFee
  const platformCostRate = commission + adRate + paymentFee

  const results = CHANNEL_GROUPS.map((cat) => ({
    ...cat,
    channels: cat.channels.map((ch) => {
      const calc = calcChannelProfit(ch, price, weight, length, width, height, params)
      return { ...ch, result: calc?.result || null, profit: calc?.profit ?? null, profitRate: calc?.profitRate ?? null, costBreakdown: calc?.costBreakdown || null }
    }),
  }))

  const bestChannel = results.flatMap((c) => c.channels).filter((ch) => ch.result).sort((a, b) => b.profit - a.profit)[0]

  const inputField = (label, key, unit, placeholder) => (
    <div>
      <label className="text-sm font-medium text-morandi-text-light mb-1 block">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={params[key]}
          onChange={(e) => updateParam(key, e.target.value)}
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
          {results.map((cat) => {
            const available = cat.channels.filter((ch) => ch.result)
            if (available.length === 0) return null
            return (
              <div key={cat.category} className="border border-gray-100 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                  <span className="text-sm font-semibold text-morandi-text">{cat.categoryZh}</span>
                  <span className="text-xs text-morandi-text-light">{cat.category}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {cat.channels.map((ch) => {
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
                            {ch.rateUnit === 'per100g' ? `${ch.rate / 10}元/KG(${ch.rate}元/100g)` : `${ch.rate}元/KG`} + {ch.base}元/票
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
                                <div className={`text-sm font-bold ${ch.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>¥{ch.profit}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-morandi-text-light">利润率</div>
                                <div className={`text-sm font-bold ${ch.profitRate >= 0 ? 'text-green-600' : 'text-red-500'}`}>{ch.profitRate}%</div>
                              </div>
                            </>
                          )}
                          {!isAvailable && <span className="text-xs text-gray-300">不适用</span>}
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
      </div>
    </div>
  )
}

// ===================== Tab2: 多规格对比（原 PricingCalc） =====================
function MultiTab() {
  const [pricingData, setPricingData] = useState(() => persistGet(PRICING_KEY) || {})

  const savePricing = (data) => {
    setPricingData(data)
    persistSet(PRICING_KEY, data)
  }

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h2 className="text-sm font-bold text-morandi-text">多规格定价对比</h2>
        <p className="text-[10px] text-morandi-text-light mt-0.5">按产品规格对比成本、定价与利润，rFBS运费自动匹配最低渠道（上架价×0.6=折后价）</p>
      </div>

      <div className="space-y-4">
        {PRICING_PRODUCTS.map((product) => {
          const pc = PRODUCT_COLORS[product.color]
          const pd = pricingData[product.id] || {}
          const skus = pd.skus || [{}]
          const commission = pd.commission !== undefined && pd.commission !== '' ? Number(pd.commission) : 12
          const adRate = pd.adRate !== undefined && pd.adRate !== '' ? Number(pd.adRate) : 10
          const paymentFee = pd.paymentFee !== undefined && pd.paymentFee !== '' ? Number(pd.paymentFee) : 1
          const agencyFee = pd.agencyFee !== undefined && pd.agencyFee !== '' ? Number(pd.agencyFee) : 2
          const returnLoss = pd.returnLoss !== undefined && pd.returnLoss !== '' ? Number(pd.returnLoss) : 4

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

          const common = { commission, adRate, paymentFee, agencyFee, returnLoss }

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
                      <input type="number" value={val} onChange={(e) => updateCommon(key, e.target.value)}
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
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-14">重量<br /><span className="text-[9px]">KG</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-28">长×宽×高<br /><span className="text-[9px]">CM</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-16">上架价格<br /><span className="text-[9px]">₽</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-16">上架价格<br /><span className="text-[9px]">¥</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-16">折后价<br /><span className="text-[9px]">₽(6折)</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-16">折后价<br /><span className="text-[9px]">¥</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-16">采购成本<br /><span className="text-[9px]">¥</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-14">国内运费<br /><span className="text-[9px]">¥</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-14">贴标费<br /><span className="text-[9px]">¥</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-16">国内成本<br /><span className="text-[9px]">¥</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-20">跨境物流<br /><span className="text-[9px]">¥</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-16">平台成本<br /><span className="text-[9px]">¥</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-14">退货损失<br /><span className="text-[9px]">¥</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-16">毛利<br /><span className="text-[9px]">¥</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-14">利润率<br /><span className="text-[9px]">%</span></th>
                        <th className="border border-gray-200 px-1 py-1.5 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {skus.map((sku, idx) => {
                        const calc = calcRow(sku, common)
                        return (
                          <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                            <td className="border border-gray-200 px-1.5 py-1">
                              <input type="text" value={sku.spec || ''} onChange={(e) => updateSku(idx, 'spec', e.target.value)} placeholder="如500ml"
                                className="w-full text-xs border-0 bg-transparent focus:outline-none text-morandi-text" />
                            </td>
                            <td className="border border-gray-200 px-1 py-1">
                              <input type="number" value={sku.weight || ''} onChange={(e) => updateSku(idx, 'weight', e.target.value)} placeholder="0.5" step="any"
                                className="w-full text-xs border-0 bg-transparent focus:outline-none text-center text-morandi-text" />
                            </td>
                            <td className="border border-gray-200 px-1 py-1">
                              <div className="flex items-center gap-0.5">
                                <input type="number" value={sku.length || ''} onChange={(e) => updateSku(idx, 'length', e.target.value)} placeholder="52" step="any"
                                  className="w-10 text-xs border-0 bg-transparent focus:outline-none text-center text-morandi-text" />
                                <span className="text-gray-300">×</span>
                                <input type="number" value={sku.width || ''} onChange={(e) => updateSku(idx, 'width', e.target.value)} placeholder="45" step="any"
                                  className="w-10 text-xs border-0 bg-transparent focus:outline-none text-center text-morandi-text" />
                                <span className="text-gray-300">×</span>
                                <input type="number" value={sku.height || ''} onChange={(e) => updateSku(idx, 'height', e.target.value)} placeholder="28" step="any"
                                  className="w-10 text-xs border-0 bg-transparent focus:outline-none text-center text-morandi-text" />
                              </div>
                            </td>
                            <td className="border border-gray-200 px-1 py-1">
                              <input type="number" value={sku.listPrice || ''} onChange={(e) => updateSku(idx, 'listPrice', e.target.value)} placeholder="8600" step="any"
                                className="w-full text-xs border-0 bg-transparent focus:outline-none text-center text-morandi-text" />
                            </td>
                            <td className="border border-gray-200 px-1.5 py-1 text-center text-morandi-text">{calc.listPriceRMB || '-'}</td>
                            <td className="border border-gray-200 px-1.5 py-1 text-center text-blue-600 font-medium">{calc.price || '-'}</td>
                            <td className="border border-gray-200 px-1.5 py-1 text-center text-blue-600 font-medium">{calc.priceRMB || '-'}</td>
                            <td className="border border-gray-200 px-1 py-1">
                              <input type="number" value={sku.purchaseCost || ''} onChange={(e) => updateSku(idx, 'purchaseCost', e.target.value)} placeholder="35" step="any"
                                className="w-full text-xs border-0 bg-transparent focus:outline-none text-center text-morandi-text" />
                            </td>
                            <td className="border border-gray-200 px-1 py-1">
                              <input type="number" value={sku.domesticShip || ''} onChange={(e) => updateSku(idx, 'domesticShip', e.target.value)} placeholder="3" step="any"
                                className="w-full text-xs border-0 bg-transparent focus:outline-none text-center text-morandi-text" />
                            </td>
                            <td className="border border-gray-200 px-1 py-1">
                              <input type="number" value={sku.labelFee || ''} onChange={(e) => updateSku(idx, 'labelFee', e.target.value)} placeholder="2" step="any"
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

// ===================== Tab3: 佣金费率表 =====================
function CommissionTab() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-5">
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
              {COMMISSION_TABLE.map((row, i) => (
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
  )
}
