-- Fix profiles_restrict_user_update trigger to allow users to update their own profile
-- Previously, the trigger blocked ALL updates except for root users
-- This prevented seniors/patients from saving demographics during registration
-- Updated to use NULL-safe comparisons to handle new user profiles with NULL fields

CREATE OR REPLACE FUNCTION profiles_restrict_user_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Allow root/super_admin to update any profile
  IF public.is_root(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Allow users to update their OWN profile
  IF OLD.user_id = auth.uid() THEN
    -- Prevent users from changing sensitive fields (NULL-safe comparisons)
    IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
      RAISE EXCEPTION 'Cannot change user_id';
    END IF;
    -- Only block if trying to SET is_admin to true (not if it stays the same)
    IF (OLD.is_admin IS NOT TRUE) AND (NEW.is_admin IS TRUE) THEN
      RAISE EXCEPTION 'Cannot self-promote to admin';
    END IF;
    -- Only block if trying to SET role_code to admin roles
    IF NEW.role_code IN (1, 2, 3) AND (OLD.role_code IS NULL OR OLD.role_code NOT IN (1, 2, 3)) THEN
      RAISE EXCEPTION 'Cannot self-promote to admin role';
    END IF;
    RETURN NEW;
  END IF;

  -- Block other updates
  RAISE EXCEPTION 'Only administrators may edit other profiles.'
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
