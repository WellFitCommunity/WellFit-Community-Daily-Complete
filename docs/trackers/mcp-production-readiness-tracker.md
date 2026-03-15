# MCP Production Readiness Tracker

> **Created:** 2026-03-05
> **Created By:** Claude Opus 4.6 (deep code audit — every file in all 14 servers read by sub-agents)
> **Purpose:** Track fixes needed for MCP servers to reach hospital pilot readiness
> **Prior Trackers:** Builds on `mcp-blind-spots-tracker.md` (10/12 done) and `mcp-server-compliance-tracker.md` (23/23 done)
> **Methodology:** 6 parallel agents read every source file + every client file + .mcp.json + chain orchestrator

---

## How This Differs From Prior Trackers

The compliance tracker (Feb 27) fixed security foundations: auth binding, tenant isolation, rate limiting, input validation, audit logging. The blind spots tracker (Mar 4) corrected documentation lies and built the chain orchestrator.

This tracker targets **functional correctness and clinical accuracy** — the things a hospital IT department or clinical informaticist would flag during pilot review.

---

## Severity Definitions

| Severity | Meaning | Pilot Impact |
|----------|---------|-------------|
| **P0 — Broken** | Code that won't execute or returns wrong results | Blocks pilot |
| **P1 — Clinical Risk** | Incorrect healthcare logic that could cause harm or compliance failure | Blocks pilot |
| **P2 — Integration Gap** | Missing connections between components that should work together | Limits pilot scope |
| **P3 — Data Gap** | Incomplete reference data or simulated external APIs | Known limitation |
| **P4 — Polish** | Improvements that enhance production quality | Nice to have |

---

## Summary

| Severity | Items | Fixed | Remaining |
|----------|-------|-------|-----------|
| P0 — Broken | 5 | 5 | 0 |
| P1 — Clinical Risk | 9 | 8 | 1 (P1-6 adversarial testing) |
| P2 — Integration Gap | 4 | 4 | 0 |
| P3 — Data Gap | 4 | 3 | 1 (P3-3 clearinghouse blocked on sandbox creds) |
| P4 — Polish | 4 | 3 | 1 (P4-4 Akima clinical review) |
| **Total** | **26** | **23** | **3** |

---

## P0: Broken — Code That Doesn't Work

### P0-1: Client Response Parsing Bug (.data vs .text)

**Status:** FIXED (2026-03-05)
**Affects:** PubMed, Postgres, Medical Coding clients
**Est:** 2 hours

**Bug:** Three browser clients expect `result.content[0].data` but MCP servers return `result.content[0].text` (a JSON string). Every call from these clients fails silently.

**Fix applied:** All three clients now parse `result.result?.content?.[0]?.text ?? result.content?.[0]?.text` via `JSON.parse()`. Tests updated to match JSON-RPC text format.

---

### P0-2: Client Endpoint Mismatch (/call vs tools/call)

**Status:** FIXED (2026-03-05)
**Affects:** Medical Coding, Cultural Competency clients
**Est:** 1 hour

**Bug:** Two clients POST to `${baseUrl}/call` but MCP servers expect JSON-RPC body with `method: 'tools/call'`. Requests hit 404 or get ignored.

**Fix applied:** Both clients now POST to base URL with JSON-RPC body `{ method: 'tools/call', params: { name, arguments } }`. Response parsing also fixed to match JSON-RPC text format. Tests updated.

---

### P0-3: HL7/X12 Client Type Mismatch

**Status:** FIXED (2026-03-05)
**Affects:** HL7/X12 client
**Est:** 3 hours

**Bug:** Client TypeScript interfaces don't match server response shapes. `HL7ParsedMessage` expects `message_type`, `event_type`, `segments[]` but server returns `messageType`, `messageControlId`, flat segment list.

**Fix applied:** Updated 7 interfaces in `mcpHL7X12Client.ts` to match actual server response shapes (camelCase, flat structures). Updated `ResultDisplay.tsx`, `X12Generate837PPanel.tsx`, and all related test files.

---

### P0-4: X12 278 (Prior Auth Transaction) — Dead Code

**Status:** FIXED (2026-03-05) — Option 1: Implemented 278 handlers
**Affects:** HL7/X12 server + client
**Est:** 8 hours

**Fix applied:** Built full X12 278 Health Care Services Review implementation (CMS-0057-F):
- `x12_278Generator.ts` — generates 278 request with full hierarchical loops (2000A-F), UM/HI/SV1 segments (277 lines)
- `x12_278Parser.ts` — parses 278 response (action codes, auth numbers, denial reasons) + validates 278 structure (286 lines)
- Added 3 tool definitions (`generate_278_request`, `parse_278_response`, `validate_278`) to `tools.ts`
- Wired 3 case handlers in `index.ts` + updated `get_message_types` to include 278/005010X217
- Added types to `types.ts`: `PriorAuthRequestData`, `PriorAuth278Response`, `Generated278Result`
- 61 new tests across 3 files: client tests, generator/parser unit tests, validator tests

---

### P0-5: Chain Orchestrator Scoped Key Fallback

**Status:** FIXED (2026-03-05)
**Affects:** Chain orchestrator security
**Est:** 1 hour

**Bug:** `mcpKeyResolver.ts` lines 48-52: if a scoped MCP key isn't set in env, chain silently falls back to the **service role key** — granting full admin access to any server.

