/**
 * miFilterEngine.js — 俄罗斯市场情报客户端纯函数过滤与排序引擎
 * 针对 6,534 个利基进行毫秒级复合筛选与排序
 */

export const DEFAULT_FILTERS = {
  search: '',
  category: 'ALL',
  tiers: ['S', 'A', 'B', 'C'],
  verdicts: ['ALL'], // 'ALL' | 'TEST' | 'VERIFY' | 'WATCH' | 'DROP'
  minMos: 0,
  minCfs: 0,
  minGmv: 0,
  minGrowth: -100,
  minBuyout: 0,
  maxSellers: 999999,
  weightFilter: 'ALL', // 'ALL' | 'LE_500' | 'LE_1000' | 'HEAVY_ONLY'
  nonElectricOnly: false,
  nonFragileOnly: false,
  nonLiquidOnly: false,
  dualHighOnly: false, // MOS >= 65 && CFS >= 85
  sortField: 'comp', // 'comp' | 'mos' | 'cfs' | 'gmv' | 'growth_num' | 'buyout' | 'sellers' | 'search'
  sortOrder: 'desc', // 'desc' | 'asc'
}

export function filterNiches(niches, filters = DEFAULT_FILTERS) {
  if (!Array.isArray(niches)) return []

  const searchTrimmed = (filters.search || '').trim().toLowerCase()
  const isAllCat = !filters.category || filters.category === 'ALL'
  const isAllVerdicts = !filters.verdicts || filters.verdicts.includes('ALL')

  return niches.filter((n) => {
    // 1. 搜索词匹配（中文利基名或俄语 TOP 搜索词）
    if (searchTrimmed) {
      const matchName = n.name.toLowerCase().includes(searchTrimmed)
      const matchKw = (n.top_kw || '').toLowerCase().includes(searchTrimmed)
      const matchCat = (n.cat || '').toLowerCase().includes(searchTrimmed)
      if (!matchName && !matchKw && !matchCat) return false
    }

    // 2. 品类过滤
    if (!isAllCat && n.cat !== filters.category) return false

    // 3. 评级 Tier
    if (filters.tiers && filters.tiers.length > 0 && !filters.tiers.includes(n.tier)) {
      return false
    }

    // 4. 验证结论 Verdict
    if (!isAllVerdicts && !filters.verdicts.includes(n.verdict)) {
      return false
    }

    // 5. Dual High 快捷开关
    if (filters.dualHighOnly) {
      if (n.mos < 65 || n.cfs < 85) return false
    }

    // 6. 数值门槛
    if (filters.minMos > 0 && n.mos < filters.minMos) return false
    if (filters.minCfs > 0 && n.cfs < filters.minCfs) return false
    if (filters.minGmv > 0 && n.gmv < filters.minGmv) return false
    if (filters.minGrowth > -100 && n.growth_num < filters.minGrowth) return false
    if (filters.minBuyout > 0 && n.buyout < filters.minBuyout) return false
    if (filters.maxSellers < 999999 && n.sellers > filters.maxSellers) return false

    // 7. 物理属性与风控
    if (filters.weightFilter === 'LE_500') {
      if (n.heavy === 'YES' || (n.specs && n.specs.weight_g > 500)) return false
    } else if (filters.weightFilter === 'LE_1000') {
      if (n.heavy === 'YES' || (n.specs && n.specs.weight_g > 1000)) return false
    } else if (filters.weightFilter === 'HEAVY_ONLY') {
      if (n.heavy !== 'YES' && (!n.specs || n.specs.weight_g <= 1000)) return false
    }

    if (filters.nonElectricOnly) {
      if (n.risks.includes('ELECTRICAL') || (n.specs && n.specs.is_elec !== 'NO')) return false
    }

    if (filters.nonFragileOnly) {
      if (n.risks.includes('FRAGILE') || (n.specs && n.specs.is_fragile === 'YES')) return false
    }

    if (filters.nonLiquidOnly) {
      if (n.specs && n.specs.is_liquid !== 'NO') return false
    }

    return true
  }).sort((a, b) => {
    const field = filters.sortField || 'comp'
    const order = filters.sortOrder === 'asc' ? 1 : -1
    const va = a[field] ?? 0
    const vb = b[field] ?? 0
    if (va < vb) return -1 * order
    if (va > vb) return 1 * order
    return 0
  })
}
