/**
 * procurementIdentity.js — Phase 5 人工采购验证身份解析器
 * 纯函数：禁止读写 Store、禁止调用 persist/API/localStorage
 */

/**
 * 安全解析利基全局唯一 UID
 * 优先取 uid，次选 niche_uid；严格过滤空串；禁止伪造/随机生成
 */
export function resolveProcurementNicheUid(niche) {
  const uid =
    niche?.uid ??
    niche?.niche_uid ??
    null

  if (uid == null) return null

  const normalized = String(uid).trim()
  return normalized || null
}

/**
 * 构建采购业务身份 (uid, name)
 * 固定返回 { uid, name }
 */
export function buildProcurementIdentity(niche) {
  const uid = resolveProcurementNicheUid(niche)
  const name = String(niche?.name || '').trim()
  return {
    uid,
    name,
  }
}

/**
 * 稳定查找采购报价（UID 优先，Legacy Name 回退）
 * STEP 1: 有 UID → quotes[uid]
 * STEP 2: 没找到 → quotes[name]
 * STEP 3: 都没有 → null
 */
export function findProcurementQuote(quotes, niche) {
  if (!quotes || typeof quotes !== 'object') return null
  const { uid, name } = buildProcurementIdentity(niche)

  if (uid && quotes[uid]) return quotes[uid]
  if (name && quotes[name]) return quotes[name]

  return null
}
