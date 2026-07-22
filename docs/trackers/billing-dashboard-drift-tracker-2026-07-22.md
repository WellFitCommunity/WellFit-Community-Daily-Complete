# Billing-Dashboard Drift — Tracker (from Maria's 2026-07-22 browser walk)

> **Status:** B-1..B-4 FIXED same day (commit trail below). B-5/B-6 NEED A DATA-MODEL DECISION — do not patch blind.
> Source: console errors on the billing/revenue surfaces. All root causes live-verified via `supabase db query --linked`.

## Fixed 2026-07-22
- **B-1 (403s):** `icd10_hcc_mappings` + `hcc_hierarchies` had RLS read policies but NO grant → migration `20260722180000` (`GRANT SELECT TO authenticated`, live-verified true). `hccOpportunityService` works now.
- **B-2 (406):** `mcp_cost_savings_summary` read used `.single()` — zero rows (no MCP usage yet) 406s. → `.maybeSingle()` in `MCPCostDashboard.tsx` + `AIFinancialDashboard.tsx` (+ test mocks).
- **B-3 (400):** `encounterBillingBridgeService.getBillingQueue` — profiles embed used `encounters_patient_id_fkey` (targets auth.users; the profiles embed FK is `encounters_patient_id_profiles_fkey`) and embedded `billing_providers` (NO FK exists encounters→billing_providers). Fixed: correct FK name; provider names via second `profiles` fetch keyed `user_id` on `provider_id`. `encounter_superbills` embed verified OK (FK exists).
- **B-4 (crash + fabrication, separate commit `683ebc43`):** PriorAuthDashboard null `.toFixed` + fabricated 100% SLA → honest NULLs migration `20260722170000` + boundary normalization + "—" render.
- Also fixed same walk: `DashboardPersonalizationIndicator` queried nonexistent `feature_clicked`/`click_count`/`workflow_pattern_detected` → repointed to live `section_name` events (client-side tally); emoji glyphs → lucide icons (mounted in PhysicianPanel, System B).

## NEEDS DESIGN (do NOT patch blind — both were written against a payer model that never existed)
- **B-5 `eligibilityVerificationService`:** TWO queries select `encounters.payer_id` (column does not exist) + embed `billing_payers` (no FK), and the verification-submit path GATES on `billing_payers.payer_id` (line ~239) — so eligibility verification has never once run. **Decision needed: where does a payer attach?** Options: (a) add `encounters.payer_id → billing_payers` (column + FK migration — Tier 3); (b) resolve payer from the patient's insurance profile fields (`primary_insurance`/`insurance_id`); (c) resolve via the claim when one exists. Recommend (a) — eligibility is checked pre-claim, and the coverage_* columns already live on encounters. Maria approves the schema change; then repoint both queries + the submit gate + fix `encounter_procedures(procedure_code)` → `(code)`.
- **B-6 `eraPaymentPostingService`:** live `remittances` = `id, payer_name, check_number, check_date, total_amount, file_path, processed, processed_at, created_at, tenant_id` — the service selects `payer_id, received_at, summary, details, billing_payers(name)` (NONE exist) and derives claim counts from a `summary` jsonb that was never stored. **Decision needed:** either extend `remittances` with the ERA-835 detail the service expects (summary/details jsonb, received_at) as part of a real ERA-ingest design, or rewrite the service to the live shape (payer_name direct, received_at→created_at, totals from `claim_payments` per remittance). Recommend the rewrite (live shape + claim_payments aggregation) — no schema change, honest data.
- **B-7 `guardian-agent-api` 401 on error-boundary reportAndHeal:** client sends the session Bearer correctly (`guardianAgentClient.ts`) — the rejection is inside the edge fn's gate. Investigate the fn's role check; crash reports currently never reach Guardian.

Regression check: `grep -rn "payer_id" src/services/eligibilityVerificationService.ts` (expect 0 after B-5); `grep -rn "received_at\|summary, details" src/services/eraPaymentPostingService.ts` (expect 0 after B-6).

---

## SOC2/AUDIT SURFACE CLUSTER (same 2026-07-22 walk, second console paste)

### Fixed same day
- **S-1 (403s):** `ai_model_registry`, `tenant_config_audit`, `disclosure_accounting` — RLS policies existed, GRANTs didn't → migration `20260722190000` (SELECT to authenticated, live-verified).
- **S-2:** `admin_settings.security_rules` jsonb column never existed (reads 400'd, rule saves silently failed) → additive migration `20260722200000`; design honored (per-admin rules keyed user_id), zero code change.
- **S-3 `tenantSecurityService`:** security_alerts read now aliases live columns (`message:description`, `acknowledged_at:assigned_at`, `resolved_at:resolution_time`) so the UI shape is unchanged; **acknowledge/resolve WRITES also targeted nonexistent columns** → repointed to `assigned_at/assigned_to/assigned_by` and `resolution_time` (resolver identity remains in the audit log). `getTenantSuspensionStatus` → `.maybeSingle()` (0 rows = not suspended; kills the 406). `getActiveSessions` no longer selects `profiles.last_sign_in_at` (never existed — it's an auth.users column) → real source: latest `login_attempts` success per user, joined to profiles client-side.
- **S-4 `trainingTrackingService`:** `employee_profiles` has no name columns (employment data only) → names via `profiles` fetch keyed `user_id`.

### NEEDS ITS OWN SWEEP — audit_logs READ fleet (S-5)
The 2026-07-11 session fixed the audit_logs INSERT fleet (28 sites); the READ side was deferred as "not manifesting" — it manifests on the SOC2/compliance/audit-viewer surfaces. At least 8 distinct queries 400 today, selecting/filtering columns that don't exist. **Live column truth (2026-07-22):** `id, actor_user_id, actor_role, actor_ip_address, actor_user_agent, event_type, event_category, resource_type, resource_id, table_name, timestamp, target_user_id, operation, metadata, success, error_code, error_message, retention_date, checksum, tenant_id`.
Mechanical mapping for the sweep: `created_at`→`timestamp` (INCLUDING all date-range filters), `action_category`/`category`→`event_category`, `action_type`→`event_type`, `action`→`operation`, `details`→`metadata`, `ip_address`→`actor_ip_address`, `patient_id`→`target_user_id`, `actor_name`→resolve via profiles join client-side.
**Design decision (Maria):** `severity` DOES NOT EXIST on audit_logs — severity belongs to `security_alerts`. Dashboards showing "audit severity" must either derive it (event_category/success mapping) or drop the column from audit views. Do NOT add a severity column without a compliance discussion (audit_logs is immutable).
Sweep method: same parser approach as the insert sweep (`97a15dba`) — enumerate every `.from('audit_logs').select/…` site, rewrite against the mapping, fleet-grep, scoped tests. Est. 1 session. Sites seen failing today include the SOC2 audit viewer, compliance report builder (category/severity/event_type/actor aggregates), and the admin activity feed.
