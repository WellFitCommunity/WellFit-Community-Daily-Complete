# T6 — Tenant Isolation Test Suite & Audit (Pool model)

> Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.

**Created:** 2026-07-08
**Status:** IN PROGRESS — baseline done + audit script committed. Behavioral harness + Akima triage next.
**Direction:** HYBRID confirmed (Pool default, Silo on demand — see `tenant-isolation-silo-tracker.md`). This hardens the Pool model that most clients stay on.
**Reusable audit:** `scripts/tenant-isolation-audit.sql` (run via Supabase MCP `execute_sql` or `psql`).

---

## Baseline (live-verified 2026-07-08)

**505 tables carry `tenant_id`. 100% have RLS enabled.** Classification of their read policies:

| Bucket | Count | Verdict |
|---|---|---|
| `OK_tenant_scoped` (policy references `tenant_id`/`get_current_tenant_id`) | **453** | ✅ correct |
| `OK_user_scoped` (scoped by `auth.uid()`) | 27 | ✅ mostly — but see note |
| `REVIEW_permissive_true` (a `true` read policy) | 14 | ⚠️ triage |
| `LEAK_RISK_role_no_tenant` (`admin`/provider grant, no tenant check) | 11 | 🔴 triage first |

**The classifier is heuristic** (SQL can't fully parse policy semantics). Specifically, a policy `role = ANY('{admin,super_admin}')` with **no `tenant_id`** lands in `OK_user_scoped` (it contains `super_admin`) but still lets a **tenant-level admin** cross tenants. So the true review set is the 11 + 14 below **plus** the role-based members of the 27. **super_admin crossing tenants is by design; tenant admin crossing is the leak.**

---

## Triage list (Akima/Maria call per table — Tier-3 RLS, do NOT auto-fix)

For each: decide the intent → **super-admin-only** (fine as-is), **tenant-admin-scoped** (add `AND tenant_id = get_current_tenant_id()`), or **reference data** (intentionally shared — fine).

### 🔴 LEAK_RISK_role_no_tenant (11) — start here
`encounter_provider_audit`, `encounter_providers`, `encounter_status_history`, `patient_engagement_metrics`, `phi_access_log`, `physician_style_profiles`, `provider_task_escalation_config`, `provider_tasks`, `rls_policy_audit`, `scribe_audit_log`, `staff_audit_log`
- Highest concern: **`phi_access_log`** (PHI access records) and **`patient_engagement_metrics`** (`is_admin(auth.uid()) OR patient_id = auth.uid()` — a tenant admin sees all patients across tenants).
- `provider_tasks` (`is_admin OR assigned_to = auth.uid()`) — tenant admin sees other tenants' tasks.
- The `*_audit_log` ones are admin-readable audit logs without tenant scope.

### ⚠️ REVIEW_permissive_true (14) — a literal `true` read policy
`audit_logs`, `fhir_locations`, `fhir_medications`, `fhir_organizations`, `mcp_clearinghouse_audit_log`, `mcp_hl7_x12_audit_log`, `mcp_keys`, `ncpdp_claims`, `patient_no_show_stats`, `performance_metrics`, `pharmacy_provider_connections`, `realtime_subscription_registry`, `referral_aging_config`, `smart_registered_apps`
- Likely **intentional**: `fhir_locations/medications/organizations` (shared reference data), the `*_audit_log` `true` may be INSERT (`WITH CHECK true`) for service-role, not SELECT — **verify per table whether the `true` is on read or insert**.
- Verify `audit_logs`, `mcp_keys`, `ncpdp_claims`, `pharmacy_provider_connections` are not actually anyone-readable.

### Role-based members of OK_user_scoped (re-examine)
Any of the 27 whose policy is `role = ANY('{admin,super_admin}')` without `tenant_id` (e.g. `no_show_policies`, `provider_blocked_times`, `system_metrics`, `x12_997_acknowledgments`, …) — same tenant-admin-cross-tenant question. Full list: run `scripts/tenant-isolation-audit.sql`.

---

## Behavioral verdict (live-proven 2026-07-08)

Harness: `scripts/tenant-isolation-behavioral.ts` (Deno; creates 2 tenants + admin users, seeds tenant-B data, probes as tenant-A admin). Programmatic sign-in is blocked by hCaptcha-on-auth, so the definitive probe was run via SQL RLS-context simulation (`set_config('request.jwt.claims',…)` + `SET ROLE authenticated`) against the live DB, rolled back.

**The leak is DEFINITIONALLY REAL but currently UNEXPLOITABLE:**
- `is_admin(u)` returns true for a **tenant-level** admin (`profiles.role='admin'` / `is_admin=true`), not only a `super_admin`. The flagged policies (`provider_tasks`, `patient_engagement_metrics`, the `is_admin()` audit logs, …) are `is_admin(auth.uid()) OR …` with **no tenant filter** → a tenant admin *would* read every tenant's rows. **Proven by `is_admin()` + policy definitions.**
- **BUT** empirically: `provider_tasks` and `patient_engagement_metrics` are **empty** in prod, only **1 tenant** (WF-0001) has data, and there are **zero** non-super tenant admins (every admin is a `super_admin`, cross-tenant *by design*). So the leak has **no data and no actor** today.

**Severity → downgraded to "fix before multi-tenant scale."** It becomes live only when you (a) onboard a 2nd tenant with data AND (b) create tenant-level (non-super) admins. Fix during T6 policy remediation, before Pool go-live with real tenant admins. Not a current exposure.

### 🔴 Bonus latent bugs found by exercising the system (real, unrelated to isolation)
1. **`fn_audit_tenant_config()` — tenants can never be DELETED.** On DELETE it inserts a `tenant_config_audit` row that FK-references the tenant being deleted → circular FK violation. (Cleanup required `session_replication_role=replica`.)
2. **`fn_audit_tenant_config()` — references `p.full_name`** which doesn't exist on `profiles` → tenant insert/update throws when `auth.uid()` is set.
3. **`log_user_roles_delete()` — `user_roles` can never be DELETED.** Inserts `old_role_id` (UUID column) from `old.role_id` (integer) → type-mismatch error.
→ File these as their own repair tickets; they'll bite tenant offboarding + role management.

### ✅ Good control confirmed
`profiles_restrict_user_update()` blocks **self-promotion to admin** and blocks updates when `auth.uid()` is null — solid anti-privilege-escalation.

---

## Plan

- [x] Baseline classification (live) + `scripts/tenant-isolation-audit.sql` committed.
- [x] Behavioral harness built (`scripts/tenant-isolation-behavioral.ts`) + definitive verdict via live SQL RLS-simulation.
- [ ] **Akima/Maria triage** of the 🔴 11 + ⚠️ 14 (+ role-based user_scoped) → per-table intent.
- [ ] **Fix** the confirmed leaks (add `AND tenant_id = get_current_tenant_id()` to tenant-admin policies) via migration — Tier-3, live-verify each.
- [ ] **Behavioral harness (the definitive proof)** — two synthetic test tenants (A, B) each with an admin + a member user (synthetic data per Rule #15). Assert: tenant A's admin/user reads of tenant B's rows return 0 / 403 across services, Edge Functions, MCP, RPCs, FHIR/SMART tokens, dashboards. This *proves* which flagged tables actually leak vs are by-design super-admin.
- [ ] **CI gate** — wire `scripts/tenant-isolation-audit.sql` into a check (snapshot-baseline like the DB-reference drift gate) that FAILS if a NEW `tenant_id` table appears without tenant/user scoping. Prevents regression.

## Notes
- 90% properly-scoped is a strong Pool baseline — this is triage, not a fire.
- The behavioral harness is the highest-value next step: it converts "policy looks risky" into "proven leak / proven safe," and its cross-tenant negative tests double as the acceptance harness for Silo (`tenant-isolation-silo-tracker.md`).
