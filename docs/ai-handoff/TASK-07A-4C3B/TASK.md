# KUAIJING-IA-REFACTOR-V1 · TASK 07A-4C3B
# Certification Applicability Implementation

## Task Metadata
- Task ID: `KUAIJING-IA-REFACTOR-V1-07A-4C3B`
- Status: `running`
- Assigned To: `Gemini`
- Contract Document: `docs/ia/TASK07A4C3A_CERTIFICATION_APPLICABILITY_CONTRACT.md` (Revision 5)
- Implementation Report: `docs/ia/TASK07A4C3B_CERTIFICATION_IMPLEMENTATION.md`

## Authorized Files
- `ozon-react/src/utils/t6/complianceProfile.js`
- `ozon-react/src/utils/t6/t6Store.js`
- `ozon-react/src/utils/t6/complianceDraftState.js`
- `ozon-react/src/utils/t6/gateEngine.js`
- `ozon-react/src/components/t6/ProjectDetailPage.jsx`
- `ozon-react/src/components/t6/ProjectCompliancePanel.jsx`
- `tests/ia-certification-applicability.test.mjs` (new test suite)
- `tests/ia-project-compliance*.test.mjs` (test maintenance)

## Implementation Scope
1. Domain whitelist & normalization in `complianceProfile.js`
2. Store initialization & atomic patch handling in `t6Store.js`
3. Draft state functions in `complianceDraftState.js`
4. Gate 12-row truth table & legacy warnings in `gateEngine.js`
5. Detail page fact extraction in `ProjectDetailPage.jsx`
6. UI Layer A field display & clean patch dispatch in `ProjectCompliancePanel.jsx`
7. Comprehensive testing of 13 acceptance matrix scenarios and regression tests.
