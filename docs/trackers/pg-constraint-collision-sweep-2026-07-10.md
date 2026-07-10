# pg_constraint Name-Collision / Duplicate Sweep — 2026-07-10

**Origin:** the first 2026-07-10 session found `user_questions_status_check1` — a stale
DUPLICATE CHECK that intersected with the base constraint and silently narrowed the
valid domain (broke the nurse claim/escalate workflow). This is the fleet-wide sweep
for the same class.

## Headline result

- **The dangerous class is CLEAN.** No public table has >1 CHECK constraint on the same
  column set (query: `pg_constraint` grouped by `(conrelid, conkey)` where `contype='c'`,
  `HAVING count(*)>1` → 0 rows). `user_questions_status_check1` was the only one and is
  already fixed. **A duplicate CHECK is the only duplicate class that can block valid
  rows** (intersection); the others below cannot.
- **`user_questions_pkey1` / `user_questions_user_id_fkey1`** carry a `1` suffix but are
  the SOLE, VALID PK/FK — cosmetic drift from a cross-table index-name collision (the
  `admin_user_questions` table's PK index is named `user_questions_pkey`, so the current
  table's PK auto-suffixed to `_pkey1`). Not a bug; left as-is.

## Duplicate FK/UNIQUE constraints — 9 across 7 tables

Duplicate FK/UNIQUE constraints do **not** block valid rows, so nothing was actively
broken. Split into two groups:

### Dropped — genuinely redundant (identical def + ZERO code references)
Migration `20260710160000_dedupe_redundant_constraints.sql` (live-verified: 4 dropped, kept siblings remain):

| Table | Dropped | Kept (identical) |
|-------|---------|------------------|
| fhir_care_plans | `fhir_care_plan_patient_fk` | `fhir_care_plans_patient_id_fkey` |
| fhir_practitioners | `fhir_practitioner_user_fk` | `fhir_practitioners_user_id_fkey` |
| fee_schedule_rates | `fee_schedule_rates_unique_code` | `fee_schedule_rates_fee_schedule_id_code_type_code_key` |
| security_events | `security_events_actor_user_id_fkey` | `fk_security_events_actor_user` |

### KEPT — LOAD-BEARING, do NOT "clean" (referenced as PostgREST embed hints)
These look like duplicates but their names are used as embed-disambiguation hints in
app code (`alias:profiles!<constraint_name>(...)`). A table with >1 relationship to
profiles/auth.users REQUIRES a named hint; these named constraints ARE those hints.
Dropping any would break live queries or change ON DELETE behavior.

| Table | Constraints | Why kept |
|-------|-------------|----------|
| `security_alerts` (affected_user_id) | `fk_security_alerts_affected_user` (SET NULL) + `security_alerts_affected_user_id_fkey` (no-action) | `security_alerts_affected_user_id_fkey` used in `socDashboardService.ts` embeds; the two carry different ON DELETE (SET NULL vs no-action) — dropping either changes behavior or breaks the embed |
| `security_alerts` (assigned_to) | `fk_security_alerts_assigned_to` + `security_alerts_assigned_to_fkey` | same — `..._assigned_to_fkey` used in `socDashboardService.ts` |
| `encounters` (patient_id) | `encounters_patient_id_fkey` (→auth.users, CASCADE) + `encounters_patient_id_profiles_fkey` (→profiles(id), RESTRICT) | **BOTH** are embed hints in different code paths — `..._fkey` in ProviderAssignmentDashboard/eligibilityVerification/encounterBillingBridge; `..._profiles_fkey` in encounterService/sdohBilling/generate-837p/sdoh-coding-suggest. Two FKs on purpose. |
| `community_moments` (user_id) | `community_moments_user_id_fkey` + `_user_id_auth_fkey` (both →auth.users) + `_user_id_profiles_fkey` (→profiles) | `_fkey` (7 refs) + `_auth_fkey`/`_profiles_fkey` referenced; the multi-FK setup is the documented PostgREST disambiguation (see MEMORY `reference_fk_name_collision_drift`) |
| `fhir_practitioner_roles` (practitioner_id) | `fhir_practitioner_role_practitioner_fk` + `..._practitioner_id_fkey` (both →fhir_practitioners) | `fhir_practitioner_role_practitioner_fk` appears in `database.generated.ts` (type-gen). Safe to drop ONLY with a type regen — deferred, low value. |

## ✅ Resolved — encounters.patient_id two-parent FK (migration `20260710170000`)
`encounters.patient_id` carried TWO FKs: `auth.users(id)` (CASCADE) and
**`profiles(id)`** (RESTRICT — note `id`, not `user_id`). It worked only because
`profiles.id == profiles.user_id` for all 61 rows; it would have silently blocked
encounter inserts for any future patient whose profile had `id <> user_id`.
**Fix:** repointed the SAME-NAMED `encounters_patient_id_profiles_fkey` to
`profiles(user_id)` (the PK/unique join key) — zero code change (every
`profiles!encounters_patient_id_profiles_fkey` embed still resolves by name),
`ON DELETE RESTRICT` and the canonical `auth.users` FK both preserved. Live-verified:
def now `REFERENCES profiles(user_id)`, validated, all 10 rows satisfy it.
(The new `claims.patient_id`, migration `20260710150000`, was deliberately given a
SINGLE FK to `auth.users` per the §5 convention.)

## Regression guard
```sql
-- Dangerous class (must stay 0 rows):
SELECT conrelid::regclass, conkey FROM pg_constraint
WHERE contype='c' AND connamespace='public'::regnamespace
GROUP BY conrelid, conkey HAVING count(*)>1;
```
