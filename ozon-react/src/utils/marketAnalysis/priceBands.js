/**
 * 模块4：SKU / 销量 / 销售额 三维加权价格带
 *
 * 口径澄清与规范（TASK 001 纠偏）：
 *   - 切片分桶：【SKU 数量等分切片】（SKU count slices），将进入口径的 SKU 按标准化可比价升序排序后均分为 N 份切片
 *   - medianPrice：切片内【非加权 SKU 价格上中位值】（排序第 floor(n/2)+1 位），仅代表该切片内未加权的上中位值，非算术平均中位、非销量加权
 *   - 三维名称：SKU占比 / 销量占比 / 销售额占比（现有数据无 GMV 字段，禁写 GMV%）
 *   - 进入规则：['A'] 默认口径；['A','B'] 可切换参考口径；C 与 UNKNOWN 一律排除
 *   - 价格轴：按类目标准化的可比价格（每100ml / 每100只 / 每kg），不是挂牌原价
 *   - 占比分母：当前进入口径内的合计（切换 A+B 后分母随之变化）
 *   - 新增独立指标：【销量加权价格分位】（sales-weighted quantiles），以有效正数销量为权重计算 P10/P25/P50/P75/P90
 */

/**
 * 计算销量加权价格分位数（sales-weighted quantiles）
 * 严格按有效正数销量（_purity.qty）为权重，计算 P10 / P25 / P50 / P75 / P90。
 * 销量为零、缺失、负数或非有限数值时一律不计入权重；无有效权重时返回 insufficient_data 状态。
 *
 * @param {Array} pipelineRowsOrEligible 待计算行（含 _purity.normalizedPrice 与 _purity.qty）
 * @param {{tiers?: string[]|null}} options 可选过滤层级（如 ['A'] 或 ['A', 'B']）
 * @returns {{
 *   status: 'ok' | 'insufficient_data',
 *   reason?: string,
 *   validCount: number,
 *   totalWeight: number,
 *   p10: number | null,
 *   p25: number | null,
 *   p50: number | null,
 *   p75: number | null,
 *   p90: number | null
 * }}
 */
export function calculateSalesWeightedQuantiles(pipelineRowsOrEligible, { tiers = null } = {}) {
  const rows = Array.isArray(pipelineRowsOrEligible) ? pipelineRowsOrEligible : []
  const weightedRows = rows.filter((r) => {
    if (!r || !r._purity) return false
    if (Array.isArray(tiers) && !tiers.includes(r._purity.tier)) return false
    return (
      Number.isFinite(r._purity.normalizedPrice) &&
      r._purity.normalizedPrice > 0 &&
      Number.isFinite(r._purity.qty) &&
      r._purity.qty > 0
    )
  })

  if (weightedRows.length === 0) {
    return {
      status: 'insufficient_data',
      reason: 'no_positive_sales_weight',
      validCount: 0,
      totalWeight: 0,
      p10: null,
      p25: null,
      p50: null,
      p75: null,
      p90: null,
    }
  }

  const sorted = [...weightedRows].sort((a, b) => a._purity.normalizedPrice - b._purity.normalizedPrice)
  const totalWeight = sorted.reduce((sum, r) => sum + r._purity.qty, 0)

  if (totalWeight <= 0 || !Number.isFinite(totalWeight)) {
    return {
      status: 'insufficient_data',
      reason: 'zero_or_invalid_total_weight',
      validCount: 0,
      totalWeight: 0,
      p10: null,
      p25: null,
      p50: null,
      p75: null,
      p90: null,
    }
  }

  const getPercentile = (q) => {
    const target = totalWeight * q
    let cum = 0
    for (const r of sorted) {
      cum += r._purity.qty
      if (cum >= target) {
        return r._purity.normalizedPrice
      }
    }
    return sorted[sorted.length - 1]._purity.normalizedPrice
  }

  return {
    status: 'ok',
    validCount: sorted.length,
    totalWeight,
    p10: getPercentile(0.10),
    p25: getPercentile(0.25),
    p50: getPercentile(0.50),
    p75: getPercentile(0.75),
    p90: getPercentile(0.90),
  }
}

