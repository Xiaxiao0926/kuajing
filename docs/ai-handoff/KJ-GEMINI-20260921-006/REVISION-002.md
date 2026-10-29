# 006 Revision 002: close the remaining evidence gaps

Status: revision_required, available for Gemini claim through CURRENT_TASK.json.
Read REVIEW-REVISION-001.md first. Production code remains read-only. Keep the existing 28-file BASELINE and all prior evidence, including Codex review runners. Do not restart the general audit or create another task.

## Four bounded deliverables

1. **Retry payload, not just list visibility.** With synthetic input 115 and scenario-save failure, snapshot projects/scenarios/logs before and after failure; assert no unintended entity writes. Remove the fault and retry WITHOUT changing tab, then separately test the original overview-return route. Compare actual saved purchaseCost in both. Record the latter's current fallback to 65 as issues_found. For standalone quota failure also compare storage, visible feedback and recovery write; do not call an uncaught pageerror graceful handling.
2. **Open-context project switching.** Reuse A/B fixtures and test Ozon plus WB with calculator open under a stable parent key. Compare displayed price/weight/cost, confirmation state, persisted input, destination project and sourceSnapshotId. Preserve UI-required confirmation. Distinguish fresh open, list-only props switch and open-calculator props switch. Inspect App mounting and navigation: it supplies no project key. If an actual user navigation path for direct same-instance switching is absent, explicitly label that probe synthetic rather than inventing one. No full App harness is required just to close this boundary.
3. **Project WB controls and trace.** In the real ProjectDetailPage project mode, repeat only template save, synthetic CSV import/delete and tariff reset. Capture expected shared keys and unchanged B project/scenarios/snapshots. Keep seed records separate. Export complete scoped before/after snapshots and attempted failed T6 writes. Never modify real settings or business files.
4. **Honest error handling and reports.** Export console/page errors with scenario context. Unexpected errors must invalidate the scenario. Known duplicate-key warnings may be narrowly classified and tracked, not globally ignored. Tighten fault detection to the exact R4 assertion and injected record. Sync FINDINGS/WRITE_MATRIX/tests with observed paths; remove blanket isolation and 'key-based real routing' claims. Keep unknown-cost handling and shared-tool ownership as proposals, not implementation authority.

## Acceptance and scope

- Correctly reproducing an existing defect is successful audit execution with business_verdict=issues_found; it is not a demand to fix source before audit acceptance.
- Separate normal/fault evidence directories. Include command, actual exit code, checked values and any not_run boundary.
- Preserve prior RESULT/tests and copy pre-edit task scripts/reports into a revision backup directory before editing your own files. No edits to Codex evidence, AGENTS, source, config, existing tests, dist, data or other tasks.
- Do not rerun unchanged broad suites or add dependencies. Use CODEX_NODE_MODULES for runtime paths; remove machine-specific fallback literals from new/modified task scripts.
- Recheck 28 source/test hashes at start/end. If drift occurs, report it and do not restore someone else's work.
- Deliver RESULT-REVISION-002.md, tests-revision-002.json, updated findings/matrix and evidence. Set task/pointer to review_ready only after real completion. No production access, deployment, credentials, formula changes or data migrations.

Rollback: remove/revert only your own task-local changes using the captured copies; preserve existing work and every prior evidence directory. This task has no production rollback action.
