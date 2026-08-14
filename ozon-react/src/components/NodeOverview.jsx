import { useState } from 'react'
import { ROADMAP_PHASES, NODE_DETAILS } from '../data/roadmap'
import {
  Map, LayoutGrid, List, Package, CheckCircle2, Clock,
  AlertTriangle, ChevronRight, Box, Store, Rocket
} from 'lucide-react'

const STATUS_CONFIG = {
  done: { label: '已完成', color: 'bg-workspace-success-soft text-workspace-success', dot: 'bg-workspace-success-soft0', icon: CheckCircle2 },
  progress: { label: '进行中', color: 'bg-workspace-warning-soft text-workspace-warning', dot: 'bg-workspace-warning-soft0', icon: Clock },
  pending: { label: '待处理', color: 'bg-workspace-surface-subtle text-workspace-text-tertiary', dot: 'bg-gray-300', icon: AlertTriangle },
}

const BLOCKS = [
  {
    id: 'product',
    title: '产品板块',
    icon: Box,
    color: 'blue',
    desc: '从选品立项到成本报价，产品全链路',
    subGroups: [
      { name: '选品与调研', nodes: ['n1', 'n2', 'n36', 'n4'] },
      { name: '产品与供应链', nodes: ['n5', 'n6', 'n7', 'n37', 'n8'] },
    ],
  },
  {
    id: 'store',
    title: '店铺和品牌板块',
    icon: Store,
    color: 'purple',
    desc: '合规认证、品牌注册、账号入驻',
    subGroups: [
      { name: '合规与认证', nodes: ['n9', 'n10'] },
      { name: '品牌与店铺', nodes: ['n11', 'n12'] },
    ],
  },
  {
    id: 'operation',
    title: '上架和运营板块',
    icon: Rocket,
    color: 'amber',
    desc: '从生产到放量增长，运营全流程',
    subGroups: [
      { name: '生产与物流', nodes: ['n15', 'n16', 'n17', 'n18', 'n19'] },
      { name: '上架与增长', nodes: ['n14', 'n20', 'n21', 'n22', 'n23', 'n24', 'n25', 'n26', 'n27', 'n28'] },
      { name: '回款与迭代', nodes: ['n29', 'n30', 'n31', 'n32', 'n33', 'n34', 'n35'] },
    ],
  },
]

const BLOCK_COLORS = {
  blue: { bg: 'bg-workspace-surface-subtle', border: 'border-workspace-border', text: 'text-workspace-primary', accent: 'bg-workspace-surface-subtle0', bar: 'bg-blue-400', light: 'bg-workspace-surface-subtle', headerBg: 'bg-workspace-surface-subtle/80' },
  purple: { bg: 'bg-workspace-surface-subtle', border: 'border-workspace-border', text: 'text-workspace-text', accent: 'bg-workspace-surface-subtle0', bar: 'bg-purple-400', light: 'bg-workspace-surface-subtle', headerBg: 'bg-workspace-surface-subtle/80' },
  amber: { bg: 'bg-workspace-warning-soft', border: 'border-amber-200', text: 'text-workspace-warning', accent: 'bg-workspace-warning-soft0', bar: 'bg-amber-400', light: 'bg-workspace-warning-soft', headerBg: 'bg-workspace-warning-soft/80' },
}

const PRODUCTS = [
  { id: 'hairdryer', name: '吹风机', color: 'rose', icon: '💇' },
  { id: 'pillow', name: '枕头', color: 'blue', icon: '🛏️' },
  { id: 'hairmask', name: '发膜', color: 'purple', icon: '🧴' },
  { id: 'essentialoil', name: '精油喷雾', color: 'green', icon: '🌿' },
]

