/**
 * WB跨境核算 - 自动化测试
 * 运行方式: node src/utils/wbEngine.test.mjs
 *
 * 覆盖 12 项测试（依据需求规格说明书第八节）
 */

import {
  toNum, round2, roundUpWeight, selectTariffVersion,
  calculateParcelLogistics, calculateOrderLogistics,
  calculateReverseCompensation, calculateTotalLogisticsCost,
  calculateOperatingProfitV2, inferReverseEventType, getOrderLabels,
} from './wbEngine.js'
import {
  DEFAULT_TARIFFS, DEFAULT_SETTINGS, REVERSE_EVENT_TYPE,
} from './wbConfig.js'

let pass = 0, fail = 0
const assert = (cond, msg) => {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.log(`  ❌ ${msg}`) }
}
const eq = (actual, expected, msg, tol = 0.01) => {
  const ok = Math.abs(actual - expected) <= tol
  assert(ok, `${msg} (期望 ${expected}, 实际 ${actual})`)
}

console.log('\n===== WB跨境核算 测试开始 =====\n')

// 获取当前0726版本DPX费率
const dpxTariff = DEFAULT_TARIFFS.find(t => t.routeId === 'DPX-SZ-382822' && t.effectiveFrom === '2026-07-22')
const settings = { ...DEFAULT_SETTINGS, rubPerCny: 12 }

// 通用500g订单
const baseOrder500g = {
  sellerRevenueBaseRub: 1000,
  commissionRate: 25,
  estimatedForwardLogisticsCny: 29.50, // 0.5×43+8
  parcels: [{ actualWeightG: 500 }],
}

// ============ 测试1: 500g正常签收 ============
console.log('测试1: 500g正常签收，物流费¥29.50')
{
  const calc = calculateParcelLogistics(500, dpxTariff)
  eq(calc.feeCny, 29.50, '500g正向CSG = 29.50')
  const order = { ...baseOrder500g, reverseEventType: REVERSE_EVENT_TYPE.NONE, forwardFeeApplied: true }
  const total = calculateTotalLogisticsCost(order, dpxTariff)
  eq(total.totalLogisticsCostCny, 29.50, '正常签收物流总成本 = 29.50')
  eq(total.multiplier, 0, '正常签收倍数 = 0')
  eq(total.estimatedReverseCompensationCny, 0, '正常签收反向赔偿 = 0')
}

// ============ 测试2: 500g进入物流后未出中国即退回 ============
console.log('\n测试2: 500g进入物流后未出中国即退回，预计赔偿¥29.50')
{
  const order = {
    ...baseOrder500g,
    reverseEventType: REVERSE_EVENT_TYPE.NOT_EXPORTED_FROM_CHINA,
    // 默认 forwardFeeApplied=true, 但此场景forward默认按0处理避免重复
    forwardFeeApplied: false,
  }
  const total = calculateTotalLogisticsCost(order, dpxTariff)
  eq(total.multiplier, 1, '未出中国倍数 = 1')
  eq(total.csgTotalCny, 29.50, 'CSG基数 = 29.50')
  eq(total.estimatedReverseCompensationCny, 29.50, '预计反向赔偿 = 29.50')
  eq(total.forwardLogisticsUsedCny, 0, '正向使用值默认0')
  eq(total.totalLogisticsCostCny, 29.50, '物流总成本 = 29.50')
}

// ============ 测试3: 500g买家退货 ============
console.log('\n测试3: 500g买家退货，正向¥29.50+赔偿¥29.50=¥59.00')
{
  const order = {
    ...baseOrder500g,
    reverseEventType: REVERSE_EVENT_TYPE.BUYER_RETURNED,
    forwardFeeApplied: true,
  }
  const total = calculateTotalLogisticsCost(order, dpxTariff)
  eq(total.multiplier, 1, '买家退货倍数 = 1')
  eq(total.estimatedReverseCompensationCny, 29.50, '反向赔偿 = 29.50')
  eq(total.forwardLogisticsUsedCny, 29.50, '正向使用值 = 29.50')
  eq(total.totalLogisticsCostCny, 59.00, '物流总成本 = 59.00')
}

