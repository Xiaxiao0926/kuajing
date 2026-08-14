// T3-2 WBCalc 拆分脚本（一次性，执行后保留供审计）
// 逐字搬移：只改 import/export，不改任何 JSX/逻辑内容。
const fs = require('fs');
const path = require('path');

const SRC = 'D:/ozon/ozon-react/src/components/WBCalc.jsx';
const ROOT = 'D:/ozon/ozon-react/src/components/wbcalc';
fs.mkdirSync(path.join(ROOT, 'tabs'), { recursive: true });

const ori = fs.readFileSync(SRC, 'utf-8').split(/\r?\n/);
if (ori.length < 1692) { console.error(`[split-wb] 行数异常: ${ori.length}`); process.exit(1); }

// 锚点校验
const anchors = [
  [24, 'const fmtCny = (v) => (v === null || v === undefined ? \'—\' : `¥${Number(v).toLocaleString(\'zh-CN\', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)'],
  [50, 'function CategoryProductPicker({ value, onChange, compact = false }) {'],
  [193, 'export default function WBCalc() {'],
  [271, 'function OverviewTab({ orders, settings }) {'],
  [397, 'function CalculatorTab({ settings, tariffs, skus, onSaveOrder, onSaveSkus }) {'],
  [737, 'function MetricCard({ label, value, color = \'text-gray-700\' }) {'],
  [750, 'function FormulaDisplay({ form, settings, tariff, logisticsCalc, logisticsCny, profitCalc, reverseCalcResult }) {'],
  [862, 'function ReverseOrderForm({ form, update, tariff }) {'],
  [992, 'function ReverseOrderResult({ result }) {'],
  [1109, 'function SkuTab({ skus, tariffs, settings, onSaveSkus }) {'],
  [1349, 'function CompareTab({ tariffs }) {'],
  [1429, 'function TariffTab({ tariffs, onSaveTariffs }) {'],
  [1513, 'function OrdersTab({ orders, tariffs, settings, onSaveOrders }) {'],
];
for (const [n, text] of anchors) {
  const actual = ori[n - 1].trim();
  if (actual !== text.trim()) {
    console.error(`[split-wb] 锚点不符 L${n}:\n  期望: ${text.trim()}\n  实际: ${actual}`);
    process.exit(1);
  }
}
console.log('[split-wb] 锚点校验通过');

const WB_ENGINE_IMPORT = (deep) => `import {
  toNum, round2, roundUpWeight, selectTariffVersion, selectTariffTier,
  validateParcel, calculateParcelLogistics, calculateOrderLogistics,
  calculatePlatformSettlement, calculateOperatingProfit, compareRoutes, calculateReturnLoss,
  calculateReverseCompensation, calculateTotalLogisticsCost, calculateOperatingProfitV2,
  inferReverseEventType, getOrderLabels,
} from '${deep ? '../../..' : '../..'}/utils/wbEngine'`;
const WB_CFG_IMPORT = (deep) => `import {
  DEFAULT_SETTINGS, DEFAULT_TARIFFS, CSV_COLUMNS,
  REVERSE_EVENT_TYPE, REVERSE_EVENT_LABEL, DEFAULT_REVERSE_MULTIPLIER, NEEDS_BILL_CONFIRMATION,
} from '${deep ? '../../..' : '../..'}/utils/wbConfig'`;

// ---- format.js: fmt* + loadCommissionData (L24-42) ----
const fmtSrc = ori.slice(23, 42).join('\n').replace('const fmtCny', 'export const fmtCny').replace('const fmtRub', 'export const fmtRub').replace('const fmtPct', 'export const fmtPct').replace('async function loadCommissionData', 'export async function loadCommissionData') + '\n';
fs.writeFileSync(path.join(ROOT, 'format.js'), fmtSrc, 'utf-8');
console.log('[split-wb] format.js');

// ---- CategoryProductPicker.jsx (L44-182 含注释) ----
let picker = ori.slice(43, 182).join('\n');
picker = picker.replace('function CategoryProductPicker', 'export function CategoryProductPicker');
const pickerSrc = [
  "import { useState, useMemo, useEffect } from 'react'",
  "import { Search } from 'lucide-react'",
  "import { loadCommissionData } from './format'",
  '',
  picker,
  '',
].join('\n');
fs.writeFileSync(path.join(ROOT, 'CategoryProductPicker.jsx'), pickerSrc, 'utf-8');
console.log('[split-wb] CategoryProductPicker.jsx');

// ---- MetricCard.jsx (L737-744 完整函数) ----
const metricSrc = ori.slice(736, 744).join('\n').replace('function MetricCard', 'export function MetricCard') + '\n';
fs.writeFileSync(path.join(ROOT, 'MetricCard.jsx'), metricSrc, 'utf-8');
console.log('[split-wb] MetricCard.jsx');

