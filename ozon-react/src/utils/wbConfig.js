/**
 * WB跨境核算 - 默认费率配置
 * 依据《WB跨境利润与物流费用核算面板-需求规格说明书》第4.4节
 *
 * 费率版本历史：
 *   - 2026-02-09: 原始版本 (来源: DPX运费(1).pdf)
 *   - 2026-07-22: 0726版本 (来源: warehouse_and_tarrifs/0726.pdf)
 *
 * 说明：DPX标准线路的费率数值（58元/kg+2元、43元/kg+8元）保持不变，
 *       仅更新生效日期和来源文件。
 */

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

export const DEFAULT_SETTINGS = {
  baseCurrency: 'CNY',
  rubPerCny: 12,
  exchangeRateEffectiveFrom: '2026-08-11',
  taxMethod: 'none', // none / manual / revenue / settlement
  taxRate: 0,
  defaultRouteId: 'DPX-SZ-382822',
  defaultCommissionRate: null,
  // 旧字段 defaultReverseIncluded 已废弃，保留以做向后兼容
  // 新字段：
  buyerToRuWarehouseReverseIncluded: true, // 买家至俄罗斯WB合作仓的物理退回运输和暂存已包含（13.1.11）
  timezone: 'Asia/Shanghai',
  profitMarginThreshold: 10,
  logisticsRatioThreshold: 30,
}

/**
 * 默认费率表
 * - 历史版本（2026-02-09）：保留 effectiveTo = '2026-07-21'，用于历史订单
 * - 当前版本（2026-07-22）：effectiveFrom = '2026-07-22'，来源 0726.pdf
 *
 * 费率数值不变，仅版本切换。
 */
