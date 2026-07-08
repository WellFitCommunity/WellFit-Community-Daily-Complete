# Clinical / Billing Dashboard Errors — Diagnosis & Repair Tracker

> Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.

**Created:** 2026-07-08
**Reported by:** Maria (runtime errors across clinical/billing admin dashboards)
**Diagnosis:** live-DB verified via Supabase MCP (`information_schema` / `pg_class` / `has_table_privilege`).

---

## Root causes (two classes)

1. **GRANT gap** — several tables/views had RLS enabled + policies but the `authenticated`
   role was never granted table privileges. RLS policies do NOT grant privileges → PostgREST
   returns `permission denied for table`.
2. **Dropped subsystem** — `provider_tasks` / `provider_task_escalation_config` /
   `v_provider_task_queue` were wiped by the `-- migrate:down` + `supabase db push` footgun
   (push runs the whole migration file incl. the DROP block). See
   `reference_migrate_down_db_push_footgun`.

## Status

| # | Error (UI) | Object | Cause | Fix | Status |
|---|---|---|---|---|---|
| 1 | HCC opportunity flag: permission denied | `hcc_categories` | no GRANT | GRANT SELECT | ✅ FIXED |
| 2 | Billing queue: failed to fetch | `encounter_superbills` | no GRANT | GRANT S/I/U | ✅ FIXED |
| 3 | ERA payment posting: failed to fetch remittances | `claim_payments` (embed) | no GRANT | GRANT S/I/U | ✅ FIXED |
| 4 | Unacknowledged results: failed to load | `result_acknowledgments`, `v_unacknowledged_results` | no GRANT | GRANT | ✅ FIXED |
| 5 | Encounter provider assignment: failed to load | `encounter_providers` (embed) | no GRANT | GRANT S/I/U | ✅ FIXED |
| 6 | Provider task queue: not in schema cache | `provider_tasks`, `provider_task_escalation_config`, `v_provider_task_queue` | dropped (footgun) | restore up-only + GRANT | ✅ FIXED |
| 7 | Eligibility verification: failed to fetch encounters | `encounters.payer_id` + `billing_payers` embed | **schema gap** — column/FK never existed | **DECISION NEEDED** | 🟡 OPEN |

Fixes 1–6: migration `20260708120000_restore_provider_tasks_and_grant_billing_clinical_reads.sql`,
applied via `supabase db push`, **live-verified** (all 10 objects exist; `authenticated` has
SELECT on all + INSERT where the services write). Commit `893d197b`.

Also: `code_cpt` was granted SELECT (billing bridge joins it for CPT descriptions).

---

## OPEN — #7 Eligibility payer data model (needs Maria/Akima)

`eligibilityVerificationService` (two methods: `getEncountersForVerification`,
`verifyEncounterEligibility`) is coded against an `encounters.payer_id → billing_payers(id)`
relationship that **does not exist**:
- `encounters` has NO payer column and NO FK to `billing_payers` (only the eligibility
  migration `20260217100000` added `coverage_status`/`coverage_verified_at`/`coverage_details`).
- The list query `SELECT ... payer_id, billing_payers(name, payer_id) ...` → PostgREST errors →
  "Failed to fetch encounters".
- `billing_payers` has **0 rows** — no payers configured at all.

So the payer subsystem for eligibility was never built end-to-end. This is a design decision,
not a mechanical fix:

- **Option A (recommended): add `encounters.payer_id uuid REFERENCES billing_payers(id)` (nullable).**
  Makes both queries valid with zero code change; feature loads (encounters show
  "no payer assigned" until populated — the code already handles that path). Still needs:
  (a) seed `billing_payers`, (b) a path that sets `encounters.payer_id` (scheduling/superbill).
- **Option B: strip payer from the service** (remove `payer_id`/`billing_payers` from both
  queries). Stops the crash but discards the feature's payer design.

**Recommendation:** Option A + a follow-up to seed payers and wire payer assignment.
**Do not guess-apply** — Tier-3 schema change to the core `encounters` table + billing data model.
