export const CHANNEL_PRESETS = {
  miniapp: { name: '小程序私域', rate: 0.006 },
  douyin: { name: '抖音小店', rate: 0.056 },
  taobao: { name: '淘宝/天猫', rate: 0.066 },
  jd: { name: '京东', rate: 0.096 },
  pdd: { name: '拼多多', rate: 0.012 },
}

export const COMPETITORS = [
  { brand: '名创优品', sku: '无火香薰50ml', price: 19.9, ml: 50, tier: 1, brandPower: 3, channel: '线下门店', desc: '门店遍布全国，SKU极多' },
  { brand: '名创优品', sku: '无火香薰120ml', price: 49.9, ml: 120, tier: 1, brandPower: 3, channel: '线下门店', desc: '极致性价比，所见即所得' },
  { brand: '网易严选', sku: '无火香薰150ml', price: 79, ml: 150, tier: 1, brandPower: 5, channel: '电商', desc: '大牌同厂，源头直采' },
  { brand: '京东京造', sku: '无火香薰150ml', price: 89, ml: 150, tier: 1, brandPower: 5, channel: '电商', desc: '品牌背书强，品质稳定' },
  { brand: '气味图书馆', sku: '无火香薰100ml', price: 99, ml: 100, tier: 1, brandPower: 6, channel: '电商', desc: '凉白开、大白兔情怀香型' },
  { brand: '气味图书馆', sku: '无火香薰150ml', price: 129, ml: 150, tier: 1, brandPower: 6, channel: '电商', desc: '独特香型记忆点' },
  { brand: 'Jupiter&Venus', sku: '无火香薰100ml', price: 59, ml: 100, tier: 1, brandPower: 4, channel: '电商', desc: '大牌平替，蓝风铃等香型' },
  { brand: 'Jupiter&Venus', sku: '无火香薰150ml', price: 89, ml: 150, tier: 1, brandPower: 4, channel: '电商', desc: '外观设计在线，年轻用户' },
  { brand: '冰希黎', sku: '麋鹿丛林200ml', price: 59, ml: 200, tier: 1, brandPower: 5, channel: '电商', desc: '调香师品牌，性价比高' },
  { brand: '冰希黎', sku: '精粹礼盒180ml', price: 129, ml: 180, tier: 2, brandPower: 6, channel: '电商', desc: '梨木桂花，礼盒装送礼' },
  { brand: '节气盒子', sku: '白桃乌龙100ml', price: 89, ml: 100, tier: 1, brandPower: 5, channel: '电商', desc: '节气文化，茶香系列' },
  { brand: '节气盒子', sku: '东方瓶花150ml', price: 139, ml: 150, tier: 2, brandPower: 6, channel: '电商', desc: '木兰坠露，东方美学' },
  { brand: '尹谜', sku: '无火香薰礼盒150ml', price: 79, ml: 150, tier: 1, brandPower: 3, channel: '电商', desc: '渐变瓶身，网红款' },
  { brand: '西苔CITTA', sku: '无火香薰150ml', price: 168, ml: 150, tier: 2, brandPower: 7, channel: '电商', desc: '中国植物原料，东方美学' },
  { brand: '香遇MEET YOU', sku: '无火香薰150ml', price: 158, ml: 150, tier: 2, brandPower: 6, channel: '电商', desc: '东方香调创新，定制调香' },
  { brand: '宋朝SONG DYNASTY', sku: '无火香薰150ml', price: 198, ml: 150, tier: 2, brandPower: 7, channel: '电商', desc: '宋代香文化，空间定制' },
  { brand: '芬享Felshare', sku: '醉花阴150ml', price: 120, ml: 150, tier: 2, brandPower: 5, channel: '电商', desc: '法国品牌，东方花香调' },
  { brand: 'RE调香室', sku: '莫奈花园150ml', price: 200, ml: 150, tier: 2, brandPower: 7, channel: '电商', desc: '沙龙香氛，专业调香' },
  { brand: '最忆ZUIYI', sku: '无火香薰200ml', price: 268, ml: 200, tier: 3, brandPower: 8, channel: '电商', desc: '冠军代言，东方禅意美学' },
  { brand: '观夏To Summer', sku: '无火香薰200ml', price: 368, ml: 200, tier: 3, brandPower: 9, channel: '线下+电商', desc: '东方美学，私域运营极强' },
  { brand: '野兽派The Beast', sku: '联名香薰礼盒', price: 399, ml: 200, tier: 3, brandPower: 9, channel: '线下门店', desc: 'IP联名，送礼硬通货' },
  { brand: '闻献DOCUMENTS', sku: '无火香薰200ml', price: 520, ml: 200, tier: 3, brandPower: 10, channel: '设计师店', desc: '禅酷风格，高净值人群' },
  { brand: 'meltseason', sku: '无火香薰200ml', price: 498, ml: 200, tier: 3, brandPower: 9, channel: '设计师店', desc: '国际资本，时尚圈宠儿' },
  { brand: 'KASE', sku: '情绪香氛200ml', price: 328, ml: 200, tier: 3, brandPower: 8, channel: '设计师店', desc: '情绪香氛，科学调香' },
  { brand: '黑爪BLACK PAW', sku: '龙珠茉莉180ml', price: 227, ml: 180, tier: 3, brandPower: 8, channel: '电商', desc: '茶香调，联名礼盒' },
  { brand: 'Aromame弥香', sku: '港岛酒店200ml', price: 299, ml: 200, tier: 3, brandPower: 8, channel: '电商', desc: '五星级酒店同款香氛' },
  { brand: '白牌A', sku: '无火香薰100ml', price: 29.9, ml: 100, tier: 4, brandPower: 1, channel: '拼多多', desc: '便宜大碗，品质参差' },
  { brand: '白牌B', sku: '无火香薰150ml', price: 39.9, ml: 150, tier: 4, brandPower: 1, channel: '抖音', desc: '直播间走量' },
  { brand: '白牌C', sku: '无火香薰200ml', price: 49.9, ml: 200, tier: 4, brandPower: 1, channel: '拼多多', desc: '仿大牌香型' },
]

