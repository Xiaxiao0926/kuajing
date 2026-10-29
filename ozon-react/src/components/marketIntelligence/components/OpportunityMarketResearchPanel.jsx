import React from 'react'
import { AlertTriangle, Info, Database } from 'lucide-react'
import MarketResearch from '../../MarketResearch'
import Surface from '../../ui/Surface'
import Badge from '../../ui/Badge'

/**
 * OpportunityMarketResearchPanel.jsx
 *
 * 机会详情抽屉内「竞品与价格」Tab 下嵌入的市场调研面板。
 * 遵循 TASK 04B-2 规则：
 * 1. 严格隔离：通过 embedded 模式与独立市场调研隔离；
 * 2. 语义诚实：显式展示提示横幅，说明 initialQuery 仅预填检索词，KPI 基于报告全局；
 * 3. 缺失防护：nicheUid 缺失时拦截挂载；
 * 4. 禁止类目筛选器：category 仅作为展示上下文，无过滤状态。
 */
export default function OpportunityMarketResearchPanel({ opportunity }) {
  if (!opportunity) return null

  // 缺失 UID 防护：没有 nicheUid 时严禁挂载 MarketResearch
  if (!opportunity.nicheUid) {
    return (
      <Surface className="p-4 border-amber-200 bg-amber-50/60 mt-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <div className="font-semibold text-amber-800">无法进入上下文市场调研</div>
            <p className="text-amber-700">机会标识缺失，无法进入上下文市场调研。</p>
          </div>
        </div>
      </Surface>
    )
  }

  const contextKey = `${opportunity.runId || 'no-run'}:${opportunity.nicheUid || 'no-uid'}`
  const initialQuery = opportunity.name || ''

  return (
    <div className="space-y-4 mt-4 border-t border-morandi-200/60 pt-4">
      {/* 嵌入上下文信息栏与语义提示 */}
      <Surface className="p-3 border-morandi-200 bg-morandi-50/50 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-morandi-primary" />
            <span className="text-xs font-semibold text-morandi-text">上下文市场调研工具</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="neutral" className="text-[10px] font-normal">
              机会: {opportunity.name || '—'}
            </Badge>
            {opportunity.category && (
              <span className="text-[11px] text-morandi-text-light">
                所属类目: {opportunity.category}
              </span>
            )}
          </div>
        </div>

        {/* 语义说明横幅：明确告知 initialQuery 仅过滤表格，顶部指标基于全报告 */}
        <div className="flex items-start gap-2 text-[11px] text-morandi-text-light bg-white/70 p-2.5 rounded border border-morandi-100">
          <Info className="w-4 h-4 text-morandi-primary shrink-0 mt-0.5" />
          <div className="space-y-0.5 leading-relaxed">
            <div className="font-medium text-morandi-text">
              当前为【利基机会调研】嵌入模式：默认填入当前机会关键词作为检索词。
            </div>
            <p className="text-morandi-text-muted">
              注意：顶部指标与图表仍基于当前选中的完整报告文件计算，表格仅预填当前词筛选。可手动切换或上传关联报告分析。
            </p>
          </div>
        </div>
      </Surface>

      {/* 嵌入式 MarketResearch 实例 */}
      <MarketResearch
        embedded={true}
        initialQuery={initialQuery}
        contextKey={contextKey}
      />
    </div>
  )
}
