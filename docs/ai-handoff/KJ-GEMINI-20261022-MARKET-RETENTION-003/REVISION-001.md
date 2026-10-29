# Revision 001: Luna implementation, Codex planning and acceptance

Date: 2026-10-28. Parent task: KJ-GEMINI-20261022-MARKET-RETENTION-003.
User authorized continued work with the main agent planning and Luna executing/reading. This revision authorizes local implementation only. No production deployment, remote writes, Git push, data migration or cleanup of existing work.

## Scope

1. Add an accessible original-source download action to UploadedMarketReport. Resolve only the report's exact `sourceBackup` in the existing `market-report-sources` namespace. Never choose by original filename, substring, latest revision or report title. If root/provenance source names conflict, fail clearly. Reports without a recorded backup remain readable with an unavailable-source explanation.
2. Use existing authenticated server file listing and returned download endpoint. Validate the returned download URL as same-origin HTTP(S) before fetching with credentials. No guessed public storage path or external credentials. Fetch original bytes; for provenance-bearing reports verify SHA-256 and recorded byte length before saving. A mismatch, missing file or failed request yields an actionable error and no downloaded wrong file. Legacy reports with an exact backup but no hash may be downloaded with an explicit unverified-source label; do not fabricate provenance or mutate stored records.
3. Provide loading/error/retry states and download with the original filename where available. Preserve report-switch correctness during an in-flight download. Keep desktop/mobile controls within bounds; use an existing lucide Download icon and a clear label. Leave detailed metadata layout refactoring for later.
4. Remove the arbitrary 1970-2100 restriction in the collection-date helper. Accept real four-digit Gregorian dates in years 0001-9999; reject 0000 and impossible dates. Preserve UTC day arithmetic, accounting for Date.UTC's 0-99 year behavior both in parsing and computeUtcAgeDays. Add targeted tests for 0001/0099/0100, 1969, 2101, 9999, leap days and existing 0/180/181-day cohorts. Do not change historical listing-date parsing or business formulas.
5. Produce fresh test records from actual commands. Preserve Gemini's original tests.json as historical evidence; the authoritative new record is tests-revision-001.json with command, actual exit, log path and limitations. Do not invent total assertion counts or count repeated suites as independent coverage.

## Allowed writes

- ozon-react/src/components/reports/UploadedMarketReport.jsx
- ozon-react/src/utils/marketReport/retentionContract.js
- new ozon-react/src/utils/marketReport/sourceDownload.js (if helpful)
- tests/market-report-retention.test.mjs and a new focused tests/market-report-source-download.test.mjs
- package.json only to register/connect the new focused test
- this task directory: revision-specific backups, evidence, RESULT-REVISION-001.md, tests-revision-001.json; and CURRENT_TASK.json / STATUS.json for claiming and result handoff

Read but do not modify shared serverFiles.js, runtime.js, PHP, business data, generated data, engines, Gates, stores, old evidence or Gemini's original deliverables. Record the dirty baseline and target hashes/backups before edits. Other contributors' work must be preserved.

## Evidence and acceptance

- Synthetic local cases: two reports with identical original filenames but different source hashes each download their own exact bytes; legacy bound/unbound report; missing source; hash/size mismatch; wrong origin; request failure followed by retry; report switch during pending download.
- Test actual React action/loading/error states using the existing test environment or a browser harness. Browser evidence should exercise a real click and saved download bytes against a local mock API, plus desktop 1366x900 and narrow 390x844 screenshots. Use a revision-specific evidence directory; preserve original evidence. Shut down only the processes this task starts.
- Run the focused source-download test, existing retention and report analysis tests, report-integration and market-report-quality. Run actual root npm test, npm run test:golden, npm run test:sync, npm --prefix ozon-react run build sequentially where generated outputs may overlap. Record real failures and baseline attribution; do not alter unrelated tests to force green.
- No production browser/API verification in this revision. Report hard-refresh import-recovery as an existing deferred limitation, not completed work.
- Return review_ready and stop. Codex performs independent review before acceptance. Rollback must use revision-specific pre-edit copies and preserve Gemini's already completed changes.
