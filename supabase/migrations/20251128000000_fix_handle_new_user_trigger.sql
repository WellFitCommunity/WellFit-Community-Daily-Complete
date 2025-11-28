-- ============================================================================
-- Fix handle_new_user trigger causing "Database error creating new user"
-- Issue: Trigger was hardcoded to role_id=1 (admin) instead of role_id=4 (senior)
-- Solution: Make trigger conditional and use correct default role
-- ============================================================================

-- Role IDs in this system:
-- 1 = admin
-- 2 = super_admin
-- 4 = senior (default for self-registration)
-- 16 = case_manager
-- 19 = patient

-- Ensure senior role exists (id=4) - default for self-registration
-- Note: senior already exists in production, this is just a safety check
INSERT INTO public.roles (id, name, tenant_id)
SELECT 4, 'senior', '2b902657-6a20-4435-a78a-576f397517ca'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE id = 4);

-- Update the handle_new_user trigger to be SAFE and CONDITIONAL
-- This prevents errors when:
-- 1. Profile is created explicitly by registration code
-- 2. Role doesn't exist
-- 3. User metadata is incomplete
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  default_role_id INTEGER := 4;  -- 'senior' role as default for self-registration
  existing_profile UUID;
BEGIN
  -- Check if profile already exists (registration code may have created it)
  SELECT user_id INTO existing_profile
  FROM public.profiles
  WHERE user_id = NEW.id
  LIMIT 1;

  IF existing_profile IS NOT NULL THEN
    -- Profile already exists, skip creation
    RETURN NEW;
  END IF;

  -- Try to get role from metadata, fallback to default
  IF NEW.raw_user_meta_data->>'role_code' IS NOT NULL THEN
    -- Look up role by code/slug
    SELECT id INTO default_role_id
    FROM public.roles
    WHERE name = NEW.raw_user_meta_data->>'role_slug'
       OR name = NEW.raw_user_meta_data->>'role_code'
    LIMIT 1;

    -- If not found, use senior role (default for self-registration)
    IF default_role_id IS NULL THEN
      default_role_id := 4;
    END IF;
  END IF;

  -- Create profile with error handling
  BEGIN
    INSERT INTO public.profiles (
      user_id,
      first_name,
      last_name,
      phone,
      role_id,
      onboarded,
      phone_verified,
      email_verified,
      consent
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
      NEW.phone,
      default_role_id,
      false,
      COALESCE(NEW.phone_confirmed_at IS NOT NULL, false),
      COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
      true
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log but don't fail user creation if profile insert fails
    -- The registration code will handle profile creation
    RAISE WARNING 'handle_new_user trigger: profile creation skipped - %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

-- Add comment explaining the trigger
COMMENT ON FUNCTION public.handle_new_user() IS
'Auto-creates a profile when a new auth user is created.
Safe and conditional: skips if profile exists, handles missing roles gracefully.
Registration flows (sms-verify-code) also create profiles, so this is a fallback.';

-- Ensure trigger exists on auth.users (may already exist)
DO $$
BEGIN
  -- Check if trigger exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    -- Create trigger if it doesn't exist
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();
  END IF;
END$$;
