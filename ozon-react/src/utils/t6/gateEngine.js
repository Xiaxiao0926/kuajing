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
import { scenarioMarginPct } from './costScenarioAdapter.js'
import { SNAPSHOT_KIND, resolveSnapshotKind } from './candidateProjectEvidence.js'

/**
 * 类型化提取快照物流状态列表
 * - SCORING 类型：优先 snapshot.scoreResult.status，回退 snapshot.status（兼容旧调用），无则 []
 * - MARKET_VALIDATION 类型：恒为 []，严禁从 marketEvidence.risks / heavy / weight / dims 伪造
 * - 其他/空：[]
 * @param {object|null} snapshot
 * @returns {string[]}
 */
export function snapshotStatusList(snapshot) {
  if (!snapshot) return []

  const kind = resolveSnapshotKind(snapshot)

  if (kind === SNAPSHOT_KIND.SCORING) {
    return (
      snapshot.scoreResult?.status ??
      snapshot.status ??
      []
    )
  }

  return []
}

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

// 基线场景毛利率（Ozon/WB 通用判定：≥15 PASS；<15 WARN；无场景/无基线 FAIL）
// 统一取 scenarioMarginPct（OZON: profitRate；WB: profitCalc.profitMargin）
function baselineMarginResult(project, ctx) {
  const scenarios = ctx.scenarios || []
  if (scenarios.length === 0) return { result: GATE_RESULTS.FAIL, message: '尚无成本场景（到「成本与物流」Tab 用核算面板生成）' }
  const baseline = scenarios.find((s) => s.id === project.costing?.baselineScenarioId)
  if (!baseline) return { result: GATE_RESULTS.FAIL, message: '未设置基线成本场景' }
  const margin = scenarioMarginPct(baseline)
  if (margin === null) return { result: GATE_RESULTS.FAIL, message: '基线场景缺少利润率' }
  return margin >= 15
    ? { result: GATE_RESULTS.PASS }
    : { result: GATE_RESULTS.WARN, message: `基线毛利率 ${margin}% < 15%` }
}

