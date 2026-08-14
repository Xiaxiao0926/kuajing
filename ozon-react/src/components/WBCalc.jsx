import { useState, useMemo, useEffect } from 'react'
import {
  Calculator, Package, DollarSign, TrendingUp, Info, Truck, Route, Settings,
  ClipboardList, Search, AlertTriangle, CheckCircle2, XCircle, Download, Upload, Plus, Trash2,
} from 'lucide-react'
import { persistGet, persistSet } from '../utils/persist'
import {
  DEFAULT_SETTINGS, DEFAULT_TARIFFS, CSV_COLUMNS,
  REVERSE_EVENT_TYPE, REVERSE_EVENT_LABEL, DEFAULT_REVERSE_MULTIPLIER, NEEDS_BILL_CONFIRMATION,
} from '../utils/wbConfig'
import {
  toNum, round2, roundUpWeight, selectTariffVersion, selectTariffTier,
  validateParcel, calculateParcelLogistics, calculateOrderLogistics,
  calculatePlatformSettlement, calculateOperatingProfit, compareRoutes, calculateReturnLoss,
  calculateReverseCompensation, calculateTotalLogisticsCost, calculateOperatingProfitV2,
  inferReverseEventType, getOrderLabels,
} from '../utils/wbEngine'

const SETTINGS_KEY = 'wb-settings-v1'
const TARIFFS_KEY = 'wb-tariffs-v1'
const SKUS_KEY = 'wb-skus-v1'
const ORDERS_KEY = 'wb-orders-v1'

