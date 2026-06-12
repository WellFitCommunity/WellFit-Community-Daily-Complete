-- Restore FK: community_moments.user_id -> profiles(user_id)
--
-- Why: PostgREST embeds (profile:profiles(first_name,last_name)) in CommunityMoments
-- require a foreign key from community_moments.user_id to the profiles table. Without it,
-- the gallery query returns HTTP 400 ("could not find a relationship ... in the schema cache").
--
-- Drift history: migrations 20251222000002_fix_feature_engagement_and_community_moments.sql
-- and 20260130000001_fix_audit_and_schema_errors.sql both attempted to add this exact
-- constraint, but wrapped the ALTER in `EXCEPTION WHEN others THEN RAISE NOTICE` blocks.
-- Orphaned rows existed at that time, the ADD CONSTRAINT threw, the error was swallowed,
-- and the FK never landed. Live verification on 2026-06-12: 0 orphaned rows,
-- profiles.user_id is unique -> the constraint now adds cleanly.
--
-- This migration intentionally does NOT swallow exceptions: if it fails, we want to know.
-- The IF NOT EXISTS guard keeps it idempotent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'community_moments_user_id_fkey'
      AND table_name = 'community_moments'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.community_moments
      ADD CONSTRAINT community_moments_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
  END IF;
END $$;

-- Force PostgREST to reload its schema cache so the new relationship is embeddable immediately.
NOTIFY pgrst, 'reload schema';
