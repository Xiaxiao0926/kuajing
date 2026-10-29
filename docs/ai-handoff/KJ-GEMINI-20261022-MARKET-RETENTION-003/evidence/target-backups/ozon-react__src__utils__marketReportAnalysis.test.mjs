import assert from 'node:assert/strict'
import {
  buildUploadedMarketReport,
  getMarketImportType,
  inferMarketReportLabel,
  isUploadedMarketReport,
  normalizeMarketReportRows,
  parseMarketReportJson,
  stableMarketReportId,
} from './marketReportAnalysis.js'
import { buildRussiaMarketContext } from './marketReportRussiaContext.js'

const normalizedRows = [
  { 产品名称: 'A', 产品类型: '猫砂', 品牌名: '甲', 卖家名称: '店甲', SKU: '1', 产品链接: 'https://example.com/1', '销售额(₽)': 1000, '销量(件)': 10, '平均售价(₽)': 100, '签收率(%)': 0.9, BSR标签: '销售领导者' },
  { 产品名称: 'B', 产品类型: '猫砂', 品牌名: 'без бренда', 卖家名称: '店乙', SKU: '1', 产品链接: 'https://example.com/2', '销售额(₽)': 2000, '销量(件)': null, '平均售价(₽)': 600, '签收率(%)': 0.95, BSR标签: null },
]

const report = buildUploadedMarketReport(normalizedRows, { sourceFile: 'ozon-2026-07-22宠物用品_清洗版.xlsx' })
assert.equal(report.label, '宠物用品')
assert.equal(report.snapshot, '2026-07-22')
assert.equal(report.kpis.totalRevenue, 3000)
assert.equal(report.kpis.totalSales, 10)
assert.equal(report.quality.salesCoverage, 50)
assert.equal(report.quality.duplicateSku, 1)
assert.equal(report.quality.duplicateUrl, 0)
assert.equal(report.topTypes[0].name, '猫砂')
assert.equal(report.topBrands[0].name, '未知/无品牌')
assert.ok(isUploadedMarketReport(report))

const legacyReport = buildUploadedMarketReport([
  { 产品名称: 'C', 产品类型: '雨刮', 品牌: '乙', 卖家: '店丙', SKU: '3', 产品链接: 'https://example.com/3', '销售额₽': 500, 销量: 5, '平均销售价格₽': 100, 签收率: 0.8 },
], { sourceFile: 'legacy.xls' })
assert.equal(legacyReport.kpis.totalRevenue, 500)
assert.equal(legacyReport.kpis.totalSales, 5)
assert.equal(legacyReport.priceBands[0].revenue, 500)

const unsafeUrlReport = buildUploadedMarketReport([
  { 产品名称: 'D', 产品类型: '测试', '销售额₽': 100, 产品链接: 'javascript:alert(1)' },
], { sourceFile: 'unsafe.xlsx' })
assert.equal(unsafeUrlReport.topProducts[0].url, '')

assert.equal(inferMarketReportLabel('ozon-2026-07-23汽车清洁_清洗版.xlsx'), '汽车清洁')
assert.equal(inferMarketReportLabel('ozon-2026-07-23汽车清洁_清洗版.csv'), '汽车清洁')
assert.equal(inferMarketReportLabel('ozon-2026-07-23汽车清洁_清洗版.json'), '汽车清洁')
assert.equal(getMarketImportType('data.xlsx'), 'Excel')
assert.equal(getMarketImportType('data.CSV'), 'CSV')
assert.equal(getMarketImportType('data.json'), 'JSON')
assert.equal(getMarketImportType('data.txt'), null)
assert.deepEqual(parseMarketReportJson('[{"销售额₽":100}]'), [{ '销售额₽': 100 }])
assert.deepEqual(parseMarketReportJson('{"rows":[{"销售额₽":200}]}'), [{ '销售额₽': 200 }])
assert.deepEqual(parseMarketReportJson('{"data":[{"销售额₽":300}]}'), [{ '销售额₽': 300 }])
assert.throws(() => parseMarketReportJson('{"meta":{}}'), /JSON 需要是对象数组/)
assert.throws(() => parseMarketReportJson('{broken'), /JSON 文件格式无效/)
assert.equal(stableMarketReportId('same.xlsx'), stableMarketReportId('same.xlsx'))
assert.notEqual(stableMarketReportId('same.xlsx'), stableMarketReportId('other.xlsx'))
assert.throws(() => buildUploadedMarketReport([{ 产品名称: '无销售额' }]), /缺少销售额字段/)

