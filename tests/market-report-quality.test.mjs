import assert from 'node:assert/strict'
import { GENERATED_MARKET_REPORTS } from '../ozon-react/src/generated/marketReports.js'
import { RECENT_MARKET_REPORTS } from '../ozon-react/src/generated/recentMarketReports.js'
import { FEATURED_MARKET_BRIEFS } from '../ozon-react/src/generated/featuredMarketBriefs.js'

const reportBriefs = [
  ...GENERATED_MARKET_REPORTS.map((report) => report.decisionBrief),
  ...RECENT_MARKET_REPORTS,
  ...Object.values(FEATURED_MARKET_BRIEFS),
]
const allowedDecisions = new Set(['优先小批测试', '补证据后测试', '观察'])

assert.equal(reportBriefs.length, 24, 'all 24 bundled market reports must pass the shared quality contract')

for (const brief of reportBriefs) {
  assert.equal(brief.executiveSummary?.length, 3, `${brief.id}: executive summary must contain three decisions`)
  assert.ok(brief.russiaEntry?.context?.sources?.length >= 2, `${brief.id}: Russia evidence sources are required`)
  assert.ok(brief.russiaEntry?.gaps?.length >= 3, `${brief.id}: known data gaps must remain visible`)
  assert.ok(
    brief.recommendations?.every((item) => Array.isArray(item.evidence) && item.evidence.length > 0),
    `${brief.id}: every recommendation needs supporting evidence`,
  )
  assert.ok(
    brief.newProducts?.every((item) => item.ageDays >= 0 && item.ageDays <= 180 && /^https?:\/\//u.test(item.url)),
    `${brief.id}: new-product links must stay inside the 0-180 day window and use safe URLs`,
  )

  for (const opportunity of brief.russiaEntry.typeOpportunities || []) {
    assert.ok(
      Number.isFinite(opportunity.score) && opportunity.score >= 0 && opportunity.score <= 100,
      `${brief.id}: type opportunity scores must stay between 0 and 100`,
    )
    assert.ok(allowedDecisions.has(opportunity.decision), `${brief.id}: unknown type opportunity decision`)
    assert.ok(
      opportunity.evidenceCoverage >= 0 && opportunity.evidenceCoverage <= 100,
      `${brief.id}: evidence coverage must stay between 0 and 100`,
    )
  }

  for (const source of brief.russiaEntry.context.sources) {
    assert.match(source.url, /^https:\/\//u, `${brief.id}: external evidence links must use HTTPS`)
  }
}

console.log(`validated ${reportBriefs.length} market reports: Russia context, evidence, dates and scores`)
