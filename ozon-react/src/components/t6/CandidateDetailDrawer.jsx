/**
 * t6/CandidateDetailDrawer.jsx — 候选商品详情抽屉（只读详情层与能力 Gateway）
 * 契约（TASK 05B-2C 冻结）：
 *  - 只读展示：只调用现有 getCandidate / getSnapshot / listLogs Read API
 *  - 严格 6 个业务 Tab：概览 (overview)、市场依据 (market)、选品评分 (scoring)、采购验证 (procurement)、风险与合规 (risk)、决策记录 (history)
 *  - 语义隔离：绝对禁止把 MOS/PFS 伪装成 T6 评分；无 Snapshot 时明确展示警示横幅
 *  - 能力归位 Gateway：通过 CandidateScoringGateway 和 CandidateProcurementPanel 引导全局视图
 *  - 禁止业务写入：不嵌入评分计算、不直接修改采购数据、不创建项目、不编辑备注或状态
 */
import { useState, useMemo } from 'react'
import {
  TrendingUp, Layers, ShieldAlert, FileClock,
  Package, Info, ChevronDown, ChevronRight, AlertCircle,
  Star, ShoppingBag,
} from 'lucide-react'
import Drawer from '../ui/Drawer'
import Badge from '../ui/Badge'
import Surface from '../ui/Surface'
import { getCandidate, getSnapshot, listLogs } from '../../utils/t6/t6Store'
import CandidateScoringGateway from './CandidateScoringGateway'
import CandidateProcurementPanel from './CandidateProcurementPanel'

const KIND_LABELS = {
  status_change: '状态变化',
  market_evidence_sync: '市场证据同步',
  project_create: '创建项目',
  snapshot_refresh: '评分刷新',
  snapshot_create: '评分快照',
}

