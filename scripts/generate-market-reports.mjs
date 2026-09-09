import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from '../ozon-react/node_modules/xlsx/xlsx.mjs'
import { buildUploadedMarketReport } from '../ozon-react/src/utils/marketReportAnalysis.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_DIR = path.join(ROOT, '市场分析', '市场bsr')
const OUTPUT_DIR = path.join(ROOT, 'ozon-react', 'public', 'reports', 'generated')
const CATALOG_PATH = path.join(ROOT, 'ozon-react', 'src', 'generated', 'marketReports.js')
const RUB_PER_CNY = 13

const REPORTS = [
  ['2026-07-22宠物用品', '宠物用品', '宠物与生活', 'pet-products'],
  ['2026-07-22家具', '家具', '家居与维修', 'furniture'],
  ['2026-07-22汽车', '汽车综合', '汽车生态', 'automotive'],
  ['2026-07-23车库汽车服务', '车库与汽车服务', '汽车生态', 'garage-service'],
  ['2026-07-23车体配件', '车体配件', '汽车生态', 'body-parts'],
  ['2026-07-23成人用品', '成人用品', '宠物与生活', 'adult-products'],
  ['2026-07-23乘用车配件', '乘用车配件', '汽车生态', 'passenger-car-parts'],
  ['2026-07-23家装修理', '家装与修理', '家居与维修', 'home-repair'],
  ['2026-07-23卡车配件', '卡车配件', '汽车生态', 'truck-parts'],
  ['2026-07-23轮胎轮毂', '轮胎与轮毂', '汽车生态', 'tires-wheels'],
  ['2026-07-23摩托车配件', '摩托车配件', '汽车生态', 'motorcycle-parts'],
  ['2026-07-23汽车电池', '汽车电池', '汽车生态', 'car-batteries'],
  ['2026-07-23汽车电子', '汽车电子', '汽车生态', 'car-electronics'],
  ['2026-07-23汽车防盗', '汽车防盗', '汽车生态', 'car-security'],
  ['2026-07-23汽车工具和雨刮', '汽车工具与雨刮', '汽车生态', 'tools-wipers'],
  ['2026-07-23汽车紧固件', '汽车紧固件', '汽车生态', 'fasteners'],
  ['2026-07-23汽车清洁', '汽车清洁', '汽车生态', 'car-cleaning'],
  ['2026-07-23汽车用品', '汽车用品', '汽车生态', 'car-accessories'],
  ['2026-07-23手机平板智能穿戴', '手机、平板与智能穿戴', '数码产品', 'mobile-wearables'],
].map(([fileKey, label, group, slug]) => ({
  file: `ozon-${fileKey}_清洗版.xlsx`,
  snapshot: fileKey.slice(0, 10),
  label,
  group,
  slug,
}))

const FIELD_ALIASES = {
  image: ['产品图片'],
  url: ['产品链接'],
  name: ['产品名称'],
  brand: ['品牌名', '品牌'],
  seller: ['卖家名称', '卖家'],
  sku: ['SKU'],
  type: ['产品类型'],
  revenue: ['销售额(₽)', '销售额₽'],
  sales: ['销量(件)', '销量'],
  avgPrice: ['平均售价(₽)', '平均销售价格₽'],
  signRate: ['签收率(%)', '签收率'],
  missedRevenue: ['错失销售额(₽)', '错过的销售额₽'],
  stockoutDays: ['无库存天数(近28天)', '无库存天数'],
  promoDays: ['促销天数(近28天)', '促销天数'],
  adDays: ['推广天数(近28天)', '推广天数'],
  bsr: ['BSR标签'],
}

const UNKNOWN_VALUES = new Set(['', '-', '--', 'none', 'null', 'n/a', 'без бренда', 'no brand', 'not specified', '未标记'])
const PRICE_BANDS = [
  { label: '<200 ₽', min: 0, max: 200 },
  { label: '200–500 ₽', min: 200, max: 500 },
  { label: '500–1,000 ₽', min: 500, max: 1000 },
  { label: '1,000–2,000 ₽', min: 1000, max: 2000 },
  { label: '2,000–5,000 ₽', min: 2000, max: 5000 },
  { label: '≥5,000 ₽', min: 5000, max: Infinity },
]

