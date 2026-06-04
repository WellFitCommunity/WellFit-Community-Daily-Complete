# DB-Reference Drift Triage Tracker — `rpc::` half

> **Source of truth:** `scripts/db-reference-drift-baseline.txt` (live: `grep -c '^rpc::'`).
> **Gate:** `python3 scripts/check-db-reference-drift.py` (must stay exit 0).
> **Started:** 2026-06-03. **Recipe:** grep caller → bucket → fix → remove baseline line → re-run gate → scoped typecheck/lint/test → commit.

## 🚨 SYSTEMIC FINDING (2026-06-04) — self-destructing `-- migrate:down` blocks
40 migration files carry a dbmate/golang-migrate `-- migrate:down` block **after** the up-section `COMMIT;`. Supabase CLI (`supabase db push`) does NOT split on `-- migrate:up`/`-- migrate:down` markers — it executes the **entire file**. Any such migration that was applied via `db push` (rather than dbmate) created its objects and then **immediately dropped them in the same run**, while `schema_migrations` recorded success. This is a likely root cause for a chunk of the B-restore baseline (objects "applied" per the registry but absent from live). **Triage implication:** for every B-restore, the forensic isn't "who dropped it" — check whether the defining migration has a `migrate:down` block; if so and the objects are absent live, the fix is a NEW forward migration containing the up-section ONLY (no down block). A plain `db push` of the original will NOT help — its version is already in the registry and will be skipped. Most older `migrate:down` migrations did NOT self-destruct (their objects exist live — they were applied via dbmate, which honors the markers); verify per-object against live, don't assume. List: `grep -rln "migrate:down" supabase/migrations/`.

## Buckets
- **A — repoint** (live object exists with matching shape): one-line rename or `.rpc()`→`.from()`. SAFE, do immediately.
- **B-restore** (defined in a migration file but ABSENT from live = drift): restore IS legitimate, BUT first run the **DRIFT forensic** — `git log -p --all -S '<name>' -- supabase/migrations/` to learn *why* it's absent (deliberately dropped vs. unapplied/superseded migration). Only re-create if the drop was unintentional. Live-verify after `db push`.
- **B-author** (never defined anywhere, 0 migration history): needs a NEW function authored from spec. Counters are trivial; analytics/clinical ones (`calculate_*`, engagement) need real logic — confirm intent with Maria before inventing algorithms.
- **C — dead**: 0 reachable callers OR known-dead. Either remove the dead caller (Tier-3 delete → ask) or leave baselined with a note.

