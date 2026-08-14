/**
 * WB跨境核算 - 默认费率配置（适配器层）
 * 唯一事实源: D:/ozon/config/*.json（snake_case，经 scripts/sync-config.js 生成为
 * src/generated/*.js）。本文件只做 snake_case → camelCase 映射，保证对外 API
 * 与历史版本完全一致；费率数值禁止在本文件修改。
 *
 * 费率版本历史：
 *   - 2026-02-09: 原始版本 (来源: DPX运费(1).pdf)
 *   - 2026-07-22: 0726版本 (来源: warehouse_and_tarrifs/0726.pdf)
 */

import tariffsData from '../generated/wb_tariffs.js'
import settingsData from '../generated/settings.js'

/**
 * 反向配送事件类型枚举
 * 对应WB服务条款13.1.14
 */
export const REVERSE_EVENT_TYPE = {
  NONE: 'none',                                  // 正常签收，无反向配送
  CANCELLED_BEFORE_HANDOVER: 'cancelled_before_handover',          // 交仓前取消，商品仍在卖家手中
  NOT_EXPORTED_FROM_CHINA: 'not_exported_from_china_after_handover', // 交仓后未运出中国即退回
  BUYER_RETURNED: 'buyer_returned',              // 买家退货
  REFUSED_OR_UNCLAIMED: 'refused_or_unclaimed',  // 拒收或超期未领取
  CUSTOMS_FAILED: 'customs_failed_returned_to_china', // 清关失败退回中国
  MANUAL: 'manual',                              // 其他情况，手工填写
}

/**
 * 默认赔偿倍数表
 * 依据WB服务条款13.1.14
 */
export const DEFAULT_REVERSE_MULTIPLIER = {
  [REVERSE_EVENT_TYPE.NONE]: 0,
  [REVERSE_EVENT_TYPE.CANCELLED_BEFORE_HANDOVER]: 0,
  [REVERSE_EVENT_TYPE.NOT_EXPORTED_FROM_CHINA]: 1,
  [REVERSE_EVENT_TYPE.BUYER_RETURNED]: 1,
  [REVERSE_EVENT_TYPE.REFUSED_OR_UNCLAIMED]: 1, // 暂按1测算，标记为待账单确认
  [REVERSE_EVENT_TYPE.CUSTOMS_FAILED]: 2,
  [REVERSE_EVENT_TYPE.MANUAL]: 0,
}

/**
 * 反向事件中文标签
 */
export const REVERSE_EVENT_LABEL = {
  [REVERSE_EVENT_TYPE.NONE]: '正常签收',
  [REVERSE_EVENT_TYPE.CANCELLED_BEFORE_HANDOVER]: '交仓前取消',
  [REVERSE_EVENT_TYPE.NOT_EXPORTED_FROM_CHINA]: '未出中国即退回',
  [REVERSE_EVENT_TYPE.BUYER_RETURNED]: '买家退货',
  [REVERSE_EVENT_TYPE.REFUSED_OR_UNCLAIMED]: '拒收/未领取',
  [REVERSE_EVENT_TYPE.CUSTOMS_FAILED]: '清关失败退回中国',
  [REVERSE_EVENT_TYPE.MANUAL]: '手工填写',
}

/**
 * 是否需要标记"待账单确认"
 */
export const NEEDS_BILL_CONFIRMATION = {
  [REVERSE_EVENT_TYPE.NONE]: false,
  [REVERSE_EVENT_TYPE.CANCELLED_BEFORE_HANDOVER]: false,
  [REVERSE_EVENT_TYPE.NOT_EXPORTED_FROM_CHINA]: false,
  [REVERSE_EVENT_TYPE.BUYER_RETURNED]: false,
  [REVERSE_EVENT_TYPE.REFUSED_OR_UNCLAIMED]: true, // 拒收/未领取需待账单确认
  [REVERSE_EVENT_TYPE.CUSTOMS_FAILED]: false,
  [REVERSE_EVENT_TYPE.MANUAL]: false,
}

/**
 * 默认设置（来自 config/settings.json，snake→camel 映射）
 */
export const DEFAULT_SETTINGS = {
  baseCurrency: settingsData.base_currency,
  rubPerCny: settingsData.rub_per_cny,
  exchangeRateEffectiveFrom: settingsData.exchange_rate_effective_from,
  taxMethod: settingsData.tax_method, // none / manual / revenue / settlement
  taxRate: settingsData.tax_rate,
  defaultRouteId: settingsData.default_route_id,
  defaultCommissionRate: settingsData.default_commission_rate,
  // 旧字段 defaultReverseIncluded 已废弃，保留以做向后兼容
  buyerToRuWarehouseReverseIncluded: settingsData.buyer_to_ru_warehouse_reverse_included, // 买家至俄罗斯WB合作仓的物理退回运输和暂存已包含（13.1.11）
  timezone: settingsData.timezone,
  profitMarginThreshold: settingsData.profit_margin_threshold,
  logisticsRatioThreshold: settingsData.logistics_ratio_threshold,
}

/**
 * 默认费率表（来自 config/wb_tariffs.json，snake→camel 映射）
 * - 历史版本（2026-02-09）：保留 effectiveTo = '2026-07-21'，用于历史订单
 * - 当前版本（2026-07-22）：effectiveFrom = '2026-07-22'，来源 0726.pdf
 */
export const DEFAULT_TARIFFS = tariffsData.map((t) => ({
  tariffId: t.tariff_id,
  routeId: t.route_id,
  routeName: t.route_name,
  warehouseCode: t.warehouse_code,
  originCity: t.origin_city,
  destinationCountry: t.destination_country,
  serviceLevel: t.service_level,
  etaMinDays: t.eta_min_days,
  etaMaxDays: t.eta_max_days,
  weightRoundingG: t.weight_rounding_g,
  chargeBasis: t.charge_basis,
  maxWeightKg: t.max_weight_kg,
  maxSumDimensionsCm: t.max_sum_dimensions_cm,
  maxSingleSideCm: t.max_single_side_cm,
  batteryLimitWh: t.battery_limit_wh,
  buyerToRuWarehouseReverseIncluded: t.reverse_to_ru_warehouse_included,
  effectiveFrom: t.effective_from,
  effectiveTo: t.effective_to,
  active: t.active,
  sourceName: t.source_name,
  notes: t.notes,
  tiers: t.tiers.map((tier) => ({
    minWeightKg: tier.min_weight_kg,
    maxWeightKg: tier.max_weight_kg,
    kgRateCny: tier.kg_rate_cny,
    fixedFeeCny: tier.fixed_fee_cny,
  })),
}))

/**
 * CSV导入模板列
 * V2 - 增加异常订单反向配送字段
 */
export const CSV_COLUMNS = [
  'order_id', 'order_date', 'status', 'sku_id', 'quantity',
  'buyer_paid_rub', 'seller_revenue_base_rub', 'commission_rate', 'route_id',
  'parcel_id', 'actual_weight_g', 'length_cm', 'width_cm', 'height_cm',
  'purchase_cost_cny', 'packaging_cost_cny', 'china_inbound_cost_cny',
  'promotion_cost_rub', 'tax_cost_cny',
  // 正向物流
  'forward_fee_applied', 'estimated_forward_logistics_cny', 'actual_forward_logistics_cny',
  // 反向配送
  'reverse_event_type', 'reverse_compensation_multiplier',
  'estimated_reverse_compensation_cny', 'actual_reverse_compensation_cny',
  'other_reverse_cost_cny',
  'notes',
]
