/**
 * miStore.js — 俄罗斯市场选品情报数据层与 T6 业务中台适配器
 * 负责批次数据加载、验证池看板状态持久化、以及一键推送到 T6 候选池
 */
import { getApiBase, getDataUrl } from '../runtime.js'
import { persistGet, persistSet } from '../persist.js'
import {
  ensureCandidate,
  findCandidateByProductId,
  findCandidateBySourceNicheUid,
  syncCandidateMarketEvidence,
  setCandidateBizStatus,
} from '../t6/t6Store.js'
import {
  resolveNicheUid,
  buildMiCandidateSourceProductId,
  buildCandidateMarketEvidence,
} from './candidateMarketBridge.js'
import {
  buildProcurementIdentity,
  findProcurementQuote,
} from './procurementIdentity.js'

export { findProcurementQuote }

const RUNS_CACHE = new Map()
const PERSIST_KEY_VALIDATION_OVERRIDES = 'mi_validation_overrides'
const PERSIST_KEY_MANUAL_QUOTES = 'mi_manual_procurement_quotes'

// ---------- 1. 批次数据加载（带内存 LRU/Map 缓存） ----------

export async function fetchActiveRunInfo() {
  const activeUrl = getDataUrl('market_intelligence/active_run.json')
  const resp = await fetch(`${activeUrl}?t=${Date.now()}`)
  if (!resp.ok) throw new Error(`无法获取活跃批次信息: ${resp.status}`)
  return resp.json()
}

export async function fetchRunBundle(runId = 'RUN-20260917-001') {
  if (RUNS_CACHE.has(runId)) {
    return RUNS_CACHE.get(runId)
  }

  const base = getDataUrl(`market_intelligence/runs/${runId}`).replace(/\/$/, '')
  const [metaRes, nichesRes, kwRes, valRes, auditRes] = await Promise.all([
    fetch(`${base}/run_meta.json?t=${Date.now()}`),
    fetch(`${base}/niches_compact.json?t=${Date.now()}`),
    fetch(`${base}/keywords_top.json?t=${Date.now()}`),
    fetch(`${base}/validation_pool.json?t=${Date.now()}`),
    fetch(`${base}/audit_summary.json?t=${Date.now()}`),
  ])

  if (!metaRes.ok || !nichesRes.ok) {
    throw new Error(`批次 ${runId} 核心数据加载失败: ${metaRes.status}/${nichesRes.status}`)
  }

  const meta = await metaRes.json()
  const niches = await nichesRes.json()
  const keywords = kwRes.ok ? await kwRes.json() : []
  const defaultValidationPool = valRes.ok ? await valRes.json() : { TEST: [], VERIFY: [], WATCH: [], DROP: [] }
  const auditSummary = auditRes.ok ? await auditRes.json() : {}

  const bundle = {
    runId,
    meta,
    niches,
    keywords,
    defaultValidationPool,
    auditSummary,
  }

  RUNS_CACHE.set(runId, bundle)
  return bundle
}

// ---------- 2. 审计日志与操作追溯 ----------

