/**
 * MarketIntelligenceApp.jsx — 俄罗斯市场情报与选品决策系统（主入口面板）
 * 包含 6 大业务视图：市场总览 / 选品雷达 / 利基市场 / 搜索词机会 / 产品验证池 / 数据中心
 * 以及 Niche 机会详情抽屉与 Phase 5 采购验证工作台
 */
import { useState, useEffect, useMemo } from 'react'
import {
  TrendingUp, Compass, Layers, Search, CheckCircle2,
  Database, RefreshCw, AlertCircle, Sparkles, Box,
} from 'lucide-react'
import Surface from '../ui/Surface'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import LoadingState from '../ui/LoadingState'
import OverviewView from './views/OverviewView'
import RadarView from './views/RadarView'
import NichesView from './views/NichesView'
import KeywordsView from './views/KeywordsView'
import ValidationPoolView from './views/ValidationPoolView'
import DataHubView from './views/DataHubView'
import NicheDetailDrawer from './components/NicheDetailDrawer'
import ManualProcurementWorkbench from './components/ManualProcurementWorkbench'
import {
  fetchActiveRunInfo, fetchRunBundle, getValidationOverrides,
  saveValidationOverride, buildMergedValidationPool, promoteToT6Candidate,
} from '../../utils/marketIntelligence/miStore'