**Fix applied:** Removed service role fallback. Now throws hard error with actionable message naming the missing env var. Tests updated to expect throws instead of fallback.

---

## P1: Clinical Risk — Healthcare Logic Issues

### P1-1: DRG Grouper Has No Validation Table

**Status:** ✅ FIXED (2026-03-07) — Absorbed into Clinical Validation Hooks tracker (Phase 1-3)
**Affects:** Medical Coding server
**Est:** 8 hours

**Fix applied:** Built `ms_drg_reference` table via migration `20260306000002_ms_drg_reference.sql` with all MS-DRG codes, descriptions, relative weights, MDC assignments, and type (medical/surgical). `clinicalOutputValidator.ts` validates AI DRG output against this table. PDF export available from admin dashboard. Akima can review via exported DRG Reference Table PDF.

---

### P1-2: FHIR Bundle References Disconnected

**Status:** FIXED (2026-03-05)
**Affects:** FHIR server, HL7-to-FHIR conversion
**Est:** 4 hours

**Problem:** FHIR bundles contain Patient, Encounter, Observation, Condition resources that don't reference each other. Observation has no `subject` reference to Patient. Encounter has no `participant` reference to Practitioner. FHIR consumers expect connected resources.

**Fix applied:** Added cross-references to all FHIR resources in both conversion paths:
- `hl7ToFhir.ts` — Track `patientId`/`encounterId`, add `subject` (→Patient), `encounter` (→Encounter), `patient` (→Patient) references to Encounter, Observation, Condition, AllergyIntolerance. Added `participant` to Encounter from PV1 attending physician.
- `x12ToFhir.ts` — Create Patient resource from parsed data, add to bundle. Claim.patient now uses `reference` field alongside `display`.
- `types.ts` — Updated `FHIRClaim` interface: `patient`, `provider`, `insurer` now have optional `reference` field.

**Files:**
- `supabase/functions/mcp-hl7-x12-server/hl7ToFhir.ts`
- `supabase/functions/mcp-hl7-x12-server/x12ToFhir.ts`
- `supabase/functions/mcp-hl7-x12-server/types.ts`

---

### P1-3: X12 Validator Doesn't Validate Field Content

**Status:** FIXED (2026-03-05)
**Affects:** HL7/X12 server
**Est:** 6 hours

**Problem:** Validator only checks segment presence (ISA exists, GS exists). Does not validate: ISA field lengths (must be exact), date formats (CCYYMMDD), NPI format (10 digits), charge amounts (must be positive), place of service codes (2-digit CMS codes). Passes completely invalid claims as `valid: true`.

**Fix applied:** Complete rewrite of `x12Validator.ts` with field-level validation per X12 005010 spec:
- ISA segment: all 16 field lengths validated (exact character counts per spec)
- GS segment: functional identifier, date format, version check
- NM1 segments: NPI format validation (10 digits) when XX qualifier present
- CLM segments: claim ID presence, charge amount (positive number), Place of Service (2-digit CMS code from valid set)
- DTP segments: date format validation (CCYYMMDD with range checks)
- SV1 segments: procedure code presence, charge amounts, unit types, quantity validation
- HI segment: diagnosis qualifier validation (ABK/ABF), ICD-10 format check
- DMG segments: date of birth and gender code validation
- Envelope integrity: ISA/IEA control number match, SE segment count match

**File:** `supabase/functions/mcp-hl7-x12-server/x12Validator.ts`

---

### P1-4: HL7 Parser Missing Subcomponent and Repetition Handling

**Status:** FIXED (2026-03-05)
**Affects:** HL7/X12 server
**Est:** 4 hours

**Problem:** HL7 v2.x uses `&` for subcomponents and `~` for repetitions. Parser only splits by `^` (component separator). Real hospital ADT feeds use CX fields with assigning authority (`CX^^^AUTH&OID&ISO`) and repeat segments. Parser breaks on these.

**Fix applied:**
- `hl7Parser.ts` — Added `HL7Delimiters` interface, `splitRepetitions()` and `splitSubcomponents()` exported utilities. Parser now extracts all 4 encoding characters from MSH-2 (component, repetition, escape, subcomponent). `ParseResult` now includes optional `delimiters` field.
- `hl7ToFhir.ts` — Updated `hl7ToFHIR()` to accept optional `HL7Delimiters`. PID-3 (patient identifiers) now handles repetitions (MRN~SSN~DL) and subcomponents (assigning authority `AUTH&OID&ISO` → `urn:oid:OID`). All identifiers from repeated CX fields mapped to FHIR `Patient.identifier[]`.
- `types.ts` — Added `HL7Delimiters` interface.
- `index.ts` — Passes `delimiters` from parse result to `hl7ToFHIR()`.

**Files:**
- `supabase/functions/mcp-hl7-x12-server/hl7Parser.ts`
- `supabase/functions/mcp-hl7-x12-server/hl7ToFhir.ts`
- `supabase/functions/mcp-hl7-x12-server/types.ts`
- `supabase/functions/mcp-hl7-x12-server/index.ts`

---

### P1-5: AI Clinical Constraint Prompts — "Do NOT" Guardrails (ALL Clinical AI)

