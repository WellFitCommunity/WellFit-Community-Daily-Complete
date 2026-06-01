# Clinical-Logic Adversarial Audit — 2026-06-01

> **Method:** 4 parallel adversarial AI reviewers (medication safety, risk scoring, FHIR mapping, CQM calc), each instructed to hunt for patient-safety/correctness defects and cite file:line. Lead agent (Claude Opus 4.8) then **independently verified the top CRITICALs against the live DB + actual code** before recording. This is the cross-AI adversarial methodology applied to the clinical layer.
> **Verdict:** Real, serious, located, and fixable defects — concentrated in (a) schema drift on 4 older FHIR services, (b) fail-open / fail-unsafe defaults in AI scoring + drug-interaction logic, (c) a structurally incomplete CQM engine. NOT architecture rot. **Clinical layer is NOT pilot-ready until the CRITICALs are fixed.**
> **Remediation status (2026-06-01):** Tier-0 **4 of 5 fixed + pushed** — AV-1 (`d416f221`, incl. live migration `20260601231319`), AV-4 + AV-5 (`d416f221`), AV-3 (`23c364a9`). Each lead-verified with a live DB round-trip + scoped typecheck/lint. **AV-2 (fhir_medications table missing) BLOCKED on Maria** (create table vs repoint). **DiagnosticReportService** is the verified sister of AV-1/AV-3 (same `category_code`/`category_display` drift) — next mechanical fix. The ~25 lower-severity findings below are not yet started.

---

## ✅ INDEPENDENTLY VERIFIED BY LEAD (code + live DB)

| # | Severity | Location | Defect | Verified how |
|---|----------|----------|--------|--------------|
| AV-1 | **CRITICAL** | `src/services/fhir/AllergyIntoleranceService.ts:24,62,82,126…` | Selects `patient_id, allergen_code_system, type, category, reaction, onset_datetime` + filters `.eq('patient_id',…)`. Live `allergy_intolerances` has **none of these** (PK is `user_id`; real cols `reaction_manifestation`, `onset_date`). **Every allergy read/write throws.** Wired live: `useFhirData.ts` → `AllergiesPage.tsx` (`/allergies`) + telehealth sidebar. A swallowed fetch error renders as **"no known allergies"** — the most dangerous interop failure. | Read code + `information_schema` query + reachability grep |
| AV-2 | **CRITICAL** | `src/services/fhir/MedicationService.ts` (all methods) | Every method queries `.from('fhir_medications')`. **Table does not exist** in live DB (count 0). Entire service is dead — any Medication resource read/write/search throws. | `information_schema.tables` count = 0 |
| AV-3 | **CRITICAL** | `src/services/fhir/ConditionService.ts:38,166,198` + `utils/fhirNormalizers.ts` | Selects `category_code, category_display, category_system, code_code`. Live `fhir_conditions` has only `category, category_coding_system, code, code_text`. Read/create/update throw. Powers `/conditions` (My Health Hub) + family-history. | Read code + `information_schema` query |
| AV-4 | **HIGH→CRIT** | `supabase/functions/check-drug-interactions/index.ts:270` | `severityOrder = { high:3, moderate:2, low:1, "n/a":0 }` — **omits `contraindicated`** → `|| 0`. The single most dangerous interaction class ranks LOWEST; a lone contraindicated pair logs `highest_severity:"n/a"`. | Read code (line 270 confirmed) |
| AV-5 | **CRITICAL** | `supabase/functions/ai-care-escalation-scorer/index.ts:739,741` | `overallEscalationScore: (…) || 0` and `escalationCategory: (…) || "none"`. Malformed/empty AI JSON forces score 0 / "none" **and discards the rule-based score** that already flagged critical vitals. Decompensating patient → "no escalation." Fail-unsafe. | Read code (lines 739/741 confirmed) |

---

## ◻️ AGENT-REPORTED — credible, NOT yet independently verified by lead

