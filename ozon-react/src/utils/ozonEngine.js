/**
 * Ozon rFBS 跨境核算 - 共享计算引擎
 * 抽自 ShippingCalc.jsx 与 PricingCalc.jsx，避免两份重复代码
 * 依据《CEL产品资费表 V5.23》
 */

// 汇率：1₽ = 0.09¥（与原组件保持一致）
export const R = 0.09

/**
 * CEL 物流渠道分组（按类目组织）
 * 用于"利润测算"Tab：展示全部渠道对比
 */
export const CHANNEL_GROUPS = [
  {
    category: 'Extra Small',
    categoryZh: '超级轻小件',
    channels: [
      { id: 'express_xs', name: 'Express Extra Small', speed: '5-10天', rate: 46.8, base: 3.12, weightMax: 0.5, sumMax: 90, sideMax: 60, priceMax: 1500, volumetric: false },
      { id: 'standard_xs', name: 'Standard Extra Small', speed: '10-15天', rate: 36.4, base: 3.12, weightMax: 0.5, sumMax: 90, sideMax: 60, priceMax: 1500, volumetric: false },
      { id: 'economy_xs', name: 'Economy Extra Small', speed: '15-25天', rate: 26, base: 3.12, weightMax: 0.5, sumMax: 90, sideMax: 60, priceMax: 1500, volumetric: false },
    ],
  },
  {
    category: 'Budget',
    categoryZh: '低客单价标准件',
    channels: [
      { id: 'express_budget', name: 'Express Budget', speed: '5-10天', rate: 34.32, base: 23.92, weightMin: 0.5, weightMax: 30, sumMax: 150, sideMax: 60, priceMax: 1500, volumetric: false },
      { id: 'standard_budget', name: 'Standard Budget', speed: '10-15天', rate: 26, base: 23.92, weightMin: 0.5, weightMax: 30, sumMax: 150, sideMax: 60, priceMax: 1500, volumetric: false },
      { id: 'economy_budget', name: 'Economy Budget', speed: '15-25天', rate: 17.68, base: 23.92, weightMin: 0.5, weightMax: 30, sumMax: 150, sideMax: 60, priceMax: 1500, volumetric: false },
    ],
  },
  {
    category: 'Small',
    categoryZh: '小件',
    channels: [
      { id: 'express_small', name: 'Express Small', speed: '5-10天', rate: 46.8, base: 16.64, weightMax: 2, sumMax: 150, sideMax: 60, priceMin: 1501, priceMax: 7000, volumetric: false },
      { id: 'standard_small', name: 'Standard Small', speed: '10-15天', rate: 36.4, base: 16.64, weightMax: 2, sumMax: 150, sideMax: 60, priceMin: 1501, priceMax: 7000, volumetric: false },
      { id: 'economy_small', name: 'Economy Small', speed: '15-25天', rate: 26, base: 16.64, weightMax: 2, sumMax: 150, sideMax: 60, priceMin: 1501, priceMax: 7000, volumetric: false },
    ],
  },
  {
    category: 'Big',
    categoryZh: '大件',
    channels: [
      { id: 'standard_big', name: 'Standard Big', speed: '10-15天', rate: 26, base: 37.44, weightMin: 2, weightMax: 30, sumMax: 310, sideMax: 150, priceMin: 1501, priceMax: 7000, volumetric: true, volDiv: 12000, chargeWeightMax: 31 },
      { id: 'economy_big', name: 'Economy Big', speed: '15-25天', rate: 17.68, base: 37.44, weightMin: 2, weightMax: 30, sumMax: 310, sideMax: 150, priceMin: 1501, priceMax: 7000, volumetric: true, volDiv: 12000, chargeWeightMax: 31 },
    ],
  },
  {
    category: 'Premium Small',
    categoryZh: '高客单价小件',
    channels: [
      { id: 'express_psmall', name: 'Express Premium Small', speed: '5-10天', rate: 46.8, base: 22.88, weightMax: 5, sumMax: 250, sideMax: 150, priceMin: 7001, priceMax: 250000, volumetric: false },
      { id: 'standard_psmall', name: 'Standard Premium Small', speed: '10-15天', rate: 36.4, base: 22.88, weightMax: 5, sumMax: 250, sideMax: 150, priceMin: 7001, priceMax: 250000, volumetric: false },
      { id: 'economy_psmall', name: 'Economy Premium Small', speed: '15-25天', rate: 26, base: 22.88, weightMax: 5, sumMax: 250, sideMax: 150, priceMin: 7001, priceMax: 250000, volumetric: false },
    ],
  },
  {
    category: 'Premium Big',
    categoryZh: '高客单价大件',
    channels: [
      { id: 'standard_pbig', name: 'Standard Premium Big', speed: '10-15天', rate: 29.12, base: 64.48, weightMin: 5, weightMax: 30, sumMax: 310, sideMax: 150, priceMin: 7001, priceMax: 250000, volumetric: true, volDiv: 12000, chargeWeightMax: 80 },
      { id: 'economy_pbig', name: 'Economy Premium Big', speed: '15-25天', rate: 23.92, base: 64.48, weightMin: 5, weightMax: 30, sumMax: 310, sideMax: 150, priceMin: 7001, priceMax: 250000, volumetric: true, volDiv: 12000, chargeWeightMax: 80 },
    ],
  },
  {
    category: 'HK',
    categoryZh: '中国香港',
    channels: [
      { id: 'express_hk', name: 'Express HK 香港空运', speed: '7-12天', rate: 96, base: 19, rateUnit: 'per100g', weightMax: 25, sumMax: 310, sideMax: 150, priceMin: 1, priceMax: 500000, volumetric: 'conditional', volDiv: 6000, volThreshold: 60 },
    ],
  },
]

