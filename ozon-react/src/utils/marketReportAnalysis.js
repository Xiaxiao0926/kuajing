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
  minPrice: ['最低价(₽)', '最低价₽'],
  revenueGrowth: ['营收增长(%)', '销售额增长(%)'],
  signRate: ['签收率(%)', '签收率'],
  missedRevenue: ['错失销售额(₽)', '错过的销售额₽'],
  stockoutDays: ['无库存天数(近28天)', '无库存天数'],
  dailyRevenue: ['日均销售额(₽)', '日均销售额₽'],
  dailySales: ['日均销量(件)', '日均销量'],
  stock: ['预估库存'],
  delivery: ['派送模式'],
  volume: ['商品体积(升)', '商品体积'],
  impressions: ['总曝光量'],
  adImpressions: ['广告搜索展示次数'],
  visits: ['商品卡片访问量'],
  orderConv: ['下单转化率(%)', '下单转化率'],
  cartConv: ['购物车转化率(%)', '购物车转化率'],
  cartAdd: ['购物车加购率(%)', '购物车加购率'],
  discount: ['产品折扣(%)', '产品折扣'],
  promoShare: ['促销份额(%)', '促销份额'],
  promoDays: ['促销天数(近28天)', '促销天数'],
  adDays: ['推广天数(近28天)', '推广天数'],
  adRoi: ['广告收入率ROI(%)', '广告收入率ROI'],
  listingDate: ['上架时间', '上架日期'],
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
const DAY_MS = 24 * 60 * 60 * 1000

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
  revenueGrowth: 'ld9-ac1',
  sales: 'ld9-de9 (2)',
  avgPrice: 'ld9-de9 (3)',
  minPrice: 'ct5140-a0',
  signRate: 'ct5140-a0 (2)',
  missedRevenue: 'ld9-de9 (4)',
  stockoutDays: 'ct5140-a0 (3)',
  dailyRevenue: 'ld9-de9 (5)',
  dailySales: 'ld9-de9 (6)',
  stock: 'ct5140-a0 (4)',
  delivery: 'ld9-de9 (7)',
  volume: 'ct5140-a0 (5)',
  impressions: 'ld9-de9 (8)',
  adImpressions: 'ld9-de9 (9)',
  visits: 'ct5140-a0 (6)',
  orderConv: 'ld9-de9 (10)',
  cartConv: 'ct5140-a0 (7)',
  cartAdd: 'ct5140-a0 (8)',
  discount: 'ct5140-a0 (9)',
  promoShare: 'ct5140-a0 (10)',
  promoDays: 'ct5140-a0 (11)',
  adDays: 'ct5140-a0 (12)',
  adRoi: 'ct5140-a0 (13)',
  listingDate: 'ld9-de9 (11)',
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
  if (String(value).includes('%')) return parsed / 100
  if (parsed <= 1) return parsed
  // SheetJS parses comma-decimal percentages such as "94,5%" as 9.45.
  if (parsed <= 10) return parsed / 10
  return parsed / 100
}

function boundedRatio(value, allowNegative = false) {
  const parsed = numeric(value)
  if (parsed === null) return null
  const normalized = String(value).includes('%') || Math.abs(parsed) > 1 ? parsed / 100 : parsed
  const minimum = allowNegative ? -1 : 0
  return normalized >= minimum && normalized <= 1 ? normalized : null
}

function percentRatio(value) {
  const parsed = numeric(value)
  if (parsed === null) return null
  return String(value).includes('%') || Math.abs(parsed) > 1 ? parsed / 100 : parsed
}

function parseListingDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'number' && value >= 20000 && value <= 80000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * DAY_MS)
  }
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const russianDate = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/u)
  if (russianDate) {
    const parsed = new Date(Date.UTC(Number(russianDate[3]), Number(russianDate[2]) - 1, Number(russianDate[1])))
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function coverage(rows, field) {
  return pct(rows.filter((row) => row[field] !== null && row[field] !== '').length, rows.length)
}

function sumField(rows, field) {
  return round(rows.reduce((sum, row) => sum + (Number.isFinite(row[field]) ? row[field] : 0), 0))
}

function medianField(rows, field) {
  return median(rows.map((row) => row[field]))
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
    image: safeUrl(model.image),
    url: safeUrl(model.url),
    name: text(model.name),
    brand: normalizedEntity(model.brand, 'brand'),
    seller: normalizedEntity(model.seller, 'seller'),
    sku: text(model.sku, ''),
    type: text(model.type, '未分类'),
    revenue: numeric(model.revenue),
    sales: numeric(model.sales),
    avgPrice: numeric(model.avgPrice),
    minPrice: numeric(model.minPrice),
    revenueGrowth: percentRatio(model.revenueGrowth),
    signRate: boundedRatio(model.signRate),
    missedRevenue: numeric(model.missedRevenue),
    stockoutDays: numeric(model.stockoutDays),
    dailyRevenue: numeric(model.dailyRevenue),
    dailySales: numeric(model.dailySales),
    stock: numeric(model.stock),
    delivery: text(model.delivery, ''),
    volume: numeric(model.volume),
    impressions: numeric(model.impressions),
    adImpressions: numeric(model.adImpressions),
    visits: numeric(model.visits),
    orderConv: boundedRatio(model.orderConv),
    cartConv: boundedRatio(model.cartConv),
    cartAdd: boundedRatio(model.cartAdd),
    discount: boundedRatio(model.discount, true),
    promoShare: boundedRatio(model.promoShare),
    promoDays: numeric(model.promoDays),
    adDays: numeric(model.adDays),
    adRoi: percentRatio(model.adRoi),
    listingDate: parseListingDate(model.listingDate),
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
    '最低价(₽)': row[RAW_OZON_SELECTOR_FIELDS.minPrice],
    '营收增长(%)': rawRatio(row[RAW_OZON_SELECTOR_FIELDS.revenueGrowth]),
    '签收率(%)': rawRatio(row[RAW_OZON_SELECTOR_FIELDS.signRate]),
    '错失销售额(₽)': row[RAW_OZON_SELECTOR_FIELDS.missedRevenue],
    '无库存天数(近28天)': rawWindowCount(row[RAW_OZON_SELECTOR_FIELDS.stockoutDays]),
    '日均销售额(₽)': row[RAW_OZON_SELECTOR_FIELDS.dailyRevenue],
    '日均销量(件)': row[RAW_OZON_SELECTOR_FIELDS.dailySales],
    预估库存: row[RAW_OZON_SELECTOR_FIELDS.stock],
    派送模式: row[RAW_OZON_SELECTOR_FIELDS.delivery],
    '商品体积(升)': row[RAW_OZON_SELECTOR_FIELDS.volume],
    总曝光量: row[RAW_OZON_SELECTOR_FIELDS.impressions],
    广告搜索展示次数: row[RAW_OZON_SELECTOR_FIELDS.adImpressions],
    商品卡片访问量: row[RAW_OZON_SELECTOR_FIELDS.visits],
    '下单转化率(%)': rawRatio(row[RAW_OZON_SELECTOR_FIELDS.orderConv]),
    '购物车转化率(%)': rawRatio(row[RAW_OZON_SELECTOR_FIELDS.cartConv]),
    '购物车加购率(%)': rawRatio(row[RAW_OZON_SELECTOR_FIELDS.cartAdd]),
    '产品折扣(%)': rawRatio(row[RAW_OZON_SELECTOR_FIELDS.discount]),
    '促销份额(%)': rawRatio(row[RAW_OZON_SELECTOR_FIELDS.promoShare]),
    '促销天数(近28天)': rawWindowCount(row[RAW_OZON_SELECTOR_FIELDS.promoDays]),
    '推广天数(近28天)': rawWindowCount(row[RAW_OZON_SELECTOR_FIELDS.adDays]),
    '广告收入率ROI(%)': rawRatio(row[RAW_OZON_SELECTOR_FIELDS.adRoi]),
    上架时间: row[RAW_OZON_SELECTOR_FIELDS.listingDate],
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
  const snapshotDate = parseListingDate(snapshot)
  const rows = normalizedRows.map(rowModel).map((row) => ({
    ...row,
    ageDays: row.listingDate && snapshotDate
      ? Math.floor((snapshotDate.getTime() - row.listingDate.getTime()) / DAY_MS)
      : null,
  }))
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
  const validListingRows = rows.filter((row) => Number.isFinite(row.ageDays) && row.ageDays >= 0 && row.ageDays <= 3650)
  const futureListingRows = rows.filter((row) => Number.isFinite(row.ageDays) && row.ageDays < 0)
  const staleListingRows = rows.filter((row) => Number.isFinite(row.ageDays) && row.ageDays > 3650)
  const freshRows = validListingRows.filter((row) => row.ageDays <= 180)
  const freshRevenue = sumField(freshRows, 'revenue')
  const inventoryCover = rows
    .filter((row) => Number.isFinite(row.stock) && Number.isFinite(row.dailySales) && row.dailySales > 0)
    .map((row) => row.stock / row.dailySales)
  const impressionRows = rows.filter((row) => Number.isFinite(row.impressions) && Number.isFinite(row.visits) && row.impressions > 0)
  const totalImpressions = sumField(impressionRows, 'impressions')
  const totalVisits = sumField(impressionRows, 'visits')
  const fulfillmentRows = rows.filter((row) => row.delivery)
  const fboRows = fulfillmentRows.filter((row) => /fbo|ozon/i.test(row.delivery))
  const salesCoverage = pct(salesRows.length, rowCount)
  const strongestBand = [...priceBands].sort((a, b) => b.revenue - a.revenue)[0]
  const topFiveTypeRevenue = typeRows.slice(0, 5).reduce((sum, item) => sum + item.revenue, 0)
  const topTenBrandRevenue = brandRows.slice(0, 10).reduce((sum, item) => sum + item.revenue, 0)
  const fieldCoverage = {
    revenueGrowth: coverage(rows, 'revenueGrowth'),
    impressions: coverage(rows, 'impressions'),
    visits: coverage(rows, 'visits'),
    orderConv: coverage(rows, 'orderConv'),
    cartAdd: coverage(rows, 'cartAdd'),
    stock: coverage(rows, 'stock'),
    dailySales: coverage(rows, 'dailySales'),
    missedRevenue: coverage(rows, 'missedRevenue'),
    discount: coverage(rows, 'discount'),
    promoShare: coverage(rows, 'promoShare'),
    adRoi: coverage(rows, 'adRoi'),
    delivery: coverage(rows, 'delivery'),
    volume: coverage(rows, 'volume'),
    listingDate: pct(validListingRows.length, rowCount),
  }
  const marketDimensions = {
    demand: {
      revenueGrowthMedian: medianField(rows, 'revenueGrowth'),
      revenueGrowthCoverage: fieldCoverage.revenueGrowth,
      impressions: totalImpressions,
      visits: totalVisits,
      visitRate: totalImpressions > 0 ? round(totalVisits / totalImpressions, 4) : null,
      orderConversionMedian: medianField(rows, 'orderConv'),
      orderConversionCoverage: fieldCoverage.orderConv,
      cartAddMedian: medianField(rows, 'cartAdd'),
      cartAddCoverage: fieldCoverage.cartAdd,
    },
    supply: {
      stockoutMedian: median(validStockout),
      stockoutCoverage: pct(validStockout.length, rowCount),
      missedRevenue: sumField(rows, 'missedRevenue'),
      missedRevenueCoverage: fieldCoverage.missedRevenue,
      inventoryCoverMedian: median(inventoryCover),
      inventoryCoverCoverage: pct(inventoryCover.length, rowCount),
    },
    marketing: {
      discountMedian: medianField(rows, 'discount'),
      discountCoverage: fieldCoverage.discount,
      promoShareMedian: medianField(rows, 'promoShare'),
      promoShareCoverage: fieldCoverage.promoShare,
      adRoiMedian: medianField(rows, 'adRoi'),
      adRoiCoverage: fieldCoverage.adRoi,
      promoActiveShare: validPromo.length ? pct(validPromo.filter((value) => value > 0).length, validPromo.length) : null,
      adActiveShare: validAd.length ? pct(validAd.filter((value) => value > 0).length, validAd.length) : null,
    },
    fulfillment: {
      signRateMedian: median(validSignRates),
      signRateCoverage: pct(validSignRates.length, rowCount),
      fboShare: fulfillmentRows.length ? pct(fboRows.length, fulfillmentRows.length) : null,
      deliveryCoverage: fieldCoverage.delivery,
      volumeMedian: medianField(rows, 'volume'),
      volumeCoverage: fieldCoverage.volume,
    },
    newness: {
      windowDays: 180,
      listingDateCoverage: fieldCoverage.listingDate,
      freshCount: freshRows.length,
      freshRevenueShare: pct(freshRevenue, totalRevenue),
      futureDateCount: futureListingRows.length,
      outlierDateCount: staleListingRows.length,
    },
  }

  const recommendations = [
    {
      title: '先从头部需求与主价格带建立首测组',
      recommendation: `围绕“${typeRows[0]?.name || '未分类'}”拆出 2–3 个明确规格，并优先覆盖 ${strongestBand.label} 主成交带；每个规格只做小批量对标测试。`,
      evidence: [`头部类型销售额占比 ${pct(typeRows[0]?.revenue || 0, totalRevenue)}%`, `${strongestBand.label} 贡献 ${strongestBand.share}% 样本销售额`, `样本 ${rowCount} 条`],
      confidence: '高',
    },
    freshRows.length && fieldCoverage.listingDate >= 40 ? {
      title: '用 180 天新品验证增长方向',
      recommendation: `优先复核新品榜中销售额靠前且链接有效的商品，拆解规格、定价和评价痛点；新品信号只用于缩小选品范围，不直接等同长期需求。`,
      evidence: [`有效上架日期覆盖 ${fieldCoverage.listingDate}%`, `180 天内新品 ${freshRows.length} 个`, `新品销售额占样本 ${pct(freshRevenue, totalRevenue)}%`],
      confidence: fieldCoverage.listingDate >= 70 ? '高' : '中',
    } : {
      title: '先补齐新品日期再判断上新机会',
      recommendation: '当前上架日期覆盖不足，不应据此判断新品趋势；优先补抓头部商品上架时间，再建立 180 天新品对标清单。',
      evidence: [`有效上架日期覆盖 ${fieldCoverage.listingDate}%`, `当前可识别新品 ${freshRows.length} 个`],
      confidence: '低',
    },
    marketDimensions.supply.inventoryCoverCoverage >= 30 || marketDimensions.supply.stockoutCoverage >= 30 ? {
      title: '把供给缺口转化为备货验证',
      recommendation: '优先核验高销售额且缺货天数较高的具体规格，同时用日销和库存覆盖天数控制首批数量，避免把偶发断货误判为真实缺口。',
      evidence: [`缺货天数字段覆盖 ${marketDimensions.supply.stockoutCoverage}%`, `缺货天数中位数 ${marketDimensions.supply.stockoutMedian === null ? '—' : round(marketDimensions.supply.stockoutMedian, 1)} 天`, `库存覆盖字段 ${marketDimensions.supply.inventoryCoverCoverage}%`],
      confidence: marketDimensions.supply.stockoutCoverage >= 60 ? '中' : '低',
    } : {
      title: '供给判断暂以人工核验为主',
      recommendation: '库存、日销和缺货字段覆盖不足，暂不根据供给缺口扩大备货；先对候选链接逐个核验在售状态和中国工厂交期。',
      evidence: [`缺货字段覆盖 ${marketDimensions.supply.stockoutCoverage}%`, `库存覆盖字段 ${fieldCoverage.stock}%`, `日销覆盖字段 ${fieldCoverage.dailySales}%`],
      confidence: '低',
    },
    marketDimensions.demand.orderConversionCoverage >= 30 ? {
      title: '用漏斗数据筛掉“有曝光没成交”商品',
      recommendation: '在同类型、同价格带内优先保留访问和下单转化更稳定的商品，再结合广告与促销依赖度判断是否值得自然流量测试。',
      evidence: [`下单转化率覆盖 ${marketDimensions.demand.orderConversionCoverage}%`, `下单转化率中位数 ${marketDimensions.demand.orderConversionMedian === null ? '—' : `${round(marketDimensions.demand.orderConversionMedian * 100, 1)}%`}`, `访问率 ${marketDimensions.demand.visitRate === null ? '—' : `${round(marketDimensions.demand.visitRate * 100, 2)}%`}`],
      confidence: marketDimensions.demand.orderConversionCoverage >= 60 ? '中' : '低',
    } : {
      title: '不要用曝光量替代成交验证',
      recommendation: '当前漏斗字段覆盖不足，选品时应把商品链接、销量、销售额和评价复核放在曝光量之前，并补抓访问与转化数据。',
      evidence: [`曝光覆盖 ${fieldCoverage.impressions}%`, `访问覆盖 ${fieldCoverage.visits}%`, `下单转化率覆盖 ${fieldCoverage.orderConv}%`],
      confidence: '低',
    },
  ]

  const newProducts = [...freshRows]
    .filter((row) => row.url)
    .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
    .slice(0, 12)
    .map((row) => ({
      name: row.name,
      type: row.type,
      brand: row.brand,
      url: row.url,
      image: row.image,
      listingDate: row.listingDate.toISOString().slice(0, 10),
      ageDays: row.ageDays,
      revenue: row.revenue === null ? null : round(row.revenue),
      sales: row.sales === null ? null : round(row.sales),
      avgPrice: row.avgPrice,
      revenueGrowth: row.revenueGrowth,
      orderConv: row.orderConv,
      cartAdd: row.cartAdd,
      stockoutDays: row.stockoutDays,
      adRoi: row.adRoi,
    }))

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
        image: row.image,
        listingDate: row.listingDate ? row.listingDate.toISOString().slice(0, 10) : null,
        ageDays: Number.isFinite(row.ageDays) && row.ageDays >= 0 ? row.ageDays : null,
      })),
    marketDimensions,
    recommendations,
    newProducts,
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
      fieldCoverage,
      listingDateCoverage: fieldCoverage.listingDate,
      freshProductCount: freshRows.length,
      futureListingDateCount: futureListingRows.length,
      outlierListingDateCount: staleListingRows.length,
    },
    insights: [
      `头部品类“${typeRows[0]?.name || '未分类'}”贡献 ${pct(typeRows[0]?.revenue || 0, totalRevenue)}% 销售额；前五品类合计 ${pct(topFiveTypeRevenue, totalRevenue)}%。`,
      `销售额最集中的价格带是 ${strongestBand.label}，覆盖 ${strongestBand.rows} 条商品记录，贡献 ${strongestBand.share}% 销售额。`,
      `前十品牌（含未知/无品牌桶）合计贡献 ${pct(topTenBrandRevenue, totalRevenue)}% 销售额；该指标反映样本集中度，不等同于完整市场份额。`,
      `销量字段覆盖率为 ${salesCoverage}%；报告以销售额作为主排序口径，销量与件均额只在有值记录上汇总。`,
      `有效上架日期覆盖 ${fieldCoverage.listingDate}%；其中 180 天内新品 ${freshRows.length} 个，贡献 ${pct(freshRevenue, totalRevenue)}% 样本销售额。`,
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
