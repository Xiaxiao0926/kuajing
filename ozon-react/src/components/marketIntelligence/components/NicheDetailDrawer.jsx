/**
 * NicheDetailDrawer.jsx — 利基机会详情抽屉（5 大业务 Tab）
 * Business role: Opportunity Detail shell
 */
import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import {
  TrendingUp, Search, Users, ShieldAlert, CheckCircle2,
  Package, FileText, AlertTriangle, Loader2, Layers,
} from 'lucide-react'
import Drawer from '../../ui/Drawer'
import Button from '../../ui/Button'
import Badge from '../../ui/Badge'
import Surface from '../../ui/Surface'
import { buildOpportunityContext } from '../../../utils/marketIntelligence/opportunityContext'
import OpportunityPurityGateway from './OpportunityPurityGateway'

const OpportunityMarketResearchPanel = lazy(() => import('./OpportunityMarketResearchPanel'))

export default function NicheDetailDrawer({
  niche,
  runId,
  isOpen,
  onClose,
  onUpdateVerdict,
  onPromoteToT6,
  onOpenProcurement,
  onOpenNode,
}) {
  const [activeTab, setActiveTab] = useState('overview')
  const [statusNote, setStatusNote] = useState('')

  // 统一 Opportunity Context 构建（只读适配）
  const opportunity = useMemo(() => {
    if (!niche) return null
    return buildOpportunityContext(niche, { runId })
  }, [niche, runId])

  // 每次选中不同 niche 时重置 Tab 与备注，避免状态残留
  useEffect(() => {
    if (niche) {
      setActiveTab('overview')
      setStatusNote('')
    }
  }, [niche])

  if (!niche || !opportunity) return null

  // 严格固定的 6 个业务 Tab
  const tabs = [
    { id: 'overview', label: '概览', icon: TrendingUp },
    { id: 'demand', label: '搜索需求', icon: Search },
    { id: 'competition', label: '竞品与价格', icon: Users },
    { id: 'purity', label: '纯度分析', icon: Layers },
    { id: 'risk', label: '风险', icon: ShieldAlert },
    { id: 'decision', label: '决策', icon: CheckCircle2 },
  ]

  const handleOpenPurity = () => {
    if (typeof onOpenNode !== 'function') return
    onClose?.()
    onOpenNode('__purity_analysis__')
  }

  const formatGmv = (val) => {
    if (!val) return '¥0'
    const num = Number(val)
    if (num >= 10000000) return `¥${(num / 10000).toFixed(0)}万`
    if (num >= 10000) return `¥${(num / 10000).toFixed(1)}万`
    return `¥${num.toLocaleString()}`
  }

  const specs = opportunity.raw?.specs || {}
  const russianKeywords = (opportunity.raw?.top_kw || '').split(',').map((s) => s.trim()).filter(Boolean)

  return (
    <Drawer open={isOpen} isOpen={isOpen} onClose={onClose} title={opportunity.name || 'Opportunity Detail'} width={680}>
      <div className="flex flex-col h-full">
        {/* Drawer Header 固定结构 */}
        <div className="bg-morandi-50 -mx-5 -mt-4 p-5 border-b border-gray-100 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-morandi-text flex items-center gap-2">
                {opportunity.name || '—'}
                <Badge
                  variant={
                    opportunity.verdict === 'TEST' ? 'success' :
                    opportunity.verdict === 'VERIFY' ? 'warning' :
                    opportunity.verdict === 'WATCH' ? 'info' :
                    opportunity.verdict === 'DROP' ? 'danger' : 'neutral'
                  }
                >
                  {opportunity.verdict}
                </Badge>
              </h2>
              <p className="text-xs text-morandi-text-light mt-0.5">
                {opportunity.category || '—'}
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div>
                <span className="text-morandi-text-light">MOS </span>
                <span className="font-bold text-morandi-primary">
                  {opportunity.mos != null ? opportunity.mos : '—'}
                </span>
              </div>
              <div>
                <span className="text-morandi-text-light">PFS </span>
                <span className="font-bold text-emerald-600">
                  {opportunity.pfs != null ? opportunity.pfs : '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between text-[11px] text-morandi-text-light pt-1 border-t border-gray-200/60 font-mono">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">RUN:</span>
              <span className="text-morandi-text font-semibold">{opportunity.runId || '—'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">UID:</span>
              {opportunity.nicheUid ? (
                <span className="text-morandi-text select-all font-semibold">{opportunity.nicheUid}</span>
              ) : (
                <span className="text-rose-600 font-semibold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                  机会标识缺失
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 5 个 Tab 导航 */}
        <div className="flex border-b border-gray-100 bg-white -mx-5 px-5">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-morandi-primary text-morandi-primary'
                    : 'border-transparent text-morandi-text-light hover:text-morandi-text'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab 内容区 */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Tab 1: 概览 */}
          {activeTab === 'overview' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Surface className="p-3">
                  <div className="text-morandi-text-light">本期季度 GMV</div>
                  <div className="text-base font-bold text-morandi-text mt-1">{formatGmv(opportunity.gmv)}</div>
                </Surface>
                <Surface className="p-3">
                  <div className="text-morandi-text-light">环比增长率</div>
                  <div className={`text-base font-bold mt-1 ${String(opportunity.growth).includes('+') ? 'text-emerald-600' : 'text-morandi-text'}`}>
                    {opportunity.growth || '—'}
                  </div>
                </Surface>
                <Surface className="p-3">
                  <div className="text-morandi-text-light">买家签收率 (Выкуп)</div>
                  <div className="text-base font-bold text-morandi-primary mt-1">
                    {opportunity.buyout != null
                      ? (typeof opportunity.buyout === 'number' ? `${opportunity.buyout}%` : opportunity.buyout)
                      : '—'}
                  </div>
                </Surface>
                <Surface className="p-3">
                  <div className="text-morandi-text-light">平均客单价</div>
                  <div className="text-base font-bold text-morandi-text mt-1">
                    {opportunity.raw?.price != null ? `¥${opportunity.raw.price}` : '—'}
                  </div>
                </Surface>
                <Surface className="p-3">
                  <div className="text-morandi-text-light">活跃动销卖家</div>
                  <div className="text-base font-bold text-morandi-text mt-1">
                    {opportunity.sellers != null ? `${opportunity.sellers} 家` : '—'}
                  </div>
                </Surface>
                <Surface className="p-3">
                  <div className="text-morandi-text-light">供需缺口比 (DSI)</div>
                  <div className="text-base font-bold text-amber-600 mt-1">
                    {opportunity.raw?.dsi || '—'}
                  </div>
                </Surface>
              </div>

              {opportunity.raw?.delta && opportunity.raw.delta !== '0' && (
                <Surface className="p-3 bg-morandi-50 border-morandi-100">
                  <div className="text-morandi-text-light font-medium">GMV 绝对增量</div>
                  <div className="text-sm font-semibold text-morandi-text mt-1">
                    {opportunity.raw.delta} 卢布
                    {opportunity.raw.gmv_prev && (
                      <span className="text-xs text-morandi-text-light ml-2">
                        (上期: {formatGmv(opportunity.raw.gmv_prev)})
                      </span>
                    )}
                  </div>
                </Surface>
              )}
            </div>
          )}

          {/* Tab 2: 搜索需求 */}
          {activeTab === 'demand' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Surface className="p-3">
                  <div className="text-morandi-text-light mb-1">关联总搜索量</div>
                  <div className="text-base font-bold text-morandi-text">
                    {opportunity.raw?.search != null ? `${Number(opportunity.raw.search).toLocaleString()} 次` : '—'}
                  </div>
                </Surface>
                <Surface className="p-3">
                  <div className="text-morandi-text-light mb-1">供需缺口比 (DSI)</div>
                  <div className="text-base font-bold text-amber-600">
                    {opportunity.raw?.dsi || '—'}
                  </div>
                </Surface>
                <Surface className="p-3">
                  <div className="text-morandi-text-light mb-1">加购转化率</div>
                  <div className="text-base font-bold text-morandi-text">
                    {opportunity.raw?.cart_rate != null ? `${opportunity.raw.cart_rate}%` : '—'}
                  </div>
                </Surface>
                <Surface className="p-3">
                  <div className="text-morandi-text-light mb-1">下单转化率</div>
                  <div className="text-base font-bold text-morandi-text">
                    {opportunity.raw?.order_rate != null ? `${opportunity.raw.order_rate}%` : '—'}
                  </div>
                </Surface>
              </div>

              <div>
                <div className="font-semibold text-morandi-text mb-2 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-morandi-primary" />
                  核心俄语搜索词映射 (TOP 词云)
                </div>
                {russianKeywords.length > 0 ? (
                  <div className="space-y-2">
                    {russianKeywords.map((kw, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded bg-morandi-50 hover:bg-morandi-100 transition-colors"
                      >
                        <span className="font-mono text-morandi-text select-all">{kw}</span>
                        <span className="text-[11px] text-morandi-text-light">俄语需求词 #{idx + 1}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-morandi-text-light py-4 text-center">暂无映射关键词</div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: 竞品与价格 */}
          {activeTab === 'competition' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <Surface className="p-3">
                  <div className="text-morandi-text-light">动销卖家总数</div>
                  <div className="text-base font-bold text-morandi-text mt-1">
                    {opportunity.sellers != null ? `${opportunity.sellers} 家` : '—'}
                  </div>
                  <div className="text-[11px] text-morandi-text-light mt-1">
                    {opportunity.sellers != null
                      ? (opportunity.sellers <= 150 ? '竞争格局相对宽松' : '成熟充分竞争红海')
                      : '—'}
                  </div>
                </Surface>
                <Surface className="p-3">
                  <div className="text-morandi-text-light">市场机会等级</div>
                  <div className="text-base font-bold text-morandi-primary mt-1">
                    {opportunity.raw?.tier ? `Tier ${opportunity.raw.tier}` : '—'}
                  </div>
                  <div className="text-[11px] text-morandi-text-light mt-1">
                    {opportunity.raw?.tier === 'S'
                      ? 'Top 3% 黄金利基'
                      : opportunity.raw?.tier === 'A'
                      ? 'Top 10% 重点关注'
                      : '普通平销池'}
                  </div>
                </Surface>
              </div>

              <Surface className="p-3 border-morandi-200">
                <div className="font-semibold text-morandi-text mb-2">竞争切入难度研判</div>
                <p className="text-morandi-text leading-relaxed">
                  该类目客单均价约 {opportunity.raw?.price != null ? `¥${opportunity.raw.price}` : '—'}，
                  买家签收率达 {opportunity.buyout != null ? `${opportunity.buyout}%` : '—'}。
                  {opportunity.sellers != null && opportunity.sellers < 300
                    ? ' 活跃店铺较少，具备明显的跨境供应链打爆空间。'
                    : ' 现有卖家基数较大，建议避开通用款，通过变体、多孔组合装或配套小配件进行差异化切入。'}
                </p>
              </Surface>

              {/* 市场调研工具（嵌入式，按需懒加载，切 Tab 自动卸载） */}
              <Suspense
                fallback={
                  <div className="flex items-center justify-center p-6 text-morandi-text-light gap-2 bg-morandi-50/50 rounded-lg">
                    <Loader2 className="w-4 h-4 animate-spin text-morandi-primary" />
                    <span>加载市场调研工具...</span>
                  </div>
                }
              >
                <OpportunityMarketResearchPanel opportunity={opportunity} />
              </Suspense>
            </div>
          )}

          {/* Tab 4: 纯度分析 (Contextual Gateway) */}
          {activeTab === 'purity' && (
            <OpportunityPurityGateway
              opportunity={opportunity}
              onOpenPurity={handleOpenPurity}
            />
          )}

          {/* Tab 5: 风险 */}
          {activeTab === 'risk' && (
            <div className="space-y-4 text-xs">
              {/* 风控标签 */}
              <div>
                <div className="font-semibold text-morandi-text mb-2">风控标签 (Risk Tags)</div>
                {opportunity.risks.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {opportunity.risks.map((r, i) => (
                      <span
                        key={i}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          r === 'NONE (通用标品)' || r === 'NO_KNOWN_RISK'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-morandi-text-light">暂无风控标签</div>
                )}
              </div>

              {/* 物理与合规参数 */}
              <div className="grid grid-cols-2 gap-3">
                <Surface className="p-3">
                  <div className="text-morandi-text-light">单件预估净重</div>
                  <div className="text-sm font-bold text-morandi-text mt-1">
                    {specs.weight_g
                      ? `${specs.weight_g} g`
                      : opportunity.raw?.heavy === 'YES'
                      ? '重货 (>2kg)'
                      : '轻小件 (<500g)'}
                  </div>
                </Surface>
                <Surface className="p-3">
                  <div className="text-morandi-text-light">EAC 认证合规要求</div>
                  <div
                    className={`text-sm font-bold mt-1 ${
                      String(specs.eac).startsWith('REQUIRED')
                        ? 'text-rose-600'
                        : String(specs.eac).startsWith('NOT_REQUIRED')
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                    }`}
                  >
                    {specs.eac || 'UNKNOWN (待查验)'}
                  </div>
                </Surface>
                <Surface className="p-3">
                  <div className="text-morandi-text-light">包装尺寸规格</div>
                  <div className="text-sm font-medium text-morandi-text mt-1">
                    {specs.dims || '标准纸盒包装'}
                  </div>
                </Surface>
                <Surface className="p-3">
                  <div className="text-morandi-text-light">车型/机型适配风险</div>
                  <div className="text-sm font-medium text-morandi-text mt-1">
                    {specs.fitment || 'UNIVERSAL (通用款)'}
                  </div>
                </Surface>
              </div>

              {specs.rationale && (
                <Surface className="p-3 bg-morandi-50 border-morandi-100">
                  <div className="text-morandi-text-light font-medium">工程验证要点与理由</div>
                  <p className="text-morandi-text mt-1 leading-relaxed">{specs.rationale}</p>
                </Surface>
              )}
            </div>
          )}

          {/* Tab 5: 决策 */}
          {activeTab === 'decision' && (
            <div className="space-y-4 text-xs">
              <Surface className="p-4 space-y-3">
                <div className="font-semibold text-morandi-text">快速调整验证结论</div>
                <div className="grid grid-cols-4 gap-2">
                  {['TEST', 'VERIFY', 'WATCH', 'DROP'].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => onUpdateVerdict(opportunity.name, v, statusNote)}
                      className={`py-2 rounded font-medium text-center transition-all ${
                        opportunity.verdict === v
                          ? 'ring-2 ring-morandi-primary shadow-sm font-bold bg-white text-morandi-primary'
                          : 'bg-gray-100 text-morandi-text-light hover:bg-gray-200'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>

                <div className="mt-2">
                  <label className="block text-morandi-text-light mb-1">调整备注 / 前置验证事项：</label>
                  <input
                    type="text"
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="例如：待确认 1688 盒装尺寸与特氟龙涂层标准..."
                    className="w-full text-xs rounded border border-gray-200 p-2 focus:ring-1 focus:ring-morandi-primary outline-none"
                  />
                </div>
              </Surface>

              {/* 业务中台联动 */}
              <div className="space-y-2 pt-2">
                {opportunity.nicheUid ? (
                  <Button
                    variant="primary"
                    className="w-full justify-center gap-2 py-2.5 text-xs font-semibold"
                    onClick={() => onPromoteToT6(opportunity.raw, statusNote)}
                  >
                    <Package className="w-4 h-4" />
                    一键推送到 T6 候选池（创建待立项项目）
                  </Button>
                ) : (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>机会标识缺失，禁止执行候选流转动作。</span>
                  </div>
                )}

                <Button
                  variant="secondary"
                  className="w-full justify-center gap-2 py-2 text-xs"
                  onClick={() => {
                    onClose()
                    onOpenProcurement(opportunity.raw)
                  }}
                >
                  <FileText className="w-4 h-4" />
                  录入 1688 采购报价与包装参数（Phase 5 工作台）
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  )
}
