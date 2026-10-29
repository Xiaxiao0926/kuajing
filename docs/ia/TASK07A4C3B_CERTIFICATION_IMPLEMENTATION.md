# KUAIJING-IA-REFACTOR-V1 · TASK 07A-4C3B
# Certification Applicability Implementation Report

- **Task ID**: `KUAIJING-IA-REFACTOR-V1-07A-4C3B`
- **Execution Date**: 2026-09-24
- **Model**: Gemini
- **Status**: `review_ready`
- **Reference Contract**: `docs/ia/TASK07A4C3A_CERTIFICATION_APPLICABILITY_CONTRACT.md` (Revision 5, Frozen)
- **Handoff Tracking**: `docs/ai-handoff/CURRENT_TASK.json` & `docs/ai-handoff/TASK-07A-4C3B/STATUS.json`

---

## 1. Baseline and Modified Files

### 1.1 Baseline Verification
Before writing any code, the working directory git status was audited. Pre-existing uncommitted modifications (including notice placement and breaking style decoupling in `ProjectDetailPage.jsx`) were preserved without rollbacks.

### 1.2 Authorized Production Files (Exactly 6 Files)
| # | File Path | Scope of Changes |
|---|---|---|
| 1 | `ozon-react/src/utils/t6/complianceProfile.js` | Added `COMPLIANCE_CERTIFICATION_APPLICABILITY` enum; expanded `PROJECT_COMPLIANCE_FIELDS` (8) & `PROFILE_PATCH_ALLOWED_FIELDS` (7); updated `isProjectComplianceEmpty` to check `'certificationApplicability' in compliance`; refactored `buildNextProjectCompliance` to merge directly onto `current` without implicit draft injection, validate `NOT_REQUIRED` notes (trim length >= 2), reject explicit `undefined` patch keys, and execute atomic fail-close validation. |
| 2 | `ozon-react/src/utils/t6/t6Store.js` | Re-exported `COMPLIANCE_CERTIFICATION_APPLICABILITY`; updated `createProject()` to initialize `compliance: { certificationApplicability: 'UNASSESSED' }` without `assessmentStatus`; updated `updateProjectCompliance()` to include 7 profile fields in diff computation and record missing baseline fields as `null`; removed `buildInitialComplianceDraft()` merge in `createProjectComplianceRequirement()`. |
| 3 | `ozon-react/src/utils/t6/complianceDraftState.js` | Updated `extractAssessmentState` to preserve raw/undefined applicability; updated `isAssessmentDirty` and `isAssessmentEqual` to monitor `certificationApplicability` and `certificationApplicabilityNotes`. |
| 4 | `ozon-react/src/utils/t6/gateEngine.js` | Activated explicit `cert_plan` evaluator labeled `'认证处理路径已明确'`, implementing the complete 12-row truth table and legacy warning message. |
| 5 | `ozon-react/src/components/t6/ProjectDetailPage.jsx` | Injected `complianceFact` containing `evaluated`, `assessmentStatus`, `certificationApplicability`, `certificationApplicabilityNotesPresent`, `certificationPlanPresent`; preserved shared `notice` banner and layout intact. |
| 6 | `ozon-react/src/components/t6/ProjectCompliancePanel.jsx` | Rendered Applicability badge in header; rendered Applicability dropdown in Layer A (displaying "未记录" when undefined); rendered Justification Notes textarea when `NOT_REQUIRED`; wired discard/sync/reset logic; clean patch dispatching on save. |

### 1.3 Test and Documentation Deliverables
- `tests/ia-certification-applicability.test.mjs` (New test suite, 13 matrix scenarios + 12 truth table rows)
- `tests/ia-project-compliance.test.mjs` (Test maintenance for 8 whitelist fields, new project initial state, and diff structure)
- `tests/ia-project-compliance-gate.test.mjs` (Test maintenance for active `cert_plan` evaluator and `complianceFact` shape)
- `tests/ia-project-compliance-draft.test.mjs` (Test maintenance for plan pre-save array boundary)
- `docs/ia/TASK07A4C3B_CERTIFICATION_IMPLEMENTATION.md` (This document)

---

## 2. New Project Initialization

In `t6Store.js`, `createProject()` initializes new projects with:
```javascript
compliance: {
  certificationApplicability: COMPLIANCE_CERTIFICATION_APPLICABILITY.UNASSESSED, // 'UNASSESSED'
}
```
- **Explicit Omission of `assessmentStatus`**: `assessmentStatus` is NOT set at creation time.
- **Initial Stage Gate Evaluation**:
  - `compliance_pending`: **FAIL** (`assessmentStatus` undefined / invalid)
  - `compliance_done`: **FAIL** (`assessmentStatus` not `COMPLETED`)
  - `cert_plan`: **FAIL** (`certificationApplicability === 'UNASSESSED'`)