export default function MarketIntelligenceApp({ onNavigateToWbCalc }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [bundle, setBundle] = useState(null)
  const [availableRuns, setAvailableRuns] = useState([])
  const [currentRunId, setCurrentRunId] = useState('RUN-20260917-001')
  const [validationOverrides, setValidationOverrides] = useState({})
  const [toastMessage, setToastMessage] = useState('')

  // 抽屉状态
  const [selectedNiche, setSelectedNiche] = useState(null)
  const [procurementTarget, setProcurementTarget] = useState(null)

  // 提示信息定时关闭
  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3000)
  }

  // 切换数据批次
  const handleSwitchRun = async (newRunId) => {
    if (newRunId === currentRunId) return
    try {
      setLoading(true)
      const dataBundle = await fetchRunBundle(newRunId)
      setBundle(dataBundle)
      setCurrentRunId(newRunId)
      showToast(`已切换至数据批次：${newRunId}`)
    } catch (err) {
      showToast(`切换批次失败: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // 加载数据
  useEffect(() => {
    let cancelled = false
    async function loadData() {
      try {
        setLoading(true)
        setError(null)
        const activeInfo = await fetchActiveRunInfo()
        const runs = activeInfo.available_runs || []
        setAvailableRuns(runs)
        const runId = activeInfo.active_run_id || 'RUN-20260917-001'
        setCurrentRunId(runId)
        const dataBundle = await fetchRunBundle(runId)
        if (!cancelled) {
          setBundle(dataBundle)
          setValidationOverrides(getValidationOverrides())
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[MarketIntelligence] 数据加载失败:', err)
          setError(err.message || '加载失败')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadData()
    return () => { cancelled = true }
  }, [])

  // 合并验证池数据 (系统默认 Phase 4 + 用户操作)
  const mergedValidationPool = useMemo(() => {
    if (!bundle) return { TEST: [], VERIFY: [], WATCH: [], DROP: [] }
    return buildMergedValidationPool(
      bundle.defaultValidationPool,
      bundle.niches,
      validationOverrides
    )
  }, [bundle, validationOverrides])

  // 处理状态更新
  const handleUpdateVerdict = (name, verdict, note = '') => {
    const updated = saveValidationOverride(name, verdict, note)
    setValidationOverrides({ ...updated })
    showToast(`已将「${name}」移入 ${verdict} 阶段！`)
  }

  // 推送到 T6 候选池
  const handlePromoteToT6 = (niche, reason = '') => {
    try {
      const { candidate, created } = promoteToT6Candidate(niche, reason, currentRunId)
      showToast(
        created
          ? `已成功将「${niche.name}」添加至 T6 候选池！`
          : `「${niche.name}」已在 T6 候选池中，信息已同步更新！`
      )
    } catch (err) {
      showToast(`推送到 T6 失败: ${err.message}`)
    }
  }

  // 从推荐卡片按名称打开详情
  const handleSelectNicheByName = (name) => {
    if (!bundle?.niches) return
    const target = bundle.niches.find((n) => n.name === name)
    if (target) setSelectedNiche(target)
  }

  const tabs = [
    { id: 'overview', label: '市场总览', icon: TrendingUp },
    { id: 'radar', label: '选品雷达', icon: Compass },
    { id: 'niches', label: '利基市场', icon: Layers },
    { id: 'keywords', label: '搜索词机会', icon: Search },
    { id: 'validation', label: '产品验证池', icon: CheckCircle2 },
    { id: 'datahub', label: '数据中心', icon: Database },
  ]

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingState text="正在加载俄罗斯市场选品决策情报数据..." />
      </div>
    )
  }

  if (error) {
    return (
      <Surface className="p-8 text-center text-rose-600 space-y-3">
        <AlertCircle className="w-8 h-8 mx-auto" />
        <div className="font-semibold text-sm">市场情报系统数据加载异常</div>
        <div className="text-xs text-morandi-text-light">{error}</div>
        <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
          重试加载
        </Button>
      </Surface>
    )
  }

  return (
    <div className="space-y-4">
      {/* 顶部系统标题与批次栏 */}
      <Surface className="p-4 bg-white border-b border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-md bg-morandi-primary/10 text-morandi-primary">
                <Compass className="w-5 h-5" />
              </span>
              <h2 className="text-base font-bold text-morandi-text">
                俄罗斯市场选品决策系统 (Market Intelligence)
              </h2>
              <Badge variant="success">WB-MARKET-MODEL-V1</Badge>
            </div>
            <p className="text-xs text-morandi-text-light mt-1">
              全量 7,630 利基与 30 万俄语搜索需求交叉洞察 · 闭环决策链
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="hidden sm:block text-right">
              <div className="text-[11px] text-morandi-text-light font-mono">当前数据批次</div>
              {availableRuns.length > 1 ? (
                <select
                  value={currentRunId}
                  onChange={(e) => handleSwitchRun(e.target.value)}
                  className="font-mono font-bold text-morandi-primary bg-morandi-50 border border-morandi-200 rounded px-1.5 py-0.5 outline-none cursor-pointer text-xs"
                >
                  {availableRuns.map((r) => (
                    <option key={r.run_id} value={r.run_id}>
                      {r.run_id}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="font-semibold text-morandi-text font-mono">{bundle?.meta?.run_id}</div>
              )}
            </div>
            <div className="p-2 rounded bg-morandi-50 border border-morandi-100 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[11px] font-medium text-morandi-text font-mono">
                {bundle?.meta?.data_period}
              </span>
            </div>
          </div>
        </div>

        {/* 6 大一级视图切换选项卡 */}
        <div className="flex border-b border-gray-200 mt-4 -mb-4 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? 'border-morandi-primary text-morandi-primary'
                    : 'border-transparent text-morandi-text-light hover:text-morandi-text'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </Surface>

      {/* 浮动操作提示 (Toast) */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg bg-morandi-text text-white text-xs shadow-xl flex items-center gap-2 animate-fade-in">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 视图内容区 */}
      <div className="transition-all duration-150">
        {activeTab === 'overview' && (
          <OverviewView
            meta={bundle?.meta}
            onSelectTab={setActiveTab}
            onSelectNicheByName={handleSelectNicheByName}
          />
        )}

        {activeTab === 'radar' && (
          <RadarView
            niches={bundle?.niches}
            onSelectNiche={(niche) => setSelectedNiche(niche)}
          />
        )}

        {activeTab === 'niches' && (
          <NichesView
            niches={bundle?.niches}
            onSelectNiche={(niche) => setSelectedNiche(niche)}
          />
        )}

        {activeTab === 'keywords' && (
          <KeywordsView keywords={bundle?.keywords} />
        )}

        {activeTab === 'validation' && (
          <ValidationPoolView
            validationPool={mergedValidationPool}
            onUpdateVerdict={handleUpdateVerdict}
            onPromoteToT6={(niche) => handlePromoteToT6(niche)}
            onOpenProcurement={(niche) => setProcurementTarget(niche)}
            onSelectNiche={(niche) => setSelectedNiche(niche)}
          />
        )}

        {activeTab === 'datahub' && (
          <DataHubView
            meta={bundle?.meta}
            auditSummary={bundle?.auditSummary}
            availableRuns={availableRuns}
            currentRunId={currentRunId}
            onSwitchRun={handleSwitchRun}
          />
        )}
      </div>

      {/* 利基机会详情抽屉 */}
      <NicheDetailDrawer
        niche={selectedNiche}
        isOpen={Boolean(selectedNiche)}
        onClose={() => setSelectedNiche(null)}
        onUpdateVerdict={(name, verdict, note) => {
          handleUpdateVerdict(name, verdict, note)
          if (selectedNiche) {
            setSelectedNiche({ ...selectedNiche, verdict })
          }
        }}
        onPromoteToT6={(niche, reason) => handlePromoteToT6(niche, reason)}
        onOpenProcurement={(niche) => setProcurementTarget(niche)}
      />

      {/* Phase 5 人工采购验证与单位经济工作台 */}
      <ManualProcurementWorkbench
        niche={procurementTarget}
        isOpen={Boolean(procurementTarget)}
        onClose={() => setProcurementTarget(null)}
        onNavigateToWbCalc={onNavigateToWbCalc}
        onPromoted={(candidate) => {
          showToast(`「${procurementTarget?.name}」已立项推送到 T6 候选池！`)
        }}
      />
    </div>
  )
}
