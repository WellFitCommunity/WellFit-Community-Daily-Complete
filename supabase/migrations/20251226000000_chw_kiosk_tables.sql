-- ============================================================================
-- CHW KIOSK SYSTEM - DATABASE SCHEMA
-- Tables for library/community center kiosk deployments
-- Deployed: 2025-12-26
-- ============================================================================

-- ============================================================================
-- CHW KIOSK SESSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.chw_kiosk_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  kiosk_id TEXT NOT NULL,
  location_name TEXT NOT NULL,
  location_gps GEOGRAPHY(POINT, 4326),

  -- Session details
  check_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_out_time TIMESTAMPTZ,
  language TEXT DEFAULT 'en' CHECK (language IN ('en', 'es', 'vi')),

  -- Consent tracking
  privacy_consent BOOLEAN NOT NULL DEFAULT false,
  privacy_consent_timestamp TIMESTAMPTZ,
  photo_consent BOOLEAN DEFAULT false,
  photo_consent_timestamp TIMESTAMPTZ,

  -- Session data (flexible JSON storage)
  session_data JSONB DEFAULT '{}'::jsonb,

  -- Visit tracking
  visit_id UUID REFERENCES public.field_visits(id),

  -- Completion status
  completed BOOLEAN DEFAULT false,
  incomplete_reason TEXT,

  -- Multi-tenancy
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE RESTRICT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chw_kiosk_sessions_patient ON public.chw_kiosk_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_chw_kiosk_sessions_kiosk ON public.chw_kiosk_sessions(kiosk_id);
CREATE INDEX IF NOT EXISTS idx_chw_kiosk_sessions_check_in ON public.chw_kiosk_sessions(check_in_time);
CREATE INDEX IF NOT EXISTS idx_chw_kiosk_sessions_location ON public.chw_kiosk_sessions USING GIST(location_gps);
CREATE INDEX IF NOT EXISTS idx_chw_kiosk_sessions_visit ON public.chw_kiosk_sessions(visit_id);
CREATE INDEX IF NOT EXISTS idx_chw_kiosk_sessions_data ON public.chw_kiosk_sessions USING GIN(session_data);
CREATE INDEX IF NOT EXISTS idx_chw_kiosk_sessions_tenant ON public.chw_kiosk_sessions(tenant_id);

COMMENT ON TABLE public.chw_kiosk_sessions IS 'Tracks patient kiosk usage sessions at library/community locations';
COMMENT ON COLUMN public.chw_kiosk_sessions.session_data IS 'Flexible JSONB for storing session-specific data';