- Verified by Matrix Scenario 1 in `tests/ia-certification-applicability.test.mjs`.

---

## 3. Legacy Project Compatibility

- **Zero Migration**: Historical projects with `compliance: {}` or missing `certificationApplicability` remain untouched in storage. No automatic migration script or on-load mutation is executed.
- **Safe Reading**: When `certificationApplicability` is absent or undefined:
  - UI displays `"未记录"` in the dropdown and does not pre-select `UNASSESSED`.
  - Gate evaluates `cert_plan` to `NOT_EVALUATED` and outputs the legacy warning:
    `"该项目尚未记录认证适用性，目前该项采用兼容处理，不代表认证判断已经完成。"`
- **Immutable Unrelated Fields**: Operations saving notes, plans, or requirements do NOT inject missing applicability fields into historical projects.
- Verified by Matrix Scenarios 5, 6, 7 in `tests/ia-certification-applicability.test.mjs`.

---

## 4. Explicit Assessment Creation

- **Elimination of Implicit Assessment**:
  - `buildNextProjectCompliance(current, patch)` no longer falls back to `buildInitialComplianceDraft()` when `current` is empty. It merges `patch` directly onto `current`.
  - `createProjectComplianceRequirement()` no longer calls `buildInitialComplianceDraft()` to populate initial compliance. It preserves `project.compliance` as-is.
  - Updating `notes` on a new project does NOT inject `assessmentStatus: 'NOT_STARTED'`.
  - Adding, updating, or deleting Requirements does NOT inject `assessmentStatus`.
- **First Explicit Assessment Save**:
  - When the user explicitly selects an `assessmentStatus` (e.g. `NOT_STARTED` or `IN_ASSESSMENT`) and saves Assessment, `certificationApplicability: 'UNASSESSED'` is strictly preserved and not overwritten.
- Verified by Matrix Scenarios 2, 3, 4 in `tests/ia-certification-applicability.test.mjs`.

---

## 5. Profile and Store Whitelists

The three whitelist locations have been synchronized to exactly match:
1. `PROJECT_COMPLIANCE_FIELDS` (8 items) in `complianceProfile.js`:
   `['assessmentStatus', 'riskLevel', 'applicableStandards', 'certificationPlan', 'notes', 'requirements', 'certificationApplicability', 'certificationApplicabilityNotes']`
2. `PROFILE_PATCH_ALLOWED_FIELDS` (7 items) in `complianceProfile.js`:
   `['assessmentStatus', 'riskLevel', 'applicableStandards', 'certificationPlan', 'notes', 'certificationApplicability', 'certificationApplicabilityNotes']`
3. `PROFILE_FIELDS` (7 items) in `t6Store.js`:
   `['assessmentStatus', 'riskLevel', 'applicableStandards', 'certificationPlan', 'notes', 'certificationApplicability', 'certificationApplicabilityNotes']`

`requirements` remains strictly excluded from top-level patch updates and is managed solely via dedicated CRUD methods (`createProjectComplianceRequirement`, `updateProjectComplianceRequirement`, `removeProjectComplianceRequirement`).

---

## 6. Atomic Save and DecisionLog

In `complianceProfile.js` (`buildNextProjectCompliance`) and `t6Store.js` (`updateProjectCompliance`):
1. **Validation of `NOT_REQUIRED`**:
   If `candidate.certificationApplicability === 'NOT_REQUIRED'`, `candidate.certificationApplicabilityNotes` must be a string with `trim().length >= 2`. If invalid or empty, the entire update throws an Error.
2. **Explicit `undefined` Patch Keys**:
   If `patch` contains a key whose value is explicitly `undefined`, it is rejected with an Error.
3. **Historical Corrupted Values**:
   If an existing profile has `certificationApplicability: null` or an invalid enum string, any partial patch (such as updating only `notes`) validates the final merged state and is rejected fail-close. However, a patch that explicitly provides a valid `certificationApplicability` heals the invalid state and succeeds atomically.
4. **Zero-Write & Zero-Log on Error**:
   Any validation failure aborts before `write()` and before `appendLog()`.
5. **Idempotent No-Op**:
   If the normalized values of all fields match the existing store values, the operation returns `project` immediately without writing to disk or appending to `DecisionLog`.
6. **Audited Diff**:
   When writing changes, `fromDiff[f]` records previously undefined fields as `null` (not default strings), providing an honest audit log.
- Verified by Matrix Scenarios 8, 9, 10 in `tests/ia-certification-applicability.test.mjs`.

