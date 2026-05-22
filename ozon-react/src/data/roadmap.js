export const ROADMAP_PHASES = [
  {
    id: 'phase-1',
    title: '🧭 选品与调研',
    nodes: [
      { id: 'n1', num: 1, title: '选品立项', icon: '🎯', status: 'pending' },
      { id: 'n2', num: 2, title: '市场调研', icon: '🔍', status: 'pending', dashboard: true },
      { id: 'n36', num: 4, title: '香薰产品调研', icon: '🕯️', status: 'pending', dashboard: true },
      { id: 'n4', num: 3, title: '利润测算', icon: '💰', status: 'pending' },
      { id: 'n38', num: 4, title: '定价计算', icon: '🧮', status: 'pending' },
      { id: 'n39', num: 5, title: '京东商品采集', icon: '🛒', status: 'pending' },
    ]
  },
  {
    id: 'phase-2',
    title: '🏭 产品与供应链',
    nodes: [
      { id: 'n5', num: 5, title: '产品定义', icon: '📐', status: 'pending' },
      { id: 'n6', num: 6, title: '供应链开发', icon: '🏭', status: 'pending' },
      { id: 'n7', num: 7, title: '样品打样确认', icon: '🧪', status: 'pending' },
      { id: 'n37', num: 8, title: '内外包材确定', icon: '📦', status: 'pending' },
      { id: 'n8', num: 9, title: '成本与报价锁定', icon: '📋', status: 'pending' },
    ]
  },
  {
    id: 'phase-3',
    title: '⚖️ 合规与账号',
    nodes: [
      { id: 'n9', num: 9, title: '合规评估', icon: '📜', status: 'pending' },
      { id: 'n10', num: 10, title: '认证与检测', icon: '✅', status: 'pending' },
      { id: 'n11', num: 11, title: '品牌与商标注册', icon: '™️', status: 'pending' },
      { id: 'n12', num: 12, title: '平台账号入驻', icon: '🏪', status: 'pending' },
    ]
  },
  {
    id: 'phase-4',
    title: '📦 生产与物流',
    nodes: [
      { id: 'n15', num: 13, title: '生产下单', icon: '🔧', status: 'pending' },
      { id: 'n16', num: 16, title: '质量检验(QC)', icon: '🔎', status: 'pending' },
      { id: 'n17', num: 17, title: '成品入库/备货', icon: '🏪', status: 'pending' },
      { id: 'n18', num: 18, title: '头程物流发运', icon: '🚢', status: 'pending' },
      { id: 'n19', num: 19, title: '清关与入仓', icon: '🏗️', status: 'pending' },
    ]
  },
  {
    id: 'phase-5',
    title: '🚀 上架和运营',
    nodes: [
      { id: 'n14', num: 19, title: 'Listing内容制作', icon: '📝', status: 'pending' },
      { id: 'n20', num: 20, title: '商品上架', icon: '📤', status: 'pending' },
      { id: 'n21', num: 21, title: '冷启动测试', icon: '🧊', status: 'pending' },
      { id: 'n22', num: 22, title: '广告投放启动', icon: '📢', status: 'pending' },
      { id: 'n23', num: 23, title: '站内流量优化', icon: '🔄', status: 'pending' },
      { id: 'n24', num: 24, title: '转化率优化', icon: '📈', status: 'pending' },
      { id: 'n25', num: 25, title: '评价体系建设', icon: '⭐', status: 'pending' },
      { id: 'n26', num: 26, title: '站外流量引入', icon: '🌐', status: 'pending' },
      { id: 'n27', num: 27, title: '销量放量增长', icon: '🚀', status: 'pending' },
      { id: 'n28', num: 28, title: '排名优化', icon: '🏆', status: 'pending' },
    ]
  },
  {
    id: 'phase-6',
    title: '💳 物流和回款',
    nodes: [
      { id: 'n29', num: 29, title: '库存管理与补货', icon: '📦', status: 'pending' },
      { id: 'n30', num: 30, title: '订单履约与发货', icon: '🚚', status: 'pending' },
      { id: 'n31', num: 31, title: '平台结算', icon: '🏦', status: 'pending' },
      { id: 'n32', num: 32, title: '收款与资金回流', icon: '💸', status: 'pending' },
      { id: 'n33', num: 33, title: '利润核算', icon: '📊', status: 'pending' },
    ]
  },
  {
    id: 'phase-7',
    title: '🔁 迭代与扩展',
    nodes: [
      { id: 'n34', num: 34, title: '产品迭代优化', icon: '🔄', status: 'pending' },
      { id: 'n35', num: 35, title: 'SKU扩展', icon: '➕', status: 'pending' },
    ]
  },
]

