import { useState, useEffect } from 'react'
import {
  Box, ChevronDown, ChevronUp, Plus, Trash2
} from 'lucide-react'
import { persistGet, persistSet } from '../utils/persist'

const STORAGE_KEY = 'project-flow-data-v2'
const NOTES_KEY = 'project-flow-notes-v1'
const PRODUCT_PROGRESS_KEY = 'product-progress-v1'

const PRODUCTS = [
  { id: 'hairdryer', name: '吹风机', color: 'rose' },
  { id: 'pillow', name: '枕头', color: 'blue' },
  { id: 'hairmask', name: '发膜', color: 'purple' },
  { id: 'essentialoil', name: '精油喷雾', color: 'green' },
  { id: 'fragrance', name: '香薰', color: 'amber' },
  { id: 'gloves', name: '家用手套', color: 'teal' },
]

const PRODUCT_COLORS = {
  rose: { bg: 'bg-workspace-surface-subtle', text: 'text-workspace-text', bar: 'bg-rose-400', dot: 'bg-workspace-surface-subtle0', light: 'bg-workspace-surface-subtle' },
  blue: { bg: 'bg-workspace-surface-subtle', text: 'text-workspace-primary', bar: 'bg-blue-400', dot: 'bg-workspace-surface-subtle0', light: 'bg-workspace-surface-subtle' },
  purple: { bg: 'bg-workspace-surface-subtle', text: 'text-workspace-text', bar: 'bg-purple-400', dot: 'bg-workspace-surface-subtle0', light: 'bg-workspace-surface-subtle' },
  green: { bg: 'bg-workspace-success-soft', text: 'text-workspace-success', bar: 'bg-green-400', dot: 'bg-workspace-success-soft0', light: 'bg-workspace-success-soft' },
  amber: { bg: 'bg-workspace-warning-soft', text: 'text-workspace-warning', bar: 'bg-amber-400', dot: 'bg-workspace-warning-soft0', light: 'bg-workspace-warning-soft' },
  teal: { bg: 'bg-workspace-surface-subtle', text: 'text-workspace-text', bar: 'bg-teal-400', dot: 'bg-workspace-surface-subtle0', light: 'bg-workspace-surface-subtle' },
}

const PRODUCT_NODES = [
  { id: 'sample', title: '样品', icon: '🔬' },
  { id: 'packaging', title: '内外包材', icon: '📦' },
  { id: 'cost', title: '成本利润核算', icon: '💰' },
  { id: 'listing', title: 'Listing编写', icon: '📝' },
]

const BLOCK_COLORS = {
  blue: { bg: 'bg-workspace-surface-subtle', border: 'border-workspace-border', text: 'text-workspace-primary', accent: 'bg-workspace-surface-subtle0', light: 'bg-workspace-surface-subtle', bar: 'bg-blue-400' },
}

const PROGRESS_OPTIONS = ['未开始', '进行中', '已完成']

function isNodeDoneForAnyProduct(nodeData, nodeId) {
  const entries = nodeData[nodeId]?.entries || []
  return entries.some(e => e.progress === '已完成')
}

