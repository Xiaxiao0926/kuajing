/**
 * t6/candidateProjectEvidence.js — MI Candidate 立项证据快照评估器与载荷组装器
 * 契约（TASK 05C-2 冻结）：
 *  - 纯领域逻辑层：负责 MI Candidate + Phase 5 Quote 的完整性检查与不可变载荷生成
 *  - 统一快照类型：通过 resolveSnapshotKind 支持 SCORING 与 MARKET_VALIDATION 两种类型
 *  - 绝不伪造评分：MARKET_VALIDATION 快照绝对不含 scoreResult, grade, totalScore, decision
 *  - 真实物理事实：sourceInputs 仅冻结真实出厂/售价、实测重(kg)与包装尺寸(cm)，佣金 commission_rfbs 恒为 null
 *  - 物理隔离：绝对不负责持久化 Project，不导入 createProject
 */

export const SNAPSHOT_KIND = {
  SCORING: 'SCORING',
  MARKET_VALIDATION: 'MARKET_VALIDATION',
}

/**
 * 解析快照类型
 * 历史无 snapshotKind 字段的快照兼容解释为 SCORING；新证据快照为 MARKET_VALIDATION
 * @param {object|null} snapshot
 * @returns {string|null}
 */
export function resolveSnapshotKind(snapshot) {
  if (!snapshot) return null
  return snapshot.snapshotKind || SNAPSHOT_KIND.SCORING
}

/**
 * 解析采购验证包装尺寸（长x宽x高，单位：cm）
 * 依据 ManualProcurementWorkbench.jsx 明确标签「外包装尺寸 (长x宽x高 cm)」
 * 支持格式：'20x15x5', '20*15*5', '20×15×5', [20,15,5], {lengthCm, widthCm, heightCm}
 * 校验失败或含非正数时返回 null（Fail-close）
 * @param {string|number[]|object} value
 * @returns {[number, number, number]|null}
 */
export function parseProcurementDims(value) {
  if (!value) return null

  // 数组格式 [L, W, H]
  if (Array.isArray(value)) {
    if (value.length !== 3) return null
    const nums = value.map((v) => Number(v))
    if (nums.every((n) => Number.isFinite(n) && n > 0)) {
      return [nums[0], nums[1], nums[2]]
    }
    return null
  }

  // 对象格式 { lengthCm, widthCm, heightCm } 或 { length, width, height }
  if (typeof value === 'object') {
    const l = Number(value.lengthCm ?? value.length)
    const w = Number(value.widthCm ?? value.width)
    const h = Number(value.heightCm ?? value.height)
    if (Number.isFinite(l) && l > 0 && Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0) {
      return [l, w, h]
    }
    return null
  }

  // 字符串格式 "20x15x5", "20*15*5", "20×15×5"
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    // 按分隔符分割
    const parts = trimmed.split(/[\s*xX×]+/).filter(Boolean)
    if (parts.length !== 3) return null
    const nums = parts.map((p) => Number(p))
    if (nums.every((n) => Number.isFinite(n) && n > 0)) {
      return [nums[0], nums[1], nums[2]]
    }
    return null
  }

  return null
}

/**
 * 评估 MI Candidate 的立项证据完整性（Eligibility Evaluation）
 * 仅检查是否有足够合法、结构化的事实能够冻结一个立项证据快照。
 * 严禁包含商业选品阈值（如 MOS>=70, marginPct>=15 等）
 * @param {{ candidate: object, quote: object }} args
 * @returns {{ eligible: boolean, checks: Array<{id: string, pass: boolean, message: string}>, missing: string[] }}
 */