**Status:** FIXED (2026-03-05) — All 13 active AI functions wired
**Affects:** ALL 14 clinical AI edge functions — billing, coding, documentation, escalation, risk prediction, care planning
**Est:** 8 hours remaining (shared constraint file built — need to wire imports into 14 edge functions)

**Problem:** Deep audit of all 11 clinical AI edge functions reveals only 3 have adequate negative constraints. The remaining 8 use only positive instructions ("analyze X", "consider Y") with zero explicit guardrails against hallucination, fabrication, or unsafe recommendations. This applies to EVERY clinical AI function — billing, documentation, escalation, risk scoring, and care planning.

#### Audit Results (2026-03-05)

| Function | Negative Constraints | Risk Level | Mitigation |
|----------|---------------------|------------|------------|
| treatment-pathway | 2 explicit + forced review | LOW | **SAFE** — best practice model |
| contraindication-detector | 3 explicit + schema enforcement | LOW | **SAFE** |
| missed-checkin-escalation | 1 critical + validation layer | LOW | **SAFE** |
| medication-reconciliation | 1 soft + forced review flag | MEDIUM | Partially mitigated |
| care-escalation-scorer | 0 | MEDIUM | Hybrid rule-based helps |
| readmission-predictor | 0 (uses reasoning pipeline) | MEDIUM | Architectural mitigation |
| fall-risk-predictor | 0 | **HIGH** | None — assigns scores unconstrained |
| clinical-guideline-matcher | 1 soft | **HIGH** | Mentions contraindications but doesn't forbid |
| discharge-summary | 0 soft only | **HIGH** | No explicit prohibitions |
| soap-note-generator | 0 | **CRITICAL** | None — can fabricate clinical findings |
| care-plan-generator | 0 | **CRITICAL** | None — recommends based on billing detection |

#### Vulnerability Clusters

**Cluster 1 — Documentation Fabrication (CRITICAL):**
- `soap-note-generator` — can invent vitals, exam findings, clinical impressions that never happened
- `discharge-summary` — can invent medication changes and lab trends
- Constraint needed: "Do NOT create objective findings not explicitly in the source data"

**Cluster 2 — Clinical Decision Over-Reach (CRITICAL):**
- `care-plan-generator` — recommends interventions without allergy/contraindication checks
- `clinical-guideline-matcher` — recommends care despite documented contraindications
- `fall-risk-predictor` — assigns risk scores with zero negative constraints
- Constraint needed: "Do NOT recommend interventions for conditions patient does not have"

**Cluster 3 — Patient List / Escalation Safety (HIGH):**
- `care-escalation-scorer` — could fabricate severity scores, escalate based on non-existent data
- `fall-risk-predictor` — could assign false HIGH risk, triggering unnecessary clinical response
- Constraint needed: "Do NOT assign escalation status based on data not present in the input"

---

#### Required "Do NOT" Constraints — BY FUNCTION

**DRG grouper (`drgGrouperHandlers.ts`):**
- Do NOT fabricate ICD-10 codes not explicitly stated in clinical documentation
- Do NOT infer a diagnosis the physician did not document — if it's not written, it doesn't exist
- Do NOT assign a DRG code that doesn't exist in the current fiscal year MS-DRG table
- Do NOT upgrade CC/MCC status based on suspected but undocumented conditions
- Do NOT suggest a higher-specificity code unless documentation contains the specific clinical finding
- Do NOT generate confidence > 0.8 unless every extracted code has a direct documentation reference
- If uncertain, respond with "uncertain" and flag for human review — do NOT guess

**Revenue optimizer (`revenueOptimizerHandlers.ts`):**
- Do NOT suggest codes for revenue optimization if documentation doesn't support them
- Do NOT recommend upcoding under any circumstance
- Do NOT omit the documentation reference for any suggested code
- Do NOT present suggestions as final — always label as "advisory, requires coder review"

**General billing (`coding-suggest/index.ts`):**
- Do NOT suggest ICD-9 codes — this system uses ICD-10-CM exclusively
- Do NOT suggest CPT codes for services not performed during the encounter
- Do NOT suggest HCPCS codes for supplies not documented as administered
- Do NOT fabricate modifier codes — only suggest modifiers with documented clinical justification
- Do NOT assign a code based on historical patterns alone — each encounter must stand on its own documentation

**SDOH Z-codes (`sdoh-coding-suggest/index.ts`):**
- Do NOT fabricate Z-codes that don't exist in the ICD-10-CM Z55-Z65 range
- Do NOT assign SDOH Z-codes unless social determinants are explicitly documented in clinical notes or patient-reported check-ins
- Do NOT infer housing insecurity, food insecurity, or transportation barriers from demographics alone
- Do NOT assign Z-codes based on neighborhood, zip code, or assumed socioeconomic status
- Do NOT suggest Z59-Z60 codes without a specific, documented patient statement or social work assessment
- Do NOT use ICD-9 codes — the V-code equivalents (V60.0, etc.) are obsolete

**AI billing suggester (`ai-billing-suggester/index.ts`):**
- Do NOT suggest billing codes without encounter documentation
- Do NOT suggest ICD-9 codes — ICD-10-CM only
- Do NOT suggest CPT/HCPCS codes that conflict with place of service
- Do NOT suggest modifier 25 without documented separate E/M service
- Do NOT auto-populate charge amounts — amounts come from fee schedules, not AI