const rawOzonRows = [{
  'sc5140-a src': 'https://example.com/image.jpg',
  'ld9-z3 href': 'https://www.ozon.ru/product/123',
  'ld9-z3': 'Test Hinge',
  'ld9-z5': 'Test Brand',
  'ld9-z5 (2)': 'Test Seller',
  'ld9-z7 (3)': '货号: 123',
  'ld9-a0a': '家具合页',
  'rc8134-a0': '销售领导者',
  'ld9-de9': '3 502 773 ₽',
  'ld9-de9 (2)': '22 152',
  'ld9-de9 (3)': '158 ₽',
  'ct5140-a0 (2)': 9.45,
  'ld9-ac1': '12,5%',
  'ld9-de9 (4)': '0 ₽',
  'ct5140-a0 (3)': '28中的11',
  'ld9-de9 (5)': '125 099 ₽',
  'ld9-de9 (6)': '791',
  'ct5140-a0 (4)': '2 500',
  'ld9-de9 (7)': 'FBO',
  'ct5140-a0 (5)': '0,12',
  'ld9-de9 (8)': '100 000',
  'ld9-de9 (9)': '20 000',
  'ct5140-a0 (6)': '5 000',
  'ld9-de9 (10)': '0,3%',
  'ct5140-a0 (7)': '1,5%',
  'ct5140-a0 (8)': '8,4%',
  'ct5140-a0 (9)': '15%',
  'ct5140-a0 (10)': '33%',
  'ct5140-a0 (11)': '28中的28',
  'ct5140-a0 (12)': '28中的12',
  'ct5140-a0 (13)': '10,1%',
  'ld9-de9 (11)': '01.06.2026',
}]
const normalizedRaw = normalizeMarketReportRows(rawOzonRows)
assert.equal(normalizedRaw[0]['销售额(₽)'], '3 502 773 ₽')
assert.equal(normalizedRaw[0]['签收率(%)'], 0.945)
assert.equal(normalizedRaw[0]['无库存天数(近28天)'], 11)
assert.equal(normalizedRaw[0]['下单转化率(%)'], 0.003)
const rawReport = buildUploadedMarketReport(rawOzonRows, { sourceFile: 'ozon-2026-09-08.csv', label: '家具合页' })
assert.equal(rawReport.kpis.totalRevenue, 3502773)
assert.equal(rawReport.operations.signRateMedian, 0.945)
assert.equal(rawReport.operations.stockoutMedian, 11)
assert.equal(rawReport.marketDimensions.demand.orderConversionMedian, 0.003)
assert.equal(rawReport.marketDimensions.newness.freshCount, 1)
assert.equal(rawReport.marketDimensions.newness.listingDateCoverage, 100)
assert.equal(rawReport.newProducts[0].ageDays, 99)
assert.equal(rawReport.newProducts[0].url, 'https://www.ozon.ru/product/123')
assert.ok(rawReport.recommendations.every((item) => item.evidence.length > 0))
const rawMissingSalesReport = buildUploadedMarketReport([
  { ...rawOzonRows[0], 'ld9-de9 (2)': '—' },
], { sourceFile: 'raw.csv', label: '原始数据' })
assert.equal(rawMissingSalesReport.quality.missingSales, 1)
assert.equal(rawMissingSalesReport.quality.salesCoverage, 0)

