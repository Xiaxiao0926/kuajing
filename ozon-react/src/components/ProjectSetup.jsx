import { useState } from 'react'
import { CheckCircle2, Circle, Zap, Globe, Store, Package, TrendingUp, Users, BarChart3, ArrowRight } from 'lucide-react'

const MARKET_INFO = {
  market: {
    name: '俄罗斯',
    flag: '🇷🇺',
    population: '1.46亿',
    internetUsers: '1.1亿+',
    ecommerceGrowth: '年增长25%+',
    currency: '卢布 (RUB)',
    exchangeRate: '1¥ ≈ 13₽',
    keyInsights: [
      '跨境电商占电商总额20%+，中国商品占比持续增长',
      '轻工业品严重依赖进口，日用消费品需求旺盛',
      '西方品牌退出后市场空白巨大，中国品牌替代机会明显',
      '消费者价格敏感度高，性价比产品极具竞争力',
    ],
  },
  platform: {
    name: 'Ozon',
    logo: '🟣',
    founded: '1998年',
    gmv: '2023年GMV超1.7万亿卢布',
    sellers: '50万+活跃卖家',
    monthlyVisitors: '3亿+月访问量',
    fulfillment: 'FBO(平台仓) / FBS(卖家仓) / rFBS(远程仓)',
    commission: '5%-25%（按类目）',
    keyFeatures: [
      '俄罗斯第二大电商平台，被称为"俄罗斯亚马逊"',
      'FBO模式配送覆盖全俄，2-5天送达',
      '支持中国卖家直接入驻，中文客服',
      '广告系统成熟，CPC竞价模式',
    ],
  },
}

const PRODUCT_CATEGORIES = [
  {
    id: 'hairdryer',
    name: '吹风机',
    icon: '💇',
    color: 'rose',
    ozonCategory: 'Красота и здоровье > Укладка волос > Фены',
    marketSize: '大',
    competition: '中高',
    margin: '15-30%',
    seasonality: '秋冬旺季',
    priceRange: '500-5000₽ (¥38-385)',
    keySellingPoints: ['负离子护发', '大功率速干', '轻量化设计', '多档温控'],
    targetAudience: '18-45岁女性，追求快速干发+护发',
    risks: ['品牌集中度高(Dyson/Philips)', '低价竞争激烈', '认证要求(EAC)'],
  },
  {
    id: 'pillow',
    name: '枕头',
    icon: '🛏️',
    color: 'blue',
    ozonCategory: 'Дом и сад > Текстиль > Подушки',
    marketSize: '大',
    competition: '中',
    margin: '20-40%',
    seasonality: '全年稳定，Q4略旺',
    priceRange: '300-3000₽ (¥23-230)',
    keySellingPoints: ['记忆棉人体工学', '颈椎支撑', '透气抗菌', '可拆洗枕套'],
    targetAudience: '25-55岁，关注睡眠质量和颈椎健康',
    risks: ['物流体积大运费高', '退货率偏高', '材质合规要求'],
  },
  {
    id: 'hairmask',
    name: '发膜',
    icon: '🧴',
    color: 'purple',
    marketSize: '中',
    competition: '中',
    margin: '25-50%',
    seasonality: '秋冬旺季（干燥损伤）',
    ozonCategory: 'Красота и здоровье > Уход за волосами > Маски',
    priceRange: '200-2000₽ (¥15-154)',
    keySellingPoints: ['角蛋白修复', '深层滋养', '受损发质专用', '天然成分'],
    targetAudience: '18-40岁女性，染烫受损发质',
    risks: ['成分合规(INCI)', '保质期管理', '品牌认知度门槛'],
  },
  {
    id: 'essentialoil',
    name: '精油喷雾',
    icon: '🌿',
    color: 'green',
    marketSize: '中',
    competition: '中低',
    margin: '30-60%',
    seasonality: '全年稳定',
    ozonCategory: 'Красота и здоровье > Уход за волосами > Спреи',
    priceRange: '150-1500₽ (¥12-115)',
    keySellingPoints: ['免洗护发', '防热损伤', '便携旅行装', '天然植物提取'],
    targetAudience: '18-35岁女性，日常护发+造型需求',
    risks: ['液体运输限制', '成分合规严格', '复购率依赖品牌力'],
  },
  {
    id: 'gloves',
    name: '家用手套',
    icon: '🧤',
    color: 'teal',
    marketSize: '大',
    competition: '中',
    margin: '20-40%',
    seasonality: '全年稳定，Q4略旺',
    ozonCategory: 'Дом и сад > Товары для уборки > Перчатки',
    priceRange: '100-800₽ (¥8-62)',
    keySellingPoints: ['加厚耐用', '食品级材质', '防滑纹理', '多尺码可选'],
    targetAudience: '25-55岁家庭主妇，日常清洁+厨房使用',
    risks: ['低价竞争激烈', '材质认证要求(食品级)', '尺码退货率'],
  },
]

