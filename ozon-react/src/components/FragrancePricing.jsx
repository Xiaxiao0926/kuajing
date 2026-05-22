import { useState, useMemo, useRef } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ResponsiveContainer
} from 'recharts'
import {
  Calculator, Target, FileText, Download,
  AlertTriangle, Users, Loader2, CheckCircle2, Circle, Zap
} from 'lucide-react'
import { NODE_DETAILS, ROADMAP_PHASES } from '../data/roadmap'

const CHANNEL_PRESETS = {
  miniapp: { name: '小程序私域', rate: 0.006 },
  douyin: { name: '抖音小店', rate: 0.056 },
  taobao: { name: '淘宝/天猫', rate: 0.066 },
  jd: { name: '京东', rate: 0.096 },
  pdd: { name: '拼多多', rate: 0.012 },
}

const COMPETITORS = [
  { brand: '名创优品', sku: '无火香薰50ml', price: 19.9, ml: 50, tier: 1, brandPower: 3, channel: '线下门店', desc: '门店遍布全国，SKU极多' },
  { brand: '名创优品', sku: '无火香薰120ml', price: 49.9, ml: 120, tier: 1, brandPower: 3, channel: '线下门店', desc: '极致性价比，所见即所得' },
  { brand: '网易严选', sku: '无火香薰150ml', price: 79, ml: 150, tier: 1, brandPower: 5, channel: '电商', desc: '大牌同厂，源头直采' },
  { brand: '京东京造', sku: '无火香薰150ml', price: 89, ml: 150, tier: 1, brandPower: 5, channel: '电商', desc: '品牌背书强，品质稳定' },
  { brand: '气味图书馆', sku: '无火香薰100ml', price: 99, ml: 100, tier: 1, brandPower: 6, channel: '电商', desc: '凉白开、大白兔情怀香型' },
  { brand: '气味图书馆', sku: '无火香薰150ml', price: 129, ml: 150, tier: 1, brandPower: 6, channel: '电商', desc: '独特香型记忆点' },
  { brand: 'Jupiter&Venus', sku: '无火香薰100ml', price: 59, ml: 100, tier: 1, brandPower: 4, channel: '电商', desc: '大牌平替，蓝风铃等香型' },
  { brand: 'Jupiter&Venus', sku: '无火香薰150ml', price: 89, ml: 150, tier: 1, brandPower: 4, channel: '电商', desc: '外观设计在线，年轻用户' },
  { brand: '冰希黎', sku: '麋鹿丛林200ml', price: 59, ml: 200, tier: 1, brandPower: 5, channel: '电商', desc: '调香师品牌，性价比高' },
  { brand: '冰希黎', sku: '精粹礼盒180ml', price: 129, ml: 180, tier: 2, brandPower: 6, channel: '电商', desc: '梨木桂花，礼盒装送礼' },
  { brand: '节气盒子', sku: '白桃乌龙100ml', price: 89, ml: 100, tier: 1, brandPower: 5, channel: '电商', desc: '节气文化，茶香系列' },
  { brand: '节气盒子', sku: '东方瓶花150ml', price: 139, ml: 150, tier: 2, brandPower: 6, channel: '电商', desc: '木兰坠露，东方美学' },
  { brand: '尹谜', sku: '无火香薰礼盒150ml', price: 79, ml: 150, tier: 1, brandPower: 3, channel: '电商', desc: '渐变瓶身，网红款' },
  { brand: '西苔CITTA', sku: '无火香薰150ml', price: 168, ml: 150, tier: 2, brandPower: 7, channel: '电商', desc: '中国植物原料，东方美学' },
  { brand: '香遇MEET YOU', sku: '无火香薰150ml', price: 158, ml: 150, tier: 2, brandPower: 6, channel: '电商', desc: '东方香调创新，定制调香' },
  { brand: '宋朝SONG DYNASTY', sku: '无火香薰150ml', price: 198, ml: 150, tier: 2, brandPower: 7, channel: '电商', desc: '宋代香文化，空间定制' },
  { brand: '芬享Felshare', sku: '醉花阴150ml', price: 120, ml: 150, tier: 2, brandPower: 5, channel: '电商', desc: '法国品牌，东方花香调' },
  { brand: 'RE调香室', sku: '莫奈花园150ml', price: 200, ml: 150, tier: 2, brandPower: 7, channel: '电商', desc: '沙龙香氛，专业调香' },
  { brand: '最忆ZUIYI', sku: '无火香薰200ml', price: 268, ml: 200, tier: 3, brandPower: 8, channel: '电商', desc: '冠军代言，东方禅意美学' },
  { brand: '观夏To Summer', sku: '无火香薰200ml', price: 368, ml: 200, tier: 3, brandPower: 9, channel: '线下+电商', desc: '东方美学，私域运营极强' },
  { brand: '野兽派The Beast', sku: '联名香薰礼盒', price: 399, ml: 200, tier: 3, brandPower: 9, channel: '线下门店', desc: 'IP联名，送礼硬通货' },
  { brand: '闻献DOCUMENTS', sku: '无火香薰200ml', price: 520, ml: 200, tier: 3, brandPower: 10, channel: '设计师店', desc: '禅酷风格，高净值人群' },
  { brand: 'meltseason', sku: '无火香薰200ml', price: 498, ml: 200, tier: 3, brandPower: 9, channel: '设计师店', desc: '国际资本，时尚圈宠儿' },
  { brand: 'KASE', sku: '情绪香氛200ml', price: 328, ml: 200, tier: 3, brandPower: 8, channel: '设计师店', desc: '情绪香氛，科学调香' },
  { brand: '黑爪BLACK PAW', sku: '龙珠茉莉180ml', price: 227, ml: 180, tier: 3, brandPower: 8, channel: '电商', desc: '茶香调，联名礼盒' },
  { brand: 'Aromame弥香', sku: '港岛酒店200ml', price: 299, ml: 200, tier: 3, brandPower: 8, channel: '电商', desc: '五星级酒店同款香氛' },
  { brand: '白牌A', sku: '无火香薰100ml', price: 29.9, ml: 100, tier: 4, brandPower: 1, channel: '拼多多', desc: '便宜大碗，品质参差' },
  { brand: '白牌B', sku: '无火香薰150ml', price: 39.9, ml: 150, tier: 4, brandPower: 1, channel: '抖音', desc: '直播间走量' },
  { brand: '白牌C', sku: '无火香薰200ml', price: 49.9, ml: 200, tier: 4, brandPower: 1, channel: '拼多多', desc: '仿大牌香型' },
]

