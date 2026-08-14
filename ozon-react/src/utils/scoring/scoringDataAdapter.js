/**
 * scoring/scoringDataAdapter.js — 数据适配层（纯函数，无 React/无网络）
 * 管线：raw canonical candidates → candidatePool / marketScalePool / BSR 映射与 shrinkage
 *       → marketContext → CEL 依赖 → scoreProduct() → buildExplanations() → ScoredProduct[]
 * React 只负责展示 ScoredProduct[]，不得在组件内重复实现类目匹配/汇率/CEL/percentile。
 * 与 scripts/t4-score-audit.js 共用本模块（同源保证：UI 与审计逐位一致）。
 */
import { scoreProduct } from './scoringEngine.js'
import { buildExplanations } from './explanations.js'
import { calcShipping, ALL_CHANNELS } from '../ozonEngine.js'

// ---------- BSR 索引 ----------
export function buildBsrIndex(benchmarkJson) {
  const typeBench = benchmarkJson?.product_types || {}
  const domainBench = benchmarkJson?.domains || {}
  const typeNames = Object.keys(typeBench).filter((t) => t !== '(未分类)')
  const domainTypesByDomain = {}
  for (const t of Object.values(typeBench)) {
    if (!t.domain) continue
    if (!domainTypesByDomain[t.domain]) domainTypesByDomain[t.domain] = []
    domainTypesByDomain[t.domain].push(t)
  }
  // T4-4A：市场规模全局产品类型池（只做"市场规模排名"，不冒充对应市场基准）
  const marketScalePool = {
    sales_p50: typeNames.map((t) => typeBench[t].sales_28d?.p50).filter((v) => v !== null && v !== undefined),
    units_p50: typeNames.map((t) => typeBench[t].units_28d?.p50).filter((v) => v !== null && v !== undefined),
  }
  return { typeBench, domainBench, typeNames, domainTypesByDomain, marketScalePool }
}

// ---------- shrinkage 融合（α = n/(n+k)，与 T4-1B 一致） ----------
const SCALAR_KEYS = ['seller_hhi', 'brand_hhi', 'top1_brand_share', 'top5_brand_share', 'top10_seller_share', 'fbo_share', 'fbs_share', 'bsr_leader_share']
const QUANTILE_KEYS = ['sales_28d', 'units_28d', 'avg_price_rub', 'min_price_rub', 'sign_rate', 'conv_rate', 'cart_add', 'discount', 'promo_share', 'promo_days', 'ad_days', 'ad_roi', 'oos_days', 'missed_sales_rub', 'volume_l']
const QUANTILES = ['p10', 'p25', 'p50', 'p75', 'p90']

export function blendBenchmark(typeB, domainB, n, k = 5) {
  if (!domainB) return typeB
  const alpha = n / (n + k)
  const out = { ...typeB }
  const blend = (tv, dv) => (tv != null && dv != null ? alpha * tv + (1 - alpha) * dv : (tv ?? dv))
  for (const key of SCALAR_KEYS) out[key] = blend(typeB[key], domainB[key])
  for (const key of QUANTILE_KEYS) {
    const t = typeB[key] || {}, d = domainB[key] || {}
    out[key] = {}
    for (const q of QUANTILES) out[key][q] = blend(t[q], d[q])
  }
  return out
}

// ---------- 类目匹配（精确 > 包含 > domain 由类型自带；与审计同源） ----------
export function matchType(leaf, index) {
  const { typeBench, domainBench, typeNames } = index
  if (typeNames.includes(leaf)) {
    const b = typeBench[leaf]
    return { kind: 'exact', benchmark: b, matchedType: leaf, domain: b.domain, n: b.n }
  }
  const hit = typeNames.find((t) => (t.includes(leaf) || leaf.includes(t)) && Math.min(t.length, leaf.length) >= 2)
  if (hit) {
    const b = typeBench[hit]
    return { kind: 'partial', benchmark: domainBench[b.domain] || null, matchedType: hit, domain: b.domain, n: b.n }
  }
  return { kind: 'none', benchmark: null, matchedType: null, domain: null, n: null }
}

export function buildMarketContext(m, index) {
  const { typeBench, domainBench, domainTypesByDomain } = index
  let context, benchmark = m.benchmark
  if (m.kind === 'exact') {
    context = m.n >= 10 ? 'HIGH' : m.n >= 5 ? 'MEDIUM' : 'LOW'
    if (m.n < 10) benchmark = blendBenchmark(typeBench[m.matchedType], domainBench[m.domain], m.n)
  } else if (m.kind === 'partial') {
    context = 'LOW'
  } else {
    context = 'LOW_MARKET_CONTEXT'
    benchmark = null
  }
  const domainTypes = (m.domain && domainTypesByDomain[m.domain]) || []
  return { context, benchmark, matchedType: m.matchedType, sampleSize: m.n, domainTypes }
}

