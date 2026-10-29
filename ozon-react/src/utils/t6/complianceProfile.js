/**
 * utils/t6/complianceProfile.js — Project Compliance Assessment & Plan 纯函数事实源 (TASK 07A-4B)
 * 
 * 契约：
 * - 纯领域逻辑模块，零 Store 读写，零持久化依赖，零副作用
 * - 字段白名单 PROJECT_COMPLIANCE_FIELDS 严格限定为 6 个字段：
 *   assessmentStatus, riskLevel, applicableStandards, certificationPlan, requirements, notes
 * - 严禁混入 Result 字段（certificateNumber, resultType, exemptReason, validUntil, issuingBody）
 * - 严禁混入 Attachment 字段（documents, attachments, fileIds）
 * - 严禁复制 MI 市场证据（eacStatus, certificationStatus, risks, regulationProvenance）
 * - 严禁复制 Product 物理属性（productName, nameZh, brand, model, material, dims, weight）
 * - 严禁复制 Sample 供应链测试属性（sampleStatus, testResult, sampleId）
 */

export const PROJECT_COMPLIANCE_FIELDS = Object.freeze([
  'assessmentStatus',
  'riskLevel',
  'applicableStandards',
  'certificationPlan',
  'requirements',
  'notes',
  'certificationApplicability',
  'certificationApplicabilityNotes',
])

export const COMPLIANCE_ASSESSMENT_STATUS = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  IN_ASSESSMENT: 'IN_ASSESSMENT',
  COMPLETED: 'COMPLETED',
})

export const COMPLIANCE_CERTIFICATION_APPLICABILITY = Object.freeze({
  UNASSESSED: 'UNASSESSED',
  REQUIRED: 'REQUIRED',
  NOT_REQUIRED: 'NOT_REQUIRED',
})

export const COMPLIANCE_RISK_LEVELS = Object.freeze([
  '',
  'LOW',
  'MEDIUM',
  'HIGH',
])

export const COMPLIANCE_REQUIREMENT_CATEGORIES = Object.freeze([
  'REGULATION',
  'INGREDIENT',
  'LABELING',
  'RISK',
  'CERTIFICATION',
  'OTHER',
])

export const COMPLIANCE_REQUIREMENT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
})

// Profile 级允许通过 updateProjectCompliance 更新的白名单字段
const PROFILE_PATCH_ALLOWED_FIELDS = Object.freeze([
  'assessmentStatus',
  'riskLevel',
  'applicableStandards',
  'certificationPlan',
  'notes',
  'certificationApplicability',
  'certificationApplicabilityNotes',
])

// 明确拒绝的领域污染黑名单（Fail-close 防御）
const FORBIDDEN_RESULT_FIELDS = Object.freeze([
  'resultType',
  'certificateNumber',
  'declarationNumber',
  'exemptReason',
  'validUntil',
  'issuingBody',
  'certificateStatus',
])

const FORBIDDEN_ATTACHMENT_FIELDS = Object.freeze([
  'documents',
  'attachments',
  'certificateFiles',
  'fileIds',
  'documentUrls',
])

const FORBIDDEN_EVIDENCE_FIELDS = Object.freeze([
  'eacStatus',
  'certificationStatus',
  'risks',
  'regulationProvenance',
  'marketEvidence',
])

const FORBIDDEN_PRODUCT_FIELDS = Object.freeze([
  'productName',
  'nameZh',
  'brand',
  'model',
  'material',
  'barcode',
  'weight',
  'grossWeightG',
  'netWeightG',
  'dims',
  'packageDimsCm',
  'productDimsCm',
])

const FORBIDDEN_SAMPLE_FIELDS = Object.freeze([
  'sampleStatus',
  'testResult',
  'sampleId',
  'trackNo',
])

/**
 * 判断项目的 compliance 对象是否为空容器
 * @param {object|null|undefined} compliance
 * @returns {boolean}
 */
export function isProjectComplianceEmpty(compliance) {
  if (!compliance || typeof compliance !== 'object') return true
  // 只要显式存在 certificationApplicability 键，无论值为何，均非空（必须交给 Gate 审查）
  if ('certificationApplicability' in compliance) return false
  const keys = Object.keys(compliance)
  if (keys.length === 0) return true
  return keys.every((k) => {
    const val = compliance[k]
    if (val === null || val === undefined || val === '') return true
    if (Array.isArray(val) && val.length === 0) return true
    return false
  })
}

