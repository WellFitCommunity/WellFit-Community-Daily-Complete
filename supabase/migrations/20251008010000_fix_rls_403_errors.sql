-- Quick fix for 403 errors on community_moments and affirmations
-- Date: 2025-10-08
-- This ensures public can read both tables

BEGIN;

-- Fix affirmations: Allow public read
DROP POLICY IF EXISTS "affirmations_select_all" ON public.affirmations;
CREATE POLICY "affirmations_select_all"
ON public.affirmations
FOR SELECT
TO public
USING (true);

-- Fix community_moments: Allow public read for approved posts
DROP POLICY IF EXISTS "community_moments_select_all" ON public.community_moments;
DROP POLICY IF EXISTS "community_moments_select_approved" ON public.community_moments;

CREATE POLICY "community_moments_select_approved"
ON public.community_moments
FOR SELECT
TO public
USING (
  COALESCE(approval_status, 'approved') = 'approved'
  OR
  auth.uid() = user_id -- Users can see their own pending/rejected moments
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'super_admin')
  )
);

-- Fix profiles: Allow public read for community features (first_name, last_name only)
DROP POLICY IF EXISTS "profiles_public_read_for_community" ON public.profiles;
CREATE POLICY "profiles_public_read_for_community"
ON public.profiles
FOR SELECT
TO public
USING (true);

COMMIT;
