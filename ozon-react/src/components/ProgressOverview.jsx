import { useState } from 'react'
import { ROADMAP_PHASES, NODE_DETAILS } from '../data/roadmap'
import {
  BarChart3, TrendingUp, CheckCircle2, Clock, AlertTriangle,
  ChevronRight, Target, Package
} from 'lucide-react'

const PRODUCTS = [
  {
    id: 'hairdryer', name: '吹风机', icon: '💇', color: 'rose',
    phases: [
      { name: '选品与调研', nodes: ['n1', 'n2', 'n36', 'n4'] },
      { name: '产品与供应链', nodes: ['n5', 'n6', 'n7', 'n37', 'n8'] },
      { name: '合规与账号', nodes: ['n9', 'n10'] },
      { name: '生产与物流', nodes: ['n15', 'n16', 'n17', 'n18', 'n19'] },
      { name: '上架和运营', nodes: ['n14', 'n20', 'n21', 'n22', 'n23', 'n24', 'n25', 'n26', 'n27', 'n28'] },
      { name: '物流和回款', nodes: ['n29', 'n30', 'n31', 'n32', 'n33'] },
      { name: '迭代与扩展', nodes: ['n34', 'n35'] },
    ]
  },
  {
    id: 'pillow', name: '枕头', icon: '🛏️', color: 'blue',
    phases: [
      { name: '选品与调研', nodes: ['n1', 'n2', 'n36', 'n4'] },
      { name: '产品与供应链', nodes: ['n5', 'n6', 'n7', 'n37', 'n8'] },
      { name: '合规与账号', nodes: ['n9', 'n10', 'n11'] },
      { name: '生产与物流', nodes: ['n15', 'n16', 'n17', 'n18', 'n19'] },
      { name: '上架和运营', nodes: ['n14', 'n20', 'n21', 'n22', 'n23', 'n24', 'n25', 'n26', 'n27', 'n28'] },
      { name: '物流和回款', nodes: ['n29', 'n30', 'n31', 'n32', 'n33'] },
      { name: '迭代与扩展', nodes: ['n34', 'n35'] },
    ]
  },
  {
    id: 'hairmask', name: '发膜', icon: '🧴', color: 'purple',
    phases: [
      { name: '选品与调研', nodes: ['n1', 'n2', 'n36', 'n4'] },
      { name: '产品与供应链', nodes: ['n5', 'n6', 'n7', 'n37', 'n8'] },
      { name: '合规与账号', nodes: ['n9', 'n10', 'n11', 'n12'] },
      { name: '生产与物流', nodes: ['n15', 'n16', 'n17', 'n18', 'n19'] },
      { name: '上架和运营', nodes: ['n14', 'n20', 'n21', 'n22', 'n23', 'n24', 'n25', 'n26', 'n27', 'n28'] },
      { name: '物流和回款', nodes: ['n29', 'n30', 'n31', 'n32', 'n33'] },
      { name: '迭代与扩展', nodes: ['n34', 'n35'] },
    ]
  },
  {
    id: 'essentialoil', name: '精油喷雾', icon: '🌿', color: 'green',
    phases: [
      { name: '选品与调研', nodes: ['n1', 'n2', 'n36', 'n4'] },
      { name: '产品与供应链', nodes: ['n5', 'n6', 'n7', 'n37', 'n8'] },
      { name: '合规与账号', nodes: ['n9', 'n10', 'n11', 'n12'] },
      { name: '生产与物流', nodes: ['n15', 'n16', 'n17', 'n18', 'n19'] },
      { name: '上架和运营', nodes: ['n14', 'n20', 'n21', 'n22', 'n23', 'n24', 'n25', 'n26', 'n27', 'n28'] },
      { name: '物流和回款', nodes: ['n29', 'n30', 'n31', 'n32', 'n33'] },
      { name: '迭代与扩展', nodes: ['n34', 'n35'] },
    ]
  },
]

