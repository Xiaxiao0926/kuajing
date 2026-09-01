import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  RefreshCw, Layers, Target, AlertCircle, FlaskConical, ClipboardCheck,
  CheckCircle2, XCircle, Save, Trash2, History, FileSpreadsheet,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import { chartColors } from '../utils/chartConfigs'
import { R as EXCHANGE_RATE } from '../utils/ozonEngine'
import { runPurityPipeline, TIER_META } from '../utils/marketAnalysis/purityFilter.js'
import { buildWeightedBands } from '../utils/marketAnalysis/priceBands.js'
import { buildCredibility, createSample, summarizeChecks } from '../utils/marketAnalysis/credibility.js'
import rules from '../generated/market_analysis.js'
import { persistGet, persistSet } from '../utils/persist'
import { getDataUrl } from '../utils/runtime.js'
import { listServerFiles } from '../utils/serverFiles.js'
import * as XLSX from 'xlsx'

const DATA_DIR = getDataUrl().replace(/\/$/, '')
const FILE_NAMESPACE = 'market-research'
const CHECKS_KEY = 'purity-checks-v1'
const HISTORY_KEY = 'purity-sample-history-v1'

const TIER_COLORS = { A: '#A8C5A8', B: '#E3C9A8', C: '#B4BEC9', UNKNOWN: '#C9A8A8' }
const TIER_ORDER = ['A', 'B', 'C', 'UNKNOWN']
const BASIS_LABEL = { pcs: '数量（只）', volume_ml: '容量（ml）', weight_g: '重量（g）' }

const fmtRub = (v) => (v >= 100 ? `₽${Math.round(v).toLocaleString()}` : `₽${v.toFixed(1)}`)
const fmtRmb = (v) => {
  const r = v * EXCHANGE_RATE
  return r >= 100 ? `¥${Math.round(r).toLocaleString()}` : `¥${r.toFixed(1)}`
}

function parseXlsxArrayBuffer(arrayBuffer) {
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
  if (jsonData.length < 2) return []
  const headers = jsonData[0].map((h) => String(h).trim())
  return jsonData
    .slice(1)
    .filter((row) => row.some((cell) => cell !== undefined && cell !== null && cell !== ''))
    .map((row) => {
      const obj = {}
      headers.forEach((header, index) => { obj[header] = row[index] })
      return obj
    })
}