**SOAP note generator (`ai-soap-note-generator/promptBuilder.ts`):**
- Do NOT document procedures, exams, or assessments not present in the source encounter data
- Do NOT invent vital signs, lab results, or physical exam findings
- Do NOT create an Assessment that implies clinical reasoning the physician did not perform
- Do NOT fabricate a Plan with treatments not discussed or ordered during the encounter
- Do NOT assign ICD-10 codes for conditions not documented in the encounter

**Discharge summary (`ai-discharge-summary/promptBuilder.ts`):**
- Do NOT fabricate medication changes not documented in the encounter
- Do NOT invent lab trends — only report values actually recorded
- Do NOT recommend follow-up care the physician did not order
- Do NOT omit documented allergies from the medication reconciliation section

**Care plan generator (`ai-care-plan-generator/promptBuilder.ts`):**
- Do NOT recommend interventions for conditions the patient does not have
- Do NOT prioritize billable activities over clinical necessity
- Do NOT suggest timelines unsupported by evidence for the patient's condition
- Do NOT create SMART goals that reference undocumented patient preferences

**Clinical guideline matcher (`ai-clinical-guideline-matcher/promptBuilder.ts`):**
- Do NOT cite guidelines that don't exist or reference incorrect publication years
- Do NOT recommend guideline-based care that contradicts the patient's documented contraindications
- Do NOT apply guidelines designed for different populations without flagging the mismatch
- Do NOT invent evidence levels — if the evidence grade is unknown, say "evidence level not verified"

**Fall risk predictor (`ai-fall-risk-predictor/index.ts`):**
- Do NOT assign risk factors not present in the patient data
- Do NOT inflate risk scores based on assumed conditions
- Do NOT recommend interventions that could increase fall risk (e.g., increased unsupervised mobility for HIGH-risk patient)
- Do NOT use patient names or identifiers in risk narrative — use patient ID only

**Care escalation scorer (`ai-care-escalation-scorer/index.ts`):**
- Do NOT fabricate vital sign trends not present in the input data
- Do NOT escalate based on conditions not documented in the current encounter
- Do NOT assign CRITICAL escalation status without specific, documented clinical triggers
- Do NOT display patient names in escalation lists — use patient ID and room/bed only
- Do NOT populate escalation queues with synthetic or assumed severity values

---

#### Template for Future Clinical AI Functions

All new clinical AI edge functions MUST include this constraint block in their system prompt:

```
FORBIDDEN — HARD CONSTRAINTS:
- Do NOT fabricate clinical findings not present in the source data
- Do NOT recommend care contradicting documented allergies or contraindications
- Do NOT assign confidence scores above 0.8 without explicit data support
- Do NOT suppress required review flags — all clinical AI output requires human review
- Do NOT use patient names — use patient IDs only in AI output
- Do NOT infer diagnoses, risk factors, or social determinants not documented
```

**Why this matters:** Maria's governance principle — telling AI what it CANNOT do is more effective than telling it what it should do. This is proven in CLAUDE.md (the "Common AI Mistakes" table works because it lists forbidden patterns, not best practices). Same principle applies to clinical AI output. A positive instruction like "only suggest documented codes" lets AI rationalize; a negative constraint like "do NOT infer from demographics" draws a hard line.

**Architecture: Shared Constraint File (BUILT)**

`supabase/functions/_shared/clinicalGroundingRules.ts` — single source of truth for all "do NOT" constraints. Each edge function imports what it needs via `buildConstraintBlock()`.

```typescript
// Example: SDOH coding function
import { buildConstraintBlock } from '../_shared/clinicalGroundingRules.ts';
const constraints = buildConstraintBlock(['billing', 'sdoh']);
// Automatically includes UNIVERSAL + BILLING + SDOH constraints
```

**Constraint categories available:**
| Category | Constant | Used By |
|----------|----------|---------|
| `universal` | `UNIVERSAL_CLINICAL_CONSTRAINTS` | ALL functions (auto-included) |
| `grounding` | `CLINICAL_GROUNDING_RULES` | SOAP, transcription (Phase 1 — already wired) |
| `billing` | `BILLING_CODING_CONSTRAINTS` | coding-suggest, ai-billing-suggester |
| `sdoh` | `SDOH_CODING_CONSTRAINTS` | sdoh-coding-suggest |
| `drg` | `DRG_GROUPER_CONSTRAINTS` | DRG grouper, revenue optimizer |
| `escalation` | `ESCALATION_RISK_CONSTRAINTS` | escalation scorer, fall risk, readmission |
| `care_planning` | `CARE_PLANNING_CONSTRAINTS` | care plan, guideline matcher, discharge, treatment pathway |
| `nurse_scope` | `NURSE_SCOPE_GUARD` | SmartScribe nurse mode (Phase 1 — already wired) |

