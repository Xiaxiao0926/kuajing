/**
 * RadarView.jsx — 选品雷达视图（核心日常选品工作台）
 * MOS 市场机会分与 PFS 初筛可行分双独立评分体系，
 * 搭载多维复合筛选器（物理/合规/市场）与卡片/表格双视图。
 */
import { useState, useMemo } from 'react'
import {
  Compass, Filter, SlidersHorizontal, ArrowUpDown, LayoutGrid,
  List, CheckCircle2, ShieldAlert, Sparkles, ChevronDown,
  RefreshCw, Search,
} from 'lucide-react'
import Surface from '../../ui/Surface'
import Button from '../../ui/Button'
import Badge from '../../ui/Badge'
import { filterNiches, DEFAULT_FILTERS } from '../../../utils/marketIntelligence/miFilterEngine'

export default function RadarView({ niches, onSelectNiche }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'table'
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // 提取所有唯一样本大类供筛选
  const categories = useMemo(() => {
    if (!Array.isArray(niches)) return []
    const cats = new Set(niches.map((n) => n.cat).filter(Boolean))
    return ['ALL', ...Array.from(cats).sort()]
  }, [niches])

  // 执行纯函数过滤
  const filteredList = useMemo(() => {
    return filterNiches(niches, filters)
  }, [niches, filters])

  // 快捷预设
  const applyPreset = (type) => {
    if (type === 'dual_high') {
      setFilters((prev) => ({
        ...prev,
        dualHighOnly: true,
        weightFilter: 'LE_1000',
        minMos: 65,
        minCfs: 85,
        minBuyout: 80,
      }))
    } else if (type === 'light_small') {
      setFilters((prev) => ({
        ...prev,
        dualHighOnly: false,
        weightFilter: 'LE_500',
        nonElectricOnly: true,
        nonFragileOnly: true,
        nonLiquidOnly: true,
        minBuyout: 85,
      }))
    } else if (type === 'growth') {
      setFilters((prev) => ({
        ...prev,
        dualHighOnly: false,
        minGrowth: 20,
        sortField: 'growth_num',
        sortOrder: 'desc',
      }))
    } else if (type === 'reset') {
      setFilters(DEFAULT_FILTERS)
    }
  }

  const formatGmv = (val) => {
    if (!val) return '¥0'
    const num = Number(val)
    if (num >= 10000000) return `¥${(num / 10000).toFixed(0)}万`
    if (num >= 10000) return `¥${(num / 10000).toFixed(1)}万`
    return `¥${num.toLocaleString()}`
  }

  return (
    <div className="space-y-4">
      {/* 顶部搜索与预设条 */}
      <Surface className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* 搜索框 */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-morandi-text-light absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
              placeholder="搜索利基名称、品类或俄语关键词（如 发泡胶枪、проводка）..."
              className="w-full text-xs rounded-md border border-gray-200 pl-9 pr-3 py-2 outline-none focus:border-morandi-primary bg-white"
            />
          </div>

          {/* 排序与视图切换 */}
          <div className="flex items-center gap-2">
            <select
              value={filters.sortField}
              onChange={(e) => setFilters((p) => ({ ...p, sortField: e.target.value }))}
              className="text-xs rounded border border-gray-200 px-2 py-1.5 bg-white text-morandi-text"
            >
              <option value="comp">综合优先级指数 (CPI)</option>
              <option value="mos">市场机会分 (MOS)</option>
              <option value="cfs">初筛可行分 (PFS)</option>
              <option value="gmv">季度 GMV</option>
              <option value="growth_num">环比增长率</option>
              <option value="buyout">买家签收率</option>
              <option value="sellers">动销卖家数</option>
              <option value="search">搜索需求量</option>
              <option value="price">平均客单价</option>
            </select>

            <button
              type="button"
              onClick={() => setFilters((p) => ({ ...p, sortOrder: p.sortOrder === 'desc' ? 'asc' : 'desc' }))}
              className="p-1.5 rounded border border-gray-200 bg-white text-morandi-text hover:bg-gray-50"
              title="切换正序/倒序"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center border border-gray-200 rounded overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 ${viewMode === 'grid' ? 'bg-morandi-primary text-white' : 'bg-white text-morandi-text-light'}`}
                title="网格卡片视图"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 ${viewMode === 'table' ? 'bg-morandi-primary text-white' : 'bg-white text-morandi-text-light'}`}
                title="数据表格视图"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            <Button
              variant={showAdvancedFilters ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setShowAdvancedFilters((v) => !v)}
              className="gap-1 text-xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              高级筛选
            </Button>
          </div>
        </div>

        {/* 快捷推荐预设按钮 */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100 text-xs">
          <span className="text-morandi-text-light">快捷策略池:</span>
          <button
            type="button"
            onClick={() => applyPreset('dual_high')}
            className={`px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors ${
              filters.dualHighOnly
                ? 'bg-amber-500 text-white border-amber-600'
                : 'bg-morandi-50 text-morandi-text border-morandi-200 hover:bg-morandi-100'
            }`}
          >
            🔥 双高黄金池 (MOS≥65 & PFS≥85)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('light_small')}
            className={`px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors ${
              filters.weightFilter === 'LE_500' && filters.nonElectricOnly
                ? 'bg-emerald-600 text-white border-emerald-700'
                : 'bg-morandi-50 text-morandi-text border-morandi-200 hover:bg-morandi-100'
            }`}
          >
            🟢 极简测款轻小件 (≤500g/免电/非液)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('growth')}
            className={`px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors ${
              filters.minGrowth > 0
                ? 'bg-rose-500 text-white border-rose-600'
                : 'bg-morandi-50 text-morandi-text border-morandi-200 hover:bg-morandi-100'
            }`}
          >
            ⚡ 季度高增长 (&gt;20%)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('reset')}
            className="px-2 py-1 text-morandi-text-light hover:text-morandi-text text-[11px] ml-auto flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            重置筛选
          </button>
        </div>

        {/* 展开的高级筛选面板 */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs bg-morandi-50/50 p-3 rounded">
            {/* 品类选择 */}
            <div>
              <label className="block text-morandi-text-light mb-1">主营大类</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))}
                className="w-full text-xs rounded border border-gray-200 p-1.5 bg-white text-morandi-text"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c === 'ALL' ? '全部品类 (97个)' : c}</option>
                ))}
              </select>
            </div>

            {/* 验证结论 */}
            <div>
              <label className="block text-morandi-text-light mb-1">验证定级 (Verdict)</label>
              <select
                value={filters.verdicts[0] || 'ALL'}
                onChange={(e) => setFilters((p) => ({ ...p, verdicts: [e.target.value] }))}
                className="w-full text-xs rounded border border-gray-200 p-1.5 bg-white text-morandi-text"
              >
                <option value="ALL">全部状态</option>
                <option value="TEST">TEST (准备测试)</option>
                <option value="VERIFY">VERIFY (待前置验证)</option>
                <option value="WATCH">WATCH (观察池)</option>
                <option value="DROP">DROP (排除/放弃)</option>
              </select>
            </div>

            {/* 重量过滤 */}
            <div>
              <label className="block text-morandi-text-light mb-1">物理重量档位</label>
              <select
                value={filters.weightFilter}
                onChange={(e) => setFilters((p) => ({ ...p, weightFilter: e.target.value }))}
                className="w-full text-xs rounded border border-gray-200 p-1.5 bg-white text-morandi-text"
              >
                <option value="ALL">全部重量</option>
                <option value="LE_500">超轻小件 (≤500g)</option>
                <option value="LE_1000">常规轻小 (≤1000g)</option>
                <option value="HEAVY_ONLY">大件重货 (&gt;1kg)</option>
              </select>
            </div>

            {/* 签收率门槛 */}
            <div>
              <label className="block text-morandi-text-light mb-1">买家签收率 ≥</label>
              <select
                value={filters.minBuyout}
                onChange={(e) => setFilters((p) => ({ ...p, minBuyout: Number(e.target.value) }))}
                className="w-full text-xs rounded border border-gray-200 p-1.5 bg-white text-morandi-text"
              >
                <option value={0}>不限</option>
                <option value={80}>≥ 80% (及格线)</option>
                <option value={85}>≥ 85% (安全线)</option>
                <option value={90}>≥ 90% (极高签收)</option>
              </select>
            </div>

            {/* 市场机会分 MOS ≥ */}
            <div>
              <label className="block text-morandi-text-light mb-1">市场机会分 MOS ≥</label>
              <input
                type="number"
                value={filters.minMos}
                onChange={(e) => setFilters((p) => ({ ...p, minMos: Number(e.target.value) }))}
                className="w-full text-xs rounded border border-gray-200 p-1.5 bg-white text-morandi-text"
                min="0"
                max="100"
              />
            </div>

            {/* 勾选框组 */}
            <div className="flex flex-col justify-end space-y-1">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.nonElectricOnly}
                  onChange={(e) => setFilters((p) => ({ ...p, nonElectricOnly: e.target.checked }))}
                  className="rounded text-morandi-primary"
                />
                <span>屏蔽带电产品</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.nonFragileOnly}
                  onChange={(e) => setFilters((p) => ({ ...p, nonFragileOnly: e.target.checked }))}
                  className="rounded text-morandi-primary"
                />
                <span>屏蔽易碎材质</span>
              </label>
            </div>
          </div>
        )}
      </Surface>

      {/* 结果统计信息 */}
      <div className="flex items-center justify-between text-xs text-morandi-text-light px-1">
        <div>
          共匹配到 <span className="font-bold text-morandi-text">{filteredList.length}</span> 个利基
          {filteredList.length < (niches?.length || 0) && (
            <span className="ml-1">(已从全量 {(niches?.length || 0).toLocaleString()} 个中筛选)</span>
          )}
        </div>
      </div>

      {/* 视图一：卡片网格流 */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredList.slice(0, 90).map((n) => (
            <Surface
              key={n.id}
              onClick={() => onSelectNiche(n)}
              className="p-4 hover:shadow-md transition-all cursor-pointer border-morandi-200 hover:border-morandi-primary/50 group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-morandi-100 text-morandi-text font-mono">
                        #{n.id}
                      </span>
                      <h4 className="text-sm font-bold text-morandi-text group-hover:text-morandi-primary transition-colors">
                        {n.name}
                      </h4>
                    </div>
                    <span className="text-[11px] text-morandi-text-light block mt-0.5">{n.cat}</span>
                  </div>

                  <Badge
                    variant={
                      n.verdict === 'TEST' ? 'success' :
                      n.verdict === 'VERIFY' ? 'warning' :
                      n.verdict === 'WATCH' ? 'info' :
                      n.verdict === 'DROP' ? 'danger' : 'neutral'
                    }
                  >
                    {n.verdict || 'UNASSIGNED'}
                  </Badge>
                </div>

                {/* MOS & PFS 双分数 */}
                <div className="grid grid-cols-3 gap-2 my-3 p-2 bg-morandi-50 rounded text-center font-mono">
                  <div>
                    <div className="text-[10px] text-morandi-text-light">MOS (机会)</div>
                    <div className="text-sm font-bold text-morandi-primary">{n.mos}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-morandi-text-light">PFS (初筛)</div>
                    <div className="text-sm font-bold text-emerald-600">{n.cfs}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-morandi-text-light">综合指数</div>
                    <div className="text-sm font-bold text-morandi-text">{n.comp}</div>
                  </div>
                </div>

                {/* 市场核心盘面 */}
                <div className="grid grid-cols-2 gap-y-1.5 text-xs text-morandi-text border-t border-gray-100 pt-2">
                  <div className="flex justify-between pr-2">
                    <span className="text-morandi-text-light">季度 GMV:</span>
                    <span className="font-semibold">{formatGmv(n.gmv)}</span>
                  </div>
                  <div className="flex justify-between pl-2">
                    <span className="text-morandi-text-light">环比增长:</span>
                    <span className={`font-semibold ${String(n.growth).includes('+') ? 'text-emerald-600' : ''}`}>{n.growth}</span>
                  </div>
                  <div className="flex justify-between pr-2">
                    <span className="text-morandi-text-light">买家签收率:</span>
                    <span className="font-semibold text-morandi-primary">{n.buyout}%</span>
                  </div>
                  <div className="flex justify-between pl-2">
                    <span className="text-morandi-text-light">在售卖家:</span>
                    <span className="font-semibold">{n.sellers} 家</span>
                  </div>
                </div>
              </div>

              {/* 风险标签与规格提示 */}
              <div className="mt-3 pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-1 text-[11px]">
                <div className="flex items-center gap-1">
                  {n.heavy === 'YES' && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 text-[10px] font-medium">重货</span>
                  )}
                  {(n.risks || []).slice(0, 2).map((r, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px]">
                      {r}
                    </span>
                  ))}
                </div>
                <span className="text-morandi-text-light">均价 ¥{n.price}</span>
              </div>
            </Surface>
          ))}
        </div>
      )}

      {/* 视图二：高密度数据表格 */}
      {viewMode === 'table' && (
        <Surface className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-morandi-text-light bg-morandi-50/70 font-medium">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">利基产品</th>
                <th className="py-2.5 px-3">品类</th>
                <th className="py-2.5 px-3 text-right">MOS</th>
                <th className="py-2.5 px-3 text-right">PFS</th>
                <th className="py-2.5 px-3 text-right">综合指数</th>
                <th className="py-2.5 px-3 text-right">季度 GMV</th>
                <th className="py-2.5 px-3 text-right">增长率</th>
                <th className="py-2.5 px-3 text-right">签收率</th>
                <th className="py-2.5 px-3 text-right">活跃卖家</th>
                <th className="py-2.5 px-3 text-right">均价</th>
                <th className="py-2.5 px-3 text-center">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-morandi-text">
              {filteredList.slice(0, 150).map((n) => (
                <tr
                  key={n.id}
                  onClick={() => onSelectNiche(n)}
                  className="hover:bg-morandi-50/70 transition-colors cursor-pointer"
                >
                  <td className="py-2 px-3 font-mono text-morandi-text-light">{n.id}</td>
                  <td className="py-2 px-3 font-semibold text-morandi-text hover:text-morandi-primary">
                    {n.name}
                  </td>
                  <td className="py-2 px-3 text-morandi-text-light">{n.cat}</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-morandi-primary">{n.mos}</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">{n.cfs}</td>
                  <td className="py-2 px-3 text-right font-mono font-bold">{n.comp}</td>
                  <td className="py-2 px-3 text-right font-mono">{formatGmv(n.gmv)}</td>
                  <td className={`py-2 px-3 text-right font-mono ${String(n.growth).includes('+') ? 'text-emerald-600' : ''}`}>
                    {n.growth}
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-semibold text-morandi-primary">{n.buyout}%</td>
                  <td className="py-2 px-3 text-right font-mono">{n.sellers}</td>
                  <td className="py-2 px-3 text-right font-mono">¥{n.price}</td>
                  <td className="py-2 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      n.verdict === 'TEST' ? 'bg-emerald-100 text-emerald-800' :
                      n.verdict === 'VERIFY' ? 'bg-amber-100 text-amber-800' :
                      n.verdict === 'WATCH' ? 'bg-sky-100 text-sky-800' :
                      n.verdict === 'DROP' ? 'bg-rose-100 text-rose-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {n.verdict}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      )}

      {filteredList.length === 0 && (
        <Surface className="p-12 text-center text-morandi-text-light text-xs">
          未找到符合当前筛选条件的利基。请尝试放宽筛选门槛或重置预设。
        </Surface>
      )}
    </div>
  )
}
