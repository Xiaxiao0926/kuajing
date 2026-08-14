import { canUseServerPersistence, getApiBase, getNonce } from './runtime.js'

let _synced = false
let _syncPromise = null
const serverKeys = new Set()
const pending = new Map()
let flushTimer = null

const UPDATED_PREFIX = '__kuajing_updated__:'

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

async function serverRequest(options = {}) {
  if (!canUseServerPersistence()) return null
  const headers = new Headers(options.headers || {})
  headers.set('Content-Type', 'application/json')
  headers.set('X-WP-Nonce', getNonce())
  const response = await fetch(`${getApiBase()}/state`, { ...options, headers })
  if (!response.ok) throw new Error(`Server persistence failed: ${response.status}`)
  return response
}

async function flushPending() {
  if (!pending.size || !canUseServerPersistence()) return
  const entries = Object.fromEntries(pending)
  pending.clear()
  try {
    await serverRequest({ method: 'POST', body: JSON.stringify({ entries }) })
    Object.keys(entries).forEach(key => serverKeys.add(key))
  } catch (error) {
    Object.entries(entries).forEach(([key, entry]) => {
      if (!pending.has(key)) pending.set(key, entry)
    })
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
      if (!resp.ok) return
      const data = await resp.json()
      Object.keys(data).forEach(key => serverKeys.add(key))
      Object.entries(data).forEach(([key, entry]) => {
        if (entry && entry.value !== undefined) {
          const localRaw = localStorage.getItem(key)
          const localUpdatedAt = getLocalUpdatedAt(key)
          const serverUpdatedAt = Number(entry.updatedAt) || 0
          if ((localUpdatedAt && localUpdatedAt >= serverUpdatedAt) || (localRaw !== null && !localUpdatedAt)) {
            pending.set(key, {
              value: localRaw === null ? null : persistGet(key),
              updatedAt: localUpdatedAt || Date.now(),
            })
            return
          }
          try {
            if (entry.value === null) {
              localStorage.removeItem(key)
              localStorage.setItem(updatedKey(key), String(serverUpdatedAt))
            } else {
              setLocalValue(key, entry.value, serverUpdatedAt)
            }
          } catch {}
        }
      })
      _synced = true
      if (pending.size) scheduleFlush()
    } catch (e) {
      console.warn('syncFromServer failed:', e.message)
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
      pending.set(key, { value, updatedAt: getLocalUpdatedAt(key) || Date.now() })
      scheduleFlush()
    }
    try { return JSON.parse(raw) } catch { return raw }
  } catch { return null }
}

export function persistSet(key, value) {
  const updatedAt = Date.now()
  try {
    setLocalValue(key, value, updatedAt)
  } catch {}
  pending.set(key, { value, updatedAt })
  scheduleFlush()
}

export function persistRemove(key) {
  try { localStorage.removeItem(key) } catch {}
  try { localStorage.removeItem(updatedKey(key)) } catch {}
  pending.set(key, { value: null, updatedAt: Date.now() })
  scheduleFlush()
}

export async function flushPersistence() {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = null
  await flushPending()
}
