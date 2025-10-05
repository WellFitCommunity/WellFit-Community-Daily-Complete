-- Add photo approval system for community moments

BEGIN;

-- Add is_approved column (defaults to false - requires approval)
ALTER TABLE public.community_moments
ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT false;

-- Add approved_at and approved_by for audit trail
ALTER TABLE public.community_moments
ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE public.community_moments
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id);

-- Index for quick filtering of pending approvals
CREATE INDEX IF NOT EXISTS idx_community_moments_pending_approval
ON public.community_moments(is_approved, created_at DESC)
WHERE is_approved = false;

-- Update RLS policies to only show approved photos to non-admins
DROP POLICY IF EXISTS "community_moments_select_all" ON public.community_moments;

-- Regular users can only see approved moments
CREATE POLICY "community_moments_select_approved"
ON public.community_moments FOR SELECT
USING (is_approved = true);

-- Users can see their OWN moments even if not approved
CREATE POLICY "community_moments_select_own"
ON public.community_moments FOR SELECT
USING (user_id = auth.uid());

-- Admins can see ALL moments (approved and pending)
CREATE POLICY "community_moments_admin_select_all"
ON public.community_moments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
);

-- Create a view for pending approvals (admin use)
CREATE OR REPLACE VIEW public.pending_photo_approvals AS
SELECT
  cm.id,
  cm.user_id,
  cm.file_path,
  cm.title,
  cm.description,
  cm.emoji,
  cm.tags,
  cm.created_at,
  p.first_name,
  p.last_name,
  p.email
FROM public.community_moments cm
LEFT JOIN public.profiles p ON p.user_id = cm.user_id
WHERE cm.is_approved = false
ORDER BY cm.created_at DESC;

-- Grant permissions
GRANT SELECT ON public.pending_photo_approvals TO authenticated;

-- Create function to approve a photo
CREATE OR REPLACE FUNCTION public.approve_community_photo(photo_id bigint)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_admin_user boolean;
  result json;
BEGIN
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  ) INTO is_admin_user;

  IF NOT is_admin_user THEN
    RAISE EXCEPTION 'Only admins can approve photos';
  END IF;

  -- Approve the photo
  UPDATE public.community_moments
  SET
    is_approved = true,
    approved_at = now(),
    approved_by = auth.uid()
  WHERE id = photo_id
  RETURNING json_build_object(
    'id', id,
    'is_approved', is_approved,
    'approved_at', approved_at
  ) INTO result;

  RETURN result;
END;
$$;

-- Create function to get pending approval count
CREATE OR REPLACE FUNCTION public.get_pending_photo_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pending_count integer;
  is_admin_user boolean;
BEGIN
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  ) INTO is_admin_user;

  IF NOT is_admin_user THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*)::integer
  FROM public.community_moments
  WHERE is_approved = false
  INTO pending_count;

  RETURN pending_count;
END;
$$;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ Photo approval system created!';
  RAISE NOTICE '   - is_approved column added (defaults to false)';
  RAISE NOTICE '   - Audit trail: approved_at, approved_by';
  RAISE NOTICE '   - RLS updated: users see only approved photos (or their own)';
  RAISE NOTICE '   - Admins see all photos including pending';
  RAISE NOTICE '   - approve_community_photo() function created';
  RAISE NOTICE '   - get_pending_photo_count() function created';
  RAISE NOTICE '   - pending_photo_approvals view created';
END $$;
