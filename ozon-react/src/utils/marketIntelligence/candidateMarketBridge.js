/**
 * candidateMarketBridge.js — Market Intelligence Niche → Candidate Market Bridge 数据适配器
 * 契约（TASK 05A-2 冻结）：
 *  - 仅纯函数：禁止读取/写入任何 Store、禁止调用 API、禁止调用 persist
 *  - 严格结构化搬运 Opportunity/Niche 市场证据至 Candidate.marketEvidence
 *  - 禁止数值清洗（不进行 parseFloat、百分比/汇率换算、重量推算）
 */

/**
 * 安全解析利基全局唯一 UID
 * 优先取 uid，次选 niche_uid；严格过滤空串；禁止伪造/随机/哈希生成
 */
export function resolveNicheUid(niche) {
  const uid =
    niche?.uid ??
    niche?.niche_uid ??
    null

  if (uid == null) return null

  const value = String(uid).trim()
  return value || null
}

/**
 * 构造 Candidate 稳定 sourceProductId
 * 若存在真实 nicheUid 则构造 `wb-niche-${nicheUid}`；无 UID 时降级为历史兼容 `wb-niche-${niche.name}`
 */
export function buildMiCandidateSourceProductId(niche) {
  const uid = resolveNicheUid(niche)

  return uid
    ? `wb-niche-${uid}`
    : `wb-niche-${niche?.name || ''}`
}

/**
 * 构建 Candidate 结构化 marketEvidence 载荷
 * 字段映射严格冻结，无清洗纯搬运
 */
export function buildCandidateMarketEvidence(niche, runId, effectiveVerdict) {
  const nicheUid = resolveNicheUid(niche)

  return {
    schemaVersion: 1,

    nicheUid,
    runId: runId != null ? String(runId) : null,

    mos: niche?.mos ?? null,
    pfs: niche?.pfs ?? niche?.cfs ?? null,

    gmv: niche?.gmv ?? niche?.revenue ?? null,
    growth: niche?.growth ?? null,
    buyout: niche?.buyout ?? null,
    sellers: niche?.sellers ?? null,

    price: niche?.price ?? null,
    weightG: niche?.weight_g ?? null,
    heavy: niche?.heavy ?? null,

    verdict: effectiveVerdict ?? niche?.verdict ?? null,
    risks: Array.isArray(niche?.risks) ? [...niche.risks] : [],

    eacStatus: niche?.eac_status ?? niche?.eacStatus ?? null,
    certificationStatus: niche?.certification_status ?? niche?.certificationStatus ?? null,

    syncedAt: new Date().toISOString(),
  }
}
