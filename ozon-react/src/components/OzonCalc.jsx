import { useState } from 'react'
import { Calculator, Package, DollarSign, TrendingUp, Info, Table as TableIcon, Save } from 'lucide-react'
import { persistGet, persistSet } from '../utils/persist'
import {
  CHANNEL_GROUPS, ALL_CHANNELS, TARIFF_VERSION,
  calcShipping, getBestShipping, calcRow, calcChannelProfit,
  PRICING_PRODUCTS, PRODUCT_COLORS, COMMISSION_TABLE,
} from '../utils/ozonEngine'
import { useExchangeRate } from '../utils/useExchangeRate'
import { formatRubPerCny } from '../utils/exchangeRate'
import channelsData from '../generated/ozon_channels.js'
import { mergeTrustedPrefill } from '../utils/t6/costScenarioAdapter'
import { isEnteredNumber, missingOzonInputs } from '../utils/platformCosting'
import { Plus, Trash2 } from 'lucide-react'
import Button from './ui/Button'

const SHIPPING_KEY = 'shipping-calc-rfbs-v2'
const PRICING_KEY = 'product-pricing-v2'
const GROUPS_KEY = 'ozon-product-groups-v1'

const TABS = [
  { id: 'single', name: '单规格测算', icon: Calculator },
  { id: 'multi', name: '多规格对比', icon: Package },
  { id: 'commission', name: '佣金费率表', icon: TableIcon },
  { id: 'channels', name: '渠道运价', icon: TableIcon },
]

/**
 * OzonCalc({ projectContext }) — T6-2B1 项目上下文模式：
 * projectContext = { projectId, projectCode, prefill, onSaveScenario } | null
 * 显式状态传入（不读残余 activeProjectId）；prefill 只在挂载时生效一次（key 强制重挂）；
 * 项目模式下编辑不写共享持久化键；[保存此方案到项目] 走 onSaveScenario 冻结场景。
 */
