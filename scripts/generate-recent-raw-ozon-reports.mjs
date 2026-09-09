import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from '../ozon-react/node_modules/xlsx/xlsx.mjs'
import { buildUploadedMarketReport } from '../ozon-react/src/utils/marketReportAnalysis.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT_PATH = path.join(ROOT, 'ozon-react', 'src', 'generated', 'recentMarketReports.js')
const FEATURED_OUTPUT_PATH = path.join(ROOT, 'ozon-react', 'src', 'generated', 'featuredMarketBriefs.js')

const REPORTS = [
  {
    file: 'ozon-2026-09-08.csv',
    id: 'recent-furniture-hinges-2026-09-08',
    label: '家具合页与门合页',
    snapshot: '2026-09-08',
    featured: false,
    recommendations: [
      '首轮把家具合页与门合页拆成两个测试组，分别按基础款、缓冲款和重载/特殊尺寸款建立规格梯度。',
      '优先核验材质、表面处理、孔距、开合角度和单包数量；低客单商品应先测算多件装与跨境运费。',
      '高缺货天数只能视为供给波动线索，需结合评价、在售状态和中国工厂交期二次确认后再备货。',
    ],
  },
  {
    file: 'ozon-2026-09-07 (1).csv',
    id: 'recent-furniture-legs-casters-2026-09-07',
    label: '家具支脚与脚轮',
    snapshot: '2026-09-07',
    featured: false,
    recommendations: [
      '家具支脚与脚轮应分开立项，支脚按高度/承重/安装方式，脚轮按直径/材质/刹车结构建立对标表。',
      '1,000–2,000 ₽ 价格带贡献最高，适合优先寻找成套、重载或功能型产品，而不是只比最低单价。',
      '上架前补齐包装体积、单套重量和安装配件清单，避免高件均收入被跨境物流与缺件售后吞噬。',
    ],
  },
  {
    file: 'ozon-2026-09-07.csv',
    id: 'recent-furniture-hardware-overview-2026-09-07',
    label: '家具五金综合',
    snapshot: '2026-09-07',
    featured: false,
    recommendations: [
      '先从合页、导轨、把手、保护贴和支脚五个头部方向各选 2–3 个规格，不建议一次铺满全部子类目。',
      '低于 500 ₽ 的商品贡献较高，优先设计多件装、组合装和维修套装，提高订单价值并降低单件物流占比。',
      '无品牌样本较多，适合中国供应链切入，但必须以尺寸兼容、材料说明、安装图和稳定交期建立差异。',
    ],
  },
  {
    file: 'ozon-2026-09-04.csv',
    id: 'lighting',
    label: '照明与车灯',
    snapshot: '2026-09-04',
    featured: true,
  },
  {
    file: 'ozon-2026-09-02.csv',
    id: 'door-window',
    label: '门窗五金',
    snapshot: '2026-09-02',
    featured: true,
  },
]

function argumentValue(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function parseCsv(filePath) {
  const workbook = XLSX.read(fs.readFileSync(filePath, 'utf8'), { type: 'string' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) throw new Error(`CSV 中没有可读取的数据表：${path.basename(filePath)}`)
  return XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false })
}

function enhance(report, config) {
  const unknownBrand = report.topBrands.find((item) => item.name === '未知/无品牌')
  const topType = report.topTypes[0]
  const under500Revenue = report.priceBands.slice(0, 2).reduce((sum, item) => sum + item.revenue, 0)
  const topFiveRevenue = report.topTypes.slice(0, 5).reduce((sum, item) => sum + item.revenue, 0)
  const percentage = (value) => report.kpis.totalRevenue > 0
    ? Math.round((value / report.kpis.totalRevenue) * 1000) / 10
    : 0

  return {
    ...report,
    kind: 'embedded',
    group: '家居与维修',
    source: 'Ozon 原始抓取 CSV（本地字段清洗）',
    publishedAt: `${config.snapshot}T00:00:00.000Z`,
    sourceHash: config.sourceHash,
    insights: [
      `头部产品类型“${topType.name}”贡献 ${topType.share}% 样本销售额；前五类型合计 ${percentage(topFiveRevenue)}%。`,
      `低于 500 ₽ 的两个价格带合计贡献 ${percentage(under500Revenue)}% 样本销售额，适合优先核算多件装与组合装。`,
      `未知/无品牌商品贡献 ${unknownBrand?.share || 0}% 样本销售额，说明供应链切入空间与同质化风险同时存在。`,
      `销量字段覆盖率 ${report.quality.salesCoverage}%；SKU 重复 ${report.quality.duplicateSku} 条、商品链接重复 ${report.quality.duplicateUrl} 条，未对缺失值作推算。`,
    ],
    persistenceNote: '源 CSV 保留在用户提供的本地数据文件中；网站只发布聚合指标、类目榜单和对标商品，不公开完整原始明细。',
  }
}