const depthRows = [
  { 产品名称: 'A-新1', 产品类型: '家具合页', 品牌名: '甲', 卖家名称: '店甲', 产品链接: 'https://example.com/a1', '销售额(₽)': 1500, '销量(件)': 15, '平均售价(₽)': 100, '下单转化率(%)': 0.08, '无库存天数(近28天)': 7, '错失销售额(₽)': 100, '商品体积(升)': 0.4, 上架日期: '01.09.2026' },
  { 产品名称: 'A-新2', 产品类型: '家具合页', 品牌名: 'без бренда', 卖家名称: '店乙', 产品链接: 'https://example.com/a2', '销售额(₽)': 1200, '销量(件)': 12, '平均售价(₽)': 120, '下单转化率(%)': 0.06, '无库存天数(近28天)': 5, '错失销售额(₽)': 80, '商品体积(升)': 0.5, 上架日期: '01.07.2026' },
  { 产品名称: 'A-成熟', 产品类型: '家具合页', 品牌名: '乙', 卖家名称: '店甲', 产品链接: 'https://example.com/a3', '销售额(₽)': 900, '销量(件)': 9, '平均售价(₽)': 90, '下单转化率(%)': 0.05, '无库存天数(近28天)': 2, '错失销售额(₽)': 30, '商品体积(升)': 0.6, 上架日期: '01.01.2026' },
  { 产品名称: 'B-新', 产品类型: '家具脚轮', 品牌名: '丙', 卖家名称: '店丙', 产品链接: 'https://example.com/b1', '销售额(₽)': 800, '销量(件)': 8, '平均售价(₽)': 160, '下单转化率(%)': 0.04, '无库存天数(近28天)': 3, '错失销售额(₽)': 20, '商品体积(升)': 1.2, 上架日期: '20.06.2026' },
  { 产品名称: 'B-成熟1', 产品类型: '家具脚轮', 品牌名: '丙', 卖家名称: '店丁', 产品链接: 'https://example.com/b2', '销售额(₽)': 700, '销量(件)': 7, '平均售价(₽)': 140, '下单转化率(%)': 0.03, '无库存天数(近28天)': 1, '错失销售额(₽)': 10, '商品体积(升)': 1.5, 上架日期: '01.12.2025' },
  { 产品名称: 'B-成熟2', 产品类型: '家具脚轮', 品牌名: '丁', 卖家名称: '店丁', 产品链接: 'https://example.com/b3', '销售额(₽)': 600, '销量(件)': 6, '平均售价(₽)': 130, '下单转化率(%)': 0.02, '无库存天数(近28天)': 0, '错失销售额(₽)': 0, '商品体积(升)': 1.8, 上架日期: '01.10.2025' },
  { 产品名称: 'B-未来日期', 产品类型: '家具脚轮', 品牌名: '丁', 卖家名称: '店丁', 产品链接: 'https://example.com/future', '销售额(₽)': 100, '销量(件)': 1, '平均售价(₽)': 100, '下单转化率(%)': 0.01, '无库存天数(近28天)': 0, '错失销售额(₽)': 0, '商品体积(升)': 1, 上架日期: '01.10.2026' },
]
const depthReport = buildUploadedMarketReport(depthRows, { sourceFile: 'ozon-2026-09-10家具五金.xlsx' })
assert.equal(depthReport.executiveSummary.length, 3)
assert.equal(depthReport.russiaEntry.context.overall.turnoverRubTrillion, 7.2)
assert.equal(depthReport.russiaEntry.context.sector.id, 'home-furniture')
assert.equal(depthReport.russiaEntry.cohortComparison.fresh.rows, 3)
assert.equal(depthReport.russiaEntry.cohortComparison.mature.rows, 3)
assert.equal(depthReport.quality.futureListingDateCount, 1)
assert.ok(!depthReport.newProducts.some((item) => item.url.endsWith('/future')))
assert.ok(Number.isFinite(depthReport.russiaEntry.cohortComparison.revenuePerSkuRatio))
assert.ok(Number.isFinite(depthReport.russiaEntry.competition.brandHhi))
assert.equal(depthReport.russiaEntry.typeOpportunities.length, 2)
for (const opportunity of depthReport.russiaEntry.typeOpportunities) {
  assert.ok(Number.isFinite(opportunity.score) && opportunity.score >= 0 && opportunity.score <= 100)
  assert.ok(['优先小批测试', '补证据后测试', '观察'].includes(opportunity.decision))
  assert.ok(opportunity.evidenceCoverage >= 0 && opportunity.evidenceCoverage <= 100)
}
assert.ok(depthReport.recommendations.every((item) => item.evidence.length > 0))

const automotiveContext = buildRussiaMarketContext({ label: '汽车电子' })
assert.equal(automotiveContext.sector.id, 'auto-parts')
assert.ok(automotiveContext.compliance.rules.some((rule) => rule.code.includes('018/2011')))
assert.ok(automotiveContext.compliance.rules.some((rule) => rule.code.includes('004/2011')))
assert.ok(automotiveContext.sources.every((source) => source.url.startsWith('https://')))

console.log('uploaded market report analysis tests passed')
