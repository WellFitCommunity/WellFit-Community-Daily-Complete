-- Add photo approval system for community moments
-- Date: 2025-10-07
-- Purpose: Allow admins to review and approve photos before they appear publicly

BEGIN;

-- Add approval status columns to community_moments
ALTER TABLE public.community_moments
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Create index for querying pending approvals
CREATE INDEX IF NOT EXISTS idx_community_moments_approval_status
ON public.community_moments(approval_status, created_at DESC);

-- Update existing community moments to approved (grandfather clause)
UPDATE public.community_moments
SET approval_status = 'approved'
WHERE approval_status = 'pending';

-- ============================================================================
-- UPDATE RLS POLICIES: Only show approved moments to regular users
-- ============================================================================

-- Drop old policy
DROP POLICY IF EXISTS "community_moments_select_all" ON public.community_moments;

-- New policy: Regular users can only see approved moments
CREATE POLICY "community_moments_select_approved"
ON public.community_moments
FOR SELECT
TO public
USING (
  approval_status = 'approved'
  OR
  auth.uid() = user_id -- Users can see their own pending/rejected moments
  OR
  EXISTS (
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
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Only admins can update approval status
DROP POLICY IF EXISTS "community_moments_update_approval" ON public.community_moments;
CREATE POLICY "community_moments_update_approval"
ON public.community_moments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'super_admin')
  )
);

-- Policy: Users can delete their own moments, admins can delete any
DROP POLICY IF EXISTS "community_moments_delete" ON public.community_moments;
CREATE POLICY "community_moments_delete"
ON public.community_moments
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'super_admin')
  )
);

COMMIT;
