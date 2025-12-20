-- Fix profiles_restrict_user_update trigger to allow users to update their own profile
-- Previously, the trigger blocked ALL updates except for root users
-- This prevented seniors/patients from saving demographics during registration

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
    -- Prevent users from changing sensitive fields
    IF OLD.user_id != NEW.user_id THEN
      RAISE EXCEPTION 'Cannot change user_id';
    END IF;
    IF OLD.is_admin IS DISTINCT FROM NEW.is_admin AND NEW.is_admin = true THEN
      RAISE EXCEPTION 'Cannot self-promote to admin';
    END IF;
    IF OLD.role_code IS DISTINCT FROM NEW.role_code AND NEW.role_code IN (1, 2, 3) THEN
      RAISE EXCEPTION 'Cannot self-promote to admin role';
    END IF;
    RETURN NEW;
  END IF;

  -- Block other updates
  RAISE EXCEPTION 'Only administrators may edit other profiles. Contact admin for edits.'
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
