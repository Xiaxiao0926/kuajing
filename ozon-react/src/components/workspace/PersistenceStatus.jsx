import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Copy, Loader2, RefreshCw, XCircle } from 'lucide-react'
import {
  PersistenceState,
  copyPendingValue,
  reloadServerValue,
  subscribePersistenceStatus,
} from '../../utils/persist.js'

function serverTime(value) {
  const timestamp = Number(value)
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

export default function PersistenceStatus() {
  const [status, setStatus] = useState({ state: PersistenceState.IDLE, details: {} })
  const [busy, setBusy] = useState(false)

  useEffect(() => subscribePersistenceStatus(setStatus), [])

  if (status.state === PersistenceState.IDLE) return null

  const details = status.details || {}
  const key = details.key || details.keys?.[0]
  const label = status.state === PersistenceState.SAVING
    ? '自动备份中'
    : status.state === PersistenceState.SAVED
      ? '已自动备份'
      : status.state === PersistenceState.CONFLICT
        ? (details.backupSaved ? '冲突副本已备份' : details.backupPending ? '正在备份冲突副本' : '版本冲突')
        : '自动备份失败'
  const Icon = status.state === PersistenceState.SAVING
    ? Loader2
    : status.state === PersistenceState.SAVED
      ? CheckCircle2
      : status.state === PersistenceState.CONFLICT
        ? AlertTriangle
        : XCircle
  const tone = status.state === PersistenceState.SAVED
    ? 'text-workspace-success'
    : status.state === PersistenceState.CONFLICT || status.state === PersistenceState.ERROR
      ? 'text-workspace-danger'
      : 'text-workspace-text-secondary'

  const handleReload = async () => {
    if (!key || busy) return
    setBusy(true)
    try { await reloadServerValue(key) } catch {}
    finally { setBusy(false) }
  }

  const handleCopy = async () => {
    if (!key || busy) return
    setBusy(true)
    try { await copyPendingValue(key) } catch {}
    finally { setBusy(false) }
  }

  return (
    <div className="flex min-w-0 items-center gap-2 text-xs" role="status" aria-live="polite">
      <span className={`flex items-center gap-1 ${tone}`}>
        <Icon className={`h-3.5 w-3.5 ${status.state === PersistenceState.SAVING ? 'animate-spin' : ''}`} />
        <span className="hidden xl:inline">{label}</span>
      </span>
      {status.state === PersistenceState.CONFLICT && (
        <>
          <span className="hidden max-w-[230px] truncate text-workspace-text-tertiary md:inline" title={details.serverUpdatedByDevice || ''}>
            服务器 r{details.serverRevision ?? '?'} · 我的 r{details.clientRevision ?? '?'}
            {details.serverUpdatedByDevice ? ` · ${details.serverUpdatedByDevice}` : ''}
            {serverTime(details.serverUpdatedAt) ? ` · ${serverTime(details.serverUpdatedAt)}` : ''}
            {details.backupSaved ? ' · 本机副本已存服务器' : details.backupError ? ' · 等待自动重试' : ''}
          </span>
          <button
            type="button"
            title="加载服务器版本"
            onClick={handleReload}
            disabled={busy}
            className="flex h-7 items-center gap-1 rounded border border-workspace-border-strong px-2 text-[11px] text-workspace-text-secondary hover:bg-workspace-surface-subtle disabled:opacity-50"
          >
            <RefreshCw className="h-3 w-3" />
            <span className="hidden sm:inline">加载服务器版本</span>
          </button>
          <button
            type="button"
            title="复制我的内容"
            onClick={handleCopy}
            disabled={busy}
            className="flex h-7 items-center gap-1 rounded border border-workspace-border-strong px-2 text-[11px] text-workspace-text-secondary hover:bg-workspace-surface-subtle disabled:opacity-50"
          >
            <Copy className="h-3 w-3" />
            <span className="hidden sm:inline">复制我的内容</span>
          </button>
        </>
      )}
    </div>
  )
}
