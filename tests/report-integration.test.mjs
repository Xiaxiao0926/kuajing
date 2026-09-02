import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const app = read('../ozon-react/src/App.jsx')
const sidebar = read('../ozon-react/src/components/Sidebar.jsx')
const reportPage = read('../ozon-react/src/components/reports/DoorWindowHardwareReport.jsx')
const reportHtml = read('../ozon-react/public/reports/doors-windows-top10/ozon-doors-windows-top10.html')

assert.match(app, /__door_window_report__/, 'App must route the report page')
assert.match(sidebar, /__door_window_report__/, 'Sidebar must expose the report page')
assert.match(reportPage, /getAssetUrl\(REPORT_PATH\)/, 'Report URL must honor the WordPress asset base')
assert.match(reportPage, /title="门窗五金 TOP 10 品类详细分析报告"/, 'Iframe needs an accessible title')

for (const asset of [
  '../ozon-react/public/reports/doors-windows-top10/assets/charts.js',
  '../ozon-react/public/reports/doors-windows-top10/_shared/js/echarts.min.js',
  '../ozon-react/public/reports/doors-windows-top10/_shared/fonts/InstrumentSans-Bold.ttf',
  '../ozon-react/public/reports/doors-windows-top10/_shared/fonts/InstrumentSans-Regular.ttf',
  '../ozon-react/public/reports/doors-windows-top10/_shared/fonts/InstrumentSerif-Regular.ttf',
]) {
  assert.ok(fs.existsSync(new URL(asset, import.meta.url)), `missing report asset: ${asset}`)
}

for (const chartId of ['chart-share', 'chart-rev', 'chart-sales', 'chart-bubble', 'chart-diffuse']) {
  assert.match(reportHtml, new RegExp(`id=["']${chartId}["']`), `missing chart container: ${chartId}`)
}
assert.match(reportHtml, /_shared\/js\/echarts\.min\.js/, 'Report must load local ECharts')
assert.match(reportHtml, /assets\/charts\.js/, 'Report must load local chart definitions')
assert.ok(
  !fs.existsSync(new URL('../ozon-react/public/reports/doors-windows-top10/_shared/js/mermaid.min.js', import.meta.url)),
  'Unused Mermaid bundle must not be shipped',
)

console.log('report integration contract tests passed')