const TIER_LABELS = { 1: '极致性价比', 2: '新锐国货', 3: '高端/设计师', 4: '白牌/工厂货' }
const TIER_COLORS = { 1: '#8B9DC3', 2: '#D4A5A5', 3: '#C3B4D1', 4: '#B0B0B0' }

const PRICE_BANDS = [
  { range: '0-50元', label: '白牌/低价区', color: '#B0B0B0', brands: '白牌、名创入门款' },
  { range: '50-100元', label: '大众品牌区', color: '#8B9DC3', brands: '名创、严选、京造、J&V、冰希黎、节气盒子、尹谜' },
  { range: '100-200元', label: '⚠️ 死亡谷', color: '#F44336', brands: '西苔、香遇、宋朝、芬享、节气盒子高端款、冰希黎礼盒' },
  { range: '200-400元', label: '高端品牌区', color: '#C3B4D1', brands: '最忆、观夏、野兽派、KASE、黑爪、Aromame弥香' },
  { range: '400元+', label: '设计师品牌区', color: '#9C27B0', brands: '闻献、meltseason' },
]

const AD_COST_BY_PRICE = [
  { label: '白牌(0-50元)', platformAd: 20, privateAd: 5, fill: '#B0B0B0' },
  { label: '大众(50-100元)', platformAd: 13, privateAd: 4, fill: '#8B9DC3' },
  { label: '新锐(100-200元)', platformAd: 15, privateAd: 4, fill: '#D4A5A5' },
  { label: '高端(200-400元)', platformAd: 25, privateAd: 6, fill: '#C3B4D1' },
  { label: '设计师(400元+)', platformAd: 28, privateAd: 8, fill: '#9C27B0' },
]

function calcProfit(p) {
  const ch = CHANNEL_PRESETS[p.channel] || CHANNEL_PRESETS.miniapp
  const costPerBottle = p.factoryPrice + p.packageCost
  const platformFee = p.retailPrice * ch.rate
  const adCost = p.retailPrice * p.adRate
  const afterSalesLoss = p.retailPrice * p.returnRate
  const grossProfit = p.retailPrice - costPerBottle
  const totalExpense = costPerBottle + p.shipping + platformFee + adCost + afterSalesLoss
  const netProfit = p.retailPrice - totalExpense
  const netRate = p.retailPrice > 0 ? netProfit / p.retailPrice : 0
  return { costPerBottle, platformFee, adCost, afterSalesLoss, grossProfit, netProfit, netRate, totalExpense }
}

