import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import path from 'node:path'

console.log('===== [TEST SUITE] Market Report Revision Retention & Collection Date Contract =====\n')

// 1. Setup lightweight DOM & globals for mounting real React 18 components via Vite SSR
const elementsRegistry = []
let makeMockElement

const mockDoc = {
  nodeType: 9,
  createElement: (tag) => makeMockElement(tag),
  createElementNS: (_ns, tag) => makeMockElement(tag),
  createComment: () => ({ nodeType: 8 }),
  createTextNode: (text) => ({ nodeType: 3, textContent: String(text ?? '') }),
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementsByClassName: (cls) =>
    elementsRegistry.filter((e) => (e.className || e.attributes.class || '').split(/\s+/).includes(cls)),
  getElementsByTagName: (tag) =>
    elementsRegistry.filter((e) => tag === '*' || e.tagName === tag.toUpperCase()),
  addEventListener: () => {},
  removeEventListener: () => {},
}

makeMockElement = (tag) => {
  const el = {
    nodeType: 1,
    tagName: String(tag).toUpperCase(),
    style: {},
    children: [],
    childNodes: [],
    attributes: {},
    setAttribute: (k, v) => {
      el.attributes[k] = String(v)
      el[k] = v
    },
    getAttribute: (k) => (k in el.attributes ? el.attributes[k] : null),
    removeAttribute: (k) => {
      delete el.attributes[k]
      delete el[k]
    },
    appendChild: (c) => {
      if (!c) return c
      delete el._textContent
      el.childNodes.push(c)
      if (c.nodeType === 1) el.children.push(c)
      c.parentNode = el
      return c
    },
    removeChild: (c) => {
      const i = el.childNodes.indexOf(c)
      if (i !== -1) el.childNodes.splice(i, 1)
      const j = el.children.indexOf(c)
      if (j !== -1) el.children.splice(j, 1)
      if (c) c.parentNode = null
      return c
    },
    insertBefore: (c, refNode) => {
      if (!c) return c
      delete el._textContent
      const idx = refNode ? el.childNodes.indexOf(refNode) : -1
      if (idx === -1) el.childNodes.push(c)
      else el.childNodes.splice(idx, 0, c)
      if (c.nodeType === 1) {
        const cIdx = refNode ? el.children.indexOf(refNode) : -1
        if (cIdx === -1) el.children.push(c)
        else el.children.splice(cIdx, 0, c)
      }
      c.parentNode = el
      return c
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    ownerDocument: mockDoc,
    parentNode: null,
    getBoundingClientRect: () => ({ width: 1366, height: 900, top: 0, left: 0, right: 1366, bottom: 900 }),
    get options() {
      return findInTree(el, (c) => c.tagName === 'OPTION')
    },
    get textContent() {
      if (el._textContent !== undefined) return el._textContent
      return el.childNodes.map((c) => c.textContent || '').join('')
    },
    set textContent(v) {
      el._textContent = String(v ?? '')
      el.childNodes = []
      el.children = []
    },
  }
  elementsRegistry.push(el)
  return el
}

const mockWin = {
  document: mockDoc,
  location: { href: 'http://localhost:5173', origin: 'http://localhost:5173', pathname: '/' },
  KUAJING_CONFIG: { apiBase: 'http://localhost:5173/api', authorized: true, nonce: 'test-nonce' },
  navigator: { userAgent: 'node-retention-test' },
  HTMLIFrameElement: class {},
  HTMLElement: class {},
  Element: class {},
  Node: class {},
  ResizeObserver: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
}

mockDoc.defaultView = mockWin
global.window = mockWin
global.document = mockDoc
try {
  Object.defineProperty(global, 'navigator', { value: mockWin.navigator, configurable: true, writable: true })
} catch {}
global.ResizeObserver = mockWin.ResizeObserver
global.getComputedStyle = mockWin.getComputedStyle

function extractDeepText(node) {
  if (!node) return ''
  if (node._textContent !== undefined) return String(node._textContent)
  if (node.nodeType === 3) return String(node.textContent || '')
  let out = ''
  for (const child of node.childNodes || []) {
    out += extractDeepText(child)
  }
  return out
}

function findInTree(root, predicate) {
  const matches = []
  function walk(node) {
    if (!node || node.nodeType !== 1) return
    if (predicate(node)) matches.push(node)
    for (const child of node.childNodes || []) walk(child)
  }
  walk(root)
  return matches
}

function findByTestId(root, testId) {
  return findInTree(root, (el) => el.attributes?.['data-testid'] === testId || el['data-testid'] === testId)[0] || null
}

function getReactProps(el) {
  if (!el) return null
  const key = Object.keys(el).find((k) => k.startsWith('__reactProps'))
  return key ? el[key] : null
}

const [ReactMod, ReactDOMClientMod, XLSXMod, ViteMod] = await Promise.all([
  import('../ozon-react/node_modules/react/index.js'),
  import('../ozon-react/node_modules/react-dom/client.js'),
  import('../ozon-react/node_modules/xlsx/xlsx.js'),
  import('../ozon-react/node_modules/vite/dist/node/index.js'),
])

const React = ReactMod.default || ReactMod
const ReactDOM = ReactDOMClientMod.default || ReactDOMClientMod
const XLSX = XLSXMod.default || XLSXMod
const { createServer } = ViteMod

const viteServer = await createServer({
  root: path.resolve('ozon-react'),
  configFile: path.resolve('ozon-react/vite.config.js'),
  server: { middlewareMode: true },
})

const [analysisMod, retentionMod, centerMod] = await Promise.all([
  viteServer.ssrLoadModule('/src/utils/marketReportAnalysis.js'),
  viteServer.ssrLoadModule('/src/utils/marketReport/retentionContract.js'),
  viteServer.ssrLoadModule('/src/components/reports/MarketReportCenter.jsx'),
])

const {
  buildUploadedMarketReport,
  isUploadedMarketReport,
  stableMarketReportId,
} = analysisMod
const {
  buildSafeSourceBackupName,
  computeSha256Hex,
  createFrozenImportAttempt,
  computeUtcAgeDays,
  extractValidFilenameDate,
  isValidCalendarDate,
  parseStrictCalendarDateUtc,
} = retentionMod
const MarketReportCenter = centerMod.default

function createWorkbookBytes(rows) {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

function makeBrowserFile(bytes, name, type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', lastModified = 1790000000000) {
  return new File([bytes], name, { type, lastModified })
}

const wait = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms))

