/**
 * t6/gateEngine.js — Stage Gate 引擎（T6-2A，纯函数）
 * 只建议，不自动改 stage。结果四态：
 *   GREEN / YELLOW / RED / NOT_EVALUATED（依赖模块尚未实现——不伪装 PASS，也不当 FAIL）
 * 判定优先级：RED > YELLOW > NOT_EVALUATED > GREEN。
 * hard block：立项快照含 BLOCKED_LOGISTICS → 目标阶段越过 PIPELINE 一律 RED（"不建议进入样品阶段"）。
 */
export const GATE_RESULTS = {
  PASS: 'PASS',
  WARN: 'WARN',
  FAIL: 'FAIL',
  NOT_EVALUATED: 'NOT_EVALUATED',
}
export const GATE_VERDICTS = {
  GREEN: 'GREEN',
  YELLOW: 'YELLOW',
  RED: 'RED',
  NOT_EVALUATED: 'NOT_EVALUATED',
}

const MODULE_ZH = {
  costing: '成本场景（T6-2B 接入）',
  supplier: '供应商管理（T7 接入）',
  samples: '样品记录（后续版本接入）',
  compliance: '合规数据域（后续版本接入）',
  listing: 'Listing 草稿（后续版本接入）',
  operations: '库存计划（后续版本接入）',
  launch: '冷启动计划（后续版本接入）',
}

// 各目标阶段的检查定义：kind='data' 用项目自身数据；kind='workflow' 检查节点状态；
// kind='module' 依赖尚未实现的域 → 由 availableModules 决定（当前版本一律 NOT_EVALUATED）
const CHECKS = {
  RESEARCH: [
    {
      id: 'snapshot_exists', label: '市场评分存在（立项快照）', kind: 'data',
      evaluate: (p) => (p.source?.creationSnapshotId
        ? { result: GATE_RESULTS.PASS }
        : { result: GATE_RESULTS.FAIL, message: '缺少立项评分快照' }),
    },
  ],
  COSTING: [
    { id: 'cost_scenario', label: '至少 1 个成本场景（Ozon/WB）', kind: 'module', module: 'costing' },
    { id: 'target_price', label: '目标售价已填', kind: 'module', module: 'costing' },
  ],
  SAMPLING: [
    { id: 'supplier_quote', label: '至少 1 个供应商报价', kind: 'module', module: 'supplier' },
    { id: 'margin_warning', label: '毛利率预期 ≥ 15%（不满足仅提示）', kind: 'module', module: 'costing' },
  ],
  COMPLIANCE: [
    { id: 'samples_record', label: '样品记录存在', kind: 'module', module: 'samples' },
    { id: 'compliance_pending', label: '合规评估完成', kind: 'module', module: 'compliance' },
  ],
  PRODUCTION: [
    { id: 'compliance_done', label: '合规评估完成', kind: 'module', module: 'compliance' },
    { id: 'cert_plan', label: '认证计划存在', kind: 'module', module: 'compliance' },
  ],
  LAUNCH: [
    { id: 'listing_draft', label: 'Listing 草稿存在', kind: 'module', module: 'listing' },
    { id: 'stock_plan', label: '库存计划存在', kind: 'module', module: 'operations' },
  ],
  OPERATIONS: [
    {
      id: 'launch_done', label: '商品上架节点（n20）已完成', kind: 'workflow', nodeId: 'n20',
      evaluate: (p) => {
        const node = (p.workflow?.states || []).find((s) => s.nodeId === 'n20')
        return node?.status === 'done'
          ? { result: GATE_RESULTS.PASS }
          : { result: GATE_RESULTS.FAIL, message: '尚未完成「商品上架」节点' }
      },
    },
    { id: 'cold_start', label: '冷启动计划存在', kind: 'module', module: 'launch' },
  ],
  REVIEW: [],
}

function nodeStatus(project, nodeId) {
  return (project.workflow?.states || []).find((s) => s.nodeId === nodeId)?.status ?? null
}

/**
 * @param {object} project SkuProject
 * @param {string} targetStage ProjectStage 枚举之一
 * @param {object} deps { availableModules?: {[module]:boolean}, snapshot?: ScoringSnapshot|null }
 * @returns {{verdict, checks:[{id,label,result,message?}], blockingReasons:string[], warnings:string[]}}
 */
export function evaluateProjectGate(project, targetStage, deps = {}) {
  const { availableModules = {}, snapshot = null } = deps
  const checks = (CHECKS[targetStage] || []).map((def) => {
    if (def.kind === 'module') {
      if (!availableModules[def.module]) {
        return { id: def.id, label: def.label, result: GATE_RESULTS.NOT_EVALUATED, message: MODULE_ZH[def.module] || '该依赖模块尚未实现' }
      }
      // 模块已实现的版本在此接真实检查；当前版本全部 NOT_EVALUATED
      return { id: def.id, label: def.label, result: GATE_RESULTS.NOT_EVALUATED, message: MODULE_ZH[def.module] || '该依赖模块尚未实现' }
    }
    return { id: def.id, label: def.label, ...def.evaluate(project) }
  })

  // hard block：立项快照 BLOCKED_LOGISTICS → 目标阶段越过 PIPELINE 一律 RED（人工可 override 但必须留理由）
  let hardBlock = null
  if (targetStage !== 'PIPELINE' && snapshot && (snapshot.status || []).includes('BLOCKED_LOGISTICS')) {
    hardBlock = {
      id: 'blocked_logistics', label: '跨境物流不可行（立项快照 BLOCKED_LOGISTICS）',
      result: GATE_RESULTS.FAIL, message: '不建议进入样品阶段',
    }
  }
  const all = hardBlock ? [...checks, hardBlock] : checks

  const blockingReasons = all.filter((c) => c.result === GATE_RESULTS.FAIL).map((c) => c.message || c.label)
  const warnings = all.filter((c) => c.result === GATE_RESULTS.WARN).map((c) => c.message || c.label)

  let verdict
  if (all.some((c) => c.result === GATE_RESULTS.FAIL)) verdict = GATE_VERDICTS.RED
  else if (all.some((c) => c.result === GATE_RESULTS.WARN)) verdict = GATE_VERDICTS.YELLOW
  else if (all.some((c) => c.result === GATE_RESULTS.NOT_EVALUATED)) verdict = GATE_VERDICTS.NOT_EVALUATED
  else verdict = GATE_VERDICTS.GREEN

  return { verdict, checks: all, blockingReasons, warnings }
}

export { nodeStatus }
