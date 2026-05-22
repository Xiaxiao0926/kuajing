let _synced = false
let _syncPromise = null

export async function syncFromServer() {
  if (_synced) return
  if (_syncPromise) return _syncPromise
  _syncPromise = (async () => {
    try {
      const resp = await fetch('/api/persist')
      if (!resp.ok) return
      const data = await resp.json()
      Object.entries(data).forEach(([key, entry]) => {
        if (entry && entry.value !== undefined && entry.value !== null) {
          const localRaw = localStorage.getItem(key)
          if (localRaw !== null) return
          try {
            const str = typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value)
            localStorage.setItem(key, str)
          } catch {}
        }
      })
      _synced = true
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
    try { return JSON.parse(raw) } catch { return raw }
  } catch { return null }
}

export function persistSet(key, value) {
  try {
    const str = typeof value === 'string' ? value : JSON.stringify(value)
    localStorage.setItem(key, str)
  } catch {}
  try {
    fetch('/api/persist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    }).catch(() => {})
  } catch {}
}

export function persistRemove(key) {
  try { localStorage.removeItem(key) } catch {}
  try {
    fetch('/api/persist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: null }),
    }).catch(() => {})
  } catch {}
}