assert.equal(parseStrictCalendarDateUtc('0001-01-01')?.getUTCFullYear(), 1)
assert.equal(parseStrictCalendarDateUtc('0099-12-31')?.getUTCFullYear(), 99)
assert.equal(parseStrictCalendarDateUtc('0100-01-01')?.getUTCFullYear(), 100)
assert.equal(isValidCalendarDate('0000-01-01'), false)
assert.equal(isValidCalendarDate('1969-12-31'), true)
assert.equal(isValidCalendarDate('2101-01-01'), true)
assert.equal(isValidCalendarDate('9999-12-31'), true)
assert.equal(isValidCalendarDate('1900-02-29'), false)
assert.equal(isValidCalendarDate('2000-02-29'), true)
assert.equal(computeUtcAgeDays(parseStrictCalendarDateUtc('0100-01-02'), parseStrictCalendarDateUtc('0100-01-01')), 1)
assert.equal(computeUtcAgeDays(parseStrictCalendarDateUtc('9999-01-02'), parseStrictCalendarDateUtc('9999-01-01')), 1)
console.log('  ✅ Gregorian year range 0001-9999, leap days, and UTC arithmetic boundaries passed')

// ============================================================================
// TEST 1 & 2: Same filename with different bytes vs same bytes in separate import + retry identity freeze
// ============================================================================
console.log('--- 1. Testing revision retention, content-addressed source backup, and retry identity freeze ---')

const batchARows = [
  { 产品名称: '阀门A1', 产品类型: '球阀', 品牌名: 'BrandA', 卖家名称: 'Shop1', SKU: 'SKU-A1', 产品链接: 'https://www.ozon.ru/product/a1', '销售额(₽)': 120000, '销量(件)': 120, '平均售价(₽)': 1000, 上架日期: '2026-08-01' },
  { 产品名称: '阀门A2', 产品类型: '球阀', 品牌名: 'без бренда', 卖家名称: 'Shop2', SKU: 'SKU-A2', 产品链接: 'https://www.ozon.ru/product/a2', '销售额(₽)': 80000, '销量(件)': 80, '平均售价(₽)': 1000, 上架日期: '2026-07-15' },
  { 产品名称: '阀门A3', 产品类型: '球阀', 品牌名: 'BrandB', 卖家名称: 'Shop3', SKU: 'SKU-A3', 产品链接: 'https://www.ozon.ru/product/a3', '销售额(₽)': 50000, '销量(件)': 50, '平均售价(₽)': 1000, 上架日期: '2025-11-01' },
]

const batchBRows = [
  { 产品名称: '阀门B1', 产品类型: '止回阀', 品牌名: 'BrandC', 卖家名称: 'Shop4', SKU: 'SKU-B1', 产品链接: 'https://www.ozon.ru/product/b1', '销售额(₽)': 310000, '销量(件)': 310, '平均售价(₽)': 1000, 上架日期: '2026-08-20' },
  { 产品名称: '阀门B2', 产品类型: '止回阀', 品牌名: 'без бренда', 卖家名称: 'Shop5', SKU: 'SKU-B2', 产品链接: 'https://www.ozon.ru/product/b2', '销售额(₽)': 190000, '销量(件)': 190, '平均售价(₽)': 1000, 上架日期: '2026-06-10' },
  { 产品名称: '阀门B3', 产品类型: '止回阀', 品牌名: 'BrandD', 卖家名称: 'Shop6', SKU: 'SKU-B3', 产品链接: 'https://www.ozon.ru/product/b3', '销售额(₽)': 90000, '销量(件)': 90, '平均售价(₽)': 1000, 上架日期: '2025-10-01' },
]

const bytesA = createWorkbookBytes(batchARows)
const bytesB = createWorkbookBytes(batchBRows)
const shaA = await computeSha256Hex(bytesA)
const shaB = await computeSha256Hex(bytesB)
assert.notEqual(shaA, shaB, 'Different workbook contents must produce distinct SHA-256 hashes')
assert.equal(shaA, crypto.createHash('sha256').update(Buffer.from(bytesA)).digest('hex'))
assert.equal(shaB, crypto.createHash('sha256').update(Buffer.from(bytesB)).digest('hex'))

