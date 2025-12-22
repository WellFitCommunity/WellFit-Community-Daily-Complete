-- =====================================================
-- Fix feature_engagement RLS and community_moments query issues
-- Date: 2025-12-22
-- =====================================================

-- ============================================
-- 1. FIX feature_engagement RLS (403 error)
-- ============================================
-- Drop existing policies and recreate with proper permissions
DROP POLICY IF EXISTS "Users can view own feature engagement" ON public.feature_engagement;
DROP POLICY IF EXISTS "Users can insert own feature engagement" ON public.feature_engagement;
DROP POLICY IF EXISTS "Users can update own feature engagement" ON public.feature_engagement;
DROP POLICY IF EXISTS "feature_engagement_tenant" ON public.feature_engagement;

-- Allow users to manage their own feature engagement
CREATE POLICY "feature_engagement_select" ON public.feature_engagement
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "feature_engagement_insert" ON public.feature_engagement
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "feature_engagement_update" ON public.feature_engagement
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- 2. ENSURE community_moments has correct foreign key for profile join
-- ============================================
-- The query uses profile:profiles(first_name, last_name) which requires
-- a foreign key relationship from community_moments.user_id to profiles.user_id

-- First check if we need to add the foreign key (might already exist)
DO $$
BEGIN
  -- Add foreign key to auth.users if not exists (for standard Supabase join)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'community_moments_user_id_fkey'
    AND table_name = 'community_moments'
  ) THEN
    BEGIN
      ALTER TABLE public.community_moments
      ADD CONSTRAINT community_moments_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN
      -- Constraint already exists, ignore
      NULL;
    END;
  END IF;
END $$;

-- ============================================
-- 3. FIX community_moments RLS for proper access
-- ============================================
DROP POLICY IF EXISTS "community_moments_select" ON public.community_moments;
DROP POLICY IF EXISTS "community_moments_select_all" ON public.community_moments;
DROP POLICY IF EXISTS "community_moments_select_approved" ON public.community_moments;
DROP POLICY IF EXISTS "community_moments_tenant" ON public.community_moments;

-- Users can view approved moments or their own moments
CREATE POLICY "community_moments_select" ON public.community_moments
  FOR SELECT TO authenticated
  USING (
    approval_status = 'approved'
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND (p.is_admin = true OR p.role IN ('admin', 'super_admin'))
    )
  );

-- ============================================
-- 4. ENSURE approval_status column exists with default
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'community_moments'
    AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE public.community_moments
    ADD COLUMN approval_status TEXT DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- ============================================
-- 5. GRANT permissions
-- ============================================
GRANT SELECT, INSERT, UPDATE ON public.feature_engagement TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_moments TO authenticated;
