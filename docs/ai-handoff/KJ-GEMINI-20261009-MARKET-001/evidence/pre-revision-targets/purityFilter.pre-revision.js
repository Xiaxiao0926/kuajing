/**
 * 模块2：竞品同类性分层过滤（Purity Filter）
 *
 * 分类纪律（用户冻结口径）：
 *   A 直接可比 / B 邻近竞品 / C 不可比 / UNKNOWN 不可解析（独立成桶，禁止塞入 C）
 *
 * 分类顺序（先 UNKNOWN 后 A/B/C，规格不可解析优先级最高）：
 *   1. 数据集类目未配置 → 全部 UNKNOWN
 *   2. 规格无法解析到目标口径 → UNKNOWN（含：复数无数量、非目标单位）
 *   3. пар 且品类 pair_handling=exclude → C（单位体系不同）
 *   4. tier_a.any 命中且 tier_a.none 未命中 → A
 *   5. tier_a.none 命中（套装降级）或 tier_b.any 命中 → B
 *   6. 其余已解析 → C
 *
 * 规则引擎唯一事实源：config/market_analysis.json（经 sync-config 生成 generated/market_analysis.js）
 */

import rules from '../../generated/market_analysis.js'
import { parseSpec, pickCandidate } from './specParser.js'

const TITLE_KEYS = ['商品名称', '产品名称', 'название', 'name', 'Name']
const PRICE_KEYS = ['价格(₽)', '价格', '最低价格', '平均单价', 'Price', 'price']
const QTY_KEYS = ['月销量', '销量', '平均销量', 'Quantity']
const SALES_KEYS = ['月销售额(₽)', '销售额', '平均销售额', 'Sales']