// ============ 测试4: 500g清关失败退回中国 ============
console.log('\n测试4: 500g清关失败退回中国，默认总风险¥59.00，不得自动算为¥88.50')
{
  const order = {
    ...baseOrder500g,
    reverseEventType: REVERSE_EVENT_TYPE.CUSTOMS_FAILED,
    forwardFeeApplied: false, // 默认0，避免3×CSG
  }
  const total = calculateTotalLogisticsCost(order, dpxTariff)
  eq(total.multiplier, 2, '清关失败倍数 = 2')
  eq(total.estimatedReverseCompensationCny, 59.00, '反向赔偿 = 2×29.50 = 59.00')
  eq(total.totalLogisticsCostCny, 59.00, '物流总成本 = 59.00 (不得为88.50)')
  assert(total.totalLogisticsCostCny !== 88.50, '不得自动计算为88.50')
}

// ============ 测试5: 交仓前取消 ============
console.log('\n测试5: 交仓前取消，正向费和赔偿均为0')
{
  const order = {
    ...baseOrder500g,
    reverseEventType: REVERSE_EVENT_TYPE.CANCELLED_BEFORE_HANDOVER,
    forwardFeeApplied: false,
  }
  const total = calculateTotalLogisticsCost(order, dpxTariff)
  eq(total.multiplier, 0, '交仓前取消倍数 = 0')
  eq(total.forwardLogisticsUsedCny, 0, '正向使用值 = 0')
  eq(total.estimatedReverseCompensationCny, 0, '反向赔偿 = 0')
  eq(total.totalLogisticsCostCny, 0, '物流总成本 = 0')
}

// ============ 测试6: 拒收/未领取默认按一倍测算 ============
console.log('\n测试6: 拒收/未领取默认按一倍赔偿测算，标记待账单确认')
{
  const order = {
    ...baseOrder500g,
    reverseEventType: REVERSE_EVENT_TYPE.REFUSED_OR_UNCLAIMED,
    forwardFeeApplied: true,
  }
  const total = calculateTotalLogisticsCost(order, dpxTariff)
  eq(total.multiplier, 1, '拒收倍数 = 1')
  eq(total.estimatedReverseCompensationCny, 29.50, '反向赔偿 = 29.50')
  eq(total.totalLogisticsCostCny, 59.00, '物流总成本 = 59.00')
  assert(total.needsBillConfirmation === true, '需标记"待账单确认"')
}

// ============ 测试7: buyer_to_ru_warehouse_reverse_included=true时一倍赔偿仍计算 ============
console.log('\n测试7: buyer_to_ru_warehouse_reverse_included=true时买家退货一倍赔偿仍正常计算')
{
  // tariff 中已设置 buyerToRuWarehouseReverseIncluded: true
  assert(dpxTariff.buyerToRuWarehouseReverseIncluded === true, 'DPX费率已包含俄仓反向运输')
  const order = {
    ...baseOrder500g,
    reverseEventType: REVERSE_EVENT_TYPE.BUYER_RETURNED,
    forwardFeeApplied: true,
  }
  const total = calculateTotalLogisticsCost(order, dpxTariff)
  eq(total.multiplier, 1, '即使included=true，倍数仍=1')
  eq(total.estimatedReverseCompensationCny, 29.50, '反向赔偿仍=29.50')
  eq(total.totalLogisticsCostCny, 59.00, '物流总成本仍=59.00')
}

// ============ 测试8: 买家退货不得叠加俄罗斯境内8+2体积运费 ============
console.log('\n测试8: 买家退货不得叠加俄罗斯境内8+2体积运费')
{
  const order = {
    ...baseOrder500g,
    reverseEventType: REVERSE_EVENT_TYPE.BUYER_RETURNED,
    forwardFeeApplied: true,
    otherReverseCostCny: 0, // 不主动增加退回中国费
  }
  const total = calculateTotalLogisticsCost(order, dpxTariff)
  // 总成本 = 29.50 + 29.50 + 0 = 59.00，不应有8+2额外费用
  eq(total.totalLogisticsCostCny, 59.00, '总成本=59.00，无8+2叠加')
  // 验证不存在额外体积运费
  const hasExtraFee = total.steps.some(s => s.includes('8') && s.includes('2') && s.includes('体积'))
  assert(!hasExtraFee, 'steps中无8+2体积运费记录')
}