export function evaluateMarketValidationEligibility({ candidate, quote }) {
  const checks = []

  // 1. candidate_exists: 候选对象必须存在
  const candidateExists = Boolean(candidate && typeof candidate === 'object')
  checks.push({
    id: 'candidate_exists',
    pass: candidateExists,
    message: candidateExists ? '候选对象存在' : '候选对象不存在',
  })

  // 2. mi_source: 必须为 WB_MARKET_INTELLIGENCE 来源
  const miSource = candidate?.source_system === 'WB_MARKET_INTELLIGENCE'
  checks.push({
    id: 'mi_source',
    pass: miSource,
    message: miSource ? '来源系统为 WB_MARKET_INTELLIGENCE' : '非 WB_MARKET_INTELLIGENCE 来源',
  })

  // 3. stable_niche_uid: 候选必须具备全局稳定利基 UID
  const hasStableUid = Boolean(candidate?.source_niche_uid && String(candidate.source_niche_uid).trim())
  checks.push({
    id: 'stable_niche_uid',
    pass: hasStableUid,
    message: hasStableUid ? '存在稳定利基 UID' : '缺失稳定利基 UID',
  })

  // 4. market_evidence: 必须具备结构化 marketEvidence 且 nicheUid 与 source_niche_uid 一致
  const hasMarketEvidence = Boolean(candidate?.marketEvidence && typeof candidate.marketEvidence === 'object')
  const uidMatchesEvidence = Boolean(
    hasMarketEvidence &&
    hasStableUid &&
    String(candidate.marketEvidence.nicheUid || '').trim() === String(candidate.source_niche_uid || '').trim()
  )
  checks.push({
    id: 'market_evidence',
    pass: uidMatchesEvidence,
    message: !hasMarketEvidence
      ? '缺失结构化 marketEvidence'
      : !uidMatchesEvidence
        ? 'marketEvidence.nicheUid 与 candidate.source_niche_uid 不一致'
        : '市场证据完整且 UID 校验一致',
  })

  // 5. procurement_quote: 必须存在 quote 且 quote.uid 与 source_niche_uid 一致
  const hasQuote = Boolean(quote && typeof quote === 'object')
  const quoteHasUid = Boolean(quote?.uid && String(quote.uid).trim())
  const uidMatchesQuote = Boolean(
    hasQuote &&
    quoteHasUid &&
    hasStableUid &&
    String(quote.uid).trim() === String(candidate.source_niche_uid).trim()
  )
  checks.push({
    id: 'procurement_quote',
    pass: uidMatchesQuote,
    message: !hasQuote
      ? '缺失采购验证报价 (Quote)'
      : !quoteHasUid
        ? '采购报价缺少 UID (不允许纯名称关联立项)'
        : !uidMatchesQuote
          ? 'quote.uid 与 candidate.source_niche_uid 不一致'
          : '采购报价存在且 UID 校验一致',
  })

  // 6. supplier: 供应商名称必须已填写
  const hasSupplier = Boolean(quote?.supplierName && String(quote.supplierName).trim())
  checks.push({
    id: 'supplier',
    pass: hasSupplier,
    message: hasSupplier ? '供应商名称已填写' : '缺失供应商名称',
  })

  // 7. factory_price: 采购出厂价必须是有限正数
  const rawFactoryPrice = quote?.factoryPriceCny
  const factoryPrice = rawFactoryPrice != null ? Number(rawFactoryPrice) : NaN
  const hasFactoryPrice = Number.isFinite(factoryPrice) && factoryPrice > 0
  checks.push({
    id: 'factory_price',
    pass: hasFactoryPrice,
    message: hasFactoryPrice ? `出厂价有效 (¥${factoryPrice})` : '出厂价缺失或非正数',
  })

  // 8. measured_weight: 实测单重 (g) 必须是有限正数
  const rawWeight = quote?.weightG
  const weightG = rawWeight != null ? Number(rawWeight) : NaN
  const hasWeight = Number.isFinite(weightG) && weightG > 0
  checks.push({
    id: 'measured_weight',
    pass: hasWeight,
    message: hasWeight ? `实测重量有效 (${weightG}g)` : '实测重量缺失或非正数',
  })

  // 9. package_dims: 外包装尺寸必须能被解析为 [L, W, H] 三个正数 (cm)
  const parsedDims = parseProcurementDims(quote?.dims)
  const hasDims = parsedDims !== null
  checks.push({
    id: 'package_dims',
    pass: hasDims,
    message: hasDims ? `包装尺寸有效 (${parsedDims.join('x')} cm)` : '包装尺寸解析失败或非正数',
  })

  // 10. target_price: 目标售价 (RUB) 必须是有限正数
  const rawTargetPrice = quote?.targetPriceRub
  const targetPrice = rawTargetPrice != null ? Number(rawTargetPrice) : NaN
  const hasTargetPrice = Number.isFinite(targetPrice) && targetPrice > 0
  checks.push({
    id: 'target_price',
    pass: hasTargetPrice,
    message: hasTargetPrice ? `目标售价有效 (${targetPrice} ₽)` : '目标售价缺失或非正数',
  })

  const eligible = checks.every((c) => c.pass)
  const missing = checks.filter((c) => !c.pass).map((c) => c.id)

  return {
    eligible,
    checks,
    missing,
  }
}