export default function ProjectFlow({ nodeStatuses, onNodeSelect }) {
  const [nodeData, setNodeData] = useState(() => {
    const data = {}
    ;['sample', 'packaging', 'cost', 'listing'].forEach(s => {
      data[s] = { entries: [] }
    })
    return data
  })
  const [expandedNode, setExpandedNode] = useState(null)
  const [notes, setNotes] = useState(() => persistGet(NOTES_KEY) || '')
  const [notesEditing, setNotesEditing] = useState(false)
  const [productProgress, setProductProgress] = useState(() => persistGet(PRODUCT_PROGRESS_KEY) || {})

  useEffect(() => {
    try {
      const saved = persistGet(STORAGE_KEY)
      if (saved) {
        const defaults = {}
        ;['sample', 'packaging', 'cost', 'listing'].forEach(s => {
          defaults[s] = { entries: [] }
        })
        setNodeData({ ...defaults, ...saved })
      }
    } catch {}
  }, [])

  const saveData = (data) => {
    setNodeData(data)
    persistSet(STORAGE_KEY, data)
  }

  const saveNotes = (text) => {
    setNotes(text)
    persistSet(NOTES_KEY, text)
  }

  const saveProductProgress = (data) => {
    setProductProgress(data)
    persistSet(PRODUCT_PROGRESS_KEY, data)
  }

  const addEntry = (nodeId) => {
    const entries = [...(nodeData[nodeId]?.entries || []), { product: PRODUCTS[0].name, time: '', progress: '未开始', note: '' }]
    saveData({ ...nodeData, [nodeId]: { entries } })
  }

  const updateEntry = (nodeId, index, field, value) => {
    const entries = [...(nodeData[nodeId]?.entries || [])]
    entries[index] = { ...entries[index], [field]: value }
    saveData({ ...nodeData, [nodeId]: { entries } })
  }

  const removeEntry = (nodeId, index) => {
    const entries = [...(nodeData[nodeId]?.entries || [])]
    entries.splice(index, 1)
    saveData({ ...nodeData, [nodeId]: { entries } })
  }

  const toggleExpand = (nodeId) => {
    setExpandedNode(prev => prev === nodeId ? null : nodeId)
  }

  const getProgressColor = (progress) => {
    if (progress === '已完成') return { bg: 'bg-workspace-success-soft', border: 'border-green-300', dot: 'bg-workspace-success-soft0', text: 'text-workspace-success' }
    if (progress === '进行中') return { bg: 'bg-workspace-warning-soft', border: 'border-amber-200', dot: 'bg-workspace-warning-soft0', text: 'text-workspace-warning' }
    return { bg: 'bg-workspace-surface-subtle', border: 'border-workspace-border', dot: 'bg-gray-300', text: 'text-workspace-text-tertiary' }
  }

  const productStats = (() => {
    const total = PRODUCTS.length * PRODUCT_NODES.length
    const done = PRODUCTS.reduce((s, p) => s + PRODUCT_NODES.filter(n => (productProgress[p.id] || {})[n.id]?.trim()).length, 0)
    return { done, total, pct: total > 0 ? Math.round(done / total * 100) : 0 }
  })()

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-morandi-text">项目流程总览</h2>
        <p className="text-xs text-morandi-text-light mt-0.5">点击节点展开，按产品填写进度信息</p>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-workspace-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-morandi-text">📝 工作跟进信息</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-morandi-text-light">自动保存</span>
            <button
              onClick={() => setNotesEditing(!notesEditing)}
              className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
            >
              {notesEditing ? '完成编辑' : '编辑'}
            </button>
          </div>
        </div>
        {notesEditing ? (
          <textarea
            value={notes}
            onChange={(e) => saveNotes(e.target.value)}
            placeholder="在此输入工作跟进信息，如：关键节点、待办事项、风险提示、协调事项等..."
            className="w-full min-h-[120px] text-xs text-morandi-text leading-relaxed p-3 border border-workspace-border rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 placeholder:text-gray-300"
          />
        ) : (
          <div
            className="min-h-[60px] text-xs text-morandi-text leading-relaxed p-3 border border-workspace-border rounded-lg bg-workspace-surface-subtle/50 whitespace-pre-wrap"
          >
            {notes || <span className="text-gray-300">暂无跟进信息，点击「编辑」添加...</span>}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-workspace-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-morandi-text">产品进度</span>
          <span className="text-xs text-morandi-primary font-semibold">{productStats.pct}%</span>
        </div>
        <div className="h-2.5 bg-workspace-surface-subtle rounded-full overflow-hidden">
          <div className="h-full bg-blue-400 rounded-full transition-all duration-500" style={{ width: `${productStats.pct}%` }} />
        </div>
        <div className="flex items-center gap-1 mt-2">
          <span className="w-2 h-2 rounded-full bg-workspace-surface-subtle0" />
          <span className="text-xs text-morandi-text-light">产品进度 {productStats.done}/{productStats.total}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-workspace-border overflow-hidden">
        <div className="px-5 py-3 flex items-center justify-between bg-workspace-surface-subtle border-b border-workspace-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-workspace-surface-subtle">
              <Box className="w-3.5 h-3.5 text-workspace-primary" />
            </div>
            <h3 className="text-sm font-bold text-workspace-primary">产品进度</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 bg-white/50 rounded-full overflow-hidden">
              <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${productStats.pct}%` }} />
            </div>
            <span className="text-xs font-bold text-workspace-primary">{productStats.done}/{productStats.total}</span>
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {PRODUCTS.map(product => {
            const pc = PRODUCT_COLORS[product.color]
            const prodData = productProgress[product.id] || {}
            const filledCount = PRODUCT_NODES.filter(n => prodData[n.id]?.trim()).length
            return (
              <div key={product.id} className={`rounded-xl border ${pc.dot.replace('bg-', 'border-').replace(/-\d+/, '-200')} bg-white p-4`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-3 h-3 rounded-full ${pc.dot}`} />
                  <span className="text-sm font-bold text-morandi-text">{product.name}</span>
                  <span className="text-xs text-morandi-text-light">{filledCount}/{PRODUCT_NODES.length} 已填写</span>
                  {filledCount === PRODUCT_NODES.length && <span className="text-xs px-1.5 py-0.5 rounded bg-workspace-success-soft text-workspace-success border border-green-200">✓ 完成</span>}
                </div>
                <div className="space-y-3">
                  {PRODUCT_NODES.map(node => (
                    <div key={node.id}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs">{node.icon}</span>
                        <span className="text-xs font-semibold text-morandi-text-light">{node.title}</span>
                        {prodData[node.id]?.trim() && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
                      </div>
                      <textarea
                        value={prodData[node.id] || ''}
                        onChange={(e) => {
                          const newData = { ...productProgress, [product.id]: { ...prodData, [node.id]: e.target.value } }
                          saveProductProgress(newData)
                        }}
                        placeholder={`输入${node.title}相关内容...`}
                        className="w-full min-h-[56px] text-xs text-morandi-text leading-relaxed p-2.5 border border-workspace-border rounded-lg resize-y focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300 placeholder:text-gray-300 bg-white"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