// Legacy helper remains available for existing callers
assert.equal(stableMarketReportId('ozon-valves.xlsx'), stableMarketReportId('ozon-valves.xlsx'))

// Create mock server storage for MarketReportCenter
function createMockServerStorage(initialReports = []) {
  const sourceFiles = new Map() // name -> { name, bytes, type, uploadCount }
  const reportFiles = new Map() // name -> { name, bytes, json, downloadUrl }
  const uploadLog = []

  for (const rep of initialReports) {
    const name = `${rep.id}.json`
    const text = JSON.stringify(rep)
    reportFiles.set(name, {
      name,
      bytes: new TextEncoder().encode(text),
      json: JSON.parse(text),
      downloadUrl: `http://localhost:5173/mock-reports/${name}`,
    })
  }

  let failNextSource = null
  let customSourceResponseName = null
  let failNextReport = null
  let loseNextReportResponse = false

  return {
    sourceFiles,
    reportFiles,
    uploadLog,
    setFailNextSource(err) { failNextSource = err },
    setCustomSourceResponseName(name) { customSourceResponseName = name },
    setFailNextReport(err) { failNextReport = err },
    setLoseNextReportResponse(flag) { loseNextReportResponse = flag },
    adapter: {
      async listServerFiles(namespace) {
        if (namespace === 'market-report-json') {
          return Array.from(reportFiles.values()).map((f) => ({
            name: f.name,
            downloadUrl: f.downloadUrl,
          }))
        }
        return []
      },
      async fetchReportJson(fileEntry) {
        const stored = reportFiles.get(fileEntry.name)
        if (!stored) throw new Error('404 not found')
        return JSON.parse(new TextDecoder().decode(stored.bytes))
      },
      async uploadServerFile(namespace, file) {
        const buf = await file.arrayBuffer()
        const copy = new Uint8Array(buf.slice(0))
        uploadLog.push({ namespace, name: file.name, type: file.type, size: copy.byteLength, bytes: copy })

        if (namespace === 'market-report-sources') {
          if (failNextSource) {
            const err = failNextSource
            failNextSource = null
            throw err
          }
          const returnedName = customSourceResponseName || file.name
          customSourceResponseName = null
          const existing = sourceFiles.get(returnedName)
          if (existing) {
            // Verify we never overwrite a source file with different bytes!
            assert.deepEqual(
              Buffer.from(existing.bytes),
              Buffer.from(copy),
              `Content-addressed source file ${returnedName} must never be overwritten with different bytes`,
            )
            existing.uploadCount += 1
          } else {
            sourceFiles.set(returnedName, {
              name: returnedName,
              bytes: copy,
              type: file.type,
              uploadCount: 1,
            })
          }
          return {
            file: {
              name: returnedName,
              size: copy.byteLength,
              downloadUrl: `http://localhost:5173/mock-sources/${returnedName}`,
            },
          }
        }

        if (namespace === 'market-report-json') {
          if (failNextReport) {
            const err = failNextReport
            failNextReport = null
            throw err
          }
          const jsonText = new TextDecoder().decode(copy)
          const parsed = JSON.parse(jsonText)
          reportFiles.set(file.name, {
            name: file.name,
            bytes: copy,
            json: parsed,
            downloadUrl: `http://localhost:5173/mock-reports/${file.name}`,
          })
          if (loseNextReportResponse) {
            loseNextReportResponse = false
            throw new Error('Network connection lost while reading report upload response.')
          }
          return {
            file: {
              name: file.name,
              size: copy.byteLength,
              downloadUrl: `http://localhost:5173/mock-reports/${file.name}`,
            },
          }
        }
        throw new Error(`Unexpected namespace: ${namespace}`)
      },
    },
  }
}

// Legacy report fixture (Acceptance #3): old ID, no provenance, stored snapshot date
const legacyStoredReport = buildUploadedMarketReport(
  [
    { 产品名称: '旧版灯具1', 产品类型: '阅读灯', 品牌名: 'LegacyBrand', 卖家名称: 'LegacyShop', SKU: 'LEG-1', 产品链接: 'https://www.ozon.ru/product/leg1', '销售额(₽)': 45000, '销量(件)': 45, '平均售价(₽)': 1000, 上架日期: '2026-05-01' },
  ],
  {
    id: 'uploaded-997badee',
    sourceFile: 'legacy-lamps.xlsx',
    snapshot: '2026-08-01',
    publishedAt: '2026-08-02T08:00:00.000Z',
    provenance: null,
  },
)
assert.equal(legacyStoredReport.provenance, undefined, 'Legacy fixture must have no provenance object')
const legacyInitialBytes = new TextEncoder().encode(JSON.stringify(legacyStoredReport))

const mockStorage = createMockServerStorage([legacyStoredReport])

// Mount MarketReportCenter
const mountContainer = mockDoc.createElement('div')
let root = ReactDOM.createRoot(mountContainer)
root.render(React.createElement(MarketReportCenter, { storageAdapter: mockStorage.adapter }))
await wait(120)

