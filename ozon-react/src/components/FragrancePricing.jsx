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
import { CHANNEL_PRESETS, COMPETITORS, TIER_LABELS, TIER_COLORS, PRICE_BANDS, AD_COST_BY_PRICE, calcProfit, getProfitLevel, generateReport } from './fragrancePricing/data'
import { PlanPanel } from './fragrancePricing/PlanPanel'

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
