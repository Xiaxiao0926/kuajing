// T3-1 NewDashboard 完整拆分脚本（一次性，执行后保留供审计）
// 三步：1) 提取 dictionary.js  2) 提取 useDashboardStats.js  3) 切分 sections + 重写编排层
// 逐字搬移：只改 import/export 与包裹结构，不改任何 JSX/逻辑内容。
const fs = require('fs');
const path = require('path');

const SRC = 'D:/ozon/ozon-react/src/components/NewDashboard.jsx';
const DASH = 'D:/ozon/ozon-react/src/components/dashboard';
const DIR = path.join(DASH, 'sections');
fs.mkdirSync(DIR, { recursive: true });

const lines = fs.readFileSync(SRC, 'utf-8').split(/\r?\n/);
if (lines.length !== 6609 && lines.length !== 6610) {
  console.error(`[split] 行数异常: ${lines.length}，中止。`);
  process.exit(1);
}
// 前置校验：关键锚点行号必须吻合，防止行号漂移导致错误切分
const anchors = [
  [7, 'const R = 0.09'],
  [1923, 'const getSeasonalDataByCategory = (category, avgPrice, priceRange, topKeywords) => {'],
  [2149, 'export default function NewDashboard({ data, kpis }) {'],
  [2154, '  const stats = useMemo(() => {'],
  [3677, '  }, [data])'],
  [6585, 'function KPICard({ icon, title, value, sub, trend }) {'],
  [6601, 'function RecommendationCard({ title, content, color }) {'],
];
for (const [n, text] of anchors) {
  if (lines[n - 1].trim() !== text.trim()) {
    console.error(`[split] 锚点不符 L${n}: 期望 "${text.trim()}" 实际 "${lines[n - 1].trim()}"`);
    process.exit(1);
  }
}
console.log('[split] 锚点校验通过');

// ---- 1. dictionary.js: L7-2147 (工具/词库，0-based 6..2146) ----
let dict = lines.slice(6, 2147).join('\n');
for (const s of ['const R = 0.09', 'const fmtCNY =', 'const fmtCNYFull =', 'const buildDictionary =',
  'const extractFeaturesFromNames =', 'const findColumn =', 'const parseNum =', 'const getPriceBand =',
  'const buildPriceBands =', 'const getSeasonalDataByCategory =']) {
  if (!dict.includes(s)) { console.error(`[split] dictionary 缺符号: ${s}`); process.exit(1); }
  dict = dict.replace(s, 'export ' + s);
}
fs.writeFileSync(path.join(DASH, 'dictionary.js'), dict + '\n', 'utf-8');
console.log('[split] dictionary.js');

// ---- 2. useDashboardStats.js: useMemo body L2155-3676 ----
const hookBody = lines.slice(2154, 3676); // 0-based: L2155..L3676
const hook = [
  "import { useMemo } from 'react'",
  "import { R, findColumn, parseNum, getPriceBand, buildPriceBands, getSeasonalDataByCategory, extractFeaturesFromNames, buildDictionary } from './dictionary'",
  '',
  '/**',
  ' * 市场分析统计计算 hook（从 NewDashboard 逐字抽取，逻辑零改动）',
  ' */',
  'export function useDashboardStats(data) {',
  '  return useMemo(() => {',
  ...hookBody,
  '  }, [data])',
  '}',
  '',
].join('\n');
fs.writeFileSync(path.join(DASH, 'useDashboardStats.js'), hook, 'utf-8');
console.log('[split] useDashboardStats.js');

