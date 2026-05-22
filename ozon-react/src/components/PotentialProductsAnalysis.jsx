import { useMemo } from 'react'
import { TrendingUp, Target, Award, Zap, Star, DollarSign, Package, Truck, MessageCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ScatterChart, Scatter, Cell } from 'recharts'
import { chartColors } from '../utils/chartConfigs'

const EXCHANGE_RATE = 0.075

const FEATURE_KEYWORDS = [
  { keywords: ['ионизация', 'ionic', 'ион'], label: '负离子' },
  { keywords: ['профессиональный', 'professional'], label: '专业级' },
  { keywords: ['инвертор', 'inverter'], label: '变频马达' },
  { keywords: ['турмалин', 'tourmaline'], label: '电气石' },
  { keywords: ['керамика', 'ceramic'], label: '陶瓷涂层' },
  { keywords: ['тихий', 'quiet', 'бесшумный'], label: '静音' },
  { keywords: ['быстрый', 'fast'], label: '快速干发' },
  { keywords: ['портативный', 'portable', 'дорожный'], label: '便携' },
  { keywords: ['складной', 'fold'], label: '折叠' },
  { keywords: ['умный', 'smart'], label: '智能温控' },
  { keywords: ['холодный', 'cold'], label: '冷风' },
  { keywords: ['5 в 1', '5в1'], label: '5合1' },
  { keywords: ['мини', 'mini'], label: '迷你' },
]

const findColumn = (data, possibleNames) => {
  if (!data || !data[0]) return null
  const keys = Object.keys(data[0])
  console.log('Available columns:', keys)
  
  for (const name of possibleNames) {
    const found = keys.find(k => k.toLowerCase().trim() === name.toLowerCase().trim())
    if (found) return found
  }
  return null
}

const parseNumeric = (value) => {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return value
  const cleaned = String(value).replace(/[^\d.\-]/g, '')
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}

const parseDate = (value) => {
  if (!value) return ''
  if (typeof value === 'number') {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000))
    return isNaN(date.getTime()) ? String(value) : date.toISOString().split('T')[0]
  }
  const str = String(value).trim()
  if (str.includes(' - ')) {
    return str.split(' - ')[0].trim()
  }
  const match = str.match(/(\d{4})[-/\.](\d{1,2})[-/\.](\d{1,2})/)
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
  }
  return str
}

