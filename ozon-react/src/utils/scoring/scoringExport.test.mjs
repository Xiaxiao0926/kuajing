/**
 * scoringExport.test.mjs — 导出功能回归（XLSX 回读验证 + CSV 往返）
 * 用真实 1000 SKU 适配层输出做一次筛选（grade=B），写 XLSX → 用 xlsx 库回读比对。
 * 运行: node --experimental-vm-modules src/utils/scoring/scoringExport.test.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { scoreAllCandidates } from './scoringDataAdapter.js'
import { buildExportDocuments, rowsToCsv, EXPORT_COLUMNS } from './scoringExport.js'

const require = createRequire(import.meta.url)
const XLSX = require(path.join(process.cwd(), 'node_modules', 'xlsx'))

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..', '..', '..', '..')
const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'scoring_rules.json'), 'utf-8'))
const settings = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'settings.json'), 'utf-8'))

let pass = 0, fail = 0
const assert = (cond, msg) => { if (cond) { pass++; console.log(`  ✅ ${msg}`) } else { fail++; console.log(`  ❌ ${msg}`) } }

console.log('\n===== 导出功能测试（XLSX 回读 + CSV） =====\n')

const cDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'ozon-react', 'public', 'data', 'scoring_candidates.json'), 'utf-8'))
const bench = JSON.parse(fs.readFileSync(path.join(ROOT, 'ozon-react', 'public', 'data', 'bsr_market_benchmarks.json'), 'utf-8'))
const rows = scoreAllCandidates({ candidates: cDoc.candidates, benchmark: bench, rules, rubPerCny: settings.rub_per_cny })

// 模拟一次筛选（导出"当前筛选结果"而非全部 1000 行）
const filtered = rows.filter((r) => r.grade === 'B' && r.decision.status === 'ELIGIBLE')
assert(filtered.length > 0 && filtered.length < rows.length, `筛选样本 = ${filtered.length} 行（B 且 ELIGIBLE，非全量）`)

// ---- 字段契约 ----
const requiredHeaders = ['商品名', '综合分', '等级', 'Decision', 'Context', 'Evidence', '市场需求', '市场规模', '候选相对表现', '竞争机会', '价格空间', '利润可行性', '物流适配', '运营稳健', 'Supply Gap', '风险标记']
const headers = EXPORT_COLUMNS.map(([h]) => h)
for (const h of requiredHeaders) assert(headers.includes(h), `导出列包含 "${h}"`)

// ---- XLSX 写 → 回读 ----
const docs = buildExportDocuments(filtered)
const ws = XLSX.utils.json_to_sheet(docs, { header: headers })
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, '选品评分')
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
const wb2 = XLSX.read(buf, { type: 'buffer' })
const sheet = wb2.Sheets[wb2.SheetNames[0]]
const readBack = XLSX.utils.sheet_to_json(sheet, { defval: '' })
assert(readBack.length === filtered.length, `XLSX 回读行数 = ${readBack.length}（与筛选一致）`)
const samples = [0, Math.floor(filtered.length / 2), filtered.length - 1]
let allMatch = true
for (const i of samples) {
  const rb = readBack[i]
  const r = filtered[i]
  const check = (header, expected) => {
    const got = String(rb[header] ?? '')
    const want = String(expected ?? '')
    if (got !== want) { allMatch = false; console.log(`    ❌ 行${i} "${header}": 回读 "${got}" ≠ 期望 "${want}"`) }
  }
  check('商品名', r.name)
  check('综合分', r.totalScore)
  check('等级', r.grade)
  check('Decision', r.decision.status)
  check('下一步动作', r.decision.action)
  check('Context', r.context)
  check('Evidence', Math.round(r.evidenceCoverage * 100))
  check('市场规模', r.dimensions.demand.marketScaleScore ?? '')
  check('候选相对表现', r.dimensions.demand.candidateStrengthScore ?? '')
  check('利润可行性', r.dimensions.profitability.available ? r.dimensions.profitability.score : '')
}
assert(allMatch, 'XLSX 回读抽样字段与源数据一致')

// ---- CSV 往返 ----
const csv = rowsToCsv(filtered)
const csvLines = csv.replace(/^\uFEFF/, '').split('\r\n').filter((l) => l.length > 0)
assert(csvLines.length === filtered.length + 1, `CSV 行数 = ${filtered.length + 1}（表头+数据）`)
assert(csvLines[0].split(',').length === headers.length, `CSV 表头列数 = ${headers.length}`)
// 引号转义：找名字含逗号/引号的行验证往返
const tricky = filtered.find((r) => /[",]/.test(r.name))
if (tricky) {
  const esc = csvLines[1 + filtered.indexOf(tricky)]
  assert(esc.includes(`"${tricky.name.replace(/"/g, '""')}"`), 'CSV 特殊字符转义正确')
} else {
  assert(true, '（样本无特殊字符名，跳过转义断言）')
}

console.log(`\n===== 导出测试结果: ${pass} 通过 / ${fail} 失败 =====\n`)
if (fail > 0) process.exit(1)