## Progress
- **DONE (Batch 1, commit `c24cf90b`):** `calculate_functional_improvement`→`calculate_pt_functional_improvement`; `evaluate_discharge_readiness`→`evaluate_pt_discharge_readiness`; `get_bed_board_view`→view `v_bed_board`; `get_unit_capacity_summary`→view `v_unit_capacity`. **4 down, 36 to go.**
- **DONE (Batch 3 — encounter-provider cluster, #2 + #35):** `assign_encounter_provider` + `remove_encounter_provider`. **DRIFT forensic uncovered a systemic root cause (see SYSTEMIC FINDING below):** migration `20260212000001_encounter_provider_assignment.sql` is registered APPLIED in `schema_migrations` but ALL its objects were absent from live (no `encounter_providers`/`encounter_provider_audit` tables, no enum, no functions). Cause: the file carries a `-- migrate:down` block (dbmate syntax) after the up COMMIT; `supabase db push` runs the whole file, so it created everything then dropped it in the same run. Feature is REACHABLE (admin `EncounterProviderPanel`/`ProviderAssignmentDashboard` + CPOE `useOrderingProvider`), so this was a genuine live gap. Restored via new forward migration `20260604000000_restore_encounter_provider_assignment.sql` (up-section only, no down block; idempotent). All deps verified live first (encounters, billing_providers, is_admin, set_updated_at, + sibling state-machine objects which did NOT self-destruct). `transition_encounter_status` signature matched live → CREATE OR REPLACE upgraded it in place to add provider validation. Pushed + live-proven: all 8 objects exist, RLS on, and all 3 functions execute end-to-end (assign→NOT_FOUND, validate→PROVIDER_REQUIRED proving the `encounter_providers` SELECT works, remove→NOT_FOUND). Snapshot refreshed (755 tables / 1448 fns). 28 service tests green. **33 to go.**
- **DONE (Batch 4 — fhir-procedure cluster, #11 + #20):** `get_billable_procedures` + `get_procedures_by_encounter`. Same self-destruct root cause (`20251017100003_fhir_procedure.sql` migrate:down), but only PARTIALLY recovered: the next-day `20251018000000_ensure_fhir_procedures_exists.sql` restored the `fhir_procedures` table + `get_recent_procedures` only, leaving these 2 (and 2 uncalled siblings) absent. Restored the 2 CALLED helpers via `20260604000001_restore_fhir_procedure_query_functions.sql` (verbatim bodies + `SET search_path=public` hardening). All 6 referenced columns verified on the LIVE table first (it came from the ensure_exists migration, not the original). Live-proven: both execute against live schema (0 rows for a random uuid). 17 ProcedureService tests green. **31 to go.**
- **DONE (Batch 2):** #34 `log_audit_event` (C/B-repoint). The RPC is dead in live DB (`log_security_event` + `log_phi_access` exist; `log_audit_event` does not). Repointed `fhirSecurityService.AuditLogger.log` from the dead `.rpc('log_audit_event')` to a direct `audit_logs` insert mirroring the canonical `auditLogger` path: reads the session and writes `actor_user_id` explicitly (INSERT RLS requires `actor_user_id = auth.uid()`), skips silently when unauthenticated, and replaces the two **empty** `if (error) {}` / `catch {}` blocks (silent-failure, CLAUDE.md violation) with RLS-safe handling that reports unexpected errors via canonical `auditLogger.error`. Verified live: `audit_logs` has the full column set incl. `target_user_id`; INSERT policy `audit_logs_authenticated_insert` = `WITH CHECK (actor_user_id = auth.uid())`. Class is near-dead (only its own test imports it) but exported + tested; 76 tests rewritten to assert the insert path, all green. Scoped typecheck 0, lint 0. **35 to go.**

## Remaining 36 (caller file:line · migration-defs · bucket)

| # | rpc:: name | caller | migdefs | bucket | note |
|---|-----------|--------|:------:|--------|------|
| 1 | aggregate_disparities_by_demographic | HealthEquityService.ts:89 | 0 | B-author | health-equity analytics |
| 2 | ~~assign_encounter_provider~~ | encounterProviderService.ts:51 | 1 | ✅ **DONE** | Batch 3. Restored via `20260604000000` (self-destruct migrate:down root cause). |
| 3 | auto_generate_clinical_data_for_hospital_patient | PaperFormScanner.tsx:269 | 1 | B-restore | |
| 4 | calculate_health_equity_metrics | HealthEquityService.ts:15 | 0 | B-author | analytics |
| 5 | calculate_readmission_risk_score | dischargePlanningService.ts:47 | 1 | B-restore | **clinical risk algo — verify logic** |
| 6 | check_sensitive_consent | sensitiveDataService.ts:254 | 1 | B-restore | **HIPAA consent gate — fail-closed** (sig p_patient_id, p_segment_type, p_purpose) |
| 7 | create_fhir_patient_from_profile | sms-verify-code/index.ts:454 | 1 | B-restore | edge fn |
| 8 | decrement | betaProgramService.ts:557 | 0 | B-author | counter helper (`{x:1}` idiom — verify) |
| 9 | deploy_questionnaire_to_wellfit | fhirQuestionnaireService.ts:248 | 1 | B-restore | |
| 10 | generate_patient_lab_token | labResultVaultService.ts:318 | 1 | B-restore | **security token gen** |
| 11 | ~~get_billable_procedures~~ | fhir/ProcedureService.ts:170 | 1 | ✅ **DONE** | Batch 4. Restored via `20260604000001`. |
| 12 | get_clearinghouse_credentials | ClearinghouseConfigPanel.tsx:41 | 1 | B-restore | **reads secrets — check RLS/role** |
| 13 | get_dementia_patients_due_for_assessment | neuroSuiteService.ts:836 | 2 | B-restore | |
| 14 | get_direct_reports | employeeService.ts:276 | 3 | B-restore | |
| 15 | get_employee_by_number | employeeService.ts:447 | 3 | B-restore | |
| 16 | get_expiring_consents | consentManagementService.ts:499 | 2 | B-restore | |
| 17 | get_missed_check_in_alerts | lawEnforcementService.ts:189 | 2 | B-restore | |
| 18 | get_nurse_bypass_count_last_7_days | shiftHandoffService.ts:266 | 1 | B-restore | sibling of the SH bypass rebuild (`20260527025413`) — check if count fn was meant to land there (sig p_nurse_id) |
| 19 | get_patient_engagement_metrics | api/metrics.ts:23 | 0 | B-author | table `patient_engagement_metrics` + view `patient_engagement_scores` exist; caller needs a `(_tenant,_user)` fn |
| 20 | ~~get_procedures_by_encounter~~ | fhir/ProcedureService.ts:84 | 1 | ✅ **DONE** | Batch 4, pair of #11. |
| 21 | get_questionnaire_stats | fhirQuestionnaireService.ts:292 | 1 | B-restore | |
| 22 | get_slow_queries | guardian-agent/index.ts:208 | 0 | B-author | pg_stat_statements wrapper |
| 23 | get_team_time_entries | timeClockService.ts:360 | 2 | B-restore | manager→reports logic (sig p_manager_user_id,p_tenant_id,dates) |
| 24 | get_tenant_time_entries | timeClockService.ts:326 | 2 | B-restore | tenant-wide (sig p_tenant_id,dates,p_limit) |
| 25 | get_uninvestigated_anomalies | behavioralAnalyticsService.ts:337 | 1 | B-restore | |
| 26 | get_vulnerability_summary | ComplianceDashboard.tsx:76 | 1 | B-restore | |
| 27 | get_welfare_check_info | lawEnforcementService.ts:97 | 2 | B-restore | |
| 28 | identify_high_burden_caregivers | neuroSuiteService.ts:719 | 2 | B-restore | |
| 29 | increment | nurseos/resourceService.ts:70 | 0 | B-author | counter helper — verify arg shape |
| 30 | increment_billing_cache_hit | ai/billingCodeSuggester.ts:444 | 1 | B-restore | cache counter |
| 31 | increment_cultural_cache_hit | ai/culturalHealthCoach.ts:422 | 0 | B-author | cache counter |
| 32 | increment_template_usage | fhirQuestionnaireService.ts:237 | 0 | B-author | usage counter on documentation_templates |
| 33 | increment_visits_used | ptTreatmentPlanService.ts:251 | 0 | **C-dead** | 0 callers of `incrementVisitsUsed`; `increment_pt_visits` trigger auto-increments. Delete dead method (Tier-3 ask) or leave baselined. |
| 34 | ~~log_audit_event~~ | fhirSecurityService.ts:361 | 2 | ✅ **DONE** | Repointed to direct `audit_logs` insert (actor_user_id from session; RLS-safe; silent-failure blocks fixed). See Progress Batch 2. |
| 35 | ~~remove_encounter_provider~~ | encounterProviderService.ts:120 | 1 | ✅ **DONE** | Batch 3, pair of #2. |
| 36 | update_clearinghouse_config | ClearinghouseConfigPanel.tsx:68 | 1 | B-restore | pair of #12 |

## Suggested execution order (next sessions)
1. **C items first** (#33, #34) — cheap, removes silent-failure: repoint `log_audit_event`→live audit; decide `increment_visits_used` deletion with Maria.
2. **B-author counters** (#8, #29, #31, #32) — small atomic-increment fns; one migration, verify each target column.
3. **B-restore in feature clusters** — encounter-provider (#2,#35), clearinghouse (#12,#36), time-clock (#23,#24), employee (#14,#15), consent (#16,#6), questionnaire (#9,#21), neuro (#13,#28), law-enforcement (#17,#27), fhir-procedure (#11,#20). For EACH: run the DRIFT forensic before re-creating.
4. **B-author analytics/clinical** (#1,#4,#5,#19,#22) — confirm intent/logic with Maria; don't invent algorithms.

> After the `rpc::` half is clear, the 156 `table::` entries are the second pass.
