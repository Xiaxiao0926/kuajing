/**
 * 每日汇率自动更新服务 - 单元测试
 * 运行方式: node ozon-react/src/utils/exchangeRate.test.mjs
 *
 * 覆盖：CBR/ER-API 解析（Nominal 换算、新鲜度、异常数据拒绝）、合理性边界、
 * 日缓存命中（不重复请求）、主源失败落备源、双源失败落配置兜底、live 汇率写入引擎。
 */

import {
  todayStr, isSaneRate, formatRubPerCny,
  parseCbrCnyRate, parseErApiCnyRate,
  refreshDailyRate, getRateInfo, subscribeRateInfo,
} from './exchangeRate.js'
import { rubPerCny, setLiveRubPerCny } from './ozonEngine.js'

let pass = 0, fail = 0
const assert = (cond, msg) => {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.log(`  ❌ ${msg}`) }
}

console.log('\n===== 每日汇率自动更新 测试开始 =====\n')

// ---------- 纯函数 ----------

const today = todayStr()
assert(/^\d{4}-\d{2}-\d{2}$/.test(today), `todayStr 返回 YYYY-MM-DD（${today}）`)

assert(isSaneRate(8) && isSaneRate(20) && isSaneRate(13) && isSaneRate(12.4378), 'isSaneRate 正常区间通过')
assert(!isSaneRate(7.99) && !isSaneRate(20.01) && !isSaneRate(NaN) && !isSaneRate('abc'), 'isSaneRate 越界/非法值拒绝')

assert(formatRubPerCny(13) === '13', 'formatRubPerCny 整数原样显示')
assert(formatRubPerCny(12.437811) === '12.4378', 'formatRubPerCny 小数保留4位')

const freshDate = new Date().toISOString().slice(0, 10)

// CBR 解析：Nominal 换算
const cbrOk = parseCbrCnyRate({ Date: freshDate, Valute: { CNY: { Nominal: 10, Value: 124.378 } } })
assert(cbrOk && Math.abs(cbrOk.rubPerCny - 12.4378) < 1e-9, `CBR Nominal=10 换算正确（${cbrOk && cbrOk.rubPerCny}）`)
const cbrOk1 = parseCbrCnyRate({ Date: freshDate, Valute: { CNY: { Nominal: 1, Value: 12.5 } } })
assert(cbrOk1 && cbrOk1.rubPerCny === 12.5, 'CBR Nominal=1 直接取值')
assert(parseCbrCnyRate({ Valute: {} }) === null, 'CBR 缺 CNY 币种返回 null')
assert(parseCbrCnyRate({ Date: freshDate, Valute: { CNY: { Nominal: 1, Value: 300 } } }) === null, 'CBR 越界汇率拒绝')
assert(parseCbrCnyRate({ Date: '2018-11-10T11:30:00+03:00', Valute: { CNY: { Nominal: 10, Value: 96.2642 } } }) === null, 'CBR 陈旧数据（>10天）拒绝')

// ER-API 解析
const erOk = parseErApiCnyRate({ rates: { RUB: 12.4378 }, time_last_update_unix: Math.floor(Date.now() / 1000) })
assert(erOk && erOk.rubPerCny === 12.4378, 'ER-API 正常解析')
assert(parseErApiCnyRate({ rates: {} }) === null, 'ER-API 缺 RUB 返回 null')
assert(parseErApiCnyRate({ rates: { RUB: 12.4378 }, time_last_update_unix: Math.floor(Date.now() / 1000) - 86400 * 30 }) === null, 'ER-API 陈旧数据（>10天）拒绝')

// ---------- refreshDailyRate（mock fetch + memory storage） ----------

class MemoryStorage {
  constructor() { this.map = new Map() }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null }
  setItem(k, v) { this.map.set(k, String(v)) }
}

const CBR_URL = 'https://www.cbr-xml-daily.ru/daily_json.js'
const ER_API_URL = 'https://open.er-api.com/v6/latest/CNY'

function makeFetch(routes) {
  const calls = []
  const fn = async (url) => {
    calls.push(url)
    const route = routes[url]
    if (!route || route.throw) throw new Error(route ? route.throw : `no mock: ${url}`)
    return { ok: true, json: async () => route.json }
  }
  fn.calls = calls
  return fn
}

