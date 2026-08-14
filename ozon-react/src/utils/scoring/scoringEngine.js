/**
 * scoring/scoringEngine.js — 选品评分引擎（纯函数，无副作用/无网络）
 * 依据 config/scoring_rules.json + T4-1B-评分模型设计冻结.md
 *
 * scoreProduct(candidate, marketContext, deps)
 *   candidate    : canonical 候选行（数值已清洗，见 T4-1B §1.1）
 *   marketContext: { context, benchmark, matchedType, sampleSize, alpha, domainTypes, domainBenchmark }
 *   deps         : { candidatePool, rubPerCny, calcCelShipping }
 * 返回结构见 T4-1B §6。
 */
import {
  percentileRank, percentileRankFromQuantiles, benchmarkQuantiles,
  evidenceWeightedScore, shrink, round1, round2,
} from './normalization.js'

// ---------- 评级 ----------
function gradeOf(score, rules) {
  if (score === null || score === undefined) return null
  for (const g of rules.grades) { if (score >= g.min) return g.grade }
  return 'D'
}

// ---------- 单维度计算 ----------

function scoreDemand(c, ctx, deps, rules, subs) {
  const pool = deps.candidatePool
  const items = []
  // 有 BSR 映射 → 市场分位；无映射 → 候选池分位
  const mk = (benchKey, value, poolKey) => {
    if (value === null || value === undefined) return null
    const qs = ctx.benchmark ? benchmarkQuantiles(ctx.benchmark, benchKey) : null
    if (qs) return percentileRankFromQuantiles(value, qs)
    return percentileRank(value, pool[poolKey])
  }
  items.push({ key: 'sales_rub_28d', weight: subs.sales_rub_28d.weight, label: subs.sales_rub_28d.label, score: mk('sales_28d', c.sales_rub_28d, 'sales_rub_28d') })
  items.push({ key: 'units_28d', weight: subs.units_28d.weight, label: subs.units_28d.label, score: mk('units_28d', c.units_28d, 'units_28d') })
  items.push({ key: 'conv_rate', weight: subs.conv_rate.weight, label: subs.conv_rate.label, score: mk('conv_rate', c.conv_rate, 'conv_rate') })
  items.push({ key: 'cart_add_rate', weight: subs.cart_add_rate.weight, label: subs.cart_add_rate.label, score: mk('cart_add', c.cart_add_rate, 'cart_add_rate') })
  items.push({ key: 'exposure', weight: subs.exposure.weight, label: subs.exposure.label, score: percentileRank(c.exposure, pool.exposure) })
  items.push({ key: 'card_visits', weight: subs.card_visits.weight, label: subs.card_visits.label, score: percentileRank(c.card_visits, pool.card_visits) })
  items.push({ key: 'reviews', weight: subs.reviews.weight, label: subs.reviews.label, score: percentileRank(c.reviews, pool.reviews) })
  const r = evidenceWeightedScore(items, rules.subs_min_coverage)
  return { ...r, subs: items }
}

