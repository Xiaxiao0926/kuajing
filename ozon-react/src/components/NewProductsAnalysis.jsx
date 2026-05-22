import { useMemo } from 'react'
import { TrendingUp, Package, Clock, Sparkles, Palette, Truck, ExternalLink } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { chartColors } from '../utils/chartConfigs'

const EXCHANGE_RATE = 0.075

const parseDate = (dateStr) => {
  if (!dateStr) return null
  try {
    if (typeof dateStr === 'number') {
      return new Date(dateStr)
    }
    
    let cleaned = String(dateStr).trim()
    
    if (cleaned.includes(' - ')) {
      cleaned = cleaned.split(' - ')[0].trim()
    }
    
    cleaned = cleaned.replace(/[^\d\-\/\.]/g, '')
    const parts = cleaned.split(/[\/\-\.]/)
    
    if (parts.length >= 3) {
      const [year, month, day] = parts.slice(0, 3)
      if (year.length === 4) {
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
        if (!isNaN(date.getTime())) return date
      } else if (year.length === 2) {
        const fullYear = parseInt(year) > 50 ? 1900 + parseInt(year) : 2000 + parseInt(year)
        const date = new Date(fullYear, parseInt(month) - 1, parseInt(day))
        if (!isNaN(date.getTime())) return date
      }
    }
    
    const date = new Date(dateStr)
    return isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

const DAYS_THRESHOLD = 365

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
  { keywords: ['диффузор', 'diffuser'], label: '扩散风罩' },
]

const COLOR_KEYWORDS = [
  { keywords: ['черный', 'black', 'чёрный'], label: '黑色', ru: 'Черный' },
  { keywords: ['белый', 'white'], label: '白色', ru: 'Белый' },
  { keywords: ['розовый', 'pink'], label: '粉色', ru: 'Розовый' },
  { keywords: ['красный', 'red'], label: '红色', ru: 'Красный' },
  { keywords: ['синий', 'blue'], label: '蓝色', ru: 'Синий' },
  { keywords: ['золото', 'gold', 'золотой'], label: '金色', ru: 'Золотой' },
  { keywords: ['серебро', 'silver', 'серебряный'], label: '银色', ru: 'Серебряный' },
  { keywords: ['фиолетовый', 'purple', 'violet'], label: '紫色', ru: 'Фиолетовый' },
  { keywords: ['зеленый', 'green'], label: '绿色', ru: 'Зеленый' },
  { keywords: ['серый', 'gray', 'grey'], label: '灰色', ru: 'Серый' },
]

const TYPE_KEYWORDS = [
  { keywords: ['фен', 'hair dryer', 'hairdryer'], label: '吹风机' },
  { keywords: ['щетка', 'brush', 'расческа'], label: '电吹风刷' },
  { keywords: ['выпрямитель', 'straightener', 'утюжок'], label: '直发器' },
  { keywords: ['плойка', 'curl', 'завивка'], label: '卷发器' },
  { keywords: ['мультистайлер', 'multistyler'], label: '多功能造型器' },
]

const SHIPPING_KEYWORDS = [
  { keywords: ['fbo', 'маркетплейс'], label: 'FBO(平台仓)', color: 'bg-blue-100 text-blue-600' },
  { keywords: ['fbs', 'продавец'], label: 'FBS(自发货)', color: 'bg-green-100 text-green-600' },
]

export default function NewProductsAnalysis({ data }) {
  const newProductData = useMemo(() => {
    if (!data || data.length === 0) return null
    
    const dateKeys = ['创建日期', '上架日期', '上新日期', 'date', 'created_at', '上架时间', '创建时间', 'created']
    const dateCol = dateKeys.find(k => data[0]?.[k] !== undefined)
    
    const qtyKeys = ['月销量', '销量', 'Quantity', 'sales', 'quantity']
    const qtyCol = qtyKeys.find(k => data[0]?.[k] !== undefined)
    
    const priceKeys = ['价格(₽)', '价格', 'Price', 'price', 'стоимость']
    const priceCol = priceKeys.find(k => data[0]?.[k] !== undefined)
    
    const nameKeys = ['商品名称', '产品名称', 'name', 'title', 'наименование']
    const nameCol = nameKeys.find(k => data[0]?.[k] !== undefined)
    
    const brandKeys = ['品牌', 'Brand', 'brand', 'производитель']
    const brandCol = brandKeys.find(k => data[0]?.[k] !== undefined)
    
    const urlKeys = ['链接', 'url', 'link', 'ссылка']
    const urlCol = urlKeys.find(k => data[0]?.[k] !== undefined)

    const today = new Date()
    
    const products = data.map(row => {
      const name = nameCol ? String(row[nameCol]) : '未知产品'
      const nameLower = name.toLowerCase()
      
      let daysListed = null
      if (dateCol) {
        const date = parseDate(row[dateCol])
        if (date) {
          daysListed = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
        }
      }
      
      const qty = qtyCol ? parseFloat(String(row[qtyCol]).replace(/[^\d.]/g, '')) || 0 : 0
      const price = priceCol ? parseFloat(String(row[priceCol]).replace(/[^\d.]/g, '')) || 0 : 0
      
      const features = FEATURE_KEYWORDS.filter(f => f.keywords.some(k => nameLower.includes(k.toLowerCase()))).map(f => f.label)
      const colors = COLOR_KEYWORDS.filter(c => c.keywords.some(k => nameLower.includes(k.toLowerCase()))).map(c => c.label)
      const types = TYPE_KEYWORDS.filter(t => t.keywords.some(k => nameLower.includes(k.toLowerCase()))).map(t => t.label)
      const shipping = SHIPPING_KEYWORDS.find(s => s.keywords.some(k => nameLower.includes(k.toLowerCase())))?.label || '未知'
      
      return {
        name,
        brand: brandCol ? row[brandCol] : '未知',
        url: urlCol ? row[urlCol] : null,
        quantity: qty,
        price,
        daysListed,
        features,
        colors,
        types,
        shipping
      }
    })
    
    const validNewProducts = products.filter(p => p.daysListed !== null && p.daysListed >= 0 && p.daysListed <= DAYS_THRESHOLD)
    const top5ByQty = [...validNewProducts].sort((a, b) => b.quantity - a.quantity).slice(0, 5)
    
    const allFeatures = validNewProducts.flatMap(p => p.features)
    const featureCounts = allFeatures.reduce((acc, f) => { acc[f] = (acc[f] || 0) + 1; return acc }, {})
    const topFeatures = Object.entries(featureCounts).sort((a, b) => b[1] - a[1]).slice(0, 6)
    
    const allColors = validNewProducts.flatMap(p => p.colors)
    const colorCounts = allColors.reduce((acc, c) => { acc[c] = (acc[c] || 0) + 1; return acc }, {})
    const topColors = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
    
    const allTypes = validNewProducts.flatMap(p => p.types)
    const typeCounts = allTypes.reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc }, {})
    const topTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
    
    const shippingCounts = validNewProducts.reduce((acc, p) => { acc[p.shipping] = (acc[p.shipping] || 0) + 1; return acc }, {})
    const shippingStats = Object.entries(shippingCounts).map(([name, count]) => ({ name, count }))
    
    return {
      totalNew: validNewProducts.length,
      top5Products: top5ByQty,
      topFeatures,
      topColors,
      topTypes,
      shippingStats,
      avgPrice: validNewProducts.length > 0 ? validNewProducts.reduce((sum, p) => sum + p.price, 0) / validNewProducts.length : 0,
      avgQty: validNewProducts.length > 0 ? validNewProducts.reduce((sum, p) => sum + p.quantity, 0) / validNewProducts.length : 0
    }
  }, [data])

  const formatRUB = (v) => `₽${Math.round(v).toLocaleString()}`
  const formatRMB = (v) => `¥${Math.round(v * EXCHANGE_RATE).toLocaleString()}`

  if (!newProductData) {
    return (
      <div className="insight-card text-center py-12">
        <p className="text-morandi-text-light">数据中未找到新品信息</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="kpi-card">
          <Package className="w-6 h-6 text-morandi-primary mb-2" />
          <div className="text-xl font-bold text-morandi-text">{newProductData.totalNew}</div>
          <div className="text-xs text-morandi-text-light">1年内新品</div>
        </div>
        <div className="kpi-card">
          <Clock className="w-6 h-6 text-morandi-accent mb-2" />
          <div className="text-xl font-bold text-morandi-text">{DAYS_THRESHOLD}天</div>
          <div className="text-xs text-morandi-text-light">筛选周期</div>
        </div>
        <div className="kpi-card">
          <TrendingUp className="w-6 h-6 text-morandi-success mb-2" />
          <div className="text-xl font-bold text-morandi-text">{formatRUB(newProductData.avgPrice)}</div>
          <div className="text-xs text-morandi-text-light">{formatRMB(newProductData.avgPrice)}</div>
          <div className="text-xs text-morandi-text-light">新品均价</div>
        </div>
        <div className="kpi-card">
          <Sparkles className="w-6 h-6 text-morandi-warning mb-2" />
          <div className="text-xl font-bold text-morandi-text">{Math.round(newProductData.avgQty)}</div>
          <div className="text-xs text-morandi-text-light">场均销量</div>
        </div>
      </div>

      {newProductData.top5Products.length > 0 && (
        <div className="insight-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-morandi-text">🌟 TOP 5 热销新品 (上架1年内)</h3>
            <span className="text-xs text-morandi-text-light">按月销量排序</span>
          </div>
          
          <div className="space-y-4">
            {newProductData.top5Products.map((product, idx) => (
              <div key={idx} className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-morandi-primary text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-morandi-text truncate">{product.name}</h4>
                      {product.url && (
                        <a href={product.url} target="_blank" rel="noopener noreferrer" className="text-morandi-primary hover:underline flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {product.features.length > 0 && product.features.map((f, i) => (
                        <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full">{f}</span>
                      ))}
                      {product.colors.length > 0 && product.colors.map((c, i) => (
                        <span key={i} className="px-2 py-0.5 bg-pink-100 text-pink-600 text-xs rounded-full flex items-center gap-1">
                          <Palette className="w-3 h-3" />{c}
                        </span>
                      ))}
                      {product.types.length > 0 && product.types.map((t, i) => (
                        <span key={i} className="px-2 py-0.5 bg-purple-100 text-purple-600 text-xs rounded-full">{t}</span>
                      ))}
                      <span className={`px-2 py-0.5 text-xs rounded-full flex items-center gap-1 ${product.shipping.includes('FBO') ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                        <Truck className="w-3 h-3" />{product.shipping}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-morandi-text-light">品牌: <span className="text-morandi-text">{product.brand}</span></span>
                      <span className="text-morandi-text-light">|</span>
                      <span className="text-morandi-text-light">价格: <span className="text-morandi-text font-medium">{formatRUB(product.price)} ({formatRMB(product.price)})</span></span>
                      <span className="text-morandi-text-light">|</span>
                      <span className="text-morandi-text-light">月销量: <span className="text-green-600 font-medium">{product.quantity.toLocaleString()}</span></span>
                      {product.daysListed !== null && (
                        <>
                          <span className="text-morandi-text-light">|</span>
                          <span className="text-morandi-text-light">上架: <span className="text-morandi-text">{product.daysListed}天</span></span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="insight-card">
          <h3 className="font-semibold text-morandi-text mb-4">🏷️ 新品热门功能</h3>
          {newProductData.topFeatures.length > 0 ? (
            <div className="space-y-2">
              {newProductData.topFeatures.map(([feature, count], idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm text-morandi-text">{feature}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-morandi-primary rounded-full" 
                        style={{ width: `${(count / newProductData.topFeatures[0][1]) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-morandi-text-light w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-morandi-text-light">暂无数据</p>
          )}
        </div>

        <div className="insight-card">
          <h3 className="font-semibold text-morandi-text mb-4">🎨 新品热门颜色</h3>
          {newProductData.topColors.length > 0 ? (
            <div className="space-y-2">
              {newProductData.topColors.map(([color, count], idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm text-morandi-text">{color}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-pink-400 rounded-full" 
                        style={{ width: `${(count / newProductData.topColors[0][1]) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-morandi-text-light w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-morandi-text-light">暂无数据</p>
          )}
        </div>

        <div className="insight-card">
          <h3 className="font-semibold text-morandi-text mb-4">📦 发货模式分布</h3>
          {newProductData.shippingStats.length > 0 ? (
            <div className="space-y-2">
              {newProductData.shippingStats.map((stat, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm text-morandi-text">{stat.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-morandi-success rounded-full" 
                        style={{ width: `${(stat.count / newProductData.totalNew) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-morandi-text-light w-8 text-right">{stat.count}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-morandi-text-light">暂无数据</p>
          )}
        </div>
      </div>

      {newProductData.topTypes.length > 0 && (
        <div className="insight-card">
          <h3 className="font-semibold text-morandi-text mb-4">🔧 新品类型分布</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={newProductData.topTypes.map(([type, count]) => ({ name: type, count }))} layout="vertical">
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill={chartColors.primary} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
