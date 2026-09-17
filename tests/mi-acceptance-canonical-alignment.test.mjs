/**
 * tests/mi-acceptance-canonical-alignment.test.mjs
 * 验收项 8 自动化测试：业务指标与 5 个标杆产品 100% 对齐验证
 * 标杆产品：发泡胶枪、热缩管、拖车支轮、中控锁、锯链
 * 验证字段：MOS、PFS、GMV、签收率、风险标签/EAC、决策建议、关联核心俄语词
 */
import fs from 'fs'
import path from 'path'
import assert from 'assert'

const POOL_PATH = path.resolve('ozon-react/public/data/market_intelligence/runs/RUN-20260917-001/validation_pool.json')
const NICHES_PATH = path.resolve('ozon-react/public/data/market_intelligence/runs/RUN-20260917-001/niches_compact.json')

console.log('=== [ACCEPTANCE 8] 标杆产品指标与前期分析 100% 对齐校验 ===\n')

const pool = JSON.parse(fs.readFileSync(POOL_PATH, 'utf-8'))
const niches = JSON.parse(fs.readFileSync(NICHES_PATH, 'utf-8'))

const allPoolItems = [
  ...pool.TEST.map((i) => ({ ...i, poolCol: 'TEST' })),
  ...pool.VERIFY.map((i) => ({ ...i, poolCol: 'VERIFY' })),
  ...pool.WATCH.map((i) => ({ ...i, poolCol: 'WATCH' })),
  ...pool.DROP.map((i) => ({ ...i, poolCol: 'DROP' })),
]

const canonicalSpecs = [
  {
    name: '发泡胶枪',
    category: '手动工具及配件',
    expectedVerdict: 'TEST',
    expectedMos: 73.7,
    expectedPfs: 100.0,
    expectedComp: 85.5,
    expectedGmv: 7785641,
    expectedBuyout: '91.0%',
    expectedEac: 'NOT_REQUIRED_VERIFIED',
    expectedWeight: 380,
    expectedTopKwIncludes: 'пистолет для монтажной пены',
  },
  {
    name: '热缩管',
    category: '电工电气',
    expectedVerdict: 'TEST',
    expectedMos: 69.9,
    expectedPfs: 100.0,
    expectedComp: 83.4,
    expectedGmv: 4596279,
    expectedBuyout: '91.0%',
    expectedWeight: 120,
    expectedTopKwIncludes: 'термоусадка для проводов',
  },
  {
    name: '拖车支轮',
    category: '汽车配件及改装件',
    expectedVerdict: 'VERIFY',
    expectedMos: 80.7,
    expectedPfs: 100.0,
    expectedComp: 89.4,
    expectedGmv: 7118729,
    expectedBuyout: '91.0%',
    expectedWeight: 5200,
    expectedTopKwIncludes: 'опорное колесо для прицепа',
  },
  {
    name: '中控锁',
    category: '汽车配件',
    expectedVerdict: 'WATCH',
    expectedMos: 71.7,
    expectedPfs: 99.0,
    expectedComp: 84.0,
    expectedGmv: 2111743,
    expectedBuyout: '85.0%',
    expectedWeight: 850,
    expectedEac: 'REQUIRED',
    expectedTopKwIncludes: 'центральный замок для автомобиля',
  },
  {
    name: '锯链',
    category: '手动工具及配件',
    expectedVerdict: 'VERIFY',
    expectedMos: 69.4,
    expectedPfs: 100.0,
    expectedComp: 83.2,
    expectedGmv: 12732726,
    expectedBuyout: '93.0%',
    expectedWeight: 220,
    expectedTopKwIncludes: 'цепь для бензопилы',
  },
]

for (const spec of canonicalSpecs) {
  const item = allPoolItems.find((x) => x.name === spec.name)
  assert(item, `验证池中未找到标杆商品: ${spec.name}`)

  // 1. 决策状态对齐
  assert.strictEqual(item.poolCol, spec.expectedVerdict, `${spec.name} 看板分类必须为 ${spec.expectedVerdict}，实际: ${item.poolCol}`)

  // 2. 核心数值对齐
  assert.strictEqual(item.mos, spec.expectedMos, `${spec.name} MOS 不对齐 (实际 ${item.mos} vs 预期 ${spec.expectedMos})`)
  assert.strictEqual(item.cfs, spec.expectedPfs, `${spec.name} PFS 不对齐 (实际 ${item.cfs} vs 预期 ${spec.expectedPfs})`)
  assert.strictEqual(item.comp, spec.expectedComp, `${spec.name} 综合指数不对齐`)
  assert.strictEqual(item.gmv, spec.expectedGmv, `${spec.name} GMV 不对齐`)
  assert.strictEqual(item.buyout, spec.expectedBuyout, `${spec.name} 签收率不对齐`)

  // 3. 物理规格与合规对齐
  if (spec.expectedWeight) {
    assert.strictEqual(item.weight_g, spec.expectedWeight, `${spec.name} 单重不对齐`)
  }
  if (spec.expectedEac) {
    assert(item.eac.includes(spec.expectedEac), `${spec.name} EAC 认证状态不对齐: ${item.eac}`)
  }

  // 4. 核心俄语需求词对齐
  if (spec.expectedTopKwIncludes) {
    assert(
      item.top_russian_queries.includes(spec.expectedTopKwIncludes),
      `${spec.name} 核心俄语搜索词不包含 ${spec.expectedTopKwIncludes}`
    )
  }

  // 5. 与全量 niches_compact.json 对齐
  const compactNiche = niches.find((n) => n.name === spec.name)
  assert(compactNiche, `全量利基表中必须存在 ${spec.name}`)
  assert.strictEqual(compactNiche.mos, spec.expectedMos, `${spec.name} niches_compact MOS 不一致`)
  assert.strictEqual(compactNiche.cfs, spec.expectedPfs, `${spec.name} niches_compact PFS 不一致`)

  console.log(`  ✓ 标杆品「${spec.name}」全部字段 100% 对齐通过:`)
  console.log(`    - 定级建议: ${item.poolCol} | 类目: ${item.category}`)
  console.log(`    - MOS: ${item.mos} | PFS: ${item.cfs} | 综合指数: ${item.comp}`)
  console.log(`    - GMV: ¥${item.gmv.toLocaleString()} | 签收率: ${item.buyout} | 预估重: ${item.weight_g}g`)
  console.log(`    - 核心搜索词: ${item.top_russian_queries.split('|')[0].trim()}`)
}

console.log('\n🎉 [ACCEPTANCE 8 PASS] 5 大标杆单品各维度字段与前期商业分析 100% 对齐无偏差！\n')
