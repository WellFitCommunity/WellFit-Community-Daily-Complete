-- Add the missing FK encounters.patient_id -> profiles.id
--
-- Context: the legacy `patients` table was consolidated into `profiles` (the
-- canonical patient/identity store, governance S1), but `encounters.patient_id`
-- was left with no foreign key. Without a declared relationship, PostgREST cannot
-- embed patient demographics into encounter reads (encounterService.getEncounter /
-- getEncountersByPatient). This FK both restores referential integrity and lets the
-- embed resolve natively as `patient:profiles!encounters_patient_id_fkey(...)`.
--
-- Pre-verified live (2026-06-11): 10 encounters, 0 NULL patient_id, 0 orphaned
-- patient_id (all reference a valid profiles.id). profiles.id carries a UNIQUE
-- constraint, so it is a valid FK target. patient_id is already indexed
-- (idx_encounters_patient, idx_encounters_patient_date, idx_encounters_tenant_patient_created).
--
-- ON DELETE RESTRICT: clinical encounter records must not be orphaned/lost if a
-- profile row is removed.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'encounters_patient_id_fkey'
      AND conrelid = 'public.encounters'::regclass
  ) THEN
    ALTER TABLE public.encounters
      ADD CONSTRAINT encounters_patient_id_fkey
      FOREIGN KEY (patient_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;
  END IF;
END $$;
