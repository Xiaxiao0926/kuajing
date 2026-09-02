import { canUseServerPersistence, getApiBase, getNonce } from './runtime.js'

let _synced = false
let _syncPromise = null
const serverKeys = new Set()
const metadata = new Map()
const pending = new Map()
const staleLocal = new Map()
const blockedConflicts = new Map()
const pendingConflictBackups = new Map()
const statusListeners = new Set()
let flushTimer = null
let retryTimer = null
let conflictBackupTimer = null
let flushPromise = null
let persistenceStatus = { state: 'idle', key: null, details: null, updatedAt: 0 }

const UPDATED_PREFIX = '__kuajing_updated__:'
const DEVICE_ID_KEY = '__kuajing_device_id__'
const RETRY_DELAY_MS = 5000

export const PersistenceState = Object.freeze({
  IDLE: 'idle',
  SAVING: 'saving',
  SAVED: 'saved',
  CONFLICT: 'conflict',
  ERROR: 'error',
})

export class PersistenceConflictError extends Error {
  constructor(details = {}) {
    super('State changed on the server. Reload before saving again.')
    this.name = 'PersistenceConflictError'
    this.status = 409
    this.details = details
  }
}

function publishStatus(state, details = {}) {
  persistenceStatus = {
    state,
    key: details.key || null,
    details,
    updatedAt: Date.now(),
  }
  statusListeners.forEach((listener) => {
    try { listener({ ...persistenceStatus }) } catch {}
  })
}

export function getPersistenceStatus() {
  return { ...persistenceStatus, details: persistenceStatus.details ? { ...persistenceStatus.details } : null }
}

export function subscribePersistenceStatus(listener) {
  if (typeof listener !== 'function') return () => {}
  statusListeners.add(listener)
  listener(getPersistenceStatus())
  return () => statusListeners.delete(listener)
}

