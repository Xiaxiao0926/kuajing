/**
 * DataHubView.jsx — 数据中心视图 (V1.1 数据更新自动化与差异看板)
 * 管理历史分析批次 (analysis_runs)、字段审计质检报告、模型版本事实源、
 * 以及真实端到端数据更新管道 (Phase 0–4 Pipeline) 与周期差异报告 (RUN_DIFF_REPORT)
 */
import { useState, useEffect, useRef } from 'react'
import {
  Database, Upload, CheckCircle2, AlertTriangle, ShieldCheck,
  FileSpreadsheet, Sparkles, Clock, RefreshCw, Cpu, ShieldAlert,
  ArrowRight, Play, Loader2, FileCheck, TrendingUp, TrendingDown,
  Layers, ChevronDown, ChevronRight, Check, AlertCircle, XCircle,
  RotateCcw, History, Lock, Shield
} from 'lucide-react'
import Surface from '../../ui/Surface'
import Button from '../../ui/Button'
import Badge from '../../ui/Badge'
import {
  uploadDataFiles,
  triggerPipelineRun,
  fetchPipelineStatus,
  fetchDiffReport,
  fetchActiveRunInfo,
  rollbackActiveRun,
  fetchAuditLogs
} from '../../../utils/marketIntelligence/miStore.js'

const PIPELINE_STEPS = [
  { key: 'UPLOADED', label: '文件就绪', minProg: 5 },
  { key: 'VALIDATING', label: '格式校验', minProg: 10 },
  { key: 'FIELD_AUDIT', label: '字段审计', minProg: 18 },
  { key: 'ANALYZING_NICHES', label: '利基门禁', minProg: 30 },
  { key: 'ANALYZING_KEYWORDS', label: '搜索词DSI', minProg: 45 },
  { key: 'CROSS_MAPPING', label: '双表穿透', minProg: 65 },
  { key: 'RISK_CLASSIFICATION', label: '风控打标', minProg: 75 },
  { key: 'COMPILING_ASSETS', label: '资产编译', minProg: 85 },
  { key: 'VERIFYING', label: '自检比对', minProg: 92 },
  { key: 'COMPLETED', label: '原子发布', minProg: 100 },
]