// Import Batch A under filename "ozon-same-name.xlsx" (no date in filename)
const fileInputs = findInTree(mountContainer, (el) => el.tagName === 'INPUT' && el.attributes.type === 'file')
assert.equal(fileInputs.length, 1)
const fileA = makeBrowserFile(bytesA, 'ozon-same-name.xlsx')
await getReactProps(fileInputs[0]).onChange({ target: { files: [fileA], value: 'C:\\fakepath\\ozon-same-name.xlsx' } })
await wait(100)

// Verify confirmation step opened and NO upload happened yet!
assert.equal(mockStorage.uploadLog.length, 0, 'Selecting a file must perform zero uploads before confirmation')
const confirmPanelA = findByTestId(mountContainer, 'market-import-confirm-panel')
assert.ok(confirmPanelA, 'Import confirmation panel must appear after selecting file')
const dateInputElA = findByTestId(mountContainer, 'import-collection-date-input')
assert.equal(dateInputElA.value, '', 'Filename without a date must NOT prefill today’s date')

// Test invalid date input (e.g., empty and 2026-02-30) produces error and 0 uploads (Acceptance #5)
await getReactProps(findByTestId(mountContainer, 'import-confirm-submit')).onClick()
await wait(40)
assert.equal(mockStorage.uploadLog.length, 0, 'Submitting empty collection date without unknown checked must perform 0 uploads')
assert.ok(findByTestId(mountContainer, 'import-confirm-error'), 'Validation error must be rendered')

await getReactProps(findByTestId(mountContainer, 'import-collection-date-input')).onChange({ target: { value: '2026-02-30' } })
await wait(30)
await getReactProps(findByTestId(mountContainer, 'import-confirm-submit')).onClick()
await wait(40)
assert.equal(mockStorage.uploadLog.length, 0, 'Submitting rollover date 2026-02-30 must perform 0 uploads')
assert.match(extractDeepText(findByTestId(mountContainer, 'import-confirm-error')), /2026-02-30|无效/)

// Now enter valid collection date 2026-09-01 and confirm Batch A
await getReactProps(findByTestId(mountContainer, 'import-collection-date-input')).onChange({ target: { value: '2026-09-01' } })
await wait(30)
await getReactProps(findByTestId(mountContainer, 'import-confirm-submit')).onClick()
await wait(120)

assert.equal(mockStorage.uploadLog.length, 2, 'Confirmed import must upload source backup then report JSON')
assert.equal(mockStorage.uploadLog[0].namespace, 'market-report-sources')
assert.equal(mockStorage.uploadLog[0].name, `source-${shaA}.xlsx`)
assert.equal(mockStorage.uploadLog[1].namespace, 'market-report-json')
assert.match(mockStorage.uploadLog[1].name, /^uploaded-[0-9a-f-]{36}\.json$/)

const reportAFileName = mockStorage.uploadLog[1].name
const savedReportABytesBefore = new Uint8Array(mockStorage.reportFiles.get(reportAFileName).bytes)
const savedSourceABytesBefore = new Uint8Array(mockStorage.sourceFiles.get(`source-${shaA}.xlsx`).bytes)

// Import Batch B under the EXACT SAME filename "ozon-same-name.xlsx" with different content!
const fileB = makeBrowserFile(bytesB, 'ozon-same-name.xlsx')
await getReactProps(fileInputs[0]).onChange({ target: { files: [fileB], value: 'C:\\fakepath\\ozon-same-name.xlsx' } })
await wait(100)
await getReactProps(findByTestId(mountContainer, 'import-collection-date-input')).onChange({ target: { value: '2026-09-05' } })
await wait(30)
await getReactProps(findByTestId(mountContainer, 'import-confirm-submit')).onClick()
await wait(120)

assert.equal(mockStorage.uploadLog.length, 4)
const reportBFileName = mockStorage.uploadLog[3].name
assert.notEqual(reportAFileName, reportBFileName, 'Same original filename must produce distinct report revision IDs')
assert.equal(mockStorage.uploadLog[2].name, `source-${shaB}.xlsx`)
assert.notEqual(mockStorage.uploadLog[0].name, mockStorage.uploadLog[2].name, 'Different source bytes must produce distinct content-addressed source names')

// Verify older report A bytes and source A bytes are 100% unchanged!
assert.deepEqual(Buffer.from(mockStorage.reportFiles.get(reportAFileName).bytes), Buffer.from(savedReportABytesBefore))
assert.deepEqual(Buffer.from(mockStorage.sourceFiles.get(`source-${shaA}.xlsx`).bytes), Buffer.from(savedSourceABytesBefore))
assert.deepEqual(Buffer.from(mockStorage.reportFiles.get('uploaded-997badee.json').bytes), Buffer.from(legacyInitialBytes))

// Acceptance #2: Same source bytes (bytesA) in a separately confirmed import creates a separate report revision while keeping the same source fingerprint
const fileA2 = makeBrowserFile(bytesA, 'ozon-same-name.xlsx')
await getReactProps(fileInputs[0]).onChange({ target: { files: [fileA2], value: 'C:\\fakepath\\ozon-same-name.xlsx' } })
await wait(100)
await getReactProps(findByTestId(mountContainer, 'import-collection-date-input')).onChange({ target: { value: '2026-09-12' } })
await wait(30)
await getReactProps(findByTestId(mountContainer, 'import-confirm-submit')).onClick()
await wait(120)