/**
 * 扁平化全部渠道（用于"多规格对比"Tab：自动找最低运费）
 */
export const ALL_CHANNELS = CHANNEL_GROUPS.flatMap((g) => g.channels)

/**
 * 单渠道运费计算
 * @param {Object} ch 渠道配置
 * @param {number} price 售价(₽)
 * @param {number} weight 实重(kg)
 * @param {number} length 长(cm)
 * @param {number} width 宽(cm)
 * @param {number} height 高(cm)
 * @returns {Object|null} {cost, chargeWeight, volumetricWeight} 或 null(不适用)
 */
export const calcShipping = (ch, price, weight, length, width, height) => {
  const sum = length + width + height
  const sideCheck = length <= ch.sideMax && width <= ch.sideMax && height <= ch.sideMax
  const sumCheck = sum <= ch.sumMax
  const priceCheck = price >= (ch.priceMin || 0) && price <= ch.priceMax
  const weightMin = ch.weightMin || 0
  const weightCheck = weight >= weightMin && weight <= ch.weightMax

  if (!sideCheck || !sumCheck || !priceCheck || !weightCheck) return null

  let chargeWeight = weight
  let volumetricWeight = null

  if (ch.volumetric === true) {
    volumetricWeight = (length * width * height) / ch.volDiv
    chargeWeight = Math.max(weight, volumetricWeight)
    if (chargeWeight > ch.chargeWeightMax) return null
  } else if (ch.volumetric === 'conditional') {
    if (sum > ch.volThreshold) {
      volumetricWeight = Math.ceil((length * width * height) / ch.volDiv * 10) / 10
      chargeWeight = Math.max(weight, volumetricWeight)
    }
    chargeWeight = Math.ceil(chargeWeight * 10) / 10
  }

  let cost
  if (ch.rateUnit === 'per100g') {
    cost = (Math.ceil(chargeWeight * 10) / 10) * ch.rate + ch.base
  } else {
    cost = chargeWeight * ch.rate + ch.base
  }

  return {
    cost: Math.round(cost * 100) / 100,
    chargeWeight: Math.round(chargeWeight * 1000) / 1000,
    volumetricWeight: volumetricWeight ? Math.round(volumetricWeight * 1000) / 1000 : null,
  }
}

/**
 * 自动筛选运费最低的渠道
 * @returns {Object|null} {name, cost, chargeWeight, volumetricWeight, channel}
 */
export const getBestShipping = (price, weight, length, width, height) => {
  let best = null
  let bestCost = Infinity
  for (const ch of ALL_CHANNELS) {
    const res = calcShipping(ch, price, weight, length, width, height)
    if (res !== null && res.cost < bestCost) {
      bestCost = res.cost
      best = { name: ch.name, cost: res.cost, chargeWeight: res.chargeWeight, volumetricWeight: res.volumetricWeight, channel: ch }
    }
  }
  return best
}

/**
 * 计算单规格行级利润（用于多规格对比 Tab）
 * 上架价 → 6折折后价 → 国内成本 → 跨境物流 → 平台成本 → 退货损失 → 毛利
 * @param {Object} sku 单规格行数据
 * @param {Object} common 公共费率 { commission, adRate, paymentFee, agencyFee, returnLoss }
 * @returns {Object} 计算结果
 */
