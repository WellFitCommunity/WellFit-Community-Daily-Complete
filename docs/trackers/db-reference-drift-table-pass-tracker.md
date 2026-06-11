# DB-Reference Drift Triage — `table::` half (second pass)

> **Source of truth:** `scripts/db-reference-drift-baseline.txt` (live: `grep -c '^table::'`).
> **Gate:** `python3 scripts/check-db-reference-drift.py` (must stay exit 0).
> **Sibling (the `rpc::` half, now 11 left):** `docs/trackers/db-reference-drift-triage-tracker.md`.
> **Scoped:** 2026-06-11. **Recipe:** grep caller → live-verify target → bucket → fix → remove baseline line → refresh snapshot → re-run gate → scoped tsc/lint/test → commit.

These are `.from('<name>')` targets referenced in production code (`src/` + `supabase/functions/`, excluding tests) that are **absent from the live DB**. Every entry HAS at least one caller (the gate only baselines *referenced* missing names — there are no zero-caller entries).

---

## 🚨 Carryover warnings (read before touching anything)

1. **NAME-COLLISION TRAPS — live-verify EVERY target before repointing.** The `rpc::` pass guessed wrong **5 times** (patient_consents→privacy_consent, clinician_time_tracking→time_clock_entries, behavioral_anomalies→anomaly_detections, documentation_templates→questionnaire_templates, …). The "→ target" suggestions below are HYPOTHESES from name similarity + a one-shot live existence check. Before repointing a caller, query `information_schema.columns` for the proposed target and confirm the caller's selected/inserted columns actually exist there. A repoint that compiles can still be silently wrong (CLAUDE.md #18, #19).
2. **Two systemic root causes still apply** (documented in the `rpc::` tracker): `-- migrate:down` self-destructs and `20251209110000_drop_broken_functions.sql`. For a B-create, run the migrate:down forensic (`git log -p --all -S '<name>' -- supabase/migrations/`) before authoring.
3. **Maria's standing directive (2026-06-04):** restore the feature set properly — don't delete; find purpose, check if replaced, rebuild if not. Deleting a caller (C-dead) is Tier-3 → ask.
4. **`db push`, NOT MCP `apply_migration`** (MCP wall-clock timestamps cause registry drift). Refresh `scripts/db-objects-snapshot.json` after any migration (`refresh-db-objects-snapshot.sql`).

---

## Live-verified state (2026-06-11)

- Baseline started at **153**. **2 were STALE** — `encounter_providers` + `encounter_provider_audit` were created in `rpc::` Batch 3 (`20260604000000`) but never removed from the `table::` baseline. ✅ **Removed (no migration — already live + in snapshot); gate exit 0. → 151 remain.**
- The other **151 are genuinely missing live** (confirmed via `information_schema.tables`).

---

## Buckets

- **A1 — Repoint (was "17 confirmed-live"; COLUMN-VERIFIED 2026-06-11):** ✅ **3 DONE** (code-ref fallbacks). The remaining 14 were **NOT clean** — re-classified: 6 → **A3 (repoint + column rewrite)**, 6 → re-bucketed (patient_id/user_id mismatch ×2, wrong-target ×4), 1 → false-positive (`community` = storage bucket), 1 → heavy (`ai_risk_assessments`). See the A1 section.
- **A2 — Repoint, target NEEDS verification (14, minus `icd10_codes` done = 13):** a look-alike exists but the mapping is risky/per-caller. Verify columns FIRST (the A1 lesson applies double here).
- **A3 — Repoint + column rewrite (was 7; 2 DONE → 5 left):** target exists, exact column fixes documented in the A1 section. Mechanical but per-caller; quality-measures cluster (conditions/observations/procedures) has CQM implications — verify downstream usage. `behavioral_anomalies` + `checkins` done 2026-06-11.
- **S — Maria/Akima-gated (13):** sensitive (law-enforcement, MPI, PHI-decrypt, audit) or deliberately-skipped infra. Do NOT author without sign-off.
- **B/C — long tail, no live match (106 + the 4 wrong-target re-bucketed from A1):** each is B-create (real feature, author from spec + Maria intent) or C-dead-caller (the service has no importers → Tier-3 delete). Triage per-cluster.
- **False-positive (2):** `table`, `community` (storage bucket) — see below.

---

## A1 — Repoint (was "17 confirmed-live"; COLUMN-VERIFIED 2026-06-11)