export const TIER_LABELS = { 1: '极致性价比', 2: '新锐国货', 3: '高端/设计师', 4: '白牌/工厂货' }
export const TIER_COLORS = { 1: '#8B9DC3', 2: '#D4A5A5', 3: '#C3B4D1', 4: '#B0B0B0' }

export const PRICE_BANDS = [
  { range: '0-50元', label: '白牌/低价区', color: '#B0B0B0', brands: '白牌、名创入门款' },
  { range: '50-100元', label: '大众品牌区', color: '#8B9DC3', brands: '名创、严选、京造、J&V、冰希黎、节气盒子、尹谜' },
  { range: '100-200元', label: '⚠️ 死亡谷', color: '#F44336', brands: '西苔、香遇、宋朝、芬享、节气盒子高端款、冰希黎礼盒' },
  { range: '200-400元', label: '高端品牌区', color: '#C3B4D1', brands: '最忆、观夏、野兽派、KASE、黑爪、Aromame弥香' },
  { range: '400元+', label: '设计师品牌区', color: '#9C27B0', brands: '闻献、meltseason' },
]

export const AD_COST_BY_PRICE = [
  { label: '白牌(0-50元)', platformAd: 20, privateAd: 5, fill: '#B0B0B0' },
  { label: '大众(50-100元)', platformAd: 13, privateAd: 4, fill: '#8B9DC3' },
  { label: '新锐(100-200元)', platformAd: 15, privateAd: 4, fill: '#D4A5A5' },
  { label: '高端(200-400元)', platformAd: 25, privateAd: 6, fill: '#C3B4D1' },
  { label: '设计师(400元+)', platformAd: 28, privateAd: 8, fill: '#9C27B0' },
]

export function calcProfit(p) {
  const ch = CHANNEL_PRESETS[p.channel] || CHANNEL_PRESETS.miniapp
  const costPerBottle = p.factoryPrice + p.packageCost
  const platformFee = p.retailPrice * ch.rate
  const adCost = p.retailPrice * p.adRate
  const afterSalesLoss = p.retailPrice * p.returnRate
  const grossProfit = p.retailPrice - costPerBottle
  const totalExpense = costPerBottle + p.shipping + platformFee + adCost + afterSalesLoss
  const netProfit = p.retailPrice - totalExpense
  const netRate = p.retailPrice > 0 ? netProfit / p.retailPrice : 0
  return { costPerBottle, platformFee, adCost, afterSalesLoss, grossProfit, netProfit, netRate, totalExpense }
}