export const calcRow = (sku, common) => {
  const listPrice = Number(sku.listPrice) || 0
  const price = Math.round(listPrice * 0.6 * 100) / 100
  const weight = Number(sku.weight) || 0
  const length = Number(sku.length) || 0
  const width = Number(sku.width) || 0
  const height = Number(sku.height) || 0
  const purchaseCost = Number(sku.purchaseCost) || 0
  const domesticShip = Number(sku.domesticShip) || 0
  const labelFee = Number(sku.labelFee) || 0
  const priceRMB = Math.round(price * R * 100) / 100
  const listPriceRMB = Math.round(listPrice * R * 100) / 100
  const domesticCost = purchaseCost + domesticShip + labelFee
  const bestShip = price && weight && length && width && height ? getBestShipping(price, weight, length, width, height) : null
  const agencyFee = Number(common?.agencyFee) || 0
  const platformRate = (Number(common?.commission) || 0) + (Number(common?.adRate) || 0) + (Number(common?.paymentFee) || 0)
  const returnLoss = Number(common?.returnLoss) || 0
  const agencyAmtRub = Math.min(200, Math.max(15, (price * agencyFee) / 100))
  const agencyAmt = Math.round(agencyAmtRub * R * 100) / 100
  const crossBorderCost = bestShip ? bestShip.cost + agencyAmt : null
  const platformCost = (priceRMB * platformRate) / 100
  const returnAmt = (priceRMB * returnLoss) / 100
  const profit = crossBorderCost !== null ? Math.round((priceRMB - domesticCost - crossBorderCost - platformCost - returnAmt) * 100) / 100 : null
  const profitRate = profit !== null && priceRMB > 0 ? Math.round((profit / priceRMB) * 1000) / 10 : null
  return { listPrice, price, priceRMB, listPriceRMB, domesticCost, bestShip, crossBorderCost, platformCost, returnAmt, profit, profitRate }
}

/**
 * 单渠道完整利润测算（用于单规格测算 Tab）
 * @param {Object} ch 渠道配置
 * @param {number} price 售价(₽)
 * @param {number} weight 实重(kg)
 * @param {number} length 长(cm)
 * @param {number} width 宽(cm)
 * @param {number} height 高(cm)
 * @param {Object} params 全部参数 { purchaseCost, domesticShipping, labelingFee, commission, adRate, paymentFee, agencyFee, returnLoss }
 */
export const calcChannelProfit = (ch, price, weight, length, width, height, params) => {
  const res = calcShipping(ch, price, weight, length, width, height)
  if (!res) return null

  const purchaseCost = Number(params.purchaseCost) || 0
  const domesticShipping = Number(params.domesticShipping) || 0
  const labelingFee = Number(params.labelingFee) || 0
  const commission = Number(params.commission) || 0
  const adRate = Number(params.adRate) || 0
  const paymentFee = Number(params.paymentFee) || 0
  const agencyFee = Number(params.agencyFee) || 0
  const returnLoss = Number(params.returnLoss) || 0

  const domesticCost = purchaseCost + domesticShipping + labelingFee
  const platformCostRate = commission + adRate + paymentFee
  const priceRMB = Math.round(price * R * 100) / 100
  const agencyAmtRub = Math.min(200, Math.max(15, (price * agencyFee) / 100))
  const agencyAmt = Math.round(agencyAmtRub * R * 100) / 100
  const crossBorderCost = res.cost + agencyAmt
  const platformAmt = (priceRMB * platformCostRate) / 100
  const returnAmt = (priceRMB * returnLoss) / 100
  const profit = Math.round((priceRMB - domesticCost - crossBorderCost - platformAmt - returnAmt) * 100) / 100
  const profitRate = priceRMB > 0 ? Math.round((profit / priceRMB) * 1000) / 10 : 0

  return {
    result: res,
    profit,
    profitRate,
    costBreakdown: {
      domesticCost,
      celShipping: res.cost,
      agencyAmt: Math.round(agencyAmt * 100) / 100,
      crossBorderCost: Math.round(crossBorderCost * 100) / 100,
      commissionAmt: Math.round((priceRMB * commission) / 100 * 100) / 100,
      adAmt: Math.round((priceRMB * adRate) / 100 * 100) / 100,
      paymentAmt: Math.round((priceRMB * paymentFee) / 100 * 100) / 100,
      platformAmt: Math.round(platformAmt * 100) / 100,
      returnAmt: Math.round(returnAmt * 100) / 100,
    },
  }
}

/**
 * 多产品定义（用于多规格对比 Tab）
 */