// ============ 测试9: 实际账单值覆盖预计值 ============
console.log('\n测试9: 实际账单值存在时覆盖预计值，但预计值和差异仍保留')
{
  const order = {
    ...baseOrder500g,
    reverseEventType: REVERSE_EVENT_TYPE.BUYER_RETURNED,
    forwardFeeApplied: true,
    actualForwardLogisticsCny: 30.00, // 实际正向比预计多0.50
    actualReverseCompensationCny: 28.00, // 实际反向比预计少1.50
  }
  const total = calculateTotalLogisticsCost(order, dpxTariff)
  eq(total.estimatedForwardLogisticsCny, 29.50, '预计正向仍保留=29.50')
  eq(total.actualForwardLogisticsCny, 30.00, '实际正向=30.00')
  eq(total.forwardLogisticsUsedCny, 30.00, '使用实际值30.00')
  eq(total.estimatedReverseCompensationCny, 29.50, '预计反向仍保留=29.50')
  eq(total.actualReverseCompensationCny, 28.00, '实际反向=28.00')
  eq(total.reverseCompensationUsedCny, 28.00, '使用实际值28.00')
  assert(total.calculationBasis === 'actual', `计算依据=actual (实际 ${total.calculationBasis})`)
  // 差异 = 实际总额 - 预计总额 = (30+28) - (29.50+29.50) = -1.00
  eq(total.varianceCny, -1.00, '差异=-1.00')
}

// ============ 测试10: 多包裹订单分别计算CSG和赔偿 ============
console.log('\n测试10: 多包裹订单分别计算CSG和赔偿')
{
  // 2个270g包裹
  const order = {
    ...baseOrder500g,
    parcels: [{ actualWeightG: 270 }, { actualWeightG: 270 }],
    reverseEventType: REVERSE_EVENT_TYPE.BUYER_RETURNED,
    forwardFeeApplied: true,
    // 重置 estimatedForwardLogisticsCny，让 parcel CSG 独立计算
    estimatedForwardLogisticsCny: 0,
  }
  // 每个包裹: 270g→300g→0.3kg→0.3×58+2=19.40
  // CSG合计 = 19.40×2 = 38.80
  // 反向赔偿 = 38.80×1 = 38.80
  // 总成本 = 38.80 + 38.80 = 77.60
  const total = calculateTotalLogisticsCost(order, dpxTariff)
  eq(total.parcelDetails.length, 2, '2个包裹独立计算')
  eq(total.parcelDetails[0].csgCny, 19.40, '包裹1 CSG=19.40')
  eq(total.parcelDetails[1].csgCny, 19.40, '包裹2 CSG=19.40')
  eq(total.csgTotalCny, 38.80, 'CSG合计=38.80')
  eq(total.estimatedReverseCompensationCny, 38.80, '反向赔偿=38.80')
  eq(total.totalLogisticsCostCny, 77.60, '物流总成本=77.60')
}

// ============ 测试11: 历史订单使用原费率版本 ============
console.log('\n测试11: 2026-07-22前历史订单用原费率，7-22及之后用0726版本')
{
  const oldOrder = { orderDate: '2026-05-01', routeId: 'DPX-SZ-382822' }
  const newOrder = { orderDate: '2026-08-01', routeId: 'DPX-SZ-382822' }
  const oldTariff = selectTariffVersion('DPX-SZ-382822', '2026-05-01', DEFAULT_TARIFFS)
  const newTariff = selectTariffVersion('DPX-SZ-382822', '2026-08-01', DEFAULT_TARIFFS)
  assert(oldTariff !== null, '历史订单找到费率')
  assert(newTariff !== null, '新订单找到费率')
  assert(oldTariff.effectiveFrom === '2026-02-09', `5月订单使用2026-02-09版本 (实际 ${oldTariff.effectiveFrom})`)
  assert(newTariff.effectiveFrom === '2026-07-22', `8月订单使用2026-07-22版本 (实际 ${newTariff.effectiveFrom})`)
  // 边界：7-21用旧，7-22用新
  const boundary1 = selectTariffVersion('DPX-SZ-382822', '2026-07-21', DEFAULT_TARIFFS)
  const boundary2 = selectTariffVersion('DPX-SZ-382822', '2026-07-22', DEFAULT_TARIFFS)
  assert(boundary1.effectiveFrom === '2026-02-09', `7-21用旧版本 (实际 ${boundary1.effectiveFrom})`)
  assert(boundary2.effectiveFrom === '2026-07-22', `7-22用新版本 (实际 ${boundary2.effectiveFrom})`)
}

