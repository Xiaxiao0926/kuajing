import React from 'react'
import {
  Layers, ExternalLink, AlertTriangle, CheckCircle2,
  Target, BarChart2, ClipboardCheck, Info,
} from 'lucide-react'
import Surface from '../../ui/Surface'
import Button from '../../ui/Button'
import Badge from '../../ui/Badge'

/**
 * OpportunityPurityGateway.jsx
 *
 * Opportunity 详情抽屉内的「纯度分析」业务入口网关（Contextual Gateway）。
 * 遵循 KUAIJING-IA-REFACTOR-V1 · TASK 04C-2 契约规则：
 * 1. 严禁把完整独立纯度页面挂载到抽屉内；
 * 2. 严禁直接或间接引入纯度流水线独立页面组件；
 * 3. 仅作为说明与跳转网关，不参与纯度计算；
 * 4. 严禁向纯度工具传入任何 Opportunity 过滤参数；
 * 5. 当前规则库品类列表事实源来自 config/market_analysis.json，前端仅展示固定 Label。
 */

// 规则库当前支持的 5 大品类 Label（事实源: config/market_analysis.json）
const SUPPORTED_CATEGORIES = [
  '发膜',
  '护发喷雾',
  '手套',
  '枕头',
  '吹风机',
]

export default function OpportunityPurityGateway({ opportunity, onOpenPurity }) {
  if (!opportunity) {
    return (
      <div className="p-6 text-center text-morandi-text-light text-xs">
        暂无机会数据
      </div>
    )
  }

  const isNavigationAvailable = typeof onOpenPurity === 'function'

  return (
    <div className="space-y-4 text-xs">
      {/* 区块 1: 当前机会上下文与适用性 */}
      <Surface className="p-3.5 space-y-3 border-morandi-200">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-morandi-text flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-morandi-primary" />
            当前关联市场机会
          </span>
          <Badge variant="warning" className="text-[10px]">
            适用性：需人工确认
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] bg-morandi-50/60 p-2.5 rounded border border-morandi-100">
          <div>
            <span className="text-morandi-text-light block">当前机会:</span>
            <span className="font-bold text-morandi-text text-xs truncate block" title={opportunity.name}>
              {opportunity.name || '—'}
            </span>
          </div>
          <div>
            <span className="text-morandi-text-light block">市场类目:</span>
            <span className="font-medium text-morandi-text truncate block" title={opportunity.category}>
              {opportunity.category || '—'}
            </span>
          </div>
          <div>
            <span className="text-morandi-text-light block">数据批次:</span>
            <span className="font-mono text-morandi-text truncate block">
              {opportunity.runId || '—'}
            </span>
          </div>
          <div>
            <span className="text-morandi-text-light block">Niche UID:</span>
            <span className="font-mono text-morandi-text-muted truncate block" title={opportunity.nicheUid}>
              {opportunity.nicheUid || '—'}
            </span>
          </div>
        </div>
      </Surface>

      {/* 区块 2: 纯度分析工具能力与支持品类 */}
      <Surface className="p-3.5 space-y-3 border-morandi-200">
        <div className="font-semibold text-morandi-text flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-morandi-primary" />
          纯度分析工具能力 (Purity Pipeline)
        </div>

        <p className="text-morandi-text-light leading-relaxed">
          纯度分析通过整份热销数据中的俄语商品标题自动识别品类，并进行规格归一、A/B/C 可比性分层和价格带分析。
        </p>

        {/* 核心能力清单 */}
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="flex items-start gap-1.5 bg-gray-50/80 p-2 rounded">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-morandi-text">规格识别</div>
              <div className="text-[10px] text-morandi-text-light">俄文单位提取与双装折算</div>
            </div>
          </div>
          <div className="flex items-start gap-1.5 bg-gray-50/80 p-2 rounded">
            <BarChart2 className="w-3.5 h-3.5 text-morandi-primary shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-morandi-text">A/B/C 分层</div>
              <div className="text-[10px] text-morandi-text-light">直接可比 vs 邻近竞品 vs 杂质</div>
            </div>
          </div>
          <div className="flex items-start gap-1.5 bg-gray-50/80 p-2 rounded">
            <Layers className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-morandi-text">加权价格带</div>
              <div className="text-[10px] text-morandi-text-light">5档等频价格分箱与中位价</div>
            </div>
          </div>
          <div className="flex items-start gap-1.5 bg-gray-50/80 p-2 rounded">
            <ClipboardCheck className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-morandi-text">50 SKU 抽检</div>
              <div className="text-[10px] text-morandi-text-light">确定性随机抽验与准确率核查</div>
            </div>
          </div>
        </div>

        {/* 当前规则库支持品类（来自 config/market_analysis.json） */}
        <div className="pt-1">
          <div className="text-[11px] text-morandi-text-light mb-1.5">
            纯度分析工具当前支持品类（规则库 v1）：
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUPPORTED_CATEGORIES.map((cat) => (
              <span
                key={cat}
                className="px-2 py-0.5 bg-morandi-100/70 text-morandi-primary rounded text-[11px] font-medium"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      </Surface>

      {/* 区块 3: 业务注意事项与边界提示 */}
      <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/60 space-y-1.5">
        <div className="flex items-center gap-1.5 font-semibold text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>业务边界提示</span>
        </div>
        <div className="text-[11px] text-amber-800 space-y-1 leading-relaxed">
          <p className="font-medium">
            当前市场机会不会自动映射为纯度分析品类。
          </p>
          <p>
            纯度分析需要使用对应细分品类的完整热销 Excel 数据集。系统不会使用当前 Opportunity 名称或类目预过滤数据，以避免破坏品类识别与 A/B/C 分类结果。
          </p>
        </div>
      </div>

      {/* 唯一主 CTA 按钮 */}
      <div className="pt-2">
        <Button
          variant="primary"
          className="w-full justify-center gap-2 py-2.5 text-xs font-semibold"
          disabled={!isNavigationAvailable}
          onClick={onOpenPurity}
        >
          <ExternalLink className="w-4 h-4" />
          打开纯度分析工具
        </Button>
        {!isNavigationAvailable && (
          <p className="text-[11px] text-rose-500 text-center mt-1.5 flex items-center justify-center gap-1">
            <Info className="w-3.5 h-3.5" />
            当前导航入口不可用
          </p>
        )}
      </div>
    </div>
  )
}