---

## 7. Assessment UI and Draft Lifecycle

In `ProjectCompliancePanel.jsx`:
- **Visual Presentation**:
  - An Applicability Badge is rendered in the Panel header next to Assessment Status and Risk Level.
  - In Layer A (Assessment Area), a dedicated select dropdown allows choosing among `未记录` (when undefined), `尚未判断 (UNASSESSED)`, `需要办理认证 (REQUIRED)`, `无需办理认证 (NOT_REQUIRED)`.
  - When `NOT_REQUIRED` is selected, a required textarea prompts for `判断依据 (必填，至少2字)`.
- **Minimal Clean Patch**:
  - `handleSaveAssessment()` inspects user intent. If applicability was not modified by the user, the two new fields are omitted from the patch.
  - Notes-only save does not send applicability fields.
  - Plan save and Requirement CRUD never send applicability fields.
- **Draft Lifecycle**:
  - Project switching properly resets draft state and discards dirty flags.
  - Unsaved inputs never leak to Stage Gate facts.
  - Saving successfully writes back normalized server state.
  - Validation errors preserve user input and display inline error alerts.

---

## 8. cert_plan Gate Implementation

In `gateEngine.js`, `cert_plan` check was activated with label `'认证处理路径已明确'`:
- Fact contract injected by `ProjectDetailPage.jsx`:
  ```javascript
  availableModules.compliance = {
    evaluated: true,
    assessmentStatus: project.compliance?.assessmentStatus,
    certificationApplicability: project.compliance?.certificationApplicability,
    certificationApplicabilityNotesPresent: Boolean(
      typeof project.compliance?.certificationApplicabilityNotes === 'string' &&
      project.compliance.certificationApplicabilityNotes.trim().length >= 2
    ),
    certificationPlanPresent: Boolean(
      typeof project.compliance?.certificationPlan === 'string' &&
      project.compliance.certificationPlan.trim() !== ''
    ),
  }
  ```
- Evaluator reads strictly from `ctx.availableModules.compliance`, performing pure domain evaluation without direct access to Store, MI, or localStorage.

---

## 9. Twelve-case Truth Table

The 12 rows specified in Revision 5 Contract §9.1 are fully implemented and verified:

| Row | Module Fact | Applicability | Plan | Notes | Gate Result | Message Content |
|---|---|---|---|---|---|---|
| 1 | None / Unevaluated | Any | Any | Any | `NOT_EVALUATED` | `'合规数据域尚未接入'` |
| 2 | `evaluated: true` | Missing / undefined | Any | Any | `NOT_EVALUATED` | `'该项目尚未记录认证适用性，目前该项采用兼容处理，不代表认证判断已经完成。'` |
| 3 | `evaluated: true` | `UNASSESSED` | False | Any | `FAIL` | `'认证适用性尚未判断，请在合规面板确认'` |
| 4 | `evaluated: true` | `UNASSESSED` | True | Any | `FAIL` | `'认证适用性尚未判断，请在合规面板确认'` |
| 5 | `evaluated: true` | `REQUIRED` | False | Any | `FAIL` | `'商品需要办理认证，但尚未制定认证处理计划'` |
| 6 | `evaluated: true` | `REQUIRED` | True | Any | `PASS` | `'认证处理路径已明确'` |
| 7 | `evaluated: true` | `NOT_REQUIRED` | Any | False | `FAIL` | `'判定无需认证时必须填写判断依据'` |
| 8 | `evaluated: true` | `NOT_REQUIRED` | Any | True | `PASS` | `'已明确判定无需办理认证（依据已留存）'` |
| 9 | `evaluated: true` | `null` | Any | Any | `FAIL` | `'认证适用性状态无效（Fail-close）'` |
| 10 | `evaluated: true` | `''` (empty string) | Any | Any | `FAIL` | `'认证适用性状态无效（Fail-close）'` |
| 11 | `evaluated: true` | `EXEMPT` (illegal) | Any | Any | `FAIL` | `'认证适用性状态无效（Fail-close）'` |
| 12 | `evaluated: true` | Unknown enum | Any | Any | `FAIL` | `'认证适用性状态无效（Fail-close）'` |

Verified 100% by truth table assertions in `tests/ia-certification-applicability.test.mjs`.

---

## 10. Cross-stage Gate Results

- **Aggregate Priority**: Evaluated stage paths strictly adhere to `RED > YELLOW > NOT_EVALUATED > GREEN`.
  - When `cert_plan` is `FAIL`, the composite verdict is `RED`.
  - When all other requirements pass and `cert_plan` is `NOT_EVALUATED` (legacy compatible), the composite verdict is `NOT_EVALUATED`, permitting forward progression without requiring an override reason.
  - When `cert_plan` is `PASS` and other checks pass, the verdict is `GREEN`.