// ============ 测试12: 更新后正常订单无回归 ============
console.log('\n测试12: 更新后正常订单利润计算无回归')
{
  const sku = {
    purchaseCostCny: 10,
    packagingCostCny: 1,
    chinaInboundCostCny: 2,
    certificationAllocationCny: 0,
  }
  const order = {
    sellerRevenueBaseRub: 1200, // 1200₽ / 12 = 100¥
    commissionRate: 25,
    promotionCostRub: 0,
    acquiringFeeRub: 0,
    platformOtherDeductionRub: 0,
    otherOperatingCostCny: 0,
    taxCostCny: 0,
    reverseEventType: REVERSE_EVENT_TYPE.NONE,
    forwardFeeApplied: true,
    estimatedForwardLogisticsCny: 29.50,
    parcels: [{ actualWeightG: 500 }],
  }
  const result = calculateOperatingProfitV2(order, sku, settings, dpxTariff)
  // 销售收入 = 1200/12 = 100
  // 佣金 = 1200×25%/12 = 25
  // 物流总成本 = 29.50
  // 平台净结算 = 100 - 25 - 29.50 = 45.50
  // 经营利润 = 45.50 - 10 - 1 - 2 = 32.50
  eq(result.salesRevenueCny, 100, '销售收入=100')
  eq(result.commissionCny, 25, '佣金=25')
  eq(result.totalLogisticsCostCny, 29.50, '物流总成本=29.50')
  eq(result.platformNetSettlementCny, 45.50, '平台净结算=45.50')
  eq(result.operatingProfitCny, 32.50, '经营利润=32.50')
  eq(result.profitMargin, 32.5, '利润率=32.5%')
}

// ============ 附加：重量跳档测试 ============
console.log('\n附加测试: 重量跳档')
{
  const r1 = calculateParcelLogistics(300, dpxTariff)
  const r2 = calculateParcelLogistics(301, dpxTariff)
  eq(r1.feeCny, 19.40, '300g=19.40')
  eq(r2.feeCny, 25.20, '301g=25.20')
  eq(r2.feeCny - r1.feeCny, 5.80, '跳档差价=5.80')
}

// ============ 附加：订单标签 ============
console.log('\n附加测试: 订单标签')
{
  const labels1 = getOrderLabels({ status: '已签收', reverseEventType: 'none' }, { multiplier: 0, eventType: 'none' })
  assert(labels1.some(l => l.text === '正常签收'), '正常签收标签')

  const labels2 = getOrderLabels({ reverseEventType: 'buyer_returned' }, { multiplier: 1, eventType: 'buyer_returned' })
  assert(labels2.some(l => l.text === '一倍赔偿'), '一倍赔偿标签')

  const labels3 = getOrderLabels({ reverseEventType: 'customs_failed_returned_to_china' }, { multiplier: 2, eventType: 'customs_failed_returned_to_china' })
  assert(labels3.some(l => l.text === '两倍赔偿'), '两倍赔偿标签')

  const labels4 = getOrderLabels({ reverseEventType: 'refused_or_unclaimed' }, { multiplier: 1, eventType: 'refused_or_unclaimed', needsBillConfirmation: true })
  assert(labels4.some(l => l.text === '待账单确认'), '待账单确认标签')

  const labels5 = getOrderLabels({}, { calculationBasis: 'actual', varianceCny: 5.00, multiplier: 1, eventType: 'buyer_returned' })
  assert(labels5.some(l => l.text === '预计与实扣不一致'), '预计与实扣不一致标签')
}

console.log(`\n===== 测试结果: ${pass} 通过 / ${fail} 失败 =====\n`)
if (fail > 0) process.exit(1)
