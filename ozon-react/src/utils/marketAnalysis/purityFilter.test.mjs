/**
 * 模块2/4/5 纯度流水线 - 单元测试
 * 运行: node ozon-react/src/utils/marketAnalysis/purityFilter.test.mjs
 *
 * 夹具来源：真实 Ozon 热销表（手套2026-05-12 / 发膜2026-05-08 / 枕头2026-05-08 /
 * 热销产品2026-05-06），行结构复刻两种真实导出格式（简版列名 / 58列全量版列名）。
 * 分类口径为用户冻结决策：UNKNOWN 独立成桶；三维名称 SKU占比/销量占比/销售额占比。
 */

import { detectCategory, classifyRow, runPurityPipeline, resolveSpec } from './purityFilter.js'
import { parseSpec } from './specParser.js'
import { buildWeightedBands } from './priceBands.js'
import { buildCredibility, createSample, summarizeChecks, mulberry32 } from './credibility.js'
import rules from '../../generated/market_analysis.js'

let pass = 0, fail = 0
const assert = (cond, msg) => {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.log(`  ❌ ${msg}`) }
}
const row = (title, price, qty, sales) => ({ 商品名称: title, '价格(₽)': price, 月销量: qty, '月销售额(₽)': sales })

console.log('\n===== 竞品纯度流水线 测试开始 =====\n')

// ---------- 类目检测 ----------
{
  const rows = [
    row('VOIS Маска для волос 350мл', 500, 100, 50000),
    row('Маска для волос 200 мл', 400, 80, 32000),
    row('Маска для волос 1000 мл', 1200, 30, 36000),
    row('Tashe Маска для волос 500 мл', 700, 50, 35000),
    row('MIXIT Маска 400 мл', 600, 40, 24000),
  ]
  const d = detectCategory(rows)
  assert(d.key === 'hair_mask' && d.label === '发膜/发用护理膏', '发膜标题多数投票 → hair_mask')
}
{
  const rows = [
    row('Перчатки хозяйственные 6 пар', 200, 10, 2000),
    row('Перчатки резиновые 50 пар', 900, 5, 4500),
    row('Перчатки хозяйственные 12 пар', 300, 8, 2400),
    row('Перчатки 1 пара M', 100, 20, 2000),
  ]
  const d = detectCategory(rows)
  assert(d.key === 'gloves', '手套标题 → gloves')
}
{
  const rows = [row('Случайный товар без关键词', 100, 1, 100), row('Ещё один посторонний', 200, 1, 200)]
  const d = detectCategory(rows)
  assert(d.key === null, '无关键词数据集 → 类目未识别（全 UNKNOWN）')
}

// ---------- 手套：пар convert → A ----------
{
  const cfg = rules.categories.gloves
  const r = classifyRow(row('Перчатки хозяйственные размер Универсальный 6 пар', 300, 10, 3000), cfg)
  assert(r.tier === 'A' && r.spec.total === 12, '6 пар 手套 → A，折算 12 只')
  assert(Math.abs(r.normalizedPrice - 2500) < 1e-9, '单价 300₽/12只 ×100 = 2500₽/100只')
}
{
  const cfg = rules.categories.gloves
  const r = classifyRow(row('Перчатки хозяйственные 1 пара размер M', 99, 5, 495), cfg)
  assert(r.tier === 'A' && r.spec.total === 2, '1 пара → A，折算 2 只')
}
{
  const cfg = rules.categories.gloves
  const r = classifyRow(row('Перчатки без указания количества', 150, 3, 450), cfg)
  assert(r.tier === 'UNKNOWN', '复数无数量手套 → UNKNOWN（禁止默认值填充）')
}

