import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { fetchReportSource } from '../ozon-react/src/utils/marketReport/sourceDownload.js'

const bytesA = new TextEncoder().encode('synthetic batch A')
const bytesB = new TextEncoder().encode('synthetic batch B')
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const response = (bytes, status = 200) => ({ ok: status >= 200 && status < 300, status, arrayBuffer: async () => bytes.slice().buffer })
const origin = 'https://reports.example.test'
const report = (sourceBackup, bytes, extra = {}) => ({
  id: `uploaded-${sourceBackup}`,
  sourceBackup,
  sourceFile: 'same-name.csv',
  provenance: {
    originalFileName: 'same-name.csv',
    sourceBackup,
    sourceSha256: hash(bytes),
    sourceByteLength: bytes.byteLength,
  },
  ...extra,
})

const files = [
  { name: 'source-a.csv', downloadUrl: `${origin}/download/a` },
  { name: 'source-b.csv', downloadUrl: `${origin}/download/b` },
]
const fetched = []
const fetchImpl = async (url, options) => {
  fetched.push({ url, options })
  return response(url.endsWith('/a') ? bytesA : bytesB)
}
const listFiles = async (namespace) => {
  assert.equal(namespace, 'market-report-sources')
  return files
}

const downloadA = await fetchReportSource(report('source-a.csv', bytesA), { listFiles, fetchImpl, origin })
const downloadB = await fetchReportSource(report('source-b.csv', bytesB), { listFiles, fetchImpl, origin })
assert.equal(new TextDecoder().decode(downloadA.bytes), 'synthetic batch A')
assert.equal(new TextDecoder().decode(downloadB.bytes), 'synthetic batch B')
assert.equal(downloadA.fileName, 'same-name.csv')
assert.equal(downloadA.verified, true)
assert.equal(fetched[0].options.credentials, 'same-origin')
assert.equal(fetched[0].options.redirect, 'error')

const legacy = await fetchReportSource({ sourceFile: 'legacy.csv', sourceBackup: 'old.csv' }, {
  listFiles: async () => [{ name: 'old.csv', downloadUrl: `${origin}/old` }],
  fetchImpl: async () => response(bytesA),
  origin,
})
assert.equal(legacy.verified, false)
assert.equal(legacy.fileName, 'legacy.csv')

await assert.rejects(fetchReportSource({ sourceBackup: 'other' }, { listFiles, fetchImpl, origin }), /找不到精确源备份/u)
await assert.rejects(fetchReportSource({ sourceBackup: 'source-a.csv', provenance: { sourceBackup: 'source-b.csv' } }, { listFiles, fetchImpl, origin }), /记录不一致/u)
await assert.rejects(fetchReportSource({ sourceBackup: 'source-a.csv' }, {
  listFiles: async () => [files[0], files[0]], fetchImpl, origin,
}), /重复/u)
await assert.rejects(fetchReportSource(report('source-a.csv', bytesA, { provenance: { sourceBackup: 'source-a.csv', sourceSha256: hash(bytesA), sourceByteLength: bytesA.byteLength + 1 } }), { listFiles, fetchImpl, origin }), /长度校验失败/u)
await assert.rejects(fetchReportSource(report('source-a.csv', bytesB), { listFiles, fetchImpl, origin }), /SHA-256 校验失败/u)
await assert.rejects(fetchReportSource({ sourceBackup: 'source-a.csv' }, {
  listFiles: async () => [{ name: 'source-a.csv', downloadUrl: 'https://attacker.example/file' }],
  fetchImpl, origin,
}), /跨站/u)
for (const downloadUrl of [undefined, null, '', '   ', 42]) {
  await assert.rejects(fetchReportSource({ sourceBackup: 'source-a.csv' }, {
    listFiles: async () => [{ name: 'source-a.csv', downloadUrl }],
    fetchImpl, origin,
  }), /未提供有效的源文件下载地址/u)
}
await assert.rejects(fetchReportSource({ sourceBackup: 'source-a.csv' }, {
  listFiles, origin, fetchImpl: async () => response(new ArrayBuffer(0), 503),
}), /HTTP 503/u)

let retries = 0
const retryFetch = async () => {
  retries += 1
  return retries === 1 ? response(new ArrayBuffer(0), 503) : response(bytesA)
}
await assert.rejects(fetchReportSource(report('source-a.csv', bytesA), {
  listFiles,
  origin,
  fetchImpl: retryFetch,
}), /HTTP 503/u)
const retried = await fetchReportSource(report('source-a.csv', bytesA), { listFiles, origin, fetchImpl: retryFetch })
assert.equal(new TextDecoder().decode(retried.bytes), 'synthetic batch A')
assert.equal(retries, 2)

console.log('PASS market-report-source-download: exact binding, integrity, legacy, origin and retry failures')