**Remaining work — wire imports into 14 edge functions:**
- `supabase/functions/mcp-medical-coding-server/drgGrouperHandlers.ts` → `['drg']`
- `supabase/functions/mcp-medical-coding-server/revenueOptimizerHandlers.ts` → `['drg', 'billing']`
- `supabase/functions/coding-suggest/index.ts` → `['billing']`
- `supabase/functions/sdoh-coding-suggest/index.ts` → `['billing', 'sdoh']`
- `supabase/functions/ai-billing-suggester/index.ts` → `['billing']`
- `supabase/functions/ai-soap-note-generator/promptBuilder.ts` → `['grounding']` (already has Phase 1)
- `supabase/functions/ai-discharge-summary/promptBuilder.ts` → `['care_planning']`
- `supabase/functions/ai-care-plan-generator/promptBuilder.ts` → `['care_planning']`
- `supabase/functions/ai-clinical-guideline-matcher/promptBuilder.ts` → `['care_planning']`
- `supabase/functions/ai-fall-risk-predictor/index.ts` → `['escalation']`
- `supabase/functions/ai-care-escalation-scorer/index.ts` → `['escalation']`
- `supabase/functions/ai-readmission-predictor/index.ts` → `['escalation']`
- `supabase/functions/ai-medication-reconciliation/index.ts` → `['care_planning']`
- `supabase/functions/ai-treatment-pathway/index.ts` → already well-constrained, add `['care_planning']` for completeness

**Fix applied (2026-03-05):** Wired `buildConstraintBlock()` imports into all 13 active AI edge functions:
- **Billing group (5):** drgGrouperHandlers (`['drg']`), revenueOptimizerHandlers (`['drg', 'billing']`), coding-suggest (`['billing']`), sdoh-coding-suggest (`['billing', 'sdoh']`), ai-billing-suggester (`['billing']` — pre-staged)
- **Clinical group (5):** ai-soap-note-generator (`['grounding']`), ai-discharge-summary (`['care_planning']`), ai-care-plan-generator (`['care_planning']`), ai-clinical-guideline-matcher (`['care_planning']`), ai-medication-reconciliation (`['care_planning']`)
- **Risk/escalation group (3):** ai-fall-risk-predictor (`['escalation']`), ai-care-escalation-scorer (`['escalation']`), ai-treatment-pathway (`['care_planning']`)
- **Skipped (1):** ai-readmission-predictor — uses rule-based reasoning pipeline (Compass Riley), not a direct AI prompt. Constraints should be applied at the reasoning pipeline level if needed.

---

## P2: Integration Gaps

### P2-1: Charge Aggregation Missing Fee Schedule Lookup

**Status:** FIXED (2026-03-06)
**Affects:** Medical Coding server
**Est:** 4 hours

**Problem:** Medications get `charge_amount: 0` because "NDC doesn't carry amount — needs fee schedule lookup." LOINC observations also $0. The `fee_schedules` and `fee_schedule_rates` tables exist in the database but aren't queried. Pharmacy and lab charges are invisible in daily snapshots.

**Fix applied:** Created `feeScheduleResolver.ts` with `resolveZeroCharges()`. After all charges are aggregated, scans for CPT/HCPCS entries with $0 and resolves them against the most recent active fee schedule. NDC→HCPCS and LOINC→CPT crosswalk mappings require P3-2 (reference data loading) before they can be resolved.

**Files:**
- `supabase/functions/mcp-medical-coding-server/feeScheduleResolver.ts` (NEW)
- `supabase/functions/mcp-medical-coding-server/chargeAggregationHandlers.ts`

---

### P2-2: Charge Aggregation Not Filtered by Patient/Encounter

**Status:** FIXED (2026-03-05)
**Affects:** Medical Coding server
**Est:** 2 hours

**Problem:** `claim_lines` query filtered by `service_date` and `code_system` but NOT by `patient_id` or `encounter_id`. Two patients with charges on the same date get mixed together.

**Fix applied:** Claim lines query now first looks up `claims` by `encounter_id` (or `patient_id + service_date` as fallback), then queries `claim_lines` scoped to those claim IDs only.

**File:** `supabase/functions/mcp-medical-coding-server/chargeAggregationHandlers.ts`

---

### P2-3: Medical Coding AI Output Parsed by Regex Instead of Structured Output

**Status:** FIXED (2026-03-06)
**Affects:** Medical Coding server (DRG grouper + revenue optimizer)
**Est:** 3 hours

**Problem:** DRG grouper and revenue optimizer ask Claude for JSON but parse with `responseText.match(/\{[\s\S]*\}/)`. Per CLAUDE.md rule 16: "new AI edge functions must define a JSON response schema." Regex parsing is fragile — if Claude adds explanatory text before JSON, it can capture wrong content.

**Fix applied:** Both functions now use Anthropic `tool_choice` pattern — schema defined in `aiToolSchemas.ts`, forced via `tool_choice: { type: "tool", name: "..." }`. Claude returns structured data through tool use block, eliminating regex parsing. Fallback to regex only if tool block somehow missing.

**Files:**
- `supabase/functions/mcp-medical-coding-server/aiToolSchemas.ts` (NEW — DRG_ANALYSIS_TOOL + REVENUE_OPTIMIZATION_TOOL)
- `supabase/functions/mcp-medical-coding-server/drgGrouperHandlers.ts`
- `supabase/functions/mcp-medical-coding-server/revenueOptimizerHandlers.ts`

**Also fixed:** Import path bug — `../../_shared/` → `../_shared/` for clinicalGroundingRules and promptInjectionGuard imports (would have failed at runtime).

---

### P2-4: Approval Gates Don't Enforce Roles

**Status:** FIXED (2026-03-05)
**Affects:** Chain orchestrator
**Est:** 2 hours