function valueFrom(row, aliases) {
  for (const key of aliases) {
    const value = row[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return null
}

function numeric(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (value === null || value === undefined || value === '') return null
  const normalized = String(value)
    .replace(/[\s\u00a0₽%]/g, '')
    .replace(',', '.')
    .replace(/[^0-9.+-]/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function text(value, fallback = '未知') {
  const normalized = value === null || value === undefined ? '' : String(value).trim()
  return normalized || fallback
}

function normalizedEntity(value, kind) {
  const raw = text(value, '')
  if (UNKNOWN_VALUES.has(raw.toLocaleLowerCase('ru-RU'))) {
    return kind === 'brand' ? '未知/无品牌' : '未知卖家'
  }
  return raw
}

function round(value, digits = 2) {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function pct(numerator, denominator) {
  return denominator > 0 ? round((numerator / denominator) * 100, 1) : 0
}

function median(values) {
  const valid = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!valid.length) return null
  const middle = Math.floor(valid.length / 2)
  return valid.length % 2 ? valid[middle] : (valid[middle - 1] + valid[middle]) / 2
}

function aggregateBy(rows, field) {
  const result = new Map()
  for (const row of rows) {
    const key = row[field]
    const current = result.get(key) || { name: key, rows: 0, revenue: 0, sales: 0, salesRows: 0 }
    current.rows += 1
    current.revenue += row.revenue || 0
    if (row.sales !== null) {
      current.sales += row.sales
      current.salesRows += 1
    }
    result.set(key, current)
  }
  return [...result.values()].map((item) => ({
    ...item,
    revenue: round(item.revenue),
    sales: round(item.sales),
    unitRevenue: item.sales > 0 ? round(item.revenue / item.sales) : null,
  }))
}

function rowModel(row) {
  const model = {}
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) model[field] = valueFrom(row, aliases)
  return {
    image: text(model.image, ''),
    url: text(model.url, ''),
    name: text(model.name),
    brand: normalizedEntity(model.brand, 'brand'),
    seller: normalizedEntity(model.seller, 'seller'),
    sku: text(model.sku, ''),
    type: text(model.type, '未分类'),
    revenue: numeric(model.revenue),
    sales: numeric(model.sales),
    avgPrice: numeric(model.avgPrice),
    signRate: numeric(model.signRate),
    missedRevenue: numeric(model.missedRevenue),
    stockoutDays: numeric(model.stockoutDays),
    promoDays: numeric(model.promoDays),
    adDays: numeric(model.adDays),
    bsr: text(model.bsr, ''),
  }
}

function buildAnalysis(report, rawRows) {
  const rows = rawRows.map(rowModel)
  const rowCount = rows.length
  const totalRevenue = rows.reduce((sum, row) => sum + (row.revenue || 0), 0)
  const salesRows = rows.filter((row) => row.sales !== null)
  const totalSales = salesRows.reduce((sum, row) => sum + row.sales, 0)
  const namedBrands = new Set(rows.filter((row) => row.brand !== '未知/无品牌').map((row) => row.brand))
  const namedSellers = new Set(rows.filter((row) => row.seller !== '未知卖家').map((row) => row.seller))
  const skuValues = rows.map((row) => row.sku).filter(Boolean)
  const urlValues = rows.map((row) => row.url).filter(Boolean)

  const typeRows = aggregateBy(rows, 'type').sort((a, b) => b.revenue - a.revenue)
  const brandRows = aggregateBy(rows, 'brand').sort((a, b) => b.revenue - a.revenue)
  const sellerRows = aggregateBy(rows, 'seller').sort((a, b) => b.revenue - a.revenue)

  const priceBands = PRICE_BANDS.map((band) => {
    const matches = rows.filter((row) => row.avgPrice !== null && row.avgPrice >= band.min && row.avgPrice < band.max)
    const revenue = matches.reduce((sum, row) => sum + (row.revenue || 0), 0)
    const sales = matches.reduce((sum, row) => sum + (row.sales || 0), 0)
    return { label: band.label, rows: matches.length, revenue: round(revenue), sales: round(sales), share: pct(revenue, totalRevenue) }
  })

  const validSignRates = rows.map((row) => row.signRate).filter(Number.isFinite)
  const validStockout = rows.map((row) => row.stockoutDays).filter(Number.isFinite)
  const validMissed = rows.map((row) => row.missedRevenue).filter(Number.isFinite)
  const validPromo = rows.map((row) => row.promoDays).filter(Number.isFinite)
  const validAd = rows.map((row) => row.adDays).filter(Number.isFinite)
  const missingSales = rowCount - salesRows.length
  const missingAveragePrice = rows.filter((row) => row.avgPrice === null).length
  const missingBsr = rows.filter((row) => !row.bsr).length
  const duplicateSku = skuValues.length - new Set(skuValues).size
  const duplicateUrl = urlValues.length - new Set(urlValues).size
  const salesCoverage = pct(salesRows.length, rowCount)
  const qualityLevel = salesCoverage >= 95 ? '核心口径完整' : salesCoverage >= 85 ? '可用，需留意缺失' : '谨慎解读销量'
  const strongestBand = [...priceBands].sort((a, b) => b.revenue - a.revenue)[0]
  const topFiveTypeRevenue = typeRows.slice(0, 5).reduce((sum, item) => sum + item.revenue, 0)
  const topTenBrandRevenue = brandRows.slice(0, 10).reduce((sum, item) => sum + item.revenue, 0)

  return {
    id: `generated-${report.slug}`,
    label: report.label,
    title: `Ozon ${report.label}市场分析`,
    group: report.group,
    snapshot: report.snapshot,
    sourceFile: report.file,
    path: `reports/generated/${report.slug}/index.html`,
    frameTitle: `Ozon ${report.label}市场分析报告`,
    kpis: {
      rowCount,
      totalRevenue: round(totalRevenue),
      totalSales: round(totalSales),
      unitRevenue: totalSales > 0 ? round(totalRevenue / totalSales) : null,
      typeCount: typeRows.length,
      brandCount: namedBrands.size,
      sellerCount: namedSellers.size,
    },
    topTypes: typeRows.slice(0, 10).map((item) => ({ ...item, share: pct(item.revenue, totalRevenue) })),
    topBrands: brandRows.slice(0, 10).map((item) => ({ ...item, share: pct(item.revenue, totalRevenue) })),
    topSellers: sellerRows.slice(0, 10).map((item) => ({ ...item, share: pct(item.revenue, totalRevenue) })),
    priceBands,
    topProducts: [...rows]
      .filter((row) => row.revenue !== null)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 15)
      .map((row) => ({
        name: row.name,
        brand: row.brand,
        seller: row.seller,
        type: row.type,
        revenue: round(row.revenue),
        sales: row.sales === null ? null : round(row.sales),
        avgPrice: row.avgPrice,
        url: row.url,
      })),
    operations: {
      signRateMedian: median(validSignRates),
      signRateCoverage: pct(validSignRates.length, rowCount),
      stockoutMedian: median(validStockout),
      stockoutCoverage: pct(validStockout.length, rowCount),
      missedRevenue: round(validMissed.reduce((sum, value) => sum + value, 0)),
      missedRevenueCoverage: pct(validMissed.length, rowCount),
      promoActiveShare: validPromo.length ? pct(validPromo.filter((value) => value > 0).length, validPromo.length) : null,
      promoCoverage: pct(validPromo.length, rowCount),
      adActiveShare: validAd.length ? pct(validAd.filter((value) => value > 0).length, validAd.length) : null,
      adCoverage: pct(validAd.length, rowCount),
    },
    quality: {
      level: qualityLevel,
      salesCoverage,
      missingSales,
      missingAveragePrice,
      missingBsr,
      duplicateSku,
      duplicateUrl,
      uniqueSku: new Set(skuValues).size,
      urlCoverage: pct(urlValues.length, rowCount),
    },
    insights: [
      `头部品类“${typeRows[0]?.name || '未分类'}”贡献 ${pct(typeRows[0]?.revenue || 0, totalRevenue)}% 销售额；前五品类合计 ${pct(topFiveTypeRevenue, totalRevenue)}%。`,
      `销售额最集中的价格带是 ${strongestBand.label}，覆盖 ${strongestBand.rows} 条商品记录，贡献 ${strongestBand.share}% 销售额。`,
      `前十品牌（含未知/无品牌桶）合计贡献 ${pct(topTenBrandRevenue, totalRevenue)}% 销售额；该指标反映样本集中度，不等同于完整市场份额。`,
      `销量字段覆盖率为 ${salesCoverage}%；报告以销售额作为主排序口径，销量与件均额只在有值记录上汇总。`,
    ],
  }
}

function formatRub(value) {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value)
}

function formatCompact(value) {
  if (value >= 1e9) return `${round(value / 1e9, 2)} 十亿 ₽`
  if (value >= 1e6) return `${round(value / 1e6, 1)} 百万 ₽`
  if (value >= 1e3) return `${round(value / 1e3, 1)} 千 ₽`
  return `${formatRub(value)} ₽`
}

function formatCount(value) {
  if (value >= 1e6) return `${round(value / 1e6, 2)} 百万`
  if (value >= 1e3) return `${round(value / 1e3, 1)} 千`
  return formatRub(value)
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function htmlFor(analysis) {
  const dataJson = JSON.stringify(analysis).replaceAll('</script', '<\\/script')
  const recommendationRows = analysis.recommendations.map((item) => `
    <div class="recommendation"><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.confidence)}置信度</span></div><p>${escapeHtml(item.recommendation)}</p><small>数据依据：${item.evidence.map(escapeHtml).join(' · ')}</small></div>`).join('')
  const newProductRows = analysis.newProducts.map((item, index) => `
    <tr><td>${index + 1}</td><td class="product-name"><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.name)}</a></td><td>${escapeHtml(item.type)}</td><td class="number">${item.ageDays} 天</td><td class="number">${item.revenue === null ? '—' : formatRub(item.revenue)}</td><td class="number">${item.sales === null ? '—' : formatRub(item.sales)}</td><td class="number">${item.avgPrice === null ? '—' : formatRub(item.avgPrice)}</td></tr>`).join('')
  const productRows = analysis.topProducts.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td class="product-name">${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.name)}</a>` : escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.type)}</td>
      <td>${escapeHtml(item.brand)}</td>
      <td class="number">${formatRub(item.revenue)}</td>
      <td class="number">${item.sales === null ? '—' : formatRub(item.sales)}</td>
      <td class="number">${item.avgPrice === null ? '—' : formatRub(item.avgPrice)}</td>
    </tr>`).join('')

  const typeRows = analysis.topTypes.map((item, index) => `
    <tr><td>${index + 1}</td><td>${escapeHtml(item.name)}</td><td class="number">${item.rows}</td><td class="number">${formatRub(item.revenue)}</td><td class="number">${formatRub(item.sales)}</td><td class="number">${item.share}%</td></tr>`).join('')

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(analysis.title)}</title>
  <style>
    @font-face{font-family:InstrumentSans;src:url('../../_shared/fonts/InstrumentSans-Regular.ttf') format('truetype');font-weight:400;font-display:swap}
    @font-face{font-family:InstrumentSans;src:url('../../_shared/fonts/InstrumentSans-Bold.ttf') format('truetype');font-weight:700;font-display:swap}
    @font-face{font-family:InstrumentSerif;src:url('../../_shared/fonts/InstrumentSerif-Regular.ttf') format('truetype');font-weight:400;font-display:swap}
    :root{--paper:#fff;--canvas:#f4f6f7;--ink:#182027;--muted:#62707d;--rule:#dfe4e8;--navy:#174a67;--teal:#16877d;--red:#b84943;--gold:#b9792b;--soft:#edf4f6}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--canvas);color:var(--ink);font-family:InstrumentSans,"Microsoft YaHei","PingFang SC",sans-serif;line-height:1.65;-webkit-font-smoothing:antialiased}.wrap{width:min(1120px,calc(100% - 40px));margin:0 auto}
    .cover{background:#173a50;color:#fff;padding:58px 0 78px;border-bottom:6px solid var(--teal)}.eyebrow{font-size:12px;font-weight:700;color:#a9d8d2;text-transform:uppercase}.cover h1{font-family:InstrumentSerif,"Songti SC",serif;font-weight:400;font-size:42px;line-height:1.15;margin:12px 0}.cover p{max-width:820px;color:#d8e4ea;margin:0}.meta{display:flex;gap:18px;flex-wrap:wrap;margin-top:22px;font-size:13px;color:#bdd0da}.rate{display:inline-block;margin-top:18px;border:1px solid rgba(255,255,255,.24);padding:6px 10px;border-radius:4px;font-size:12px;color:#d8e4ea}
    .kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-top:-42px}.kpi{background:var(--paper);border:1px solid var(--rule);border-top:3px solid var(--teal);padding:16px;box-shadow:0 7px 18px rgba(20,40,52,.08)}.kpi span{display:block}.kpi .label{font-size:12px;color:var(--muted)}.kpi .value{margin-top:5px;font-size:21px;font-weight:700}.kpi .hint{margin-top:2px;font-size:11px;color:var(--muted)}
    main{padding:34px 0 50px}.quality{display:flex;align-items:flex-start;gap:14px;background:#fff;border:1px solid var(--rule);border-left:4px solid var(--gold);padding:15px 17px;margin-bottom:34px}.quality strong{white-space:nowrap}.quality p{margin:0;color:var(--muted);font-size:13px}.section{margin:0 0 42px}.section-head{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center;margin-bottom:8px}.section-no{display:grid;place-items:center;width:30px;height:30px;background:var(--navy);color:#fff;font-size:13px;font-weight:700}.section h2{font-family:InstrumentSerif,"Songti SC",serif;font-size:28px;font-weight:400;margin:0}.lead{color:var(--muted);font-size:14px;margin:0 0 18px;max-width:880px}
    .insights{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.insight{background:var(--paper);border:1px solid var(--rule);padding:16px 18px;font-size:14px}.insight b{color:var(--red);margin-right:7px}.charts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.chart{background:var(--paper);border:1px solid var(--rule);padding:16px}.chart h3{font-size:14px;margin:0 0 8px}.chart-box{height:340px}.chart.wide{grid-column:1/-1}.chart.wide .chart-box{height:380px}
    .table-wrap{background:#fff;border:1px solid var(--rule);overflow:auto;max-height:600px}table{width:100%;border-collapse:collapse;min-width:760px;font-size:13px}th{position:sticky;top:0;background:#244b61;color:#fff;text-align:left;padding:10px 12px;white-space:nowrap;z-index:1}td{padding:10px 12px;border-top:1px solid var(--rule);vertical-align:top}tbody tr:nth-child(even){background:#f7f9fa}.number{text-align:right;white-space:nowrap}.product-name{min-width:260px;max-width:420px}.product-name a{color:var(--navy);text-decoration:none}.product-name a:hover{text-decoration:underline}
    .ops{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.op{background:#fff;border-bottom:3px solid var(--navy);padding:15px}.op .label{font-size:12px;color:var(--muted)}.op .value{font-size:20px;font-weight:700;margin-top:5px}.op .coverage{font-size:11px;color:var(--muted);margin-top:2px}.recommendations{display:grid;gap:10px}.recommendation{background:#fff;border-left:3px solid var(--teal);padding:15px 17px}.recommendation>div{display:flex;justify-content:space-between;gap:12px}.recommendation span{font-size:11px;color:var(--teal);white-space:nowrap}.recommendation p{margin:7px 0;font-size:14px}.recommendation small{color:var(--muted)}.notes{background:#edf4f6;border:1px solid #d4e2e5;padding:18px 20px}.notes ul{margin:0;padding-left:20px}.notes li{margin:6px 0;font-size:13px;color:#4f5f6b}
    footer{background:#192a35;color:#b9c8d1;padding:34px 0;font-size:12px}footer strong{color:#fff}footer p{margin:6px 0}footer code{color:#d5e1e7;overflow-wrap:anywhere}.empty-chart{height:100%;display:grid;place-items:center;color:var(--muted);font-size:13px}
    @media(max-width:900px){.kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.charts{grid-template-columns:1fr}.chart.wide{grid-column:auto}.ops{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:620px){.wrap{width:min(100% - 24px,1120px)}.cover{padding:38px 0 62px}.cover h1{font-size:32px}.kpis{grid-template-columns:repeat(2,minmax(0,1fr));margin-top:-30px}.kpi:last-child{grid-column:1/-1}.insights{grid-template-columns:1fr}.quality{display:block}.quality strong{display:block;margin-bottom:5px}.chart{padding:12px}.chart-box{height:300px}.ops{grid-template-columns:1fr 1fr}.op .value{font-size:17px}}
    @media print{body{background:#fff}.cover{padding:30px 0}.kpis{margin-top:18px}.chart{break-inside:avoid}.section{break-inside:auto}}
  </style>
</head>
<body>
  <header class="cover"><div class="wrap">
    <div class="eyebrow">Ozon BSR1000 · 类目结构报告</div>
    <h1>${escapeHtml(analysis.label)}市场分析</h1>
    <p>以清洗后的商品级记录观察类目规模、价格结构、品牌与卖家集中度。销售额为核心排序口径；报告不把榜单样本外推为 Ozon 全站市场规模。</p>
    <div class="rate">主货币：俄罗斯卢布 · 人民币仅按内部估算 1 CNY = ${RUB_PER_CNY} RUB 换算</div>
    <div class="meta"><span>数据快照：${analysis.snapshot}</span><span>记录：${analysis.kpis.rowCount.toLocaleString('zh-CN')} 条</span><span>来源：用户提供的 Ozon 清洗表</span></div>
  </div></header>

  <div class="wrap">
    <div class="kpis">
      <div class="kpi"><span class="label">样本销售额</span><span class="value">${formatCompact(analysis.kpis.totalRevenue)}</span><span class="hint">约 ${round(analysis.kpis.totalRevenue / RUB_PER_CNY / 1e6, 1)} 百万元人民币</span></div>
      <div class="kpi"><span class="label">已记录销量</span><span class="value">${formatCount(analysis.kpis.totalSales)} 件</span><span class="hint">覆盖 ${analysis.quality.salesCoverage}% 商品记录</span></div>
      <div class="kpi"><span class="label">销售额 / 已记录销量</span><span class="value">${analysis.kpis.unitRevenue === null ? '—' : `${formatRub(analysis.kpis.unitRevenue)} ₽`}</span><span class="hint">统计比值，不等同商品标价</span></div>
      <div class="kpi"><span class="label">产品类型</span><span class="value">${analysis.kpis.typeCount}</span><span class="hint">按清洗表“产品类型”字段</span></div>
      <div class="kpi"><span class="label">品牌 / 卖家</span><span class="value">${analysis.kpis.brandCount} / ${analysis.kpis.sellerCount}</span><span class="hint">排除未知桶后的去重数</span></div>
    </div>
  </div>

  <main class="wrap">
    <div class="quality"><strong>${escapeHtml(analysis.quality.level)}</strong><p>销售额字段用于主分析；销量缺失 ${analysis.quality.missingSales} 条，均价缺失 ${analysis.quality.missingAveragePrice} 条，BSR 标签缺失 ${analysis.quality.missingBsr} 条。SKU 重复 ${analysis.quality.duplicateSku} 条，但产品链接重复 ${analysis.quality.duplicateUrl} 条，因此按商品记录保留，不擅自去重。</p></div>

    <section class="section">
      <div class="section-head"><span class="section-no">01</span><h2>先看结论</h2></div>
      <p class="lead">这些结论直接来自当前 1,000 条左右的榜单样本，用于形成采购假设与进一步调研优先级，不构成利润承诺。</p>
      <div class="insights">${analysis.insights.map((item, index) => `<div class="insight"><b>0${index + 1}</b>${escapeHtml(item)}</div>`).join('')}</div>
    </section>

    <section class="section">
      <div class="section-head"><span class="section-no">02</span><h2>市场结构</h2></div>
      <p class="lead">从产品类型、成交价格带、品牌和卖家四个维度交叉观察。图表中的销售额均为样本汇总，不代表平台完整类目规模。</p>
      <div class="charts">
        <div class="chart wide"><h3>头部产品类型：销售额与样本份额</h3><div id="chart-types" class="chart-box"></div></div>
        <div class="chart"><h3>价格带结构</h3><div id="chart-bands" class="chart-box"></div></div>
        <div class="chart"><h3>头部品牌销售额</h3><div id="chart-brands" class="chart-box"></div></div>
        <div class="chart wide"><h3>头部卖家销售额</h3><div id="chart-sellers" class="chart-box"></div></div>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><span class="section-no">03</span><h2>有数据支撑的选品建议</h2></div>
      <p class="lead">建议由当前样本自动生成。覆盖率不足的指标会降低置信度，不把曝光、断货或新品身份单独当作需求证明。</p>
      <div class="recommendations">${recommendationRows}</div>
    </section>

    <section class="section">
      <div class="section-head"><span class="section-no">04</span><h2>上架 180 天内新品链接</h2></div>
      <p class="lead">相对于 ${analysis.snapshot} 快照计算；有效日期覆盖 ${analysis.quality.listingDateCoverage}%，共识别 ${analysis.quality.freshProductCount} 个新品。未来日期、异常旧日期和缺失日期均不进入清单。</p>
      ${newProductRows ? `<div class="table-wrap"><table><thead><tr><th>#</th><th>产品</th><th>类型</th><th class="number">已上架</th><th class="number">销售额(₽)</th><th class="number">销量</th><th class="number">均价(₽)</th></tr></thead><tbody>${newProductRows}</tbody></table></div>` : '<div class="notes">当前没有同时满足有效日期、180 天窗口和有效商品链接的记录。</div>'}
    </section>

    <section class="section">
      <div class="section-head"><span class="section-no">05</span><h2>头部类型明细</h2></div>
      <p class="lead">先确认需求集中在哪些产品类型，再进入单品、规格、物流成本与合规验证。销量缺失记录不会被填零。</p>
      <div class="table-wrap"><table><thead><tr><th>#</th><th>产品类型</th><th class="number">记录数</th><th class="number">销售额(₽)</th><th class="number">已记录销量</th><th class="number">销售额份额</th></tr></thead><tbody>${typeRows}</tbody></table></div>
    </section>

    <section class="section">
      <div class="section-head"><span class="section-no">06</span><h2>运营信号</h2></div>
      <p class="lead">运营指标只汇总有值记录，并同时展示覆盖率；覆盖率不足时只能作为线索，不能直接据此决定备货。</p>
      <div class="ops">
        <div class="op"><div class="label">签收率中位数</div><div class="value">${analysis.operations.signRateMedian === null ? '—' : `${round(analysis.operations.signRateMedian * 100, 1)}%`}</div><div class="coverage">字段覆盖 ${analysis.operations.signRateCoverage}%</div></div>
        <div class="op"><div class="label">无库存天数中位数</div><div class="value">${analysis.operations.stockoutMedian === null ? '—' : `${round(analysis.operations.stockoutMedian, 1)} 天`}</div><div class="coverage">字段覆盖 ${analysis.operations.stockoutCoverage}%</div></div>
        <div class="op"><div class="label">有促销记录占比</div><div class="value">${analysis.operations.promoActiveShare === null ? '—' : `${analysis.operations.promoActiveShare}%`}</div><div class="coverage">字段覆盖 ${analysis.operations.promoCoverage}%</div></div>
        <div class="op"><div class="label">有推广记录占比</div><div class="value">${analysis.operations.adActiveShare === null ? '—' : `${analysis.operations.adActiveShare}%`}</div><div class="coverage">字段覆盖 ${analysis.operations.adCoverage}%</div></div>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><span class="section-no">07</span><h2>头部商品观察</h2></div>
      <p class="lead">按销售额列出头部记录，点击名称可回到 Ozon 商品页核验。这里用于拆规格、卖点和评价，不建议直接照搬产品。</p>
      <div class="table-wrap"><table><thead><tr><th>#</th><th>产品</th><th>类型</th><th>品牌</th><th class="number">销售额(₽)</th><th class="number">销量</th><th class="number">均价(₽)</th></tr></thead><tbody>${productRows}</tbody></table></div>
    </section>

    <section class="section">
      <div class="section-head"><span class="section-no">08</span><h2>使用边界与下一步</h2></div>
      <div class="notes"><ul>
        <li>数据粒度是清洗表中的商品记录。SKU 可能重复，但产品链接未重复，因此本报告不进行无依据合并。</li>
        <li>样本来自 BSR1000 类榜单，适合比较样本内部结构，不等于 Ozon 全市场份额，也不代表未来销量。</li>
        <li>销售额、销量和均价属于市场信号；利润判断仍需补齐采购价、包装尺寸、渠道费率、退货、税费和汇率。</li>
        <li>建议从头部类型中挑 3–5 个具体规格，再核验俄罗斯评论痛点、中国货源、认证要求和物流可行性。</li>
      </ul></div>
    </section>
  </main>

  <footer><div class="wrap"><strong>数据来源与口径</strong><p>用户提供的清洗工作簿：<code>${escapeHtml(analysis.sourceFile)}</code></p><p>生成方式：本地批量分析脚本；未调用外部市场数据，未补写缺失值。生成于 ${new Date().toISOString().slice(0, 10)}。</p></div></footer>
  <script>window.REPORT_DATA=${dataJson}</script>
  <script src="../../_shared/js/echarts.min.js"></script>
  <script src="../../_shared/js/generated-market-report.js"></script>
</body>
</html>`
}

function catalogSource(analyses) {
  const records = analyses.map((analysis) => ({
    id: analysis.id,
    label: analysis.label,
    title: analysis.title,
    group: analysis.group,
    snapshot: analysis.snapshot,
    source: 'Ozon 清洗版 BSR1000',
    sample: `${analysis.kpis.rowCount.toLocaleString('zh-CN')} 条记录`,
    path: analysis.path,
    frameTitle: analysis.frameTitle,
    quality: analysis.quality.level,
    decisionBrief: {
      id: analysis.id,
      label: analysis.label,
      snapshot: analysis.snapshot,
      kpis: analysis.kpis,
      marketDimensions: analysis.marketDimensions,
      recommendations: analysis.recommendations,
      newProducts: analysis.newProducts,
      quality: analysis.quality,
    },
  }))
  return `// Generated by scripts/generate-market-reports.mjs. Do not edit manually.\nexport const GENERATED_MARKET_REPORTS = ${JSON.stringify(records, null, 2)}\n`
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true })
fs.mkdirSync(path.dirname(CATALOG_PATH), { recursive: true })

const analyses = []
for (const report of REPORTS) {
  const sourcePath = path.join(SOURCE_DIR, report.file)
  if (!fs.existsSync(sourcePath)) throw new Error(`Missing source workbook: ${sourcePath}`)
  const workbook = XLSX.read(fs.readFileSync(sourcePath), { type: 'buffer', cellDates: false })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: null })
  const analysis = {
    ...buildUploadedMarketReport(rawRows, {
      id: `generated-${report.slug}`,
      label: report.label,
      snapshot: report.snapshot,
      sourceFile: report.file,
      sourceFormat: 'Excel',
    }),
    kind: 'generated',
    group: report.group,
    path: `reports/generated/${report.slug}/index.html`,
    frameTitle: `Ozon ${report.label}市场分析报告`,
  }
  const reportDir = path.join(OUTPUT_DIR, report.slug)
  fs.mkdirSync(reportDir, { recursive: true })
  fs.writeFileSync(path.join(reportDir, 'index.html'), htmlFor(analysis), 'utf8')
  fs.writeFileSync(path.join(reportDir, 'analysis.json'), `${JSON.stringify(analysis, null, 2)}\n`, 'utf8')
  analyses.push(analysis)
}

const qualitySummary = {
  generatedAt: new Date().toISOString(),
  sourceDirectory: '市场分析/市场bsr',
  reportCount: analyses.length,
  reports: analyses.map((analysis) => ({
    id: analysis.id,
    label: analysis.label,
    sourceFile: analysis.sourceFile,
    rowCount: analysis.kpis.rowCount,
    quality: analysis.quality,
  })),
}

fs.writeFileSync(path.join(OUTPUT_DIR, 'quality-summary.json'), `${JSON.stringify(qualitySummary, null, 2)}\n`, 'utf8')
fs.writeFileSync(CATALOG_PATH, catalogSource(analyses), 'utf8')
console.log(`Generated ${analyses.length} market reports in ${OUTPUT_DIR}`)
