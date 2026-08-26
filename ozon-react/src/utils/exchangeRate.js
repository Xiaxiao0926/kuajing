/**
 * 每日汇率自动更新服务（RUB per CNY，即 1¥ = X₽）
 *
 * 数据源（按优先级）：
 *   1. 俄罗斯央行 CBR 官方每日牌价 https://www.cbr-xml-daily.ru/daily_json.js（CORS 开放，免费）
 *   2. open.er-api.com 市场汇率（CORS 开放，免费）
 *   3. 兜底：config/settings.json rub_per_cny（构建时固化值，经 generated/settings.js）
 *
 * 策略：
 *   - 每个浏览器自然日（业务时区 Asia/Shanghai）最多请求一次，结果缓存于 localStorage；
 *   - 拉取失败 / 数据异常 / 数据源时间戳过期（>10 天）时保持兜底值，不写缓存，下次访问自动重试；
 *   - 生效方式：setLiveRubPerCny 写入 ozonEngine 的 live binding，引擎全部换算立即使用新汇率。
 *
 * UI 侧：utils/useExchangeRate.js（React hook，汇率更新触发重渲染）。
 */

import settingsData from '../generated/settings.js'
import { setLiveRubPerCny } from './ozonEngine.js'

const FALLBACK_RUB_PER_CNY = Number(settingsData.rub_per_cny)
const CACHE_KEY = 'fx-rate-daily-v1'
const CBR_URL = 'https://www.cbr-xml-daily.ru/daily_json.js'
const ER_API_URL = 'https://open.er-api.com/v6/latest/CNY'
const FETCH_TIMEOUT_MS = 8000
const MAX_SOURCE_AGE_DAYS = 10
const MIN_RATE = 8
const MAX_RATE = 20

let currentInfo = {
  rubPerCny: FALLBACK_RUB_PER_CNY,
  date: null,
  source: 'config',
  refDate: null,
  auto: false,
}
const listeners = new Set()
let inFlight = null

/** 业务时区（config/settings.json timezone）下的"今天"，YYYY-MM-DD */
export function todayStr(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: settingsData.timezone || 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** 合理性边界：偏离正常区间的汇率一律拒绝（防数据源污染） */
export function isSaneRate(v) {
  const n = Number(v)
  return Number.isFinite(n) && n >= MIN_RATE && n <= MAX_RATE
}

/** 展示格式化：整数原样（13），小数保留 4 位（12.4378） */
export function formatRubPerCny(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)
  return Number.isInteger(n) ? String(n) : n.toFixed(4)
}

/** dateStr(YYYY-MM-DD) 距 now 的天数；无法解析返回 Infinity（视为过期） */
function daysBetween(dateStr, now) {
  const t = Date.parse(`${dateStr}T00:00:00Z`)
  if (!Number.isFinite(t)) return Infinity
  return Math.abs(now.getTime() - t) / 86400000
}

/**
 * 解析 CBR 牌价：Valute.CNY.Value / Nominal = 1 CNY 兑 RUB
 * 校验：数值合法 + 数据源 Date 距今不超过 MAX_SOURCE_AGE_DAYS（防 CDN 陈旧缓存）
 */
export function parseCbrCnyRate(json, now = new Date()) {
  const cny = json && json.Valute && json.Valute.CNY
  if (!cny) return null
  const nominal = Number(cny.Nominal) || 1
  const value = Number(cny.Value)
  if (!Number.isFinite(value) || nominal <= 0) return null
  const rate = value / nominal
  if (!isSaneRate(rate)) return null
  const refDate = String(json.Date || '').slice(0, 10)
  if (refDate && daysBetween(refDate, now) > MAX_SOURCE_AGE_DAYS) return null
  return { rubPerCny: rate, refDate: refDate || null }
}

/** 解析 open.er-api.com：rates.RUB = 1 CNY 兑 RUB，同样做新鲜度校验 */
export function parseErApiCnyRate(json, now = new Date()) {
  const rate = Number(json && json.rates && json.rates.RUB)
  if (!isSaneRate(rate)) return null
  const ts = Number(json && json.time_last_update_unix)
  const refDate = Number.isFinite(ts) ? new Date(ts * 1000).toISOString().slice(0, 10) : null
  if (refDate && daysBetween(refDate, now) > MAX_SOURCE_AGE_DAYS) return null
  return { rubPerCny: rate, refDate }
}

function defaultStorage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch { /* 浏览器禁用存储等场景 */ }
  return null
}

function readCache(storage) {
  try {
    const raw = storage && storage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!isSaneRate(parsed && parsed.rubPerCny)) return null
    if (typeof parsed.date !== 'string' || typeof parsed.source !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

function writeCache(storage, info) {
  try {
    if (storage) storage.setItem(CACHE_KEY, JSON.stringify(info))
  } catch { /* 存储写入失败不影响本次生效 */ }
}

export function getRateInfo() {
  return currentInfo
}

export function subscribeRateInfo(fn) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function applyRate(info) {
  if (!isSaneRate(info.rubPerCny)) return false
  currentInfo = { ...info }
  setLiveRubPerCny(currentInfo.rubPerCny)
  listeners.forEach((fn) => {
    try { fn(currentInfo) } catch { /* 单个监听器异常不影响其他 */ }
  })
  return true
}

async function fetchJson(url, fetchImpl) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const resp = await fetchImpl(url, { signal: controller.signal })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    return await resp.json()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 每日汇率刷新入口（App 挂载时调用一次；当日缓存命中则不发网络请求）。
 * 可注入 fetchImpl / storage 供单元测试。
 */
export async function refreshDailyRate({ force = false, fetchImpl = (...a) => fetch(...a), storage = defaultStorage() } = {}) {
  if (inFlight) return inFlight
  inFlight = (async () => {
    const today = todayStr()
    if (!force) {
      const cached = readCache(storage)
      if (cached && cached.date === today) {
        applyRate({ rubPerCny: cached.rubPerCny, date: cached.date, source: cached.source, refDate: cached.refDate || null, auto: true })
        return getRateInfo()
      }
    }
    // 主源：俄罗斯央行
    try {
      const parsed = parseCbrCnyRate(await fetchJson(CBR_URL, fetchImpl))
      if (parsed) {
        const info = { rubPerCny: parsed.rubPerCny, date: today, source: '俄罗斯央行', refDate: parsed.refDate, auto: true }
        writeCache(storage, info)
        applyRate(info)
        return getRateInfo()
      }
    } catch { /* 落到备源 */ }
    // 备源：open.er-api.com
    try {
      const parsed = parseErApiCnyRate(await fetchJson(ER_API_URL, fetchImpl))
      if (parsed) {
        const info = { rubPerCny: parsed.rubPerCny, date: today, source: 'ER-API', refDate: parsed.refDate, auto: true }
        writeCache(storage, info)
        applyRate(info)
        return getRateInfo()
      }
    } catch { /* 落到兜底 */ }
    // 兜底：保持构建时配置值（不写缓存，下次访问自动重试）
    applyRate({ rubPerCny: FALLBACK_RUB_PER_CNY, date: null, source: 'config', refDate: null, auto: false })
    return getRateInfo()
  })()
  try {
    return await inFlight
  } finally {
    inFlight = null
  }
}