function firstCol(row, keys) {
  for (const k of keys) {
    const v = row[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return v
  }
  return null
}

export function extractTitle(row) { return String(firstCol(row, TITLE_KEYS) || '') }

export function extractPrice(row) {
  const v = firstCol(row, PRICE_KEYS)
  if (v === null) return 0
  return parseFloat(String(v).replace(/[^\d.]/g, '')) || 0
}

export function extractQty(row) {
  const v = firstCol(row, QTY_KEYS)
  if (v === null) return 0
  return parseFloat(String(v).replace(/[^\d.]/g, '')) || 0
}

export function extractSales(row) {
  const v = firstCol(row, SALES_KEYS)
  if (v === null) return 0
  return parseFloat(String(v).replace(/[^\d.]/g, '')) || 0
}

function lower(title) { return String(title || '').toLowerCase() }

function hasAny(titleLower, words) {
  return (words || []).some((w) => titleLower.includes(String(w).toLowerCase()))
}

/**
 * 类目检测：全数据集标题对 detect_keywords 投票，最高票且份额 ≥ min_share 返回类目键。
 * @param {Array<object>} rows 原始行
 */
export function detectCategory(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return { key: null, share: 0, label: null }
  const votes = {}
  let voted = 0
  for (const row of rows) {
    const t = lower(extractTitle(row))
    if (!t) continue
    let hit = false
    for (const [key, cfg] of Object.entries(rules.categories)) {
      if (hasAny(t, cfg.detect_keywords)) { votes[key] = (votes[key] || 0) + 1; hit = true }
    }
    if (hit) voted++
  }
  let bestKey = null
  let bestVotes = 0
  for (const [key, n] of Object.entries(votes)) {
    if (n > bestVotes || (n === bestVotes && bestKey && Object.keys(rules.categories).indexOf(key) < Object.keys(rules.categories).indexOf(bestKey))) {
      bestKey = key; bestVotes = n
    }
  }
  const minShare = rules.sampling?.min_share_for_detection ?? 0.3
  if (!bestKey || rows.length === 0 || bestVotes / rows.length < minShare) {
    return { key: null, share: bestVotes / rows.length, label: null }
  }
  return { key: bestKey, share: bestVotes / rows.length, label: rules.categories[bestKey].label }
}

/**
 * 规格归一：按类目目标口径解析出可比数量。
 * @returns {{total:number, detail:string, inferred:string|null}|null}
 *   pcs 口径：双×2 或 шт 数量；无数量且 implicit_singular 且单数词形 → 1（俄语词法推断）；复数无数量 → null
 *   volume_ml / weight_g 口径：目标单位候选 ×（若存在打包数量 шт/双 则相乘）
 */
export function resolveSpec(parsed, catCfg) {
  if (!parsed || !catCfg) return null
  const basis = catCfg.target_basis

  if (basis === 'pcs') {
    const pack = pickCandidate(parsed, 'pair') || pickCandidate(parsed, 'pcs')
    if (pack) {
      const total = pack.basis === 'pair' ? pack.qty * 2 : pack.qty
      return { total, detail: pack.raw, inferred: null }
    }
    if (catCfg.implicit_singular) {
      const t = lower(parsed.title)
      const hasSingular = hasAny(t, catCfg.singular_forms)
      const hasPlural = hasAny(t, catCfg.plural_forms)
      if (hasSingular && !hasPlural) {
        return { total: 1, detail: '单数词形推断 qty=1', inferred: 'singular' }
      }
    }
    return null
  }

  const target = pickCandidate(parsed, basis)
  if (!target) return null
  const pack = pickCandidate(parsed, 'pair') || pickCandidate(parsed, 'pcs')
  const packQty = pack ? (pack.basis === 'pair' ? pack.qty * 2 : pack.qty) : 1
  const total = target.value * packQty
  const detail = pack ? `${pack.raw} × ${target.raw}` : target.raw
  return { total, detail, inferred: null }
}

/**
 * 单行分类。
 * @returns {{tier:'A'|'B'|'C'|'UNKNOWN', reason:string, spec:object|null, normalizedPrice:number}}
 */
export function classifyRow(row, catCfg) {
  const title = extractTitle(row)
  const parsed = parseSpec(title)
  const price = extractPrice(row)

  if (!catCfg) {
    return { tier: 'UNKNOWN', reason: '类目未配置/未识别', spec: null, normalizedPrice: 0, parsed }
  }

  // 单位体系不匹配可判定 → C（优先于 UNKNOWN：能确定不可比就不算未知）
  if (pickCandidate(parsed, 'pair') && catCfg.pair_handling === 'exclude') {
    return { tier: 'C', reason: 'пар 双装且品类规则=排除', spec: null, normalizedPrice: 0, parsed }
  }

  const spec = resolveSpec(parsed, catCfg)
  if (!spec) {
    const reason = parsed.candidates.length === 0
      ? '标题无可解析数量+单位'
      : `非目标口径(${catCfg.target_basis})单位`
    return { tier: 'UNKNOWN', reason, spec: null, normalizedPrice: 0, parsed }
  }

  const t = lower(title)
  const aHit = hasAny(t, catCfg.tier_a?.any)
  const aDemote = hasAny(t, catCfg.tier_a?.none)
  const bHit = hasAny(t, catCfg.tier_b?.any)

  let tier, reason
  if (aHit && !aDemote) {
    tier = 'A'; reason = '核心品类+规格可比'
  } else if (aHit && aDemote) {
    tier = 'B'; reason = '核心品类但命中降级词(套装等)'
  } else if (bHit) {
    tier = 'B'; reason = '邻近品类关键词'
  } else {
    tier = 'C'; reason = '无可比品类关键词'
  }

  const normalizedPrice = price > 0 && spec.total > 0
    ? (price / spec.total) * catCfg.normalize.per
    : 0

  return { tier, reason, spec, normalizedPrice, parsed }
}

export const TIER_META = {
  A: { label: 'A 直接可比', color: 'green' },
  B: { label: 'B 邻近竞品', color: 'amber' },
  C: { label: 'C 不可比', color: 'gray' },
  UNKNOWN: { label: 'UNKNOWN 未解析', color: 'red' },
}

/**
 * 纯度流水线入口：类目检测 → 逐行分类。
 * @returns {{
 *   category: {key:string|null, share:number, label:string|null},
 *   rows: Array<object & {_purity: {tier, reason, spec, normalizedPrice, parsed, title, price, qty, sales}}>,
 *   stats: {total:number, identified:number, unknown:number, coveragePct:number, tierCounts:object}
 * }}
 */
export function runPurityPipeline(rows) {
  const category = detectCategory(rows)
  const catCfg = category.key ? rules.categories[category.key] : null

  const out = []
  const tierCounts = { A: 0, B: 0, C: 0, UNKNOWN: 0 }
  for (const row of rows || []) {
    const title = extractTitle(row)
    if (!title.trim()) continue
    const result = classifyRow(row, catCfg)
    tierCounts[result.tier]++
    out.push({
      ...row,
      _purity: {
        ...result,
        title,
        price: extractPrice(row),
        qty: extractQty(row),
        sales: extractSales(row),
      },
    })
  }

  const total = out.length
  const unknown = tierCounts.UNKNOWN
  const identified = total - unknown
  return {
    category,
    rows: out,
    stats: {
      total,
      identified,
      unknown,
      coveragePct: total > 0 ? Math.round((identified / total) * 1000) / 10 : 0,
      tierCounts,
    },
  }
}
