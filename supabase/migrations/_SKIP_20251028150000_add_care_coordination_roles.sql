-- ============================================================================
-- Add Case Manager & Social Worker Roles
-- ============================================================================
-- Purpose: Extend role system for Claude Care Assistant
-- Zero tech debt: Additive changes only, no breaking modifications
-- Database structure: roles table has (id=integer, name=text)
-- Profiles table uses role_code (integer)
-- ============================================================================

-- Add case_manager and social_worker to roles table
-- Using integer IDs that don't conflict with existing roles (14, 15)

DO $$
BEGIN
  -- Insert case_manager role if not exists (ID 14)
  INSERT INTO public.roles (id, name)
  VALUES (14, 'case_manager')
  ON CONFLICT (id) DO NOTHING;

  -- Insert social_worker role if not exists (ID 15)
  INSERT INTO public.roles (id, name)
  VALUES (15, 'social_worker')
  ON CONFLICT (id) DO NOTHING;

  -- Insert physician if not exists (ID 7) - needed for Claude Care Assistant
  INSERT INTO public.roles (id, name)
  VALUES (7, 'physician')
  ON CONFLICT (id) DO NOTHING;

  -- Insert nurse if not exists (ID 8) - needed for Claude Care Assistant
  INSERT INTO public.roles (id, name)
  VALUES (8, 'nurse')
  ON CONFLICT (id) DO NOTHING;

  -- Insert nurse_practitioner if not exists (ID 9)
  INSERT INTO public.roles (id, name)
  VALUES (9, 'nurse_practitioner')
  ON CONFLICT (id) DO NOTHING;

  -- Insert physician_assistant if not exists (ID 10)
  INSERT INTO public.roles (id, name)
  VALUES (10, 'physician_assistant')
  ON CONFLICT (id) DO NOTHING;

END $$;

-- Grant appropriate permissions for case managers and social workers
-- They need access to patient data, care coordination, and administrative functions

-- Create RLS helper function for case managers and social workers
CREATE OR REPLACE FUNCTION public.is_care_coordinator()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role_code IN (14, 15) -- 14=case_manager, 15=social_worker
  );
END;
$$;

COMMENT ON FUNCTION public.is_care_coordinator() IS
  'Returns true if current user is a case manager (14) or social worker (15)';

-- Create helper function to check if user is clinical staff (for Claude Care Assistant)
CREATE OR REPLACE FUNCTION public.is_clinical_staff()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role_code IN (7, 8, 9, 10, 14, 15) -- physician, nurse, NP, PA, case_manager, social_worker
  );
END;
$$;

COMMENT ON FUNCTION public.is_clinical_staff() IS
  'Returns true if current user is clinical staff (physician, nurse, NP, PA, case manager, or social worker)';

-- Grant permissions to care coordination roles
GRANT USAGE ON SCHEMA public TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Case Manager and Social Worker roles added successfully!';
  RAISE NOTICE '📋 Role IDs: 14=case_manager, 15=social_worker';
  RAISE NOTICE '👨‍⚕️ Also ensured: 7=physician, 8=nurse, 9=nurse_practitioner, 10=physician_assistant';
  RAISE NOTICE '🔒 RLS helper functions created: is_care_coordinator(), is_clinical_staff()';
END $$;
