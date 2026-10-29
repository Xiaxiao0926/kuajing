# KJ-GEMINI-20261022-MARKET-RETENTION-003 — Delivery Result

- **Task ID**: `KJ-GEMINI-20261022-MARKET-RETENTION-003`
- **Title**: Market report revision retention and truthful collection dates
- **Executor**: Gemini
- **Independent Reviewer**: Codex
- **Hand-off Status**: `review_ready` (`claimed_by: null`, `last_executor: "Gemini"`)
- **Authorization & Deployment State**:
  - `local_implementation_authorized`: `true`
  - `production_authorized`: `false`
  - `deployment_status`: `not_deployed`
  - `public_verification_status`: `not_performed`

---

## 1. Old vs. New Behavior

### A. Report Revision Retention & Content-Addressed Source Bytes

| Aspect | Old Behavior | New Behavior |
|---|---|---|
| **Report ID & Filename** | Interactive imports derived `id` via `stableMarketReportId(file.name)` (`uploaded-<fnv1a32>`) and uploaded report JSON under a sanitized original filename, causing two different batches with the same filename to collide and overwrite each other. | Each explicit confirmed import generates a fresh `importId = crypto.randomUUID()`, freezes `id = uploaded-${importId}`, `publishedAt`, `importedAt`, and exact serialized report JSON bytes (`uploaded-${importId}.json`) via `createFrozenImportAttempt()`. Legacy `stableMarketReportId` remains exported for existing callers and fallback ID derivation. |
| **Source Backup Naming & Integrity** | Uploaded raw File under its original filename into `market-report-sources`; WordPress `sanitize_file_name()` stripped Cyrillic/CJK characters or overwrote previous batches with the same filename. | Computes Web Crypto SHA-256 (`crypto.subtle.digest('SHA-256', ...)`) on the unchanged original file bytes before any upload and backs up under `source-<64-hex-sha256>.<lowercase-ext>` while preserving original filename in `sourceFile` and MIME type on the aliased `File`. Verifies `sourceResult.file.name === expectedSourceBackupName` before uploading report JSON. |
| **Provenance Metadata** | No `provenance` block; `sourceBackup` could be recorded even when unconfirmed. | Adds additive `provenance` (`version: 1`, `originalFileName`, `sourceSha256`, `sourceByteLength`, `importedAt`, `importId`, `originalMimeType`, `sourceBackupMimeType`, `collectionDateOrigin`, `collectionDateConfirmed`, `collectionDateStatus`, `sourceBackup`) while keeping `schemaVersion: 1`. |
| **Upload Confirmation & Frozen Retry** | Treated local queue fallback or partial upload as immediate publication; retrying re-ran `buildUploadedMarketReport` with a new timestamp. | Finishes source confirmation before report upload. Only a server-confirmed report response (`reportResult?.file?.name === reportFileName`) transitions to `status: 'ready'`. On source or report failure/queue deferral, retains the frozen attempt (`pendingAttempt`) for explicit retry (`handleRetryFrozenAttempt`), reusing the exact same `id`, `publishedAt`, and serialized JSON bytes without creating a second revision. |
| **Multi-Revision Listing & Legacy Compatibility** | Equal-title reports were indistinguishable or overwritten after reload. | Lists both old and new revisions after refresh/remount, displaying original filename (`sourceFile`), collection date (`采集 YYYY-MM-DD` / `采集日未评估` / `未校验来源`), and import timestamp (`导入 YYYY-MM-DD HH:mm`) in desktop navigation, mobile `<select>`, and active report header. Legacy reports without `provenance` remain selectable and readable without mutation and explicitly label their stored `snapshot` as `历史记录（未校验来源）`. |

### B. Truthful Collection Date & 180-Day Cohort Semantics