/**
 * 构建不可变 Market Validation Snapshot 载荷
 * 只有 eligibility.eligible 为 true 时才允许构建，否则抛出 Fail-close 异常
 * @param {{ candidate: object, quote: object }} args
 * @returns {object} snapshot payload (符合 t6.snapshot 标准规范)
 */
export function buildMarketValidationSnapshotPayload({ candidate, quote }) {
  const eligibility = evaluateMarketValidationEligibility({ candidate, quote })
  if (!eligibility.eligible) {
    throw new Error(`T6_EVIDENCE: MI Candidate 立项证据不完整（缺失项: ${eligibility.missing.join(', ')}）`)
  }

  const parsedDims = parseProcurementDims(quote.dims)
  const weightG = Number(quote.weightG)
  const weightKg = Math.round((weightG / 1000) * 1000) / 1000

  // 构造供下游成本适配器（CostScenarioAdapter）消费的基础物理与价格事实
  const sourceInputs = {
    name: candidate.candidateName || '',
    price_rub: Number(quote.targetPriceRub),
    avg_price_rub: null,
    weight_kg: weightKg,
    dims: parsedDims,
    commission_rfbs: null, // 绝不把 WB 佣金冒充为 Ozon 佣金，恒为 null
    category_leaf: candidate.categoryLeaf || '',
    category_full: candidate.categoryFull || '',
  }

  // 深拷贝冻结当时的证据副本
  const marketEvidence = JSON.parse(JSON.stringify(candidate.marketEvidence))
  const procurementEvidence = JSON.parse(JSON.stringify(quote))

  const evidenceContext = {
    sourceSystem: candidate.source_system,
    sourceRunId: candidate.source_run_id ?? null,
    sourceNicheUid: candidate.source_niche_uid,
    marketSyncedAt: candidate.marketEvidence?.syncedAt ?? null,
    procurementUpdatedAt: quote.updatedAt ?? null,
  }

  const versions = {
    evidenceSchemaVersion: 'market-validation-v1',
  }

  return {
    snapshotKind: SNAPSHOT_KIND.MARKET_VALIDATION,
    candidateId: candidate.id,
    sourceProductId: candidate.sourceProductId,
    sourceInputs,
    marketEvidence,
    procurementEvidence,
    evidenceContext,
    versions,
  }
}

/**
 * 辅助纯函数：从快照列表中查找特定 Candidate 最新的 Market Validation 快照（只读辅助）
 * @param {Array<object>} snapshots
 * @param {string} candidateId
 * @returns {object|null}
 */
export function findLatestMarketValidationSnapshot(snapshots, candidateId) {
  if (!Array.isArray(snapshots) || !candidateId) return null
  const matches = snapshots.filter(
    (s) => s?.candidateId === candidateId && resolveSnapshotKind(s) === SNAPSHOT_KIND.MARKET_VALIDATION
  )
  if (matches.length === 0) return null
  return matches.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0]
}

/**
 * 校验 Candidate 与 Snapshot 是否满足创建 Project 的一致性与数据结构要求
 * 纯函数，不写入 Store，Fail-close
 * 契约（TASK 05C-3A 冻结）：
 *  - 统一通用校验：候选与快照实体存在，candidateId 与 sourceProductId 严格一致
 *  - 支持两类快照：SCORING（含历史无 kind 的快照兼容）与 MARKET_VALIDATION
 *  - SCORING 快照保持原有基础契约，不收紧历史字段
 *  - MARKET_VALIDATION 快照严格校验 Shape 完整性，禁止包含 scoreResult，验证内部 UID 闭环
 *  - 绝不重新比较当前 candidate.marketEvidence（保证立项绑定当时冻结的历史事实）
 * @param {{ candidate: object, snapshot: object }} args
 * @returns {{ valid: boolean, snapshotKind: string|null, errors: string[] }}
 */
