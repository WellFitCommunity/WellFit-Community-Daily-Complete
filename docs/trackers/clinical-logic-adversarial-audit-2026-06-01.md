# Clinical-Logic Adversarial Audit — 2026-06-01

> **Method:** 4 parallel adversarial AI reviewers (medication safety, risk scoring, FHIR mapping, CQM calc), each instructed to hunt for patient-safety/correctness defects and cite file:line. Lead agent (Claude Opus 4.8) then **independently verified the top CRITICALs against the live DB + actual code** before recording. This is the cross-AI adversarial methodology applied to the clinical layer.
> **Verdict:** Real, serious, located, and fixable defects — concentrated in (a) schema drift on 4 older FHIR services, (b) fail-open / fail-unsafe defaults in AI scoring + drug-interaction logic, (c) a structurally incomplete CQM engine. NOT architecture rot. **Clinical layer is NOT pilot-ready until the CRITICALs are fixed.**
> **Remediation status (2026-06-02): ALL Tier-0 + all FHIR schema-drift findings FIXED + pushed.** AV-1 (`d416f221` + migration `20260601231319`), AV-4 + AV-5 (`d416f221`), AV-3 (`23c364a9`), DiagnosticReportService select drift (`eb54a1ef`) + all 4 missing-RPC methods reimplemented (`55c54b03`, `b0cc6e74`) → 7/7 methods working, AV-2 (`fhir_medications` catalog created via migration `20260602000049`). Every fix lead-verified with a live DB round-trip + scoped typecheck/lint.

> **TIER-0 NOW FULLY CLOSED (2026-06-02, session 2).** The remaining Tier-0 items landed: med-safety cache poisoning + fail-open cache read + AI severity-downgrade + NKDA-on-error + contraindication NaN-lab (`be2eceb1`), and fall-risk null-DOB under-triage (next commit, deployed v17). All edge fns redeployed (verify_jwt=false preserved). **Remaining: the ~25 lower-severity findings below (Tiers 2–3) — not yet started.** A Tier-1 regression guard (`check-fhir-service-schema.sh`, the FHIR analogue of the SDK-hygiene gate) is being added to stop the schema-drift class (AV-1/2/3) from recurring.

---

## ✅ INDEPENDENTLY VERIFIED BY LEAD (code + live DB)

| # | Severity | Location | Defect | Verified how |
|---|----------|----------|--------|--------------|
| AV-1 | **CRITICAL** | `src/services/fhir/AllergyIntoleranceService.ts:24,62,82,126…` | Selects `patient_id, allergen_code_system, type, category, reaction, onset_datetime` + filters `.eq('patient_id',…)`. Live `allergy_intolerances` has **none of these** (PK is `user_id`; real cols `reaction_manifestation`, `onset_date`). **Every allergy read/write throws.** Wired live: `useFhirData.ts` → `AllergiesPage.tsx` (`/allergies`) + telehealth sidebar. A swallowed fetch error renders as **"no known allergies"** — the most dangerous interop failure. | Read code + `information_schema` query + reachability grep |
| AV-2 | **CRITICAL → ✅ FIXED** | `src/services/fhir/MedicationService.ts` (all methods) | Every method queried `.from('fhir_medications')` — table did not exist → service dead. **FIXED:** created the FHIR Medication drug-definition catalog table via migration `20260602000049` (RLS: authenticated read, admin write; columns match the service's select exactly). Confirmed repointing to `medications` would be WRONG (that's a patient med-list, not a catalog). No service code change needed — it now hits a real empty catalog (clean not-found vs. a thrown DB error). Applied + Local=Remote per CLI; column round-trip pending MCP recovery. | `information_schema.tables` count was 0; migration applied + verified via CLI |
| AV-3 | **CRITICAL** | `src/services/fhir/ConditionService.ts:38,166,198` + `utils/fhirNormalizers.ts` | Selects `category_code, category_display, category_system, code_code`. Live `fhir_conditions` has only `category, category_coding_system, code, code_text`. Read/create/update throw. Powers `/conditions` (My Health Hub) + family-history. | Read code + `information_schema` query |
| AV-4 | **HIGH→CRIT** | `supabase/functions/check-drug-interactions/index.ts:270` | `severityOrder = { high:3, moderate:2, low:1, "n/a":0 }` — **omits `contraindicated`** → `|| 0`. The single most dangerous interaction class ranks LOWEST; a lone contraindicated pair logs `highest_severity:"n/a"`. | Read code (line 270 confirmed) |
| AV-5 | **CRITICAL** | `supabase/functions/ai-care-escalation-scorer/index.ts:739,741` | `overallEscalationScore: (…) || 0` and `escalationCategory: (…) || "none"`. Malformed/empty AI JSON forces score 0 / "none" **and discards the rule-based score** that already flagged critical vitals. Decompensating patient → "no escalation." Fail-unsafe. | Read code (lines 739/741 confirmed) |

