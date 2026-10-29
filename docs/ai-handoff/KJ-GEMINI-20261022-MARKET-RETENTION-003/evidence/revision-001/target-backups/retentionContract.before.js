const DAY_MS = 24 * 60 * 60 * 1000

const MIME_BY_EXTENSION = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
  json: 'application/json',
}

export function parseStrictCalendarDateUtc(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/u)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1970 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const utcMs = Date.UTC(year, month - 1, day)
  const date = new Date(utcMs)
  if (
    Number.isNaN(utcMs)
    || date.getUTCFullYear() !== year
    || date.getUTCMonth() + 1 !== month
    || date.getUTCDate() !== day
  ) {
    return null
  }
  return date
}

export function isValidCalendarDate(value) {
  return Boolean(parseStrictCalendarDateUtc(value))
}

export function extractValidFilenameDate(fileName) {
  const raw = String(fileName || '')
  const matches = raw.match(/\d{4}-\d{2}-\d{2}/gu) || []
  for (const candidate of matches) {
    if (isValidCalendarDate(candidate)) return candidate
  }
  return null
}

export function resolveCollectionDateOption(options = {}, sourceFile = '') {
  const hasExplicitSnapshotProp = Object.prototype.hasOwnProperty.call(options, 'snapshot')
  if (options.snapshot === null || options.collectionDateOrigin === 'unknown') {
    return {
      snapshot: null,
      snapshotDate: null,
      collectionDateOrigin: 'unknown',
      collectionDateKnown: false,
    }
  }

  if (hasExplicitSnapshotProp && options.snapshot !== undefined) {
    if (typeof options.snapshot !== 'string' || !options.snapshot.trim()) {
      throw new Error('采集日期格式无效，需为真实存在的 YYYY-MM-DD 日历日期。')
    }
    const normalized = options.snapshot.trim()
    const snapshotDate = parseStrictCalendarDateUtc(normalized)
    if (!snapshotDate) {
      throw new Error(`采集日期“${options.snapshot}”无效，需为真实存在的 YYYY-MM-DD 日历日期。`)
    }
    const origin = options.collectionDateOrigin === 'filename' ? 'filename' : 'user'
    return {
      snapshot: normalized,
      snapshotDate,
      collectionDateOrigin: origin,
      collectionDateKnown: true,
    }
  }

  const filenameDate = extractValidFilenameDate(sourceFile)
  if (filenameDate) {
    return {
      snapshot: filenameDate,
      snapshotDate: parseStrictCalendarDateUtc(filenameDate),
      collectionDateOrigin: 'filename',
      collectionDateKnown: true,
    }
  }

  return {
    snapshot: null,
    snapshotDate: null,
    collectionDateOrigin: 'unknown',
    collectionDateKnown: false,
  }
}

export function computeUtcAgeDays(snapshotDate, listingDate) {
  if (!snapshotDate || !(listingDate instanceof Date) || Number.isNaN(listingDate.getTime())) {
    return null
  }
  const snapshotDayUtc = Date.UTC(
    snapshotDate.getUTCFullYear(),
    snapshotDate.getUTCMonth(),
    snapshotDate.getUTCDate(),
  )
  const listingDayUtc = Date.UTC(
    listingDate.getUTCFullYear(),
    listingDate.getUTCMonth(),
    listingDate.getUTCDate(),
  )
  return Math.floor((snapshotDayUtc - listingDayUtc) / DAY_MS)
}

export async function computeSha256Hex(bufferOrArray) {
  if (!globalThis.crypto?.subtle?.digest) {
    throw new Error('当前运行环境不支持 Web Crypto SHA-256。')
  }
  const sourceBuffer = bufferOrArray instanceof ArrayBuffer
    ? bufferOrArray
    : ArrayBuffer.isView(bufferOrArray)
      ? bufferOrArray.buffer.slice(bufferOrArray.byteOffset, bufferOrArray.byteOffset + bufferOrArray.byteLength)
      : await bufferOrArray.arrayBuffer()
  const digest = await globalThis.crypto.subtle.digest('SHA-256', sourceBuffer)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function getLowercaseExtension(fileName) {
  const matched = String(fileName || '').trim().match(/\.([a-z0-9]+)$/iu)
  return matched ? matched[1].toLowerCase() : ''
}

export function resolveSourceMimeDetails(originalFileName, originalMimeType = '') {
  const ext = getLowercaseExtension(originalFileName)
  const canonicalMime = MIME_BY_EXTENSION[ext] || 'application/octet-stream'
  const normalizedOriginal = String(originalMimeType || '').trim()
  return {
    extension: ext,
    originalMimeType: normalizedOriginal || canonicalMime,
    aliasedMimeType: normalizedOriginal || canonicalMime,
  }
}

export function buildSafeSourceBackupName(originalFileName, sha256Hex) {
  const normalizedHash = String(sha256Hex || '').trim().toLowerCase()
  if (!/^[0-9a-f]{64}$/u.test(normalizedHash)) {
    throw new Error('源文件 SHA-256 指纹无效，无法生成安全源备份名称。')
  }
  const ext = getLowercaseExtension(originalFileName)
  if (!ext || !/^[a-z0-9]+$/u.test(ext)) {
    throw new Error('源文件扩展名无效，无法生成安全源备份名称。')
  }
  return `source-${normalizedHash}.${ext}`
}

export function buildRevisionReportId(importId) {
  const normalized = String(importId || '').trim().toLowerCase()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(normalized)) {
    throw new Error('报告版本 UUID 格式无效。')
  }
  return `uploaded-${normalized}`
}

export function buildRevisionReportFileName(reportId) {
  const normalized = String(reportId || '').trim()
  if (!/^uploaded-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(normalized)) {
    throw new Error('报告文件标识必须由 uploaded-<uuid> 派生。')
  }
  return `${normalized}.json`
}

