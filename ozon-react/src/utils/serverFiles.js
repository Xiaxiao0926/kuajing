import { canUseServerPersistence, getApiBase, getNonce } from './runtime.js'

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
    const response = await request(`/files/${encodeURIComponent(namespace)}`)
    if (!response) return []
    const result = await response.json()
    return Array.isArray(result.files) ? result.files : []
  } catch (error) {
    console.warn('Server file list skipped:', error.message)
    return []
  }
}

export async function uploadServerFile(namespace, file) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await request(`/files/${encodeURIComponent(namespace)}`, {
    method: 'POST',
    body: formData,
  })
  return response ? response.json() : null
}

export async function deleteServerFile(namespace, name) {
  try {
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