// ---------- 发膜：volume_ml 口径 ----------
{
  const cfg = rules.categories.hair_mask
  const r = classifyRow(row('VOIS Маска для здоровья волос 350мл', 525, 20, 10500), cfg)
  assert(r.tier === 'A' && r.spec.total === 350, '350мл 发膜 → A')
  assert(Math.abs(r.normalizedPrice - 150) < 1e-9, '525₽/350ml ×100 = 150₽/100ml')
}
{
  const cfg = rules.categories.hair_mask
  const r = classifyRow(row('Набор шампунь и бальзам маска 500 мл', 800, 10, 8000), cfg)
  assert(r.tier === 'B', 'маска 命中但 набор 套装降级 → B')
  assert(r.spec && r.spec.total === 500, 'B 仍参与归一（500ml）')
}
{
  const cfg = rules.categories.hair_mask
  const r = classifyRow(row('Шампунь профессиональный 500 мл', 600, 10, 6000), cfg)
  assert(r.tier === 'B', 'шампунь 邻近品类 → B')
}
{
  const cfg = rules.categories.hair_mask
  const r = classifyRow(row('Маска без объема в названии', 500, 10, 5000), cfg)
  assert(r.tier === 'UNKNOWN' && r.reason.includes('解析'), '发膜无 ml → UNKNOWN')
}
{
  const cfg = rules.categories.hair_mask
  const r = classifyRow(row('Перчатки 6 пар попавшие в файл масок', 300, 5, 1500), cfg)
  assert(r.tier === 'C' && r.reason.includes('пар'), 'пар 进发膜类目（pair_handling=exclude）→ C 排除')
}

// ---------- 枕头：implicit_singular ----------
{
  const cfg = rules.categories.pillows
  const r = classifyRow(row('Премиум подушка 50х70 для сна анатомическая', 890, 25, 22250), cfg)
  assert(r.tier === 'A' && r.spec.total === 1 && r.spec.inferred === 'singular',
    '单数 подушка 无数量 → qty=1（词法推断，可追溯）')
  assert(r.normalizedPrice === 89000, '890₽/1只 ×100 = 89000₽/100只')
}
{
  const cfg = rules.categories.pillows
  const r = classifyRow(row('Подушки 50x70 2шт Queen', 1500, 10, 15000), cfg)
  assert(r.tier === 'A' && r.spec.total === 2, 'Подушки 2шт → qty=2')
}
{
  const cfg = rules.categories.pillows
  const r = classifyRow(row('Подушки анатомические комплект', 2000, 5, 10000), cfg)
  assert(r.tier === 'UNKNOWN', '复数 подушки 无数量 → UNKNOWN（不猜数量）')
}
{
  const cfg = rules.categories.pillows
  const r = classifyRow(row('Наволочка для подушки 50х70 см 1 шт.', 300, 30, 9000), cfg)
  assert(r.tier === 'B', 'наволочка 枕套（邻近品类）→ B')
}

// ---------- 吹风机：implicit_singular ----------
{
  const cfg = rules.categories.hair_dryer
  const r = classifyRow(row('Фен для волос профессиональный мощный с насадками 5в1', 3500, 15, 52500), cfg)
  assert(r.tier === 'A' && r.spec.total === 1 && r.spec.inferred === 'singular',
    'фен 单数无数量 + 5в1 陷阱排除 → qty=1')
  assert(r.normalizedPrice === 3500, 'per=1（每只）→ 归一价=挂牌价')
}
{
  const cfg = rules.categories.hair_dryer
  const r = classifyRow(row('booster воздуходувка для автомобиля беспроводной TF64', 2900, 8, 23200), cfg)
  assert(r.tier === 'B', 'воздуходувка 车用吹尘器（使用场景不同）→ B')
}

// ---------- 未配置类目 ----------
{
  const r = classifyRow(row('Что-то совсем другое 100 шт', 500, 1, 500), null)
  assert(r.tier === 'UNKNOWN' && r.reason.includes('类目'), '类目未配置 → UNKNOWN')
}

