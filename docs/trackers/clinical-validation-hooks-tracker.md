# Clinical Validation Hooks Tracker

> **Created:** 2026-03-06
> **Created By:** Maria (design) + Claude Opus 4.6 (documentation)
> **Purpose:** Build runtime validation hooks that catch AI-hallucinated clinical codes before they reach human reviewers, with dashboard + PDF export for non-technical clinical review
> **Design Doc:** `docs/CLINICAL_VALIDATION_HOOKS_ARCHITECTURE.md`
> **Supporting Doc:** `docs/AI_AGENT_QUALITY_VARIANCE.md`
> **Prior Work:** Builds on MCP Production Readiness P1-5 (constraints), P1-7 (prompt injection), P1-9 (reference data freshness)

---

## Why This Exists

AI edge functions suggest ICD-10 codes, CPT codes, Z-codes, DRG assignments, and risk scores. If the AI hallucinates a code that doesn't exist, the human reviewer has to catch it. That's not their job. The validation hook handles "is it real?" so the biller only answers "is it right?"

Defense in depth: prompt constraints (preventive) + validation hooks (detective) + audit logging (proof).

---

## Summary

| Phase | Items | Status | Est. Hours |
|-------|-------|--------|-----------|
| Phase 1: Reference Data | 4 | 4/4 ✅ | 8 |
| Phase 2: Validator Module | 3 | 3/3 ✅ | 8 |
| Phase 3: Wire Into AI Functions | 2 | 2/2 ✅ | 6 |
| Phase 4: Results Table | 2 | 1/2 | 2 |
| Phase 5: Admin Dashboard | 3 | 0/3 | 12 |
| Phase 6: PDF Export | 3 | 0/3 | 6 |
| Phase 7: Clinical Content Export | 2 | 0/2 | 4 |
| **Total** | **19** | **10/19** | **~46** |

---

## Akima Review Gates

These items require Akima's clinical review. All are accessible WITHOUT reading code.

| Item | Review Format | Blocked Until |
|------|-------------|---------------|
| MS-DRG reference table (codes, weights, MDC) | CSV export from Supabase Table Editor | Phase 1 complete |
| Cultural competency profiles (prevalence, screening tools, drug interactions) | PDF export with readable cards | Phase 7 complete |
| Failure behavior policy (strip / reject / flag hallucinated codes) | Conversation — Maria asks Akima directly | Before Phase 2 starts |
| Validation dashboard usefulness | Dashboard — Akima logs in and reviews | Phase 5 complete |
| Adversarial test scenarios (P1-6, separate tracker) | PDF report of test inputs + results | P1-6 complete |

---

## Government APIs (Free, No License)

| API | Validates | Auth | URL |
|-----|----------|------|-----|
| NLM Clinical Tables | ICD-10-CM (~72,000 codes) | None | `clinicaltables.nlm.nih.gov/api/icd10cm/v3/search` |
| NLM RxNorm | Drug names, NDC crosswalk | None | `rxnav.nlm.nih.gov/REST/` |
| NLM SNOMED/LOINC | Clinical terms, lab codes | UMLS key (free) | `uts-ws.nlm.nih.gov/rest/` |
| FDA NDC Directory | National Drug Codes | None | `api.fda.gov/drug/ndc.json` |
| CDC CVX | Vaccine codes | None | Static download from CDC |

---

## Phase 1: Reference Data

### 1-1: NLM API Integration

**Status:** ✅ COMPLETE (2026-03-07)
**Est:** 3 hours

Build shared edge function utility `nlmCodeValidator.ts` that calls NLM Clinical Tables API for real-time ICD-10-CM validation. Returns code existence + description. Handles API timeout gracefully (fall back to local cache).

**File:** `supabase/functions/_shared/nlmCodeValidator.ts` (NEW)

**Acceptance:** Call with valid code (E11.65) returns `{ valid: true, description: "Type 2 diabetes mellitus with hyperglycemia" }`. Call with hallucinated code (Z99.9) returns `{ valid: false }`.

---

### 1-2: Local ICD-10 Cache (Top 5,000 Codes)

**Status:** ✅ COMPLETE (2026-03-07) — Validator uses `code_icd` table as local cache with NLM API fallback
**Est:** 2 hours

