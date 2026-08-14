/**
 * scoring/monotonicity.test.mjs — T4-3 第二层：单调性 / 不变式测试
 * 以 tests/scoring-golden/excellent-mapped.json 固件为基座，只改单一输入，
 * 断言对应维度方向（"不得下降/不得上升"允许等值，容差 1e-9）。
 * 覆盖 7 组：销售额↑→demand、毛利↑→profitability、广告负担↑→profitability、
 * seller HHI↑→competition、物流成本占比↑→logistics、有/无 CEL→BLOCKED、
 * 删 benchmark→competition/price/supplyGap N/A（不切全局基准）。
 * 运行: node --experimental-vm-modules src/utils/scoring/monotonicity.test.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { scoreProduct } from './scoringEngine.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rules = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'config', 'scoring_rules.json'), 'utf-8'))
const { calcShipping, ALL_CHANNELS } = await import(pathToFileURL(path.join(__dirname, '..', 'ozonEngine.js')).href)

const fx = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'tests', 'scoring-golden', 'excellent-mapped.json'), 'utf-8'))
const baseCase = fx.cases[0]
const baseCandidate = baseCase.candidate
const baseCtx = baseCase.marketContext

const effPriceOf = (c) => (c.price_rub > 0 ? c.price_rub : (c.avg_price_rub && c.avg_price_rub > 0 ? c.avg_price_rub : null))
const dimsValid = (c) => Array.isArray(c.dims) && c.dims.length === 3 && c.dims.every((v) => v !== null && v !== undefined && v > 0)
const makeCel = (scale = 1) => (c) => {
  if (!(c.weight_kg > 0) || !dimsValid(c)) return []
  const p = effPriceOf(c) ?? 1
  const out = []
  for (const ch of ALL_CHANNELS) {
    const res = calcShipping(ch, p, c.weight_kg, c.dims[0], c.dims[1], c.dims[2])
    if (res) out.push({ ...res, cost: res.cost * scale })
  }
  return out
}

let pass = 0, fail = 0
const assert = (cond, msg, detail = '') => {
  if (cond) { pass++; console.log(`  ✅ ${msg}${detail ? ` (${detail})` : ''}`) }
  else { fail++; console.log(`  ❌ ${msg}${detail ? ` (${detail})` : ''}`) }
}

console.log('\n===== 单调性 / 不变式测试 =====\n')

console.log('M1: 销售额 ↑ → demand 不得下降')
{
  const deps = { candidatePool: fx.pool, rubPerCny: fx.rubPerCny, calcCelShipping: makeCel() }
  const low = scoreProduct({ ...baseCandidate, sales_rub_28d: 800000 }, baseCtx, deps, rules)
  const high = scoreProduct({ ...baseCandidate, sales_rub_28d: 3500000 }, baseCtx, deps, rules)
  assert(high.dimensions.demand.score >= low.dimensions.demand.score - 1e-9,
    'demand(3.5M) >= demand(800k)', `${low.dimensions.demand.score} → ${high.dimensions.demand.score}`)
  assert(high.dimensions.demand.score > low.dimensions.demand.score, '方向严格为正')
}

console.log('M2: 毛利率 ↑ → profitability 不得下降')
{
  const deps = { candidatePool: fx.pool, rubPerCny: fx.rubPerCny, calcCelShipping: makeCel() }
  const g30 = scoreProduct({ ...baseCandidate, gross_margin: 30 }, baseCtx, deps, rules)
  const g50 = scoreProduct({ ...baseCandidate, gross_margin: 50 }, baseCtx, deps, rules)
  assert(g50.dimensions.profitability.score >= g30.dimensions.profitability.score - 1e-9,
    'profitability(50) >= profitability(30)', `${g30.dimensions.profitability.score} → ${g50.dimensions.profitability.score}`)
  assert(g50.dimensions.profitability.score > g30.dimensions.profitability.score, '方向严格为正')
}

console.log('M3: 广告负担 ↑ → profitability 不得上升')
{
  const deps = { candidatePool: fx.pool, rubPerCny: fx.rubPerCny, calcCelShipping: makeCel() }
  const a3 = scoreProduct({ ...baseCandidate, ad_share: 3 }, baseCtx, deps, rules)
  const a20 = scoreProduct({ ...baseCandidate, ad_share: 20 }, baseCtx, deps, rules)
  assert(a20.dimensions.profitability.score <= a3.dimensions.profitability.score + 1e-9,
    'profitability(ad20) <= profitability(ad3)', `${a3.dimensions.profitability.score} → ${a20.dimensions.profitability.score}`)
  assert(a20.dimensions.profitability.score < a3.dimensions.profitability.score, '方向严格为负')
}

console.log('M4: seller HHI ↑ → competition 不得上升')
{
  const deps = { candidatePool: fx.pool, rubPerCny: fx.rubPerCny, calcCelShipping: makeCel() }
  const lo = scoreProduct(baseCandidate, { ...baseCtx, benchmark: { ...baseCtx.benchmark, seller_hhi: 1200 } }, deps, rules)
  const hi = scoreProduct(baseCandidate, { ...baseCtx, benchmark: { ...baseCtx.benchmark, seller_hhi: 1800 } }, deps, rules)
  assert(hi.dimensions.competition.score <= lo.dimensions.competition.score + 1e-9,
    'competition(HHI1800) <= competition(HHI1200)', `${lo.dimensions.competition.score} → ${hi.dimensions.competition.score}`)
  assert(hi.dimensions.competition.score < lo.dimensions.competition.score, '方向严格为负')
}

console.log('M5: 物流成本占比 ↑ → logistics 不得上升')
{
  const c1 = { candidatePool: fx.pool, rubPerCny: fx.rubPerCny, calcCelShipping: makeCel(1) }
  const c2 = { candidatePool: fx.pool, rubPerCny: fx.rubPerCny, calcCelShipping: makeCel(2) }
  const lo = scoreProduct(baseCandidate, baseCtx, c1, rules)
  const hi = scoreProduct(baseCandidate, baseCtx, c2, rules)
  assert(hi.dimensions.logistics.score <= lo.dimensions.logistics.score + 1e-9,
    'logistics(cost×2) <= logistics(cost×1)', `${lo.dimensions.logistics.score} → ${hi.dimensions.logistics.score}`)
  assert(hi.dimensions.logistics.score < lo.dimensions.logistics.score, '方向严格为负')
}

console.log('M6: 有 CEL 渠道 → 无 CEL 渠道 → BLOCKED_LOGISTICS 必须出现')
{
  const withCel = { candidatePool: fx.pool, rubPerCny: fx.rubPerCny, calcCelShipping: makeCel() }
  const noCel = { candidatePool: fx.pool, rubPerCny: fx.rubPerCny, calcCelShipping: () => [] }
  const r1 = scoreProduct(baseCandidate, baseCtx, withCel, rules)
  const r2 = scoreProduct(baseCandidate, baseCtx, noCel, rules)
  assert(!r1.status.includes('BLOCKED_LOGISTICS'), '有渠道时无 BLOCKED')
  assert(r2.status.includes('BLOCKED_LOGISTICS'), '无渠道时 BLOCKED_LOGISTICS 出现')
  assert(r2.dimensions.logistics.score === 0, '无渠道 logistics=0')
  assert(r2.decision.status === 'BLOCKED' && r2.decision.action === 'DO_NOT_SAMPLE', 'decision=BLOCKED/DO_NOT_SAMPLE')
}

console.log('M7: 删除 BSR benchmark → competition/price/supplyGap N/A（不得偷切全局基准）')
{
  const deps = { candidatePool: fx.pool, rubPerCny: fx.rubPerCny, calcCelShipping: makeCel() }
  const withB = scoreProduct(baseCandidate, baseCtx, deps, rules)
  const lmcCtx = { context: 'LOW_MARKET_CONTEXT', benchmark: null, matchedType: null, sampleSize: null, domainTypes: [] }
  const noB = scoreProduct(baseCandidate, lmcCtx, deps, rules)
  assert(withB.dimensions.competition.available, '有基准时 competition 可用（对照组）')
  assert(!noB.dimensions.competition.available, '删基准后 competition N/A')
  assert(!noB.dimensions.price_opportunity.available, '删基准后 price N/A')
  assert(noB.supplyGap === null, '删基准后 supplyGap=null')
  assert(noB.dimensions.demand.available, 'demand 仍可用（候选池口径，不是全局基准）')
  assert(noB.status.includes('LOW_MARKET_CONTEXT'), 'LOW_MARKET_CONTEXT 标记')
}

console.log(`\n===== 单调性结果: ${pass} 通过 / ${fail} 失败 =====\n`)
if (fail > 0) process.exit(1)
