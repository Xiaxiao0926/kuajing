/**
 * Ozon FBP 边境仓核算 - 计算引擎
 *
 * 渠道配置唯一事实源: D:/ozon/config/ozon_fbp_channels.json
 * （经 scripts/sync-config.js 生成为 src/generated/ozon_fbp_channels.js，
 *  提取自 运费计算/FBP_list_of_services_CN_HK1092026_*.xlsx，DEX/Smart 一期排除）
 *
 * 本文件只做 snake_case → 引擎内部结构映射；费率数值禁止在本文件修改。
 * 汇率沿用 ozonEngine live binding R（每日自动更新全局生效，勿改为 const）。
 */

import fbpData from '../generated/ozon_fbp_channels.js'
import settingsData from '../generated/settings.js'
import { R, rubPerCny, rubToCnyExact, round2, calculateAgencyFeeRub } from './ozonEngine.js'

// 资费表版本：从 source 字段提取，禁止 UI 硬编码
const FBP_VERSION_MATCH = /HK\d+/.exec(String(fbpData.source || ''))
export const FBP_VERSION = FBP_VERSION_MATCH ? FBP_VERSION_MATCH[0] : String(fbpData.source || '')

export const FBP_SOURCE = String(fbpData.source || '')
export const FBP_STORAGE = fbpData.storage
export const FBP_LAST_MILE = fbpData.last_mile

export const FBP_DESTINATIONS = (() => {
  const seen = new Map()
  for (const g of fbpData.groups) {
    if (!seen.has(g.destination)) seen.set(g.destination, g.destination_zh)
  }
  return [...seen.entries()].map(([code, zh]) => ({ code, zh }))
})()

export const FBP_WAREHOUSES = [
  { id: 'all', name: '全部仓库', carriers: null },
  ...fbpData.warehouses.map((w) => ({ id: w.id, name: w.name, carriers: w.carriers })),
]

/**
 * 平铺渠道（含分组元信息），供线路对比与筛选
 */
export const ALL_FBP_CHANNELS = fbpData.groups.flatMap((g) =>
  g.channels.map((c) => ({
    ...c,
    groupKey: `${g.carrier} / ${g.service_level}`,
  }))
)

/** 按目的国 + 可选仓库筛选渠道池 */
export function filterFbpChannels(destination, warehouseId = 'all') {
  const wh = fbpData.warehouses.find((w) => w.id === warehouseId)
  return ALL_FBP_CHANNELS.filter((c) => {
    if (c.destination !== destination) return false
    if (wh && !wh.carriers.includes(c.carrier)) return false
    return true
  })
}

/**
 * 单渠道运费计算（FBP 3PL 段：中国揽收点→Ozon 分拣中心）
 * @param {Object} ch 渠道（engine 结构）
 * @param {number} price 成交价(₽)
 * @param {number} weight 实重(kg)
 * @param {number} length/width/height 尺寸(cm)
 * @param {Object} [flags] { hasBattery, hasLiquid }
 * @returns {{ok:true, cost:number, chargeWeightKg:number, volumetricWeightKg:number|null}}
 *          | {{ok:false, reason:string}}
 */
export function calcFbpShipping(ch, price, weight, length, width, height, flags = {}) {
  const wG = weight * 1000
  const sum = length + width + height
  const reasons = []
  if (length > ch.side_max_cm || width > ch.side_max_cm || height > ch.side_max_cm) reasons.push('最长边超限')
  if (sum > ch.sum_max_cm) reasons.push(`三边和超限(${sum}>${ch.sum_max_cm}cm)`)
  if (wG < ch.weight_min_g || wG > ch.weight_max_g) reasons.push(`重量超出区间(${ch.weight_min_g}-${ch.weight_max_g}g)`)
  if (price < ch.price_min_rub || price > ch.price_max_rub) reasons.push(`申报价值超出区间(${ch.price_min_rub}-${ch.price_max_rub}₽)`)
  if (flags.hasBattery && ch.batteries === 'forbidden') reasons.push('该线路禁运电池')
  if (flags.hasLiquid && ch.liquids === 'forbidden') reasons.push('该线路禁运液体')
  if (reasons.length) return { ok: false, reason: reasons.join('；') }

  // 体积重公式 (L×W×H)/divisor 结果单位为 kg（沿袭 rFBS 引擎口径），全程统一 kg
  let chargeWeightKg = weight
  let volumetricWeightKg = null
  if (ch.charge_weight === 'vol_6000' || ch.charge_weight === 'vol_12000') {
    volumetricWeightKg = (length * width * height) / ch.vol_divisor
    chargeWeightKg = Math.max(weight, volumetricWeightKg)
  } else if (ch.charge_weight === 'conditional') {
    if (sum > ch.vol_threshold_sum_cm) {
      volumetricWeightKg = (length * width * height) / ch.vol_divisor
      chargeWeightKg = Math.max(weight, volumetricWeightKg)
    }
  }

  const cost = ch.fixed_cny + ch.rate_per_g_cny * chargeWeightKg * 1000
  return {
    ok: true,
    cost: round2(cost),
    chargeWeightKg: Math.round(chargeWeightKg * 1000) / 1000,
    volumetricWeightKg: volumetricWeightKg !== null ? Math.round(volumetricWeightKg * 1000) / 1000 : null,
  }
}

