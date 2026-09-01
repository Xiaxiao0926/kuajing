/**
 * 纯度流水线端到端测试（对齐 PurityPipelinePage.jsx 的完整数据流）
 * 运行: node --experimental-vm-modules ozon-react/src/utils/marketAnalysis/pipeline.e2e.test.mjs
 *
 * 数据源：public/data 下真实 Ozon 热销表（发膜 2026-05-08 / 手套 2026-05-12）。
 * 验证链路：xlsx 解析 → runPurityPipeline → buildWeightedBands(A/A+B) →
 *           buildCredibility → createSample（种子确定性）→ summarizeChecks。
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import * as XLSX from 'xlsx'
import { runPurityPipeline } from './purityFilter.js'
import { buildWeightedBands } from './priceBands.js'
import { buildCredibility, createSample, summarizeChecks } from './credibility.js'

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public', 'data')

let pass = 0, fail = 0
const assert = (cond, msg) => {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.log(`  ❌ ${msg}`) }
}

// 与 PurityPipelinePage.parseXlsxArrayBuffer 相同的解析逻辑
function parseXlsx(fileName) {
  const buf = readFileSync(join(DATA_DIR, fileName))
  const workbook = XLSX.read(new Uint8Array(buf), { type: 'array' })
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
  if (jsonData.length < 2) return []
  const headers = jsonData[0].map((h) => String(h).trim())
  return jsonData
    .slice(1)
    .filter((row) => row.some((cell) => cell !== undefined && cell !== null && cell !== ''))
    .map((row) => {
      const obj = {}
      headers.forEach((header, index) => { obj[header] = row[index] })
      return obj
    })
}

function runDataset(fileName, expectCategoryKey) {
  console.log(`\n----- 数据集: ${fileName} -----`)
  const rows = parseXlsx(fileName)
  assert(rows.length > 0, `xlsx 解析出 ${rows.length} 行`)

  const pipeline = runPurityPipeline(rows)
  assert(pipeline.category.key === expectCategoryKey,
    `类目检测 = ${expectCategoryKey}（实际 ${pipeline.category.key}，份额 ${(pipeline.category.share * 100).toFixed(1)}%）`)

  const { stats } = pipeline
  const tierSum = stats.tierCounts.A + stats.tierCounts.B + stats.tierCounts.C + stats.tierCounts.UNKNOWN
  assert(tierSum === stats.total, `四桶合计 ${tierSum} = 有效样本 ${stats.total}`)
  assert(stats.coveragePct > 0, `识别覆盖率 ${stats.coveragePct}%（identified=${stats.identified}, unknown=${stats.unknown}）`)

  const bandsA = buildWeightedBands(pipeline.rows, { tiers: ['A'] })
  const bandsAB = buildWeightedBands(pipeline.rows, { tiers: ['A', 'B'] })
  assert(bandsA.bands.length > 0, `A 口径价格带 ${bandsA.bands.length} 档，进入 ${bandsA.eligibleCount} SKU`)
  assert(bandsAB.eligibleCount >= bandsA.eligibleCount, `A+B 口径进入 ${bandsAB.eligibleCount} SKU ≥ A 口径 ${bandsA.eligibleCount}`)

  const shareSum = (key) => Math.round(bandsA.bands.reduce((s, b) => s + b[key], 0) * 10) / 10
  assert(Math.abs(shareSum('skuShare') - 100) <= 0.2, `A 口径 SKU 占比合计 = ${shareSum('skuShare')}%（≈100）`)
  assert(Math.abs(shareSum('salesShare') - 100) <= 0.2 || shareSum('salesShare') === 0,
    `A 口径销售额占比合计 = ${shareSum('salesShare')}%（无销售额列时为 0）`)
  assert(bandsA.bands.every((b) => b.priceMin <= b.medianPrice && b.medianPrice <= b.priceMax),
    '各价格带中位价落在 [priceMin, priceMax] 区间内（排序分箱一致性）')
  assert(bandsA.bands.every((b) => b.priceMin <= b.priceMax), '各价格带 priceMin ≤ priceMax')
  for (let i = 1; i < bandsA.bands.length; i++) {
    assert(bandsA.bands[i].priceMin >= bandsA.bands[i - 1].priceMax,
      `带${i + 1} 下界 ≥ 带${i} 上界（区间单调不重叠）`)
  }
  assert(bandsA.topQtyBandIndex !== null, `主流价格带 = 带${bandsA.topQtyBandIndex}`)

  for (const tier of ['C', 'UNKNOWN']) {
    assert(bandsA.excludedBreakdown[tier] === stats.tierCounts[tier],
      `排除明细 ${tier}=${bandsA.excludedBreakdown[tier]}（= 分层计数 ${stats.tierCounts[tier]}）`)
  }

  const credibility = buildCredibility(pipeline.rows, pipeline.category)
  assert(credibility.total === stats.total && credibility.coveragePct === stats.coveragePct,
    '可信度统计与流水线统计一致')

  const s1 = createSample(pipeline.rows, { size: 50, seed: 7 })
  const s2 = createSample(pipeline.rows, { size: 50, seed: 7 })
  assert(s1.length === Math.min(50, stats.total) && s1.length === s2.length,
    `抽检样本 ${s1.length} 条（size=50 上限）`)
  assert(s1.every((item, i) => item.key === s2[i].key), '同种子重抽样本一致（确定性）')
  assert(new Set(s1.map((i) => i.key)).size === s1.length, '样本 key 无重复')

  const checks = {}
  s1.slice(0, 10).forEach((item, i) => { checks[item.key] = i < 8 ? 'correct' : 'wrong' })
  const summary = summarizeChecks(s1, checks)
  assert(summary.checked === 10 && summary.correct === 8 && summary.wrong === 2,
    `核验汇总：checked=${summary.checked}, correct=${summary.correct}, wrong=${summary.wrong}`)
  assert(summary.accuracyPct === 80, `准确率 = ${summary.accuracyPct}%`)
  assert(summary.wrongItems.length === 2 && summary.wrongItems.every((w) => checks[w.key] === 'wrong'),
    '异常清单只含判定错误项')

  console.log(`  📊 分层: A=${stats.tierCounts.A} B=${stats.tierCounts.B} C=${stats.tierCounts.C} UNKNOWN=${stats.tierCounts.UNKNOWN}`)
  if (bandsA.bands.length > 0) {
    const main = bandsA.bands.find((b) => b.index === bandsA.topQtyBandIndex)
    console.log(`  💰 主流价格带 带${main.index}: ₽${main.priceMin.toFixed(1)}–₽${main.priceMax.toFixed(1)}，中位 ₽${main.medianPrice.toFixed(1)}`)
  }
}

console.log('\n===== 纯度流水线 端到端测试开始 =====')

const appSource = readFileSync(join(DATA_DIR, '..', '..', 'src', 'App.jsx'), 'utf8')
assert(
  appSource.includes('<option value="__purity_analysis__">选品市场分析</option>'),
  '移动端“当前步骤”下拉包含选品市场分析入口'
)

runDataset('发膜热销品2026-05-08.xlsx', 'hair_mask')
runDataset('手套热销产品2026-05-12.xlsx', 'gloves')

console.log(`\n===== 测试结果: ${pass} 通过 / ${fail} 失败 =====`)
if (fail > 0) process.exit(1)
