-- pg_constraint name-collision / duplicate sweep (2026-07-10).
--
-- Context: the first 2026-07-10 session found user_questions_status_check1 — a
-- stale DUPLICATE CHECK that intersected with the base constraint and silently
-- narrowed the valid domain (broke the nurse claim/escalate workflow). This sweep
-- confirms that dangerous class (>1 CHECK on the same column) is now CLEAN
-- fleet-wide. It also enumerated all duplicate FK/UNIQUE constraints (9 across 7
-- tables). Unlike duplicate CHECKs, duplicate FK/UNIQUE do NOT block valid rows,
-- so nothing was actively broken.
--
-- MOST of those duplicates are LOAD-BEARING and intentionally kept: their names are
-- used as PostgREST embed-disambiguation hints in app code (e.g.
-- profiles!security_alerts_affected_user_id_fkey in socDashboardService.ts;
-- profiles!encounters_patient_id_profiles_fkey in encounterService.ts / generate-837p;
-- the encounters/community_moments tables carry two FKs on purpose so different code
-- paths can embed profiles by name). Dropping those would break live queries or
-- change ON DELETE behavior — so they are left as-is.
--
-- This migration drops ONLY the 4 constraints that are BOTH an exact-duplicate of a
-- sibling AND have ZERO references anywhere in the codebase, leaving one equivalent
-- constraint (identical column set, target, and ON DELETE — no behavior change; also
-- removes a redundant "more than one relationship" ambiguity for PostgREST).
-- Forward-only; no `-- migrate:down` block (db push executes down blocks).

-- fhir_care_plans: two identical FK(patient_id) -> auth.users(id) ON DELETE CASCADE.
ALTER TABLE public.fhir_care_plans DROP CONSTRAINT IF EXISTS fhir_care_plan_patient_fk;

-- fhir_practitioners: two identical FK(user_id) -> auth.users(id) ON DELETE CASCADE.
ALTER TABLE public.fhir_practitioners DROP CONSTRAINT IF EXISTS fhir_practitioner_user_fk;

-- fee_schedule_rates: two identical UNIQUE(fee_schedule_id, code_type, code).
ALTER TABLE public.fee_schedule_rates DROP CONSTRAINT IF EXISTS fee_schedule_rates_unique_code;

-- security_events: two identical FK(actor_user_id) -> auth.users(id) ON DELETE SET NULL.
ALTER TABLE public.security_events DROP CONSTRAINT IF EXISTS security_events_actor_user_id_fkey;
