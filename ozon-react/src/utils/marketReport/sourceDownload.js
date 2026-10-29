import { computeSha256Hex } from './retentionContract.js'

function expectedSourceName(report) {
  const rootName = String(report?.sourceBackup || '').trim()
  const provenanceName = String(report?.provenance?.sourceBackup || '').trim()
  if (!rootName && !provenanceName) {
    throw new Error('此历史报告未记录源文件备份，无法下载原始文件。')
  }
  if (rootName && provenanceName && rootName !== provenanceName) {
    throw new Error('报告中的源备份名称记录不一致，已阻止下载以免关联到错误文件。')
  }
  return rootName || provenanceName
}

export async function fetchReportSource(report, {
  listFiles,
  fetchImpl = globalThis.fetch,
  origin = globalThis.location?.origin,
  signal,
} = {}) {
  const sourceName = expectedSourceName(report)
  if (typeof listFiles !== 'function') throw new Error('源文件列表服务不可用，请稍后重试。')
  const files = await listFiles('market-report-sources')
  const matches = (Array.isArray(files) ? files : []).filter((file) => file?.name === sourceName)
  if (matches.length !== 1) {
    throw new Error(matches.length ? '服务器返回了重复的源备份记录，已阻止下载。' : `服务器中找不到精确源备份“${sourceName}”，请刷新报告后重试。`)
  }

  const rawDownloadUrl = matches[0].downloadUrl
  if (typeof rawDownloadUrl !== 'string' || !rawDownloadUrl.trim()) {
    throw new Error('服务器未提供有效的源文件下载地址。')
  }
  let url
  try {
    url = new URL(rawDownloadUrl.trim(), globalThis.location?.href || origin)
  } catch {
    throw new Error('服务器未提供有效的源文件下载地址。')
  }
  if (!['http:', 'https:'].includes(url.protocol) || !origin || url.origin !== origin) {
    throw new Error('源文件下载地址不属于当前站点，已阻止跨站请求。')
  }
  if (typeof fetchImpl !== 'function') throw new Error('当前环境无法下载源文件，请稍后重试。')
  const response = await fetchImpl(url.href, { credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal })
  if (!response.ok) throw new Error(`源文件下载失败（HTTP ${response.status}），请刷新后重试。`)
  const bytes = await response.arrayBuffer()
  const provenance = report.provenance || {}
  const hasDigestMetadata = provenance.sourceSha256 != null || provenance.sourceByteLength != null
  if (hasDigestMetadata) {
    if (!/^[0-9a-f]{64}$/iu.test(String(provenance.sourceSha256 || ''))
      || !Number.isSafeInteger(provenance.sourceByteLength)
      || provenance.sourceByteLength < 0) {
      throw new Error('报告中的源文件校验信息不完整，已阻止下载。')
    }
    if (bytes.byteLength !== provenance.sourceByteLength) {
      throw new Error(`源文件长度校验失败（预期 ${provenance.sourceByteLength} 字节，收到 ${bytes.byteLength} 字节），未保存文件。`)
    }
    const actualHash = await computeSha256Hex(bytes)
    if (actualHash.toLowerCase() !== provenance.sourceSha256.toLowerCase()) {
      throw new Error('源文件 SHA-256 校验失败，未保存文件。')
    }
  }
  return {
    bytes,
    fileName: String(provenance.originalFileName || report.sourceFile || sourceName),
    verified: hasDigestMetadata,
    sourceName,
  }
}

export function saveSourceBytes({ bytes, fileName, mimeType = 'application/octet-stream' }) {
  const blob = new Blob([bytes], { type: mimeType })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fileName
  anchor.hidden = true
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}