export const PRICING_PRODUCTS = [
  { id: 'hairmask', name: '发膜', color: 'purple' },
  { id: 'spray', name: '精油喷雾', color: 'indigo' },
  { id: 'gloves', name: '家用手套', color: 'teal' },
]

/**
 * 产品颜色映射
 */
export const PRODUCT_COLORS = {
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', bar: 'bg-purple-400', dot: 'bg-purple-500', light: 'bg-purple-100' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', bar: 'bg-indigo-400', dot: 'bg-indigo-500', light: 'bg-indigo-100' },
  teal: { bg: 'bg-teal-50', text: 'text-teal-700', bar: 'bg-teal-400', dot: 'bg-teal-500', light: 'bg-teal-100' },
}

/**
 * Ozon 商品销售佣金表数据（2025.12.1 起）
 * 字段顺序：[类目模块, 商品类目, ≤1500₽rFBS, ≤1500₽FBP, ≤5000₽rFBS, ≤5000₽FBP, >5000₽rFBS, >5000₽FBP]
 */
export const COMMISSION_TABLE = [
  ['药房商品', '药店', '12%', '11%', '14%', '13%', '18%', '17%'],
  ['', '矫形用品', '12%', '11%', '17%', '16%', '17%', '16%'],
  ['', '成人用品', '12%', '11%', '14%', '13%', '21%', '20%'],
  ['', '辅助药品', '12%', '11%', '15%', '14%', '15%', '14%'],
  ['', '电子烟及配件', '12%', '11%', '24%', '23%', '24%', '23%'],
  ['', '维生素和膳食补充剂', '12%', '11%', '18%', '17%', '18%', '17%'],
  ['家居与汽车用品', '装饰、清洁与储物', '12%', '11%', '14%', '13%', '18%', '17%'],
  ['', '住宅和花园', '12%', '11%', '14%', '13%', '20%', '19%'],
  ['', '汽车用品', '12%', '11%', '17%', '16%', '17%', '16%'],
  ['', '手动工具和测量仪器', '12%', '11%', '17%', '16%', '17%', '16%'],
  ['', '建筑和装修', '12%', '11%', '18%', '17%', '18%', '17%'],
  ['', '康复设备', '12%', '11%', '14%', '13%', '17%', '16%'],
  ['', '重型建筑', '11%', '10%', '11%', '10%', '11%', '10%'],
  ['', '儿童餐具', '12%', '11%', '14%', '13%', '18%', '17%'],
  ['', '家具', '10%', '9%', '10%', '9%', '10%', '9%'],
  ['', '轮胎', '10%', '9%', '10%', '9%', '10%', '9%'],
  ['', '装饰材料', '12%', '11%', '14%', '13%', '14%', '13%'],
  ['', '卫浴设备', '12%', '11%', '14%', '13%', '14%', '13%'],
  ['', '日化', '12%', '11%', '18%', '17%', '18%', '17%'],
  ['', '建筑装修和园艺设备', '12%', '11%', '16%', '15%', '16%', '15%'],
  ['', '新年装饰用品', '12%', '11%', '14%', '13%', '20%', '19%'],
  ['', '电动滑板车', '12%', '11%', '17%', '16%', '17%', '16%'],
  ['', '船只马达和充气艇', '12%', '11%', '15%', '14%', '15%', '14%'],
  ['', '自行车', '12%', '11%', '15%', '14%', '15%', '14%'],
  ['', '水过滤器', '12%', '11%', '17%', '16%', '17%', '16%'],
  ['', '运动手表', '12%', '11%', '12%', '11%', '12%', '11%'],
  ['', '成品房', '12%', '11%', '14.5%', '13.5%', '14.5%', '13.5%'],
  ['', '汽车/汽车房/特种设备', '10%', '9%', '10%', '9%', '10%', '9%'],
  ['美容', '服装和配饰', '12%', '11%', '14%', '13%', '20.5%', '19.5%'],
  ['', '鞋类', '12%', '11%', '12%', '11%', '12%', '11%'],
  ['', '美容与健康', '12%', '11%', '14%', '13%', '18%', '17%'],
  ['', '专业口腔护理', '12%', '11%', '17%', '16%', '17%', '16%'],
  ['', '外衣', '10%', '9%', '10%', '9%', '10%', '9%'],
  ['', '专业医疗设备', '12%', '11%', '17%', '16%', '17%', '16%'],
  ['其它', '包装袋', '10%', '9%', '10%', '9%', '10%', '9%'],
  ['儿童用品', '儿童纺织品', '12%', '11%', '19%', '18%', '19%', '18%'],
  ['', '儿童运动用品', '12%', '11%', '14%', '13%', '14%', '13%'],
  ['', '儿童电子/家具/配件', '12%', '11%', '14%', '13%', '20%', '19%'],
  ['', '玩具', '12%', '11%', '14%', '13%', '17.5%', '16.5%'],
  ['', '儿童卫生用品', '12%', '11%', '18%', '17%', '18%', '17%'],
  ['', '婴儿推车和汽车安全座椅', '12%', '11%', '14%', '13%', '20%', '19%'],
  ['宠物用品', '宠物饲料与农场用品', '12%', '11%', '13%', '12%', '13%', '12%'],
  ['', '宠物用品', '12%', '11%', '14%', '13%', '15%', '14%'],
  ['', '宠物卫生与护理', '12%', '11%', '13%', '12%', '13%', '12%'],
  ['快速消费品', '食品', '11%', '10%', '11%', '10%', '11%', '10%'],
  ['', '新鲜食品', '11%', '10%', '11%', '10%', '11%', '10%'],
  ['', '个人卫生用品', '12%', '11%', '18%', '17%', '18%', '17%'],
  ['', '隐形眼镜', '12%', '11%', '18%', '17%', '18%', '17%'],
  ['爱好与运动', '运动和休闲用品', '12%', '11%', '19%', '18%', '19%', '18%'],
  ['', '兴趣/创意与文具', '12%', '11%', '14%', '13%', '16%', '15%'],
  ['', '书籍', '12%', '11%', '22%', '21%', '22%', '21%'],
  ['', '蹦床/游泳池/立式桨板', '12%', '11%', '16%', '15%', '16%', '15%'],
  ['', '运动营养', '12%', '11%', '15%', '14%', '15%', '14%'],
  ['', '运动员营养补充剂', '12%', '11%', '18%', '17%', '18%', '17%'],
  ['电子产品', '电子产品配饰', '12%', '11%', '20%', '19%', '20%', '19%'],
  ['', '音视频设备配件', '12%', '11%', '14.5%', '13.5%', '14.5%', '13.5%'],
  ['', '家用电器', '10%', '9%', '10%', '9%', '10%', '9%'],
  ['', '电视机', '9%', '8%', '9%', '8%', '9%', '8%'],
  ['', '美容设备', '12%', '11%', '14%', '13%', '16%', '15%'],
  ['', '办公电脑/收银/仓储设备', '12%', '11%', '16%', '15%', '16%', '15%'],
  ['', '游戏主机/摄影器材', '12%', '11%', '12.5%', '11.5%', '12.5%', '11.5%'],
  ['', '电脑外设及耗材', '12%', '11%', '14.5%', '13.5%', '14.5%', '13.5%'],
  ['', '非内置大型家电', '9%', '8%', '9%', '8%', '9%', '8%'],
  ['', '智能手机和平板', '11.5%', '10.5%', '11.5%', '10.5%', '11.5%', '10.5%'],
  ['', '电脑及笔记本配件', '12%', '11%', '12.5%', '11.5%', '12.5%', '11.5%'],
  ['', 'Yandex智能音箱', '12%', '11%', '14.5%', '13.5%', '14.5%', '13.5%'],
  ['', '嵌入式大型家电', '9%', '8%', '9%', '8%', '9%', '8%'],
  ['', '显示器', '12%', '11%', '12.5%', '11.5%', '12.5%', '11.5%'],
  ['', '智能手表/健身手环', '11.5%', '10.5%', '11.5%', '10.5%', '11.5%', '10.5%'],
  ['', '电子游戏', '12%', '11%', '14.5%', '13.5%', '14.5%', '13.5%'],
  ['', '台式电脑', '9%', '8%', '9%', '8%', '9%', '8%'],
  ['', '电脑设备配件', '12%', '11%', '13.5%', '12.5%', '13.5%', '12.5%'],
  ['', '笔记本电脑', '8%', '7%', '8%', '7%', '8%', '7%'],
  ['', '戴森配件', '6%', '5%', '6%', '5%', '6%', '5%'],
  ['', '索尼耳机', '8%', '7%', '8%', '7%', '8%', '7%'],
  ['', '三星TWS耳机', '8%', '7%', '8%', '7%', '8%', '7%'],
  ['', '三星智能手表/手环', '8%', '7%', '8%', '7%', '8%', '7%'],
  ['', '三星智能手机/平板', '8%', '7%', '8%', '7%', '8%', '7%'],
  ['', '苹果设备', '7%', '6%', '7%', '6%', '7%', '6%'],
  ['', '戴森设备', '8%', '7%', '8%', '7%', '8%', '7%'],
]
