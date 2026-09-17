/**
 * NicheDetailDrawer.jsx — 利基机会详情抽屉（5 大业务 Tab）
 * 市场大盘 / 搜索需求 / 竞争结构 / 跨境初筛与风控 / 决策与 T6 流转
 */
import { useState } from 'react'
import {
  X, TrendingUp, Search, Users, ShieldAlert, CheckCircle2,
  Package, ExternalLink, ArrowRight, Layers, FileText,
} from 'lucide-react'
import Drawer from '../../ui/Drawer'
import Button from '../../ui/Button'
import Badge from '../../ui/Badge'
import Surface from '../../ui/Surface'

export default function NicheDetailDrawer({
  niche,
  isOpen,
  onClose,
  onUpdateVerdict,
  onPromoteToT6,
  onOpenProcurement,
}) {
  const [activeTab, setActiveTab] = useState('market')
  const [statusNote, setStatusNote] = useState('')

  if (!niche) return null

  const tabs = [
    { id: 'market', label: '市场大盘', icon: TrendingUp },
    { id: 'search', label: '搜索需求', icon: Search },
    { id: 'comp', label: '竞争格局', icon: Users },
    { id: 'risk', label: '跨境初筛与风控', icon: ShieldAlert },
    { id: 'decision', label: '决策与流转', icon: CheckCircle2 },
  ]

  const formatGmv = (val) => {
    if (!val) return '¥0'
    const num = Number(val)
    if (num >= 10000000) return `¥${(num / 10000).toFixed(0)}万`
    if (num >= 10000) return `¥${(num / 10000).toFixed(1)}万`
    return `¥${num.toLocaleString()}`
  }

  const specs = niche.specs || {}
  const russianKeywords = (niche.top_kw || '').split(',').map((s) => s.trim()).filter(Boolean)

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={niche.name} width="max-w-2xl">
      <div className="flex flex-col h-full">
        {/* 顶部利基状态栏 */}
        <div className="bg-morandi-50 p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-morandi-200 text-morandi-text">
              #{niche.id || niche.rank}
            </span>
            <span className="text-xs text-morandi-text-light">{niche.cat || niche.category}</span>
            <Badge
              variant={
                niche.verdict === 'TEST' ? 'success' :
                niche.verdict === 'VERIFY' ? 'warning' :
                niche.verdict === 'WATCH' ? 'info' :
                niche.verdict === 'DROP' ? 'danger' : 'neutral'
              }
            >
              {niche.verdict || 'UNASSIGNED'}
            </Badge>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div>
              <span className="text-morandi-text-light">MOS: </span>
              <span className="font-bold text-morandi-primary">{niche.mos}</span>
            </div>
            <div>
              <span className="text-morandi-text-light">PFS: </span>
              <span className="font-bold text-emerald-600">{niche.cfs}</span>
            </div>
            <div>
              <span className="text-morandi-text-light">综合分: </span>
              <span className="font-bold text-morandi-text">{niche.comp}</span>
            </div>
          </div>
        </div>

        {/* 5 个 Tab 导航 */}
        <div className="flex border-b border-gray-100 bg-white px-2">
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
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Tab 1: 市场大盘 */}
          {activeTab === 'market' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Surface className="p-3">
                  <div className="text-morandi-text-light">本期季度 GMV</div>
                  <div className="text-base font-bold text-morandi-text mt-1">{formatGmv(niche.gmv)}</div>
                </Surface>
                <Surface className="p-3">
                  <div className="text-morandi-text-light">环比增长率</div>
                  <div className={`text-base font-bold mt-1 ${String(niche.growth).includes('+') ? 'text-emerald-600' : 'text-morandi-text'}`}>
                    {niche.growth}
                  </div>
                </Surface>
                <Surface className="p-3">
                  <div className="text-morandi-text-light">买家签收率 (Выкуп)</div>
                  <div className="text-base font-bold text-morandi-primary mt-1">
                    {typeof niche.buyout === 'number' ? `${niche.buyout}%` : niche.buyout}
                  </div>
                </Surface>
                <Surface className="p-3">
                  <div className="text-morandi-text-light">平均客单价</div>
                  <div className="text-base font-bold text-morandi-text mt-1">
                    ¥{niche.price}
                  </div>
                </Surface>
                <Surface className="p-3">
                  <div className="text-morandi-text-light">活跃动销卖家</div>
                  <div className="text-base font-bold text-morandi-text mt-1">
                    {niche.sellers} 家
                  </div>
                </Surface>
                <Surface className="p-3">
                  <div className="text-morandi-text-light">供需缺口比 (DSI)</div>
                  <div className="text-base font-bold text-amber-600 mt-1">
                    {niche.dsi || '--'}
                  </div>
                </Surface>
              </div>

              {niche.delta && niche.delta !== '0' && (
                <Surface className="p-3 bg-morandi-50 border-morandi-100">
                  <div className="text-morandi-text-light font-medium">GMV 绝对增量</div>
                  <div className="text-sm font-semibold text-morandi-text mt-1">
                    {niche.delta} 卢布
                    <span className="text-xs text-morandi-text-light ml-2">
                      (上期: {formatGmv(niche.gmv_prev)})
                    </span>
                  </div>
                </Surface>
              )}
            </div>
          )}

          {/* Tab 2: 搜索需求 */}
          {activeTab === 'search' && (
            <div className="space-y-4 text-xs">
              <Surface className="p-3">
                <div className="text-morandi-text-light mb-1">季度关联总搜索量</div>
                <div className="text-lg font-bold text-morandi-text">
                  {(niche.search || 0).toLocaleString()} 次
                </div>
              </Surface>

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

          {/* Tab 3: 竞争格局 */}
          {activeTab === 'comp' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <Surface className="p-3">
                  <div className="text-morandi-text-light">动销卖家总数</div>
                  <div className="text-base font-bold text-morandi-text mt-1">{niche.sellers} 家</div>
                  <div className="text-[11px] text-morandi-text-light mt-1">
                    {niche.sellers <= 150 ? '竞争格局相对宽松' : '成熟充分竞争红海'}
                  </div>
                </Surface>
                <Surface className="p-3">
                  <div className="text-morandi-text-light">市场机会等级</div>
                  <div className="text-base font-bold text-morandi-primary mt-1">
                    Tier {niche.tier || 'C'}
                  </div>
                  <div className="text-[11px] text-morandi-text-light mt-1">
                    {niche.tier === 'S' ? 'Top 3% 黄金利基' : niche.tier === 'A' ? 'Top 10% 重点关注' : '普通平销池'}
                  </div>
                </Surface>
              </div>

              <Surface className="p-3 border-morandi-200">
                <div className="font-semibold text-morandi-text mb-2">竞争切入难度研判</div>
                <p className="text-morandi-text leading-relaxed">
                  该类目客单均价约 ¥{niche.price}，签收率达 {niche.buyout}%。
                  {niche.sellers < 300
                    ? ' 活跃店铺较少，具备明显的跨境供应链打爆空间。'
                    : ' 现有卖家基数较大，建议避开通用款，通过变体、多孔组合装或配套小配件进行差异化切入。'}
                </p>
              </Surface>
            </div>
          )}

          {/* Tab 4: 跨境初筛与风控 */}
          {activeTab === 'risk' && (
            <div className="space-y-4 text-xs">
              {/* 风险标签 */}
              <div>
                <div className="font-semibold text-morandi-text mb-2">风控标签 (Risk Tags)</div>
                <div className="flex flex-wrap gap-1.5">
                  {(niche.risks || []).map((r, i) => (
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
              </div>

              {/* 工程与物理参数 */}
              <div className="grid grid-cols-2 gap-3">
                <Surface className="p-3">
                  <div className="text-morandi-text-light">单件预估净重</div>
                  <div className="text-sm font-bold text-morandi-text mt-1">
                    {specs.weight_g ? `${specs.weight_g} g` : niche.heavy === 'YES' ? '重货 (>2kg)' : '轻小件 (<500g)'}
                  </div>
                </Surface>
                <Surface className="p-3">
                  <div className="text-morandi-text-light">EAC 认证合规要求</div>
                  <div className={`text-sm font-bold mt-1 ${
                    specs.eac === 'REQUIRED' ? 'text-rose-600' :
                    specs.eac === 'NOT_REQUIRED_VERIFIED' ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
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

          {/* Tab 5: 决策与流转 */}
          {activeTab === 'decision' && (
            <div className="space-y-4 text-xs">
              <Surface className="p-4 space-y-3">
                <div className="font-semibold text-morandi-text">快速调整验证结论</div>
                <div className="grid grid-cols-4 gap-2">
                  {['TEST', 'VERIFY', 'WATCH', 'DROP'].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => onUpdateVerdict(niche.name, v, statusNote)}
                      className={`py-2 rounded font-medium text-center transition-all ${
                        niche.verdict === v
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
                <Button
                  variant="primary"
                  className="w-full justify-center gap-2 py-2.5 text-xs font-semibold"
                  onClick={() => onPromoteToT6(niche, statusNote)}
                >
                  <Package className="w-4 h-4" />
                  一键推送到 T6 候选池（创建待立项项目）
                </Button>

                <Button
                  variant="secondary"
                  className="w-full justify-center gap-2 py-2 text-xs"
                  onClick={() => {
                    onClose()
                    onOpenProcurement(niche)
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
