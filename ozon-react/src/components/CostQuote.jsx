import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import {
  DollarSign, Package, Factory, ChevronDown, ChevronUp,
  Pencil, Plus, Trash2, X, Save, RotateCcw, Scale, Tag, FileText
} from 'lucide-react'
import { persistGet, persistSet, persistRemove } from '../utils/persist'
import { getAssetUrl } from '../utils/runtime.js'

const PRICE_FILE = getAssetUrl('data/各供应商起订量及价格清单表.xlsx')
const STORAGE_KEY = 'cost-quote-data'

const CATEGORY_COLORS = {
  '发膜': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', accent: 'bg-purple-500' },
  '精油': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', accent: 'bg-green-500' },
  '吹风机': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', accent: 'bg-rose-500' },
  '枕头': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', accent: 'bg-blue-500' },
}

const FIELDS = [
  { key: 'supplier', label: '供应商', type: 'text', required: true },
  { key: 'category', label: '产品类别', type: 'text', required: true },
  { key: 'productName', label: '产品名称', type: 'text' },
  { key: 'spec', label: '产品规格', type: 'text' },
  { key: 'moq', label: '起订量', type: 'text' },
  { key: 'priceCondition', label: '价格条件', type: 'text' },
  { key: 'unitPrice', label: '单价', type: 'text' },
  { key: 'notes', label: '备注', type: 'textarea' },
]

function parsePriceData(arrayBuffer) {
  const fileData = new Uint8Array(arrayBuffer)
  const workbook = XLSX.read(fileData, { type: 'array' })
  const ws = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
  if (rows.length < 2) return []

  const items = []
  let currentSupplier = ''
  let currentCategory = ''
  let currentProduct = ''
  let currentSpec = ''
  let currentMoq = ''

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every(c => c == null || c === '')) continue

    if (row[0] && String(row[0]).trim()) currentSupplier = String(row[0]).trim()
    if (row[1] && String(row[1]).trim()) currentCategory = String(row[1]).trim()
    if (row[2] && String(row[2]).trim()) currentProduct = String(row[2]).trim()
    if (row[3] && String(row[3]).trim()) currentSpec = String(row[3]).trim()
    if (row[4] && String(row[4]).trim()) currentMoq = String(row[4]).trim()

    const priceCond = String(row[5] || '').trim()
    const unitPrice = String(row[6] || '').trim()
    const notes = String(row[7] || '').trim()

    if (!priceCond && !unitPrice && !notes) continue

    items.push({
      id: 'p' + i,
      supplier: currentSupplier,
      category: currentCategory,
      productName: currentProduct,
      spec: currentSpec,
      moq: currentMoq,
      priceCondition: priceCond,
      unitPrice: unitPrice,
      notes: notes,
      source: 'file',
    })
  }
  return items
}