/**
 * 规范化适用法规标准列表 (trim, 去空, 去重, 保持顺序)
 * @param {string[]|string|null|undefined} standards
 * @returns {string[]}
 */
export function normalizeApplicableStandards(standards) {
  if (!standards) return []
  let items = []
  if (Array.isArray(standards)) {
    items = standards
  } else if (typeof standards === 'string') {
    items = standards.split('\n')
  } else {
    return []
  }

  const result = []
  const seen = new Set()
  for (const raw of items) {
    const trimmed = String(raw || '').trim()
    if (!trimmed) continue
    if (!seen.has(trimmed)) {
      seen.add(trimmed)
      result.push(trimmed)
    }
  }
  return result
}

/**
 * 构建初始 Project Compliance 本地草稿（纯函数）
 * @returns {object}
 */
export function buildInitialComplianceDraft() {
  return {
    assessmentStatus: COMPLIANCE_ASSESSMENT_STATUS.NOT_STARTED,
    riskLevel: '',
    applicableStandards: [],
    certificationPlan: '',
    requirements: [],
    notes: '',
  }
}

/**
 * 校验并合并更新 Project Compliance Profile（仅限 Profile 级 7 个字段）
 * 铁律：禁止通过此函数直接覆盖 requirements（requirements 使用专用 API）
 * @param {object} param0
 * @param {object} param0.current 当前 compliance 对象
 * @param {object} param0.patch 本次更新 patch
 * @returns {object} 校验后的全新 compliance 纯对象
 */
export function buildNextProjectCompliance({ current = {}, patch = {} }) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new Error('T6_STORE: patch 必须为普通对象（Fail-close）')
  }

  // 1. 检查禁止字段与白名单拦截
  for (const key of Object.keys(patch)) {
    if (key === 'requirements') {
      throw new Error('T6_STORE: 禁止直接通过 updateProjectCompliance 修改 requirements，请使用专用 Requirement API')
    }
    if (FORBIDDEN_RESULT_FIELDS.includes(key)) {
      throw new Error(`T6_STORE: 结果层字段 "${key}" 在 V1 阶段尚未接入，禁止录入（Fail-close）`)
    }
    if (FORBIDDEN_ATTACHMENT_FIELDS.includes(key)) {
      throw new Error(`T6_STORE: 附件字段 "${key}" 受 P6 架构落差限制，禁止录入（Fail-close）`)
    }
    if (FORBIDDEN_EVIDENCE_FIELDS.includes(key)) {
      throw new Error(`T6_STORE: 市场证据字段 "${key}" 为 Snapshot 只读引用，禁止复制入项目合规域（Fail-close）`)
    }
    if (FORBIDDEN_PRODUCT_FIELDS.includes(key)) {
      throw new Error(`T6_STORE: 商品物理属性 "${key}" 属于 project.product，禁止复制入合规域（Fail-close）`)
    }
    if (FORBIDDEN_SAMPLE_FIELDS.includes(key)) {
      throw new Error(`T6_STORE: 供应链样品属性 "${key}" 属于 SampleRecord，禁止复制入合规域（Fail-close）`)
    }
    if (!PROFILE_PATCH_ALLOWED_FIELDS.includes(key)) {
      throw new Error(`T6_STORE: 未知或非法合规档案字段 "${key}"（Fail-close）`)
    }
  }

  // 2. 纯函数合并以当前真实数据为基础（严禁因空档案、更新备注或 CRUD 自动写入 assessmentStatus: 'NOT_STARTED'）
  const merged = { ...current }

  // 3. 逐字段合并与严格类型/枚举校验
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'assessmentStatus') {
      if (typeof value !== 'string' || !Object.values(COMPLIANCE_ASSESSMENT_STATUS).includes(value)) {
        throw new Error('T6_STORE: assessmentStatus 必须是有效的评估状态（NOT_STARTED, IN_ASSESSMENT, COMPLETED）')
      }
      merged.assessmentStatus = value
    } else if (key === 'riskLevel') {
      if (typeof value !== 'string' || !COMPLIANCE_RISK_LEVELS.includes(value)) {
        throw new Error("T6_STORE: riskLevel 必须是有效的风险等级（'', 'LOW', 'MEDIUM', 'HIGH'）")
      }
      merged.riskLevel = value
    } else if (key === 'applicableStandards') {
      if (!Array.isArray(value) && typeof value !== 'string') {
        throw new Error('T6_STORE: applicableStandards 必须是字符串数组')
      }
      merged.applicableStandards = normalizeApplicableStandards(value)
    } else if (key === 'certificationPlan') {
      if (typeof value !== 'string') {
        throw new Error('T6_STORE: certificationPlan 必须是字符串')
      }
      merged.certificationPlan = value.trim()
    } else if (key === 'notes') {
      if (typeof value !== 'string') {
        throw new Error('T6_STORE: notes 必须是字符串')
      }
      merged.notes = value.trim()
    } else if (key === 'certificationApplicability') {
      if (value === undefined) {
        throw new Error('T6_STORE: patch 中 certificationApplicability 显式为 undefined（Fail-close）')
      }
      if (typeof value !== 'string' || !Object.values(COMPLIANCE_CERTIFICATION_APPLICABILITY).includes(value)) {
        throw new Error('T6_STORE: certificationApplicability 必须为有效适用性状态（UNASSESSED, REQUIRED, NOT_REQUIRED）（Fail-close）')
      }
      merged.certificationApplicability = value
    } else if (key === 'certificationApplicabilityNotes') {
      if (value === undefined) {
        throw new Error('T6_STORE: patch 中 certificationApplicabilityNotes 显式为 undefined（Fail-close）')
      }
      if (typeof value !== 'string') {
        throw new Error('T6_STORE: certificationApplicabilityNotes 必须是字符串')
      }
      merged.certificationApplicabilityNotes = value.trim()
    }
  }

  // 4. 最终合并状态校验（Fail-close 防线）
  if (merged.certificationApplicability !== undefined) {
    if (typeof merged.certificationApplicability !== 'string' || !Object.values(COMPLIANCE_CERTIFICATION_APPLICABILITY).includes(merged.certificationApplicability)) {
      throw new Error('T6_STORE: certificationApplicability 必须为有效适用性状态（UNASSESSED, REQUIRED, NOT_REQUIRED）（Fail-close）')
    }
    if (merged.certificationApplicability === COMPLIANCE_CERTIFICATION_APPLICABILITY.NOT_REQUIRED) {
      const notes = typeof merged.certificationApplicabilityNotes === 'string' ? merged.certificationApplicabilityNotes.trim() : ''
      if (notes.length < 2) {
        throw new Error('T6_STORE: 判定无需办理认证时必须填写判断依据（不少于 2 个字符）')
      }
    }
  }

  // 保持现有的 requirements 数组完整不可变
  if (Array.isArray(current.requirements)) {
    merged.requirements = [...current.requirements]
  }

  return merged
}

