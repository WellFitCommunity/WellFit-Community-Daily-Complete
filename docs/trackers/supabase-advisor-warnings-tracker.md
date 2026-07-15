# Supabase Security Advisor — Warning Triage Tracker (2026-07-15)

> **Scope:** The 836 non-critical WARN-level findings from the Supabase Security Advisor, as of 2026-07-15 (the 2 ERRORs were already fixed — see commit `60375170`; `spatial_ref_sys` is the one accepted, unfixable-at-project-level ERROR). This tracker triages every WARN family into **fix / scope / accept**, with exact object names and live-DB-verified reasoning.
>
> **Authoring method (Commandment #18 satisfied):** every table's exposure below was cross-checked live against `has_table_privilege(...)` and `pg_policy` on 2026-07-15 — NOT read from migrations. Re-verify before each session; policies drift.
>
> **The one principle that drives all severity calls here:**
> **An always-true RLS policy is only reachable to the extent a role holds a table GRANT.** RLS and GRANT are two independent gates (supabase.md §2a). A `USING (true)` policy on a table where `anon`/`authenticated` have **no GRANT** is inert — the advisor still flags it, but it cannot be exploited until someone adds a GRANT. This is why the 77 "always-true policy" lints collapse to **~9 that are genuinely exploitable today** and ~68 that are cosmetic-or-latent. Do the 9 first.

---

## Warning families at a glance

| Family | Lint count | Distinct objects | Disposition |
|---|---:|---:|---|
| `rls_policy_always_true` | 77 | 67 tables | **Split** — 9 real (P0/P1), ~20 latent (P2), ~48 accept |
| `authenticated_security_definer_function_executable` | 367 | 364 fns | **Batch REVOKE** (P3) — per-function judgment |
| `anon_security_definer_function_executable` | 345 | 342 fns | Same fns as above; fixed by the same REVOKE (P3) |
| `function_search_path_mutable` | 41 | 41 fns | **Mechanical batch** (P2) |
| `rls_policy_always_true` (service_role only) | (subset) | ~40 | Accept — service_role bypasses RLS anyway |
| `public_bucket_allows_listing` | 3 | 3 buckets | **Review** (P2) — avatars, community-moments, meal-photos |
| `extension_in_public` | 4 | 4 extensions | **Accept/schedule** — postgis, pg_trgm, btree_gist, fuzzystrmatch |

> Note: the 712 security-definer lints are 364 functions each double-flagged (once for `anon`, once for `authenticated`). Fixing EXECUTE for one function clears 2 lints. So the real function count is 364, not 712.

---

# P0 — Genuinely exploitable TODAY (always-true policy + live GRANT + sensitive data)

These have both gates open. Fix first.

### ADV-P0-1 — `profiles` readable cross-tenant by any authenticated user ⚑ MARIA (Tier-3 RLS)
- **Policy:** `profiles_public_read_for_community` — `FOR SELECT TO authenticated USING (true)`
- **GRANT:** `authenticated` has SELECT → **reachable**. (`anon` has none.)
- **Why it matters:** `profiles` carries DOB, address, phone, tenant_id. `USING (true)` means **any** logged-in user (any tenant) can `SELECT` **every** profile in the platform. This is a cross-tenant PHI read and violates tenant isolation (governance-boundaries S2) and HIPAA minimum-necessary.
- **Live proof (2026-07-15):** `auth_sel = true`, policy qual = `true`. 61 profile rows exist.
- **Complication:** the policy name says "for community" — some community surface may depend on reading *some* other-user profile fields (names for a member gallery, caregiver linkage). **Do not blind-drop it.** Grep first: `grep -rn "from('profiles')" src/components/community src/components/check-in`. The correct replacement is almost certainly tenant-scoped: `USING (tenant_id = get_current_tenant_id())`, plus a **column-scoped view** if a genuine cross-user name lookup exists.
- **Fix spec:** replace with `USING (tenant_id = get_current_tenant_id())`. If a community feature needs specific columns of same-tenant peers, that's already covered by the tenant scope; if it needs cross-tenant, that's a separate view with only non-PHI columns.
- **Acceptance:** as an authenticated user in tenant A, `SELECT count(*) FROM profiles` returns only tenant-A rows; community surfaces that read profiles still render (verify DoctorsView + any member gallery).
- **⚑ MARIA:** confirm no white-label/community feature intends cross-tenant profile reads before I narrow it.

### ADV-P0-2 — `patient_daily_check_ins` — anon has full CRUD via `FOR ALL TO PUBLIC USING(true)`
- **Policy:** `System can manage check-ins` — `FOR ALL TO PUBLIC USING (true) WITH CHECK (true)`
- **GRANT:** `anon` has SELECT + INSERT; `authenticated` has full. → **reachable by anon.**
- **Why it matters:** a PHI check-in table with a `FOR ALL` policy open to the `anon` role. Any unauthenticated caller with the publishable key could read/insert check-ins.
- **Live proof:** `anon_ins = true, anon_sel = true`; policy `true/true`. **Table is currently empty (0 rows)** — so no data is exposed *right now*, but this is a live write target and the hole is real the moment a row lands.
- **Fix spec:** drop the PUBLIC `FOR ALL` policy. Replace with user-scoped policies: `FOR SELECT/INSERT/UPDATE TO authenticated USING (patient_id = auth.uid())` (+ tenant scope). `REVOKE ALL ON patient_daily_check_ins FROM anon`. If a kiosk/anon check-in flow genuinely exists, route it through an edge function on the service key, not a direct anon table grant.
- **Acceptance:** `anon` gets 0 rows and INSERT 403; an authenticated patient can insert/read only their own; the check-in write path still works end-to-end.
- **⚑ MARIA:** is there an intentional anonymous kiosk check-in path? If yes, it moves to an edge function; if no, straight revoke.

### ADV-P0-3 — `tenants` list readable by `anon` + all-tenant read by `authenticated`
- **Policy:** `tenants_view_all` — `FOR SELECT TO authenticated USING (true)`; plus `anon` holds a SELECT grant.
- **GRANT:** `anon_sel = true`, `auth_sel = true`.
- **Why it matters:** the full tenant roster (org names, config) is enumerable. Lower severity than PHI, but it leaks the customer list and every authenticated user sees all orgs.
- **Fix spec:** `REVOKE SELECT ON tenants FROM anon`. Narrow the authenticated policy to the caller's own tenant: `USING (id = get_current_tenant_id())`. (Branding/onboarding edge functions that need the full list already run on the service key.)
- **Acceptance:** anon SELECT → 403; authenticated sees only their own tenant row; branding still loads (it resolves by host on the server side).

### ADV-P0-4 — `caregiver_sessions` / `caregiver_access_log` — `FOR ALL / write TO PUBLIC USING(true)`
- **Policies:** `caregiver_sessions.Allow caregiver session management` (`FOR ALL PUBLIC true/true`); `caregiver_access_log.Allow anonymous caregiver access logging` (INSERT PUBLIC true) + `Allow session updates` (UPDATE PUBLIC true).
- **GRANT:** `authenticated` has full on both; `anon` has none (verified `anon_ins=false`). So today it's **authenticated-reachable, not anon** — but `FOR ALL ... USING(true)` still lets any authenticated user read/modify **any** caregiver's session, not just their own.
- **Why it matters:** caregiver PIN sessions are an access-control primitive (docs/clinical/CAREGIVER_SUITE.md). A caregiver in one family reading/mutating another family's session row is a privilege boundary break.
- **Fix spec:** replace `FOR ALL PUBLIC true` with policies scoped to the owning caregiver/patient linkage. This one needs the caregiver-suite data model in hand — read `emergencyAccessService.ts` + the caregiver grant tables before writing. Not a mechanical fix.
- **Acceptance:** a caregiver session row is readable/updatable only by its owner or the linked patient's tenant admin; PIN-grant flow still works.
- **⚑ MARIA/AKIMA:** caregiver access model is clinical-compliance-adjacent — confirm the intended scope rule before I rewrite.

---

# P1 — Audit/security INSERT does not enforce identity (adversarial-audit rule #4)

`WITH CHECK (true)` on an audit/security table lets a caller forge the actor. Rule #4 requires the identity column = `auth.uid()`.

### ADV-P1-1 — `audit_logs` — `anon` can INSERT, and INSERT check is `true`
- **Policy:** `audit_logs_select` (SELECT authenticated true) + service_role ALL. The INSERT path: **`anon_ins = true`** on the table.
- **Why it matters:** the general audit trail. If anon (or any authenticated user) can insert with `WITH CHECK (true)`, the audit log is spoofable — fatal for HIPAA integrity. Also `audit_logs_select USING(true)` means any authenticated user reads the entire audit trail cross-tenant.
- **Cross-check with memory:** `reference_audit_logs_immutable_and_shape` — canonical cols are `actor_user_id / event_type / actor_ip_address / metadata`; the table is append-only (no DELETE). **Do not probe-insert to test.**
- **Fix spec:** `REVOKE INSERT ON audit_logs FROM anon`. Keep writes on service_role (edge functions / auditLogger). If authenticated must insert directly, add `WITH CHECK (actor_user_id = auth.uid())`. Narrow the SELECT policy to tenant + role (not `true`).
- **Acceptance:** anon INSERT → 403; a forged `actor_user_id` INSERT as an authenticated user → rejected; a normal audit write via auditLogger still lands.

### ADV-P1-2 — `admin_audit_logs`, `security_events`, `password_history`, `mfa_enrollment`
- **Policies:** each has an INSERT `WITH CHECK (true)` to `authenticated` or `PUBLIC` (see rows below). `anon` has no grant on any (verified), so these are authenticated-reachable, not anon — lower than ADV-P1-1 but same class.
  - `admin_audit_logs_insert` — INSERT authenticated `true`
  - `security_events` — three INSERT policies (`authenticated`, `PUBLIC`, `service_role`) all `true`
  - `password_history_insert` — INSERT PUBLIC `true`
  - `Service role insert MFA enrollment` — INSERT PUBLIC `true`
- **Fix spec:** for each, replace `WITH CHECK (true)` with the identity predicate (`admin_user_id = auth.uid()` / `user_id = auth.uid()` as appropriate), and drop the redundant `PUBLIC` INSERT policy where a `service_role` one already exists. `password_history` and `mfa_enrollment` should be **service_role-only** writes (they're security-critical) — revoke authenticated/PUBLIC INSERT entirely if the writer is an edge function.
- **Acceptance:** each table rejects a forged-identity INSERT; the legitimate writer (edge function / auth flow) still works. Verify the auth flows (password change, MFA enroll) end-to-end after.
- **⚑ note:** confirm each table's real writer (edge fn vs client) via grep before revoking — `grep -rn "from('security_events')" supabase/functions src`.

---

# P2 — Latent / mechanical (do after P0/P1)

### ADV-P2-1 — Clinical module policies assigned to `PUBLIC` role (latent footgun) — ~20 policies
- **Tables:** all `card_*` (arrhythmia, rehab, cath, device, ecg, echo, heart_failure, patient_registry, stress), all `ld_*` (pregnancies, delivery, fetal, labor, med_admin, newborn, postpartum, prenatal, risk, alerts), all `onc_*` (cancer_registry, chemo, imaging, lab, radiation, side_effects, staging, survivorship, treatment_plans) — INSERT/UPDATE policies `TO PUBLIC WITH CHECK (true)`.
- **Current state:** **INERT.** Verified: `anon` and `authenticated` have **no GRANT** on these tables (all false). The `PUBLIC` role on the policy is meaningless until a grant is added — but it's a footgun: the day someone runs `GRANT ... TO authenticated`, all these become wide-open writes.
- **Why not P0:** no reachable path today. Why not "accept": the `PUBLIC` role assignment is exactly the pattern that becomes a P0 by accident.
- **Fix spec:** mechanical batch — `ALTER POLICY ... TO service_role` (or drop+recreate scoped to `service_role`) on each. These modules are written by service-key edge functions. No behavior change (service_role already bypasses RLS; this just removes the latent `PUBLIC` grant surface).
- **Acceptance:** advisor `rls_policy_always_true` count drops by ~20; the card/ld/onc write paths (edge functions) still work; `has_table_privilege('authenticated', 'public.card_heart_failure', 'INSERT')` stays false.

### ADV-P2-2 — `function_search_path_mutable` — 41 functions
- **Functions (exact list):** `_equity_dim_expr, approve_superbill, assign_encounter_provider, audit_encounter_provider_change, calc_weight_change, check_medication_allergy, create_alert_from_critical_security_event, enforce_superbill_approval, expand_medical_synonyms, generate_amendment_request_number, generate_breach_incident_number, get_active_allergies, get_aging_referrals, get_coverage_provider, get_flagged_override_providers, get_healthcare_integration_stats, get_patient_active_insurance, get_patient_imaging_studies, get_patient_lab_results, get_pending_guardian_tickets, get_provider_override_count_last_7_days, get_referral_aging_stats, get_referral_completion_stats, get_referrals_awaiting_confirmation, record_specialist_completion, reject_superbill, remove_encounter_provider, search_clinical_notes, search_medical_codes, set_amendment_response_deadline, tg_fhir_devices_set_updated_at, tg_fhir_fmh_set_updated_at, transition_encounter_status, update_allergy_updated_at, update_cultural_profiles_updated_at, update_fhir_service_request_updated_at, update_healthcare_updated_at, update_referral_aging_config_updated_at, update_result_escalation_rules_updated_at, update_updated_at_column, validate_encounter_provider`
- **Why it matters:** a `SECURITY DEFINER` (or even INVOKER) function without a pinned `search_path` is vulnerable to search_path injection (supabase.md §4). Several of these are DEFINER and touch PHI/billing.
- **Fix spec:** mechanical — `ALTER FUNCTION <name>(<args>) SET search_path = public;` for each (add `extensions` too if the fn uses postgis/trgm — `search_medical_codes`, `expand_medical_synonyms` likely do). Must include the exact arg signature (some may be overloaded — `get_patient_lab_results` is a known duplicate overload per the intake tracker). Get signatures from `pg_proc` first.
- **Acceptance:** advisor `function_search_path_mutable` → 0; each function still executes (spot-check `search_clinical_notes`, `get_patient_lab_results`, an `update_*` trigger fires on a row update).
- **Note:** the `update_*`/`tg_*` trigger functions are trivial and safe to batch; the `approve_superbill`/`enforce_superbill_approval`/`transition_encounter_status` ones mutate clinical/billing state — verify each still works, don't just ALTER-and-assume.

### ADV-P2-3 — `public_bucket_allows_listing` — 3 storage buckets
- **Buckets:** `avatars` (2 broad SELECT policies), `community-moments` (3), `meal-photos` (2) — all on `storage.objects`.
- **Context:** all three are **System A / community** image buckets (governance boundaries — emojis/community aesthetic live here). Public *read* of an individual object by URL is likely intended (avatars, shared meal photos). The advisor's concern is **listing** — the policies allow enumerating every object in the bucket, not just fetching a known key.
- **Why it matters:** community-moments/meal-photos may contain member-identifiable images. Enumeration ≠ intended even if per-object read is.
- **Fix spec:** review each bucket's SELECT policies. Keep object-read-by-key; remove the ability to LIST (the merged `merged_all_*` / "Public read access" policies are the broad ones). Likely: restrict listing to the owner (`owner = auth.uid()`) while keeping public GET-by-path for avatars only.
- **⚑ MARIA:** community image sharing is a product decision — confirm which of these are meant to be publicly browsable vs. owner-only before I tighten.

---

# P3 — Largest effort, lowest per-item risk: SECURITY DEFINER functions EXECUTE-able by anon/authenticated

### ADV-P3-1 — 364 `SECURITY DEFINER` functions granted EXECUTE to `anon`/`authenticated`
- **Lint count:** 712 (364 fns × 2 roles). Fixing EXECUTE per function clears both.
- **Why it matters (and why it's mostly WARN not ERROR):** a `SECURITY DEFINER` function runs as its owner (bypassing RLS). If `anon`/`authenticated` can EXECUTE it, they invoke owner-privilege logic. Many are *intended* RPCs (a user calling `check_in_count_last_7_days` for themselves). But many should **never** be caller-invokable — `cleanup_*` (should be cron/service), `admit_patient`, `approve_claim`, `assign_super_admin_to_tenant`, `bulk_enroll_hospital_patients`, `backfill_missing_profiles`, `approve_beta_enrollment`. Those are privilege-escalation surface.
- **This is NOT a blanket revoke.** A blanket `REVOKE EXECUTE FROM authenticated` on all 364 breaks legitimate RPCs and the app. This needs **per-function classification**:
  1. **Cron/maintenance** (`cleanup_*`, `aggregate_*`, `capture_*_metrics`, `auto_dismiss_*`) → REVOKE from anon+authenticated, keep service_role only.
  2. **Admin/privileged actions** (`admit_patient`, `approve_*`, `assign_*`, `bulk_enroll_*`, `backfill_*`, `assign_super_admin_*`) → REVOKE from anon; keep authenticated ONLY IF the function itself checks role internally (verify each has an `is_tenant_admin()`/role gate; if not, that's a *second* bug).
  3. **Legitimate self-service RPCs** (`check_in_count_last_7_days`, `can_access_tenant`, `check_user_has_role`) → keep, but confirm they internally scope to `auth.uid()`.
- **Execution model:** this is its own multi-session sub-project. Batch by prefix. Start with the unambiguous category-1 `cleanup_*`/maintenance set (safe, high count, clears the most lints fastest), then category-2 admin actions (each needs a "does it self-gate?" check), then leave category-3 alone (document why).
- **First batch (category 1 — safe REVOKEs, ~40 fns):** everything matching `cleanup_*`, plus `aggregate_kiosk_analytics, capture_connection_pool_metrics, cleanup_monitoring_data, auto_dismiss_old_info_alerts`. Full list to be pulled from `pg_proc` at session start (`SELECT proname FROM pg_proc WHERE proname LIKE 'cleanup_%'`).
- **Acceptance per batch:** `has_function_privilege('anon', '<fn>(<args>)', 'EXECUTE')` = false for revoked fns; the app's real callers (which use service_role for maintenance) still work; no legitimate client RPC breaks (smoke-test the affected UI).
- **⚑ This is where the effort is — recommend a dedicated tracker once P0–P2 clear. ~5+ sessions for a careful pass.**

---

# ACCEPT (no action — documented rationale)

### ADV-ACCEPT-1 — Reference-data tables with `SELECT USING(true)` (intentional public read)
Non-PHI reference/lookup data; public or authenticated read is by design. **Suppress in advisor, do not "fix":**
`cms_coverage_articles, cms_lcds, cms_mac_contractors, cms_ncds, cms_prior_auth_codes, code_cpt, code_icd10, code_hcpcs, code_modifiers, ms_drg_reference, hcc_categories, hcc_hierarchies, icd10_hcc_mappings, ecqm_cql_libraries, ecqm_measure_definitions, ecqm_value_sets, safer_guide_definitions, safer_guide_questions, reportable_conditions, onc_standard_regimens, x12_997_error_codes, drug_interaction_cache, fhir_medications, fhir_locations, fhir_organizations, chain_definitions, chain_step_definitions, migration_phi_field_definitions` (verify each carries no tenant/PHI column — they're code sets and definitions).

### ADV-ACCEPT-2 — `service_role`-only policies with `USING(true)` (~40)
`service_role` bypasses RLS entirely, so `USING(true)` on a service_role policy is a documentation no-op, not a hole. The advisor flags them for completeness. Examples: `capacity_*_service_role, evs_*_service_role, transport_*_service_role, wearable_*_service, prior_auth_*_service_role_bypass, smart_*_service_all, guardian_*_service, phi_access_logs_service_role`, etc. **Accept.** (Optional cosmetic cleanup: scope them to specific commands, but zero security value.)

### ADV-ACCEPT-3 — `extension_in_public` — 4 extensions
`postgis, pg_trgm, btree_gist, fuzzystrmatch` live in `public`. Best practice is a dedicated `extensions` schema, but **moving PostGIS post-hoc is high-risk** (6 geometry columns depend on it, plus `spatial_ref_sys`). The exposure is negligible (these are function libraries, not data). **Accept / schedule only as part of a deliberate, tested migration — never a drive-by.**

### ADV-ACCEPT-4 — `spatial_ref_sys` RLS (the remaining ERROR, not a WARN)
PostGIS system table owned by `supabase_admin`; `ALTER TABLE ... ENABLE RLS` returns `must be owner` at project level (attempted 2026-07-15). Public SRID projection data, no exposure. **Accept — platform limitation.**

---

## Suggested execution order

1. **Session 1 (P0):** ADV-P0-1..4 — the 4 real cross-tenant/anon holes. Blocked on 2 MARIA confirmations (profiles community read, anon kiosk check-in) + 1 AKIMA (caregiver scope). Do `tenants` (P0-3) immediately — no decision needed.
2. **Session 2 (P1):** audit/security INSERT identity — `audit_logs` anon revoke first, then the identity predicates. Grep each table's real writer before revoking.
3. **Session 3 (P2):** ADV-P2-1 (clinical PUBLIC→service_role, mechanical) + ADV-P2-2 (41 search_path, mechanical). Both low-risk, high lint-count reduction.
4. **Session 4:** ADV-P2-3 storage buckets (needs MARIA product call).
5. **Sessions 5+:** ADV-P3-1 — spin out its own tracker; batch the `cleanup_*` maintenance functions first.

## Regression check (re-run any session)
```sql
-- Confirm P0 tables are no longer anon/cross-tenant reachable after fixes:
SELECT relname,
  has_table_privilege('anon', ('public.'||relname)::regclass, 'SELECT') AS anon_sel,
  has_table_privilege('anon', ('public.'||relname)::regclass, 'INSERT') AS anon_ins
FROM (VALUES ('patient_daily_check_ins'),('tenants'),('audit_logs')) v(relname);
-- Expected after P0/P1: all anon_sel/anon_ins = false
```
Then re-pull the advisor: `mcp__claude_ai_Supabase__get_advisors(type: security)` and confirm the family counts drop as each batch lands.