const fmtCny = (v) => (v === null || v === undefined ? '—' : `¥${Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const fmtRub = (v) => (v === null || v === undefined ? '—' : `₽${Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const fmtPct = (v) => (v === null || v === undefined ? '—' : `${Number(v).toFixed(1)}%`)

// 加载WB佣金数据（96类目 / 7424条商品）
let _commissionCache = null
async function loadCommissionData() {
  if (_commissionCache) return _commissionCache
  try {
    const resp = await fetch('/data/wb_commission.json?t=' + Date.now())
    if (!resp.ok) return null
    const data = await resp.json()
    _commissionCache = data
    return data
  } catch (e) {
    console.warn('加载WB佣金数据失败:', e.message)
    return null
  }
}

/**
 * 商品类目选择器
 * - 先选类目（dropdown）
 * - 再选商品（datalist 或 dropdown，根据类目过滤）
 * - 选中商品后自动回调佣金率
 */
function CategoryProductPicker({ value, onChange, compact = false }) {
  const [data, setData] = useState(null)
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    loadCommissionData().then(setData)
  }, [])

  const valueCategory = value?.category || ''
  const valueProduct = value?.product || ''
  const valueCommission = value?.commission ?? null

  // 当前类目下的商品列表
  const productsInCategory = useMemo(() => {
    if (!data || !valueCategory) return []
    return data.items.filter((it) => it.category === valueCategory)
  }, [data, valueCategory])

  // 关键词搜索结果（跨类目）
  const searchResults = useMemo(() => {
    if (!data || !keyword.trim()) return []
    const kw = keyword.trim().toLowerCase()
    return data.items.filter((it) =>
      it.product.toLowerCase().includes(kw) || it.category.toLowerCase().includes(kw)
    ).slice(0, 30)
  }, [data, keyword])

  const handleCategoryChange = (cat) => {
    onChange({ category: cat, product: '', commission: null })
  }
  const handleProductChange = (prodName) => {
    if (!valueCategory) {
      // 未选类目，尝试从搜索匹配
      const matched = (data?.items || []).find((it) => it.product === prodName)
      if (matched) {
        onChange({ category: matched.category, product: matched.product, commission: matched.commission })
      } else {
        onChange({ category: '', product: prodName, commission: null })
      }
      return
    }
    const matched = productsInCategory.find((it) => it.product === prodName)
    if (matched) {
      onChange({ category: valueCategory, product: matched.product, commission: matched.commission })
    } else {
      onChange({ category: valueCategory, product: prodName, commission: null })
    }
  }
  const handlePickSearch = (item) => {
    onChange({ category: item.category, product: item.product, commission: item.commission })
    setKeyword('')
  }

  if (!data) {
    return <div className="text-xs text-gray-400">加载WB佣金数据中...</div>
  }

  return (
    <div className={`space-y-2 ${compact ? '' : 'p-3 bg-gray-50 rounded-lg border border-gray-200'}`}>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">WB类目</label>
          <select
            value={valueCategory}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
          >
            <option value="">— 选择类目 —</option>
            {data.categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">
            商品名称
            {valueCommission !== null && (
              <span className="ml-2 text-orange-600 font-semibold">佣金 {valueCommission}%</span>
            )}
          </label>
          <input
            type="text"
            list="wb-product-list"
            value={valueProduct}
            onChange={(e) => handleProductChange(e.target.value)}
            placeholder={valueCategory ? `从 ${productsInCategory.length} 个商品中选择或输入` : '输入关键词搜索'}
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
          />
          <datalist id="wb-product-list">
            {(valueCategory ? productsInCategory : searchResults).map((it, i) => (
              <option key={i} value={it.product}>{it.category} · {it.commission}%</option>
            ))}
          </datalist>
        </div>
      </div>
      {!valueCategory && (
        <div className="relative">
          <Search className="w-3 h-3 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="跨类目搜索商品（如：玩具、化妆品、电器）"
            className="w-full text-sm border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 bg-white"
          />
          {keyword.trim() && searchResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {searchResults.slice(0, 20).map((it, i) => (
                <button
                  key={i}
                  onClick={() => handlePickSearch(it)}
                  className="w-full text-left px-3 py-1.5 hover:bg-orange-50 border-b border-gray-100 last:border-0"
                >
                  <span className="text-xs text-gray-700">{it.product}</span>
                  <span className="text-[10px] text-gray-400 ml-2">{it.category}</span>
                  <span className="text-[10px] text-orange-600 ml-2 font-semibold">{it.commission}%</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {valueCategory && productsInCategory.length > 0 && (
        <p className="text-[10px] text-gray-400">
          当前类目「{valueCategory}」共 {productsInCategory.length} 个商品
          {productsInCategory[0] && (
            <>，佣金范围 {Math.min(...productsInCategory.map((p) => p.commission))}%-{Math.max(...productsInCategory.map((p) => p.commission))}%</>
          )}
        </p>
      )}
    </div>
  )
}

const TABS = [
  { id: 'overview', name: '经营总览', icon: TrendingUp },
  { id: 'calculator', name: '单订单核算器', icon: Calculator },
  { id: 'sku', name: 'SKU利润表', icon: Package },
  { id: 'compare', name: '线路对比', icon: Route },
  { id: 'tariff', name: '费率管理', icon: Settings },
  { id: 'orders', name: '订单与对账', icon: ClipboardList },
]

export default function WBCalc() {
  const [tab, setTab] = useState('overview')
  // 汇率迁移：强制将旧值更新为当前默认值（1¥=12₽，2026-08-11生效）
  const [settings, setSettings] = useState(() => {
    const stored = persistGet(SETTINGS_KEY)
    if (!stored) return DEFAULT_SETTINGS
    // 强制覆盖汇率为最新默认值（用户全局指令：整个跨境面板统一改汇率）
    const migrated = {
      ...stored,
      rubPerCny: DEFAULT_SETTINGS.rubPerCny,
      exchangeRateEffectiveFrom: DEFAULT_SETTINGS.exchangeRateEffectiveFrom,
    }
    persistSet(SETTINGS_KEY, migrated)
    return migrated
  })
  const [tariffs, setTariffs] = useState(() => persistGet(TARIFFS_KEY) || DEFAULT_TARIFFS)
  const [skus, setSkus] = useState(() => persistGet(SKUS_KEY) || [])
  const [orders, setOrders] = useState(() => persistGet(ORDERS_KEY) || [])

  const saveSettings = (s) => { setSettings(s); persistSet(SETTINGS_KEY, s) }
  const saveTariffs = (t) => { setTariffs(t); persistSet(TARIFFS_KEY, t) }
  const saveSkus = (s) => { setSkus(s); persistSet(SKUS_KEY, s) }
  const saveOrders = (o) => { setOrders(o); persistSet(ORDERS_KEY, o) }

  const activeRoutes = useMemo(() => tariffs.filter((t) => t.active !== false), [tariffs])

  return (
    <div className="space-y-4">
      {/* 标题区 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 flex items-center justify-between bg-orange-50 border-b border-orange-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-100">
              <Truck className="w-4 h-4 text-orange-700" />
            </div>
            <div>
              <h3 className="text-base font-bold text-orange-700">WB跨境利润与物流费用核算</h3>
              <p className="text-[10px] text-orange-600">DPX深圳标准 · 费率生效 2026-02-09 · 按实际重量每100g向上取整</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="px-2 py-1 rounded bg-white border border-orange-200 text-orange-700">汇率 1¥ = {settings.rubPerCny}₽</span>
            <span className="px-2 py-1 rounded bg-white border border-orange-200 text-orange-700">利润率阈值 {settings.profitMarginThreshold}%</span>
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
                  active ? 'border-orange-500 text-orange-700 bg-orange-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
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
      {tab === 'overview' && <OverviewTab orders={orders} settings={settings} />}
      {tab === 'calculator' && <CalculatorTab settings={settings} tariffs={activeRoutes} skus={skus} onSaveOrder={(o) => saveOrders([...orders, o])} onSaveSkus={saveSkus} />}
      {tab === 'sku' && <SkuTab skus={skus} tariffs={activeRoutes} settings={settings} onSaveSkus={saveSkus} />}
      {tab === 'compare' && <CompareTab tariffs={activeRoutes} />}
      {tab === 'tariff' && <TariffTab tariffs={tariffs} onSaveTariffs={saveTariffs} />}
      {tab === 'orders' && <OrdersTab orders={orders} tariffs={activeRoutes} settings={settings} onSaveOrders={saveOrders} />}
    </div>
  )
}

// ===================== 总览 =====================
function OverviewTab({ orders, settings }) {
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
            <p className="text-[10px] text-gray-500 mb-0.5">{m.label}</p>
            <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
            {m.sub && <p className="text-[10px] text-gray-400">{m.sub}</p>}
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
                  <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-semibold text-gray-700">{count}</span>
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
                  <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-semibold text-gray-700">{count}</span>
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

// ===================== 单订单核算器 =====================
function CalculatorTab({ settings, tariffs, skus, onSaveOrder, onSaveSkus }) {
  const [form, setForm] = useState(() => ({
    productName: '', actualWeightG: 100, lengthCm: 20, widthCm: 15, heightCm: 10,
    purchaseCost: 0, packagingCost: 0, quantity: 1, parcelCount: 1,
    routeId: tariffs[0]?.routeId || '', sellerRevenueRub: 1000, commissionRate: 25,
    chinaInbound: 0, promotionCostRub: 0, status: '已签收',
    useSku: false, selectedSkuIdx: 0,
    category: '', commissionAutoMatched: false,
    // V2 异常订单字段
    reverseEventType: 'none',
    reverseCompensationMultiplier: '',
    actualForwardLogisticsCny: '',
    actualReverseCompensationCny: '',
    otherReverseCostCny: 0,
    forwardFeeApplied: true,
    inventoryRecoveryRate: 0,
  }))
  const [showSteps, setShowSteps] = useState(false)

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const selectedSku = form.useSku && skus.length > 0 ? skus[form.selectedSkuIdx] : null
  const tariff = tariffs.find((t) => t.routeId === form.routeId)

  // 计算
  const perParcelWeight = form.actualWeightG * form.quantity / form.parcelCount
  const parcels = Array.from({ length: form.parcelCount }, () => ({
    actualWeightG: perParcelWeight, lengthCm: form.lengthCm, widthCm: form.widthCm, heightCm: form.heightCm,
  }))
  const logisticsCalc = tariff ? calculateOrderLogistics(parcels, tariff) : null
  const logisticsCny = logisticsCalc ? logisticsCalc.totalFeeCny : 0

  const orderData = {
    sellerRevenueBaseRub: form.sellerRevenueRub,
    commissionBaseRub: form.sellerRevenueRub,
    commissionRate: form.commissionRate,
    acquiringFeeRub: 0,
    promotionCostRub: form.promotionCostRub,
    platformOtherDeductionRub: 0,
    otherOperatingCostCny: 0,
    taxCostCny: 0,
  }
  const skuData = {
    purchaseCostCny: form.purchaseCost * form.quantity,
    packagingCostCny: form.packagingCost * form.quantity,
    chinaInboundCostCny: form.chinaInbound * form.quantity,
    certificationAllocationCny: 0,
  }
  const profitCalc = calculateOperatingProfit(orderData, skuData, settings, logisticsCny)

  // V2: 反向配送赔偿计算
  const reverseOrderData = {
    ...orderData,
    reverseEventType: form.reverseEventType,
    reverseCompensationMultiplier: form.reverseCompensationMultiplier,
    estimatedForwardLogisticsCny: logisticsCny, // 正向CSG
    actualForwardLogisticsCny: form.actualForwardLogisticsCny,
    actualReverseCompensationCny: form.actualReverseCompensationCny,
    otherReverseCostCny: form.otherReverseCostCny,
    forwardFeeApplied: form.forwardFeeApplied,
    inventoryRecoveryRate: form.inventoryRecoveryRate,
    parcels: Array.from({ length: form.parcelCount }, () => ({
      actualWeightG: perParcelWeight,
    })),
  }
  const reverseCalcResult = tariff ? calculateTotalLogisticsCost(reverseOrderData, tariff) : null

  // 盈亏平衡
  const rubPerCny = toNum(settings.rubPerCny)
  const commissionPct = form.commissionRate / 100
  const fixedCost = form.purchaseCost * form.quantity + form.packagingCost * form.quantity + form.chinaInbound * form.quantity + logisticsCny
  const bePriceRub = commissionPct < 1 && rubPerCny > 0 ? (fixedCost * rubPerCny) / (1 - commissionPct) : null

  const inputField = (label, key, unit, opts = {}) => (
    <div>
      <label className="text-xs font-medium text-gray-500 mb-1 block">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={form[key]}
          onChange={(e) => update(key, e.target.value)}
          step="any"
          className="w-full text-sm text-morandi-text border border-gray-200 rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:ring-1 focus:ring-orange-200 focus:border-orange-300 bg-white"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">{unit}</span>
      </div>
    </div>
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 输入 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
        <h4 className="text-sm font-semibold text-morandi-text">输入参数</h4>

        {skus.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={form.useSku} onChange={(e) => update('useSku', e.target.checked)} className="rounded" />
            从SKU库选择
          </label>
        )}
        {form.useSku && skus.length > 0 && (
          <select
            value={form.selectedSkuIdx}
            onChange={(e) => {
              const idx = Number(e.target.value)
              update('selectedSkuIdx', idx)
              const s = skus[idx]
              if (s) setForm((f) => ({
                ...f, selectedSkuIdx: idx, productName: s.productNameCn || '',
                category: s.category || '', commissionAutoMatched: false,
                actualWeightG: s.actualUnitWeightG || 100, lengthCm: s.productLengthCm || 20,
                widthCm: s.productWidthCm || 15, heightCm: s.productHeightCm || 10,
                purchaseCost: s.purchaseCostCny || 0, packagingCost: s.packagingCostCny || 0,
                chinaInbound: s.chinaInboundCostCny || 0, routeId: s.defaultRouteId || f.routeId,
                sellerRevenueRub: s.targetSalePriceRub || 1000, commissionRate: s.commissionRate || 25,
              }))
            }}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
          >
            {skus.map((s, i) => <option key={i} value={i}>{s.skuId} - {s.productNameCn}</option>)}
          </select>
        )}

        <div className="grid grid-cols-2 gap-3">
          {inputField('含包装重量', 'actualWeightG', 'g')}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">佣金率(%)</label>
            <div className="relative">
              <input
                type="number"
                value={form.commissionRate}
                onChange={(e) => update('commissionRate', e.target.value)}
                step="any"
                className={`w-full text-sm border rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:ring-1 focus:ring-orange-200 focus:border-orange-300 bg-white ${
                  form.commissionAutoMatched ? 'border-orange-300 bg-orange-50/50' : 'border-gray-200'
                }`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">%</span>
            </div>
            {form.commissionAutoMatched && (
              <p className="text-[10px] text-orange-600 mt-0.5">✓ 已从佣金表自动匹配</p>
            )}
          </div>
        </div>

        {/* 类目+商品选择器 */}
        <CategoryProductPicker
          value={{ category: form.category || '', product: form.productName || '', commission: form.commissionAutoMatched ? toNum(form.commissionRate) : null }}
          onChange={(v) => {
            setForm((f) => ({
              ...f,
              category: v.category,
              productName: v.product,
              commissionRate: v.commission !== null ? v.commission : f.commissionRate,
              commissionAutoMatched: v.commission !== null,
            }))
          }}
          compact
        />

        <div className="grid grid-cols-3 gap-3">
          {inputField('长', 'lengthCm', 'cm')}
          {inputField('宽', 'widthCm', 'cm')}
          {inputField('高', 'heightCm', 'cm')}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {inputField('数量', 'quantity', '件')}
          {inputField('包裹数(标签数)', 'parcelCount', '个')}
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">物流线路</label>
          <select value={form.routeId} onChange={(e) => update('routeId', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
            {tariffs.map((t) => <option key={t.routeId} value={t.routeId}>{t.routeName} ({t.etaMinDays}-{t.etaMaxDays}天)</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {inputField('卖家收入基数', 'sellerRevenueRub', '₽')}
          {inputField('促销费', 'promotionCostRub', '₽')}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {inputField('采购成本', 'purchaseCost', '¥')}
          {inputField('包装成本', 'packagingCost', '¥')}
          {inputField('国内送仓费', 'chinaInbound', '¥')}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">订单状态</label>
          <select value={form.status} onChange={(e) => {
            const newStatus = e.target.value
            // 根据订单状态自动推断反向事件类型
            const statusToEvent = {
              '已签收': 'none', '发货前取消': 'cancelled_before_handover',
              '买家拒收': 'refused_or_unclaimed', '超期未领取': 'refused_or_unclaimed',
              '签收后退货': 'buyer_returned', '丢失/破损': 'manual',
            }
            const inferredEvent = statusToEvent[newStatus] || 'none'
            setForm((f) => ({
              ...f, status: newStatus,
              reverseEventType: inferredEvent,
              reverseCompensationMultiplier: '',
              // 交仓前取消默认无正向费
              forwardFeeApplied: inferredEvent !== 'cancelled_before_handover',
            }))
          }}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
            {['待发货', '已交DPX', '运输中', '已签收', '买家拒收', '超期未领取', '签收后退货', '发货前取消', '丢失/破损', '已赔付', '其他异常'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* 异常订单配置（仅当反向事件类型不为none时显示） */}
      {form.reverseEventType !== 'none' && (
        <ReverseOrderForm form={form} update={update} tariff={tariff} />
      )}

      {/* 结果 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
        <h4 className="text-sm font-semibold text-morandi-text">核算结果</h4>

        <div className="grid grid-cols-3 gap-2">
          <MetricCard label="计费重量" value={logisticsCalc?.parcels[0]?.billableWeightKg ? `${logisticsCalc.parcels[0].billableWeightKg}kg` : '—'} />
          <MetricCard label="包裹数" value={form.parcelCount} />
          <MetricCard label="物流费" value={fmtCny(logisticsCny)} color="text-purple-700" />
          <MetricCard label="销售收入" value={fmtCny(profitCalc.salesRevenueCny)} color="text-green-700" />
          <MetricCard label="平台净结算" value={fmtCny(profitCalc.platformNetSettlementCny)} color="text-blue-700" />
          <MetricCard label="经营利润" value={fmtCny(profitCalc.operatingProfitCny)} color={profitCalc.operatingProfitCny >= 0 ? 'text-emerald-700' : 'text-red-600'} />
          <MetricCard label="利润率" value={fmtPct(profitCalc.profitMargin)} />
          <MetricCard label="物流费率" value={fmtPct(profitCalc.logisticsRatio)} />
          <MetricCard label="成本ROI" value={fmtPct(profitCalc.costRoi)} />
        </div>

        {/* 公式展示 */}
        <FormulaDisplay
          form={form}
          settings={settings}
          tariff={tariff}
          logisticsCalc={logisticsCalc}
          logisticsCny={logisticsCny}
          profitCalc={profitCalc}
          reverseCalcResult={reverseCalcResult}
        />

        {/* 异常订单费用模块 */}
        {reverseCalcResult && reverseCalcResult.eventType !== 'none' && (
          <ReverseOrderResult result={reverseCalcResult} />
        )}

        {/* 预警 */}
        {profitCalc.profitMargin !== null && profitCalc.profitMargin < settings.profitMarginThreshold && (
          <div className="rounded-lg bg-orange-50 border border-orange-200 p-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-600" />
            <span className="text-xs text-orange-700">利润率 {fmtPct(profitCalc.profitMargin)} 低于阈值 {settings.profitMarginThreshold}%</span>
          </div>
        )}
        {profitCalc.operatingProfitCny < 0 && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-2 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-600" />
            <span className="text-xs text-red-700">负毛利！</span>
          </div>
        )}
        {/* 重量跳档提醒 */}
        {logisticsCalc?.parcels.map((p, i) => p.validation?.messages.filter((m) => m.includes('291-300') || m.includes('91-100') || m.includes('191-200')).map((msg, j) => (
          <div key={`${i}-${j}`} className="rounded-lg bg-blue-50 border border-blue-200 p-2 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-blue-700">{msg}</span>
          </div>
        )))}

        {/* 盈亏平衡 */}
        {bePriceRub !== null && (
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
            <p className="text-xs text-gray-500 mb-1">💡 盈亏平衡分析</p>
            <p className="text-sm text-gray-700">盈亏平衡售价: <span className="font-bold">{fmtRub(bePriceRub)}</span></p>
            {form.sellerRevenueRub < bePriceRub ? (
              <p className="text-xs text-red-600 mt-1">当前售价低于平衡点，差额 {fmtRub(bePriceRub - form.sellerRevenueRub)}</p>
            ) : (
              <p className="text-xs text-emerald-700 mt-1">当前售价高于平衡点，安全边际 {fmtRub(form.sellerRevenueRub - bePriceRub)}</p>
            )}
          </div>
        )}

        {/* 计算明细 */}
        <button onClick={() => setShowSteps(!showSteps)} className="text-xs text-orange-600 hover:text-orange-700">
          {showSteps ? '收起' : '展开'}计算明细
        </button>
        {showSteps && (
          <div className="bg-gray-50 rounded-lg p-3 space-y-1 max-h-64 overflow-y-auto">
            <p className="text-xs font-semibold text-gray-600">物流计算</p>
            {logisticsCalc?.parcels.map((p, i) => (
              <div key={i} className="space-y-0.5">
                <p className="text-[11px] font-semibold text-gray-600">包裹 #{p.parcelIndex}</p>
                {p.steps.map((s, j) => <p key={j} className="text-[11px] text-gray-500 pl-3">{s}</p>)}
              </div>
            ))}
            <p className="text-xs font-semibold text-gray-600 mt-2">利润计算</p>
            {profitCalc.steps.map((s, i) => <p key={i} className="text-[11px] text-gray-500 pl-3">{s}</p>)}
          </div>
        )}

        {/* 保存 */}
        <button
          onClick={() => {
            if (!form.productName) { alert('请填写商品名称'); return }
            const skuId = `SKU-${Date.now()}`
            const newSku = {
              skuId,
              productNameCn: form.productName,
              category: form.category || '',
              actualUnitWeightG: toNum(form.actualWeightG) * toNum(form.quantity),
              purchaseCostCny: toNum(form.purchaseCost) * toNum(form.quantity),
              packagingCostCny: toNum(form.packagingCost) * toNum(form.quantity),
              chinaInboundCostCny: toNum(form.chinaInbound) * toNum(form.quantity),
              targetSalePriceRub: toNum(form.sellerRevenueRub),
              commissionRate: toNum(form.commissionRate),
              adCostRate: toNum(form.promotionCostRub) > 0 && toNum(form.sellerRevenueRub) > 0
                ? Math.round((toNum(form.promotionCostRub) / toNum(form.sellerRevenueRub)) * 1000) / 10
                : 0,
              commissionAutoMatched: !!form.commissionAutoMatched,
              productLengthCm: toNum(form.lengthCm),
              productWidthCm: toNum(form.widthCm),
              productHeightCm: toNum(form.heightCm),
              defaultRouteId: form.routeId,
              active: true,
              createdAt: new Date().toISOString(),
            }
            onSaveSkus([...skus, newSku])
            alert(`已保存为SKU模板：${skuId}\n可在「SKU利润表」Tab 查看`)
          }}
          className="w-full bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium py-2 rounded-lg"
        >
          保存为SKU模板
        </button>
      </div>
    </div>
  )
}

function MetricCard({ label, value, color = 'text-gray-700' }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2">
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
    </div>
  )
}

/**
 * 公式展示组件
 * 直观展示WB核算各步骤的公式与代入值，含异常订单物流总成本公式
 */
function FormulaDisplay({ form, settings, tariff, logisticsCalc, logisticsCny, profitCalc, reverseCalcResult }) {
  const [showFormula, setShowFormula] = useState(true)
  const rubPerCny = toNum(settings.rubPerCny)
  const qty = Number(form.quantity) || 1
  const parcelCount = Number(form.parcelCount) || 1
  const perWeight = Number(form.actualWeightG) || 0
  const totalWeight = perWeight * qty
  const actualWeightPerParcel = parcelCount > 0 ? totalWeight / parcelCount : 0
  const stepG = toNum(tariff?.weightRoundingG || 100)
  const billableG = logisticsCalc?.parcels?.[0]?.billableWeightG
  const billableKg = logisticsCalc?.parcels?.[0]?.billableWeightKg
  const tier = logisticsCalc?.parcels?.[0]?.tier
  const kgRate = toNum(tier?.kgRateCny)
  const fixedFee = toNum(tier?.fixedFeeCny)
  const singleFee = logisticsCalc?.parcels?.[0]?.feeCny
  const isAbnormal = reverseCalcResult && reverseCalcResult.eventType !== 'none'

  // 利润相关
  const sellerRevenueRub = toNum(form.sellerRevenueRub)
  const commissionRate = toNum(form.commissionRate)
  const commissionCny = profitCalc?.commissionCny
  const salesRevenueCny = profitCalc?.salesRevenueCny
  const netSettlement = profitCalc?.platformNetSettlementCny
  const purchaseCost = toNum(form.purchaseCost) * qty
  const packagingCost = toNum(form.packagingCost) * qty
  const chinaInbound = toNum(form.chinaInbound) * qty
  const operatingProfit = profitCalc?.operatingProfitCny
  const profitMargin = profitCalc?.profitMargin
  const logisticsRatio = profitCalc?.logisticsRatio

  // 异常订单物流总成本
  const fwdUsed = reverseCalcResult?.forwardLogisticsUsedCny
  const revComp = reverseCalcResult?.reverseCompensationUsedCny
  const otherRev = reverseCalcResult?.otherReverseCostCny
  const totalLogistics = reverseCalcResult?.totalLogisticsCostCny

  return (
    <div className="rounded-lg bg-amber-50/40 border border-amber-200 overflow-hidden">
      <button
        onClick={() => setShowFormula(!showFormula)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-amber-50/60 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Calculator className="w-3.5 h-3.5 text-amber-700" />
          <span className="text-xs font-semibold text-amber-800">公式展示</span>
        </span>
        <span className="text-[10px] text-amber-700">{showFormula ? '收起 ▲' : '展开 ▼'}</span>
      </button>
      {showFormula && (
        <div className="px-3 pb-3 space-y-3 text-[11px] text-gray-700 leading-relaxed">
          {/* 1. 物流费 */}
          <div>
            <p className="font-semibold text-amber-700 mb-0.5">① 物流费（每包裹独立取整计费）</p>
            <p className="pl-3">实际重量 {perWeight}g × {qty}件 = {totalWeight}g → 每包裹 {actualWeightPerParcel}g</p>
            <p className="pl-3">按{stepG}g向上取整: ⌈{actualWeightPerParcel}/{stepG}⌉ × {stepG} = <span className="font-semibold">{billableG}g</span> = <span className="font-semibold">{billableKg}kg</span>（计费重量）</p>
            <p className="pl-3">命中区间 {tier ? `${tier.minWeightKg}-${tier.maxWeightKg}kg` : '—'}: 费率 {kgRate}元/kg + 固定费 {fixedFee}元</p>
            <p className="pl-3">单包裹物流费 = {billableKg} × {kgRate} + {fixedFee} = <span className="font-semibold text-purple-700">{singleFee}元</span></p>
            <p className="pl-3">{parcelCount}个包裹合计 = {singleFee} × {parcelCount} = <span className="font-bold text-purple-700">{logisticsCny}元</span></p>
          </div>

          {/* 2. 销售收入 */}
          <div className="pt-2 border-t border-amber-200/60">
            <p className="font-semibold text-amber-700 mb-0.5">② 销售收入（卢布→人民币）</p>
            <p className="pl-3">销售收入 = 卖家收入基数 / 汇率 = {sellerRevenueRub}₽ / {rubPerCny} = <span className="font-bold text-green-700">{salesRevenueCny}元</span></p>
          </div>

          {/* 3. 佣金 */}
          <div className="pt-2 border-t border-amber-200/60">
            <p className="font-semibold text-amber-700 mb-0.5">③ 平台佣金</p>
            <p className="pl-3">佣金 = 卖家收入基数 × 佣金率 / 汇率 = {sellerRevenueRub}₽ × {commissionRate}% / {rubPerCny} = <span className="font-bold text-orange-700">{commissionCny}元</span></p>
          </div>

          {/* 4. 平台净结算 */}
          <div className="pt-2 border-t border-amber-200/60">
            <p className="font-semibold text-amber-700 mb-0.5">④ 平台净结算</p>
            <p className="pl-3">净结算 = 销售收入 - 佣金 - 物流费 - 支付费 - 促销费 - 其他扣款</p>
            <p className="pl-3">= {salesRevenueCny} - {commissionCny} - {logisticsCny} - {profitCalc?.acquiringFeeCny || 0} - {profitCalc?.promotionCostCny || 0} - {profitCalc?.platformOtherCny || 0} = <span className="font-bold text-blue-700">{netSettlement}元</span></p>
          </div>

          {/* 5. 异常订单物流总成本（仅异常订单显示） */}
          {isAbnormal && (
            <div className="pt-2 border-t border-amber-200/60 bg-orange-50/40 -mx-3 px-3 py-2">
              <p className="font-semibold text-orange-700 mb-0.5">⑤ 异常订单物流总成本（依据WB条款13.1.14）</p>
              <p className="pl-3">物流总成本 = 正向物流费 + 反向配送赔偿 + 其他退回费</p>
              <p className="pl-3">= {fwdUsed} + {revComp} + {otherRev} = <span className="font-bold text-orange-700">{totalLogistics}元</span></p>
              <p className="pl-3 text-[10px] text-gray-500 mt-0.5">
                其中：反向赔偿 = CSG × 倍数 = {logisticsCny} × {reverseCalcResult?.multiplier} = {reverseCalcResult?.estimatedReverseCompensationCny}元
                {reverseCalcResult?.calculationBasis === 'actual' && <span className="text-orange-600">（已使用实际账单值覆盖）</span>}
              </p>
            </div>
          )}

          {/* 6. 经营利润 */}
          <div className="pt-2 border-t border-amber-200/60">
            <p className="font-semibold text-amber-700 mb-0.5">{isAbnormal ? '⑥' : '⑤'} 经营利润</p>
            <p className="pl-3">经营利润 = 平台净结算 - 采购成本 - 包装成本 - 国内送仓 - 认证分摊 - 税费 - 其他运营</p>
            <p className="pl-3">= {netSettlement} - {purchaseCost} - {packagingCost} - {chinaInbound} - 0 - 0 - 0 = <span className={`font-bold ${operatingProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{operatingProfit}元</span></p>
          </div>

          {/* 7. 利润率/物流费率 */}
          <div className="pt-2 border-t border-amber-200/60">
            <p className="font-semibold text-amber-700 mb-0.5">{isAbnormal ? '⑦' : '⑥'} 利润率 / 物流费率</p>
            <p className="pl-3">利润率 = 经营利润 / 销售收入 × 100% = {operatingProfit} / {salesRevenueCny} = <span className={`font-bold ${profitMargin >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{profitMargin}%</span></p>
            <p className="pl-3">物流费率 = {isAbnormal ? '物流总成本' : '物流费'} / 销售收入 × 100% = {isAbnormal ? totalLogistics : logisticsCny} / {salesRevenueCny} = <span className="font-bold text-purple-700">{logisticsRatio}%</span></p>
          </div>
        </div>
      )}
    </div>
  )
}

// ===================== 异常订单配置表单 =====================
function ReverseOrderForm({ form, update, tariff }) {
  const eventType = form.reverseEventType
  const eventLabel = REVERSE_EVENT_LABEL[eventType] || '未知'
  const defaultMult = DEFAULT_REVERSE_MULTIPLIER[eventType] ?? 0
  const needsConfirm = NEEDS_BILL_CONFIRMATION[eventType]

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-600" />
          <span className="text-sm font-semibold text-orange-700">异常订单配置</span>
        </div>
        {needsConfirm && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-300">
            待账单确认
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">反向事件类型</label>
          <select value={eventType} onChange={(e) => {
            const newType = e.target.value
            update('reverseEventType', newType)
            // 切换事件类型时重置倍数为默认
            update('reverseCompensationMultiplier', '')
            // 交仓前取消默认无正向费
            update('forwardFeeApplied', newType !== 'cancelled_before_handover')
          }}
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
            {Object.entries(REVERSE_EVENT_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">
            赔偿倍数 (默认 {defaultMult}×)
          </label>
          <input
            type="number"
            value={form.reverseCompensationMultiplier}
            onChange={(e) => update('reverseCompensationMultiplier', e.target.value)}
            placeholder={`默认 ${defaultMult}`}
            step="any"
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">
            实际正向物流费 (¥)
            <span className="text-[10px] text-gray-400 ml-1">留空用预计值</span>
          </label>
          <input
            type="number"
            value={form.actualForwardLogisticsCny}
            onChange={(e) => update('actualForwardLogisticsCny', e.target.value)}
            placeholder="留空"
            step="any"
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">
            实际反向赔偿 (¥)
            <span className="text-[10px] text-gray-400 ml-1">留空用预计值</span>
          </label>
          <input
            type="number"
            value={form.actualReverseCompensationCny}
            onChange={(e) => update('actualReverseCompensationCny', e.target.value)}
            placeholder="留空"
            step="any"
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">其他退回/销毁费 (¥)</label>
          <input
            type="number"
            value={form.otherReverseCostCny}
            onChange={(e) => update('otherReverseCostCny', e.target.value)}
            step="any"
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">库存回收率 (%)</label>
          <input
            type="number"
            value={form.inventoryRecoveryRate}
            onChange={(e) => update('inventoryRecoveryRate', e.target.value)}
            step="any"
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">正向费是否发生</label>
          <select value={String(form.forwardFeeApplied)} onChange={(e) => update('forwardFeeApplied', e.target.value === 'true')}
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
            <option value="true">是</option>
            <option value="false">否</option>
          </select>
        </div>
      </div>

      <div className="text-[10px] text-orange-700 bg-orange-100/50 rounded p-2">
        <p className="font-semibold mb-1">📋 说明（依据WB服务条款13.1.14）</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>未运出中国或买家退货：1×CSG赔偿</li>
          <li>清关失败退回中国：2×CSG赔偿（默认总风险2×CSG，不自动叠加为3×CSG）</li>
          <li>拒收/未领取：暂按1×CSG测算，最终以WB实际账单为准</li>
          <li>交仓前取消：正向费和赔偿均为0</li>
          <li>实际账单值优先于预计公式，但预计值和差异仍保留</li>
          <li>不叠加俄罗斯境内"8元首升+2元续升"体积运费</li>
        </ul>
      </div>
    </div>
  )
}

// ===================== 异常订单费用结果展示 =====================
function ReverseOrderResult({ result }) {
  const [showSteps, setShowSteps] = useState(false)
  const labels = getOrderLabels({}, result)

  const labelColorMap = {
    green: 'bg-green-100 text-green-700 border-green-300',
    orange: 'bg-orange-100 text-orange-700 border-orange-300',
    red: 'bg-red-100 text-red-700 border-red-300',
    yellow: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    gray: 'bg-gray-100 text-gray-700 border-gray-300',
  }

  return (
    <div className="bg-orange-50/50 border border-orange-200 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="text-sm font-semibold text-orange-700">异常订单费用</h5>
        <div className="flex gap-1">
          {labels.map((lbl, i) => (
            <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full border ${labelColorMap[lbl.color] || labelColorMap.gray}`}>
              {lbl.text}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
        <div className="bg-white rounded p-2 border border-gray-200">
          <p className="text-[10px] text-gray-500">异常类型</p>
          <p className="font-semibold text-gray-700">{result.eventLabel}</p>
        </div>
        <div className="bg-white rounded p-2 border border-gray-200">
          <p className="text-[10px] text-gray-500">赔偿倍数</p>
          <p className="font-semibold text-orange-700">{result.multiplier}× CSG</p>
        </div>
        <div className="bg-white rounded p-2 border border-gray-200">
          <p className="text-[10px] text-gray-500">CSG基数</p>
          <p className="font-semibold text-gray-700">{fmtCny(result.csgTotalCny)}</p>
        </div>
        <div className="bg-white rounded p-2 border border-gray-200">
          <p className="text-[10px] text-gray-500">计算依据</p>
          <p className="font-semibold text-gray-700">{result.calculationBasis === 'actual' ? '实际账单' : '预计公式'}</p>
        </div>

        <div className="bg-white rounded p-2 border border-gray-200">
          <p className="text-[10px] text-gray-500">正向费(预计)</p>
          <p className="text-gray-700">{fmtCny(result.estimatedForwardLogisticsCny)}</p>
        </div>
        <div className="bg-white rounded p-2 border border-gray-200">
          <p className="text-[10px] text-gray-500">正向费(实际)</p>
          <p className="text-gray-700">{result.actualForwardLogisticsCny !== null ? fmtCny(result.actualForwardLogisticsCny) : '—'}</p>
        </div>
        <div className="bg-white rounded p-2 border border-gray-200">
          <p className="text-[10px] text-gray-500">反向赔偿(预计)</p>
          <p className="text-gray-700">{fmtCny(result.estimatedReverseCompensationCny)}</p>
        </div>
        <div className="bg-white rounded p-2 border border-gray-200">
          <p className="text-[10px] text-gray-500">反向赔偿(实际)</p>
          <p className="text-gray-700">{result.actualReverseCompensationCny !== null ? fmtCny(result.actualReverseCompensationCny) : '—'}</p>
        </div>

        <div className="bg-white rounded p-2 border border-gray-200">
          <p className="text-[10px] text-gray-500">其他退回/销毁</p>
          <p className="text-gray-700">{fmtCny(result.otherReverseCostCny)}</p>
        </div>
        <div className="bg-white rounded p-2 border border-gray-200">
          <p className="text-[10px] text-gray-500">预计物流总损失</p>
          <p className="font-semibold text-gray-700">{fmtCny(result.estimatedTotalCny)}</p>
        </div>
        <div className="bg-white rounded p-2 border border-gray-200">
          <p className="text-[10px] text-gray-500">实际物流总损失</p>
          <p className="font-semibold text-orange-700">{fmtCny(result.actualTotalCny)}</p>
        </div>
        <div className="bg-white rounded p-2 border border-gray-200">
          <p className="text-[10px] text-gray-500">预计vs实际差异</p>
          <p className={`font-semibold ${result.varianceCny !== 0 ? 'text-red-600' : 'text-gray-700'}`}>{fmtCny(result.varianceCny)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-purple-50 border border-purple-200 rounded p-2 text-center">
          <p className="text-[10px] text-gray-500">正向使用值</p>
          <p className="text-sm font-bold text-purple-700">{fmtCny(result.forwardLogisticsUsedCny)}</p>
          <p className="text-[9px] text-gray-400">{result.forwardSource}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded p-2 text-center">
          <p className="text-[10px] text-gray-500">反向使用值</p>
          <p className="text-sm font-bold text-purple-700">{fmtCny(result.reverseCompensationUsedCny)}</p>
        </div>
      </div>

      <div className="bg-red-50 border border-red-200 rounded p-2 text-center">
        <p className="text-[10px] text-gray-500">物流总成本</p>
        <p className="text-lg font-bold text-red-700">{fmtCny(result.totalLogisticsCostCny)}</p>
      </div>

      {result.needsBillConfirmation && (
        <div className="rounded bg-yellow-50 border border-yellow-300 p-2 flex items-center gap-2">
          <AlertTriangle className="w-3 h-3 text-yellow-600" />
          <span className="text-[11px] text-yellow-700">⚠️ 此场景暂按 {result.multiplier}×CSG 测算，需以WB实际账单确认为准</span>
        </div>
      )}

      <button onClick={() => setShowSteps(!showSteps)} className="text-xs text-orange-600 hover:text-orange-700">
        {showSteps ? '收起' : '展开'}计算过程
      </button>
      {showSteps && (
        <div className="bg-gray-50 rounded p-2 max-h-48 overflow-y-auto">
          {result.steps.map((s, i) => (
            <p key={i} className={`text-[11px] text-gray-600 ${s.startsWith('=====') ? 'font-semibold mt-2' : ''}`}>{s}</p>
          ))}
        </div>
      )}
    </div>
  )
}

// ===================== SKU利润表 =====================
function SkuTab({ skus, tariffs, settings, onSaveSkus }) {
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

// ===================== 线路对比 =====================
function CompareTab({ tariffs }) {
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
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">{unit}</span>
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
                  <td className="px-3 py-2 border-b border-gray-100 text-gray-500 text-[10px]">{r.messages?.join('; ') || ''}</td>
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

// ===================== 费率管理 =====================
function TariffTab({ tariffs, onSaveTariffs }) {
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(tariffs, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'wb_tariffs.json'; a.click()
    URL.revokeObjectURL(url)
  }
  const importJson = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result)
        onSaveTariffs(imported)
        alert('导入成功')
      } catch (err) { alert('导入失败: ' + err.message) }
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-morandi-text">当前费率 ({tariffs.length})</h4>
          <div className="flex gap-2">
            <button onClick={exportJson} className="text-xs px-2 py-1 rounded bg-white border border-gray-200 hover:bg-gray-50 flex items-center gap-1">
              <Download className="w-3 h-3" />导出JSON
            </button>
            <label className="text-xs px-2 py-1 rounded bg-white border border-gray-200 hover:bg-gray-50 flex items-center gap-1 cursor-pointer">
              <Upload className="w-3 h-3" />导入JSON
              <input type="file" accept=".json" onChange={importJson} className="hidden" />
            </label>
            <button onClick={() => { if (confirm('重置为默认费率？')) onSaveTariffs(DEFAULT_TARIFFS) }} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600">
              重置默认
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                {['线路ID', '名称', '仓库', '时效(天)', '最大重量(kg)', '三边和(cm)', '单边(cm)', '生效日期', '失效', '启用', '费率区间'].map((h) => (
                  <th key={h} className="px-2 py-2 text-left text-gray-500 font-semibold border-b border-gray-200 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tariffs.map((t, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-gray-700">{t.routeId}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-gray-700">{t.routeName}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-gray-600">{t.warehouseCode || '—'}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-gray-600">{t.etaMinDays}-{t.etaMaxDays}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-right text-gray-600">{t.maxWeightKg}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-right text-gray-600">{t.maxSumDimensionsCm}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-right text-gray-600">{t.maxSingleSideCm}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-gray-600">{t.effectiveFrom}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-gray-600">{t.effectiveTo || '—'}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100">{t.active !== false ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-gray-400" />}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-[10px] text-gray-500">{(t.tiers || []).map((tier) => `${tier.minWeightKg}-${tier.maxWeightKg}kg: ${tier.kgRateCny}+${tier.fixedFeeCny}`).join(' | ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
        <p className="font-semibold mb-1">⚠️ 费率管理说明</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>修改费率前请提示影响的预计订单数量</li>
          <li>新订单使用新版本，历史订单保留原费率版本</li>
          <li>重算历史订单时必须明确提示并保留重算前结果</li>
          <li>跨境订单（DPX）不得叠加俄罗斯境内"首升+续升"体积费</li>
          <li>当前费率按实际重量计费，不使用体积重</li>
        </ul>
      </div>
    </div>
  )
}

// ===================== 订单与对账 =====================
function OrdersTab({ orders, tariffs, settings, onSaveOrders }) {
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
                              <span key={j} className={`text-[9px] px-1.5 py-0.5 rounded border ${labelColorMap[lbl.color] || labelColorMap.gray}`}>
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
