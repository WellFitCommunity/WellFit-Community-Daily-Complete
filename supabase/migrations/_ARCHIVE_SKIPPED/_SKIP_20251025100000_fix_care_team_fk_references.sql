-- =====================================================================
-- Fix CareTeam FK References to Use auth.users Instead of profiles
-- =====================================================================
-- CRITICAL FIX: FHIR resources should reference auth.users(id) for consistency
-- Current issue: References profiles(user_id) which breaks FHIR standard pattern
-- This migration corrects all FK constraints in fhir_care_teams tables
-- =====================================================================

-- 1. Drop existing constraints that reference profiles(user_id)
ALTER TABLE public.fhir_care_teams
  DROP CONSTRAINT IF EXISTS fhir_care_teams_patient_id_fkey,
  DROP CONSTRAINT IF EXISTS fhir_care_teams_created_by_fkey,
  DROP CONSTRAINT IF EXISTS fhir_care_teams_updated_by_fkey;

ALTER TABLE public.fhir_care_team_members
  DROP CONSTRAINT IF EXISTS fhir_care_team_members_member_user_id_fkey;

-- 2. Add correct constraints referencing auth.users(id)
ALTER TABLE public.fhir_care_teams
  ADD CONSTRAINT fhir_care_teams_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.fhir_care_teams
  ADD CONSTRAINT fhir_care_teams_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.fhir_care_teams
  ADD CONSTRAINT fhir_care_teams_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.fhir_care_team_members
  ADD CONSTRAINT fhir_care_team_members_member_user_id_fkey
    FOREIGN KEY (member_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Update comments to reflect correct FK pattern
COMMENT ON COLUMN public.fhir_care_teams.patient_id IS 'FHIR reference to patient (auth.users.id)';
COMMENT ON COLUMN public.fhir_care_teams.created_by IS 'User who created the care team (auth.users.id)';
COMMENT ON COLUMN public.fhir_care_teams.updated_by IS 'User who last updated the care team (auth.users.id)';
COMMENT ON COLUMN public.fhir_care_team_members.member_user_id IS 'Local user reference for team member (auth.users.id)';

-- 4. Verify constraint updates
DO $$
DECLARE
  v_constraint_count INTEGER;
BEGIN
  -- Count constraints on fhir_care_teams that reference auth.users
  SELECT COUNT(*) INTO v_constraint_count
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
  WHERE tc.table_name = 'fhir_care_teams'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'users'
    AND ccu.table_schema = 'auth';

  IF v_constraint_count < 3 THEN
    RAISE WARNING 'Expected 3 FK constraints to auth.users on fhir_care_teams, found %', v_constraint_count;
  ELSE
    RAISE NOTICE 'Successfully created % FK constraints to auth.users on fhir_care_teams', v_constraint_count;
  END IF;
END $$;

COMMENT ON TABLE public.fhir_care_teams IS 'FHIR R4 CareTeam resource - Uses auth.users(id) for all user references (FHIR standard pattern)';