function EditModal({ item, onSave, onClose }) {
  const [form, setForm] = useState(() => {
    const f = { ...item }
    delete f.source
    return f
  })

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h3 className="text-sm font-semibold text-morandi-text flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-morandi-primary" />
            {item.id ? '编辑报价' : '新增报价'}
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

export default function CostQuote() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterCat, setFilterCat] = useState('all')
  const [filterSupplier, setFilterSupplier] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [editItem, setEditItem] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const saved = persistGet(STORAGE_KEY)
        if (saved) {
          setItems(saved)
          setLoading(false)
          const updates = persistGet('node-updates') || {}
          if (!updates['n8']) updates['n8'] = []
          updates['n8'].push({ time: Date.now(), msg: '成本报价数据已加载' })
          persistSet('node-updates', updates)
          return
        }
        const resp = await fetch(PRICE_FILE)
        if (!resp.ok) throw new Error('文件加载失败')
        const ab = await resp.arrayBuffer()
        const data = parsePriceData(ab)
        if (data.length === 0) throw new Error('未解析到有效数据')
        setItems(data)
        persistSet(STORAGE_KEY, data)
        const updates = persistGet('node-updates') || {}
        if (!updates['n8']) updates['n8'] = []
        updates['n8'].push({ time: Date.now(), msg: '成本报价数据已加载' })
        persistSet('node-updates', updates)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const saveToStorage = (list) => {
    setItems(list)
    persistSet(STORAGE_KEY, list)
  }

  const handleSave = (updated) => {
    const idx = items.findIndex(it => it.id === updated.id)
    if (idx >= 0) {
      const list = [...items]
      list[idx] = { ...list[idx], ...updated }
      saveToStorage(list)
    }
    setEditItem(null)
  }

  const handleAdd = (data) => {
    const newId = 'p_' + Date.now()
    saveToStorage([...items, { ...data, id: newId, source: 'manual' }])
    setShowAdd(false)
  }

  const handleDelete = (id) => {
    if (!confirm('确认删除该报价？')) return
    saveToStorage(items.filter(it => it.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  const handleReset = async () => {
    if (!confirm('确认重置为原始文件数据？手动修改将丢失。')) return
    persistRemove(STORAGE_KEY)
    try {
      setLoading(true)
      const resp = await fetch(PRICE_FILE)
      if (!resp.ok) throw new Error('文件加载失败')
      const ab = await resp.arrayBuffer()
      const data = parsePriceData(ab)
      saveToStorage(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-morandi-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-morandi-text-light">加载成本报价数据...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="bg-white rounded-xl p-8 shadow-sm text-center max-w-md">
          <DollarSign className="w-10 h-10 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-morandi-text mb-2">成本报价数据加载失败</h3>
          <p className="text-sm text-morandi-text-light">{error}</p>
        </div>
      </div>
    )
  }

  const suppliers = [...new Set(items.map(it => it.supplier).filter(Boolean))]
  const categories = [...new Set(items.map(it => it.category).filter(Boolean))]

  const catStats = {}
  categories.forEach(cat => {
    catStats[cat] = items.filter(it => it.category === cat).length
  })

  const supplierStats = {}
  suppliers.forEach(s => {
    supplierStats[s] = items.filter(it => it.supplier === s).length
  })

  const filtered = items.filter(it => {
    if (filterCat !== 'all' && it.category !== filterCat) return false
    if (filterSupplier !== 'all' && it.supplier !== filterSupplier) return false
    return true
  })

  const extractCostPerBottle = (notes) => {
    if (!notes) return null
    const m = notes.match(/成本[约]?([\d.]+)元\/瓶/)
    return m ? parseFloat(m[1]) : null
  }

  const costItems = items.filter(it => extractCostPerBottle(it.notes) != null)
  const avgCost = costItems.length > 0
    ? (costItems.reduce((s, it) => s + extractCostPerBottle(it.notes), 0) / costItems.length).toFixed(2)
    : null

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-morandi-text flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-morandi-primary" />
            成本与报价锁定
          </h2>
          <p className="text-[10px] text-morandi-text-light mt-0.5">数据来源：各供应商起订量及价格清单表 · 支持手动编辑与新增</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-morandi-primary"
          >
            <option value="all">全部类别</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat} ({catStats[cat] || 0})</option>
            ))}
          </select>
          <select
            value={filterSupplier}
            onChange={e => setFilterSupplier(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-morandi-primary"
          >
            <option value="all">全部供应商</option>
            {suppliers.map(s => (
              <option key={s} value={s}>{s} ({supplierStats[s] || 0})</option>
            ))}
          </select>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-morandi-primary rounded-lg hover:bg-morandi-primary/90"
          >
            <Plus className="w-3 h-3" />新增报价
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
            title="重置为原始文件数据"
          >
            <RotateCcw className="w-3 h-3" />重置
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center gap-1.5 mb-2">
            <Factory className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[10px] font-medium text-blue-600">供应商数</span>
          </div>
          <div className="text-2xl font-bold text-blue-700">{suppliers.length}</div>
          <div className="text-[9px] text-blue-400 mt-0.5">家供应商报价</div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-4 border border-purple-100">
          <div className="flex items-center gap-1.5 mb-2">
            <Tag className="w-3.5 h-3.5 text-purple-500" />
            <span className="text-[10px] font-medium text-purple-600">产品类别</span>
          </div>
          <div className="text-2xl font-bold text-purple-700">{categories.length}</div>
          <div className="text-[9px] text-purple-400 mt-0.5">{categories.join(' / ')}</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl p-4 border border-green-100">
          <div className="flex items-center gap-1.5 mb-2">
            <Scale className="w-3.5 h-3.5 text-green-500" />
            <span className="text-[10px] font-medium text-green-600">报价条目</span>
          </div>
          <div className="text-2xl font-bold text-green-700">{items.length}</div>
          <div className="text-[9px] text-green-400 mt-0.5">含阶梯价格</div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl p-4 border border-amber-100">
          <div className="flex items-center gap-1.5 mb-2">
            <DollarSign className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] font-medium text-amber-600">平均瓶成本</span>
          </div>
          <div className="text-2xl font-bold text-amber-700">{avgCost || '—'}</div>
          <div className="text-[9px] text-amber-400 mt-0.5">元/瓶（基于备注提取）</div>
        </div>
      </div>

      {suppliers.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-morandi-text mb-4 flex items-center gap-1.5">
            <Factory className="w-4 h-4 text-morandi-primary" />
            供应商报价对比
          </h3>
          <div className="space-y-4">
            {suppliers.map(supplier => {
              const supplierItems = items.filter(it => it.supplier === supplier)
              const supplierCats = [...new Set(supplierItems.map(it => it.category))]
              const taxNote = supplier.includes('不含税') ? '（不含税13%）' : supplier.includes('含税') ? '（含税）' : ''

              return (
                <div key={supplier} className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Factory className="w-4 h-4 text-morandi-primary" />
                      <span className="text-sm font-semibold text-morandi-text">{supplier.replace(/（.*）/, '')}</span>
                      {taxNote && <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">{taxNote}</span>}
                    </div>
                    <div className="flex gap-1">
                      {supplierCats.map(cat => {
                        const c = CATEGORY_COLORS[cat] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }
                        return (
                          <span key={cat} className={`px-2 py-0.5 rounded text-[10px] font-medium ${c.bg} ${c.text} border ${c.border}`}>
                            {cat}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/50">
                          <th className="text-left py-2 px-4 font-semibold text-morandi-text w-28">产品名称</th>
                          <th className="text-left py-2 px-4 font-semibold text-morandi-text w-20">规格</th>
                          <th className="text-left py-2 px-4 font-semibold text-morandi-text w-20">起订量</th>
                          <th className="text-left py-2 px-4 font-semibold text-morandi-text">价格条件</th>
                          <th className="text-left py-2 px-4 font-semibold text-morandi-text w-28">单价</th>
                          <th className="text-left py-2 px-4 font-semibold text-morandi-text">瓶成本</th>
                          <th className="text-left py-2 px-4 font-semibold text-morandi-text w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {supplierItems.map(it => {
                          const cost = extractCostPerBottle(it.notes)
                          return (
                            <tr key={it.id} className="border-b border-gray-50 hover:bg-gray-50/30">
                              <td className="py-2 px-4 font-medium text-morandi-text">{it.productName || '—'}</td>
                              <td className="py-2 px-4 text-morandi-text-light">{it.spec || '—'}</td>
                              <td className="py-2 px-4 text-morandi-text-light">{it.moq || '—'}</td>
                              <td className="py-2 px-4 text-morandi-text-light">{it.priceCondition || '—'}</td>
                              <td className="py-2 px-4 font-semibold text-morandi-primary">{it.unitPrice || '—'}</td>
                              <td className="py-2 px-4">
                                {cost != null ? (
                                  <span className="font-semibold text-amber-600">{cost}元/瓶</span>
                                ) : '—'}
                              </td>
                              <td className="py-2 px-4">
                                <div className="flex items-center gap-0.5">
                                  <button
                                    onClick={() => setEditItem(it)}
                                    className="p-1 hover:bg-blue-50 rounded text-gray-300 hover:text-blue-500 transition-colors"
                                    title="编辑"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(it.id)}
                                    className="p-1 hover:bg-red-50 rounded text-gray-300 hover:text-red-400 transition-colors"
                                    title="删除"
                                  >
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
                  {supplierItems.some(it => it.notes) && (
                    <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100">
                      <div className="space-y-1.5">
                        {supplierItems.filter(it => it.notes).map(it => (
                          <div key={it.id} className="flex items-start gap-2">
                            <FileText className="w-3 h-3 text-gray-300 mt-0.5 flex-shrink-0" />
                            <div>
                              <span className="text-[10px] text-gray-400">{it.productName} {it.spec} · {it.priceCondition}:</span>
                              <span className="text-[10px] text-morandi-text ml-1">{it.notes}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-morandi-text mb-4 flex items-center gap-1.5">
          <Package className="w-4 h-4 text-morandi-primary" />
          全部报价明细
          <span className="text-[10px] text-morandi-text-light font-normal ml-1">({filtered.length} 条)</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-3 font-semibold text-morandi-text">供应商</th>
                <th className="text-left py-2 px-3 font-semibold text-morandi-text">类别</th>
                <th className="text-left py-2 px-3 font-semibold text-morandi-text">产品名称</th>
                <th className="text-left py-2 px-3 font-semibold text-morandi-text">规格</th>
                <th className="text-left py-2 px-3 font-semibold text-morandi-text">起订量</th>
                <th className="text-left py-2 px-3 font-semibold text-morandi-text">价格条件</th>
                <th className="text-left py-2 px-3 font-semibold text-morandi-text">单价</th>
                <th className="text-left py-2 px-3 font-semibold text-morandi-text">瓶成本</th>
                <th className="text-left py-2 px-3 font-semibold text-morandi-text w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(it => {
                const cost = extractCostPerBottle(it.notes)
                const c = CATEGORY_COLORS[it.category] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }
                return (
                  <tr key={it.id} className="border-b border-gray-50 hover:bg-gray-50/30">
                    <td className="py-2 px-3 font-medium text-morandi-text max-w-[140px] truncate">{it.supplier}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${c.bg} ${c.text} border ${c.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${c.accent || 'bg-gray-400'}`} />
                        {it.category}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-morandi-text">{it.productName || '—'}</td>
                    <td className="py-2 px-3 text-morandi-text-light">{it.spec || '—'}</td>
                    <td className="py-2 px-3 text-morandi-text-light">{it.moq || '—'}</td>
                    <td className="py-2 px-3 text-morandi-text-light">{it.priceCondition || '—'}</td>
                    <td className="py-2 px-3 font-semibold text-morandi-primary">{it.unitPrice || '—'}</td>
                    <td className="py-2 px-3">
                      {cost != null ? (
                        <span className="font-semibold text-amber-600">{cost}元</span>
                      ) : '—'}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => setEditItem(it)} className="p-1 hover:bg-blue-50 rounded text-gray-300 hover:text-blue-500 transition-colors" title="编辑">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDelete(it.id)} className="p-1 hover:bg-red-50 rounded text-gray-300 hover:text-red-400 transition-colors" title="删除">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-sm text-morandi-text-light">无匹配数据</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(editItem || showAdd) && (
        <EditModal
          item={editItem || { id: '', supplier: '', category: '', productName: '', spec: '', moq: '', priceCondition: '', unitPrice: '', notes: '' }}
          onSave={editItem ? handleSave : handleAdd}
          onClose={() => { setEditItem(null); setShowAdd(false) }}
        />
      )}
    </div>
  )
}
