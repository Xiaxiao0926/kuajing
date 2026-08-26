import { useState, useMemo, useEffect } from 'react'
import { Calculator, Package, DollarSign, TrendingUp, Truck, Route, Settings, ClipboardList } from 'lucide-react'
import { persistGet, persistSet } from '../utils/persist'
import { DEFAULT_SETTINGS, DEFAULT_TARIFFS } from '../utils/wbConfig'
import { getRateInfo, formatRubPerCny } from '../utils/exchangeRate'
import { useExchangeRate } from '../utils/useExchangeRate'
import { OverviewTab } from './wbcalc/tabs/OverviewTab'
import { CalculatorTab } from './wbcalc/tabs/CalculatorTab'
import { SkuTab } from './wbcalc/tabs/SkuTab'
import { CompareTab } from './wbcalc/tabs/CompareTab'
import { TariffTab } from './wbcalc/tabs/TariffTab'
import { OrdersTab } from './wbcalc/tabs/OrdersTab'

const SETTINGS_KEY = 'wb-settings-v1'
const TARIFFS_KEY = 'wb-tariffs-v1'
const SKUS_KEY = 'wb-skus-v1'
const ORDERS_KEY = 'wb-orders-v1'

const TABS = [
  { id: 'overview', name: '经营总览', icon: TrendingUp },
  { id: 'calculator', name: '单订单核算器', icon: Calculator },
  { id: 'sku', name: 'SKU利润表', icon: Package },
  { id: 'compare', name: '线路对比', icon: Route },
  { id: 'tariff', name: '费率管理', icon: Settings },
  { id: 'orders', name: '订单与对账', icon: ClipboardList },
]

/**
 * WB跨境利润与物流费用核算（编排层）
 * 计算逻辑：utils/wbEngine.js（禁改）；配置：config/wb_tariffs.json
 * Tab 区块：./wbcalc/tabs/*.jsx；共享组件：./wbcalc/
 * projectContext（T6-2B2）：{ projectId, projectCode, prefill, onSaveScenario } | null
 * 项目模式下在单订单核算器预填候选数据（仅 5 项，佣金绝不预填）并允许保存不可变成本场景。
 */
export default function WBCalc({ projectContext = null }) {
  const [tab, setTab] = useState('overview')
  // 汇率统一走 live 每日自动更新（utils/exchangeRate.js；用户全局指令：整个跨境面板统一汇率）。
  // WB 引擎经 settings.rubPerCny 消费汇率：挂载时取当前 live 值，异步拉取完成后由 effect 同步。
  const rateInfo = useExchangeRate()
  const [settings, setSettings] = useState(() => {
    const stored = persistGet(SETTINGS_KEY)
    const base = stored || DEFAULT_SETTINGS
    const live = getRateInfo()
    const migrated = {
      ...base,
      rubPerCny: live.rubPerCny,
      exchangeRateEffectiveFrom: live.date || base.exchangeRateEffectiveFrom,
    }
    persistSet(SETTINGS_KEY, migrated)
    return migrated
  })
  useEffect(() => {
    setSettings((prev) => {
      if (prev.rubPerCny === rateInfo.rubPerCny) return prev
      const next = {
        ...prev,
        rubPerCny: rateInfo.rubPerCny,
        exchangeRateEffectiveFrom: rateInfo.date || prev.exchangeRateEffectiveFrom,
      }
      persistSet(SETTINGS_KEY, next)
      return next
    })
  }, [rateInfo])
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
            <span className="px-2 py-1 rounded bg-white border border-orange-200 text-orange-700">
              汇率 1¥ = {formatRubPerCny(settings.rubPerCny)}₽{rateInfo.auto ? `（${rateInfo.source} ${rateInfo.date}自动更新）` : ''}
            </span>
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
      {tab === 'calculator' && <CalculatorTab key={projectContext ? `ctx-${projectContext.projectId}` : 'standalone'} projectContext={projectContext} settings={settings} tariffs={activeRoutes} skus={skus} onSaveOrder={(o) => saveOrders([...orders, o])} onSaveSkus={saveSkus} />}
      {tab === 'sku' && <SkuTab skus={skus} tariffs={activeRoutes} settings={settings} onSaveSkus={saveSkus} />}
      {tab === 'compare' && <CompareTab tariffs={activeRoutes} />}
      {tab === 'tariff' && <TariffTab tariffs={tariffs} onSaveTariffs={saveTariffs} />}
      {tab === 'orders' && <OrdersTab orders={orders} tariffs={activeRoutes} settings={settings} onSaveOrders={saveOrders} />}
    </div>
  )
}
