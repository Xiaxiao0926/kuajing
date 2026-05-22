import { useState, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'
import {
  Shield, Upload, FileText, Trash2, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle2, Clock, X, Save, Plus, Pencil, RotateCcw
} from 'lucide-react'
import { persistGet, persistSet, persistRemove } from '../utils/persist'

const DB_NAME = 'ozon-compliance'
const DB_VERSION = 1
const STORE_NAME = 'files'
const STORAGE_KEY = 'compliance-items'

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

async function dbDelete(name) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(name)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

const CHECKLIST = [
  { id: 'c1', title: 'EAEU/TR CU法规识别', desc: '识别目标市场适用的技术法规' },
  { id: 'c2', title: '禁限用成分筛查', desc: '核查产品成分是否符合EAEU禁限用清单' },
  { id: 'c3', title: '标签要求确认', desc: '确认EAC标签、俄语标签等要求' },
  { id: 'c4', title: '合规风险等级评估', desc: '评估产品合规风险等级及应对措施' },
]

const RISK_COLORS = {
  high: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500', label: '高风险' },
  mid: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500', label: '中风险' },
  low: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500', label: '低风险' },
}

const FIELDS = [
  { key: 'name', label: '项目名称', type: 'text', required: true },
  { key: 'category', label: '合规类别', type: 'select', options: ['法规识别', '成分筛查', '标签要求', '风险等级', '其他'] },
  { key: 'risk', label: '风险等级', type: 'select', options: ['high', 'mid', 'low'] },
  { key: 'status', label: '状态', type: 'select', options: ['pending', 'progress', 'done'] },
  { key: 'desc', label: '说明', type: 'textarea' },
]

function EditModal({ item, onSave, onClose }) {
  const [form, setForm] = useState(() => ({ ...item }))

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h3 className="text-sm font-semibold text-morandi-text flex items-center gap-2">
            <Shield className="w-4 h-4 text-morandi-primary" />
            {item.id ? '编辑合规项' : '新增合规项'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-3">
          {FIELDS.map(f => (
            <div key={f.key}>
              <label className="text-[11px] font-medium text-morandi-text-light mb-1 block">
                {f.label}{f.required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              {f.type === 'textarea' ? (
                <textarea
                  value={form[f.key] || ''}
                  onChange={e => update(f.key, e.target.value)}
                  rows={3}
                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-morandi-primary resize-none"
                />
              ) : f.type === 'select' ? (
                <select
                  value={form[f.key] || ''}
                  onChange={e => update(f.key, e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-morandi-primary bg-white"
                >
                  <option value="">请选择</option>
                  {f.options.map(o => (
                    <option key={o} value={o}>
                      {f.key === 'risk' ? (RISK_COLORS[o]?.label || o) : f.key === 'status' ? ({ pending: '待处理', progress: '进行中', done: '已完成' }[o] || o) : o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={form[f.key] || ''}
                  onChange={e => update(f.key, e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-morandi-primary"
                />
              )}
            </div>
          ))}
        </div>
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-end gap-2 rounded-b-2xl z-10">
          <button onClick={onClose} className="px-4 py-2 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">取消</button>
          <button onClick={() => onSave(form)} className="px-4 py-2 text-xs text-white bg-morandi-primary rounded-lg hover:bg-morandi-primary/90 flex items-center gap-1">
            <Save className="w-3 h-3" />保存
          </button>
        </div>
      </div>
    </div>
  )
}

async function parseDocFile(arrayBuffer) {
  try {
    const result = await mammoth.convertToHtml({ arrayBuffer })
    const parser = new DOMParser()
    const doc = parser.parseFromString(result.value, 'text/html')
    const tables = doc.querySelectorAll('table')
    if (tables.length > 0) {
      const allRows = []
      tables.forEach(table => {
        const headerCells = table.querySelectorAll('tr:first-child th, tr:first-child td')
        const hdrs = []
        headerCells.forEach(cell => hdrs.push(String(cell.textContent).trim()))
        const trs = (table.querySelector('tbody') || table).querySelectorAll('tr')
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
          allRows.push(row)
        })
      })
      if (allRows.length > 0) return allRows
    }
    const textResult = await mammoth.extractRawText({ arrayBuffer })
    const paragraphs = textResult.value.split('\n').filter(p => p.trim())
    return paragraphs.map((p, i) => ({ 序号: i + 1, 内容: p.trim() }))
  } catch (err) {
    console.error('Doc parse error:', err)
    return []
  }
}

function parseFile(arrayBuffer, fileName) {
  const ext = fileName.split('.').pop().toLowerCase()
  const isHTML = ext === 'html' || ext === 'htm'
  const isDoc = ext === 'doc' || ext === 'docx'

  if (isDoc) {
    return parseDocFile(arrayBuffer)
  }

  if (isHTML) {
    const text = new TextDecoder().decode(arrayBuffer)
    const parser = new DOMParser()
    const doc = parser.parseFromString(text, 'text/html')
    const table = doc.querySelector('table')
    if (!table) return []
    const headerCells = table.querySelectorAll('tr:first-child th, tr:first-child td')
    const hdrs = []
    headerCells.forEach(cell => hdrs.push(String(cell.textContent).trim()))
    const trs = (table.querySelector('tbody') || table).querySelectorAll('tr')
    const rows = []
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
      rows.push(row)
    })
    return rows
  }

  const fileData = new Uint8Array(arrayBuffer)
  const workbook = XLSX.read(fileData, { type: 'array' })
  const result = []
  workbook.SheetNames.forEach(sn => {
    const ws = workbook.Sheets[sn]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
    if (rows.length < 1) return
    const headers = rows[0].map(h => String(h).trim())
    rows.slice(1).filter(row => row.some(c => c != null && c !== '')).forEach((row, ri) => {
      const obj = { _sheet: sn, _row: ri + 2 }
      headers.forEach((h, i) => { obj[h] = row[i] != null ? row[i] : '' })
      result.push(obj)
    })
  })
  return result
}

export default function ComplianceAssessment() {
  const [files, setFiles] = useState([])
  const [activeFile, setActiveFile] = useState(null)
  const [fileData, setFileData] = useState(null)
  const [items, setItems] = useState([])
  const [editItem, setEditItem] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [expandedFile, setExpandedFile] = useState(null)
  const [checklistStatus, setChecklistStatus] = useState({})
  const fileInputRef = useRef(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const saved = persistGet(STORAGE_KEY)
        if (saved) setItems(saved)
        const savedChecklist = persistGet('compliance-checklist')
        if (savedChecklist) setChecklistStatus(savedChecklist)
        const savedFiles = await dbGetAll()
        setFiles(savedFiles.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)))
        const lastActive = persistGet('compliance-active-file')
        if (lastActive) {
          const found = savedFiles.find(f => f.name === lastActive)
          if (found) {
            setActiveFile(found.name)
            setFileData(found.data)
          }
        }
      } catch {}
      const updates = persistGet('node-updates') || {}
      if (!updates['n9']) updates['n9'] = []
      updates['n9'].push({ time: Date.now(), msg: '合规评估数据已加载' })
      persistSet('node-updates', updates)
    }
    loadData()
  }, [])

  const saveItems = (list) => {
    setItems(list)
    persistSet(STORAGE_KEY, list)
  }

  const toggleChecklist = (id, status) => {
    const next = { ...checklistStatus, [id]: status }
    setChecklistStatus(next)
    persistSet('compliance-checklist', next)
  }

  const handleUpload = async (e) => {
    const uploadFiles = e.target.files
    if (!uploadFiles.length) return
    for (const file of uploadFiles) {
      try {
        const ab = await file.arrayBuffer()
        const data = await parseFile(ab, file.name)
        const record = {
          name: file.name,
          size: file.size,
          type: file.type || file.name.split('.').pop(),
          data,
          savedAt: Date.now(),
        }
        await dbPut(record)
        setFiles(prev => {
          const filtered = prev.filter(f => f.name !== file.name)
          return [record, ...filtered].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
        })
        if (!activeFile) {
          setActiveFile(file.name)
          setFileData(data)
          persistSet('compliance-active-file', file.name)
        }
      } catch (err) {
        console.error('Upload error:', err)
      }
    }
    e.target.value = ''
  }

  const handleSelectFile = async (name) => {
    try {
      const db = await openDB()
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(name)
      req.onsuccess = () => {
        if (req.result) {
          setActiveFile(name)
          setFileData(req.result.data)
          persistSet('compliance-active-file', name)
        }
      }
    } catch {}
  }

  const handleDeleteFile = async (name) => {
    if (!confirm('确认删除该文件？')) return
    await dbDelete(name)
    setFiles(prev => prev.filter(f => f.name !== name))
    if (activeFile === name) {
      setActiveFile(null)
      setFileData(null)
      persistRemove('compliance-active-file')
    }
  }

  const handleSaveItem = (updated) => {
    const idx = items.findIndex(it => it.id === updated.id)
    if (idx >= 0) {
      const list = [...items]
      list[idx] = { ...list[idx], ...updated }
      saveItems(list)
    }
    setEditItem(null)
  }

  const handleAddItem = (data) => {
    const newId = 'c_' + Date.now()
    saveItems([...items, { ...data, id: newId }])
    setShowAdd(false)
  }

  const handleDeleteItem = (id) => {
    if (!confirm('确认删除该合规项？')) return
    saveItems(items.filter(it => it.id !== id))
  }

  const handleReset = () => {
    if (!confirm('确认重置？手动添加的合规项将丢失。')) return
    persistRemove(STORAGE_KEY)
    setItems([])
  }

  const statusIcon = (status) => {
    if (status === 'done') return <CheckCircle2 className="w-4 h-4 text-green-500" />
    if (status === 'progress') return <Clock className="w-4 h-4 text-amber-500" />
    return <AlertTriangle className="w-4 h-4 text-gray-300" />
  }

  const statusLabel = (s) => ({ pending: '待处理', progress: '进行中', done: '已完成' }[s] || '待处理')

  const doneCount = CHECKLIST.filter(c => checklistStatus[c.id] === 'done').length
  const highRiskCount = items.filter(it => it.risk === 'high').length
  const midRiskCount = items.filter(it => it.risk === 'mid').length
  const doneItemCount = items.filter(it => it.status === 'done').length

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + 'B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
    return (bytes / 1024 / 1024).toFixed(1) + 'MB'
  }

  const renderDataTable = (data) => {
    if (!data || data.length === 0) return <p className="text-xs text-morandi-text-light py-4 text-center">文件内容为空</p>
    const headers = Object.keys(data[0]).filter(k => !k.startsWith('_'))
    const isTextContent = headers.length === 2 && headers.includes('序号') && headers.includes('内容')
    const displayData = data.slice(0, 200)
    if (isTextContent) {
      return (
        <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
          {displayData.map((row, i) => (
            <div key={i} className="flex gap-2 text-xs py-1 px-2 hover:bg-gray-50 rounded">
              <span className="text-morandi-text-light flex-shrink-0 w-6 text-right">{row['序号']}</span>
              <span className="text-morandi-text">{row['内容']}</span>
            </div>
          ))}
          {data.length > 200 && <p className="text-[10px] text-morandi-text-light text-center py-2">仅显示前200段，共{data.length}段</p>}
        </div>
      )
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {headers.map(h => (
                <th key={h} className="text-left py-2 px-3 font-semibold text-morandi-text whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayData.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/30">
                {headers.map(h => (
                  <td key={h} className="py-1.5 px-3 text-morandi-text-light max-w-[200px] truncate">{row[h] != null ? String(row[h]) : ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length > 200 && <p className="text-[10px] text-morandi-text-light text-center py-2">仅显示前200行，共{data.length}行</p>}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-morandi-text flex items-center gap-2">
            <Shield className="w-5 h-5 text-morandi-primary" />
            合规评估
          </h2>
          <p className="text-[10px] text-morandi-text-light mt-0.5">上传合规文档，跟踪合规进度与风险</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-morandi-primary rounded-lg hover:bg-morandi-primary/90"
          >
            <Plus className="w-3 h-3" />新增合规项
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
            title="重置合规项"
          >
            <RotateCcw className="w-3 h-3" />重置
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center gap-1.5 mb-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[10px] font-medium text-blue-600">合规进度</span>
          </div>
          <div className="text-2xl font-bold text-blue-700">{doneCount}/{CHECKLIST.length}</div>
          <div className="text-[9px] text-blue-400 mt-0.5">核心合规项已完成</div>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100/50 rounded-xl p-4 border border-red-100">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-[10px] font-medium text-red-600">高风险项</span>
          </div>
          <div className="text-2xl font-bold text-red-700">{highRiskCount}</div>
          <div className="text-[9px] text-red-400 mt-0.5">需要优先处理</div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl p-4 border border-amber-100">
          <div className="flex items-center gap-1.5 mb-2">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] font-medium text-amber-600">中风险项</span>
          </div>
          <div className="text-2xl font-bold text-amber-700">{midRiskCount}</div>
          <div className="text-[9px] text-amber-400 mt-0.5">持续关注</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl p-4 border border-green-100">
          <div className="flex items-center gap-1.5 mb-2">
            <FileText className="w-3.5 h-3.5 text-green-500" />
            <span className="text-[10px] font-medium text-green-600">合规文档</span>
          </div>
          <div className="text-2xl font-bold text-green-700">{files.length}</div>
          <div className="text-[9px] text-green-400 mt-0.5">已上传文件</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-morandi-text mb-4 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-morandi-primary" />
          核心合规清单
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {CHECKLIST.map(c => {
            const status = checklistStatus[c.id] || 'pending'
            return (
              <div key={c.id} className={`rounded-xl p-4 border ${status === 'done' ? 'bg-green-50/50 border-green-200' : status === 'progress' ? 'bg-amber-50/50 border-amber-200' : 'bg-gray-50/50 border-gray-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {statusIcon(status)}
                    <span className="text-sm font-medium text-morandi-text">{c.title}</span>
                  </div>
                  <select
                    value={status}
                    onChange={e => toggleChecklist(c.id, e.target.value)}
                    className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:border-morandi-primary"
                  >
                    <option value="pending">待处理</option>
                    <option value="progress">进行中</option>
                    <option value="done">已完成</option>
                  </select>
                </div>
                <p className="text-[10px] text-morandi-text-light">{c.desc}</p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-morandi-text mb-4 flex items-center gap-1.5">
          <Upload className="w-4 h-4 text-morandi-primary" />
          合规文档上传
          <span className="text-[10px] text-morandi-text-light font-normal ml-1">支持 xlsx / xls / html / csv / doc / docx 文件</span>
        </h3>
        <div
          className="border-2 border-dashed border-gray-200 hover:border-morandi-primary rounded-xl p-6 text-center cursor-pointer transition-all hover:bg-gray-50/50 mb-4"
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.html,.htm,.csv,.doc,.docx" multiple className="hidden" onChange={handleUpload} />
          <Upload className="w-6 h-6 text-morandi-primary mx-auto mb-2" />
          <p className="text-xs text-morandi-text">点击上传合规文档</p>
          <p className="text-[10px] text-morandi-text-light mt-1">文件将保存到本地，刷新后自动恢复</p>
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            {files.map(f => {
              const isActive = activeFile === f.name
              const isExpanded = expandedFile === f.name
              return (
                <div key={f.name} className={`rounded-xl border transition-all ${isActive ? 'border-morandi-primary/30 bg-morandi-primary/5' : 'border-gray-100 hover:border-gray-200'}`}>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer" onClick={() => handleSelectFile(f.name)}>
                      <FileText className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-morandi-primary' : 'text-gray-400'}`} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs truncate ${isActive ? 'font-semibold text-morandi-primary' : 'font-medium text-morandi-text'}`}>{f.name}</p>
                        <p className="text-[9px] text-morandi-text-light">
                          {formatSize(f.size)} · {f.data?.length || 0}行
                          {f.savedAt ? ` · ${new Date(f.savedAt).toLocaleDateString()}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setExpandedFile(isExpanded ? null : f.name)}
                        className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-morandi-text transition-colors"
                        title={isExpanded ? '收起' : '展开'}
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleDeleteFile(f.name)}
                        className="p-1 hover:bg-red-50 rounded text-gray-300 hover:text-red-400 transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {isExpanded && f.data && (
                    <div className="px-4 pb-3 border-t border-gray-100 pt-3">
                      {renderDataTable(f.data)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {files.length === 0 && (
          <div className="text-center py-6">
            <FileText className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-morandi-text-light">暂无合规文档，请上传</p>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-morandi-text mb-4 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-morandi-primary" />
            合规风险项
            <span className="text-[10px] text-morandi-text-light font-normal ml-1">({items.length} 项)</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 font-semibold text-morandi-text">项目名称</th>
                  <th className="text-left py-2 px-3 font-semibold text-morandi-text">合规类别</th>
                  <th className="text-left py-2 px-3 font-semibold text-morandi-text">风险等级</th>
                  <th className="text-left py-2 px-3 font-semibold text-morandi-text">状态</th>
                  <th className="text-left py-2 px-3 font-semibold text-morandi-text">说明</th>
                  <th className="text-left py-2 px-3 font-semibold text-morandi-text w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(it => {
                  const rc = RISK_COLORS[it.risk] || RISK_COLORS.mid
                  return (
                    <tr key={it.id} className="border-b border-gray-50 hover:bg-gray-50/30">
                      <td className="py-2 px-3 font-medium text-morandi-text">{it.name}</td>
                      <td className="py-2 px-3 text-morandi-text-light">{it.category || '—'}</td>
                      <td className="py-2 px-3">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${rc.bg} ${rc.text} border ${rc.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${rc.dot}`} />
                          {rc.label}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`text-[10px] font-medium ${it.status === 'done' ? 'text-green-600' : it.status === 'progress' ? 'text-amber-600' : 'text-gray-400'}`}>
                          {statusLabel(it.status)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-morandi-text-light max-w-[200px] truncate">{it.desc || '—'}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => setEditItem(it)} className="p-1 hover:bg-blue-50 rounded text-gray-300 hover:text-blue-500 transition-colors" title="编辑">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button onClick={() => handleDeleteItem(it.id)} className="p-1 hover:bg-red-50 rounded text-gray-300 hover:text-red-400 transition-colors" title="删除">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(editItem || showAdd) && (
        <EditModal
          item={editItem || { id: '', name: '', category: '', risk: '', status: 'pending', desc: '' }}
          onSave={editItem ? handleSaveItem : handleAddItem}
          onClose={() => { setEditItem(null); setShowAdd(false) }}
        />
      )}
    </div>
  )
}
