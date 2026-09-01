/**
 * 模块3：规格标准化解析器（俄文 Ozon 标题，兼容中文单位）
 *
 * 职责：从商品标题提取「数量+单位」规格，折算为可比基础（pcs/volume_ml/weight_g）。
 * 分类纪律：解析不出就是 UNKNOWN，禁止默认值填充；所有被排除的数字模式保留排除原因（可追溯）。
 *
 * 实现注记：JS 正则 \b 基于 ASCII \w，对西里尔字母恒为 false——所有单位边界
 * 一律用前瞻 (?![а-яёa-z0-9]) 表达（此为本文件正确性的关键约束，勿改回 \b）。
 *
 * 陷阱排除（基于 2026-05/08 真实热销表侦察）：
 *   - 尺寸对：50х70 / 40x60см / 60*40 / 60х40х13 / 15/17 см（см 恒为尺寸）
 *   - 功能描述：5в1 / 6 в 1 / 17 в 1 / 15 масел / 8 насадок / 3 скорости
 *   - 型号数字：AHD51 / HBI1418 / TF64 / №8（字母粘连数字，含大写）
 *   - 版本号：RESTART 2.0（裸小数且后面不接任何字母）
 *
 * 候选单位（пар/шт/мл/л/кг/г + 双/只/毫升/克）：
 *   пар → pcs 基础上 ×2（пара/пары/пар 变格）；л → ml ×1000；кг → g ×1000。
 */

const NOT_WORD = '(?![а-яёa-z0-9])'

const RE = {
  dimPair: /\d+(?:[.,]\d+)?\s*[хx×*]\s*\d+(?:[.,]\d+)?(?:\s*[хx×*]\s*\d+(?:[.,]\d+)?)?/g,
  cm: new RegExp(`\\d+(?:[.,]\\d+)?\\s*(?:см|cm)${NOT_WORD}`, 'g'),
  slashDim: /\d+(?:[.,]\d+)?\s*\/\s*\d+(?:[.,]\d+)?\s*(?:см|cm)/g,
  nInOne: /\d+\s*(?:в|in)\s*1\b/g,
  feature: /\d+\s*(?:насад[а-яё]*|мас(?:ел|л[а-яё]*)|режим[а-яё]*|скорост[а-яё]*|ступен[а-яё]*|уров(?:ен[а-яё]*|н[а-яё]*)|функци[а-яё]*|волн[а-яё]*|мощност[а-яё]*)/g,
  model: /[а-яёА-ЯЁa-zA-Z]+-?\d+(?:[.,]\d+)?/g,
  ordinal: /№\s*\d+/g,
  version: /\d+[.,]\d+(?!\s*[а-яёa-z0-9])/g,
}

const UNIT_DEFS = [
  { unit: 'пар', basis: 'pair', piecesPer: 2, re: new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*пар(?:а|ы|у)?${NOT_WORD}`, 'g') },
  { unit: 'шт', basis: 'pcs', re: new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*шт(?:ук)?\\.?${NOT_WORD}`, 'g') },
  { unit: 'мл', basis: 'volume_ml', re: new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*мл\\.?${NOT_WORD}`, 'g') },
  { unit: 'л', basis: 'volume_ml', mult: 1000, re: new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:л|литр[а-яё]*)${NOT_WORD}`, 'g') },
  { unit: 'кг', basis: 'weight_g', mult: 1000, re: new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*кг\\.?${NOT_WORD}`, 'g') },
  { unit: 'г', basis: 'weight_g', re: new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*г(?:р\\.?|рамм[а-яё]*)?${NOT_WORD}`, 'g') },
  { unit: '双', basis: 'pair', piecesPer: 2, re: /(\d+(?:[.,]\d+)?)\s*双/g },
  { unit: '只', basis: 'pcs', re: /(\d+(?:[.,]\d+)?)\s*(?:只|个|支|件|张)/g },
  { unit: '毫升', basis: 'volume_ml', re: new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:毫升|ml)${NOT_WORD}`, 'gi') },
  { unit: '克', basis: 'weight_g', re: new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:克|g)${NOT_WORD}`, 'gi') },
]

/** 基础优先级：双 > 只 > 容量 > 重量（primary 选择用） */
const BASIS_PRIORITY = { pair: 0, pcs: 1, volume_ml: 2, weight_g: 3 }

function collectExclusions(title) {
  const spans = []
  const push = (re, reason) => {
    re.lastIndex = 0
    let m
    while ((m = re.exec(title)) !== null) {
      spans.push({ start: m.index, end: m.index + m[0].length, raw: m[0], reason })
    }
  }
  push(RE.dimPair, 'dimension')
  push(RE.cm, 'dimension-cm')
  push(RE.slashDim, 'dimension-slash')
  push(RE.nInOne, 'feature-n-in-1')
  push(RE.feature, 'feature-count')
  push(RE.model, 'model-number')
  push(RE.ordinal, 'ordinal-number')
  push(RE.version, 'version-number')
  return spans
}

function overlaps(start, end, spans) {
  return spans.some((s) => start < s.end && end > s.start)
}

function parseNum(raw) {
  const n = Number(String(raw).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * 解析标题规格。
 * @returns {{
 *   title: string,
 *   candidates: Array<{qty:number, unit:string, basis:string, value:number, raw:string, index:number}>,
 *   primary: object|null,
 *   excluded: Array<{raw:string, reason:string}>,
 * }}
 * value = 折算到基础口径的数量：pair→qty×2(pcs)、л→qty×1000(ml)、кг→qty×1000(g)
 */
export function parseSpec(title) {
  const t = String(title || '')
  if (!t.trim()) return { title: t, candidates: [], primary: null, excluded: [] }

  const spans = collectExclusions(t)
  const candidates = []
  const seen = new Set()

  for (const def of UNIT_DEFS) {
    def.re.lastIndex = 0
    let m
    while ((m = def.re.exec(t)) !== null) {
      const start = m.index
      const end = start + m[0].length
      if (overlaps(start, end, spans)) continue
      const key = `${start}-${end}`
      if (seen.has(key)) continue
      const qty = parseNum(m[1])
      if (qty === null || qty <= 0) continue
      seen.add(key)
      let value = qty
      if (def.piecesPer) value = qty * def.piecesPer
      else if (def.mult) value = qty * def.mult
      candidates.push({ qty, unit: def.unit, basis: def.basis, value, raw: m[0].trim(), index: start })
    }
  }

  candidates.sort((a, b) => a.index - b.index)
  const primary = candidates.slice().sort(
    (a, b) => (BASIS_PRIORITY[a.basis] - BASIS_PRIORITY[b.basis]) || (a.index - b.index)
  )[0] || null

  const excluded = spans
    .sort((a, b) => a.start - b.start)
    .map((s) => ({ raw: t.slice(s.start, s.end).trim(), reason: s.reason }))

  return { title: t, candidates, primary, excluded }
}

/** 按 basis 取候选（purityFilter 用）：同基础取首个 */
export function pickCandidate(parsed, basis) {
  if (!parsed || !Array.isArray(parsed.candidates)) return null
  return parsed.candidates.find((c) => c.basis === basis) || null
}
