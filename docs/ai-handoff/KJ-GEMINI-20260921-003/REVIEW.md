# Codex independent review: 003

Date: 2026-09-21
Verdict: **revision_required** (document contract only)
Reviewed input SHA256: `c708168bd966454744275b0edf404d1bac7e7483e677d2571561aeeae1676642`

This review concerns the archived 003 delivery, not the active 006 revision. No implementation or deployment is authorized. The executor's static checklist does not constitute independent acceptance.

## Findings

1. **P1: Missing and invalid applicability values have conflicting gate outcomes.** Contract section 9.1, row 2 (original line 379), uses `!fact.certificationApplicability`. This matches absent, null, empty string, false and zero, although row 8 requires invalid values to fail. Section 11 unconditionally injects the property, while `isProjectComplianceEmpty` can prevent an empty/invalid-only profile from being evaluated. Section 10.3 also normalizes values with `|| ''`, losing presence distinctions during draft/conflict comparison. Specify presence and raw-value semantics consistently through profile, facts, gate, draft baseline and logs. Missing historical fields may remain NOT_EVALUATED; explicitly present invalid values must not use that compatibility branch.

2. **P1: The proposed initialization still changes historical empty profiles.** Section 7.3 selects `buildInitialComplianceDraft()` via `isProjectComplianceEmpty(current)`. That helper cannot distinguish a newly created project from a historical missing, empty or all-empty compliance object. Adding UNASSESSED to the shared initializer can therefore inject it during an unrelated notes/plan/requirement operation. The statement at original line 390 about upgrading old projects on open/save also conflicts with preservation requirements. Define an explicit creation boundary or explicit Layer A edit; never infer newness from emptiness. This is a defect in the proposed contract, not evidence that the new fields are already deployed.

3. **P1: The justification fact has two names.** Decision rows 6/7 use `applicabilityNotesPresent` (original lines 383-384); section 11 and the fact whitelist use `certificationApplicabilityNotesPresent` (456/487). An implementation following both would reject a valid NOT_REQUIRED decision. Freeze one name and its boolean/type/trim semantics across every example and test.

4. **P2: Legal claims and acceptance wording exceed the evidence.** Original line 61 asserts that particular laser/battery examples necessarily require certification; line 94 equates exemptReason with an exemption letter number. These are not established by this software audit. Replace them with neutral internal assessment terminology. A minimum note length is a formatting condition, not proof of legal sufficiency. Preserve the existing reasoned RED/YELLOW override policy; do not describe RED as unconditionally unoverrideable. The final self-issued APPROVED verdict must not authorize 07A-4C3B.

## Evidence and limits

- Inspected the contract and existing complianceProfile, t6Store, gateEngine, stageTransition and complianceDraftState paths.
- Evaluated the proposed falsy predicate locally: missing/null/empty/false/zero all match. This is a contract-expression counterexample, not a production gate test.
- Compared all 28 frozen files in 006/BASELINE.json: zero mismatches before this document-only review update.
- No runtime acceptance suite, production request, migration or business-code edit was performed for this review.

## Disposition

003 is revision_required. Follow REVISION-001.md only after explicit activation; dispatch is deferred while 006 remains the active task. Leave CURRENT_TASK.json and 006 files untouched. Existing RESULT.md and tests.json remain executor records, not acceptance evidence.
