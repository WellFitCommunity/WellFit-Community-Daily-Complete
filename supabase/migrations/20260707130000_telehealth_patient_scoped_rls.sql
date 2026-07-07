-- Telehealth patient-scoped RLS
--
-- Fixes T-4 (cross-patient PHI leak): the prior SELECT policies on the two
-- telehealth tables were tenant-WIDE (any authenticated user in a tenant could
-- read every patient's appointments and video sessions). This scopes reads to:
--   * the patient themselves      (patient_id = auth.uid())   ← NEW, enables the WellFit join
--   * the provider on the record  (provider_id = auth.uid())
--   * a tenant admin, tenant-wide (tenant_id = get_current_tenant_id() AND is_tenant_admin())
--   * a super admin, platform-wide
--
-- Writes remain provider/admin/service-role only (edge functions use the service
-- key and bypass RLS). Verified no client consumer relies on a tenant-wide read:
-- telehealth_sessions is only read by-id (PatientWaitingRoom, TelehealthConsultation);
-- appointment analytics use SECURITY DEFINER RPCs; the no-show admin summary runs
-- under is_tenant_admin(). Deliberately NO `-- migrate:down` block (db push executes
-- down blocks — known footgun in this repo).

-- ── telehealth_appointments ────────────────────────────────────────────────
DROP POLICY IF EXISTS telehealth_appointments_select ON public.telehealth_appointments;

CREATE POLICY telehealth_appointments_select ON public.telehealth_appointments
  FOR SELECT
  USING (
    patient_id = auth.uid()
    OR provider_id = auth.uid()
    OR (tenant_id = get_current_tenant_id() AND is_tenant_admin())
    OR is_super_admin()
  );

-- ── telehealth_sessions ────────────────────────────────────────────────────
-- Remove the broad tenant-wide ALL policy (the leak). Provider and admin ALL
-- policies remain; add patient + tenant-admin SELECT.
DROP POLICY IF EXISTS telehealth_sessions_tenant ON public.telehealth_sessions;

CREATE POLICY telehealth_sessions_patient_select ON public.telehealth_sessions
  FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY telehealth_sessions_tenant_admin_select ON public.telehealth_sessions
  FOR SELECT
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());