export function validateConfirmedCollectionDateInput({
  dateUnknown = false,
  dateInput = '',
  prefilledFilenameDate = null,
} = {}) {
  if (dateUnknown) {
    return {
      snapshot: null,
      collectionDateOrigin: 'unknown',
    }
  }
  const trimmed = String(dateInput ?? '').trim()
  if (!trimmed) {
    throw new Error('请填写有效采集日期（YYYY-MM-DD），或明确勾选“采集日期未知”。')
  }
  if (!isValidCalendarDate(trimmed)) {
    throw new Error(`采集日期“${trimmed}”无效：请输入真实存在的 YYYY-MM-DD 日历日期（拒绝如 2026-02-30 的无效日期）。`)
  }
  const origin = prefilledFilenameDate && trimmed === prefilledFilenameDate ? 'filename' : 'user'
  return {
    snapshot: trimmed,
    collectionDateOrigin: origin,
  }
}

export async function createFrozenImportAttempt({
  file,
  rawBytes,
  rawRows,
  fileType,
  dateUnknown = false,
  dateInput = '',
  prefilledFilenameDate = null,
  buildReportFn,
  uuidFn = () => globalThis.crypto.randomUUID(),
  nowFn = () => new Date().toISOString(),
}) {
  if (!file || typeof file.name !== 'string') {
    throw new Error('缺少待导入的原始文件。')
  }
  if (typeof buildReportFn !== 'function') {
    throw new Error('缺少报告构建函数。')
  }

  const { snapshot, collectionDateOrigin } = validateConfirmedCollectionDateInput({
    dateUnknown,
    dateInput,
    prefilledFilenameDate,
  })

  const bytesBuffer = rawBytes instanceof ArrayBuffer
    ? rawBytes.slice(0)
    : await file.arrayBuffer()
  const sourceSha256 = await computeSha256Hex(bytesBuffer)
  const importId = String(uuidFn()).toLowerCase()
  const reportId = buildRevisionReportId(importId)
  const reportFileName = buildRevisionReportFileName(reportId)
  const expectedSourceBackupName = buildSafeSourceBackupName(file.name, sourceSha256)
  const mimeDetails = resolveSourceMimeDetails(file.name, file.type)
  const importedAt = String(nowFn())
  const publishedAt = importedAt
  const lastModified = Number(file.lastModified) || Date.parse(importedAt) || Date.now()

  const sourceBackupFile = new File([bytesBuffer], expectedSourceBackupName, {
    type: mimeDetails.aliasedMimeType,
    lastModified,
  })

  const provenance = {
    version: 1,
    originalFileName: file.name,
    originalMimeType: mimeDetails.originalMimeType,
    sourceBackupMimeType: mimeDetails.aliasedMimeType,
    sourceSha256,
    sourceByteLength: bytesBuffer.byteLength,
    importedAt,
    importId,
    collectionDateOrigin,
    collectionDateConfirmed: true,
  }

  const baseReport = buildReportFn(rawRows, {
    id: reportId,
    sourceFile: file.name,
    sourceFormat: fileType,
    snapshot,
    collectionDateOrigin,
    publishedAt,
    provenance,
  })

  let confirmedSourceBackup = null
  let frozenPublishedReport = null
  let frozenReportJsonText = null
  let frozenReportJsonBytes = null
  let frozenReportFile = null

  function finalizeReportWithConfirmedSource(serverConfirmedSourceName) {
    const confirmedName = String(serverConfirmedSourceName || '').trim()
    if (!confirmedName) {
      throw new Error('服务器未返回已确认的源文件备份名称。')
    }
    if (confirmedName !== expectedSourceBackupName) {
      throw new Error(`服务器返回的源备份文件名（${confirmedName}）与预期内容寻址名称（${expectedSourceBackupName}）不一致，已阻止发布报告。`)
    }
    if (frozenPublishedReport && frozenReportFile) {
      return {
        publishedReport: frozenPublishedReport,
        reportJsonText: frozenReportJsonText,
        reportJsonBytes: frozenReportJsonBytes,
        reportFile: frozenReportFile,
      }
    }
    confirmedSourceBackup = confirmedName
    const nextProvenance = Object.freeze({
      ...baseReport.provenance,
      sourceBackup: confirmedName,
    })
    frozenPublishedReport = Object.freeze({
      ...baseReport,
      sourceBackup: confirmedName,
      provenance: nextProvenance,
    })
    frozenReportJsonText = JSON.stringify(frozenPublishedReport)
    frozenReportJsonBytes = new TextEncoder().encode(frozenReportJsonText)
    frozenReportFile = new File([frozenReportJsonBytes], reportFileName, {
      type: 'application/json',
      lastModified,
    })
    return {
      publishedReport: frozenPublishedReport,
      reportJsonText: frozenReportJsonText,
      reportJsonBytes: frozenReportJsonBytes,
      reportFile: frozenReportFile,
    }
  }

  return {
    importId,
    reportId,
    reportFileName,
    originalFileName: file.name,
    fileType,
    sourceSha256,
    sourceByteLength: bytesBuffer.byteLength,
    expectedSourceBackupName,
    importedAt,
    publishedAt,
    snapshot,
    collectionDateOrigin,
    sourceBackupFile,
    baseReport,
    get confirmedSourceBackup() {
      return confirmedSourceBackup
    },
    markSourceConfirmed(serverConfirmedSourceName) {
      return finalizeReportWithConfirmedSource(serverConfirmedSourceName)
    },
    getFrozenReportArtifacts() {
      if (!confirmedSourceBackup) return null
      return finalizeReportWithConfirmedSource(confirmedSourceBackup)
    },
  }
}
