-- =====================================================
-- Fix Community Moments and User Questions Insert Issues
-- Date: 2026-01-30
-- Purpose: Fix FK conflicts, ensure proper RLS, and fix storage
-- =====================================================

BEGIN;

-- ============================================
-- 1. FIX community_moments FK (remove conflicting FK to profiles)
-- ============================================
-- The original table has user_id -> auth.users(id)
-- A conflicting FK to profiles(user_id) was attempted but may cause issues
-- We'll drop the profiles FK if it exists and keep auth.users FK

DO $$
BEGIN
  -- First, check if there's a FK to profiles and drop it
  -- The FK to auth.users should be the primary relationship
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'community_moments'
    AND ccu.table_name = 'profiles'
  ) THEN
    -- Find and drop FK constraints to profiles
    EXECUTE (
      SELECT 'ALTER TABLE community_moments DROP CONSTRAINT IF EXISTS ' || constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'community_moments'
      AND ccu.table_name = 'profiles'
      LIMIT 1
    );
    RAISE NOTICE 'Dropped FK constraint from community_moments to profiles';
  END IF;
END $$;

-- ============================================
-- 2. ENSURE community_moments has FK to auth.users
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'community_moments'
    AND tc.constraint_schema = 'public'
    AND ccu.table_name = 'users'
    AND ccu.table_schema = 'auth'
  ) THEN
    ALTER TABLE public.community_moments
    ADD CONSTRAINT community_moments_user_id_auth_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK from community_moments.user_id to auth.users(id)';
  END IF;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'FK to auth.users already exists';
END $$;

-- ============================================
-- 3. FIX community_moments RLS policies
-- ============================================
-- Drop all existing policies and recreate with correct permissions
DROP POLICY IF EXISTS "community_moments_select" ON public.community_moments;
DROP POLICY IF EXISTS "community_moments_select_all" ON public.community_moments;
DROP POLICY IF EXISTS "community_moments_select_approved" ON public.community_moments;
DROP POLICY IF EXISTS "community_moments_insert" ON public.community_moments;
DROP POLICY IF EXISTS "community_moments_insert_own" ON public.community_moments;
DROP POLICY IF EXISTS "community_moments_update" ON public.community_moments;
DROP POLICY IF EXISTS "community_moments_update_own" ON public.community_moments;
DROP POLICY IF EXISTS "community_moments_delete" ON public.community_moments;
DROP POLICY IF EXISTS "community_moments_delete_own" ON public.community_moments;
DROP POLICY IF EXISTS "community_moments_admin_all" ON public.community_moments;
DROP POLICY IF EXISTS "community_moments_tenant" ON public.community_moments;

-- SELECT: Anyone can view approved moments, users can see their own
CREATE POLICY "community_moments_select"
ON public.community_moments
FOR SELECT
USING (
  approval_status = 'approved'
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
  )
);

-- INSERT: Authenticated users can insert their own moments
CREATE POLICY "community_moments_insert"
ON public.community_moments
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- UPDATE: Users can update their own, admins can update all
CREATE POLICY "community_moments_update"
ON public.community_moments
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
  )
);

-- DELETE: Users can delete their own, admins can delete all
CREATE POLICY "community_moments_delete"
ON public.community_moments
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
  )
);

-- ============================================
-- 4. FIX user_questions RLS policies
-- ============================================
DROP POLICY IF EXISTS "users_can_insert_own_questions" ON public.user_questions;
DROP POLICY IF EXISTS "users_can_view_own_questions" ON public.user_questions;
DROP POLICY IF EXISTS "admins_can_view_all_questions" ON public.user_questions;
DROP POLICY IF EXISTS "admins_can_update_questions" ON public.user_questions;
DROP POLICY IF EXISTS "user_questions_insert" ON public.user_questions;
DROP POLICY IF EXISTS "user_questions_select" ON public.user_questions;
DROP POLICY IF EXISTS "user_questions_update" ON public.user_questions;

-- INSERT: Users can insert their own questions
CREATE POLICY "user_questions_insert"
ON public.user_questions
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- SELECT: Users see their own, admins/nurses see all
CREATE POLICY "user_questions_select"
ON public.user_questions
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin', 'nurse', 'provider')
  )
);

-- UPDATE: Admins and nurses can update all questions
CREATE POLICY "user_questions_update"
ON public.user_questions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin', 'nurse', 'provider')
  )
);

-- ============================================
-- 5. FIX storage policies for community-moments bucket
-- ============================================
-- Ensure bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'community-moments',
  'community-moments',
  true,  -- Make bucket public for reading
  20971520,  -- 20MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- Drop existing storage policies and recreate
DROP POLICY IF EXISTS "community_moments_public_read" ON storage.objects;
DROP POLICY IF EXISTS "community_moments_user_upload" ON storage.objects;
DROP POLICY IF EXISTS "community_moments_user_update" ON storage.objects;
DROP POLICY IF EXISTS "community_moments_user_delete" ON storage.objects;
DROP POLICY IF EXISTS "community_moments_read" ON storage.objects;
DROP POLICY IF EXISTS "community_moments_write" ON storage.objects;
DROP POLICY IF EXISTS "community_moments_storage_read" ON storage.objects;
DROP POLICY IF EXISTS "community_moments_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "community_moments_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "community_moments_storage_delete" ON storage.objects;

-- Public read for community-moments bucket
CREATE POLICY "community_moments_storage_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'community-moments');

-- Authenticated users can upload to their own folder
CREATE POLICY "community_moments_storage_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'community-moments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update their own uploads
CREATE POLICY "community_moments_storage_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'community-moments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own uploads
CREATE POLICY "community_moments_storage_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'community-moments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- 6. ENSURE profiles are readable for community features
-- ============================================
DROP POLICY IF EXISTS "profiles_public_read_for_community" ON public.profiles;

CREATE POLICY "profiles_public_read_for_community"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- ============================================
-- 7. GRANT permissions
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_moments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_questions TO authenticated;

COMMIT;