export function validateProjectCreationSnapshot({ candidate, snapshot }) {
  const errors = []

  if (!candidate || typeof candidate !== 'object') {
    errors.push('候选对象缺失或无效')
    return { valid: false, snapshotKind: null, errors }
  }
  if (!snapshot || typeof snapshot !== 'object') {
    errors.push('快照对象缺失或无效')
    return { valid: false, snapshotKind: null, errors }
  }

  // 通用引用一致性检查
  if (snapshot.candidateId !== candidate.id) {
    errors.push(`快照 candidateId(${snapshot.candidateId}) 与候选 ID(${candidate.id}) 不一致`)
  }
  if (String(snapshot.sourceProductId) !== String(candidate.sourceProductId)) {
    errors.push(`快照 sourceProductId(${snapshot.sourceProductId}) 与候选 sourceProductId(${candidate.sourceProductId}) 不一致`)
  }

  // 判定快照类型（未声明 snapshotKind 的历史快照自动解释为 SCORING）
  const kind = resolveSnapshotKind(snapshot)
  if (kind !== SNAPSHOT_KIND.SCORING && kind !== SNAPSHOT_KIND.MARKET_VALIDATION) {
    errors.push(`未知或不支持的快照类型: "${kind}"`)
    return { valid: false, snapshotKind: kind, errors }
  }

  if (kind === SNAPSHOT_KIND.SCORING) {
    // SCORING: 保持原有 Store 检查，不额外收紧旧快照字段要求
    return { valid: errors.length === 0, snapshotKind: kind, errors }
  }

  if (kind === SNAPSHOT_KIND.MARKET_VALIDATION) {
    // MARKET_VALIDATION: 严格结构完整性检查 (Shape Validation)
    if (snapshot.snapshotKind !== SNAPSHOT_KIND.MARKET_VALIDATION) {
      errors.push(`快照声明类型必须为 ${SNAPSHOT_KIND.MARKET_VALIDATION}`)
    }
    if (!snapshot.sourceInputs || typeof snapshot.sourceInputs !== 'object') {
      errors.push('缺少结构化 sourceInputs')
    }
    if (!snapshot.marketEvidence || typeof snapshot.marketEvidence !== 'object') {
      errors.push('缺少结构化 marketEvidence')
    }
    if (!snapshot.procurementEvidence || typeof snapshot.procurementEvidence !== 'object') {
      errors.push('缺少结构化 procurementEvidence')
    }
    if (!snapshot.evidenceContext || typeof snapshot.evidenceContext !== 'object') {
      errors.push('缺少结构化 evidenceContext')
    }
    if (snapshot.versions?.evidenceSchemaVersion !== 'market-validation-v1') {
      errors.push('evidenceSchemaVersion 必须为 "market-validation-v1"')
    }

    // 严禁包含评分结果，杜绝两类快照混淆
    if ('scoreResult' in snapshot || snapshot.scoreResult != null) {
      errors.push('MARKET_VALIDATION 快照严禁包含 scoreResult 评分结果')
    }

    // 冻结 Artifact 自身内部的 UID 一致性校验（绝不读取/比较当前可变的 candidate.marketEvidence）
    const ctxNicheUid = String(snapshot.evidenceContext?.sourceNicheUid || '').trim()
    const meNicheUid = String(snapshot.marketEvidence?.nicheUid || '').trim()
    const peUid = String(snapshot.procurementEvidence?.uid || '').trim()

    if (!ctxNicheUid) {
      errors.push('evidenceContext.sourceNicheUid 为空')
    }
    if (ctxNicheUid !== meNicheUid) {
      errors.push(`evidenceContext.sourceNicheUid(${ctxNicheUid}) 与 marketEvidence.nicheUid(${meNicheUid}) 不一致`)
    }
    if (ctxNicheUid !== peUid) {
      errors.push(`procurementEvidence.uid(${peUid}) 与 evidenceContext.sourceNicheUid(${ctxNicheUid}) 不一致`)
    }

    return { valid: errors.length === 0, snapshotKind: kind, errors }
  }

  return { valid: errors.length === 0, snapshotKind: kind, errors }
}

