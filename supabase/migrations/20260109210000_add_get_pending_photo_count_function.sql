-- Add get_pending_photo_count RPC function
-- This function was missing from active migrations but is used by CommunityMoments page
-- Date: 2026-01-09

BEGIN;

-- Create RPC function for pending photo count (used by admin UI)
CREATE OR REPLACE FUNCTION public.get_pending_photo_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_pending_photo_count() TO authenticated;

COMMENT ON FUNCTION public.get_pending_photo_count() IS
  'Returns count of pending community photo submissions for admin review. Returns 0 for non-admins.';

COMMIT;