/**
 * 构建加权价格带（含 SKU 数量切片与独立销量加权分位）。
 * @param {Array} pipelineRows runPurityPipeline 输出行（含 _purity）
 * @param {{tiers?: string[], bandCount?: number}} options
 */
export function buildWeightedBands(pipelineRows, { tiers = ['A'], bandCount = 5 } = {}) {
  const eligible = (pipelineRows || []).filter(
    (r) => r._purity && tiers.includes(r._purity.tier) && r._purity.normalizedPrice > 0
  )
  const excludedBreakdown = {}
  for (const r of pipelineRows || []) {
    if (!r._purity) continue
    const t = r._purity.tier
    if (!tiers.includes(t)) excludedBreakdown[t] = (excludedBreakdown[t] || 0) + 1
    else if (r._purity.normalizedPrice <= 0) excludedBreakdown['no_price'] = (excludedBreakdown['no_price'] || 0) + 1
  }

  const totals = eligible.reduce(
    (acc, r) => {
      acc.sku += 1
      acc.qty += r._purity.qty || 0
      acc.sales += r._purity.sales || 0
      return acc
    },
    { sku: 0, qty: 0, sales: 0 }
  )

  if (eligible.length === 0) {
    return {
      bands: [],
      totals,
      excludedBreakdown,
      eligibleCount: 0,
      bandCount: 0,
      topQtyBandIndex: null,
      salesWeightedQuantiles: {
        status: 'insufficient_data',
        reason: 'no_eligible_rows',
        validCount: 0,
        totalWeight: 0,
        p10: null,
        p25: null,
        p50: null,
        p75: null,
        p90: null,
      },
    }
  }

  // 先按可比价排序再分箱：分箱边界与成员聚合来自同一个有序序列
  const sortedRows = [...eligible].sort((a, b) => a._purity.normalizedPrice - b._purity.normalizedPrice)
  const n = sortedRows.length
  const actualBands = Math.max(1, Math.min(bandCount, n))

  const slices = []
  for (let i = 0; i < actualBands; i++) {
    const from = Math.floor((n * i) / actualBands)
    const to = Math.max(from + 1, Math.floor((n * (i + 1)) / actualBands))
    slices.push({ from, to })
  }

  const pct = (v, base) => (base > 0 ? Math.round((v / base) * 1000) / 10 : 0)

  const detailed = slices.map((s, i) => {
    const members = sortedRows.slice(s.from, s.to)
    const agg = members.reduce(
      (acc, r) => {
        acc.sku += 1
        acc.qty += r._purity.qty || 0
        acc.sales += r._purity.sales || 0
        return acc
      },
      { sku: 0, qty: 0, sales: 0 }
    )
    const prices = members.map((r) => r._purity.normalizedPrice)
    const median = prices.length ? prices[Math.floor(prices.length / 2)] : 0
    return {
      index: i + 1,
      label: `带${i + 1}`,
      priceMin: prices[0],
      priceMax: prices[prices.length - 1],
      medianPrice: median, // 切片内未加权 SKU 价格上中位值（排序第 floor(n/2)+1 位，保持历史取值不变）
      sku: agg.sku,
      skuShare: pct(agg.sku, totals.sku),
      qty: agg.qty,
      qtyShare: pct(agg.qty, totals.qty),
      sales: agg.sales,
      salesShare: pct(agg.sales, totals.sales),
    }
  })

  const topQtyBand = detailed.reduce(
    (best, b) => (best === null || b.qtyShare > best.qtyShare ? b : best),
    null
  )

  const salesWeightedQuantiles = calculateSalesWeightedQuantiles(eligible)

  return {
    bands: detailed,
    totals,
    excludedBreakdown,
    eligibleCount: eligible.length,
    bandCount: actualBands,
    topQtyBandIndex: topQtyBand ? topQtyBand.index : null,
    salesWeightedQuantiles,
  }
}
