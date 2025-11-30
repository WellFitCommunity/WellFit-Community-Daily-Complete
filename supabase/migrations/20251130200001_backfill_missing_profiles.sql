-- Migration: Backfill missing profiles for existing auth.users
-- This creates profiles for any users who registered but don't have a profile

-- ============================================================================
-- STEP 1: Create backfill function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.backfill_missing_profiles()
RETURNS TABLE(user_id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_record RECORD;
  default_tenant_id UUID := '2b902657-6a20-4435-a78a-576f397517ca';
  default_role_id INTEGER := 4; -- senior
  created_count INTEGER := 0;
  skipped_count INTEGER := 0;
BEGIN
  -- Find all auth.users without a profile
  FOR user_record IN
    SELECT
      u.id,
      u.phone,
      u.email,
      u.raw_user_meta_data,
      u.phone_confirmed_at,
      u.email_confirmed_at,
      u.created_at
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    WHERE p.user_id IS NULL
  LOOP
    BEGIN
      -- Determine role from metadata if available
      IF user_record.raw_user_meta_data->>'role_code' IS NOT NULL THEN
        SELECT r.id INTO default_role_id
        FROM public.roles r
        WHERE r.name = user_record.raw_user_meta_data->>'role_slug'
           OR r.name = user_record.raw_user_meta_data->>'role_code'
        LIMIT 1;

        IF default_role_id IS NULL THEN
          default_role_id := 4;
        END IF;
      END IF;

      -- Determine tenant from metadata if available
      IF user_record.raw_user_meta_data->>'tenant_id' IS NOT NULL THEN
        default_tenant_id := (user_record.raw_user_meta_data->>'tenant_id')::uuid;
      ELSE
        default_tenant_id := '2b902657-6a20-4435-a78a-576f397517ca';
      END IF;

      -- Create the profile
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
        consent,
        created_at
      )
      VALUES (
        user_record.id,
        COALESCE(user_record.raw_user_meta_data->>'first_name', ''),
        COALESCE(user_record.raw_user_meta_data->>'last_name', ''),
        user_record.phone,
        default_role_id,
        default_tenant_id,
        false,
        COALESCE(user_record.phone_confirmed_at IS NOT NULL, false),
        COALESCE(user_record.email_confirmed_at IS NOT NULL, false),
        true,
        user_record.created_at
      );

      created_count := created_count + 1;
      user_id := user_record.id;
      status := 'created';
      RETURN NEXT;

    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue with next user
      skipped_count := skipped_count + 1;
      user_id := user_record.id;
      status := 'error: ' || SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;

  -- Final summary
  RAISE NOTICE 'Backfill complete: % profiles created, % skipped due to errors', created_count, skipped_count;
END;
$$;

COMMENT ON FUNCTION public.backfill_missing_profiles() IS
'Creates profiles for any auth.users that are missing them. Safe to run multiple times.';

-- ============================================================================
-- STEP 2: Run the backfill
-- ============================================================================
DO $$
DECLARE
  result RECORD;
  total_created INTEGER := 0;
  total_errors INTEGER := 0;
BEGIN
  FOR result IN SELECT * FROM public.backfill_missing_profiles()
  LOOP
    IF result.status = 'created' THEN
      total_created := total_created + 1;
      RAISE NOTICE 'Created profile for user: %', result.user_id;
    ELSE
      total_errors := total_errors + 1;
      RAISE WARNING 'Failed to create profile for user %: %', result.user_id, result.status;
    END IF;
  END LOOP;

  RAISE NOTICE '=== BACKFILL SUMMARY ===';
  RAISE NOTICE 'Total profiles created: %', total_created;
  RAISE NOTICE 'Total errors: %', total_errors;
END $$;

-- ============================================================================
-- STEP 3: Verify results
-- ============================================================================
-- Count users without profiles (should be 0 after backfill)
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE p.user_id IS NULL;

  IF orphan_count > 0 THEN
    RAISE WARNING 'Still have % users without profiles!', orphan_count;
  ELSE
    RAISE NOTICE 'SUCCESS: All users now have profiles';
  END IF;
END $$;