export default function CandidateDetailDrawer({ candidateId, open = true, onClose, onOpenNode = null }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [notesOpen, setNotesOpen] = useState(true)

  // 只读获取 Candidate 实体
  const candidate = useMemo(() => (candidateId ? getCandidate(candidateId) : null), [candidateId])

  // 只读获取关联 Snapshot 实体（若存在）
  const snapshot = useMemo(() => {
    if (!candidate?.latestSnapshotId) return null
    return getSnapshot(candidate.latestSnapshotId)
  }, [candidate])

  // 只读获取针对该候选的 T6 决策日志（倒序）
  const logs = useMemo(() => {
    if (!candidateId) return []
    return listLogs()
      .filter((log) => log.subjectType === 'candidate' && log.subjectId === candidateId)
      .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
  }, [candidateId])

  const handleOpenScoring = () => {
    if (typeof onOpenNode !== 'function') return
    onClose?.()
    onOpenNode('__scoring__')
  }

  const handleOpenProcurement = () => {
    if (typeof onOpenNode !== 'function') return
    onClose?.()
    onOpenNode('__market_validation__')
  }

  if (!candidate) return null

  const tabs = [
    { id: 'overview', label: '概览', icon: TrendingUp },
    { id: 'market', label: '市场依据', icon: Layers },
    { id: 'scoring', label: '选品评分', icon: Star },
    { id: 'procurement', label: '采购验证', icon: ShoppingBag },
    { id: 'risk', label: '风险与合规', icon: ShieldAlert },
    { id: 'history', label: '决策记录', icon: FileClock },
  ]

  const sourceSystemLabel =
    candidate.source_system === 'WB_MARKET_INTELLIGENCE'
      ? 'WB Market Intelligence'
      : (candidate.source_system || '—')

  const marketEvidence = candidate.marketEvidence || null

  return (
    <Drawer open={open} isOpen={open} onClose={onClose} title="候选商品详情" width={620}>
      <div className="flex flex-col h-full space-y-4">
        {/* Header 固定区域 */}
        <Surface className="p-4 bg-workspace-surface-subtle border border-workspace-border space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-workspace-text truncate" title={candidate.candidateName}>
                {candidate.candidateName || '—'}
              </h2>
              <p className="text-xs text-workspace-text-tertiary mt-0.5">
                {candidate.categoryLeaf || '未分类'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Badge tone="primary">{candidate.bizStatus || '—'}</Badge>
              <Badge tone="neutral">{sourceSystemLabel}</Badge>
            </div>
          </div>

          <div className="pt-2 border-t border-workspace-border/60 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-workspace-text-secondary font-mono">
            <span>Candidate: {candidate.id ? candidate.id.slice(0, 13) + '…' : '—'}</span>
            <span>Run: {candidate.source_run_id || '—'}</span>
            <span>Niche: {candidate.source_niche_uid || '—'}</span>
          </div>
        </Surface>

        {/* Tab 导航 */}
        <div className="flex items-center border-b border-workspace-border gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-workspace-primary text-workspace-primary'
                    : 'border-transparent text-workspace-text-secondary hover:text-workspace-text'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Tab 1: 概览 (overview) */}
        {activeTab === 'overview' && (
          <div className="space-y-4 text-xs">
            {/* 基础信息 */}
            <Surface className="p-4 space-y-3">
              <h3 className="text-xs font-semibold text-workspace-text flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-workspace-primary" /> Candidate 基本信息
              </h3>
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div>
                  <span className="text-workspace-text-tertiary">商品名称：</span>
                  <span className="font-medium text-workspace-text">{candidate.candidateName || '—'}</span>
                </div>
                <div>
                  <span className="text-workspace-text-tertiary">末级类目：</span>
                  <span className="font-medium text-workspace-text">{candidate.categoryLeaf || '—'}</span>
                </div>
                <div>
                  <span className="text-workspace-text-tertiary">业务状态：</span>
                  <span className="font-medium text-workspace-text">{candidate.bizStatus || '—'}</span>
                </div>
                <div>
                  <span className="text-workspace-text-tertiary">负责人：</span>
                  <span className="font-medium text-workspace-text">{candidate.owner || '—'}</span>
                </div>
                <div>
                  <span className="text-workspace-text-tertiary">加入时间：</span>
                  <span className="text-workspace-text">{candidate.addedAt ? new Date(candidate.addedAt).toLocaleString('zh-CN') : '—'}</span>
                </div>
                <div>
                  <span className="text-workspace-text-tertiary">更新时间：</span>
                  <span className="text-workspace-text">{candidate.updatedAt ? new Date(candidate.updatedAt).toLocaleString('zh-CN') : '—'}</span>
                </div>
              </div>
            </Surface>

            {/* 项目关系 */}
            <Surface className="p-4 space-y-2">
              <h3 className="text-xs font-semibold text-workspace-text flex items-center justify-between">
                <span>关联项目关系</span>
                <span className="text-[11px] font-normal text-workspace-text-secondary">
                  已关联 {candidate.projectIds?.length ?? 0} 个项目
                </span>
              </h3>
              {(candidate.projectIds || []).length > 0 ? (
                <div className="space-y-1 pt-1">
                  {candidate.projectIds.map((pId) => (
                    <div key={pId} className="font-mono text-[11px] p-1.5 bg-workspace-surface-subtle rounded border border-workspace-border text-workspace-text-secondary">
                      {pId}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-workspace-text-tertiary text-[11px]">当前候选尚未生成 SKU 项目。</p>
              )}
            </Surface>

            {/* 评分快照状态 */}
            <Surface className="p-4 space-y-2">
              <h3 className="text-xs font-semibold text-workspace-text">T6 评分快照</h3>
              {candidate.latestSnapshotId ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge tone="success">已有评分快照</Badge>
                    <span className="font-mono text-[11px] text-workspace-text-secondary">
                      {candidate.latestSnapshotId}
                    </span>
                  </div>
                  {snapshot?.scoreResult && (
                    <div className="flex items-center gap-4 text-sm font-semibold text-workspace-text pt-1">
                      <span>综合分：{snapshot.scoreResult.totalScore ?? '—'}</span>
                      <span>评级：{snapshot.scoreResult.grade ?? '—'}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge tone="warning">暂无 T6 评分快照</Badge>
                  </div>
                  <div className="p-2.5 rounded bg-amber-50/80 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600 mt-0.5" />
                    <span>Market Intelligence 的 MOS / PFS 属于市场机会分析指标，不等同于 T6 商品评分快照。</span>
                  </div>
                </div>
              )}
            </Surface>

            {/* 历史备注折叠区 */}
            <Surface className="p-3 border border-workspace-border">
              <button
                type="button"
                onClick={() => setNotesOpen((prev) => !prev)}
                className="w-full flex items-center justify-between text-xs font-semibold text-workspace-text"
              >
                <span>历史备注</span>
                {notesOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
              {notesOpen && (
                <div className="mt-2 pt-2 border-t border-workspace-border text-[11px] text-workspace-text-secondary whitespace-pre-wrap leading-relaxed">
                  {candidate.notes || '暂无备注'}
                </div>
              )}
            </Surface>
          </div>
        )}

        {/* Tab 2: 市场依据 (market) */}
        {activeTab === 'market' && (
          <div className="space-y-4 text-xs">
            {!marketEvidence ? (
              <Surface className="p-6 text-center text-workspace-text-tertiary">
                暂无结构化市场依据
              </Surface>
            ) : (
              <>
                <Surface className="p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-workspace-text">核心市场表现指标</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[12px]">
                    <div className="p-2 bg-workspace-surface-subtle rounded border border-workspace-border">
                      <div className="text-[11px] text-workspace-text-tertiary">MOS</div>
                      <div className="text-sm font-bold text-workspace-text mt-0.5">{marketEvidence.mos ?? '—'}</div>
                    </div>
                    <div className="p-2 bg-workspace-surface-subtle rounded border border-workspace-border">
                      <div className="text-[11px] text-workspace-text-tertiary">PFS</div>
                      <div className="text-sm font-bold text-workspace-text mt-0.5">{marketEvidence.pfs ?? '—'}</div>
                    </div>
                    <div className="p-2 bg-workspace-surface-subtle rounded border border-workspace-border">
                      <div className="text-[11px] text-workspace-text-tertiary">GMV</div>
                      <div className="text-sm font-semibold text-workspace-text mt-0.5">{marketEvidence.gmv ?? '—'}</div>
                    </div>
                    <div className="p-2 bg-workspace-surface-subtle rounded border border-workspace-border">
                      <div className="text-[11px] text-workspace-text-tertiary">增长率</div>
                      <div className="text-sm font-semibold text-workspace-text mt-0.5">{marketEvidence.growth ?? '—'}</div>
                    </div>
                    <div className="p-2 bg-workspace-surface-subtle rounded border border-workspace-border">
                      <div className="text-[11px] text-workspace-text-tertiary">签收率</div>
                      <div className="text-sm font-semibold text-workspace-text mt-0.5">{marketEvidence.buyout ?? '—'}</div>
                    </div>
                    <div className="p-2 bg-workspace-surface-subtle rounded border border-workspace-border">
                      <div className="text-[11px] text-workspace-text-tertiary">卖家数</div>
                      <div className="text-sm font-semibold text-workspace-text mt-0.5">{marketEvidence.sellers ?? '—'}</div>
                    </div>
                  </div>
                </Surface>

                <Surface className="p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-workspace-text">商品规格与验证状态</h3>
                  <div className="grid grid-cols-2 gap-3 text-[12px]">
                    <div>
                      <span className="text-workspace-text-tertiary">市场均价：</span>
                      <span className="font-medium text-workspace-text">{marketEvidence.price ?? '—'}</span>
                    </div>
                    <div>
                      <span className="text-workspace-text-tertiary">预估单重：</span>
                      <span className="font-medium text-workspace-text">
                        {marketEvidence.weightG != null ? `${marketEvidence.weightG} g` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-workspace-text-tertiary">大件标识：</span>
                      <span className="font-medium text-workspace-text">{marketEvidence.heavy ?? '—'}</span>
                    </div>
                    <div>
                      <span className="text-workspace-text-tertiary">MI 验证阶段：</span>
                      <span className="font-medium text-workspace-text">{marketEvidence.verdict ?? '—'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-workspace-text-tertiary">最后同步时间：</span>
                      <span className="text-workspace-text">
                        {marketEvidence.syncedAt ? new Date(marketEvidence.syncedAt).toLocaleString('zh-CN') : '—'}
                      </span>
                    </div>
                  </div>
                </Surface>

                {/* 来源追溯 */}
                <Surface className="p-4 space-y-2">
                  <h3 className="text-xs font-semibold text-workspace-text">来源追溯</h3>
                  <div className="space-y-1.5 font-mono text-[11px] text-workspace-text-secondary">
                    <div>来源系统：{candidate.source_system || '—'}</div>
                    <div>来源批次：{candidate.source_run_id || '—'}</div>
                    <div>利基 UID：{candidate.source_niche_uid || '—'}</div>
                    <div>利基 ID：{candidate.source_niche_id || '—'}</div>
                    <div>商品唯一标识：{candidate.sourceProductId || '—'}</div>
                  </div>
                </Surface>
              </>
            )}
          </div>
        )}

        {/* Tab 3: 选品评分 (scoring) */}
        {activeTab === 'scoring' && (
          <CandidateScoringGateway
            candidate={candidate}
            snapshot={snapshot}
            onOpenScoring={handleOpenScoring}
          />
        )}

        {/* Tab 4: 采购验证 (procurement) */}
        {activeTab === 'procurement' && (
          <CandidateProcurementPanel
            candidate={candidate}
            onOpenProcurement={handleOpenProcurement}
          />
        )}

        {/* Tab 5: 风险与合规 (risk) */}
        {activeTab === 'risk' && (
          <div className="space-y-4 text-xs">
            <Surface className="p-4 space-y-3">
              <h3 className="text-xs font-semibold text-workspace-text">风险标签</h3>
              {Array.isArray(marketEvidence?.risks) && marketEvidence.risks.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {marketEvidence.risks.map((r, i) => (
                    <Badge key={i} tone="warning">{r}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-workspace-text-tertiary text-[11px]">暂无结构化风险标签</p>
              )}
            </Surface>

            <Surface className="p-4 space-y-3">
              <h3 className="text-xs font-semibold text-workspace-text">合规与认证状态</h3>
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div>
                  <span className="text-workspace-text-tertiary">EAC 认证要求：</span>
                  <span className="font-medium text-workspace-text">{marketEvidence?.eacStatus || '—'}</span>
                </div>
                <div>
                  <span className="text-workspace-text-tertiary">资质认证要求：</span>
                  <span className="font-medium text-workspace-text">{marketEvidence?.certificationStatus || '—'}</span>
                </div>
              </div>
            </Surface>

            <div className="p-3 rounded bg-blue-50/70 border border-blue-200 text-blue-900 text-[11px] flex items-start gap-2">
              <Info className="w-4 h-4 flex-shrink-0 text-blue-600 mt-0.5" />
              <span>当前风险和认证状态来自最近一次 Market Intelligence 市场证据同步，仅用于候选判断；正式采购/上架前仍需按实际 SKU 进行合规确认。</span>
            </div>
          </div>
        )}

        {/* Tab 4: 决策记录 (history) */}
        {activeTab === 'history' && (
          <div className="space-y-4 text-xs">
            {logs.length === 0 ? (
              <Surface className="p-6 text-center text-workspace-text-tertiary">
                暂无决策记录
              </Surface>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => {
                  const kindLabel = KIND_LABELS[log.kind] || log.kind || '—'
                  const flowText = log.from || log.to ? `${log.from || '—'} → ${log.to || '—'}` : null
                  return (
                    <Surface key={log.id} className="p-3 text-[11px] space-y-1 border border-workspace-border">
                      <div className="flex items-center justify-between text-workspace-text-secondary">
                        <span className="font-semibold text-workspace-text">{kindLabel}</span>
                        <span>{log.at ? new Date(log.at).toLocaleString('zh-CN') : '—'}</span>
                      </div>
                      {flowText && (
                        <div className="text-workspace-text-tertiary">
                          流转：<span className="font-medium text-workspace-text">{flowText}</span>
                        </div>
                      )}
                      {log.reason && (
                        <div className="text-workspace-text-secondary">
                          说明：{log.reason}
                        </div>
                      )}
                      <div className="text-[10px] text-workspace-text-tertiary">
                        操作人：{log.by || '—'}
                      </div>
                    </Surface>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </Drawer>
  )
}
