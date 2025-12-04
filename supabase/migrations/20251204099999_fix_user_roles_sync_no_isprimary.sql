-- ============================================================================
-- Fix sync_user_roles_from_profiles - remove is_primary reference
-- The user_roles table doesn't have an is_primary column
-- ============================================================================

-- Update the trigger function to not reference is_primary
CREATE OR REPLACE FUNCTION sync_user_roles_from_profiles()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip for hospital patients (they don't have auth.users records)
  IF NEW.enrollment_type = 'hospital' THEN
    RETURN NEW;
  END IF;

  -- Only sync if role_id is set and user_id exists in auth.users
  IF NEW.role_id IS NOT NULL THEN
    -- Check if user exists in auth.users before inserting
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.user_id) THEN
      -- Insert into user_roles (no is_primary column)
      INSERT INTO user_roles (user_id, role_id)
      VALUES (NEW.user_id, NEW.role_id)
      ON CONFLICT (user_id, role_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
