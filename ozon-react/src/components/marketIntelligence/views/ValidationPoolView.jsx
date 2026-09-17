/**
 * ValidationPoolView.jsx — 产品验证池看板 (Phase 4 核心产品化页面)
 * 4 列看板：TEST / VERIFY / WATCH / DROP
 * 支持快速切换状态、录入前置验证备忘录、推送到 T6 候选池或启动 Phase 5 采购核算。
 */
import { useState } from 'react'
import {
  CheckCircle2, AlertCircle, Eye, Trash2, ArrowRight,
  Package, FileText, ExternalLink, Plus,
} from 'lucide-react'
import Surface from '../../ui/Surface'
import Button from '../../ui/Button'
import Badge from '../../ui/Badge'

export default function ValidationPoolView({
  validationPool = { TEST: [], VERIFY: [], WATCH: [], DROP: [] },
  onUpdateVerdict,
  onPromoteToT6,
  onOpenProcurement,
  onSelectNiche,
}) {
  const [editingNotes, setEditingNotes] = useState({})

  const columns = [
    { id: 'TEST', title: 'TEST 准备测试', desc: '轻小/标品/免电免认证，可低库存试水', color: 'border-emerald-500 bg-emerald-50/30' },
    { id: 'VERIFY', title: 'VERIFY 待确认前置', desc: '重货/易碎/规格深/季节性，需前置核实', color: 'border-amber-500 bg-amber-50/30' },
    { id: 'WATCH', title: 'WATCH 观察池', desc: '涉及射频/动植物检疫/电子客诉，暂不推进', color: 'border-sky-500 bg-sky-50/30' },
    { id: 'DROP', title: 'DROP 排除池', desc: '运费击穿货值或无跨境可行性，果断剔除', color: 'border-rose-500 bg-rose-50/30' },
  ]

  const handleNoteChange = (name, note) => {
    setEditingNotes((p) => ({ ...p, [name]: note }))
  }

  const handleSaveNote = (name, currentVerdict) => {
    const note = editingNotes[name] ?? ''
    onUpdateVerdict(name, currentVerdict, note)
  }

  return (
    <div className="space-y-4">
      {/* 顶部提示 */}
      <Surface className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs bg-morandi-50/60 border-morandi-200">
        <div>
          <span className="font-bold text-morandi-text">选品项目管理看板 (Validation Kanban)</span>
          <span className="text-morandi-text-light ml-2">
            当前处于工程可行性验证阶段。已审核通过的单品可直接「推送到 T6 候选池」或进入「Phase 5 采购询价」。
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs">
          <span>TEST: <b className="text-emerald-700">{validationPool.TEST?.length || 0}</b></span>
          <span>VERIFY: <b className="text-amber-700">{validationPool.VERIFY?.length || 0}</b></span>
          <span>WATCH: <b className="text-sky-700">{validationPool.WATCH?.length || 0}</b></span>
          <span>DROP: <b className="text-rose-700">{validationPool.DROP?.length || 0}</b></span>
        </div>
      </Surface>

      {/* 4 列看板网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {columns.map((col) => {
          const items = validationPool[col.id] || []
          return (
            <div key={col.id} className="flex flex-col space-y-3 min-h-[500px]">
              {/* 列头部 */}
              <div className={`p-3 rounded-lg border-t-4 bg-white shadow-sm border ${col.color}`}>
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-morandi-text">{col.title}</h4>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-morandi-100 text-morandi-text">
                    {items.length}
                  </span>
                </div>
                <p className="text-[11px] text-morandi-text-light mt-1">{col.desc}</p>
              </div>

              {/* 列卡片列表 */}
              <div className="space-y-3">
                {items.map((item) => (
                  <Surface
                    key={item.name}
                    className="p-3 space-y-2.5 hover:shadow-md transition-shadow border-morandi-200"
                  >
                    {/* 标题与分类 */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-morandi-100 text-morandi-text">
                            #{item.rank}
                          </span>
                          <span
                            onClick={() => onSelectNiche(item)}
                            className="font-bold text-xs text-morandi-text hover:text-morandi-primary cursor-pointer"
                          >
                            {item.name}
                          </span>
                        </div>
                        <span className="text-[11px] text-morandi-text-light block mt-0.5">{item.category}</span>
                      </div>

                      <div className="flex items-center gap-1 font-mono text-[11px]">
                        <span className="text-morandi-primary font-bold">M:{item.mos}</span>
                        <span className="text-gray-300">/</span>
                        <span className="text-emerald-600 font-bold">P:{item.cfs}</span>
                      </div>
                    </div>

                    {/* 关键物理参数 */}
                    <div className="bg-morandi-50/60 p-2 rounded text-[11px] space-y-1">
                      <div className="flex justify-between">
                        <span className="text-morandi-text-light">预估单重:</span>
                        <span className="font-semibold text-morandi-text">{item.weight_g} g</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-morandi-text-light">EAC 认证:</span>
                        <span className={`font-semibold ${
                          item.eac === 'REQUIRED' ? 'text-rose-600' :
                          item.eac === 'NOT_REQUIRED_VERIFIED' ? 'text-emerald-600' : 'text-amber-600'
                        }`}>
                          {item.eac}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-morandi-text-light">WB 均价:</span>
                        <span className="font-mono text-morandi-text">{item.price} (签收{item.buyout})</span>
                      </div>
                    </div>

                    {/* 状态与理由 */}
                    <div className="text-[11px] text-morandi-text leading-relaxed line-clamp-2">
                      {item.rationale}
                    </div>

                    {/* 调整备注输入 */}
                    <div className="pt-1">
                      <input
                        type="text"
                        value={editingNotes[item.name] ?? item.userNote ?? ''}
                        onChange={(e) => handleNoteChange(item.name, e.target.value)}
                        onBlur={() => handleSaveNote(item.name, col.id)}
                        placeholder="添加验证备忘/采购备注..."
                        className="w-full text-[11px] rounded border border-gray-200 p-1.5 outline-none focus:border-morandi-primary bg-white"
                      />
                    </div>

                    {/* 状态流转快捷按钮组 */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px]">
                      <div className="flex items-center gap-1">
                        {columns.filter((c) => c.id !== col.id).map((targetCol) => (
                          <button
                            key={targetCol.id}
                            type="button"
                            onClick={() => onUpdateVerdict(item.name, targetCol.id, editingNotes[item.name] || item.userNote || '')}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 hover:bg-gray-200 text-morandi-text transition-colors"
                            title={`移动至 ${targetCol.id}`}
                          >
                            → {targetCol.id}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectNiche(item)}
                        className="text-morandi-primary hover:text-morandi-primary-dark font-medium"
                      >
                        详情
                      </button>
                    </div>

                    {/* 核心动作栏 */}
                    <div className="pt-1 flex gap-1.5">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onPromoteToT6(item)}
                        className="flex-1 justify-center gap-1 py-1.5 text-[11px]"
                      >
                        <Package className="w-3 h-3" />
                        推送到 T6
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onOpenProcurement(item)}
                        className="flex-1 justify-center gap-1 py-1.5 text-[11px]"
                      >
                        <FileText className="w-3 h-3" />
                        1688 询价
                      </Button>
                    </div>
                  </Surface>
                ))}

                {items.length === 0 && (
                  <div className="p-8 border-2 border-dashed border-gray-200 rounded-lg text-center text-xs text-morandi-text-light">
                    该阶段暂无候选
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