| Aspect | Old Behavior | New Behavior |
|---|---|---|
| **Pre-Upload Confirmation** | Immediately uploaded on file selection without operator review of collection date. | Renders `MarketReportImportConfirm` before any upload, showing original filename, byte size, parsed row count, editable `YYYY-MM-DD` collection-date input (prefilled only when filename contains a strictly valid calendar date, never today's clock), and an explicit `采集日期未知（不评估 180 天新品指标）` checkbox. Canceling performs zero uploads. |
| **Calendar Date Validation & Day Arithmetic** | Used `new Date(raw)` which allowed rollover dates (e.g., `2026-02-30` rolling into March) and fell back to `new Date().toISOString().slice(0, 10)` when absent. | `parseStrictCalendarDateUtc()` validates real calendar dates in `YYYY-MM-DD` (rejecting `2026-02-30`, non-leap `02-29`, etc.) and uses UTC day boundaries (`computeUtcAgeDays`). Invalid explicit input is rejected with zero uploads and never falls through to filename or current clock. Explicit `snapshot: null` suppresses filename fallback. |
| **Unknown Collection Date (`snapshot: null`)** | Impossible in default flow because today's date was silently invented; if missing, treated `newProducts` as `0` (`0%` new product share, full 5-dimension evidence coverage). | Stores `snapshot: null`, `collectionDateOrigin: 'unknown'`, `collectionDateStatus: 'not_evaluated'`, and sets `ageDays = null` on all items (`newProducts: []` for reader compatibility). Propagates `status: 'not_evaluated'` and `null` metrics across `marketDimensions.newness`, `cohortComparison` (`newCount: null`, `oldCount: null`), `typeOpportunities` (`freshCount: null`, `freshRevenueShare: null`, `scoreParts.newness: null`, `evidenceCoverage` capped at `<= 80%` (`4/5` dimensions)), `recommendations[1]`, `insights[4]`, `quality`, `UploadedMarketReport`, and `MarketDecisionBrief` (including normalized display fields for `RussiaMarketEntry`). Separates `listingDateCoverage` from collection-date availability (`collectionDateKnown`). |
| **Valid Collection Date Boundaries** | Included `0..180` days. | Preserves exact valid-date semantics in UTC: `ageDays === 0` and `ageDays === 180` included in 180-day cohort; `ageDays === 181` excluded (old cohort); `ageDays < 0` (listing date after snapshot) excluded from both cohorts and counted in `quality.futureListingDateCount`. |

### C. Preserving Aggregation & Exposing Duplicate Identity Uncertainty

| Aspect | Old Behavior | New Behavior |
|---|---|---|
| **SKU/URL Aggregation & Warning** | Counted `duplicateSku` and `duplicateUrl` in `quality` without explaining row-summed aggregation vs. period/shop/variant ambiguity in report views. | Preserves all rows and exact revenue/sales totals without deduplication. Populates `quality.duplicateIdentityWarning` and renders a concise warning banner in `UploadedMarketReport` and `MarketDecisionBrief` whenever `duplicateSku > 0 || duplicateUrl > 0`, stating that totals are summed by row and repeated SKU/URL rows require checking period, shop, or variant splits. |

---

## 2. File Inventory & SHA-256 Hashes

### 2.1 Permitted Existing Target Files

| File Path | Pre-Edit Bytes | Pre-Edit SHA-256 | Post-Edit Bytes | Post-Edit SHA-256 | Modified |
|---|---:|---|---:|---|---|
| `ozon-react/src/utils/marketReportAnalysis.js` | 43,203 | `f3c00dd0f2dba4e3b220a7388bd3a08a639b5dbe659e1f9812fa642671d3127b` | 46,777 | `1526283551344a2cefcd67b20dc3c28816b6ea1d931cb847d483b88b6d92ba4c` | Yes |
| `ozon-react/src/components/reports/MarketReportCenter.jsx` | 15,149 | `ef95bd70cfd03ec84328273b3c416df382d28ce47b35b333ee347198cc6d3928` | 27,825 | `6ef751b5218e732143189a2502db68e94d29a1cc9dfb9e2ba8fdf029dd5da043` | Yes |
| `ozon-react/src/components/reports/UploadedMarketReport.jsx` | 9,198 | `0c63ff929e7b2f3520631c2057902fe2d9ea30a9292e34c6380d99a5e86423c8` | 11,742 | `9c32f416f9da84a7afbf47e56a712c2e25941fc38e57258a21c203dba3dddfa4` | Yes |
| `ozon-react/src/components/reports/MarketDecisionBrief.jsx` | 8,230 | `8cae1130b329cc534864b6156df5eba305df38e0104ee2da08a4d28a8b8c71ff` | 12,345 | `45915ae74c0ba36fe50f63bae750ca847c96a81e58e0ce21aca16f9d2d771e24` | Yes |
| `ozon-react/src/utils/marketReportAnalysis.test.mjs` | 10,080 | `c1e71e6bb959b68f1a87874c6c21e7f165595ca46b8de2ec7f28464af0449902` | 12,275 | `25475cba5c5ca5cfd55f353823f6552c775108aa80a3de2d6a31195a755903af` | Yes |
| `tests/report-integration.test.mjs` | 7,352 | `17ebc81a2577f6abdb2cf9500d00a1f3c4f2c2d809539bf0eee56fe530a3f569` | 7,352 | `17ebc81a2577f6abdb2cf9500d00a1f3c4f2c2d809539bf0eee56fe530a3f569` | No (passed as-is) |
| `package.json` | 3,032 | `f12888b6d46a03ec619219b67d27f8975eb3722a70b03950aa64cbbccd761097` | 3,109 | `df56c357c609d4d0bf1e5e31c9c27fad2a733ab3665a337d7626b1cbd74a5b64` | Yes |

### 2.2 Permitted New Files

| File Path | Bytes | SHA-256 |
|---|---:|---|
| `ozon-react/src/utils/marketReport/retentionContract.js` | 10,865 | `2bddd5e1a2b04b80ca72fc7d9e64f5e13272ac86fcad3785c1e32372ab33945d` |
| `ozon-react/src/components/reports/MarketReportImportConfirm.jsx` | 6,260 | `f64e282c9e80d867b18c5a5335b3e1065e7666725fcb6a0ef1f7374b94ce720a` |
| `tests/market-report-retention.test.mjs` | 37,878 | `a93eaed0944dbe920e6cacc2d266430811b325dad16233ca6849ecf8b28064f6` |
| `docs/ai-handoff/KJ-GEMINI-20261022-MARKET-RETENTION-003/evidence/browser-harness.mjs` | 26,717 | `191f8fd3fb89fbfc7fbc219afc15984d6dc7e66e26e35964227e18c8b7e455c7` |

### 2.3 Synthetic Fixtures, Frozen Retry Payload & Incremental Diff

| Artifact Path | Bytes | SHA-256 |
|---|---:|---|
| `docs/ai-handoff/KJ-GEMINI-20261022-MARKET-RETENTION-003/evidence/fixtures/batch1-ozon-same-batch.json` | 1,408 | `c8397a9da5c0710987adc748f3468ed593002014193844945c15ba10668434f6` |
| `docs/ai-handoff/KJ-GEMINI-20261022-MARKET-RETENTION-003/evidence/fixtures/batch2-ozon-same-batch.json` | 1,403 | `f06546c0598c878ba3d62b0339ce782d3e1edaa6523285acfcd170a4f614356c` |
| `docs/ai-handoff/KJ-GEMINI-20261022-MARKET-RETENTION-003/evidence/fixtures/frozen-retry-payload.json` | 12,536 | `b2e32d3bcb6d7b624f5207b7527ff06454e33b4c147a5ea31b29cae6154a2184` |
| `docs/ai-handoff/KJ-GEMINI-20261022-MARKET-RETENTION-003/evidence/incremental.diff` | 125,298 | `77b852b83b2e009c86fc9535eb9d0a9b3be224dc6501f8427c02178b679450cb` |

All read-only reference files (`ozon-react/src/utils/serverFiles.js`, `ozon-react/src/utils/persist.js`, `ozon-react/src/utils/marketReportRussiaContext.js`, `ozon-react/src/components/reports/RussiaMarketEntry.jsx`, `tests/market-report-quality.test.mjs`, `wordpress/kuajing-persistence/kuajing-persistence.php`) were verified bit-identical before and after edits (`BASELINE.json`).

---

## 3. Verification & Acceptance Evidence

1. **Automated Test & Build Commands** (`tests.json`):
   - `npm run test:market-retention` → **exit 0** (204 assertions passed across Scenarios 1–8)
   - `node ozon-react/src/utils/marketReportAnalysis.test.mjs` → **exit 0**
   - `npm run test:market` → **exit 0**
   - `node tests/report-integration.test.mjs` → **exit 0**
   - `node tests/market-report-quality.test.mjs` → **exit 0**
   - `node docs/ai-handoff/KJ-GEMINI-20261022-MARKET-RETENTION-003/evidence/browser-harness.mjs` → **exit 0**
   - `npm test` → **exit 0** (note: repeats `npm run test:market`; not counted as additional independent coverage)
   - `npm run test:golden` → **exit 0** (76/76 passed)
   - `npm run test:sync` → **exit 0** (0 drift)
   - `npm --prefix ozon-react run build` → **exit 0**
2. **Real Browser & Local Mock API Evidence** (`evidence/browser-request-payload-evidence.json`):
   - Two distinct synthetic batches uploaded with the exact same filename `ozon-same-batch.json` produced:
     - Batch 1: `source-c8397a9da5c0710987adc748f3468ed593002014193844945c15ba10668434f6.json` (1,408 bytes) and `uploaded-0e6ccf30-cba8-4ec7-9768-5f9d684ea82e.json` (`snapshot: "2026-09-05"`, `collectionDateOrigin: "user"`).
     - Batch 2: `source-f06546c0598c878ba3d62b0339ce782d3e1edaa6523285acfcd170a4f614356c.json` (1,403 bytes) and `uploaded-c42d3d0d-c7d7-4e6a-b26e-e4c1d08d7148.json` (`snapshot: null`, `collectionDateOrigin: "unknown"`, `collectionDateStatus: "not_evaluated"`).
   - Simulated `503` on Batch 2 report upload kept the UI in `pending-retry` state; clicking retry re-sent the exact frozen report filename `uploaded-c42d3d0d-c7d7-4e6a-b26e-e4c1d08d7148.json`, `publishedAt: "2026-10-26T02:06:48.568Z"`, and payload SHA-256 `b2e32d3bcb6d7b624f5207b7527ff06454e33b4c147a5ea31b29cae6154a2184`.
   - Desktop (`1366x900`) and narrow (`390x844`) screenshots saved in `docs/ai-handoff/KJ-GEMINI-20261022-MARKET-RETENTION-003/evidence/`:
     - `confirm-step-desktop-1366x900.png`, `confirm-step-narrow-390x844.png`
     - `pending-retry-desktop-1366x900.png`, `pending-retry-narrow-390x844.png`
     - `reloaded-revisions-desktop-1366x900.png`, `reloaded-revisions-narrow-390x844.png`
     - `duplicate-warning-desktop-1366x900.png`

---

## 4. Untested Boundaries & Remaining Shared-Queue / Reload Limitations

1. **Shared `serverFiles.js` IndexedDB Queue Behavior**:
   - Because `ozon-react/src/utils/serverFiles.js` is read-only under this task contract, `uploadServerFile(namespace, file)` always enqueues the `File` into IndexedDB (`kuajing-server-file-backups` / `pending-uploads`) and performs up to 2 internal flush attempts before throwing `'... is queued and will retry automatically.'`.
   - When a report upload fails both internal attempts and the operator later clicks `重试当前冻结版本` in the same session, `uploadServerFile` enqueues the frozen `reportUploadFile` and calls `flushQueuedServerFiles()`, which flushes both the earlier queued record and the retry record. Because both carry the exact same content-addressed filename `uploaded-<uuid>.json` and identical frozen JSON bytes, the server write is idempotent and produces only one revision.
2. **In-Memory `pendingAttempt` Across Hard Browser Reload**:
   - `pendingAttempt` (the UI retry banner state) is held in React component state inside `MarketReportCenter`. If the user performs a full page reload while a report upload is still in the failed/queued state, the interactive retry banner is not rehydrated from IndexedDB, although `listServerFiles('market-report-json')` on reload triggers `flushQueuedServerFiles()` in `serverFiles.js` to flush any queued IndexedDB uploads in the background before listing server files. Cross-reload/cross-device recoverable import state is scheduled for the subsequent task described in `TASK.md` ("After acceptance: recoverable imports across reload/devices and measured report loading").
3. **Production WordPress Endpoint Not Exercised**:
   - Per contract (`production_authorized=false`), all verification used local mock endpoints and synthetic fixtures; no requests were sent to production WordPress/Nginx.

---

## 5. Rollback Instructions (Dirty Baseline Safe)

To roll back **only** this task's incremental changes while preserving all pre-existing uncommitted work in the repository:

```powershell
# 1. Restore modified target files from pre-edit backups
Copy-Item "docs/ai-handoff/KJ-GEMINI-20261022-MARKET-RETENTION-003/evidence/target-backups/ozon-react__src__utils__marketReportAnalysis.js" "ozon-react/src/utils/marketReportAnalysis.js" -Force
Copy-Item "docs/ai-handoff/KJ-GEMINI-20261022-MARKET-RETENTION-003/evidence/target-backups/ozon-react__src__components__reports__MarketReportCenter.jsx" "ozon-react/src/components/reports/MarketReportCenter.jsx" -Force
Copy-Item "docs/ai-handoff/KJ-GEMINI-20261022-MARKET-RETENTION-003/evidence/target-backups/ozon-react__src__components__reports__UploadedMarketReport.jsx" "ozon-react/src/components/reports/UploadedMarketReport.jsx" -Force
Copy-Item "docs/ai-handoff/KJ-GEMINI-20261022-MARKET-RETENTION-003/evidence/target-backups/ozon-react__src__components__reports__MarketDecisionBrief.jsx" "ozon-react/src/components/reports/MarketDecisionBrief.jsx" -Force
Copy-Item "docs/ai-handoff/KJ-GEMINI-20261022-MARKET-RETENTION-003/evidence/target-backups/ozon-react__src__utils__marketReportAnalysis.test.mjs" "ozon-react/src/utils/marketReportAnalysis.test.mjs" -Force
Copy-Item "docs/ai-handoff/KJ-GEMINI-20261022-MARKET-RETENTION-003/evidence/target-backups/package.json" "package.json" -Force

# 2. Remove new files added by this task
Remove-Item "ozon-react/src/utils/marketReport/retentionContract.js" -Force
Remove-Item "ozon-react/src/utils/marketReport" -Force -ErrorAction SilentlyContinue
Remove-Item "ozon-react/src/components/reports/MarketReportImportConfirm.jsx" -Force
Remove-Item "tests/market-report-retention.test.mjs" -Force
```

Existing stored reports and source files remain readable by the old reader (`schemaVersion: 1` and additive `provenance` fields).
