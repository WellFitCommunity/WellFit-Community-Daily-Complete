-- ============================================================================
-- IMMEDIATE FIX for Community Moments Profile Join Error
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================================
--
-- Error: "Could not find a relationship between 'community_moments' and 'profiles'"
--
-- Fix: Add direct foreign key from community_moments to profiles
-- ============================================================================

-- Drop old foreign key to auth.users
ALTER TABLE public.community_moments
DROP CONSTRAINT IF EXISTS community_moments_user_id_fkey;

-- Add new foreign key to profiles
ALTER TABLE public.community_moments
ADD CONSTRAINT community_moments_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.profiles(user_id)
ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_community_moments_user_id
ON public.community_moments(user_id);

-- Verify it worked
SELECT
  'community_moments' as table_name,
  'user_id' as column_name,
  'profiles.user_id' as references,
  'FK exists ✅' as status
WHERE EXISTS (
  SELECT 1
  FROM pg_constraint
  WHERE conname = 'community_moments_user_id_fkey'
);