const cbrJson = { Date: freshDate, Valute: { CNY: { Nominal: 1, Value: 12.4378 } } }
const erJson = { rates: { RUB: 12.1111 }, time_last_update_unix: Math.floor(Date.now() / 1000) }

// 场景1：主源成功
{
  const storage = new MemoryStorage()
  const fetchImpl = makeFetch({ [CBR_URL]: { json: cbrJson } })
  const notified = []
  const unsub = subscribeRateInfo((info) => notified.push(info))
  const info = await refreshDailyRate({ fetchImpl, storage })
  assert(info.rubPerCny === 12.4378 && info.source === '俄罗斯央行' && info.auto === true, '主源成功：应用 CBR 汇率')
  assert(rubPerCny === 12.4378, 'live binding 写入引擎（rubPerCny=12.4378）')
  assert(notified.length === 1 && notified[0].rubPerCny === 12.4378, '订阅者收到汇率更新通知')
  const cached = JSON.parse(storage.getItem('fx-rate-daily-v1'))
  assert(cached && cached.rubPerCny === 12.4378 && cached.date === today, '当日结果写入 localStorage 缓存')
  unsub()

  // 场景2：当日缓存命中 → 不再发请求
  const info2 = await refreshDailyRate({ fetchImpl, storage })
  assert(fetchImpl.calls.length === 1 && info2.rubPerCny === 12.4378, '缓存命中：不重复请求')
}

// 场景3：主源网络失败 → 备源成功
{
  const storage = new MemoryStorage()
  const fetchImpl = makeFetch({ [CBR_URL]: { throw: 'network down' }, [ER_API_URL]: { json: erJson } })
  const info = await refreshDailyRate({ fetchImpl, storage })
  assert(info.rubPerCny === 12.1111 && info.source === 'ER-API', '主源失败：备源 ER-API 生效')
  assert(fetchImpl.calls.length === 2, '主源+备源各请求一次')
}

// 场景4：主源返回陈旧数据 → 落备源
{
  const storage = new MemoryStorage()
  const staleCbr = { Date: '2018-11-10T11:30:00+03:00', Valute: { CNY: { Nominal: 10, Value: 96.2642 } } }
  const fetchImpl = makeFetch({ [CBR_URL]: { json: staleCbr }, [ER_API_URL]: { json: erJson } })
  const info = await refreshDailyRate({ fetchImpl, storage })
  assert(info.rubPerCny === 12.1111 && info.source === 'ER-API', '主源陈旧数据：解析拒绝后落备源')
}

// 场景5：双源失败 → 配置兜底，不写缓存
{
  const storage = new MemoryStorage()
  const fetchImpl = makeFetch({ [CBR_URL]: { throw: 'down' }, [ER_API_URL]: { throw: 'down' } })
  const info = await refreshDailyRate({ fetchImpl, storage })
  assert(info.rubPerCny === 13 && info.source === 'config' && info.auto === false, '双源失败：配置兜底 13')
  assert(rubPerCny === 13, 'live binding 回落到配置值')
  assert(storage.getItem('fx-rate-daily-v1') === null, '兜底不写缓存（下次访问重试）')
}

// 场景6：force=true 强制刷新（跳过缓存读取）
{
  const storage = new MemoryStorage()
  storage.setItem('fx-rate-daily-v1', JSON.stringify({ rubPerCny: 12.9999, date: today, source: '俄罗斯央行', refDate: null }))
  const fetchImpl = makeFetch({ [CBR_URL]: { json: cbrJson } })
  const info = await refreshDailyRate({ force: true, fetchImpl, storage })
  assert(fetchImpl.calls.length === 1 && info.rubPerCny === 12.4378, 'force 跳过缓存直接拉取')
}

// 引擎侧联动：setLiveRubPerCny 更新后换算函数立即生效
{
  setLiveRubPerCny(12.5)
  assert(rubPerCny === 12.5, 'setLiveRubPerCny 更新 live binding')
  setLiveRubPerCny(-1)
  assert(rubPerCny === 12.5, '非法汇率被拒绝（不改变现状）')
  setLiveRubPerCny(13) // 还原默认，避免影响同进程其他断言
}

console.log(`\n===== 测试结果: ${pass} 通过 / ${fail} 失败 =====\n`)
if (fail > 0) process.exit(1)