function scoreCompetition(ctx, deps, rules, subs) {
  if (!ctx.benchmark) return { score: null, coverage: 0, available: false, subs: [] }
  // 比较池：同 domain 下 product types 的结构指标数组（支持嵌套 p50 键）
  const domTypes = ctx.domainTypes || []
  const arr = (key) => domTypes.map((t) => {
    const dot = key.indexOf('.')
    return dot >= 0 ? t[key.slice(0, dot)]?.[key.slice(dot + 1)] : t[key]
  }).filter((v) => v !== null && v !== undefined)
  const b = ctx.benchmark
  const items = []
  items.push({ key: 'seller_concentration', weight: subs.seller_concentration.weight, label: subs.seller_concentration.label,
    score: b.seller_hhi != null ? 100 - percentileRank(b.seller_hhi, arr('seller_hhi')) : null })
  items.push({ key: 'brand_concentration', weight: subs.brand_concentration.weight, label: subs.brand_concentration.label,
    score: b.brand_hhi != null ? 100 - percentileRank(b.brand_hhi, arr('brand_hhi')) : null })
  const head = b.top1_brand_share != null || b.top10_seller_share != null
    ? Math.max(b.top1_brand_share ?? 0, b.top10_seller_share ?? 0) : null
  const headPool = domTypes.map((t) => Math.max(t.top1_brand_share ?? 0, t.top10_seller_share ?? 0)).filter((v) => v > 0)
  items.push({ key: 'head_share_pressure', weight: subs.head_share_pressure.weight, label: subs.head_share_pressure.label,
    score: head !== null && headPool.length ? 100 - percentileRank(head, headPool) : null })
  // 促销依赖：promo_share 60 / promo_days 40，缺失一侧按剩余权重重归一，两侧全缺 → null。
  // 铁律：缺失子项不得用 0 补齐（0 会被解读为"无促销依赖"，属伪造证据）。
  const promoDep = (() => {
    const ps = b.promo_share?.p50, pd = b.promo_days?.p50
    const psRank = ps != null ? percentileRank(ps, arr('promo_share.p50')) : null
    const pdRank = pd != null ? percentileRank(pd, arr('promo_days.p50')) : null
    return evidenceWeightedScore([
      { weight: 60, score: psRank != null ? 100 - psRank : null },
      { weight: 40, score: pdRank != null ? 100 - pdRank : null },
    ], 0).score
  })()
  items.push({ key: 'promo_dependency', weight: subs.promo_dependency.weight, label: subs.promo_dependency.label, score: promoDep })
  // 广告机会：ad_days 60 / ad_roi 40，缺失一侧按剩余权重重归一，两侧全缺 → null。
  // 铁律：缺失子项不得用固定 50 补齐（50 = 中位猜测，属伪造证据）。
  const adOpp = (() => {
    const ad = b.ad_days?.p50, roi = b.ad_roi?.p50
    const adRank = ad != null ? percentileRank(ad, arr('ad_days.p50')) : null
    const roiRank = roi != null ? percentileRank(roi, arr('ad_roi.p50')) : null
    return evidenceWeightedScore([
      { weight: 60, score: adRank != null ? 100 - adRank : null },
      { weight: 40, score: roiRank != null ? roiRank : null },
    ], 0).score
  })()
  items.push({ key: 'ad_opportunity', weight: subs.ad_opportunity.weight, label: subs.ad_opportunity.label, score: adOpp })
  const r = evidenceWeightedScore(items, rules.subs_min_coverage)
  return { ...r, subs: items }
}

function scorePrice(c, ctx, deps, rules, subs) {
  if (!ctx.benchmark) return { score: null, coverage: 0, available: false, subs: [] }
  const b = ctx.benchmark
  const effPrice = c.price_rub > 0 ? c.price_rub : (c.avg_price_rub && c.avg_price_rub > 0 ? c.avg_price_rub : null)
  // 规格：价格与平均单价都无效 → price 维度整体 N/A
  if (effPrice === null) return { score: null, coverage: 0, available: false, subs: [] }
  const items = []
  let bandScore = null
  if (effPrice !== null && b.avg_price_rub?.p25 != null) {
    const { p25, p75, p10, p90 } = b.avg_price_rub
    if (effPrice >= p25 && effPrice <= p75) bandScore = 100
    else if ((effPrice >= p10 && effPrice < p25) || (effPrice > p75 && effPrice <= p90)) bandScore = 60
    else if (effPrice < p10) bandScore = 30
    else bandScore = 40
  }
  items.push({ key: 'price_band_match', weight: subs.price_band_match.weight, label: subs.price_band_match.label, score: bandScore })
  // 价格下限压力（正式冻结公式）：市场最低价带相对主流成交中位价越低，价格战越激烈（越低分越低）。
  //   price_floor_pressure = clamp(100 × P25(min_price_rub) / P50(avg_price_rub), 0, 100)
  items.push({ key: 'price_floor_pressure', weight: subs.price_floor_pressure.weight, label: subs.price_floor_pressure.label,
    score: b.min_price_rub?.p25 != null && b.avg_price_rub?.p50 != null && b.avg_price_rub.p50 > 0
      ? Math.max(0, Math.min(100, (100 * b.min_price_rub.p25) / b.avg_price_rub.p50)) : null })
  // 折扣稳定性（正式冻结公式）：市场折扣深度越大越不稳定（折扣越深分越低）。
  //   discount_stability = clamp(100 − P50(discount), 0, 100)  （中位折扣 20%→80 / 50%→50 / 80%→20）
  items.push({ key: 'discount_stability', weight: subs.discount_stability.weight, label: subs.discount_stability.label,
    score: b.discount?.p50 != null ? Math.max(0, Math.min(100, 100 - b.discount.p50)) : null })
  const r = evidenceWeightedScore(items, rules.subs_min_coverage)
  return { ...r, subs: items }
}

