import assert from 'node:assert/strict'
import {
  buildUploadedMarketReport,
  inferMarketReportLabel,
  isUploadedMarketReport,
  stableMarketReportId,
} from './marketReportAnalysis.js'

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
assert.equal(stableMarketReportId('same.xlsx'), stableMarketReportId('same.xlsx'))
assert.notEqual(stableMarketReportId('same.xlsx'), stableMarketReportId('other.xlsx'))
assert.throws(() => buildUploadedMarketReport([{ 产品名称: '无销售额' }]), /缺少销售额字段/)

console.log('uploaded market report analysis tests passed')
