/**
 * t6/CandidateScoringGateway.jsx — 候选商品选品评分 Gateway 与只读快照展示
 * 契约（TASK 05B-2C 冻结）：
 *  - 纯只读与导航引导：不运行评分、不创建快照、不引入 ProductScoringSection / ScoringDetailDrawer
 *  - 语义隔离：绝不将 Market Intelligence 的 MOS/PFS 冒充为 T6 商品评分
 *  - 明确标示：全局选品评分工作台不会自动按当前 Candidate 预过滤
 */
import { ExternalLink, AlertCircle, Info, ShieldAlert, CheckCircle2 } from 'lucide-react'
import Surface from '../ui/Surface'
import Badge from '../ui/Badge'
import Button from '../ui/Button'

export default function CandidateScoringGateway({ candidate, snapshot, onOpenScoring }) {
  const isMiCandidate = candidate?.source_system === 'WB_MARKET_INTELLIGENCE'
  const hasSnapshot = Boolean(snapshot?.scoreResult)
  const scoreResult = snapshot?.scoreResult || null
  const versions = snapshot?.versions || {}
  const explanations = snapshot?.explanations || {}

  return (
    <div className="space-y-4 text-xs">
      {/* 状态区 */}
      {hasSnapshot ? (
        <Surface className="p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-workspace-border pb-3">
            <div>
              <h3 className="text-xs font-semibold text-workspace-text flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-workspace-success" />
                当前 T6 商品评分快照
              </h3>
              <p className="text-[11px] text-workspace-text-tertiary mt-0.5">
                快照 ID: <span className="font-mono text-workspace-text-secondary">{snapshot.id}</span>
                {snapshot.createdAt && (
                  <span className="ml-2">({new Date(snapshot.createdAt).toLocaleString('zh-CN')})</span>
                )}
              </p>
            </div>
            <Badge tone="success">已有评分快照</Badge>
          </div>

          {/* 核心分与评级 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            <div className="p-2.5 bg-workspace-surface-subtle rounded border border-workspace-border">
              <span className="text-workspace-text-tertiary block text-[11px]">综合评分</span>
              <span className="text-base font-bold text-workspace-text tabular-nums">
                {scoreResult.totalScore ?? '—'}
              </span>
            </div>
            <div className="p-2.5 bg-workspace-surface-subtle rounded border border-workspace-border">
              <span className="text-workspace-text-tertiary block text-[11px]">评级 Grade</span>
              <span className="text-base font-bold text-workspace-text">
                {scoreResult.grade ?? '—'}
                {scoreResult.gradeTentative && (
                  <span className="ml-1 text-[10px] text-workspace-warning font-normal">(暂定)</span>
                )}
              </span>
            </div>
            <div className="p-2.5 bg-workspace-surface-subtle rounded border border-workspace-border">
              <span className="text-workspace-text-tertiary block text-[11px]">决策建议</span>
              <span className="text-xs font-semibold text-workspace-text mt-1 block">
                {scoreResult.decision?.status ?? '—'}
                {scoreResult.decision?.action ? ` (${scoreResult.decision.action})` : ''}
              </span>
            </div>
            <div className="p-2.5 bg-workspace-surface-subtle rounded border border-workspace-border">
              <span className="text-workspace-text-tertiary block text-[11px]">置信度 / Context</span>
              <span className="text-xs font-semibold text-workspace-text mt-1 block">
                {scoreResult.context ?? '—'}
                {scoreResult.evidenceCoverage != null && (
                  <span className="ml-1 text-[11px] font-normal text-workspace-text-secondary">
                    ({Math.round(scoreResult.evidenceCoverage * 100)}%)
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* 维度拆解（若存在） */}
          {scoreResult.dimensions && (
            <div className="pt-2 border-t border-workspace-border/60 space-y-2">
              <span className="font-semibold text-workspace-text text-[11px]">商业可行性五维评分：</span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-workspace-text-tertiary">市场需求：</span>
                  <span className="font-medium text-workspace-text">{scoreResult.dimensions.demand?.score ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-workspace-text-tertiary">利润可行性：</span>
                  <span className="font-medium text-workspace-text">{scoreResult.dimensions.profitability?.score ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-workspace-text-tertiary">物流适配：</span>
                  <span className="font-medium text-workspace-text">{scoreResult.dimensions.logistics?.score ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-workspace-text-tertiary">竞争机会：</span>
                  <span className="font-medium text-workspace-text">{scoreResult.dimensions.competition?.score ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-workspace-text-tertiary">价格空间：</span>
                  <span className="font-medium text-workspace-text">{scoreResult.dimensions.price_opportunity?.score ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-workspace-text-tertiary">运营稳健：</span>
                  <span className="font-medium text-workspace-text">{scoreResult.dimensions.operations?.score ?? '—'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Supply Gap */}
          {scoreResult.supplyGap && (
            <div className="pt-2 border-t border-workspace-border/60 flex items-center justify-between text-[11px]">
              <span className="text-workspace-text-tertiary">Supply Gap 信号：</span>
              <span className="font-medium text-workspace-text">
                {scoreResult.supplyGap.rank || '—'} (信号: {scoreResult.supplyGap.signal ?? '—'} · 需求: {scoreResult.supplyGap.demandRank ?? '—'} · 缺货: {scoreResult.supplyGap.shortageRank ?? '—'})
              </span>
            </div>
          )}

          {/* 规则与模型版本 */}
          <div className="pt-2 border-t border-workspace-border/60 grid grid-cols-2 gap-2 text-[10px] text-workspace-text-tertiary font-mono">
            <div>规则版本: {versions.rulesVersion || '—'}</div>
            <div>引擎版本: {versions.engineVersion || '—'}</div>
            <div>候选集版本: {versions.candidateDatasetVersion || '—'}</div>
            <div>基准版本: {versions.benchmarkVersion || '—'}</div>
          </div>
        </Surface>
      ) : (
        <Surface className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-workspace-text">T6 商品评分状态</h3>
            <Badge tone="warning">暂无 T6 商品评分快照</Badge>
          </div>

          <div className="p-3 rounded bg-amber-50/80 border border-amber-200 text-amber-900 text-[11px] space-y-1.5">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600 mt-0.5" />
              <div className="leading-relaxed">
                当前 Candidate 尚未绑定合法 T6 Scoring Snapshot。Market Intelligence 的 MOS/PFS 属于市场机会指标，不能替代商品评分。
              </div>
            </div>
            {isMiCandidate && (
              <div className="pl-6 text-amber-800 text-[11px] leading-relaxed">
                当前候选来源于 WB Market Intelligence。现有 T6 Scoring 工作台以 canonical 商品数据为评分对象；本页不会将利基市场指标转换为商品评分。
              </div>
            )}
          </div>
        </Surface>
      )}

      {/* Gateway CTA 引导卡片 */}
      <Surface className="p-4 bg-workspace-surface-subtle border border-workspace-border space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-xs font-semibold text-workspace-text">选品评分全局工作台</h4>
            <p className="text-[11px] text-workspace-text-tertiary mt-1 leading-relaxed">
              当前评分工作台为全局商品评分工作台，不会自动筛选或定位到当前 Candidate。
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenScoring}
            className="flex-shrink-0 gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            打开选品评分工作台
          </Button>
        </div>
      </Surface>
    </div>
  )
}
