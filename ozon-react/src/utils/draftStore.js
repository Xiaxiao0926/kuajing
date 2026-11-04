/**
 * draftStore.js — 表单草稿的读写、恢复与格式化（FINDINGS 发现2 修复共用）
 *
 * 铁律：
 *  - 草稿只存 UI 输入快照，绝不写入项目/候选等正式数据；保存正式数据仍走各自 store。
 *  - 所有操作 fail-close：localStorage 异常时静默降级，绝不阻断主流程。
 *  - 恢复时只接受白名单字段，且空值不覆盖（避免 '' 把已有值清空）。
 */
import { persistGet, persistSet, persistRemove } from './persist.js'

/** 读取草稿；不存在或形状非法返回 null */
export function readDraft(key) {
  if (!key) return null
  try {
    const d = persistGet(key)
    return d && typeof d === 'object' ? d : null
  } catch { return null }
}

/** 写入草稿（自动附加 __savedAt 时间戳）；key 为空或写入异常时静默跳过 */
export function writeDraft(key, data) {
  if (!key) return
  try {
    persistSet(key, { ...data, __savedAt: new Date().toISOString() })
  } catch { /* fail-close */ }
}

/** 清除草稿 */
export function clearDraft(key) {
  if (!key) return
  try { persistRemove(key) } catch { /* ignore */ }
}

/**
 * 把草稿中的白名单字段合并进 base（草稿优先，空值跳过）
 * @param {object} base 已含 prefill/默认值的基线
 * @param {object|null} draft 读出的草稿
 * @param {string[]} whitelist 允许恢复的字段名
 */
export function restoreDraftFields(base, draft, whitelist) {
  if (!draft || !Array.isArray(whitelist)) return base
  const out = { ...base }
  for (const key of whitelist) {
    const v = draft[key]
    if (v !== undefined && v !== null && v !== '') out[key] = v
  }
  return out
}

/** 草稿保存时间的人类可读格式（M-D HH:mm），解析失败返回空串 */
export function formatDraftTime(iso) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch { return '' }
}