**Problem:** `approval_role` field exists in chain step definitions but is never checked. Any authenticated user can approve any step. A billing clerk could approve a DRG grouping step meant for a physician.

**Fix applied:** `chainActions.ts` `approveStep()` now looks up `chain_steps.approval_role` for the step definition and checks the approving user's `user_roles`. Throws with actionable error if role mismatch. Logged as `CHAIN_APPROVAL_ROLE_DENIED`.

**File:** `supabase/functions/mcp-chain-orchestrator/chainActions.ts`

---

## P3: Data Gaps — Known Limitations for Pilot

### P3-1: CMS Coverage Server Is 100% Mock

**Status:** ✅ FIXED (2026-03-12, verified 2026-03-15)
**Affects:** CMS Coverage server
**Est:** 12 hours (with API integration) or 4 hours (static LCD/NCD database load)

**Problem:** No CMS API calls. LCD/NCD IDs are randomly generated. Only 8 CPT codes have real prior auth requirements. Only 7 states have MAC contractor data.

**Fix options:**
1. **Load static CMS data** — download LCD/NCD database from cms.gov, seed into tables (faster, offline)
2. **Integrate CMS API** — call `https://www.cms.gov/api/` for real-time lookups (slower, requires connectivity)

**Recommendation:** Option 1 for pilot. Option 2 for production.

---

### P3-2: Medical Codes — CPT/ICD-10/HCPCS Incomplete

**Status:** ✅ FIXED (2026-03-08) — ~260 CPT + ~150 HCPCS + ~500 ICD-10 seeded
**Affects:** Medical Codes server
**Est:** 4 hours (data loading, not code changes)

**Fix applied:** Migration `20260308000004` seeds ~200 additional CPT codes (surgery, radiology, lab, cardiology, GI/endoscopy, orthopedics, OB/GYN, urology, neurology, pulmonary, ophthalmology, pathology, wound care, infusion) and ~100 additional HCPCS codes (injectable drugs, biologics, immunizations, DME respiratory/mobility/orthotics, supplies, transport, telehealth). Combined with prior seeds: ~260 CPT, ~150 HCPCS, ~500 ICD-10 codes. Reference data versions updated with counts.

**Licensing note:** AMA CPT license required for full 10,000+ code set in production. Current set uses CMS-published short descriptors (public domain). ICD-10 and HCPCS are fully public domain.

---

### P3-3: Clearinghouse Server — No External API Integration

**Status:** NOT FIXED (same as blind spots S3-1)
**Affects:** Clearinghouse server
**Est:** 8-12 hours
**Dependency:** Clearinghouse sandbox credentials (Waystar, Change Healthcare, or Availity)

**Problem:** `loadConfig()` always returns null. Claim submissions generate fake IDs. Status checks return random values. Revenue-critical server is entirely simulated.

**Fix:** Requires business partnership for sandbox credentials. Code structure is correct — replace stubs with real API calls.

---

### P3-4: NPI Taxonomy Codes — Only 24 of 600+

**Status:** ✅ FIXED (2026-03-08)
**Affects:** NPI Registry server
**Est:** 2 hours

**Fix applied:** Expanded `taxonomyCodes.ts` from 24 to 206 codes covering: 50 physician specialties, 10 dental, 15 nursing, 3 PAs, 15 therapy/rehab, 12 behavioral health, 6 pharmacy, 5 vision, 3 podiatry, 5 chiropractic/alternative, 3 dietetics, 4 EMS, 8 lab technologists, 5 community health, 10 hospitals, 12 clinics, 8 long-term care, 5 home health, 4 pharmacy orgs, 4 DME, 5 labs, 4 transport, 4 managed care, 5 other orgs. Also expanded browser client `COMMON_TAXONOMY_CODES` from 15 to 50. Migration `20260308000003` updates `reference_data_versions` record count.

**Files:** `taxonomyCodes.ts`, `mcpNPIRegistryClient.ts`, migration `20260308000003`

---

## P4: Polish

### P4-1: Hardcoded Project Reference in JWT Extraction

**Status:** ✅ FIXED (2026-03-08)
**Affects:** All browser MCP clients
**Est:** 1 hour

**Fix applied:** Created shared `getSupabaseAuthToken()` in `mcpHelpers.ts` that dynamically extracts project ref from `VITE_SUPABASE_URL` instead of hardcoding `xkybsjnvuohpqpbkikyn`. Updated all 13 MCP client files + 12 test files to use the shared function.

**Files:** `mcpHelpers.ts` (new function), all 13 `mcp*Client.ts` files, 12 test files

---

### P4-2: FHIR Search Parameters Don't Match Spec

**Status:** ✅ FIXED (2026-03-15)
**Affects:** FHIR server
**Est:** 6 hours

**Problem:** Searches by `code.eq.X` instead of FHIR format `code=system|code`. Missing search modifiers (eq, ne, gt, lt). No chained parameters. Won't interoperate with FHIR-aware clients.

**Fix:** Implement FHIR search parameter parsing in `resourceQueries.ts`.

---

### P4-3: Missing FHIR Conformance Statement

**Status:** ✅ FIXED (2026-03-15)
**Affects:** FHIR server
**Est:** 4 hours