// ---------- 整条流水线（模拟小数据集） ----------
{
  const rows = [
    row('Маска для волос 200 мл', 400, 100, 40000),
    row('Маска для волос 200 мл', 420, 80, 33600),
    row('Маска для волос 400 мл', 700, 60, 42000),
    row('Маска для волос 1000 мл', 1200, 30, 36000),
    row('Маска для волос 500 мл', 800, 50, 40000),
    row('Набор маска и шампунь 300 мл', 900, 20, 18000),
    row('Маска без объема', 500, 10, 5000),
    row('Перчатки 6 пар', 300, 5, 1500),
  ]
  const pipeline = runPurityPipeline(rows)
  assert(pipeline.category.key === 'hair_mask', '流水线类目检测 → hair_mask')
  assert(pipeline.stats.total === 8, '总样本 8')
  assert(pipeline.stats.tierCounts.A === 5, 'A=5（5 个 мл 规格发膜）')
  assert(pipeline.stats.tierCounts.B === 1, 'B=1（набор）')
  assert(pipeline.stats.tierCounts.C === 1, 'C=1（пар）')
  assert(pipeline.stats.tierCounts.UNKNOWN === 1, 'UNKNOWN=1（无 ml）')
  assert(pipeline.stats.coveragePct === 87.5, '覆盖率 87.5%')

  const bandsA = buildWeightedBands(pipeline.rows, { tiers: ['A'], bandCount: 3 })
  assert(bandsA.eligibleCount === 5 && bandsA.bands.length === 3, 'A 口径 5 条进 3 个价格带')
  const skuShareSum = bandsA.bands.reduce((s, b) => s + b.skuShare, 0)
  const qtyShareSum = bandsA.bands.reduce((s, b) => s + b.qtyShare, 0)
  const salesShareSum = bandsA.bands.reduce((s, b) => s + b.salesShare, 0)
  assert(Math.abs(skuShareSum - 100) < 0.5 && Math.abs(qtyShareSum - 100) < 0.5 && Math.abs(salesShareSum - 100) < 0.5,
    '三维占比各自归一为 100%')
  assert(bandsA.bands.every((b) => b.priceMin <= b.priceMax), '价格带区间单调')
  const qtyTotal = bandsA.bands.reduce((s, b) => s + b.qty, 0)
  assert(qtyTotal === 100 + 80 + 60 + 30 + 50, 'A 口径销量合计 320 校验（销量维度进入）')
  assert(bandsA.excludedBreakdown.B === 1 && bandsA.excludedBreakdown.C === 1 && bandsA.excludedBreakdown.UNKNOWN === 1,
    '排除明细：B/C/UNKNOWN 各 1（透明可追溯）')

  const bandsAB = buildWeightedBands(pipeline.rows, { tiers: ['A', 'B'], bandCount: 3 })
  assert(bandsAB.eligibleCount === 6, 'A+B 口径 6 条进入（切换生效）')
  assert(bandsAB.totals.sales === 40000 + 33600 + 42000 + 36000 + 40000 + 18000, 'A+B 销售额分母随之变化')

  const cred = buildCredibility(pipeline.rows, pipeline.category)
  assert(cred.total === 8 && cred.coveragePct === 87.5 && cred.tierCounts.A === 5, '可信度统计与流水线一致')

  const sample = createSample(pipeline.rows, { size: 5, seed: 42 })
  const sample2 = createSample(pipeline.rows, { size: 5, seed: 42 })
  assert(sample.length === 5, '抽检样本 5 条')
  assert(JSON.stringify(sample.map((s) => s.key)) === JSON.stringify(sample2.map((s) => s.key)),
    '同种子抽样可复现（种子=42）')
  const sample3 = createSample(pipeline.rows, { size: 5, seed: 7 })
  assert(JSON.stringify(sample.map((s) => s.key)) !== JSON.stringify(sample3.map((s) => s.key)),
    '不同种子样本不同')

  const checks = { [sample[0].key]: 'correct', [sample[1].key]: 'wrong', [sample[2].key]: 'correct' }
  const sum = summarizeChecks(sample, checks)
  assert(sum.checked === 3 && sum.correct === 2 && sum.accuracyPct === 66.7, '核验汇总：3 抽 2 对 = 66.7%')
}

// ---------- mulberry32 确定性 ----------
{
  const a = mulberry32(123)
  const b = mulberry32(123)
  const seqA = [a(), a(), a()]
  const seqB = [b(), b(), b()]
  assert(JSON.stringify(seqA) === JSON.stringify(seqB), 'mulberry32 同种子序列一致')
  assert(seqA[0] !== a(), '序列持续演进')
}

// ---------- resolveSpec 直接调用 ----------
{
  const parsed = parseSpec('Спрей 2 шт 200 мл')
  const resolved = resolveSpec(parsed, rules.categories.hair_spray)
  assert(resolved && resolved.total === 400 && resolved.detail.includes('×'),
    '打包数量×单位容量：2шт × 200мл = 400ml 总量')
}

console.log(`\n===== 测试结果: ${pass} 通过 / ${fail} 失败 =====\n`)
if (fail > 0) process.exit(1)
