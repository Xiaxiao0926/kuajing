/**
 * OverviewView.jsx — 市场总览视图
 * 呈现大盘宏观指标、今日动态推荐（高增长/供需缺口/跨境友好）与重点品类分布
 */
import {
  TrendingUp, Compass, Target, ShieldAlert, Sparkles,
  ArrowRight, Flame, Layers, Box, CheckCircle2, Search,
} from 'lucide-react'
import Surface from '../../ui/Surface'
import Button from '../../ui/Button'
import Badge from '../../ui/Badge'

export default function OverviewView({ meta, onSelectTab, onSelectNicheByName }) {
  if (!meta) return null

  const kpis = meta.summary_kpis || {}
  const highlights = meta.today_highlights || {}
  const catSummary = (meta.categories_summary || []).slice(0, 8)

  return (
    <div className="space-y-6">
      {/* 顶部大盘 KPI 状态卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Surface className="p-3">
          <div className="text-[11px] text-morandi-text-light">合格利基总数</div>
          <div className="text-xl font-bold text-morandi-text mt-1">
            {(kpis.passed_niches || 6534).toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-600 mt-1">过闸率 85.6%</div>
        </Surface>

        <Surface className="p-3">
          <div className="text-[11px] text-morandi-text-light">S+A 级高机会利基</div>
          <div className="text-xl font-bold text-morandi-primary mt-1">
            {(kpis.high_opportunity_sa || 765).toLocaleString()}
          </div>
          <div className="text-[11px] text-morandi-text-light mt-1">占比 11.7%</div>
        </Surface>

        <Surface className="p-3">
          <div className="text-[11px] text-morandi-text-light">立即测试候选池 (TEST)</div>
          <div className="text-xl font-bold text-emerald-600 mt-1">
            {kpis.immediate_test_candidates || 30}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1">轻小/免电/标品</div>
        </Surface>

        <Surface className="p-3">
          <div className="text-[11px] text-morandi-text-light">高风险观察池 (WATCH)</div>
          <div className="text-xl font-bold text-amber-600 mt-1">
            {kpis.watchlist_count || 114}
          </div>
          <div className="text-[11px] text-amber-700 mt-1">认证/重货/电化学</div>
        </Surface>

        <Surface className="p-3">
          <div className="text-[11px] text-morandi-text-light">蓝海高 DSI 搜索词</div>
          <div className="text-xl font-bold text-morandi-text mt-1">
            {(kpis.blue_ocean_keywords || 1280).toLocaleString()}
          </div>
          <div className="text-[11px] text-morandi-text-light mt-1">30 万需求词挖掘</div>
        </Surface>

        <Surface className="p-3">
          <div className="text-[11px] text-morandi-text-light">数据分析期</div>
          <div className="text-sm font-semibold text-morandi-text mt-1.5 font-mono truncate">
            {meta.data_period || '2026-06-18 ~ 2026-09-15'}
          </div>
          <div className="text-[11px] text-morandi-text-light mt-1">{meta.run_id}</div>
        </Surface>
      </div>

      {/* 「今日值得看」3 维机会推荐 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-morandi-text">今日值得看 (Today's Highlights)</h3>
            <span className="text-xs text-morandi-text-light">系统根据增长、供需与跨境友好度自动圈选</span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onSelectTab('radar')}
            className="text-xs gap-1 text-morandi-primary hover:text-morandi-primary-dark"
          >
            进入选品雷达
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. 高增长 */}
          <Surface className="p-4 border-l-4 border-l-rose-500 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-700">
                <Flame className="w-4 h-4 text-rose-500" />
                🔥 季度高增长爆发
              </span>
              <Badge variant="danger">环比暴涨</Badge>
            </div>
            <div className="space-y-2">
              {(highlights.growth || []).map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => onSelectNicheByName(item.name)}
                  className="p-2.5 rounded bg-rose-50/50 hover:bg-rose-50 border border-rose-100 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-morandi-text">
                    <span>{item.name}</span>
                    <span className="text-rose-600 font-bold">{item.growth}</span>
                  </div>
                  <div className="text-[11px] text-morandi-text-light mt-1 flex items-center justify-between">
                    <span>{item.category}</span>
                    <span>GMV: ¥{(item.gmv / 10000).toFixed(0)}万</span>
                  </div>
                  <div className="text-[11px] text-rose-800/80 mt-1 line-clamp-1">{item.note}</div>
                </div>
              ))}
            </div>
          </Surface>

          {/* 2. 供需缺口 */}
          <Surface className="p-4 border-l-4 border-l-sky-500 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-sky-700">
                <Compass className="w-4 h-4 text-sky-500" />
                🔵 供需缺口蓝海
              </span>
              <Badge variant="info">竞争宽松</Badge>
            </div>
            <div className="space-y-2">
              {(highlights.supply_gap || []).map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => onSelectNicheByName(item.name)}
                  className="p-2.5 rounded bg-sky-50/50 hover:bg-sky-50 border border-sky-100 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-morandi-text">
                    <span>{item.name}</span>
                    <span className="text-sky-600 font-bold">签收 {item.buyout}</span>
                  </div>
                  <div className="text-[11px] text-morandi-text-light mt-1 flex items-center justify-between">
                    <span>{item.category}</span>
                    <span>活跃在售 {item.sellers} 家</span>
                  </div>
                  <div className="text-[11px] text-sky-800/80 mt-1 line-clamp-1">{item.note}</div>
                </div>
              ))}
            </div>
          </Surface>

          {/* 3. 跨境友好 */}
          <Surface className="p-4 border-l-4 border-l-emerald-500 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <Box className="w-4 h-4 text-emerald-500" />
                🟢 跨境友好轻小件
              </span>
              <Badge variant="success">低库存测款</Badge>
            </div>
            <div className="space-y-2">
              {(highlights.cross_border || []).map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => onSelectNicheByName(item.name)}
                  className="p-2.5 rounded bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-100 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-morandi-text">
                    <span>{item.name}</span>
                    <span className="text-emerald-700 font-bold">{item.weight}</span>
                  </div>
                  <div className="text-[11px] text-morandi-text-light mt-1 flex items-center justify-between">
                    <span>{item.category}</span>
                    <span>均价 ¥{item.price} (签收{item.buyout})</span>
                  </div>
                  <div className="text-[11px] text-emerald-800/80 mt-1 line-clamp-1">{item.note}</div>
                </div>
              ))}
            </div>
          </Surface>
        </div>
      </div>

      {/* 重点类目分布概览 */}
      <Surface className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-semibold text-morandi-text">TOP 重点品类机会分布 (大盘概览)</h4>
            <p className="text-[11px] text-morandi-text-light">按季度总销售规模排序的头部类目与利基活跃度</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => onSelectTab('niches')} className="text-xs">
            查看全部 97 个大类
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-morandi-text-light">
                <th className="py-2 px-3 font-medium">类目名称</th>
                <th className="py-2 px-3 font-medium text-right">包含利基数</th>
                <th className="py-2 px-3 font-medium text-right">季度总 GMV</th>
                <th className="py-2 px-3 font-medium text-right">平均卖家数</th>
                <th className="py-2 px-3 font-medium text-center">优先级</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-morandi-text">
              {catSummary.map((cat, idx) => (
                <tr key={idx} className="hover:bg-morandi-50/60 transition-colors">
                  <td className="py-2.5 px-3 font-medium">{cat.category}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{cat.niche_count}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold">
                    ¥{Number(cat.total_gmv).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">{cat.avg_sellers || '--'}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-morandi-100 text-morandi-text">
                      P{idx < 3 ? '1 核心' : idx < 6 ? '2 重点' : '3 观察'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>
    </div>
  )
}
