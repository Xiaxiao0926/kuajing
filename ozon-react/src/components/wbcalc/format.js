export const fmtCny = (v) => (v === null || v === undefined ? '—' : `¥${Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
export const fmtRub = (v) => (v === null || v === undefined ? '—' : `₽${Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
export const fmtPct = (v) => (v === null || v === undefined ? '—' : `${Number(v).toFixed(1)}%`)

// 加载WB佣金数据（96类目 / 7424条商品）
let _commissionCache = null
export async function loadCommissionData() {
  if (_commissionCache) return _commissionCache
  try {
    const resp = await fetch(getAssetUrl('data/wb_commission.json') + '?t=' + Date.now())
    if (!resp.ok) return null
    const data = await resp.json()
    _commissionCache = data
    return data
  } catch (e) {
    console.warn('加载WB佣金数据失败:', e.message)
    return null
  }
}
import { getAssetUrl } from '../../utils/runtime.js'
