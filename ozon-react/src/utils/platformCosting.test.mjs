import assert from 'node:assert/strict'
import { DEFAULT_TARIFFS } from './wbConfig.js'
import { ALL_CHANNELS, calcChannelProfit } from './ozonEngine.js'
import { effectiveWbRoutes, isEnteredNumber, missingOzonInputs, missingWbInputs } from './platformCosting.js'
import { buildOzonScenarioPayload, recalculateOzonScenario } from './t6/costScenarioAdapter.js'

const currentRoutes = effectiveWbRoutes(DEFAULT_TARIFFS, '2026-10-08')
assert.equal(currentRoutes.length, new Set(currentRoutes.map((route) => route.routeId)).size)
assert.equal(currentRoutes.find((route) => route.routeId === 'DPX-SZ-382822')?.effectiveFrom, '2026-07-22')
assert.equal(effectiveWbRoutes(DEFAULT_TARIFFS, '2026-07-21').find((route) => route.routeId === 'DPX-SZ-382822')?.effectiveFrom, '2026-02-09')
assert.equal(effectiveWbRoutes(DEFAULT_TARIFFS, '2026-01-01').length, 0)

assert.equal(isEnteredNumber(''), false)
assert.equal(isEnteredNumber('0'), true)
assert.equal(isEnteredNumber('-1'), false)
assert.equal(isEnteredNumber('1.5', { integer: true }), false)
assert.ok(missingWbInputs({ quantity: '1.5' }).includes('数量'))
assert.ok(missingOzonInputs({ purchaseCost: '', domesticShipping: '0' }).includes('采购成本'))
assert.ok(!missingOzonInputs({ purchaseCost: '0', domesticShipping: '0' }).includes('采购成本'))
assert.ok(missingWbInputs({ purchaseCost: '', packagingCost: '0' }).includes('采购成本'))
assert.ok(!missingWbInputs({ purchaseCost: '0', packagingCost: '0' }).includes('采购成本'))

const inputPayload = {
  price: 5200, weight: 1.55, length: 52, width: 45, height: 28,
  purchaseCost: 35, domesticShipping: 3, labelingFee: 2,
  commission: 12, adRate: 10, paymentFee: 1, agencyFee: 3, returnLoss: 4,
}
const channel = ALL_CHANNELS.find((item) => calcChannelProfit(item, inputPayload.price, inputPayload.weight, inputPayload.length, inputPayload.width, inputPayload.height, { ...inputPayload, rubPerCny: 12 }))
assert.ok(channel, 'test fixture needs an eligible Ozon channel')
const outputPayload = calcChannelProfit(channel, inputPayload.price, inputPayload.weight, inputPayload.length, inputPayload.width, inputPayload.height, { ...inputPayload, rubPerCny: 12 })
const scenario = {
  platform: 'OZON',
  ...buildOzonScenarioPayload({
    project: { source: { creationSnapshotId: 'snapshot-test' } }, inputPayload,
    selectedChannelId: channel.id, outputPayload,
    exchangeRateInfo: { rubPerCny: 12, source: 'test', date: '2026-10-08', refDate: '2026-10-07' },
  }),
}
assert.equal(scenario.resolvedConfig.rubPerCny, 12)
assert.equal(scenario.resolvedConfig.agencyFee.rate, 0.03)
assert.equal(scenario.resolvedConfig.exchangeRateDate, '2026-10-08')
assert.deepEqual(recalculateOzonScenario(scenario), outputPayload)

console.log('platform costing checks passed')
