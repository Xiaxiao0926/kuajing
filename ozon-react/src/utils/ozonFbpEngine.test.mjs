/**
 * ozonFbpEngine 单元测试
 * 运行: node --experimental-vm-modules ozon-react/src/utils/ozonFbpEngine.test.mjs
 * 覆盖：费率计算（actual/vol_12000/conditional）、适用性过滤（尺寸/重量/价值/电池/液体/目的国/仓库）、
 *       仓储费 90 天边界、完整利润链复算、汇率 live binding 生效。
 */

import assert from 'node:assert/strict'
import {
  FBP_VERSION, FBP_STORAGE, FBP_DESTINATIONS, FBP_WAREHOUSES,
  ALL_FBP_CHANNELS, filterFbpChannels, calcFbpShipping, calcStorageFee, calcFbpProfit, getBestFbpProfit,
} from './ozonFbpEngine.js'
import { setLiveRubPerCny, rubPerCny } from './ozonEngine.js'
import settingsData from '../generated/settings.js'

let pass = 0, fail = 0
const t = (name, fn) => {
  try { fn(); pass++; console.log(`  ✅ ${name}`) }
  catch (e) { fail++; console.log(`  ❌ ${name}\n     ${e.message}`) }
}

console.log('===== ozonFbpEngine 测试开始 =====')

// ---------- 配置加载 ----------
console.log('\n-- 配置加载 --')
t('配置总量：142 条线路 / 3 目的国 / 11 仓库（+全部）', () => {
  assert.equal(ALL_FBP_CHANNELS.length, 142)
  assert.equal(FBP_DESTINATIONS.length, 3)
  assert.equal(FBP_WAREHOUSES.length, 12)
})
t('版本从 source 动态提取（HK 日期标识）', () => {
  assert.match(FBP_VERSION, /^HK\d+$/)
})
t('仓储参数：90 天免租 / ¥4/m³/天', () => {
  assert.equal(FBP_STORAGE.free_days, 90)
  assert.equal(FBP_STORAGE.rate_cny_per_m3_per_day, 4)
})
t('目的国 = 俄/白俄/哈萨克', () => {
  const codes = FBP_DESTINATIONS.map((d) => d.code).sort()
  assert.deepEqual(codes, ['BY', 'KZ', 'RU'])
})
t('渠道 id 唯一', () => {
  assert.equal(new Set(ALL_FBP_CHANNELS.map((c) => c.id)).size, ALL_FBP_CHANNELS.length)
})

// ---------- calcFbpShipping ----------
console.log('\n-- 运费计算 --')
const celSmallRu = ALL_FBP_CHANNELS.find((c) => c.carrier === 'CEL' && c.destination === 'RU' && c.service_level === 'Standard' && c.scoring_group === 'Small')
const celBigRu = ALL_FBP_CHANNELS.find((c) => c.carrier === 'CEL' && c.destination === 'RU' && c.service_level === 'Standard' && c.scoring_group === 'Big')
const uralSuperOther = ALL_FBP_CHANNELS.find((c) => c.charge_weight === 'conditional')
const uralHk = ALL_FBP_CHANNELS.find((c) => c.carrier === 'Ural HK')
const guooSmallRu = ALL_FBP_CHANNELS.find((c) => c.carrier === 'GUOO' && c.destination === 'RU' && c.scoring_group === 'Small')

