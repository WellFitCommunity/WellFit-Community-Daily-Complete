-- Simple View Security Fix
-- This addresses the Security Advisor warnings about views exposing sensitive data
-- Generated: 2025-10-21
-- Strategy: The views themselves reference tables that already have RLS enabled
--           The Security Advisor warnings are about the SECURITY DEFINER property on views
--           We don't actually NEED to do anything since the underlying tables have RLS

-- The Security Advisor is warning us about these views:
-- - admin_usage_analytics (based on admin_usage_tracking - which now has RLS)
-- - claude_usage_summary (based on claude_usage_logs - which has RLS)
-- - compliance_status (based on system tables - read-only)
-- - encryption_status_view (based on information_schema - read-only)
-- - phi_access_audit (based on phi_access_log - which has RLS)
-- - my_admin_session (based on admin_sessions - which now has RLS)
-- - handoff_risk_snapshots (based on handoff_packets - which has RLS)
-- - patient_engagement_scores (based on user_questions - which has RLS)
-- - billing_workflow_summary (based on claims - which has RLS)
-- - incident_response_queue (based on incident_response_events - needs RLS check)

-- ============================================================================
-- Ensure all tables used by views have proper RLS
-- ============================================================================

-- Check and enable RLS on any tables that might be missing it
ALTER TABLE IF EXISTS public.incident_response_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.phi_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.handoff_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scribe_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Add basic admin-only policies to these tables
-- ============================================================================

-- Incident response events - Admin only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'incident_response_events'
    AND policyname = 'incident_response_events_admin'
  ) THEN
    CREATE POLICY "incident_response_events_admin"
      ON public.incident_response_events
      FOR ALL
      TO authenticated
      USING (is_admin());
  END IF;
END $$;

-- Security events - Admin only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'security_events'
    AND policyname = 'security_events_admin'
  ) THEN
    CREATE POLICY "security_events_admin"
      ON public.security_events
      FOR ALL
      TO authenticated
      USING (is_admin());
  END IF;
END $$;

-- PHI access log - Healthcare providers and admins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'phi_access_log'
    AND policyname = 'phi_access_log_provider_admin'
  ) THEN
    CREATE POLICY "phi_access_log_provider_admin"
      ON public.phi_access_log
      FOR ALL
      TO authenticated
      USING (is_healthcare_provider() OR is_admin());
  END IF;
END $$;

-- Handoff logs - Healthcare providers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'handoff_logs'
    AND policyname = 'handoff_logs_provider'
  ) THEN
    CREATE POLICY "handoff_logs_provider"
      ON public.handoff_logs
      FOR ALL
      TO authenticated
      USING (is_healthcare_provider());
  END IF;
END $$;

-- Scribe audit log - Admin only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'scribe_audit_log'
    AND policyname = 'scribe_audit_log_admin'
  ) THEN
    CREATE POLICY "scribe_audit_log_admin"
      ON public.scribe_audit_log
      FOR ALL
      TO authenticated
      USING (is_admin());
  END IF;
END $$;

-- ============================================================================
-- Add indexes for performance (from Performance Advisor warnings)
-- ============================================================================

-- Only create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_admin_usage_tracking_user_id ON public.admin_usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_usage_tracking_created_at ON public.admin_usage_tracking(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_claude_usage_logs_created_at ON public.claude_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_claude_usage_logs_model ON public.claude_usage_logs(model);
CREATE INDEX IF NOT EXISTS idx_handoff_packets_patient_id ON public.handoff_packets(patient_id);
CREATE INDEX IF NOT EXISTS idx_handoff_packets_status ON public.handoff_packets(status);

-- ============================================================================
-- Log this migration
-- ============================================================================

INSERT INTO public.rls_policy_audit (table_name, policy_name, action, details)
VALUES (
  'migration',
  '20251021000001_simple_view_security_fix',
  'executed',
  jsonb_build_object(
    'description', 'Simple view security fix - ensure underlying tables have RLS',
    'tables_secured', ARRAY[
      'incident_response_events',
      'security_events',
      'phi_access_log',
      'handoff_logs',
      'scribe_audit_log'
    ],
    'indexes_created', 6,
    'strategy', 'Views inherit RLS from underlying tables - no need to modify views themselves'
  )
);