-- ============================================================================
-- CHW PATIENT CONSENT TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.chw_patient_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,

  -- Consent types
  consent_type TEXT NOT NULL CHECK (consent_type IN (
    'kiosk_usage',
    'photo_capture',
    'video_call',
    'data_sharing',
    'hipaa_privacy',
    'medication_photo',
    'home_visit'
  )),

  -- Consent details
  consented BOOLEAN NOT NULL,
  consent_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consent_method TEXT CHECK (consent_method IN ('verbal', 'written', 'electronic', 'implied')),

  -- Location where consent was obtained
  kiosk_id TEXT,
  location_name TEXT,

  -- Witness (for important consents)
  witness_name TEXT,
  witness_role TEXT,

  -- Expiration (some consents may expire)
  expires_at TIMESTAMPTZ,

  -- Revocation tracking
  revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,

  -- Multi-tenancy
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE RESTRICT,

  -- Audit trail
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chw_patient_consent_patient ON public.chw_patient_consent(patient_id);
CREATE INDEX IF NOT EXISTS idx_chw_patient_consent_type ON public.chw_patient_consent(consent_type);
CREATE INDEX IF NOT EXISTS idx_chw_patient_consent_kiosk ON public.chw_patient_consent(kiosk_id);
CREATE INDEX IF NOT EXISTS idx_chw_patient_consent_expires ON public.chw_patient_consent(expires_at);
CREATE INDEX IF NOT EXISTS idx_chw_patient_consent_tenant ON public.chw_patient_consent(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chw_patient_consent_active_unique ON public.chw_patient_consent(patient_id, consent_type) WHERE (NOT revoked);

COMMENT ON TABLE public.chw_patient_consent IS 'HIPAA-compliant consent tracking for kiosk usage';

-- ============================================================================
-- CHW KIOSK DEVICES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.chw_kiosk_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kiosk_id TEXT NOT NULL UNIQUE,

  -- Location details
  location_name TEXT NOT NULL,
  location_type TEXT CHECK (location_type IN ('library', 'community_center', 'church', 'clinic', 'mobile_unit', 'other')),
  location_address TEXT,
  location_gps GEOGRAPHY(POINT, 4326),

  -- Service area
  service_area GEOGRAPHY(POLYGON, 4326),

  -- Device information
  device_type TEXT CHECK (device_type IN ('tablet', 'desktop', 'laptop', 'mobile')),
  device_model TEXT,
  device_serial TEXT,

  -- Operating hours
  operating_hours JSONB, -- {"mon": {"open": "09:00", "close": "17:00"}, ...}

  -- Capabilities
  has_camera BOOLEAN DEFAULT true,
  has_microphone BOOLEAN DEFAULT true,
  has_printer BOOLEAN DEFAULT false,
  has_bluetooth BOOLEAN DEFAULT true,

  -- Network information
  internet_type TEXT CHECK (internet_type IN ('fiber', 'cable', 'dsl', 'cellular', 'satellite', 'other')),
  internet_speed_mbps INTEGER,

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_online_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,

  -- Contact person at location
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,

  -- Partnership details
  partner_organization TEXT,
  partnership_start_date DATE,
  partnership_end_date DATE,

  -- Multi-tenancy
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE RESTRICT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chw_kiosk_devices_location ON public.chw_kiosk_devices USING GIST(location_gps);
CREATE INDEX IF NOT EXISTS idx_chw_kiosk_devices_service_area ON public.chw_kiosk_devices USING GIST(service_area);
CREATE INDEX IF NOT EXISTS idx_chw_kiosk_devices_active ON public.chw_kiosk_devices(is_active);
CREATE INDEX IF NOT EXISTS idx_chw_kiosk_devices_type ON public.chw_kiosk_devices(location_type);
CREATE INDEX IF NOT EXISTS idx_chw_kiosk_devices_tenant ON public.chw_kiosk_devices(tenant_id);

COMMENT ON TABLE public.chw_kiosk_devices IS 'Registry of all kiosk devices deployed in the field';

-- ============================================================================
-- CHW KIOSK USAGE ANALYTICS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.chw_kiosk_usage_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kiosk_id TEXT NOT NULL,
  date DATE NOT NULL,

  -- Daily metrics
  total_sessions INTEGER DEFAULT 0,
  completed_sessions INTEGER DEFAULT 0,
  incomplete_sessions INTEGER DEFAULT 0,

  -- User engagement
  unique_patients INTEGER DEFAULT 0,
  returning_patients INTEGER DEFAULT 0,
  new_patients INTEGER DEFAULT 0,

  -- Activity breakdown
  vitals_captured INTEGER DEFAULT 0,
  medications_photographed INTEGER DEFAULT 0,
  sdoh_assessments INTEGER DEFAULT 0,
  telehealth_calls INTEGER DEFAULT 0,

  -- Offline metrics
  offline_sessions INTEGER DEFAULT 0,
  sync_failures INTEGER DEFAULT 0,

  -- Performance
  avg_session_duration_minutes NUMERIC(10,2),

  -- Multi-tenancy
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE RESTRICT,

  -- Generated
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_kiosk_date UNIQUE(kiosk_id, date)
);

CREATE INDEX IF NOT EXISTS idx_chw_kiosk_analytics_kiosk ON public.chw_kiosk_usage_analytics(kiosk_id);
CREATE INDEX IF NOT EXISTS idx_chw_kiosk_analytics_date ON public.chw_kiosk_usage_analytics(date);
CREATE INDEX IF NOT EXISTS idx_chw_kiosk_analytics_tenant ON public.chw_kiosk_usage_analytics(tenant_id);

COMMENT ON TABLE public.chw_kiosk_usage_analytics IS 'Daily analytics for kiosk usage and performance tracking';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.chw_kiosk_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chw_patient_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chw_kiosk_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chw_kiosk_usage_analytics ENABLE ROW LEVEL SECURITY;

-- Kiosk Sessions Policies
CREATE POLICY "Patients can view their own kiosk sessions"
  ON public.chw_kiosk_sessions FOR SELECT
  USING (auth.uid() = patient_id);

CREATE POLICY "CHW staff can view all kiosk sessions"
  ON public.chw_kiosk_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'nurse', 'case_manager', 'community_health_worker')
    )
  );

CREATE POLICY "System can insert kiosk sessions"
  ON public.chw_kiosk_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update kiosk sessions"
  ON public.chw_kiosk_sessions FOR UPDATE
  USING (true);

-- Patient Consent Policies
CREATE POLICY "Patients can view their own consents"
  ON public.chw_patient_consent FOR SELECT
  USING (auth.uid() = patient_id);

CREATE POLICY "Staff can view all patient consents"
  ON public.chw_patient_consent FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'physician', 'nurse', 'case_manager')
    )
  );

CREATE POLICY "System can insert patient consents"
  ON public.chw_patient_consent FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Patients can revoke their own consents"
  ON public.chw_patient_consent FOR UPDATE
  USING (auth.uid() = patient_id);

-- Kiosk Devices Policies (Admin only)
CREATE POLICY "Admins can manage kiosk devices"
  ON public.chw_kiosk_devices FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Anyone can view active kiosk devices"
  ON public.chw_kiosk_devices FOR SELECT
  USING (is_active = true);

-- Kiosk Analytics Policies (Admin only)
CREATE POLICY "Admins can view kiosk analytics"
  ON public.chw_kiosk_usage_analytics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "System can insert kiosk analytics"
  ON public.chw_kiosk_usage_analytics FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to record patient consent
