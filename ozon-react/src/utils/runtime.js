export function getRuntimeConfig() {
  if (globalThis.window?.KUAJING_CONFIG) return globalThis.window.KUAJING_CONFIG
  const configElement = globalThis.document?.getElementById('fyzsxnb-kuajing-config')
  if (!configElement?.textContent) return {}
  try {
    return JSON.parse(configElement.textContent)
  } catch {
    return {}
  }
}

let sessionAuthorized = Boolean(getRuntimeConfig().authorized)

export function getApiBase() {
  const configured = getRuntimeConfig().apiBase
  return configured ? configured.replace(/\/$/, '') : ''
}

export function getAssetUrl(pathname = '') {
  const config = getRuntimeConfig()
  const base = config.assetBase || import.meta.env.BASE_URL || '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  return new URL(pathname.replace(/^\//, ''), new URL(normalizedBase, window.location.origin)).toString()
}

export function getDataUrl(pathname = '') {
  const configured = getRuntimeConfig().dataBase
  if (!configured) return getAssetUrl(`data/${pathname.replace(/^\//, '')}`)
  const normalizedBase = configured.endsWith('/') ? configured : `${configured}/`
  return new URL(pathname.replace(/^\//, ''), normalizedBase).toString()
}

export function canUseServerPersistence() {
  return Boolean(sessionAuthorized && getApiBase())
}

export function setSessionAuthorized(authorized) {
  sessionAuthorized = Boolean(authorized)
}

export function requiresAccessSession() {
  return Boolean(getRuntimeConfig().sessionRequired)
}

export function getNonce() {
  return getRuntimeConfig().nonce || ''
}