/**
 * 规范化与校验单个合规事项对象 (Compliance Requirement)
 * @param {object} item
 * @returns {object}
 */
export function normalizeComplianceRequirement(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error('T6_STORE: requirement 必须是普通对象（Fail-close）')
  }

  if (!item.id || typeof item.id !== 'string' || !item.id.trim()) {
    throw new Error('T6_STORE: 事项 id 必须是非空字符串')
  }

  if (!item.category || !COMPLIANCE_REQUIREMENT_CATEGORIES.includes(item.category)) {
    throw new Error('T6_STORE: category 必须是有效的合规事项类别（REGULATION, INGREDIENT, LABELING, RISK, CERTIFICATION, OTHER）')
  }

  if (typeof item.name !== 'string' || !item.name.trim()) {
    throw new Error('T6_STORE: 事项名称 name 必须是非空字符串')
  }

  if (typeof item.required !== 'boolean') {
    throw new Error('T6_STORE: required 必须为布尔值')
  }

  if (!item.status || !Object.values(COMPLIANCE_REQUIREMENT_STATUS).includes(item.status)) {
    throw new Error('T6_STORE: status 必须是有效的状态（PENDING, IN_PROGRESS, DONE）')
  }

  const risk = item.risk !== undefined && item.risk !== null ? String(item.risk) : ''
  if (!COMPLIANCE_RISK_LEVELS.includes(risk)) {
    throw new Error("T6_STORE: risk 必须是有效的风险等级（'', 'LOW', 'MEDIUM', 'HIGH'）")
  }

  const desc = item.desc !== undefined && item.desc !== null ? String(item.desc).trim() : ''

  return {
    id: item.id.trim(),
    category: item.category,
    name: item.name.trim(),
    required: item.required,
    status: item.status,
    risk,
    desc,
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString(),
  }
}