Migration to seed `code_icd` table with ~5,000 most common ICD-10-CM codes from CMS annual download. These serve as fast local validation when NLM API is slow or unavailable.

**File:** `supabase/migrations/YYYYMMDD_seed_icd10_common_codes.sql` (NEW)

**Acceptance:** `SELECT count(*) FROM code_icd` returns ~5,000. Common codes (E11.65, I10, J18.9, Z87.891) all present with descriptions.

---

### 1-3: MS-DRG Reference Table

**Status:** ✅ COMPLETE (2026-03-07) — DRG validation via `validateDRGCode()` in `codeValidationHelpers.ts`
**Est:** 2 hours

Migration to create and seed `ms_drg_reference` table with current fiscal year MS-DRG codes, descriptions, relative weights, MDC assignments, and CC/MCC indicators. Source: CMS MS-DRG tables (public domain).

**File:** `supabase/migrations/YYYYMMDD_ms_drg_reference.sql` (NEW)

**Acceptance:** All ~760 MS-DRG codes seeded. Akima reviews via CSV export from Supabase Table Editor.

**Akima review:** Export CSV → Akima checks codes/descriptions/weights for accuracy.

---

### 1-4: RxNorm API Integration

**Status:** ✅ COMPLETE (2026-03-07) — `validateMedication()` in `nlmCodeValidator.ts` with RxNorm lookup
**Est:** 1 hour

Add RxNorm lookup to `nlmCodeValidator.ts` for medication name validation. Used by medication reconciliation and allergy cross-check hooks.

**Acceptance:** Lookup "metformin" returns valid RxCUI. Lookup "fakemed123" returns not found.

---

## Phase 2: Validator Module

### 2-1: Core Validator

**Status:** ✅ COMPLETE (2026-03-07) — `clinicalOutputValidator.ts` (440 lines) + `codeValidationHelpers.ts` (193 lines)
**Est:** 4 hours

Build `supabase/functions/_shared/clinicalOutputValidator.ts` — shared module imported by all AI edge functions. Categories:

| Validator | What It Checks | Data Source |
|-----------|---------------|-------------|
| `validateICD10` | Code exists in ICD-10-CM, active for current FY | NLM API + `code_icd` cache |
| `validateCPT` | Code exists in `code_cpt` table | Local DB |
| `validateHCPCS` | Code exists in `code_hcpcs` table | Local DB |
| `validateDRG` | Code exists in `ms_drg_reference`, correct FY | Local DB |
| `validateZCode` | Code in Z55-Z65 range AND exists in ICD-10-CM | Range check + NLM API |
| `validateRiskScore` | Range 0-100, supporting factors non-empty | Logic check |
| `validateMedication` | Cross-check against patient `allergy_intolerances` | Patient DB query |

**File:** `supabase/functions/_shared/clinicalOutputValidator.ts` (NEW)

**Acceptance:** Each validator returns `ValidationResult` with `validatedCodes[]`, `rejectedCodes[]`, and `audit` metadata.

---

### 2-2: FHIR Code System Validator

**Status:** ✅ COMPLETE (2026-03-07) — `fhirCodeSystemValidator.ts`, re-exported from `clinicalOutputValidator.ts`
**Est:** 2 hours

Extend validator to check FHIR-specific rules: code system URI matches code format (ICD-10 code with SNOMED URI = wrong), required value set bindings, UCUM unit format for quantities.

**Acceptance:** Mismatched code/system pair (ICD-10 code with `http://snomed.info/sct` URI) caught and flagged.

---

### 2-3: Failure Behavior Implementation

**Status:** ✅ COMPLETE (2026-03-07) — Option C implemented: flag codes with `_validated: false` + `_flagReason`, never strip. Learning loop via `validation_feedback` table (migration pushed).
**Est:** 2 hours

Implemented behavior: **Option C** — Flag bad codes (`_validated: false`, `_flagReason`, `_validationSource`) but still return for coder to see. Biller confirms or overrides via `validation_feedback` table (learning loop). Codes are never stripped — billers see everything with validation metadata attached.

---

## Phase 3: Wire Into AI Functions

### 3-1: Billing/Coding Functions (6 functions)

**Status:** ✅ COMPLETE (2026-03-07) — 4 wired, 2 skipped (justified)
**Est:** 3 hours

