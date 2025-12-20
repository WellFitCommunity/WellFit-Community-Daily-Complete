-- Fix profiles_restrict_user_update trigger to allow users to update their own profile
-- Previously, the trigger blocked ALL updates except for root users
-- This prevented seniors/patients from saving demographics during registration
-- Updated to handle NULL auth.uid() gracefully and provide better error messages

CREATE OR REPLACE FUNCTION profiles_restrict_user_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid UUID;
BEGIN
  -- Get current user ID
  v_uid := auth.uid();

  -- Allow root/super_admin to update any profile
  IF v_uid IS NOT NULL AND public.is_root(v_uid) THEN
    RETURN NEW;
  END IF;

  -- Allow users to update their OWN profile
  IF v_uid IS NOT NULL AND OLD.user_id = v_uid THEN
    -- Prevent users from changing sensitive fields
    IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
      RAISE EXCEPTION 'Cannot change user_id';
    END IF;
    IF (OLD.is_admin IS NOT TRUE) AND (NEW.is_admin IS TRUE) THEN
      RAISE EXCEPTION 'Cannot self-promote to admin';
    END IF;
    IF NEW.role_code IN (1, 2, 3) AND (OLD.role_code IS NULL OR OLD.role_code NOT IN (1, 2, 3)) THEN
      RAISE EXCEPTION 'Cannot self-promote to admin role';
    END IF;
    RETURN NEW;
  END IF;

  -- If auth context is missing (NULL uid), check if this is a service-level operation
  IF v_uid IS NULL THEN
    -- Allow if request has JWT claims (PostgREST request with token)
    IF current_setting('request.jwt.claims', true) IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Block other updates with informative error
  RAISE EXCEPTION 'Profile update not allowed. auth.uid()=%, OLD.user_id=%', v_uid, OLD.user_id
    USING ERRCODE = 'P0001';
END;
$$;

-- Add RLS policy for users to update their own profile
-- This works alongside the trigger which provides additional security checks
DROP POLICY IF EXISTS profiles_update_own ON profiles;
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
