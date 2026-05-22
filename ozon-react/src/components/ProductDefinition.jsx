import { Target, Users, Lightbulb, Ruler, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

const SECTIONS = [
  {
    id: 'function',
    icon: Target,
    title: '功能定位',
    subtitle: '解决什么问题',
    color: 'rose',
    overview: '搞清楚你的产品到底帮消费者解决什么问题。不是"我有什么功能"，而是"消费者为什么要买"。把消费者痛点翻译成产品功能清单，确保做出来的东西有人要。',
    methods: [
      {
        name: '看差评找痛点',
        desc: '直接去Ozon上看竞品的差评，消费者骂什么就是痛点。这是最直接、最省钱的办法。',
        example: '比如看Ozon上吹风机的差评："风力太弱吹半天""太重手酸""温度太高烧头发"——这三个痛点直接对应三个功能方向：大功率马达、轻量化设计、智能温控。',
        steps: ['打开Ozon，搜你的品类，按差评排序', '把差评里反复出现的问题记下来，归类统计', '每个痛点标注出现频率（10条差评里有几条在说这个）', '按频率排序，频率最高的就是最该解决的功能'],
      },
      {
        name: '功能分三档',
        desc: '把功能分成"必须有""最好有""有了更牛"三档。第一档不做就卖不动，第二档做了能多卖点，第三档做了能卖贵点。',
        example: '吹风机：必须有=能吹干头发（没有这个谁买）；最好有=恒温不伤发（消费者关心但不是刚需）；有了更牛=精华养护功能（竞品少，能卖溢价）。\n枕头：必须有=支撑颈部；最好有=记忆棉慢回弹；有了更牛=可调节高度。',
        steps: ['列出你能想到的所有功能点', '问自己：没这个功能，消费者会不会直接不买？→ 必须有', '问自己：有这个功能，消费者愿不愿意多付钱？→ 最好有/有了更牛', '按这个优先级分配开发资源和成本'],
      },
      {
        name: '竞品功能对比表',
        desc: '把竞品的功能列出来打勾，看哪些功能大家都做了（红海），哪些没人做但消费者需要（蓝海）。',
        example: '比如发膜品类，拉个表：5个竞品都写了"深层修复"→ 红海别卷了；只有1家写了"免蒸加热"→ 可能是机会；没有一家写"分区域护理（发根/发梢分开）"→ 空白区，值得试。',
        steps: ['挑5-10个卖得最好的竞品', '把所有功能点列出来，做成表格', '每个竞品每个功能打勾或不打', '找"消费者常搜但竞品少做"的功能空白'],
      },
    ],
    output: '产品功能清单（按优先级排好）、竞品功能对比表',
  },
  {
    id: 'persona',
    icon: Users,
    title: '目标人群画像',
    subtitle: '谁在买、为什么买',
    color: 'blue',
    overview: '搞清楚到底是谁在买你的东西。不是"所有俄罗斯人"，而是具体到"25-35岁、月入5万卢布、住莫斯科、关注头发护理的职场女性"。越具体，产品越好做，广告越好投。',
    methods: [
      {
        name: '看评论猜买家',
        desc: 'Ozon评论里藏着大量买家信息。看他们怎么说、说什么场景用、送给谁，就能拼出买家画像。',
        example: '吹风机评论里频繁出现"купила дочери"（给女儿买的）→ 妈妈买给青春期女儿用；"для путешествий"（旅行用）→ 出差族需要便携。这两个就是不同人群，产品侧重点不一样。',
        steps: ['看Ozon上Top20产品的评论（好的差的都看）', '注意关键词：谁在用（мама/девушка/муж）、什么场景（дом/поездка/подарок）、为什么买', '把相似特征的买家归成2-3类', '给每类人起个名字，写清楚年龄、场景、核心需求'],
      },
      {
        name: '看搜索词猜意图',
        desc: 'Ozon搜索框的联想词和热搜词能告诉你消费者在想什么。搜"подушка"（枕头）的人，如果联想词是"ортопедическая"（矫形），说明大家关心健康而不是舒服。',
        example: '搜"фен"（吹风机）的联想词：ифонический（负离子）→ 关注护发；складной（折叠）→ 需要便携；профессиональный（专业级）→ 理发师或发烧友。不同搜索词对应不同人群。',
        steps: ['在Ozon搜索你的品类关键词', '记录联想词和下拉推荐', '按意图归类：功能型（要什么功能）、场景型（什么场景用）、价格型（什么价位）', '搜索量大的意图就是主流需求'],
      },
      {
        name: '用俄罗斯数据验证',
        desc: '光看线上数据可能有偏差，用俄罗斯的人口和消费数据交叉验证一下，确保你猜的人群真的够大。',
        example: '评论里看着都是年轻女性在买发膜，但俄罗斯25-44岁女性有2000万+，线上美妆消费年增长20%+，说明这个人群确实够大，值得做。如果只看到几个评论就说"中年男性是主力"，但俄罗斯中年男性很少在线买护肤品，那就要打个问号。',
        steps: ['查俄罗斯人口数据：多少人在你的目标年龄段', '查线上消费数据：这个品类在Ozon的增长率', '把评论分析的人群规模和宏观数据对比', '如果差距大，重新审视画像是否准确'],
      },
    ],
    output: '2-3个买家画像（年龄、场景、核心需求）、人群规模估算',
  },
  {
    id: 'differentiation',
    icon: Lightbulb,
    title: '差异化点',
    subtitle: '凭什么买你不买别人',
    color: 'purple',
    overview: '差异化不是"做点不一样的"，而是"做消费者在乎的不一样"。消费者不在乎的差异等于白做。关键是找到消费者关心、但竞品没做好的地方，集中火力打透。',
    methods: [
      {
        name: '画竞争雷达图',
        desc: '把产品和竞品在几个关键维度上打分，画成雷达图。如果大家的图长得差不多，说明同质化严重；如果你的图形状明显不同，说明差异化出来了。',
        example: '吹风机6个维度：风力、温控、重量、噪音、护发、价格。竞品A和B的图很相似（风力高、价格低、护发差），那你就反着来——护发做到最强、风力够用就行、价格中等，图就不一样了，差异化就出来了。',
        steps: ['确定品类的5-8个关键维度（从消费者评论里提炼）', '给竞品和自己的产品在每个维度打1-5分', '画雷达图，看哪里重叠、哪里空白', '在空白维度集中投入，形成差异化'],
      },
      {
        name: '找矛盾解矛盾',
        desc: '很多差异化机会藏在矛盾里——消费者既想要A又想要B，但A和B通常是对立的。谁能同时满足，谁就赢了。',
        example: '吹风机：消费者要"风力大"又要"噪音小"——传统上这两者矛盾。用高速无刷马达+多风道设计，风力大但噪音小，矛盾就解决了。\n枕头：消费者要"柔软"又要"支撑好"——传统上矛盾。用分区设计（中间软、两侧硬），同时满足，矛盾解决。',
        steps: ['列出消费者"既要又要"的矛盾对', '看竞品怎么取舍的（通常牺牲一方）', '想办法两方都满足（换材料、改结构、加技术）', '验证方案可行性和成本'],
      },
      {
        name: '让消费者看得见差异',
        desc: '差异做了但消费者看不出来=白做。差异必须能在主图、标题、五点描述里一眼看出来，不然消费者刷过去都不会停。',
        example: '你做了个"可拆卸清洗"的吹风机滤网——这是好差异，但主图如果只拍吹风机外观，消费者根本看不出来。必须拍一张"滤网拆开"的特写图，标题写"съемный фильтр"（可拆卸滤网），差异才被看见。',
        steps: ['列出你的差异化点', '问自己：消费者看主图能发现吗？看标题能发现吗？', '如果发现不了，想怎么视觉化呈现', '主图/标题/五点里都要体现差异'],
      },
    ],
    output: '差异化策略（2-3个核心差异点）、竞争雷达图、差异视觉化方案',
  },
  {
    id: 'spec',
    icon: Ruler,
    title: '产品规格定义',
    subtitle: '做到什么程度',
    color: 'green',
    overview: '把前面说的"要做什么"翻译成具体的数字和标准，这样工厂才知道怎么做、QC才知道怎么验。规格写不清楚，做出来的东西一定跟你想的不一样。',
    methods: [
      {
        name: '需求翻译成参数',
        desc: '消费者说"风力要大"，工厂听不懂。你得翻译成"风速≥18m/s，马达转速≥10万转/分"。每个模糊需求都要变成可测量的数字。',
        example: '消费者需求 → 产品参数：\n"吹干快" → 风速≥18m/s，功率≥1600W\n"不伤发" → 出风口温度≤65°C，带NTC温控传感器\n"轻便" → 整机重量≤450g\n"安静" → 噪音≤75dB\n\n每个参数都要写明测试方法和合格标准。',
        steps: ['把功能清单里的每条需求都问：怎么测量？标准是多少？', '参考竞品参数作为基线（拆机或查公开数据）', '和供应商确认这些参数能不能做到', '写成规格表，每个参数标明：目标值、最低值、测试方法'],
      },
      {
        name: '定好公差范围',
        desc: '工厂生产不可能每个产品都一模一样，要给一个合理的误差范围。太严工厂做不到或成本翻倍，太松品质不稳定。',
        example: '枕头高度标12cm，公差±0.5cm——工厂能做到，消费者也感觉不出11.5和12.5的区别。\n但如果公差写成±2cm，那10cm和14cm的枕头都算合格，消费者收到可能觉得"怎么跟图片不一样"。\n吹风机重量标450g，公差±20g——可以接受；写±50g就不行了，400g和500g手感差很多。',
        steps: ['每个关键参数都定一个公差范围', '问工厂：你们正常生产的波动范围是多少？', '问自己：消费者能接受多大的差异？', '取工厂能力和消费者接受度的交集'],
      },
      {
        name: '算好成本账',
        desc: '规格不是越高越好，每个参数的提升都有成本。关键是分清哪些规格"必须到位"，哪些"够用就行"，把钱花在刀刃上。',
        example: '吹风机马达：10万转成本30元，11万转成本50元——风速差距消费者几乎感觉不到，省这20元。\n但温控传感器：有NTC的成本加8元，没有的容易过热伤发——这8元必须花，因为安全相关。\n核心逻辑：安全和基本功能→必须到位；锦上添花→看成本效益比。',
        steps: ['把每个规格参数标注对成本的影响（高/中/低）', '标注对消费者体验的影响（高/中/低）', '成本高+体验高 → 值得投入', '成本高+体验低 → 可以砍掉或降级', '成本低+体验高 → 必须做', '输出最终规格确认书，和供应商签字确认'],
      },
    ],
    output: '产品规格表（每个参数的目标值、公差、测试方法）、成本-体验平衡分析',
  },
]

const COLOR_MAP = {
  rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', header: 'bg-rose-100/80', accent: 'bg-rose-500', light: 'bg-rose-50/50' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', header: 'bg-blue-100/80', accent: 'bg-blue-500', light: 'bg-blue-50/50' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', header: 'bg-purple-100/80', accent: 'bg-purple-500', light: 'bg-purple-50/50' },
  green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', header: 'bg-green-100/80', accent: 'bg-green-500', light: 'bg-green-50/50' },
}

export default function ProductDefinition() {
  const [expandedSection, setExpandedSection] = useState(null)
  const [expandedMethod, setExpandedMethod] = useState({})

  const toggleMethod = (sectionId, methodIdx) => {
    const key = `${sectionId}-${methodIdx}`
    setExpandedMethod(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-morandi-text mb-3">产品定义怎么做</h3>
        <p className="text-xs text-morandi-text-light leading-relaxed">
          产品定义就是回答四个问题：
          <span className="font-medium text-rose-600">做什么</span>（功能）、
          <span className="font-medium text-blue-600">给谁做</span>（人群）、
          <span className="font-medium text-purple-600">怎么赢</span>（差异）、
          <span className="font-medium text-green-600">做到什么程度</span>（规格）。
          每个问题下面都有具体做法和实际案例，点击展开查看。
        </p>
      </div>

      <div className="space-y-3">
        {SECTIONS.map(section => {
          const c = COLOR_MAP[section.color]
          const isExpanded = expandedSection === section.id
          const Icon = section.icon

          return (
            <div key={section.id} className={`bg-white rounded-xl shadow-sm border ${c.border} overflow-hidden`}>
              <div
                className={`flex items-center gap-3 p-4 cursor-pointer ${c.light} transition-colors`}
                onClick={() => setExpandedSection(isExpanded ? null : section.id)}
              >
                <div className={`w-9 h-9 rounded-lg ${c.header} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4.5 h-4.5 ${c.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${c.text}`}>{section.title}</span>
                    <span className="text-[10px] text-morandi-text-light">{section.subtitle}</span>
                  </div>
                </div>
                {isExpanded ? <ChevronUp className={`w-4 h-4 ${c.text}`} /> : <ChevronDown className="w-4 h-4 text-gray-300" />}
              </div>

              {isExpanded && (
                <div className="px-5 pb-5 pt-3 space-y-4">
                  <div className={`p-3 ${c.light} rounded-lg border ${c.border}`}>
                    <p className="text-xs text-morandi-text leading-relaxed">{section.overview}</p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-morandi-text">具体做法</h4>
                    {section.methods.map((m, idx) => {
                      const methodKey = `${section.id}-${idx}`
                      const isMethodOpen = expandedMethod[methodKey]

                      return (
                        <div key={idx} className="border border-gray-100 rounded-lg overflow-hidden">
                          <div
                            className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-gray-50/50 transition-colors"
                            onClick={() => toggleMethod(section.id, idx)}
                          >
                            <span className={`w-5 h-5 rounded-full ${c.accent} text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0`}>
                              {idx + 1}
                            </span>
                            <span className="text-xs font-semibold text-morandi-text flex-1">{m.name}</span>
                            {isMethodOpen ? <ChevronUp className="w-3.5 h-3.5 text-gray-300" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-300" />}
                          </div>

                          {isMethodOpen && (
                            <div className="px-4 pb-4 pt-0 space-y-3">
                              <p className="text-xs text-morandi-text leading-relaxed">{m.desc}</p>

                              <div className="p-3 bg-amber-50/80 rounded-lg border border-amber-100">
                                <span className="text-[10px] font-semibold text-amber-700 block mb-1">举例</span>
                                <p className="text-xs text-amber-800 leading-relaxed whitespace-pre-line">{m.example}</p>
                              </div>

                              <div>
                                <span className="text-[10px] font-semibold text-morandi-text-light">怎么做</span>
                                <div className="mt-1.5 space-y-1.5">
                                  {m.steps.map((step, si) => (
                                    <div key={si} className="flex items-start gap-2">
                                      <span className={`w-4 h-4 rounded ${c.bg} ${c.text} text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                        {si + 1}
                                      </span>
                                      <span className="text-xs text-morandi-text leading-relaxed">{step}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div className={`p-3 rounded-lg border ${c.border} ${c.light}`}>
                    <span className="text-[10px] font-semibold text-morandi-text-light">做完要产出</span>
                    <p className="text-xs text-morandi-text mt-1 leading-relaxed">{section.output}</p>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
