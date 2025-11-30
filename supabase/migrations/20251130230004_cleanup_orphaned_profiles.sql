-- ============================================================================
-- CLEANUP: Remove orphaned profiles (profiles without auth.users)
-- ============================================================================

-- Disable triggers
SET session_replication_role = 'replica';

DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  -- Count orphaned profiles
  SELECT COUNT(*) INTO orphan_count
  FROM profiles p
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id);

  RAISE NOTICE 'CLEANUP: Found % orphaned profiles (no matching auth.users)', orphan_count;

  -- Delete orphaned profiles
  DELETE FROM profiles
  WHERE user_id NOT IN (SELECT id FROM auth.users);

  RAISE NOTICE 'CLEANUP: Deleted orphaned profiles';
END $$;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- Final verification
DO $$
DECLARE
  auth_count INTEGER;
  profile_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO auth_count FROM auth.users;
  SELECT COUNT(*) INTO profile_count FROM profiles;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'FINAL CLEANUP COMPLETE';
  RAISE NOTICE 'auth.users: %', auth_count;
  RAISE NOTICE 'profiles: %', profile_count;
  RAISE NOTICE '========================================';

  IF auth_count != profile_count THEN
    RAISE WARNING 'Mismatch between auth.users and profiles counts!';
  ELSE
    RAISE NOTICE 'Database is clean - 1:1 auth.users to profiles';
  END IF;
END $$;
