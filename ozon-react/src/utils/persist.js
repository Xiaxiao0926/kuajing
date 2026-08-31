import { canUseServerPersistence, getApiBase, getNonce } from './runtime.js'

let _synced = false
let _syncPromise = null
const serverKeys = new Set()
const metadata = new Map()
const pending = new Map()
const staleLocal = new Map()
const statusListeners = new Set()
let flushTimer = null
let persistenceStatus = { state: 'idle', key: null, details: null, updatedAt: 0 }

const UPDATED_PREFIX = '__kuajing_updated__:'
const DEVICE_ID_KEY = '__kuajing_device_id__'

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
  if (!pending.size || !canUseServerPersistence()) return
  const entries = Object.fromEntries(pending)
  pending.clear()
  publishStatus(PersistenceState.SAVING, { keys: Object.keys(entries) })
  try {
    const response = await serverRequest({
      method: 'POST',
      body: JSON.stringify({ entries }),
    })
    const result = await response.json().catch(() => ({}))
    Object.entries(entries).forEach(([key, entry]) => {
      const saved = result.saved && typeof result.saved === 'object' ? result.saved[key] : null
      const next = setSavedMetadata(key, saved, entry)
      if (entry.value === null) {
        try {
          localStorage.removeItem(key)
          localStorage.setItem(updatedKey(key), String(next.updatedAt))
        } catch {}
      } else {
        try { setLocalValue(key, entry.value, next.updatedAt) } catch {}
      }
    })
    publishStatus(PersistenceState.SAVED, { keys: Object.keys(entries) })
  } catch (error) {
    Object.entries(entries).forEach(([key, entry]) => {
      if (!pending.has(key)) pending.set(key, entry)
    })
    const details = error.details || {}
    if (error.status === 409 || error instanceof PersistenceConflictError) {
      publishStatus(PersistenceState.CONFLICT, { ...details, key: details.key || Object.keys(entries)[0] })
    } else {
      publishStatus(PersistenceState.ERROR, { key: Object.keys(entries)[0], message: error.message })
    }
    console.warn('Server persistence deferred:', error.message)
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
      Object.entries(data || {}).forEach(([key, rawEntry]) => {
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
          return
        }

        const localRaw = localStorage.getItem(key)
        const localUpdatedAt = getLocalUpdatedAt(key)
        if (localRaw !== null && localUpdatedAt > entry.updatedAt) {
          const localValue = (() => { try { return JSON.parse(localRaw) } catch { return localRaw } })()
          staleLocal.set(key, { value: localValue, updatedAt: localUpdatedAt })
          try {
            if (entry.value === null) {
              localStorage.removeItem(key)
              localStorage.setItem(updatedKey(key), String(entry.updatedAt))
            } else {
              setLocalValue(key, entry.value, entry.updatedAt)
            }
          } catch {}
          publishStatus(PersistenceState.CONFLICT, {
            key,
            clientRevision: null,
            serverRevision: entry.revision,
            serverValue: entry.value,
            serverUpdatedAt: entry.updatedAt,
            serverUpdatedByDevice: entry.updatedByDevice,
            localOnly: true,
            localUpdatedAt,
          })
          return
        }
        try {
          if (entry.value === null) {
            localStorage.removeItem(key)
            localStorage.setItem(updatedKey(key), String(entry.updatedAt))
          } else {
            setLocalValue(key, entry.value, entry.updatedAt)
          }
        } catch {}
      })
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
  staleLocal.delete(key)
  try { setLocalValue(key, value, updatedAt) } catch {}
  pending.set(key, pendingEntry(key, value, updatedAt))
  scheduleFlush()
}

export function persistRemove(key) {
  staleLocal.delete(key)
  try { localStorage.removeItem(key) } catch {}
  try { localStorage.removeItem(updatedKey(key)) } catch {}
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
}
