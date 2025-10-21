-- Add Final Policies to Tables with RLS but No Policies
-- Generated: 2025-10-21

-- ============================================================================
-- Add policies to 11 tables that have RLS enabled but no policies
-- ============================================================================

-- Backup tables - admin only
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = '_policy_backup' AND policyname = 'policy_backup_admin_access') THEN
    CREATE POLICY "policy_backup_admin_access" ON public._policy_backup FOR ALL TO authenticated USING (is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = '_policy_merge_backup' AND policyname = 'policy_merge_backup_admin_access') THEN
    CREATE POLICY "policy_merge_backup_admin_access" ON public._policy_merge_backup FOR ALL TO authenticated USING (is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = '_policy_merge_backup_all' AND policyname = 'policy_merge_backup_all_admin_access') THEN
    CREATE POLICY "policy_merge_backup_all_admin_access" ON public._policy_merge_backup_all FOR ALL TO authenticated USING (is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = '_policy_merge_backup_final' AND policyname = 'policy_merge_backup_final_admin_access') THEN
    CREATE POLICY "policy_merge_backup_final_admin_access" ON public._policy_merge_backup_final FOR ALL TO authenticated USING (is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = '_policy_merge_backup_select' AND policyname = 'policy_merge_backup_select_admin_access') THEN
    CREATE POLICY "policy_merge_backup_select_admin_access" ON public._policy_merge_backup_select FOR ALL TO authenticated USING (is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = '_policy_merge_backup_select_all' AND policyname = 'policy_merge_backup_select_all_admin_access') THEN
    CREATE POLICY "policy_merge_backup_select_all_admin_access" ON public._policy_merge_backup_select_all FOR ALL TO authenticated USING (is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = '_policy_role_tweak_backup' AND policyname = 'policy_role_tweak_backup_admin_access') THEN
    CREATE POLICY "policy_role_tweak_backup_admin_access" ON public._policy_role_tweak_backup FOR ALL TO authenticated USING (is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'data_retention_policies' AND policyname = 'data_retention_policies_admin') THEN
    CREATE POLICY "data_retention_policies_admin" ON public.data_retention_policies FOR ALL TO authenticated USING (is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'staff_audit_log' AND policyname = 'staff_audit_log_admin_all') THEN
    CREATE POLICY "staff_audit_log_admin_all" ON public.staff_audit_log FOR ALL TO authenticated USING (is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'staff_audit_log' AND policyname = 'staff_audit_log_own') THEN
    CREATE POLICY "staff_audit_log_own" ON public.staff_audit_log FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'staff_auth_attempts' AND policyname = 'staff_auth_attempts_admin_all') THEN
    CREATE POLICY "staff_auth_attempts_admin_all" ON public.staff_auth_attempts FOR ALL TO authenticated USING (is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'staff_auth_attempts' AND policyname = 'staff_auth_attempts_own') THEN
    CREATE POLICY "staff_auth_attempts_own" ON public.staff_auth_attempts FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tenants' AND policyname = 'tenants_view_all') THEN
    CREATE POLICY "tenants_view_all" ON public.tenants FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tenants' AND policyname = 'tenants_admin_modify') THEN
    CREATE POLICY "tenants_admin_modify" ON public.tenants FOR INSERT TO authenticated WITH CHECK (is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tenants' AND policyname = 'tenants_admin_update') THEN
    CREATE POLICY "tenants_admin_update" ON public.tenants FOR UPDATE TO authenticated USING (is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tenants' AND policyname = 'tenants_admin_delete') THEN
    CREATE POLICY "tenants_admin_delete" ON public.tenants FOR DELETE TO authenticated USING (is_admin());
  END IF;
END $$;

-- Log this migration
INSERT INTO public.rls_policy_audit (table_name, policy_name, action, details)
VALUES (
  'migration',
  '20251021130001_add_final_policies',
  'executed',
  jsonb_build_object(
    'description', 'Add policies to all tables with RLS but no policies',
    'policies_added', 16,
    'tables_secured', 11
  )
);

-- Final verification
DO $$
DECLARE
  tables_no_policy INTEGER;
BEGIN
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
  RAISE NOTICE 'Tables with RLS but no policies: %', tables_no_policy;
  IF tables_no_policy = 0 THEN
    RAISE NOTICE 'SUCCESS: All tables now have policies!';
  END IF;
  RAISE NOTICE '========================';
END $$;
