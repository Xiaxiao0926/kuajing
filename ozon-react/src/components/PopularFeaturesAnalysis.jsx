import { useMemo } from 'react'
import { Star, Zap, Thermometer, Wind, TrendingUp, DollarSign, Globe } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { chartColors } from '../utils/chartConfigs'
import { R as EXCHANGE_RATE } from '../utils/ozonEngine'

const RUSSIAN_FEATURES = [
  { keywords: ['5 в 1', '5в1', '5 in 1'], label: '5合1多功能', en: '5 in 1', ru: '5 в 1' },
  { keywords: ['профессиональный', 'professional'], label: '专业级', en: 'Professional', ru: 'Профессиональный' },
  { keywords: ['ионизация', 'ionic', 'ион'], label: '负离子', en: 'Ionic', ru: 'Ионизация' },
  { keywords: ['инвертор', 'inverter'], label: '变频马达', en: 'Inverter Motor', ru: 'Инверторный мотор' },
  { keywords: ['турмалин', 'tourmaline'], label: '电气石', en: 'Tourmaline', ru: 'Турмалин' },
  { keywords: ['керамика', 'ceramic'], label: '陶瓷涂层', en: 'Ceramic', ru: 'Керамика' },
  { keywords: ['тихий', 'quiet', 'бесшумный'], label: '静音', en: 'Quiet', ru: 'Бесшумный' },
  { keywords: ['быстрый', 'fast', 'скоростной'], label: '快速干发', en: 'Fast Drying', ru: 'Быстрая сушка' },
  { keywords: ['портативный', 'portable', 'дорожный'], label: '便携旅行', en: 'Portable', ru: 'Портативный' },
  { keywords: ['2000w', '2000 вт', '2200w', '2100w', '1800w', '2400w'], label: '大功率', en: 'High Power', ru: 'Высокая мощность' },
  { keywords: ['умный', 'smart', 'интеллект'], label: '智能温控', en: 'Smart Temp', ru: 'Умный контроль' },
  { keywords: ['холодный', 'cold', 'охлаждение'], label: '冷风定型', en: 'Cold Shot', ru: 'Холодный обдув' },
  { keywords: ['складной', 'fold', 'складывается'], label: '折叠式', en: 'Foldable', ru: 'Складной' },
  { keywords: ['терморегулятор', 'термостат', 'температура'], label: '恒温控制', en: 'Temperature Control', ru: 'Терморегулятор' },
  { keywords: ['нано', 'nano'], label: '纳米技术', en: 'Nano Technology', ru: 'Нанотехнология' },
  { keywords: ['коллаген', 'collagen'], label: '胶原蛋白', en: 'Collagen', ru: 'Коллаген' },
  { keywords: ['уход за волосами', 'волосы', 'hair care'], label: '护发功能', en: 'Hair Care', ru: 'Уход за волосами' },
  { keywords: ['ультрафиолет', 'uv'], label: '紫外线杀菌', en: 'UV Sterilization', ru: 'Ультрафиолет' },
  { keywords: ['мини', 'mini', 'компактный'], label: '迷你便携', en: 'Mini', ru: 'Мини' },
  { keywords: ['беспроводной', 'cordless', 'аккумулятор'], label: '无线充电', en: 'Cordless', ru: 'Беспроводной' },
  { keywords: ['usb', 'юсб'], label: 'USB充电', en: 'USB Charging', ru: 'USB зарядка' },
  { keywords: ['легкий', 'lightweight'], label: '轻便', en: 'Lightweight', ru: 'Легкий' },
  { keywords: ['диффузор', 'diffuser'], label: '扩散风罩', en: 'Diffuser', ru: 'Диффузор' },
  { keywords: ['концентратор', 'concentrator', 'насадка'], label: '集风嘴', en: 'Concentrator', ru: 'Концентратор' },
  { keywords: ['расческа', 'brush', 'насадка-расческа'], label: '梳形风嘴', en: 'Brush Attachment', ru: 'Насадка-расческа' },
  { keywords: ['выпрямление', 'straight', 'выпрямитель'], label: '直发器', en: 'Hair Straightener', ru: 'Выпрямление' },
  { keywords: ['локоны', 'curl', 'кудри'], label: '卷发功能', en: 'Curling', ru: 'Завивка' },
  { keywords: ['антистатик', 'anti-static'], label: '防静电', en: 'Anti-static', ru: 'Антистатик' },
  { keywords: ['ионизатор', 'ionizer'], label: '离子发生器', en: 'Ionizer', ru: 'Ионизатор' },
  { keywords: ['щетка', 'brush'], label: '电刷梳理', en: 'Brush', ru: 'Электрическая щетка' },
  { keywords: ['3 скорость', '3 скорости', '3 speed'], label: '3档风速', en: '3 Speed', ru: '3 скорости' },
  { keywords: ['2 скорость', '2 speed'], label: '2档风速', en: '2 Speed', ru: '2 скорости' },
  { keywords: ['мощный', 'powerful', 'сильный'], label: '强力', en: 'Powerful', ru: 'Мощный' },
  { keywords: ['профессиональный фен', 'prof dryer'], label: '专业吹风机', en: 'Pro Hair Dryer', ru: 'Профессиональный фен' },
  { keywords: ['бытовая', 'home', 'для дома'], label: '家用', en: 'Home Use', ru: 'Бытовая' },
  { keywords: ['гостиница', 'hotel'], label: '酒店用', en: 'Hotel', ru: 'Для гостиницы' },
  { keywords: ['спа', 'salon', 'салон'], label: '沙龙/SPA', en: 'Salon', ru: 'Салон' },
  { keywords: ['для детей', 'kids', 'ребенок'], label: '儿童适用', en: 'Kids', ru: 'Для детей' },
  { keywords: ['мужской', 'men', 'муж'], label: '男士理容', en: 'Men', ru: 'Мужской' },
  { keywords: ['женский', 'women', 'дамский'], label: '女士吹风', en: 'Women', ru: 'Женский' },
  { keywords: ['длинный шнур', 'long cord'], label: '加长电源线', en: 'Long Cord', ru: 'Длинный шнур' },
  { keywords: ['шнур 3м', '3 метра'], label: '3米电源线', en: '3m Cord', ru: 'Шнур 3 метра' },
  { keywords: ['петля', 'петля для подвешивания', 'hang'], label: '挂环', en: 'Hang Loop', ru: 'Петля' },
  { keywords: ['съемный фильтр', 'removable filter'], label: '可拆洗滤网', en: 'Removable Filter', ru: 'Съемный фильтр' },
  { keywords: ['защита от перегрева', 'overheat protection'], label: '过热保护', en: 'Overheat Protection', ru: 'Защита от перегрева' },
  { keywords: ['индикатор', 'indicator', 'дисплей'], label: '显示屏', en: 'Display', ru: 'Индикатор' },
  { keywords: ['кнопка', 'button'], label: '按钮控制', en: 'Button Control', ru: 'Кнопка' },
  { keywords: ['шелковый', 'silk', 'шелк'], label: '丝绸护发', en: 'Silk', ru: 'Шелковый' },
  { keywords: ['кератиновый', 'keratin'], label: '角蛋白', en: 'Keratin', ru: 'Кератиновый' },
  { keywords: ['масло', 'oil', 'аргоновое'], label: '精油护发', en: 'Argan Oil', ru: 'Аргановое масло' },
  { keywords: ['турбо', 'turbo', 'бустер'], label: 'Turbo加速', en: 'Turbo Boost', ru: 'Турбо режим' },
  { keywords: ['эко', 'eco', 'экономия'], label: '节能模式', en: 'Eco Mode', ru: 'Эко режим' },
]

