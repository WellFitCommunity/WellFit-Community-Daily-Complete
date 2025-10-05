-- Fix permissions for patient_engagement_scores view
-- Allow authenticated users and admins to access the engagement scoring view

BEGIN;

-- Grant SELECT on the view to authenticated users (they can only see their own data via RLS on underlying tables)
GRANT SELECT ON public.patient_engagement_scores TO authenticated;

-- Grant SELECT on the view to anon (they won't see data due to RLS on underlying tables)
GRANT SELECT ON public.patient_engagement_scores TO anon;

-- Grant SELECT on the view to service_role for admin operations
GRANT SELECT ON public.patient_engagement_scores TO service_role;

COMMIT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Fixed patient_engagement_scores view permissions';
  RAISE NOTICE '   - Granted SELECT to authenticated, anon, and service_role';
END $$;
