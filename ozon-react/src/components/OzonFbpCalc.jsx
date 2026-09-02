import { useMemo, useState } from 'react'
import { Warehouse, Package, DollarSign, TrendingUp, Info, Save, AlertCircle, Clock } from 'lucide-react'
import { persistGet, persistSet } from '../utils/persist'
import {
  FBP_VERSION, FBP_STORAGE, FBP_LAST_MILE, FBP_DESTINATIONS, FBP_WAREHOUSES,
  filterFbpChannels, calcFbpShipping, calcStorageFee, calcFbpProfit, getBestFbpProfit,
} from '../utils/ozonFbpEngine'
import { R, rubPerCny } from '../utils/ozonEngine'
import { useExchangeRate } from '../utils/useExchangeRate'
import { formatRubPerCny } from '../utils/exchangeRate'
import Button from './ui/Button'

const PARAMS_KEY = 'fbp-calc-params-v1'
const HISTORY_KEY = 'fbp-calc-history-v1'

const DEFAULTS = {
  destination: 'RU',
  warehouseId: 'all',
  price: 3000,
  weight: 1,
  length: 20,
  width: 15,
  height: 10,
  hasBattery: false,
  hasLiquid: false,
  stockDays: 90,
  lastMileRub: 0,
  purchaseCost: 20,
  domesticShipping: 3,
  labelingFee: 2,
  commission: 12,
  adRate: 10,
  paymentFee: 1,
  agencyFee: 2,
  returnLoss: 4,
  onlyUsable: true,
}

const LEVEL_ZH = { 'Super Express': '超级快', Express: '快递', Standard: '标准', Economy: '经济' }
const CHARGE_ZH = { actual: '实重', vol_6000: '体积重÷6000', vol_12000: '体积重÷12000', conditional: '条件体积重' }
const TRISTATE_ZH = { forbidden: '禁止', allowed: '允许', msds: '需MSDS' }