function decisionBrief(report) {
  return {
    id: report.id,
    label: report.label,
    snapshot: report.snapshot,
    kpis: report.kpis,
    marketDimensions: report.marketDimensions,
    recommendations: report.recommendations,
    newProducts: report.newProducts,
    quality: report.quality,
  }
}

const sourceDir = argumentValue('--source-dir') || process.env.OZON_RAW_REPORT_DIR
if (!sourceDir) throw new Error('请通过 --source-dir 或 OZON_RAW_REPORT_DIR 指定原始 CSV 目录。')

const generated = REPORTS.map((config) => {
  const sourcePath = path.resolve(sourceDir, config.file)
  if (!fs.existsSync(sourcePath)) throw new Error(`缺少原始 CSV：${sourcePath}`)
  const rawRows = parseCsv(sourcePath)
  const baseReport = buildUploadedMarketReport(rawRows, {
    id: config.id,
    label: config.label,
    snapshot: config.snapshot,
    sourceFile: config.file,
    sourceFormat: 'CSV',
    publishedAt: `${config.snapshot}T00:00:00.000Z`,
  })
  return {
    report: enhance(baseReport, { ...config, sourceHash: sha256(sourcePath) }),
    urls: new Set(rawRows.map((row) => row['ld9-z3 href']).filter(Boolean)),
  }
})

const recentGenerated = generated.filter((item) => !REPORTS.find((config) => config.id === item.report.id)?.featured)
const reports = recentGenerated.map((item) => item.report)
const hingeUrls = generated.find((item) => item.report.id === 'recent-furniture-hinges-2026-09-08').urls
const overviewUrls = generated.find((item) => item.report.id === 'recent-furniture-hardware-overview-2026-09-07').urls
const overlapCount = [...hingeUrls].filter((url) => overviewUrls.has(url)).length
reports.find((report) => report.id === 'recent-furniture-hinges-2026-09-08').insights.push(`与 9 月 7 日家具五金综合样本共有 ${overlapCount} 个商品链接；两份数据覆盖范围不同，应分别看作专项样本与综合样本，而不是重复报告。`)
reports.find((report) => report.id === 'recent-furniture-hardware-overview-2026-09-07').insights.push(`与 9 月 8 日合页专项样本共有 ${overlapCount} 个商品链接；综合样本适合找方向，专项样本适合继续拆规格与竞品。`)

const featuredBriefs = Object.fromEntries(generated
  .filter((item) => REPORTS.find((config) => config.id === item.report.id)?.featured)
  .map((item) => [item.report.id, decisionBrief(item.report)]))

const source = `// Generated by scripts/generate-recent-raw-ozon-reports.mjs. Do not edit manually.\nexport const RECENT_MARKET_REPORTS = ${JSON.stringify(reports, null, 2)}\n`
fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
fs.writeFileSync(OUTPUT_PATH, source, 'utf8')
fs.writeFileSync(FEATURED_OUTPUT_PATH, `// Generated by scripts/generate-recent-raw-ozon-reports.mjs. Do not edit manually.\nexport const FEATURED_MARKET_BRIEFS = ${JSON.stringify(featuredBriefs, null, 2)}\n`, 'utf8')
console.log(`Generated ${reports.length} recent reports and ${Object.keys(featuredBriefs).length} featured briefs.`)
