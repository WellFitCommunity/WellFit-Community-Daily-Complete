-- Migration: Fix profile creation for new users
-- Issue 1: Missing trigger on auth.users to call handle_new_user()
-- Issue 2: Conflicting RLS INSERT policy requiring admin privileges

-- ============================================================================
-- STEP 1: Create the missing trigger on auth.users
-- ============================================================================
-- The handle_new_user() function exists but was never hooked to auth.users

DO $$
BEGIN
  -- Check if trigger already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'auth'
    AND c.relname = 'users'
    AND t.tgname = 'on_auth_user_created'
  ) THEN
    -- Create trigger to auto-create profile on user signup
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();

    RAISE NOTICE 'Created trigger: on_auth_user_created on auth.users';
  ELSE
    RAISE NOTICE 'Trigger on_auth_user_created already exists';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Fix the conflicting INSERT policy
-- ============================================================================
-- The policy "merged_insert_auth_35225333" requires is_admin_or_super_admin()
-- which blocks regular users from creating their own profile.
--
-- We need to either:
-- A) Drop it (if profiles_insert_own is sufficient)
-- B) Modify it to also allow self-insert
--
-- Safest approach: Drop the restrictive policy since profiles_insert_own
-- already handles the legitimate use case (users inserting their own profile)

DO $$
BEGIN
  -- Drop the overly restrictive admin-only insert policy
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'merged_insert_auth_35225333'
  ) THEN
    DROP POLICY "merged_insert_auth_35225333" ON public.profiles;
    RAISE NOTICE 'Dropped policy: merged_insert_auth_35225333';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Ensure profiles_insert_own policy exists and is correct
-- ============================================================================
-- This policy should allow users to insert their own profile during registration

DO $$
BEGIN
  -- Check if profiles_insert_own exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'profiles_insert_own'
  ) THEN
    -- Create the self-insert policy
    CREATE POLICY "profiles_insert_own" ON public.profiles
      FOR INSERT
      WITH CHECK (
        user_id = auth.uid()
        AND tenant_id IS NOT NULL
      );
    RAISE NOTICE 'Created policy: profiles_insert_own';
  ELSE
    RAISE NOTICE 'Policy profiles_insert_own already exists';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Add admin insert policy for admins creating other users' profiles
-- ============================================================================
-- Admins should still be able to create profiles for other users

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'profiles_admin_insert'
  ) THEN
    CREATE POLICY "profiles_admin_insert" ON public.profiles
      FOR INSERT
      TO authenticated
      WITH CHECK (
        public.is_admin_or_super_admin()
      );
    RAISE NOTICE 'Created policy: profiles_admin_insert';
  ELSE
    RAISE NOTICE 'Policy profiles_admin_insert already exists';
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Add service role bypass for the trigger (SECURITY DEFINER handles this)
-- ============================================================================
-- The handle_new_user() function uses SECURITY DEFINER so it runs as postgres
-- This means it bypasses RLS, but let's ensure service_role can also insert

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'profiles_insert_svc'
  ) THEN
    CREATE POLICY "profiles_insert_svc" ON public.profiles
      FOR INSERT
      TO service_role
      WITH CHECK (true);
    RAISE NOTICE 'Created policy: profiles_insert_svc';
  ELSE
    RAISE NOTICE 'Policy profiles_insert_svc already exists';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (for manual testing)
-- ============================================================================
-- Run these to verify the fix:
--
-- 1. Check trigger exists:
-- SELECT tgname, tgenabled FROM pg_trigger t
-- JOIN pg_class c ON t.tgrelid = c.oid
-- JOIN pg_namespace n ON c.relnamespace = n.oid
-- WHERE n.nspname = 'auth' AND c.relname = 'users';
--
-- 2. Check INSERT policies on profiles:
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'profiles' AND cmd = 'INSERT';
--
-- 3. Test by creating a user via Supabase Auth and checking if profile is created