export const DEFAULT_TARIFFS = [
  // ============ 历史版本：2026-02-09 ============
  {
    tariffId: 'DPX-SZ-382822-20260209',
    routeId: 'DPX-SZ-382822',
    routeName: 'DPX深圳标准',
    warehouseCode: '382822',
    originCity: '深圳',
    destinationCountry: 'RU',
    serviceLevel: 'standard',
    etaMinDays: 15,
    etaMaxDays: 30,
    weightRoundingG: 100,
    chargeBasis: 'actual_weight',
    maxWeightKg: 20,
    maxSumDimensionsCm: 200,
    maxSingleSideCm: 120,
    batteryLimitWh: 100,
    buyerToRuWarehouseReverseIncluded: true,
    effectiveFrom: '2026-02-09',
    effectiveTo: '2026-07-21', // 已被0726版本取代
    active: true, // 保留启用，用于历史订单按日期匹配
    sourceName: 'DPX运费(1).pdf',
    notes: 'DPX深圳标准线路（历史版本）',
    tiers: [
      { minWeightKg: 0.1, maxWeightKg: 0.3, kgRateCny: 58, fixedFeeCny: 2 },
      { minWeightKg: 0.4, maxWeightKg: 20, kgRateCny: 43, fixedFeeCny: 8 },
    ],
  },
  {
    tariffId: 'WB-SE-20260209',
    routeId: 'WB-SE',
    routeName: 'WB超级经济',
    warehouseCode: '',
    originCity: '深圳',
    destinationCountry: 'RU',
    serviceLevel: 'economy',
    etaMinDays: 15,
    etaMaxDays: 30,
    weightRoundingG: 100,
    chargeBasis: 'actual_weight',
    maxWeightKg: 20,
    maxSumDimensionsCm: 200,
    maxSingleSideCm: 115,
    batteryLimitWh: 100,
    buyerToRuWarehouseReverseIncluded: true,
    effectiveFrom: '2026-02-09',
    effectiveTo: '2026-07-21',
    active: true,
    sourceName: 'DPX运费(1).pdf',
    notes: 'WB超级经济线路（历史版本）',
    tiers: [
      { minWeightKg: 0.1, maxWeightKg: 0.3, kgRateCny: 58, fixedFeeCny: 2 },
      { minWeightKg: 0.4, maxWeightKg: 20, kgRateCny: 43, fixedFeeCny: 8 },
    ],
  },
  {
    tariffId: 'WB-PLUS-20260209',
    routeId: 'WB-PLUS',
    routeName: 'WB Plus东莞/珲春',
    warehouseCode: '',
    originCity: '东莞',
    destinationCountry: 'RU',
    serviceLevel: 'plus',
    etaMinDays: 7,
    etaMaxDays: 7,
    weightRoundingG: 100,
    chargeBasis: 'actual_weight',
    maxWeightKg: 20,
    maxSumDimensionsCm: 200,
    maxSingleSideCm: 120,
    batteryLimitWh: 100,
    buyerToRuWarehouseReverseIncluded: true,
    effectiveFrom: '2026-02-09',
    effectiveTo: '2026-07-21',
    active: true,
    sourceName: 'DPX运费(1).pdf',
    notes: 'WB Plus 快速线路（历史版本）',
    tiers: [
      { minWeightKg: 0.1, maxWeightKg: 0.3, kgRateCny: 48, fixedFeeCny: 9 },
      { minWeightKg: 0.4, maxWeightKg: 20, kgRateCny: 48, fixedFeeCny: 9 },
    ],
  },
  {
    tariffId: 'HK-EXP-20260209',
    routeId: 'HK-EXP',
    routeName: '香港快线',
    warehouseCode: '',
    originCity: '香港',
    destinationCountry: 'RU',
    serviceLevel: 'express',
    etaMinDays: 10,
    etaMaxDays: 10,
    weightRoundingG: 100,
    chargeBasis: 'actual_weight',
    maxWeightKg: 20,
    maxSumDimensionsCm: 200,
    maxSingleSideCm: 60,
    batteryLimitWh: 100,
    buyerToRuWarehouseReverseIncluded: true,
    effectiveFrom: '2026-02-09',
    effectiveTo: '2026-07-21',
    active: true,
    sourceName: 'DPX运费(1).pdf',
    notes: '香港快线，单边≤60cm（历史版本）',
    tiers: [
      { minWeightKg: 0.1, maxWeightKg: 0.3, kgRateCny: 89, fixedFeeCny: 17 },
      { minWeightKg: 0.4, maxWeightKg: 20, kgRateCny: 89, fixedFeeCny: 17 },
    ],
  },
  {
    tariffId: 'DG-EXP-20260209',
    routeId: 'DG-EXP',
    routeName: '东莞快线',
    warehouseCode: '',
    originCity: '东莞',
    destinationCountry: 'RU',
    serviceLevel: 'express',
    etaMinDays: 10,
    etaMaxDays: 10,
    weightRoundingG: 100,
    chargeBasis: 'actual_weight',
    maxWeightKg: 20,
    maxSumDimensionsCm: 200,
    maxSingleSideCm: 100,
    batteryLimitWh: 100,
    buyerToRuWarehouseReverseIncluded: true,
    effectiveFrom: '2026-02-09',
    effectiveTo: '2026-07-21',
    active: true,
    sourceName: 'DPX运费(1).pdf',
    notes: '东莞快线，单边≤100cm（历史版本）',
    tiers: [
      { minWeightKg: 0.1, maxWeightKg: 0.3, kgRateCny: 122, fixedFeeCny: 19 },
      { minWeightKg: 0.4, maxWeightKg: 20, kgRateCny: 122, fixedFeeCny: 19 },
    ],
  },

  // ============ 当前版本：2026-07-22（0726.pdf）============
  {
    tariffId: 'DPX-SZ-382822-20260722',
    routeId: 'DPX-SZ-382822',
    routeName: 'DPX深圳标准',
    warehouseCode: '382822',
    originCity: '深圳',
    destinationCountry: 'RU',
    serviceLevel: 'standard',
    etaMinDays: 15,
    etaMaxDays: 30,
    weightRoundingG: 100,
    chargeBasis: 'actual_weight',
    maxWeightKg: 20,
    maxSumDimensionsCm: 200,
    maxSingleSideCm: 120,
    batteryLimitWh: 100,
    buyerToRuWarehouseReverseIncluded: true,
    effectiveFrom: '2026-07-22',
    effectiveTo: null,
    active: true,
    sourceName: 'warehouse_and_tarrifs/0726.pdf',
    notes: 'DPX深圳标准线路（0726版本）',
    tiers: [
      { minWeightKg: 0.1, maxWeightKg: 0.3, kgRateCny: 58, fixedFeeCny: 2 },
      { minWeightKg: 0.4, maxWeightKg: 20, kgRateCny: 43, fixedFeeCny: 8 },
    ],
  },
  {
    tariffId: 'WB-SE-20260722',
    routeId: 'WB-SE',
    routeName: 'WB超级经济',
    warehouseCode: '',
    originCity: '深圳',
    destinationCountry: 'RU',
    serviceLevel: 'economy',
    etaMinDays: 15,
    etaMaxDays: 30,
    weightRoundingG: 100,
    chargeBasis: 'actual_weight',
    maxWeightKg: 20,
    maxSumDimensionsCm: 200,
    maxSingleSideCm: 115,
    batteryLimitWh: 100,
    buyerToRuWarehouseReverseIncluded: true,
    effectiveFrom: '2026-07-22',
    effectiveTo: null,
    active: true,
    sourceName: 'warehouse_and_tarrifs/0726.pdf',
    notes: 'WB超级经济线路（0726版本）',
    tiers: [
      { minWeightKg: 0.1, maxWeightKg: 0.3, kgRateCny: 58, fixedFeeCny: 2 },
      { minWeightKg: 0.4, maxWeightKg: 20, kgRateCny: 43, fixedFeeCny: 8 },
    ],
  },
  {
    tariffId: 'WB-PLUS-20260722',
    routeId: 'WB-PLUS',
    routeName: 'WB Plus东莞/珲春',
    warehouseCode: '',
    originCity: '东莞',
    destinationCountry: 'RU',
    serviceLevel: 'plus',
    etaMinDays: 7,
    etaMaxDays: 7,
    weightRoundingG: 100,
    chargeBasis: 'actual_weight',
    maxWeightKg: 20,
    maxSumDimensionsCm: 200,
    maxSingleSideCm: 120,
    batteryLimitWh: 100,
    buyerToRuWarehouseReverseIncluded: true,
    effectiveFrom: '2026-07-22',
    effectiveTo: null,
    active: true,
    sourceName: 'warehouse_and_tarrifs/0726.pdf',
    notes: 'WB Plus 快速线路（0726版本）',
    tiers: [
      { minWeightKg: 0.1, maxWeightKg: 0.3, kgRateCny: 48, fixedFeeCny: 9 },
      { minWeightKg: 0.4, maxWeightKg: 20, kgRateCny: 48, fixedFeeCny: 9 },
    ],
  },
  {
    tariffId: 'HK-EXP-20260722',
    routeId: 'HK-EXP',
    routeName: '香港快线',
    warehouseCode: '',
    originCity: '香港',
    destinationCountry: 'RU',
    serviceLevel: 'express',
    etaMinDays: 10,
    etaMaxDays: 10,
    weightRoundingG: 100,
    chargeBasis: 'actual_weight',
    maxWeightKg: 20,
    maxSumDimensionsCm: 200,
    maxSingleSideCm: 60,
    batteryLimitWh: 100,
    buyerToRuWarehouseReverseIncluded: true,
    effectiveFrom: '2026-07-22',
    effectiveTo: null,
    active: true,
    sourceName: 'warehouse_and_tarrifs/0726.pdf',
    notes: '香港快线，单边≤60cm（0726版本）',
    tiers: [
      { minWeightKg: 0.1, maxWeightKg: 0.3, kgRateCny: 89, fixedFeeCny: 17 },
      { minWeightKg: 0.4, maxWeightKg: 20, kgRateCny: 89, fixedFeeCny: 17 },
    ],
  },
  {
    tariffId: 'DG-EXP-20260722',
    routeId: 'DG-EXP',
    routeName: '东莞快线',
    warehouseCode: '',
    originCity: '东莞',
    destinationCountry: 'RU',
    serviceLevel: 'express',
    etaMinDays: 10,
    etaMaxDays: 10,
    weightRoundingG: 100,
    chargeBasis: 'actual_weight',
    maxWeightKg: 20,
    maxSumDimensionsCm: 200,
    maxSingleSideCm: 100,
    batteryLimitWh: 100,
    buyerToRuWarehouseReverseIncluded: true,
    effectiveFrom: '2026-07-22',
    effectiveTo: null,
    active: true,
    sourceName: 'warehouse_and_tarrifs/0726.pdf',
    notes: '东莞快线，单边≤100cm（0726版本）',
    tiers: [
      { minWeightKg: 0.1, maxWeightKg: 0.3, kgRateCny: 122, fixedFeeCny: 19 },
      { minWeightKg: 0.4, maxWeightKg: 20, kgRateCny: 122, fixedFeeCny: 19 },
    ],
  },
]

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