export default function PotentialProductsAnalysis({ data }) {
const calculatePotentialScore = (qty, price, growth, rating, featureCount) => {
    let score = 0
    
    if (qty > 0) score += Math.min(qty / 10, 30)
    if (growth > 0) score += Math.min(growth * 2, 25)
    if (rating >= 4) score += (rating - 3) * 10
    if (price > 0 && price < 10000) score += 15
    else if (price >= 10000 && price < 20000) score += 10
    score += Math.min(featureCount * 3, 15)
    
    return Math.round(score)
  }

  const potentialData = useMemo(() => {
    if (!data || data.length === 0) return null
    
    console.log('Processing potential products data...')
    console.log('Sample row:', data[0])
    
    const nameCol = findColumn(data, ['商品名称', '产品名称', 'name', 'title', 'наименование', 'Наименование'])
    const qtyCol = findColumn(data, ['月销量', '销量', 'Quantity', 'sales', 'quantity', 'Количество', 'Продажи'])
    const priceCol = findColumn(data, ['价格(₽)', '价格', 'Price', 'price', 'стоимость', 'Стоимость', 'Цена'])
    const brandCol = findColumn(data, ['品牌', 'Brand', 'brand', 'производитель', 'Производитель'])
    const growthCol = findColumn(data, ['月销量环比(%)', '增长率', 'Growth', 'growth', 'прирост', 'Прирост'])
    const ratingCol = findColumn(data, ['星级评分', '评分', 'rating', 'Rating', 'оценка', 'рейтинг', 'Оценка', 'Рейтинг'])
    const commentCol = findColumn(data, ['产品评论数', '评论数', '评价数', 'reviews', 'отзывов', 'отзывы', 'Отзывы'])
    const shippingCol = findColumn(data, ['发货模式', 'FBO', 'FBS', 'тип_доставки', 'доставка', 'fulfillment', 'Тип доставки'])
    const dateCol = findColumn(data, ['创建日期', '上架日期', '上新日期', 'date', 'created_at', 'created', 'дата', '上架时间', 'Дата'])
    const urlCol = findColumn(data, ['链接', 'url', 'link', 'ссылка', 'URL', 'Ссылка'])

    console.log('Found columns:', { nameCol, qtyCol, priceCol, brandCol, ratingCol, commentCol, shippingCol, dateCol })

    const products = data.map(row => {
      const name = nameCol ? String(row[nameCol]) : '未知产品'
      const nameLower = name.toLowerCase()
      
      const qty = qtyCol ? parseNumeric(row[qtyCol]) : 0
      const price = priceCol ? parseNumeric(row[priceCol]) : 0
      const growth = growthCol ? parseNumeric(row[growthCol]) : 0
      const rating = ratingCol ? parseNumeric(row[ratingCol]) : 0
      const comments = commentCol ? parseNumeric(row[commentCol]) : 0
      const shipping = shippingCol ? String(row[shippingCol]) : ''
      const createdDate = dateCol ? parseDate(row[dateCol]) : ''
      
      let shippingType = '未知'
      const shipLower = shipping.toLowerCase()
      if (shipLower.includes('fbo') || shipLower.includes('маркетплейс') || shipLower.includes('маркетплейс')) {
        shippingType = 'FBO'
      } else if (shipLower.includes('fbs') || shipLower.includes('продавец') || shipLower.includes('самовывоз')) {
        shippingType = 'FBS'
      } else if (shipping) {
        shippingType = shipping
      }
      
      const features = FEATURE_KEYWORDS.filter(f => f.keywords.some(k => nameLower.includes(k.toLowerCase()))).map(f => f.label)
      
      const potentialScore = calculatePotentialScore(qty, price, growth, rating, features.length)
      
      return {
        name,
        brand: brandCol ? row[brandCol] : '未知',
        url: urlCol ? row[urlCol] : null,
        quantity: qty,
        price,
        growth,
        rating,
        comments,
        shipping: shippingType,
        createdDate,
        features,
        potentialScore,
        sales: price * qty
      }
    }).filter(p => p.price > 0)

    const avgPrice = products.reduce((sum, p) => sum + p.price, 0) / products.length
    const avgQty = products.reduce((sum, p) => sum + p.quantity, 0) / products.length
    const avgGrowth = products.reduce((sum, p) => sum + p.growth, 0) / products.length
    const avgRating = products.filter(p => p.rating > 0).reduce((sum, p) => sum + p.rating, 0) / products.filter(p => p.rating > 0).length || 0

    const topByScore = [...products].sort((a, b) => b.potentialScore - a.potentialScore).slice(0, 5)
    const topByGrowth = [...products].sort((a, b) => b.growth - a.growth).slice(0, 5)
    const topByRating = [...products].sort((a, b) => b.rating - a.rating).slice(0, 5)
    
    const priceRanges = [
      { name: '<3000₽', min: 0, max: 3000 },
      { name: '3K-5K₽', min: 3000, max: 5000 },
      { name: '5K-10K₽', min: 5000, max: 10000 },
      { name: '10K-20K₽', min: 10000, max: 20000 },
      { name: '>20K₽', min: 20000, max: Infinity }
    ]
    
    const potentialByPrice = priceRanges.map(range => {
      const inRange = products.filter(p => p.price >= range.min && p.price < range.max)
      const avgScore = inRange.length > 0 ? inRange.reduce((sum, p) => sum + p.potentialScore, 0) / inRange.length : 0
      return { name: range.name, count: inRange.length, avgScore: Math.round(avgScore) }
    }).filter(p => p.count > 0)

    const scatterData = products.map(p => ({
      ...p,
      z: Math.max(p.quantity / 10, 10)
    }))

    return {
      products,
      topByScore,
      topByGrowth,
      topByRating,
      potentialByPrice,
      scatterData,
      avgPrice,
      avgQty,
      avgGrowth,
      avgRating,
      avgComments: products.filter(p => p.comments > 0).reduce((sum, p) => sum + p.comments, 0) / products.filter(p => p.comments > 0).length || 0,
      shippingStats: products.reduce((acc, p) => { 
        acc[p.shipping] = (acc[p.shipping] || 0) + 1; 
        return acc 
      }, {}),
      marketAvgScore: products.reduce((sum, p) => sum + p.potentialScore, 0) / products.length
    }
  }, [data])

  const formatRUB = (v) => `₽${Math.round(v).toLocaleString()}`
  const formatRMB = (v) => `¥${Math.round(v * EXCHANGE_RATE).toLocaleString()}`

  if (!potentialData) {
    return (
      <div className="insight-card text-center py-12">
        <p className="text-morandi-text-light">数据中未找到潜力产品信息</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="kpi-card">
          <Target className="w-6 h-6 text-morandi-primary mb-2" />
          <div className="text-xl font-bold text-morandi-text">{potentialData.products.length}</div>
          <div className="text-xs text-morandi-text-light">分析产品数</div>
        </div>
        <div className="kpi-card">
          <Zap className="w-6 h-6 text-morandi-warning mb-2" />
          <div className="text-xl font-bold text-morandi-text">{Math.round(potentialData.marketAvgScore)}</div>
          <div className="text-xs text-morandi-text-light">市场平均潜力分</div>
        </div>
        <div className="kpi-card">
          <TrendingUp className="w-6 h-6 text-morandi-success mb-2" />
          <div className="text-xl font-bold text-morandi-text">{potentialData.avgGrowth > 0 ? '+' : ''}{Math.round(potentialData.avgGrowth)}%</div>
          <div className="text-xs text-morandi-text-light">平均增长率</div>
        </div>
        <div className="kpi-card">
          <Star className="w-6 h-6 text-morandi-accent mb-2" />
          <div className="text-xl font-bold text-morandi-text">{potentialData.avgRating > 0 ? potentialData.avgRating.toFixed(1) : '-'}</div>
          <div className="text-xs text-morandi-text-light">平均评分</div>
        </div>
      </div>

      <div className="insight-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-morandi-text">🎯 TOP 5 潜力产品 (综合评分)</h3>
          <span className="text-xs text-morandi-text-light">基于销量、增长率、评分、价格、功能计算</span>
        </div>
        
        <div className="space-y-4">
          {potentialData.topByScore.map((product, idx) => (
            <div key={idx} className="p-4 bg-gradient-to-r from-morandi-primary/5 to-transparent rounded-xl hover:from-morandi-primary/10 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-morandi-primary text-white flex items-center justify-center font-bold text-lg flex-shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-morandi-text truncate">{product.name}</h4>
                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full">
                      潜力分: {product.potentialScore}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {product.features.map((f, i) => (
                      <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full">{f}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 text-sm flex-wrap">
                    <span className="text-morandi-text-light">品牌: <span className="text-morandi-text">{product.brand}</span></span>
                    <span className="text-morandi-text-light">|</span>
                    <span className="text-morandi-text-light">价格: <span className="text-morandi-text font-medium">{formatRUB(product.price)} ({formatRMB(product.price)})</span></span>
                    <span className="text-morandi-text-light">|</span>
                    <span className="text-morandi-text-light">月销量: <span className="text-green-600 font-medium">{product.quantity > 0 ? product.quantity.toLocaleString() : '-'}</span></span>
                    <span className="text-morandi-text-light">|</span>
                    <span className="text-morandi-text-light">增长: <span className="text-green-600 font-medium">{product.growth > 0 ? '+' : ''}{product.growth}%</span></span>
                    <span className="text-morandi-text-light">|</span>
                    <span className="text-morandi-text-light">评分: <span className="text-yellow-600 font-medium">⭐ {product.rating > 0 ? product.rating : '-'}</span></span>
                    <span className="text-morandi-text-light">|</span>
                    <span className="text-morandi-text-light flex items-center gap-1"><MessageCircle className="w-3 h-3" />: <span className="text-morandi-text">{product.comments > 0 ? product.comments.toLocaleString() : '-'}</span></span>
                    <span className="text-morandi-text-light">|</span>
                    <span className={`px-1.5 py-0.5 text-xs rounded flex items-center gap-1 ${product.shipping === 'FBO' ? 'bg-blue-100 text-blue-600' : product.shipping === 'FBS' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}><Truck className="w-3 h-3" />{product.shipping}</span>
                    {product.createdDate && product.createdDate !== '未知' && (
                      <>
                        <span className="text-morandi-text-light">|</span>
                        <span className="text-morandi-text-light">{product.createdDate}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="insight-card">
          <h3 className="font-semibold text-morandi-text mb-4">📈 增长最快的潜力产品</h3>
          <div className="space-y-3">
            {potentialData.topByGrowth.slice(0, 5).map((product, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-sm text-morandi-text truncate">{product.name?.slice(0, 25)}</span>
                </div>
                <span className="text-green-600 font-medium text-sm">+{product.growth}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="insight-card">
          <h3 className="font-semibold text-morandi-text mb-4">⭐ 高评分潜力产品</h3>
          <div className="space-y-3">
            {potentialData.topByRating.slice(0, 5).map((product, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-sm text-morandi-text truncate">{product.name?.slice(0, 25)}</span>
                </div>
                <span className="text-yellow-600 font-medium text-sm">⭐ {product.rating > 0 ? product.rating : '-'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="insight-card">
        <h3 className="font-semibold text-morandi-text mb-4">💰 各价格带潜力分布</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={potentialData.potentialByPrice}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" orientation="left" stroke="#8B9DC3" />
              <YAxis yAxisId="right" orientation="right" stroke="#D4A373" />
              <Tooltip 
                formatter={(value, name) => [name === 'count' ? `${value} 个产品` : `平均潜力分: ${value}`, name === 'count' ? '产品数' : '潜力分']}
              />
              <Bar yAxisId="left" dataKey="count" fill={chartColors.primary} radius={[4, 4, 0, 0]} name="产品数" />
              <Bar yAxisId="right" dataKey="avgScore" fill={chartColors.accent} radius={[4, 4, 0, 0]} name="潜力分" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="insight-card">
        <h3 className="font-semibold text-morandi-text mb-4">🔍 潜力产品分布 (价格 vs 销量)</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart>
              <XAxis dataKey="price" name="价格" unit="₽" tick={{ fontSize: 10 }} />
              <YAxis dataKey="quantity" name="月销量" tick={{ fontSize: 10 }} />
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload
                    return (
                      <div className="bg-white p-3 shadow-lg rounded-lg border border-gray-100 text-sm">
                        <p className="font-medium">{data.name?.slice(0, 30)}</p>
                        <p>价格: {formatRUB(data.price)} ({formatRMB(data.price)})</p>
                        <p>月销量: {data.quantity.toLocaleString()}</p>
                        <p>增长率: {data.growth > 0 ? '+' : ''}{data.growth}%</p>
                        <p>潜力分: <span className="font-bold text-morandi-primary">{data.potentialScore}</span></p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Scatter 
                data={potentialData.scatterData} 
                fill="#8B9DC3"
              >
                {potentialData.scatterData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.potentialScore >= 50 ? '#4CAF50' : entry.potentialScore >= 30 ? '#FF9800' : '#9E9E9E'} 
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-morandi-text-light">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500"></span> 高潜力 (≥50分)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400"></span> 中潜力 (30-49分)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-400"></span> 普通 (&lt;30分)</span>
        </div>
      </div>
    </div>
  )
}
