-- Migration: add the missing table GRANTs for the RPM report pipeline (§2a RLS ≠ GRANT)
--
-- The 20260704180000_rpm_report_pipeline.sql migration enabled RLS + policies on
-- rpm_reports and rpm_report_settings but never GRANTed table privileges to the
-- `authenticated` role. Supabase does NOT auto-grant, so PostgREST returns
-- 403 "permission denied for table" on every client read path — specifically
-- rpmReportService.listPatientReports (`.from('rpm_reports').select(...)`).
-- Verified live: has_table_privilege('authenticated','public.rpm_reports','SELECT') = false.
--
-- This is the recurring RLS-without-GRANT footgun (see .claude/rules/supabase.md §2a
-- and memory reference_rls_policy_without_grant). The pipeline was built 2026-07-04,
-- one day before that lesson was baselined, which is why the grants were omitted.
--
-- Scope note: rpm_reports rows are INSERTed only by the rpm-weekly-report edge
-- function under the service role (which bypasses RLS + grants), so `authenticated`
-- needs SELECT only. Review stamping goes through the log_rpm_report_review
-- SECURITY DEFINER RPC (already granted EXECUTE), so no UPDATE grant is needed either.

-- rpm_reports: client review-UI read path only. RLS (rpm_reports_tenant_read)
-- already restricts visible rows to tenant admins of the report's tenant.
GRANT SELECT ON public.rpm_reports TO authenticated;

-- rpm_report_settings: managed by tenant admins via the settings UI. Its RLS policy
-- (rpm_settings_tenant_admin_all, FOR ALL) already gates every verb to
-- `tenant_id = get_current_tenant_id() AND is_tenant_admin()`, so the grant is the
-- only missing gate. Granting the full CRUD set the policy anticipates.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rpm_report_settings TO authenticated;
