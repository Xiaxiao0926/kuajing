/**
 * tests/price-weighted-quantiles.test.mjs
 * 验证 Work Package B：价格带口径纠偏与销量加权分位数（salesWeightedQuantiles）计算
 *
 * 验收目标：
 * 1. 核心反例：10元销量1000、100元销量1，P50 必须为 10（杜绝把非加权切片中值包装为销量分布）
 * 2. 同价商品：分位数一致性
 * 3. 边界值鲁棒性：零销量、负数销量、NaN/非有限数值、零价格、负价格全部正确过滤或返回 insufficient_data
 * 4. 口径分层隔离：C 与 UNKNOWN 彻底排除；A / A+B 切换过滤生效
 * 5. 多件装规格可比价：按 _purity.normalizedPrice 计算分位数
 * 6. buildWeightedBands 向下兼容性：保留 bands、totals、topQtyBandIndex，medianPrice 澄清为未加权切片中值
 */
import assert from 'node:assert/strict'
import {
  calculateSalesWeightedQuantiles,
  buildWeightedBands,
} from '../ozon-react/src/utils/marketAnalysis/priceBands.js'
import {
  runPurityPipeline,
  extractQty,
} from '../ozon-react/src/utils/marketAnalysis/purityFilter.js'

console.log('===== [TEST SUITE 2] Price Bands Sales-Weighted Quantiles Test Suite =====\n')

// ----------------------------------------------------
// 1. 核心反例：加权中位数 vs 未加权切片中位值
// ----------------------------------------------------
console.log('--- 1. 核心反例测试 (10元销量1000 vs 100元销量1) ---')
{
  const rows = [
    { _purity: { tier: 'A', normalizedPrice: 10, qty: 1000, sales: 10000 } },
    { _purity: { tier: 'A', normalizedPrice: 100, qty: 1, sales: 100 } },
  ]

  const q = calculateSalesWeightedQuantiles(rows)
  assert.strictEqual(q.status, 'ok', '必须成功计算加权分位数')
  assert.strictEqual(q.validCount, 2, '有效行数为 2')
  assert.strictEqual(q.totalWeight, 1001, '总权重为 1001')
  // 总权重 1001，50% 阈值为 500.5。第1行累积权重 1000 >= 500.5，因此 P50 必为 10
  assert.strictEqual(q.p50, 10, '核心反例：10元销量1000与100元销量1，销量加权P50中位数必须为 10')
  assert.strictEqual(q.p10, 10, 'P10 必须为 10')
  assert.strictEqual(q.p25, 10, 'P25 必须为 10')
  assert.strictEqual(q.p75, 10, 'P75 必须为 10')
  assert.strictEqual(q.p90, 10, 'P90 必须为 10')

  // 对比 buildWeightedBands 中的切片中位数：
  const result = buildWeightedBands(rows, { tiers: ['A'], bandCount: 2 })
  // 切片 1 (10元) 中位数 10；切片 2 (100元) 中位数 100；切片中位值不代表全局销量分布
  assert.strictEqual(result.salesWeightedQuantiles.p50, 10, 'buildWeightedBands 挂载的 salesWeightedQuantiles.p50 必须为 10')
  console.log(`  ✅ 核心反例验证通过：销量加权 P50 = ${q.p50}，成功纠正非加权切片误解`)
}

// ----------------------------------------------------
// 2. 多梯队阶梯分布与分位点精确性
// ----------------------------------------------------
console.log('\n--- 2. 多梯队阶梯分布加权分位校验 ---')
{
  // 5 个价格档位，分别赋予不同销量权重：
  // 价格 20: 销量 10 (累积 10, 占 10%) -> P10 边界
  // 价格 40: 销量 20 (累积 30, 占 30%) -> P25 落在 40
  // 价格 60: 销量 30 (累积 60, 占 60%) -> P50 落在 60
  // 价格 80: 销量 20 (累积 80, 占 80%) -> P75 落在 80
  // 价格 100: 销量 20 (累积 100, 占 100%) -> P90 落在 100
  const rows = [
    { _purity: { tier: 'A', normalizedPrice: 20, qty: 10 } },
    { _purity: { tier: 'A', normalizedPrice: 40, qty: 20 } },
    { _purity: { tier: 'A', normalizedPrice: 60, qty: 30 } },
    { _purity: { tier: 'A', normalizedPrice: 80, qty: 20 } },
    { _purity: { tier: 'A', normalizedPrice: 100, qty: 20 } },
  ]

  const q = calculateSalesWeightedQuantiles(rows)
  assert.strictEqual(q.status, 'ok')
  assert.strictEqual(q.totalWeight, 100)
  assert.strictEqual(q.p10, 20, 'P10 阈值 10 -> 价格 20')
  assert.strictEqual(q.p25, 40, 'P25 阈值 25 -> 价格 40')
  assert.strictEqual(q.p50, 60, 'P50 阈值 50 -> 价格 60')
  assert.strictEqual(q.p75, 80, 'P75 阈值 75 -> 价格 80')
  assert.strictEqual(q.p90, 100, 'P90 阈值 90 -> 价格 100')
  console.log(`  ✅ 阶梯分位验证通过: P10=${q.p10}, P25=${q.p25}, P50=${q.p50}, P75=${q.p75}, P90=${q.p90}`)
}

