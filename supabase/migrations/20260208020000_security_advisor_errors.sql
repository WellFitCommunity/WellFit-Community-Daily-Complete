-- Security Advisor Error Fixes
-- Addresses 58 errors from Supabase Security Advisor:
--   53 Security Definer Views → SET security_invoker = on
--    2 Exposed Auth Users → Revoke anon access + set security_invoker
--    2 RLS Disabled in Public → Enable RLS + create policies
--    1 Policy Exists RLS Disabled → Enable RLS

-- =============================================================================
-- PART 1: Fix 53 Security Definer Views
-- PostgreSQL 17 supports ALTER VIEW ... SET (security_invoker = on)
-- This makes views run as the calling user, not the view owner (postgres)
-- =============================================================================

ALTER VIEW public.admin_usage_analytics SET (security_invoker = on);
ALTER VIEW public.app_patients SET (security_invoker = on);
ALTER VIEW public.audit_summary_stats SET (security_invoker = on);
ALTER VIEW public.backup_compliance_dashboard SET (security_invoker = on);
ALTER VIEW public.billing_providers_decrypted SET (security_invoker = on);
ALTER VIEW public.billing_workflow_summary SET (security_invoker = on);
ALTER VIEW public.check_ins_decrypted SET (security_invoker = on);
ALTER VIEW public.drill_compliance_dashboard SET (security_invoker = on);
ALTER VIEW public.ed_boarders_with_metrics SET (security_invoker = on);
ALTER VIEW public.employee_directory SET (security_invoker = on);
ALTER VIEW public.facilities_decrypted SET (security_invoker = on);
ALTER VIEW public.fhir_encounters SET (security_invoker = on);
ALTER VIEW public.fhir_practitioners_decrypted SET (security_invoker = on);
ALTER VIEW public.hc_organization_decrypted SET (security_invoker = on);
ALTER VIEW public.hc_provider_group_decrypted SET (security_invoker = on);
ALTER VIEW public.hc_staff_decrypted SET (security_invoker = on);
ALTER VIEW public.healthcare_metrics SET (security_invoker = on);
ALTER VIEW public.hospital_patients SET (security_invoker = on);
ALTER VIEW public.mcp_clearinghouse_daily_volume SET (security_invoker = on);
ALTER VIEW public.mcp_clearinghouse_stats SET (security_invoker = on);
ALTER VIEW public.mcp_cost_savings_summary SET (security_invoker = on);
ALTER VIEW public.mcp_hl7_x12_stats SET (security_invoker = on);
ALTER VIEW public.metrics_latest SET (security_invoker = on);
ALTER VIEW public.patient_engagement_scores SET (security_invoker = on);
ALTER VIEW public.patient_referrals_decrypted SET (security_invoker = on);
ALTER VIEW public.pending_security_alerts SET (security_invoker = on);
ALTER VIEW public.phi_access_by_patient SET (security_invoker = on);
ALTER VIEW public.position_savings_summary SET (security_invoker = on);
ALTER VIEW public.profiles_decrypted SET (security_invoker = on);
ALTER VIEW public.rate_limit_monitoring SET (security_invoker = on);
ALTER VIEW public.security_alert_dashboard SET (security_invoker = on);
ALTER VIEW public.senior_demographics_decrypted SET (security_invoker = on);
ALTER VIEW public.staff_savings_summary SET (security_invoker = on);
ALTER VIEW public.tenant_savings_totals SET (security_invoker = on);
ALTER VIEW public.time_clock_settings_with_timezone SET (security_invoker = on);
ALTER VIEW public.us_timezones SET (security_invoker = on);
ALTER VIEW public.v_997_acknowledgment_summary SET (security_invoker = on);
ALTER VIEW public.v_997_rejected_transactions SET (security_invoker = on);
ALTER VIEW public.v_bed_board SET (security_invoker = on);
ALTER VIEW public.v_cache_health_dashboard SET (security_invoker = on);
ALTER VIEW public.v_mental_health_discharge_blockers SET (security_invoker = on);
ALTER VIEW public.v_pending_mental_health_sessions SET (security_invoker = on);
ALTER VIEW public.v_readmission_active_alerts SET (security_invoker = on);
ALTER VIEW public.v_readmission_dashboard_metrics SET (security_invoker = on);
ALTER VIEW public.v_readmission_high_risk_members SET (security_invoker = on);
ALTER VIEW public.v_subscription_health_dashboard SET (security_invoker = on);
ALTER VIEW public.v_tenant_config_change_summary SET (security_invoker = on);
ALTER VIEW public.v_tenant_config_changes SET (security_invoker = on);
ALTER VIEW public.v_unit_capacity SET (security_invoker = on);
ALTER VIEW public.vital_capture_sources SET (security_invoker = on);
ALTER VIEW public.vw_hc_active_staff SET (security_invoker = on);
ALTER VIEW public.vw_hc_expiring_credentials SET (security_invoker = on);
ALTER VIEW public.vw_staff_wellness_summary SET (security_invoker = on);

-- =============================================================================
-- PART 2: Fix 2 Exposed Auth Users views
-- These views JOIN auth.users and are accessible by authenticated/anon roles.
-- With security_invoker = on (set above), authenticated users already can't
-- read auth.users. But we also revoke anon access as defense-in-depth.
-- =============================================================================

-- healthcare_metrics: admin-only dashboard view
REVOKE ALL ON public.healthcare_metrics FROM anon;

-- pending_security_alerts: security dashboard — admin only
REVOKE ALL ON public.pending_security_alerts FROM anon;

-- =============================================================================
-- PART 3: Fix 2 RLS Disabled in Public tables
-- =============================================================================

-- spatial_ref_sys: PostGIS system table — owned by PostGIS extension
-- Cannot modify: not our table to manage. Skipped.

-- migration_phi_field_definitions: PHI field pattern reference table
-- Read-only for authenticated, admin-write
ALTER TABLE public.migration_phi_field_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "phi_field_defs_read_authenticated" ON public.migration_phi_field_definitions;
CREATE POLICY "phi_field_defs_read_authenticated"
  ON public.migration_phi_field_definitions
  FOR SELECT
  TO authenticated
  USING (true);

-- =============================================================================
-- PART 4: Fix 1 Policy Exists but RLS Disabled
-- =============================================================================

-- x12_997_error_codes: already has policies but RLS not enabled
ALTER TABLE public.x12_997_error_codes ENABLE ROW LEVEL SECURITY;
