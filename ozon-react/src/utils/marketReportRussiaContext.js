const SOURCES = {
  akitH1_2026: {
    id: 'akit-h1-2026',
    title: 'АКИТ：2026 年上半年俄罗斯网络零售',
    publisher: '俄罗斯网络贸易企业协会（АКИТ）',
    asOf: '2026-06-30',
    url: 'https://www.akit.ru/news/internet-torgovlya-v-pervom-polugodii-2026-7-2-trln-rublej',
  },
  ozonAnalytics: {
    id: 'ozon-analytics-tools',
    title: 'Ozon 官方卖家分析工具说明',
    publisher: 'Ozon Help',
    asOf: '2026-09-10',
    url: 'https://docs.ozon.com/global/analytics/analytics-and-metrics/analytics-tools/?country=OTHER',
  },
  furnitureSafety: {
    id: 'eec-tr-cu-025-2012',
    title: 'ТР ТС 025/2012 家具产品安全技术法规',
    publisher: '欧亚经济委员会',
    url: 'https://eec.eaeunion.org/upload/medialibrary/f2f/RS_P_32.pdf',
  },
  vehicleSafety: {
    id: 'eec-tr-cu-018-2011',
    title: 'ТР ТС 018/2011 轮式车辆安全技术法规',
    publisher: '欧亚经济委员会',
    url: 'https://eec.eaeunion.org/upload/medialibrary/834/Plan-TR-EAES-_2021_.pdf',
  },
  lowVoltage: {
    id: 'eec-tr-cu-004-2011',
    title: 'ТР ТС 004/2011 低电压设备安全技术法规',
    publisher: '欧亚经济委员会',
    url: 'https://eec.eaeunion.org/upload/medialibrary/269/TR-TS-Downvolt.pdf',
  },
  emc: {
    id: 'eec-tr-cu-020-2011',
    title: 'ТР ТС 020/2011 技术设备电磁兼容法规',
    publisher: '欧亚经济委员会',
    url: 'https://eec.eaeunion.org/upload/medialibrary/1ab/TehReg-TS-EMS.pdf',
  },
  hazardousSubstances: {
    id: 'eec-tr-eaeu-037-2016',
    title: 'ТР ЕАЭС 037/2016 电气电子产品有害物质限制',
    publisher: '欧亚经济委员会',
    url: 'https://eec.eaeunion.org/upload/medialibrary/7d0/f8sym7qu883mt9ms7z4c6maijt358pl8/TR-EAES-statistika-27.02.2024-deystvuyushchie.pdf',
  },
}

const SECTORS = [
  {
    id: 'home-furniture',
    label: '家居与家具近似大类',
    pattern: /家具|家装|门窗|五金/u,
    sharePct: 15.8,
    turnoverRubBillion: 1130,
    growthText: '同比增长超过 20%',
  },
  {
    id: 'auto-parts',
    label: '汽车零配件与汽车用品近似大类',
    pattern: /汽车|车库|车体|乘用车|卡车|轮胎|轮毂|摩托车|雨刮/u,
    sharePct: 6.1,
    turnoverRubBillion: null,
    growthText: null,
  },
  {
    id: 'electronics-appliances',
    label: '电子产品与家电近似大类',
    pattern: /电子|手机|平板|智能穿戴|照明|灯/u,
    sharePct: 13,
    turnoverRubBillion: 931,
    growthText: null,
  },
  {
    id: 'tools',
    label: '工具近似大类',
    pattern: /工具|修理/u,
    sharePct: 5.4,
    turnoverRubBillion: null,
    growthText: null,
  },
  {
    id: 'beauty-health',
    label: '美容与健康近似大类',
    pattern: /美容|健康|护理/u,
    sharePct: 6.8,
    turnoverRubBillion: 490,
    growthText: '同比增长超过 20%',
  },
  {
    id: 'pet',
    label: '宠物用品相关零售',
    pattern: /宠物/u,
    sharePct: null,
    turnoverRubBillion: null,
    growthText: '宠物商店销售同比增长接近 30%',
  },
]

function complianceProfile(text) {
  const rules = []
  if (/汽车|车库|车体|乘用车|卡车|轮胎|轮毂|摩托车|雨刮|车灯/u.test(text)) {
    rules.push({
      code: 'ТР ТС 018/2011',
      note: '涉及车辆安全、受监管部件或安装后影响车辆性能时核验；不能仅凭商品名称判断适用。',
      source: SOURCES.vehicleSafety,
    })
  }
  if (/电子|电池|手机|平板|智能穿戴|照明|灯|充电|防盗/u.test(text)) {
    rules.push({
      code: 'ТР ТС 004/2011 / 020/2011 / ТР ЕАЭС 037/2016',
      note: '带电、充电或无线/电子产品需按电压、用途和产品清单分别核验低压安全、电磁兼容与有害物质限制。',
      source: SOURCES.lowVoltage,
      extraSources: [SOURCES.emc, SOURCES.hazardousSubstances],
    })
  }
  if (/家具/u.test(text)) {
    rules.push({
      code: 'ТР ТС 025/2012',
      note: '完整家具产品需核验家具安全法规；单独五金配件是否在范围内仍应按产品归类确认。',
      source: SOURCES.furnitureSafety,
    })
  }
  if (!rules.length) {
    return {
      level: '待分类',
      summary: '当前类目无法仅凭报告标签确定监管路径，首轮询价时需补齐材质、用途、供电方式和 HS 编码。',
      rules: [],
    }
  }
  return {
    level: rules.length > 1 ? '中高' : '中',
    summary: '这是法规预筛，不是认证结论；最终范围取决于具体产品、HS 编码、用途和申报主体。',
    rules,
  }
}

export function buildRussiaMarketContext({ label, typeNames = [] } = {}) {
  const searchableText = [label, ...typeNames].filter(Boolean).join(' ')
  const sector = SECTORS.find((item) => item.pattern.test(searchableText)) || null
  const compliance = complianceProfile(searchableText)
  const sourceMap = new Map([
    [SOURCES.akitH1_2026.id, SOURCES.akitH1_2026],
    [SOURCES.ozonAnalytics.id, SOURCES.ozonAnalytics],
  ])
  for (const rule of compliance.rules) {
    sourceMap.set(rule.source.id, rule.source)
    for (const source of rule.extraSources || []) sourceMap.set(source.id, source)
  }

  return {
    asOf: '2026 年上半年',
    overall: {
      turnoverRubTrillion: 7.2,
      yoyGrowthPct: 18.7,
      onlineRetailSharePct: 22.2,
      domesticPlatformSharePct: 96.6,
      crossBorderSharePct: 3.4,
    },
    sector: sector ? {
      id: sector.id,
      label: sector.label,
      sharePct: sector.sharePct,
      turnoverRubBillion: sector.turnoverRubBillion,
      growthText: sector.growthText,
      matchType: '俄罗斯全网零售近似大类，不等同于当前 Ozon 报告类目',
    } : null,
    operatingImplications: [
      '俄罗斯线上零售仍在增长，但本报告的 Ozon BSR 样本不能外推为全市场规模。',
      '本地平台贡献绝大多数线上成交；跨境直发适合低库存验证，跑通后仍应评估本地备货与履约。',
      'Ozon 的热门商品、搜索、缺失商品和售罄工具口径不同，应与本报告的销量、缺货和新品信号交叉核验。',
    ],
    compliance,
    sources: [...sourceMap.values()],
  }
}

export { SOURCES as RUSSIA_MARKET_SOURCES }