### Medication safety
- **CRITICAL** `check-drug-interactions:242-258` — negative-result cache keyed by **substring name match** (RxNorm canonical name vs chart display name); mismatch caches `has_interaction:false` for a pair that DID interact → real interaction permanently suppressed until cache expiry (fail-open cache poisoning).
- **HIGH** `check-drug-interactions:179-182` — only `PGRST116` cache-error handled; any other cache-read error silently **drops the med from checking** (neither pushed to interactions nor to the API queue). Use `.maybeSingle()`.
- **HIGH** `drugInteractionService.ts:201-222` — `enhanceInteractionWithClaude` lets Claude free-text **overwrite authoritative RxNorm severity** (`parsed.severity || base`) and stamps `confidence:0.95`; no anti-downgrade guard. Violates structured-output rule (§16).
- **HIGH** `medicationReconciliationService.ts:81` — dose discrepancy via raw `dosage !== dosage` (no normalization): `"10mg"≠"10 mg"` (false positives → alert fatigue); `undefined !== undefined` false (both-unknown passes as reconciled).
- **MEDIUM** `ai-contraindication-detector:563` & `ai-medication-reconciliation:528` — AI `overallAssessment` trusted verbatim (`|| "caution"`), never cross-checked against the computed `contraindicated` findings count → a contraindicated finding can surface under a "safe" banner.
- **MEDIUM** `ai-contraindication-detector:316-360` — allergy/lab queries ignore their `error` field; an RLS/DB failure leaves `allergies=[]` rendered to the LLM as **"NKDA (No Known Drug Allergies)"** → defeats allergy cross-check. Fail-open.
- **MEDIUM/SUSPECT** `check-drug-interactions:122` reads `medication_codeable_concept.rxcui` while `ai-contraindication-detector:302` reads `medication_code` from the same table — at most one matches the schema; if the former is wrong, **every** interaction check returns "no other meds." (Needs schema check.)
- **LOW** `medicationReconciliationService.ts:114` — duplicate detection substring-matches short tokens (`'asa'` matches `"Asacol"`).

### Risk scoring
- **CRITICAL** `ai-fall-risk-predictor:307,558` — null DOB → age risk defaults to `"low"`/0; oldest highest-risk cohort under-triaged when age missing.
- **HIGH** `ai-infection-risk-predictor:816` — caller-supplied `haiTypes:[]` → `Math.max(...[])` = `-Infinity` → "low" + corrupt stored score (no input validation).
- **HIGH** `holisticRiskAssessment.ts:289` — `(riskScore/riskFactors)*3.33` averages points across ALL vitals incl. normal ones → a lone critical vital diluted (SpO2 85 + 3 normal vitals → MODERATE).
- **HIGH** `holisticRiskAssessment.ts` (multiple) — every dimension returns a hardcoded `5.0/6.0/3.0` default on no-data/`catch` (errors **unlogged**); composite is a flat average → genuine high clinical risk diluted toward MODERATE.
- **HIGH** `holisticRiskAssessment.ts:537` — `10 - adherenceRate/10` assumes 0–100 scale; if adherence is 0–1, a well-adherent patient flips to near-max risk. Unit not validated.
- **HIGH** `*scorer/predictor` — `parseFloat` on missing/blank lab values → `NaN`; `NaN<min` & `NaN>max` both false → **abnormal lab scored "normal."**
- **MEDIUM** `holisticRiskAssessment.ts:371` — `+30` suicidal/hopeless flag divided by `moodCount` → ideation signal diluted by volume of normal mood entries.
- **MEDIUM** `ai-readmission-predictor:350` — completion rate `completed/30` hardcoded; >30 records → >1.0; <30 days enrolled → falsely non-compliant. No clamp.
- **MEDIUM** `readmissionRiskPredictionService.ts:400` — `dataConfidence` adds +10 for `x >= 0` (always true for non-negative defaults) → confidence inflated on absent data.
- All AI predictors parse free-text via `content.match(/\{[\s\S]*\}/)` instead of structured output (§16).

