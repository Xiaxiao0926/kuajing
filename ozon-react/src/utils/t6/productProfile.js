/**
 * utils/t6/productProfile.js — Project Product Profile 纯函数事实源 (TASK 07A-3B)
 * 
 * 契约：
 * - 纯函数模块，零 Store 读写，零持久化依赖
 * - 字段白名单 PROJECT_PRODUCT_FIELDS 严格固定为 12 个字段
 * - Required Core: nameZh, categoryLeaf 必填非空字符串
 * - Optional Strings: variantLabel, nameRu, brand, model, material, barcode 允许空字符串，必须 typeof === 'string'
 * - Weights: grossWeightG, netWeightG 必须为 null 或大于 0 的有效有限正数
 * - Dimensions: packageDimsCm, productDimsCm 必须为 null 或包含 3 个大于 0 有限正数的数组 [L, W, H]
 * - Snapshot 初始化只生成本地 Draft，严禁将 weightG 自动填充为重量字段，严禁从 project.name 猜 variantLabel
 * - MARKET_VALIDATION 尺寸必须从 snapshot.sourceInputs.dims 取，严禁直接取 procurementEvidence.dims 字符串
 */

export const PROJECT_PRODUCT_FIELDS = Object.freeze([
  'nameZh',
  'categoryLeaf',
  'packageDimsCm',
  'grossWeightG',
  'netWeightG',
  'productDimsCm',
  'variantLabel',
  'nameRu',
  'brand',
  'model',
  'material',
  'barcode',
])

/**
 * 判断项目的 product 对象是否为空容器
 * @param {object|null|undefined} product
 * @returns {boolean}
 */
export function isProjectProductEmpty(product) {
  if (!product || typeof product !== 'object') return true
  const keys = Object.keys(product)
  if (keys.length === 0) return true
  return keys.every((k) => product[k] === null || product[k] === undefined || product[k] === '')
}

/**
 * 构建初始 Project Product 本地 Draft（纯函数，不写 Store，不改 Project/Snapshot）
 * 遵循一次性初始化契约：
 * - SCORING：仅安全带入 nameZh / categoryLeaf，重量与尺寸均保持 null
 * - MARKET_VALIDATION：安全带入 nameZh / categoryLeaf，以及 sourceInputs.dims（若为有效 3 正数数组）；重量保持 null
 * - variantLabel：严格保持空字符串，严禁从 project.name / candidateName / 标题猜测
 * @param {object} param0
 * @param {object} param0.project
 * @param {object|null} param0.snapshot
 * @returns {object}
 */
export function buildInitialProjectProductDraft({ project, snapshot }) {
  const draft = {
    nameZh: '',
    categoryLeaf: '',
    packageDimsCm: null,
    grossWeightG: null,
    netWeightG: null,
    productDimsCm: null,
    variantLabel: '',
    nameRu: '',
    brand: '',
    model: '',
    material: '',
    barcode: '',
  }

  const sourceInputs = snapshot?.sourceInputs
  if (sourceInputs) {
    if (typeof sourceInputs.name === 'string') {
      draft.nameZh = sourceInputs.name.trim()
    }
    if (typeof sourceInputs.category_leaf === 'string') {
      draft.categoryLeaf = sourceInputs.category_leaf.trim()
    }
  }

  // 区分快照类型：MARKET_VALIDATION 且 sourceInputs.dims 是 3 个有效正数数组时安全带入
  const isMarketValidation = snapshot?.snapshotKind === 'MARKET_VALIDATION' || Boolean(snapshot?.procurementEvidence)
  if (isMarketValidation && sourceInputs?.dims) {
    const d = sourceInputs.dims
    if (
      Array.isArray(d) &&
      d.length === 3 &&
      d.every((v) => typeof v === 'number' && Number.isFinite(v) && v > 0)
    ) {
      draft.packageDimsCm = [d[0], d[1], d[2]]
    }
  }

  // 铁律：SCORING 尺寸/重量均不带入；MV 重量不自动带入；variantLabel 严禁自动猜测
  return draft
}

/**
 * 校验并合并更新 Project Product Profile
 * @param {object} param0
 * @param {object} param0.current 当前 product
 * @param {object} param0.patch 本次更新字段
 * @returns {object} 校验通过后的纯新对象
 */
export function buildNextProjectProduct({ current = {}, patch = {} }) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new Error('T6_STORE: patch 必须为普通对象（Fail-close）')
  }

  // 1. patch 白名单校验 (Fail-close)
  for (const key of Object.keys(patch)) {
    if (!PROJECT_PRODUCT_FIELDS.includes(key)) {
      throw new Error(`T6_STORE: 未知或非法商品档案字段 "${key}"（Fail-close）`)
    }
  }

  const base = {
    nameZh: '',
    categoryLeaf: '',
    packageDimsCm: null,
    grossWeightG: null,
    netWeightG: null,
    productDimsCm: null,
    variantLabel: '',
    nameRu: '',
    brand: '',
    model: '',
    material: '',
    barcode: '',
  }

  const merged = { ...base, ...current }

  // 2. 将 patch 逐字段合并与类型校验
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'nameZh' || key === 'categoryLeaf') {
      if (typeof value !== 'string') {
        throw new Error(`T6_STORE: ${key} 必须是字符串`)
      }
      merged[key] = value.trim()
    } else if (['variantLabel', 'nameRu', 'brand', 'model', 'material', 'barcode'].includes(key)) {
      if (typeof value !== 'string') {
        throw new Error(`T6_STORE: ${key} 必须是字符串`)
      }
      merged[key] = value.trim()
    } else if (key === 'grossWeightG' || key === 'netWeightG') {
      if (value === null) {
        merged[key] = null
      } else if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        merged[key] = value
      } else {
        throw new Error(`T6_STORE: ${key} 必须为 null 或大于 0 的有效正数`)
      }
    } else if (key === 'packageDimsCm' || key === 'productDimsCm') {
      if (value === null) {
        merged[key] = null
      } else if (
        Array.isArray(value) &&
        value.length === 3 &&
        value.every((v) => typeof v === 'number' && Number.isFinite(v) && v > 0)
      ) {
        merged[key] = [value[0], value[1], value[2]]
      } else {
        throw new Error(`T6_STORE: ${key} 必须为 null 或包含 3 个大于 0 正数的数组 [L, W, H]`)
      }
    }
  }

  // 3. Required Core 校验
  if (!merged.nameZh || merged.nameZh.trim() === '') {
    throw new Error('T6_STORE: 商品中文品名 (nameZh) 为必填项（Fail-close）')
  }
  if (!merged.categoryLeaf || merged.categoryLeaf.trim() === '') {
    throw new Error('T6_STORE: 叶子类目 (categoryLeaf) 为必填项（Fail-close）')
  }

  // 4. 返回纯新对象，确保只包含 12 个字段
  const result = {}
  for (const f of PROJECT_PRODUCT_FIELDS) {
    result[f] = merged[f] !== undefined ? merged[f] : base[f]
  }
  return result
}
