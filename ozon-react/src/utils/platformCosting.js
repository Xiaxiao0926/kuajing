import { selectTariffVersion } from './wbEngine.js'

export function localDateString(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function isEnteredNumber(value, { positive = false, max = Infinity, integer = false } = {}) {
  if (value === '' || value === null || value === undefined) return false
  const number = Number(value)
  return Number.isFinite(number) && (positive ? number > 0 : number >= 0) && number <= max && (!integer || Number.isInteger(number))
}

export function missingOzonInputs(values) {
  const required = {
    price: ['售价', { positive: true }],
    weight: ['实重', { positive: true }],
    length: ['长', { positive: true }],
    width: ['宽', { positive: true }],
    height: ['高', { positive: true }],
    purchaseCost: ['采购成本', {}],
    domesticShipping: ['国内运费', {}],
    labelingFee: ['贴标费', {}],
    commission: ['佣金', { max: 100 }],
    adRate: ['广告费率', { max: 100 }],
    paymentFee: ['支付费率', { max: 100 }],
    agencyFee: ['代理费率', { max: 100 }],
    returnLoss: ['退货损失率', { max: 100 }],
  }
  return Object.entries(required)
    .filter(([key, [, options]]) => !isEnteredNumber(values?.[key], options))
    .map(([, [label]]) => label)
}

export function missingWbInputs(values) {
  const required = {
    actualWeightG: ['重量', { positive: true }],
    lengthCm: ['长', { positive: true }],
    widthCm: ['宽', { positive: true }],
    heightCm: ['高', { positive: true }],
    quantity: ['数量', { positive: true, max: 1000, integer: true }],
    parcelCount: ['包裹数', { positive: true, max: 100, integer: true }],
    sellerRevenueRub: ['卖家收入', { positive: true }],
    commissionRate: ['佣金率', { max: 100 }],
    purchaseCost: ['采购成本', {}],
    packagingCost: ['包装成本', {}],
    chinaInbound: ['国内送仓费', {}],
    promotionCostRub: ['促销费', {}],
  }
  return Object.entries(required)
    .filter(([key, [, options]]) => !isEnteredNumber(values?.[key], options))
    .map(([, [label]]) => label)
}

export function effectiveWbRoutes(tariffs, date) {
  const routeIds = [...new Set((tariffs || []).map((tariff) => tariff.routeId).filter(Boolean))]
  return routeIds.map((routeId) => selectTariffVersion(routeId, date, tariffs)).filter(Boolean)
}