export default function OzonFbpCalc() {
  // 订阅每日自动汇率：live binding R/rubPerCny 更新后重渲染即生效
  useExchangeRate()

  const [params, setParams] = useState(() => ({ ...DEFAULTS, ...(persistGet(PARAMS_KEY) || {}) }))
  const [savedAt, setSavedAt] = useState(null)
  const [history, setHistory] = useState(() => persistGet(HISTORY_KEY) || [])

  const update = (key, val) => setParams((p) => ({ ...p, [key]: val }))

  const num = (k) => Number(params[k]) || 0

  const inputs = {
    price: num('price'),
    weight: num('weight'),
    length: num('length'),
    width: num('width'),
    height: num('height'),
    hasBattery: !!params.hasBattery,
    hasLiquid: !!params.hasLiquid,
    stockDays: num('stockDays'),
    lastMileRub: num('lastMileRub'),
  }
  const costParams = {
    purchaseCost: num('purchaseCost'),
    domesticShipping: num('domesticShipping'),
    labelingFee: num('labelingFee'),
    commission: num('commission'),
    adRate: num('adRate'),
    paymentFee: num('paymentFee'),
    agencyFee: params.agencyFee,
    returnLoss: num('returnLoss'),
  }

  const volumeM3 = (inputs.length * inputs.width * inputs.height) / 1000000
  const storageFee = calcStorageFee(inputs.length, inputs.width, inputs.height, inputs.stockDays)
  const billableDays = Math.max(0, inputs.stockDays - FBP_STORAGE.free_days)

  const channelPool = useMemo(
    () => filterFbpChannels(params.destination, params.warehouseId),
    [params.destination, params.warehouseId]
  )

  const results = useMemo(
    () =>
      channelPool.map((ch) => {
        const calc = calcFbpProfit(ch, inputs, costParams)
        return { ch, calc }
      }),
    [channelPool, params]
  )

  const usable = results.filter((r) => r.calc.ok).sort((a, b) => b.calc.profit - a.calc.profit)
  const unusable = results.filter((r) => !r.calc.ok)
  const best = usable[0] || null
  const visibleResults = params.onlyUsable ? usable : [...usable, ...unusable]

  const saveParams = () => {
    persistSet(PARAMS_KEY, params)
    setSavedAt(new Date().toLocaleString('zh-CN', { hour12: false }))
    if (best) {
      const entry = {
        time: new Date().toLocaleString('zh-CN', { hour12: false }),
        dest: params.destination,
        price: inputs.price,
        weight: inputs.weight,
        channel: best.ch.service_name,
        profit: best.calc.profit,
        profitRate: best.calc.profitRate,
      }
      const next = [entry, ...history].slice(0, 20)
      setHistory(next)
      persistSet(HISTORY_KEY, next)
    }
  }

  const inputField = (label, key, unit, placeholder) => (
    <div>
      <label className="text-sm font-medium text-morandi-text-light mb-1 block">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={params[key]}
          onChange={(e) => update(key, e.target.value)}
          placeholder={placeholder}
          step="any"
          className="w-full text-sm text-morandi-text border border-gray-200 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300 bg-white"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{unit}</span>
      </div>
    </div>
  )

  const selectField = (label, key, options) => (
    <div>
      <label className="text-sm font-medium text-morandi-text-light mb-1 block">{label}</label>
      <select
        value={params[key]}
        onChange={(e) => update(key, e.target.value)}
        className="w-full text-sm text-morandi-text border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300 bg-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )

  const checkField = (label, key) => (
    <label className="flex items-center gap-2 text-sm text-morandi-text cursor-pointer pt-6">
      <input
        type="checkbox"
        checked={!!params[key]}
        onChange={(e) => update(key, e.target.checked)}
        className="rounded"
      />
      {label}
    </label>
  )

  const destOptions = FBP_DESTINATIONS.map((d) => ({ value: d.code, label: d.zh }))
  const whOptions = FBP_WAREHOUSES.map((w) => ({ value: w.id, label: w.name }))

  return (
    <div className="space-y-4">
      {/* 标题区 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-2 bg-teal-50 border-b border-teal-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-teal-100">
              <Warehouse className="w-4 h-4 text-teal-700" />
            </div>
            <div>
              <h3 className="text-base font-bold text-teal-700">Ozon FBP 边境仓核算</h3>
              <p className="text-[10px] text-teal-600">
                FBP 资费 {FBP_VERSION} · 汇率 1¥ = {formatRubPerCny(rubPerCny)}₽ · 3PL段：中国揽收点→Ozon分拣中心
              </p>
            </div>
          </div>
          <span className="text-xs px-2 py-1 rounded bg-white border border-teal-200 text-teal-700">
            边境仓备货 · {FBP_STORAGE.free_days}天免租 · 仓租¥{FBP_STORAGE.rate_cny_per_m3_per_day}/m³/天
          </span>
        </div>
      </div>

      {/* 尾程费待配置提示 */}
      {!FBP_LAST_MILE.source && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Ozon 尾程配送费（分拣中心→买家）费率表尚未接入，当前「尾程配送费」为手动输入估算值（默认 0）。
            利润为<b>不含尾程</b>口径，费率表到位后自动切换查表计算。{FBP_LAST_MILE.note}
          </p>
        </div>
      )}

      {/* 参数区 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 space-y-5">
          <div>
            <p className="text-sm font-semibold text-morandi-text mb-2">📦 商品与线路筛选</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {selectField('目的国', 'destination', destOptions)}
              {selectField('边境仓', 'warehouseId', whOptions)}
              {inputField('成交价', 'price', '₽', '如3000')}
              {inputField('实重', 'weight', 'KG', '如1')}
              {inputField('库存天数', 'stockDays', '天', '默认90')}
              {inputField('长', 'length', 'CM', '如20')}
              {inputField('宽', 'width', 'CM', '如15')}
              {inputField('高', 'height', 'CM', '如10')}
              {checkField('含电池', 'hasBattery')}
              {checkField('含液体', 'hasLiquid')}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-morandi-text mb-2">🏭 国内段（工厂→边境仓）</p>
            <div className="grid grid-cols-3 gap-3">
              {inputField('采购成本', 'purchaseCost', '¥', '如20')}
              {inputField('国内段运费', 'domesticShipping', '¥/件', '如3')}
              {inputField('贴标费', 'labelingFee', '¥', '如2')}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-morandi-text mb-2">💰 跨境与平台费用</p>
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
              {inputField('尾程配送费', 'lastMileRub', '₽/件', '待费率表,默认0')}
              {inputField('佣金', 'commission', '%', '12')}
              {inputField('广告费用', 'adRate', '%', '10')}
              {inputField('支付工具费', 'paymentFee', '%', '1')}
              {inputField('交付代理费', 'agencyFee', '%', '2')}
              {inputField('退货损失', 'returnLoss', '%', '4')}
            </div>
          </div>

          {/* 实时指标 */}
          <div className="flex flex-wrap items-center gap-5 px-1">
            <div className="flex items-center gap-1.5">
              <Package className="w-4 h-4 text-morandi-text-light" />
              <span className="text-sm text-morandi-text-light">三边和: <span className="font-semibold text-morandi-text">{inputs.length + inputs.width + inputs.height}CM</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-morandi-text-light" />
              <span className="text-sm text-morandi-text-light">成交价折合: <span className="font-semibold text-morandi-text">¥{(inputs.price / rubPerCny).toFixed(2)}</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Warehouse className="w-4 h-4 text-morandi-text-light" />
              <span className="text-sm text-morandi-text-light">
                单件体积: <span className="font-semibold text-morandi-text">{volumeM3.toFixed(4)}m³</span>
                <span className="text-xs text-morandi-text-light ml-1">
                  （超免租 {billableDays}天 × ¥{FBP_STORAGE.rate_cny_per_m3_per_day}/m³/天 = ¥{storageFee}）
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <label className="flex items-center gap-2 text-sm text-morandi-text cursor-pointer">
              <input
                type="checkbox"
                checked={!!params.onlyUsable}
                onChange={(e) => update('onlyUsable', e.target.checked)}
                className="rounded"
              />
              仅显示可用线路（{usable.length} 可用 / {unusable.length} 不可用）
            </label>
            <div className="flex items-center gap-3">
              {savedAt && <span className="text-xs text-green-600">已保存（{savedAt}）</span>}
              <Button variant="primary" size="sm" onClick={saveParams}>
                <Save className="h-3.5 w-3.5" /> 保存参数与最优方案
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 最优线路卡 */}
      {best && best.calc.ok && (
        <div className="mb-1 p-4 rounded-lg bg-green-50 border border-green-200">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-green-700">🏆 最优线路（利润最高）</span>
              <span className="text-sm font-bold text-green-800">{best.ch.method}</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-white border border-green-200 text-green-700">
                {LEVEL_ZH[best.ch.service_level] || best.ch.service_level} · {best.ch.speed_days}天
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-green-700">利润 <b className="text-green-800">¥{best.calc.profit}</b></span>
              <span className="text-sm text-green-700">利润率 <b className="text-green-800">{best.calc.profitRate}%</b></span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 text-sm">
            <div><span className="text-green-600">成交价</span><br /><span className="font-bold text-green-800">¥{best.calc.priceCny}</span></div>
            <div><span className="text-green-600">国内段</span><br /><span className="font-bold text-green-800">-¥{best.calc.costBreakdown.domesticCost}</span></div>
            <div><span className="text-green-600">FBP国际段</span><br /><span className="font-bold text-green-800">-¥{best.calc.costBreakdown.fbpShipping}</span></div>
            <div><span className="text-green-600">尾程配送</span><br /><span className="font-bold text-green-800">-¥{best.calc.costBreakdown.lastMile}{best.calc.costBreakdown.lastMileRub > 0 ? `（${best.calc.costBreakdown.lastMileRub}₽）` : ''}</span></div>
            <div><span className="text-green-600">仓储费</span><br /><span className="font-bold text-green-800">-¥{best.calc.costBreakdown.storageFee}</span></div>
            <div><span className="text-green-600">代理费</span><br /><span className="font-bold text-green-800">-¥{best.calc.costBreakdown.agencyAmt}</span></div>
            <div><span className="text-green-600">平台费</span><br /><span className="font-bold text-green-800">-¥{best.calc.costBreakdown.platformAmt}</span></div>
            <div><span className="text-green-600">退货损失</span><br /><span className="font-bold text-green-800">-¥{best.calc.costBreakdown.returnAmt}</span></div>
          </div>
          <div className="mt-3 pt-2 border-t border-green-200 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-green-700">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> 计费重 {best.calc.shipping.chargeWeightKg}kg{best.calc.shipping.volumetricWeightKg ? `（体积重 ${best.calc.shipping.volumetricWeightKg}kg）` : ''} · {CHARGE_ZH[best.ch.charge_weight]}</span>
            <span>评分组 {best.ch.scoring_group} · 申报价值 {best.ch.price_min_rub.toLocaleString()}-{best.ch.price_max_rub.toLocaleString()}₽</span>
            <span>电池{TRISTATE_ZH[best.ch.batteries]} · 液体{TRISTATE_ZH[best.ch.liquids]}</span>
            <span className="text-green-600">逆向：{best.ch.reverse_policy}</span>
          </div>
        </div>
      )}
      {!best && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-morandi-text-light">
          当前筛选条件下无可用线路（{unusable.length} 条全部不可用）。可尝试放宽尺寸/重量/申报价值、取消电池液体限制或切换边境仓。
        </div>
      )}

      {/* 线路对比表 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h4 className="text-sm font-bold text-morandi-text">全部线路对比（{params.destination === 'RU' ? '俄罗斯' : params.destination === 'BY' ? '白俄罗斯' : '哈萨克斯坦'}）</h4>
          <span className="text-xs text-morandi-text-light">运费 = 固定费 + ¥/g × 计费重 · CNY 计价</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">线路</th>
                <th className="px-3 py-2 text-left">等级/时效</th>
                <th className="px-3 py-2 text-left">评分组</th>
                <th className="px-3 py-2 text-right">固定费</th>
                <th className="px-3 py-2 text-right">费率¥/g</th>
                <th className="px-3 py-2 text-right">计费重</th>
                <th className="px-3 py-2 text-right">国际段运费</th>
                <th className="px-3 py-2 text-right">利润</th>
                <th className="px-3 py-2 text-right">利润率</th>
                <th className="px-3 py-2 text-left">限制/计费</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleResults.map(({ ch, calc }) => {
                const ok = calc.ok
                return (
                  <tr key={ch.id} className={ok ? 'hover:bg-gray-50' : 'bg-gray-50/60 text-gray-400'}>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">
                      {ch.method}
                      {best && ch.id === best.ch.id && <span className="ml-1 text-[10px] text-green-600">★最优</span>}
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{LEVEL_ZH[ch.service_level] || ch.service_level} · {ch.speed_days}天</td>
                    <td className="px-3 py-2 text-xs">{ch.scoring_group}</td>
                    <td className="px-3 py-2 text-right">{ch.fixed_cny}</td>
                    <td className="px-3 py-2 text-right">{ch.rate_per_g_cny}</td>
                    <td className="px-3 py-2 text-right">{ok ? `${calc.shipping.chargeWeightKg}kg` : '—'}</td>
                    <td className="px-3 py-2 text-right font-medium">{ok ? `¥${calc.costBreakdown.fbpShipping}` : '—'}</td>
                    <td className={`px-3 py-2 text-right font-bold ${ok ? (calc.profit > 0 ? 'text-green-600' : 'text-red-500') : ''}`}>{ok ? `¥${calc.profit}` : '不可用'}</td>
                    <td className="px-3 py-2 text-right">{ok ? `${calc.profitRate}%` : '—'}</td>
                    <td className="px-3 py-2 text-[11px] max-w-[260px]">
                      {ok ? (
                        <span className="text-morandi-text-light">
                          {CHARGE_ZH[ch.charge_weight]}
                          {(ch.batteries === 'msds' || ch.liquids === 'msds') && <span className="text-amber-600"> · MSDS</span>}
                        </span>
                      ) : (
                        <span className="text-red-400" title={calc.reason}>{calc.reason}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {visibleResults.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-morandi-text-light">当前目的国/仓库组合下没有线路</div>
        )}
      </div>

      {/* 保存历史 */}
      {history.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-morandi-text-light" />
            <h4 className="text-sm font-bold text-morandi-text">最优方案保存记录（最近 {history.length} 次）</h4>
          </div>
          <div className="px-5 py-3 space-y-1 max-h-40 overflow-y-auto">
            {history.map((h, i) => (
              <p key={i} className="text-xs text-morandi-text-light">
                {h.time} · {h.dest} · 售价{h.price}₽/{h.weight}kg · {h.channel} → 利润 ¥{h.profit}（{h.profitRate}%）
              </p>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-morandi-text-light px-1 flex items-start gap-1">
        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
        口径：FBP 国际段资费来自 Ozon FBP 服务清单（{FBP_VERSION}），DEX 美元线路与 Smart 服务一期未纳入；汇率沿用每日自动更新 live binding；代理费沿用以卢布计（2%/15₽/200₽ 封顶，settings.json）。
      </p>
    </div>
  )
}
