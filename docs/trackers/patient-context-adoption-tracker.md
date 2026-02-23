# Patient Context Service Adoption Tracker

> **Goal:** Migrate ad-hoc patient data queries to the canonical `patientContextService` for ATLUS Unity + Accountability compliance.
>
> **Estimated effort:** 12-16 hours across 3 sessions
>
> **Started:** 2026-02-22

---

## Phase 0: Fix fetchTimeline.ts table/column bug (Prerequisite)

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 0.1 | Change `daily_check_ins` -> `check_ins`, fix column names | `src/services/patient-context/fetchTimeline.ts` | DONE |
| 0.2 | Update `CheckInRow` type to match `check_ins` schema | `src/services/patient-context/types.ts` | DONE |
| 0.3 | Fix same table name bug in welfareCheckDispatcher | `src/services/ai/welfareCheckDispatcher.ts` | DONE |
| 0.4 | Fix same table name bug in emergencyAccessIntelligence | `src/services/ai/emergencyAccessIntelligence.ts` | DONE |
| 0.5 | Update tests for timeline + orchestrator | `__tests__/fetchTimeline.test.ts`, `__tests__/PatientContextService.test.ts` | DONE |

**Session 1 result:** 5/5 complete. All 38 patient-context tests pass.

---

## Phase 1: Add self_reports section to patientContextService

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1.1 | Add `SelfReportEntry`, `SelfReportSummary` types | `src/types/patientContext.ts` | DONE |
| 1.2 | Add `includeSelfReports`, `maxSelfReports` options | `src/types/patientContext.ts` | DONE |
| 1.3 | Add `self_reports` field to `PatientContext` interface | `src/types/patientContext.ts` | DONE |
| 1.4 | Create `fetchSelfReports.ts` module | `src/services/patient-context/fetchSelfReports.ts` (NEW) | DONE |
| 1.5 | Wire `fetchSelfReports` into `PatientContextService.ts` Promise.all | `src/services/patient-context/PatientContextService.ts` | DONE |
| 1.6 | Update barrel export | `src/services/patient-context/index.ts` | DONE |
| 1.7 | Add `self_reports` mock to orchestrator test | `__tests__/PatientContextService.test.ts` | DONE |
| 1.8 | Create `fetchSelfReports.test.ts` (7 tests) | `__tests__/fetchSelfReports.test.ts` (NEW) | DONE |

**Session 1 result:** 8/8 complete. 51 patient-context tests pass (up from 38).

---

## Phase 2: Add batch demographics method

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 2.1 | Add `getBatchDemographics()` method (max 500, single IN query) | `src/services/patient-context/PatientContextService.ts` | DONE |
| 2.2 | Add 6 tests for batch method | `__tests__/PatientContextService.test.ts` | DONE |

**Session 1 result:** 2/2 complete. File at 316 lines (under 600 limit).

---

## Phase 3: Migrate data-fetching.ts (CRITICAL)

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 3.1 | Replace `fetchComprehensivePatientData()` with `getPatientContext()` call + adapter | `src/components/admin/enhanced-fhir/data-fetching.ts` | DONE |
| 3.2 | Replace `fetchPopulationData()` to use parallel `getPatientContext()` calls | `src/components/admin/enhanced-fhir/data-fetching.ts` | DONE |
| 3.3 | Verify downstream consumers unchanged (adapter preserves shape) | `EnhancedFhirServiceClass`, `clinical-decision-support`, `population-analytics` | DONE |
| 3.4 | Write 18 tests (cache, adapter, delegation, edge cases) | `__tests__/data-fetching.test.ts` (NEW) | DONE |
| 3.5 | Fix `fetchRecentCheckIns` SELECT * → explicit columns | `data-fetching.ts` | DONE |

**Session 2 result:** 5/5 complete. Adapter pattern ensures zero breaking changes. `supabaseClient` param retained for API compat but unused by `fetchComprehensivePatientData` (delegates to patientContextService). `fetchRecentCheckIns` intentionally NOT migrated (time-window query across all patients, per CLAUDE.md exception).

---

## Phase 4: Migrate DoctorsViewPage (CRITICAL)

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 4.1 | Extract data-fetching hook using `patientContextService` | `src/pages/DoctorsView/useDoctorsViewData.ts` (NEW) | DONE |
| 4.2 | Replace direct `self_reports` query with patientContextService | `src/pages/DoctorsView/useDoctorsViewData.ts` | DONE |
| 4.3 | Keep check-in + community engagement queries direct (per CLAUDE.md) | `src/pages/DoctorsView/useDoctorsViewData.ts` | DONE |
| 4.4 | Decompose 800-line file into 8 focused modules | `src/pages/DoctorsView/` (8 files, largest 368 lines) | DONE |
| 4.5 | Write 23 tests (hook + vitalUtils) | `src/pages/DoctorsView/__tests__/useDoctorsViewData.test.ts` | DONE |

**Session 2 result:** 5/5 complete. Old 800-line `DoctorsViewPage.tsx` decomposed into 8 files under `src/pages/DoctorsView/` (largest: 368 lines). `self_reports` query migrated to patientContextService. Check-in query kept direct (needs raw vital fields). Community engagement queries kept direct (aggregate queries). Lazy import updated in `lazyComponents.tsx`.

---

## Phase 5: Migrate MPIReviewQueue

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 5.1 | Replace 12-field profile fetch with `getBatchDemographics()` | `src/components/admin/mpi-review/MPIReviewQueue.tsx` | DONE |
| 5.2 | Lazy-load address/email on expand for detailed comparison | `src/components/admin/mpi-review/MPIReviewQueue.tsx` | DONE |
| 5.3 | Decompose 697-line file into 4 focused modules (under 600 limit) | `src/components/admin/mpi-review/` (4 files, largest 493 lines) | DONE |

**Session 3 result:** 3/3 complete. N+1 profile queries replaced with single `getBatchDemographics()` call. Address/city/state/zip/email lazy-loaded on expand via direct narrow query (5 fields, 2 patients). File decomposed from 697 → 4 modules (largest: 493 lines). Old `MPIReviewQueue.tsx` is now a barrel re-export.

---

## Phase 6: Final tests & verification

| # | Task | Status |
|---|------|--------|
| 6.1 | Verify all patient-context tests pass (93 tests) | DONE |
| 6.2 | Full suite: typecheck + lint + tests | DONE |
| 6.3 | Update PROJECT_STATE.md | DONE |

---

## Documented Exceptions (Keep as direct queries)

| File | Reason |
|------|--------|
| `PatientMergeWizard.tsx` | 21-field raw profile for field-by-field merge comparison |
| `mpiMergeService.ts` | 5-table clinical snapshot for rollback (write-path backup) |
| 8 Category A files | Single-field lookups (counts, role checks, existence checks) |

---

## Session Log

| Session | Date | Phases | Tests Before | Tests After | Result |
|---------|------|--------|-------------|-------------|--------|
| 1 | 2026-02-22 | 0 + 1 + 2 | 8,415 | 8,665 | typecheck 0, lint 0, 8,665 pass |
| 2 | 2026-02-22 | 3 + 4 | 8,665 | 8,706 | typecheck 0, lint 0, 8,706 pass |
| 3 | 2026-02-23 | 5 + 6 | 8,706 | 8,706 | typecheck 0, lint 0, 8,706 pass |