function scoreProfitability(c, deps, rules, subs) {
  const pool = deps.candidatePool
  const items = []
  items.push({ key: 'gross_margin', weight: subs.gross_margin.weight, label: subs.gross_margin.label,
    score: c.gross_margin != null ? percentileRank(c.gross_margin, pool.gross_margin) : null })
  // 佣金：发货模式明确→对应；混合→取最高；无→N/A
  const comm = (() => {
    const mode = (c.ship_mode || '').toUpperCase()
    const vals = []
    if (mode.includes('FBS')) vals.push(c.commission_fbs)
    if (mode.includes('FBO')) vals.push(c.commission_fbo)
    if (mode.includes('RFBS')) vals.push(c.commission_rfbs)
    if (mode.includes('FBP')) vals.push(c.commission_fbp)
    if (vals.length === 0) {
      // 混合/未明确：取可适用佣金中的最高值（保守）
      const all = [c.commission_fbs, c.commission_fbo, c.commission_rfbs, c.commission_fbp].filter((v) => v != null)
      return all.length ? Math.max(...all) : null
    }
    return Math.max(...vals)
  })()
  items.push({ key: 'commission_burden', weight: subs.commission_burden.weight, label: subs.commission_burden.label,
    score: comm != null ? 100 - percentileRank(comm, pool.commission_max) : null })
  items.push({ key: 'ad_burden', weight: subs.ad_burden.weight, label: subs.ad_burden.label,
    score: c.ad_share != null ? 100 - percentileRank(c.ad_share, pool.ad_share) : null })
  const r = evidenceWeightedScore(items, rules.subs_min_coverage)
  return { ...r, subs: items }
}

function scoreLogistics(c, deps, rules, subs) {
  const pool = deps.candidatePool
  // 重量/尺寸数据无效 → 维度 N/A（数据不足 ≠ 物流不可行），不判 BLOCKED
  const weightValid = c.weight_kg !== null && c.weight_kg !== undefined && c.weight_kg > 0
  const dimsValid = Array.isArray(c.dims) && c.dims.length === 3 && c.dims.every((v) => v !== null && v !== undefined && v > 0)
  if (!weightValid || !dimsValid) {
    return { score: null, coverage: 0, available: false, subs: [], blocked: false }
  }
  // 有效价格：price>0 用 price；=0 用 avg_price（与价格空间同口径，避免价格=0 的新品被误判无渠道）
  // 价格无效时仍可评估渠道数与计费重量，仅 shipping_ratio 子项 N/A（子指标证据感知处理）
  const effPrice = c.price_rub > 0 ? c.price_rub : (c.avg_price_rub && c.avg_price_rub > 0 ? c.avg_price_rub : null)
  // CEL 渠道探测
  let channels = []
  if (deps.calcCelShipping) {
    channels = deps.calcCelShipping({ ...c, price_rub: effPrice ?? 1 })
  }
  if (channels.length === 0) {
    return {
      score: 0, coverage: 1, available: true, blocked: true,
      subs: [{ key: 'channel_availability', weight: 0, label: subs.channel_availability.label, score: 0 }],
    }
  }
  const validCount = channels.length
  const channelScore = Math.min(validCount / 5, 1) * 100
  // 最低运费渠道（CNY）及其计费重量
  const best = channels.reduce((a, b) => (b.cost < a.cost ? b : a), channels[0])
  const minCny = best.cost
  const effPriceCny = effPrice !== null && effPrice > 0 ? effPrice / deps.rubPerCny : null
  const ratio = effPriceCny !== null && effPriceCny > 0 ? minCny / effPriceCny : null
  const billableKg = best.chargeWeight ?? null
  const items = []
  items.push({ key: 'channel_availability', weight: subs.channel_availability.weight, label: subs.channel_availability.label, score: channelScore })
  items.push({ key: 'shipping_ratio', weight: subs.shipping_ratio.weight, label: subs.shipping_ratio.label,
    score: ratio !== null ? 100 - percentileRank(ratio, pool.shipping_ratio) : null })
  items.push({ key: 'billable_weight', weight: subs.billable_weight.weight, label: subs.billable_weight.label,
    score: billableKg !== null ? 100 - percentileRank(billableKg, pool.billable_weight) : null })
  // 体积重惩罚
  let volScore = 100
  const volCh = channels.find((ch) => ch.volumetricWeight != null && ch.volumetricWeight > 0)
  if (volCh && volCh.chargeWeight > 0) {
    const vr = volCh.volumetricWeight / Math.max(volCh.actualWeightKg || c.weight_kg || 1, 0.001)
    if (vr > 1.5) volScore = 0
    else if (vr > 1.25) volScore = 40
    else if (vr > 1) volScore = 70
  }
  items.push({ key: 'volumetric_penalty', weight: subs.volumetric_penalty.weight, label: subs.volumetric_penalty.label, score: volScore })
  const r = evidenceWeightedScore(items, rules.subs_min_coverage)
  return { ...r, subs: items, blocked: false }
}

