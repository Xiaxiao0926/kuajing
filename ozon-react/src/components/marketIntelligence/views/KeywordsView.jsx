/**
 * KeywordsView.jsx — 搜索词机会洞察视图
 * 直连 300,001 俄语搜索需求全量底表，支持毫秒级全文检索、品类下钻、意图聚类与多维排序
 * 具备客户端防抖 (300ms) 与离线降级双重保障，绝不拖垮浏览器主线程
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Search, Copy, Check, TrendingUp, Sparkles, Filter,
  ChevronLeft, ChevronRight, ArrowUpDown, Loader2,
} from 'lucide-react'
import Surface from '../../ui/Surface'
import Button from '../../ui/Button'
import Badge from '../../ui/Badge'

export default function KeywordsView({ keywords: fallbackKeywords = [] }) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedIntent, setSelectedIntent] = useState('ALL')
  const [selectedType, setSelectedType] = useState('ALL')
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [sortBy, setSortBy] = useState('search_vol')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const pageSize = 50

  const [apiData, setApiData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [apiFailed, setApiFailed] = useState(false)
  const [copiedKw, setCopiedKw] = useState('')

  const intents = ['ALL', '规格词', '机型词', '场景词', '爆发词']

  // 300ms 输入防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // 重置页码
  const handleFilterChange = (setter) => (val) => {
    setter(val)
    setPage(1)
  }

  // 排序切换
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(field)
      setSortDir('desc')
    }
    setPage(1)
  }

  // 尝试从 API 请求全量 300,001 词数据
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function fetchKeywords() {
      try {
        setLoading(true)
        const params = new URLSearchParams({
          q: debouncedSearch.trim(),
          category: selectedCategory,
          intent: selectedIntent,
          type: selectedType,
          sortBy,
          sortDir,
          page: String(page),
          pageSize: String(pageSize),
        })

        const res = await fetch(`/api/market-intelligence/keywords?${params.toString()}`, {
          signal: controller.signal,
        })

        if (!res.ok) throw new Error(`API HTTP ${res.status}`)
        const json = await res.json()

        if (!cancelled) {
          setApiData(json)
          setApiFailed(false)
        }
      } catch (err) {
        if (!cancelled && err.name !== 'AbortError') {
          console.warn('[KeywordsView] API 暂不可用，降级至内置关键词池:', err.message)
          setApiFailed(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchKeywords()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [debouncedSearch, selectedCategory, selectedIntent, selectedType, sortBy, sortDir, page])

  // 降级模式客户端过滤
  const clientFiltered = useMemo(() => {
    if (!apiFailed && apiData) return []
    const q = debouncedSearch.trim().toLowerCase()
    return fallbackKeywords.filter((k) => {
      if (selectedIntent !== 'ALL' && k.intent !== selectedIntent) return false
      if (selectedType !== 'ALL' && k.type !== selectedType) return false
      if (q) {
        return (
          k.query.toLowerCase().includes(q) ||
          (k.category || '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [fallbackKeywords, debouncedSearch, selectedIntent, selectedType, apiFailed, apiData])

  // 当前激活的数据集与分页信息
  const isUsingApi = !apiFailed && apiData !== null
  const displayItems = isUsingApi ? apiData.items : clientFiltered.slice((page - 1) * pageSize, page * pageSize)
  const totalKeywordsCount = isUsingApi ? apiData.total : fallbackKeywords.length
  const filteredCount = isUsingApi ? apiData.filteredCount : clientFiltered.length
  const totalPages = isUsingApi ? apiData.totalPages : Math.ceil(filteredCount / pageSize) || 1

  const handleCopy = (kw) => {
    navigator.clipboard.writeText(kw)
    setCopiedKw(kw)
    setTimeout(() => setCopiedKw(''), 1500)
  }

  return (
    <div className="space-y-4">
      {/* 顶部搜索与过滤 */}
      <Surface className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-morandi-text-light absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索全量 300,001 俄语需求词（如 stihl、пистолет、для авто）..."
              className="w-full text-xs rounded border border-gray-200 pl-8 pr-8 py-2 outline-none focus:border-morandi-primary bg-white"
            />
            {loading && (
              <Loader2 className="w-3.5 h-3.5 text-morandi-primary animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedType}
              onChange={(e) => handleFilterChange(setSelectedType)(e.target.value)}
              className="text-xs rounded border border-gray-200 px-2 py-1.5 bg-white text-morandi-text"
            >
              <option value="ALL">全部机会类型</option>
              <option value="BLUE_OCEAN">🔵 供需缺口蓝海词 (DSI&ge;1.5)</option>
              <option value="HIGH_GROWTH">⚡ 环比暴涨需求词</option>
            </select>

            <select
              value={selectedIntent}
              onChange={(e) => handleFilterChange(setSelectedIntent)(e.target.value)}
              className="text-xs rounded border border-gray-200 px-2 py-1.5 bg-white text-morandi-text"
            >
              {intents.map((it) => (
                <option key={it} value={it}>{it === 'ALL' ? '全部意图聚类' : it}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-morandi-text-light pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <span>
              全量俄语搜索词库：共 <b>{totalKeywordsCount.toLocaleString()}</b> 词
            </span>
            <span className="text-gray-300">|</span>
            <span>
              当前筛选命中：<b className="text-morandi-primary">{filteredCount.toLocaleString()}</b> 条
            </span>
            {isUsingApi ? (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-mono">
                全量索引引擎实时检索
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-mono">
                本地精选离线池
              </span>
            )}
          </div>

          {/* 分页按钮 */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <span>
              第 <b>{page}</b> / {totalPages} 页
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </Surface>

      {/* 关键词数据表格 */}
      <Surface className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-morandi-50/70 text-morandi-text-light font-medium">
              <th className="py-2.5 px-3">#</th>
              <th className="py-2.5 px-3">俄语搜索词 (Query)</th>
              <th className="py-2.5 px-3">归属类目</th>
              <th className="py-2.5 px-3">意图分类</th>
              <th
                onClick={() => handleSort('search_vol')}
                className="py-2.5 px-3 text-right cursor-pointer hover:text-morandi-primary select-none"
              >
                <span className="inline-flex items-center gap-1">
                  季度搜索量
                  <ArrowUpDown className="w-3 h-3" />
                </span>
              </th>
              <th
                onClick={() => handleSort('goods_count')}
                className="py-2.5 px-3 text-right cursor-pointer hover:text-morandi-primary select-none"
              >
                <span className="inline-flex items-center gap-1">
                  在售商品数
                  <ArrowUpDown className="w-3 h-3" />
                </span>
              </th>
              <th
                onClick={() => handleSort('dsi')}
                className="py-2.5 px-3 text-right cursor-pointer hover:text-morandi-primary select-none"
              >
                <span className="inline-flex items-center gap-1">
                  DSI 机会指数
                  <ArrowUpDown className="w-3 h-3" />
                </span>
              </th>
              <th className="py-2.5 px-3 text-right">下单转化率</th>
              <th
                onClick={() => handleSort('growth')}
                className="py-2.5 px-3 text-right cursor-pointer hover:text-morandi-primary select-none"
              >
                <span className="inline-flex items-center gap-1">
                  加购率/增长率
                  <ArrowUpDown className="w-3 h-3" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-morandi-text">
            {displayItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-morandi-text-light">
                  未找到匹配关键词，请尝试缩短或更换俄语检索词
                </td>
              </tr>
            ) : (
              displayItems.map((k, idx) => (
                <tr key={idx} className="hover:bg-morandi-50/70 transition-colors">
                  <td className="py-2 px-3 font-mono text-morandi-text-light">
                    {k.rank || (page - 1) * pageSize + idx + 1}
                  </td>
                  <td className="py-2 px-3 font-mono font-medium text-morandi-text">
                    <div className="flex items-center gap-2">
                      <span className="select-all">{k.query}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(k.query)}
                        className="text-morandi-text-light hover:text-morandi-primary p-1"
                        title="复制俄语词"
                      >
                        {copiedKw === k.query ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-morandi-text-light">{k.category || '--'}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        k.intent === '规格词'
                          ? 'bg-indigo-50 text-indigo-700'
                          : k.intent === '机型词'
                          ? 'bg-amber-50 text-amber-700'
                          : k.intent === '爆发词'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {k.intent}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-semibold">
                    {(k.search_vol || 0).toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-morandi-text-light">
                    {(k.goods_count || 0).toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-morandi-primary">
                    {k.dsi || '--'}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-emerald-600 font-medium">
                    {k.order_cvr || '--'}
                  </td>
                  <td className="py-2 px-3 text-right font-mono">
                    {k.growth ? (
                      <span className="text-rose-600 font-bold">{k.growth}</span>
                    ) : (
                      k.cart_rate || k.cart_cvr || '--'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Surface>
    </div>
  )
}
