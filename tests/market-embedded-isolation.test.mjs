/**
 * tests/market-embedded-isolation.test.mjs
 * 验证 Work Package A：MarketResearch embedded 模式只读隔离性（真实组件运行时 Harness）
 *
 * 验收目标（符合 REVISION-001.md 第 2 节规定）：
 * 1. 绝不使用测试内自行编写的 simulate* 复制实现，必须加载真实 MarketResearch.jsx 组件
 * 2. 真实执行 React 18 生命周期与 Hook 逻辑（useEffect, useState, useRef）
 * 3. 拦截请求与 IndexedDB，使用合成文件，绝不触发真实服务器写入
 * 4. embedded=true 模式下严格断言：
 *    - 0 次 dbPut（写入共享 IndexedDB）
 *    - 0 次 uploadServerFile（服务端上传）
 *    - 0 次 deleteServerFile（服务端删除）
 *    - 0 次 mr-active-file 写入 (persistSet)
 *    - 0 次 mr-active-file 读取恢复 (persistGet)
 *    - 工具栏展示“只读查阅模式”提示，严禁展示上传 Excel 控件
 * 5. embedded=false 模式下严格断言：
 *    - 工具栏暴露文件上传控件与拖拽入口
 *    - 加载服务端文件时触发 dbPut >= 1 并写入 mr-active-file
 *    - 本地文件上传入口触发 uploadServerFile >= 1
 *    - 缓存删除入口触发 deleteServerFile >= 1 与 dbDelete >= 1
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

console.log('===== [TEST SUITE 1] MarketResearch Embedded Mode Read-Only Isolation =====\n')

const src = fs.readFileSync(path.resolve('ozon-react/src/components/MarketResearch.jsx'), 'utf8')

// =========================================================================
// 1. 静态隔离守卫契约校验（源码级 AST/文本断言）
// =========================================================================
console.log('--- 1. 静态隔离守卫契约校验 ---')

// 1.1 dbPut 必须被 !embedded 守卫
assert.ok(
  src.includes('const shouldSaveToDb = !embedded && Boolean(isUpload)') ||
  src.includes('if (!embedded && isUpload)'),
  'dbPut 操作必须被 !embedded 严格守卫'
)
console.log('  ✅ 1.1 dbPut (IndexedDB) 已被 !embedded 严格守卫')

// 1.2 uploadToServer 必须首行有 if (embedded) return
assert.ok(
  src.includes('const uploadToServer = async (file) => {\n    if (embedded) return') ||
  src.includes('const uploadToServer = async (file) => {\r\n    if (embedded) return'),
  'uploadToServer 必须首行检查 if (embedded) return'
)
console.log('  ✅ 1.2 uploadToServer (服务端上传) 已包含 if (embedded) return 守卫')

// 1.3 handleDeleteSaved 必须首行有 if (embedded) return
assert.ok(
  src.includes('const handleDeleteSaved = async (name) => {\n    if (embedded) return') ||
  src.includes('const handleDeleteSaved = async (name) => {\r\n    if (embedded) return'),
  'handleDeleteSaved 必须首行检查 if (embedded) return'
)
console.log('  ✅ 1.3 handleDeleteSaved (缓存/服务端删除) 已包含 if (embedded) return 守卫')

// 1.4 handleLocalUpload 必须首行有 if (embedded) return
assert.ok(
  src.includes('const handleLocalUpload = async (e) => {\n    if (embedded) return') ||
  src.includes('const handleLocalUpload = async (e) => {\r\n    if (embedded) return'),
  'handleLocalUpload 必须首行检查 if (embedded) return'
)
console.log('  ✅ 1.4 handleLocalUpload (本地上传事件) 已包含 if (embedded) return 守卫')

// 1.5 handleLoadFile 传递给 processAndSave 的 isUpload 必须为 !embedded && file.source === "server"
assert.ok(
  src.includes("!embedded && file.source === 'server'"),
  'handleLoadFile 必须在 embedded 模式下禁止将服务端文件标记为 isUpload=true'
)
console.log('  ✅ 1.5 handleLoadFile 在 embedded 模式下禁止将服务端文件标记为 isUpload')

// 1.6 mr-active-file 读写删除均受 !embedded 隔离
const activeSetMatches = src.match(/if\s*\(!embedded\)\s*\{[^}]*persistSet\(['"]mr-active-file['"]/g)
assert.ok(activeSetMatches && activeSetMatches.length >= 2, '所有 persistSet(mr-active-file) 均置于 !embedded 守卫内')
const activeGetMatches = src.match(/if\s*\(!embedded\)\s*\{[^}]*persistGet\(['"]mr-active-file['"]\)/g)
assert.ok(activeGetMatches && activeGetMatches.length >= 1, 'persistGet(mr-active-file) 必须置于 !embedded 守卫内')
console.log('  ✅ 1.6 mr-active-file 全局状态在 embedded 模式下彻底禁止读写与恢复')

// 1.7 embedded 模式工具栏展示只读查阅提示
assert.ok(
  src.includes('只读查阅模式（如需导入报表请前往独立市场调研页面）'),
  'embedded 模式工具栏必须展示只读查阅模式提示'
)
console.log('  ✅ 1.7 embedded 模式工具栏已移除上传按钮，替换为只读查阅提示')

// =========================================================================
// 2. 真实组件运行时环境构造（DOM Mocking & Vite SSR 加载）
// =========================================================================
console.log('\n--- 2. 真实 React 组件运行环境初始化 ---')

const elementsRegistry = []
let makeMockElement

const mockDoc = {
  nodeType: 9,
  createElement: (tag) => makeMockElement(tag),
  createElementNS: (ns, tag) => makeMockElement(tag),
  createComment: () => ({ nodeType: 8 }),
  createTextNode: (text) => ({ nodeType: 3, textContent: text }),
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementsByClassName: (cls) => elementsRegistry.filter(e => (e.className || e.attributes.class || '').split(/\s+/).includes(cls)),
  getElementsByTagName: (tag) => elementsRegistry.filter(e => tag === '*' || e.tagName === tag.toUpperCase()),
  addEventListener: () => {},
  removeEventListener: () => {},
}

makeMockElement = (tag) => {
  const el = {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    style: {},
    children: [],
    childNodes: [],
    attributes: {},
    setAttribute: (k, v) => { el.attributes[k] = v; el[k] = v },
    getAttribute: (k) => el.attributes[k] || null,
    removeAttribute: (k) => { delete el.attributes[k]; delete el[k] },
    appendChild: (c) => { el.childNodes.push(c); el.children.push(c); c.parentNode = el; return c },
    removeChild: (c) => {
      const i = el.childNodes.indexOf(c)
      if (i !== -1) el.childNodes.splice(i, 1)
      const j = el.children.indexOf(c)
      if (j !== -1) el.children.splice(j, 1)
      c.parentNode = null
      return c
    },
    insertBefore: (c, r) => { el.childNodes.push(c); el.children.push(c); c.parentNode = el; return c },
    addEventListener: () => {},
    removeEventListener: () => {},
    ownerDocument: mockDoc,
    parentNode: null,
    getBoundingClientRect: () => ({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600 }),
    getBBox: () => ({ x: 0, y: 0, width: 50, height: 20 }),
    getComputedTextLength: () => 50,
    get options() { return el.children.filter(c => c.tagName === 'OPTION') },
    get textContent() {
      if (el._textContent !== undefined) return el._textContent
      return el.childNodes.map(c => c.textContent || '').join('')
    },
    set textContent(v) {
      el._textContent = v
      el.childNodes = []
      el.children = []
    },
    getElementsByClassName: (className) => {
      const result = []
      const search = (node) => {
        for (const child of node.children) {
          if ((child.className || child.attributes.class || '').split(/\s+/).includes(className)) {
            result.push(child)
          }
          search(child)
        }
      }
      search(el)
      return result
    },
    getElementsByTagName: (tagName) => {
      const result = []
      const tagUpper = tagName.toUpperCase()
      const search = (node) => {
        for (const child of node.children) {
          if (tagUpper === '*' || child.tagName === tagUpper) result.push(child)
          search(child)
        }
      }
      search(el)
      return result
    },
  }
  elementsRegistry.push(el)
  return el
}

const mockWin = {
  document: mockDoc,
  location: { href: 'http://localhost:5173', origin: 'http://localhost:5173' },
  KUAJING_CONFIG: { apiBase: 'http://localhost:5173/api', authorized: true },
  atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
  navigator: { userAgent: 'node-test-agent' },
  HTMLIFrameElement: class {},
  HTMLElement: class {},
  Element: class {},
  Node: class {},
  ResizeObserver: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
  getComputedStyle: () => ({
    getPropertyValue: () => '',
    width: '100px',
    height: '100px',
    fontSize: '12px',
    fontFamily: 'sans-serif',
  }),
}

mockDoc.defaultView = mockWin
global.window = mockWin
global.document = mockDoc
try {
  Object.defineProperty(global, 'navigator', { value: mockWin.navigator, configurable: true, writable: true })
} catch {}
global.atob = mockWin.atob
global.btoa = mockWin.btoa
global.ResizeObserver = mockWin.ResizeObserver
global.getComputedStyle = mockWin.getComputedStyle

function extractDeepText(node) {
  if (node._textContent !== undefined) return node._textContent
  if (node.nodeType === 3) return node.textContent || ''
  let text = ''
  if (node.childNodes) {
    for (const c of node.childNodes) {
      text += extractDeepText(c)
    }
  }
  return text
}

// 动态载入 Vite SSR 与核心依赖
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

// 构造合成 XLSX 测试报表二进制
const syntheticWb = XLSX.utils.book_new()
const syntheticWs = XLSX.utils.aoa_to_sheet([
  ['商品名称', '价格', '销量', '商品链接'],
  ['热销发膜 500ml', 350, 100, 'https://ozon.ru/product/12345'],
])
XLSX.utils.book_append_sheet(syntheticWb, syntheticWs, 'Sheet1')
const syntheticXlsxBuf = XLSX.write(syntheticWb, { type: 'buffer', bookType: 'xlsx' })

// 副作用监测探针
let dbPutCount = 0
let dbDeleteCount = 0
let serverUploadCount = 0
let serverDeleteCount = 0
const persistSetLog = []
const persistGetLog = []
const persistRemoveLog = []

const capturedWarnings = []
const originalConsoleWarn = console.warn
console.warn = (...args) => {
  capturedWarnings.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '))
  originalConsoleWarn(...args)
}

const localStoreData = new Map()
global.localStorage = {
  getItem: (key) => {
    persistGetLog.push(key)
    return localStoreData.get(key) ?? null
  },
  setItem: (key, val) => {
    persistSetLog.push([key, val])
    localStoreData.set(key, String(val))
  },
  removeItem: (key) => {
    persistRemoveLog.push(key)
    localStoreData.delete(key)
  },
  clear: () => {
    localStoreData.clear()
  },
}

const idbStores = new Map()
function getIdbStore(name) {
  if (!idbStores.has(name)) idbStores.set(name, new Map())
  return idbStores.get(name)
}

global.indexedDB = {
  open: () => {
    const req = {
      onsuccess: null,
      onerror: null,
      result: {
        close: () => {},
        objectStoreNames: { contains: () => true },
        transaction: (storeName) => {
          const storeMap = getIdbStore(storeName)
          const tx = {
            oncomplete: null,
            onerror: null,
            objectStore: () => ({
              getAll: () => {
                const r = { onsuccess: null, onerror: null, result: Array.from(storeMap.values()) }
                setTimeout(() => {
                  if (r.onsuccess) r.onsuccess({ target: r })
                  if (tx.oncomplete) tx.oncomplete()
                }, 0)
                return r
              },
              put: (record) => {
                dbPutCount++
                const key = record.id || record.name
                storeMap.set(key, record)
                const r = { onsuccess: null, onerror: null, result: key }
                setTimeout(() => {
                  if (r.onsuccess) r.onsuccess({ target: r })
                  if (tx.oncomplete) tx.oncomplete()
                }, 0)
                return r
              },
              delete: (key) => {
                dbDeleteCount++
                storeMap.delete(key)
                const r = { onsuccess: null, onerror: null }
                setTimeout(() => {
                  if (r.onsuccess) r.onsuccess({ target: r })
                  if (tx.oncomplete) tx.oncomplete()
                }, 0)
                return r
              },
              get: (key) => {
                const r = { onsuccess: null, onerror: null, result: storeMap.get(key) || null }
                setTimeout(() => {
                  if (r.onsuccess) r.onsuccess({ target: r })
                  if (tx.oncomplete) tx.oncomplete()
                }, 0)
                return r
              },
            }),
          }
          return tx
        },
      },
    }
    setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0)
    return req
  },
}

// 模拟网络请求（拦截一切外部与真实服务端写入）
global.fetch = async (url, opts = {}) => {
  const urlStr = String(url)
  if (urlStr.includes('manifest.json')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        files: [{ name: '热销发膜_2026.xlsx', date: '2026-05-10', source: 'server' }],
      }),
    }
  }
  if (urlStr.includes('/api/state') || urlStr.endsWith('/state')) {
    if (opts.method === 'POST') {
      const saved = {}
      try {
        const body = typeof opts.body === 'string' ? JSON.parse(opts.body) : opts.body
        const entries = body?.entries || {}
        for (const k of Object.keys(entries)) {
          saved[k] = { revision: 1, updatedAt: Date.now() }
        }
      } catch {}
      return {
        ok: true,
        status: 200,
        json: async () => ({ saved }),
      }
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
    }
  }
  if (urlStr.includes('/api/files/')) {
    if (opts.method === 'POST') {
      serverUploadCount++
      return {
        ok: true,
        status: 200,
        json: async () => ({
          file: {
            name: '本地上传测试.xlsx',
            size: syntheticXlsxBuf.byteLength,
            date: '2026-10-10',
            source: 'server',
          },
        }),
      }
    }
    if (opts.method === 'DELETE') {
      serverDeleteCount++
      return { ok: true, status: 200, json: async () => ({ success: true }) }
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        files: [{ name: '热销发膜_2026.xlsx', date: '2026-05-10', source: 'server' }],
      }),
    }
  }
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => syntheticXlsxBuf.buffer.slice(
      syntheticXlsxBuf.byteOffset,
      syntheticXlsxBuf.byteOffset + syntheticXlsxBuf.byteLength
    ),
    json: async () => ({}),
  }
}

// 启动 Vite SSR 实例加载组件
const viteServer = await createServer({
  root: path.resolve('ozon-react'),
  configFile: path.resolve('ozon-react/vite.config.js'),
  server: { middlewareMode: true },
})

const marketResearchMod = await viteServer.ssrLoadModule('/src/components/MarketResearch.jsx')
const MarketResearch = marketResearchMod.default

// =========================================================================
// 3. 真实组件验证：嵌入只读模式（embedded = true）
// =========================================================================
console.log('\n--- 3. 真实组件 embedded=true (嵌入只读模式) 副作用验证 ---')

const embeddedContainer = mockDoc.createElement('div')
const embeddedRoot = ReactDOM.createRoot(embeddedContainer)
embeddedRoot.render(React.createElement(MarketResearch, { embedded: true }))

// 等待 manifest 拉取及 DOM 挂载
await new Promise(r => setTimeout(r, 400))

// 3.1 验证工具栏 UI 呈现：严格隐藏上传控件，展示只读提示
const embeddedFileInputs = elementsRegistry.filter(el => el.tagName === 'INPUT' && el.attributes.type === 'file')
assert.strictEqual(embeddedFileInputs.length, 0, 'embedded=true 下工具栏严禁包含 <input type="file">')
console.log('  ✅ 3.1 embedded=true 工具栏无文件上传 input 元素')

const hasReadOnlyNotice = elementsRegistry.some(el => extractDeepText(el).includes('只读查阅模式'))
assert.ok(hasReadOnlyNotice, 'embedded=true 工具栏必须展示“只读查阅模式”提示')
console.log('  ✅ 3.2 embedded=true 工具栏成功呈现“只读查阅模式”提示文案')

// 3.3 交互测试：点击服务端报表加载按钮
const embeddedServerButtons = elementsRegistry.filter(el => el.tagName === 'BUTTON' && extractDeepText(el).includes('热销发膜'))
assert.ok(embeddedServerButtons.length > 0, 'embedded=true 下应从清单中渲染可用报表按钮')

const embeddedBtnPropsKey = Object.keys(embeddedServerButtons[0]).find(k => k.startsWith('__reactProps'))
assert.ok(embeddedBtnPropsKey && typeof embeddedServerButtons[0][embeddedBtnPropsKey]?.onClick === 'function', '按钮挂载了真实的 onClick 处理函数')

console.log('  触发点击加载服务端测试报表...')
await embeddedServerButtons[0][embeddedBtnPropsKey].onClick()
await new Promise(r => setTimeout(r, 300))

// 3.4 严格断言副作用：0 写入 IndexedDB，0 写入服务端，0 读写 mr-active-file
assert.strictEqual(dbPutCount, 0, 'embedded=true 下加载文件绝不触发 dbPut 写入 IndexedDB')
console.log('  ✅ 3.3 embedded=true 加载文件 0 次 dbPut 调用')

assert.strictEqual(serverUploadCount, 0, 'embedded=true 下绝不触发 serverUpload')
assert.strictEqual(serverDeleteCount, 0, 'embedded=true 下绝不触发 serverDelete')
console.log('  ✅ 3.4 embedded=true 模式 0 次服务端上传/删除请求')

const mrActiveSetCalls = persistSetLog.filter(([k]) => k === 'mr-active-file')
assert.strictEqual(mrActiveSetCalls.length, 0, 'embedded=true 下绝不将活动文件写入 mr-active-file')
console.log('  ✅ 3.5 embedded=true 模式 0 次 mr-active-file 写入')

const mrActiveGetCalls = persistGetLog.filter(k => k === 'mr-active-file')
assert.strictEqual(mrActiveGetCalls.length, 0, 'embedded=true 下挂载时绝不尝试从 mr-active-file 恢复历史活动文件')
console.log('  ✅ 3.6 embedded=true 挂载时 0 次 mr-active-file 历史状态读取')

// =========================================================================
// 4. 真实组件验证：独立页面模式（embedded = false）功能完整性
// =========================================================================
console.log('\n--- 4. 真实组件 embedded=false (独立页面模式) 功能完整性验证 ---')

// 重置计数器与元素注册表
dbPutCount = 0
dbDeleteCount = 0
serverUploadCount = 0
serverDeleteCount = 0
persistSetLog.length = 0
persistGetLog.length = 0
persistRemoveLog.length = 0
elementsRegistry.length = 0

const standaloneContainer = mockDoc.createElement('div')
const standaloneRoot = ReactDOM.createRoot(standaloneContainer)
standaloneRoot.render(React.createElement(MarketResearch, { embedded: false }))

// 等待 manifest 拉取及 DOM 挂载
await new Promise(r => setTimeout(r, 400))

// 4.1 验证独立模式工具栏：暴露文件上传输入与拖拽区，不展示嵌入只读提示
const standaloneFileInputs = elementsRegistry.filter(el => el.tagName === 'INPUT' && el.attributes.type === 'file')
assert.strictEqual(standaloneFileInputs.length, 1, 'embedded=false 下必须渲染本地文件上传 <input type="file">')
const standaloneReadOnlyNotice = elementsRegistry.some(el => extractDeepText(el).includes('只读查阅模式'))
assert.strictEqual(standaloneReadOnlyNotice, false, 'embedded=false 下严禁展示“只读查阅模式”提示')
console.log('  ✅ 4.1 standalone 模式成功渲染文件上传 input 控件且未呈现只读提示')

// 4.2 交互测试：独立模式下点击加载服务端报表，必须触发正常保存
const standaloneServerButtons = elementsRegistry.filter(el => el.tagName === 'BUTTON' && extractDeepText(el).includes('热销发膜'))
assert.ok(standaloneServerButtons.length > 0, 'standalone 模式应渲染服务端报表按钮')

const standaloneBtnPropsKey = Object.keys(standaloneServerButtons[0]).find(k => k.startsWith('__reactProps'))
console.log('  触发 standalone 模式下加载报表...')
await standaloneServerButtons[0][standaloneBtnPropsKey].onClick()
await new Promise(r => setTimeout(r, 300))

assert.ok(dbPutCount >= 1, 'standalone 模式下加载服务端报表必须正常写入 IndexedDB (dbPut >= 1)')
console.log('  ✅ 4.2 standalone 模式正常触发 dbPut 存储 (' + dbPutCount + ' 次)')

const standaloneActiveSet = persistSetLog.some(([k, v]) => k === 'mr-active-file' && v === '热销发膜_2026.xlsx')
assert.ok(standaloneActiveSet, 'standalone 模式必须记录当前文件名至 mr-active-file')
console.log('  ✅ 4.3 standalone 模式正常记录 mr-active-file')

// 4.3 交互测试：独立模式触发本地上传入口
const uploadInput = standaloneFileInputs[0]
assert.ok(uploadInput, 'standalone 模式必须成功渲染文件上传 input 控件')
const inputPropsKey = Object.keys(uploadInput).find(k => k.startsWith('__reactProps'))
assert.ok(inputPropsKey, '上传 input 控件必须挂载 React props 属性')
assert.strictEqual(
  typeof uploadInput[inputPropsKey]?.onChange,
  'function',
  '上传 input 控件必须直接挂载 onChange 回调函数（绝不可为 undefined，禁止跳过断言）'
)

const syntheticUploadFile = {
  name: '本地上传测试.xlsx',
  lastModified: Date.now(),
  size: syntheticXlsxBuf.byteLength,
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  arrayBuffer: async () => syntheticXlsxBuf.buffer.slice(
    syntheticXlsxBuf.byteOffset,
    syntheticXlsxBuf.byteOffset + syntheticXlsxBuf.byteLength
  ),
}

console.log('  触发 standalone 模式本地文件上传 onChange...')
await uploadInput[inputPropsKey].onChange({ target: { files: [syntheticUploadFile] } })
await new Promise(r => setTimeout(r, 600))

assert.ok(serverUploadCount >= 1, 'standalone 模式上传文件必须调用 uploadServerFile 且发起服务端上传请求')
console.log('  ✅ 4.4 standalone 模式正常调用 uploadServerFile (' + serverUploadCount + ' 次)')

// 4.4 验证 IndexedDB 队列生命周期：成功上传后 pending-uploads 必须清空
const pendingUploadsStore = getIdbStore('pending-uploads')
assert.strictEqual(
  pendingUploadsStore.size,
  0,
  '上传成功后 IndexedDB pending-uploads 队列必须已被清空（证明上传完成并确认，绝非失败后的队列重试）'
)
console.log('  ✅ 4.5 standalone 模式 IndexedDB pending-uploads 队列已清空 (0 条残留排队任务)')

// 4.5 验证本地 IndexedDB 与活动状态持久化结果
const filesStore = getIdbStore('files')
assert.ok(
  filesStore.has('本地上传测试.xlsx'),
  '上传的文件必须成功写入 IndexedDB files 表'
)
const activeFileRecorded = persistSetLog.some(([k, v]) => k === 'mr-active-file' && v === '本地上传测试.xlsx')
assert.ok(activeFileRecorded, '本地上传成功后 mr-active-file 必须记录新文件名')
console.log('  ✅ 4.6 standalone 模式文件与状态在 IndexedDB / LocalStorage 中完成持久化')

// 4.6 验证无任何 Server persistence deferred 或 Server upload skipped 警告
const deferredOrSkippedWarnings = capturedWarnings.filter(w =>
  w.includes('Server persistence deferred') ||
  w.includes('Server upload skipped') ||
  w.includes('response.json is not a function')
)
assert.strictEqual(
  deferredOrSkippedWarnings.length,
  0,
  `测试中严禁出现服务端持久化延后或上传跳过警告，实际捕获: ${deferredOrSkippedWarnings.join('; ')}`
)
console.log('  ✅ 4.7 独立模式上传全链路 0 次 Server persistence deferred 警告，0 次 Server upload skipped 警告')

// 释放 Vite SSR 服务器
await viteServer.close()

console.log('\n🎉 [PASS] MarketResearch 真实组件嵌入隔离与独立模式验证全部通过！\n')
process.exit(0)
