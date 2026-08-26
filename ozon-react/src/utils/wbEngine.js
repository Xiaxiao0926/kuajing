/**
 * WB跨境核算 - 计算引擎
 * 独立纯函数，使用字符串/数字运算避免浮点误差，结果统一round2。
 * 依据《WB跨境利润与物流费用核算面板-需求规格说明书》第4、6节
 */

import {
  REVERSE_EVENT_TYPE, DEFAULT_REVERSE_MULTIPLIER, REVERSE_EVENT_LABEL, NEEDS_BILL_CONFIRMATION,
} from './wbConfig.js'

export const toNum = (v) => {
  if (v === null || v === undefined || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export const round2 = (n) => {
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100) / 100
}

export const round4 = (n) => {
  if (!Number.isFinite(n)) return null
  return Math.round(n * 10000) / 10000
}

/**
 * 实际重量按step向上取整
 * 例: 101g, step=100 -> 200g
 */
export const roundUpWeight = (actualWeightG, stepG) => {
  const aw = toNum(actualWeightG)
  const step = toNum(stepG)
  if (step <= 0) return aw
  return Math.ceil(aw / step) * step
}

/**
 * 根据线路ID和订单日期选择当日有效的费率版本
 * 历史订单保留原费率，不因新费率覆盖
 */
export const selectTariffVersion = (routeId, orderDateStr, tariffs) => {
  if (!orderDateStr) return null
  const orderDate = typeof orderDateStr === 'string' ? orderDateStr.slice(0, 10) : ''
  if (!orderDate) return null

  const candidates = (tariffs || []).filter((t) => {
    if (t.routeId !== routeId) return false
    if (t.active === false) return false
    const effFrom = t.effectiveFrom ? String(t.effectiveFrom).slice(0, 10) : null
    const effTo = t.effectiveTo ? String(t.effectiveTo).slice(0, 10) : null
    if (effFrom && orderDate < effFrom) return false
    if (effTo && orderDate > effTo) return false
    return true
  })
  if (candidates.length === 0) return null
  // 取生效日期最新
  candidates.sort((a, b) => String(b.effectiveFrom || '').localeCompare(String(a.effectiveFrom || '')))
  return candidates[0]
}

/**
 * 选择命中的费率区间
 */
export const selectTariffTier = (tariff, billableWeightKg) => {
  const bw = toNum(billableWeightKg)
  const tiers = tariff?.tiers || []
  for (const tier of tiers) {
    const minW = toNum(tier.minWeightKg)
    const maxW = toNum(tier.maxWeightKg)
    if (minW <= bw && bw <= maxW) return tier
  }
  return null
}

/**
 * 校验包裹尺寸和重量是否符合线路限制
 */
export const validateParcel = (parcel, tariff) => {
  const messages = []
  let status = 'pass'

  const actualWeightG = toNum(parcel?.actualWeightG)
  const length = toNum(parcel?.lengthCm)
  const width = toNum(parcel?.widthCm)
  const height = toNum(parcel?.heightCm)

  // 重量校验
  if (actualWeightG <= 0) {
    messages.push('实际重量为空或≤0')
    status = 'error'
  } else {
    const maxWeightG = toNum(tariff?.maxWeightKg) * 1000
    if (maxWeightG > 0 && actualWeightG > maxWeightG) {
      messages.push(`实际重量${actualWeightG}g超过线路最大重量${maxWeightG}g`)
      status = 'error'
    }
  }

  // 尺寸校验
  const sumDim = length + width + height
  const maxSum = toNum(tariff?.maxSumDimensionsCm)
  if (maxSum > 0 && sumDim > maxSum) {
    messages.push(`三边之和${sumDim}cm超过线路限制${maxSum}cm`)
    status = 'error'
  }
  const maxSide = toNum(tariff?.maxSingleSideCm)
  if (maxSide > 0) {
    const sides = [['长', length], ['宽', width], ['高', height]]
    for (const [name, val] of sides) {
      if (val > maxSide) {
        messages.push(`${name}${val}cm超过单边限制${maxSide}cm`)
        status = 'error'
      }
    }
  }

  // 重量跳档预警
  if (actualWeightG >= 291 && actualWeightG <= 300) {
    messages.push('当前重量处于291-300g区间，再增加1g将进入0.4kg档，运费跳跃¥5.80')
    if (status === 'pass') status = 'warning'
  } else if (actualWeightG >= 91 && actualWeightG <= 100) {
    messages.push('当前重量处于91-100g区间，再增加1g将进入下一档')
    if (status === 'pass') status = 'warning'
  } else if (actualWeightG >= 191 && actualWeightG <= 200) {
    messages.push('当前重量处于191-200g区间，再增加1g将进入下一档')
    if (status === 'pass') status = 'warning'
  }

  return { valid: status !== 'error', messages, status }
}

/**
 * 单包裹物流费用计算
 */
export const calculateParcelLogistics = (actualWeightG, tariff) => {
  const validation = validateParcel({ actualWeightG }, tariff)
  if (!validation.valid) {
    return {
      actualWeightG,
      billableWeightG: null,
      billableWeightKg: null,
      tier: null,
      feeCny: null,
      steps: ['校验失败: ' + validation.messages.join('; ')],
      validation,
    }
  }

  const aw = toNum(actualWeightG)
  const stepG = toNum(tariff?.weightRoundingG || 100)
  const billableWeightG = roundUpWeight(aw, stepG)
  const billableWeightKg = billableWeightG / 1000
  const maxWeightKg = toNum(tariff?.maxWeightKg || 20)

  if (billableWeightKg > maxWeightKg) {
    return {
      actualWeightG: aw,
      billableWeightG,
      billableWeightKg,
      tier: null,
      feeCny: null,
      steps: [`计费重量${billableWeightKg}kg超过最大重量${maxWeightKg}kg`],
      validation: { valid: false, messages: ['超过最大重量'], status: 'error' },
    }
  }

  const tier = selectTariffTier(tariff, billableWeightKg)
  if (!tier) {
    return {
      actualWeightG: aw,
      billableWeightG,
      billableWeightKg,
      tier: null,
      feeCny: null,
      steps: [`计费重量${billableWeightKg}kg找不到适用费率区间`],
      validation: { valid: false, messages: ['无适用费率区间'], status: 'error' },
    }
  }

  const kgRate = toNum(tier.kgRateCny)
  const fixedFee = toNum(tier.fixedFeeCny)
  const fee = round2(billableWeightKg * kgRate + fixedFee)

  const steps = [
    `实际重量${aw}g`,
    `按${stepG}g向上取整为${billableWeightG}g`,
    `计费重量 = ${billableWeightG}g / 1000 = ${billableWeightKg}kg`,
    `命中区间: ${tier.minWeightKg}-${tier.maxWeightKg}kg, 费率${kgRate}元/kg + 固定费${fixedFee}元`,
    `物流费 = ${billableWeightKg} × ${kgRate} + ${fixedFee} = ${fee}元`,
  ]

  return {
    actualWeightG: aw,
    billableWeightG,
    billableWeightKg,
    tier,
    feeCny: fee,
    steps,
    validation,
  }
}

/**
 * 多包裹订单物流费
 * 每个包裹独立取整、独立计费
 */
export const calculateOrderLogistics = (parcels, tariff) => {
  if (!parcels || parcels.length === 0) {
    return { parcelCount: 0, totalFeeCny: 0, parcels: [], steps: ['无包裹'] }
  }
  const results = []
  let total = 0
  parcels.forEach((p, i) => {
    const calc = calculateParcelLogistics(p?.actualWeightG || 0, tariff)
    calc.parcelIndex = i + 1
    if (calc.feeCny !== null && calc.feeCny !== undefined) total += calc.feeCny
    results.push(calc)
  })
  return {
    parcelCount: parcels.length,
    totalFeeCny: round2(total),
    parcels: results,
    steps: [`共${parcels.length}个包裹，每个独立取整计费，合计${round2(total)}元`],
  }
}

/**
 * 平台结算预估
 */
const calculatePlatformSettlementRaw = (order, settings) => {
  const rubPerCny = toNum(settings?.rubPerCny)
  if (rubPerCny <= 0) {
    return { error: '汇率为0或空，无法转换' }
  }

  const sellerRevenueBaseRub = toNum(order?.sellerRevenueBaseRub)
  const commissionBaseRub = toNum(order?.commissionBaseRub ?? order?.sellerRevenueBaseRub)
  const commissionRate = toNum(order?.commissionRate)
  const acquiringFeeRub = toNum(order?.acquiringFeeRub)
  const promotionCostRub = toNum(order?.promotionCostRub)
  const platformOtherRub = toNum(order?.platformOtherDeductionRub)
  const orderLogisticsCny = toNum(order?.orderLogisticsCny)

  const salesRevenueCny = sellerRevenueBaseRub / rubPerCny
  const commissionCny = (commissionBaseRub * commissionRate) / 100 / rubPerCny
  const acquiringFeeCny = acquiringFeeRub / rubPerCny
  const promotionCostCny = promotionCostRub / rubPerCny
  const platformOtherCny = platformOtherRub / rubPerCny
  const platformNetSettlementCny = salesRevenueCny - commissionCny - orderLogisticsCny - acquiringFeeCny - promotionCostCny - platformOtherCny

  return {
    rubPerCny,
    sellerRevenueBaseRub,
    commissionBaseRub,
    commissionRate,
    acquiringFeeRub,
    promotionCostRub,
    platformOtherRub,
    orderLogisticsCny,
    salesRevenueCny,
    commissionCny,
    acquiringFeeCny,
    promotionCostCny,
    platformOtherCny,
    platformNetSettlementCny,
  }
}

const formatPlatformSettlement = (raw) => {
  if (raw.error) {
    return {
      error: raw.error,
      salesRevenueCny: null,
      commissionCny: null,
      platformNetSettlementCny: null,
      steps: [raw.error],
    }
  }

  const salesRevenueCny = round2(raw.salesRevenueCny)
  const commissionCny = round2(raw.commissionCny)
  const acquiringFeeCny = round2(raw.acquiringFeeCny)
  const promotionCostCny = round2(raw.promotionCostCny)
  const platformOtherCny = round2(raw.platformOtherCny)
  const net = round2(raw.platformNetSettlementCny)

  const steps = [
    `卖家收入基数: ${raw.sellerRevenueBaseRub}₽ / ${raw.rubPerCny} = ${salesRevenueCny}¥`,
    `佣金: ${raw.commissionBaseRub}₽ × ${raw.commissionRate}% / ${raw.rubPerCny} = ${commissionCny}¥`,
    `物流费: ${raw.orderLogisticsCny}¥`,
    `支付费: ${raw.acquiringFeeRub}₽ / ${raw.rubPerCny} = ${acquiringFeeCny}¥`,
    `促销费: ${raw.promotionCostRub}₽ / ${raw.rubPerCny} = ${promotionCostCny}¥`,
    `其他扣款: ${raw.platformOtherRub}₽ / ${raw.rubPerCny} = ${platformOtherCny}¥`,
    `平台净结算（内部全精度计算）= ${net}¥`,
  ]

  return {
    salesRevenueCny,
    commissionCny,
    acquiringFeeCny,
    promotionCostCny,
    platformOtherCny,
    platformNetSettlementCny: net,
    steps,
  }
}

export const calculatePlatformSettlement = (order, settings) => formatPlatformSettlement(
  calculatePlatformSettlementRaw(order, settings),
)

/**
 * 单订单经营利润
 */
export const calculateOperatingProfit = (order, sku, settings, logisticsCny) => {
  const settlementRaw = calculatePlatformSettlementRaw(
    { ...order, orderLogisticsCny: logisticsCny },
    settings
  )
  const settlement = formatPlatformSettlement(settlementRaw)
  if (settlement.platformNetSettlementCny === null) {
    return { ...settlement, operatingProfitCny: null }
  }

  const netRaw = settlementRaw.platformNetSettlementCny
  const salesRevenueRaw = settlementRaw.salesRevenueCny
  const purchaseCost = toNum(sku?.purchaseCostCny)
  const packagingCost = toNum(sku?.packagingCostCny)
  const chinaInbound = toNum(sku?.chinaInboundCostCny)
  const certification = toNum(sku?.certificationAllocationCny)
  const otherOperating = toNum(order?.otherOperatingCostCny)

  // 税费
  let taxCostRaw = 0
  const taxMethod = settings?.taxMethod || 'none'
  const taxRate = toNum(settings?.taxRate)
  if (taxMethod === 'revenue' && salesRevenueRaw !== null) {
    taxCostRaw = (salesRevenueRaw * taxRate) / 100
  } else if (taxMethod === 'settlement') {
    taxCostRaw = (netRaw * taxRate) / 100
  } else if (taxMethod === 'manual') {
    taxCostRaw = toNum(order?.taxCostCny)
  }

  const profitRaw = netRaw - purchaseCost - packagingCost - chinaInbound - certification - taxCostRaw - otherOperating
  const taxCost = round2(taxCostRaw)
  const profit = round2(profitRaw)
  const profitMargin = salesRevenueRaw > 0 ? round2((profitRaw / salesRevenueRaw) * 100) : null
  const logisticsRatio = salesRevenueRaw > 0 ? round2((toNum(logisticsCny) / salesRevenueRaw) * 100) : null
  const costTotal = purchaseCost + packagingCost + chinaInbound + toNum(logisticsCny) + settlementRaw.promotionCostCny
  const costRoi = costTotal > 0 ? round2((profitRaw / costTotal) * 100) : null

  const steps = [
    ...settlement.steps,
    `采购成本: ${purchaseCost}¥`,
    `包装成本: ${packagingCost}¥`,
    `国内送仓: ${chinaInbound}¥`,
    `认证分摊: ${certification}¥`,
    `税费(${taxMethod}): ${taxCost}¥`,
    `其他成本: ${otherOperating}¥`,
    `经营利润（内部全精度计算）= ${profit}¥`,
    profitMargin !== null ? `利润率 = ${profit} / ${settlement.salesRevenueCny} = ${profitMargin}%` : '利润率: 不可计算',
    logisticsRatio !== null ? `物流费率 = ${logisticsCny} / ${settlement.salesRevenueCny} = ${logisticsRatio}%` : '物流费率: 不可计算',
  ]

  return {
    ...settlement,
    purchaseCostCny: purchaseCost,
    packagingCostCny: packagingCost,
    chinaInboundCostCny: chinaInbound,
    certificationAllocationCny: certification,
    taxCostCny: taxCost,
    otherOperatingCostCny: otherOperating,
    operatingProfitCny: profit,
    profitMargin,
    logisticsRatio,
    costRoi,
    steps,
  }
}

/**
 * 线路对比
 */
export const compareRoutes = (parcel, routes) => {
  const results = []
  const validFees = []
  for (const tariff of routes) {
    const validation = validateParcel(parcel, tariff)
    if (!validation.valid) {
      results.push({
        tariff,
        feeCny: null,
        etaMinDays: tariff.etaMinDays,
        etaMaxDays: tariff.etaMaxDays,
        valid: false,
        messages: validation.messages,
      })
      continue
    }
    const calc = calculateParcelLogistics(parcel?.actualWeightG || 0, tariff)
    results.push({
      tariff,
      feeCny: calc.feeCny,
      billableWeightKg: calc.billableWeightKg,
      etaMinDays: tariff.etaMinDays,
      etaMaxDays: tariff.etaMaxDays,
      valid: true,
      messages: validation.messages,
    })
    if (calc.feeCny !== null && calc.feeCny !== undefined) validFees.push(calc.feeCny)
  }
  const minFee = validFees.length > 0 ? Math.min(...validFees) : null
  for (const r of results) {
    r.diffToMin = r.feeCny !== null && r.feeCny !== undefined && minFee !== null ? round2(r.feeCny - minFee) : null
  }
  return results
}

/**
 * 签收后退货损益（旧版，保留向后兼容）
 * V2推荐使用 calculateReverseCompensation + calculateTotalLogisticsCost
 */
export const calculateReturnLoss = (order, sku, forwardLogisticsCny, settings) => {
  const purchaseCost = toNum(sku?.purchaseCostCny)
  const packagingCost = toNum(sku?.packagingCostCny)
  const chinaInbound = toNum(sku?.chinaInboundCostCny)
  const recoveryRate = toNum(order?.inventoryRecoveryRate) // 0-100
  const returnToChina = toNum(order?.returnToChinaOrDisposalCostCny)
  const nonRefundedCommission = toNum(order?.nonRefundedCommissionCny)
  const otherFailure = toNum(order?.otherFailureCostCny)
  const forwardLogistics = toNum(forwardLogisticsCny)

  const inventoryLoss = round2((purchaseCost * (100 - recoveryRate)) / 100)
  const totalLoss = round2(
    forwardLogistics + packagingCost + chinaInbound + nonRefundedCommission + returnToChina + inventoryLoss + otherFailure
  )

  const steps = [
    `正向物流费: ${forwardLogisticsCny}¥`,
    `包装成本: ${packagingCost}¥`,
    `国内送仓: ${chinaInbound}¥`,
    `不可退佣金: ${nonRefundedCommission}¥`,
    `退回/销毁成本: ${returnToChina}¥`,
    `库存损失 = 采购成本${purchaseCost} × (100% - 回收率${recoveryRate}%) = ${inventoryLoss}¥`,
    `其他失败成本: ${otherFailure}¥`,
    `退货总损失 = ${totalLoss}¥`,
  ]

  return { inventoryLossCny: inventoryLoss, failedOrderLossCny: totalLoss, steps }
}

// ============================================================
// V2: 反向配送赔偿计算（WB服务条款13.1.14）
// ============================================================

/**
 * 根据订单状态推断反向事件类型
 * 兼容旧订单（仅设置status字段）
 */
export const inferReverseEventType = (order) => {
  // 优先使用显式指定的 reverseEventType
  if (order?.reverseEventType) return order.reverseEventType

  const status = order?.status || ''
  switch (status) {
    case '已签收':
      return REVERSE_EVENT_TYPE.NONE
    case '发货前取消':
      return REVERSE_EVENT_TYPE.CANCELLED_BEFORE_HANDOVER
    case '买家拒收':
    case '超期未领取':
      return REVERSE_EVENT_TYPE.REFUSED_OR_UNCLAIMED
    case '签收后退货':
      return REVERSE_EVENT_TYPE.BUYER_RETURNED
    case '丢失/破损':
      return REVERSE_EVENT_TYPE.MANUAL
    default:
      return REVERSE_EVENT_TYPE.NONE
  }
}

/**
 * 计算反向配送赔偿金额
 *
 * 依据WB服务条款13.1.14：
 * - 未运出中国或买家退货：1×CSG
 * - 清关失败退回中国：2×CSG
 * - 拒收/未领取：暂按1×CSG，标记待账单确认
 * - 交仓前取消：0
 *
 * 赔偿基数 = 平台公布的正常跨境配送服务费(CSG)
 * 不叠加俄罗斯境内8+2体积运费
 *
 * @param {object} order 订单（含 reverseEventType, reverseCompensationMultiplier, parcels 等）
 * @param {object} tariff 适用的费率版本
 * @returns {object} 反向赔偿计算结果
 */
export const calculateReverseCompensation = (order, tariff) => {
  const eventType = inferReverseEventType(order)
  const label = REVERSE_EVENT_LABEL[eventType] || '未知'
  const needsBillConfirmation = NEEDS_BILL_CONFIRMATION[eventType] || false

  // 赔偿倍数：order显式 > 默认表
  const multiplier = order?.reverseCompensationMultiplier !== null &&
                     order?.reverseCompensationMultiplier !== undefined &&
                     order?.reverseCompensationMultiplier !== ''
    ? toNum(order.reverseCompensationMultiplier)
    : toNum(DEFAULT_REVERSE_MULTIPLIER[eventType] ?? 0)

  // 实际账单值（如果存在则优先使用）
  const actualReverseCompensation = order?.actualReverseCompensationCny !== null &&
                                     order?.actualReverseCompensationCny !== undefined &&
                                     order?.actualReverseCompensationCny !== ''
    ? toNum(order.actualReverseCompensationCny)
    : null

  // 多包裹时每个独立计算CSG
  const parcels = order?.parcels || []
  let csgTotal = 0
  const parcelDetails = []

  if (parcels.length > 0) {
    parcels.forEach((p, i) => {
      const calc = calculateParcelLogistics(p?.actualWeightG || 0, tariff)
      csgTotal += calc.feeCny || 0
      parcelDetails.push({
        parcelIndex: i + 1,
        actualWeightG: p?.actualWeightG || 0,
        billableWeightKg: calc.billableWeightKg,
        csgCny: calc.feeCny,
        steps: calc.steps,
      })
    })
  } else {
    // 没有包裹信息时使用 estimatedForwardLogisticsCny 作为CSG基数
    csgTotal = toNum(order?.estimatedForwardLogisticsCny)
  }

  // 预计反向赔偿 = CSG × 倍数
  const estimatedReverseCompensation = round2(csgTotal * multiplier)

  // 最终使用值：实际账单优先，否则用预计值
  const reverseCompensationUsed = actualReverseCompensation !== null ? actualReverseCompensation : estimatedReverseCompensation

  const steps = [
    `反向事件类型: ${label} (${eventType})`,
    `赔偿倍数: ${multiplier}× (依据WB服务条款13.1.14)`,
    parcels.length > 0
      ? `平台公布配送费(CSG): ${parcels.length}个包裹独立计算，合计 ${round2(csgTotal)}¥`
      : `平台公布配送费(CSG): ${round2(csgTotal)}¥ (从forward_logistics字段读取)`,
    `预计反向赔偿 = CSG × ${multiplier} = ${estimatedReverseCompensation}¥`,
  ]
  if (actualReverseCompensation !== null) {
    steps.push(`实际账单反向赔偿: ${actualReverseCompensation}¥ (优先使用实际值)`)
    steps.push(`差异 = ${actualReverseCompensation} - ${estimatedReverseCompensation} = ${round2(actualReverseCompensation - estimatedReverseCompensation)}¥`)
  }
  if (needsBillConfirmation) {
    steps.push(`⚠️ 此场景暂按${multiplier}×CSG测算，需以WB实际账单确认为准`)
  }

  return {
    eventType,
    eventLabel: label,
    multiplier,
    csgTotalCny: round2(csgTotal),
    parcelDetails,
    estimatedReverseCompensationCny: estimatedReverseCompensation,
    actualReverseCompensationCny: actualReverseCompensation,
    reverseCompensationUsedCny: reverseCompensationUsed,
    needsBillConfirmation,
    steps,
  }
}

/**
 * 计算订单物流总成本
 *
 * total_logistics_cost_cny =
 *   forward_logistics_used
 *   + reverse_compensation_used
 *   + other_reverse_cost_cny
 *
 * forward_logistics_used:
 *   - actual_forward_logistics_cny 存在时使用实际值
 *   - 否则根据 forward_fee_applied 决定是否使用 estimated_forward_logistics_cny
 *
 * @param {object} order 订单
 * @param {object} tariff 适用的费率版本
 * @returns {object} 物流总成本计算结果
 */
export const calculateTotalLogisticsCost = (order, tariff) => {
  const reverseCalc = calculateReverseCompensation(order, tariff)

  // 正向物流费
  const forwardFeeApplied = order?.forwardFeeApplied !== false && order?.forwardFeeApplied !== 'false'
  // 当有 parcels 时，正向CSG = parcels 计算的 csgTotal；否则用 estimatedForwardLogisticsCny
  const hasParcels = (order?.parcels || []).length > 0
  const estimatedForward = hasParcels
    ? reverseCalc.csgTotalCny
    : toNum(order?.estimatedForwardLogisticsCny)
  const actualForward = order?.actualForwardLogisticsCny !== null &&
                        order?.actualForwardLogisticsCny !== undefined &&
                        order?.actualForwardLogisticsCny !== ''
    ? toNum(order.actualForwardLogisticsCny)
    : null

  // 决定正向物流费使用的值
  let forwardLogisticsUsed = 0
  let forwardSource = ''
  if (actualForward !== null) {
    forwardLogisticsUsed = actualForward
    forwardSource = '实际账单值'
  } else if (forwardFeeApplied) {
    forwardLogisticsUsed = estimatedForward
    forwardSource = hasParcels ? '预计值(parcels计算)' : '预计值'
  } else {
    forwardLogisticsUsed = 0
    forwardSource = '未发生(forward_fee_applied=false)'
  }

  // 反向赔偿使用的值
  const reverseCompensationUsed = reverseCalc.reverseCompensationUsedCny

  // 其他退回/销毁/处理费用（不自动增加，仅当用户填写或账单列明时）
  const otherReverseCost = toNum(order?.otherReverseCostCny)

  const totalLogisticsCost = round2(forwardLogisticsUsed + reverseCompensationUsed + otherReverseCost)

  // 计算依据：有任何实际值就用actual，否则用estimated
  const hasActual = actualForward !== null || reverseCalc.actualReverseCompensationCny !== null
  const calculationBasis = hasActual ? 'actual' : 'estimated'

  // 预计vs实际差异
  const estimatedTotal = round2(
    (forwardFeeApplied ? estimatedForward : 0) + reverseCalc.estimatedReverseCompensationCny + otherReverseCost
  )
  const actualTotal = round2(forwardLogisticsUsed + reverseCompensationUsed + otherReverseCost)
  const variance = round2(actualTotal - estimatedTotal)

  const steps = [
    `===== 物流总成本计算 =====`,
    `正向配送费:`,
    `  forward_fee_applied: ${forwardFeeApplied}`,
    `  预计正向: ${estimatedForward}¥${hasParcels ? ' (parcels独立计算)' : ''}`,
    actualForward !== null ? `  实际正向: ${actualForward}¥ (优先使用)` : `  实际正向: 未提供`,
    `  正向使用值: ${forwardLogisticsUsed}¥ (来源: ${forwardSource})`,
    ``,
    `反向赔偿:`,
    ...reverseCalc.steps.map((s) => `  ${s}`),
    `  反向使用值: ${reverseCompensationUsed}¥`,
    ``,
    `其他退回/销毁成本: ${otherReverseCost}¥`,
    ``,
    `物流总成本 = ${forwardLogisticsUsed} + ${reverseCompensationUsed} + ${otherReverseCost} = ${totalLogisticsCost}¥`,
    `计算依据: ${calculationBasis}`,
    `预计总额: ${estimatedTotal}¥ / 实际总额: ${actualTotal}¥ / 差异: ${variance}¥`,
  ]

  return {
    forwardFeeApplied,
    estimatedForwardLogisticsCny: estimatedForward,
    actualForwardLogisticsCny: actualForward,
    forwardLogisticsUsedCny: forwardLogisticsUsed,
    forwardSource,
    ...reverseCalc,
    reverseCompensationUsedCny: reverseCompensationUsed,
    otherReverseCostCny: otherReverseCost,
    totalLogisticsCostCny: totalLogisticsCost,
    calculationBasis,
    estimatedTotalCny: estimatedTotal,
    actualTotalCny: actualTotal,
    varianceCny: variance,
    steps,
  }
}

/**
 * V2: 订单经营利润计算（使用新物流总成本）
 *
 * operating_profit_cny =
 *   sales_revenue_cny
 *   - commission_cny
 *   - total_logistics_cost_cny
 *   - product_purchase_cost_cny
 *   - packaging_cost_cny
 *   - china_inbound_to_dpx_cost_cny
 *   - promotion_cost_cny
 *   - tax_cost_cny
 *   - other_operating_cost_cny
 *
 * 异常订单（拒收/退货/清关失败）会冲回销售收入
 */
export const calculateOperatingProfitV2 = (order, sku, settings, tariff) => {
  const rubPerCny = toNum(settings?.rubPerCny)
  if (rubPerCny <= 0) {
    return {
      error: '汇率为0或空，无法转换',
      salesRevenueCny: null,
      operatingProfitCny: null,
      steps: ['汇率为0或空，无法转换'],
    }
  }

  // 计算物流总成本（含反向赔偿）
  const logisticsCalc = calculateTotalLogisticsCost(order, tariff)
  const totalLogisticsCost = logisticsCalc.totalLogisticsCostCny

  // 收入口径：异常订单冲回销售收入
  const reverseEventType = logisticsCalc.eventType
  let sellerRevenueBaseRub = toNum(order?.sellerRevenueBaseRub)

  // 异常场景下销售收入冲回为0或保留（按用户设置）
  const abnormalEvents = [
    REVERSE_EVENT_TYPE.BUYER_RETURNED,
    REVERSE_EVENT_TYPE.REFUSED_OR_UNCLAIMED,
    REVERSE_EVENT_TYPE.CUSTOMS_FAILED,
    REVERSE_EVENT_TYPE.NOT_EXPORTED_FROM_CHINA,
  ]
  if (abnormalEvents.includes(reverseEventType)) {
    // 默认冲回销售收入为0
    sellerRevenueBaseRub = 0
  }

  const commissionBaseRub = toNum(order?.commissionBaseRub ?? sellerRevenueBaseRub)
  const commissionRate = toNum(order?.commissionRate)
  const acquiringFeeRub = toNum(order?.acquiringFeeRub)
  const promotionCostRub = toNum(order?.promotionCostRub)
  const platformOtherRub = toNum(order?.platformOtherDeductionRub)

  const salesRevenueRaw = sellerRevenueBaseRub / rubPerCny
  const commissionRaw = (commissionBaseRub * commissionRate) / 100 / rubPerCny
  const acquiringFeeRaw = acquiringFeeRub / rubPerCny
  const promotionCostRaw = promotionCostRub / rubPerCny
  const platformOtherRaw = platformOtherRub / rubPerCny

  // 成本
  const purchaseCost = toNum(sku?.purchaseCostCny)
  const packagingCost = toNum(sku?.packagingCostCny)
  const chinaInbound = toNum(sku?.chinaInboundCostCny)
  const certification = toNum(sku?.certificationAllocationCny)
  const otherOperating = toNum(order?.otherOperatingCostCny)

  // 税费
  let taxCostRaw = 0
  const taxMethod = settings?.taxMethod || 'none'
  const taxRate = toNum(settings?.taxRate)
  if (taxMethod === 'revenue' && salesRevenueRaw > 0) {
    taxCostRaw = (salesRevenueRaw * taxRate) / 100
  } else if (taxMethod === 'settlement') {
    taxCostRaw = (salesRevenueRaw * taxRate) / 100
  } else if (taxMethod === 'manual') {
    taxCostRaw = toNum(order?.taxCostCny)
  }

  // 库存回收（仅退货/拒收场景）
  let inventoryLossCny = 0
  if (abnormalEvents.includes(reverseEventType)) {
    const recoveryRate = toNum(order?.inventoryRecoveryRate) // 0-100
    inventoryLossCny = round2((purchaseCost * (100 - recoveryRate)) / 100)
  }

  // 经营利润
  const platformNetSettlementRaw = salesRevenueRaw - commissionRaw - totalLogisticsCost - acquiringFeeRaw - promotionCostRaw - platformOtherRaw
  const profitRaw = platformNetSettlementRaw - purchaseCost - packagingCost - chinaInbound - certification - taxCostRaw - otherOperating - inventoryLossCny
  const salesRevenueCny = round2(salesRevenueRaw)
  const commissionCny = round2(commissionRaw)
  const acquiringFeeCny = round2(acquiringFeeRaw)
  const promotionCostCny = round2(promotionCostRaw)
  const platformOtherCny = round2(platformOtherRaw)
  const taxCost = round2(taxCostRaw)
  const platformNetSettlement = round2(platformNetSettlementRaw)
  const profit = round2(profitRaw)

  const profitMargin = salesRevenueRaw > 0 ? round2((profitRaw / salesRevenueRaw) * 100) : null
  const logisticsRatio = salesRevenueRaw > 0 ? round2((totalLogisticsCost / salesRevenueRaw) * 100) : null
  const costTotal = purchaseCost + packagingCost + chinaInbound + totalLogisticsCost + promotionCostRaw
  const costRoi = costTotal > 0 ? round2((profitRaw / costTotal) * 100) : null

  const steps = [
    `===== 订单经营利润计算（V2）=====`,
    `反向事件类型: ${logisticsCalc.eventLabel}`,
    ...(abnormalEvents.includes(reverseEventType) ? [`⚠️ 异常订单，销售收入已冲回为0`] : []),
    `销售收入 = ${sellerRevenueBaseRub}₽ / ${rubPerCny} = ${salesRevenueCny}¥`,
    `佣金 = ${commissionBaseRub}₽ × ${commissionRate}% / ${rubPerCny} = ${commissionCny}¥`,
    `支付费 = ${acquiringFeeRub}₽ / ${rubPerCny} = ${acquiringFeeCny}¥`,
    `促销费 = ${promotionCostRub}₽ / ${rubPerCny} = ${promotionCostCny}¥`,
    `其他平台扣款 = ${platformOtherRub}₽ / ${rubPerCny} = ${platformOtherCny}¥`,
    ``,
    ...logisticsCalc.steps.map((s) => `  ${s}`),
    ``,
    `采购成本: ${purchaseCost}¥`,
    `包装成本: ${packagingCost}¥`,
    `国内送仓: ${chinaInbound}¥`,
    `认证分摊: ${certification}¥`,
    `税费(${taxMethod}): ${taxCost}¥`,
    `其他成本: ${otherOperating}¥`,
    inventoryLossCny > 0 ? `库存损失: ${inventoryLossCny}¥ (回收率${toNum(order?.inventoryRecoveryRate)}%)` : `库存损失: 0¥`,
    ``,
    `平台净结算（内部全精度计算）= ${platformNetSettlement}¥`,
    `经营利润（内部全精度计算）= ${profit}¥`,
    profitMargin !== null ? `利润率 = ${profit} / ${salesRevenueCny} = ${profitMargin}%` : `利润率: 不可计算(销售收入为0)`,
    `物流费率 = ${totalLogisticsCost} / ${salesRevenueCny || '—'} = ${logisticsRatio !== null ? logisticsRatio + '%' : '不可计算'}`,
    `成本ROI = ${profit} / ${costTotal} = ${costRoi !== null ? costRoi + '%' : '不可计算'}`,
  ]

  return {
    salesRevenueCny,
    commissionCny,
    acquiringFeeCny,
    promotionCostCny,
    platformOtherCny,
    platformNetSettlementCny: platformNetSettlement,
    purchaseCostCny: purchaseCost,
    packagingCostCny: packagingCost,
    chinaInboundCostCny: chinaInbound,
    certificationAllocationCny: certification,
    taxCostCny: taxCost,
    otherOperatingCostCny: otherOperating,
    inventoryLossCny,
    totalLogisticsCostCny: totalLogisticsCost,
    logisticsCalc,
    operatingProfitCny: profit,
    profitMargin,
    logisticsRatio,
    costRoi,
    calculationBasis: logisticsCalc.calculationBasis,
    needsBillConfirmation: logisticsCalc.needsBillConfirmation,
    steps,
  }
}

/**
 * 获取订单标签（用于列表显示）
 */
export const getOrderLabels = (order, logisticsCalc) => {
  const labels = []
  const eventType = logisticsCalc?.eventType || inferReverseEventType(order)

  if (eventType === REVERSE_EVENT_TYPE.NONE) {
    labels.push({ text: '正常签收', color: 'green' })
  } else if (eventType === REVERSE_EVENT_TYPE.CANCELLED_BEFORE_HANDOVER) {
    labels.push({ text: '交仓前取消', color: 'gray' })
  } else {
    const mult = logisticsCalc?.multiplier ?? DEFAULT_REVERSE_MULTIPLIER[eventType] ?? 0
    if (mult === 1) labels.push({ text: '一倍赔偿', color: 'orange' })
    else if (mult === 2) labels.push({ text: '两倍赔偿', color: 'red' })
    else if (mult > 0) labels.push({ text: `${mult}倍赔偿`, color: 'orange' })
  }

  if (logisticsCalc?.needsBillConfirmation) {
    labels.push({ text: '待账单确认', color: 'yellow' })
  }
  if (logisticsCalc?.calculationBasis === 'actual' && logisticsCalc?.varianceCny !== 0) {
    labels.push({ text: '预计与实扣不一致', color: 'red' })
  }

  return labels
}
