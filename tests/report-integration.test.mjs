import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const app = read('../ozon-react/src/App.jsx')
const sidebar = read('../ozon-react/src/components/Sidebar.jsx')
const reportPage = read('../ozon-react/src/components/reports/MarketReportCenter.jsx')
const doorWindowHtml = read('../ozon-react/public/reports/doors-windows-top10/ozon-doors-windows-top10.html')
const lightingHtml = read('../ozon-react/public/reports/ozon-lighting-deep-analysis/index.html')

assert.match(app, /__market_reports__/, 'App must route the report center')
assert.match(sidebar, /__market_reports__/, 'Sidebar must expose the report center')
assert.match(reportPage, /getAssetUrl\(activeReport\.path\)/, 'Report URLs must honor the WordPress asset base')
assert.match(reportPage, /role="tablist"/, 'Report center must expose reports as tabs')
assert.match(reportPage, /reports\/ozon-lighting-deep-analysis\/index\.html/, 'Lighting report must be registered')
assert.match(reportPage, /reports\/doors-windows-top10\/ozon-doors-windows-top10\.html/, 'Door and window report must remain registered')
assert.match(reportPage, /title=\{activeReport\.frameTitle\}/, 'Iframe needs a report-specific accessible title')

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
