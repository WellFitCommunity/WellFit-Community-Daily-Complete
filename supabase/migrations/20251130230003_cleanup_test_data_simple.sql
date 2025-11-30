-- ============================================================================
-- DATABASE CLEANUP: Remove test data, keep only Akima and Maria
-- ============================================================================
-- SIMPLE APPROACH: Delete from auth.users with CASCADE
-- FK constraints will handle cascading deletes to related tables
-- ============================================================================

-- User IDs to KEEP
-- Akima Taylor: 06ce7189-1da3-4e22-a6b2-ede88aa1445a
-- Maria LeBlanc: ba4f20ad-2707-467b-a87f-d46fe9255d2f

-- Disable triggers that might interfere with bulk delete
SET session_replication_role = 'replica';

DO $$
DECLARE
  deleted_count INTEGER;
  kept_count INTEGER;
BEGIN
  -- Count before
  SELECT COUNT(*) INTO kept_count FROM auth.users
  WHERE id IN (
    '06ce7189-1da3-4e22-a6b2-ede88aa1445a',
    'ba4f20ad-2707-467b-a87f-d46fe9255d2f'
  );

  RAISE NOTICE 'CLEANUP: Keeping % users (Akima and Maria)', kept_count;

  -- Delete all auth.users EXCEPT Akima and Maria
  -- CASCADE will delete from profiles and any FK-linked tables
  DELETE FROM auth.users
  WHERE id NOT IN (
    '06ce7189-1da3-4e22-a6b2-ede88aa1445a',
    'ba4f20ad-2707-467b-a87f-d46fe9255d2f'
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'CLEANUP: Deleted % auth.users (and cascaded data)', deleted_count;

  -- Verify profiles
  SELECT COUNT(*) INTO kept_count FROM profiles;
  RAISE NOTICE 'CLEANUP: Remaining profiles: %', kept_count;
END $$;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- Clear any orphaned data in tables without FK to auth.users
DELETE FROM super_admin_users WHERE user_id NOT IN (
  '06ce7189-1da3-4e22-a6b2-ede88aa1445a',
  'ba4f20ad-2707-467b-a87f-d46fe9255d2f'
);

DELETE FROM staff_pins WHERE user_id NOT IN (
  '06ce7189-1da3-4e22-a6b2-ede88aa1445a',
  'ba4f20ad-2707-467b-a87f-d46fe9255d2f'
);

-- Final summary
DO $$
DECLARE
  auth_count INTEGER;
  profile_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO auth_count FROM auth.users;
  SELECT COUNT(*) INTO profile_count FROM profiles;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'CLEANUP COMPLETE';
  RAISE NOTICE 'auth.users remaining: %', auth_count;
  RAISE NOTICE 'profiles remaining: %', profile_count;
  RAISE NOTICE '========================================';
END $$;