const COLOR_MAP = {
  rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-700', icon: 'bg-rose-100' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700', icon: 'bg-blue-100' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700', icon: 'bg-purple-100' },
  green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-700', icon: 'bg-green-100' },
  teal: { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', badge: 'bg-teal-100 text-teal-700', icon: 'bg-teal-100' },
}

export default function ProjectSetup({ onNavigateToResearch }) {
  const [selectedCategories, setSelectedCategories] = useState([])
  const [expandedCategory, setExpandedCategory] = useState(null)

  const toggleCategory = (id) => {
    setSelectedCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  const toggleExpand = (id) => {
    setExpandedCategory(prev => prev === id ? null : id)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-xl">{MARKET_INFO.market.flag}</div>
            <div>
              <h3 className="text-lg font-bold text-morandi-text">{MARKET_INFO.market.name}市场</h3>
              <p className="text-xs text-morandi-text-light">人口 {MARKET_INFO.market.population} · 互联网用户 {MARKET_INFO.market.internetUsers}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-blue-700">{MARKET_INFO.market.ecommerceGrowth}</div>
              <div className="text-[10px] text-blue-600">电商增速</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-blue-700">{MARKET_INFO.market.exchangeRate}</div>
              <div className="text-[10px] text-blue-600">参考汇率</div>
            </div>
          </div>
          <div className="space-y-2">
            {MARKET_INFO.market.keyInsights.map((insight, i) => (
              <div key={i} className="flex items-start gap-2">
                <Zap className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-gray-600">{insight}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-xl">{MARKET_INFO.platform.logo}</div>
            <div>
              <h3 className="text-lg font-bold text-morandi-text">{MARKET_INFO.platform.name}</h3>
              <p className="text-xs text-morandi-text-light">创立 {MARKET_INFO.platform.founded} · {MARKET_INFO.platform.sellers}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <div className="text-sm font-bold text-purple-700">{MARKET_INFO.platform.gmv}</div>
              <div className="text-[10px] text-purple-600">GMV</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <div className="text-sm font-bold text-purple-700">{MARKET_INFO.platform.commission}</div>
              <div className="text-[10px] text-purple-600">佣金范围</div>
            </div>
          </div>
          <div className="mb-3">
            <span className="text-[10px] text-morandi-text-light">发货模式：</span>
            <span className="text-xs text-morandi-text font-medium">{MARKET_INFO.platform.fulfillment}</span>
          </div>
          <div className="space-y-2">
            {MARKET_INFO.platform.keyFeatures.map((feature, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-500 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-gray-600">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-morandi-text flex items-center gap-2">
            <Package className="w-5 h-5 text-morandi-primary" />
            产品类目选择
          </h3>
          {selectedCategories.length > 0 && (
            <span className="text-xs text-morandi-primary font-medium">已选 {selectedCategories.length} 个类目</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {PRODUCT_CATEGORIES.map((cat) => {
            const colors = COLOR_MAP[cat.color]
            const isSelected = selectedCategories.includes(cat.id)
            const isExpanded = expandedCategory === cat.id
            return (
              <div key={cat.id} className={`rounded-xl border-2 transition-all ${isSelected ? `${colors.border} ${colors.bg}` : 'border-gray-100 hover:border-gray-200'}`}>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg ${colors.icon}`}>{cat.icon}</div>
                      <div>
                        <h4 className="text-sm font-bold text-morandi-text">{cat.name}</h4>
                        <p className="text-[10px] text-morandi-text-light">{cat.ozonCategory}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleCategory(cat.id)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${isSelected ? `${colors.badge}` : 'bg-gray-100 hover:bg-gray-200'}`}
                    >
                      {isSelected ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4 text-gray-400" />}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${colors.badge}`}>市场{cat.marketSize}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-600">竞争{cat.competition}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-700">毛利{cat.margin}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-cyan-100 text-cyan-700">{cat.seasonality}</span>
                  </div>
                  <div className="text-[10px] text-morandi-text-light mb-2">价格带：{cat.priceRange}</div>
                  <button
                    onClick={() => toggleExpand(cat.id)}
                    className="text-[10px] text-morandi-primary hover:underline"
                  >
                    {isExpanded ? '收起详情' : '查看详情'}
                  </button>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-gray-100 mt-0">
                    <div className="pt-3 space-y-3">
                      <div>
                        <h5 className="text-[10px] font-semibold text-morandi-text mb-1.5">核心卖点</h5>
                        <div className="flex flex-wrap gap-1">
                          {cat.keySellingPoints.map((sp, i) => (
                            <span key={i} className={`px-2 py-0.5 rounded text-[10px] ${colors.badge}`}>{sp}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h5 className="text-[10px] font-semibold text-morandi-text mb-1">目标人群</h5>
                        <p className="text-[10px] text-gray-500">{cat.targetAudience}</p>
                      </div>
                      <div>
                        <h5 className="text-[10px] font-semibold text-morandi-text mb-1.5">风险提示</h5>
                        <div className="space-y-1">
                          {cat.risks.map((risk, i) => (
                            <div key={i} className="flex items-start gap-1">
                              <span className="text-[10px] text-red-400">⚠️</span>
                              <span className="text-[10px] text-gray-500">{risk}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {selectedCategories.length > 0 && (
        <div className="bg-gradient-to-r from-morandi-primary/5 to-morandi-secondary/5 rounded-xl p-5 border border-morandi-primary/10">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-morandi-text">已选择 {selectedCategories.length} 个类目</h4>
              <p className="text-xs text-morandi-text-light mt-0.5">
                {selectedCategories.map(id => PRODUCT_CATEGORIES.find(c => c.id === id)?.name).join('、')}
              </p>
            </div>
            <button
              onClick={() => onNavigateToResearch?.()}
              className="flex items-center gap-2 px-5 py-2.5 bg-morandi-primary text-white rounded-lg text-sm font-medium hover:bg-morandi-primary/90 transition-colors"
            >
              进入市场调研
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
