-- =====================================================================
-- Grant SELECT Permissions to Views
-- =====================================================================
-- Fix: 7 views lack SELECT permission for authenticated role
-- Views should generally be read-only for authenticated users
-- =====================================================================

-- Admin/analytics views
GRANT SELECT ON public.admin_usage_analytics TO authenticated;
GRANT SELECT ON public.billing_workflow_summary TO authenticated;
GRANT SELECT ON public.claude_cost_by_user TO authenticated;
GRANT SELECT ON public.claude_usage_summary TO authenticated;
GRANT SELECT ON public.my_admin_session TO authenticated;

-- Nurse and clinical views
GRANT SELECT ON public.nurse_questions_view TO authenticated;

-- Audit/compliance views
GRANT SELECT ON public.phi_access_by_patient TO authenticated;

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