export default function PurityPipelinePage({ data }) {
  const [rows, setRows] = useState(null)
  const [sourceLabel, setSourceLabel] = useState('')
  const [availableFiles, setAvailableFiles] = useState([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [loadingFile, setLoadingFile] = useState(false)

  const [scope, setScope] = useState('A')

  const [seed, setSeed] = useState(1)
  const [sample, setSample] = useState(null)
  const [checks, setChecks] = useState({})
  const [checksSavedAt, setChecksSavedAt] = useState(null)
  const [history, setHistory] = useState([])
  const fileInitRef = useRef(false)

  useEffect(() => {
    setChecks(persistGet(CHECKS_KEY) || {})
    setHistory(persistGet(HISTORY_KEY) || [])
  }, [])

  useEffect(() => {
    if (fileInitRef.current || !data || data.length === 0) return
    fileInitRef.current = true
    setRows(data)
    setSourceLabel('顶部/市场调研已上传数据')
  }, [data])

  const fetchFiles = useCallback(async () => {
    try {
      setLoadingFiles(true)
      const resp = await fetch(`${DATA_DIR}/manifest.json?t=${Date.now()}`)
      let publicFiles = []
      if (resp.ok) {
        const manifest = await resp.json()
        publicFiles = (manifest.files || []).filter((f) => f.name.includes('热销'))
      }
      let serverFiles = []
      try { serverFiles = await listServerFiles(FILE_NAMESPACE) } catch {}
      const merged = new Map(publicFiles.map((f) => [f.name, f]))
      serverFiles.forEach((f) => merged.set(f.name, { ...f, source: 'server' }))
      setAvailableFiles([...merged.values()].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))))
    } catch { setAvailableFiles([]) }
    finally { setLoadingFiles(false) }
  }, [])

  useEffect(() => { fetchFiles() }, [fetchFiles])

  const handleLoadFile = async (file) => {
    try {
      setLoadingFile(true)
      const resp = await fetch(file.downloadUrl || `${DATA_DIR}/${file.name}`)
      if (!resp.ok) throw new Error('下载失败')
      const parsed = parseXlsxArrayBuffer(await resp.arrayBuffer())
      if (parsed.length === 0) return
      setRows(parsed)
      setSourceLabel(file.name)
      setSample(null)
    } catch (err) { console.error('Load file error:', err) }
    finally { setLoadingFile(false) }
  }

  const pipeline = useMemo(() => (rows && rows.length ? runPurityPipeline(rows) : null), [rows])

  const catCfg = pipeline?.category?.key ? rules.categories[pipeline.category.key] : null

  const bandsA = useMemo(() => (pipeline ? buildWeightedBands(pipeline.rows, { tiers: ['A'] }) : null), [pipeline])
  const bandsAB = useMemo(() => (pipeline ? buildWeightedBands(pipeline.rows, { tiers: ['A', 'B'] }) : null), [pipeline])
  const bandsResult = scope === 'AB' ? bandsAB : bandsA

  const credibility = useMemo(() => (pipeline ? buildCredibility(pipeline.rows, pipeline.category) : null), [pipeline])

  const tierReasons = useMemo(() => {
    if (!pipeline) return {}
    const m = {}
    for (const r of pipeline.rows) {
      const t = r._purity.tier
      const reason = r._purity.reason || ''
      m[t] = m[t] || {}
      m[t][reason] = (m[t][reason] || 0) + 1
    }
    for (const t of Object.keys(m)) {
      m[t] = Object.entries(m[t]).sort((a, b) => b[1] - a[1])
    }
    return m
  }, [pipeline])

  const tierChart = useMemo(() => {
    if (!pipeline) return []
    return TIER_ORDER.map((t) => ({
      name: TIER_META[t].label,
      tier: t,
      count: pipeline.stats.tierCounts[t] || 0,
    }))
  }, [pipeline])

  const bandChart = useMemo(() => {
    if (!bandsResult || !bandsResult.bands.length) return []
    return bandsResult.bands.map((b) => ({
      name: b.label,
      'SKU占比': b.skuShare,
      '销量占比': b.qtyShare,
      '销售额占比': b.salesShare,
    }))
  }, [bandsResult])

  const generateSample = () => {
    if (!pipeline) return
    const size = rules.sampling?.default_size ?? 50
    const s = createSample(pipeline.rows, { size, seed })
    setSample(s)
    const entry = {
      time: new Date().toLocaleString('zh-CN', { hour12: false }),
      source: sourceLabel || '未命名',
      seed,
      size: s.length,
      coveragePct: pipeline.stats.coveragePct,
      tierCounts: { ...pipeline.stats.tierCounts },
    }
    const next = [entry, ...history].slice(0, 20)
    setHistory(next)
    persistSet(HISTORY_KEY, next)
  }

  const markCheck = (key, value) => {
    setChecks((prev) => {
      const next = { ...prev }
      if (next[key] === value) delete next[key]
      else next[key] = value
      return next
    })
  }

  const saveChecks = () => {
    persistSet(CHECKS_KEY, checks)
    setChecksSavedAt(new Date().toLocaleString('zh-CN', { hour12: false }))
  }

  const clearChecks = () => {
    setChecks({})
    persistSet(CHECKS_KEY, {})
    setChecksSavedAt(null)
  }

  const checkSummary = useMemo(
    () => (sample ? summarizeChecks(sample, checks) : null),
    [sample, checks]
  )

  const tierAccuracy = useMemo(() => {
    if (!sample) return []
    return TIER_ORDER.map((t) => {
      const items = sample.filter((s) => s.tier === t)
      let checked = 0, correct = 0
      for (const item of items) {
        const mark = checks[item.key]
        if (mark === 'correct' || mark === 'wrong') {
          checked++
          if (mark === 'correct') correct++
        }
      }
      return {
        tier: t,
        label: TIER_META[t].label,
        total: items.length,
        checked,
        correct,
        accuracyPct: checked > 0 ? Math.round((correct / checked) * 1000) / 10 : null,
      }
    }).filter((t) => t.total > 0)
  }, [sample, checks])

  if (!rows || rows.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 shadow-sm text-center">
        <Layers className="w-10 h-10 text-gray-200 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-morandi-text mb-2">选品市场分析（纯度流水线）</h3>
        <p className="text-sm text-morandi-text-light mb-4">
          请从下方选择 Ozon 热销数据文件，或在顶部/市场调研页上传数据
        </p>
        <FileSelector
          files={availableFiles}
          loadingFiles={loadingFiles}
          loadingFile={loadingFile}
          onRefresh={fetchFiles}
          onLoad={handleLoadFile}
        />
      </div>
    )
  }

  const stats = pipeline.stats
  const bands = bandsResult?.bands || []

  return (
    <div className="space-y-6">
      <div className="insight-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-morandi-text flex items-center gap-2">
              <Layers className="w-4 h-4 text-morandi-primary" />
              选品市场分析 · 纯度流水线
            </h3>
            <p className="text-xs text-morandi-text-light mt-1">
              数据源：{sourceLabel} · {rows.length} 行 · 规则版本 v{rules.version}（{rules.updated_at}）
            </p>
          </div>
          <div className="min-w-[240px]">
            <FileSelector
              files={availableFiles}
              loadingFiles={loadingFiles}
              loadingFile={loadingFile}
              onRefresh={fetchFiles}
              onLoad={handleLoadFile}
              compact
            />
          </div>
        </div>
      </div>

      {stats.total === 0 && (
        <div className="insight-card border-l-4 border-amber-400">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-morandi-text">数据中未找到商品名称列</p>
              <p className="text-xs text-morandi-text-light mt-1">
                纯度流水线依赖「商品名称」列做规格识别，请确认数据文件格式
              </p>
            </div>
          </div>
        </div>
      )}

      {stats.total > 0 && !catCfg && (
        <div className="insight-card border-l-4 border-amber-400">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-morandi-text">未识别到已配置类目（NEEDS_DATA）</p>
              <p className="text-xs text-morandi-text-light mt-1">
                类目关键词最高得票份额 {Math.round((pipeline.category.share || 0) * 1000) / 10}%，
                低于检测门槛 {Math.round((rules.sampling?.min_share_for_detection ?? 0.3) * 100)}%。
                全部样本进入 UNKNOWN，不做任何假设性分类。可在 config/market_analysis.json 中配置该类目后重试。
              </p>
            </div>
          </div>
        </div>
      )}

      {stats.total > 0 && catCfg && (
        <div className="insight-card">
          <h3 className="font-semibold text-morandi-text mb-3">📦 类目检测与折算口径</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-morandi-text-light">识别类目</p>
              <p className="font-semibold text-morandi-text mt-1">{catCfg.label}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-morandi-text-light">检测得票份额</p>
              <p className="font-semibold text-morandi-text mt-1">
                {Math.round((pipeline.category.share || 0) * 1000) / 10}%
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-morandi-text-light">目标计价口径</p>
              <p className="font-semibold text-morandi-text mt-1">{BASIS_LABEL[catCfg.target_basis]}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-morandi-text-light">标准化基准</p>
              <p className="font-semibold text-morandi-text mt-1">{catCfg.normalize.label}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-morandi-text-light">пар 双装处理</p>
              <p className="font-semibold text-morandi-text mt-1">
                {catCfg.pair_handling === 'convert' ? '×2 折算为只' : '排除（判 C）'}
              </p>
            </div>
          </div>
        </div>
      )}

      {stats.total > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="kpi-card">
              <Target className="w-6 h-6 text-morandi-primary mb-2" />
              <div className="text-xl font-bold text-morandi-text">{stats.total}</div>
              <div className="text-xs text-morandi-text-light">有效样本（有标题）</div>
            </div>
            <div className="kpi-card">
              <div className="w-6 h-6 rounded-lg bg-morandi-success/10 flex items-center justify-center mb-2">
                <span className="text-morandi-success font-bold text-xs">%</span>
              </div>
              <div className="text-xl font-bold text-morandi-text">{stats.coveragePct}%</div>
              <div className="text-xs text-morandi-text-light">规格识别覆盖率</div>
            </div>
            <div className="kpi-card">
              <CheckCircle2 className="w-6 h-6 mb-2" style={{ color: TIER_COLORS.A }} />
              <div className="text-xl font-bold text-morandi-text">{stats.tierCounts.A}</div>
              <div className="text-xs text-morandi-text-light">A 直接可比</div>
            </div>
            <div className="kpi-card">
              <AlertCircle className="w-6 h-6 mb-2" style={{ color: TIER_COLORS.UNKNOWN }} />
              <div className="text-xl font-bold text-morandi-text">{stats.tierCounts.UNKNOWN}</div>
              <div className="text-xs text-morandi-text-light">UNKNOWN 未解析</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="insight-card">
              <h3 className="font-semibold text-morandi-text mb-4">🏷️ 竞品纯度分层分布</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tierChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {tierChart.map((entry) => (
                        <Cell key={entry.tier} fill={TIER_COLORS[entry.tier]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="insight-card">
              <h3 className="font-semibold text-morandi-text mb-4">📋 分层依据与主要成因</h3>
              <div className="space-y-3">
                {TIER_ORDER.map((t) => (
                  <div key={t} className="border rounded-lg p-2.5" style={{ borderColor: `${TIER_COLORS[t]}66` }}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-morandi-text flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: TIER_COLORS[t] }} />
                        {TIER_META[t].label}
                      </span>
                      <span className="text-sm font-bold text-morandi-text">
                        {stats.tierCounts[t]}
                        <span className="text-xs font-normal text-morandi-text-light ml-1">
                          ({stats.total > 0 ? Math.round((stats.tierCounts[t] / stats.total) * 1000) / 10 : 0}%)
                        </span>
                      </span>
                    </div>
                    {(tierReasons[t] || []).slice(0, 3).map(([reason, n]) => (
                      <p key={reason} className="text-xs text-morandi-text-light mt-1 pl-5">
                        · {reason}（{n}）
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="insight-card">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="font-semibold text-morandi-text">💰 三维加权价格带（标准化可比价）</h3>
              <div className="flex items-center gap-2">
                {catCfg && (
                  <span className="text-xs text-morandi-text-light mr-2">价格轴：{catCfg.normalize.label}</span>
                )}
                <div className="flex rounded-lg overflow-hidden border border-gray-200">
                  <button
                    onClick={() => setScope('A')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${scope === 'A' ? 'bg-morandi-primary text-white' : 'bg-white text-morandi-text hover:bg-gray-50'}`}
                  >
                    A 默认
                  </button>
                  <button
                    onClick={() => setScope('AB')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${scope === 'AB' ? 'bg-morandi-primary text-white' : 'bg-white text-morandi-text hover:bg-gray-50'}`}
                  >
                    A+B 参考
                  </button>
                </div>
              </div>
            </div>

            {bands.length === 0 ? (
              <p className="text-sm text-morandi-text-light py-6 text-center">
                当前口径（{scope === 'A' ? 'A 直接可比' : 'A+B'}）下无可比价格数据
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-morandi-text-light">进入计算样本</p>
                    <p className="font-semibold text-morandi-text mt-1">{bandsResult.eligibleCount} SKU</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-morandi-text-light">主流价格带（销量占比最高）</p>
                    <p className="font-semibold text-morandi-text mt-1">
                      带{bandsResult.topQtyBandIndex}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-morandi-text-light">全距（可比价）</p>
                    <p className="font-semibold text-morandi-text mt-1">
                      {fmtRub(bands[0].priceMin)} – {fmtRub(bands[bands.length - 1].priceMax)}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-morandi-text-light">排除明细</p>
                    <p className="font-semibold text-morandi-text mt-1 text-xs">
                      {Object.entries(bandsResult.excludedBreakdown)
                        .map(([k, v]) => `${k === 'no_price' ? '无价格' : k}:${v}`)
                        .join(' · ') || '无'}
                    </p>
                  </div>
                </div>

                <div className="h-64 mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bandChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(v) => `${v}%`} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="SKU占比" fill={chartColors.primary} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="销量占比" fill={chartColors.accent} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="销售额占比" fill={chartColors.success} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">价格带</th>
                        <th className="px-3 py-2 text-left">可比价区间（{catCfg?.normalize.label || '标准化'}）</th>
                        <th className="px-3 py-2 text-right">中位价 ₽/¥</th>
                        <th className="px-3 py-2 text-right">SKU 数</th>
                        <th className="px-3 py-2 text-right">SKU 占比</th>
                        <th className="px-3 py-2 text-right">销量占比</th>
                        <th className="px-3 py-2 text-right">销售额占比</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {bands.map((b) => (
                        <tr key={b.index} className={`hover:bg-gray-50 ${b.index === bandsResult.topQtyBandIndex ? 'bg-amber-50/50' : ''}`}>
                          <td className="px-3 py-2 font-medium">
                            带{b.index}
                            {b.index === bandsResult.topQtyBandIndex && (
                              <span className="ml-1 text-[10px] text-amber-600 font-normal">主流</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs">{fmtRub(b.priceMin)} – {fmtRub(b.priceMax)}</td>
                          <td className="px-3 py-2 text-right">
                            <div>{fmtRub(b.medianPrice)}</div>
                            <div className="text-xs text-morandi-text-light">{fmtRmb(b.medianPrice)}</div>
                          </td>
                          <td className="px-3 py-2 text-right">{b.sku}</td>
                          <td className="px-3 py-2 text-right">{b.skuShare}%</td>
                          <td className="px-3 py-2 text-right">{b.qtyShare}%</td>
                          <td className="px-3 py-2 text-right">{b.salesShare}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-morandi-text-light mt-2">
                  占比分母 = 当前口径内合计；C 与 UNKNOWN 一律排除；价格轴为标准化可比价（{catCfg?.normalize.label || '—'}），非挂牌原价。
                </p>
              </>
            )}
          </div>

          <div className="insight-card">
            <h3 className="font-semibold text-morandi-text mb-4">🛡️ 数据可信度与人工抽检</h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-morandi-text-light">识别覆盖率</p>
                    <p className="font-semibold text-morandi-text mt-1">{credibility.coveragePct}%</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-morandi-text-light">已识别规格</p>
                    <p className="font-semibold text-morandi-text mt-1">{credibility.identified}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-morandi-text-light">UNKNOWN</p>
                    <p className="font-semibold text-morandi-text mt-1">{credibility.unknown}</p>
                  </div>
                </div>
                {credibility.unknownReasons.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-morandi-text mb-1.5">UNKNOWN 成因（不自动归 C，防假精确）</p>
                    <div className="space-y-1">
                      {credibility.unknownReasons.map(([reason, n]) => (
                        <div key={reason} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2.5 py-1.5">
                          <span className="text-morandi-text-light">{reason}</span>
                          <span className="font-medium text-morandi-text">{n}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {history.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-morandi-text mb-1.5 flex items-center gap-1">
                      <History className="w-3.5 h-3.5" /> 抽检生成记录（最近 {history.length} 次）
                    </p>
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {history.map((h, i) => (
                        <p key={i} className="text-[11px] text-morandi-text-light">
                          {h.time} · {h.source} · 种子 {h.seed} · {h.size} 条 · 覆盖率 {h.coveragePct}%
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-end gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-morandi-text-light mb-1">随机种子（同种子=同样本）</label>
                    <input
                      type="number"
                      min="1"
                      value={seed}
                      onChange={(e) => setSeed(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-24 rounded-md border border-gray-200 px-2 py-1.5 text-sm text-morandi-text"
                    />
                  </div>
                  <button
                    onClick={generateSample}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-morandi-primary text-white rounded-lg text-xs font-medium hover:bg-morandi-primary/90"
                  >
                    <FlaskConical className="w-3.5 h-3.5" />
                    生成抽检样本（{rules.sampling?.default_size ?? 50} SKU）
                  </button>
                </div>

                {!sample ? (
                  <p className="text-sm text-morandi-text-light py-8 text-center bg-gray-50 rounded-lg">
                    点击「生成抽检样本」从 {stats.total} 条中种子化随机抽取
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-xs text-morandi-text-light">
                        已核验 {checkSummary.checked} / {sample.length}
                      </span>
                      {checkSummary.accuracyPct !== null && (
                        <span className="text-xs font-semibold text-morandi-text">
                          规格判定准确率 {checkSummary.accuracyPct}%
                        </span>
                      )}
                      <span className="flex-1" />
                      <button
                        onClick={saveChecks}
                        className="flex items-center gap-1 px-2.5 py-1 bg-green-600 text-white rounded-md text-xs font-medium hover:bg-green-700"
                      >
                        <Save className="w-3 h-3" /> 保存核验结果
                      </button>
                      <button
                        onClick={clearChecks}
                        className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-medium hover:bg-gray-200"
                      >
                        <Trash2 className="w-3 h-3" /> 清空
                      </button>
                    </div>
                    {checksSavedAt && (
                      <p className="text-[11px] text-green-600 mb-2">核验结果已保存（{checksSavedAt}）</p>
                    )}

                    <div className="max-h-80 overflow-y-auto border border-gray-100 rounded-lg">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-2 py-2 text-left">标题</th>
                            <th className="px-2 py-2 text-center">分层</th>
                            <th className="px-2 py-2 text-left">规格解析</th>
                            <th className="px-2 py-2 text-right">可比价</th>
                            <th className="px-2 py-2 text-center">核验</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {sample.map((item) => {
                            const mark = checks[item.key]
                            return (
                              <tr key={item.key} className={mark === 'wrong' ? 'bg-red-50/60' : mark === 'correct' ? 'bg-green-50/40' : ''}>
                                <td className="px-2 py-1.5 max-w-[220px]">
                                  <p className="truncate text-morandi-text" title={item.title}>{item.title}</p>
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  <span
                                    className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                                    style={{ background: TIER_COLORS[item.tier] }}
                                  >
                                    {item.tier}
                                  </span>
                                </td>
                                <td className="px-2 py-1.5 text-morandi-text-light">
                                  {item.specDetail}
                                  {item.inferred === 'singular' && (
                                    <span className="ml-1 text-[10px] text-amber-600">词形推断</span>
                                  )}
                                </td>
                                <td className="px-2 py-1.5 text-right">{item.normalizedPrice > 0 ? fmtRub(item.normalizedPrice) : '—'}</td>
                                <td className="px-2 py-1.5">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => markCheck(item.key, 'correct')}
                                      className={`p-1 rounded ${mark === 'correct' ? 'bg-green-100 text-green-600' : 'text-gray-300 hover:text-green-500 hover:bg-green-50'}`}
                                      title="规格判定正确"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => markCheck(item.key, 'wrong')}
                                      className={`p-1 rounded ${mark === 'wrong' ? 'bg-red-100 text-red-500' : 'text-gray-300 hover:text-red-400 hover:bg-red-50'}`}
                                      title="规格判定错误"
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {tierAccuracy.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-morandi-text mb-1.5 flex items-center gap-1">
                          <ClipboardCheck className="w-3.5 h-3.5" /> 分层准确率
                        </p>
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-2 py-1.5 text-left">分层</th>
                              <th className="px-2 py-1.5 text-right">样本数</th>
                              <th className="px-2 py-1.5 text-right">已核验</th>
                              <th className="px-2 py-1.5 text-right">正确</th>
                              <th className="px-2 py-1.5 text-right">准确率</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {tierAccuracy.map((t) => (
                              <tr key={t.tier}>
                                <td className="px-2 py-1.5">
                                  <span className="inline-flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full" style={{ background: TIER_COLORS[t.tier] }} />
                                    {t.label}
                                  </span>
                                </td>
                                <td className="px-2 py-1.5 text-right">{t.total}</td>
                                <td className="px-2 py-1.5 text-right">{t.checked}</td>
                                <td className="px-2 py-1.5 text-right">{t.correct}</td>
                                <td className="px-2 py-1.5 text-right font-medium">
                                  {t.accuracyPct === null ? '—' : `${t.accuracyPct}%`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {checkSummary.wrongItems.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-red-600 mb-1.5">异常清单（判定错误，需复核）</p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {checkSummary.wrongItems.map((w) => (
                            <p key={w.key} className="text-[11px] text-morandi-text-light bg-red-50/50 rounded px-2 py-1">
                              [{w.tier}] {w.title} → 系统解析：{w.specDetail}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function FileSelector({ files, loadingFiles, loadingFile, onRefresh, onLoad, compact }) {
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <select
          className="flex-1 min-w-0 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-morandi-text"
          defaultValue=""
          onChange={(e) => { const f = files.find((x) => x.name === e.target.value); if (f) onLoad(f); e.target.value = '' }}
          disabled={loadingFile || files.length === 0}
        >
          <option value="" disabled>
            {loadingFile ? '加载中…' : files.length === 0 ? '无可用热销文件' : '选择数据文件…'}
          </option>
          {files.map((f) => (
            <option key={f.name} value={f.name}>{f.name}（{f.date || ''}）</option>
          ))}
        </select>
        <button
          onClick={onRefresh}
          disabled={loadingFiles}
          className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
          title="刷新文件列表"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingFiles ? 'animate-spin' : ''}`} />
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto">
      <FileSelector compact files={files} loadingFiles={loadingFiles} loadingFile={loadingFile} onRefresh={onRefresh} onLoad={onLoad} />
      {files.length > 0 && (
        <p className="text-[11px] text-morandi-text-light mt-2">
          <FileSpreadsheet className="w-3 h-3 inline mr-1" />
          {files.length} 个热销文件可用
        </p>
      )}
    </div>
  )
}
