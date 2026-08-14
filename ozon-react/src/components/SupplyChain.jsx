import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import {
  Factory, Plus, Pencil, Trash2, ChevronDown, ChevronUp, X, Save, RotateCcw,
  MapPin, Clock, Building2, Shield, Package, DollarSign, FileCheck, Users,
  Truck, Lightbulb, Star, Phone, FileText, ClipboardCheck, Tag
} from 'lucide-react'
import { persistGet, persistSet, persistRemove } from '../utils/persist'
import { getDataUrl } from '../utils/runtime.js'

const SUPPLY_FILE = getDataUrl('2026年Ozon平台供应链工厂目录0406.xlsx')
const STORAGE_KEY = 'supply-chain-factories'

const CATEGORY_KEYWORDS = {
  '吹风机': ['吹风机', '电吹风', '热风梳', '卷发棒', '高速吹风机', '折叠吹风机', '便携', '精油吹风机'],
  '枕头': ['枕头', '床垫', '寝具', '记忆棉'],
  '发膜': ['发膜', '洗护', '护发素', '洗发水', '护法精华', '修复', '角蛋白'],
  '精油': ['精油', '香氛', '次抛', '精华液', '头皮精华'],
}

const CATEGORY_COLORS = {
  '吹风机': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', accent: 'bg-rose-500', light: 'bg-rose-100' },
  '枕头': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', accent: 'bg-blue-500', light: 'bg-blue-100' },
  '发膜': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', accent: 'bg-purple-500', light: 'bg-purple-100' },
  '精油': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', accent: 'bg-green-500', light: 'bg-green-100' },
}

const CATEGORY_LUCIDE = {
  '吹风机': 'Wind',
  '枕头': 'Moon',
  '发膜': 'Droplets',
  '精油': 'Leaf',
}

const FIELDS = [
  { key: 'name', label: '企业名称', type: 'text', required: true },
  { key: 'contact', label: '联系人/电话', type: 'text' },
  { key: 'address', label: '企业地址', type: 'text' },
  { key: 'mainCategory', label: '主营类目', type: 'text' },
  { key: 'productDetail', label: '产品详情', type: 'textarea' },
  { key: 'experience', label: '行业资历', type: 'text' },
  { key: 'scale', label: '工厂规模', type: 'text' },
  { key: 'businessModel', label: '业务模式', type: 'text' },
  { key: 'markets', label: '销售市场', type: 'text' },
  { key: 'certification', label: '认证情况', type: 'textarea' },
  { key: 'qualityProcess', label: '品控流程', type: 'textarea' },
  { key: 'moq', label: '最低起订量', type: 'text' },
  { key: 'payment', label: '付款方式', type: 'text' },
  { key: 'pricing', label: '报价水平', type: 'textarea' },
  { key: 'leadTime', label: '交期', type: 'text' },
  { key: 'sample', label: '带回样品', type: 'text' },
  { key: 'suggestion', label: '工厂建议/市场信息', type: 'textarea' },
  { key: 'notes', label: '备注', type: 'textarea' },
]

function inferCategories(text) {
  const cats = []
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    if (kws.some(k => text.includes(k))) cats.push(cat)
  }
  return cats
}