export default function DataHubView({
  meta,
  auditSummary,
  availableRuns = [],
  currentRunId = 'RUN-20260917-001',
  onSwitchRun,
}) {
  const models = meta?.models || {
    market_model: 'WB-MARKET-MODEL-V1',
    risk_model: 'WB-CROSSBORDER-RISK-V1',
    keyword_model: 'WB-DSI-V1',
  }

  // 整理展示的批次列表
  const runsList = availableRuns.length > 0 ? availableRuns : [
    {
      run_id: meta?.run_id || 'RUN-20260917-001',
      title: meta?.run_title || '2026 Q3 俄罗斯市场全量选品决策基线',
      date_range: meta?.data_period || '2026-06-18 ~ 2026-09-15',
      niches_count: meta?.summary_kpis?.passed_niches || 6534,
      keywords_count: 300001,
      models: meta?.models,
      created_at: '2026-09-17',
    },
  ]

  // 文件选择状态
  const fileInputARef = useRef(null)
  const fileInputBRef = useRef(null)
  const [fileA, setFileA] = useState(null)
  const [fileB, setFileB] = useState(null)
  const [pathA, setPathA] = useState('')
  const [pathB, setPathB] = useState('')

  // Run 参数
  const [newRunId, setNewRunId] = useState('RUN-20261217-001')
  const [newRunTitle, setNewRunTitle] = useState('2026 Q4 俄罗斯市场选品决策基线')

  // 管道运行状态
  const [pipelineState, setPipelineState] = useState({
    status: 'IDLE',
    progress: 0,
    step: '未运行',
    error: null,
  })
  const [isStarting, setIsStarting] = useState(false)
  const [pollInterval, setPollInterval] = useState(null)

  // 差异报告展示
  const [diffReport, setDiffReport] = useState(null)
  const [loadingDiff, setLoadingDiff] = useState(false)
  const [diffTab, setDiffTab] = useState('TEST') // TEST | MOS | KEYWORDS | NICHES

  // V1.1.1 生产级加固状态
  const [activeInfo, setActiveInfo] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [showAuditLogs, setShowAuditLogs] = useState(false)
  const [duplicateInfo, setDuplicateInfo] = useState(null)
  const [concurrencyLock, setConcurrencyLock] = useState(null)
  const [isRollingBack, setIsRollingBack] = useState(false)

  // 初始加载一次管道状态、活跃批次信息、当前 Run 的差异报告与审计日志
  useEffect(() => {
    fetchPipelineStatus().then((st) => {
      if (st && st.status !== 'IDLE') {
        setPipelineState(st)
      }
    }).catch(() => {})

    fetchActiveRunInfo().then((info) => {
      setActiveInfo(info)
    }).catch(() => {})

    fetchAuditLogs().then((logs) => {
      if (Array.isArray(logs)) setAuditLogs(logs)
    }).catch(() => {})

    loadDiffReport(currentRunId)
  }, [currentRunId])

  // 回滚操作处理
  const handleRollback = async () => {
    const targetPrev = activeInfo?.previous_active_run_id
    if (!targetPrev) return
    if (!window.confirm(`确定要将当前活跃批次回滚至上一批次 [${targetPrev}] 吗？`)) return

    setIsRollingBack(true)
    try {
      const res = await rollbackActiveRun()
      alert(`已成功回滚活跃批次至: ${res.active_run_id}`)
      const info = await fetchActiveRunInfo()
      setActiveInfo(info)
      if (onSwitchRun) onSwitchRun(res.active_run_id)
      const logs = await fetchAuditLogs()
      setAuditLogs(logs)
    } catch (err) {
      alert(`回滚失败: ${err.message}`)
    } finally {
      setIsRollingBack(false)
    }
  }

  // 加载指定批次的差异报告
  const loadDiffReport = async (rid) => {
    setLoadingDiff(true)
    try {
      const rep = await fetchDiffReport(rid)
      setDiffReport(rep)
    } catch (e) {
      setDiffReport(null)
    } finally {
      setLoadingDiff(false)
    }
  }

  // 状态轮询
  useEffect(() => {
    const isRunning = ['UPLOADED', 'VALIDATING', 'FIELD_AUDIT', 'ANALYZING_NICHES', 'ANALYZING_KEYWORDS', 'CROSS_MAPPING', 'RISK_CLASSIFICATION', 'COMPILING_ASSETS', 'VERIFYING'].includes(pipelineState.status)

    if (isRunning) {
      const timer = setInterval(async () => {
        try {
          const st = await fetchPipelineStatus()
          if (st) {
            setPipelineState(st)
            if (st.status === 'COMPLETED') {
              clearInterval(timer)
              // 重新拉取差异报告
              loadDiffReport(newRunId)
            } else if (st.status === 'FAILED' || st.status === 'SCHEMA_CHANGE_REVIEW_REQUIRED') {
              clearInterval(timer)
            }
          }
        } catch (e) {
          console.warn('轮询状态异常:', e)
        }
      }, 1500)
      return () => clearInterval(timer)
    }
  }, [pipelineState.status, newRunId])

  // 启动管道
  const handleStartPipeline = async () => {
    setIsStarting(true)
    try {
      let targetNicheFile = pathA
      let targetSearchFile = pathB

      // 若为通过文件组件上传
      if (fileA || fileB) {
        setPipelineState({
          status: 'UPLOADED',
          progress: 5,
          step: '正在向后台传输原始文件...',
          error: null,
        })
        const upRes = await uploadDataFiles(fileA, fileB)
        targetNicheFile = upRes.nicheFile || targetNicheFile
        targetSearchFile = upRes.searchFile || targetSearchFile
      }

      if (!targetNicheFile || !targetSearchFile) {
        throw new Error('请选择利基文件 (.xlsx) 与搜索词文件 (.xlsx)')
      }

      setDuplicateInfo(null)
      setConcurrencyLock(null)

      const res = await triggerPipelineRun({
        nicheFile: targetNicheFile,
        searchFile: targetSearchFile,
        runId: newRunId,
        runTitle: newRunTitle,
      })

      if (res.duplicate) {
        setDuplicateInfo(res)
        setPipelineState({
          status: 'IDLE',
          progress: 100,
          step: res.message || '数据集已存在，无需重复计算。',
          error: null,
        })
        return
      }

      setPipelineState({
        status: 'VALIDATING',
        progress: 10,
        step: '管道已在后台拉起，开始执行 Phase 0 结构质检...',
        error: null,
      })
    } catch (err) {
      if (err.message?.includes('PIPELINE_LOCKED') || err.message?.includes('409') || err.message?.includes('后台运行中')) {
        setConcurrencyLock(err.message)
      }
      setPipelineState({
        status: 'FAILED',
        progress: 0,
        step: '启动失败',
        error: err.message,
      })
    } finally {
      setIsStarting(false)
    }
  }

  // 快速载入本地已有测试文件
  const handleLoadBaselineFiles = () => {
    setPathA('D:\\FYZSXNB\\市场分析wb\\WB--16-9-2026 利基分析(付费版) 从 18-06-2026 到 15-09-2026.xlsx')
    setPathB('D:\\FYZSXNB\\市场分析wb\\WB--16-9-2026 在WB上的搜索请求. Jam 从 18-06-2026 到 15-09-2026.xlsx')
  }

  // 进度指示计算
  const getStepStatus = (stepKey, minProg) => {
    const isError = pipelineState.status === 'FAILED' || pipelineState.status === 'SCHEMA_CHANGE_REVIEW_REQUIRED'
    if (pipelineState.status === stepKey) {
      return isError ? 'error' : 'active'
    }
    if (pipelineState.progress >= minProg) {
      return 'done'
    }
    return 'pending'
  }

  const isPipelineRunning = ['UPLOADED', 'VALIDATING', 'FIELD_AUDIT', 'ANALYZING_NICHES', 'ANALYZING_KEYWORDS', 'CROSS_MAPPING', 'RISK_CLASSIFICATION', 'COMPILING_ASSETS', 'VERIFYING'].includes(pipelineState.status)

  return (
    <div className="space-y-6 text-xs">
      {/* 1. 批次管理 (Analysis Runs) */}
      <Surface className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-morandi-primary" />
            <h3 className="font-bold text-sm text-morandi-text">分析批次版本库 (Analysis Runs)</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="success">当前活跃: {activeInfo?.active_run_id || currentRunId}</Badge>
            {activeInfo?.previous_active_run_id && (
              <Button
                variant="outline"
                size="xs"
                disabled={isRollingBack}
                onClick={handleRollback}
                className="flex items-center gap-1 text-morandi-gold border-morandi-gold hover:bg-amber-50"
              >
                <RotateCcw className={`w-3 h-3 ${isRollingBack ? 'animate-spin' : ''}`} />
                回滚至上一批次 ({activeInfo.previous_active_run_id})
              </Button>
            )}
          </div>
        </div>

        {duplicateInfo && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-amber-900">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold">数据集已存在：</span>
                {duplicateInfo.message}
              </div>
            </div>
            <Button
              size="xs"
              variant="outline"
              onClick={() => onSwitchRun && onSwitchRun(duplicateInfo.existing_run_id)}
            >
              立即切换至已有批次
            </Button>
          </div>
        )}

        {concurrencyLock && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-800">
            <Lock className="w-4 h-4 text-rose-600 shrink-0" />
            <div>
              <span className="font-bold">并发互斥锁阻断：</span>
              {concurrencyLock}
            </div>
          </div>
        )}

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-morandi-50 text-morandi-text-light font-medium border-b border-gray-200">
              <tr>
                <th className="py-2.5 px-3">批次编号</th>
                <th className="py-2.5 px-3">批次标题</th>
                <th className="py-2.5 px-3">数据覆盖期</th>
                <th className="py-2.5 px-3">算法事实源</th>
                <th className="py-2.5 px-3 text-right">利基数</th>
                <th className="py-2.5 px-3 text-right">搜索词数</th>
                <th className="py-2.5 px-3 text-center">状态与操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-morandi-text">
              {runsList.map((run) => {
                const isActive = run.run_id === currentRunId
                return (
                  <tr key={run.run_id} className={isActive ? 'bg-morandi-50/50' : 'hover:bg-gray-50/60'}>
                    <td className="py-2.5 px-3 font-mono font-bold text-morandi-primary">
                      {run.run_id}
                    </td>
                    <td className="py-2.5 px-3 font-medium">
                      {run.title}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-morandi-text-light">{run.date_range}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white border border-gray-200">
                        {run.models?.market_model || models.market_model}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold">
                      {(run.niches_count || 6534).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold">
                      {(run.keywords_count || 300001).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            当前活跃
                          </span>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onSwitchRun && onSwitchRun(run.run_id)}
                            className="text-[11px] py-0.5 px-2"
                          >
                            切换此批次
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => loadDiffReport(run.run_id)}
                          className="text-[10px] text-morandi-primary py-0.5 px-1.5 hover:bg-morandi-50"
                        >
                          看差异
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Surface>

      {/* 2. 新季度数据更新自动化管道 (Pipeline Runner) */}
      <Surface className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-morandi-primary" />
            <h3 className="font-bold text-sm text-morandi-text">新数据季度轮转上传与自动分析管道</h3>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              V1.1 PIPELINE 就绪
            </span>
          </div>
          <button
            onClick={handleLoadBaselineFiles}
            className="text-[11px] text-morandi-primary underline hover:text-morandi-primary/80"
          >
            快速载入服务器已有基准文件
          </button>
        </div>

        {/* 输入参数与配置 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-morandi-50/50 rounded-lg border border-morandi-100">
          <div>
            <label className="block text-[11px] font-semibold text-morandi-text mb-1">新批次编号 (Run ID)</label>
            <input
              type="text"
              value={newRunId}
              onChange={(e) => setNewRunId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded border border-gray-300 font-mono text-xs focus:ring-1 focus:ring-morandi-primary"
              placeholder="RUN-20261217-001"
              disabled={isPipelineRunning}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-morandi-text mb-1">批次标题说明</label>
            <input
              type="text"
              value={newRunTitle}
              onChange={(e) => setNewRunTitle(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded border border-gray-300 text-xs focus:ring-1 focus:ring-morandi-primary"
              placeholder="2026 Q4 俄罗斯市场选品决策基线"
              disabled={isPipelineRunning}
            />
          </div>
        </div>

        {/* 双文件上传 / 路径指定 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* File A: Niches */}
          <div
            onClick={() => !isPipelineRunning && fileInputARef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-4 transition-all cursor-pointer ${
              fileA || pathA
                ? 'border-morandi-primary bg-morandi-50/40'
                : 'border-gray-200 hover:border-morandi-primary hover:bg-gray-50/50'
            }`}
          >
            <input
              ref={fileInputARef}
              type="file"
              accept=".xlsx,.xlsm"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) setFileA(e.target.files[0])
              }}
              disabled={isPipelineRunning}
            />
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="w-7 h-7 text-morandi-primary shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-morandi-text flex items-center justify-between">
                  <span>文件 A：WB 市场利基总表</span>
                  {(fileA || pathA) && (
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      已就绪
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-morandi-text-light mt-0.5">
                  必须包含「详细信息」工作表及 43 列核心指标 (供给/卖家/GMV/签收率)
                </div>
                <div className="mt-2 text-[11px] font-mono text-morandi-primary truncate bg-white p-1.5 rounded border border-gray-200">
                  {fileA ? `${fileA.name} (${(fileA.size / 1024 / 1024).toFixed(2)} MB)` : (pathA || '点击上传或填写本地路径...')}
                </div>
              </div>
            </div>
          </div>

          {/* File B: Searches */}
          <div
            onClick={() => !isPipelineRunning && fileInputBRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-4 transition-all cursor-pointer ${
              fileB || pathB
                ? 'border-emerald-500 bg-emerald-50/30'
                : 'border-gray-200 hover:border-emerald-500 hover:bg-gray-50/50'
            }`}
          >
            <input
              ref={fileInputBRef}
              type="file"
              accept=".xlsx,.xlsm"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) setFileB(e.target.files[0])
              }}
              disabled={isPipelineRunning}
            />
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="w-7 h-7 text-emerald-600 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-morandi-text flex items-center justify-between">
                  <span>文件 B：WB Jam 搜索词需求漏斗表</span>
                  {(fileB || pathB) && (
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      已就绪
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-morandi-text-light mt-0.5">
                  必须包含 30 万条买家真实搜索词、加购转化与类目订单冠军
                </div>
                <div className="mt-2 text-[11px] font-mono text-emerald-700 truncate bg-white p-1.5 rounded border border-gray-200">
                  {fileB ? `${fileB.name} (${(fileB.size / 1024 / 1024).toFixed(2)} MB)` : (pathB || '点击上传或填写本地路径...')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 启动操作条 */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
          <div className="text-morandi-text-light">
            规则保证：执行过程先写入 <code className="font-mono text-[10px] bg-gray-100 px-1 py-0.5 rounded">_staging/{newRunId}</code>，全部 100% 成功并校验通过后原子生效，半成品绝不破坏当前活跃 Run。
          </div>
          <Button
            variant="primary"
            disabled={isPipelineRunning || isStarting || (!fileA && !pathA) || (!fileB && !pathB)}
            onClick={handleStartPipeline}
            className="gap-2 font-semibold text-xs py-2 px-4 shadow-sm"
          >
            {isPipelineRunning || isStarting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                后台计算执行中...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                执行数据更新管道
              </>
            )}
          </Button>
        </div>

        {/* 3. 真实运行状态 UI 步进器 (No Fake Timer) */}
        {pipelineState.status !== 'IDLE' && (
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isPipelineRunning && <Loader2 className="w-4 h-4 text-morandi-primary animate-spin" />}
                {pipelineState.status === 'COMPLETED' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                {(pipelineState.status === 'FAILED' || pipelineState.status === 'SCHEMA_CHANGE_REVIEW_REQUIRED') && (
                  <XCircle className="w-4 h-4 text-rose-600" />
                )}
                <span className="font-bold text-morandi-text">
                  管道运行状态：
                  <span className="font-mono text-morandi-primary ml-1">{pipelineState.status}</span>
                </span>
              </div>
              <span className="font-mono font-bold text-morandi-text">{pipelineState.progress}%</span>
            </div>

            {/* 进度条 */}
            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  pipelineState.status === 'FAILED'
                    ? 'bg-rose-500'
                    : pipelineState.status === 'SCHEMA_CHANGE_REVIEW_REQUIRED'
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${pipelineState.progress}%` }}
              />
            </div>

            {/* 10 阶段步进节点 */}
            <div className="grid grid-cols-5 md:grid-cols-10 gap-1 pt-1">
              {PIPELINE_STEPS.map((step) => {
                const st = getStepStatus(step.key, step.minProg)
                return (
                  <div
                    key={step.key}
                    className={`text-center p-1.5 rounded text-[10px] font-medium transition-colors ${
                      st === 'active'
                        ? 'bg-morandi-primary text-white font-bold'
                        : st === 'done'
                        ? 'bg-emerald-100 text-emerald-800'
                        : st === 'error'
                        ? 'bg-rose-100 text-rose-800 font-bold'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {step.label}
                  </div>
                )
              })}
            </div>

            {/* 实时描述文字与异常警示 */}
            <div className="text-[11px] text-morandi-text bg-white p-2.5 rounded border border-gray-200 flex items-center justify-between">
              <div className="truncate">
                <b>当前执行：</b> {pipelineState.step}
              </div>
              {pipelineState.status === 'COMPLETED' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onSwitchRun && onSwitchRun(newRunId)}
                  className="shrink-0 text-[11px] py-0.5 px-2.5 bg-emerald-600 hover:bg-emerald-700"
                >
                  立即切换为此新批次
                </Button>
              )}
            </div>

            {pipelineState.error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded text-[11px] space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  管道中断阻断原因：
                </div>
                <div className="font-mono break-all">{pipelineState.error}</div>
              </div>
            )}
          </div>
        )}
      </Surface>

      {/* 4. 周期差异报告展示: 本期相比上期发生了什么 (Quarterly Diff Report) */}
      <Surface className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-morandi-primary" />
            <h3 className="font-bold text-sm text-morandi-text">
              本期相比上期发生了什么 (Quarterly Diff & Market Shift)
            </h3>
            {diffReport?.compared_against && (
              <span className="text-morandi-text-light font-mono text-[11px]">
                (对拍基线: {diffReport.compared_against})
              </span>
            )}
          </div>
          {loadingDiff && <Loader2 className="w-3.5 h-3.5 animate-spin text-morandi-primary" />}
        </div>

        {diffReport ? (
          <div className="space-y-4">
            {/* KPI 概览指标 */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              <div className="p-2.5 bg-emerald-50/70 border border-emerald-100 rounded text-center">
                <div className="text-[10px] text-emerald-800">新进入 TEST 候选</div>
                <div className="text-lg font-bold font-mono text-emerald-900 mt-0.5">
                  +{diffReport.summary?.new_test_candidates_count || 0}
                </div>
              </div>
              <div className="p-2.5 bg-rose-50/70 border border-rose-100 rounded text-center">
                <div className="text-[10px] text-rose-800">跌出 TEST 候选</div>
                <div className="text-lg font-bold font-mono text-rose-900 mt-0.5">
                  -{diffReport.summary?.dropped_from_test_count || 0}
                </div>
              </div>
              <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded text-center">
                <div className="text-[10px] text-blue-800">MOS 大幅上涨 (≥+5)</div>
                <div className="text-lg font-bold font-mono text-blue-900 mt-0.5">
                  {diffReport.summary?.mos_surged_count || 0}
                </div>
              </div>
              <div className="p-2.5 bg-amber-50/70 border border-amber-100 rounded text-center">
                <div className="text-[10px] text-amber-800">MOS 大幅下挫 (≤-5)</div>
                <div className="text-lg font-bold font-mono text-amber-900 mt-0.5">
                  {diffReport.summary?.mos_dropped_count || 0}
                </div>
              </div>
              <div className="p-2.5 bg-morandi-50 border border-morandi-100 rounded text-center">
                <div className="text-[10px] text-morandi-text-light">新增利基品类</div>
                <div className="text-lg font-bold font-mono text-morandi-text mt-0.5">
                  +{diffReport.summary?.new_niches_count || 0}
                </div>
              </div>
              <div className="p-2.5 bg-morandi-50 border border-morandi-100 rounded text-center">
                <div className="text-[10px] text-morandi-text-light">需求暴涨搜索词</div>
                <div className="text-lg font-bold font-mono text-morandi-text mt-0.5">
                  {diffReport.booming_keywords?.length || 0}
                </div>
              </div>
            </div>

            {/* 差异标签页切换 */}
            <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
              <button
                onClick={() => setDiffTab('TEST')}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  diffTab === 'TEST' ? 'bg-morandi-primary text-white' : 'text-morandi-text hover:bg-gray-100'
                }`}
              >
                选品候选异动 ({diffReport.new_test_candidates?.length || 0})
              </button>
              <button
                onClick={() => setDiffTab('MOS')}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  diffTab === 'MOS' ? 'bg-morandi-primary text-white' : 'text-morandi-text hover:bg-gray-100'
                }`}
              >
                机会分异动榜 ({diffReport.mos_surged?.length || 0})
              </button>
              <button
                onClick={() => setDiffTab('KEYWORDS')}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  diffTab === 'KEYWORDS' ? 'bg-morandi-primary text-white' : 'text-morandi-text hover:bg-gray-100'
                }`}
              >
                需求爆发搜索词 ({diffReport.booming_keywords?.length || 0})
              </button>
            </div>

            {/* 选品候选变化列表 */}
            {diffTab === 'TEST' && (
              <div className="space-y-2">
                {diffReport.new_test_candidates?.length > 0 ? (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-morandi-50 text-morandi-text-light font-medium border-b border-gray-200">
                        <tr>
                          <th className="py-2 px-3">新晋 TEST 商品名</th>
                          <th className="py-2 px-3">类目</th>
                          <th className="py-2 px-3 text-right">MOS 机会分</th>
                          <th className="py-2 px-3 text-right">季度 GMV</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-morandi-text">
                        {diffReport.new_test_candidates.slice(0, 10).map((n, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/60">
                            <td className="py-2 px-3 font-semibold text-emerald-800">{n.name}</td>
                            <td className="py-2 px-3 text-morandi-text-light">{n.category}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-morandi-primary">{n.mos}</td>
                            <td className="py-2 px-3 text-right font-mono">¥{(n.gmv || 0).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-6 text-morandi-text-light bg-gray-50 rounded-lg">
                    本期选品候选池稳定，与上期保持一致。
                  </div>
                )}
              </div>
            )}

            {/* MOS 异动列表 */}
            {diffTab === 'MOS' && (
              <div className="space-y-2">
                {diffReport.mos_surged?.length > 0 ? (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-morandi-50 text-morandi-text-light font-medium border-b border-gray-200">
                        <tr>
                          <th className="py-2 px-3">利基名称</th>
                          <th className="py-2 px-3">类目</th>
                          <th className="py-2 px-3 text-right">上期 MOS</th>
                          <th className="py-2 px-3 text-right">本期 MOS</th>
                          <th className="py-2 px-3 text-right">上涨幅度</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-morandi-text">
                        {diffReport.mos_surged.slice(0, 10).map((n, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/60">
                            <td className="py-2 px-3 font-medium">{n.name}</td>
                            <td className="py-2 px-3 text-morandi-text-light">{n.category}</td>
                            <td className="py-2 px-3 text-right font-mono">{n.old_mos}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-morandi-primary">{n.new_mos}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">+{n.delta}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-6 text-morandi-text-light bg-gray-50 rounded-lg">
                    本期各利基 MOS 机会分均处于稳定波动区间。
                  </div>
                )}
              </div>
            )}

            {/* 需求爆发词列表 */}
            {diffTab === 'KEYWORDS' && (
              <div className="space-y-2">
                {diffReport.booming_keywords?.length > 0 ? (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-morandi-50 text-morandi-text-light font-medium border-b border-gray-200">
                        <tr>
                          <th className="py-2 px-3">俄语爆发搜索词</th>
                          <th className="py-2 px-3">关联类目</th>
                          <th className="py-2 px-3 text-right">季度搜索量</th>
                          <th className="py-2 px-3 text-right">环比增长</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-morandi-text font-mono">
                        {diffReport.booming_keywords.slice(0, 10).map((kw, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/60">
                            <td className="py-2 px-3 font-semibold text-morandi-text">{kw.query}</td>
                            <td className="py-2 px-3 text-morandi-text-light font-sans">{kw.category}</td>
                            <td className="py-2 px-3 text-right">{(kw.vol || 0).toLocaleString()}</td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-700">{kw.growth}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-6 text-morandi-text-light bg-gray-50 rounded-lg">
                    暂未检测到增幅超 50% 的异动爆发搜索词。
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-morandi-text-light bg-gray-50 rounded-lg">
            {loadingDiff ? '正在分析两期差异...' : '暂无可对比的上一期差异报告（或当前为首个基线 Run）。'}
          </div>
        )}
      </Surface>

      {/* 5. Phase 0 字段审计与质检报告 */}
      <Surface className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <h3 className="font-bold text-sm text-morandi-text">Phase 0 字段审计与门禁过滤报告</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 bg-morandi-50 rounded space-y-1">
            <div className="text-morandi-text-light">审计字段总量</div>
            <div className="text-base font-bold text-morandi-text font-mono">
              {auditSummary?.total_fields || 43} 个维度
            </div>
            <div className="text-[11px] text-emerald-700">100% 结构化清洗映射</div>
          </div>

          <div className="p-3 bg-morandi-50 rounded space-y-1">
            <div className="text-morandi-text-light">门禁淘汰利基 (Gate Filter)</div>
            <div className="text-base font-bold text-rose-600 font-mono">
              {auditSummary?.eliminated_count || 1096} 个利基
            </div>
            <div className="text-[11px] text-morandi-text-light">零营收/微型/独家垄断淘汰</div>
          </div>

          <div className="p-3 bg-morandi-50 rounded space-y-1">
            <div className="text-morandi-text-light">双表需求端覆盖率</div>
            <div className="text-base font-bold text-morandi-primary font-mono">
              {auditSummary?.bridge_stats?.search_volume_coverage_pct || '99.6%'}
            </div>
            <div className="text-[11px] text-morandi-text-light">覆盖 29.8 万条真实搜索意图</div>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-gray-100">
          <div className="font-semibold text-morandi-text">核心指标定义关键校准结论：</div>
          <div className="space-y-1.5 text-morandi-text leading-relaxed">
            <div className="p-2 rounded bg-morandi-50 border border-morandi-100">
              <b>1. Col 2「实际成交率」</b>：经 WB 官方公式与数据分布确认，实为 <b>买家签收率 (Выкуп = 成交量 / (成交量 + 取消量))</b>，大盘均值 78.4%，用于衡量退货率风险，&gt;85% 极度安全。
            </div>
            <div className="p-2 rounded bg-morandi-50 border border-morandi-100">
              <b>2. Col 7「订单集中度(%)」</b>：实为 <b>占 80% 订单的头部卖家数量占比</b>。数值越高代表市场越分散、垄断度越低，已校准为正向计分。
            </div>
            <div className="p-2 rounded bg-morandi-50 border border-morandi-100">
              <b>3. 双表桥接</b>：以「项目」↔「类目订单冠军」为核心锚点，桥接 5,209 个有效利基，搜索需求大盘覆盖率达 99.6%。
            </div>
          </div>
        </div>
      </Surface>

      {/* 6. 算法与风控模型版本事实源 */}
      <Surface className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-morandi-primary" />
          <h3 className="font-bold text-sm text-morandi-text">6. 核心算法与风控模型版本事实源</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 border border-gray-200 rounded-lg space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-morandi-text">市场机会模型</span>
              <Badge variant="primary">{models.market_model}</Badge>
            </div>
            <div className="text-[11px] text-morandi-text-light">
              6 维度加权（规模20/增长25/竞争20/健康15/需求10/客单10），采用品类内 log1p 百分位标准化。
            </div>
          </div>

          <div className="p-3 border border-gray-200 rounded-lg space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-morandi-text">跨境风控规则引擎</span>
              <Badge variant="warning">{models.risk_model}</Badge>
            </div>
            <div className="text-[11px] text-morandi-text-light">
              10 项硬核风险标签（带电/加热/燃料/易碎/重件/大件/机型适配/EAC/高客诉/季节性）与反向重量惩罚穿透。
            </div>
          </div>

          <div className="p-3 border border-gray-200 rounded-lg space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-morandi-text">搜索意图与DSI模型</span>
              <Badge variant="success">{models.keyword_model}</Badge>
            </div>
            <div className="text-[11px] text-morandi-text-light">
              供需缺口指数（搜索量 / (在售商品+1)）与 5 类意图聚类（规格词/机型词/场景词/爆发词/基础词）。
            </div>
          </div>
        </div>
      </Surface>

      {/* 7. 生产级审计日志与变更履历 (Audit Log) */}
      <Surface className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-morandi-primary" />
            <h3 className="font-bold text-sm text-morandi-text">
              7. 决策审计日志与变更履历
            </h3>
            <span className="text-[11px] text-morandi-text-light font-mono">
              ({auditLogs.length} 条记录)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const logs = await fetchAuditLogs()
                setAuditLogs(logs)
              }}
              className="text-[11px] text-morandi-primary hover:underline flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              刷新
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAuditLogs(!showAuditLogs)}
            >
              {showAuditLogs ? '收起履历' : '展开履历'}
            </Button>
          </div>
        </div>

        <div className="text-[11px] text-morandi-text-light">
          所有人工标记覆写、备注变更、Phase 5 测算与 T6 候选池推送均全程双重记录（niche_uid + 名称），具备完整不可抵赖的审计追踪能力。
        </div>

        {showAuditLogs && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            {auditLogs.length > 0 ? (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-xs text-left">
                  <thead className="bg-morandi-50 text-morandi-text font-semibold sticky top-0">
                    <tr>
                      <th className="py-2 px-3">时间</th>
                      <th className="py-2 px-3">操作类型</th>
                      <th className="py-2 px-3">利基目标 / UID</th>
                      <th className="py-2 px-3">变更内容 (Old → New)</th>
                      <th className="py-2 px-3">来源 / 操作者</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
                    {auditLogs.slice(0, 50).map((log, idx) => {
                      const actionBadge = {
                        OVERRIDE_STATUS: <Badge variant="primary">状态调整</Badge>,
                        SAVE_NOTE: <Badge variant="secondary">备注更新</Badge>,
                        SAVE_PHASE5_QUOTE: <Badge variant="warning">测算调价</Badge>,
                        PROMOTE_T6: <Badge variant="success">推入T6</Badge>,
                        ROLLBACK_RUN: <Badge variant="danger">批次回滚</Badge>,
                      }[log.action] || <Badge variant="outline">{log.action}</Badge>

                      let changeText = '-'
                      if (log.action === 'OVERRIDE_STATUS') {
                        changeText = `${log.old_value?.status || '无'} → ${log.new_value?.status || '无'}`
                      } else if (log.action === 'SAVE_NOTE') {
                        changeText = `备注: "${log.new_value?.note || ''}"`
                      } else if (log.action === 'SAVE_PHASE5_QUOTE') {
                        changeText = `采购¥${log.new_value?.cny_cost || 0} / 售价₽${log.new_value?.selling_price_rub || 0}`
                      } else if (log.action === 'PROMOTE_T6') {
                        changeText = `推入候选商品: ${log.new_value?.t6_item?.name || '商品'}`
                      } else if (log.action === 'ROLLBACK_RUN') {
                        changeText = `${log.old_value?.active_run_id} → ${log.new_value?.active_run_id}`
                      }

                      return (
                        <tr key={idx} className="hover:bg-gray-50/60">
                          <td className="py-2 px-3 text-morandi-text-light whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString('zh-CN', { hour12: false })}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            {actionBadge}
                          </td>
                          <td className="py-2 px-3 font-sans">
                            <div className="font-semibold text-morandi-text">{log.niche_name || '-'}</div>
                            <div className="text-[10px] text-morandi-text-light font-mono">{log.niche_uid || '-'}</div>
                          </td>
                          <td className="py-2 px-3 text-morandi-text font-sans">
                            {changeText}
                          </td>
                          <td className="py-2 px-3 text-morandi-text-light whitespace-nowrap">
                            <span className="font-semibold text-morandi-text">{log.user || 'operator'}</span>
                            <span className="ml-1 text-[10px] text-gray-400">({log.source || 'frontend'})</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-6 text-morandi-text-light bg-gray-50 rounded-lg">
                暂无审计记录。修改利基状态、填写备注或推送 T6 时将自动记录到本审计日志。
              </div>
            )}
          </div>
        )}
      </Surface>
    </div>
  )
}
