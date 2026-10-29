import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

const EVIDENCE_DIR = path.resolve('docs/ai-handoff/KJ-GEMINI-20261022-MARKET-RETENTION-003/evidence')
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

// Parse multipart/form-data body to extract uploaded file field
function parseMultipartFile(bodyBuf, contentTypeHeader) {
  const match = String(contentTypeHeader || '').match(/boundary=(?:"([^"]+)"|([^;]+))/i)
  if (!match) throw new Error(`Missing multipart boundary in ${contentTypeHeader}`)
  const boundary = match[1] || match[2]
  const rawLatin1 = bodyBuf.toString('latin1')
  const parts = rawLatin1.split(`--${boundary}`)
  for (const part of parts) {
    if (!part.includes('Content-Disposition')) continue
    const headerEnd = part.indexOf('\r\n\r\n')
    if (headerEnd === -1) continue
    const headerText = part.slice(0, headerEnd)
    const filenameMatch = headerText.match(/filename="([^"]+)"/i)
    const typeMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i)
    let contentLatin1 = part.slice(headerEnd + 4)
    if (contentLatin1.endsWith('\r\n')) {
      contentLatin1 = contentLatin1.slice(0, -2)
    }
    const fileBytes = Buffer.from(contentLatin1, 'latin1')
    return {
      filename: filenameMatch ? Buffer.from(filenameMatch[1], 'latin1').toString('utf8') : 'unknown',
      contentType: typeMatch ? typeMatch[1].trim() : 'application/octet-stream',
      bytes: fileBytes,
    }
  }
  throw new Error('No file part found in multipart upload')
}

const ViteMod = await import('../../../../ozon-react/node_modules/vite/dist/node/index.js')
const { createServer: createViteServer } = ViteMod
const { buildUploadedMarketReport } = await import('../../../../ozon-react/src/utils/marketReportAnalysis.js')

// Seed a legacy report without provenance
const legacySeedReport = buildUploadedMarketReport(
  [
    {
      产品名称: 'Legacy Lamp A',
      产品类型: '阅读台灯',
      品牌名: 'OldLamp',
      卖家名称: 'OldStore',
      SKU: 'LEG-LAMP-01',
      产品链接: 'https://www.ozon.ru/product/leg-lamp-01',
      '销售额(₽)': 64000,
      '销量(件)': 64,
      '平均售价(₽)': 1000,
      上架日期: '2026-05-10',
    },
  ],
  {
    id: 'uploaded-997badee',
    sourceFile: 'legacy-lamps.json',
    snapshot: '2026-08-01',
    publishedAt: '2026-08-01T10:00:00.000Z',
    provenance: null,
  },
)

const storedSources = new Map()
const storedReports = new Map()
const apiRequestLog = []
let failNextReportUploadCount = 0

const legacyBytes = Buffer.from(JSON.stringify(legacySeedReport), 'utf8')
storedReports.set('uploaded-997badee.json', {
  name: 'uploaded-997badee.json',
  bytes: legacyBytes,
  sha256: sha256Hex(legacyBytes),
})

const OZON_REACT_DIR = path.resolve('ozon-react')
process.chdir(OZON_REACT_DIR)

