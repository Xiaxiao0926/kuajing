/**
 * workflowTemplates/roadmap-v1.js — 不可变 WorkflowTemplate 注册表（T6-1 hardening 冻结）
 * 铁律：本文件一旦入库不得修改 nodeId/phaseId/title/order；36 节点流程变化 → 新建 roadmap-v2.js，
 * 旧项目继续按 project.workflow.templateVersion 读取对应版本。禁止运行时从 data/roadmap.js 再生成。
 * 元素级深冻结：数组与每个元素对象均 Object.freeze。
 */
const _phases = [{"phaseId":"phase-1","title":"🧭 选品与调研","order":0},{"phaseId":"phase-5","title":"🚀 上架和运营","order":1},{"phaseId":"phase-2","title":"🏭 产品与供应链","order":2},{"phaseId":"phase-3","title":"⚖️ 合规与账号","order":3},{"phaseId":"phase-4","title":"📦 生产与物流","order":4},{"phaseId":"phase-6","title":"💳 物流和回款","order":5},{"phaseId":"phase-7","title":"🔁 迭代与扩展","order":6}];
const _nodes = [{"nodeId":"n1","phaseId":"phase-1","title":"选品立项","order":0},{"nodeId":"n2","phaseId":"phase-1","title":"市场调研","order":1},{"nodeId":"n36","phaseId":"phase-1","title":"香薰产品调研","order":2},{"nodeId":"n4","phaseId":"phase-1","title":"Ozon跨境核算","order":3},{"nodeId":"n39","phaseId":"phase-1","title":"WB跨境核算","order":4},{"nodeId":"n14","phaseId":"phase-5","title":"Listing内容制作","order":5},{"nodeId":"n20","phaseId":"phase-5","title":"商品上架","order":6},{"nodeId":"n21","phaseId":"phase-5","title":"冷启动测试","order":7},{"nodeId":"n22","phaseId":"phase-5","title":"广告投放启动","order":8},{"nodeId":"n23","phaseId":"phase-5","title":"站内流量优化","order":9},{"nodeId":"n24","phaseId":"phase-5","title":"转化率优化","order":10},{"nodeId":"n25","phaseId":"phase-5","title":"评价体系建设","order":11},{"nodeId":"n26","phaseId":"phase-5","title":"站外流量引入","order":12},{"nodeId":"n27","phaseId":"phase-5","title":"销量放量增长","order":13},{"nodeId":"n28","phaseId":"phase-5","title":"排名优化","order":14},{"nodeId":"n5","phaseId":"phase-2","title":"产品定义","order":15},{"nodeId":"n6","phaseId":"phase-2","title":"供应链开发","order":16},{"nodeId":"n7","phaseId":"phase-2","title":"样品打样确认","order":17},{"nodeId":"n37","phaseId":"phase-2","title":"内外包材确定","order":18},{"nodeId":"n8","phaseId":"phase-2","title":"成本与报价锁定","order":19},{"nodeId":"n9","phaseId":"phase-3","title":"合规评估","order":20},{"nodeId":"n10","phaseId":"phase-3","title":"认证与检测","order":21},{"nodeId":"n11","phaseId":"phase-3","title":"品牌与商标注册","order":22},{"nodeId":"n12","phaseId":"phase-3","title":"平台账号入驻","order":23},{"nodeId":"n15","phaseId":"phase-4","title":"生产下单","order":24},{"nodeId":"n16","phaseId":"phase-4","title":"质量检验(QC)","order":25},{"nodeId":"n17","phaseId":"phase-4","title":"成品入库/备货","order":26},{"nodeId":"n18","phaseId":"phase-4","title":"头程物流发运","order":27},{"nodeId":"n19","phaseId":"phase-4","title":"清关与入仓","order":28},{"nodeId":"n29","phaseId":"phase-6","title":"库存管理与补货","order":29},{"nodeId":"n30","phaseId":"phase-6","title":"订单履约与发货","order":30},{"nodeId":"n31","phaseId":"phase-6","title":"平台结算","order":31},{"nodeId":"n32","phaseId":"phase-6","title":"收款与资金回流","order":32},{"nodeId":"n33","phaseId":"phase-6","title":"利润核算","order":33},{"nodeId":"n34","phaseId":"phase-7","title":"产品迭代优化","order":34},{"nodeId":"n35","phaseId":"phase-7","title":"SKU扩展","order":35}];

export const WORKFLOW_TEMPLATES = Object.freeze({
  'roadmap-v1': Object.freeze({
    version: 'roadmap-v1',
    phases: Object.freeze(_phases.map((x) => Object.freeze(x))),
    nodes: Object.freeze(_nodes.map((x) => Object.freeze(x))),
  }),
});

/** 按版本读取模板（不存在返回 null，调用方 fail-close） */
export function getWorkflowTemplate(version) {
  return WORKFLOW_TEMPLATES[version] || null;
}