function getProfitLevel(netRate) {
  if (netRate < 0.05) return { label: '亏本/不可行', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' }
  if (netRate < 0.10) return { label: '利润太薄', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' }
  if (netRate < 0.20) return { label: '可以赚钱', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' }
  return { label: '利润很好', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' }
}

function generateReport(planA, planB, resultA, resultB) {
  const chA = CHANNEL_PRESETS[planA.channel] || CHANNEL_PRESETS.miniapp
  const chB = CHANNEL_PRESETS[planB.channel] || CHANNEL_PRESETS.miniapp
  const lines = []

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('  一句话结论')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('')

  if (resultA.netRate < 0.05) {
    lines.push(`❌ 方案A不可行：净利率仅${(resultA.netRate * 100).toFixed(1)}%，卖一瓶亏一瓶`)
  } else if (resultA.netRate < 0.10) {
    lines.push(`⚠️ 方案A勉强可行：净利率${(resultA.netRate * 100).toFixed(1)}%，只能小规模私域，不能投广告`)
  } else if (resultA.netRate < 0.20) {
    lines.push(`✅ 方案A可行：净利率${(resultA.netRate * 100).toFixed(1)}%，可以适度投放广告`)
  } else {
    lines.push(`🟢 方案A利润健康：净利率${(resultA.netRate * 100).toFixed(1)}%，有充足空间做品牌投放`)
  }

  if (resultB.netRate > resultA.netRate) {
    lines.push(`✅ 方案B更优：净利率${(resultB.netRate * 100).toFixed(1)}%，每瓶净赚¥${resultB.netProfit.toFixed(1)}`)
  }

  lines.push('')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('  利润对比（每瓶）')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('')
  lines.push(`方案A  零售¥${planA.retailPrice}  出厂¥${planA.factoryPrice}  渠道:${chA.name}`)
  lines.push(`  总成本 ¥${resultA.totalExpense.toFixed(1)} = 出厂+包材¥${resultA.costPerBottle.toFixed(0)} + 物流¥${planA.shipping} + 平台费¥${resultA.platformFee.toFixed(1)} + 广告¥${resultA.adCost.toFixed(1)} + 售后¥${resultA.afterSalesLoss.toFixed(1)}`)
  lines.push(`  净利润 ¥${resultA.netProfit.toFixed(1)}/瓶  净利率 ${(resultA.netRate * 100).toFixed(1)}%`)
  lines.push('')
  lines.push(`方案B  零售¥${planB.retailPrice}  出厂¥${planB.factoryPrice}  渠道:${chB.name}`)
  lines.push(`  总成本 ¥${resultB.totalExpense.toFixed(1)} = 出厂+包材¥${resultB.costPerBottle.toFixed(0)} + 物流¥${planB.shipping} + 平台费¥${resultB.platformFee.toFixed(1)} + 广告¥${resultB.adCost.toFixed(1)} + 售后¥${resultB.afterSalesLoss.toFixed(1)}`)
  lines.push(`  净利润 ¥${resultB.netProfit.toFixed(1)}/瓶  净利率 ${(resultB.netRate * 100).toFixed(1)}%`)
  lines.push('')

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('  市场定位诊断')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('')

  if (planA.retailPrice >= 80 && planA.retailPrice <= 200) {
    lines.push(`你的定价¥${planA.retailPrice}落在"死亡谷"（80-200元）：`)
    lines.push('')
    lines.push('  向上 → 打不过野兽派、观夏（品牌力+故事+包装）')
    lines.push('  向下 → 打不过名创优品、网易严选（价格+渠道+知名度）')
    lines.push('  同级 → 宋朝、西苔、香遇都在抢这个价位段')
    lines.push('')
    lines.push('  在这个价位段活下来的品牌，都至少做到一点：')
    lines.push('  • 安全背书：母婴/宠物/孕妇可用，IFRA合规声明')
    lines.push('  • 差异化故事：调香师背景、香料产地、留香数据')
    lines.push('  • 礼品属性：包装像礼物，送人不尴尬')
  } else if (planA.retailPrice < 80) {
    lines.push(`定价¥${planA.retailPrice}走量路线，和名创优品/网易严选正面竞争。`)
    lines.push('  优势：价格门槛低，容易起量')
    lines.push('  风险：利润薄，品牌溢价为零，只能靠渠道和供应链效率取胜')
  } else {
    lines.push(`定价¥${planA.retailPrice}进入高端区间，需要强品牌力支撑。`)
    lines.push('  优势：单瓶利润高，品牌溢价空间大')
    lines.push('  风险：没有观夏/野兽派的品牌积累，消费者不买单')
  }

  lines.push('')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('  行动建议')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('')

  if (resultA.netRate < 0.10 && resultB.netRate >= 0.10) {
    lines.push(`1. 降价放量：出厂价从¥${planA.factoryPrice}降到¥${planB.factoryPrice}，净利率从${(resultA.netRate * 100).toFixed(1)}%提升到${(resultB.netRate * 100).toFixed(1)}%`)
    lines.push(`   月销从500瓶可提升到3000+瓶，工厂年出货量提升约6倍`)
  }

  if (planA.channel === 'miniapp') {
    lines.push('2. 走私域小程序：平台费率仅0.6%，是利润最高的渠道')
    lines.push('   但私域流量有限，需要搭配内容种草引流')
  } else {
    lines.push(`2. 当前渠道${chA.name}费率${(chA.rate * 100).toFixed(1)}%，走私域小程序仅0.6%，利润空间更大`)
  }

  lines.push('3. 包材升级：消费者在100-200元价位最在意"开箱体验"')
  lines.push('   礼盒+手提袋+感谢卡，成本增加5-8元，但溢价空间20-50元')

  if (resultA.netRate >= 0.10) {
    lines.push('4. 广告投放：净利率>10%可以开始投流，先投小红书种草，再转小程序成交')
  } else {
    lines.push('4. 暂不投广告：净利率<10%投广告会亏，先做私域积累口碑')
  }

  lines.push('5. 安全合规：提供IFRA声明+MSDS报告，这是和白牌拉开差距的最低门槛')

  return lines.join('\n')
}

function InputField({ label, value, onChange, suffix, step, min, max }) {
  return (
    <div>
      <label className="text-[10px] font-medium text-morandi-text-light mb-1 block">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          step={step}
          min={min}
          max={max}
          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-morandi-primary"
        />
        {suffix && <span className="text-[10px] text-morandi-text-light flex-shrink-0">{suffix}</span>}
      </div>
    </div>
  )
}

function PlanPanel({ title, plan, onChange, color }) {
  return (
    <div className={`rounded-xl border ${color.border} overflow-hidden`}>
      <div className={`px-4 py-3 ${color.bg} border-b ${color.border}`}>
        <h4 className={`text-xs font-bold ${color.text}`}>{title}</h4>
      </div>
      <div className="p-4 space-y-2.5">
        <InputField label="出厂价" value={plan.factoryPrice} onChange={v => onChange({ ...plan, factoryPrice: v })} suffix="元/瓶" />
        <InputField label="建议零售价" value={plan.retailPrice} onChange={v => onChange({ ...plan, retailPrice: v })} suffix="元" />
        <InputField label="包材成本" value={plan.packageCost} onChange={v => onChange({ ...plan, packageCost: v })} suffix="元" />
        <InputField label="物流费用" value={plan.shipping} onChange={v => onChange({ ...plan, shipping: v })} suffix="元/单" />
        <InputField label="广告费占比" value={(plan.adRate * 100).toFixed(0)} onChange={v => onChange({ ...plan, adRate: v / 100 })} suffix="%" step={1} min={0} max={50} />
        <InputField label="售后损耗率" value={(plan.returnRate * 100).toFixed(0)} onChange={v => onChange({ ...plan, returnRate: v / 100 })} suffix="%" step={1} min={0} max={30} />
        <div>
          <label className="text-[10px] font-medium text-morandi-text-light mb-1 block">销售渠道</label>
          <select value={plan.channel} onChange={e => onChange({ ...plan, channel: e.target.value })} className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-morandi-primary">
            {Object.entries(CHANNEL_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.name}(费率{(v.rate * 100).toFixed(1)}%)</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

export default function FragrancePricing({ nodeId = 'n36', status = 'pending', onStatusChange }) {
  const detail = NODE_DETAILS[nodeId]
  const phase = ROADMAP_PHASES.find(p => p.nodes.some(n => n.id === nodeId))
  const [planA, setPlanA] = useState({ channel: 'miniapp', factoryPrice: 80, retailPrice: 168, packageCost: 15, shipping: 12, adRate: 0.15, returnRate: 0.05 })
  const [planB, setPlanB] = useState({ channel: 'miniapp', factoryPrice: 55, retailPrice: 128, packageCost: 12, shipping: 12, adRate: 0.12, returnRate: 0.05 })
  const [exporting, setExporting] = useState(false)
  
  const headerRef = useRef(null)
  const customerRef = useRef(null)
  const brandPanoramaRef = useRef(null)
  const competitorTableRef = useRef(null)
  const planPanelRef = useRef(null)
  const profitCardsRef = useRef(null)
  const waterfallRef = useRef(null)
  const adCostRef = useRef(null)
  const reportRef = useRef(null)

  const resultA = useMemo(() => calcProfit(planA), [planA])
  const resultB = useMemo(() => calcProfit(planB), [planB])
  const levelA = getProfitLevel(resultA.netRate)
  const levelB = getProfitLevel(resultB.netRate)
  const chA = CHANNEL_PRESETS[planA.channel] || CHANNEL_PRESETS.miniapp
  const chB = CHANNEL_PRESETS[planB.channel] || CHANNEL_PRESETS.miniapp

  const waterfallA = [
    { name: '零售价', value: planA.retailPrice, fill: '#8B9DC3' },
    { name: '出厂+包材', value: -resultA.costPerBottle, fill: '#D4A5A5' },
    { name: '物流', value: -planA.shipping, fill: '#D4C4B0' },
    { name: '平台费', value: -resultA.platformFee, fill: '#C3B4D1' },
    { name: '广告费', value: -resultA.adCost, fill: '#FF9800' },
    { name: '售后损耗', value: -resultA.afterSalesLoss, fill: '#E57373' },
    { name: '净利', value: resultA.netProfit, fill: resultA.netRate >= 0.1 ? '#4CAF50' : resultA.netRate >= 0.05 ? '#FF9800' : '#F44336' },
  ]

  const waterfallB = [
    { name: '零售价', value: planB.retailPrice, fill: '#8B9DC3' },
    { name: '出厂+包材', value: -resultB.costPerBottle, fill: '#D4A5A5' },
    { name: '物流', value: -planB.shipping, fill: '#D4C4B0' },
    { name: '平台费', value: -resultB.platformFee, fill: '#C3B4D1' },
    { name: '广告费', value: -resultB.adCost, fill: '#FF9800' },
    { name: '售后损耗', value: -resultB.afterSalesLoss, fill: '#E57373' },
    { name: '净利', value: resultB.netProfit, fill: resultB.netRate >= 0.1 ? '#4CAF50' : resultB.netRate >= 0.05 ? '#FF9800' : '#F44336' },
  ]

  const reportText = generateReport(planA, planB, resultA, resultB)

  const handleExportPDF = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
      const pdfW = pdf.internal.pageSize.getWidth()
      const pdfH = pdf.internal.pageSize.getHeight()
      const margin = 5
      const usableW = pdfW - margin * 2
      const images = []

      const refs = [
        { ref: headerRef, name: 'header' },
        { ref: customerRef, name: 'customer' },
        { ref: brandPanoramaRef, name: 'brand' },
        { ref: competitorTableRef, name: 'table' },
        { ref: planPanelRef, name: 'plan' },
        { ref: profitCardsRef, name: 'profit' },
        { ref: waterfallRef, name: 'waterfall' },
        { ref: adCostRef, name: 'adcost' },
        { ref: reportRef, name: 'report' },
      ]

      for (const { ref } of refs) {
        if (!ref.current) continue
        const el = ref.current
        el.style.overflow = 'visible'
        el.style.maxHeight = 'none'
        await new Promise(r => setTimeout(r, 100))
        
        const canvas = await html2canvas(el, {
          scale: 3,
          useCORS: true,
          backgroundColor: '#f5f5f0',
          logging: false,
        })
        images.push(canvas)
      }

      let yPos = margin
      images.forEach((canvas, index) => {
        const imgW = canvas.width
        const imgH = canvas.height
        const ratio = usableW / imgW
        const imgPdfH = imgH * ratio

        if (yPos + imgPdfH > pdfH - margin && index > 0) {
          pdf.addPage()
          yPos = margin
        }

        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', margin, yPos, usableW, imgPdfH)
        yPos += imgPdfH + 5
      })

      pdf.save('香薰产品调研分析报告.pdf')
    } catch (e) {
      console.error('PDF export failed:', e)
      alert('PDF生成失败: ' + e.message)
    } finally {
      setExporting(false)
    }
  }

  const tierStats = [1, 2, 3, 4].map(tier => {
    const items = COMPETITORS.filter(c => c.tier === tier)
    const avgPrice = items.reduce((s, c) => s + c.price, 0) / items.length
    return { tier, label: TIER_LABELS[tier], count: items.length, avgPrice: avgPrice.toFixed(0), color: TIER_COLORS[tier] }
  })

  const priceBandData = PRICE_BANDS.map(band => {
    const min = parseFloat(band.range.split('-')[0]) || 0
    const max = parseFloat(band.range.split('-')[1]) || 9999
    const items = COMPETITORS.filter(c => c.price >= min && c.price < max)
    return { ...band, count: items.length, brands: band.brands }
  })

  return (
    <div className="space-y-5">
      <div ref={headerRef} className="mb-4">
        <div className="flex items-center gap-2 text-xs text-morandi-text-light mb-1">
          <span>{phase?.title}</span>
        </div>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-morandi-text flex items-center gap-3">
            <span className="text-3xl">{detail?.icon || '🧴'}</span>
            {detail?.title || '香薰产品调研'}
          </h2>
          <div className="flex items-center gap-2">
            {status === 'done' ? (
              <button onClick={() => onStatusChange?.(nodeId, 'pending')} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 transition-colors">
                <CheckCircle2 className="w-4 h-4" /> 已完成
              </button>
            ) : status === 'active' ? (
              <div className="flex items-center gap-1.5">
                <button onClick={() => onStatusChange?.(nodeId, 'done')} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600 transition-colors">
                  <CheckCircle2 className="w-4 h-4" /> 标记完成
                </button>
                <button onClick={() => onStatusChange?.(nodeId, 'pending')} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors">
                  取消
                </button>
              </div>
            ) : (
              <button onClick={() => onStatusChange?.(nodeId, 'active')} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-200 transition-colors">
                <Zap className="w-4 h-4" /> 开始执行
              </button>
            )}
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-morandi-primary rounded-lg hover:bg-morandi-primary/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {exporting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />生成中...</> : <><Download className="w-3.5 h-3.5" />导出PDF</>}
            </button>
          </div>
        </div>
        <p className="text-sm text-morandi-text-light mt-1">{detail?.desc}</p>
      </div>

      <div ref={customerRef} className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-5 border border-blue-100">
        <div className="flex items-start gap-3">
          <Users className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-700 mb-1">目标客户群体</p>
            <p className="text-sm text-morandi-text leading-relaxed">
              核心客户是<b className="text-blue-700">公务员/体制内人群</b>，注重品质和面子、偏好私域/礼品渠道、复购率较高。
              主要走<b className="text-blue-700">小程序私域</b>销售，支付费率仅0.6%，无平台佣金，适合送礼场景。
            </p>
          </div>
        </div>
      </div>

      <div ref={brandPanoramaRef} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-base font-semibold text-morandi-text mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-morandi-primary" />
          国内无火香薰市场品牌全景图（2026年）
        </h3>
        <div className="grid grid-cols-4 gap-3 mb-5">
          {tierStats.map(t => (
            <div key={t.tier} className="rounded-lg p-4 border text-center" style={{ borderColor: t.color + '40' }}>
              <div className="flex items-center justify-center gap-1.5 mb-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                <span className="text-xs font-semibold text-morandi-text">{t.label}</span>
              </div>
              <p className="text-2xl font-bold text-morandi-text">{t.count}</p>
              <p className="text-xs text-morandi-text-light">均价¥{t.avgPrice}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-5 mb-5">
          <div>
            <p className="text-xs font-semibold text-morandi-text mb-2">价格带分布</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={priceBandData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div className="bg-white p-2 shadow-lg rounded text-xs border">
                      <p className="font-semibold">{d.range} · {d.label}</p>
                      <p>{d.count}个品牌</p>
                      <p className="text-morandi-text-light">{d.brands}</p>
                    </div>
                  )
                }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} name="品牌数">
                  {priceBandData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-morandi-text mb-1">价格带解读</p>
            <div className="rounded-lg p-2.5 bg-gray-50 border border-gray-100">
              <p className="text-xs text-morandi-text"><b>0-50元</b>：白牌低价区，拼价格没利润</p>
            </div>
            <div className="rounded-lg p-2.5 bg-blue-50 border border-blue-200">
              <p className="text-xs text-blue-700"><b>50-100元</b>：名创/严选/京造/J&V/冰希黎/节气盒子/尹谜，极致性价比</p>
            </div>
            <div className="rounded-lg p-2.5 bg-red-50 border border-red-200">
              <p className="text-xs text-red-700"><b>100-200元</b>：⚠️ 死亡谷！西苔/香遇/宋朝/芬享/RE调香室/冰希黎礼盒，你的168元在这里</p>
            </div>
            <div className="rounded-lg p-2.5 bg-purple-50 border border-purple-200">
              <p className="text-xs text-purple-700"><b>200元+</b>：观夏/野兽派/闻献/黑爪/Aromame弥香/最忆/KASE，需要品牌沉淀</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-5">
          <div className="rounded-lg p-3.5 border border-gray-100" style={{ borderLeftWidth: 3, borderLeftColor: TIER_COLORS[1] }}>
            <p className="text-sm font-bold text-morandi-text mb-1">第一梯队：极致性价比（30-80元）</p>
            <p className="text-xs text-morandi-text-light leading-relaxed">市场基本盘，走量为主。名创优品门店遍布全国SKU极多；网易严选/京东京造大牌同厂源头直采；气味图书馆凉白开情怀香型；J&V大牌平替蓝风铃等香型；冰希黎调香师品牌性价比高；节气盒子节气文化茶香系列；尹谜渐变瓶身网红款。</p>
          </div>
          <div className="rounded-lg p-3.5 border border-red-200 bg-red-50/30" style={{ borderLeftWidth: 3, borderLeftColor: '#F44336' }}>
            <p className="text-sm font-bold text-red-700 mb-1">第二梯队：中端礼品/新锐国货（80-200元）← 你的168元在这里</p>
            <p className="text-xs text-morandi-text-light leading-relaxed">西苔中国植物原料东方美学；香遇东方香调创新定制调香；宋朝宋代香文化空间定制；芬享法国品牌东方花香调；RE调香室沙龙香氛专业调香；冰希黎礼盒装梨木桂花；节气盒子东方瓶花木兰坠露。这个区间品牌各有故事和设计，竞争激烈。</p>
          </div>
          <div className="rounded-lg p-3.5 border border-gray-100" style={{ borderLeftWidth: 3, borderLeftColor: TIER_COLORS[3] }}>
            <p className="text-sm font-bold text-morandi-text mb-1">第三梯队：高端/设计师品牌（200-500元+）</p>
            <p className="text-xs text-morandi-text-light leading-relaxed">品牌溢价极高。野兽派IP联名送礼硬通货；观夏东方美学私域运营极强；闻献禅酷风格高净值人群；meltseason国际资本时尚圈宠儿；KASE情绪香氛科学调香；黑爪茶香调联名礼盒；Aromame弥香五星级酒店同款；最忆冠军代言东方禅意美学。</p>
          </div>
          <div className="rounded-lg p-3.5 border border-gray-100" style={{ borderLeftWidth: 3, borderLeftColor: TIER_COLORS[4] }}>
            <p className="text-sm font-bold text-morandi-text mb-1">第四梯队：白牌/工厂货（20-50元）</p>
            <p className="text-xs text-morandi-text-light leading-relaxed">拼多多/抖音直播间走量，便宜大碗，拉低了整个市场的价格底线，让消费者对"香薰"心理价位普遍偏低。</p>
          </div>
        </div>
      </div>

      <div ref={competitorTableRef} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left py-2.5 px-3 font-semibold text-morandi-text">品牌</th>
                <th className="text-left py-2.5 px-3 font-semibold text-morandi-text">产品</th>
                <th className="text-right py-2.5 px-3 font-semibold text-morandi-text">售价</th>
                <th className="text-right py-2.5 px-3 font-semibold text-morandi-text">容量</th>
                <th className="text-center py-2.5 px-3 font-semibold text-morandi-text">梯队</th>
                <th className="text-left py-2.5 px-3 font-semibold text-morandi-text">核心优势</th>
                <th className="text-left py-2.5 px-3 font-semibold text-morandi-text">渠道</th>
              </tr>
            </thead>
            <tbody>
              {COMPETITORS.map((c, i) => {
                const isDeathValley = c.price >= 100 && c.price <= 200
                return (
                  <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50/30 ${isDeathValley ? 'bg-red-50/30' : ''}`}>
                    <td className="py-2 px-3 font-medium text-morandi-text">{c.brand}</td>
                    <td className="py-2 px-3 text-morandi-text-light">{c.sku}</td>
                    <td className="py-2 px-3 text-right font-semibold text-morandi-text">¥{c.price}</td>
                    <td className="py-2 px-3 text-right text-morandi-text-light">{c.ml}ml</td>
                    <td className="py-2 px-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: TIER_COLORS[c.tier] + '20', color: TIER_COLORS[c.tier] }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: TIER_COLORS[c.tier] }} />
                        {TIER_LABELS[c.tier]}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-morandi-text-light">{c.desc}</td>
                    <td className="py-2 px-3 text-morandi-text-light">{c.channel}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-xs text-morandi-text-light flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          红色底色行 = 100-200元"新锐品牌死亡谷"区间，品牌力不够就很难卖动
        </div>
      </div>

      <div ref={planPanelRef} className="grid grid-cols-2 gap-5">
        <PlanPanel title="方案A（当前）" plan={planA} onChange={setPlanA} color={{ bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' }} />
        <PlanPanel title="方案B（优化）" plan={planB} onChange={setPlanB} color={{ bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' }} />
      </div>

      <div ref={profitCardsRef} className="grid grid-cols-2 gap-5">
        <div className={`rounded-xl border ${levelA.border} overflow-hidden`}>
          <div className={`px-5 py-4 ${levelA.bg} flex items-center justify-between`}>
            <div>
              <p className="text-xs font-medium text-morandi-text-light">方案A · 零售价¥{planA.retailPrice}</p>
              <p className={`text-3xl font-bold ${levelA.color}`}>¥{resultA.netProfit.toFixed(2)}</p>
              <p className="text-xs text-morandi-text-light">每瓶净利</p>
            </div>
            <div className="text-right">
              <p className={`text-lg font-bold ${levelA.color}`}>{(resultA.netRate * 100).toFixed(1)}%</p>
              <p className={`text-xs px-2.5 py-1 rounded-full ${levelA.bg} ${levelA.color} border ${levelA.border}`}>{levelA.label}</p>
            </div>
          </div>
          <div className="px-5 py-3 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-morandi-text-light">出厂+包材</span><span className="font-semibold text-morandi-text">¥{resultA.costPerBottle.toFixed(0)}</span></div>
            <div className="flex justify-between"><span className="text-morandi-text-light">物流</span><span className="font-semibold text-morandi-text">¥{planA.shipping}</span></div>
            <div className="flex justify-between"><span className="text-morandi-text-light">平台费({chA.name}{(chA.rate * 100).toFixed(1)}%)</span><span className="font-semibold text-morandi-text">¥{resultA.platformFee.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-morandi-text-light">广告费({(planA.adRate * 100).toFixed(0)}%)</span><span className="font-semibold text-morandi-text">¥{resultA.adCost.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-morandi-text-light">售后损耗({(planA.returnRate * 100).toFixed(0)}%)</span><span className="font-semibold text-morandi-text">¥{resultA.afterSalesLoss.toFixed(2)}</span></div>
            <div className="flex justify-between border-t border-gray-100 pt-1 mt-1"><span className="text-morandi-text-light font-semibold">总成本</span><span className="font-bold text-morandi-text">¥{resultA.totalExpense.toFixed(2)}</span></div>
          </div>
        </div>
        <div className={`rounded-xl border ${levelB.border} overflow-hidden`}>
          <div className={`px-5 py-4 ${levelB.bg} flex items-center justify-between`}>
            <div>
              <p className="text-xs font-medium text-morandi-text-light">方案B · 零售价¥{planB.retailPrice}</p>
              <p className={`text-3xl font-bold ${levelB.color}`}>¥{resultB.netProfit.toFixed(2)}</p>
              <p className="text-xs text-morandi-text-light">每瓶净利</p>
            </div>
            <div className="text-right">
              <p className={`text-lg font-bold ${levelB.color}`}>{(resultB.netRate * 100).toFixed(1)}%</p>
              <p className={`text-xs px-2.5 py-1 rounded-full ${levelB.bg} ${levelB.color} border ${levelB.border}`}>{levelB.label}</p>
            </div>
          </div>
          <div className="px-5 py-3 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-morandi-text-light">出厂+包材</span><span className="font-semibold text-morandi-text">¥{resultB.costPerBottle.toFixed(0)}</span></div>
            <div className="flex justify-between"><span className="text-morandi-text-light">物流</span><span className="font-semibold text-morandi-text">¥{planB.shipping}</span></div>
            <div className="flex justify-between"><span className="text-morandi-text-light">平台费({chB.name}{(chB.rate * 100).toFixed(1)}%)</span><span className="font-semibold text-morandi-text">¥{resultB.platformFee.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-morandi-text-light">广告费({(planB.adRate * 100).toFixed(0)}%)</span><span className="font-semibold text-morandi-text">¥{resultB.adCost.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-morandi-text-light">售后损耗({(planB.returnRate * 100).toFixed(0)}%)</span><span className="font-semibold text-morandi-text">¥{resultB.afterSalesLoss.toFixed(2)}</span></div>
            <div className="flex justify-between border-t border-gray-100 pt-1 mt-1"><span className="text-morandi-text-light font-semibold">总成本</span><span className="font-bold text-morandi-text">¥{resultB.totalExpense.toFixed(2)}</span></div>
          </div>
        </div>
      </div>

      <div ref={waterfallRef} className="grid grid-cols-2 gap-5">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-morandi-text mb-3">方案A 钱去哪了</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={waterfallA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `¥${v}`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => `¥${Math.abs(v).toFixed(2)}`} />
              <Bar dataKey="value">
                {waterfallA.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-morandi-text mb-3">方案B 钱去哪了</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={waterfallB}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `¥${v}`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => `¥${Math.abs(v).toFixed(2)}`} />
              <Bar dataKey="value">
                {waterfallB.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div ref={adCostRef} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-base font-semibold text-morandi-text mb-1">不同价位段广告费占比参考</h3>
        <p className="text-xs text-morandi-text-light mb-4">数据来源：行业公开财报及投流数据估算 | 野兽派广告费约占售价25%，三只松鼠平台推广费约13%</p>
        <div className="space-y-4">
          {AD_COST_BY_PRICE.map(item => {
            const total = item.platformAd + item.privateAd
            const platformW = (item.platformAd / total) * 100
            const privateW = (item.privateAd / total) * 100
            return (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-morandi-text">{item.label}</span>
                  <span className="text-xs text-morandi-text-light">合计 {total}%</span>
                </div>
                <div className="flex h-9 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-center text-white text-xs font-bold" style={{ width: `${platformW}%`, backgroundColor: item.fill }}>
                    平台广告 {item.platformAd}%
                  </div>
                  <div className="flex items-center justify-center text-morandi-text text-xs font-bold bg-gray-200" style={{ width: `${privateW}%` }}>
                    私域运营 {item.privateAd}%
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
          <p className="text-xs text-amber-700 leading-relaxed">💡 私域小程序渠道广告费可降低50-70%，但需要前期内容种草积累用户；平台渠道起量快但广告费持续消耗</p>
        </div>
      </div>

      <div ref={reportRef} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-base font-semibold text-morandi-text flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-morandi-primary" />
          分析结论
        </h3>
        <div className="bg-gray-50 rounded-lg p-5 text-sm text-morandi-text whitespace-pre-wrap leading-relaxed">{reportText}</div>
      </div>
    </div>
  )
}