const vite = await createViteServer({
  root: OZON_REACT_DIR,
  configFile: path.join(OZON_REACT_DIR, 'vite.config.js'),
  server: { middlewareMode: true },
  plugins: [
    {
      name: 'retention-harness-entry',
      resolveId(id) {
        if (id === '/@retention-harness.jsx') return id
        return null
      },
      load(id) {
        if (id === '/@retention-harness.jsx') {
          return `
            import React from 'react';
            import ReactDOM from 'react-dom/client';
            import '/src/index.css';
            import MarketReportCenter from '/src/components/reports/MarketReportCenter.jsx';
            ReactDOM.createRoot(document.getElementById('root')).render(
              React.createElement(MarketReportCenter)
            );
          `
        }
        return null
      },
    },
  ],
})

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`)
  const pathname = urlObj.pathname

  // Serve mock report JSON downloads
  if (pathname.startsWith('/mock-download/report/')) {
    const fileName = decodeURIComponent(pathname.replace('/mock-download/report/', ''))
    const entry = storedReports.get(fileName)
    if (!entry) {
      res.writeHead(404)
      res.end('Not found')
      return
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(entry.bytes)
    return
  }

  // Handle local mock /api/files/:namespace
  if (pathname.startsWith('/api/files/')) {
    const namespace = decodeURIComponent(pathname.replace('/api/files/', ''))
    if (req.method === 'GET') {
      apiRequestLog.push({ method: 'GET', url: req.url, namespace, timestamp: new Date().toISOString() })
      if (namespace === 'market-report-json') {
        const files = Array.from(storedReports.values()).map((item) => ({
          name: item.name,
          size: item.bytes.byteLength,
          downloadUrl: `http://${req.headers.host}/mock-download/report/${encodeURIComponent(item.name)}`,
        }))
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ files }))
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ files: [] }))
      return
    }

    if (req.method === 'POST') {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const bodyBuf = Buffer.concat(chunks)
      const parsedFile = parseMultipartFile(bodyBuf, req.headers['content-type'])
      const fileSha256 = sha256Hex(parsedFile.bytes)

      if (namespace === 'market-report-sources') {
        storedSources.set(parsedFile.filename, {
          name: parsedFile.filename,
          contentType: parsedFile.contentType,
          bytes: parsedFile.bytes,
          sha256: fileSha256,
        })
        apiRequestLog.push({
          method: 'POST',
          namespace,
          filename: parsedFile.filename,
          contentType: parsedFile.contentType,
          byteLength: parsedFile.bytes.byteLength,
          sha256: fileSha256,
          status: 200,
          timestamp: new Date().toISOString(),
        })
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            file: {
              name: parsedFile.filename,
              size: parsedFile.bytes.byteLength,
              downloadUrl: `http://${req.headers.host}/mock-download/source/${encodeURIComponent(parsedFile.filename)}`,
            },
          }),
        )
        return
      }

      if (namespace === 'market-report-json') {
        const reportJson = JSON.parse(parsedFile.bytes.toString('utf8'))
        if (failNextReportUploadCount > 0) {
          failNextReportUploadCount -= 1
          apiRequestLog.push({
            method: 'POST',
            namespace,
            filename: parsedFile.filename,
            contentType: parsedFile.contentType,
            byteLength: parsedFile.bytes.byteLength,
            sha256: fileSha256,
            reportId: reportJson.id,
            publishedAt: reportJson.publishedAt,
            snapshot: reportJson.snapshot,
            sourceBackup: reportJson.sourceBackup,
            status: 503,
            timestamp: new Date().toISOString(),
          })
          res.writeHead(503, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Simulated 503 report upload interruption' }))
          return
        }

        storedReports.set(parsedFile.filename, {
          name: parsedFile.filename,
          bytes: parsedFile.bytes,
          sha256: fileSha256,
          json: reportJson,
        })
        apiRequestLog.push({
          method: 'POST',
          namespace,
          filename: parsedFile.filename,
          contentType: parsedFile.contentType,
          byteLength: parsedFile.bytes.byteLength,
          sha256: fileSha256,
          reportId: reportJson.id,
          publishedAt: reportJson.publishedAt,
          snapshot: reportJson.snapshot,
          collectionDateOrigin: reportJson.collectionDateOrigin,
          sourceBackup: reportJson.sourceBackup,
          provenance: reportJson.provenance,
          status: 200,
          timestamp: new Date().toISOString(),
        })
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            file: {
              name: parsedFile.filename,
              size: parsedFile.bytes.byteLength,
              downloadUrl: `http://${req.headers.host}/mock-download/report/${encodeURIComponent(parsedFile.filename)}`,
            },
          }),
        )
        return
      }
    }
  }

  if (pathname.startsWith('/api/state')) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ entries: {}, saved: {} }))
    return
  }

  // Serve dedicated harness HTML mounting MarketReportCenter directly with full Tailwind styles
  if (pathname === '/' || pathname === '/index.html' || pathname === '/harness') {
    const rawHtml = `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MarketReportCenter Retention Browser Harness</title>
    <script>window.KUAJING_CONFIG = { apiBase: window.location.origin + '/api', authorized: true, nonce: 'harness-nonce' };</script>
  </head>
  <body class="bg-gray-50 p-4">
    <div id="root" class="fyzsxnb-kuajing-root"></div>
    <script type="module" src="/@retention-harness.jsx"></script>
  </body>
</html>`
    const transformed = await vite.transformIndexHtml('/index.html', rawHtml)
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(transformed)
    return
  }

  vite.middlewares(req, res)
})

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
const appUrl = `http://127.0.0.1:${port}/`
console.log(`Local Vite + Mock API server listening at ${appUrl}`)

