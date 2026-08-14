import { useState, useRef, useEffect } from 'react'
import { Upload, FileSpreadsheet, Loader2, FolderOpen, CheckCircle2, FileDown, Camera, HardDrive, Trash2 } from 'lucide-react'
import NewDashboard from './NewDashboard'
import Dashboard from './Dashboard'
import * as XLSX from 'xlsx'
import { cleanData, addPriceCategory, calculateKPIs } from '../utils/dataProcessor'
import { persistGet, persistSet, persistRemove } from '../utils/persist'
import { getDataUrl } from '../utils/runtime.js'
import { deleteServerFile, listServerFiles, uploadServerFile } from '../utils/serverFiles.js'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

const DATA_DIR = getDataUrl().replace(/\/$/, '')
const FILE_NAMESPACE = 'market-research'
const DB_NAME = 'ozon-market-research'
const DB_VERSION = 1
const STORE_NAME = 'files'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'name' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function dbPut(record) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function dbGetAll() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function dbGet(name) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(name)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function dbDelete(name) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(name)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export default function MarketResearch({ data, kpis, dataFormat, onFileUpload, loading, error, screenshotMode, setScreenshotMode }) {
  const [availableFiles, setAvailableFiles] = useState([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [activeFile, setActiveFile] = useState(null)
  const [localData, setLocalData] = useState(null)
  const [localKpis, setLocalKpis] = useState(null)
  const [localFormat, setLocalFormat] = useState(dataFormat)
  const [exporting, setExporting] = useState(false)
  const [savedFiles, setSavedFiles] = useState([])
  const dashboardRef = useRef(null)
  const fileInputRef = useRef(null)

  const displayData = localData || data
  const displayKpis = localKpis || kpis
  const displayFormat = localData ? localFormat : dataFormat

  useEffect(() => {
    const loadSaved = async () => {
      try {
        const files = await dbGetAll()
        setSavedFiles(files.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)))
        const lastActive = persistGet('mr-active-file')
        if (lastActive) {
          const found = files.find(f => f.name === lastActive)
          if (found) {
            setLocalData(found.data)
            setLocalKpis(found.kpis)
            setLocalFormat(found.format || 'old')
            setActiveFile(found.name)
          }
        }
      } catch {}
    }
    loadSaved()
  }, [])

  useEffect(() => {
    const fetchManifest = async () => {
      try {
        setLoadingFiles(true)
        const resp = await fetch(`${DATA_DIR}/manifest.json?t=${Date.now()}`)
        let publicFiles = []
        if (resp.ok) {
          const manifest = await resp.json()
          publicFiles = (manifest.files || []).filter(f => !f.name.includes('供应链') && !f.name.includes('工厂目录') && !f.name.includes('价格清单') && f.name.includes('热销'))
        }
        const serverFiles = await listServerFiles(FILE_NAMESPACE)
        const merged = new Map(publicFiles.map(file => [file.name, file]))
        serverFiles.forEach(file => merged.set(file.name, { ...file, source: 'server' }))
        setAvailableFiles([...merged.values()].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))))
      } catch { setAvailableFiles([]) }
      finally { setLoadingFiles(false) }
    }
    fetchManifest()
    const interval = setInterval(fetchManifest, 30000)
    return () => clearInterval(interval)
  }, [])

  const parseXlsxArrayBuffer = (arrayBuffer) => {
    const fileData = new Uint8Array(arrayBuffer)
    const workbook = XLSX.read(fileData, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
    if (jsonData.length < 2) return []
    const headers = jsonData[0].map(h => String(h).trim())
    return jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== null && cell !== '')).map(row => {
      const obj = {}
      headers.forEach((header, index) => { obj[header] = row[index] })
      return obj
    })
  }

  const processAndSave = async (parsedData, fileName, fileDate, isUpload) => {
    const headers = Object.keys(parsedData[0])
    const hasNewFormat = headers.some(h => h.includes('销售额') || h.includes('曝光量') || h.includes('广告费用') || h.includes('转化指数'))
    const fmt = hasNewFormat ? 'new' : 'old'
    let processedData = parsedData
    let calculatedKpis = null
    if (!hasNewFormat) {
      const cleaned = cleanData(parsedData)
      const processed = addPriceCategory(cleaned)
      processedData = processed
      calculatedKpis = calculateKPIs(processed)
    }
    setLocalFormat(fmt)
    setLocalData(processedData)
    setLocalKpis(calculatedKpis)
    setActiveFile(fileName)
    persistSet('mr-active-file', fileName)
    const updates = persistGet('node-updates') || {}
    if (!updates['n2']) updates['n2'] = []
    updates['n2'].push({ time: Date.now(), msg: '市场调研数据已加载' })
    persistSet('node-updates', updates)
    if (isUpload) {
      try {
        await dbPut({
          name: fileName,
          date: fileDate || new Date().toISOString().slice(0, 10),
          format: fmt,
          data: processedData,
          kpis: calculatedKpis,
          savedAt: Date.now(),
        })
        const files = await dbGetAll()
        setSavedFiles(files.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)))
      } catch (err) {
        console.error('Save to IndexedDB failed:', err)
      }
    }
  }

  const handleLoadFile = async (file) => {
    try {
      setLoadingFiles(true)
      const resp = await fetch(file.downloadUrl || `${DATA_DIR}/${file.name}`)
      if (!resp.ok) throw new Error('下载失败')
      const arrayBuffer = await resp.arrayBuffer()
      const parsedData = parseXlsxArrayBuffer(arrayBuffer)
      if (parsedData.length === 0) return
      await processAndSave(parsedData, file.name, file.date, file.source === 'server')
    } catch (err) { console.error('Load file error:', err) }
    finally { setLoadingFiles(false) }
  }

  const handleLoadSaved = async (file) => {
    try {
      const cached = await dbGet(file.name)
      if (cached) {
        setLocalData(cached.data)
        setLocalKpis(cached.kpis)
        setLocalFormat(cached.format || 'old')
        setActiveFile(file.name)
        persistSet('mr-active-file', file.name)
      }
    } catch (err) { console.error('Load saved file error:', err) }
  }

  const handleDeleteSaved = async (name) => {
    try {
      await dbDelete(name)
      await deleteServerFile(FILE_NAMESPACE, name)
      const files = await dbGetAll()
      setSavedFiles(files.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)))
      if (activeFile === name) {
        setActiveFile(null)
        setLocalData(null)
        setLocalKpis(null)
        persistRemove('mr-active-file')
      }
    } catch (err) { console.error('Delete saved file error:', err) }
  }

  const uploadToServer = async (file) => {
    try {
      const result = await uploadServerFile(FILE_NAMESPACE, file)
      if (result?.file) {
        setAvailableFiles(prev => {
          const merged = new Map(prev.map(item => [item.name, item]))
          merged.set(result.file.name, { ...result.file, source: 'server' })
          return [...merged.values()]
        })
      }
    } catch (err) {
      console.warn('Server upload skipped:', err.message)
    }
  }

  const handleLocalUpload = async (e) => {
    const files = e.target.files
    if (files.length > 0) {
      const file = files[0]
      try {
        const arrayBuffer = await file.arrayBuffer()
        const isHTML = file.name.endsWith('.html') || file.name.endsWith('.htm')
        let parsedData = []
        if (isHTML) {
          const text = await file.text()
          const parser = new DOMParser()
          const doc = parser.parseFromString(text, 'text/html')
          const table = doc.querySelector('table')
          if (!table) return
          const headerCells = table.querySelectorAll('tr:first-child th, tr:first-child td')
          const hdrs = []
          headerCells.forEach(cell => hdrs.push(String(cell.textContent).trim()))
          const trs = (table.querySelector('tbody') || table).querySelectorAll('tr')
          const htmlRows = []
          trs.forEach(tr => {
            if (tr.querySelector('th')) return
            const cells = tr.querySelectorAll('td')
            if (cells.length === 0) return
            const row = {}
            hdrs.forEach((header, index) => {
              let value = String(cells[index]?.textContent || '').trim()
              const numValue = parseFloat(value.replace(/[^\d.-]/g, ''))
              if (!isNaN(numValue) && value.match(/^-?\d+([.,]\d+)?$/)) row[header] = numValue
              else row[header] = value
            })
            htmlRows.push(row)
          })
          parsedData = htmlRows
        } else {
          parsedData = parseXlsxArrayBuffer(arrayBuffer)
        }
        if (parsedData.length === 0) return
        await processAndSave(parsedData, file.name, undefined, true)
        await uploadToServer(file)
      } catch (err) {
        console.error('Upload parse error:', err)
        onFileUpload(file)
        setActiveFile(file.name)
      }
    }
  }

  const exportToPDF = async () => {
    setExporting(true)
    try {
      const element = dashboardRef.current
      if (!element) { setExporting(false); return }
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' })
      const imgWidth = 210
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      const pdf = new jsPDF('p', 'mm', [imgWidth, imgHeight])
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight)
      pdf.save('Ozon市场分析报告.pdf')
    } catch (err) { console.error('Export error:', err); alert('导出失败') }
    finally { setExporting(false) }
  }

  const hasData = displayData && displayData.length > 0

  return (
    <div className="flex gap-4 h-full">
      <div className="w-48 flex-shrink-0 bg-white rounded-xl shadow-sm p-3 flex flex-col h-fit sticky top-0">
        <h4 className="text-xs font-semibold text-morandi-text mb-3 flex items-center gap-1.5">
          <FolderOpen className="w-3.5 h-3.5 text-morandi-primary" />
          报告文件
        </h4>

        <div className="mb-3">
          <div
            className={`border-2 border-dashed rounded-lg p-2 text-center cursor-pointer transition-all ${loading ? 'border-morandi-primary bg-morandi-primary/5' : 'border-gray-200 hover:border-morandi-primary hover:bg-gray-50'}`}
            onClick={() => !loading && fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" accept="*" className="hidden" onChange={handleLocalUpload} disabled={loading} />
            {loading ? (
              <Loader2 className="w-4 h-4 text-morandi-primary animate-spin mx-auto" />
            ) : (
              <div className="flex flex-col items-center gap-0.5">
                <Upload className="w-3.5 h-3.5 text-morandi-primary" />
                <span className="text-[10px] text-morandi-text">上传</span>
              </div>
            )}
          </div>
        </div>

        {savedFiles.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-1 mb-1.5">
              <HardDrive className="w-3 h-3 text-blue-400" />
              <span className="text-[9px] font-semibold text-morandi-text-light uppercase tracking-wider">本地缓存</span>
            </div>
            <div className="space-y-0.5">
              {savedFiles.map(f => {
                const isActive = activeFile === f.name
                return (
                  <div key={f.name} className={`flex items-center group rounded-lg transition-colors ${isActive ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}`}>
                    <button
                      onClick={() => handleLoadSaved(f)}
                      className="flex-1 text-left px-2 py-1.5 min-w-0"
                    >
                      <div className="flex items-center gap-1.5">
                        <HardDrive className={`w-3 h-3 flex-shrink-0 ${isActive ? 'text-blue-500' : 'text-blue-300'}`} />
                        <div className="min-w-0 flex-1">
                          <p className={`text-[10px] truncate ${isActive ? 'font-semibold text-blue-600' : 'font-medium text-morandi-text'}`}>
                            {f.name}
                          </p>
                          <p className="text-[9px] text-morandi-text-light">{f.date} · {(JSON.stringify(f.data).length / 1024).toFixed(0)}KB</p>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleDeleteSaved(f.name)}
                      className="p-1 mr-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded text-gray-300 hover:text-red-400 transition-all"
                      title="删除缓存"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {availableFiles.length > 0 && (
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <FileSpreadsheet className="w-3 h-3 text-green-400" />
              <span className="text-[9px] font-semibold text-morandi-text-light uppercase tracking-wider">服务器文件</span>
            </div>
            <div className="space-y-0.5 flex-1 overflow-y-auto max-h-[calc(100vh-500px)]">
              {availableFiles.map((f, i) => {
                const isActive = activeFile === f.name
                return (
                  <button
                    key={i}
                    onClick={() => handleLoadFile(f)}
                    disabled={loadingFiles}
                    className={`w-full text-left px-2 py-1.5 rounded-lg transition-colors group disabled:opacity-50 ${isActive ? 'bg-morandi-primary/10 border border-morandi-primary/20' : 'hover:bg-gray-50 border border-transparent'}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <FileSpreadsheet className={`w-3 h-3 flex-shrink-0 ${isActive ? 'text-morandi-primary' : 'text-green-500'}`} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-[10px] truncate ${isActive ? 'font-semibold text-morandi-primary' : 'font-medium text-morandi-text group-hover:text-morandi-primary'}`}>
                          {f.name}
                        </p>
                        <p className="text-[9px] text-morandi-text-light">
                          {f.date?.replace(/-/g, '/')}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {hasData && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="p-1.5 bg-green-50 rounded flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-green-500" />
              <span className="text-[10px] text-green-700">{displayData.length} 条数据</span>
            </div>
          </div>
        )}

        {hasData && (
          <div className="mt-3 space-y-1.5">
            <button
              onClick={() => setScreenshotMode(!screenshotMode)}
              className={`w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${screenshotMode ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <Camera className="w-3 h-3" />
              {screenshotMode ? '退出截图' : '截图模式'}
            </button>
            <button
              onClick={exportToPDF}
              disabled={exporting}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-morandi-primary text-white rounded-lg text-[10px] font-medium hover:bg-morandi-primary/90 transition-colors disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
              {exporting ? '导出中...' : '导出PDF'}
            </button>
          </div>
        )}
      </div>

      <div ref={dashboardRef} className="flex-1 min-w-0">
        {hasData ? (
          displayFormat === 'new' ? (
            <NewDashboard data={displayData} kpis={displayKpis} screenshotMode={screenshotMode} />
          ) : (
            <Dashboard data={displayData} kpis={displayKpis} screenshotMode={screenshotMode} />
          )
        ) : (
          <div className="bg-white rounded-xl p-12 shadow-sm text-center">
            <FolderOpen className="w-10 h-10 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-morandi-text mb-2">请选择或上传数据文件</h3>
            <p className="text-sm text-morandi-text-light">从左侧选择报告文件，或上传 .xlsx / .xls / .html 文件开始分析</p>
          </div>
        )}
      </div>
    </div>
  )
}