const PRODUCT_COLOR_MAP = {
  rose: { bg: 'bg-workspace-surface-subtle', border: 'border-rose-200', text: 'text-workspace-text', accent: 'bg-workspace-surface-subtle0' },
  blue: { bg: 'bg-workspace-surface-subtle', border: 'border-workspace-border', text: 'text-workspace-primary', accent: 'bg-workspace-surface-subtle0' },
  purple: { bg: 'bg-workspace-surface-subtle', border: 'border-workspace-border', text: 'text-workspace-text', accent: 'bg-workspace-surface-subtle0' },
  green: { bg: 'bg-workspace-success-soft', border: 'border-green-200', text: 'text-workspace-success', accent: 'bg-workspace-success-soft0' },
}

const PRODUCT_NODE_MAP = {
  hairdryer: ['n1', 'n2', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n10', 'n15', 'n16', 'n17', 'n18', 'n19', 'n14', 'n20', 'n21', 'n22', 'n23', 'n24', 'n25', 'n26', 'n27', 'n28', 'n29', 'n30', 'n31', 'n32', 'n33', 'n34', 'n35'],
  pillow: ['n1', 'n2', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n10', 'n11', 'n15', 'n16', 'n17', 'n18', 'n19', 'n14', 'n20', 'n21', 'n22', 'n23', 'n24', 'n25', 'n26', 'n27', 'n28', 'n29', 'n30', 'n31', 'n32', 'n33', 'n34', 'n35'],
  hairmask: ['n1', 'n2', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n10', 'n11', 'n12', 'n15', 'n16', 'n17', 'n18', 'n19', 'n14', 'n20', 'n21', 'n22', 'n23', 'n24', 'n25', 'n26', 'n27', 'n28', 'n29', 'n30', 'n31', 'n32', 'n33', 'n34', 'n35'],
  essentialoil: ['n1', 'n2', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n10', 'n11', 'n12', 'n15', 'n16', 'n17', 'n18', 'n19', 'n14', 'n20', 'n21', 'n22', 'n23', 'n24', 'n25', 'n26', 'n27', 'n28', 'n29', 'n30', 'n31', 'n32', 'n33', 'n34', 'n35'],
}

const VIEW_MODES = [
  { key: 'block', label: '按板块', icon: LayoutGrid },
  { key: 'status', label: '按状态', icon: List },
  { key: 'product', label: '按产品', icon: Package },
]

function getNodeById(nodeId) {
  for (const phase of ROADMAP_PHASES) {
    const node = phase.nodes.find(n => n.id === nodeId)
    if (node) return node
  }
  return null
}

export default function NodeOverview({ nodeStatuses, onNodeSelect }) {
  const [viewMode, setViewMode] = useState('block')

  const getStatus = (nodeId) => nodeStatuses?.[nodeId] || 'pending'

  const allNodes = ROADMAP_PHASES.flatMap(p => p.nodes)
  const totalNodes = allNodes.length
  const doneNodes = allNodes.filter(n => getStatus(n.id) === 'done').length
  const progressNodes = allNodes.filter(n => getStatus(n.id) === 'progress').length
  const pendingNodes = allNodes.filter(n => getStatus(n.id) === 'pending').length

  const getBlockStats = (block) => {
    const nodeIds = block.subGroups.flatMap(sg => sg.nodes)
    const done = nodeIds.filter(id => getStatus(id) === 'done').length
    return { total: nodeIds.length, done, pct: nodeIds.length > 0 ? Math.round(done / nodeIds.length * 100) : 0 }
  }

  const renderBlockView = () => (
    <div className="space-y-5">
      {BLOCKS.map(block => {
        const stats = getBlockStats(block)
        const colors = BLOCK_COLORS[block.color]
        const BlockIcon = block.icon
        return (
          <div key={block.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden ${colors.border}`}>
            <div className={`px-5 py-4 flex items-center justify-between border-b ${colors.border} ${colors.headerBg}`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors.light}`}>
                  <BlockIcon className={`w-4.5 h-4.5 ${colors.text}`} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-morandi-text">{block.title}</h3>
                  <p className="text-xs text-morandi-text-light">{block.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-28 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full ${colors.bar} rounded-full transition-all`} style={{ width: `${stats.pct}%` }} />
                </div>
                <span className={`text-xs font-bold ${colors.text}`}>{stats.pct}%</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${stats.pct === 100 ? 'bg-workspace-success-soft text-workspace-success' : stats.pct > 0 ? 'bg-workspace-warning-soft text-workspace-warning' : 'bg-workspace-surface-subtle text-workspace-text-tertiary'}`}>
                  {stats.done}/{stats.total}
                </span>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {block.subGroups.map((sg, si) => {
                const sgDone = sg.nodes.filter(id => getStatus(id) === 'done').length
                const sgPct = sg.nodes.length > 0 ? Math.round(sgDone / sg.nodes.length * 100) : 0
                return (
                  <div key={si}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-morandi-text">{sg.name}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1 bg-workspace-surface-subtle rounded-full overflow-hidden">
                          <div className={`h-full ${colors.bar} rounded-full transition-all`} style={{ width: `${sgPct}%` }} />
                        </div>
                        <span className="text-xs text-morandi-text-light">{sgDone}/{sg.nodes.length}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {sg.nodes.map(nodeId => {
                        const node = getNodeById(nodeId)
                        if (!node) return null
                        const status = getStatus(nodeId)
                        const cfg = STATUS_CONFIG[status]
                        const detail = NODE_DETAILS[nodeId]
                        return (
                          <button
                            key={nodeId}
                            onClick={() => onNodeSelect?.(nodeId)}
                            className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-workspace-border hover:border-morandi-primary/30 hover:bg-morandi-primary/5 transition-all text-left group"
                          >
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-morandi-text truncate group-hover:text-morandi-primary">{node.title}</p>
                              {detail && <p className="text-xs text-morandi-text-light truncate">{detail.desc}</p>}
                            </div>
                            <span className={`text-[8px] px-1 py-0.5 rounded flex-shrink-0 ${cfg.color}`}>{cfg.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )

  const renderStatusView = () => {
    const groups = {
      done: { label: '已完成', nodes: allNodes.filter(n => getStatus(n.id) === 'done') },
      progress: { label: '进行中', nodes: allNodes.filter(n => getStatus(n.id) === 'progress') },
      pending: { label: '待处理', nodes: allNodes.filter(n => getStatus(n.id) === 'pending') },
    }
    return (
      <div className="space-y-4">
        {Object.entries(groups).map(([key, group]) => {
          const cfg = STATUS_CONFIG[key]
          return (
            <div key={key} className="bg-white rounded-xl shadow-sm border border-workspace-border overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <cfg.icon className="w-4 h-4 text-morandi-primary" />
                  <h3 className="text-sm font-bold text-morandi-text">{group.label}</h3>
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${cfg.color}`}>{group.nodes.length} 个节点</span>
              </div>
              <div className="p-4">
                {group.nodes.length === 0 ? (
                  <p className="text-xs text-morandi-text-light text-center py-4">暂无{group.label}的节点</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {group.nodes.map(node => {
                      const detail = NODE_DETAILS[node.id]
                      const block = BLOCKS.find(b => b.subGroups.some(sg => sg.nodes.includes(node.id)))
                      return (
                        <button
                          key={node.id}
                          onClick={() => onNodeSelect?.(node.id)}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-workspace-border hover:border-morandi-primary/30 hover:bg-morandi-primary/5 transition-all text-left group"
                        >
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-morandi-text truncate group-hover:text-morandi-primary">{node.title}</p>
                            <p className="text-xs text-morandi-text-light truncate">{block?.title || ''}</p>
                          </div>
                          <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-morandi-primary flex-shrink-0" />
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderProductView = () => (
    <div className="space-y-4">
      {PRODUCTS.map(product => {
        const nodeIds = PRODUCT_NODE_MAP[product.id] || []
        const productNodes = allNodes.filter(n => nodeIds.includes(n.id))
        const done = productNodes.filter(n => getStatus(n.id) === 'done').length
        const pct = productNodes.length > 0 ? Math.round(done / productNodes.length * 100) : 0
        const colors = PRODUCT_COLOR_MAP[product.color]
        return (
          <div key={product.id} className="bg-white rounded-xl shadow-sm border border-workspace-border overflow-hidden">
            <div className={`px-5 py-4 flex items-center justify-between border-b border-gray-50 ${colors.bg}`}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{product.icon}</span>
                <h3 className="text-sm font-bold text-morandi-text">{product.name}</h3>
                <span className="text-xs text-morandi-text-light">{productNodes.length} 个节点</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-white/50 rounded-full overflow-hidden">
                  <div className={`h-full ${colors.accent} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${pct === 100 ? 'bg-workspace-success-soft text-workspace-success' : pct > 0 ? 'bg-workspace-warning-soft text-workspace-warning' : 'bg-workspace-surface-subtle text-workspace-text-tertiary'}`}>
                  {done}/{productNodes.length}
                </span>
              </div>
            </div>
            <div className="p-4 grid grid-cols-3 gap-2">
              {productNodes.map(node => {
                const status = getStatus(node.id)
                const cfg = STATUS_CONFIG[status]
                const detail = NODE_DETAILS[node.id]
                return (
                  <button
                    key={node.id}
                    onClick={() => onNodeSelect?.(node.id)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-workspace-border hover:border-morandi-primary/30 hover:bg-morandi-primary/5 transition-all text-left group"
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-morandi-text truncate group-hover:text-morandi-primary">{node.title}</p>
                      {detail && <p className="text-xs text-morandi-text-light truncate">{cfg.label}</p>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-morandi-text flex items-center gap-2">
            <Map className="w-5 h-5 text-morandi-primary" />
            项目节点总览
          </h2>
          <p className="text-xs text-morandi-text-light mt-0.5">全流程节点状态一览，点击节点可跳转详情</p>
        </div>
        <div className="flex items-center gap-1 bg-workspace-surface-subtle rounded-lg p-0.5">
          {VIEW_MODES.map(mode => (
            <button
              key={mode.key}
              onClick={() => setViewMode(mode.key)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === mode.key ? 'bg-white text-morandi-primary shadow-sm' : 'text-morandi-text-light hover:text-morandi-text'}`}
            >
              <mode.icon className="w-3 h-3" />
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {BLOCKS.map(block => {
          const stats = getBlockStats(block)
          const colors = BLOCK_COLORS[block.color]
          const BlockIcon = block.icon
          return (
            <div key={block.id} className={`bg-gradient-to-br ${colors.bg} to-white/50 rounded-xl p-4 border ${colors.border}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <BlockIcon className={`w-3.5 h-3.5 ${colors.text}`} />
                <span className={`text-xs font-medium ${colors.text}`}>{block.title}</span>
              </div>
              <div className={`text-2xl font-bold ${colors.text}`}>{stats.pct}%</div>
              <div className="text-xs text-morandi-text-light mt-0.5">{stats.done}/{stats.total} 已完成</div>
            </div>
          )
        })}
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-workspace-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-morandi-text">整体进度</span>
          <span className="text-xs text-morandi-primary font-semibold">{totalNodes > 0 ? Math.round(doneNodes / totalNodes * 100) : 0}%</span>
        </div>
        <div className="h-2 bg-workspace-surface-subtle rounded-full overflow-hidden flex">
          {BLOCKS.map(block => {
            const stats = getBlockStats(block)
            const colors = BLOCK_COLORS[block.color]
            const width = totalNodes > 0 ? stats.done / totalNodes * 100 : 0
            return (
              <div key={block.id} className={`h-full ${colors.bar} transition-all duration-500`} style={{ width: `${width}%` }} />
            )
          })}
        </div>
        <div className="flex items-center gap-4 mt-2">
          {BLOCKS.map(block => {
            const colors = BLOCK_COLORS[block.color]
            return (
              <div key={block.id} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${colors.accent}`} />
                <span className="text-xs text-morandi-text-light">{block.title}</span>
              </div>
            )
          })}
        </div>
      </div>

      {viewMode === 'block' && renderBlockView()}
      {viewMode === 'status' && renderStatusView()}
      {viewMode === 'product' && renderProductView()}
    </div>
  )
}
