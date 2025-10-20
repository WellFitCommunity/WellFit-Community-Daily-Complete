-- =====================================================================
-- Grant Permissions to Provider Support Circle Tables
-- =====================================================================

-- The issue: The authenticated role doesn't have basic SELECT, INSERT, UPDATE
-- permissions on the provider support circle tables

-- Grant permissions for provider_support_circles
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.provider_support_circles TO authenticated;

-- Grant permissions for provider_support_circle_members
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.provider_support_circle_members TO authenticated;

-- =====================================================================
-- Migration Complete
-- =====================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Granted table permissions for provider support circles';
  RAISE NOTICE '   - authenticated role can now SELECT, INSERT, UPDATE, DELETE';
  RAISE NOTICE '   - RLS policies will properly restrict access';
END $$;
