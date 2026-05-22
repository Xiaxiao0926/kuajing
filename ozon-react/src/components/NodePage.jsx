import { CheckCircle2, Circle, Zap } from 'lucide-react'
import { NODE_DETAILS, ROADMAP_PHASES } from '../data/roadmap'

export default function NodePage({ nodeId, status, onStatusChange, children, wide }) {
  const detail = NODE_DETAILS[nodeId]
  const phase = ROADMAP_PHASES.find(p => p.nodes.some(n => n.id === nodeId))

  if (!detail) return null

  return (
    <div className={wide ? 'max-w-full' : 'max-w-5xl mx-auto'}>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-morandi-text-light mb-1">
          <span>{phase?.title}</span>
        </div>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-morandi-text flex items-center gap-3">
            <span className="text-3xl">{detail.icon || phase?.nodes.find(n => n.id === nodeId)?.icon}</span>
            {detail.title}
          </h2>
          <div className="flex items-center gap-2">
            {status === 'done' ? (
              <button onClick={() => onStatusChange(nodeId, 'pending')} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 transition-colors">
                <CheckCircle2 className="w-4 h-4" /> 已完成
              </button>
            ) : status === 'active' ? (
              <div className="flex items-center gap-1.5">
                <button onClick={() => onStatusChange(nodeId, 'done')} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600 transition-colors">
                  <CheckCircle2 className="w-4 h-4" /> 标记完成
                </button>
                <button onClick={() => onStatusChange(nodeId, 'pending')} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors">
                  取消
                </button>
              </div>
            ) : (
              <button onClick={() => onStatusChange(nodeId, 'active')} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-200 transition-colors">
                <Zap className="w-4 h-4" /> 开始执行
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-morandi-text-light mt-1">{detail.desc}</p>
      </div>

      {status === 'active' && detail.checklist && (
        <div className="mb-6 bg-amber-50 border border-amber-100 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-amber-800 mb-3">📋 执行清单</h3>
          <div className="space-y-2">
            {detail.checklist.map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <Circle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-amber-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {status === 'pending' && detail.checklist && (
        <div className="mb-6 bg-gray-50 border border-gray-100 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">📋 待办事项</h3>
          <div className="space-y-2">
            {detail.checklist.map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <Circle className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-500">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {status === 'done' && detail.checklist && (
        <div className="mb-6 bg-green-50 border border-green-100 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-green-700 mb-3">✅ 已完成事项</h3>
          <div className="space-y-2">
            {detail.checklist.map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-green-600">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {children}
    </div>
  )
}