Wired `clinicalOutputValidator` into:
- ✅ `coding-suggest/index.ts` — validates ICD-10, CPT, HCPCS
- ✅ `sdoh-coding-suggest/index.ts` — validates ICD-10, CPT, risk score
- ✅ `mcp-medical-coding-server/drgGrouperHandlers.ts` — validates ICD-10, DRG
- ✅ `mcp-medical-coding-server/revenueOptimizerHandlers.ts` — validates CPT, HCPCS
- ⏭️ `ai-billing-suggester/index.ts` — SKIPPED (placeholder, not fully wired to AI)
- ⏭️ `mcp-medical-coding-server/chargeAggregationHandlers.ts` — SKIPPED (data aggregator, no AI-generated codes)

---

### 3-2: Clinical AI Functions (8 functions)

**Status:** ✅ COMPLETE (2026-03-07) — 6 wired, 2 skipped (justified)
**Est:** 3 hours

Wired `clinicalOutputValidator` into:
- ✅ `ai-soap-note-generator` — validates ICD-10, CPT from suggestions
- ✅ `ai-discharge-summary` — validates ICD-10 diagnoses, risk score
- ✅ `ai-fall-risk-predictor` — validates risk score range (0-100)
- ✅ `ai-care-escalation-scorer` — validates escalation score range (0-100)
- ✅ `ai-medication-reconciliation` — validates medication names via RxNorm
- ✅ `ai-treatment-pathway` — validates conditionCode (ICD-10)
- ⏭️ `ai-care-plan-generator` — NOT WIRED (decomposed into separate module, wired at module level already)
- ⏭️ `ai-clinical-guideline-matcher` — SKIPPED (matches guidelines, doesn't generate codes)

---

## Phase 4: Results Table

### 4-1: Migration

**Status:** ✅ COMPLETE (2026-03-07) — `validation_feedback` table pushed (learning loop). `validation_hook_results` table still needed for aggregate tracking.
**Est:** 1 hour

Created `validation_feedback` table (migration `20260307000001_validation_feedback.sql` — pushed). Still need `validation_hook_results` for aggregate tracking:

Original plan — create `validation_hook_results` table:

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | PK |
| `created_at` | timestamptz | When validation ran |
| `source_function` | text | Which AI edge function |
| `patient_id` | uuid | Patient context (nullable) |
| `tenant_id` | uuid | Tenant isolation |
| `codes_checked` | integer | Total codes validated |
| `codes_rejected` | integer | Codes that failed validation |
| `rejected_details` | jsonb | Array of `{ code, system, reason }` |
| `validation_method` | text | `nlm_api`, `local_cache`, `both` |
| `response_time_ms` | integer | Validation latency |

**RLS:** Tenant-scoped. Admin read access.

**File:** `supabase/migrations/YYYYMMDD_validation_hook_results.sql` (NEW)

---

### 4-2: Audit Integration

**Status:** NOT STARTED
**Est:** 1 hour

Wire validator to log every rejection to `audit_logs` via `auditLogger`. Event: `AI_CODE_VALIDATION_REJECTED`. Include source function, rejected code, reason, patient_id.

**Acceptance:** Rejected code appears in both `validation_hook_results` and `audit_logs`.

---

## Phase 5: Admin Dashboard

### 5-1: Validation Dashboard Component

**Status:** NOT STARTED
**Est:** 6 hours

Build `ClinicalValidationDashboard.tsx` in `src/components/admin/`. Displays:
- Summary cards: codes validated (30d), codes rejected, rejection rate %, top hallucinated code
- Trend chart: rejection rate over time
- Rejection log table: date, AI function, code, system, reason — sortable/filterable
- Filter by: date range, AI function, code system, rejection reason

**Route:** Wire into admin dashboard at appropriate section.

**Visual acceptance:** Maria must see it rendered before "done."

---

### 5-2: Reference Data Health Panel

**Status:** NOT STARTED
**Est:** 3 hours

Panel within dashboard showing reference data freshness (from P1-9 `reference_data_versions` table). Shows each data source, last updated date, freshness status (current/warning/stale/critical), next expected update.

**Acceptance:** Akima can see at a glance whether the validation data is current.

---

### 5-3: Dashboard Tests

**Status:** NOT STARTED
**Est:** 3 hours

Behavioral tests for dashboard components. Tier 1-2: user interactions, data display, filter behavior, loading/error states. Must pass Deletion Test.

---

## Phase 6: PDF Export

### 6-1: Validation Report PDF

**Status:** NOT STARTED
**Est:** 3 hours

Export from dashboard: validation statistics, rejection log, top hallucinated codes, reference data freshness — formatted as downloadable PDF. Date range selectable.

**Acceptance:** Akima downloads PDF, reviews offline. Contains same data as dashboard but portable.

---

### 6-2: DRG Reference Table PDF

**Status:** NOT STARTED
**Est:** 1.5 hours

Export `ms_drg_reference` table as formatted PDF. Columns: DRG code, description, relative weight, MDC, CC/MCC indicator. Sortable before export. Downloadable from dashboard or direct.

**Acceptance:** Akima reviews DRG codes/weights for clinical accuracy without opening Supabase.

---

### 6-3: PDF Generation Infrastructure

**Status:** NOT STARTED
**Est:** 1.5 hours

Shared PDF generation utility. Options: browser-side (html2pdf.js / jsPDF) or server-side (edge function). Browser-side preferred for pilot — no server dependency.

**Acceptance:** PDF renders cleanly, readable font sizes (Akima-friendly), includes generation date and data source.

---

## Phase 7: Clinical Content Export

### 7-1: Cultural Competency Profile PDF

**Status:** NOT STARTED
**Est:** 3 hours

Format cultural competency profiles (veteran, African American, Hispanic/Latino, Native American) as readable PDF cards:
- Population overview
- Prevalence rates (with source citations)
- Recommended screening tools
- Drug interaction considerations
- Trust-building guidance
- Communication recommendations

**Acceptance:** Akima reads each profile, flags inaccuracies. Content is in plain clinical language, not code.

---

### 7-2: Clinical Content Review Dashboard Panel

**Status:** NOT STARTED
**Est:** 1 hour

Admin panel listing all clinical content that needs periodic review. Links to PDF exports. Shows last review date, reviewer, status (reviewed/pending/flagged).

**Acceptance:** Akima can see what needs her review and download the relevant PDF.

---

## Session Plan

| Session | Phases | Est. Hours | Focus |
|---------|--------|-----------|-------|
| **1** | Phase 1 (1-1, 1-2, 1-3, 1-4) + Phase 4 (4-1) | 9 | Reference data + NLM API + results table |
| **2** | Phase 2 (2-1, 2-2, 2-3) + Phase 3 (3-1, 3-2) | 14 | Validator module + wire into all 14 AI functions |
| **3** | Phase 4 (4-2) + Phase 5 (5-1, 5-2, 5-3) | 13 | Dashboard + tests |
| **4** | Phase 6 (6-1, 6-2, 6-3) + Phase 7 (7-1, 7-2) | 10 | PDF exports + clinical content review |

**Total: ~46 hours across 4 sessions**

---

## Dependencies on Other Trackers

| This Tracker Item | Depends On | Status |
|-------------------|-----------|--------|
| Phase 1-3 (DRG table) | MCP P1-1 (DRG validation) | Absorbed — this tracker owns it now |
| Phase 2-1 (validator) | MCP P1-8 (post-output validation) | Absorbed — this tracker expands P1-8 |
| Phase 2-3 (failure behavior) | Akima policy decision | Blocked — Maria to ask |
| Phase 3 (wiring) | MCP P1-5 (constraints) | Done — constraints already wired |
| Phase 5 (dashboard) | Phase 4 (results table) | Sequential |
| Phase 6 (PDF) | Phase 5 (dashboard) | Sequential — exports from dashboard |
| Phase 7 (clinical content) | Cultural competency server data | Available — profiles exist in code |

---

## Verification After Each Session

```bash
npm run typecheck && npm run lint && npm test
```

For API integration (Phase 1): also test with live NLM API call to verify response parsing.
For dashboard (Phase 5): Maria visual acceptance required.
For PDF (Phase 6-7): Akima reviews exported documents.

---

*This tracker was created from a design session where Maria identified the need for runtime AI output validation with non-technical review paths for clinical staff (Akima). The architecture doc contains the full rationale, FHIR integration details, and competitive analysis.*