function scoreOperations(c, deps, rules, subs) {
  const pool = deps.candidatePool
  const items = []
  items.push({ key: 'sign_rate', weight: subs.sign_rate.weight, label: subs.sign_rate.label,
    score: c.sign_rate != null ? percentileRank(c.sign_rate, pool.sign_rate) : null })
  items.push({ key: 'oos_days_share', weight: subs.oos_days_share.weight, label: subs.oos_days_share.label,
    score: c.oos_days_share != null ? 100 - percentileRank(c.oos_days_share, pool.oos_days_share) : null })
  let stockScore = null
  if (c.stock != null) {
    if (c.stock > 0) stockScore = 100
    else if (c.stock === 0) stockScore = 60
    else stockScore = 30
  }
  items.push({ key: 'stock_availability', weight: subs.stock_availability.weight, label: subs.stock_availability.label, score: stockScore })
  items.push({ key: 'turnover_stability', weight: subs.turnover_stability.weight, label: subs.turnover_stability.label,
    score: c.turnover != null ? 100 - Math.min(100, Math.abs(percentileRank(c.turnover, pool.turnover) - 50) * 2) : null })
  items.push({ key: 'revenue_loss_rate', weight: subs.revenue_loss_rate.weight, label: subs.revenue_loss_rate.label,
    score: c.revenue_loss_rate != null ? 100 - percentileRank(c.revenue_loss_rate, pool.revenue_loss_rate) : null })
  const r = evidenceWeightedScore(items, rules.subs_min_coverage)
  return { ...r, subs: items }
}

// ---------- Supply Gap ----------
function computeSupplyGap(ctx, deps, rules) {
  if (!ctx.benchmark || !ctx.domainTypes || ctx.domainTypes.length < rules.supply_gap.min_comparable_types) return null
  const domTypes = ctx.domainTypes
  const arr = (key) => domTypes.map((t) => {
    const dot = key.indexOf('.')
    return dot >= 0 ? t[key.slice(0, dot)]?.[key.slice(dot + 1)] : t[key]
  }).filter((v) => v !== null && v !== undefined)
  const b = ctx.benchmark
  const demandRank = b.sales_28d?.p50 != null ? percentileRank(b.sales_28d.p50, arr('sales_28d.p50')) : null
  const oosRank = b.oos_days?.p50 != null ? percentileRank(b.oos_days.p50, arr('oos_days.p50')) : null
  const missedRank = b.missed_sales_rub?.p50 != null ? percentileRank(b.missed_sales_rub.p50, arr('missed_sales_rub.p50')) : null
  if (demandRank === null || (oosRank === null && missedRank === null)) return null
  const shortageRank = (oosRank ?? missedRank) * rules.supply_gap.shortage_w_oos + (missedRank ?? oosRank) * rules.supply_gap.shortage_w_missed
  const pressure = rules.supply_gap.pressure_w_demand * demandRank + rules.supply_gap.pressure_w_shortage * shortageRank
  const sellerHhi = b.seller_hhi
  const openness = sellerHhi != null ? 100 - percentileRank(sellerHhi, arr('seller_hhi')) : 50
  const gap = pressure * (0.80 + rules.supply_gap.openness_w * openness / 100)
  const th = rules.supply_gap.thresholds
  let rank = 'NO_STRONG_GAP_SIGNAL'
  if (gap >= th.HIGH_GAP.gap && demandRank >= th.HIGH_GAP.demand && shortageRank >= th.HIGH_GAP.shortage) rank = 'HIGH_GAP'
  else if (gap >= th.MEDIUM_GAP.gap && demandRank >= th.MEDIUM_GAP.demand && shortageRank >= th.MEDIUM_GAP.shortage) rank = 'MEDIUM_GAP'
  return { signal: round1(gap), rank, demandRank: round1(demandRank), shortageRank: round1(shortageRank), entryOpenness: round1(openness) }
}

// ---------- 主入口 ----------
/**
 * @param {object} c canonical 候选行
 * @param {object} marketContext {context, benchmark, matchedType, sampleSize, alpha, domainTypes}
 * @param {object} deps {candidatePool, rubPerCny, calcCelShipping}
 * @param {object} rules scoring_rules.json 内容
 */
