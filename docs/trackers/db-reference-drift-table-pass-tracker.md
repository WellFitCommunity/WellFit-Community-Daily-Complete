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

- **A1 — Repoint, target CONFIRMED live (17):** a real renamed/legacy table exists. Repoint the caller + live round-trip. SAFEST. Still verify per-caller columns.
- **A2 — Repoint, target NEEDS verification (14):** a look-alike exists but the mapping is risky/per-caller. Verify columns FIRST.
- **S — Maria/Akima-gated (13):** sensitive (law-enforcement, MPI, PHI-decrypt, audit) or deliberately-skipped infra. Do NOT author without sign-off.
- **B/C — long tail, no live match (106):** each is B-create (real feature, author from spec + Maria intent) or C-dead-caller (the service has no importers → Tier-3 delete). Triage per-cluster.
- **False-positive (1):** `table` — see below.

---

## A1 — Repoint, target confirmed live (17) — START HERE

Do these first: lowest risk, highest signal. Repoint `.from('<from>')` → `.from('<to>')`, fix any column drift, live round-trip, remove the baseline line.

| from | → to | callers | note |
|------|------|:------:|------|
| `conditions` | `fhir_conditions` | 1 | classic FHIR legacy rename |
| `immunizations` | `fhir_immunizations` | 1 | |
| `medication_requests` | `fhir_medication_requests` | 2 | |
| `fhir_allergy_intolerances` | `allergy_intolerances` | 7 | reverse: code over-prefixed; live is unprefixed |
| `observations` | `fhir_observations` | 1 | ⚠ verify vs `dental_/ehr_/sdoh_observations` per caller domain |
| `procedures` | `fhir_procedures` | 1 | ⚠ verify vs `dental_procedures` |
| `daily_check_ins` | `check_ins` | 2 | |
| `checkins` | `check_ins` | 1 | |
| `patient_medications` | `medications` | 5 | |
| `payers` | `billing_payers` | 2 | |
| `community` | `community_moments` | 1 | |
| `ai_risk_assessments` | `risk_assessments` | 10 | medium-heavy (10 callers across ai/*, mcp-fhir, enhanced-fhir-export) |
| `codes_cpt` | `code_cpt` | 2 | code-ref table |
| `cpt_codes` | `code_cpt` | 1 | code-ref table |
| `hcpcs_codes` | `code_hcpcs` | 1 | code-ref table |
| `behavioral_anomalies` | `anomaly_detections` | 1 | **KNOWN trap** (same as rpc #25) |
| `clinician_time_tracking` | `time_clock_entries` | 1 | **KNOWN trap** (same as rpc #23/#24) |

---

## A2 — Repoint, verify target first (14)

| from | candidate → | callers | why verify |
|------|------------|:------:|-----------|
| `patients` | `profiles` \| `fhir_patient_bundle` \| `app_patients` | **12** | HIGH impact, per-caller (billing/encounter/quality-measures/law-enforcement). Demographics→profiles; FHIR→fhir_patient_bundle. fhir_patients does NOT exist. |
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

## False-positive (1)

- **`table` [2 callers]** — NOT a real reference. Both hits are inside string/comment examples: a code-example string literal in `src/services/guardian-agent/RealHealingImplementations.ts:101` and a JSDoc comment in `supabase/functions/_shared/mcpQueryTimeout.ts:10`. **Leave baselined** (harmless) OR improve the gate regex to skip comments/strings (the cleaner fix — `check-db-reference-drift.py` matches `.from('table')` inside text). Do NOT author a `table` table.

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
- **2026-06-11 — SCOPED + 2 stale removed.** Live-verified all 153; removed `encounter_providers` + `encounter_provider_audit` (created in rpc Batch 3, never de-baselined). Bucketed the remaining 151 (A1=17 / A2=14 / S=13 / false-positive=1 / B-C tail=106). Confirmed repoint targets live (code_cpt/hcpcs/modifiers, risk_assessments, fhir_* legacy set, check_ins, medications, billing_payers, anomaly_detections, time_clock_entries) and confirmed-absent (fhir_patients, code_icd, risk_assessments_decrypted). Gate exit 0. **151 to go.**
