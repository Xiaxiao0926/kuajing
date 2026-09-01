/**
 * 模块5：数据可信度与抽检质量监控
 *
 * 原则：零默认值填充、全流程可追溯。
 * 抽检用种子化随机（mulberry32）保证可复现：同一种子重抽样本一致，
 * 人工核验结果按 种子:行ID 持久化，可随时回看与重算准确率。
 */

/** mulberry32 确定性 PRNG */
export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 行稳定 ID：标题+价格 哈希（同一数据集内稳定，抽检结果可跨会话关联） */
export function rowId(row) {
  const p = row._purity || {}
  const s = `${p.title || ''}|${p.price || 0}`
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0
  }
  return (h >>> 0).toString(36)
}

/**
 * 汇总可信度统计。
 * @param {Array} pipelineRows runPurityPipeline 输出行
 */
export function buildCredibility(pipelineRows, categoryInfo = null) {
  const rows = pipelineRows || []
  const total = rows.length
  const tierCounts = { A: 0, B: 0, C: 0, UNKNOWN: 0 }
  const reasons = {}
  for (const r of rows) {
    const t = r._purity?.tier || 'UNKNOWN'
    tierCounts[t] = (tierCounts[t] || 0) + 1
    const reason = r._purity?.reason
    if (reason) reasons[reason] = (reasons[reason] || 0) + 1
  }
  const unknown = tierCounts.UNKNOWN
  const identified = total - unknown
  return {
    total,
    identified,
    unknown,
    coveragePct: total > 0 ? Math.round((identified / total) * 1000) / 10 : 0,
    tierCounts,
    unknownReasons: Object.entries(reasons)
      .filter(([k]) => k.includes('解析') || k.includes('口径') || k.includes('配置'))
      .sort((a, b) => b[1] - a[1]),
    category: categoryInfo,
  }
}

/**
 * 生成抽检样本（确定性：同 seed 同样本）。
 * @param {Array} pipelineRows
 * @param {{size?: number, seed?: number}} options
 */
export function createSample(pipelineRows, { size = 50, seed = 1 } = {}) {
  const rows = pipelineRows || []
  const n = Math.min(size, rows.length)
  const rand = mulberry32(seed)
  const idx = rows.map((_, i) => i)
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return idx.slice(0, n).map((i) => {
    const r = rows[i]
    const p = r._purity
    return {
      key: `${seed}:${rowId(r)}`,
      id: rowId(r),
      title: p.title,
      tier: p.tier,
      reason: p.reason,
      specDetail: p.spec ? p.spec.detail : '—',
      specTotal: p.spec ? p.spec.total : null,
      inferred: p.spec ? p.spec.inferred : null,
      price: p.price,
      normalizedPrice: p.normalizedPrice,
    }
  })
}

/**
 * 汇总人工核验结果。
 * @param {Object} checks { [sampleKey]: 'correct' | 'wrong' }
 * @param {Array} sample createSample 输出
 */
export function summarizeChecks(sample, checks = {}) {
  let checked = 0
  let correct = 0
  const wrongItems = []
  for (const item of sample) {
    const mark = checks[item.key]
    if (mark === 'correct' || mark === 'wrong') {
      checked++
      if (mark === 'correct') correct++
      else wrongItems.push(item)
    }
  }
  return {
    checked,
    correct,
    wrong: checked - correct,
    accuracyPct: checked > 0 ? Math.round((correct / checked) * 1000) / 10 : null,
    wrongItems,
  }
}
