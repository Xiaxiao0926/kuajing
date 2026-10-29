# Kuajing platform costing upgrade

Date: 2026-10-09
Owner: Codex
Scope: React `/kuajing` Ozon rFBS and WB panels, and project CostScenario handoff.

## Goal

Give both platforms a comparable workflow for preparing a SKU, checking a route,
understanding cost assumptions, and saving a reproducible project scenario. Keep
their separate tariff, commission, logistics, return, and settlement rules.

## Baseline

- Ozon: single-SKU channel profit, three preset multi-SKU groups, commission
  reference table. Standalone data uses `shipping-calc-rfbs-v2` and
  `product-pricing-v2`.
- WB: order calculator, SKU profit list, route comparison, tariff versions, and
  order reconciliation. Standalone data uses existing `wb-*-v1` keys.
- Projects: append-only `t6.costScenario.*` records preserve inputs, resolved
  configuration, and output. A baseline is an explicit project reference.
- The existing localStorage and WordPress REST persistence path is retained.

## Phase 1: make results reproducible

1. Select the WB route version effective on the calculation date. Route choices
   appear once per route; missing or expired versions are unavailable. Historical
   orders and saved scenarios retain their original version.
2. Pass one explicit RUB/CNY rate through the displayed Ozon calculation and
   saved scenario. Freeze the rate value, source, and reference date. A later
   refresh cannot change a saved result.
3. A project Ozon calculation starts from project evidence and blank assumptions,
   never another product's standalone draft. In both panels, missing required
   inputs display an incomplete state and cannot be saved as a project scenario.
4. Preserve a genuine entered zero as zero; distinguish it from an empty field.

## Phase 2: share useful workflows

1. WB route comparison adds a profit comparison using the existing WB engine,
   alongside the existing shipping and delivery-time comparison. It must use the
   same SKU, price, fee assumptions, rate, and date across all routes.
2. Ozon multi-SKU comparison accepts user-named product groups while preserving
   the three original groups and saved values. Project mode isolates drafts from
   standalone data and can save a chosen SKU calculation as a CostScenario.
3. Ozon gains a read-only, source-labelled channel/tariff view. Tariff edits
   continue through the canonical config workflow; the panel does not invent a
   second tariff authority.
4. Both panels show input provenance and estimated-versus-confirmed status in a
   compact, consistent summary. Platform-specific fee lines remain explicit.

## Phase 3: order review

- Add Ozon order-level estimated-versus-actual shipping/fee reconciliation based
  on its own saved input and settlement evidence. Do not copy WB reverse-event
  multipliers to Ozon.
- Show WB reverse-logistics estimates separately from actual bill amounts and
  identify whether the displayed operating profit includes them. Reusing the
  existing WB V2 engine requires separate formula/golden-test approval if the
  primary profit definition changes.
- No source tariff, commission, tax, or platform policy update is implied by
  this UI work. New rates require source documents, dates, and separate review.

## Data and release contract

- Do not rewrite existing `CostScenario` bytes, project IDs, SKU/order records,
  storage keys, Python calculators, or original business data.
- Treat standalone drafts, shared tariffs/SKUs, and project scenarios as distinct
  scopes. No project tab may silently write a global key.
- Run `npm test`, `npm run test:golden`, and `npm run test:sync` after code edits,
  plus focused tests for date boundaries, rate freeze, input completeness,
  project isolation, and real UI interactions.
- Verify before/after diffs, built frontend, and production persistence behavior
  separately. Deployment requires its own acceptance step.

## Acceptance cases

- On 2026-10-08, route DPX-SZ-382822 selects version 2026-07-22, not 2026-02-09.
- A runtime Ozon rate of 12 is saved as 12 and reproduces the displayed profit.
- An empty project purchase cost never inherits a standalone value or produces a
  saveable trusted profit; a user-entered zero remains distinguishable.
- WB route profit rankings exclude invalid routes and use one date/rate/input set.
- Legacy Ozon groups, WB orders/SKUs, and existing CostScenarios remain readable.

## Implementation status (2026-10-09)

- Phase 1 completed locally: effective-date WB route selection, explicit Ozon
  rate and agency-fee freeze, project-only blank cost inputs, and save gates.
- Phase 2 completed locally for WB profit route comparison, Ozon named groups,
  project-scoped Ozon multi-SKU drafts/scenario save, and the read-only Ozon
  channel view. WB project mode only exposes project-safe calculation tabs.
- Phase 3 is a separate follow-up. Ozon order reconciliation and any change to
  the WB primary reverse-logistics profit formula require their own business
  contract and golden cases; neither was silently introduced here.
- Local verification: focused platform-costing test, full `npm test`, golden
  tests, sync tests, Vite build, and Chrome desktop/mobile interaction checks
  passed. No production write or deployment was performed.
