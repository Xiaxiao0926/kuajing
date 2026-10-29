# KJ-GEMINI-20261022-MARKET-RETENTION-003

Title: Market report revision retention and truthful collection dates

Executor: Gemini. Independent reviewer: Codex. Status: `ready`. Local implementation authorized by the user's request to continue optimization. Production/deployment authorization: false.

## Goal and boundaries

Users must be able to import two different batches with the same filename, select both reports, and retrieve each report's exact original source. Collection date must not be silently invented from the import date. Existing stored reports, IDs, source files, candidates, projects, snapshots, calculations and routes must remain intact.

Read AGENTS.md, ARCHITECTURE.md, BUSINESS_RULES.md, RUNBOOK.md, docs/ai-handoff/README.md and the previous planning task's REVIEW.md. That review supersedes conflicting suggestions in Gemini's earlier ROADMAP/IMPLEMENTATION_CARDS. Those suggested task IDs are not active work.

Claim only if CURRENT_TASK points here with `ready` and no owner. Set CURRENT_TASK and STATUS to `running` with `claimed_by: Gemini` when actually starting. Do not overwrite another owner.

## Baseline and permitted files

Expected HEAD is `de0cecf107e670e1c0d9cf393c50b92ab85afdee`; branch is `feat/platform-calc-parity-20261009`. Verify actual state. The repository contains existing changes: save target-file copies, hashes, status and the current diff before editing; show only this task's incremental changes at handoff.

Permitted existing implementation files:

- `ozon-react/src/utils/marketReportAnalysis.js`
- `ozon-react/src/components/reports/MarketReportCenter.jsx`
- `ozon-react/src/components/reports/UploadedMarketReport.jsx`
- `ozon-react/src/components/reports/MarketDecisionBrief.jsx` (only date/unknown/duplicate presentation needed by this contract)
- `ozon-react/src/utils/marketReportAnalysis.test.mjs`
- `tests/report-integration.test.mjs` (only obsolete assertions affected by this contract)
- `package.json` (only register the new regression test command and connect it to the existing market test entry)

Permitted new files: narrowly scoped helper(s) under `ozon-react/src/utils/marketReport/`, an import confirmation component under `ozon-react/src/components/reports/` if needed, `tests/market-report-retention.test.mjs`, a component/browser test harness under this task's `evidence/`, and task-local handoff evidence.

Read but do not change shared `serverFiles.js`, `persist.js`, WordPress PHP, generated reports, public/data, business files, engines, Gate, T6 stores, candidates/projects, dependency versions or deployment workflows. If the contract cannot be met without another production file, report the concrete blocker. No deployment, push, data migration, regeneration of historical reports or broad commit.

## A. Preserve report revisions and their source bytes

1. Each explicit confirmed import creates one new report revision ID using browser `crypto.randomUUID()`. Freeze this ID, publication timestamp and exact report JSON bytes for the entire attempt and any retries. Use a safe ASCII name such as `uploaded-<uuid>.json`, derived from the report's ID. Do not recompute the filename from the original source filename.
2. Compute the original file's SHA-256 using Web Crypto before any upload. Back up its unchanged bytes under `source-<full lowercase sha256>.<original extension lowercase>` in the existing source namespace. Keep the original filename in `sourceFile`. Both original and aliased MIME/type details must remain correct. Shared identical source bytes may reuse the content-addressed source name; do not overwrite a different-content source under its original name.
3. Add a versioned provenance object with at least `originalFileName`, `sourceSha256`, `sourceByteLength`, `importedAt`, `importId`, and a collection-date origin. Keep `schemaVersion: 1` and the existing reader contract; these are additive fields. Record `sourceBackup` from the server-confirmed result, not a guessed filename. Verify the response name matches the intended safe source identity before publishing the report.
4. Finish source confirmation before report upload. Only a server-confirmed report response permits the success state. Preserve the current offline queue contract. If a response is lost or the queue is pending, show confirmation pending/error accurately and retain the frozen attempt for an explicit retry; retries reuse the same ID, timestamp and bytes. Do not automatically create a second revision for that retry. An explicit new import may create a new revision even for identical source bytes.
5. List both old and new revisions after a refresh/remount. Never overwrite or rename old `uploaded-xxxxxxxx` report files. Keep the legacy exported ID helper available for existing callers; remove its use from new interactive publication identity. Display enough original filename, collection date and import/publication time to distinguish equal-title revisions.
6. Existing reports without provenance must remain selectable and readable without rewriting. Their stored snapshot dates remain recorded values with unverified origin; do not claim they were explicitly confirmed. Old source links cannot be retroactively guaranteed; do not attempt to repair them silently.

## B. Collection date and 180-day semantics

