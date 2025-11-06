-- ============================================================================
-- PHI ACCESS AUDIT LOGS - HIPAA § 164.312(b) Compliance
-- Create audit trail table for all PHI access events
-- ============================================================================

-- ============================================================================
-- PHI ACCESS LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.phi_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who accessed
  user_id UUID REFERENCES auth.users(id),
  user_role TEXT NOT NULL,

  -- What was accessed
  action TEXT NOT NULL, -- 'VITALS_CAPTURE', 'MEDICATION_PHOTO_CAPTURE', 'SDOH_ASSESSMENT', etc.
  patient_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  visit_id UUID, -- Will reference field_visits when that table is created
  data_types TEXT[] NOT NULL, -- ['blood_pressure', 'medication_photos', etc.]

  -- Where and when
  access_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  device_id TEXT,
  kiosk_id TEXT,

  -- Additional context
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Compliance metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for query performance
CREATE INDEX idx_phi_access_logs_patient ON public.phi_access_logs(patient_id);
CREATE INDEX idx_phi_access_logs_user ON public.phi_access_logs(user_id);
CREATE INDEX idx_phi_access_logs_timestamp ON public.phi_access_logs(access_timestamp DESC);
CREATE INDEX idx_phi_access_logs_action ON public.phi_access_logs(action);
CREATE INDEX idx_phi_access_logs_visit ON public.phi_access_logs(visit_id);

COMMENT ON TABLE public.phi_access_logs IS 'HIPAA § 164.312(b) compliant audit trail for all PHI access events';
COMMENT ON COLUMN public.phi_access_logs.data_types IS 'Array of PHI data types accessed in this event';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.phi_access_logs ENABLE ROW LEVEL SECURITY;

-- Only admins and compliance officers can view audit logs
CREATE POLICY "Admins can view audit logs"
  ON public.phi_access_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'compliance_officer')
    )
  );

-- System can insert audit logs (service role)
CREATE POLICY "System can insert audit logs"
  ON public.phi_access_logs FOR INSERT
  WITH CHECK (true);

-- IMPORTANT: Audit logs are append-only, no UPDATE or DELETE allowed
-- This ensures tamper-proof audit trail

-- ============================================================================
-- HELPER FUNCTION: Get recent PHI access for a patient
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_patient_phi_access_log(
  p_patient_id UUID,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  access_timestamp TIMESTAMPTZ,
  action TEXT,
  user_role TEXT,
  device_id TEXT,
  data_types TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only admins and compliance officers can view audit logs
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'compliance_officer')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins and compliance officers can view audit logs';
  END IF;

  RETURN QUERY
  SELECT
    pal.access_timestamp,
    pal.action,
    pal.user_role,
    pal.device_id,
    pal.data_types
  FROM public.phi_access_logs pal
  WHERE pal.patient_id = p_patient_id
  ORDER BY pal.access_timestamp DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- HELPER FUNCTION: Get PHI access stats for compliance reporting
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_phi_access_stats(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  action TEXT,
  access_count BIGINT,
  unique_patients BIGINT,
  unique_devices BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only admins and compliance officers
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'compliance_officer')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins and compliance officers can view PHI statistics';
  END IF;

  RETURN QUERY
  SELECT
    pal.action,
    COUNT(*) as access_count,
    COUNT(DISTINCT pal.patient_id) as unique_patients,
    COUNT(DISTINCT pal.device_id) as unique_devices
  FROM public.phi_access_logs pal
  WHERE pal.access_timestamp BETWEEN p_start_date AND p_end_date
  GROUP BY pal.action
  ORDER BY access_count DESC;
END;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Service role needs full access for system operations
GRANT SELECT, INSERT ON public.phi_access_logs TO authenticated;

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION public.get_patient_phi_access_log TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_phi_access_stats TO authenticated;

-- ============================================================================
-- TRIGGER: Prevent modification of audit logs (tamper-proof)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are append-only and cannot be modified or deleted';
  RETURN NULL;
END;
$$;

CREATE TRIGGER prevent_phi_access_log_update
  BEFORE UPDATE ON public.phi_access_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_modification();

CREATE TRIGGER prevent_phi_access_log_delete
  BEFORE DELETE ON public.phi_access_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_modification();

-- ============================================================================
-- RETENTION POLICY (Optional - uncomment if needed)
-- ============================================================================

-- HIPAA requires audit logs be retained for 6 years
-- Uncomment this to automatically archive old logs

-- CREATE TABLE IF NOT EXISTS public.phi_access_logs_archive (
--   LIKE public.phi_access_logs INCLUDING ALL
-- );

-- CREATE OR REPLACE FUNCTION public.archive_old_phi_access_logs()
-- RETURNS void
-- LANGUAGE plpgsql
-- AS $$
-- BEGIN
--   -- Move logs older than 6 years to archive
--   INSERT INTO public.phi_access_logs_archive
--   SELECT * FROM public.phi_access_logs
--   WHERE access_timestamp < NOW() - INTERVAL '6 years';
--
--   -- Delete from active table
--   DELETE FROM public.phi_access_logs
--   WHERE access_timestamp < NOW() - INTERVAL '6 years';
-- END;
-- $$;

-- Migration complete
COMMENT ON SCHEMA public IS 'PHI Access Audit Logs migration completed - HIPAA § 164.312(b) compliant';