### FHIR mapping (besides the verified CRITICALs)
- ✅ **FIXED (`23c364a9`→ next commit)** `DiagnosticReportService.ts:28,148,182` — selected `category_code`/`category_display` (verified absent; live has array `category` + `category_coding_system`) → getByPatient/create/update threw. Removed the 2 phantom columns; create/update strip them at the write boundary. Verified: corrected SELECT parses live, scoped typecheck 0, lint 0.
- ✅ **NEW — CRITICAL, FULLY FIXED** `DiagnosticReportService` — **4 of 7 methods called RPCs absent from the live DB** (`get_recent_diagnostic_reports`, `get_lab_reports`, `get_imaging_reports`, `get_pending_reports`). All 4 reimplemented as direct table queries: getRecent (order issued desc + limit); getPending (status IN registered/partial); getLabReports / getImagingReports (`category @> ['laboratory']` / `['imaging']` — vocabulary confirmed by Maria, resolving the ObservationService inconsistency — with effective_datetime lookback). All live-verified (array-contains filters parse on the live table), typecheck 0, lint 0. **DiagnosticReportService now fully functional (7/7 methods).**
- **HIGH** `AllergyIntoleranceService:26` — `.order('criticality', desc)` string-sorts `high|low|unable-to-assess` → `high` (life-threatening) sorts LAST in `getHighRisk` (moot until AV-1 fixed).
- **MEDIUM** vocabulary inconsistency: Observation uses `'laboratory'/'imaging'`; DiagnosticReport uses `'LAB'/'RAD'`.
- **CLEAN (agent-confirmed):** MedicationRequestService, ObservationService, ServiceRequestService, ImmunizationService — selects match live schema, FHIR R4 semantics correct (ServiceRequest cancel→`revoked`, units preserved). The recently-built services are faithful.

### CQM calculation (`src/services/qualityMeasures/calculation/`)
- **CRITICAL** `measureEvaluators.ts:134` (CMS165) — denominator patients with no BP reading fall through → counted as numerator FAILURE (no exception path) → understates BP-control rate.
- **CRITICAL** `aggregateResults.ts:37-56` — `numeratorCount` not intersected with denominator (CQL path emits them independently); **performanceRate never clamped** → can exceed 100%.
- **HIGH** `aggregateResults.ts:47` — `eligibleDenominator = denom − exclusions − exceptions` where exclusion/exception counts are over ALL rows (not denominator subset) → can go **negative**.
- **HIGH** no `inverse`-measure flag anywhere (`types.ts:39`); CMS122 (poor-control, lower=better) reports the same numeric field as the "higher=better" measures → a consumer reads it backwards.
- **MEDIUM-HIGH** `measureEvaluators.ts` — hand-coded evaluators **never set exclusions/exceptions** for any of the 5 measures → hospice/mastectomy/colectomy patients stay in denominators → deflates rates.
- **MEDIUM** `patientEvaluation.ts:227` — age computed at `periodEnd` (spec: period START) + 365.25-day drift → boundary patients flip in/out of initial population.
- **MEDIUM** `measureEvaluators.ts:211` — screening lookback has no upper bound → future-dated procedures satisfy numerator.
- Verdict: structurally incomplete — **must not be used for live CMS/MIPS submission** until exclusions, inverse handling, and clamping/intersection are fixed + validated against Bonnie/CMS test decks.

---

## Remediation sequencing (proposed)

**Tier 0 — patient-safety, fix before ANY clinical pilot:**
AV-1 (allergy false-negative), AV-4 (contraindicated severity), AV-5 (escalation fail-unsafe), med-safety cache poisoning + NKDA-on-error, fall-risk null-DOB, NaN-lab-as-normal.

**Tier 1 — schema-drift repair (mechanical, like the SDK gate):**
AV-1/AV-2/AV-3 + DiagnosticReport. Repair each service's select against `information_schema`; add a **gate** that diffs FHIR-service select lists vs live columns (same philosophy as `check-edge-sdk-hygiene.sh`) so this can't regress.

**Tier 2 — AI scoring hardening:**
Replace `|| 0`/`|| low` fail-unsafe defaults with explicit "unable to assess"; enforce structured output (§16) across predictors; derive safety verdicts from findings, not from a trusted AI summary field.

**Tier 3 — CQM correctness:**
Exclusion/exception logic, inverse-measure flag, clamp+intersect performanceRate; validate against CMS test decks. Do not submit until then.

## Regression idea
A `check-fhir-service-schema.sh` gate (diff each `fhir/*Service.ts` SELECT column list against `information_schema.columns`) would have caught AV-1/2/3 mechanically — the FHIR analogue of the SDK hygiene gate.
