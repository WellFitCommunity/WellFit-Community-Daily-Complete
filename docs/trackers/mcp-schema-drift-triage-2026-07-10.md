# MCP + FHIR Schema-Drift Triage — 2026-07-10

**Origin:** The FHIR schema-drift gate (`scripts/check-fhir-service-schema.py`) was
generalized from the MCP FHIR server to **every** `mcp-*` server plus the app-side
`src/services/fhir/` layer. On the first full-scope run it surfaced **46 candidate
column-drift findings** across 8 files. Each was verified against the live DB
(`information_schema`) by reading the actual source line — **all 46 were real
runtime-dead drift; 0 false positives, 0 snapshot staleness.**

## Status

| Bucket | Count | Disposition |
|--------|------:|-------------|
| Clean renames (MCP servers) | 22 | ✅ Fixed + deno-check clean |
| B2 claims fallback (encounter-join) | 2 | ✅ Fixed (no schema change) |
| B3 self_reports drop | 2 | ✅ Fixed (summary sourced from real `mood`) |
| B4 profiles.preferred_language drop | 1 | ✅ Fixed (returns `null`) |
| EncounterService remap (Option A) | 14 | ✅ Fixed + tests updated |
| **B1 caregiver contacts** | 8 | ⏸️ **HELD — baselined pending Maria's caregiver-model decision** |

Gate: **green** (139 files clean, 8 baselined). Scoped typecheck 0, eslint 0,
affected tests 34/34.

## Fixes applied (real column mappings, live-verified)

- **mcp-patient-context-server/fetchers.ts** — care_team (`member_` prefix),
  check_ins (`mood→emotional_state`), readmission (`readmission_risk_score`,
  `risk_category`), fall-risk (`overall_risk_score`/`risk_category`/`assessment_date`),
  self_reports (dropped nonexistent `symptom_category`/`severity`; summary from `mood`),
  profiles (dropped nonexistent `preferred_language`).
- **mcp-prior-auth-server/toolHandlers.ts** — `service_code→cpt_code`,
  `description→cpt_description`, `units→requested_units`, `status→line_status`.
- **mcp-medical-coding-server** + **mcp-drg-grouper-server** (twins) —
  `clinical_notes.type→note_type`, `encounters.notes→clinical_notes`, and claims
  charge-aggregation fallback rewired patient→encounters→claims (claims carries no
  `patient_id`/`service_date`).
- **src/services/fhir/EncounterService.ts** — Option A: dropped the FHIR-shaped
  column list (`class_code`, `period_start`, `reason_code`, `participant`,
  `hospitalization`, … — present in neither `encounters` nor `fhir_encounters`),
  now selects the operational `encounters` columns; `complete()` stamps
  `visit_ended_at` + `status='completed'`; `getActive` uses live statuses
  (`arrived`/`triaged`/`in_progress`); `getByClass`→`getByType`. Consumer
  `patient-context/fetchTimeline.extractLastEncounter` + both test files updated.

## OPEN — decisions for Maria

1. **B1 — Caregiver contacts model.** `caregiver_view_grants` is the access-grant
   edge (the PIN / read-only monitoring mechanism), not a contact record. Contact
   fields live on `profiles.caregiver_*`. Proposed fix: list caregivers by joining
   grant→profiles (by `senior_user_id`, active = `expires_at IS NULL OR > now()`)
   **plus** the senior's own `profiles.caregiver_*` as the primary contact — giving
   the "more than one way to reach caregiver info" goal. Baselined in
   `scripts/fhir-schema-gate-baseline.txt` (8 entries) until decided.
2. **B2 — `claims.patient_id`.** The encounter-join fix is correct today. If claims
   should carry `patient_id` as a first-class column (837P-style), that's a separate
   deliberate migration + backfill — not bundled here.

## Regression guard

Re-run any time: `python3 scripts/check-fhir-service-schema.py` (wired in
`ci-cd.yml`). Refresh the snapshot after any migration touching a covered table.