const COLOR_MAP = {
  rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', accent: 'bg-rose-500', light: 'bg-rose-100', bar: 'bg-rose-400' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', accent: 'bg-blue-500', light: 'bg-blue-100', bar: 'bg-blue-400' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', accent: 'bg-purple-500', light: 'bg-purple-100', bar: 'bg-purple-400' },
  green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', accent: 'bg-green-500', light: 'bg-green-100', bar: 'bg-green-400' },
}

const STATUS_DOT = {
  done: 'bg-green-500',
  progress: 'bg-amber-500',
  pending: 'bg-gray-300',
}

const PHASE_ICONS = {
  '选品与调研': '🧭',
  '产品与供应链': '🏭',
  '合规与账号': '⚖️',
  '生产与物流': '📦',
  '上架和运营': '🚀',
  '物流和回款': '💳',
  '迭代与扩展': '🔁',
}

export default function ProgressOverview({ nodeStatuses, onNodeSelect }) {
  const [expandedProduct, setExpandedProduct] = useState(null)

  const getStatus = (nodeId) => nodeStatuses?.[nodeId] || 'pending'

  const getNodeTitle = (nodeId) => {
    for (const phase of ROADMAP_PHASES) {
      const node = phase.nodes.find(n => n.id === nodeId)
      if (node) return node.title
    }
    return nodeId
  }

  const getProductStats = (product) => {
    const allNodeIds = product.phases.flatMap(p => p.nodes)
    const total = allNodeIds.length
    const done = allNodeIds.filter(id => getStatus(id) === 'done').length
    const progress = allNodeIds.filter(id => getStatus(id) === 'progress').length
    return { total, done, progress, pending: total - done - progress, pct: total > 0 ? Math.round(done / total * 100) : 0 }
  }

  const getPhaseStats = (phase) => {
    const total = phase.nodes.length
    const done = phase.nodes.filter(id => getStatus(id) === 'done').length
    return { total, done, pct: total > 0 ? Math.round(done / total * 100) : 0 }
  }

  const allStats = PRODUCTS.map(p => ({ ...p, stats: getProductStats(p) }))
  const totalAll = allStats.reduce((s, p) => s + p.stats.total, 0)
  const doneAll = allStats.reduce((s, p) => s + p.stats.done, 0)

  const getBottleneck = () => {
    let bottleneck = null
    let minPct = 100
    PRODUCTS.forEach(p => {
      p.phases.forEach(phase => {
        const stats = getPhaseStats(phase)
        if (stats.pct < minPct && stats.total > 0) {
          minPct = stats.pct
          bottleneck = { product: p.name, phase: phase.name, pct: stats.pct }
        }
      })
    })
    return bottleneck
  }

  const bottleneck = getBottleneck()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-morandi-text flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-morandi-primary" />
            项目进度总览
          </h2>
          <p className="text-[10px] text-morandi-text-light mt-0.5">按产品品类跟踪各阶段进度</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center gap-1.5 mb-2">
            <Package className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[10px] font-medium text-blue-600">产品线</span>
          </div>
          <div className="text-2xl font-bold text-blue-700">{PRODUCTS.length}</div>
          <div className="text-[9px] text-blue-400 mt-0.5">个品类并行</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl p-4 border border-green-100">
          <div className="flex items-center gap-1.5 mb-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            <span className="text-[10px] font-medium text-green-600">总完成率</span>
          </div>
          <div className="text-2xl font-bold text-green-700">{totalAll > 0 ? Math.round(doneAll / totalAll * 100) : 0}%</div>
          <div className="text-[9px] text-green-400 mt-0.5">{doneAll}/{totalAll} 节点</div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl p-4 border border-amber-100">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] font-medium text-amber-600">推进中</span>
          </div>
          <div className="text-2xl font-bold text-amber-700">{allStats.reduce((s, p) => s + p.stats.progress, 0)}</div>
          <div className="text-[9px] text-amber-400 mt-0.5">个节点执行中</div>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100/50 rounded-xl p-4 border border-red-100">
          <div className="flex items-center gap-1.5 mb-2">
            <Target className="w-3.5 h-3.5 text-red-500" />
            <span className="text-[10px] font-medium text-red-600">瓶颈</span>
          </div>
          <div className="text-sm font-bold text-red-700 truncate">{bottleneck ? `${bottleneck.product}` : '无'}</div>
          <div className="text-[9px] text-red-400 mt-0.5 truncate">{bottleneck ? `${bottleneck.phase} ${bottleneck.pct}%` : '进度正常'}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <h3 className="text-xs font-semibold text-morandi-text mb-3">各产品进度对比</h3>
        <div className="space-y-3">
          {allStats.map(p => {
            const colors = COLOR_MAP[p.color]
            return (
              <div key={p.id} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${colors.light}`}>{p.icon}</div>
                <span className="text-xs font-medium text-morandi-text w-16">{p.name}</span>
                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${colors.bar} rounded-full transition-all duration-500`} style={{ width: `${p.stats.pct}%` }} />
                </div>
                <span className="text-xs font-semibold text-morandi-text w-10 text-right">{p.stats.pct}%</span>
                <span className="text-[9px] text-morandi-text-light w-16 text-right">{p.stats.done}/{p.stats.total}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="space-y-3">
        {PRODUCTS.map(product => {
          const stats = getProductStats(product)
          const colors = COLOR_MAP[product.color]
          const isExpanded = expandedProduct === product.id
          return (
            <div key={product.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${isExpanded ? `${colors.border}` : 'border-gray-100'}`}>
              <button
                onClick={() => setExpandedProduct(isExpanded ? null : product.id)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${colors.light}`}>{product.icon}</div>
                  <div className="text-left">
                    <h3 className="text-sm font-bold text-morandi-text">{product.name}</h3>
                    <p className="text-[10px] text-morandi-text-light">{stats.done}/{stats.total} 节点已完成 · {stats.progress} 进行中</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${colors.bar} rounded-full transition-all duration-500`} style={{ width: `${stats.pct}%` }} />
                  </div>
                  <span className={`text-xs font-bold ${colors.text}`}>{stats.pct}%</span>
                  <ChevronRight className={`w-4 h-4 text-gray-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </div>
              </button>

              {isExpanded && (
                <div className="px-5 pb-4 space-y-3">
                  {product.phases.map((phase, pi) => {
                    const phaseStats = getPhaseStats(phase)
                    const phaseIcon = PHASE_ICONS[phase.name] || '📋'
                    return (
                      <div key={pi} className="border border-gray-100 rounded-lg overflow-hidden">
                        <div className={`px-4 py-2.5 flex items-center justify-between ${phaseStats.pct === 100 ? 'bg-green-50/50' : 'bg-gray-50/50'}`}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs">{phaseIcon}</span>
                            <span className="text-xs font-semibold text-morandi-text">{phase.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div className={`h-full ${colors.bar} rounded-full transition-all`} style={{ width: `${phaseStats.pct}%` }} />
                            </div>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${phaseStats.pct === 100 ? 'bg-green-100 text-green-700' : phaseStats.pct > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                              {phaseStats.done}/{phaseStats.total}
                            </span>
                          </div>
                        </div>
                        <div className="px-4 py-2 grid grid-cols-2 gap-1.5">
                          {phase.nodes.map(nodeId => {
                            const status = getStatus(nodeId)
                            const title = getNodeTitle(nodeId)
                            return (
                              <button
                                key={nodeId}
                                onClick={() => onNodeSelect?.(nodeId)}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors text-left group"
                              >
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[status]}`} />
                                <span className="text-[11px] text-morandi-text group-hover:text-morandi-primary truncate">{title}</span>
                                {status === 'done' && <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0 ml-auto" />}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
