import { getApiBase, setSessionAuthorized } from './runtime.js'

async function sessionRequest(options = {}) {
  const method = options.method || 'GET'
  const url = method === 'GET'
    ? `${getApiBase()}/session?_=${Date.now()}`
    : `${getApiBase()}/session`
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(result.message || '访问验证失败')
    error.status = response.status
    throw error
  }
  setSessionAuthorized(Boolean(result.authorized))
  return result
}

export async function checkAccessSession() {
  try {
    return await sessionRequest()
  } catch {
    setSessionAuthorized(false)
    return { authorized: false }
  }
}

export async function unlockAccess(password) {
  return sessionRequest({
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

export async function lockAccess() {
  try {
    return await sessionRequest({ method: 'DELETE' })
  } finally {
    setSessionAuthorized(false)
  }
}
