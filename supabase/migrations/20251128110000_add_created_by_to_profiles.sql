-- ============================================================================
-- Add created_by Column to Profiles Table
-- ============================================================================
-- Purpose: Track which staff member enrolled a patient/senior
-- This is used when clinical staff (admin, nurse) enrolls someone,
-- NOT for self-registration where the user creates their own account.
--
-- Date: 2025-11-28
-- ============================================================================

-- Add created_by column to track who enrolled this user
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for reporting (find all patients enrolled by a specific staff member)
CREATE INDEX IF NOT EXISTS idx_profiles_created_by ON public.profiles(created_by)
WHERE created_by IS NOT NULL;

-- Add helpful comment
COMMENT ON COLUMN public.profiles.created_by IS
'User ID of the staff member (admin/nurse) who enrolled this patient. NULL for self-registration.';
