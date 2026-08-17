/**
 * t6/gateEngine.js — Stage Gate 引擎（T6-2A hardening：路径 Gate）
 * 只建议，不自动改状态。direction：SAME / FORWARD / BACKWARD。
 * FORWARD 时 path = 当前之后到目标每一段，逐段聚合 checks（check 带 stage）；
 * 非法 stage throw（绝不把未知 stage 当空 checks → GREEN）。
 * verdict：SAME/BACKWARD 不执行前向检查（返回同名字符串，UI/transition 处理）；
 * FORWARD 四态 GREEN/YELLOW/RED/NOT_EVALUATED，优先级 RED>YELLOW>NOT_EVALUATED>GREEN。
 * BLOCKED_LOGISTICS 精确语义：仅当 当前<samplingIndex 且 目标>=samplingIndex 触发一次 RED。
 */
import { PROJECT_STAGES, stageIndex, isValidStage, transitionDirection, SAMPLING_INDEX } from './stageModel.js'

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
  costing: '成本场景（T6-2B1 起接入）',
  supplier: '供应商管理（T7 接入）',
  samples: '样品记录（后续版本接入）',
  compliance: '合规数据域（后续版本接入）',
  listing: 'Listing 草稿（后续版本接入）',
  operations: '库存计划（后续版本接入）',
  launch: '冷启动计划（后续版本接入）',
}

// 每段进入时执行的检查；kind=data/workflow 用项目自身数据，kind=module 依赖未实现域 → NOT_EVALUATED
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

/**
 * @param {object} project SkuProject
 * @param {string} targetStage
 * @param {object} deps { availableModules?, snapshot? }
 * @returns {{direction, path, verdict, checks:[{stage,id,label,result,message?}], blockingReasons, warnings}}
 */
export function evaluateProjectGate(project, targetStage, deps = {}) {
  const from = project.stage
  if (!isValidStage(from)) throw new Error(`T6_GATE: 项目当前阶段非法 "${from}"（fail-close）`)
  if (!isValidStage(targetStage)) throw new Error(`T6_GATE: 目标阶段非法 "${targetStage}"（绝不把未知 stage 当空 checks → GREEN）`)

  const direction = transitionDirection(from, targetStage)
  if (direction === 'SAME') {
    return { direction, path: [], verdict: 'SAME', checks: [], blockingReasons: [], warnings: [] }
  }
  if (direction === 'BACKWARD') {
    // 回退不执行前向 Gate
    return { direction, path: [], verdict: 'BACKWARD', checks: [], blockingReasons: [], warnings: [] }
  }

  // FORWARD：路径 = (from, target] 每一段
  const fromIdx = stageIndex(from)
  const toIdx = stageIndex(targetStage)
  const path = PROJECT_STAGES.slice(fromIdx + 1, toIdx + 1)

  const { availableModules = {}, snapshot = null } = deps
  const checks = []
  for (const stage of path) {
    for (const def of CHECKS[stage] || []) {
      if (def.kind === 'module') {
        if (!availableModules[def.module]) {
          checks.push({ stage, id: def.id, label: def.label, result: GATE_RESULTS.NOT_EVALUATED, message: MODULE_ZH[def.module] || '该依赖模块尚未实现' })
        } else {
          checks.push({ stage, id: def.id, label: def.label, result: GATE_RESULTS.NOT_EVALUATED, message: MODULE_ZH[def.module] || '该依赖模块尚未实现' })
        }
      } else {
        checks.push({ stage, id: def.id, label: def.label, ...def.evaluate(project) })
      }
    }
  }

  // BLOCKED_LOGISTICS 精确语义：当前 < SAMPLING 且目标 >= SAMPLING 才触发一次
  if (fromIdx < SAMPLING_INDEX && toIdx >= SAMPLING_INDEX && snapshot && (snapshot.status || []).includes('BLOCKED_LOGISTICS')) {
    checks.push({
      stage: SAMPLING_INDEX >= fromIdx + 1 ? PROJECT_STAGES[SAMPLING_INDEX] : targetStage,
      id: 'blocked_logistics',
      label: '跨境物流不可行（立项快照 BLOCKED_LOGISTICS）',
      result: GATE_RESULTS.FAIL,
      message: '不建议进入样品阶段',
    })
  }

  const blockingReasons = checks.filter((c) => c.result === GATE_RESULTS.FAIL).map((c) => c.message || c.label)
  const warnings = checks.filter((c) => c.result === GATE_RESULTS.WARN).map((c) => c.message || c.label)

  let verdict
  if (checks.some((c) => c.result === GATE_RESULTS.FAIL)) verdict = GATE_VERDICTS.RED
  else if (checks.some((c) => c.result === GATE_RESULTS.WARN)) verdict = GATE_VERDICTS.YELLOW
  else if (checks.some((c) => c.result === GATE_RESULTS.NOT_EVALUATED)) verdict = GATE_VERDICTS.NOT_EVALUATED
  else verdict = GATE_VERDICTS.GREEN

  return { direction, path, verdict, checks, blockingReasons, warnings }
}
