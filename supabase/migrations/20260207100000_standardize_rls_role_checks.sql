-- ============================================================================
-- STANDARDIZE RLS ROLE CHECKS ACROSS BED/SMART/READMISSION MODULES
-- ============================================================================
-- Problem: Three different role-checking patterns exist across these modules:
--   1. Inline EXISTS against profiles.role (bed mgmt, SMART)
--   2. is_admin() function (readmissions)
--   3. user_roles table lookup (check_ins)
--
-- Additionally, bed management policies use profiles.id = auth.uid() which
-- may not match the actual user_id column (profiles.user_id is the FK to auth.users).
--
-- Solution: Standardize all write policies to use current_user_has_any_role()
-- which already exists and correctly joins profiles.user_id -> roles.name.
-- This gives us ONE function to maintain if the role model ever changes.
--
-- NOTE: Read policies (tenant_read) are left as-is since they only check tenant_id.
-- NOTE: service_role and direct user_id policies (patient self-service) are left as-is.
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: BED MANAGEMENT WRITE POLICIES
-- Replace inline profiles.id EXISTS checks with current_user_has_any_role()
-- Also fixes profiles.id vs profiles.user_id inconsistency
-- ============================================================================

-- 1a. beds_staff_write
DROP POLICY IF EXISTS "beds_staff_write" ON public.beds;
CREATE POLICY "beds_staff_write" ON public.beds
  FOR ALL
  TO authenticated
  USING (
    tenant_id = public.get_current_tenant_id()
    AND public.current_user_has_any_role(ARRAY['admin', 'super_admin', 'nurse', 'care_manager', 'bed_control'])
  )
  WITH CHECK (
    tenant_id = public.get_current_tenant_id()
    AND public.current_user_has_any_role(ARRAY['admin', 'super_admin', 'nurse', 'care_manager', 'bed_control'])
  );

-- 1b. bed_assignments_staff_write
DROP POLICY IF EXISTS "bed_assignments_staff_write" ON public.bed_assignments;
CREATE POLICY "bed_assignments_staff_write" ON public.bed_assignments
  FOR ALL
  TO authenticated
  USING (
    tenant_id = public.get_current_tenant_id()
    AND public.current_user_has_any_role(ARRAY['admin', 'super_admin', 'nurse', 'care_manager', 'bed_control'])
  )
  WITH CHECK (
    tenant_id = public.get_current_tenant_id()
    AND public.current_user_has_any_role(ARRAY['admin', 'super_admin', 'nurse', 'care_manager', 'bed_control'])
  );

-- 1c. scheduled_arrivals_staff_write
DROP POLICY IF EXISTS "scheduled_arrivals_staff_write" ON public.scheduled_arrivals;
CREATE POLICY "scheduled_arrivals_staff_write" ON public.scheduled_arrivals
  FOR ALL
  TO authenticated
  USING (
    tenant_id = public.get_current_tenant_id()
    AND public.current_user_has_any_role(ARRAY['admin', 'super_admin', 'nurse', 'care_manager', 'bed_control'])
  )
  WITH CHECK (
    tenant_id = public.get_current_tenant_id()
    AND public.current_user_has_any_role(ARRAY['admin', 'super_admin', 'nurse', 'care_manager', 'bed_control'])
  );

-- 1d. hospital_units_admin_write (was using is_admin() + is_super_admin() separately)
DROP POLICY IF EXISTS "hospital_units_admin_write" ON public.hospital_units;
CREATE POLICY "hospital_units_admin_write" ON public.hospital_units
  FOR ALL
  TO authenticated
  USING (
    tenant_id = public.get_current_tenant_id()
    AND public.current_user_has_any_role(ARRAY['admin', 'super_admin'])
  )
  WITH CHECK (
    tenant_id = public.get_current_tenant_id()
    AND public.current_user_has_any_role(ARRAY['admin', 'super_admin'])
  );

-- ============================================================================
-- PART 2: SMART APP MANAGEMENT WRITE POLICIES
-- Replace inline profiles.user_id EXISTS checks with current_user_has_any_role()
-- ============================================================================

-- 2a. smart_registered_apps_admin_all
DROP POLICY IF EXISTS "smart_registered_apps_admin_all" ON public.smart_registered_apps;
CREATE POLICY "smart_registered_apps_admin_all" ON public.smart_registered_apps
  FOR ALL
  TO authenticated
  USING (
    public.current_user_has_any_role(ARRAY['admin', 'super_admin'])
  );

-- 2b. smart_authorizations_admin_all
DROP POLICY IF EXISTS "smart_authorizations_admin_all" ON public.smart_authorizations;
CREATE POLICY "smart_authorizations_admin_all" ON public.smart_authorizations
  FOR ALL
  TO authenticated
  USING (
    public.current_user_has_any_role(ARRAY['admin', 'super_admin'])
  );

-- 2c. smart_audit_log_admin_select
DROP POLICY IF EXISTS "smart_audit_log_admin_select" ON public.smart_audit_log;
CREATE POLICY "smart_audit_log_admin_select" ON public.smart_audit_log
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_has_any_role(ARRAY['admin', 'super_admin'])
  );

-- ============================================================================
-- PART 3: READMISSION POLICIES — ALREADY USE is_admin() FUNCTION
-- These are already function-based and correct. No changes needed.
-- is_admin() checks super_admin_users first, then profiles.user_id + role.
-- Documenting here for completeness:
--   - patient_readmissions_admin_rw_patient_r: is_admin() ✓
--   - care_plans_admin_rw_team_r: is_admin() ✓
--   - daily_check_ins_admin_rw_patient_r: is_admin() ✓
--   - high_utilizer_admin_only: is_admin() ✓
--   - care_alerts_admin_and_assigned: is_admin() ✓
--   - engagement_metrics_admin_rw_patient_r: is_admin() ✓
-- ============================================================================

-- ============================================================================
-- PART 4: CHECK_INS POLICIES — ALREADY USE user_roles TABLE
-- These already use the correct pattern via user_roles table lookup.
-- The sync trigger (sync_user_roles_from_profiles) keeps them in sync.
-- No changes needed. Documenting here for completeness:
--   - check_ins_select_own: user_id = auth.uid() ✓
--   - check_ins_insert_own: user_id = auth.uid() ✓
--   - check_ins_admin_all: user_roles lookup ✓
--   - check_ins_caregiver_view: caregiver_view_grants ✓
-- ============================================================================

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (run manually to confirm)
-- ============================================================================
-- SELECT schemaname, tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('beds', 'bed_assignments', 'scheduled_arrivals',
--                     'hospital_units', 'smart_registered_apps',
--                     'smart_authorizations', 'smart_audit_log')
-- ORDER BY tablename, policyname;