1. Introduce a compact import confirmation step before uploads. Show original file, parsed record count, an editable collection-date input, and an explicit `collection date unknown` option. A valid filename date may prefill the date; it is still a filename-derived value confirmed by the operator. Do not prefill today's date when absent.
2. Validate date-only values strictly as real calendar dates in YYYY-MM-DD. Reject invalid/rollover dates such as 2026-02-30. Use UTC date arithmetic for day boundaries. Invalid explicit input must not silently fall through to a filename date or current date. Avoid changing historical listing-date parsing beyond the collection-date contract.
3. In `buildUploadedMarketReport`, absent snapshot may use a strictly valid filename date; otherwise it is unknown. Explicit `snapshot: null` must suppress filename fallback. Remove the fallback to current time. Record origin as `user`, `filename`, or `unknown`. Import/publication timestamps may use current time and must stay distinct.
4. Unknown snapshot stores null and makes `ageDays` unavailable. `newProducts` may be an empty array for reader compatibility, but all cohort counts/shares/comparisons/recommendations that depend on the date must explicitly indicate `not evaluated`, never a measured zero or an old-product conclusion. Do not accidentally reward an unknown date as zero new competition or full evidence coverage in opportunity scores. Audit all consumers, including summary text, dimensions, type opportunities, quality and MarketDecisionBrief. Use additive status metadata and guarded presentation where needed.
5. When a valid snapshot is supplied, keep existing valid-date calculation semantics: day 0 and day 180 included; day 181 excluded; listing after snapshot excluded and reported. Missing listing dates remain unknown. Date coverage and collection-date availability are separate facts.
6. Canceling before confirmation performs no upload. Import confirmation/error/pending states must remain usable at desktop and narrow widths and must not shift existing navigation or report layouts unexpectedly.

## C. Preserve aggregation and expose uncertainty

Do not deduplicate by SKU/URL, choose first/last/max rows, or alter revenue/sales totals. Preserve original records and current aggregation. When repeated identities are detected, display a concise warning that the totals are summed by row and repeated identities need review of period/shop/variant. Do not assert duplicates always mean double-counting. Existing clean-data outputs must remain unchanged except for the explicit collection-date behavior above.

## Acceptance evidence

Use synthetic fixtures only; no private business data or real production uploads.

1. Same original filename with different source bytes creates different report IDs and different source names. Both reports are visible after remount against a local mock API. Older report/source bytes remain exactly unchanged.
2. Same source bytes in a separately confirmed import create a separate report revision while retaining the same source fingerprint. A retry of one attempt reuses its original ID and exact payload.
3. Legacy schemaVersion 1 reports with old IDs, no provenance and stored dates render without mutation. Built-in/static reports still work.
4. Unknown collection date stays null through build/JSON roundtrip/read/render; date-dependent summaries, comparisons and scores do not present zero as measured evidence. No date is silently assigned from today's clock.
5. Valid filename date, edited date, explicit unknown despite a dated filename, invalid calendar date, and 0/180/181-day boundaries are exercised. Date-input errors produce zero uploads.
6. Repeated SKU with different revenue/period/shop remains two records; totals stay as baseline, warning appears. No implicit deletion or business-rule change.
7. Exercise source failure/queue pending, source success + report failure, report response loss/delayed completion, retry and refresh. UI never reports server publication before confirmation; exact source/report association survives each case. Use a local mocked endpoint or injected adapter; never the production API.
8. Exercise the actual React import/confirmation handler, reload/remount and retry using a browser/component harness. Helper-only or source-string tests do not establish this lifecycle behavior. Retain desktop (1366x900) and narrow (390x844) screenshots plus request/payload evidence with synthetic files.

Required commands from repository root: new dedicated retention test command; `npm run test:market`; `node tests/report-integration.test.mjs`; `node tests/market-report-quality.test.mjs`; `npm test`; `npm run test:golden`; `npm run test:sync`; `npm --prefix ozon-react run build`. Record actual exits. Where npm test repeats test:market, do not count it as additional independent coverage. Do not modify generated output to force a pass. Any pre-existing failure must be isolated against the saved baseline and reported honestly.

## Handoff and rollback

Produce BASELINE.json, RESULT.md, tests.json, evidence/target-backups, incremental diff, and UI/request evidence. Include hashes for modified files, source fixtures and frozen retry payloads. Explain exact old/new behavior, any untested boundary, and remaining shared-queue/reload recovery limitations.

Rollback instructions must restore only this task's incremental file changes over the saved dirty baseline. Existing reports/sources are not deleted; new additive report records must remain readable by the old reader. Production rollback is a later deployment concern, not an action in this task.

On completion set task STATUS and CURRENT_TASK to `review_ready`, clear `claimed_by`, set `last_executor: Gemini`, and wait for Codex independent review. Keep production_authorized=false, deployment_status=not_deployed and public_verification_status=not_performed throughout.

## Subsequent sequence (not activated)

After acceptance: recoverable imports across reload/devices and measured report loading, then factory selection cards and report-to-candidate provenance. No automatic SKU deduplication, new Gate restrictions or commercial approvals are authorized by this task.
