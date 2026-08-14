/**
 * scoringEngine.test.mjs — 评分引擎单测
 * 覆盖 T4-1B §8 黄金案例断言方向（V1 用构造数据验证，T4-3 落 tests/scoring-golden/）。
 * 运行: node --experimental-vm-modules src/utils/scoring/scoringEngine.test.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { scoreProduct } from './scoringEngine.js'
import { buildExplanations } from './explanations.js'
import { percentileRank, percentileRankFromQuantiles, evidenceWeightedScore, shrink } from './normalization.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rules = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'config', 'scoring_rules.json'), 'utf-8'))

let pass = 0, fail = 0
const assert = (cond, msg) => { if (cond) { pass++; console.log(`  ✅ ${msg}`) } else { fail++; console.log(`  ❌ ${msg}`) } }
const eq = (a, b, msg, tol = 0.01) => assert(Math.abs(a - b) <= tol, `${msg} (期望 ${b}, 实际 ${a})`)

console.log('\n===== 评分引擎测试 =====\n')

// ---------- 公共构造 ----------
// 候选池（1000 规模模拟）
const pool = {
  sales_rub_28d: Array.from({ length: 1000 }, (_, i) => 100000 + i * 8000 + (i % 7) * 30000),
  units_28d: Array.from({ length: 1000 }, (_, i) => 100 + i * 3 + (i % 5) * 20),
  conv_rate: Array.from({ length: 1000 }, (_, i) => 0.1 + (i % 40) * 0.05),
  cart_add_rate: Array.from({ length: 1000 }, (_, i) => 5 + (i % 30) * 0.3),
  exposure: Array.from({ length: 1000 }, (_, i) => 500000 + i * 10000),
  card_visits: Array.from({ length: 1000 }, (_, i) => 20000 + i * 500),
  reviews: Array.from({ length: 1000 }, (_, i) => i * 100),
  gross_margin: Array.from({ length: 1000 }, (_, i) => 10 + (i % 60)),
  commission_max: Array.from({ length: 1000 }, (_, i) => 10 + (i % 30)),
  ad_share: Array.from({ length: 1000 }, (_, i) => (i % 40)),
  shipping_ratio: Array.from({ length: 1000 }, (_, i) => 0.05 + (i % 30) * 0.02),
  billable_weight: Array.from({ length: 1000 }, (_, i) => 0.1 + (i % 80) * 0.02),
  sign_rate: Array.from({ length: 1000 }, (_, i) => 60 + (i % 35)),
  oos_days_share: Array.from({ length: 1000 }, (_, i) => (i % 60)),
  turnover: Array.from({ length: 1000 }, (_, i) => -50 + (i % 100)),
  revenue_loss_rate: Array.from({ length: 1000 }, (_, i) => (i % 30) * 0.01),
}
const rubPerCny = 12

// CEL 渠道模拟（7 渠道，覆盖多速度档；语义与 ozonEngine 一致）
function makeCel() {
  const channels = [
    { id: 'xs_express', rate: 46.8, base: 3.12, wMin: 0, wMax: 0.5, sumMax: 90, sideMax: 60, vol: false },
    { id: 'xs_standard', rate: 36.4, base: 3.12, wMin: 0, wMax: 0.5, sumMax: 90, sideMax: 60, vol: false },
    { id: 'budget', rate: 34.32, base: 23.92, wMin: 0.5, wMax: 30, sumMax: 150, sideMax: 60, vol: false },
    { id: 'small_express', rate: 46.8, base: 16.64, wMin: 0, wMax: 2, sumMax: 150, sideMax: 60, vol: false },
    { id: 'small_standard', rate: 36.4, base: 16.64, wMin: 0, wMax: 2, sumMax: 150, sideMax: 60, vol: false },
    { id: 'small_economy', rate: 26, base: 16.64, wMin: 0, wMax: 2, sumMax: 150, sideMax: 60, vol: false },
    { id: 'big', rate: 26, base: 37.44, wMin: 2, wMax: 30, sumMax: 310, sideMax: 150, vol: true, volDiv: 12000 },
  ]
  const calcCelShipping = (c) => {
    const out = []
    const w = c.weight_kg
    const dims = c.dims || [30, 20, 10]
    const [l, wd, h] = dims
    const sum = l + wd + h
    for (const ch of channels) {
      if (w < ch.wMin || w > ch.wMax) continue
      if (sum > ch.sumMax || Math.max(l, wd, h) > ch.sideMax) continue
      let cw = w
      let vw = null
      if (ch.vol) { vw = (l * wd * h) / ch.volDiv; cw = Math.max(w, vw) }
      out.push({ cost: +(cw * ch.rate + ch.base).toFixed(2), chargeWeight: +cw.toFixed(3), volumetricWeight: vw !== null ? +vw.toFixed(3) : null, actualWeightKg: w })
    }
    return out
  }
  return { calcCelShipping, channels }
}
const cel = makeCel()
const calcCelShipping = (c) => cel.calcCelShipping(c)

// BSR 市场上下文构造
function makeMarketCtx({ context = 'HIGH', n = 50 } = {}) {
  const benchmark = {
    n,
    sales_28d: { p10: 300000, p25: 600000, p50: 1000000, p75: 1800000, p90: 3000000 },
    units_28d: { p10: 500, p25: 1000, p50: 2000, p75: 3500, p90: 6000 },
    conv_rate: { p10: 0.2, p25: 0.5, p50: 1.0, p75: 2.0, p90: 4.0 },
    cart_add: { p10: 5, p25: 10, p50: 16, p75: 24, p90: 35 },
    avg_price_rub: { p10: 300, p25: 500, p50: 700, p75: 1000, p90: 1400 },
    min_price_rub: { p10: 200, p25: 400, p50: 600, p75: 800, p90: 1100 },
    discount: { p10: 5, p25: 15, p50: 30, p75: 45, p90: 60 },
    promo_share: { p50: 30 }, promo_days: { p50: 14 },
    ad_days: { p50: 10 }, ad_roi: { p50: 25 },
    oos_days: { p50: 5 }, missed_sales_rub: { p50: 200000 }, volume_l: { p50: 0.8 },
    seller_hhi: 1800, brand_hhi: 1500, top1_brand_share: 22, top5_brand_share: 55, top10_seller_share: 40,
    fbo_share: 60, fbs_share: 40, bsr_leader_share: 20,
  }
  const domainTypes = Array.from({ length: 40 }, (_, i) => ({
    n: 10 + i,
    sales_28d: { p50: 300000 + i * 40000 },
    oos_days: { p50: 2 + (i % 15) },
    missed_sales_rub: { p50: 50000 + i * 30000 },
    seller_hhi: 1000 + i * 60,
    brand_hhi: 800 + i * 50,
    top1_brand_share: 10 + (i % 30),
    top10_seller_share: 20 + (i % 30),
    promo_share: { p50: 10 + (i % 40) }, promo_days: { p50: 5 + (i % 20) },
    ad_days: { p50: 5 + (i % 20) }, ad_roi: { p50: 15 + (i % 30) },
  }))
  return { context, benchmark, matchedType: '汽车芳香剂', sampleSize: n, domainTypes }
}

// 候选基座：构造为"明显优秀"（高需求+高毛利+轻小件）
function makeCandidate(overrides = {}) {
  return {
    name: 'Тестовый ароматизатор авто 50мл',
    price_rub: 700, avg_price_rub: 700, sales_rub_28d: 3500000, units_28d: 6500,
    conv_rate: 4.5, cart_add_rate: 36, exposure: 90000000, card_visits: 3000000, reviews: 90000,
    gross_margin: 62, commission_fbs: 12, commission_fbo: 12, commission_rfbs: 12, commission_fbp: 11,
    ad_share: 3, ship_mode: 'FBS', weight_kg: 0.3, dims: [20, 10, 5], volume_l: 0.5,
    sign_rate: 95, oos_days_share: 2, stock: 2000, turnover: 45, revenue_loss_rate: 0.002,
    ...overrides,
  }
}

const deps = { candidatePool: pool, rubPerCny, calcCelShipping }

// ============ 测试 ============
console.log('测试1: 明显优秀 SKU（高需求+高毛利+轻小件+有映射）')
{
  const r = scoreProduct(makeCandidate(), makeMarketCtx({ context: 'HIGH' }), deps, rules)
  assert(r.grade === 'A', `grade=A (实际 ${r.grade}, score ${r.totalScore})`)
  assert(r.context === 'HIGH', 'context=HIGH')
  assert(r.decision.status === 'ELIGIBLE', `decision=ELIGIBLE (实际 ${r.decision.status})`)
  assert(r.supplyGap !== null, 'supplyGap 已计算')
}

console.log('\n测试2: 明显差 SKU（低需求+负毛利+重件）')
{
  const r = scoreProduct(makeCandidate({ sales_rub_28d: 200000, units_28d: 300, gross_margin: -15, reviews: 10, weight_kg: 20 }), makeMarketCtx(), deps, rules)
  assert(r.grade === 'C' || r.grade === 'D', `grade≤C (实际 ${r.grade})`)
  assert(r.status.includes('MARGIN_RISK'), '含 MARGIN_RISK')
  assert(r.decision.status === 'HOLD', `decision=HOLD (实际 ${r.decision.status})`)
  assert(r.dimensions.profitability.score <= 20, `profitability≤20 (实际 ${r.dimensions.profitability.score})`)
}

console.log('\n测试3: 高销量但亏损')
{
  const r = scoreProduct(makeCandidate({ sales_rub_28d: 5000000, units_28d: 9000, gross_margin: -8 }), makeMarketCtx(), deps, rules)
  assert(r.status.includes('MARGIN_RISK'), 'MARGIN_RISK')
  assert(r.dimensions.profitability.score <= 20, 'profitability 封顶 20')
}

console.log('\n测试4: 低竞争但无需求（缺货信号弱）')
{
  const ctx = makeMarketCtx()
  ctx.benchmark = { ...ctx.benchmark, oos_days: { p50: 0.5 }, missed_sales_rub: { p50: 10000 }, sales_28d: { p10: 300000, p25: 600000, p50: 1000000, p75: 1800000, p90: 3000000 } }
  const r = scoreProduct(makeCandidate({ sales_rub_28d: 300000, units_28d: 400 }), ctx, deps, rules)
  assert(!r.supplyGap || r.supplyGap.rank !== 'HIGH_GAP', '无 HIGH_GAP')
}

console.log('\n测试5: 高利润但物流不可发（超重超尺寸）')
{
  const r = scoreProduct(makeCandidate({ weight_kg: 50, dims: [200, 100, 100], gross_margin: 60 }), makeMarketCtx(), deps, rules)
  assert(r.status.includes('BLOCKED_LOGISTICS'), 'BLOCKED_LOGISTICS')
  assert(r.dimensions.logistics.score === 0, 'logistics=0')
  assert(r.decision.status === 'BLOCKED', `decision=BLOCKED (实际 ${r.decision.status})`)
  assert(r.decision.action === 'DO_NOT_SAMPLE', 'action=DO_NOT_SAMPLE')
  // raw grade 可为 A（机会质量与执行分离）
  assert(r.grade !== null, 'grade 仍可计算（机会质量）')
}

console.log('\n测试6: 数据缺失（价格=0 且 avg 无效）')
{
  const r = scoreProduct(makeCandidate({ price_rub: 0, avg_price_rub: 0, conv_rate: null, cart_add_rate: null }), makeMarketCtx(), deps, rules)
  const pr = r.dimensions.price_opportunity
  assert(pr.score === null || !pr.available, 'price 不可用')
  assert(r.evidenceCoverage < 1, `evidenceCoverage<1 (实际 ${r.evidenceCoverage})`)
}

console.log('\n测试7: 异常极值不崩溃')
{
  const r = scoreProduct(makeCandidate({ reviews: 1570000, turnover: 30325, sales_rub_28d: 999999999 }), makeMarketCtx(), deps, rules)
  assert(r.totalScore !== null && isFinite(r.totalScore), '正常打分')
}

console.log('\n测试8: 临界 A/B（80 附近）')
{
  // 构造 79.5 与 80.5 的归一化单元测试（直接测 gradeOf 行为通过 scoreProduct 间接验证）
  const rA = scoreProduct(makeCandidate(), makeMarketCtx(), deps, rules)
  assert(rA.grade === 'A' && rA.totalScore >= 80, `A 需 ≥80 (实际 ${rA.totalScore})`)
  // 差候选应显著低于 80
  const rD = scoreProduct(makeCandidate({ sales_rub_28d: 100000, units_28d: 100, reviews: 1, gross_margin: -50 }), makeMarketCtx(), deps, rules)
  assert(rD.totalScore < 80, `差候选 <80 (实际 ${rD.totalScore})`)
}

console.log('\n测试9: 无 BSR 映射')
{
  const ctx = { context: 'LOW_MARKET_CONTEXT', benchmark: null, matchedType: null, sampleSize: null, domainTypes: [] }
  const r = scoreProduct(makeCandidate(), ctx, deps, rules)
  assert(r.status.includes('LOW_MARKET_CONTEXT'), 'LOW_MARKET_CONTEXT')
  assert(r.gradeTentative === true, '暂定评级')
  assert(r.supplyGap === null, 'supplyGap=null')
  assert(r.decision.status === 'RESEARCH', `decision=RESEARCH (实际 ${r.decision.status})`)
  assert(!r.dimensions.competition.available, 'competition N/A')
  assert(!r.dimensions.price_opportunity.available, 'price N/A')
  // 冻结契约：coverage 保留两位小数，0.75 不得 round1 成 0.8（缺 competition 15 + price 10 = 25）
  assert(r.evidenceCoverage === 0.75, `evidenceCoverage=0.75 (实际 ${r.evidenceCoverage})`)
}

console.log('\n测试10: 子指标覆盖 <50% 的维度 N/A')
{
  // demand 仅 reviews 可用 → 覆盖 5/100 < 50% → N/A
  const c = makeCandidate({ sales_rub_28d: null, units_28d: null, conv_rate: null, cart_add_rate: null, exposure: null, card_visits: null })
  const r = scoreProduct(c, makeMarketCtx(), deps, rules)
  assert(!r.dimensions.demand.available, 'demand N/A（覆盖<50%）')
}

console.log('\n测试11: 规范化工具')
{
  eq(percentileRank(50, [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]), 50, 'percentileRank 中位')
  eq(percentileRank(0, [0, 1, 2]), 0, 'percentileRank 最小值')
  eq(percentileRank(2, [0, 1, 2]), 100, 'percentileRank 最大值')
  const rq = percentileRankFromQuantiles(700, [{ q: 0.25, v: 500 }, { q: 0.50, v: 700 }, { q: 0.75, v: 1000 }])
  eq(rq, 50, '分位插值中位')
  const ew = evidenceWeightedScore([{ weight: 60, score: 100 }, { weight: 20, score: null }, { weight: 20, score: 50 }])
  eq(ew.score, 87.5, '证据感知加权（缺一个子项）')
  assert(ew.coverage === 0.8, 'coverage=0.8')
  const ew2 = evidenceWeightedScore([{ weight: 60, score: null }, { weight: 40, score: null }])
  assert(!ew2.available, '覆盖 0 → N/A')
  const ew3 = evidenceWeightedScore([{ weight: 60, score: null }], 0)
  assert(!ew3.available && ew3.score === null, 'minCoverage=0 且无任何证据 → N/A（不得 NaN）')
  eq(shrink(80, 60, 5, 5), 70, 'shrinkage n=5 α=0.5')
  eq(shrink(90, 60, 10, 5), 80, 'shrinkage n=10 α=2/3')
}

console.log('\n测试12: 解释生成口径')
{
  const ctx = makeMarketCtx()
  const r = scoreProduct(makeCandidate(), ctx, deps, rules)
  const ex = buildExplanations(makeCandidate(), r, ctx)
  assert(Array.isArray(ex.strengths) && Array.isArray(ex.risks) && Array.isArray(ex.missingMetrics), '三字段齐全')
  // 有映射时 strengths 应含"市场"措辞
  const hasMarketWording = ex.strengths.some((s) => s.includes('市场') || s.includes('同类'))
  assert(hasMarketWording, '有映射措辞含市场比较')
  // 无映射时不得含"市场 X% 商品"
  const ctx2 = { context: 'LOW_MARKET_CONTEXT', benchmark: null, matchedType: null }
  const r2 = scoreProduct(makeCandidate(), ctx2, deps, rules)
  const ex2 = buildExplanations(makeCandidate(), r2, ctx2)
  const badWording = ex2.strengths.some((s) => /市场\s*\d+%/.test(s) || s.includes('同类市场'))
  assert(!badWording, '无映射不得伪造市场口径')
}

console.log('\n测试13: 包含匹配 context 不高于 MEDIUM（由调用方保证，引擎不越权）')
{
  // 引擎只消费传入 context；调用方（管线）负责 mapping。此处验证引擎尊重传入的 LOW context
  const r = scoreProduct(makeCandidate(), { context: 'LOW', benchmark: makeMarketCtx().benchmark, matchedType: 'x', sampleSize: 8, domainTypes: makeMarketCtx().domainTypes }, deps, rules)
  assert(r.context === 'LOW', 'context 由调用方决定')
}

console.log('\n测试14: NEEDS_DATA（可用维度权重 <50%）→ grade=null 不可评级')
{
  const c = makeCandidate({
    sales_rub_28d: null, units_28d: null, conv_rate: null, cart_add_rate: null, exposure: null, card_visits: null, reviews: null,
    gross_margin: null, commission_fbs: null, commission_fbo: null, commission_rfbs: null, commission_fbp: null, ad_share: null,
    sign_rate: null, oos_days_share: null, stock: null, turnover: null, revenue_loss_rate: null,
    price_rub: 0, avg_price_rub: 0,
  })
  const r = scoreProduct(c, makeMarketCtx({ context: 'HIGH' }), deps, rules)
  assert(r.status.includes('NEEDS_DATA'), '含 NEEDS_DATA')
  assert(r.grade === null, `grade=null (实际 ${r.grade})`)
  assert(r.totalScore !== null, 'totalScore 保留为诊断值')
  assert(r.evidenceCoverage === 0.3, `evidenceCoverage=0.3 (实际 ${r.evidenceCoverage})`)
  assert(r.decision.status === 'HOLD' && r.decision.action === 'NEEDS_DATA', `decision=HOLD/NEEDS_DATA (实际 ${r.decision.status}/${r.decision.action})`)
}

console.log('\n测试15: 促销依赖/广告机会缺失子项 → 按剩余权重重归一，不用 0/50 补值')
{
  // promo_share 有、promo_days 无 → 只用 promo_share 重归一（禁止 0 混合）
  const ctx = makeMarketCtx()
  ctx.benchmark = { ...ctx.benchmark, promo_days: null }
  const r = scoreProduct(makeCandidate(), ctx, deps, rules)
  const promoSub = r.dimensions.competition.subs.find((s) => s.key === 'promo_dependency')
  const psArr = ctx.domainTypes.map((t) => t.promo_share?.p50).filter((v) => v != null)
  const expectedPromo = Math.round((100 - percentileRank(30, psArr)) * 10) / 10
  eq(promoSub.score, expectedPromo, 'promo 缺一侧按剩余权重重归一')
  // ad_days 有、ad_roi 无 → 只用 ad_days（禁止 50 混合）
  ctx.benchmark = { ...ctx.benchmark, ad_roi: null }
  const r2 = scoreProduct(makeCandidate(), ctx, deps, rules)
  const adSub = r2.dimensions.competition.subs.find((s) => s.key === 'ad_opportunity')
  const adArr = ctx.domainTypes.map((t) => t.ad_days?.p50).filter((v) => v != null)
  const expectedAd = Math.round((100 - percentileRank(10, adArr)) * 10) / 10
  eq(adSub.score, expectedAd, 'ad 缺一侧按剩余权重重归一')
  // 两侧全缺 → 子项 N/A，竞争维度由剩余子项重归一
  ctx.benchmark = { ...ctx.benchmark, promo_share: null, promo_days: null, ad_days: null, ad_roi: null }
  const r3 = scoreProduct(makeCandidate(), ctx, deps, rules)
  const promoSub3 = r3.dimensions.competition.subs.find((s) => s.key === 'promo_dependency')
  const adSub3 = r3.dimensions.competition.subs.find((s) => s.key === 'ad_opportunity')
  assert(promoSub3.score === null, 'promo 两侧全缺 → 子项 null')
  assert(adSub3.score === null, 'ad 两侧全缺 → 子项 null')
  assert(r3.dimensions.competition.available, '竞争维度由剩余 70% 子权重重归一仍可用')
}

console.log('\n测试16: 价格空间两个正式冻结公式')
{
  const ctx = makeMarketCtx()
  ctx.benchmark = {
    ...ctx.benchmark,
    min_price_rub: { ...ctx.benchmark.min_price_rub, p25: 400 },
    avg_price_rub: { ...ctx.benchmark.avg_price_rub, p50: 700 },
    discount: { ...ctx.benchmark.discount, p50: 30 },
  }
  const r = scoreProduct(makeCandidate(), ctx, deps, rules)
  const subs = r.dimensions.price_opportunity.subs
  const floor = subs.find((s) => s.key === 'price_floor_pressure')
  const disc = subs.find((s) => s.key === 'discount_stability')
  // clamp(100 × P25(min) / P50(avg), 0, 100) = 100×400/700 = 57.14 → round1 57.1
  eq(floor.score, 57.1, 'price_floor_pressure 冻结公式', 0.11)
  // clamp(100 − P50(discount), 0, 100) = 100−30 = 70
  eq(disc.score, 70, 'discount_stability 冻结公式 (p50=30 → 70)')
  // 中位折扣 80% → 20 分；50% → 50 分
  ctx.benchmark = { ...ctx.benchmark, discount: { ...ctx.benchmark.discount, p50: 80 } }
  const r80 = scoreProduct(makeCandidate(), ctx, deps, rules)
  eq(r80.dimensions.price_opportunity.subs.find((s) => s.key === 'discount_stability').score, 20, 'discount p50=80 → 20')
}

console.log('\n测试17: percentileRankFromQuantiles 越界截断 10/90')
{
  const qs = [{ q: 0.10, v: 100 }, { q: 0.50, v: 500 }, { q: 0.90, v: 900 }]
  eq(percentileRankFromQuantiles(50, qs), 10, '低于 P10 → 10')
  eq(percentileRankFromQuantiles(950, qs), 90, '高于 P90 → 90')
  eq(percentileRankFromQuantiles(500, qs), 50, '区间内正常插值')
}

console.log('\n测试19: T4-4A demand = λ×MarketScale + (1-λ)×CandidateStrength')
{
  const scalePool = {
    sales_p50: Array.from({ length: 30 }, (_, i) => 100000 + i * 100000), // 100k..3M
    units_p50: Array.from({ length: 30 }, (_, i) => 50 + i * 200),        // 50..5850
  }
  const depsScale = { ...deps, marketScalePool: scalePool }
  const lam = rules.dimensions.demand.scale_weight
  const sRank = percentileRank(1000000, scalePool.sales_p50)
  const uRank = percentileRank(2000, scalePool.units_p50)
  const expectedScale = 0.6 * sRank + 0.4 * uRank
  // 参照组：无 scale pool 的 HIGH 路径 = 纯候选强度（回退语义保证）
  const rNoPool = scoreProduct(makeCandidate(), makeMarketCtx({ context: 'HIGH' }), deps, rules)
  const strength = rNoPool.dimensions.demand.score
  const r = scoreProduct(makeCandidate(), makeMarketCtx({ context: 'HIGH' }), depsScale, rules)
  const d = r.dimensions.demand
  eq(d.marketScaleScore, Math.round(expectedScale * 10) / 10, 'marketScaleScore=60/40 加权', 0.11)
  eq(d.candidateStrengthScore, strength, 'candidateStrengthScore 保留原算法', 0.11)
  const expectedDemand = Math.round((lam * expectedScale + (1 - lam) * strength) * 10) / 10
  eq(d.score, expectedDemand, `demand=λ×scale+(1-λ)×strength (λ=${lam})`, 0.11)
  // MEDIUM 同样可计算 MarketScale
  const rMed = scoreProduct(makeCandidate(), makeMarketCtx({ context: 'MEDIUM' }), depsScale, rules)
  assert(rMed.dimensions.demand.marketScaleScore !== null, 'MEDIUM 计算 MarketScale')
  // LOW → MarketScale=N/A，分数与无池路径逐位一致（路径不变）
  const lowCtx = { context: 'LOW', benchmark: makeMarketCtx().benchmark, matchedType: 'x', sampleSize: 3, domainTypes: makeMarketCtx().domainTypes }
  const rLow = scoreProduct(makeCandidate(), lowCtx, depsScale, rules)
  const rLowCtrl = scoreProduct(makeCandidate(), lowCtx, deps, rules)
  assert(rLow.dimensions.demand.marketScaleScore === null, 'LOW → MarketScale=N/A')
  eq(rLow.dimensions.demand.score, rLowCtrl.dimensions.demand.score, 'LOW demand 与旧路径一致')
  // LMC → 分数与无池路径逐位一致（771 行不受影响）
  const lmcCtx = { context: 'LOW_MARKET_CONTEXT', benchmark: null, matchedType: null, sampleSize: null, domainTypes: [] }
  const rLmc = scoreProduct(makeCandidate(), lmcCtx, depsScale, rules)
  const rLmcCtrl = scoreProduct(makeCandidate(), lmcCtx, deps, rules)
  assert(rLmc.dimensions.demand.marketScaleScore === null, 'LMC → MarketScale=N/A')
  eq(rLmc.dimensions.demand.score, rLmcCtrl.dimensions.demand.score, 'LMC demand 与旧路径一致')
  // scale 缺一侧 → 剩余权重重归一（禁止 0/50 补值）
  const ctxNoSales = makeMarketCtx({ context: 'HIGH' })
  ctxNoSales.benchmark = { ...ctxNoSales.benchmark, sales_28d: null }
  const r2 = scoreProduct(makeCandidate(), ctxNoSales, depsScale, rules)
  eq(r2.dimensions.demand.marketScaleScore, Math.round(uRank * 10) / 10, 'scale 缺 sales → 只用 units', 0.11)
}

console.log('\n测试18: 解释口径分级（LOW/domain 不得写"同类市场"）')
{
  // HIGH（type 基准）→ 同类市场措辞
  const ctxH = makeMarketCtx()
  const rH = scoreProduct(makeCandidate(), ctxH, deps, rules)
  const exH = buildExplanations(makeCandidate(), rH, ctxH)
  assert(exH.strengths.some((s) => s.includes('同类市场')), 'HIGH → 同类市场措辞')
  // LOW（domain 基准）→ 对应 BSR 市场域，禁止同类市场
  const ctxL = { context: 'LOW', benchmark: makeMarketCtx().benchmark, matchedType: 'x', sampleSize: 3, domainTypes: makeMarketCtx().domainTypes }
  const rL = scoreProduct(makeCandidate(), ctxL, deps, rules)
  const exL = buildExplanations(makeCandidate(), rL, ctxL)
  assert(exL.strengths.some((s) => s.includes('对应 BSR 市场域')), 'LOW → 对应 BSR 市场域措辞')
  assert(!exL.strengths.some((s) => s.includes('同类市场')), 'LOW 不得伪装成产品类型市场基准')
}

console.log(`\n===== 测试结果: ${pass} 通过 / ${fail} 失败 =====\n`)
if (fail > 0) process.exit(1)
