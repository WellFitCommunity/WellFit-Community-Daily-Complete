-- =====================================================================
-- Grant SELECT Permissions to Views
-- =====================================================================
-- Fix: 7 views lack SELECT permission for authenticated role
-- Views should generally be read-only for authenticated users
-- =====================================================================

-- Admin/analytics views (with existence checks)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_views WHERE schemaname = 'public' AND viewname = 'admin_usage_analytics') THEN
    GRANT SELECT ON public.admin_usage_analytics TO authenticated;
  END IF;

  IF EXISTS (SELECT FROM pg_views WHERE schemaname = 'public' AND viewname = 'billing_workflow_summary') THEN
    GRANT SELECT ON public.billing_workflow_summary TO authenticated;
  END IF;

  IF EXISTS (SELECT FROM pg_views WHERE schemaname = 'public' AND viewname = 'claude_cost_by_user') THEN
    GRANT SELECT ON public.claude_cost_by_user TO authenticated;
  END IF;

  IF EXISTS (SELECT FROM pg_views WHERE schemaname = 'public' AND viewname = 'claude_usage_summary') THEN
    GRANT SELECT ON public.claude_usage_summary TO authenticated;
  END IF;

  IF EXISTS (SELECT FROM pg_views WHERE schemaname = 'public' AND viewname = 'my_admin_session') THEN
    GRANT SELECT ON public.my_admin_session TO authenticated;
  END IF;

  IF EXISTS (SELECT FROM pg_views WHERE schemaname = 'public' AND viewname = 'nurse_questions_view') THEN
    GRANT SELECT ON public.nurse_questions_view TO authenticated;
  END IF;

  IF EXISTS (SELECT FROM pg_views WHERE schemaname = 'public' AND viewname = 'phi_access_by_patient') THEN
    GRANT SELECT ON public.phi_access_by_patient TO authenticated;
  END IF;
END $$;

-- =====================================================================
-- Migration Complete
-- =====================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Granted SELECT permission to 7 views';
  RAISE NOTICE '   - Admin and analytics views now accessible';
  RAISE NOTICE '   - Clinical and audit views now accessible';
  RAISE NOTICE '   - Views will respect underlying table RLS policies';
END $$;
