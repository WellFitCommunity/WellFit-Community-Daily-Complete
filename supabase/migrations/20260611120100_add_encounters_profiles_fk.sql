-- Add encounters.patient_id -> profiles.id FK (for PostgREST embedding)
--
-- Corrective follow-up to 20260611120000: that migration tried to add
-- `encounters_patient_id_fkey` REFERENCES profiles(id), but a constraint of that
-- exact name ALREADY existed referencing auth.users(id) — so the IF NOT EXISTS guard
-- skipped it (no-op). (The pre-existing auth.users FK wasn't visible in the earlier
-- information_schema check because its target lives in the `auth` schema.)
--
-- encounterService embeds patient demographics into encounter reads, which requires
-- a declared relationship encounters -> profiles. The existing auth.users FK does NOT
-- give PostgREST a profiles relationship. This adds a DISTINCTLY-NAMED FK to profiles
-- so the embed can resolve as `patient:profiles!encounters_patient_id_profiles_fkey(...)`.
-- It coexists with the auth.users FK (both hold: profiles.id == user_id == auth.users.id
-- for every patient; verified 0 orphaned / 0 NULL patient_id across 10 encounters).
--
-- ON DELETE RESTRICT: clinical encounters must not be orphaned if a profile is removed.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'encounters_patient_id_profiles_fkey'
      AND conrelid = 'public.encounters'::regclass
  ) THEN
    ALTER TABLE public.encounters
      ADD CONSTRAINT encounters_patient_id_profiles_fkey
      FOREIGN KEY (patient_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;
  END IF;
END $$;
