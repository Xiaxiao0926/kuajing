import { canUseServerPersistence, getApiBase, getNonce } from './runtime.js'

const QUEUE_DB = 'kuajing-server-file-backups'
const QUEUE_STORE = 'pending-uploads'
const RETRY_DELAY_MS = 10000
let queueFlushPromise = null
let retryTimer = null

function queueId(namespace, name) {
  return `${namespace}:${name}`
}

function openQueueDb() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('IndexedDB is unavailable.'))
    const request = indexedDB.open(QUEUE_DB, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Could not open the upload queue.'))
  })
}

async function queueOperation(mode, operation) {
  const db = await openQueueDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(QUEUE_STORE, mode)
    const store = transaction.objectStore(QUEUE_STORE)
    let request
    try { request = operation(store) } catch (error) {
      db.close()
      reject(error)
      return
    }
    transaction.oncomplete = () => {
      const result = request?.result
      db.close()
      resolve(result)
    }
    transaction.onerror = () => {
      const error = transaction.error || request?.error || new Error('Upload queue operation failed.')
      db.close()
      reject(error)
    }
    transaction.onabort = transaction.onerror
  })
}

function enqueueFile(namespace, file) {
  return queueOperation('readwrite', store => store.put({
    id: queueId(namespace, file.name),
    namespace,
    name: file.name,
    type: file.type || 'application/octet-stream',
    lastModified: Number(file.lastModified) || Date.now(),
    blob: file,
    queuedAt: Date.now(),
  }))
}

function removeQueuedFile(namespace, name) {
  return queueOperation('readwrite', store => store.delete(queueId(namespace, name)))
}

function listQueuedFiles() {
  return queueOperation('readonly', store => store.getAll())
}

async function request(path, options = {}) {
  if (!canUseServerPersistence()) return null

  const headers = new Headers(options.headers || {})
  if (getNonce()) headers.set('X-WP-Nonce', getNonce())
  const method = options.method || 'GET'
  const separator = path.includes('?') ? '&' : '?'
  const url = method === 'GET'
    ? `${getApiBase()}${path}${separator}_=${Date.now()}`
    : `${getApiBase()}${path}`
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers,
  })
  if (!response.ok) throw new Error(`Server request failed: ${response.status}`)
  return response
}

export async function listServerFiles(namespace) {
  try {
    flushQueuedServerFiles().catch(() => {})
    const response = await request(`/files/${encodeURIComponent(namespace)}`)
    if (!response) return []
    const result = await response.json()
    return Array.isArray(result.files) ? result.files : []
  } catch (error) {
    console.warn('Server file list skipped:', error.message)
    return []
  }
}

async function uploadFileNow(namespace, file) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await request(`/files/${encodeURIComponent(namespace)}`, {
    method: 'POST',
    body: formData,
  })
  return response ? response.json() : null
}

function scheduleQueueRetry() {
  if (retryTimer || !canUseServerPersistence()) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    flushQueuedServerFiles().catch(() => {})
  }, RETRY_DELAY_MS)
}

export async function flushQueuedServerFiles() {
  if (queueFlushPromise) return queueFlushPromise
  if (!canUseServerPersistence() || !globalThis.indexedDB) return { uploaded: 0, pending: 0 }
  queueFlushPromise = (async () => {
    const queued = await listQueuedFiles().catch(() => [])
    let uploaded = 0
    let pending = 0
    for (const record of queued) {
      try {
        const file = new File([record.blob], record.name, {
          type: record.type,
          lastModified: record.lastModified,
        })
        const result = await uploadFileNow(record.namespace, file)
        if (!result?.file) throw new Error('Server did not confirm the uploaded file.')
        await removeQueuedFile(record.namespace, record.name)
        uploaded += 1
      } catch (error) {
        pending += 1
        console.warn(`Server file backup deferred (${record.namespace}/${record.name}):`, error.message)
      }
    }
    if (pending) scheduleQueueRetry()
    return { uploaded, pending }
  })()
  try {
    return await queueFlushPromise
  } finally {
    queueFlushPromise = null
  }
}

export async function uploadServerFile(namespace, file) {
  let queued = false
  try {
    await enqueueFile(namespace, file)
    queued = true
  } catch (error) {
    console.warn('Could not persist the server file backup queue:', error.message)
  }
  try {
    const result = await uploadFileNow(namespace, file)
    if (result?.file && queued) await removeQueuedFile(namespace, file.name)
    return result
  } catch (error) {
    if (queued) scheduleQueueRetry()
    throw error
  }
}

export async function deleteServerFile(namespace, name) {
  try {
    await removeQueuedFile(namespace, name).catch(() => {})
    const response = await request(
      `/files/${encodeURIComponent(namespace)}?name=${encodeURIComponent(name)}`,
      { method: 'DELETE' },
    )
    return response ? response.json() : null
  } catch (error) {
    console.warn('Server file delete skipped:', error.message)
    return null
  }
}

if (globalThis.addEventListener) {
  globalThis.addEventListener('online', () => flushQueuedServerFiles().catch(() => {}))
}