// Create two synthetic JSON files with the SAME filename "ozon-same-batch.json" in temp subdirs
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ozon-retention-harness-'))
const dirBatch1 = path.join(tmpRoot, 'batch1')
const dirBatch2 = path.join(tmpRoot, 'batch2')
fs.mkdirSync(dirBatch1, { recursive: true })
fs.mkdirSync(dirBatch2, { recursive: true })

const batch1Data = [
  { 产品名称: '冬季防冻雨刮器 60cm (周期1)', 产品类型: '无骨雨刮', 品牌名: 'NordWipe', 卖家名称: 'AutoShopA', SKU: 'WIPER-600', 产品链接: 'https://www.ozon.ru/product/wiper-600', '销售额(₽)': 280000, '销量(件)': 560, '平均售价(₽)': 500, '下单转化率(%)': 0.06, '无库存天数(近28天)': 4, '商品体积(升)': 0.8, 上架日期: '2026-07-01' },
  { 产品名称: '冬季防冻雨刮器 60cm (周期2/变体)', 产品类型: '无骨雨刮', 品牌名: 'NordWipe', 卖家名称: 'AutoShopB', SKU: 'WIPER-600', 产品链接: 'https://www.ozon.ru/product/wiper-600', '销售额(₽)': 170000, '销量(件)': 340, '平均售价(₽)': 500, '下单转化率(%)': 0.05, '无库存天数(近28天)': 3, '商品体积(升)': 0.8, 上架日期: '2026-07-01' },
  { 产品名称: '冬季后窗雨刮 35cm', 产品类型: '无骨雨刮', 品牌名: 'без бренда', 卖家名称: 'AutoShopC', SKU: 'WIPER-350', 产品链接: 'https://www.ozon.ru/product/wiper-350', '销售额(₽)': 150000, '销量(件)': 500, '平均售价(₽)': 300, '下单转化率(%)': 0.07, '无库存天数(近28天)': 6, '商品体积(升)': 0.5, 上架日期: '2025-11-15' },
]

const batch2Data = [
  { 产品名称: '车载保温电热杯 12V/24V', 产品类型: '车载电器', 品牌名: 'ThermoCar', 卖家名称: 'ElectroShop1', SKU: 'CUP-12V-01', 产品链接: 'https://www.ozon.ru/product/cup-12v-01', '销售额(₽)': 420000, '销量(件)': 420, '平均售价(₽)': 1000, '下单转化率(%)': 0.08, '无库存天数(近28天)': 5, '商品体积(升)': 1.1, 上架日期: '2026-08-10' },
  { 产品名称: '车载加热坐垫垫片', 产品类型: '车载电器', 品牌名: 'без бренда', 卖家名称: 'ElectroShop2', SKU: 'PAD-12V-02', 产品链接: 'https://www.ozon.ru/product/pad-12v-02', '销售额(₽)': 310000, '销量(件)': 620, '平均售价(₽)': 500, '下单转化率(%)': 0.07, '无库存天数(近28天)': 7, '商品体积(升)': 1.4, 上架日期: '2026-06-20' },
  { 产品名称: '点烟器一拖三扩展坞', 产品类型: '车载电器', 品牌名: 'VoltPlus', 卖家名称: 'ElectroShop3', SKU: 'HUB-12V-03', 产品链接: 'https://www.ozon.ru/product/hub-12v-03', '销售额(₽)': 190000, '销量(件)': 380, '平均售价(₽)': 500, '下单转化率(%)': 0.05, '无库存天数(近28天)': 2, '商品体积(升)': 0.4, 上架日期: '2025-12-01' },
]

const file1Path = path.join(dirBatch1, 'ozon-same-batch.json')
const file2Path = path.join(dirBatch2, 'ozon-same-batch.json')
fs.writeFileSync(file1Path, JSON.stringify(batch1Data, null, 2), 'utf8')
fs.writeFileSync(file2Path, JSON.stringify(batch2Data, null, 2), 'utf8')
const file1Bytes = fs.readFileSync(file1Path)
const file2Bytes = fs.readFileSync(file2Path)
const file1Sha256 = sha256Hex(file1Bytes)
const file2Sha256 = sha256Hex(file2Bytes)

