import { TrendingUp, DollarSign, Crown, Percent, Package, Star, TrendingDown, Tag } from 'lucide-react'

const EXCHANGE_RATE = 0.075

const formatNumber = (num) => {
  if (num === null || num === undefined) return '-'
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toLocaleString()
}

const formatCurrency = (num) => {
  if (num === null || num === undefined) return { rub: '-', cny: '-' }
  const rmb = Math.round(num * EXCHANGE_RATE)
  return {
    rub: '₽ ' + formatNumber(num),
    cny: '¥ ' + formatNumber(rmb)
  }
}

export default function KPICards({ kpis }) {
  if (!kpis) {
    return (
      <div className="text-center py-8 text-morandi-text-light">
        加载中...
      </div>
    )
  }

  const marketSizeDual = formatCurrency(kpis.totalMarketSize)
  const unitPriceDual = formatCurrency(kpis.avgUnitPrice)
  const minPriceDual = formatCurrency(kpis.minPrice)
  const maxPriceDual = formatCurrency(kpis.maxPrice)

  const cards = [
    {
      icon: Package,
      label: '商品总数',
      value: kpis.totalProducts?.toLocaleString() || '0',
      subValue: `${kpis.totalBrands || 0} 个品牌`,
      color: 'bg-morandi-primary/10 text-morandi-primary'
    },
    {
      icon: DollarSign,
      label: '总市场规模',
      value: marketSizeDual.rub,
      subValue: marketSizeDual.cny !== '-' ? marketSizeDual.cny : null,
      color: 'bg-blue-100 text-blue-600'
    },
    {
      icon: TrendingUp,
      label: '平均客单价',
      value: unitPriceDual.rub,
      subValue: unitPriceDual.cny !== '-' ? unitPriceDual.cny : null,
      color: 'bg-morandi-secondary/10 text-morandi-secondary'
    },
    {
      icon: Tag,
      label: '价格区间',
      value: kpis.minPrice && kpis.maxPrice ? `${formatNumber(kpis.minPrice)}-${formatNumber(kpis.maxPrice)}` : '-',
      subValue: kpis.minPrice && kpis.maxPrice ? `${formatNumber(kpis.minPrice * EXCHANGE_RATE)}-${formatNumber(kpis.maxPrice * EXCHANGE_RATE)}` : null,
      color: 'bg-purple-100 text-purple-600'
    },
    {
      icon: Crown,
      label: 'Top品牌',
      value: kpis.topBrand || '-',
      subValue: kpis.topBrandBySales && kpis.topBrandBySales !== kpis.topBrand ? `销额: ${kpis.topBrandBySales}` : null,
      color: 'bg-morandi-accent/10 text-morandi-accent'
    },
    {
      icon: Percent,
      label: '平均增长率',
      value: kpis.avgGrowth !== undefined && kpis.avgGrowth !== null ? `${kpis.avgGrowth > 0 ? '+' : ''}${kpis.avgGrowth}%` : '-',
      subValue: kpis.growthPositiveRate ? `正增${kpis.growthPositiveRate}%` : null,
      color: 'bg-morandi-success/10 text-morandi-success',
      trend: kpis.avgGrowth > 0 ? 'positive' : kpis.avgGrowth < 0 ? 'negative' : null
    },
    {
      icon: Star,
      label: '平均评分',
      value: kpis.avgRating || '-',
      subValue: kpis.highRatingRate ? `高评${kpis.highRatingRate}%` : null,
      color: 'bg-yellow-100 text-yellow-600'
    },
    {
      icon: TrendingDown,
      label: '总月销量',
      value: kpis.totalQty?.toLocaleString() || '-',
      subValue: kpis.avgQty ? `场均 ${kpis.avgQty.toLocaleString()}` : null,
      color: 'bg-orange-100 text-orange-600'
    }
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3">
      {cards.map((card, index) => (
        <div key={index} className="kpi-card">
          <div className={`w-10 h-10 rounded-xl ${card.color} flex items-center justify-center mb-3`}>
            <card.icon className="w-5 h-5" />
          </div>
          <div className="text-lg font-bold text-morandi-text mb-0.5 truncate" title={String(card.value)}>
            {card.value}
          </div>
          {card.subValue && (
            <div className="text-xs text-morandi-text-light truncate" title={String(card.subValue)}>
              {card.subValue}
            </div>
          )}
          <div className="text-xs text-morandi-text-light uppercase tracking-wide mt-1">
            {card.label}
          </div>
          {card.trend && (
            <div className={`mt-1 text-xs font-medium ${
              card.trend === 'positive' ? 'text-green-600' : 'text-red-500'
            }`}>
              {card.trend === 'positive' ? '↑ 增长' : '↓ 下降'}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
