/**
 * utils/t6/supplyCostBridge.js — 正式供应报价 → 成本核算草稿 桥接契约（纯函数）
 * 
 * 职责：
 * 验证调用层已解析的 project / supplier / quote 引用关系，
 * 并生成供 Ozon / WB Calculator 消费的最小 UI 成本参考对象。
 * 
 * 铁律（TASK 07A-3D1/3D2）：
 * 1. 纯领域函数：严禁 import t6Store、读取 localStorage/persist、读取汇率配置、网络请求；
 * 2. 状态固定：NONE / INVALID_REFERENCE / APPLICABLE_CNY / BLOCKED_CURRENCY；
 * 3. 严格引用一致性 (Fail-close)：
 *    project.supply.supplierId === supplier.id &&
 *    project.supply.quoteId === quote.id &&
 *    supplier.projectId === project.id &&
 *    quote.supplierId === supplier.id
 * 4. 严禁字符串偷偷转数字：quote.unitPriceCny 必须为有限非负数值；
 * 5. 零汇率换算：非 CNY (USD/RUB) 绝不换汇，绝不生成 purchaseCostCny；
 * 6. 最小状态集：仅暴露 quoteId, quoteVersion, supplierId, supplierName, rawAmount, currency, (purchaseCostCny)。
 */

export const SUPPLY_COST_STATUS = Object.freeze({
  NONE: 'NONE',
  INVALID_REFERENCE: 'INVALID_REFERENCE',
  APPLICABLE_CNY: 'APPLICABLE_CNY',
  BLOCKED_CURRENCY: 'BLOCKED_CURRENCY',
})

/**
 * 校验并构造供核算工作台使用的供应报价参考
 * @param {Object} params
 * @param {Object|null} params.project - 当前项目对象
 * @param {Object|null} params.supplier - 当前关联供应商对象
 * @param {Object|null} params.quote - 正式选定报价对象
 * @returns {Object} 归一化 supplyCostReference
 */
export function buildSupplyCostReference({ project, supplier, quote } = {}) {
  const supply = project?.supply
  if (!supply) {
    return { status: SUPPLY_COST_STATUS.NONE }
  }

  // 引用一致性校验 (Fail-close)
  if (
    !supplier ||
    !quote ||
    supply.supplierId !== supplier.id ||
    supply.quoteId !== quote.id ||
    supplier.projectId !== project.id ||
    quote.supplierId !== supplier.id
  ) {
    return {
      status: SUPPLY_COST_STATUS.INVALID_REFERENCE,
      warning: '正式供应方案引用异常，采购成本请暂时手工填写。',
    }
  }

  // 报价数值类型与范围严格校验（严禁 Number('10') 隐式转换字符串）
  const unitPrice = quote.unitPriceCny
  if (typeof unitPrice !== 'number' || !Number.isFinite(unitPrice) || unitPrice < 0) {
    return {
      status: SUPPLY_COST_STATUS.INVALID_REFERENCE,
      warning: '正式供应方案报价数值非法，采购成本请暂时手工填写。',
    }
  }

  const baseRef = {
    quoteId: quote.id,
    quoteVersion: quote.version,
    supplierId: supplier.id,
    supplierName: supplier.name,
    rawAmount: unitPrice,
    currency: quote.currency || 'CNY',
  }

  // 币种分支：仅 CNY 允许显式采用；非 CNY 阻断并保留原币原值展示
  if (quote.currency === 'CNY') {
    return {
      ...baseRef,
      status: SUPPLY_COST_STATUS.APPLICABLE_CNY,
      purchaseCostCny: unitPrice,
    }
  }

  return {
    ...baseRef,
    status: SUPPLY_COST_STATUS.BLOCKED_CURRENCY,
    warning: '非人民币正式报价暂不支持一键采用，请核实汇率后手工填写采购成本。',
  }
}
