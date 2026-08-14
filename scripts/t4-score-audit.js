// T4-2/T4-3/T4-4A 1000 SKU 分数分布审计
// 输出：A/B/C/D/不可评级 五档分布、LOW_MARKET_CONTEXT 虚高检查、Top20% 模型 enrichment、
//       维度验证矩阵。数据适配层（映射/shrinkage/池/CEL）与 UI 同源：scoringDataAdapter.js。
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { loadCanonicalCandidates } = require('./scoring-xlsx.js');

const ROOT = process.cwd();

async function main() {
  const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'scoring_rules.json'), 'utf-8'));
  // T4-4A 校准实验：T4_SCALE_WEIGHT 环境变量临时覆盖 λ（生产值以 scoring_rules.json 为准）
  const scaleOverride = process.env.T4_SCALE_WEIGHT;
  if (scaleOverride != null && !isNaN(parseFloat(scaleOverride))) {
    rules.dimensions.demand.scale_weight = parseFloat(scaleOverride);
  }
  console.log(`[audit] demand scale_weight λ = ${rules.dimensions.demand.scale_weight}`);
  const settings = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'settings.json'), 'utf-8'));
  const bench = JSON.parse(fs.readFileSync(path.join(ROOT, 'ozon-react', 'public', 'data', 'bsr_market_benchmarks.json'), 'utf-8'));
  const { scoreProduct } = await import(pathToFileURL(path.join(ROOT, 'ozon-react', 'src', 'utils', 'scoring', 'scoringEngine.js')).href);
  const adapter = await import(pathToFileURL(path.join(ROOT, 'ozon-react', 'src', 'utils', 'scoring', 'scoringDataAdapter.js')).href);

  // ---- 1. 读候选（唯一解析实现：scripts/scoring-xlsx.js） ----
  const candidates = loadCanonicalCandidates(path.join(ROOT, '选品', '跨境项目产品线扩展计划.xlsx'));

  // ---- 2/3. 候选池 + 市场基准索引（与 UI 同源：scoringDataAdapter） ----
  const index = adapter.buildBsrIndex(bench);
  const { typeBench, domainBench, marketScalePool } = index;
  console.log(`[audit] marketScalePool: sales_p50 n=${marketScalePool.sales_p50.length}, units_p50 n=${marketScalePool.units_p50.length}`);
  const candidatePool = adapter.buildCandidatePool(candidates);
  const celChannels = adapter.makeCelChannels();
  const effPriceOf = adapter.effPriceOf;
  const dimsValid = adapter.dimsValid;
  adapter.fillLogisticsPools(candidatePool, candidates, celChannels, settings.rub_per_cny);
  adapter.sortPools(candidatePool);
  marketScalePool.sales_p50.sort((a, b) => a - b);
  marketScalePool.units_p50.sort((a, b) => a - b);

  // ---- 3/4. 类型映射 + 物流池预计算（与 UI 同源：scoringDataAdapter，禁止本地重复实现） ----

  // ---- 5. 评分 ----
  const results = candidates.map((c) => {
    const m = adapter.matchType(c.category_leaf, index)
    const ctx = adapter.buildMarketContext(m, index)
    const deps = { candidatePool, rubPerCny: settings.rub_per_cny, calcCelShipping: celChannels, marketScalePool }
    const r = scoreProduct(c, ctx, deps, rules)
    // ---- 诊断字段（维度验证矩阵用；matched type 一律取原始 typeBench，不用 blendBench） ----
    const diag = { grossMargin: c.gross_margin, signRate: c.sign_rate, shippingRatio: null, bandIn: null }
    const t = m.matchedType ? typeBench[m.matchedType] : null
    if (t) {
      diag.typeLeader = t.bsr_leader_share ?? null
      diag.typeSellerHhi = t.seller_hhi ?? null
      diag.typeTop10 = t.top10_seller_share ?? null
      diag.typeSalesP50 = t.sales_28d?.p50 ?? null
      diag.typeUnitsP50 = t.units_28d?.p50 ?? null
      diag.typeAvgP25 = t.avg_price_rub?.p25 ?? null
      diag.typeAvgP75 = t.avg_price_rub?.p75 ?? null
    }
    if (c.weight_kg > 0 && dimsValid(c)) {
      const chs = celChannels(c)
      if (chs.length > 0) {
        const best = chs.reduce((a, b) => (b.cost < a.cost ? b : a), chs[0])
        const eff = effPriceOf(c)
        if (eff != null && eff > 0) {
          diag.shippingRatio = best.cost / (eff / settings.rub_per_cny)
          if (diag.typeAvgP25 != null && diag.typeAvgP75 != null) {
            diag.bandIn = eff >= diag.typeAvgP25 && eff <= diag.typeAvgP75
          }
        }
      }
    }
    return { ...r, ...diag, kind: m.kind, leaf: c.category_leaf, sales: c.sales_rub_28d }
  })

  // ---- 6. 分布统计 ----
  const total = results.length
  const gradeCount = { A: 0, B: 0, C: 0, D: 0, null: 0 }
  const contextCount = { HIGH: 0, MEDIUM: 0, LOW: 0, LOW_MARKET_CONTEXT: 0 }
  const statusCount = {}
  const scores = []
  for (const r of results) {
    gradeCount[r.grade ?? 'null']++
    contextCount[r.context]++
    for (const s of r.status) statusCount[s] = (statusCount[s] || 0) + 1
    if (r.totalScore !== null) scores.push(r.totalScore)
  }
  scores.sort((a, b) => a - b)
  const p = (q) => scores[Math.floor(scores.length * q)]

  console.log('===== 1000 SKU 分数分布审计 =====')
  console.log(`总数: ${total}`)
  console.log(`A: ${gradeCount.A} (${(gradeCount.A / total * 100).toFixed(1)}%)`)
  console.log(`B: ${gradeCount.B} (${(gradeCount.B / total * 100).toFixed(1)}%)`)
  console.log(`C: ${gradeCount.C} (${(gradeCount.C / total * 100).toFixed(1)}%)`)
  console.log(`D: ${gradeCount.D} (${(gradeCount.D / total * 100).toFixed(1)}%)`)
  console.log(`不可评级: ${gradeCount.null}`)
  console.log(`\n分数分布: min ${scores[0]?.toFixed(1)} / p10 ${p(0.1)?.toFixed(1)} / p25 ${p(0.25)?.toFixed(1)} / p50 ${p(0.5)?.toFixed(1)} / p75 ${p(0.75)?.toFixed(1)} / p90 ${p(0.9)?.toFixed(1)} / max ${scores[scores.length - 1]?.toFixed(1)}`)
  console.log(`\nContext: HIGH ${contextCount.HIGH} / MEDIUM ${contextCount.MEDIUM} / LOW ${contextCount.LOW} / LOW_MARKET_CONTEXT ${contextCount.LOW_MARKET_CONTEXT}`)
  console.log(`\nStatus 分布:`)
  for (const [k, v] of Object.entries(statusCount).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`)

  // 虚高检查：LOW_MARKET_CONTEXT 组的分数分布 vs 有映射组
  const lmc = results.filter((r) => r.context === 'LOW_MARKET_CONTEXT').map((r) => r.totalScore).filter((s) => s !== null)
  const mapped = results.filter((r) => r.context !== 'LOW_MARKET_CONTEXT').map((r) => r.totalScore).filter((s) => s !== null)
  const avg = (a) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0
  const aLmc = results.filter((r) => r.context === 'LOW_MARKET_CONTEXT' && r.grade === 'A').length
  const aMapped = results.filter((r) => r.context !== 'LOW_MARKET_CONTEXT' && r.grade === 'A').length
  console.log(`\n虚高检查:`)
  console.log(`  LOW_MARKET_CONTEXT 组: n=${lmc.length}, 均分 ${avg(lmc).toFixed(1)}, A 数 ${aLmc} (${(aLmc / Math.max(contextCount.LOW_MARKET_CONTEXT, 1) * 100).toFixed(1)}%)`)
  console.log(`  有映射组: n=${mapped.length}, 均分 ${avg(mapped).toFixed(1)}, A 数 ${aMapped} (${(aMapped / Math.max(total - contextCount.LOW_MARKET_CONTEXT, 1) * 100).toFixed(1)}%)`)

  // ---- 7. 模型验证：Top20% 总分 SKU 的 matched-type 销售领导者 enrichment ----
  // 真实验证流程（T4-3 口径）：仅取有 BSR 映射且可评级（grade!==null，NEEDS_DATA 诊断分不混入）的候选
  // → 按 totalScore 排序 → 模型 Top20% → 其 matched type 的 bsr_leader_share 均值 vs 全部 mapped baseline。
  const mappedResults = results.filter((r) => r.context !== 'LOW_MARKET_CONTEXT' && r.grade !== null)
  const leaderOf = (r) => {
    const t = r.matchedProductType ? typeBench[r.matchedProductType] : null
    return t && t.bsr_leader_share != null ? t.bsr_leader_share : null
  }
  const withLeader = mappedResults.filter((r) => leaderOf(r) !== null)
  const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null)
  const baseLeader = mean(withLeader.map((r) => leaderOf(r)))
  const byScore = [...withLeader].sort((a, b) => b.totalScore - a.totalScore)
  const top20 = byScore.slice(0, Math.ceil(byScore.length * 0.2))
  const topLeader = mean(top20.map((r) => leaderOf(r)))
  console.log(`\n模型验证：Top20% 总分 SKU 的 matched-type 销售领导者 enrichment`)
  console.log(`  参与: mapped 且可评级 ${mappedResults.length} 行; matched type 有 bsr_leader_share 的 ${withLeader.length} 行`)
  console.log(`  baseline (candidate-weighted): ${baseLeader?.toFixed(1) ?? 'N/A'}%`)
  console.log(`  模型 Top20% 组 (candidate-weighted): ${topLeader?.toFixed(1) ?? 'N/A'}%`)
  console.log(`  enrichment 倍数 (candidate-weighted): ${baseLeader && topLeader ? (topLeader / baseLeader).toFixed(2) : 'N/A'}`)
  // unique-type 口径：避免同一产品类型因候选 SKU 多而被重复加权
  const byType = {}
  for (const r of withLeader) {
    if (!byType[r.matchedProductType]) byType[r.matchedProductType] = []
    byType[r.matchedProductType].push(r)
  }
  const typeRows = Object.values(byType).map((rs) => ({
    type: rs[0].matchedProductType,
    score: rs.reduce((s, r) => s + r.totalScore, 0) / rs.length,
    leader: leaderOf(rs[0]),
  }))
  const baseType = mean(typeRows.map((t) => t.leader))
  typeRows.sort((a, b) => b.score - a.score)
  const topTypes = typeRows.slice(0, Math.ceil(typeRows.length * 0.2))
  const topTypeLeader = mean(topTypes.map((t) => t.leader))
  console.log(`  unique-type: 覆盖 ${typeRows.length} 个产品类型`)
  console.log(`  baseline (unique-type): ${baseType?.toFixed(1) ?? 'N/A'}%`)
  console.log(`  Top20% 类型组 (unique-type): ${topTypeLeader?.toFixed(1) ?? 'N/A'}%`)
  console.log(`  enrichment 倍数 (unique-type): ${baseType && topTypeLeader ? (topTypeLeader / baseType).toFixed(2) : 'N/A'}`)

  // ---- 8. 维度验证矩阵（T4-3 第三层）----
  // 每个维度按其维度分排序取 Top20%，比较该组与 baseline 的验证指标；
  // 期望方向来自需求方口径表：demand→leader/salesP50 高、competition→HHI/top10 低、
  // price→落带比例高、profitability→gross 高、logistics→shipping ratio 低、operations→sign rate 高、
  // total→gap 占比与 leader-share 仅观察记录（不作 pass/fail）。
  const mappedEligible = results.filter((r) => r.context !== 'LOW_MARKET_CONTEXT' && r.grade !== null)
  const dimEligible = (key) => mappedEligible.filter((r) => r.dimensions[key] && r.dimensions[key].available)
  const top20ByScore = (rows, f) => [...rows].sort((a, b) => f(b) - f(a)).slice(0, Math.ceil(rows.length * 0.2))
  const meanOf = (rows, f) => {
    const v = rows.map(f).filter((x) => x !== null && x !== undefined && !isNaN(x))
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null
  }
  const shareOf = (rows, f) => {
    const v = rows.map(f).filter((x) => x !== null && x !== undefined)
    return v.length ? v.filter(Boolean).length / v.length : null
  }
  const matrix = [
    { key: 'demand', metric: 'BSR leader-share', get: (r) => r.typeLeader, dir: '>', expect: 'higher' },
    { key: 'demand', metric: 'sales P50', get: (r) => r.typeSalesP50, dir: '>', expect: 'higher' },
    { key: 'demand', metric: 'units P50', get: (r) => r.typeUnitsP50, dir: '>', expect: 'higher' },
    { key: 'competition', metric: 'seller HHI', get: (r) => r.typeSellerHhi, dir: '<', expect: 'lower' },
    { key: 'competition', metric: 'top10 seller share', get: (r) => r.typeTop10, dir: '<', expect: 'lower' },
    { key: 'price_opportunity', metric: '落 P25-P75 比例', get: (r) => r.bandIn, dir: '>', expect: 'higher', share: true },
    { key: 'profitability', metric: 'gross margin', get: (r) => r.grossMargin, dir: '>', expect: 'higher' },
    { key: 'logistics', metric: 'shipping ratio', get: (r) => r.shippingRatio, dir: '<', expect: 'lower' },
    { key: 'operations', metric: 'sign rate', get: (r) => r.signRate, dir: '>', expect: 'higher' },
    { key: 'total', metric: 'Supply Gap HIGH/MEDIUM 占比', get: (r) => !!(r.supplyGap && (r.supplyGap.rank === 'HIGH_GAP' || r.supplyGap.rank === 'MEDIUM_GAP')), dir: 'obs', expect: 'observe', share: true },
    { key: 'total', metric: 'BSR leader-share', get: (r) => r.typeLeader, dir: 'obs', expect: 'record' },
  ]
  console.log(`\n维度验证矩阵 (mapped 且可评级 n=${mappedEligible.length}):`)
  for (const d of matrix) {
    const eligible = d.key === 'total' ? mappedEligible : dimEligible(d.key)
    const top = d.key === 'total' ? top20ByScore(eligible, (r) => r.totalScore) : top20ByScore(eligible, (r) => r.dimensions[d.key].score)
    const fmt = (v, share) => (v == null ? 'N/A' : share ? `${(v * 100).toFixed(1)}%` : String(Math.round(v * 10) / 10))
    const baseV = d.share ? shareOf(eligible, d.get) : meanOf(eligible, d.get)
    const topV = d.share ? shareOf(top, d.get) : meanOf(top, d.get)
    let verdict = 'OBSERVE'
    if (d.dir === '>' && baseV != null && topV != null) verdict = topV > baseV ? 'OK' : 'REVERSED'
    if (d.dir === '<' && baseV != null && topV != null) verdict = topV < baseV ? 'OK' : 'REVERSED'
    console.log(`  [${verdict.padEnd(8)}] ${d.key.padEnd(18)} ${d.metric.padEnd(26)} baseline ${String(fmt(baseV, d.share)).padEnd(8)} | Top20% ${String(fmt(topV, d.share)).padEnd(8)} (期待 ${d.expect}, n=${eligible.length})`)
  }

  // 保存明细（本地审计用，不入 git）
  fs.writeFileSync(path.join(ROOT, '_audit', 'tmp', 't4-score-audit-raw.json'), JSON.stringify(results, null, 2), 'utf-8')
  console.log(`\n明细: _audit/tmp/t4-score-audit-raw.json`)
}

main().catch((e) => { console.error(e); process.exit(1) })
