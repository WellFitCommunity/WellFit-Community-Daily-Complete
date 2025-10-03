-- ==============================================================================
-- Migration: Add Missing Profile Columns for Enrollment Flow
-- Date: 2025-10-03
-- Author: System Administrator
--
-- PURPOSE:
-- Ensure profiles table has all columns needed for the complete enrollment flow.
-- The EnrollSeniorPage collects data that was not being saved due to missing
-- columns or mismatched field names between the form and the database.
--
-- PROBLEM:
-- 1. EnrollSeniorPage (admin form) collects: date_of_birth, emergency_contact_phone,
--    caregiver_email, notes - but these weren't being saved during enrollment
-- 2. The enrollClient Edge Function was using 'id' instead of 'user_id' as PK
-- 3. DemographicsPage expects 'user_id' but enrollment created 'id'
--
-- DATA FLOW:
-- EnrollSeniorPage -> enrollClient Edge Function -> profiles table -> DemographicsPage
--
-- COLUMNS ADDED:
-- - emergency_contact_phone: Next of kin contact number (labeled "Next of Kin" in UI)
-- - emergency_contact_relationship: Relationship to patient (spouse, child, etc.)
-- - admin_enrollment_notes: Admin notes from enrollment (not exposed to patient)
-- - demographics_step: Tracks progress through demographics wizard (1-6)
--
-- EXISTING COLUMNS (already in schema from previous migrations):
-- - user_id (PK) - references auth.users(id)
-- - first_name, last_name, phone, email
-- - dob (maps to date_of_birth from form)
-- - emergency_contact_name (next of kin name)
-- - caregiver_email
-- - gender, ethnicity, marital_status, living_situation
-- - health_conditions, medications, mobility_level
-- - demographics_complete (boolean flag)
--
-- COMPATIBILITY:
-- - Safe to run multiple times (uses ADD COLUMN IF NOT EXISTS)
-- - No data migration needed
-- - Backward compatible with existing code
-- ==============================================================================

-- migrate:up
begin;

-- Add emergency contact phone (Next of Kin phone in UI)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS emergency_contact_phone text;

-- Add emergency contact relationship
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS emergency_contact_relationship text
  CHECK (emergency_contact_relationship IN (
    'spouse', 'child', 'parent', 'sibling',
    'friend', 'neighbor', 'caregiver', 'other'
  ));

-- Add admin enrollment notes (not visible to patient)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS admin_enrollment_notes text;

-- Add demographics wizard progress tracking
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS demographics_step integer
  CHECK (demographics_step >= 1 AND demographics_step <= 6);

-- Add index for emergency contact lookups (for caregiver notifications)
CREATE INDEX IF NOT EXISTS idx_profiles_emergency_phone
  ON public.profiles (emergency_contact_phone)
  WHERE emergency_contact_phone IS NOT NULL;

-- Add index for demographics completion tracking
CREATE INDEX IF NOT EXISTS idx_profiles_demographics_complete
  ON public.profiles (demographics_complete)
  WHERE demographics_complete = false;

-- Add helpful comments for documentation
COMMENT ON COLUMN public.profiles.emergency_contact_phone IS
  'Next of Kin contact phone. Displayed as "Next of Kin" in patient UI.';

COMMENT ON COLUMN public.profiles.emergency_contact_relationship IS
  'Relationship of emergency contact to patient. Options: spouse, child, parent, sibling, friend, neighbor, caregiver, other.';

COMMENT ON COLUMN public.profiles.admin_enrollment_notes IS
  'Private notes from admin during enrollment. Not visible to patient. Used for internal tracking only.';

COMMENT ON COLUMN public.profiles.demographics_step IS
  'Tracks progress through 6-step demographics wizard. NULL = not started or completed. 1-6 = current step if in progress.';

commit;

-- migrate:down
begin;

-- Drop indexes
DROP INDEX IF EXISTS idx_profiles_emergency_phone;
DROP INDEX IF EXISTS idx_profiles_demographics_complete;

-- Drop columns (use with caution in production - will lose data!)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS demographics_step;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS admin_enrollment_notes;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS emergency_contact_relationship;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS emergency_contact_phone;

commit;