export async function recordAuditLog(entry) {
  const payload = {
    timestamp: new Date().toISOString(),
    ...entry,
  }
  try {
    await fetch(`${getApiBase()}/api/market-intelligence/audit-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    try {
      const localLogs = persistGet('mi_audit_log') || []
      localLogs.unshift(payload)
      if (localLogs.length > 300) localLogs.length = 300
      persistSet('mi_audit_log', localLogs)
    } catch {}
  }
  return payload
}

export async function fetchAuditLogs() {
  try {
    const res = await fetch(`${getApiBase()}/api/market-intelligence/audit-log?t=${Date.now()}`)
    if (res.ok) return await res.json()
  } catch {}
  return persistGet('mi_audit_log') || []
}

// ---------- 3. 验证池动态状态管理（支持用户看板拖拽与状态持久化） ----------

export function getValidationOverrides() {
  try {
    return persistGet(PERSIST_KEY_VALIDATION_OVERRIDES) || {}
  } catch {
    return {}
  }
}

export function saveValidationOverride(nicheIdentifier, newVerdict, note = '', oldVerdict = null, source = 'VALIDATION_OVERRIDE') {
  const overrides = getValidationOverrides()
  const nicheName = typeof nicheIdentifier === 'string' ? nicheIdentifier : (nicheIdentifier?.name || '')
  const nicheUid = typeof nicheIdentifier === 'object' ? nicheIdentifier?.uid : null

  const entry = {
    verdict: newVerdict,
    note,
    uid: nicheUid,
    name: nicheName,
    updatedAt: new Date().toISOString(),
  }

  // 双键索引：既支持 name 也支持 uid
  overrides[nicheName] = entry
  if (nicheUid) {
    overrides[nicheUid] = entry
  }

  persistSet(PERSIST_KEY_VALIDATION_OVERRIDES, overrides)

  // 记录审计日志
  recordAuditLog({
    action: 'STATUS_CHANGE',
    niche_uid: nicheUid,
    niche_name: nicheName,
    old_value: oldVerdict,
    new_value: newVerdict,
    source,
    note,
  })

  return overrides
}

/**
 * 将默认 Phase 4 验证池与用户自定义调整合并为最终看板数据
 */
export function buildMergedValidationPool(defaultPool, allNiches, overrides) {
  const pool = {
    TEST: [],
    VERIFY: [],
    WATCH: [],
    DROP: [],
  }

  // 1. 放入默认已验证的单品
  const handledNames = new Set()
  for (const [col, items] of Object.entries(defaultPool)) {
    for (const item of items) {
      const name = item.name
      handledNames.add(name)
      const userOv = overrides[name]
      const targetCol = userOv?.verdict || col
      const mergedItem = {
        ...item,
        verdict: targetCol,
        userNote: userOv?.note || '',
      }
      if (pool[targetCol]) pool[targetCol].push(mergedItem)
    }
  }

  // 2. 放入用户从雷达/利基列表额外加入验证池的利基
  for (const [name, ov] of Object.entries(overrides)) {
    if (handledNames.has(name)) continue
    const targetCol = ov.verdict
    if (!pool[targetCol]) continue

    const niche = allNiches.find((n) => n.name === name)
    if (niche) {
      pool[targetCol].push({
        rank: niche.id,
        name: niche.name,
        category: niche.cat,
        mos: niche.mos,
        cfs: niche.cfs,
        comp: niche.comp,
        gmv: niche.gmv,
        growth: niche.growth,
        sellers: niche.sellers,
        buyout: `${niche.buyout}%`,
        price: `¥${niche.price}`,
        search: niche.search,
        weight_g: niche.specs?.weight_g || (niche.heavy === 'YES' ? 2500 : 350),
        dims: niche.specs?.dims || '标准规格',
        specs: niche.specs?.specs || '通用规格',
        eac: niche.specs?.eac || 'UNKNOWN',
        rationale: ov.note || '由用户手动从选品雷达加入',
        userNote: ov.note || '',
        verdict: targetCol,
      })
    }
  }

  return pool
}

// ---------- 4. Phase 5 人工采购询价暂存器 ----------

export function getManualQuotes() {
  try {
    return persistGet(PERSIST_KEY_MANUAL_QUOTES) || {}
  } catch {
    return {}
  }
}

export function saveManualQuote(nicheIdentifier, quoteData, oldData = null) {
  const all = getManualQuotes()
  const { uid: nicheUid, name: nicheName } = typeof nicheIdentifier === 'string'
    ? { uid: null, name: nicheIdentifier.trim() }
    : buildProcurementIdentity(nicheIdentifier)

  const entry = {
    ...quoteData,
    uid: nicheUid,
    name: nicheName,
    updatedAt: new Date().toISOString(),
  }

  if (nicheName) {
    all[nicheName] = entry
  }
  if (nicheUid) {
    all[nicheUid] = entry
  }
  persistSet(PERSIST_KEY_MANUAL_QUOTES, all)

  recordAuditLog({
    action: 'PHASE5_UPDATE',
    niche_uid: nicheUid,
    niche_name: nicheName,
    old_value: oldData ? JSON.stringify(oldData) : null,
    new_value: JSON.stringify(quoteData),
    source: 'PROCUREMENT_WORKBENCH',
  })

  return all
}

// ---------- 5. 无缝衔接 T6 SKU 项目生命周期 ----------

/**
 * 一键将验证池中的单品推送到 T6 候选池（生成 t6.candidate，具备幂等防重与证据同步）
 */
export function promoteToT6Candidate(niche, reason = '', runId = 'RUN-20260917-001') {
  if (!niche || !niche.name) {
    throw new Error('MI_STORE: 无效利基对象，无法推送到 T6')
  }

  const nicheUid = resolveNicheUid(niche)
  if (!nicheUid) {
    throw new Error('MI_STORE: 利基对象缺少有效 nicheUid，阻断推送到 T6（禁止无 UID 推进以防脏数据）')
  }

  const overrides = getValidationOverrides()
  const override = overrides[nicheUid] || overrides[niche.name] || null
  const effectiveVerdict = override?.verdict ?? niche?.verdict ?? null

  const marketEvidence = buildCandidateMarketEvidence(niche, runId, effectiveVerdict)

  const nicheId = niche.rank ?? niche.id ?? niche.name
  const stableSourceProductId = buildMiCandidateSourceProductId(niche)
  const legacySourceProductId = `wb-niche-${niche.name}`
  const notes = `[WB选品情报] Niche ID: ${nicheId} | UID: ${nicheUid} | Run: ${runId} | MOS: ${niche.mos} | CFS: ${niche.cfs || niche.pfs} | 签收率: ${niche.buyout} | 均价: ${niche.price} | 预估单重: ${niche.weight_g || (niche.heavy === 'YES' ? '大件' : '轻件')}。${reason || niche.rationale || ''}`

  // 四步查重策略：
  // STEP 1: 按 source_niche_uid 找 Candidate（以 nicheUid 为主身份键）
  let existing = findCandidateBySourceNicheUid(nicheUid)
  if (existing) {
    // 来源系统一致性校验：显式跨系统冲突阻断
    if (existing.source_system && existing.source_system !== 'WB_MARKET_INTELLIGENCE') {
      throw new Error(
        `MI_STORE: 身份冲突阻断：已有候选 (${existing.id}) 来源系统为 ${existing.source_system}，与当前 WB_MARKET_INTELLIGENCE 冲突，禁止覆盖复用，需人工核实`
      )
    }

    // 类目一致性校验：两端均有具体类目且不一致时阻断
    const nicheCat = String(niche.category || niche.cat || '').trim()
    const candCatLeaf = String(existing.categoryLeaf || '').trim()
    const candCatFull = String(existing.categoryFull || '').trim()
    const hasSpecificNicheCat = Boolean(nicheCat && nicheCat !== '未分类')
    const hasSpecificCandCat = Boolean(
      (candCatLeaf && candCatLeaf !== '未分类') ||
      (candCatFull && candCatFull !== '未分类')
    )
    if (hasSpecificNicheCat && hasSpecificCandCat) {
      const categoryMatch = candCatLeaf === nicheCat || candCatFull === nicheCat
      if (!categoryMatch) {
        throw new Error(
          `MI_STORE: 身份冲突阻断：已有候选 (${existing.id}) 类目 (${candCatLeaf || candCatFull}) 与当前利基类目 (${nicheCat}) 冲突，禁止覆盖复用，需人工核实`
        )
      }
    }

    // 商品名称一致性校验：若旧候选有明确名称且与当前不符则阻断
    const candName = String(existing.candidateName || '').trim()
    const nicheName = String(niche.name || '').trim()
    if (candName && nicheName && candName !== nicheName) {
      throw new Error(
        `MI_STORE: 身份冲突阻断：已有候选 (${existing.id}) 名称 (${candName}) 与当前利基名称 (${nicheName}) 冲突，禁止覆盖复用，需人工核实`
      )
    }
  }

  // STEP 2: 按 stable sourceProductId 找 (校验 UID、系统、类目、名称及先验身份充分性)
  if (!existing) {
    const byProduct = findCandidateByProductId(stableSourceProductId)
    if (byProduct) {
      // 1. 冲突 UID 校验
      if (byProduct.source_niche_uid && byProduct.source_niche_uid !== nicheUid) {
        throw new Error(
          `MI_STORE: 身份冲突阻断：已有候选 (${byProduct.id}) 的 sourceProductId 与当前相同，但已绑定其他 UID (${byProduct.source_niche_uid})，禁止覆盖复用，需人工核实`
        )
      }

      // 2. 跨系统冲突校验
      if (byProduct.source_system && byProduct.source_system !== 'WB_MARKET_INTELLIGENCE') {
        throw new Error(
          `MI_STORE: 身份冲突阻断：已有候选 (${byProduct.id}) 的 sourceProductId 与当前相同，但来源系统为 ${byProduct.source_system}，禁止覆盖复用，需人工核实`
        )
      }

      // 3. 类目一致性校验
      const nicheCat = String(niche.category || niche.cat || '').trim()
      const candCatLeaf = String(byProduct.categoryLeaf || '').trim()
      const candCatFull = String(byProduct.categoryFull || '').trim()
      const hasSpecificNicheCat = Boolean(nicheCat && nicheCat !== '未分类')
      const hasSpecificCandCat = Boolean(
        (candCatLeaf && candCatLeaf !== '未分类') ||
        (candCatFull && candCatFull !== '未分类')
      )
      if (hasSpecificNicheCat && hasSpecificCandCat) {
        const categoryMatch = candCatLeaf === nicheCat || candCatFull === nicheCat
        if (!categoryMatch) {
          throw new Error(
            `MI_STORE: 身份冲突阻断：已有候选 (${byProduct.id}) 的 sourceProductId 与当前相同，但类目 (${candCatLeaf || candCatFull}) 与当前 (${nicheCat}) 冲突，需人工核实`
          )
        }
      }

      // 4. 名称一致性校验
      const candName = String(byProduct.candidateName || '').trim()
      const nicheName = String(niche.name || '').trim()
      if (candName && nicheName && candName !== nicheName) {
        throw new Error(
          `MI_STORE: 身份冲突阻断：已有候选 (${byProduct.id}) 的 sourceProductId 与当前相同，但名称 (${candName}) 与当前 (${nicheName}) 冲突，需人工核实`
        )
      }

      // 5. 来源身份校验：必须具备与当前利基一致的 source_niche_uid，禁止仅凭名称/类目相同自动复用
      if (byProduct.source_niche_uid && byProduct.source_niche_uid === nicheUid) {
        existing = byProduct
      } else {
        // 旧记录缺少可证明当前来源的 UID 身份凭据，且 stableSourceProductId 已被占用，必须阻断
        throw new Error(
          `MI_STORE: 身份冲突阻断：已有候选 (${byProduct.id}) 占用了 sourceProductId (${stableSourceProductId}) 但缺少当前来源 UID 身份凭据，禁止自动同步覆盖，需人工核实`
        )
      }
    }
  }

  // STEP 3: Legacy Candidate Backfill (严格核验来源ID、类目、系统与UID一致性)
  if (!existing) {
    const legacyCandidate = findCandidateByProductId(legacySourceProductId)
    if (legacyCandidate) {
      const nicheCat = String(niche.category || niche.cat || '').trim()
      const candCatLeaf = String(legacyCandidate.categoryLeaf || '').trim()
      const candCatFull = String(legacyCandidate.categoryFull || '').trim()

      const hasUidConflict = Boolean(
        legacyCandidate.source_niche_uid && legacyCandidate.source_niche_uid !== nicheUid
      )

      // 类目必须明确且一致（排除空值或未分类这种信息不充分情况）
      const hasSpecificCategory =
        Boolean(nicheCat && nicheCat !== '未分类') &&
        Boolean((candCatLeaf && candCatLeaf !== '未分类') || (candCatFull && candCatFull !== '未分类'))

      const categoryMatch =
        hasSpecificCategory &&
        (candCatLeaf === nicheCat || candCatFull === nicheCat)

      const systemConflict = Boolean(
        legacyCandidate.source_system &&
        legacyCandidate.source_system !== 'WB_MARKET_INTELLIGENCE'
      )

      // 强身份一致性要求：仅同名同类目不足以证明同一利基。
      // 旧字段缺失、冲突或无法证明同一来源时，严禁自动回填旧候选！
      // 必须满足：旧候选记录了 source_niche_id 且与本次 nicheId 严格一致。
      const nicheIdStr = String(nicheId)
      const legacyNicheId = legacyCandidate.source_niche_id ? String(legacyCandidate.source_niche_id) : null
      const hasValidSourceIdMatch = Boolean(legacyNicheId && legacyNicheId === nicheIdStr)

      // 仅当名、类目、无 UID 冲突、无来源冲突且来源利基 ID 明确匹配时才合法回填
      if (!hasUidConflict && categoryMatch && !systemConflict && hasValidSourceIdMatch) {
        existing = legacyCandidate
      }
      // 注意：若旧 source_niche_id 缺失、不一致（如旧 101 新 999）、类目不同或存在冲突，
      // 严禁复用，保持现有 legacyCandidate 及其项目/快照指针原样（字节级不变），继续执行 STEP 4 创建基于 nicheUid 的新候选
    }
  }

  // 若存在已有候选：刷新市场证据，严禁覆盖业务字段，保持旧 sourceProductId
  if (existing) {
    const candidate = syncCandidateMarketEvidence(existing.id, {
      source_niche_id: String(nicheId),
      source_niche_uid: nicheUid,
      source_run_id: String(runId),
      source_system: 'WB_MARKET_INTELLIGENCE',
      marketEvidence,
    })

    recordAuditLog({
      action: 'T6_PUSH',
      niche_uid: nicheUid || null,
      niche_name: niche.name,
      old_value: null,
      new_value: `PROMOTED_TO_T6_CANDIDATE_SYNCED (ID: ${candidate.id})`,
      source: 'T6_PROMOTION',
      note: reason,
    })

    return { candidate, created: false }
  }

  // STEP 4: 全新候选创建
  const { candidate, created } = ensureCandidate({
    sourceProductId: stableSourceProductId,
    candidateIndex: typeof nicheId === 'number' ? nicheId : 0,
    name: niche.name,
    categoryLeaf: niche.category || niche.cat || '未分类',
    categoryFull: niche.category || niche.cat || '未分类',
    notes,
    source_niche_id: String(nicheId),
    source_niche_uid: nicheUid,
    source_run_id: String(runId),
    source_system: 'WB_MARKET_INTELLIGENCE',
    marketEvidence,
  })

  // 严防伪成功陷阱：若 ensureCandidate 返回 created === false，说明底层被不可信旧记录占用
  if (!created) {
    throw new Error(
      `MI_STORE: 身份冲突阻断：sourceProductId (${stableSourceProductId}) 已存在但未通过前置身份复用核验，严禁伪报同步成功，需人工核实`
    )
  }

  let finalCandidate = candidate
  if (created) {
    try {
      finalCandidate = setCandidateBizStatus(candidate.id, '待调研', '来自俄罗斯市场情报一键推进')
    } catch {
      // 忽略重复状态
    }
  }

  recordAuditLog({
    action: 'T6_PUSH',
    niche_uid: nicheUid || null,
    niche_name: niche.name,
    old_value: null,
    new_value: `PROMOTED_TO_T6_CANDIDATE (ID: ${finalCandidate.id})`,
    source: 'T6_PROMOTION',
    note: reason,
  })

  return { candidate: finalCandidate, created }
}

// ---------- 6. 数据更新自动化与批次回滚管道服务 ----------

export async function rollbackActiveRun() {
  const resp = await fetch(`${getApiBase()}/api/market-intelligence/rollback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error || `回滚失败: ${resp.status}`)
  }
  return resp.json()
}


