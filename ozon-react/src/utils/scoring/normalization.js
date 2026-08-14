/**
 * scoring/normalization.js — 归一化与百分位工具（纯函数）
 * 依据 T4-1B 规格：
 *  - 归一化一律百分位秩（0-100），不用 min-max
 *  - winsorize(1/99) 后计算
 *  - 两层证据感知：submetric→dimension→total 均按可用权重重归一
 */

/** winsorize：把数组按 1%/99% 百分位截断后返回新数组 */
export function winsorize(values) {
  if (!values || values.length === 0) return []
  const s = [...values].sort((a, b) => a - b)
  const lo = s[Math.floor(s.length * 0.01)]
  const hi = s[Math.floor(s.length * 0.99)]
  return values.map((v) => Math.min(Math.max(v, lo), hi))
}

/** 判断数组是否已升序（预排序池检测，行为零变化优化：跳过重复排序） */
function isSortedAsc(arr) {
  for (let i = 1; i < arr.length; i++) { if (arr[i] < arr[i - 1]) return false }
  return true
}

/** 百分位秩（0-100）：value 在 population 中的位置。population 非空；value 为 null 返回 null。
 *  已升序的 population 直接使用（与"复制后排序"结果逐位一致，仅省重复排序）。 */
export function percentileRank(value, population) {
  if (value === null || value === undefined || !population || population.length === 0) return null
  const sorted = isSortedAsc(population) ? population : [...population].sort((a, b) => a - b)
  if (sorted.length === 1) return value <= sorted[0] ? 0 : 100
  if (value <= sorted[0]) return 0
  if (value >= sorted[sorted.length - 1]) return 100
  let below = 0
  for (const v of sorted) { if (v < value) below++ }
  return (below / (sorted.length - 1)) * 100
}

/**
 * 两层证据感知加权（通用）：
 *   items: [{weight, score}]，score 可为 null（不可计算）
 *   minCoverage: 可用权重占比下限，低于则整体返回 null
 * 返回 {score, coverage, available}
 */
export function evidenceWeightedScore(items, minCoverage = 0.5) {
  const totalWeight = items.reduce((s, it) => s + (it.weight || 0), 0)
  if (totalWeight <= 0) return { score: null, coverage: 0, available: false }
  let availWeight = 0
  let weightedSum = 0
  for (const it of items) {
    if (it.score === null || it.score === undefined || it.weight === undefined) continue
    availWeight += it.weight
    weightedSum += it.weight * it.score
  }
  const coverage = availWeight / totalWeight
  if (availWeight === 0) return { score: null, coverage: 0, available: false }
  if (coverage < minCoverage) return { score: null, coverage, available: false }
  return { score: weightedSum / availWeight, coverage, available: true }
}

/** 线性融合（shrinkage）：α×type + (1-α)×domain；缺一侧取有的一侧；都缺 → null */
export function shrink(typeValue, domainValue, n, k = 5) {
  const t = typeValue === null || typeValue === undefined ? null : typeValue
  const d = domainValue === null || domainValue === undefined ? null : domainValue
  if (t !== null && d !== null) {
    const alpha = n / (n + k)
    return alpha * t + (1 - alpha) * d
  }
  if (t !== null) return t
  if (d !== null) return d
  return null
}

/**
 * 由分位点序列（如 benchmark 的 p10/p25/p50/p75/p90）对 value 做分段线性插值百分位。
 * quantiles: [{q: 0.10, v: ...}, ...] 按 q 升序。
 * 越界截断到首/末分位对应的百分位：只有 P10–P90 数据时，低于 P10 → 10、高于 P90 → 90
 * （不得声称 P0/P100 —— 只有 P10–P90 观测时不能把区间外值伪装成市场极值）。
 */
export function percentileRankFromQuantiles(value, quantiles) {
  if (value === null || value === undefined || !quantiles || quantiles.length < 2) return null
  const qs = [...quantiles].sort((a, b) => a.q - b.q)
  if (value <= qs[0].v) return qs[0].q * 100
  if (value >= qs[qs.length - 1].v) return qs[qs.length - 1].q * 100
  for (let i = 0; i < qs.length - 1; i++) {
    const a = qs[i], b = qs[i + 1]
    if (value >= a.v && value <= b.v) {
      if (b.v === a.v) return a.q * 100
      const t = (value - a.v) / (b.v - a.v)
      return (a.q + t * (b.q - a.q)) * 100
    }
  }
  return null
}

/** benchmark 对象（p10/p25/p50/p75/p90 字段）转 quantiles 数组 */
export function benchmarkQuantiles(bench, key) {
  const b = bench ? bench[key] : null
  if (!b) return null
  const pairs = [
    [0.10, b.p10], [0.25, b.p25], [0.50, b.p50], [0.75, b.p75], [0.90, b.p90],
  ].filter(([, v]) => v !== null && v !== undefined && !isNaN(v))
  if (pairs.length < 2) return null
  return pairs.map(([q, v]) => ({ q, v }))
}

/** 把 [0,100] 分数四舍五入到 1 位小数 */
export function round1(v) {
  if (v === null || v === undefined) return null
  return Math.round(v * 10) / 10
}

/** 把 [0,1] 覆盖度四舍五入到 2 位小数（evidenceCoverage/coverage 专用；禁止用 round1，0.75→0.8 是错的） */
export function round2(v) {
  if (v === null || v === undefined) return null
  return Math.round(v * 100) / 100
}