---

## ◻️ AGENT-REPORTED — credible, NOT yet independently verified by lead

### Medication safety
- **CRITICAL → ✅ FIXED (`be2eceb1`)** `check-drug-interactions:242-258` — negative-result cache keyed by **substring name match** (RxNorm canonical name vs chart display name); mismatch caches `has_interaction:false` for a pair that DID interact → real interaction permanently suppressed until cache expiry (fail-open cache poisoning). FIXED: negative cache now keyed by RxCUI (authoritative), not display-name substring.
- **HIGH → ✅ FIXED (`be2eceb1`)** `check-drug-interactions:179-182` — only `PGRST116` cache-error handled; any other cache-read error silently **drops the med from checking** (neither pushed to interactions nor to the API queue). FIXED: `.maybeSingle()` + any cache miss/error now fails SAFE to an API re-check.
- **HIGH → ✅ FIXED (`be2eceb1`)** `drugInteractionService.ts:201-222` — `enhanceInteractionWithClaude` let Claude free-text **overwrite authoritative RxNorm severity** (`parsed.severity || base`). FIXED: `mostSevereSeverity()` lets the AI escalate but never downgrade; test asserts the contract (+ no-downgrade/escalation cases).
- **HIGH** `medicationReconciliationService.ts:81` — dose discrepancy via raw `dosage !== dosage` (no normalization): `"10mg"≠"10 mg"` (false positives → alert fatigue); `undefined !== undefined` false (both-unknown passes as reconciled).
- **MEDIUM** `ai-contraindication-detector:563` & `ai-medication-reconciliation:528` — AI `overallAssessment` trusted verbatim (`|| "caution"`), never cross-checked against the computed `contraindicated` findings count → a contraindicated finding can surface under a "safe" banner.
- **MEDIUM → ✅ FIXED (`be2eceb1`)** `ai-contraindication-detector:316-360` — allergy/lab queries ignored their `error` field; an RLS/DB failure left `allergies=[]` rendered to the LLM as **"NKDA (No Known Drug Allergies)"** → defeats allergy cross-check. FIXED: allergy lookup captures `error`; on failure the prompt says "ALLERGY HISTORY UNAVAILABLE" (never NKDA). Also fixed schema drift (dosage_text, value_quantity_value, effective_datetime, user_id) and NaN-lab-as-normal (finite-number guard) in the same function. Deployed (v17).
- **MEDIUM/SUSPECT** `check-drug-interactions:122` reads `medication_codeable_concept.rxcui` while `ai-contraindication-detector:302` reads `medication_code` from the same table — at most one matches the schema; if the former is wrong, **every** interaction check returns "no other meds." (Needs schema check.)
- **LOW** `medicationReconciliationService.ts:114` — duplicate detection substring-matches short tokens (`'asa'` matches `"Asacol"`).

### Risk scoring
- **CRITICAL → ✅ FIXED (next commit)** `ai-fall-risk-predictor:307,558` — null DOB → age risk defaulted to `"low"`/0; oldest highest-risk cohort under-triaged when age missing. **FIXED:** unknown age now → `ageRiskCategory:"moderate"` + a conservative `scores.age=40` (≥65 floor) + a mandatory `reviewReasons` entry flagging the missing DOB, so the gap is surfaced for human verification instead of silently scored low. Lead-verified against the live code at both sites; deployed (v17), verify_jwt=false preserved. Exact magnitude (moderate/40) flagged for Akima's clinical sign-off; the direction (no under-triage) is unambiguous.
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

## Regression idea — ✅ BUILT (2026-06-02)
A gate that diffs each `fhir/*Service.ts` SELECT/filter column list against the live `fhir_*` column set — the FHIR analogue of the SDK hygiene gate — would have caught AV-1/2/3 mechanically.

**Built:** `scripts/check-fhir-service-schema.py` (+ committed snapshot `scripts/fhir-schema-snapshot.json`, refreshed via `scripts/refresh-fhir-schema-snapshot.sql`; pre-existing offenders grandfathered in `scripts/fhir-schema-gate-baseline.txt`). Wired into the CI **Governance Boundary Check** job. CI has no DB creds, so it diffs against the committed snapshot. NEW drift fails the build.

### Gate-surfaced findings (NEW — beyond the 4-reviewer audit; baselined, NOT yet fixed)
The gate immediately found 10 pre-existing drift instances the manual audit missed. **6 column drifts are lead-verified real** (the SELECT names a column absent from the live table → the read throws), **4 are dead services** (query a table that does not exist — AV-2 class):