const reportA2FileName = mockStorage.uploadLog[5].name
assert.notEqual(reportA2FileName, reportAFileName, 'Separate confirmed import of identical source bytes must create a new report revision ID')
assert.equal(mockStorage.uploadLog[4].name, `source-${shaA}.xlsx`, 'Identical source bytes must reuse the same content-addressed source name')
const reportAJson = mockStorage.reportFiles.get(reportAFileName).json
const reportA2Json = mockStorage.reportFiles.get(reportA2FileName).json
assert.equal(reportAJson.provenance.sourceSha256, shaA)
assert.equal(reportA2Json.provenance.sourceSha256, shaA)
assert.equal(reportAJson.snapshot, '2026-09-01')
assert.equal(reportA2Json.snapshot, '2026-09-12')

// Unmount and remount against mockStorage to verify all 4 reports (Legacy + A + B + A2) are visible and selectable (Acceptance #1, #3)
root.unmount()
elementsRegistry.length = 0
const remountContainer = mockDoc.createElement('div')
root = ReactDOM.createRoot(remountContainer)
root.render(React.createElement(MarketReportCenter, { storageAdapter: mockStorage.adapter }))
await wait(150)

// Switch to 导入报告 tab
const groupTabs = findInTree(remountContainer, (el) => el.attributes?.role === 'tab')
const uploadedTab = groupTabs.find((el) => extractDeepText(el).includes('导入报告'))
assert.ok(uploadedTab, 'Uploaded reports tab must exist')
await getReactProps(uploadedTab).onClick()
await wait(80)

for (const expectedId of [reportAJson.id, reportA2Json.id, mockStorage.reportFiles.get(reportBFileName).json.id, 'uploaded-997badee']) {
  const navBtn = findByTestId(remountContainer, `report-nav-item-${expectedId}`)
  assert.ok(navBtn, `Report revision ${expectedId} must be visible after remount`)
}

// Select legacy report and verify it renders without mutation and shows unverified snapshot origin (Acceptance #3)
const legacyNavBtn = findByTestId(remountContainer, 'report-nav-item-uploaded-997badee')
await getReactProps(legacyNavBtn).onClick()
await wait(80)
const legacyHeaderMeta = extractDeepText(findByTestId(remountContainer, 'uploaded-report-snapshot-meta'))
assert.match(legacyHeaderMeta, /2026-08-01/)
assert.match(legacyHeaderMeta, /未核验/, 'Legacy report without provenance must state its snapshot origin is unverified')
assert.deepEqual(
  Buffer.from(mockStorage.reportFiles.get('uploaded-997badee.json').bytes),
  Buffer.from(legacyInitialBytes),
  'Selecting and rendering legacy report must not mutate its stored bytes',
)
console.log('  ✅ 1 & 2 & 3. Same filename revisions, identical source re-import, remount visibility, and legacy compatibility passed')

// ============================================================================
// TEST 4 & 5: Collection date unknown, dated filename prefill, explicit unknown override, cancel, and 0/180/181-day boundaries
// ============================================================================
console.log('--- 2. Testing collection-date truthfulness, unknown state, cancel, and 0/180/181-day boundaries ---')

// 5a: Cancel before confirmation performs zero uploads
const uploadCountBeforeCancel = mockStorage.uploadLog.length
const datedFile = makeBrowserFile(bytesA, 'ozon-2026-09-10阀门.xlsx')
const remountFileInputs = findInTree(remountContainer, (el) => el.tagName === 'INPUT' && el.attributes.type === 'file')
await getReactProps(remountFileInputs[0]).onChange({ target: { files: [datedFile], value: 'C:\\fakepath\\ozon-2026-09-10阀门.xlsx' } })
await wait(100)

// Verify valid filename date prefilled input
assert.equal(findByTestId(remountContainer, 'import-collection-date-input').value, '2026-09-10')
assert.match(extractDeepText(findByTestId(remountContainer, 'import-date-origin-hint')), /filename/)

// Click Cancel
await getReactProps(findByTestId(remountContainer, 'import-confirm-cancel')).onClick()
await wait(60)
assert.equal(mockStorage.uploadLog.length, uploadCountBeforeCancel, 'Canceling import confirmation must perform zero uploads')
assert.equal(findByTestId(remountContainer, 'market-import-confirm-panel'), null, 'Confirmation panel must close on cancel')

// 5b: Dated filename with explicit "collection date unknown" checked suppresses filename fallback!
await getReactProps(remountFileInputs[0]).onChange({ target: { files: [datedFile], value: 'C:\\fakepath\\ozon-2026-09-10阀门.xlsx' } })
await wait(100)
await getReactProps(findByTestId(remountContainer, 'import-date-unknown-checkbox')).onChange({ target: { checked: true } })
await wait(40)
await getReactProps(findByTestId(remountContainer, 'import-confirm-submit')).onClick()
await wait(120)

