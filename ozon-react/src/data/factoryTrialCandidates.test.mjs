import { COMPARISON_LEVELS, FACTORY_TRIAL_CANDIDATES, FACTORY_TRIAL_META } from './factoryTrialCandidates.js'

let pass = 0
let fail = 0
const assert = (condition, message) => {
  if (condition) { pass++; console.log(`  PASS ${message}`) }
  else { fail++; console.log(`  FAIL ${message}`) }
}

console.log('\n===== Factory trial candidate contract =====\n')

const ids = FACTORY_TRIAL_CANDIDATES.map((item) => item.id)
assert(FACTORY_TRIAL_CANDIDATES.length === 8, 'contains the frozen 8-candidate shortlist')
assert(new Set(ids).size === ids.length, 'candidate ids are unique')
assert(FACTORY_TRIAL_CANDIDATES.filter((item) => item.priority === 1).length === 4, 'four candidates are marked first batch')
assert(FACTORY_TRIAL_CANDIDATES.filter((item) => item.comparator.comparisonLevel !== 'missing').length === 6, 'six candidates have benchmark leads')
assert(FACTORY_TRIAL_CANDIDATES.every((item) => Object.hasOwn(COMPARISON_LEVELS, item.comparator.comparisonLevel)), 'comparison levels use the frozen vocabulary')
assert(FACTORY_TRIAL_CANDIDATES.every((item) => item.catalogueRef && item.catalogueClaims.length > 0 && item.confirmationNeeded.length > 0), 'every candidate retains catalogue evidence and missing fields')
assert(FACTORY_TRIAL_CANDIDATES.every((item) => item.comparator.priceRub === null || (item.comparator.url && item.comparator.checkedAt)), 'every public price has a URL and checked date')
assert(FACTORY_TRIAL_META.evidenceBoundary.includes('评价数不是销量'), 'evidence boundary prevents review-count misuse')

console.log(`\n===== Factory trial candidate contract: ${pass} passed / ${fail} failed =====\n`)
if (fail > 0) process.exit(1)