// ---- 各 tab / 展示组件（含各自上方注释行）----
// deep=true 表示目标位于 wbcalc/tabs/ 子目录（相对路径多一级）
const tabs = [
  { name: 'OverviewTab', from: 270, to: 395, react: '', icons: ['ClipboardList', 'AlertTriangle'], engine: true, cfg: false, fmt: ['fmtCny', 'fmtRub', 'fmtPct'], extra: ["import { MetricCard } from '../MetricCard'"], deep: true },
  { name: 'CalculatorTab', from: 396, to: 735, react: "import { useState } from 'react'", icons: ['Info', 'AlertTriangle', 'XCircle'], engine: true, cfg: false, fmt: ['fmtCny', 'fmtRub', 'fmtPct'], extra: ["import { CategoryProductPicker } from '../CategoryProductPicker'", "import { MetricCard } from '../MetricCard'", "import { FormulaDisplay } from '../FormulaDisplay'", "import { ReverseOrderForm } from '../ReverseOrderForm'", "import { ReverseOrderResult } from '../ReverseOrderResult'"], deep: true },
  { name: 'FormulaDisplay', from: 746, to: 860, react: "import { useState } from 'react'", icons: ['Calculator'], engine: true, cfg: false, fmt: [], extra: [], deep: false },
  { name: 'ReverseOrderForm', from: 861, to: 990, react: '', icons: ['AlertTriangle'], engine: false, cfg: true, fmt: [], extra: [], deep: false },
  { name: 'ReverseOrderResult', from: 991, to: 1107, react: "import { useState } from 'react'", icons: ['AlertTriangle'], engine: true, cfg: false, fmt: ['fmtCny'], extra: [], deep: false },
  { name: 'SkuTab', from: 1108, to: 1347, react: "import { useState } from 'react'", icons: ['Download', 'Plus', 'Trash2'], engine: true, cfg: false, fmt: [], extra: ["import { CategoryProductPicker } from '../CategoryProductPicker'"], deep: true },
  { name: 'CompareTab', from: 1348, to: 1427, react: "import { useState } from 'react'", icons: ['CheckCircle2', 'XCircle'], engine: true, cfg: false, fmt: ['fmtCny'], extra: [], deep: true },
  { name: 'TariffTab', from: 1428, to: 1511, react: '', icons: ['CheckCircle2', 'XCircle', 'Download', 'Upload'], engine: false, cfg: true, fmt: [], extra: [], deep: true },
  { name: 'OrdersTab', from: 1512, to: 1692, react: '', icons: ['ClipboardList', 'Download', 'Upload', 'Trash2'], engine: true, cfg: true, fmt: [], extra: [], deep: true },
];

for (const t of tabs) {
  let body = ori.slice(t.from - 1, t.to).join('\n');
  // 函数声明改导出（锚点行即函数声明行，替换整行首部的 'function Xxx('）
  body = body.replace(new RegExp('^function ' + t.name + '\\(', 'm'), 'export function ' + t.name + '(');
  const parts = [];
  if (t.react) parts.push(t.react);
  if (t.icons.length) parts.push(`import { ${t.icons.join(', ')} } from 'lucide-react'`);
  if (t.engine) parts.push(WB_ENGINE_IMPORT(t.deep));
  if (t.cfg) parts.push(WB_CFG_IMPORT(t.deep));
  if (t.fmt.length) parts.push(`import { ${t.fmt.join(', ')} } from '${t.deep ? '..' : '.'}/format'`);
  parts.push(...t.extra);
  parts.push('');
  parts.push(body);
  parts.push('');
  const dest = t.name.endsWith('Tab') ? path.join(ROOT, 'tabs', t.name + '.jsx') : path.join(ROOT, t.name + '.jsx');
  fs.writeFileSync(dest, parts.join('\n'), 'utf-8');
  console.log(`[split-wb] ${t.name} (${t.to - t.from + 1} lines)`);
}

// ---- 主文件重写：imports + keys + TABS + 主组件 (L1-23, 184-268) ----
const main = `import { useState, useMemo } from 'react'
import { Calculator, Package, DollarSign, TrendingUp, Truck, Route, Settings, ClipboardList } from 'lucide-react'
import { persistGet, persistSet } from '../utils/persist'
import { DEFAULT_SETTINGS, DEFAULT_TARIFFS } from '../utils/wbConfig'
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
 */
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
                className={\`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors \${
                  active ? 'border-orange-500 text-orange-700 bg-orange-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }\`}
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
`;
fs.writeFileSync(SRC, main, 'utf-8');
console.log('[split-wb] WBCalc.jsx 已重写为编排层');
