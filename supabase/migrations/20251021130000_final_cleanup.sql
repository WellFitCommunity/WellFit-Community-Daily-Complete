-- Final Cleanup - Fix ALL Remaining Issues
-- Fixes: 9 trigger/update functions + 11 tables with RLS but no policies
-- Generated: 2025-10-21

-- ============================================================================
-- PART 1: Fix remaining 9 functions without search_path
-- ============================================================================

CREATE OR REPLACE FUNCTION public.tg_questionnaire_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_care_plan_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_fhir_immunizations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_fhir_med_request_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_fhir_observations_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_fhir_procedure_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_handoff_packets_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_practitioner_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_telehealth_session_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- PART 2: Add policies to tables with RLS but no policies
-- ============================================================================

-- Backup tables - admin only (already have DROP POLICY from earlier, now CREATE)
CREATE POLICY IF NOT EXISTS "policy_backup_admin_access" ON public._policy_backup
  FOR ALL TO authenticated USING (is_admin());

CREATE POLICY IF NOT EXISTS "policy_merge_backup_admin_access" ON public._policy_merge_backup
  FOR ALL TO authenticated USING (is_admin());

CREATE POLICY IF NOT EXISTS "policy_merge_backup_all_admin_access" ON public._policy_merge_backup_all
  FOR ALL TO authenticated USING (is_admin());

CREATE POLICY IF NOT EXISTS "policy_merge_backup_final_admin_access" ON public._policy_merge_backup_final
  FOR ALL TO authenticated USING (is_admin());

CREATE POLICY IF NOT EXISTS "policy_merge_backup_select_admin_access" ON public._policy_merge_backup_select
  FOR ALL TO authenticated USING (is_admin());

CREATE POLICY IF NOT EXISTS "policy_merge_backup_select_all_admin_access" ON public._policy_merge_backup_select_all
  FOR ALL TO authenticated USING (is_admin());

CREATE POLICY IF NOT EXISTS "policy_role_tweak_backup_admin_access" ON public._policy_role_tweak_backup
  FOR ALL TO authenticated USING (is_admin());

-- Data retention policies - admin only
CREATE POLICY IF NOT EXISTS "data_retention_policies_admin" ON public.data_retention_policies
  FOR ALL TO authenticated USING (is_admin());

-- Staff audit log - admin can see all, staff can see their own
CREATE POLICY IF NOT EXISTS "staff_audit_log_admin_all" ON public.staff_audit_log
  FOR ALL TO authenticated USING (is_admin());

CREATE POLICY IF NOT EXISTS "staff_audit_log_own" ON public.staff_audit_log
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Staff auth attempts - admin can see all, users can see their own
CREATE POLICY IF NOT EXISTS "staff_auth_attempts_admin_all" ON public.staff_auth_attempts
  FOR ALL TO authenticated USING (is_admin());

CREATE POLICY IF NOT EXISTS "staff_auth_attempts_own" ON public.staff_auth_attempts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Tenants - everyone can view, admins can modify
CREATE POLICY IF NOT EXISTS "tenants_view_all" ON public.tenants
  FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "tenants_admin_modify" ON public.tenants
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY IF NOT EXISTS "tenants_admin_update" ON public.tenants
  FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY IF NOT EXISTS "tenants_admin_delete" ON public.tenants
  FOR DELETE TO authenticated USING (is_admin());

-- ============================================================================
-- PART 3: Log this migration
-- ============================================================================

INSERT INTO public.rls_policy_audit (table_name, policy_name, action, details)
VALUES (
  'migration',
  '20251021130000_final_cleanup',
  'executed',
  jsonb_build_object(
    'description', 'Final cleanup - fix remaining functions and RLS policies',
    'functions_fixed', 9,
    'policies_added', 15,
    'tables_secured', 11
  )
);

-- ============================================================================
-- VERIFICATION: Show final counts
-- ============================================================================

DO $$
DECLARE
  unsafe_funcs INTEGER;
  tables_no_policy INTEGER;
BEGIN
  -- Count remaining unsafe functions
  SELECT count(*) INTO unsafe_funcs
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  AND (p.prosecdef = true OR p.proname LIKE 'update_%' OR p.proname LIKE '%_updated%')
  AND pg_get_functiondef(p.oid) NOT LIKE '%search_path%';

  -- Count tables with RLS but no policies
  SELECT count(*) INTO tables_no_policy
  FROM pg_tables t
  WHERE schemaname = 'public'
  AND rowsecurity = true
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public'
    AND p.tablename = t.tablename
  );

  RAISE NOTICE '=== FINAL VERIFICATION ===';
  RAISE NOTICE 'Functions without search_path: %', unsafe_funcs;
  RAISE NOTICE 'Tables with RLS but no policies: %', tables_no_policy;
  RAISE NOTICE '========================';
END $$;