CREATE OR REPLACE FUNCTION public.record_patient_consent(
  p_patient_id UUID,
  p_consent_type TEXT,
  p_consented BOOLEAN,
  p_kiosk_id TEXT DEFAULT NULL,
  p_consent_method TEXT DEFAULT 'electronic'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  consent_id UUID;
BEGIN
  -- Revoke any existing consent of this type
  UPDATE public.chw_patient_consent
  SET revoked = true,
      revoked_at = NOW(),
      revocation_reason = 'Replaced by new consent'
  WHERE patient_id = p_patient_id
    AND consent_type = p_consent_type
    AND NOT revoked;

  -- Insert new consent
  INSERT INTO public.chw_patient_consent (
    patient_id,
    consent_type,
    consented,
    consent_method,
    kiosk_id
  ) VALUES (
    p_patient_id,
    p_consent_type,
    p_consented,
    p_consent_method,
    p_kiosk_id
  ) RETURNING id INTO consent_id;

  RETURN consent_id;
END;
$$;

-- Function to check if patient has active consent
CREATE OR REPLACE FUNCTION public.has_active_consent(
  p_patient_id UUID,
  p_consent_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  has_consent BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.chw_patient_consent
    WHERE patient_id = p_patient_id
      AND consent_type = p_consent_type
      AND consented = true
      AND NOT revoked
      AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO has_consent;

  RETURN has_consent;
END;
$$;

-- Function to update kiosk device last seen
CREATE OR REPLACE FUNCTION public.update_kiosk_last_seen(
  p_kiosk_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.chw_kiosk_devices
  SET last_online_at = NOW(),
      updated_at = NOW()
  WHERE kiosk_id = p_kiosk_id;
END;
$$;

-- Function to aggregate daily kiosk analytics
CREATE OR REPLACE FUNCTION public.aggregate_kiosk_analytics(
  p_kiosk_id TEXT,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_sessions INTEGER;
  v_completed_sessions INTEGER;
  v_unique_patients INTEGER;
  v_avg_duration NUMERIC;
BEGIN
  -- Count sessions for the day
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE completed = true),
    COUNT(DISTINCT patient_id),
    AVG(EXTRACT(EPOCH FROM (check_out_time - check_in_time)) / 60)
  INTO
    v_total_sessions,
    v_completed_sessions,
    v_unique_patients,
    v_avg_duration
  FROM public.chw_kiosk_sessions
  WHERE kiosk_id = p_kiosk_id
    AND DATE(check_in_time) = p_date;

  -- Upsert analytics
  INSERT INTO public.chw_kiosk_usage_analytics (
    kiosk_id,
    date,
    total_sessions,
    completed_sessions,
    incomplete_sessions,
    unique_patients,
    avg_session_duration_minutes
  ) VALUES (
    p_kiosk_id,
    p_date,
    v_total_sessions,
    v_completed_sessions,
    v_total_sessions - v_completed_sessions,
    v_unique_patients,
    v_avg_duration
  )
  ON CONFLICT (kiosk_id, date) DO UPDATE
  SET total_sessions = EXCLUDED.total_sessions,
      completed_sessions = EXCLUDED.completed_sessions,
      incomplete_sessions = EXCLUDED.incomplete_sessions,
      unique_patients = EXCLUDED.unique_patients,
      avg_session_duration_minutes = EXCLUDED.avg_session_duration_minutes;
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE TRIGGER update_chw_kiosk_sessions_updated_at
  BEFORE UPDATE ON public.chw_kiosk_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chw_kiosk_devices_updated_at
  BEFORE UPDATE ON public.chw_kiosk_devices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.chw_kiosk_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.chw_patient_consent TO authenticated;
GRANT SELECT ON public.chw_kiosk_devices TO authenticated;
GRANT SELECT ON public.chw_kiosk_usage_analytics TO authenticated;

-- Grant access to helper functions
GRANT EXECUTE ON FUNCTION public.record_patient_consent TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_consent TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_kiosk_last_seen TO authenticated;
GRANT EXECUTE ON FUNCTION public.aggregate_kiosk_analytics TO authenticated;

-- ============================================================================
-- SAMPLE DATA (for testing)
-- ============================================================================

-- Insert demo kiosk devices
INSERT INTO public.chw_kiosk_devices (
  kiosk_id,
  location_name,
  location_type,
  location_address,
  device_type,
  has_camera,
  has_microphone,
  has_bluetooth,
  internet_type,
  internet_speed_mbps,
  contact_name,
  partner_organization,
  tenant_id
) VALUES
(
  'kiosk-demo-001',
  'Main Street Public Library',
  'library',
  '123 Main St, Smalltown, USA',
  'tablet',
  true,
  true,
  true,
  'fiber',
  100,
  'Jane Librarian',
  'Smalltown Public Library System',
  '2b902657-6a20-4435-a78a-576f397517ca'
),
(
  'kiosk-web-001',
  'Web Kiosk',
  'other',
  'Virtual',
  'desktop',
  true,
  true,
  false,
  'fiber',
  1000,
  'System Administrator',
  'WellFit Community',
  '2b902657-6a20-4435-a78a-576f397517ca'
)
ON CONFLICT (kiosk_id) DO NOTHING;

-- Migration complete