const unknownReportEntry = mockStorage.reportFiles.get(mockStorage.uploadLog[mockStorage.uploadLog.length - 1].name).json
assert.equal(unknownReportEntry.snapshot, null, 'Explicit unknown must store snapshot: null even when filename has a valid date')
assert.equal(unknownReportEntry.collectionDateOrigin, 'unknown')
assert.equal(unknownReportEntry.provenance.collectionDateOrigin, 'unknown')
assert.equal(unknownReportEntry.marketDimensions.newness.status, 'not_evaluated')
assert.equal(unknownReportEntry.marketDimensions.newness.freshCount, null)
assert.equal(unknownReportEntry.marketDimensions.newness.freshRevenueShare, null)
assert.equal(unknownReportEntry.quality.freshProductCount, null)
assert.equal(unknownReportEntry.russiaEntry.cohortComparison.status, 'not_evaluated')
assert.equal(unknownReportEntry.russiaEntry.cohortComparison.fresh.rows, null)
assert.equal(unknownReportEntry.russiaEntry.cohortComparison.mature.rows, null)
assert.ok(unknownReportEntry.topProducts.every((p) => p.ageDays === null), 'All topProducts ageDays must be null when snapshot is unknown')
for (const opp of unknownReportEntry.russiaEntry.typeOpportunities) {
  assert.equal(opp.freshCount, null)
  assert.equal(opp.freshRevenueShare, null)
  assert.equal(opp.scoreParts.newness, null, 'Unknown collection date must not award a newness score')
  assert.ok(opp.evidenceCoverage <= 80, 'Unknown collection date must not grant 100% full evidence coverage')
}

// Check rendered DOM for unknown collection date report (Acceptance #4)
const renderedUnknownText = extractDeepText(remountContainer)
assert.match(renderedUnknownText, /未评估（缺采集日）/, 'MarketDecisionBrief must render 未评估（缺采集日） for 180-day fresh count')
assert.ok(findByTestId(remountContainer, 'new-products-not-evaluated'), 'New products section must render not-evaluated notice')
assert.doesNotMatch(renderedUnknownText, /180 天内新品 0 个/, 'Must never render "180 天内新品 0 个" when collection date is unknown')

// 5c: Exact 0 / 180 / 181 / future day boundaries in UTC
// Snapshot: 2026-09-10
// - 2026-09-10 -> 0 days (included in fresh)
// - 2026-03-14 -> 180 days before 2026-09-10 (included in fresh: March has 31-14=17, Apr 30, May 31, Jun 30, Jul 31, Aug 31, Sep 10 => 17+30+31+30+31+31+10 = 180)
// - 2026-03-13 -> 181 days before 2026-09-10 (excluded from fresh, included in mature)
// - 2026-09-11 -> -1 days (future listing date, excluded from fresh & mature, counted in futureListingDateCount)
// - null -> missing listing date
const boundaryRows = [
  { 产品名称: 'Day0', 产品类型: '测试品', SKU: 'B-0', 产品链接: 'https://www.ozon.ru/product/b0', '销售额(₽)': 1000, '销量(件)': 10, '平均售价(₽)': 100, 上架日期: '2026-09-10' },
  { 产品名称: 'Day180', 产品类型: '测试品', SKU: 'B-180', 产品链接: 'https://www.ozon.ru/product/b180', '销售额(₽)': 2000, '销量(件)': 20, '平均售价(₽)': 100, 上架日期: '2026-03-14' },
  { 产品名称: 'Day181', 产品类型: '测试品', SKU: 'B-181', 产品链接: 'https://www.ozon.ru/product/b181', '销售额(₽)': 4000, '销量(件)': 40, '平均售价(₽)': 100, 上架日期: '2026-03-13' },
  { 产品名称: 'FutureDay', 产品类型: '测试品', SKU: 'B-FUT', 产品链接: 'https://www.ozon.ru/product/bfut', '销售额(₽)': 8000, '销量(件)': 80, '平均售价(₽)': 100, 上架日期: '2026-09-11' },
  { 产品名称: 'MissingDate', 产品类型: '测试品', SKU: 'B-MISS', 产品链接: 'https://www.ozon.ru/product/bmiss', '销售额(₽)': 16000, '销量(件)': 160, '平均售价(₽)': 100, 上架日期: null },
]
const boundaryReport = buildUploadedMarketReport(boundaryRows, {
  sourceFile: 'boundary.xlsx',
  snapshot: '2026-09-10',
  collectionDateOrigin: 'user',
})
assert.equal(boundaryReport.snapshot, '2026-09-10')
assert.equal(boundaryReport.collectionDateOrigin, 'user')
assert.equal(boundaryReport.marketDimensions.newness.freshCount, 2, 'Only Day 0 and Day 180 must be included in 180-day fresh count')
assert.equal(boundaryReport.russiaEntry.cohortComparison.fresh.rows, 2)
assert.equal(boundaryReport.russiaEntry.cohortComparison.mature.rows, 1, 'Day 181 must be in mature cohort')
assert.equal(boundaryReport.quality.futureListingDateCount, 1, 'Listing after snapshot must be reported in futureListingDateCount')
assert.equal(boundaryReport.quality.listingDateCoverage, 60, '3 valid non-future listing dates out of 5 rows = 60% coverage')
assert.deepEqual(
  boundaryReport.newProducts.map((p) => ({ name: p.name, ageDays: p.ageDays })),
  [
    { name: 'Day180', ageDays: 180 },
    { name: 'Day0', ageDays: 0 },
  ],
)
console.log('  ✅ 4 & 5. Unknown date propagation, cancel, dated filename override, and 0/180/181/future boundaries passed')