// ----------------------------------------------------
// 3. 同价商品与单商品边界
// ----------------------------------------------------
console.log('\n--- 3. 同价商品与单品边界测试 ---')
{
  const samePriceRows = [
    { _purity: { tier: 'A', normalizedPrice: 50, qty: 100 } },
    { _purity: { tier: 'A', normalizedPrice: 50, qty: 200 } },
    { _purity: { tier: 'A', normalizedPrice: 50, qty: 300 } },
  ]
  const qSame = calculateSalesWeightedQuantiles(samePriceRows)
  assert.strictEqual(qSame.p10, 50)
  assert.strictEqual(qSame.p50, 50)
  assert.strictEqual(qSame.p90, 50)
  console.log('  ✅ 同价商品全部返回统一价格 50')

  const singleRow = [
    { _purity: { tier: 'A', normalizedPrice: 88.5, qty: 15 } },
  ]
  const qSingle = calculateSalesWeightedQuantiles(singleRow)
  assert.strictEqual(qSingle.p50, 88.5)
  assert.strictEqual(qSingle.validCount, 1)
  console.log('  ✅ 单品样本正确定位自身价格 88.5')
}

// ----------------------------------------------------
// 4. 异常值、零销量、负数、无效数值安全兜底
// ----------------------------------------------------
console.log('\n--- 4. 异常权重与非数字安全过滤 ---')
{
  const dirtyRows = [
    { _purity: { tier: 'A', normalizedPrice: 30, qty: 0 } },          // 零销量排除
    { _purity: { tier: 'A', normalizedPrice: 40, qty: -10 } },        // 负数销量排除
    { _purity: { tier: 'A', normalizedPrice: 50, qty: NaN } },        // NaN排除
    { _purity: { tier: 'A', normalizedPrice: 60, qty: null } },       // null排除
    { _purity: { tier: 'A', normalizedPrice: 70, qty: undefined } },  // undefined排除
    { _purity: { tier: 'A', normalizedPrice: 0, qty: 100 } },         // 零价格排除
    { _purity: { tier: 'A', normalizedPrice: -20, qty: 100 } },       // 负价格排除
    { _purity: { tier: 'A', normalizedPrice: 99, qty: 50 } },         // 唯一有效行
  ]

  const q = calculateSalesWeightedQuantiles(dirtyRows)
  assert.strictEqual(q.status, 'ok')
  assert.strictEqual(q.validCount, 1, '仅 1 行有效数据通过过滤')
  assert.strictEqual(q.totalWeight, 50)
  assert.strictEqual(q.p50, 99)
  console.log('  ✅ 脏数据行安全过滤，只采纳有效正价格与正销量')

  // 全脏数据导致无可计算权重
  const allZeroRows = [
    { _purity: { tier: 'A', normalizedPrice: 30, qty: 0 } },
    { _purity: { tier: 'A', normalizedPrice: 40, qty: -5 } },
  ]
  const qZero = calculateSalesWeightedQuantiles(allZeroRows)
  assert.strictEqual(qZero.status, 'insufficient_data')
  assert.strictEqual(qZero.reason, 'no_positive_sales_weight')
  assert.strictEqual(qZero.p50, null)
  assert.strictEqual(qZero.totalWeight, 0)
  console.log('  ✅ 无有效正数销量时安全返回 insufficient_data，绝不冒充 0 或伪造中位数')
}