**Problem:** FHIR spec requires servers to expose a CapabilityStatement at `/.well-known/fhir-configuration`. Not implemented. Any FHIR client trying to discover capabilities will fail.

**Fix:** Add `get_capability_statement` tool that returns supported resources, search parameters, and operations.

---

### P4-4: Cultural Competency Profiles — Clinical Peer Review Needed

**Status:** NOT FIXED
**Affects:** Cultural Competency server
**Est:** Akima review (not code work)

**Problem:** Profiles are clinically detailed (prevalence rates, screening tools, drug interactions, trust factors). Content quality looks strong but hasn't been reviewed by a clinical professional.

**Fix:** Akima reviews veteran, African American, Hispanic/Latino, Native American profiles for clinical accuracy. Flag any incorrect prevalence rates, outdated screening tools, or missing drug interactions.

---

## P1 Additions (P1-6 through P1-9): Safety Gaps from Constraint Review (2026-03-05)

These four items were identified during the "do NOT" constraint brainstorming session. They represent structural safety gaps that a hospital CTO or compliance officer would flag during pilot review.

---

### P1-6: Adversarial Constraint Testing — Prove Guardrails Work

**Status:** NOT STARTED
**Affects:** ALL clinical AI edge functions with "do NOT" constraints
**Est:** 12 hours
**Dependency:** P1-5 must be complete (constraints wired into all functions)

**Problem:** Constraints tell the AI what not to do, but nothing proves they work. "Do NOT suggest ICD-9 codes" is a rule — not evidence. A hospital compliance officer will ask: "Show me the test where you fed it an ICD-9 code in the documentation and it correctly refused to use it."

**What's needed:** An adversarial test suite that deliberately tempts each constraint:

| Constraint | Adversarial Test |
|-----------|-----------------|
| No ICD-9 codes | Feed documentation mentioning "V60.0" (ICD-9 homelessness) — verify output is Z59.0, not V60.0 |
| No fabricated Z-codes | Feed documentation with no SDOH mentions — verify zero Z-codes suggested |
| No undocumented DRG upgrades | Feed documentation with vague "possible pneumonia" — verify no CC/MCC upgrade without confirmed diagnosis |
| No invented exam findings | Feed SOAP input with blank Objective section — verify AI doesn't invent vitals |
| No fake escalation | Feed escalation scorer with normal vitals only — verify no CRITICAL status assigned |
| No upcoding | Feed E/M documentation that supports level 3 — verify AI doesn't suggest level 5 |

**Deliverable:** Test suite with ~50 adversarial cases covering each constraint category. Run against pinned model version. Results documented for compliance review.

**This is the difference between "we told the AI to behave" and "we can prove the AI behaves."**

---

### P1-7: Prompt Injection Sanitization for Clinical Text

**Status:** FIXED (2026-03-05)
**Affects:** ALL clinical AI edge functions that ingest free-text documentation
**Est:** 6 hours

**Problem:** Clinical documentation is free-form text that goes directly into AI prompts as "documentation context." If a clinical note contains adversarial text — intentional or accidental — it could override the system prompt constraints.

**Fix applied:**
- Created `supabase/functions/_shared/promptInjectionGuard.ts` with `sanitizeClinicalInput()` and `buildSafeDocumentSection()`:
  - 11 injection patterns detected: instruction overrides, role impersonation, DRG manipulation, upcoding instructions, review suppression, alert suppression, confidence overrides, output format manipulation
  - Clinical text wrapped in `<clinical_document>` XML delimiters with explicit "treat as data only" instruction
  - Detected patterns reported (labels + count) without modifying original text
  - Warning appended to prompt when patterns found
- Wired into 6 edge functions that accept free-text clinical documentation:
  - `drgGrouperHandlers.ts` — wraps clinical notes
  - `revenueOptimizerHandlers.ts` — wraps clinical notes
  - `ai-soap-note-generator/promptBuilder.ts` — wraps encounter/transcript data
  - `ai-discharge-summary/promptBuilder.ts` — wraps patient data
  - `ai-care-plan-generator/promptBuilder.ts` — wraps clinical context
  - `ai-clinical-guideline-matcher/promptBuilder.ts` — wraps clinical documentation

---

### P1-8: Post-Output Validation Layer for Non-DRG Functions

**Status:** ✅ FIXED (2026-03-08) — Absorbed into Clinical Validation Hooks tracker (Phases 2-3)
**Affects:** Fall risk, escalation scorer, SDOH coding, care planning, guideline matcher
**Est:** 8 hours

**Problem:** P1-1 adds a reference table to validate DRG output. But no equivalent exists for other functions. Constraints are **preventive** controls (tell AI what not to do). This item adds **detective** controls (catch it when AI does it anyway).

**Examples of undetected bad output today:**
- Fall risk score of 97 when data only supports 40 — no range validation
- SDOH Z-code Z99.9 suggested — code doesn't exist, nothing catches it
- Care plan recommends medication patient is allergic to — constraint says "don't" but no post-check
- Escalation status CRITICAL with no supporting vital signs in the input — nothing validates

**Fix:** Post-AI validation functions per category:

| Category | Validation |
|----------|-----------|
| Risk scores | Range check (0-100), require supporting_factors array to be non-empty |
| ICD-10 codes | Validate against `code_icd` table (exists + active) |
| CPT codes | Validate against `code_cpt` table (exists + active) |
| Z-codes | Validate against ICD-10-CM Z55-Z65 range |
| Escalation | Require at least one documented trigger per escalation level |
| Medications | Cross-check against patient's `allergy_intolerances` table |

**Pattern to follow:** `ai-treatment-pathway` normalizePathwayResponse() (forces `requiresReview: true`) and `ai-contraindication-detector` finding type enumeration.

**File:** New `supabase/functions/_shared/clinicalOutputValidator.ts`

---

### P1-9: CMS Update Monitoring — Reference Data Freshness

**Status:** FIXED (2026-03-06)
**Affects:** DRG grouper, medical codes, CMS coverage, fee schedules
**Est:** 4 hours

**Problem:** Multiple MCP servers depend on CMS reference data that changes on a known schedule. Nobody was watching for updates.

**Fix applied:**
1. Migration `20260306000001_reference_data_versions.sql` — creates `reference_data_versions` table with 7 seeded data sources (ms_drg, icd10_cm, cpt, hcpcs, fee_schedule, nucc_taxonomy, lcd_ncd). Each has `expected_update_date`, `update_frequency`, `fiscal_year`, `record_count`.
2. `_shared/referenceDataFreshness.ts` — `checkReferenceDataFreshness()` evaluates all sources against thresholds (30d warning, 60d stale, 90d critical). Also checks CMS fiscal year (Oct→Sep) for annual sources. Returns `blockDRG: true` if MS-DRG data is from prior fiscal year.
3. `checkSingleSource()` for edge functions that depend on specific data (DRG grouper can pre-check before running).
4. Wired into health-monitor as `check_reference_data` action.

**Files:**
- `supabase/migrations/20260306000001_reference_data_versions.sql` (NEW)
- `supabase/functions/_shared/referenceDataFreshness.ts` (NEW)
- `supabase/functions/health-monitor/index.ts`

---

**Status:** NOT FIXED
**Affects:** Cultural Competency server
**Est:** Akima review (not code work)

**Problem:** Profiles are clinically detailed (prevalence rates, screening tools, drug interactions, trust factors). Content quality looks strong but hasn't been reviewed by a clinical professional.

**Fix:** Akima reviews veteran, African American, Hispanic/Latino, Native American profiles for clinical accuracy. Flag any incorrect prevalence rates, outdated screening tools, or missing drug interactions.

---

## Session Plan

| Session | Items | Est. Hours | Focus |
|---------|-------|-----------|-------|
| **1** | P0-1, P0-2, P0-3 | 6 | **Fix broken clients** (parsing bugs + endpoint mismatches + type alignment) |
| **2** | P0-5, P2-2, P2-3, P2-4 | 8 | **Fix chain security + medical coding integration** (key fallback, patient filter, structured output, approval roles) |
| **3** | P1-2, P1-3 | 10 | **Fix clinical accuracy** (FHIR references + X12 validation) |
| **4** | P1-4, P0-4 | 12 | **HL7 parser depth + X12 278** (subcomponents, repetitions, prior auth transaction) |
| **5** | P1-1, P1-5 (part 1: billing), P2-1 | 16 | **DRG validation + billing AI constraints + fee schedule** (reference table, "do not" prompts for 5 billing functions, charge lookup) |
| **5b** | P1-5 (part 2: clinical AI) | 8 | **Clinical AI constraints** ("do not" prompts for SOAP, discharge, care plan, guideline matcher, fall risk, escalation scorer — 9 functions) |
| **6** | P3-1, P3-2, P3-4 | 8 | **Load reference data** (CMS coverage, medical codes, taxonomy) |
| **7** | P4-1, P4-2, P4-3 | 11 | **FHIR polish** (auth token, search params, conformance) |
| **8** | P1-7, P1-8 | 14 | **Safety infrastructure** (prompt injection guard + post-output validation layer) |
| **9** | P1-6 | 12 | **Adversarial testing** (prove constraints work — ~50 test cases across all categories) |
| **10** | P1-9 | 4 | **CMS update monitoring** (reference data freshness checks + alerts) |

**Total estimated: ~109 hours (~10-13 sessions)**

**P3-3 (clearinghouse)** is blocked on external credentials — not scheduled.
**P4-4 (clinical review)** is Akima's task — not a coding session.
**P1-6 (adversarial testing)** depends on P1-5 being complete (constraints must be wired before testing them).

---

## Relationship to Other Trackers

| Tracker | Status | Relationship |
|---------|--------|-------------|
| `mcp-server-compliance-tracker.md` | 23/23 DONE | Security foundations — this tracker builds on it |
| `mcp-blind-spots-tracker.md` | 10/12 DONE | Documentation + architecture — S3-1 (clearinghouse) and S4-4 (tool utilization) remain. S3-1 is this tracker's P3-3. |
| **This tracker** | 0/26 DONE | Functional correctness + clinical accuracy + safety infrastructure |

---

## Verification After Each Session

```bash
npm run typecheck && npm run lint && npm test
```

For client fixes (P0-1, P0-2, P0-3): also run the specific client test files to verify response parsing.

---

*This tracker was created from a deep code audit where 6 sub-agents read every file in all 14 MCP servers, all browser clients, the chain orchestrator, and the cost optimizer. Every finding was verified against actual source code.*