export function scoreProduct(c, marketContext, deps, rules) {
  const ctx = marketContext || { context: 'LOW_MARKET_CONTEXT', benchmark: null, matchedType: null, sampleSize: null, alpha: null, domainTypes: [] }
  const dims = rules.dimensions
  const status = []

  // 合规 Gate
  const name = String(c.name || '')
  let complianceHit = false
  for (const words of Object.values(rules.compliance_high_risk_keywords || {})) {
    if (words.some((w) => name.toLowerCase().includes(w.toLowerCase()))) { complianceHit = true; break }
  }
  if (complianceHit) status.push('REVIEW_REQUIRED')
  if (ctx.context === 'LOW_MARKET_CONTEXT') status.push('LOW_MARKET_CONTEXT')
  if (c.gross_margin != null && c.gross_margin < 0) status.push('MARGIN_RISK')

  const dimResults = {}
  dimResults.demand = scoreDemand(c, ctx, deps, rules, dims.demand.subs)
  dimResults.competition = scoreCompetition(ctx, deps, rules, dims.competition.subs)
  dimResults.price_opportunity = scorePrice(c, ctx, deps, rules, dims.price_opportunity.subs)
  dimResults.profitability = scoreProfitability(c, deps, rules, dims.profitability.subs)
  dimResults.logistics = scoreLogistics(c, deps, rules, dims.logistics.subs)
  dimResults.operations = scoreOperations(c, deps, rules, dims.operations.subs)

  // Gate 修正
  if (dimResults.logistics.blocked) {
    status.push('BLOCKED_LOGISTICS')
  } else if (status.includes('BLOCKED_LOGISTICS')) {
    // 不重复
  }
  if (c.gross_margin != null && c.gross_margin < 0 && dimResults.profitability.score !== null) {
    dimResults.profitability.score = Math.min(dimResults.profitability.score, rules.margin_risk_cap)
    dimResults.profitability.capped = true
  }

  // 总分（维度层证据感知）
  const dimItems = Object.entries(dims).map(([key, d]) => ({
    key,
    weight: d.weight,
    score: dimResults[key] && dimResults[key].available ? dimResults[key].score : null,
  }))
  const total = evidenceWeightedScore(dimItems, 0) // 维度层不设 minCoverage，由 NEEDS_DATA 判断
  const evidenceCoverage = total.coverage
  const totalScore = total.available ? round1(total.score) : null

  // 冻结契约：可用维度权重 <50% → NEEDS_DATA → 不可评级（grade=null），totalScore 仅作诊断值保留
  const needsData = evidenceCoverage < 0.5
  if (needsData) status.push('NEEDS_DATA')

  const grade = !needsData && totalScore !== null ? gradeOf(totalScore, rules) : null
  const gradeTentative = ctx.context === 'LOW_MARKET_CONTEXT'

  // Supply Gap
  const supplyGap = computeSupplyGap(ctx, deps, rules)

  // Decision 层（优先级从上到下）
  let decision
  if (status.includes('BLOCKED_LOGISTICS')) decision = { status: 'BLOCKED', action: 'DO_NOT_SAMPLE', reason: 'BLOCKED_LOGISTICS' }
  else if (status.includes('MARGIN_RISK')) decision = { status: 'HOLD', action: 'VERIFY_COST', reason: 'MARGIN_RISK' }
  else if (status.includes('REVIEW_REQUIRED')) decision = { status: 'REVIEW', action: 'COMPLIANCE_REVIEW', reason: 'REVIEW_REQUIRED' }
  else if (status.includes('LOW_MARKET_CONTEXT')) decision = { status: 'RESEARCH', action: 'COLLECT_MARKET_DATA', reason: 'LOW_MARKET_CONTEXT' }
  else if (grade) decision = { status: 'ELIGIBLE', action: rules.decision.ELIGIBLE[grade], reason: 'NO_BLOCKING_FLAG' }
  else decision = { status: 'HOLD', action: 'NEEDS_DATA', reason: 'NEEDS_DATA' }

  return {
    totalScore,
    grade,
    gradeTentative,
    context: ctx.context,
    evidenceCoverage: round2(evidenceCoverage),
    dimensions: Object.fromEntries(Object.entries(dimResults).map(([k, v]) => [k, {
      score: round1(v.score),
      weight: dims[k].weight,
      available: v.available,
      coverage: round2(v.coverage),
      subs: v.subs.map((s) => ({ key: s.key, score: round1(s.score), weight: s.weight, label: s.label })),
    }])),
    supplyGap,
    status,
    decision,
    matchedProductType: ctx.matchedType,
    benchmarkSampleSize: ctx.sampleSize,
    ruleVersion: rules.version,
  }
}
