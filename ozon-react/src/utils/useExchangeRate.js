/**
 * 汇率订阅 hook：汇率每日自动更新时触发使用方重渲染。
 * 返回 { rubPerCny, date, source, refDate, auto }。
 */
import { useSyncExternalStore } from 'react'
import { getRateInfo, subscribeRateInfo } from './exchangeRate.js'

export function useExchangeRate() {
  return useSyncExternalStore(subscribeRateInfo, getRateInfo, getRateInfo)
}
