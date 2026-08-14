/**
 * ProjectSetup.jsx — 立项决策页（T5-5 重点重做，展示层）
 * 数据（MARKET_INFO/PRODUCT_CATEGORIES）与交互（选择/展开/进入调研）零变化；
 * 视觉从"彩色双卡 + 产品小卡"改为：市场概况（统一白 Surface）+ 候选方向表（list 行）。
 * 业务色仅用于状态语义，产品类别不再各自配色。
 */
import { useState } from 'react'
import { CheckCircle2, Circle, Zap, Globe, Store, ChevronDown, ChevronRight, ArrowRight, AlertTriangle } from 'lucide-react'
import Surface from './ui/Surface'
import SectionHeader from './ui/SectionHeader'
import Badge from './ui/Badge'
import Button from './ui/Button'

const MARKET_INFO = {
  market: {
    name: '俄罗斯',
    population: '1.46亿',
    internetUsers: '1.1亿+',
    ecommerceGrowth: '年增长25%+',
    currency: '卢布 (RUB)',
    exchangeRate: '1₽ ≈ ¥0.09',
    keyInsights: [
      '跨境电商占电商总额20%+，中国商品占比持续增长',
      '轻工业品严重依赖进口，日用消费品需求旺盛',
      '西方品牌退出后市场空白巨大，中国品牌替代机会明显',
      '消费者价格敏感度高，性价比产品极具竞争力',
    ],
  },
  platform: {
    name: 'Ozon',
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
    id: 'hairdryer', name: '吹风机', ozonCategory: 'Красота и здоровье > Укладка волос > Фены',
    marketSize: '大', competition: '中高', margin: '15-30%', seasonality: '秋冬旺季',
    priceRange: '500-5000₽ (¥45-450)',
    keySellingPoints: ['负离子护发', '大功率速干', '轻量化设计', '多档温控'],
    targetAudience: '18-45岁女性，追求快速干发+护发',
    risks: ['品牌集中度高(Dyson/Philips)', '低价竞争激烈', '认证要求(EAC)'],
  },
  {
    id: 'pillow', name: '枕头', ozonCategory: 'Дом и сад > Текстиль > Подушки',
    marketSize: '大', competition: '中', margin: '20-40%', seasonality: '全年稳定，Q4略旺',
    priceRange: '300-3000₽ (¥27-270)',
    keySellingPoints: ['记忆棉人体工学', '颈椎支撑', '透气抗菌', '可拆洗枕套'],
    targetAudience: '25-55岁，关注睡眠质量和颈椎健康',
    risks: ['物流体积大运费高', '退货率偏高', '材质合规要求'],
  },
  {
    id: 'hairmask', name: '发膜', ozonCategory: 'Красота и здоровье > Уход за волосами > Маски',
    marketSize: '中', competition: '中', margin: '25-50%', seasonality: '秋冬旺季（干燥损伤）',
    priceRange: '200-2000₽ (¥18-180)',
    keySellingPoints: ['角蛋白修复', '深层滋养', '受损发质专用', '天然成分'],
    targetAudience: '18-40岁女性，染烫受损发质',
    risks: ['成分合规(INCI)', '保质期管理', '品牌认知度门槛'],
  },
  {
    id: 'essentialoil', name: '精油喷雾', ozonCategory: 'Красота и здоровье > Уход за волосами > Спреи',
    marketSize: '中', competition: '中低', margin: '30-60%', seasonality: '全年稳定',
    priceRange: '150-1500₽ (¥14-135)',
    keySellingPoints: ['免洗护发', '防热损伤', '便携旅行装', '天然植物提取'],
    targetAudience: '18-35岁女性，日常护发+造型需求',
    risks: ['液体运输限制', '成分合规严格', '复购率依赖品牌力'],
  },
  {
    id: 'gloves', name: '家用手套', ozonCategory: 'Дом и сад > Товары для уборки > Перчатки',
    marketSize: '大', competition: '中', margin: '20-40%', seasonality: '全年稳定，Q4略旺',
    priceRange: '100-800₽ (¥9-72)',
    keySellingPoints: ['加厚耐用', '食品级材质', '防滑纹理', '多尺码可选'],
    targetAudience: '25-55岁家庭主妇，日常清洁+厨房使用',
    risks: ['低价竞争激烈', '材质认证要求(食品级)', '尺码退货率'],
  },
]