function parseSupplyData(arrayBuffer) {
  const fileData = new Uint8Array(arrayBuffer)
  const workbook = XLSX.read(fileData, { type: 'array' })
  const ws = workbook.Sheets[workbook.SheetNames[0]]
  const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 })
  if (jsonData.length < 5) return []

  const col = { seq: 0, name: 1, date: 2, inspector: 3, address: 4, certification: 5, qualityProcess: 6, mainCategory: 7, productDetail: 8, experience: 9, market: 10, scale: 11, businessModel: 12, brands: 13, moq: 14, payment: 15, pricing: 16, leadTime: 17, sample: 18, suggestion: 23, notes: 24 }

  const factories = []
  for (let i = 4; i < jsonData.length; i++) {
    const row = jsonData[i]
    if (!row || !row[col.seq]) continue
    const nameRaw = String(row[col.name] || '').trim()
    if (!nameRaw || nameRaw === '/') continue
    const parts = nameRaw.split('\n')
    const mainCat = String(row[col.mainCategory] || '')
    const prodDetail = String(row[col.productDetail] || '')
    const combined = mainCat + ' ' + prodDetail
    const marketRaw = String(row[col.market] || '').trim()

    factories.push({
      id: 'f' + row[col.seq],
      name: parts[0].trim(),
      contact: parts.length > 1 ? parts.slice(1).join(' ').trim() : '',
      address: String(row[col.address] || '').trim(),
      mainCategory: mainCat.trim(),
      productDetail: prodDetail.trim(),
      categories: inferCategories(combined),
      experience: String(row[col.experience] || '').trim(),
      scale: String(row[col.scale] || '').trim(),
      businessModel: String(row[col.businessModel] || '').trim(),
      markets: marketRaw,
      certification: String(row[col.certification] || '').trim(),
      qualityProcess: String(row[col.qualityProcess] || '').trim(),
      moq: String(row[col.moq] || '').trim(),
      payment: String(row[col.payment] || '').trim(),
      pricing: String(row[col.pricing] || '').trim(),
      leadTime: String(row[col.leadTime] || '').trim(),
      sample: String(row[col.sample] || '').trim(),
      suggestion: String(row[col.suggestion] || '').trim(),
      notes: String(row[col.notes] || '').trim(),
      source: 'file',
    })
  }
  return factories
}