export function getDeviceId() {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY)
    if (existing) return existing
    const generated = globalThis.crypto?.randomUUID?.()
      || `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(DEVICE_ID_KEY, generated)
    return generated
  } catch {
    return 'unknown-device'
  }
}

function updatedKey(key) {
  return `${UPDATED_PREFIX}${key}`
}

function getLocalUpdatedAt(key) {
  try { return Number(localStorage.getItem(updatedKey(key))) || 0 } catch { return 0 }
}

function setLocalValue(key, value, updatedAt) {
  const str = typeof value === 'string' ? value : JSON.stringify(value)
  localStorage.setItem(key, str)
  localStorage.setItem(updatedKey(key), String(updatedAt || Date.now()))
}

function normalizeServerEntry(key, entry) {
  const value = entry && typeof entry === 'object' && Object.prototype.hasOwnProperty.call(entry, 'value')
    ? entry.value
    : entry
  const rawRevision = Number(entry?.revision)
  return {
    key,
    value,
    revision: Number.isFinite(rawRevision) && rawRevision >= 0 ? Math.floor(rawRevision) : 1,
    updatedAt: Number(entry?.updatedAt) || 0,
    updatedByDevice: String(entry?.updatedByDevice || entry?.deviceId || ''),
  }
}

function metadataFor(key) {
  return metadata.get(key) || { revision: serverKeys.has(key) ? 1 : 0, updatedAt: 0, updatedByDevice: '' }
}

function pendingEntry(key, value, updatedAt = Date.now()) {
  const server = metadataFor(key)
  return {
    value,
    baseRevision: server.revision,
    deviceId: getDeviceId(),
    updatedAt,
  }
}

async function serverRequest(options = {}) {
  if (!canUseServerPersistence()) return null
  const headers = new Headers(options.headers || {})
  headers.set('Content-Type', 'application/json')
  if (getNonce()) headers.set('X-WP-Nonce', getNonce())
  const method = options.method || 'GET'
  const path = options.path || '/state'
  const query = path.includes('?') ? '&' : '?'
  const url = method === 'GET'
    ? `${getApiBase()}${path}${query}_=${Date.now()}`
    : `${getApiBase()}${path}`
  const response = await fetch(url, {
    credentials: 'same-origin',
    keepalive: method !== 'GET',
    ...options,
    headers,
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    if (response.status === 409) throw new PersistenceConflictError(payload.data || payload)
    const error = new Error(payload.message || `Server persistence failed: ${response.status}`)
    error.status = response.status
    error.details = payload.data || payload
    throw error
  }
  return response
}

async function backupConflictSnapshot(key, entry, details = {}, reason = 'revision_conflict') {
  const response = await serverRequest({
    method: 'POST',
    path: '/state/backup',
    body: JSON.stringify({
      key,
      value: entry.value,
      baseRevision: Number(entry.baseRevision) || 0,
      clientUpdatedAt: Number(entry.updatedAt) || Date.now(),
      deviceId: entry.deviceId || getDeviceId(),
      reason,
    }),
  })
  if (!response) throw new Error('Server conflict backup is unavailable.')
  const result = await response.json().catch(() => ({}))
  if (!result.backup) throw new Error('Server did not confirm the conflict backup.')
  return result.backup
}

function scheduleRetry() {
  if (retryTimer || !pending.size || !canUseServerPersistence()) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    flushPending()
  }, RETRY_DELAY_MS)
}

function conflictDetailsFor(key, entry, details = {}, backup = null) {
  const serverRevision = Number(details.serverRevision)
  if (Number.isFinite(serverRevision) && serverRevision >= 0) {
    metadata.set(key, {
      revision: serverRevision,
      updatedAt: Number(details.serverUpdatedAt) || 0,
      updatedByDevice: String(details.serverUpdatedByDevice || ''),
    })
    serverKeys.add(key)
  }
  const next = {
    ...details,
    key,
    clientRevision: Number(entry.baseRevision) || 0,
    localUpdatedAt: Number(entry.updatedAt) || Date.now(),
    backupSaved: Boolean(backup),
    backupPending: !backup && Boolean(details.backupPending),
    backupId: backup?.id || null,
  }
  staleLocal.set(key, { ...entry, backupId: next.backupId, backupSaved: next.backupSaved })
  blockedConflicts.set(key, next)
  return next
}

async function flushConflictBackups() {
  const snapshots = [...pendingConflictBackups.entries()]
  pendingConflictBackups.clear()
  for (const [key, snapshot] of snapshots) {
    try {
      const backup = await backupConflictSnapshot(key, snapshot.entry, snapshot.details, 'conflict_edit')
      const details = conflictDetailsFor(key, snapshot.entry, snapshot.details, backup)
      publishStatus(PersistenceState.CONFLICT, details)
    } catch (error) {
      pendingConflictBackups.set(key, snapshot)
      publishStatus(PersistenceState.CONFLICT, {
        ...snapshot.details,
        key,
        backupSaved: false,
        backupError: error.message,
      })
    }
  }
  if (pendingConflictBackups.size) {
    conflictBackupTimer = setTimeout(() => {
      conflictBackupTimer = null
      flushConflictBackups()
    }, RETRY_DELAY_MS)
  }
}

function scheduleConflictBackup(key, entry, details) {
  pendingConflictBackups.set(key, { entry, details })
  if (conflictBackupTimer) clearTimeout(conflictBackupTimer)
  conflictBackupTimer = setTimeout(() => {
    conflictBackupTimer = null
    flushConflictBackups()
  }, 800)
}

function setSavedMetadata(key, entry, fallback) {
  const rawRevision = Number(entry?.revision)
  const revision = Number.isFinite(rawRevision) && rawRevision >= 0
    ? Math.floor(rawRevision)
    : Math.max(1, (Number(metadata.get(key)?.revision) || Number(fallback?.baseRevision) || 0) + 1)
  const updatedAt = Number(entry?.updatedAt) || Date.now()
  metadata.set(key, {
    revision,
    updatedAt,
    updatedByDevice: String(entry?.updatedByDevice || entry?.deviceId || fallback?.deviceId || ''),
  })
  serverKeys.add(key)
  return metadata.get(key)
}

async function flushPending() {
  if (flushPromise) return flushPromise
  if (!pending.size || !canUseServerPersistence()) return
  flushPromise = (async () => {
    const entries = [...pending.entries()]
    entries.forEach(([key]) => pending.delete(key))
    publishStatus(PersistenceState.SAVING, { keys: entries.map(([key]) => key) })
    const savedKeys = []
    const conflicts = []
    const errors = []

    for (const [key, entry] of entries) {
      try {
        const response = await serverRequest({
          method: 'POST',
          body: JSON.stringify({ entries: { [key]: entry } }),
        })
        const result = await response.json().catch(() => ({}))
        const saved = result.saved && typeof result.saved === 'object' ? result.saved[key] : null
        const next = setSavedMetadata(key, saved, entry)
        blockedConflicts.delete(key)
        staleLocal.delete(key)

        const newer = pending.get(key)
        if (newer && Number(newer.updatedAt) > Number(entry.updatedAt)) {
          pending.set(key, { ...newer, baseRevision: next.revision })
        } else if (entry.value === null) {
          try {
            localStorage.removeItem(key)
            localStorage.setItem(updatedKey(key), String(next.updatedAt))
          } catch {}
        } else {
          try { setLocalValue(key, entry.value, next.updatedAt) } catch {}
        }
        savedKeys.push(key)
      } catch (error) {
        const details = error.details || {}
        if (error.status === 409 || error instanceof PersistenceConflictError) {
          let backup = null
          try { backup = await backupConflictSnapshot(key, entry, details) } catch (backupError) {
            details.backupError = backupError.message
            details.backupPending = true
          }
          const conflict = conflictDetailsFor(key, entry, details, backup)
          if (!backup) scheduleConflictBackup(key, entry, conflict)
          conflicts.push(conflict)
        } else {
          if (!pending.has(key)) pending.set(key, entry)
          errors.push({ key, message: error.message })
          console.warn('Server persistence deferred:', error.message)
        }
      }
    }

    if (conflicts.length) {
      publishStatus(PersistenceState.CONFLICT, conflicts.at(-1))
    } else if (errors.length) {
      publishStatus(PersistenceState.ERROR, errors[0])
    } else {
      publishStatus(PersistenceState.SAVED, { keys: savedKeys })
    }
    if (pending.size) scheduleRetry()
  })()
  try {
    await flushPromise
  } finally {
    flushPromise = null
  }
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => {
    flushTimer = null
    flushPending()
  }, 500)
}

export async function syncFromServer() {
  if (_synced) return
  if (_syncPromise) return _syncPromise
  _syncPromise = (async () => {
    try {
      const resp = await serverRequest()
      if (!resp) return
      const data = await resp.json()
      for (const [key, rawEntry] of Object.entries(data || {})) {
        const entry = normalizeServerEntry(key, rawEntry)
        serverKeys.add(key)
        metadata.set(key, {
          revision: entry.revision,
          updatedAt: entry.updatedAt,
          updatedByDevice: entry.updatedByDevice,
        })

        const localPending = pending.get(key)
        if (localPending) {
          if (localPending.baseRevision !== entry.revision) {
            publishStatus(PersistenceState.CONFLICT, {
              key,
              clientRevision: localPending.baseRevision,
              serverRevision: entry.revision,
              serverValue: entry.value,
              serverUpdatedAt: entry.updatedAt,
              serverUpdatedByDevice: entry.updatedByDevice,
            })
          }
          continue
        }

        const localRaw = localStorage.getItem(key)
        const localUpdatedAt = getLocalUpdatedAt(key)
        if (localRaw !== null && localUpdatedAt > entry.updatedAt) {
          const localValue = (() => { try { return JSON.parse(localRaw) } catch { return localRaw } })()
          const localEntry = {
            value: localValue,
            baseRevision: entry.revision,
            deviceId: getDeviceId(),
            updatedAt: localUpdatedAt,
          }
          let backup = null
          let backupError = ''
          try { backup = await backupConflictSnapshot(key, localEntry, entry, 'local_newer') } catch (error) {
            backupError = error.message
          }
          const details = conflictDetailsFor(key, localEntry, {
            key,
            serverRevision: entry.revision,
            serverValue: entry.value,
            serverUpdatedAt: entry.updatedAt,
            serverUpdatedByDevice: entry.updatedByDevice,
            localOnly: true,
            localUpdatedAt,
            backupError,
            backupPending: !backup,
          }, backup)
          if (!backup) scheduleConflictBackup(key, localEntry, details)
          if (backup) {
            try {
              if (entry.value === null) {
                localStorage.removeItem(key)
                localStorage.setItem(updatedKey(key), String(entry.updatedAt))
              } else {
                setLocalValue(key, entry.value, entry.updatedAt)
              }
            } catch {}
          }
          publishStatus(PersistenceState.CONFLICT, details)
          continue
        }
        try {
          if (entry.value === null) {
            localStorage.removeItem(key)
            localStorage.setItem(updatedKey(key), String(entry.updatedAt))
          } else {
            setLocalValue(key, entry.value, entry.updatedAt)
          }
        } catch {}
      }
      _synced = true
      if (pending.size) scheduleFlush()
    } catch (e) {
      console.warn('syncFromServer failed:', e.message)
      publishStatus(PersistenceState.ERROR, { message: e.message })
      _syncPromise = null
    }
  })()
  return _syncPromise
}

export function persistGet(key) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    if (_synced && !serverKeys.has(key) && !pending.has(key)) {
      const value = (() => { try { return JSON.parse(raw) } catch { return raw } })()
      pending.set(key, pendingEntry(key, value, getLocalUpdatedAt(key) || Date.now()))
      scheduleFlush()
    }
    try { return JSON.parse(raw) } catch { return raw }
  } catch { return null }
}

export function persistSet(key, value) {
  const updatedAt = Date.now()
  try { setLocalValue(key, value, updatedAt) } catch {}
  const blocked = blockedConflicts.get(key)
  if (blocked) {
    const entry = {
      value,
      baseRevision: Number(blocked.serverRevision) || metadataFor(key).revision,
      deviceId: getDeviceId(),
      updatedAt,
    }
    staleLocal.set(key, entry)
    scheduleConflictBackup(key, entry, blocked)
    publishStatus(PersistenceState.CONFLICT, { ...blocked, key, backupPending: true })
    return
  }
  staleLocal.delete(key)
  pending.set(key, pendingEntry(key, value, updatedAt))
  scheduleFlush()
}

export function persistRemove(key) {
  try { localStorage.removeItem(key) } catch {}
  try { localStorage.removeItem(updatedKey(key)) } catch {}
  const blocked = blockedConflicts.get(key)
  if (blocked) {
    const entry = {
      value: null,
      baseRevision: Number(blocked.serverRevision) || metadataFor(key).revision,
      deviceId: getDeviceId(),
      updatedAt: Date.now(),
    }
    staleLocal.set(key, entry)
    scheduleConflictBackup(key, entry, blocked)
    publishStatus(PersistenceState.CONFLICT, { ...blocked, key, backupPending: true })
    return
  }
  staleLocal.delete(key)
  pending.set(key, pendingEntry(key, null))
  scheduleFlush()
}

export function getPersistenceMetadata(key) {
  const entry = metadata.get(key)
  return entry ? { ...entry } : null
}

export function getPendingPersistence(key) {
  const entry = pending.get(key)
  return entry ? { ...entry } : null
}

export async function reloadServerValue(key) {
  const response = await serverRequest()
  if (!response) return null
  const data = await response.json()
  staleLocal.delete(key)
  blockedConflicts.delete(key)
  pendingConflictBackups.delete(key)
  const rawEntry = data?.[key]
  pending.delete(key)
  if (!rawEntry) {
    serverKeys.delete(key)
    metadata.delete(key)
    try {
      localStorage.removeItem(key)
      localStorage.removeItem(updatedKey(key))
    } catch {}
    publishStatus(PersistenceState.SAVED, { key, reloaded: true })
    return null
  }
  const entry = normalizeServerEntry(key, rawEntry)
  serverKeys.add(key)
  metadata.set(key, {
    revision: entry.revision,
    updatedAt: entry.updatedAt,
    updatedByDevice: entry.updatedByDevice,
  })
  try {
    if (entry.value === null) {
      localStorage.removeItem(key)
      localStorage.setItem(updatedKey(key), String(entry.updatedAt))
    } else {
      setLocalValue(key, entry.value, entry.updatedAt)
    }
  } catch {}
  publishStatus(PersistenceState.SAVED, { key, reloaded: true, revision: entry.revision })
  return entry
}

export async function getStateHistory(key, limit = 100) {
  const params = new URLSearchParams()
  if (key) params.set('key', key)
  if (limit) params.set('limit', String(limit))
  const response = await serverRequest({ path: `/state/history?${params.toString()}` })
  if (!response) return []
  const result = await response.json()
  return Array.isArray(result.history) ? result.history : []
}

export async function restoreServerValue(key, revision, baseRevision = metadataFor(key).revision) {
  const deviceId = getDeviceId()
  try {
    const response = await serverRequest({
      method: 'POST',
      path: '/state/restore',
      body: JSON.stringify({ key, revision, baseRevision, deviceId }),
    })
    if (!response) return null
    const result = await response.json()
    const restored = result.restored
    if (!restored) return null
    pending.delete(key)
    serverKeys.add(key)
    metadata.set(key, {
      revision: Number(restored.revision) || Number(baseRevision) + 1,
      updatedAt: Number(restored.updatedAt) || Date.now(),
      updatedByDevice: String(restored.updatedByDevice || deviceId),
    })
    try { setLocalValue(key, restored.value, metadata.get(key).updatedAt) } catch {}
    publishStatus(PersistenceState.SAVED, { key, restoredRevision: revision, revision: metadata.get(key).revision })
    return restored
  } catch (error) {
    const details = error.details || {}
    if (error.status === 409 || error instanceof PersistenceConflictError) {
      publishStatus(PersistenceState.CONFLICT, { ...details, key: details.key || key })
    } else {
      publishStatus(PersistenceState.ERROR, { key, message: error.message })
    }
    throw error
  }
}

export async function copyPendingValue(key) {
  const entry = pending.get(key) || staleLocal.get(key)
  if (!entry) return false
  const text = typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value, null, 2)
  if (globalThis.navigator?.clipboard?.writeText) {
    await globalThis.navigator.clipboard.writeText(text)
  }
  return text
}

export async function flushPersistence() {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = null
  await flushPending()
  if (conflictBackupTimer) clearTimeout(conflictBackupTimer)
  conflictBackupTimer = null
  await flushConflictBackups()
}

export async function getStateBackups(key, limit = 100) {
  const params = new URLSearchParams()
  if (key) params.set('key', key)
  if (limit) params.set('limit', String(limit))
  const response = await serverRequest({ path: `/state/backups?${params.toString()}` })
  if (!response) return []
  const result = await response.json()
  return Array.isArray(result.backups) ? result.backups : []
}

if (globalThis.addEventListener) {
  globalThis.addEventListener('online', () => {
    if (pending.size) scheduleFlush()
    if (pendingConflictBackups.size) flushConflictBackups()
  })
}
