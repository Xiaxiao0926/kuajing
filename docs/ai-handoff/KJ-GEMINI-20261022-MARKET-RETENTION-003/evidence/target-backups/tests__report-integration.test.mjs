import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const app = read('../ozon-react/src/App.jsx')
const sidebar = read('../ozon-react/src/components/Sidebar.jsx')
const reportPage = read('../ozon-react/src/components/reports/MarketReportCenter.jsx')
const uploadedReport = read('../ozon-react/src/components/reports/UploadedMarketReport.jsx')
const decisionBrief = read('../ozon-react/src/components/reports/MarketDecisionBrief.jsx')
const russiaEntry = read('../ozon-react/src/components/reports/RussiaMarketEntry.jsx')
const reportAnalysis = read('../ozon-react/src/utils/marketReportAnalysis.js')
const russiaContext = read('../ozon-react/src/utils/marketReportRussiaContext.js')
const recentReports = read('../ozon-react/src/generated/recentMarketReports.js')
const featuredBriefs = read('../ozon-react/src/generated/featuredMarketBriefs.js')
const doorWindowHtml = read('../ozon-react/public/reports/doors-windows-top10/ozon-doors-windows-top10.html')
const lightingHtml = read('../ozon-react/public/reports/ozon-lighting-deep-analysis/index.html')
const generatedFurnitureHtml = read('../ozon-react/public/reports/generated/furniture/index.html')