// 展示层映射：物流信息从既有 risk 文本提取（不新增业务判断）
const logisticsOf = (cat) => cat.risks.find((r) => /物流|运输|运费/.test(r)) || '—'
const riskBrief = (cat) => cat.risks.filter((r) => !/物流|运输|运费/.test(r)).slice(0, 2)

function StatLine({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-xs text-workspace-text-secondary">{label}</span>
      <span className="tabular-nums text-[13px] font-medium text-workspace-text">{value}</span>
    </div>
  )
}

export default function ProjectSetup({ onNavigateToResearch }) {
  const [selectedCategories, setSelectedCategories] = useState([])
  const [expandedCategory, setExpandedCategory] = useState(null)

  const toggleCategory = (id) => {
    setSelectedCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }
  const toggleExpand = (id) => setExpandedCategory(prev => prev === id ? null : id)

  return (
    <div className="space-y-5">
      {/* 市场概况：统一白 Surface，不用蓝/紫双卡 */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Surface className="p-5">
          <SectionHeader title="俄罗斯市场" extra={<Globe className="h-4 w-4 text-workspace-text-tertiary" />} />
          <div className="mt-2 divide-y divide-workspace-border">
            <StatLine label="人口" value={MARKET_INFO.market.population} />
            <StatLine label="互联网用户" value={MARKET_INFO.market.internetUsers} />
            <StatLine label="电商增速" value={MARKET_INFO.market.ecommerceGrowth} />
            <StatLine label="货币 / 参考汇率" value={`${MARKET_INFO.market.currency} · ${MARKET_INFO.market.exchangeRate}`} />
          </div>
          <ul className="mt-3 space-y-1.5">
            {MARKET_INFO.market.keyInsights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] leading-snug text-workspace-text-secondary">
                <Zap className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-workspace-primary" />
                {insight}
              </li>
            ))}
          </ul>
        </Surface>

        <Surface className="p-5">
          <SectionHeader title={MARKET_INFO.platform.name} extra={<Store className="h-4 w-4 text-workspace-text-tertiary" />} />
          <div className="mt-2 divide-y divide-workspace-border">
            <StatLine label="创立 / 卖家" value={`${MARKET_INFO.platform.founded} · ${MARKET_INFO.platform.sellers}`} />
            <StatLine label="月访问量" value={MARKET_INFO.platform.monthlyVisitors} />
            <StatLine label="GMV" value={MARKET_INFO.platform.gmv} />
            <StatLine label="佣金范围" value={MARKET_INFO.platform.commission} />
            <StatLine label="发货模式" value={MARKET_INFO.platform.fulfillment} />
          </div>
          <ul className="mt-3 space-y-1.5">
            {MARKET_INFO.platform.keyFeatures.map((feature, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] leading-snug text-workspace-text-secondary">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-workspace-success" />
                {feature}
              </li>
            ))}
          </ul>
        </Surface>
      </div>

      {/* 候选方向：list 行 + 展开详情，不用每个产品一个大彩色卡 */}
      <Surface>
        <div className="flex items-center justify-between px-5 pt-4">
          <SectionHeader title="候选方向" />
          {selectedCategories.length > 0 && (
            <span className="text-xs text-workspace-text-secondary">已选 {selectedCategories.length} 个</span>
          )}
        </div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-[13px]">
            <thead>
              <tr className="border-y border-workspace-border bg-workspace-surface-subtle text-left text-xs text-workspace-text-secondary">
                <th className="px-5 py-2 font-medium">商品</th>
                <th className="px-3 py-2 font-medium">市场判断</th>
                <th className="px-3 py-2 font-medium">竞争</th>
                <th className="px-3 py-2 font-medium">利润预期</th>
                <th className="px-3 py-2 font-medium">物流</th>
                <th className="px-3 py-2 font-medium">风险</th>
                <th className="px-5 py-2 text-right font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {PRODUCT_CATEGORIES.map((cat) => {
                const isSelected = selectedCategories.includes(cat.id)
                const isExpanded = expandedCategory === cat.id
                const briefs = riskBrief(cat)
                return (
                  <FragmentRow key={cat.id}>
                    <tr
                      onClick={() => toggleCategory(cat.id)}
                      className={`cursor-pointer border-b border-workspace-border transition-colors hover:bg-workspace-surface-subtle ${isSelected ? 'bg-workspace-primary-soft' : ''}`}
                    >
                      <td className="px-5 py-2.5">
                        <button onClick={(e) => { e.stopPropagation(); toggleExpand(cat.id) }} className="mr-1 inline-flex align-middle text-workspace-text-tertiary">
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                        <span className="font-medium text-workspace-text">{cat.name}</span>
                        <div className="mt-0.5 pl-5 text-xs text-workspace-text-tertiary">{cat.ozonCategory}</div>
                      </td>
                      <td className="px-3 py-2.5 text-workspace-text">市场{cat.marketSize} · {cat.seasonality}</td>
                      <td className="px-3 py-2.5 text-workspace-text">{cat.competition}</td>
                      <td className="tabular-nums px-3 py-2.5 text-workspace-text">毛利 {cat.margin}</td>
                      <td className="px-3 py-2.5 text-workspace-text-secondary">{logisticsOf(cat)}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1">
                          {briefs.map((r) => (
                            <Badge key={r} tone="warning">{r.length > 12 ? `${r.slice(0, 12)}…` : r}</Badge>
                          ))}
                          {cat.risks.length - briefs.length > 0 && <span className="text-xs text-workspace-text-tertiary">+{cat.risks.length - briefs.length}</span>}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        {isSelected ? (
                          <Badge tone="primary"><CheckCircle2 className="h-3 w-3" /> 已选</Badge>
                        ) : (
                          <Badge tone="neutral">待评估</Badge>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-workspace-border bg-workspace-surface-subtle/60">
                        <td colSpan={7} className="px-5 py-3">
                          <div className="grid gap-3 text-[13px] text-workspace-text sm:grid-cols-3">
                            <div>
                              <div className="mb-1 text-xs font-medium text-workspace-text-secondary">核心卖点 / 价格带</div>
                              <div className="mb-1">{cat.priceRange}</div>
                              {cat.keySellingPoints.map((sp) => <span key={sp} className="mr-1 inline-block rounded-[5px] bg-workspace-surface px-1.5 py-0.5 text-xs text-workspace-text-secondary">{sp}</span>)}
                            </div>
                            <div>
                              <div className="mb-1 text-xs font-medium text-workspace-text-secondary">目标人群</div>
                              {cat.targetAudience}
                            </div>
                            <div>
                              <div className="mb-1 text-xs font-medium text-workspace-text-secondary">风险提示</div>
                              <ul className="space-y-1">
                                {cat.risks.map((risk) => (
                                  <li key={risk} className="flex items-start gap-1.5 text-workspace-text-secondary">
                                    <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-workspace-warning" />
                                    {risk}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </FragmentRow>
                )
              })}
            </tbody>
          </table>
        </div>
      </Surface>

      {selectedCategories.length > 0 && (
        <Surface className="flex items-center justify-between gap-3 p-5">
          <div>
            <div className="text-sm font-semibold text-workspace-text">已选择 {selectedCategories.length} 个类目</div>
            <div className="mt-0.5 text-[13px] text-workspace-text-secondary">
              {selectedCategories.map(id => PRODUCT_CATEGORIES.find(c => c.id === id)?.name).join('、')}
            </div>
          </div>
          <Button variant="primary" onClick={() => onNavigateToResearch?.()}>
            进入市场调研
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Surface>
      )}
    </div>
  )
}

function FragmentRow({ children }) {
  return <>{children}</>
}
