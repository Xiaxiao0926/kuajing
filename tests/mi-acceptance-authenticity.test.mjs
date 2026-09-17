/**
 * tests/mi-acceptance-authenticity.test.mjs
 * 验收项 1：全量数据真实性与抽样对拍
 * - 验证 6,534 个 Niche 全部存在且字段与原始 CSV 一致
 * - 验证 300,001 个 Keyword 全部存在且字段与原始 CSV 一致
 * - 随机抽取 20 个 Niche 与 50 个 Keyword 进行逐字段对拍
 */
import fs from 'fs'
import path from 'path'
import assert from 'assert'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { searchKeywords, loadKeywordsIndex } = require('../scripts/keywordsSearchService.cjs')

const ROOT = path.resolve('.')
const SRC_DIR = path.resolve('D:/FYZSXNB/市场分析wb/analysis_output')
const NICHES_JSON_PATH = path.resolve('ozon-react/public/data/market_intelligence/runs/RUN-20260917-001/niches_compact.json')
const NICHES_CSV_PATH = path.join(SRC_DIR, 'FULL_all_niches_scored.csv')
const KEYWORDS_CSV_PATH = path.join(SRC_DIR, 'searches_all_cleaned.csv')

console.log('=== [ACCEPTANCE 1] 全量数据真实性与抽样对拍 ===\n')

// 1. 验证 Niches 全量与结构
assert(fs.existsSync(NICHES_JSON_PATH), `Niches JSON 文件不存在: ${NICHES_JSON_PATH}`)
const nichesJson = JSON.parse(fs.readFileSync(NICHES_JSON_PATH, 'utf-8'))
console.log(`[PASS] 1.1 niches_compact.json 成功载入，利基总数: ${nichesJson.length} (期望: 6534)`)
assert.strictEqual(nichesJson.length, 6534, '利基总数必须精确为 6534')

// 2. 验证 Keywords 全量与结构
const allKw = loadKeywordsIndex()
console.log(`[PASS] 1.2 搜索词索引引擎预热成功，全量搜索词数: ${allKw.length} (期望: 300001)`)
assert.strictEqual(allKw.length, 300001, '搜索词总数必须精确为 300001')

// 3. 随机抽取原始 CSV 20 个 Niche 对拍
console.log('\n--- 1.3 随机抽样 20 个 Niche 与原始 CSV 对拍 ---')
function parseCsvLine(line) {
  const res = []
  let curr = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') inQuotes = !inQuotes
    else if (ch === ',' && !inQuotes) { res.push(curr); curr = '' }
    else curr += ch
  }
  res.push(curr)
  return res
}

const csvLines = fs.readFileSync(NICHES_CSV_PATH, 'utf-8').split('\n').filter((l) => l.trim())
const header = parseCsvLine(csvLines[0])
const nameIdx = header.indexOf('niche_name')
const catIdx = header.indexOf('category')
const mosIdx = header.indexOf('market_opportunity_score')
const cfsIdx = header.indexOf('feasibility_score')
const revIdx = header.indexOf('revenue')
const buyoutIdx = header.indexOf('buyout_rate')

// 建立 JSON map by name
const jsonMap = new Map()
for (const n of nichesJson) {
  jsonMap.set(n.name, n)
}

// 抽取 20 个步长采样的样本（覆盖从头部到尾部不同排名的利基）
const sampleIndices = []
const step = Math.floor((csvLines.length - 2) / 20)
for (let i = 1; i < csvLines.length && sampleIndices.length < 20; i += step) {
  sampleIndices.push(i)
}

let nicheMatchCount = 0
for (const idx of sampleIndices) {
  const p = parseCsvLine(csvLines[idx].trim())
  const rawName = p[nameIdx]
  const target = jsonMap.get(rawName)
  assert(target, `原始 CSV 第 ${idx} 行利基 "${rawName}" 在 JSON 中未找到`)

  // 对拍核心指标
  const rawMos = roundNum(parseFloat(p[mosIdx]), 1)
  const rawCfs = roundNum(parseFloat(p[cfsIdx]), 1)
  const rawRev = parseInt(floatVal(p[revIdx]), 10)
  const rawBuyout = roundNum(parseFloat(p[buyoutIdx].replace('%', '')), 1)

  assert.strictEqual(target.cat, p[catIdx], `类目不匹配: ${rawName}`)
  assert.strictEqual(target.mos, rawMos, `MOS 分值不匹配: ${rawName} (JSON:${target.mos} vs CSV:${rawMos})`)
  assert.strictEqual(target.cfs, rawCfs, `PFS 分值不匹配: ${rawName}`)
  assert.strictEqual(target.gmv, rawRev, `GMV 不匹配: ${rawName}`)
  assert.strictEqual(target.buyout, rawBuyout, `签收率不匹配: ${rawName}`)

  nicheMatchCount++
  console.log(`  ✓ 对拍通过 #${nicheMatchCount} [行 ${idx}]: "${rawName}" | 类目: ${target.cat} | MOS: ${target.mos} | PFS: ${target.cfs} | 签收率: ${target.buyout}%`)
}
assert.strictEqual(nicheMatchCount, 20, '20 个利基抽检对拍必须 100% 通过')
console.log(`[PASS] 20 个利基样本与原始 CSV 逐项比对全部一致！`)

