/**
 * opportunityContext.js — 统一只读 Opportunity Context 适配器
 *
 * 作用：将 Market Intelligence 选中的 niche 转换为统一、只读的页面上下文。
 * 纪律：
 * 1. 禁止保存、禁止调用 API、禁止调用 Store。
 * 2. 纯函数适配层，底层使用 niche_uid，不创建新的 Opportunity ID。
 * 3. nicheUid 硬门禁：若未提供 uid/niche_uid 则严格为 null，禁止 Math.random / Date.now / 随机 hash。
 * 4. 前台统一使用 PFS 术语，兼容底层旧数据中的 cfs 字段。
 */

export function buildOpportunityContext(niche, runContext = {}) {
  if (!niche || typeof niche !== 'object') {
    return null
  }

  // 1. nicheUid: 严格读取真实标识，缺失则为 null，禁止假造 ID
  const nicheUid = niche.uid ?? niche.niche_uid ?? null

  // 2. 名称
  const name = niche.name ?? niche.niche_name ?? ''

  // 3. 分类
  const category = niche.cat ?? niche.category ?? ''

  // 4. 批次号
  const runId = runContext.runId ?? niche.run_id ?? niche.runId ?? ''

  // 5. MOS 评分
  const mos = niche.mos ?? null

  // 6. PFS 评分（前台统一显示 PFS，兼容旧数据 cfs）
  const pfs = niche.pfs ?? niche.cfs ?? null

  // 7. 市场指标
  const gmv = niche.gmv ?? null
  const growth = niche.growth ?? ''
  const buyout = niche.buyout ?? null
  const sellers = niche.sellers ?? null

  // 8. 判定结论与风险
  const verdict = niche.verdict ?? 'UNASSIGNED'
  const risks = Array.isArray(niche.risks) ? niche.risks : []

  // 固定结构返回
  return {
    nicheUid,
    name,
    category,

    runId,

    mos,
    pfs,

    gmv,
    growth,
    buyout,
    sellers,

    verdict,
    risks,

    source: 'WB_MARKET_INTELLIGENCE',

    raw: niche,
  }
}