export default function OzonCalc({ projectContext = null }) {
  const [tab, setTab] = useState('single')
  // One subscribed rate is passed to both displayed calculations and saved scenarios.
  const rateInfo = useExchangeRate()

  return (
    <div className="space-y-4">
      {/* 标题区 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 sm:px-5 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between bg-blue-50 border-b border-blue-200">
          <div className="flex items-start gap-2 min-w-0">
            <div className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center bg-blue-100">
              <Calculator className="w-4 h-4 text-blue-700" />
            </div>
            <div>
              <h3 className="text-base font-bold text-blue-700">Ozon 跨境核算面板</h3>
              <p className="text-xs leading-5 text-blue-700">
                OZON rFBS 自发货 · CEL产品资费表 {TARIFF_VERSION} · 汇率 1¥ = {formatRubPerCny(rateInfo.rubPerCny)}₽
                {rateInfo.auto ? `（${rateInfo.source} ${rateInfo.date}自动更新）` : '（配置值）'}
              </p>
            </div>
          </div>
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
      {tab === 'single' && <SingleTab key={projectContext ? `ctx-${projectContext.projectId}` : 'standalone'} projectContext={projectContext} rateInfo={rateInfo} />}
      {tab === 'multi' && <MultiTab key={projectContext ? `ctx-${projectContext.projectId}` : 'standalone'} projectContext={projectContext} rateInfo={rateInfo} />}
      {tab === 'commission' && <CommissionTab />}
      {tab === 'channels' && <ChannelTab />}
    </div>
  )
}

// ===================== Tab1: 单规格测算（原 ShippingCalc） =====================
const SINGLE_DEFAULTS = {
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
}

function SingleTab({ projectContext = null, rateInfo }) {
  // prefill 只在挂载时生效一次（key 按 projectId 强制重挂）；项目模式下不写共享持久化键
  // T6-2B hotfix：base = 既有保存值（或默认值），只有"有值"的 project prefill 覆盖 base——
  // 禁止 '' 把采购/广告等成本假设清成 0（否则会算出虚假高利润基线）
  const [params, setParams] = useState(() => {
    const base = projectContext
      ? Object.fromEntries(Object.keys(SINGLE_DEFAULTS).map((key) => [key, '']))
      : (persistGet(SHIPPING_KEY) || { ...SINGLE_DEFAULTS })
    return projectContext?.prefill ? mergeTrustedPrefill(base, projectContext.prefill) : base
  })
  // T6-2B hotfix：项目模式保存前必须人工确认成本与费率假设
  const [costConfirmed, setCostConfirmed] = useState(false)
  const [appliedNotice, setAppliedNotice] = useState(null)

  const supplyRef = projectContext?.supplyCostReference || { status: 'NONE' }

  const handleApplySupplyQuote = () => {
    if (supplyRef.status !== 'APPLICABLE_CNY' || typeof supplyRef.purchaseCostCny !== 'number') return
    setParams((prev) => ({
      ...prev,
      purchaseCost: supplyRef.purchaseCostCny,
    }))
    setCostConfirmed(false)
    setAppliedNotice(`已采用正式报价 ¥${supplyRef.purchaseCostCny} 作为当前采购成本草稿。`)
  }

  const updateParam = (key, val) => {
    const newData = { ...params, [key]: val }
    setParams(newData)
    setCostConfirmed(false)
    if (key === 'purchaseCost') {
      setAppliedNotice(null)
    }
    if (!projectContext) persistSet(SHIPPING_KEY, newData)
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
  const effectiveRate = Number(rateInfo?.rubPerCny)
  const missingInputs = missingOzonInputs(params)
  const validRate = Number.isFinite(effectiveRate) && effectiveRate > 0
  const priceRMB = validRate ? Math.round(price / effectiveRate * 100) / 100 : null
  const calculationParams = { ...params, rubPerCny: effectiveRate }

  const results = CHANNEL_GROUPS.map((cat) => ({
    ...cat,
    channels: cat.channels.map((ch) => {
      const calc = validRate ? calcChannelProfit(ch, price, weight, length, width, height, calculationParams) : null
      return { ...ch, result: calc?.result || null, profit: calc?.profit ?? null, profitRate: calc?.profitRate ?? null, costBreakdown: calc?.costBreakdown || null }
    }),
  }))

  const bestChannel = results.flatMap((c) => c.channels).filter((ch) => ch.result).sort((a, b) => b.profit - a.profit)[0]

  // T6-2B1：项目模式下把当前方案冻结为不可变成本场景（引擎输出 verbatim）
  const saveScenario = () => {
    if (!projectContext?.onSaveScenario || !bestChannel || !costConfirmed || missingInputs.length || !validRate) return
    const engineCh = ALL_CHANNELS.find((c) => c.id === bestChannel.id)
    const out = calcChannelProfit(engineCh, price, weight, length, width, height, calculationParams)
    projectContext.onSaveScenario({
      inputPayload: { price, weight, length, width, height, purchaseCost, domesticShipping, labelingFee, commission, adRate, paymentFee, agencyFee, returnLoss },
      selectedChannelId: bestChannel.id,
      outputPayload: out,
      exchangeRateInfo: rateInfo,
    })
  }

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
        {projectContext && (
          <div className="mb-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="text-xs text-blue-700">
                正在为项目 <b>{projectContext.projectCode}</b> 核算：预填候选真实数据（售价/重量/尺寸/rFBS 佣金），
                成本与费率字段请填写真实值后再保存为不可变成本场景。
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-blue-800">
                  <input type="checkbox" checked={costConfirmed} onChange={(e) => setCostConfirmed(e.target.checked)} className="rounded" />
                  已确认采购成本及平台费用假设
                </label>
                <Button variant="primary" size="sm" disabled={!bestChannel || !costConfirmed || missingInputs.length > 0 || !validRate} onClick={saveScenario}>
                  <Save className="h-3.5 w-3.5" /> 保存此方案到项目
                </Button>
              </div>
            </div>
            {missingInputs.length > 0 && <p className="text-xs text-amber-700">待补齐：{missingInputs.join('、')}。当前结果仅供试算。</p>}
            {supplyRef && supplyRef.status !== 'NONE' && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                {supplyRef.status === 'APPLICABLE_CNY' && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-slate-800">
                        <span className="font-semibold text-slate-700">正式供应报价</span>
                        <span>{supplyRef.supplierName} · v{supplyRef.quoteVersion} · <b className="text-emerald-700">¥{supplyRef.rawAmount}</b></span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        该值来自正式供应报价，仅作为采购单价草稿；国内段运费、贴标费及税费等仍需单独确认。
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleApplySupplyQuote}
                    >
                      采用正式供应报价
                    </Button>
                  </div>
                )}
                {supplyRef.status === 'BLOCKED_CURRENCY' && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-slate-800">
                        <span className="font-semibold text-slate-700">正式供应报价</span>
                        <span>{supplyRef.supplierName} · v{supplyRef.quoteVersion} · <b className="text-slate-800">{supplyRef.rawAmount} {supplyRef.currency}</b></span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-amber-700">
                        非人民币正式报价暂不支持一键采用，请核实汇率后手工填写采购成本。
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled
                    >
                      采用正式供应报价
                    </Button>
                  </div>
                )}
                {supplyRef.status === 'INVALID_REFERENCE' && (
                  <div className="text-[11px] text-amber-700">
                    正式供应方案引用异常，采购成本请暂时手工填写。
                  </div>
                )}
                {appliedNotice && (
                  <div className="mt-1.5 text-[11px] font-medium text-emerald-700">
                    ✓ {appliedNotice}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
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
            <span className="text-sm text-morandi-text-light">汇率: 1¥ = {formatRubPerCny(effectiveRate)}₽ {validRate ? `(1₽ ≈ ¥${(1 / effectiveRate).toFixed(4)})` : ''}</span>
          </div>
        </div>

        {bestChannel && bestChannel.costBreakdown && (
          <div className="mb-5 p-4 rounded-lg bg-green-50 border border-green-200">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-green-700">{missingInputs.length ? '试算最优渠道' : '最优渠道'}</span>
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
      </div>
    </div>
  )
}

function MultiTab({ projectContext = null, rateInfo }) {
  const pricingKey = projectContext ? `${PRICING_KEY}-project-${projectContext.projectId}` : PRICING_KEY
  const groupsKey = projectContext ? `${GROUPS_KEY}-project-${projectContext.projectId}` : GROUPS_KEY
  const [pricingData, setPricingData] = useState(() => persistGet(pricingKey) || {})
  const [customGroups, setCustomGroups] = useState(() => persistGet(groupsKey) || [])
  const [newGroupName, setNewGroupName] = useState('')
  const [costConfirmed, setCostConfirmed] = useState(false)
  const rate = Number(rateInfo?.rubPerCny)
  const validRate = isEnteredNumber(rate, { positive: true })
  const products = [...PRICING_PRODUCTS, ...customGroups]
  const savePricing = (data) => {
    setPricingData(data)
    setCostConfirmed(false)
    persistSet(pricingKey, data)
  }

  const addGroup = () => {
    const name = newGroupName.trim()
    if (!name) return
    const next = [...customGroups, { id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, color: 'teal' }]
    setCustomGroups(next)
    persistSet(groupsKey, next)
    setNewGroupName('')
  }

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h2 className="text-sm font-bold text-morandi-text">多规格定价对比</h2>
        <p className="text-xs text-morandi-text-light mt-0.5">按产品规格对比成本、定价与利润；rFBS 渠道按最低运费匹配。汇率 1¥ = {formatRubPerCny(rate)}₽。</p>
        {projectContext && <p className="mt-1 text-xs text-blue-700">项目 {projectContext.projectCode} 的产品组单独保存，成本假设需逐项确认。</p>}
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <input aria-label="新产品组名称" value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addGroup() }} placeholder="新产品组名称" className="text-sm border border-gray-200 rounded px-2 py-1.5 bg-white" />
          <button type="button" onClick={addGroup} disabled={!newGroupName.trim()} className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded bg-blue-50 text-blue-700 disabled:opacity-40"><Plus className="w-3.5 h-3.5" />添加产品组</button>
          {projectContext && <label className="inline-flex items-center gap-1.5 text-xs text-gray-700"><input type="checkbox" checked={costConfirmed} onChange={(event) => setCostConfirmed(event.target.checked)} />已核对本组价格与成本假设</label>}
        </div>
      </div>

      <div className="space-y-4">
        {products.map((product) => {
          const pc = PRODUCT_COLORS[product.color]
          const pd = pricingData[product.id] || {}
          const skus = pd.skus || [{}]
          const defaultValue = (key, fallback) => pd[key] !== undefined && pd[key] !== '' ? Number(pd[key]) : (projectContext ? '' : fallback)
          const commission = defaultValue('commission', 12)
          const adRate = defaultValue('adRate', 10)
          const paymentFee = defaultValue('paymentFee', 1)
          const agencyFee = defaultValue('agencyFee', 2)
          const returnLoss = defaultValue('returnLoss', 4)
          const discountRate = defaultValue('discountRate', 0.6)

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

          const common = { commission, adRate, paymentFee, agencyFee, returnLoss, discountRate: discountRate === '' ? null : discountRate, rubPerCny: rate }

          const saveSkuScenario = (sku, calc) => {
            if (!projectContext?.onSaveScenario || !costConfirmed || !calc.bestShip || !validRate) return
            const inputPayload = {
              productName: `${product.name} ${sku.spec || ''}`.trim(),
              listPrice: Number(sku.listPrice), discountRate: Number(discountRate),
              price: calc.price, weight: Number(sku.weight), length: Number(sku.length),
              width: Number(sku.width), height: Number(sku.height),
              purchaseCost: Number(sku.purchaseCost), domesticShipping: Number(sku.domesticShip),
              labelingFee: Number(sku.labelFee), commission: Number(commission), adRate: Number(adRate),
              paymentFee: Number(paymentFee), agencyFee: Number(agencyFee), returnLoss: Number(returnLoss),
            }
            if (missingOzonInputs(inputPayload).length || !isEnteredNumber(discountRate, { positive: true, max: 1 })) return
            const outputPayload = calcChannelProfit(calc.bestShip.channel, calc.price, inputPayload.weight, inputPayload.length, inputPayload.width, inputPayload.height, { ...inputPayload, rubPerCny: rate })
            projectContext.onSaveScenario({ inputPayload, selectedChannelId: calc.bestShip.channel.id, outputPayload, exchangeRateInfo: rateInfo })
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
                    ['折扣系数', 'discountRate', '折', discountRate === '' ? '' : Math.round(discountRate * 10 * 10) / 10],
                  ].map(([label, key, unit, val]) => (
                    <div key={key} className="flex items-center gap-1">
                      <span className="text-[10px] text-morandi-text-light">{label}</span>
                      <input type="number" step={key === 'discountRate' ? '0.1' : '1'} value={val} onChange={(e) => {
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
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-14">重量<br /><span className="text-[9px]">KG</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-28">长×宽×高<br /><span className="text-[9px]">CM</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-16">上架价格<br /><span className="text-[9px]">₽</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-16">上架价格<br /><span className="text-[9px]">¥</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-16">折后成交价<br /><span className="text-[9px]">₽({Math.round(discountRate * 100)}%)</span></th>
                        <th className="border border-gray-200 px-2 py-1.5 text-center text-morandi-text-light font-semibold w-16">折后成交价<br /><span className="text-[9px]">¥</span></th>
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
                        const rowInputs = {
                          price: calc.price, weight: sku.weight, length: sku.length, width: sku.width,
                          height: sku.height, purchaseCost: sku.purchaseCost, domesticShipping: sku.domesticShip,
                          labelingFee: sku.labelFee, commission, adRate, paymentFee, agencyFee, returnLoss,
                        }
                        const rowReady = validRate && isEnteredNumber(discountRate, { positive: true, max: 1 }) && missingOzonInputs(rowInputs).length === 0 && !!calc.bestShip
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
                            <td className={`border border-gray-200 px-1.5 py-1 text-center font-bold ${(!projectContext || rowReady) && calc.profit !== null ? (calc.profit >= 0 ? 'text-green-600' : 'text-red-500') : 'text-gray-300'}`}>
                              {(!projectContext || rowReady) && calc.profit !== null ? calc.profit : '-'}
                            </td>
                            <td className={`border border-gray-200 px-1.5 py-1 text-center font-bold ${(!projectContext || rowReady) && calc.profitRate !== null ? (calc.profitRate >= 0 ? 'text-green-600' : 'text-red-500') : 'text-gray-300'}`}>
                              {(!projectContext || rowReady) && calc.profitRate !== null ? calc.profitRate : '-'}
                            </td>
                            <td className="border border-gray-200 px-1 py-1 text-center">
                              {projectContext && <button type="button" onClick={() => saveSkuScenario(sku, calc)} disabled={!rowReady || !costConfirmed} title={rowReady ? '保存该规格为项目成本场景' : '请补齐该规格和公共费率'} className="p-0.5 text-blue-600 disabled:text-gray-300"><Save className="w-3.5 h-3.5" /></button>}
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

function ChannelTab() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-gray-800">rFBS 渠道参考</h4>
        <p className="mt-1 text-xs text-gray-500">只读配置 · {channelsData.source} · 来源日期 {channelsData.source_date}。费率可能变化，发货前请复核渠道报价。</p>
      </div>
      {CHANNEL_GROUPS.map((group) => (
        <section key={group.category}>
          <h5 className="mb-2 text-xs font-semibold text-gray-700">{group.categoryZh}</h5>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-xs">
              <thead><tr className="border-b border-gray-200 text-left text-gray-500"><th className="py-2 pr-3">渠道</th><th className="py-2 pr-3">基础费</th><th className="py-2 pr-3">重量费</th><th className="py-2 pr-3">限重</th><th className="py-2">计抛</th></tr></thead>
              <tbody>{group.channels.map((channel) => <tr key={channel.id} className="border-b border-gray-100 text-gray-700"><td className="py-2 pr-3">{channel.name}</td><td className="py-2 pr-3">¥{channel.base}</td><td className="py-2 pr-3">¥{channel.rate}/{channel.rateUnit === 'per100g' ? '100g' : 'kg'}</td><td className="py-2 pr-3">{channel.weightMax} kg</td><td className="py-2">{channel.volumetric ? `÷${channel.volDiv}` : '无'}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      ))}
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