/**
 * FBP 仓储费（90 天免仓期，其后 ¥4/m³/天，单件口径）
 * @returns {number} 仓储费(¥/件)
 */
export function calcStorageFee(length, width, height, days) {
  const volumeM3 = (length * width * height) / 1000000
  const billableDays = Math.max(0, (Number(days) || 0) - FBP_STORAGE.free_days)
  return round2(billableDays * volumeM3 * FBP_STORAGE.rate_cny_per_m3_per_day)
}

/**
 * 单渠道完整利润测算（FBP 模式单件利润链）
 * @param {Object} ch 渠道
 * @param {Object} inputs 商品输入 {
 *   price(成交价₽), weight(kg), length, width, height(cm),
 *   hasBattery, hasLiquid, stockDays(预计库存天数), lastMileRub(Ozon尾程配送费₽/件，一期手动)
 * }
 * @param {Object} params 成本参数 {
 *   purchaseCost, domesticShipping(工厂→边境仓), labelingFee,
 *   commission, adRate, paymentFee, agencyFee(覆盖%)， returnLoss
 * }
 */
export function calcFbpProfit(ch, inputs, params) {
  const ship = calcFbpShipping(ch, inputs.price, inputs.weight, inputs.length, inputs.width, inputs.height, {
    hasBattery: inputs.hasBattery,
    hasLiquid: inputs.hasLiquid,
  })
  if (!ship.ok) return { ok: false, reason: ship.reason }

  const price = Number(inputs.price) || 0
  const priceCnyRaw = rubToCnyExact(price, rubPerCny)
  const lastMileCnyRaw = rubToCnyExact(Number(inputs.lastMileRub) || 0, rubPerCny)

  const purchaseCost = Number(params.purchaseCost) || 0
  const domesticShipping = Number(params.domesticShipping) || 0
  const labelingFee = Number(params.labelingFee) || 0
  const commission = Number(params.commission) || 0
  const adRate = Number(params.adRate) || 0
  const paymentFee = Number(params.paymentFee) || 0
  const agencyFeePct = params.agencyFee !== undefined && params.agencyFee !== '' ? Number(params.agencyFee) : Number(settingsData.agency_fee.rate) * 100
  const returnLoss = Number(params.returnLoss) || 0

  const domesticCost = purchaseCost + domesticShipping + labelingFee
  const storageFee = calcStorageFee(inputs.length, inputs.width, inputs.height, inputs.stockDays)
  const agencyAmtRub = calculateAgencyFeeRub(price, { rate: agencyFeePct / 100 })
  const agencyCnyRaw = rubToCnyExact(agencyAmtRub, rubPerCny)
  const platformRate = commission + adRate + paymentFee
  const platformAmtRaw = (priceCnyRaw * platformRate) / 100
  const returnAmtRaw = (priceCnyRaw * returnLoss) / 100

  const profitRaw = priceCnyRaw - domesticCost - ship.cost - lastMileCnyRaw - storageFee - agencyCnyRaw - platformAmtRaw - returnAmtRaw

  return {
    ok: true,
    shipping: ship,
    priceCny: round2(priceCnyRaw),
    profit: round2(profitRaw),
    profitRate: priceCnyRaw > 0 ? Math.round((profitRaw / priceCnyRaw) * 1000) / 10 : 0,
    storageFee,
    costBreakdown: {
      domesticCost: round2(domesticCost),
      fbpShipping: ship.cost,
      lastMile: round2(lastMileCnyRaw),
      lastMileRub: Number(inputs.lastMileRub) || 0,
      storageFee,
      agencyAmt: round2(agencyCnyRaw),
      agencyAmtRub,
      commissionAmt: round2((priceCnyRaw * commission) / 100),
      adAmt: round2((priceCnyRaw * adRate) / 100),
      paymentAmt: round2((priceCnyRaw * paymentFee) / 100),
      platformAmt: round2(platformAmtRaw),
      returnAmt: round2(returnAmtRaw),
    },
  }
}

/**
 * 全渠道测算并取利润最高线路
 * @returns {{ok:boolean, channel, calc}|null} 最优线路或 null（无可用线路时）
 */
export function getBestFbpProfit(destination, inputs, params, warehouseId = 'all') {
  let best = null
  for (const ch of filterFbpChannels(destination, warehouseId)) {
    const calc = calcFbpProfit(ch, inputs, params)
    if (calc.ok && (best === null || calc.profit > best.calc.profit)) {
      best = { channel: ch, calc }
    }
  }
  return best
}