// ----------------------------------------------------
// 5. 口径分层隔离：C/UNKNOWN 严格排除，A 与 A+B 切换生效
// ----------------------------------------------------
console.log('\n--- 5. 纯度口径过滤与 A/AB 切换校验 ---')
{
  const mixedRows = [
    { _purity: { tier: 'A', normalizedPrice: 15, qty: 100 } },
    { _purity: { tier: 'B', normalizedPrice: 45, qty: 200 } },
    { _purity: { tier: 'C', normalizedPrice: 5, qty: 9999 } },       // 必须彻底排除
    { _purity: { tier: 'UNKNOWN', normalizedPrice: 8, qty: 8888 } }, // 必须彻底排除
  ]

  // A 默认口径
  const bandsA = buildWeightedBands(mixedRows, { tiers: ['A'], bandCount: 2 })
  assert.strictEqual(bandsA.salesWeightedQuantiles.validCount, 1)
  assert.strictEqual(bandsA.salesWeightedQuantiles.p50, 15, 'A 口径仅采纳 A 级样本')
  assert.strictEqual(bandsA.excludedBreakdown.C, 1, 'C 被计入排除明细')
  assert.strictEqual(bandsA.excludedBreakdown.UNKNOWN, 1, 'UNKNOWN 被计入排除明细')

  // A+B 参考口径
  const bandsAB = buildWeightedBands(mixedRows, { tiers: ['A', 'B'], bandCount: 2 })
  assert.strictEqual(bandsAB.salesWeightedQuantiles.validCount, 2)
  // A (15元, qty 100) + B (45元, qty 200), 总权重 300, P50 阈值 150 -> 累积 100 < 150，落在 B 的 45 元
  assert.strictEqual(bandsAB.salesWeightedQuantiles.p50, 45, 'A+B 口径下 B 级商品参与加权计算')
  console.log('  ✅ C 与 UNKNOWN 彻底排除；A / A+B 切换后销量加权分位口径联动生效')
}

// ----------------------------------------------------
// 6. 多件装规格可比价验证
// ----------------------------------------------------
console.log('\n--- 6. 多件装规格归一化可比价校验 ---')
{
  // 模拟规格标准化：
  // 商品 1: 挂牌 500₽ / 2只装 -> 每只标准化可比价 250₽，销量 100
  // 商品 2: 挂牌 150₽ / 1只装 -> 每只标准化可比价 150₽，销量 200
  const normalizedRows = [
    { _purity: { tier: 'A', normalizedPrice: 250, qty: 100, price: 500 } },
    { _purity: { tier: 'A', normalizedPrice: 150, qty: 200, price: 150 } },
  ]
  const qNorm = calculateSalesWeightedQuantiles(normalizedRows)
  // 总权重 300, 阈值 150. 升序后第 1 项为 150₽ (权重 200 >= 150)，故 P50 = 150
  assert.strictEqual(qNorm.p50, 150, '以 normalizedPrice 为价格轴计算分位数')
  console.log('  ✅ 成功验证分位数严格按类目标准化可比价排序与累计')
}

// ----------------------------------------------------
// 7. buildWeightedBands 向下兼容性校验
// ----------------------------------------------------
console.log('\n--- 7. buildWeightedBands 向下兼容性结构校验 ---')
{
  const rows = [
    { _purity: { tier: 'A', normalizedPrice: 10, qty: 50, sales: 500 } },
    { _purity: { tier: 'A', normalizedPrice: 20, qty: 30, sales: 600 } },
    { _purity: { tier: 'A', normalizedPrice: 30, qty: 20, sales: 600 } },
  ]
  const res = buildWeightedBands(rows, { tiers: ['A'], bandCount: 3 })
  assert.ok(Array.isArray(res.bands), 'res.bands 存在且为数组')
  assert.strictEqual(res.bands.length, 3, '3 个切片')
  assert.strictEqual(res.eligibleCount, 3)
  assert.strictEqual(res.totals.sku, 3)
  assert.strictEqual(res.totals.qty, 100)
  assert.strictEqual(res.totals.sales, 1700)
  assert.ok(res.salesWeightedQuantiles, '新增挂载 salesWeightedQuantiles 属性')
  assert.strictEqual(res.salesWeightedQuantiles.status, 'ok')
  console.log('  ✅ 结构与字段完全向下兼容既有流水线与仪表盘')
}