// ---- 3. Cards.jsx ----
const cardsSrc = `export function KPICard({ icon, title, value, sub, trend }) {
  const colors = { up: 'text-green-600 bg-green-50', down: 'text-red-600 bg-red-50', neutral: 'text-gray-600 bg-gray-50' }
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={\`p-2 rounded-lg \${colors[trend]}\`}>{icon}</div>
        <div>
          <div className="text-xs text-morandi-text-light">{title}</div>
          <div className="text-lg font-bold text-morandi-text">{value}</div>
          <div className="text-xs text-morandi-text-light">{sub}</div>
        </div>
      </div>
    </div>
  )
}

export function RecommendationCard({ title, content, color }) {
  const colors = { blue: 'border-l-blue-500 bg-blue-50', green: 'border-l-green-500 bg-green-50', purple: 'border-l-purple-500 bg-purple-50', orange: 'border-l-orange-500 bg-orange-50', red: 'border-l-red-500 bg-red-50', teal: 'border-l-teal-500 bg-teal-50' }
  return (
    <div className={\`p-4 rounded-lg border-l-4 \${colors[color]}\`}>
      <div className="font-semibold text-morandi-text mb-1">{title}</div>
      <div className="text-sm text-morandi-text-light">{content}</div>
    </div>
  )
}
`;
fs.writeFileSync(path.join(DASH, 'Cards.jsx'), cardsSrc, 'utf-8');
console.log('[split] Cards.jsx');

// ---- 4. sections ----
// JSX 区域边界（HEAD 文件 1-based 行号，经锚点验证）
const bounds = [
  { name: 'HeaderOverview', from: 3710, to: 4269, icons: ['Eye', 'ShoppingCart', 'DollarSign', 'Package', 'Target', 'BarChart3', 'Truck', 'Percent', 'Crown'], charts: ['PieChart', 'Pie', 'Cell', 'BarChart', 'Bar', 'XAxis', 'YAxis', 'Tooltip', 'ResponsiveContainer', 'LineChart', 'Line', 'CartesianGrid', 'Legend'], deps: ['R', 'fmtCNY', 'fmtCNYFull'], props: ['stats', 'data', 'CC', 'showAllSizes', 'setShowAllSizes', 'showAllMaterials', 'setShowAllMaterials'], cards: 'KPICard' },
  { name: 'HairMaskSection', from: 4272, to: 4573, icons: [], charts: ['BarChart', 'Bar', 'XAxis', 'YAxis', 'Tooltip', 'ResponsiveContainer', 'CartesianGrid'], deps: ['R'], props: ['stats', 'data'] },
  { name: 'HairSpraySection', from: 4576, to: 5340, icons: ['Download'], charts: ['BarChart', 'Bar', 'XAxis', 'YAxis', 'Tooltip', 'ResponsiveContainer', 'CartesianGrid'], deps: ['R'], props: ['stats', 'data', 'sprayExporting', 'sprayStockRef', 'exportSprayStockPDF'] },
  { name: 'GlovesSection', from: 5343, to: 5741, icons: [], charts: ['PieChart', 'Pie', 'Cell', 'BarChart', 'Bar', 'XAxis', 'YAxis', 'Tooltip', 'ResponsiveContainer', 'Legend', 'RadarChart', 'Radar', 'PolarGrid', 'PolarAngleAxis', 'PolarRadiusAxis'], deps: ['R', 'fmtCNY', 'fmtCNYFull'], props: ['stats', 'data', 'CC'] },
  { name: 'InsightsSections', from: 5743, to: 6580, icons: ['TrendingUp', 'Sparkles', 'Star', 'Zap', 'Truck'], charts: ['BarChart', 'Bar', 'XAxis', 'YAxis', 'Tooltip', 'ResponsiveContainer', 'ScatterChart', 'Scatter'], deps: ['R', 'fmtCNY', 'fmtCNYFull'], props: ['stats', 'data'], cards: 'RecommendationCard' },
];