function CatTag({ cat }) {
  const c = CATEGORY_COLORS[cat]
  if (!c) return null
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${c.bg} ${c.text} border ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.accent}`} />
      {cat}
    </span>
  )
}

function DetailRow({ icon: Icon, label, value }) {
  if (!value || value === '/') return null
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-gray-300 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] text-gray-400 leading-none mb-0.5">{label}</div>
        <p className="text-xs text-morandi-text leading-relaxed whitespace-pre-line">{value}</p>
      </div>
    </div>
  )
}

function EditModal({ factory, onSave, onClose }) {
  const [form, setForm] = useState(() => {
    const f = { ...factory }
    delete f.categories
    delete f.source
    return f
  })

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const handleSave = () => {
    const combined = (form.mainCategory || '') + ' ' + (form.productDetail || '')
    onSave({ ...form, categories: inferCategories(combined) })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h3 className="text-sm font-semibold text-morandi-text flex items-center gap-2">
            <Factory className="w-4 h-4 text-morandi-primary" />
            {factory.id ? '编辑工厂' : '新增工厂'}
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
          <button onClick={handleSave} className="px-4 py-2 text-xs text-white bg-morandi-primary rounded-lg hover:bg-morandi-primary/90 flex items-center gap-1">
            <Save className="w-3 h-3" />保存
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SupplyChain() {
  const [factories, setFactories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [filterCat, setFilterCat] = useState('all')
  const [editFactory, setEditFactory] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const saved = persistGet(STORAGE_KEY)
        if (saved) {
          setFactories(saved)
          setLoading(false)
          const updates = persistGet('node-updates') || {}
          if (!updates['n6']) updates['n6'] = []
          updates['n6'].push({ time: Date.now(), msg: '供应链数据已加载' })
          persistSet('node-updates', updates)
          return
        }
        const resp = await fetch(SUPPLY_FILE)
        if (!resp.ok) throw new Error('文件加载失败')
        const ab = await resp.arrayBuffer()
        const data = parseSupplyData(ab)
        if (data.length === 0) throw new Error('未解析到有效数据')
        setFactories(data)
        persistSet(STORAGE_KEY, data)
        const updates = persistGet('node-updates') || {}
        if (!updates['n6']) updates['n6'] = []
        updates['n6'].push({ time: Date.now(), msg: '供应链数据已加载' })
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
    setFactories(list)
    persistSet(STORAGE_KEY, list)
  }

  const handleSave = (updated) => {
    const idx = factories.findIndex(f => f.id === updated.id)
    if (idx >= 0) {
      const list = [...factories]
      list[idx] = { ...list[idx], ...updated }
      saveToStorage(list)
    }
    setEditFactory(null)
  }

  const handleAdd = (data) => {
    const newId = 'f_' + Date.now()
    const newF = { ...data, id: newId, source: 'manual' }
    saveToStorage([...factories, newF])
    setShowAdd(false)
  }

  const handleDelete = (id) => {
    if (!confirm('确认删除该工厂？')) return
    saveToStorage(factories.filter(f => f.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  const handleReset = async () => {
    if (!confirm('确认重置为原始文件数据？手动修改将丢失。')) return
    persistRemove(STORAGE_KEY)
    try {
      setLoading(true)
      const resp = await fetch(SUPPLY_FILE)
      if (!resp.ok) throw new Error('文件加载失败')
      const ab = await resp.arrayBuffer()
      const data = parseSupplyData(ab)
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
          <span className="text-sm text-morandi-text-light">加载供应链数据...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="bg-white rounded-xl p-8 shadow-sm text-center max-w-md">
          <Factory className="w-10 h-10 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-morandi-text mb-2">供应链数据加载失败</h3>
          <p className="text-sm text-morandi-text-light mb-4">{error}</p>
        </div>
      </div>
    )
  }

  const catStats = {}
  for (const cat of Object.keys(CATEGORY_KEYWORDS)) {
    catStats[cat] = factories.filter(f => (f.categories || []).includes(cat)).length
  }

  const certCoop = factories.filter(f => f.certification && (f.certification.includes('可配合') || f.certification.includes('帮忙做'))).length
  const sampleYes = factories.filter(f => f.sample && f.sample.startsWith('是')).length
  const hasOEM = factories.filter(f => f.businessModel && (f.businessModel.includes('OEM') || f.businessModel.includes('代工'))).length
  const hasODM = factories.filter(f => f.businessModel && (f.businessModel.includes('ODM') || f.businessModel.includes('贴牌') || f.businessModel.includes('定制'))).length

  const filtered = filterCat === 'all' ? factories : factories.filter(f => (f.categories || []).includes(filterCat))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-morandi-text flex items-center gap-2">
            <Factory className="w-5 h-5 text-morandi-primary" />
            供应链工厂目录
          </h2>
          <p className="text-[10px] text-morandi-text-light mt-0.5">数据来源：2026年Ozon平台供应链工厂目录0406 · 支持手动编辑与新增</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-morandi-primary"
          >
            <option value="all">全部品类</option>
            {Object.keys(CATEGORY_KEYWORDS).map(cat => (
              <option key={cat} value={cat}>{cat} ({catStats[cat]})</option>
            ))}
          </select>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-morandi-primary rounded-lg hover:bg-morandi-primary/90"
          >
            <Plus className="w-3 h-3" />新增工厂
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

      <div className="grid grid-cols-6 gap-3">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center gap-1.5 mb-2">
            <Factory className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[10px] font-medium text-blue-600">验厂数量</span>
          </div>
          <div className="text-2xl font-bold text-blue-700">{factories.length}</div>
          <div className="text-[9px] text-blue-400 mt-0.5">已实地验厂</div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-4 border border-purple-100">
          <div className="flex items-center gap-1.5 mb-2">
            <Package className="w-3.5 h-3.5 text-purple-500" />
            <span className="text-[10px] font-medium text-purple-600">品类覆盖</span>
          </div>
          <div className="text-2xl font-bold text-purple-700">{Object.values(catStats).filter(v => v > 0).length}/4</div>
          <div className="text-[9px] text-purple-400 mt-0.5">吹风机/枕头/发膜/精油</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl p-4 border border-green-100">
          <div className="flex items-center gap-1.5 mb-2">
            <Shield className="w-3.5 h-3.5 text-green-500" />
            <span className="text-[10px] font-medium text-green-600">认证配合</span>
          </div>
          <div className="text-2xl font-bold text-green-700">{certCoop}</div>
          <div className="text-[9px] text-green-400 mt-0.5">占 {factories.length > 0 ? Math.round(certCoop / factories.length * 100) : 0}%</div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl p-4 border border-amber-100">
          <div className="flex items-center gap-1.5 mb-2">
            <FileCheck className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] font-medium text-amber-600">样品带回</span>
          </div>
          <div className="text-2xl font-bold text-amber-700">{sampleYes}</div>
          <div className="text-[9px] text-amber-400 mt-0.5">占 {factories.length > 0 ? Math.round(sampleYes / factories.length * 100) : 0}%</div>
        </div>
        <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 rounded-xl p-4 border border-rose-100">
          <div className="flex items-center gap-1.5 mb-2">
            <Building2 className="w-3.5 h-3.5 text-rose-500" />
            <span className="text-[10px] font-medium text-rose-600">OEM代工</span>
          </div>
          <div className="text-2xl font-bold text-rose-700">{hasOEM}</div>
          <div className="text-[9px] text-rose-400 mt-0.5">家工厂支持</div>
        </div>
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-xl p-4 border border-indigo-100">
          <div className="flex items-center gap-1.5 mb-2">
            <ClipboardCheck className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-[10px] font-medium text-indigo-600">ODM定制</span>
          </div>
          <div className="text-2xl font-bold text-indigo-700">{hasODM}</div>
          <div className="text-[9px] text-indigo-400 mt-0.5">家工厂支持</div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {Object.entries(catStats).map(([cat, count]) => {
          const c = CATEGORY_COLORS[cat]
          return (
            <div
              key={cat}
              className={`p-4 rounded-xl border ${c.border} ${c.bg} cursor-pointer transition-all hover:shadow-sm ${filterCat === cat ? 'ring-2 ring-morandi-primary shadow-sm' : ''}`}
              onClick={() => setFilterCat(filterCat === cat ? 'all' : cat)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold ${c.text}`}>{cat}</span>
                <span className={`text-[10px] ${c.text} opacity-60`}>{factories.length > 0 ? Math.round(count / factories.length * 100) : 0}%</span>
              </div>
              <div className="text-2xl font-bold text-morandi-text">{count}</div>
              <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
                <div className={`h-full ${c.accent} rounded-full transition-all duration-500`} style={{ width: `${factories.length > 0 ? (count / factories.length) * 100 : 0}%` }} />
              </div>
              <div className="text-[9px] text-morandi-text-light mt-1.5">家工厂</div>
            </div>
          )
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-morandi-primary" />
            <span className="text-xs font-semibold text-morandi-text">工厂列表</span>
            <span className="text-[10px] text-morandi-text-light">({filtered.length} 家)</span>
          </div>
          <span className="text-[10px] text-gray-300">点击展开详情 · 支持编辑/删除</span>
        </div>
        <div className="divide-y divide-gray-50">
          {filtered.map(f => (
            <div key={f.id} className={expandedId === f.id ? 'bg-gray-50/30' : ''}>
              <div
                className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50/50 transition-colors"
                onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-morandi-text truncate">{f.name}</span>
                    {f.source === 'manual' && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-50 text-amber-600 border border-amber-200">手动添加</span>
                    )}
                    <div className="flex gap-1">
                      {(f.categories || []).map(cat => <CatTag key={cat} cat={cat} />)}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-[10px] text-morandi-text-light">
                    {f.mainCategory && f.mainCategory !== '/' && (
                      <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{f.mainCategory}</span>
                    )}
                    {f.moq && f.moq !== '/' && (
                      <span className="flex items-center gap-1"><Package className="w-3 h-3" />起订: {f.moq}</span>
                    )}
                    {f.leadTime && f.leadTime !== '/' && (
                      <span className="flex items-center gap-1"><Truck className="w-3 h-3" />交期: {f.leadTime}</span>
                    )}
                    {f.pricing && f.pricing !== '/' && (
                      <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{f.pricing.length > 20 ? f.pricing.substring(0, 20) + '...' : f.pricing}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={e => { e.stopPropagation(); setEditFactory(f) }}
                    className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-500 transition-colors"
                    title="编辑"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(f.id) }}
                    className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {expandedId === f.id ? <ChevronUp className="w-4 h-4 text-gray-300" /> : <ChevronDown className="w-4 h-4 text-gray-300" />}
                </div>
              </div>

              {expandedId === f.id && (
                <div className="px-5 pb-4 pt-0">
                  <div className="bg-gray-50/50 rounded-xl p-4">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                      <DetailRow icon={Phone} label="联系人/电话" value={f.contact} />
                      <DetailRow icon={MapPin} label="企业地址" value={f.address} />
                      <DetailRow icon={Clock} label="行业资历" value={f.experience} />
                      <DetailRow icon={Building2} label="工厂规模" value={f.scale} />
                      <DetailRow icon={ClipboardCheck} label="业务模式" value={f.businessModel} />
                      <DetailRow icon={Truck} label="销售市场" value={f.markets} />
                      <DetailRow icon={Shield} label="认证情况" value={f.certification} />
                      <DetailRow icon={FileCheck} label="品控流程" value={f.qualityProcess} />
                      <DetailRow icon={Package} label="最低起订量" value={f.moq} />
                      <DetailRow icon={DollarSign} label="付款方式" value={f.payment} />
                      <DetailRow icon={DollarSign} label="报价水平" value={f.pricing} />
                      <DetailRow icon={Truck} label="交期" value={f.leadTime} />
                      <DetailRow icon={FileCheck} label="带回样品" value={f.sample} />
                    </div>

                    {f.productDetail && f.productDetail !== '/' && (
                      <div className="mt-3 pt-3 border-t border-gray-200/50">
                        <DetailRow icon={FileText} label="产品详情" value={f.productDetail} />
                      </div>
                    )}

                    {f.suggestion && f.suggestion !== '/' && (
                      <div className="mt-3 p-3 bg-amber-50/80 rounded-lg border border-amber-100">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-[10px] font-semibold text-amber-700">工厂建议 / 市场信息</span>
                        </div>
                        <p className="text-xs text-amber-800 leading-relaxed whitespace-pre-line">{f.suggestion}</p>
                      </div>
                    )}

                    {f.notes && f.notes !== '/' && (
                      <div className="mt-2 p-3 bg-blue-50/80 rounded-lg border border-blue-100">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Star className="w-3.5 h-3.5 text-blue-500" />
                          <span className="text-[10px] font-semibold text-blue-700">备注</span>
                        </div>
                        <p className="text-xs text-blue-800 leading-relaxed whitespace-pre-line">{f.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="py-12 text-center">
              <Factory className="w-8 h-8 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-morandi-text-light">
                {filterCat !== 'all' ? `没有${filterCat}类别的工厂` : '暂无工厂数据，点击右上角"新增工厂"添加'}
              </p>
            </div>
          )}
        </div>
      </div>

      {(editFactory || showAdd) && (
        <EditModal
          factory={editFactory || { id: '', name: '', contact: '', address: '', mainCategory: '', productDetail: '', experience: '', scale: '', businessModel: '', markets: '', certification: '', qualityProcess: '', moq: '', payment: '', pricing: '', leadTime: '', sample: '', suggestion: '', notes: '' }}
          onSave={editFactory ? handleSave : handleAdd}
          onClose={() => { setEditFactory(null); setShowAdd(false) }}
        />
      )}
    </div>
  )
}