export default function PopularFeaturesAnalysis({ data }) {
  const featureData = useMemo(() => {
    if (!data || data.length === 0) return null
    
    const nameKeys = ['商品名称', '产品名称', 'name', 'title']
    const nameCol = nameKeys.find(k => data[0]?.[k] !== undefined)
    
    const qtyKeys = ['月销量', '销量', 'Quantity']
    const qtyCol = qtyKeys.find(k => data[0]?.[k] !== undefined)
    
    const priceKeys = ['价格(₽)', '价格', 'Price']
    const priceCol = priceKeys.find(k => data[0]?.[k] !== undefined)
    
    const marketAvgPrice = data.reduce((sum, row) => {
      const price = priceCol ? parseFloat(row[priceCol]) || 0 : 0
      return sum + price
    }, 0) / data.filter(row => (priceCol ? parseFloat(row[priceCol]) || 0 : 0) > 0).length || 1
    
    const marketAvgQty = data.reduce((sum, row) => {
      const qty = qtyCol ? parseFloat(row[qtyCol]) || 0 : 0
      return sum + qty
    }, 0) / data.length
    
    const featureStats = RUSSIAN_FEATURES.map(feat => ({
      ...feat,
      count: 0,
      totalQty: 0,
      avgPrice: 0,
      totalSales: 0,
      products: []
    }))
    
    data.forEach(row => {
      const name = nameCol ? String(row[nameCol]).toLowerCase() : ''
      const qty = qtyCol ? parseFloat(row[qtyCol]) || 0 : 0
      const price = priceCol ? parseFloat(row[priceCol]) || 0 : 0
      const sales = price * qty
      
      RUSSIAN_FEATURES.forEach((feat, idx) => {
        const hasFeature = feat.keywords.some(kw => name.includes(kw.toLowerCase()))
        if (hasFeature) {
          featureStats[idx].count++
          featureStats[idx].totalQty += qty
          featureStats[idx].avgPrice += price
          featureStats[idx].totalSales += sales
          if (nameCol) {
            featureStats[idx].products.push({
              name: row[nameCol],
              qty,
              price,
              sales
            })
          }
        }
      })
    })
    
    return featureStats
      .filter(f => f.count > 0)
      .map(f => ({
        ...f,
        avgPrice: f.count > 0 ? Math.round(f.avgPrice / f.count) : 0,
        avgQty: f.count > 0 ? Math.round(f.totalQty / f.count) : 0,
        avgSales: f.count > 0 ? Math.round(f.totalSales / f.count) : 0,
        marketAvgPrice: Math.round(marketAvgPrice),
        marketAvgQty: Math.round(marketAvgQty),
        premiumRate: f.avgPrice > 0 ? Math.round((f.avgPrice - marketAvgPrice) / marketAvgPrice * 100) : 0,
        qtyPremium: f.avgQty > 0 ? Math.round((f.avgQty - marketAvgQty) / marketAvgQty * 100) : 0
      }))
      .sort((a, b) => b.totalQty - a.totalQty)
  }, [data])

  if (!featureData || featureData.length === 0) {
    return (
      <div className="insight-card text-center py-12">
        <p className="text-morandi-text-light">数据中未找到功能特征信息</p>
      </div>
    )
  }

  const topFeatures = featureData.slice(0, 8)
  const totalProducts = data.length

  const formatRUB = (value) => `₽${Math.round(value).toLocaleString()}`
  const formatRMB = (value) => `¥${Math.round(value * EXCHANGE_RATE).toLocaleString()}`
  const formatBoth = (value) => `${formatRUB(value)} (${formatRMB(value)})`

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="kpi-card">
          <Zap className="w-6 h-6 text-morandi-primary mb-2" />
          <div className="text-xl font-bold text-morandi-text">{featureData.length}</div>
          <div className="text-xs text-morandi-text-light">功能类型数</div>
        </div>
        <div className="kpi-card">
          <Star className="w-6 h-6 text-morandi-accent mb-2" />
          <div className="text-xl font-bold text-morandi-text">{featureData[0]?.label || '-'}</div>
          <div className="text-xs text-morandi-text-light">最热功能</div>
        </div>
        <div className="kpi-card">
          <Thermometer className="w-6 h-6 text-morandi-success mb-2" />
          <div className="text-xl font-bold text-morandi-text">
            {featureData.reduce((sum, f) => sum + f.count, 0)}
          </div>
          <div className="text-xs text-morandi-text-light">功能商品总数</div>
        </div>
        <div className="kpi-card">
          <Wind className="w-6 h-6 text-morandi-secondary mb-2" />
          <div className="text-xl font-bold text-morandi-text">
            {Math.round(featureData.reduce((sum, f) => sum + f.count, 0) / totalProducts * 100)}%
          </div>
          <div className="text-xs text-morandi-text-light">功能商品占比</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="insight-card">
          <h3 className="font-semibold text-morandi-text mb-4">🏷️ 功能分布 (按销量)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topFeatures}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="totalQty" fill={chartColors.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="insight-card">
          <h3 className="font-semibold text-morandi-text mb-4">📊 功能占比</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topFeatures}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="label"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={true}
                >
                  {topFeatures.map((entry, index) => (
                    <Cell key={entry.label} fill={chartColors.palette[index % chartColors.palette.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value, name) => [`${value} 个商品`, name]}
                />
                <Legend 
                  layout="vertical" 
                  align="right" 
                  verticalAlign="middle"
                  formatter={(value) => <span className="text-sm text-morandi-text">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="insight-card">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-6 h-6 text-morandi-primary" />
          <h3 className="font-semibold text-morandi-text">🌍 俄语关键词市场分析</h3>
        </div>
        <p className="text-sm text-morandi-text-light mb-4">
          俄语-英语-中文三语对比分析，包含各功能关键词的市场表现与溢价情况
        </p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left" rowSpan={2}>功能</th>
                <th className="px-3 py-2 text-left" rowSpan={2}>Русский</th>
                <th className="px-3 py-2 text-left" rowSpan={2}>English</th>
                <th className="px-3 py-2 text-center" colSpan={3}>📈 市场情况</th>
                <th className="px-3 py-2 text-center" colSpan={3}>💰 溢价分析</th>
              </tr>
              <tr>
                <th className="px-2 py-1 text-right text-xs">商品数</th>
                <th className="px-2 py-1 text-right text-xs">销量</th>
                <th className="px-2 py-1 text-right text-xs">均价</th>
                <th className="px-2 py-1 text-right text-xs">vs市场</th>
                <th className="px-2 py-1 text-right text-xs">溢价</th>
                <th className="px-2 py-1 text-right text-xs">销量增幅</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {featureData.slice(0, 12).map((feat, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{feat.label}</td>
                  <td className="px-3 py-2 text-morandi-primary">{feat.ru}</td>
                  <td className="px-3 py-2 text-morandi-text-light">{feat.en}</td>
                  <td className="px-2 py-2 text-right">{feat.count}</td>
                  <td className="px-2 py-2 text-right">{feat.totalQty.toLocaleString()}</td>
                  <td className="px-2 py-2 text-right">
                    <div className="font-medium">{formatRUB(feat.avgPrice)}</div>
                    <div className="text-xs text-morandi-text-light">{formatRMB(feat.avgPrice)}</div>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <span className={feat.premiumRate > 0 ? 'text-green-600' : 'text-red-500'}>
                      {feat.premiumRate > 0 ? '+' : ''}{feat.premiumRate}%
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <div className="font-medium">{formatRUB(Math.abs(feat.avgPrice - feat.marketAvgPrice))}</div>
                    <div className="text-xs text-morandi-text-light">{formatRMB(Math.abs(feat.avgPrice - feat.marketAvgPrice))}</div>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <span className={feat.qtyPremium > 0 ? 'text-green-600' : 'text-red-500'}>
                      {feat.qtyPremium > 0 ? '+' : ''}{feat.qtyPremium}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="insight-card">
        <h3 className="font-semibold text-morandi-text mb-4">📋 功能详细数据</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">功能</th>
                <th className="px-4 py-2 text-left">Русский</th>
                <th className="px-4 py-2 text-right">商品数</th>
                <th className="px-4 py-2 text-right">总销量</th>
                <th className="px-4 py-2 text-right">均价 (₽/¥)</th>
                <th className="px-4 py-2 text-right">销售额 (₽/¥)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {featureData.slice(0, 12).map((feat, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{feat.label}</td>
                  <td className="px-4 py-2 text-morandi-text-light">{feat.ru}</td>
                  <td className="px-4 py-2 text-right">{feat.count}</td>
                  <td className="px-4 py-2 text-right">{feat.totalQty.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">
                    <div>{formatRUB(feat.avgPrice)}</div>
                    <div className="text-xs text-morandi-text-light">{formatRMB(feat.avgPrice)}</div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div>{formatRUB(Math.round(feat.avgSales * feat.count))}</div>
                    <div className="text-xs text-morandi-text-light">{formatRMB(feat.avgSales * feat.count)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
