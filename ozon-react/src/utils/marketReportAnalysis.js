const FIELD_ALIASES = {
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

const RAW_OZON_SELECTOR_FIELDS = {
  image: 'sc5140-a src',
  url: 'ld9-z3 href',
  name: 'ld9-z3',
  brand: 'ld9-z5',
  seller: 'ld9-z5 (2)',
  sku: 'ld9-z7 (3)',
  type: 'ld9-a0a',
  bsr: 'rc8134-a0',
  revenue: 'ld9-de9',
  sales: 'ld9-de9 (2)',
  avgPrice: 'ld9-de9 (3)',
  signRate: 'ct5140-a0 (2)',
  missedRevenue: 'ld9-de9 (4)',
  stockoutDays: 'ct5140-a0 (3)',
  promoDays: 'ct5140-a0 (11)',
  adDays: 'ct5140-a0 (12)',
}

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
  if (!normalized || normalized === '-' || normalized === '+' || normalized === '.') return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function rawWindowCount(value) {
  const matched = String(value ?? '').match(/中的(\d+)/u)
  return matched ? Number(matched[1]) : numeric(value)
}

function rawRatio(value) {
  const parsed = numeric(value)
  if (parsed === null) return null
  if (parsed <= 1) return parsed
  // SheetJS parses comma-decimal percentages such as "94,5%" as 9.45.
  if (parsed <= 10) return parsed / 10
  return parsed / 100
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

function safeUrl(value) {
  const raw = text(value, '')
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : ''
  } catch {
    return ''
  }
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
    url: safeUrl(model.url),
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

export function normalizeMarketReportRows(rawRows) {
  if (!Array.isArray(rawRows) || !rawRows.length) return rawRows
  const headers = new Set(Object.keys(rawRows[0] || {}))
  const isRawOzonExport = headers.has(RAW_OZON_SELECTOR_FIELDS.image)
    && headers.has(RAW_OZON_SELECTOR_FIELDS.url)
    && headers.has(RAW_OZON_SELECTOR_FIELDS.revenue)
    && headers.has(RAW_OZON_SELECTOR_FIELDS.type)
  if (!isRawOzonExport) return rawRows

  return rawRows.map((row) => ({
    产品图片: row[RAW_OZON_SELECTOR_FIELDS.image],
    产品链接: row[RAW_OZON_SELECTOR_FIELDS.url],
    产品名称: row[RAW_OZON_SELECTOR_FIELDS.name],
    品牌名: row[RAW_OZON_SELECTOR_FIELDS.brand],
    卖家名称: row[RAW_OZON_SELECTOR_FIELDS.seller],
    SKU: String(row[RAW_OZON_SELECTOR_FIELDS.sku] || '').replace(/^货号:\s*/u, ''),
    产品类型: row[RAW_OZON_SELECTOR_FIELDS.type],
    BSR标签: row[RAW_OZON_SELECTOR_FIELDS.bsr],
    '销售额(₽)': row[RAW_OZON_SELECTOR_FIELDS.revenue],
    '销量(件)': row[RAW_OZON_SELECTOR_FIELDS.sales],
    '平均售价(₽)': row[RAW_OZON_SELECTOR_FIELDS.avgPrice],
    '签收率(%)': rawRatio(row[RAW_OZON_SELECTOR_FIELDS.signRate]),
    '错失销售额(₽)': row[RAW_OZON_SELECTOR_FIELDS.missedRevenue],
    '无库存天数(近28天)': rawWindowCount(row[RAW_OZON_SELECTOR_FIELDS.stockoutDays]),
    '促销天数(近28天)': rawWindowCount(row[RAW_OZON_SELECTOR_FIELDS.promoDays]),
    '推广天数(近28天)': rawWindowCount(row[RAW_OZON_SELECTOR_FIELDS.adDays]),
  }))
}

export function inferMarketReportLabel(fileName) {
  return String(fileName || '导入数据')
    .replace(/\.(xlsx|xls|csv|json)$/iu, '')
    .replace(/^ozon-\d{4}-\d{2}-\d{2}/iu, '')
    .replace(/_?清洗版$/u, '')
    .replace(/^[_\s-]+|[_\s-]+$/g, '') || '导入数据'
}

export function getMarketImportType(fileName) {
  const extension = String(fileName || '').match(/\.([^.]+)$/u)?.[1]?.toLocaleLowerCase()
  if (extension === 'xlsx' || extension === 'xls') return 'Excel'
  if (extension === 'csv') return 'CSV'
  if (extension === 'json') return 'JSON'
  return null
}

export function parseMarketReportJson(textValue) {
  let parsed
  try {
    parsed = JSON.parse(String(textValue || '').replace(/^\uFEFF/u, ''))
  } catch {
    throw new Error('JSON 文件格式无效。')
  }
  const rows = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.rows)
      ? parsed.rows
      : Array.isArray(parsed?.data)
        ? parsed.data
        : null
  if (!rows?.length || rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
    throw new Error('JSON 需要是对象数组，或使用 { rows: [...] } / { data: [...] }。')
  }
  return rows
}

export function stableMarketReportId(fileName) {
  let hash = 2166136261
  for (const char of String(fileName || '').toLocaleLowerCase()) {
    hash ^= char.codePointAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return `uploaded-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export function buildUploadedMarketReport(rawRows, options = {}) {
  if (!Array.isArray(rawRows) || rawRows.length === 0) throw new Error('工作表中没有可分析的数据行。')
  const normalizedRows = normalizeMarketReportRows(rawRows)
  const headers = new Set(Object.keys(normalizedRows[0] || {}))
  if (!FIELD_ALIASES.revenue.some((header) => headers.has(header))) {
    throw new Error('缺少销售额字段，需要“销售额(₽)”或“销售额₽”。')
  }

  const sourceFile = options.sourceFile || 'import.xlsx'
  const sourceFormat = options.sourceFormat || getMarketImportType(sourceFile) || '数据文件'
  const label = options.label || inferMarketReportLabel(sourceFile)
  const snapshot = options.snapshot || sourceFile.match(/\d{4}-\d{2}-\d{2}/)?.[0] || new Date().toISOString().slice(0, 10)
  const id = options.id || stableMarketReportId(sourceFile)
  const rows = normalizedRows.map(rowModel)
  const rowCount = rows.length
  const totalRevenue = rows.reduce((sum, row) => sum + (row.revenue || 0), 0)
  const revenueRows = rows.filter((row) => row.revenue !== null)
  if (!revenueRows.length) throw new Error('销售额字段没有可用数值。')
  const salesRows = rows.filter((row) => row.sales !== null)
  const totalSales = salesRows.reduce((sum, row) => sum + row.sales, 0)
  const skuValues = rows.map((row) => row.sku).filter(Boolean)
  const urlValues = rows.map((row) => row.url).filter(Boolean)
  const namedBrands = new Set(rows.filter((row) => row.brand !== '未知/无品牌').map((row) => row.brand))
  const namedSellers = new Set(rows.filter((row) => row.seller !== '未知卖家').map((row) => row.seller))
  const typeRows = aggregateBy(rows, 'type').sort((a, b) => b.revenue - a.revenue)
  const brandRows = aggregateBy(rows, 'brand').sort((a, b) => b.revenue - a.revenue)
  const sellerRows = aggregateBy(rows, 'seller').sort((a, b) => b.revenue - a.revenue)

  const priceBands = PRICE_BANDS.map((band) => {
    const matches = rows.filter((row) => row.avgPrice !== null && row.avgPrice >= band.min && row.avgPrice < band.max)
    const revenue = matches.reduce((sum, row) => sum + (row.revenue || 0), 0)
    return {
      label: band.label,
      rows: matches.length,
      revenue: round(revenue),
      sales: round(matches.reduce((sum, row) => sum + (row.sales || 0), 0)),
      share: pct(revenue, totalRevenue),
    }
  })

  const validSignRates = rows.map((row) => row.signRate).filter(Number.isFinite)
  const validStockout = rows.map((row) => row.stockoutDays).filter(Number.isFinite)
  const validPromo = rows.map((row) => row.promoDays).filter(Number.isFinite)
  const validAd = rows.map((row) => row.adDays).filter(Number.isFinite)
  const salesCoverage = pct(salesRows.length, rowCount)
  const strongestBand = [...priceBands].sort((a, b) => b.revenue - a.revenue)[0]
  const topFiveTypeRevenue = typeRows.slice(0, 5).reduce((sum, item) => sum + item.revenue, 0)
  const topTenBrandRevenue = brandRows.slice(0, 10).reduce((sum, item) => sum + item.revenue, 0)

  return {
    schemaVersion: 1,
    kind: 'uploaded',
    id,
    label,
    title: `Ozon ${label}市场分析`,
    group: '导入报告',
    snapshot,
    source: `用户导入 ${sourceFormat}`,
    sample: `${rowCount.toLocaleString('zh-CN')} 条记录`,
    frameTitle: `Ozon ${label}市场分析报告`,
    sourceFile,
    publishedAt: options.publishedAt || new Date().toISOString(),
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
      promoActiveShare: validPromo.length ? pct(validPromo.filter((value) => value > 0).length, validPromo.length) : null,
      promoCoverage: pct(validPromo.length, rowCount),
      adActiveShare: validAd.length ? pct(validAd.filter((value) => value > 0).length, validAd.length) : null,
      adCoverage: pct(validAd.length, rowCount),
    },
    quality: {
      level: salesCoverage >= 95 ? '核心口径完整' : salesCoverage >= 85 ? '可用，需留意缺失' : '谨慎解读销量',
      salesCoverage,
      missingSales: rowCount - salesRows.length,
      missingAveragePrice: rows.filter((row) => row.avgPrice === null).length,
      missingBsr: rows.filter((row) => !row.bsr).length,
      duplicateSku: skuValues.length - new Set(skuValues).size,
      duplicateUrl: urlValues.length - new Set(urlValues).size,
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

export function isUploadedMarketReport(value) {
  return Boolean(value
    && value.schemaVersion === 1
    && value.kind === 'uploaded'
    && typeof value.id === 'string'
    && Array.isArray(value.topTypes)
    && value.kpis?.rowCount > 0)
}
