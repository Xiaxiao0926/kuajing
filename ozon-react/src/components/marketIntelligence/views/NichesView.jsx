/**
 * NichesView.jsx — 利基市场全量 6,534 条明细视图
 * 支持品类树筛选、模糊检索、分页与 CSV 格式化导出
 */
import { useState, useMemo } from 'react'
import { Search, Download, ChevronLeft, ChevronRight, Layers, ExternalLink } from 'lucide-react'
import Surface from '../../ui/Surface'
import Button from '../../ui/Button'
import Badge from '../../ui/Badge'

export default function NichesView({ niches, onSelectNiche }) {
  const [search, setSearch] = useState('')
  const [selectedCat, setSelectedCat] = useState('ALL')
  const [page, setPage] = useState(1)
  const pageSize = 50

  const categories = useMemo(() => {
    if (!Array.isArray(niches)) return []
    const map = new Map()
    for (const n of niches) {
      map.set(n.cat, (map.get(n.cat) || 0) + 1)
    }
    return [
      { name: 'ALL', count: niches.length },
      ...Array.from(map.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    ]
  }, [niches])

  const filtered = useMemo(() => {
    if (!Array.isArray(niches)) return []
    const q = search.trim().toLowerCase()
    return niches.filter((n) => {
      if (selectedCat !== 'ALL' && n.cat !== selectedCat) return false
      if (q) {
        return (
          n.name.toLowerCase().includes(q) ||
          (n.top_kw || '').toLowerCase().includes(q) ||
          (n.cat || '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [niches, search, selectedCat])

  const totalPages = Math.ceil(filtered.length / pageSize) || 1
  const currentPageList = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page])

  const handleExportCsv = () => {
    if (!filtered.length) return
    const headers = ['排名', '利基名称', '品类', '评级', '市场机会分(MOS)', '初筛可行分(PFS)', '综合指数', '季度GMV', '环比增长', '在售卖家', '签收率', '均价', '搜索量', 'DSI', '状态']
    const rows = filtered.map((n) => [
      n.id,
      `"${n.name.replace(/"/g, '""')}"`,
      `"${n.cat.replace(/"/g, '""')}"`,
      n.tier,
      n.mos,
      n.cfs,
      n.comp,
      n.gmv,
      `"${n.growth}"`,
      n.sellers,
      `"${n.buyout}%"`,
      n.price,
      n.search,
      n.dsi,
      n.verdict,
    ])

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `WB_Niches_Export_${selectedCat}_${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* 左侧品类导航面板 */}
      <Surface className="p-3 lg:col-span-1 space-y-3 max-h-[750px] flex flex-col">
        <div className="flex items-center gap-1.5 font-semibold text-xs text-morandi-text pb-2 border-b border-gray-100">
          <Layers className="w-3.5 h-3.5 text-morandi-primary" />
          全量品类索引 (97大类)
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 text-xs pr-1">
          {categories.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => {
                setSelectedCat(c.name)
                setPage(1)
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded transition-colors text-left ${
                selectedCat === c.name
                  ? 'bg-morandi-primary text-white font-medium'
                  : 'hover:bg-morandi-50 text-morandi-text'
              }`}
            >
              <span className="truncate">{c.name === 'ALL' ? '全部大类 (全量)' : c.name}</span>
              <span className={`text-[10px] ml-2 ${selectedCat === c.name ? 'text-morandi-100' : 'text-morandi-text-light font-mono'}`}>
                {c.count}
              </span>
            </button>
          ))}
        </div>
      </Surface>

      {/* 右侧利基数据表格 */}
      <div className="lg:col-span-3 space-y-3">
        <Surface className="p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-morandi-text-light absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="在当前品类中模糊搜索利基..."
              className="w-full text-xs rounded border border-gray-200 pl-8 pr-3 py-1.5 outline-none focus:border-morandi-primary"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-morandi-text-light">
              共 <b>{filtered.length.toLocaleString()}</b> 条记录
            </span>
            <Button variant="secondary" size="sm" onClick={handleExportCsv} className="gap-1 text-xs">
              <Download className="w-3.5 h-3.5" />
              导出当前筛选 CSV
            </Button>
          </div>
        </Surface>

        {/* 表格 */}
        <Surface className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-morandi-50/70 text-morandi-text-light font-medium">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">利基名称</th>
                <th className="py-2.5 px-3">品类</th>
                <th className="py-2.5 px-3 text-right">MOS</th>
                <th className="py-2.5 px-3 text-right">PFS</th>
                <th className="py-2.5 px-3 text-right">综合分</th>
                <th className="py-2.5 px-3 text-right">季度 GMV</th>
                <th className="py-2.5 px-3 text-right">增长率</th>
                <th className="py-2.5 px-3 text-right">签收率</th>
                <th className="py-2.5 px-3 text-right">卖家数</th>
                <th className="py-2.5 px-3 text-center">定级</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-morandi-text">
              {currentPageList.map((n) => (
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
                  <td className="py-2 px-3 text-right font-mono">¥{Number(n.gmv).toLocaleString()}</td>
                  <td className={`py-2 px-3 text-right font-mono ${String(n.growth).includes('+') ? 'text-emerald-600' : ''}`}>
                    {n.growth}
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-semibold text-morandi-primary">{n.buyout}%</td>
                  <td className="py-2 px-3 text-right font-mono">{n.sellers}</td>
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

        {/* 分页控制栏 */}
        <div className="flex items-center justify-between p-2 text-xs text-morandi-text-light">
          <div>
            第 {page} / {totalPages} 页 (显示 {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, filtered.length)} 条)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              上一页
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              下一页
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
