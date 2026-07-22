-- Widen encounters.encounter_type CHECK with hospital arrival values
-- (tracker: docs/trackers/ems-and-hospital-transfer-repair-tracker-2026-07-22.md)
--
-- LIVE-PROBE FINDING (2026-07-22, authenticated round-trip): the live CHECK
-- only allows outpatient/behavioral values (initial_evaluation, follow_up,
-- discharge, telehealth, group_therapy, consultation) — the EMS and
-- hospital-transfer integrations create 'emergency'/'inpatient' encounters,
-- which the constraint rejected. Additive widen; existing rows (all
-- 'follow_up') unaffected.
--
-- Forward-only; no `-- migrate:down` block (db push executes down blocks — documented footgun).

ALTER TABLE public.encounters DROP CONSTRAINT IF EXISTS encounters_encounter_type_check;
ALTER TABLE public.encounters ADD CONSTRAINT encounters_encounter_type_check
  CHECK (encounter_type = ANY (ARRAY[
    'initial_evaluation'::text,
    'follow_up'::text,
    'discharge'::text,
    'telehealth'::text,
    'group_therapy'::text,
    'consultation'::text,
    'emergency'::text,
    'inpatient'::text
  ]));