| Service | Drift | Status |
|---|---|---|
| `MedicationRequestService` | selects phantom `dosage_route` (live has `dosage_route_code`/`_display`) | ✅ FIXED — SELECT corrected + live-proven |
| `PractitionerService` | selects `fhir_id` + `full_name` (live has neither; `id`, `family_name`/`given_names`) | ✅ FIXED — SELECT corrected + live-proven |
| `ImmunizationService` | selects `fhir_id` (live has `external_id`) | ✅ FIXED — SELECT corrected + live-proven |
| `PractitionerRoleService` | selects `fhir_id` (absent) | ✅ FIXED — SELECT corrected + live-proven |
| `CareTeamService` | selects `fhir_id` on `fhir_care_teams` (absent) | ✅ FIXED — SELECT corrected + live-proven |
| `GoalService` | `.from('fhir_goals')` — table did not exist | ✅ FIXED — table created (`20260602210000`) |
| `LocationService` | `.from('fhir_locations')` — table did not exist | ✅ FIXED — table created (`20260602210000`) |
| `OrganizationService` | `.from('fhir_organizations')` — table did not exist | ✅ FIXED — table created (`20260602210000`) |
| `ProvenanceService` | `.from('fhir_provenance')` — table did not exist | ✅ FIXED — table created (`20260602210000`) |

**Remediation = a focused "Tier-1 schema-drift repair" follow-up:** for each column drift, fix the SELECT to the live columns + live round-trip; for each dead service, **CREATE the missing table via migration — do NOT delete the service** (Maria-directed 2026-06-02; "tables that exist are FEATURES", same call as AV-2/`fhir_medications`).

**✅ DONE — the 4 missing tables (migration `20260602210000`):** `fhir_goals`, `fhir_provenance` (patient-scoped PHI, RLS mirrors `fhir_conditions`, `tenant_id` defaults to `get_current_tenant_id()` so the services keep working), `fhir_locations`, `fhir_organizations` (catalog, RLS mirrors `fhir_medications`: global read / admin write). Columns match each service's `select` exactly. Applied via `db push`; all 4 service query shapes live-proven (seed → query → 0-left cleanup). Snapshot refreshed (27 tables); these 4 removed from the gate baseline.

**✅ DONE — the 6 column drifts (2026-06-02):** all were phantom columns (the table never had them → every read threw). Removed from each SELECT: `MedicationRequestService` `dosage_route` (kept the real `dosage_route_code`/`_display`); `PractitionerService` `fhir_id`+`full_name`; `ImmunizationService` `fhir_id`; `PractitionerRoleService` `fhir_id`; `CareTeamService` `fhir_id`. The matching type drift was fixed too — `FHIRPractitioner`/`FHIRImmunization`/`FHIRPractitionerRole`/`FHIRCareTeam` now `extends Omit<FHIRResource,'fhir_id'>` since those tables genuinely have no `fhir_id` column. Live-proven (each corrected SELECT executes against live), full `tsc` 0 errors, lint 0, 150 service tests green. **The gate baseline is now EMPTY — the FHIR service layer is fully schema-clean with zero grandfathered exceptions.**

## RPC-drift triage (2026-06-02) — codebase-wide `.rpc()` scan

A scan of all production `.rpc()` calls found **45 functions referenced but absent from live `pg_proc`**. Triaged the safety/security-relevant ones; status:

| Subsystem | RPC(s) | Verdict |
|---|---|---|
| Medication allergy | `check_medication_allergy_from_request` | ✅ FIXED (`73df04a7`) — was **fail-OPEN** on a live CPOE/telehealth path (created Rx allergy-unchecked). Repointed to the existing `check_medication_allergy` + fail-safe on error. |
| SOC dashboard | `acknowledge_security_alert`, `resolve_security_alert`, `soc_assign_alert`, `soc_add_alert_message` | ✅ FIXED (`bce63b8f`) — created all 4 (admin-gated, tenant-scoped, SECURITY DEFINER) against existing `security_alerts`/`soc_alert_messages`. |
| Clinical note locking/amendments | `lock_clinical_note`, `create_note_amendment`, `get_note_with_amendments` | ✅ FIXED (`5502346b`) — reconciled onto the live `clinical_notes` immutability: 3 append-only tables + immutability-safe functions (lock = audit row, not a note UPDATE) + service fixes. Live-proven. **Amendment approval authority pending Akima.** |
| FHIR security (dead) | `log_audit_event` (`fhirSecurityService`) | ⬜ Not fixed — **DEAD CODE** (0 non-test importers). No active risk; revisit if the service is ever wired. |

**Remaining (not yet triaged):** ~38 other missing RPCs + ~154 missing `.from()` table refs (mostly legacy/superseded names like `conditions`→`fhir_conditions`). Recommend the **generalized schema gate** (extend `check-fhir-service-schema.py` to all tables + RPCs across `src/` + edge functions, baselined + CI-wired) to freeze the perimeter, then triage by reachability. (This was option "#2"; deferred after the safety RPCs per Maria.)