// ============================================================================
// TEST 6: Repeated SKU/URL aggregation preservation and duplicate warning
// ============================================================================
console.log('--- 3. Testing repeated SKU/URL row preservation and uncertainty warning (Acceptance #6) ---')

const duplicateSkuRows = [
  { 产品名称: '同SKU周期1', 产品类型: '密封条', 品牌名: 'SealPro', 卖家名称: '店铺A', SKU: 'DUP-SKU-900', 产品链接: 'https://www.ozon.ru/product/dup900', '销售额(₽)': 150000, '销量(件)': 300, '平均售价(₽)': 500, 上架日期: '2026-07-01' },
  { 产品名称: '同SKU周期2或店铺B', 产品类型: '密封条', 品牌名: 'SealPro', 卖家名称: '店铺B', SKU: 'DUP-SKU-900', 产品链接: 'https://www.ozon.ru/product/dup900', '销售额(₽)': 250000, '销量(件)': 500, '平均售价(₽)': 500, 上架日期: '2026-07-01' },
  { 产品名称: '独立SKU', 产品类型: '密封条', 品牌名: 'SealPro', 卖家名称: '店铺A', SKU: 'UNI-SKU-901', 产品链接: 'https://www.ozon.ru/product/uni901', '销售额(₽)': 100000, '销量(件)': 200, '平均售价(₽)': 500, 上架日期: '2026-06-01' },
]
const dupBytes = createWorkbookBytes(duplicateSkuRows)
const dupFile = makeBrowserFile(dupBytes, 'ozon-2026-09-10密封条.xlsx')
await getReactProps(remountFileInputs[0]).onChange({ target: { files: [dupFile], value: 'C:\\fakepath\\ozon-2026-09-10密封条.xlsx' } })
await wait(100)
await getReactProps(findByTestId(remountContainer, 'import-confirm-submit')).onClick()
await wait(120)

const dupReportJson = mockStorage.reportFiles.get(mockStorage.uploadLog[mockStorage.uploadLog.length - 1].name).json
assert.equal(dupReportJson.kpis.rowCount, 3, 'Repeated SKU rows must NOT be deduplicated')
assert.equal(dupReportJson.kpis.totalRevenue, 500000, 'Revenue must be summed across all rows without dropping duplicates')
assert.equal(dupReportJson.kpis.totalSales, 1000, 'Sales must be summed across all rows without dropping duplicates')
assert.equal(dupReportJson.quality.duplicateSku, 1)
assert.equal(dupReportJson.quality.duplicateUrl, 1)
assert.ok(dupReportJson.quality.duplicateIdentityWarning.includes('按导入行直接汇总'))
assert.ok(findByTestId(remountContainer, 'uploaded-report-duplicate-warning'), 'UploadedMarketReport must display duplicate identity warning')
assert.ok(findByTestId(remountContainer, 'decision-brief-duplicate-warning'), 'MarketDecisionBrief must display duplicate identity warning')
console.log('  ✅ 6. Repeated SKU/URL aggregation preservation and UI warnings passed')

// ============================================================================
// TEST 7: Source failure/queue pending, source mismatch, source ok + report failure + retry, and lost response + refresh
// ============================================================================
console.log('--- 4. Testing failure/queue states, frozen retry reuse, and refresh reconciliation (Acceptance #7) ---')

const retryRows = [
  { 产品名称: '重试商品1', 产品类型: '工具箱', 品牌名: 'ToolX', 卖家名称: 'ShopX', SKU: 'TX-1', 产品链接: 'https://www.ozon.ru/product/tx1', '销售额(₽)': 88000, '销量(件)': 88, '平均售价(₽)': 1000, 上架日期: '2026-08-10' },
  { 产品名称: '重试商品2', 产品类型: '工具箱', 品牌名: 'ToolX', 卖家名称: 'ShopX', SKU: 'TX-2', 产品链接: 'https://www.ozon.ru/product/tx2', '销售额(₽)': 66000, '销量(件)': 66, '平均售价(₽)': 1000, 上架日期: '2026-08-12' },
  { 产品名称: '重试商品3', 产品类型: '工具箱', 品牌名: 'ToolX', 卖家名称: 'ShopX', SKU: 'TX-3', 产品链接: 'https://www.ozon.ru/product/tx3', '销售额(₽)': 44000, '销量(件)': 44, '平均售价(₽)': 1000, 上架日期: '2026-01-10' },
]
const retryBytes = createWorkbookBytes(retryRows)
const retrySha = await computeSha256Hex(retryBytes)
const retryFile = makeBrowserFile(retryBytes, 'ozon-2026-09-15工具箱.xlsx')

// 7a: Source upload queued / deferred -> report upload must NOT run, UI shows pending banner, retains attempt
mockStorage.setFailNextSource(new Error('Source file backup is queued and will retry automatically.'))
const countBefore7a = mockStorage.uploadLog.length
await getReactProps(remountFileInputs[0]).onChange({ target: { files: [retryFile], value: 'C:\\fakepath\\ozon-2026-09-15工具箱.xlsx' } })
await wait(100)
await getReactProps(findByTestId(remountContainer, 'import-confirm-submit')).onClick()
await wait(120)