t('actual 计费：CEL Standard Small 1000g = 17.97 + 0.0393×1000 = ¥57.27', () => {
  const r = calcFbpShipping(celSmallRu, 3000, 1, 20, 15, 10)
  assert.equal(r.ok, true)
  assert.equal(r.cost, 57.27)
  assert.equal(r.chargeWeightKg, 1)
})
t('vol_12000 计费：CEL Big 实重2.5kg 尺寸50×40×30 → 体积重5kg 取较大值', () => {
  const r = calcFbpShipping(celBigRu, 3000, 2.5, 50, 40, 30)
  assert.equal(r.ok, true)
  assert.equal(r.volumetricWeightKg, 5)
  assert.equal(r.chargeWeightKg, 5)
  assert.equal(r.cost, round2exact(celBigRu.fixed_cny + celBigRu.rate_per_g_cny * 5000))
})
t('conditional 计费：三边和 ≤90cm 用实重', () => {
  const r = calcFbpShipping(uralSuperOther, 3000, 1, 30, 30, 30) // sum=90
  assert.equal(r.ok, true)
  assert.equal(r.chargeWeightKg, 1)
  assert.equal(r.volumetricWeightKg, null)
})
t('conditional 计费：三边和 >90cm 用体积重÷6000', () => {
  const r = calcFbpShipping(uralSuperOther, 3000, 1, 40, 40, 40) // sum=120>90, vol=64000/6000≈10.67kg
  assert.equal(r.ok, true)
  assert.ok(r.volumetricWeightKg > 10)
  assert.equal(r.chargeWeightKg, r.volumetricWeightKg)
})
t('per100g 折算：Ural HK ¥18 + 0.105/g × 1000g = ¥123', () => {
  const r = calcFbpShipping(uralHk, 3000, 1, 20, 15, 10)
  assert.equal(r.ok, true)
  assert.equal(uralHk.rate_per_g_cny, 0.105)
  assert.equal(r.cost, 123)
})

console.log('\n-- 适用性过滤 --')
t('超重拒绝：2.1kg 超出 Small 2000g 上限', () => {
  const r = calcFbpShipping(celSmallRu, 3000, 2.1, 20, 15, 10)
  assert.equal(r.ok, false)
  assert.match(r.reason, /重量超出区间/)
})
t('申报价值拒绝：1500₽ 低于 Small 下限 1501₽', () => {
  const r = calcFbpShipping(celSmallRu, 1500, 1, 20, 15, 10)
  assert.equal(r.ok, false)
  assert.match(r.reason, /申报价值/)
})
t('尺寸拒绝：三边和超限', () => {
  const r = calcFbpShipping(celSmallRu, 3000, 1, 60, 60, 60) // sum=180 > 150
  assert.equal(r.ok, false)
  assert.match(r.reason, /三边和超限/)
})
t('电池过滤：GUOO Small 电池=允许 通过；含液体被拒（液体=禁止）', () => {
  const okBat = calcFbpShipping(guooSmallRu, 3000, 1, 20, 15, 10, { hasBattery: true })
  assert.equal(okBat.ok, true)
  const noLiq = calcFbpShipping(guooSmallRu, 3000, 1, 20, 15, 10, { hasLiquid: true })
  assert.equal(noLiq.ok, false)
  assert.match(noLiq.reason, /禁运液体/)
})
t('MSDS 线路不拦截（提示性质）', () => {
  const r = calcFbpShipping(uralHk, 3000, 1, 20, 15, 10, { hasBattery: true, hasLiquid: true })
  assert.equal(r.ok, true)
})
t('目的国过滤：RU 查询不返回 BY/KZ 线路', () => {
  const ru = filterFbpChannels('RU')
  assert.ok(ru.length > 0)
  assert.ok(ru.every((c) => c.destination === 'RU'))
  assert.equal(ru.length, 70)
})
t('仓库过滤：CEL 珲春仓只剩 CEL 线路', () => {
  const hunchun = FBP_WAREHOUSES.find((w) => w.name === 'CEL Hunchun')
  const list = filterFbpChannels('RU', hunchun.id)
  assert.ok(list.length > 0)
  assert.ok(list.every((c) => c.carrier === 'CEL'))
})

// ---------- calcStorageFee ----------
console.log('\n-- 仓储费 --')
t('89 天免租期内 = ¥0', () => {
  assert.equal(calcStorageFee(50, 40, 30, 89), 0)
})
t('90 天 = ¥0（免租边界含当天）', () => {
  assert.equal(calcStorageFee(50, 40, 30, 90), 0)
})
t('91 天：0.06m³ × 1天 × ¥4 = ¥0.24', () => {
  assert.equal(calcStorageFee(50, 40, 30, 91), 0.24)
})
t('120 天：0.06m³ × 30天 × ¥4 = ¥7.2', () => {
  assert.equal(calcStorageFee(50, 40, 30, 120), 7.2)
})

