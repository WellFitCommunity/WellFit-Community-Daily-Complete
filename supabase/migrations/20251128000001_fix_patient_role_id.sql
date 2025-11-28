-- ============================================================================
-- Fix patient role ID: move from 16 to 19
-- Issue: Patient was incorrectly assigned ID 16 (which is case_manager)
-- Correct mapping:
--   4 = senior
--   16 = case_manager
--   19 = patient
-- ============================================================================

BEGIN;

-- First, check if role 16 is 'patient' and needs to be moved
DO $$
DECLARE
  role_16_name TEXT;
  role_19_exists BOOLEAN;
BEGIN
  -- Get current role at ID 16
  SELECT name INTO role_16_name FROM public.roles WHERE id = 16;

  -- Check if role 19 exists
  SELECT EXISTS(SELECT 1 FROM public.roles WHERE id = 19) INTO role_19_exists;

  -- If role 16 is 'patient', we need to fix it
  IF role_16_name = 'patient' THEN
    -- Update any profiles using role_id=16 for patient to use 19
    -- First, ensure role 19 exists
    IF NOT role_19_exists THEN
      INSERT INTO public.roles (id, name) VALUES (19, 'patient');
    END IF;

    -- Update profiles that have role_id=16 with role='patient' or role_slug='patient'
    UPDATE public.profiles
    SET role_id = 19
    WHERE role_id = 16
      AND (role = 'patient' OR role_slug = 'patient');

    -- Now we can update role 16 to be case_manager (or delete if we want to reassign)
    -- Check if case_manager already exists elsewhere
    IF NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'case_manager' AND id != 16) THEN
      UPDATE public.roles SET name = 'case_manager' WHERE id = 16;
    ELSE
      -- case_manager exists elsewhere, just delete the duplicate patient entry
      DELETE FROM public.roles WHERE id = 16 AND name = 'patient';
    END IF;

    RAISE NOTICE 'Migrated patient role from ID 16 to ID 19';
  ELSE
    -- Role 16 is not patient, just ensure patient exists at 19
    IF NOT role_19_exists THEN
      INSERT INTO public.roles (id, name) VALUES (19, 'patient');
      RAISE NOTICE 'Created patient role at ID 19';
    ELSE
      RAISE NOTICE 'Patient role already exists at ID 19';
    END IF;
  END IF;
END$$;

-- Ensure all required roles exist with correct IDs
INSERT INTO public.roles (id, name) VALUES (4, 'senior') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.roles (id, name) VALUES (19, 'patient') ON CONFLICT (id) DO NOTHING;

-- Update the comment on roles table
COMMENT ON TABLE public.roles IS 'User roles in the system. Role IDs: 4=senior, 16=case_manager, 19=patient. "patient" is the universal care recipient role. "senior" is for backward compatibility with existing users.';

COMMIT;