assert.match(app, /__market_reports__/, 'App must route the report center')
assert.match(sidebar, /__market_reports__/, 'Sidebar must expose the report center')
assert.match(reportPage, /getAssetUrl\(activeReport\.path\)/, 'Report URLs must honor the WordPress asset base')
assert.match(reportPage, /role="tablist"/, 'Report center must expose reports as tabs')
assert.match(reportPage, /reports\/ozon-lighting-deep-analysis\/index\.html/, 'Lighting report must be registered')
assert.match(reportPage, /reports\/doors-windows-top10\/ozon-doors-windows-top10\.html/, 'Door and window report must remain registered')
assert.match(reportPage, /title=\{activeReport\.frameTitle\}/, 'Iframe needs a report-specific accessible title')
assert.match(reportPage, /uploadServerFile\(SOURCE_NAMESPACE, file\)/, 'Imported source workbooks must be backed up before publication')
assert.match(reportPage, /uploadServerFile\(REPORT_NAMESPACE, reportFile\)/, 'Generated reports must be published to server storage')
assert.match(reportPage, /listServerFiles\(REPORT_NAMESPACE\)/, 'Published reports must reload from shared server storage')
assert.match(reportPage, /accept="\.xlsx,\.xls,\.csv,\.json"/, 'Report center must accept Excel, CSV, and JSON imports')
assert.match(reportPage, /parseMarketReportJson/, 'Report center must parse JSON row datasets')
assert.match(reportPage, /RECENT_MARKET_REPORTS/, 'Report center must include recent raw Ozon analyses')
assert.match(reportPage, /FEATURED_MARKET_BRIEFS/, 'Featured reports must include the shared decision brief')
assert.match(reportPage, /MarketDecisionBrief/, 'Static reports must render the shared decision brief')
assert.match(reportPage, /导入并发布/, 'Report center must expose the data publication command')
assert.match(uploadedReport, /服务器私有目录/, 'Uploaded report must state its persistence boundary')
assert.match(reportAnalysis, /销售额\(₽\)/, 'Report analysis must support normalized revenue headers')
assert.match(reportAnalysis, /销售额₽/, 'Report analysis must support legacy revenue headers')
assert.match(reportAnalysis, /normalizeMarketReportRows/, 'Report analysis must normalize raw Ozon selector exports')
assert.match(reportAnalysis, /windowDays: 180/, 'Report analysis must define the 180-day new-product window')
assert.match(decisionBrief, /上架 180 天内新品对标链接/, 'Decision brief must expose linked new-product analysis')
assert.match(decisionBrief, /数据依据/, 'Recommendations must show their supporting data')
assert.match(decisionBrief, /Executive Summary/, 'Decision brief must put an executive summary before detail')
assert.match(decisionBrief, /RussiaMarketEntry/, 'Decision brief must render Russia-specific market entry analysis')
assert.match(russiaEntry, /俄罗斯市场进入分析/, 'Russia market entry section must be visible')
assert.match(russiaEntry, /品类进入优先级/, 'Russia market entry section must rank internal type opportunities')
assert.match(russiaEntry, /当前数据没有俄罗斯地区分布|gaps\.map/, 'Russia market entry section must expose evidence gaps')
assert.match(russiaEntry, /grid min-w-0/, 'Russia market grids must not force page-level mobile overflow')
assert.match(russiaContext, /96\.6/, 'Russia context must retain the domestic-platform share')
assert.match(russiaContext, /ТР ТС 018\/2011/, 'Russia context must include vehicle compliance pre-screening')
assert.match(generatedFurnitureHtml, /Executive Summary/, 'Generated reports must lead with an executive summary')
assert.match(generatedFurnitureHtml, /俄罗斯市场进入分析/, 'Generated reports must render Russia market context')
assert.match(generatedFurnitureHtml, /品类进入优先级/, 'Generated reports must render type-level entry priority')
assert.match(generatedFurnitureHtml, /akit\.ru/, 'Generated reports must link the external Russia evidence')
assert.match(generatedFurnitureHtml, /\.chart\{min-width:0;overflow:hidden/, 'Generated chart cards must not force page-level mobile overflow')
assert.match(featuredBriefs, /"lighting"/, 'Lighting report must have an upgraded decision brief')
assert.match(featuredBriefs, /"door-window"/, 'Door and window report must have an upgraded decision brief')
for (const reportId of [
  'recent-furniture-hinges-2026-09-08',
  'recent-furniture-legs-casters-2026-09-07',
  'recent-furniture-hardware-overview-2026-09-07',
]) {
  assert.match(recentReports, new RegExp(reportId), `missing recent report: ${reportId}`)
}

for (const asset of [
  '../ozon-react/public/reports/doors-windows-top10/assets/charts.js',
  '../ozon-react/public/reports/ozon-lighting-deep-analysis/assets/charts.js',
  '../ozon-react/public/reports/_shared/js/echarts.min.js',
  '../ozon-react/public/reports/_shared/fonts/InstrumentSans-Bold.ttf',
  '../ozon-react/public/reports/_shared/fonts/InstrumentSans-Regular.ttf',
  '../ozon-react/public/reports/_shared/fonts/InstrumentSerif-Regular.ttf',
]) {
  assert.ok(fs.existsSync(new URL(asset, import.meta.url)), `missing report asset: ${asset}`)
}

for (const chartId of ['chart-share', 'chart-rev', 'chart-sales', 'chart-bubble', 'chart-diffuse']) {
  assert.match(doorWindowHtml, new RegExp(`id=["']${chartId}["']`), `missing door/window chart container: ${chartId}`)
}
for (const chartId of ['chart-share', 'chart-rev', 'chart-band', 'chart-heat', 'chart-premium', 'chart-ctr', 'chart-ratio']) {
  assert.match(lightingHtml, new RegExp(`id=["']${chartId}["']`), `missing lighting chart container: ${chartId}`)
}
for (const html of [doorWindowHtml, lightingHtml]) {
  assert.match(html, /\.\.\/_shared\/js\/echarts\.min\.js/, 'Reports must load shared local ECharts')
  assert.match(html, /assets\/charts\.js/, 'Reports must load local chart definitions')
}
assert.ok(
  !fs.existsSync(new URL('../ozon-react/public/reports/_shared/js/mermaid.min.js', import.meta.url)),
  'Unused Mermaid bundle must not be shipped',
)

console.log('market report center integration contract tests passed')