// ---------- 候选池（percentile 用） ----------
export function buildCandidatePool(candidates) {
  const poolArr = (key) => candidates.map((c) => c[key]).filter((v) => v !== null && v !== undefined)
  return {
    sales_rub_28d: poolArr('sales_rub_28d'),
    units_28d: poolArr('units_28d'),
    conv_rate: poolArr('conv_rate'),
    cart_add_rate: poolArr('cart_add_rate'),
    exposure: poolArr('exposure'),
    card_visits: poolArr('card_visits'),
    reviews: poolArr('reviews'),
    gross_margin: poolArr('gross_margin'),
    commission_max: candidates.map((c) => Math.max(c.commission_fbs ?? 0, c.commission_fbo ?? 0, c.commission_rfbs ?? 0, c.commission_fbp ?? 0)).filter((v) => v != null),
    ad_share: poolArr('ad_share'),
    sign_rate: poolArr('sign_rate'),
    oos_days_share: poolArr('oos_days_share'),
    turnover: poolArr('turnover'),
    revenue_loss_rate: poolArr('revenue_loss_rate'),
    // 物流池：仅重量/尺寸有效且 CEL 有渠道的候选入池（T4-2 hardening 契约）
    billable_weight: [],
    shipping_ratio: [],
  }
}

// ---------- CEL 渠道探测（与审计同源；尺寸无效 → 无渠道） ----------
export const effPriceOf = (c) => (c.price_rub > 0 ? c.price_rub : (c.avg_price_rub && c.avg_price_rub > 0 ? c.avg_price_rub : null))
export const dimsValid = (c) => Array.isArray(c.dims) && c.dims.length === 3 && c.dims.every((v) => v !== null && v !== undefined && v > 0)

export function makeCelChannels() {
  return (c) => {
    if (!(c.weight_kg > 0) || !dimsValid(c)) return []
    const p = effPriceOf(c) ?? 1
    const out = []
    for (const ch of ALL_CHANNELS) {
      const res = calcShipping(ch, p, c.weight_kg, c.dims[0], c.dims[1], c.dims[2])
      if (res) out.push(res)
    }
    return out
  }
}

// ---------- 物流 percentile 池预计算（shipping_ratio / billable_weight） ----------
export function fillLogisticsPools(candidatePool, candidates, celChannels, rubPerCny) {
  for (const c of candidates) {
    if (!(c.weight_kg > 0) || !dimsValid(c)) continue
    const chs = celChannels(c)
    if (chs.length > 0) {
      const best = chs.reduce((a, b) => (b.cost < a.cost ? b : a), chs[0])
      candidatePool.billable_weight.push(best.chargeWeight)
      const eff = effPriceOf(c)
      if (eff != null && eff > 0) candidatePool.shipping_ratio.push(best.cost / (eff / rubPerCny))
    }
  }
  return candidatePool
}

// ---------- 主入口：批量评分 ----------
// 行为零变化性能优化：候选池/市场规模池升序预排序一次，percentileRank 检测已排序后跳过重复排序。
export function sortPools(candidatePool) {
  for (const k of Object.keys(candidatePool)) {
    if (Array.isArray(candidatePool[k])) candidatePool[k].sort((a, b) => a - b)
  }
}

/**
 * @param {object} opts { candidates, benchmark, rules, rubPerCny }
 * @returns {Array<object>} ScoredProduct[]：scoreProduct 输出 + explanations + 展示辅助字段
 */
export function scoreAllCandidates({ candidates, benchmark, rules, rubPerCny }) {
  const index = buildBsrIndex(benchmark)
  const candidatePool = buildCandidatePool(candidates)
  const celChannels = makeCelChannels()
  fillLogisticsPools(candidatePool, candidates, celChannels, rubPerCny)
  sortPools(candidatePool)
  index.marketScalePool.sales_p50.sort((a, b) => a - b)
  index.marketScalePool.units_p50.sort((a, b) => a - b)
  const deps = { candidatePool, rubPerCny, calcCelShipping: celChannels, marketScalePool: index.marketScalePool }

  return candidates.map((c, i) => {
    const m = matchType(c.category_leaf, index)
    const ctx = buildMarketContext(m, index)
    const r = scoreProduct(c, ctx, deps, rules)
    const ex = buildExplanations(c, r, ctx)
    const band = ctx.benchmark?.avg_price_rub
    return {
      index: i,
      name: c.name,
      leaf: c.category_leaf,
      categoryFull: c.category_full || c.category_leaf,
      kind: m.kind,
      marketPriceBand: band && band.p25 != null ? { p25: band.p25, p50: band.p50, p75: band.p75 } : null,
      ...r,
      ...ex,
    }
  })
}
