-- ============================================================================
-- Fix profiles INSERT RLS policy for new user registration
-- ============================================================================
-- Problem: profiles_tenant_insert requires tenant_id = get_current_tenant_id()
-- But get_current_tenant_id() looks up tenant_id FROM profiles
-- This creates a chicken-and-egg problem for new users!
--
-- Solution: Allow INSERT if:
--   1. user_id = auth.uid() (user can only create their own profile)
--   2. tenant_id is the default tenant OR matches a tenant they're assigned to
-- ============================================================================

-- Default tenant ID (WellFit Community)
-- This is used for self-registration when no tenant is specified

-- Drop the problematic policy
DROP POLICY IF EXISTS "profiles_tenant_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;

-- Create INSERT policy that:
-- 1. Requires user_id = auth.uid() (users can only create their own profile)
-- 2. Requires tenant_id to be set (white-label requires tenant identification)
-- 3. For new users, accepts the default WellFit tenant OR existing tenant context
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id IS NOT NULL
    AND (
      -- Default WellFit tenant for self-registration
      tenant_id = '2b902657-6a20-4435-a78a-576f397517ca'::uuid
      -- OR user already has a tenant context (admin-created users)
      OR tenant_id = COALESCE(
        current_setting('app.current_tenant_id', true)::uuid,
        '2b902657-6a20-4435-a78a-576f397517ca'::uuid
      )
    )
  );

-- Also ensure the handle_new_user trigger sets a default tenant_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  default_role_id INTEGER := 4;  -- 'senior' role as default for self-registration
  default_tenant_id UUID := '2b902657-6a20-4435-a78a-576f397517ca';
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
    SELECT id INTO default_role_id
    FROM public.roles
    WHERE name = NEW.raw_user_meta_data->>'role_slug'
       OR name = NEW.raw_user_meta_data->>'role_code'
    LIMIT 1;

    IF default_role_id IS NULL THEN
      default_role_id := 4;
    END IF;
  END IF;

  -- Try to get tenant from metadata, fallback to default
  IF NEW.raw_user_meta_data->>'tenant_id' IS NOT NULL THEN
    default_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::uuid;
  END IF;

  -- Create profile with error handling
  BEGIN
    INSERT INTO public.profiles (
      user_id,
      first_name,
      last_name,
      phone,
      role_id,
      tenant_id,
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
      default_tenant_id,
      false,
      COALESCE(NEW.phone_confirmed_at IS NOT NULL, false),
      COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
      true
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log but don't fail user creation if profile insert fails
    RAISE WARNING 'handle_new_user trigger: profile creation failed - %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.handle_new_user() IS
'Auto-creates a profile when a new auth user is created.
Now includes tenant_id assignment using default tenant for self-registration.';