export async function uploadDataFiles(fileA, fileB) {
  const formData = new FormData()
  if (fileA) formData.append('nicheFile', fileA)
  if (fileB) formData.append('searchFile', fileB)

  const resp = await fetch(`${getApiBase()}/api/market-intelligence/upload`, {
    method: 'POST',
    body: formData,
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error || `文件上传失败: ${resp.status}`)
  }
  return resp.json()
}

export async function triggerPipelineRun({ nicheFile, searchFile, runId, runTitle, dryRun = false }) {
  const resp = await fetch(`${getApiBase()}/api/market-intelligence/run-pipeline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nicheFile, searchFile, runId, runTitle, dryRun }),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error || `启动管道失败: ${resp.status}`)
  }
  return resp.json()
}

export async function fetchPipelineStatus() {
  const resp = await fetch(`${getApiBase()}/api/market-intelligence/pipeline-status?t=${Date.now()}`)
  if (!resp.ok) throw new Error(`获取管道状态失败: ${resp.status}`)
  return resp.json()
}

export async function fetchDiffReport(runId) {
  if (!runId) return null
  try {
    const resp = await fetch(`${getApiBase()}/api/market-intelligence/diff-report?run_id=${encodeURIComponent(runId)}&t=${Date.now()}`)
    if (resp.ok) return await resp.json()
  } catch {}
  try {
    const staticUrl = getDataUrl(`market_intelligence/runs/${runId}/RUN_DIFF_REPORT.json`)
    const resp = await fetch(`${staticUrl}?t=${Date.now()}`)
    if (resp.ok) return await resp.json()
  } catch {}
  return null
}
