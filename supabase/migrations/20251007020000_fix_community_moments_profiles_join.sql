-- ==============================================================================
-- Fix Community Moments → Profiles Relationship
-- Date: 2025-10-07
--
-- Issue: "Could not find a relationship between 'community_moments' and 'profiles'"
--
-- Root Cause:
-- The community_moments table has user_id -> auth.users(id) foreign key,
-- but the code is trying to join with profiles table using:
-- .select('..., profile:profiles(first_name, last_name)')
--
-- Supabase PostgREST cannot automatically find the relationship because:
-- 1. community_moments.user_id → auth.users.id (direct FK)
-- 2. profiles.user_id → auth.users.id (direct FK)
-- 3. There's NO direct FK between community_moments and profiles
--
-- Solution:
-- Add a direct foreign key from community_moments.user_id to profiles.user_id
-- This allows PostgREST to understand the relationship and enable the join.
-- ==============================================================================

BEGIN;

-- Drop the existing foreign key to auth.users
ALTER TABLE public.community_moments
DROP CONSTRAINT IF EXISTS community_moments_user_id_fkey;

-- Add foreign key to profiles instead
-- This creates a direct relationship that PostgREST can use for joins
ALTER TABLE public.community_moments
ADD CONSTRAINT community_moments_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.profiles(user_id)
ON DELETE CASCADE;

-- Add index for better join performance
CREATE INDEX IF NOT EXISTS idx_community_moments_user_id
ON public.community_moments(user_id);

-- Add helpful comment
COMMENT ON CONSTRAINT community_moments_user_id_fkey ON public.community_moments
IS 'FK to profiles.user_id - enables PostgREST join for profile:profiles(...) syntax';

-- Verify the constraint exists
DO $$
BEGIN
  RAISE NOTICE '✅ Foreign key community_moments.user_id → profiles.user_id created';
  RAISE NOTICE '   This enables: SELECT ..., profile:profiles(first_name, last_name) FROM community_moments';
END $$;

COMMIT;

-- ==============================================================================
-- TESTING
-- ==============================================================================
-- After running this migration, this query should work:
--
-- SELECT
--   id,
--   user_id,
--   title,
--   profile:profiles(first_name, last_name)
-- FROM community_moments
-- LIMIT 1;
--
-- If you still get the error, check:
-- 1. Schema cache refresh: Sometimes PostgREST needs a restart
-- 2. Run: SELECT * FROM pg_constraint WHERE conname = 'community_moments_user_id_fkey';
-- ==============================================================================