// 每段进入时执行的检查；
// kind=data/workflow 用项目自身数据；kind=costing 用真实成本场景（T6-2B1）；
// kind=module 依赖未实现域 → NOT_EVALUATED（supplier/samples/compliance/listing/operations/launch）
const CHECKS = {
  RESEARCH: [
    {
      id: 'snapshot_exists', label: '立项证据快照存在', kind: 'data',
      evaluate: (p, ctx) => {
        if (!p.source?.creationSnapshotId) {
          return { result: GATE_RESULTS.FAIL, message: '缺少立项证据快照' }
        }
        if (ctx?.snapshotSpecified && !ctx?.snapshot) {
          return { result: GATE_RESULTS.FAIL, message: '立项证据快照实体缺失' }
        }
        return { result: GATE_RESULTS.PASS }
      },
    },
  ],
  COSTING: [
    {
      id: 'cost_scenario', label: '至少 1 个成本场景且基线毛利率 ≥ 15%', kind: 'costing',
      evaluate: (p, ctx) => baselineMarginResult(p, ctx),
    },
    {
      id: 'target_price', label: '目标售价已填（基线场景）', kind: 'costing',
      evaluate: (p, ctx) => {
        const scenarios = ctx.scenarios || []
        const baseline = scenarios.find((s) => s.id === p.costing?.baselineScenarioId)
        if (!baseline) return { result: GATE_RESULTS.FAIL, message: '未设置基线成本场景' }
        // 平台统一售价口径：OZON=price；WB=sellerRevenueRub
        const price = Number(baseline.inputPayload?.price ?? baseline.inputPayload?.sellerRevenueRub)
        return price > 0
          ? { result: GATE_RESULTS.PASS }
          : { result: GATE_RESULTS.FAIL, message: '基线场景目标售价为空' }
      },
    },
  ],
  SAMPLING: [
    {
      id: 'supplier_quote',
      label: '至少 1 个供应商报价',
      kind: 'module',
      module: 'supplier',
      evaluate: (p, ctx) => {
        const fact = ctx.availableModules?.supplier
        if (!fact || fact.evaluated !== true) {
          return { result: GATE_RESULTS.NOT_EVALUATED, message: MODULE_ZH.supplier || '供应商管理尚未接入' }
        }
        return Number(fact.quoteCount) > 0
          ? { result: GATE_RESULTS.PASS }
          : { result: GATE_RESULTS.FAIL, message: '尚无供应商报价' }
      },
    },
    {
      id: 'margin_warning', label: '毛利率预期 ≥ 15%', kind: 'costing',
      evaluate: (p, ctx) => baselineMarginResult(p, ctx),
    },
  ],
  COMPLIANCE: [
    {
      id: 'samples_record',
      label: '样品记录存在',
      kind: 'module',
      module: 'samples',
      evaluate: (p, ctx) => {
        const fact = ctx.availableModules?.samples
        if (!fact || fact.evaluated !== true) {
          return { result: GATE_RESULTS.NOT_EVALUATED, message: MODULE_ZH.samples || '样品记录尚未接入' }
        }
        return Number(fact.sampleCount) > 0
          ? { result: GATE_RESULTS.PASS }
          : { result: GATE_RESULTS.FAIL, message: '尚无打样记录' }
      },
    },
    {
      id: 'compliance_pending',
      label: '合规评估档案已建立',
      kind: 'module',
      module: 'compliance',
      evaluate: (p, ctx) => {
        const fact = ctx.availableModules?.compliance
        if (!fact || fact.evaluated !== true) {
          return { result: GATE_RESULTS.NOT_EVALUATED, message: MODULE_ZH.compliance || '合规数据域尚未接入' }
        }
        const status = fact.assessmentStatus
        if (
          status === 'NOT_STARTED' ||
          status === 'IN_ASSESSMENT' ||
          status === 'COMPLETED'
        ) {
          return { result: GATE_RESULTS.PASS }
        }
        return {
          result: GATE_RESULTS.FAIL,
          message: '合规评估档案状态无效，请检查项目合规记录',
        }
      },
    },
  ],
  PRODUCTION: [
    {
      id: 'compliance_done',
      label: '合规评估已完成',
      kind: 'module',
      module: 'compliance',
      evaluate: (p, ctx) => {
        const fact = ctx.availableModules?.compliance
        if (!fact || fact.evaluated !== true) {
          return { result: GATE_RESULTS.NOT_EVALUATED, message: MODULE_ZH.compliance || '合规数据域尚未接入' }
        }
        const status = fact.assessmentStatus
        if (status === 'COMPLETED') {
          return { result: GATE_RESULTS.PASS }
        }
        if (status === 'NOT_STARTED') {
          return { result: GATE_RESULTS.FAIL, message: '合规评估尚未开始' }
        }
        if (status === 'IN_ASSESSMENT') {
          return { result: GATE_RESULTS.FAIL, message: '合规评估尚未完成' }
        }
        return {
          result: GATE_RESULTS.FAIL,
          message: '合规评估状态无效',
        }
      },
    },
    {
      id: 'cert_plan',
      label: '认证处理路径已明确',
      kind: 'module',
      module: 'compliance',
      evaluate: (p, ctx) => {
        const fact = ctx.availableModules?.compliance
        if (!fact || fact.evaluated !== true) {
          return {
            result: GATE_RESULTS.NOT_EVALUATED,
            message: '合规数据域尚未接入',
          }
        }

        if (!('certificationApplicability' in fact) || fact.certificationApplicability === undefined) {
          return {
            result: GATE_RESULTS.NOT_EVALUATED,
            message: '该项目尚未记录认证适用性，目前该项采用兼容处理，不代表认证判断已经完成。',
          }
        }

        const app = fact.certificationApplicability

        if (
          app === null ||
          app === '' ||
          typeof app !== 'string' ||
          !['UNASSESSED', 'REQUIRED', 'NOT_REQUIRED'].includes(app)
        ) {
          return {
            result: GATE_RESULTS.FAIL,
            message: '认证适用性状态无效（Fail-close）',
          }
        }

        if (app === 'UNASSESSED') {
          return {
            result: GATE_RESULTS.FAIL,
            message: '认证适用性尚未判断，请在合规面板确认',
          }
        }

        if (app === 'REQUIRED') {
          if (!fact.certificationPlanPresent) {
            return {
              result: GATE_RESULTS.FAIL,
              message: '商品需要办理认证，但尚未制定认证处理计划',
            }
          }
          return {
            result: GATE_RESULTS.PASS,
            message: '认证处理路径已明确',
          }
        }

        if (app === 'NOT_REQUIRED') {
          if (!fact.certificationApplicabilityNotesPresent) {
            return {
              result: GATE_RESULTS.FAIL,
              message: '判定无需认证时必须填写判断依据',
            }
          }
          return {
            result: GATE_RESULTS.PASS,
            message: '已明确判定无需办理认证（依据已留存）',
          }
        }

        return {
          result: GATE_RESULTS.FAIL,
          message: '认证适用性状态无效（Fail-close）',
        }
      },
    },
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

  const { availableModules = {}, snapshot = null, scenarios = [] } = deps
  const snapshotSpecified = 'snapshot' in deps
  const ctx = { scenarios, snapshot, snapshotSpecified, availableModules }
  const checks = []
  for (const stage of path) {
    for (const def of CHECKS[stage] || []) {
      if (def.kind === 'module') {
        if (typeof def.evaluate === 'function') {
          checks.push({ stage, id: def.id, label: def.label, ...def.evaluate(project, ctx) })
        } else {
          // 未实现依赖域一律 NOT_EVALUATED（不伪装 PASS，也不当 FAIL）
          checks.push({ stage, id: def.id, label: def.label, result: GATE_RESULTS.NOT_EVALUATED, message: MODULE_ZH[def.module] || '该依赖模块尚未实现' })
        }
      } else {
        checks.push({ stage, id: def.id, label: def.label, ...def.evaluate(project, ctx) })
      }
    }
  }

  // BLOCKED_LOGISTICS 精确语义：当前 < SAMPLING 且目标 >= SAMPLING 才触发一次
  const statuses = snapshotStatusList(snapshot)
  if (fromIdx < SAMPLING_INDEX && toIdx >= SAMPLING_INDEX && statuses.includes('BLOCKED_LOGISTICS')) {
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