export function getProfitLevel(netRate) {
  if (netRate < 0.05) return { label: '亏本/不可行', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' }
  if (netRate < 0.10) return { label: '利润太薄', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' }
  if (netRate < 0.20) return { label: '可以赚钱', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' }
  return { label: '利润很好', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' }
}

export function generateReport(planA, planB, resultA, resultB) {
  const chA = CHANNEL_PRESETS[planA.channel] || CHANNEL_PRESETS.miniapp
  const chB = CHANNEL_PRESETS[planB.channel] || CHANNEL_PRESETS.miniapp
  const lines = []

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('  一句话结论')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('')

  if (resultA.netRate < 0.05) {
    lines.push(`❌ 方案A不可行：净利率仅${(resultA.netRate * 100).toFixed(1)}%，卖一瓶亏一瓶`)
  } else if (resultA.netRate < 0.10) {
    lines.push(`⚠️ 方案A勉强可行：净利率${(resultA.netRate * 100).toFixed(1)}%，只能小规模私域，不能投广告`)
  } else if (resultA.netRate < 0.20) {
    lines.push(`✅ 方案A可行：净利率${(resultA.netRate * 100).toFixed(1)}%，可以适度投放广告`)
  } else {
    lines.push(`🟢 方案A利润健康：净利率${(resultA.netRate * 100).toFixed(1)}%，有充足空间做品牌投放`)
  }

  if (resultB.netRate > resultA.netRate) {
    lines.push(`✅ 方案B更优：净利率${(resultB.netRate * 100).toFixed(1)}%，每瓶净赚¥${resultB.netProfit.toFixed(1)}`)
  }

  lines.push('')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('  利润对比（每瓶）')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('')
  lines.push(`方案A  零售¥${planA.retailPrice}  出厂¥${planA.factoryPrice}  渠道:${chA.name}`)
  lines.push(`  总成本 ¥${resultA.totalExpense.toFixed(1)} = 出厂+包材¥${resultA.costPerBottle.toFixed(0)} + 物流¥${planA.shipping} + 平台费¥${resultA.platformFee.toFixed(1)} + 广告¥${resultA.adCost.toFixed(1)} + 售后¥${resultA.afterSalesLoss.toFixed(1)}`)
  lines.push(`  净利润 ¥${resultA.netProfit.toFixed(1)}/瓶  净利率 ${(resultA.netRate * 100).toFixed(1)}%`)
  lines.push('')
  lines.push(`方案B  零售¥${planB.retailPrice}  出厂¥${planB.factoryPrice}  渠道:${chB.name}`)
  lines.push(`  总成本 ¥${resultB.totalExpense.toFixed(1)} = 出厂+包材¥${resultB.costPerBottle.toFixed(0)} + 物流¥${planB.shipping} + 平台费¥${resultB.platformFee.toFixed(1)} + 广告¥${resultB.adCost.toFixed(1)} + 售后¥${resultB.afterSalesLoss.toFixed(1)}`)
  lines.push(`  净利润 ¥${resultB.netProfit.toFixed(1)}/瓶  净利率 ${(resultB.netRate * 100).toFixed(1)}%`)
  lines.push('')

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('  市场定位诊断')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('')

  if (planA.retailPrice >= 80 && planA.retailPrice <= 200) {
    lines.push(`你的定价¥${planA.retailPrice}落在"死亡谷"（80-200元）：`)
    lines.push('')
    lines.push('  向上 → 打不过野兽派、观夏（品牌力+故事+包装）')
    lines.push('  向下 → 打不过名创优品、网易严选（价格+渠道+知名度）')
    lines.push('  同级 → 宋朝、西苔、香遇都在抢这个价位段')
    lines.push('')
    lines.push('  在这个价位段活下来的品牌，都至少做到一点：')
    lines.push('  • 安全背书：母婴/宠物/孕妇可用，IFRA合规声明')
    lines.push('  • 差异化故事：调香师背景、香料产地、留香数据')
    lines.push('  • 礼品属性：包装像礼物，送人不尴尬')
  } else if (planA.retailPrice < 80) {
    lines.push(`定价¥${planA.retailPrice}走量路线，和名创优品/网易严选正面竞争。`)
    lines.push('  优势：价格门槛低，容易起量')
    lines.push('  风险：利润薄，品牌溢价为零，只能靠渠道和供应链效率取胜')
  } else {
    lines.push(`定价¥${planA.retailPrice}进入高端区间，需要强品牌力支撑。`)
    lines.push('  优势：单瓶利润高，品牌溢价空间大')
    lines.push('  风险：没有观夏/野兽派的品牌积累，消费者不买单')
  }

  lines.push('')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('  行动建议')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('')

  if (resultA.netRate < 0.10 && resultB.netRate >= 0.10) {
    lines.push(`1. 降价放量：出厂价从¥${planA.factoryPrice}降到¥${planB.factoryPrice}，净利率从${(resultA.netRate * 100).toFixed(1)}%提升到${(resultB.netRate * 100).toFixed(1)}%`)
    lines.push(`   月销从500瓶可提升到3000+瓶，工厂年出货量提升约6倍`)
  }

  if (planA.channel === 'miniapp') {
    lines.push('2. 走私域小程序：平台费率仅0.6%，是利润最高的渠道')
    lines.push('   但私域流量有限，需要搭配内容种草引流')
  } else {
    lines.push(`2. 当前渠道${chA.name}费率${(chA.rate * 100).toFixed(1)}%，走私域小程序仅0.6%，利润空间更大`)
  }

  lines.push('3. 包材升级：消费者在100-200元价位最在意"开箱体验"')
  lines.push('   礼盒+手提袋+感谢卡，成本增加5-8元，但溢价空间20-50元')

  if (resultA.netRate >= 0.10) {
    lines.push('4. 广告投放：净利率>10%可以开始投流，先投小红书种草，再转小程序成交')
  } else {
    lines.push('4. 暂不投广告：净利率<10%投广告会亏，先做私域积累口碑')
  }

  lines.push('5. 安全合规：提供IFRA声明+MSDS报告，这是和白牌拉开差距的最低门槛')

  return lines.join('\n')
}
