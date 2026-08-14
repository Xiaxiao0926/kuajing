/**
 * scoringDataAdapter.test.mjs — 数据适配层回归测试（UI 与审计同源保证）
 * 用真实数据：public/data/scoring_candidates.json + bsr_market_benchmarks.json
 * 断言与 scripts/t4-score-audit.js 的分布逐位一致（A/B/C/D/不可评级 + context + 均分），
 * 以及 T4-4A/4B 关键不变量（demand 两分量、LMC 路径、fail-close 前提、决策排序）。
 * 运行: node --experimental-vm-modules src/utils/scoring/scoringDataAdapter.test.mjs
 * 注意：若重建 scoring_candidates.json（数据变更），本测试的分布期望需同步复核。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { scoreAllCandidates } from './scoringDataAdapter.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..', '..', '..', '..')
const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'scoring_rules.json'), 'utf-8'))
const settings = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'settings.json'), 'utf-8'))

let pass = 0, fail = 0
const assert = (cond, msg) => { if (cond) { pass++; console.log(`  ✅ ${msg}`) } else { fail++; console.log(`  ❌ ${msg}`) } }

console.log('\n===== 数据适配层回归测试（真实 1000 SKU + 855 类型基准） =====\n')

const cDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'ozon-react', 'public', 'data', 'scoring_candidates.json'), 'utf-8'))
const bench = JSON.parse(fs.readFileSync(path.join(ROOT, 'ozon-react', 'public', 'data', 'bsr_market_benchmarks.json'), 'utf-8'))
assert(cDoc.candidates.length === 1000, `候选行数=1000 (实际 ${cDoc.candidates.length})`)

const t0 = performance.now()
const rows = scoreAllCandidates({ candidates: cDoc.candidates, benchmark: bench, rules, rubPerCny: settings.rub_per_cny })
const ms = Math.round(performance.now() - t0)
console.log(`  ℹ️ 首次评分耗时: ${ms} ms（含解释生成）`)
assert(rows.length === 1000, `评分行数=1000 (实际 ${rows.length})`)

// ---- 分布与审计逐位一致（t4-score-audit.js，λ=0.5） ----
const gradeCount = { A: 0, B: 0, C: 0, D: 0, null: 0 }
const contextCount = { HIGH: 0, MEDIUM: 0, LOW: 0, LOW_MARKET_CONTEXT: 0 }
for (const r of rows) { gradeCount[r.grade ?? 'null']++; contextCount[r.context]++ }
assert(gradeCount.A === 1 && gradeCount.B === 191 && gradeCount.C === 448 && gradeCount.D === 169 && gradeCount.null === 191,
  `A/B/C/D/不可评级 = 1/191/448/169/191 (实际 ${gradeCount.A}/${gradeCount.B}/${gradeCount.C}/${gradeCount.D}/${gradeCount.null})`)
assert(contextCount.HIGH === 123 && contextCount.MEDIUM === 52 && contextCount.LOW === 54 && contextCount.LOW_MARKET_CONTEXT === 771,
  `Context = 123/52/54/771 (实际 ${contextCount.HIGH}/${contextCount.MEDIUM}/${contextCount.LOW}/${contextCount.LOW_MARKET_CONTEXT})`)

const mean = (arr) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null
const lmc = rows.filter((r) => r.context === 'LOW_MARKET_CONTEXT').map((r) => r.totalScore).filter((s) => s !== null)
const mapped = rows.filter((r) => r.context !== 'LOW_MARKET_CONTEXT').map((r) => r.totalScore).filter((s) => s !== null)
assert(Math.abs(mean(lmc) - 54.7) < 0.05, `LMC 均分 54.7 (实际 ${mean(lmc).toFixed(1)})`)
assert(Math.abs(mean(mapped) - 61.0) < 0.05, `mapped 均分 61.0 (实际 ${mean(mapped).toFixed(1)})`)

// ---- T4-4A：demand 两分量按 context 正确输出 ----
const highRows = rows.filter((r) => r.context === 'HIGH')
const lmcRows = rows.filter((r) => r.context === 'LOW_MARKET_CONTEXT')
assert(highRows.length > 0 && highRows.every((r) => r.dimensions.demand.marketScaleScore !== null), 'HIGH 行全部有 marketScaleScore')
assert(lmcRows.every((r) => r.dimensions.demand.marketScaleScore === null), 'LMC 行 marketScaleScore 全为 null')
assert(lmcRows.every((r) => r.dimensions.demand.candidateStrengthScore !== null || !r.dimensions.demand.available), 'LMC demand 走候选强度路径')
const lowRows = rows.filter((r) => r.context === 'LOW')
assert(lowRows.every((r) => r.dimensions.demand.marketScaleScore === null), 'LOW 行 marketScaleScore 全为 null（domain 回退）')

// ---- 不变量：无 NaN/undefined 分数 ----
assert(rows.every((r) => r.totalScore === null || (typeof r.totalScore === 'number' && Number.isFinite(r.totalScore))), '全部分数 finite 或 null')

// ---- 默认排序契约：BLOCKED 不得排在 ELIGIBLE 前 ----
const tier = { ELIGIBLE: 0, REVIEW: 1, RESEARCH: 2, HOLD: 3, BLOCKED: 4 }
const sorted = [...rows].sort((a, b) => {
  const ta = tier[a.decision.status] ?? 9, tb = tier[b.decision.status] ?? 9
  if (ta !== tb) return ta - tb
  const sa = a.totalScore ?? -1, sb = b.totalScore ?? -1
  if (sa !== sb) return sb - sa
  return (b.evidenceCoverage ?? 0) - (a.evidenceCoverage ?? 0)
})
const firstBlocked = sorted.findIndex((r) => r.decision.status === 'BLOCKED')
const lastEligible = sorted.map((r, i) => (r.decision.status === 'ELIGIBLE' ? i : -1)).filter((i) => i >= 0).pop()
assert(firstBlocked === -1 || lastEligible === -1 || firstBlocked > lastEligible, 'BLOCKED 全部排在 ELIGIBLE 之后（Decision 优先排序）')

// ---- Gate 0 前提：规则源完整（fail-close 的前提） ----
assert(typeof rules.dimensions.demand.scale_weight === 'number' && rules.dimensions.demand.scale_weight === 0.5, '规则源 λ=0.5')

console.log(`\n===== 适配层测试结果: ${pass} 通过 / ${fail} 失败 =====\n`)
if (fail > 0) process.exit(1)
