-- =====================================================================
-- Grant Permissions to shift_handoff_risk_scores
-- =====================================================================

-- The issue: The authenticated role doesn't have basic SELECT permission
-- on the shift_handoff_risk_scores table, even though RLS policies exist

-- Grant SELECT permission to authenticated users
GRANT SELECT ON TABLE public.shift_handoff_risk_scores TO authenticated;

-- Grant INSERT and UPDATE permissions as well for nurses/admins
GRANT INSERT, UPDATE ON TABLE public.shift_handoff_risk_scores TO authenticated;

-- =====================================================================
-- Migration Complete
-- =====================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Granted table permissions for shift_handoff_risk_scores';
  RAISE NOTICE '   - authenticated role can now SELECT, INSERT, UPDATE';
  RAISE NOTICE '   - RLS policies will properly restrict access based on role';
END $$;
