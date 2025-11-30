-- ============================================================================
-- Add UNIQUE constraint on profiles.user_id for upsert operations
-- ============================================================================
-- Problem: Upsert with onConflict: 'user_id' fails with 400 error because
-- there's no UNIQUE constraint on user_id column.
--
-- This is required for:
-- - sms-verify-code registration flow
-- - Profile updates during registration
-- - Any upsert operation targeting user_id
-- ============================================================================

-- First, check for and remove any duplicate user_ids (keep most recent)
-- This is a safety measure in case there are existing duplicates
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  -- Count duplicates
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT user_id, COUNT(*) as cnt
    FROM profiles
    WHERE user_id IS NOT NULL
    GROUP BY user_id
    HAVING COUNT(*) > 1
  ) dups;

  IF dup_count > 0 THEN
    RAISE NOTICE 'Found % user_ids with duplicates, keeping most recent profiles', dup_count;

    -- Delete older duplicates, keeping the one with the most recent updated_at
    DELETE FROM profiles p1
    WHERE EXISTS (
      SELECT 1 FROM profiles p2
      WHERE p2.user_id = p1.user_id
        AND p2.user_id IS NOT NULL
        AND (p2.updated_at > p1.updated_at
             OR (p2.updated_at = p1.updated_at AND p2.id > p1.id))
    );
  END IF;
END $$;

-- Now add the unique constraint
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_user_id_unique;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);

-- Also create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id
  ON profiles(user_id)
  WHERE user_id IS NOT NULL;

COMMENT ON CONSTRAINT profiles_user_id_unique ON profiles IS
'Ensures one profile per auth user. Required for upsert operations during registration.';