// ---------- calcFbpProfit ----------
console.log('\n-- 利润链 --')
const baseInputs = { price: 3000, weight: 1, length: 20, width: 15, height: 10, hasBattery: false, hasLiquid: false, stockDays: 90, lastMileRub: 0 }
const baseParams = { purchaseCost: 20, domesticShipping: 3, labelingFee: 2, commission: 12, adRate: 10, paymentFee: 1, agencyFee: 2, returnLoss: 4 }

t('利润链复算：CEL Small 3000₽/1kg/90天', () => {
  const calc = calcFbpProfit(celSmallRu, baseInputs, baseParams)
  assert.equal(calc.ok, true)
  const priceCny = 3000 / rubPerCny
  // 代理费: 3000×2%=60₽, min15 max200 → 60₽
  const agencyRub = 60
  const agencyCny = agencyRub / rubPerCny
  const platform = priceCny * 0.23
  const ret = priceCny * 0.04
  const expected = priceCny - 25 - 57.27 - 0 - 0 - agencyCny - platform - ret
  assert.ok(Math.abs(calc.profit - Math.round(expected * 100) / 100) < 0.02, `profit=${calc.profit} expected≈${expected.toFixed(2)}`)
  assert.equal(calc.costBreakdown.fbpShipping, 57.27)
  assert.equal(calc.costBreakdown.agencyAmtRub, 60)
  assert.equal(calc.costBreakdown.storageFee, 0)
})
t('尾程费入链：lastMileRub=100₽ 折 CNY 扣减', () => {
  const withLm = calcFbpProfit(celSmallRu, { ...baseInputs, lastMileRub: 100 }, baseParams)
  const noLm = calcFbpProfit(celSmallRu, baseInputs, baseParams)
  assert.ok(withLm.profit < noLm.profit)
  assert.ok(Math.abs((noLm.profit - withLm.profit) - 100 / rubPerCny) < 0.02)
})
t('仓租入链：150 天 0.003m³ × 60天 × 4 = ¥0.72', () => {
  const calc = calcFbpProfit(celSmallRu, { ...baseInputs, stockDays: 150 }, baseParams)
  assert.equal(calc.costBreakdown.storageFee, 0.72)
})
t('不可用线路返回原因', () => {
  const calc = calcFbpProfit(celSmallRu, { ...baseInputs, price: 99999 }, baseParams)
  assert.equal(calc.ok, false)
  assert.match(calc.reason, /申报价值/)
})

// ---------- getBestFbpProfit ----------
console.log('\n-- 最优线路 --')
t('RU 全仓：能选出利润最高线路且为可用线路', () => {
  const best = getBestFbpProfit('RU', baseInputs, baseParams)
  assert.ok(best)
  assert.ok(best.calc.ok)
  const allOk = filterFbpChannels('RU')
    .map((c) => calcFbpProfit(c, baseInputs, baseParams))
    .filter((c) => c.ok)
  const maxProfit = Math.max(...allOk.map((c) => c.profit))
  assert.ok(Math.abs(best.calc.profit - maxProfit) < 1e-9)
})
t('含电池商品：最优线路为允许电池的物流商', () => {
  const best = getBestFbpProfit('RU', { ...baseInputs, hasBattery: true }, baseParams)
  assert.ok(best)
  assert.notEqual(best.channel.batteries, 'forbidden')
})

// ---------- 汇率 live binding ----------
console.log('\n-- 汇率 live binding --')
t('setLiveRubPerCny 后 FBP 利润全局生效（禁止改回 const）', () => {
  const before = calcFbpProfit(celSmallRu, baseInputs, baseParams).profit
  const original = rubPerCny
  setLiveRubPerCny(original * 2)
  const after = calcFbpProfit(celSmallRu, baseInputs, baseParams).profit
  setLiveRubPerCny(original)
  assert.notEqual(before, after)
  // 汇率翻倍（₽/¥），同一₽售价折 CNY 减半 → 收入减半，成本以¥计不变 → 利润下降
  assert.ok(after < before, `after=${after} before=${before}`)
})
t('settings 兜底汇率存在且为正', () => {
  assert.ok(settingsData.rub_per_cny > 0)
})

function round2exact(v) { return Math.round(v * 100) / 100 }

console.log(`\n===== 测试结果: ${pass} 通过 / ${fail} 失败 =====`)
if (fail > 0) process.exit(1)
