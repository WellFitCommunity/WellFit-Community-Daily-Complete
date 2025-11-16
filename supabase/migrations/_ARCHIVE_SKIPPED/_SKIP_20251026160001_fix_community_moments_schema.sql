-- ============================================================================
-- FIX COMMUNITY MOMENTS TABLE SCHEMA
-- ============================================================================
-- Purpose: Restore the correct schema for community_moments table that was
--          accidentally replaced with wrong schema in 20251026000000_schema_reconciliation.sql
-- Date: 2025-10-26
-- Priority: CRITICAL (User-Facing Bug Fix)
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Drop the incorrect table created by schema reconciliation
-- ============================================================================
DROP TABLE IF EXISTS public.community_moments CASCADE;

-- ============================================================================
-- STEP 2: Recreate with the CORRECT schema (from 20251001000000)
-- ============================================================================
CREATE TABLE public.community_moments (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url TEXT,
  file_path TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  emoji TEXT DEFAULT '😊',
  tags TEXT,
  is_gallery_high BOOLEAN NOT NULL DEFAULT false,
  approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STEP 3: Create indexes for performance
-- ============================================================================
CREATE INDEX idx_community_moments_user_id ON public.community_moments (user_id);
CREATE INDEX idx_community_moments_created_at ON public.community_moments (created_at DESC);
CREATE INDEX idx_community_moments_is_gallery_high ON public.community_moments (is_gallery_high) WHERE is_gallery_high = true;
CREATE INDEX idx_community_moments_approval_status ON public.community_moments (approval_status, created_at DESC);

-- ============================================================================
-- STEP 4: Enable RLS and create policies
-- ============================================================================
ALTER TABLE public.community_moments ENABLE ROW LEVEL SECURITY;

-- Policy: Regular users can only see approved moments, or their own, or admins see all
DROP POLICY IF EXISTS "community_moments_select_approved" ON public.community_moments;
CREATE POLICY "community_moments_select_approved"
  ON public.community_moments
  FOR SELECT
  TO public
  USING (
    approval_status = 'approved'
    OR auth.uid() = user_id -- Users can see their own pending/rejected moments
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );

-- Policy: Users can insert their own moments (starts as pending)
DROP POLICY IF EXISTS "community_moments_insert_own" ON public.community_moments;
CREATE POLICY "community_moments_insert_own"
  ON public.community_moments
  FOR INSERT
  TO public
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own moments
DROP POLICY IF EXISTS "community_moments_update_own" ON public.community_moments;
CREATE POLICY "community_moments_update_own"
  ON public.community_moments
  FOR UPDATE
  TO public
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own moments, admins can delete any
DROP POLICY IF EXISTS "community_moments_delete_own" ON public.community_moments;
CREATE POLICY "community_moments_delete_own"
  ON public.community_moments
  FOR DELETE
  TO public
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );

-- Policy: Admins can do everything
DROP POLICY IF EXISTS "community_moments_admin_all" ON public.community_moments;
CREATE POLICY "community_moments_admin_all"
  ON public.community_moments
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- STEP 5: Create updated_at trigger
-- ============================================================================
-- Reuse existing function or create if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_community_moments_updated_at ON public.community_moments;
CREATE TRIGGER update_community_moments_updated_at
  BEFORE UPDATE ON public.community_moments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.community_moments TO authenticated;
GRANT USAGE ON SEQUENCE public.community_moments_id_seq TO authenticated;

-- ============================================================================
-- STEP 7: Create RPC function for pending photo count (used by UI)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_pending_photo_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only admins should be able to call this
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'super_admin')
  ) THEN
    RETURN 0;
  END IF;

  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM public.community_moments
    WHERE approval_status = 'pending'
  );
END;
$$;

-- ============================================================================
-- STEP 8: Ensure storage bucket exists
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('community-moments', 'community-moments', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 9: Create storage policies
-- ============================================================================
DROP POLICY IF EXISTS "community_moments_public_read" ON storage.objects;
CREATE POLICY "community_moments_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'community-moments');

DROP POLICY IF EXISTS "community_moments_user_upload" ON storage.objects;
CREATE POLICY "community_moments_user_upload"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (
    bucket_id = 'community-moments'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "community_moments_user_update" ON storage.objects;
CREATE POLICY "community_moments_user_update"
  ON storage.objects FOR UPDATE
  TO public
  USING (
    bucket_id = 'community-moments'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "community_moments_user_delete" ON storage.objects;
CREATE POLICY "community_moments_user_delete"
  ON storage.objects FOR DELETE
  TO public
  USING (
    bucket_id = 'community-moments'
    AND auth.role() = 'authenticated'
  );

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary:
-- ✓ Dropped incorrect community_moments table schema
-- ✓ Recreated with correct schema (title, description, file_url, file_path, approval_status)
-- ✓ Added all necessary indexes
-- ✓ Configured proper RLS policies
-- ✓ Created updated_at trigger
-- ✓ Created get_pending_photo_count() RPC function
-- ✓ Configured storage bucket and policies
-- ============================================================================