> 🚨 **FINDING (2026-06-11): name-similarity ≠ schema-compatibility.** I read every caller's actual `.select()`/`.insert()`/`.eq()` columns and compared to the live target. **Only 3 of the 17 were truly clean repoints.** The other 14 have column/PK divergence — repointing them blindly would compile and then break (or silently return nothing), exactly the trap warning #1 predicts. The dominant failure mode: callers use **`patient_id`** but the legacy/community targets key on **`user_id`** (the AV-1 audit pattern), and FHIR-shaped callers expect structured columns the flat tables lack. Re-classified below. **The "do A1 first because it's clean" assumption was wrong — most of A1 is really A3 (repoint + column rewrite) or B-create (wrong target).**

### ✅ DONE — clean repoints (3, commit pending)
All in `mcp-medical-codes-server/toolHandlers.ts` (the legacy-table *fallback* branches; primary path already uses the `code_*` tables). Each selects only `code, description` — both confirmed present on the target. Live round-trip proven. ⏳ needs `mcp-medical-codes-server` redeploy to take effect.

| from | → to | callers | status |
|------|------|:------:|--------|
| `cpt_codes` | `code_cpt` | 1 | ✅ repointed |
| `hcpcs_codes` | `code_hcpcs` | 1 | ✅ repointed |
| `icd10_codes` | `code_icd10` | 1 | ✅ repointed (target is `code_icd10`, NOT `code_icd` which doesn't exist) |

### A3 — repoint NEEDS COLUMN REWRITE (target exists, columns diverge)
Per-entry the exact column fixes are known (below). These are mechanical but must rewrite the caller's selected columns; some have clinical/CQM implications (the quality-measures cluster) so verify downstream logic uses the remapped fields.

| from | → to | callers | column fixes required |
|------|------|:------:|----------------------|
| ✅ ~~`conditions`~~ | `fhir_conditions` | 1 (patientEvaluation) | **DONE 2026-06-11.** Aliased select `onset_date:onset_datetime, status:clinical_status` (downstream shape unchanged); filter → `.eq('clinical_status','active')`. |
| ✅ ~~`observations`~~ | `fhir_observations` | 1 (patientEvaluation) | **DONE 2026-06-11.** Aliased `value:value_quantity_value, unit:value_quantity_unit, effective_date:effective_datetime`; `.gte/.lte` → real `effective_datetime`. |
| ✅ ~~`procedures`~~ | `fhir_procedures` | 1 (patientEvaluation) | **DONE 2026-06-11.** Aliased `performed_date:performed_datetime`; `.gte/.lte` → real `performed_datetime`. |
| ✅ ~~`medication_requests`~~ | `fhir_medication_requests` | 2 | **DONE 2026-06-11.** patientEvaluation caller CLEAN (id, medication_code, status, authored_on all exist). MedicationManager.tsx: aliased `dispense_valid_from:validity_period_start, dispense_number_of_repeats:number_of_repeats_allowed`; **`drug_class` dropped** (no equivalent on the FHIR table) — high-risk detection falls back to `medication_display` matching, `drugClass` shows `'unclassified'`. |
| ✅ ~~`codes_cpt`~~ | `code_cpt` | 4 (billing-decision-tree) | **DONE 2026-06-11.** procedureLookupNode: `long_desc`→`long_description`, `short_desc`→`short_description` (+`ilike`). feeScheduleNode: aliased `practice_rvu:non_facility_pe_rvu, malpractice_rvu:mp_rvu` (non-facility PE = outpatient/office place-of-service); `work_rvu` unchanged. |
| ✅ ~~`behavioral_anomalies`~~ | `anomaly_detections` | 1 | **DONE 2026-06-11.** Repointed via PostgREST column aliases (`anomaly_type:event_type, severity:risk_level, description:investigation_notes`) — no type/downstream change. Test mock retargeted; 38/38 green. |
| ✅ ~~`checkins`~~ | `check_ins` | 1 | **DONE 2026-06-11.** `additional_notes`→`notes`, `location`→`metadata.location`. **Repoint surfaced a real bug: the SOS insert never set `check_ins.tenant_id` (NOT NULL) — it had been failing.** Added a `profiles.tenant_id` resolve before the insert; live-proven (rolled-back insert accepts the shape). |

### Re-bucketed OUT of A1 (NOT repoints)
- **`patient_id`↔`user_id` + flat-vs-FHIR mismatch (→ clinical, ties to AV-1/AV-2 audit):**
  - `patient_medications` → `medications`: target PK is **`user_id`**, callers filter `.eq('patient_id', …)`; column sets differ. 5 callers. NOT a rename.
  - `fhir_allergy_intolerances` → `allergy_intolerances`: target PK **`user_id`**, flat `allergen_name`/`allergen_code` vs callers' FHIR-structured `code.coding[]`; 7 callers filter `patient_id`. This **IS the AV-1 finding** — callers expect a FHIR allergy table that doesn't exist. → coordinate with the clinical-audit tracker, not a mechanical repoint.
- **Wrong target (→ B-create or different table):**
  - `immunizations` → ~~fhir_immunizations~~: `immunizations` is a **registry-submission tracker** (`registry_status`, `registry_submission_id`, joins `patients`), NOT the FHIR cache. 2 callers (immunization-registry-submit). B-create or repoint to the real registry table.
  - `clinician_time_tracking` → ~~time_clock_entries~~: caller INSERTs handoff-efficiency cols (`action_type`, `epic_benchmark_seconds`, `ai_confidence_score`, `complexity_level`) that **don't exist** on the clock-in/out `time_clock_entries`. Different feature → B-create. (The rpc-pass trap mapping applied to the time-*entries* RPCs, NOT this handoff-metrics writer.)
  - `daily_check_ins` → ~~check_ins~~: callers select `mood`/`mood_score`/`checked_in_at`/`completed` — none exist on the vitals `check_ins`. Different (mood-tracking) schema. 2 callers. B-create or find the real table.
  - `payers` → `billing_payers`: caller selects `medicare_multiplier` — absent on billing_payers. 2 callers (feeScheduleNode, generate-837p). Needs a different source or column add.
- **False-positive:** `community` — it's `supabase.storage.from('community')` (a **storage bucket**, not a table). Moved to the false-positive list. Leave baselined (or exclude `storage.from` in the gate regex).
- **Heavy / needs detailed verification:** `ai_risk_assessments` → `risk_assessments` (14 refs incl. INSERTs across ai/*, mcp-fhir, bulk-export, enhanced-fhir-export). risk_assessments has `patient_id`/`risk_level`/`overall_score` but the INSERT payloads need column-by-column reconciliation. Medium-heavy; do as its own batch.

---

## A2 — Repoint, verify target first (14)

| from | candidate → | callers | why verify |
|------|------------|:------:|-----------|
| `patients` | `profiles` (canonical) | **8 live callers, 3 DONE / 5 open** | **IN PROGRESS 2026-06-11 (fifth).** All 8 callers LIVE-reachable (none dead). **Approach decided = profiles is canonical, route each consumer to its real owning table** (rejected unified view + dedicated table — see progress note). profiles is keyed on `user_id` (rule #8 — pre-commit gate enforces it; do NOT `.eq('id',…)`); aliased `id:user_id` keeps downstream shapes. **✅ 3 clean single-patient repoints DONE** (live-proven): `patientEvaluation` (`date_of_birth:dob` alias — this also completes the A3 eCQM dependency flagged in `fc9b75e9`), `qrdaIExport` (`address_line1:address`,`postal_code:zip_code`,`date_of_birth:dob`), `unifiedBillingService` (existence). **⏳ 5 open — surfaced to Maria (need real decisions, not engineering):** `batchCalculation` (population def: who is a "patient" in profiles? role='senior'? — clinical/Akima), `ai…/patientContext` (`primary_language` lives on `senior_demographics`, not profiles), `eligibilityNode` (`insurance_payer_id`/`_member_id`/`_status` exist on NO live table — billing data gap), `encounterService` (CRUD incl. `ssn`/`member_id` profiles lacks + INSERT/UPDATE write-path), `lawEnforcementService` (`full_name`/`emergency_contacts` + FK joins to check_ins/law_enforcement_response_info; **sensitive/S-gated**). Entry clears only when all 5 resolved. |
| `icd10_codes` | ICD code table | 1 | **`code_icd` does NOT exist** — find the real ICD table (`code_icd10`? `codes_icd`?) before repointing |
| `codes_icd10` | ICD code table | 1 | pair of above |
| `emergency_contacts` | `senior_emergency_contacts` \| `mobile_emergency_contacts` | 3 | two live variants — pick per caller |
| `cognitive_assessments` | `neuro_cognitive_assessments` | 1 | plausible; verify columns |
| `functional_assessments` | `pt_functional_assessments` | 1 | plausible; verify columns |
| `fhir_patients` | `fhir_patient_bundle` | 1 | ⚠ shape differs (flattened cols vs jsonb bundle) — likely **obsolete**, not a repoint (rpc Batch 13 finding) |
| `admin_audit_log` | `admin_audit_logs`? | 2 | plural exists; confirm it's the same concept |
| `avatars` | `patient_avatars`? | 1 | plausible |
| `caregiver_access` | `caregiver_access_log`? | 1 | weak — "access" (grant) vs "access_log" (audit) are different |
| `admin_notes` | `admin_notes_audit`? | 2 | weak — note vs audit |
| `notifications` | ? | 2 | weak guess (`breach_notifications` ≠ generic notifications) — inspect callers |
| `users` | `profiles` \| `auth.users`? | 2 | inspect — likely should be `profiles` (user_id PK) |
| `user_tenants` | ? | 1 | likely a join table that was renamed/removed — inspect |

---

## S — Maria/Akima-gated (13) — do NOT author without sign-off

| cluster | entries | gate |
|---------|---------|------|
| **Law-enforcement / welfare** | `welfare_check_access_log`, `welfare_check_analytics`, `welfare_check_priority_queue`, `emergency_response_briefings`, `ems_handoffs` | sensitive; pairs with `rpc::` #17/#27 — Maria/Akima |
| **Master Patient Index** | `mpi_identity_records` (3c), `mpi_match_candidates` (2c), `mpi_matching_config`, `mpi_merge_history` | identity-matching subsystem — needs Maria intent (don't invent matching logic) |
| **Skipped caching infra** | `billing_code_cache`, `cultural_content_cache` | deliberately-SKIPPED migration; pairs with `rpc::` #30/#31 — Maria's call before un-skipping |
| **PHI / audit integrity** | `risk_assessments_decrypted` (decrypted view — encryption layer, Akima), `phi_access_audit` (verify vs `phi_access_logs` — don't fork the audit trail) | Akima |

---

## False-positive (2)

- **`table` [2 callers]** — NOT a real reference. Both hits are inside string/comment examples: a code-example string literal in `src/services/guardian-agent/RealHealingImplementations.ts:101` and a JSDoc comment in `supabase/functions/_shared/mcpQueryTimeout.ts:10`. **Leave baselined** (harmless) OR improve the gate regex to skip comments/strings (the cleaner fix — `check-db-reference-drift.py` matches `.from('table')` inside text). Do NOT author a `table` table.
- **`community` [1 caller]** — NOT a table. It's `supabase.storage.from('community').getPublicUrl(...)` in `src/components/features/PhotoGallery.tsx:175` — a **Storage bucket**, which the gate regex can't distinguish from `.from('<table>')`. **Leave baselined** OR teach the gate to skip `storage.from(`. Do NOT author/repoint.

---

## B/C — long tail (106), grouped by feature for pickability

Each is **B-create** (real feature → migrate:down forensic + author from spec; confirm intent with Maria) or **C-dead-caller** (service has no importers → Tier-3 delete, ask). Per entry: (1) grep the caller; (2) check if the caller's service/component has any importer (dead vs live); (3) forensic the migration history; (4) decide create-vs-repoint-vs-dead.

- **Wearables / RPM** (governance "known gaps"): `wearable_apple_health_activity`, `_devices`, `_ecg`, `_falls`, `_sleep`, `_vitals`, `patient_devices`, `device_tokens`, `patient_vitals`, `health_data`, `movement_patterns`
- **FHIR sync layer**: `fhir_allergies`, `fhir_appointments`, `fhir_bundles`, `fhir_medication_statements`, `fhir_patient_mappings`, `fhir_sync_conflicts`, `fhir_sync_log`, `fhir_sync_logs`, `ai_fhir_mappings`, `document_references` (several may repoint to existing `fhir_*` — verify each)
- **Billing / codes**: `billing_codes`, `coding_rules`, `billing_optimization_history`, `encounter_billing_suggestions` (7c), `medication_affordability_checks`
- **Care coordination / tasks**: `care_coordination_alerts` (3c), `care_coordination_events` (2c), `clinical_recommendations`, `ccm_eligibility_assessments` (3c), `provider_tasks` (2c), `provider_task_escalation_config`, `v_provider_task_queue`
- **Patient clinical**: `patient_allergies`, `patient_conditions`, `patient_diagnoses` (5c), `patient_procedures`, `patient_appointments`, `patient_risk_registry` (2c), `adverse_events`, `discharge_summaries`, `medication_records`, `medication_safety_alerts`, `appointments` (2c), `appointment_reminders`
- **Neuro registry**: `parkinsons_patient_registry`, `parkinsons_updrs`
- **CHW / geo / outreach**: `geofence_events`, `geofence_zones`, `field_visit_metrics`, `outreach_logs`
- **Admin / chat / workflow prefs**: `admin_actions`, `admin_chat_feedback`, `admin_chat_sessions`, `admin_profile_view_logs` (2c), `admin_workflow_preferences`, `nurse_workflow_preferences`, `security_workflow_preferences`
- **Community / engagement**: `community_photos` (2c), `meals`, `meal_images`, `posts`, `messages`, `personalized_content_delivery`, `communication_silence_window`, `user_consecutive_missed_days`, `user_notifications`, `system_notifications`
- **SDOH / equity**: `sdoh_indicators` (6c), `sdoh_flags`, `health_equity_metrics`, `hpsa_designations`, `zip_ruca_codes`
- **Security / monitoring**: `security_events_analysis`, `security_monitoring_dashboard`, `incident_response_queue`, `system_errors`, `interaction_log`, `compliance_status`, `encryption_status_view`
- **AI / MCP infra**: `ai_assistant_interactions`, `ai_response_reports`, `ai_schedule_optimizations` (2c), `ai_shift_handoff_summaries` (2c), `ai_usage_log`, `mcp_batch_metrics`, `chain_steps`, `adapter_connections`, `alert_effectiveness`, `cultural_content_analytics`
- **Pills / meds imaging**: `pill_identifications`, `pill_label_comparisons`, `medical_transcripts`, `temp_vital_images` (3c)
- **Emergency / handoff**: `emergency_alerts` (2c), `emergency_briefing_access_log`, `emergency_briefing_analytics`, `handoff_notifications`, `handoff_notification_failures`
- **Caregiver / misc**: `caregiver_relationships`, `ecr_submissions` (2c), `exports`, `public_data`, `health_data`, `mv_discharged_patient_dashboard`, `v_active_mental_health_patients`, `v_connection_health_dashboard`

---

## Recommended execution order

1. **A1 repoints (17)** — cheapest, safest. Probably 2–3 batches (cluster the FHIR-legacy ones; the code-ref ones; the two known traps). The 10-caller `ai_risk_assessments` and 7-caller `fhir_allergy_intolerances` are the heaviest A1s.
2. **A2 — `patients` (12c)** — highest-impact single repoint; do it carefully per-caller after A1.
3. **A2 remainder** — verify each target, repoint or re-bucket.
4. **B/C tail by cluster** — pick a feature cluster, decide create-vs-dead per Maria's intent. Start with clusters that are clearly real features with live siblings (FHIR sync, SDOH, care-coordination).
5. **S-gated** — only after Maria/Akima give per-cluster calls (law-enforcement, MPI, caching infra, PHI-decrypt/audit).

> **Litmus test (airtight):** a fresh Claude can take any A1 row, grep its one caller, query `information_schema.columns` on the target, repoint, live round-trip, drop the baseline line, and re-run the gate — without asking a question.

## Progress
- **2026-06-11 (fifth) — A2 `patients` STARTED: 3 of 8 live callers repointed to `profiles`.** Scoped the whole entry: all 8 `.from('patients')` callers are LIVE-reachable (UI panels, FHIR wrappers, 11 AI edge fns) — NONE dead. **Engineering decision (Maria asked for the professional call): `profiles` is the canonical patient store (governance S1); route each consumer to its real owning table — REJECTED (a) a unified `patients` view (callers don't share one coherent shape → would become a god-view over 4+ tables, several nonexistent, and can't make encounterService writes work) and (b) a dedicated `patients` table (fractures single-source-of-truth).** Did the 3 unambiguous single-patient-by-id repoints (live-proven vs real profiles row MRN001/John Doe): `patientEvaluation`, `qrdaIExport`, `unifiedBillingService`. scoped tsc 0 (3 files, 0 project-wide) / lint 0 / gate exit 0. baseline stays 141 (entry needs all 8). **5 open callers surfaced to Maria** — each needs a real decision (clinical population def / data that exists on no live table / write-path / sensitive law-enforcement), NOT a mechanical repoint: `batchCalculation`, `ai…/patientContext`, `eligibilityNode`, `encounterService`, `lawEnforcementService`. See the A2 `patients` row.
- **2026-06-11 (fourth) — A3 bucket FINISHED: last 5 done (`conditions`, `observations`, `procedures`, `medication_requests`, `codes_cpt`).** All targets live-column-verified before editing (`fhir_conditions`/`fhir_observations`/`fhir_procedures`/`fhir_medication_requests`/`code_cpt`); all 6 repointed query shapes live-proven (real columns + filters resolve, 0-row OK). PostgREST aliases used throughout to keep downstream shapes stable (no type churn). `drug_class` dropped on MedicationManager (no FHIR equivalent; graceful fallback). feeScheduleNode PE-RVU → `non_facility_pe_rvu` (outpatient PoS). Files: `patientEvaluation.ts`, `procedureLookupNode.ts`, `feeScheduleNode.ts`, `MedicationManager.tsx`. baseline 146→141; gate exit 0; scoped tsc 0 (4 files, 0 project-wide) / lint 0; no tests reference the changed modules. **⚠️ `patientEvaluation.getPatientDataForMeasure` still queries `.from('patients')` FIRST (A2, table absent) → the eCQM path is NOT end-to-end functional until the A2 `patients` repoint lands (it's 1 of the 12 `patients` callers). The 4 A3 refs here are correct but the function gates on A2.** A3 bucket now COMPLETE (7/7). **141 to go; next bucket = A2 (`patients` 12-caller repoint is highest-impact).**
- **2026-06-11 (third) — A3: 2 done (`behavioral_anomalies`, `checkins`).** `behavioral_anomalies`→`anomaly_detections` via PostgREST column aliasing (no type/downstream churn; test mock retargeted, 38/38 green). `checkins`→`check_ins` (`additional_notes`→`notes`, `location`→`metadata.location`) — **the repoint exposed that the Wearable SOS insert never set `check_ins.tenant_id` (NOT NULL) so the emergency check-in had been failing; fixed by resolving `profiles.tenant_id` first.** Both live-proven (anomaly aliases resolve; rolled-back check_ins insert accepts the shape + tenant_id). baseline 148→146; gate exit 0; scoped tsc 0 (3 files) / lint 0 / 38 tests green. **146 to go.**
- **2026-06-11 (second) — A1 column-verified + 3 clean repoints DONE.** Read every A1 caller's actual columns vs the live target: **only 3 of 17 were clean.** Repointed the 3 code-ref fallbacks in `mcp-medical-codes-server/toolHandlers.ts` (`cpt_codes`→`code_cpt`, `hcpcs_codes`→`code_hcpcs`, `icd10_codes`→`code_icd10`; each selects `code, description`, both confirmed live; live round-trip returns real rows). Removed 3 baseline lines; gate exit 0. ⏳ **needs `mcp-medical-codes-server` redeploy** to take effect live. **Re-classified the other 14** (the A1 table above): 6 → A3 (column rewrite, per-entry fixes documented), 2 → patient_id/user_id clinical mismatch (AV-1 tie-in), 4 → wrong-target B-create (`immunizations`, `clinician_time_tracking`, `daily_check_ins`, `payers`), 1 → false-positive (`community` = storage bucket), 1 → heavy (`ai_risk_assessments`, 14 refs). **Lesson: name-similarity ≠ schema-compatibility — verify columns before every repoint.** **148 to go.**
- **2026-06-11 — SCOPED + 2 stale removed.** Live-verified all 153; removed `encounter_providers` + `encounter_provider_audit` (created in rpc Batch 3, never de-baselined). Bucketed the remaining 151 (A1=17 / A2=14 / S=13 / false-positive=1 / B-C tail=106). Confirmed repoint targets live (code_cpt/hcpcs/modifiers, risk_assessments, fhir_* legacy set, check_ins, medications, billing_payers, anomaly_detections, time_clock_entries) and confirmed-absent (fhir_patients, code_icd, risk_assessments_decrypted). Gate exit 0. **151 to go.**