// Launch headless Chrome with remote debugging
const userDataDir = path.join(tmpRoot, 'chrome-profile')
const chromeProc = spawn(
  CHROME_PATH,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${userDataDir}`,
    '--remote-debugging-port=0',
    '--window-size=1366,900',
    'about:blank',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] },
)

const wsEndpoint = await new Promise((resolve, reject) => {
  let stderrAcc = ''
  const timer = setTimeout(() => reject(new Error(`Timed out waiting for Chrome DevTools WS: ${stderrAcc}`)), 15000)
  chromeProc.stderr.on('data', (chunk) => {
    stderrAcc += chunk.toString()
    const m = stderrAcc.match(/DevTools listening on (ws:\/\/[^\r\n]+)/)
    if (m) {
      clearTimeout(timer)
      resolve(m[1])
    }
  })
})

const devToolsPort = new URL(wsEndpoint).port
const targetsRes = await fetch(`http://127.0.0.1:${devToolsPort}/json/list`)
const targets = await targetsRes.json()
const pageTarget = targets.find((t) => t.type === 'page')
assert.ok(pageTarget?.webSocketDebuggerUrl, 'Could not find Chrome page target')

const ws = new WebSocket(pageTarget.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true })
  ws.addEventListener('error', reject, { once: true })
})

let nextMsgId = 1
const pendingCdp = new Map()
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data)
  if (msg.id && pendingCdp.has(msg.id)) {
    const { resolve, reject } = pendingCdp.get(msg.id)
    pendingCdp.delete(msg.id)
    if (msg.error) reject(new Error(JSON.stringify(msg.error)))
    else resolve(msg.result)
  }
})