assert.equal(mockStorage.uploadLog.length, countBefore7a + 1, 'When source upload is queued/fails, report upload must NOT be called')
assert.equal(mockStorage.uploadLog[mockStorage.uploadLog.length - 1].namespace, 'market-report-sources')
const statusAfter7a = extractDeepText(findByTestId(remountContainer, 'publish-status-message'))
assert.match(statusAfter7a, /等待队列确认/)
assert.match(statusAfter7a, /未上传报告 JSON/)
const pendingBanner7a = findByTestId(remountContainer, 'pending-attempt-banner')
assert.ok(pendingBanner7a, 'Pending attempt banner must be visible')

// 7b: Retry when source succeeds, but report upload fails -> source is confirmed, report fails, same attempt is kept
mockStorage.setFailNextReport(new Error('Server 503 during report upload'))
await getReactProps(findByTestId(remountContainer, 'retry-frozen-attempt-btn')).onClick()
await wait(120)

assert.equal(mockStorage.uploadLog.length, countBefore7a + 3, 'Retry #1 uploads source (now confirmed) and attempts report upload')
const failedReportUploadCall = mockStorage.uploadLog[mockStorage.uploadLog.length - 1]
assert.equal(failedReportUploadCall.namespace, 'market-report-json')
const frozenReportName = failedReportUploadCall.name
const frozenReportBytesFirstTry = new Uint8Array(failedReportUploadCall.bytes)
const statusAfter7b = extractDeepText(findByTestId(remountContainer, 'publish-status-message'))
assert.match(statusAfter7b, /源文件备份.*已确认.*报告版本.*尚未获服务器确认/)

// 7c: Retry #2 succeeds -> reuses already-confirmed source and uploads the EXACT same report ID, timestamp, and JSON bytes!
await getReactProps(findByTestId(remountContainer, 'retry-frozen-attempt-btn')).onClick()
await wait(120)

assert.equal(mockStorage.uploadLog.length, countBefore7a + 4, 'Retry #2 after source confirmation only needs to upload the frozen report JSON')
const succeededReportUploadCall = mockStorage.uploadLog[mockStorage.uploadLog.length - 1]
assert.equal(succeededReportUploadCall.name, frozenReportName, 'Retry must reuse the exact same report revision filename/ID')
assert.deepEqual(
  Buffer.from(succeededReportUploadCall.bytes),
  Buffer.from(frozenReportBytesFirstTry),
  'Retry must send byte-for-byte identical report JSON payload (frozen ID, timestamps, and provenance)',
)
assert.equal(findByTestId(remountContainer, 'pending-attempt-banner'), null, 'Pending banner must clear after server confirmation')
const confirmedRetryReport = mockStorage.reportFiles.get(frozenReportName).json
assert.equal(confirmedRetryReport.sourceBackup, `source-${retrySha}.xlsx`)
assert.equal(confirmedRetryReport.provenance.sourceBackup, `source-${retrySha}.xlsx`)

// 7d: Report response loss (server saved the file, but client saw network error) + Refresh reconciles the pending attempt
const lostResponseFile = makeBrowserFile(retryBytes, 'ozon-2026-09-16工具箱复测.xlsx')
mockStorage.setLoseNextReportResponse(true)
await getReactProps(remountFileInputs[0]).onChange({ target: { files: [lostResponseFile], value: 'C:\\fakepath\\ozon-2026-09-16工具箱复测.xlsx' } })
await wait(100)
await getReactProps(findByTestId(remountContainer, 'import-confirm-submit')).onClick()
await wait(120)

assert.ok(findByTestId(remountContainer, 'pending-attempt-banner'), 'Lost report response must keep pending banner before server confirmation')
await getReactProps(findByTestId(remountContainer, 'refresh-server-reports-btn')).onClick()
await wait(120)
assert.equal(findByTestId(remountContainer, 'pending-attempt-banner'), null, 'Refreshing server reports must reconcile the completed pending attempt')
assert.match(extractDeepText(findByTestId(remountContainer, 'publish-status-message')), /服务器已确认/)

// 7e: Source response name mismatch is rejected before any report upload
const mismatchFile = makeBrowserFile(retryBytes, 'ozon-2026-09-17防篡改.xlsx')
mockStorage.setCustomSourceResponseName('source-wrong-unverified-file.xlsx')
const countBefore7e = mockStorage.uploadLog.length
await getReactProps(remountFileInputs[0]).onChange({ target: { files: [mismatchFile], value: 'C:\\fakepath\\ozon-2026-09-17防篡改.xlsx' } })
await wait(100)
await getReactProps(findByTestId(remountContainer, 'import-confirm-submit')).onClick()
await wait(120)

assert.equal(mockStorage.uploadLog.length, countBefore7e + 1, 'Mismatched source backup name must abort before report upload')
assert.match(extractDeepText(findByTestId(remountContainer, 'publish-status-message')), /不一致/)

root.unmount()
await viteServer.close()

console.log('  ✅ 7 & 8. Source/report failure states, frozen retry payload identity, refresh reconciliation, and source verification passed')
console.log('\n🎉 [PASS] All market report retention and collection-date truthfulness tests passed!\n')
process.exit(0)