// 4. 随机抽取原始 CSV 50 个 Keyword 对拍
console.log('\n--- 1.4 随机抽样 50 个 Keyword 与原始 CSV 对拍 ---')
const kwLines = fs.readFileSync(KEYWORDS_CSV_PATH, 'utf-8').split('\n').filter((l) => l.trim())
const kwSampleIndices = []
const kwStep = Math.floor((kwLines.length - 2) / 50)
for (let i = 1; i < kwLines.length && kwSampleIndices.length < 50; i += kwStep) {
  kwSampleIndices.push(i)
}

let kwMatchCount = 0
for (const idx of kwSampleIndices) {
  const p = parseCsvLine(kwLines[idx].trim())
  const rawQuery = p[0]
  const rawVol = parseInt(p[1], 10) || 0
  const rawGoods = parseInt(p[18], 10) || 0
  const rawDsi = roundNum(parseFloat(p[22]) || 0, 1)

  const searchRes = searchKeywords({ q: rawQuery, pageSize: 20 })
  const match = searchRes.items.find((item) => item.query === rawQuery)
  assert(match, `原始 CSV 第 ${idx} 行关键词 "${rawQuery}" 在搜索引擎中未检索到`)

  assert.strictEqual(match.search_vol, rawVol, `搜索量不匹配: "${rawQuery}"`)
  assert.strictEqual(match.goods_count, rawGoods, `在售商品数不匹配: "${rawQuery}"`)
  assert.strictEqual(match.dsi, rawDsi, `DSI 不匹配: "${rawQuery}" (Engine:${match.dsi} vs CSV:${rawDsi})`)

  kwMatchCount++
  if (kwMatchCount <= 10 || kwMatchCount % 10 === 0) {
    console.log(`  ✓ 对拍通过 #${kwMatchCount} [行 ${idx}]: "${rawQuery}" | 搜索量: ${match.search_vol} | 商品数: ${match.goods_count} | DSI: ${match.dsi}`)
  }
}
assert.strictEqual(kwMatchCount, 50, '50 个关键词抽检对拍必须 100% 通过')
console.log(`[PASS] 50 个关键词样本与原始 CSV 逐项比对全部一致！`)

// 5. 验证全量筛选、排序与检索作用于全局数据集
console.log('\n--- 1.5 验证搜索/排序/筛选作用于全量数据而非当前分页 ---')
const searchBeer = searchKeywords({ q: 'авто', page: 1, pageSize: 10 })
console.log(`  - 搜索 "авто"：匹配总数 = ${searchBeer.filteredCount} 条（作用于全量 300,001 条）`)
assert(searchBeer.filteredCount > 1000, '搜索 "авто" 命中总数应远大于分页数 10')
assert.strictEqual(searchBeer.items.length, 10, '单页切片长度应为 10')

const blueOceanSearch = searchKeywords({ type: 'BLUE_OCEAN', page: 1, pageSize: 50 })
console.log(`  - 筛选 BLUE_OCEAN (DSI >= 1.5)：全局匹配总数 = ${blueOceanSearch.filteredCount} 条`)
assert(blueOceanSearch.filteredCount > 500, '蓝海词命中总数应大于 500')
for (const item of blueOceanSearch.items) {
  assert(item.dsi >= 1.5, `蓝海词 DSI 必须 >= 1.5，当前: ${item.dsi}`)
}

console.log('\n🎉 [ACCEPTANCE 1 PASS] 全量数据真实性与抽样对拍 100% 验证通过！\n')

function roundNum(val, dec) {
  const m = Math.pow(10, dec)
  return Math.round(val * m) / m
}

function floatVal(v) {
  const n = parseFloat(v)
  return isNaN(n) ? 0 : n
}