function cdp(method, params = {}) {
  const id = nextMsgId++
  return new Promise((resolve, reject) => {
    pendingCdp.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  const res = await cdp('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (res.exceptionDetails) {
    throw new Error(`Browser eval error: ${JSON.stringify(res.exceptionDetails)}`)
  }
  return res.result?.value
}

async function setViewport(width, height, mobile = false) {
  await cdp('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  })
  await new Promise((r) => setTimeout(r, 250))
}

async function captureScreenshot(fileName) {
  const shot = await cdp('Page.captureScreenshot', { format: 'png' })
  const outPath = path.join(EVIDENCE_DIR, fileName)
  fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'))
  return outPath
}

await cdp('Page.enable')
await cdp('Runtime.enable')
await cdp('DOM.enable')
await setViewport(1366, 900, false)

await cdp('Page.navigate', { url: `${appUrl}harness` })
for (let i = 0; i < 40; i += 1) {
  const ready = await evaluate(`Boolean(document.querySelector('[data-testid="trigger-import-file-btn"]'))`)
  if (ready) break
  await new Promise((r) => setTimeout(r, 200))
}

// Set file #1 on MarketReportCenter's <input type="file" accept=".xlsx,.xls,.csv,.json">
const docRoot = await cdp('DOM.getDocument', { depth: -1 })
const inputNode = await cdp('DOM.querySelector', {
  nodeId: docRoot.root.nodeId,
  selector: 'input[type="file"][accept=".xlsx,.xls,.csv,.json"]',
})
assert.ok(inputNode?.nodeId, 'File input must exist in MarketReportCenter')
await cdp('DOM.setFileInputFiles', {
  nodeId: inputNode.nodeId,
  files: [file1Path],
})
await new Promise((r) => setTimeout(r, 600))

// Verify confirmation panel is open and zero uploads happened yet
const confirmVisible = await evaluate(`Boolean(document.querySelector('[data-testid="market-import-confirm-panel"]'))`)
assert.equal(confirmVisible, true, 'Import confirmation panel must be visible in Chrome')
assert.equal(
  apiRequestLog.filter((r) => r.method === 'POST').length,
  0,
  'Zero POST uploads before confirmation',
)

// Test invalid rollover calendar date 2026-02-30 in real browser
await evaluate(`(() => {
  const input = document.querySelector('[data-testid="import-collection-date-input"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '2026-02-30');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('[data-testid="import-confirm-submit"]').click();
})()`)
await new Promise((r) => setTimeout(r, 300))

const invalidDateErrorText = await evaluate(`document.querySelector('[data-testid="import-confirm-error"]')?.textContent || ''`)
assert.match(invalidDateErrorText, /2026-02-30|无效/)
assert.equal(
  apiRequestLog.filter((r) => r.method === 'POST').length,
  0,
  'Invalid calendar date 2026-02-30 must produce zero POST uploads',
)

// Capture Desktop (1366x900) and Narrow (390x844) screenshots of Confirmation Step
await setViewport(1366, 900, false)
const desktopConfirmOverflow = await evaluate(`({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth })`)
await captureScreenshot('confirm-step-desktop-1366x900.png')

await setViewport(390, 844, true)
const narrowConfirmOverflow = await evaluate(`({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth })`)
await captureScreenshot('confirm-step-narrow-390x844.png')

// Now enter valid date 2026-09-05 and confirm Batch 1
await setViewport(1366, 900, false)
await evaluate(`(() => {
  const input = document.querySelector('[data-testid="import-collection-date-input"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '2026-09-05');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('[data-testid="import-confirm-submit"]').click();
})()`)
await new Promise((r) => setTimeout(r, 800))

assert.equal(apiRequestLog.filter((r) => r.method === 'POST').length, 2, 'Batch 1 must upload source then report')

// Now select Batch 2 (same filename "ozon-same-batch.json", different bytes), select "collection date unknown", and simulate a 503 report failure across uploadServerFile's 2 internal attempts
failNextReportUploadCount = 2
const docRoot2 = await cdp('DOM.getDocument', { depth: -1 })
const inputNode2 = await cdp('DOM.querySelector', {
  nodeId: docRoot2.root.nodeId,
  selector: 'input[type="file"][accept=".xlsx,.xls,.csv,.json"]',
})
await cdp('DOM.setFileInputFiles', {
  nodeId: inputNode2.nodeId,
  files: [file2Path],
})
await new Promise((r) => setTimeout(r, 600))

await evaluate(`(() => {
  const cb = document.querySelector('[data-testid="import-date-unknown-checkbox"]');
  cb.click();
})()`)
await new Promise((r) => setTimeout(r, 200))
await evaluate(`document.querySelector('[data-testid="import-confirm-submit"]').click()`)
await new Promise((r) => setTimeout(r, 600))

// Verify pending retry banner is visible
const pendingBannerVisible = await evaluate(`Boolean(document.querySelector('[data-testid="pending-attempt-banner"]'))`)
assert.equal(pendingBannerVisible, true, 'Pending retry banner must appear when report upload returns 503')

// Capture Desktop (1366x900) and Narrow (390x844) screenshots of Pending Retry state
await setViewport(1366, 900, false)
await captureScreenshot('pending-retry-desktop-1366x900.png')
await setViewport(390, 844, true)
await captureScreenshot('pending-retry-narrow-390x844.png')

// Click Retry button and verify it reuses the exact same reportId, publishedAt, and payload bytes
await setViewport(1366, 900, false)
await evaluate(`document.querySelector('[data-testid="retry-frozen-attempt-btn"]').click()`)
await new Promise((r) => setTimeout(r, 800))

const reportPostLogsBatch2 = apiRequestLog.filter(
  (r) => r.method === 'POST' && r.namespace === 'market-report-json' && r.snapshot === null,
)
assert.ok(reportPostLogsBatch2.length >= 3, 'Batch 2 report POSTs must include initial failed attempts and successful retry')
const firstFailedBatch2 = reportPostLogsBatch2[0]
const finalSucceededBatch2 = reportPostLogsBatch2[reportPostLogsBatch2.length - 1]
assert.equal(firstFailedBatch2.status, 503)
assert.equal(finalSucceededBatch2.status, 200)
assert.equal(firstFailedBatch2.filename, finalSucceededBatch2.filename, 'Retry must reuse exact same report filename/ID')
assert.equal(firstFailedBatch2.sha256, finalSucceededBatch2.sha256, 'Retry must send byte-for-byte identical report JSON payload')
assert.equal(firstFailedBatch2.publishedAt, finalSucceededBatch2.publishedAt, 'Retry must preserve frozen publishedAt timestamp')

// Reload the browser page to verify persistence and remount behavior
await cdp('Page.reload', { ignoreCache: true })
for (let i = 0; i < 40; i += 1) {
  const ready = await evaluate(`Boolean(document.querySelector('[data-testid="trigger-import-file-btn"]'))`)
  if (ready) break
  await new Promise((r) => setTimeout(r, 200))
}
await new Promise((r) => setTimeout(r, 400))

await evaluate(`(() => {
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  const uploadedTab = tabs.find(t => (t.textContent || '').includes('导入报告'));
  if (uploadedTab) uploadedTab.click();
})()`)
await new Promise((r) => setTimeout(r, 600))

// Verify all 3 uploaded reports (Batch 2 unknown date, Batch 1 with duplicate warning, and Legacy report) are listed after reload
const navItemCount = await evaluate(`document.querySelectorAll('[data-testid^="report-nav-item-uploaded-"]').length`)
assert.equal(navItemCount, 3, 'All 3 uploaded report revisions must be visible after browser reload')

// Capture Desktop (1366x900) and Narrow (390x844) screenshots of Reloaded Unknown-Date Revision
await setViewport(1366, 900, false)
const desktopReloadedOverflow = await evaluate(`({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth })`)
await captureScreenshot('reloaded-revisions-desktop-1366x900.png')

await setViewport(390, 844, true)
const narrowReloadedOverflow = await evaluate(`({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth })`)
await captureScreenshot('reloaded-revisions-narrow-390x844.png')

// Also click Batch 1 revision to verify duplicate warning in browser DOM
await setViewport(1366, 900, false)
await evaluate(`(() => {
  const items = Array.from(document.querySelectorAll('[data-testid^="report-nav-item-uploaded-"]'));
  const batch1Btn = items.find(el => (el.textContent || '').includes('2026-09-05'));
  if (batch1Btn) batch1Btn.click();
})()`)
await new Promise((r) => setTimeout(r, 500))
const dupWarningText = await evaluate(`document.querySelector('[data-testid="uploaded-report-duplicate-warning"]')?.textContent || ''`)
assert.match(dupWarningText, /按导入行直接汇总/)
await captureScreenshot('duplicate-warning-desktop-1366x900.png')

const evidenceSummary = {
  executedAt: new Date().toISOString(),
  browser: CHROME_PATH,
  syntheticFixtures: [
    {
      batch: 'batch1',
      originalFileName: 'ozon-same-batch.json',
      byteLength: file1Bytes.byteLength,
      sha256: file1Sha256,
      expectedSourceBackupName: `source-${file1Sha256}.json`,
    },
    {
      batch: 'batch2',
      originalFileName: 'ozon-same-batch.json',
      byteLength: file2Bytes.byteLength,
      sha256: file2Sha256,
      expectedSourceBackupName: `source-${file2Sha256}.json`,
    },
  ],
  viewportChecks: {
    desktopConfirmOverflow,
    narrowConfirmOverflow,
    desktopReloadedOverflow,
    narrowReloadedOverflow,
  },
  frozenRetryComparison: {
    firstAttemptReportFile: firstFailedBatch2.filename,
    retryAttemptReportFile: finalSucceededBatch2.filename,
    firstAttemptSha256: firstFailedBatch2.sha256,
    retryAttemptSha256: finalSucceededBatch2.sha256,
    firstAttemptPublishedAt: firstFailedBatch2.publishedAt,
    retryAttemptPublishedAt: finalSucceededBatch2.publishedAt,
    identicalPayloadVerified: firstFailedBatch2.sha256 === finalSucceededBatch2.sha256,
  },
  apiRequestLog,
  screenshots: [
    'confirm-step-desktop-1366x900.png',
    'confirm-step-narrow-390x844.png',
    'pending-retry-desktop-1366x900.png',
    'pending-retry-narrow-390x844.png',
    'reloaded-revisions-desktop-1366x900.png',
    'reloaded-revisions-narrow-390x844.png',
    'duplicate-warning-desktop-1366x900.png',
  ],
}

const fixturesDir = path.join(EVIDENCE_DIR, 'fixtures')
fs.mkdirSync(fixturesDir, { recursive: true })
fs.copyFileSync(file1Path, path.join(fixturesDir, 'batch1-ozon-same-batch.json'))
fs.copyFileSync(file2Path, path.join(fixturesDir, 'batch2-ozon-same-batch.json'))
const batch2StoredReport = storedReports.get(finalSucceededBatch2.filename)
if (batch2StoredReport?.bytes) {
  fs.writeFileSync(path.join(fixturesDir, 'frozen-retry-payload.json'), batch2StoredReport.bytes)
}

fs.writeFileSync(
  path.join(EVIDENCE_DIR, 'browser-request-payload-evidence.json'),
  JSON.stringify(evidenceSummary, null, 2),
  'utf8',
)

await cdp('Browser.close').catch(() => {})
ws.close()
chromeProc.kill()
server.close()
await vite.close()
await new Promise((r) => setTimeout(r, 300))
try {
  fs.rmSync(tmpRoot, { recursive: true, force: true })
} catch {}

console.log('Browser harness completed and saved screenshots + request/payload evidence!')
process.exit(0)