// ----------------------------------------------------
// 8. 原始销量输入到分位数端到端链路校验
// ----------------------------------------------------
console.log('\n--- 8. 原始销量输入到分位数端到端链路校验 ---')
{
  // 8.1 单独 extractQty 单元级保守解析校验
  assert.strictEqual(extractQty({ 销量: '-5' }), 0, "'-5' 负数输入必须解析为 0")
  assert.strictEqual(extractQty({ 销量: '5-10' }), 0, "'5-10' 区间输入必须解析为 0（严禁拼接为 510）")
  assert.strictEqual(extractQty({ 销量: '5~10' }), 0, "'5~10' 波浪号区间必须解析为 0")
  assert.strictEqual(extractQty({ 销量: '5至10' }), 0, "'5至10' 中文区间必须解析为 0")
  assert.strictEqual(extractQty({ 销量: '1 000' }), 1000, "'1 000' 空格千位符必须正常解析为 1000")
  assert.strictEqual(extractQty({ 销量: '2,000' }), 2000, "'2,000' 逗号千位符必须正常解析为 2000")
  assert.strictEqual(extractQty({ 销量: -10 }), 0, '负数数字直接解析为 0')
  assert.strictEqual(extractQty({ 销量: 0 }), 0, '0 销量解析为 0')
  assert.strictEqual(extractQty({ 销量: '' }), 0, '空字符串解析为 0')
  console.log('  ✅ 8.1 extractQty 单元测试：负数、范围输入安全归零，千位符正常保留')

  // 8.2 原始行输入进入 runPurityPipeline -> buildWeightedBands 端到端链路
  const rawRows = [
    { '商品名称': 'Маска для волос 500мл', '价格': 100, '销量': '-5' },    // 负数 -> qty: 0
    { '商品名称': 'Маска для волос 500мл', '价格': 200, '销量': '5-10' },  // 区间 -> qty: 0
    { '商品名称': 'Маска dla волос 500мл', '价格': 250, '销量': '5~10' },  // 区间 -> qty: 0
    { '商品名称': 'Маска для волос 500мл', '价格': 300, '销量': '1 000' }, // 合法千位符 -> qty: 1000, 可比价 300/500*100 = 60
    { '商品名称': 'Маска для волос 500мл', '价格': 600, '销量': '2,000' }, // 合法千位符 -> qty: 2000, 可比价 600/500*100 = 120
    { '商品名称': 'Маска для волос 500мл', '价格': 500, '销量': '' },      // 空值 -> qty: 0
  ]

  const pipelineRes = runPurityPipeline(rawRows)
  assert.strictEqual(pipelineRes.rows.length, 6)

  // 校验每行的 _purity.qty 提取结果
  assert.strictEqual(pipelineRes.rows[0]._purity.qty, 0, '第1行 -5 不得被解析为正数')
  assert.strictEqual(pipelineRes.rows[1]._purity.qty, 0, '第2行 5-10 不得被解析为 510')
  assert.strictEqual(pipelineRes.rows[2]._purity.qty, 0, '第3行 5~10 不得参与加权')
  assert.strictEqual(pipelineRes.rows[3]._purity.qty, 1000, '第4行 1 000 成功提取')
  assert.strictEqual(pipelineRes.rows[4]._purity.qty, 2000, '第5行 2,000 成功提取')
  assert.strictEqual(pipelineRes.rows[5]._purity.qty, 0, '第6行空值提取为 0')

  // 构建价格带与销量加权分位数
  const bandsRes = buildWeightedBands(pipelineRes.rows, { tiers: ['A'], bandCount: 2 })
  const quantiles = bandsRes.salesWeightedQuantiles

  assert.strictEqual(quantiles.status, 'ok')
  // 只有第 4 行与第 5 行具有有效正数销量权重，因此有效加权样本数必须为 2
  assert.strictEqual(quantiles.validCount, 2, '只有合法正销量的 2 条记录进入加权')
  assert.strictEqual(quantiles.totalWeight, 3000, '总权重为 1000 + 2000 = 3000')

  // 第 4 行 normalizedPrice = 60 (权重 1000), 第 5 行 normalizedPrice = 120 (权重 2000)
  // P50 阈值 1500。累积到第 4 行仅 1000 < 1500，累积到第 5 行 3000 >= 1500，故 P50 = 120
  assert.strictEqual(quantiles.p10, 60)
  assert.strictEqual(quantiles.p50, 120, 'P50 加权中位点精准落在 120')
  assert.strictEqual(quantiles.p90, 120)
  console.log('  ✅ 8.2 原始行链路加权分位验证通过：负数与区间被彻底剔除出权重，P50 精确计算')

  // 8.3 全量非法/区间销量的全无效样本安全兜底
  const invalidOnlyRows = [
    { '商品名称': 'Маска для волос 500мл', '价格': 100, '销量': '-5' },
    { '商品名称': 'Маска для волос 500мл', '价格': 200, '销量': '5-10' },
  ]
  const invalidPipeline = runPurityPipeline(invalidOnlyRows)
  const invalidBands = buildWeightedBands(invalidPipeline.rows, { tiers: ['A'] })
  assert.strictEqual(invalidBands.salesWeightedQuantiles.status, 'insufficient_data', '全无效销量安全返回 insufficient_data')
  assert.strictEqual(invalidBands.salesWeightedQuantiles.validCount, 0)
  assert.strictEqual(invalidBands.salesWeightedQuantiles.totalWeight, 0)
  assert.strictEqual(invalidBands.salesWeightedQuantiles.p50, null)
  console.log('  ✅ 8.3 全无效销量行兜底通过：返回 insufficient_data，绝不冒充有效分位')
}

console.log('\n🎉 [PASS] Price Bands Sales-Weighted Quantiles 全部测试通过！\n')