// 用原始行号验证与原始文件的实际内容（切分发生在主 return 内部，行号即原文件行号）
const ori = fs.readFileSync(SRC, 'utf-8').split(/\r?\n/);
for (const b of bounds) {
  const body = ori.slice(b.from - 1, b.to); // 1-based from..to
  const imports = [];
  if (b.icons.length) imports.push(`import { ${b.icons.join(', ')} } from 'lucide-react'`);
  if (b.charts.length) imports.push(`import { ${b.charts.join(', ')} } from 'recharts'`);
  if (b.deps.length) imports.push(`import { ${b.deps.join(', ')} } from '../dictionary'`);
  if (b.cards) imports.push(`import { ${b.cards} } from '../Cards'`);
  const content = [
    ...imports,
    '',
    `export default function ${b.name}({ ${b.props.join(', ')} }) {`,
    '  return (',
    '    <>',
    ...body,
    '    </>',
    '  )',
    '}',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(DIR, b.name + '.jsx'), content, 'utf-8');
  console.log(`[split] ${b.name}.jsx (${body.length} lines)`);
}

// ---- 5. 重写主文件为编排层 ----
const newMain = `import { useState, useRef } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { useDashboardStats } from './dashboard/useDashboardStats'
import HeaderOverview from './dashboard/sections/HeaderOverview'
import HairMaskSection from './dashboard/sections/HairMaskSection'
import HairSpraySection from './dashboard/sections/HairSpraySection'
import GlovesSection from './dashboard/sections/GlovesSection'
import InsightsSections from './dashboard/sections/InsightsSections'

/**
 * 市场调研面板（编排层）
 * 数据计算：dashboard/useDashboardStats.js
 * 展示区块：dashboard/sections/*.jsx
 * 词库/格式化工具：dashboard/dictionary.js
 */
export default function NewDashboard({ data, kpis }) {
  const [showAllSizes, setShowAllSizes] = useState(false)
  const [showAllMaterials, setShowAllMaterials] = useState(false)
  const [sprayExporting, setSprayExporting] = useState(false)
  const sprayStockRef = useRef(null)
  const stats = useDashboardStats(data)

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <div className="text-6xl mb-6">📊</div>
          <h2 className="text-2xl font-semibold text-morandi-text mb-3">新版市场分析面板</h2>
          <p className="text-morandi-text-light">请上传Ozon分析报告数据开始分析</p>
        </div>
      </div>
    )
  }

  const CC = ['#8B9DC3', '#B4BEC9', '#C3B4D1', '#D4C4B0', '#E8D5C4', '#F0E6E0', '#D9E5D6', '#A8C5DA']

  const exportSprayStockPDF = async () => {
    setSprayExporting(true)
    try {
      const element = sprayStockRef.current
      if (!element) { setSprayExporting(false); return }
      const canvas = await html2canvas(element, { scale: 3, useCORS: true, logging: false, backgroundColor: '#ffffff' })
      const imgWidth = 210
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      const pdf = new jsPDF('p', 'mm', [imgWidth, imgHeight])
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight)
      pdf.save('精油喷雾备货计算.pdf')
    } catch (err) { console.error('Export error:', err); alert('导出失败') }
    finally { setSprayExporting(false) }
  }

  return (
    <div className="space-y-6">
      <HeaderOverview
        stats={stats}
        data={data}
        CC={CC}
        showAllSizes={showAllSizes}
        setShowAllSizes={setShowAllSizes}
        showAllMaterials={showAllMaterials}
        setShowAllMaterials={setShowAllMaterials}
      />
      {stats.isHairMaskCategory && stats.hairMaskAnalysis && (
        <HairMaskSection stats={stats} data={data} />
      )}
      {stats.isSprayCategory && stats.sprayAnalysis && (
        <HairSpraySection
          stats={stats}
          data={data}
          sprayExporting={sprayExporting}
          sprayStockRef={sprayStockRef}
          exportSprayStockPDF={exportSprayStockPDF}
        />
      )}
      {stats.isGlovesCategory && stats.nitrileGlovesData && (
        <GlovesSection stats={stats} data={data} CC={CC} />
      )}
      <InsightsSections stats={stats} data={data} />
    </div>
  )
}
`;
fs.writeFileSync(SRC, newMain, 'utf-8');
console.log('[split] NewDashboard.jsx 已重写为编排层');