- **Single Source of Truth**: Both `evaluateProjectGate` (preview) and `transitionProjectStage` (execution) in `ProjectDetailPage.jsx` consume the exact same `gateDeps`.

---

## 11. Legacy Warning

When `cert_plan` evaluates a legacy project where `certificationApplicability` is missing or undefined:
- Evaluator returns `result: NOT_EVALUATED` with warning message:
  `"该项目尚未记录认证适用性，目前该项采用兼容处理，不代表认证判断已经完成。"`
- Explicit corrupted values (`null`, `''`, `'EXEMPT'`, unknown strings) never trigger this compatibility warning; they immediately fail-close to `result: FAIL` with an invalid status error.

---

## 12. Candidate and Snapshot Regression

- **Candidate -> Project Launch**: The launch flows for both `SCORING` and `MARKET_VALIDATION` candidate types use `createProject()` and correctly initialize `{ certificationApplicability: 'UNASSESSED' }`.
- **Snapshot Immutability**: Neither candidate launches nor compliance saves mutate frozen snapshots or `latestSnapshotId`.
- Verified by:
  - `node tests/ia-candidate-project-launch.test.mjs` (20 passed)
  - `node tests/ia-dual-snapshot-project-gate.test.mjs` (19 passed)

---

## 13. Component / Browser Verification

- **Draft State Logic**: `complianceDraftState.js` tested for extraction, dirty detection, and equality comparison with both new fields.
- **UI Interaction & Notice Isolation**: Verified via `tests/ia-project-notice.test.mjs` and `tests/ia-project-compliance-draft.test.mjs` unit and static contract assertions.
- **Headless Browser Execution**: `CODEX_NODE_MODULES` environment variable is not configured on this machine, so Playwright browser rendering is recorded as `NOT_RUN` (static layout and DOM contracts passed).

---

## 14. Full Regression and Build Verification

All regression test suites were executed on 2026-09-24 with genuine terminal outputs:

| Test Command / Suite | Tests Run | Result | Notes |
|---|---|---|---|
| `node tests/ia-certification-applicability.test.mjs` | 13 Scenarios + 12 Truth Table Rows | **PASS** | 100% green |
| `node tests/ia-project-compliance.test.mjs` | 32 test groups | **PASS** | All passed |
| `node tests/ia-project-compliance-gate.test.mjs` | 49 tests | **PASS** | All passed |
| `node tests/ia-project-compliance-draft.test.mjs` | Unit & static suites | **PASS** | Headless browser marked `NOT_RUN` |
| `node tests/ia-project-notice.test.mjs` | Notice isolation suite | **PASS** | All passed |
| `node tests/ia-candidate-project-launch.test.mjs` | 20 tests + E2E | **PASS** | All passed |
| `node tests/ia-dual-snapshot-project-gate.test.mjs` | 19 tests | **PASS** | All passed |
| `node tests/ia-project-supply-gate.test.mjs` | 24 tests | **PASS** | All passed |
| `node tests/ia-project-product-profile.test.mjs` | 43 tests | **PASS** | All passed |
| `npm run test:t6` | 130 tests | **PASS** | 53 WB + 26 UI + 43 T7-1 + 8 Candidate |
| `npm test` | 165 tests | **PASS** | 65 wbEngine + 56 scoring golden + 44 python wb |
| `npm run test:golden` | 76 tests | **PASS** | 76 golden business cases |
| `npm run test:sync` | 18 boundary cases | **PASS** | 0 diff |
| `npm run test:web-persistence` | 6 suites | **PASS** | All passed |
| `npm --prefix ozon-react run build` | Vite build | **PASS** | Built in 8.64s, 0 errors |

---

## 15. Git Status

- **Working Directory**: Verified against `git status`.
- **Scope Compliance**: Exactly the 6 authorized files were modified.
- **Non-Destructive Execution**: No unrelated files were touched, reverted, or reset.
- **Untracked Additions**: `tests/ia-certification-applicability.test.mjs` and `docs/ia/TASK07A4C3B_CERTIFICATION_IMPLEMENTATION.md`.

---

## 16. Remaining Risks and Next Steps

1. **Browser Visual Testing**: Responsive layout in a real browser under full CSS rendering remains `NOT_RUN` and requires Codex independent acceptance verification.
2. **Result Layer Deferred**: Certificate file upload, tracking numbers, and compliance validity expiry dates remain strictly out of scope for 07A and await future roadmap tasks.
3. **No Automatic Transition**: System stops here and awaits independent audit and review before moving to subsequent tasks.
