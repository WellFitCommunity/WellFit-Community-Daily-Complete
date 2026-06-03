# DB-Reference Drift Triage Tracker — `rpc::` half

> **Source of truth:** `scripts/db-reference-drift-baseline.txt` (live: `grep -c '^rpc::'`).
> **Gate:** `python3 scripts/check-db-reference-drift.py` (must stay exit 0).
> **Started:** 2026-06-03. **Recipe:** grep caller → bucket → fix → remove baseline line → re-run gate → scoped typecheck/lint/test → commit.

## Buckets
- **A — repoint** (live object exists with matching shape): one-line rename or `.rpc()`→`.from()`. SAFE, do immediately.
- **B-restore** (defined in a migration file but ABSENT from live = drift): restore IS legitimate, BUT first run the **DRIFT forensic** — `git log -p --all -S '<name>' -- supabase/migrations/` to learn *why* it's absent (deliberately dropped vs. unapplied/superseded migration). Only re-create if the drop was unintentional. Live-verify after `db push`.
- **B-author** (never defined anywhere, 0 migration history): needs a NEW function authored from spec. Counters are trivial; analytics/clinical ones (`calculate_*`, engagement) need real logic — confirm intent with Maria before inventing algorithms.
- **C — dead**: 0 reachable callers OR known-dead. Either remove the dead caller (Tier-3 delete → ask) or leave baselined with a note.

## Progress
- **DONE (Batch 1, commit `c24cf90b`):** `calculate_functional_improvement`→`calculate_pt_functional_improvement`; `evaluate_discharge_readiness`→`evaluate_pt_discharge_readiness`; `get_bed_board_view`→view `v_bed_board`; `get_unit_capacity_summary`→view `v_unit_capacity`. **4 down, 36 to go.**

## Remaining 36 (caller file:line · migration-defs · bucket)

| # | rpc:: name | caller | migdefs | bucket | note |
|---|-----------|--------|:------:|--------|------|
| 1 | aggregate_disparities_by_demographic | HealthEquityService.ts:89 | 0 | B-author | health-equity analytics |
| 2 | assign_encounter_provider | encounterProviderService.ts:51 | 1 | B-restore | |
| 3 | auto_generate_clinical_data_for_hospital_patient | PaperFormScanner.tsx:269 | 1 | B-restore | |
| 4 | calculate_health_equity_metrics | HealthEquityService.ts:15 | 0 | B-author | analytics |
| 5 | calculate_readmission_risk_score | dischargePlanningService.ts:47 | 1 | B-restore | **clinical risk algo — verify logic** |
| 6 | check_sensitive_consent | sensitiveDataService.ts:254 | 1 | B-restore | **HIPAA consent gate — fail-closed** (sig p_patient_id, p_segment_type, p_purpose) |
| 7 | create_fhir_patient_from_profile | sms-verify-code/index.ts:454 | 1 | B-restore | edge fn |
| 8 | decrement | betaProgramService.ts:557 | 0 | B-author | counter helper (`{x:1}` idiom — verify) |
| 9 | deploy_questionnaire_to_wellfit | fhirQuestionnaireService.ts:248 | 1 | B-restore | |
| 10 | generate_patient_lab_token | labResultVaultService.ts:318 | 1 | B-restore | **security token gen** |
| 11 | get_billable_procedures | fhir/ProcedureService.ts:170 | 1 | B-restore | |
| 12 | get_clearinghouse_credentials | ClearinghouseConfigPanel.tsx:41 | 1 | B-restore | **reads secrets — check RLS/role** |
| 13 | get_dementia_patients_due_for_assessment | neuroSuiteService.ts:836 | 2 | B-restore | |
| 14 | get_direct_reports | employeeService.ts:276 | 3 | B-restore | |
| 15 | get_employee_by_number | employeeService.ts:447 | 3 | B-restore | |
| 16 | get_expiring_consents | consentManagementService.ts:499 | 2 | B-restore | |
| 17 | get_missed_check_in_alerts | lawEnforcementService.ts:189 | 2 | B-restore | |
| 18 | get_nurse_bypass_count_last_7_days | shiftHandoffService.ts:266 | 1 | B-restore | sibling of the SH bypass rebuild (`20260527025413`) — check if count fn was meant to land there (sig p_nurse_id) |
| 19 | get_patient_engagement_metrics | api/metrics.ts:23 | 0 | B-author | table `patient_engagement_metrics` + view `patient_engagement_scores` exist; caller needs a `(_tenant,_user)` fn |
| 20 | get_procedures_by_encounter | fhir/ProcedureService.ts:84 | 1 | B-restore | |
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
| 34 | log_audit_event | fhirSecurityService.ts:361 | 2 | **C/B-repoint** | known-dead (PROJECT_STATE `434d7c3b`). Caller's audit write silently fails → repoint to a live audit fn (`log_security_event` exists) or `audit_logs` insert. |
| 35 | remove_encounter_provider | encounterProviderService.ts:120 | 1 | B-restore | pair of #2 |
| 36 | update_clearinghouse_config | ClearinghouseConfigPanel.tsx:68 | 1 | B-restore | pair of #12 |

## Suggested execution order (next sessions)
1. **C items first** (#33, #34) — cheap, removes silent-failure: repoint `log_audit_event`→live audit; decide `increment_visits_used` deletion with Maria.
2. **B-author counters** (#8, #29, #31, #32) — small atomic-increment fns; one migration, verify each target column.
3. **B-restore in feature clusters** — encounter-provider (#2,#35), clearinghouse (#12,#36), time-clock (#23,#24), employee (#14,#15), consent (#16,#6), questionnaire (#9,#21), neuro (#13,#28), law-enforcement (#17,#27), fhir-procedure (#11,#20). For EACH: run the DRIFT forensic before re-creating.
4. **B-author analytics/clinical** (#1,#4,#5,#19,#22) — confirm intent/logic with Maria; don't invent algorithms.

> After the `rpc::` half is clear, the 156 `table::` entries are the second pass.
