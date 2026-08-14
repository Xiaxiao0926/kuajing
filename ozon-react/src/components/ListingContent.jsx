import { useState } from 'react'
import { Check, ChevronDown, ChevronRight, Image, Film, Search, FileText, Eye, ShoppingBag } from 'lucide-react'

export default function ListingContent() {
  const [expandedSections, setExpandedSections] = useState({
    habits: true,
    images: true,
    video: true,
    seo: true,
    title: true,
    bullets: true,
    description: true,
    priorities: true
  })

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const imageStructure = [
    { order: 1, type: '主视觉图', focus: '产品+氛围+核心卖点', purpose: '拉点击' },
    { order: 2, type: '功效图', focus: '产品核心效果展示', purpose: '强转化' },
    { order: 3, type: '场景图', focus: '使用环境', purpose: '建立代入感' },
    { order: 4, type: '使用步骤图', focus: '怎么使用', purpose: '降低咨询' },
    { order: 5, type: '成分/材质图', focus: '原料/结构说明', purpose: '提升信任' },
    { order: 6, type: '尺寸参数图', focus: '容量/尺寸/重量', purpose: '降低退货' },
    { order: 7, type: '包装内容图', focus: '套装包含什么', purpose: '清晰交付感' },
    { order: 8, type: '对比图', focus: '和普通产品差异', purpose: '拉转化' },
    { order: 9, type: '用户效果图', focus: 'Before/After', purpose: '美妆强需求' },
    { order: 10, type: '品牌价值图', focus: '品牌理念/包装质感', purpose: '品牌感提升' },
  ]

  const videoStructure = [
    { time: '0-3秒', content: '痛点切入', example: '头发毛躁？干枯分叉？吹头发太慢？洗碗伤手？' },
    { time: '3-10秒', content: '展示产品外观', details: '包装、容量、外观' },
    { time: '10-20秒', content: '真人使用演示', note: '俄罗斯用户非常喜欢真使用场景，不是纯广告' },
    { time: '20-30秒', content: '卖点展示', details: '+俄文字幕' },
  ]

  const titleStructure = ['品牌', '品类', '功效', '核心卖点', '容量']

  const bulletPoints = [
    { number: 1, focus: '功效价值', content: '解决什么问题' },
    { number: 2, focus: '材质优势', content: '成分/面料/结构' },
    { number: 3, focus: '使用场景', content: '在哪里用' },
    { number: 4, focus: '适用人群', content: '适合谁' },
    { number: 5, focus: '包装信息', content: '包含什么' },
  ]

  const descriptionModules = [
    '品牌介绍',
    '核心卖点',
    '真实效果图',
    '使用方式',
    '参数信息（容量、材质、尺寸、重量）',
    '包装内容展示',
  ]

  const productPriorities = [
    {
      priority: '第一优先',
      products: ['护发精油', '发膜'],
      recommendation: '氛围图 + 模特发丝效果图 + Before/After'
    },
    {
      priority: '第二优先',
      products: ['手套'],
      recommendation: '真人佩戴 + 厨房清洁场景'
    },
    {
      priority: '第三优先',
      products: ['吹风机'],
      recommendation: '产品主体 + 功能 icon + 真人吹发场景'
    }
  ]

  const Section = ({ id, title, icon: Icon, children }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
      <button
        onClick={() => toggleSection(id)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl flex items-center justify-center">
            <Icon className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        </div>
        {expandedSections[id] ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>
      {expandedSections[id] && (
        <div className="px-6 pb-6">
          {children}
        </div>
      )}
    </div>
  )

  const Card = ({ children, highlight = false }) => (
    <div className={`p-5 rounded-xl border ${highlight ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
      {children}
    </div>
  )

  const Badge = ({ children, color = 'blue' }) => {
    const colors = {
      blue: 'bg-blue-100 text-blue-700',
      green: 'bg-green-100 text-green-700',
      purple: 'bg-purple-100 text-purple-700',
      orange: 'bg-orange-100 text-orange-700',
    }
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${colors[color]}`}>
        {children}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* 顶部摘要 */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Ozon 商品内容制作 SOP</h2>
            <p className="text-white/80 text-sm">俄罗斯市场版</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <Badge color="green">点击率 CTR</Badge>
          <Badge color="green">转化率 CVR</Badge>
          <Badge color="green">搜索曝光 SEO</Badge>
          <Badge color="green">收藏加购率</Badge>
          <Badge color="green">Ozon 推荐流量</Badge>
        </div>
        <div className="mt-6 p-4 bg-white/10 rounded-xl">
          <p className="text-sm font-medium mb-2">💡 核心原则</p>
          <ul className="space-y-1 text-sm text-white/90">
            <li>• 图要丰富</li>
            <li>• 卖点要直接</li>
            <li>• 俄文化表达强</li>
            <li>• 使用场景真实</li>
            <li>• 功效展示清晰</li>
          </ul>
        </div>
      </div>

      {/* 俄罗斯用户视觉习惯 */}
      <Section id="habits" title="俄罗斯用户视觉习惯" icon={Eye}>
        <div className="grid md:grid-cols-3 gap-4">
          <Card highlight>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">1</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 mb-2">首图要"丰富"</h4>
                <p className="text-sm text-gray-600">不是纯白底</p>
                <div className="mt-3 space-y-1">
                  <p className="text-sm text-gray-500">• 产品大主体</p>
                  <p className="text-sm text-gray-500">• 场景化</p>
                  <p className="text-sm text-gray-500">• 带氛围感</p>
                  <p className="text-sm text-gray-500">• 轻文案卖点</p>
                </div>
              </div>
            </div>
          </Card>
          <Card highlight>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">2</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 mb-2">喜欢"直接看到结果"</h4>
                <p className="text-sm text-gray-600">例如：护发精油</p>
                <div className="mt-3 space-y-1">
                  <p className="text-sm text-gray-500">• 使用前后头发变化</p>
                  <p className="text-sm text-gray-500">• 顺滑效果</p>
                  <p className="text-sm text-gray-500">• 光泽感</p>
                </div>
                <p className="text-xs text-gray-400 mt-2">不是单纯瓶子摆拍</p>
              </div>
            </div>
          </Card>
          <Card highlight>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">3</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 mb-2">喜欢信息一次看懂</h4>
                <p className="text-sm text-gray-600">俄罗斯买家不爱点很深</p>
                <div className="mt-3 space-y-1">
                  <p className="text-sm text-gray-500">• 几件装</p>
                  <p className="text-sm text-gray-500">• 容量</p>
                  <p className="text-sm text-gray-500">• 核心功能</p>
                  <p className="text-sm text-gray-500">• 适用场景</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </Section>

      {/* 商品图片体系 */}
      <Section id="images" title="商品图片体系（8-10张）" icon={Image}>
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
          <p className="text-yellow-800 font-medium">📌 建议数量：8-10张图片</p>
        </div>
        <div className="grid gap-3">
          {imageStructure.map((item) => (
            <div key={item.order} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">{item.order}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-semibold text-gray-800">{item.type}</span>
                  <Badge>{item.purpose}</Badge>
                </div>
                <p className="text-sm text-gray-600">{item.focus}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 首图标准 */}
        <div className="mt-6">
          <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="text-blue-600">🎨</span> 首图标准（俄罗斯市场重点）
          </h4>
          <Card highlight>
            <p className="font-medium text-gray-800 mb-3">推荐结构：产品主体 + 场景氛围 + 卖点短文案</p>
            <p className="text-sm text-gray-600 mb-4">不是纯白底</p>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 bg-white rounded-lg border">
                <p className="font-medium text-gray-800 mb-2">美妆背景</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 奶油白</li>
                  <li>• 浅金</li>
                  <li>• 浅粉</li>
                  <li>• 水波纹</li>
                  <li>• 光影背景</li>
                </ul>
              </div>
              <div className="p-4 bg-white rounded-lg border">
                <p className="font-medium text-gray-800 mb-2">家居背景</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 客厅</li>
                  <li>• 卧室</li>
                  <li>• 木桌背景</li>
                </ul>
              </div>
              <div className="p-4 bg-white rounded-lg border">
                <p className="font-medium text-gray-800 mb-2">电器背景</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 深灰</li>
                  <li>• 科技蓝</li>
                  <li>• 金属背景</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="font-medium text-blue-800 mb-2">📝 首图文字建议（俄文）</p>
              <p className="text-sm text-blue-700">控制在 3组以内</p>
              <div className="mt-3 grid md:grid-cols-3 gap-4">
                <div className="p-3 bg-white rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">护发精油示例</p>
                  <p className="text-sm font-medium">Восстановление</p>
                  <p className="text-xs text-gray-500">修护</p>
                  <p className="text-sm font-medium mt-1">Увлажнение</p>
                  <p className="text-xs text-gray-500">滋润</p>
                  <p className="text-sm font-medium mt-1">Блеск волос</p>
                  <p className="text-xs text-gray-500">秀发光泽</p>
                </div>
                <div className="p-3 bg-white rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">手套示例</p>
                  <p className="text-sm font-medium">Прочные</p>
                  <p className="text-xs text-gray-500">耐用</p>
                  <p className="text-sm font-medium mt-1">Водонепроницаемые</p>
                  <p className="text-xs text-gray-500">防水</p>
                  <p className="text-sm font-medium mt-1">Многоразовые</p>
                  <p className="text-xs text-gray-500">可重复使用</p>
                </div>
                <div className="p-3 bg-white rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">吹风机示例</p>
                  <p className="text-sm font-medium">2000W</p>
                  <p className="text-sm font-medium mt-1">Ионизация</p>
                  <p className="text-sm font-medium mt-1">Холодный воздух</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </Section>

      {/* 视频内容标准 */}
      <Section id="video" title="视频内容标准" icon={Film}>
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-green-800 font-medium">🎬 推荐时长：15-30秒最佳</p>
        </div>
        <div className="space-y-4">
          {videoStructure.map((item, idx) => (
            <div key={idx} className="flex gap-4 p-4 bg-gray-50 rounded-xl">
              <div className="w-24 flex-shrink-0">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  {item.time}
                </span>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-800 mb-2">{item.content}</h4>
                {item.example && (
                  <p className="text-sm text-gray-600 mb-2">"{item.example}"</p>
                )}
                {item.details && (
                  <p className="text-sm text-gray-600">{item.details}</p>
                )}
                {item.note && (
                  <p className="text-sm text-purple-600 mt-2">💡 {item.note}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* SEO关键词结构 */}
      <Section id="seo" title="SEO关键词结构" icon={Search}>
        <Card highlight>
          <p className="font-medium text-gray-800 mb-4">核心词 + 功效词 + 场景词 + 属性词</p>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h5 className="font-semibold text-gray-800 mb-3">护发精油示例</h5>
              <div className="space-y-2">
                <p className="text-sm font-medium text-blue-600">主词：</p>
                <p className="text-sm text-gray-700">масло для волос</p>
                <p className="text-sm font-medium text-blue-600 mt-3">长尾词：</p>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>масло для сухих волос</li>
                  <li>масло для восстановления волос</li>
                  <li>масло для кончиков волос</li>
                  <li>несмываемое масло для волос</li>
                </ul>
              </div>
            </div>
            <div>
              <h5 className="font-semibold text-gray-800 mb-3">手套示例</h5>
              <div className="space-y-2">
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>перчатки хозяйственные</li>
                  <li>резиновые перчатки</li>
                  <li>перчатки для уборки</li>
                  <li>кухонные перчатки</li>
                </ul>
              </div>
            </div>
            <div>
              <h5 className="font-semibold text-gray-800 mb-3">吹风机示例</h5>
              <div className="space-y-2">
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>фен для волос</li>
                  <li>профессиональный фен</li>
                  <li>фен с ионизацией</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>
      </Section>

      {/* 标题SOP */}
      <Section id="title" title="标题 SOP（俄文）" icon={FileText}>
        <Card highlight>
          <p className="font-medium text-gray-800 mb-4">推荐结构：</p>
          <div className="flex flex-wrap gap-2 mb-6">
            {titleStructure.map((part, idx) => (
              <span key={idx} className="px-4 py-2 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 rounded-lg font-medium">
                {part}
              </span>
            ))}
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-white rounded-lg border">
              <p className="text-xs text-gray-500 mb-1">护发精油示例</p>
              <p className="text-sm text-gray-800 font-medium">
                Maria'iQ Масло для волос восстанавливающее, увлажняющее, против сухости и секущихся кончиков, 100 мл
              </p>
            </div>
            <div className="p-4 bg-white rounded-lg border">
              <p className="text-xs text-gray-500 mb-1">发膜示例</p>
              <p className="text-sm text-gray-800 font-medium">
                Маска для волос питательная восстанавливающая для сухих и поврежденных волос, 500 мл
              </p>
            </div>
            <div className="p-4 bg-white rounded-lg border">
              <p className="text-xs text-gray-500 mb-1">手套示例</p>
              <p className="text-sm text-gray-800 font-medium">
                Перчатки хозяйственные резиновые многоразовые для уборки кухни
              </p>
            </div>
          </div>
        </Card>
      </Section>

      {/* 五点卖点SOP */}
      <Section id="bullets" title="五点卖点 SOP（俄区转化版）" icon={Check}>
        <div className="mb-4">
          <p className="text-sm text-gray-600">每条一句，简洁直接</p>
        </div>
        <div className="grid gap-3">
          {bulletPoints.map((item) => (
            <div key={item.number} className="flex gap-4 p-4 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">{item.number}</span>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-800 mb-1">{item.focus}</h4>
                <p className="text-sm text-gray-600">{item.content}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 详情页内容模块 */}
      <Section id="description" title="详情页内容模块" icon={FileText}>
        <Card>
          <div className="space-y-2">
            {descriptionModules.map((module, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">{idx + 1}</span>
                </div>
                <span className="text-gray-800">{module}</span>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      {/* 重点打法 */}
      <Section id="priorities" title="现阶段重点打法" icon={ShoppingBag}>
        <div className="space-y-4">
          {productPriorities.map((item, idx) => (
            <Card key={idx} highlight={idx === 0}>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 ${idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-gray-300' : 'bg-orange-300'} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <span className="font-bold text-white">{idx + 1}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-bold text-gray-800">{item.priority}</span>
                    <span className="text-gray-500">{item.products.join(' / ')}</span>
                  </div>
                  <p className="text-gray-700">
                    <span className="text-blue-600 font-medium">建议：</span> {item.recommendation}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* 底部总结 */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-6 text-white">
        <h3 className="text-lg font-bold mb-2">📝 最终总结</h3>
        <p className="mb-3">针对俄罗斯 Ozon：</p>
        <div className="bg-white/10 rounded-xl p-4">
          <p className="font-medium mb-2">内容重点不是"规范展示商品"</p>
          <p className="text-xl font-bold">而是："让俄罗斯消费者快速理解商品，并产生购买冲动"</p>
        </div>
      </div>
    </div>
  )
}