export const ALL_NODES = ROADMAP_PHASES.flatMap(p => p.nodes)

export const NODE_DETAILS = {
  n1: { title: '选品立项', desc: '确定目标品类与产品方向，评估市场机会', checklist: ['确定目标市场（俄罗斯/独联体）', '选择产品类目方向', '初步评估市场规模', '立项决策评审'] },
  n2: { title: '市场调研', desc: '深入分析目标市场规模、趋势、消费者需求与竞品格局', checklist: ['类目规模与增长趋势', '价格带分布分析', '季节性需求波动', '消费者需求痛点', 'Top10卖家占比分析', '品牌垄断度评估', '竞品定价策略', '市场空白机会识别'] },
  n36: { title: '香薰产品调研', desc: '香氛定价模型与竞争力模拟，支持方案对比与谈判报告', checklist: [] },
  n4: { title: '利润测算', desc: '全链路成本核算，验证利润可行性', checklist: ['采购成本估算', '物流费用测算', '平台佣金计算', '广告成本预估', '净利润率判断（≥15%可做 / 8-15%需优化 / ≤8%不建议）'] },
  n38: { title: '定价计算', desc: '按产品规格对比成本、定价与利润，rFBS运费自动匹配', checklist: ['产品规格与重量录入', '售价(₽)设定', '采购/运费/贴标成本填写', 'rFBS最优渠道自动匹配', '毛利与利润率计算'] },
  n39: { title: '京东商品采集', desc: '输入京东商品链接，自动获取标题、图片、详情等资料到本地', checklist: ['输入京东商品链接', '自动获取商品信息', '下载商品图片到本地', '查看已采集商品列表'] },
  n5: { title: '产品定义', desc: '明确产品功能定位、目标人群与差异化卖点', checklist: ['功能定位（解决什么问题）', '目标人群画像', '差异化点（结构/材料/设计）', '产品规格定义'] },
  n6: { title: '供应链开发', desc: '筛选供应商，评估产能与定制能力', checklist: ['3-5家工厂对比', 'MOQ/交期/工艺能力评估', 'OEM/ODM支持确认', '供应商资质审核'] },
  n7: { title: '样品打样确认', desc: '从初样到确认样的完整打样流程，含包装设计与打样', checklist: ['初样制作', '修改样调整', '确认样锁定', '样品质量评估', '包装视觉设计', '合规标签（EAC/CE等）', '外箱抗压设计', 'SKU条码系统'] },
  n37: { title: '内外包材确定', desc: '确定产品内外包装材质、设计与供应商', checklist: ['内包材选型与打样', '外包材/礼盒设计确认', '包材供应商比价', '包材样品确认'] },
  n8: { title: '成本与报价锁定', desc: '锁定最终成本结构，确认报价方案', checklist: ['EXW/FOB价格确认', '包装成本核算', '运输成本测算', '总成本结构锁定'] },
  n9: { title: '合规评估', desc: '识别目标市场法规要求，评估合规风险', checklist: ['EAEU/TR CU法规识别', '禁限用成分筛查', '标签要求确认', '合规风险等级评估'] },
  n10: { title: '认证与检测', desc: '完成产品认证与实验室检测', checklist: ['EAC/CE认证申请', '实验室测试安排', '合规报告获取', 'Declaration of Conformity'] },
  n11: { title: '品牌与商标注册', desc: '品牌保护与商标注册', checklist: ['品牌名可注册性查询', '商标注册申请', '类目保护布局', '马德里体系评估'] },
  n12: { title: '平台账号入驻', desc: '完成电商平台卖家账号注册与审核', checklist: ['Ozon Seller注册', 'FBO/FBS审核', '品牌备案（Brand Registry）', '支付通道绑定'] },
  n14: { title: 'Listing内容制作', desc: '商品详情页内容制作与优化', checklist: ['图片体系（主图/场景/细节）', '视频内容（15-60s）', 'SEO关键词结构', '标题/五点/描述优化'] },
  n15: { title: '生产下单', desc: '确认PO，安排生产排期与质控节点', checklist: ['PO确认与签署', '生产排期确认', '质量控制节点设定', '物料采购启动'] },
  n16: { title: '质量检验(QC)', desc: '生产过程与出货质量检验', checklist: ['IPQC过程检验', 'OQC出货检验', 'AQL标准抽检', '质量问题整改'] },
  n17: { title: '成品入库/备货', desc: '成品入库管理，安全库存准备', checklist: ['成品入库登记', '安全库存计算', '断货风险控制', '仓储管理'] },
  n18: { title: '头程物流发运', desc: '选择物流方案，安排头程发运', checklist: ['海运/空运/铁路方案选择', 'DDP/FOB条款确认', '清关资料准备', '物流追踪'] },
  n19: { title: '清关与入仓', desc: '完成清关手续，货物入仓上架', checklist: ['清关申报', '关税缴纳', '仓库预约', '上架SKU匹配'] },
  n20: { title: '商品上架', desc: 'Listing上线，转化率基础搭建', checklist: ['Listing正式上线', '价格策略设定', '转化率基础搭建', '初始库存确认'] },
  n21: { title: '冷启动测试', desc: '初始曝光测试，优化点击率', checklist: ['初始曝光投放', '自然流量测试', 'CTR优化', '转化率观察'] },
  n22: { title: '广告投放启动', desc: '搭建PPC广告结构，启动付费流量', checklist: ['PPC结构搭建（自动+手动）', 'ACOS控制模型', '关键词分层', '预算分配'] },
  n23: { title: '站内流量优化', desc: '优化站内搜索排名与推荐流量', checklist: ['搜索排名优化', '类目排名提升', '推荐流量获取', 'Deal活动参与'] },
  n24: { title: '转化率优化', desc: 'A/B测试与页面优化提升转化', checklist: ['A/B测试主图', '价格测试', '页面CVR优化', '五点描述优化'] },
  n25: { title: '评价体系建设', desc: '建立产品评价体系，提升评分', checklist: ['Vine/促评计划', 'Review结构建立', '差评管理', '评分提升策略'] },
  n26: { title: '站外流量引入', desc: 'TikTok种草与社媒引流', checklist: ['TikTok种草内容', '红人合作', '社媒广告投放', '流量归因追踪'] },
  n27: { title: '销量放量增长', desc: '规模化放量，冲刺销量目标', checklist: ['广告预算放大', 'Deal活动冲刺', '多SKU联动', '销量目标达成'] },
  n28: { title: '排名优化', desc: '关键词与类目排名冲刺', checklist: ['核心关键词排名提升', '类目BSR冲刺', '长尾词布局', '排名稳定性维护'] },
  n29: { title: '库存管理与补货', desc: '安全库存管理，避免断货', checklist: ['安全库存计算', '补货周期优化', '断货预警', '滞销品处理'] },
  n30: { title: '订单履约与发货', desc: '订单处理与物流追踪', checklist: ['仓库发货效率', '物流追踪管理', '售后处理', '退换货管理'] },
  n31: { title: '平台结算', desc: '平台结算周期与风控管理', checklist: ['Ozon payout周期', '风控冻结监测', '结算异常处理', '对账管理'] },
  n32: { title: '收款与资金回流', desc: '多币种收款与汇兑管理', checklist: ['Payoneer/PingPong配置', '多币种结算', '汇兑管理', '资金回流优化'] },
  n33: { title: '利润核算', desc: 'SKU级利润分析与ROI回算', checklist: ['SKU级利润分析', '广告ROI回算', '全链路成本复盘', '利润优化方向'] },
  n34: { title: '产品迭代优化', desc: '基于数据反馈优化产品', checklist: ['用户反馈分析', '产品改进方案', '迭代样品确认', '迭代产品上线'] },
  n35: { title: 'SKU扩展', desc: '颜色/规格/功能变体扩展', checklist: ['变体开发（颜色/规格）', '产品线延伸', '相邻品类进入', '多平台扩张'] },
}
