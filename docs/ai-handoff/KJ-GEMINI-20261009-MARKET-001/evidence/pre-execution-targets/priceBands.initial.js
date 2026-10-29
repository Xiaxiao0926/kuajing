/**
 * 模块4：SKU / 销量 / 销售额 三维加权价格带
 *
 * 口径冻结（用户决策）：
 *   - 三维名称：SKU占比 / 销量占比 / 销售额占比（现有数据无 GMV 字段，禁写 GMV%）
 *   - 进入规则：['A'] 默认口径；['A','B'] 可切换参考口径；C 与 UNKNOWN 一律排除
 *   - 价格轴：按类目标准化的可比价格（每100ml / 每100只 / 每kg），不是挂牌原价
 *   - 占比分母：当前进入口径内的合计（切换 A+B 后分母随之变化）
 */

/**
 * 构建加权价格带。
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
    return { bands: [], totals, excludedBreakdown, eligibleCount: 0, bandCount: 0 }
  }

  // 先按可比价排序再分箱：分箱边界与成员聚合必须来自同一个有序序列
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
      medianPrice: median,
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

  return {
    bands: detailed,
    totals,
    excludedBreakdown,
    eligibleCount: eligible.length,
    bandCount: actualBands,
    topQtyBandIndex: topQtyBand ? topQtyBand.index : null,
  }
}
