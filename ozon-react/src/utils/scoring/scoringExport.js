/**
 * scoring/scoringExport.js — 选品结果导出（纯函数，无 React）
 * 导出当前筛选后的 ScoredProduct[]；字段固定（不含内部调试字段）。
 * XLSX 序列化由注入的 XLSX 库完成（浏览器传 import('xlsx')，测试传 require('xlsx')）。
 */

export const EXPORT_COLUMNS = [
  ['商品名', 'name'],
  ['类目', 'categoryFull'],
  ['综合分', 'totalScore'],
  ['等级', 'grade'],
  ['暂定评级', 'gradeTentative'],
  ['Decision', 'decision.status'],
  ['下一步动作', 'decision.action'],
  ['Context', 'context'],
  ['Evidence', 'evidenceCoveragePct'],
  ['市场需求', 'dim_demand'],
  ['市场规模', 'marketScale'],
  ['候选相对表现', 'candidateStrength'],
  ['竞争机会', 'dim_competition'],
  ['价格空间', 'dim_price'],
  ['利润可行性', 'dim_profitability'],
  ['物流适配', 'dim_logistics'],
  ['运营稳健', 'dim_operations'],
  ['Supply Gap', 'gapRank'],
  ['Gap 信号', 'gapSignal'],
  ['风险标记', 'flags'],
]

const GAP_ZH = { HIGH_GAP: '强缺口', MEDIUM_GAP: '中缺口', NO_STRONG_GAP_SIGNAL: '无强信号' }
const FLAG_ZH = {
  MARGIN_RISK: '毛利风险',
  REVIEW_REQUIRED: '合规复核',
  BLOCKED_LOGISTICS: '物流不可行',
  NEEDS_DATA: '数据不足',
  LOW_MARKET_CONTEXT: '无市场基准',
}

/** ScoredProduct[] → 导出行（平面中文字段；null → ''，等级 null → '不可评级'） */
export function buildExportRows(rows) {
  return rows.map((r) => {
    const d = r.dimensions || {}
    const flags = (r.status || []).filter((s) => FLAG_ZH[s]).map((s) => FLAG_ZH[s]).join(' / ')
    return {
      name: r.name || '',
      categoryFull: r.categoryFull || '',
      totalScore: r.totalScore ?? '',
      grade: r.grade ?? '不可评级',
      gradeTentative: r.gradeTentative ? '是' : '',
      'decision.status': r.decision?.status || '',
      'decision.action': r.decision?.action || '',
      context: r.context || '',
      evidenceCoveragePct: r.evidenceCoverage != null ? Math.round(r.evidenceCoverage * 100) : '',
      dim_demand: d.demand?.available ? d.demand.score : '',
      marketScale: d.demand?.marketScaleScore ?? '',
      candidateStrength: d.demand?.candidateStrengthScore ?? '',
      dim_competition: d.competition?.available ? d.competition.score : '',
      dim_price: d.price_opportunity?.available ? d.price_opportunity.score : '',
      dim_profitability: d.profitability?.available ? d.profitability.score : '',
      dim_logistics: d.logistics?.available ? d.logistics.score : '',
      dim_operations: d.operations?.available ? d.operations.score : '',
      gapRank: r.supplyGap ? (GAP_ZH[r.supplyGap.rank] || r.supplyGap.rank) : '',
      gapSignal: r.supplyGap ? r.supplyGap.signal : '',
      flags,
    }
  })
}

/** 导出行 → 中文字段名对象数组（XLSX/CSV 共用表头顺序） */
export function buildExportDocuments(rows) {
  const docs = buildExportRows(rows)
  return docs.map((row) => {
    const out = {}
    for (const [header, key] of EXPORT_COLUMNS) out[header] = row[key] ?? ''
    return out
  })
}

function escapeCsv(v) {
  const s = String(v ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV 序列化（带 BOM，Excel 中文兼容） */
export function rowsToCsv(rows) {
  const docs = buildExportDocuments(rows)
  const headers = EXPORT_COLUMNS.map(([h]) => h)
  const lines = [headers.map(escapeCsv).join(',')]
  for (const doc of docs) {
    lines.push(headers.map((h) => escapeCsv(doc[h])).join(','))
  }
  return '\uFEFF' + lines.join('\r\n')
}

/** XLSX 序列化：注入 XLSX 库 → 触发浏览器下载 */
export function rowsToXlsx(rows, XLSX, filename) {
  const docs = buildExportDocuments(rows)
  const ws = XLSX.utils.json_to_sheet(docs, { header: EXPORT_COLUMNS.map(([h]) => h) })
  ws['!cols'] = EXPORT_COLUMNS.map(([h]) => ({ wch: Math.max(10, Math.min(40, h.length * 2 + 8)) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '选品评分')
  XLSX.writeFile(wb, filename)
}

export function exportFilename(ext) {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `选品评分-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.${ext}`
}
