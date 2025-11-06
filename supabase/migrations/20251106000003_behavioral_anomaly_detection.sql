-- =====================================================
-- BEHAVIORAL ANOMALY DETECTION SYSTEM
-- =====================================================
-- Purpose: Detect insider threats, account takeovers, and unusual PHI access
-- Compliance: SOC 2 CC7.3, HIPAA §164.308(a)(1)(ii)(D)
-- Created: 2025-11-06
-- =====================================================

-- =====================================================
-- 1. USER BEHAVIOR PROFILES
-- =====================================================
-- Stores baseline behavior for each user

CREATE TABLE IF NOT EXISTS public.user_behavior_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Temporal patterns
  typical_login_hours INTEGER[] DEFAULT '{}', -- e.g., [8,9,10,11,12,13,14,15,16,17]
  typical_login_days INTEGER[] DEFAULT '{}', -- 0=Sun, 1=Mon, etc.
  avg_session_duration_minutes INTEGER,

  -- Access patterns
  typical_ip_addresses TEXT[] DEFAULT '{}',
  typical_geolocation JSONB DEFAULT '{}', -- { city, region, country, lat, lon }
  avg_records_accessed_per_session NUMERIC(10,2),
  typical_resource_types TEXT[] DEFAULT '{}', -- ['patient', 'medication', 'lab_result']

  -- PHI access patterns
  typical_patient_access_pattern JSONB DEFAULT '{}', -- Frequently accessed patients
  avg_phi_access_per_day NUMERIC(10,2),
  typical_operations TEXT[] DEFAULT '{}', -- ['VIEW', 'CREATE', 'UPDATE']

  -- Export/bulk access patterns
  typical_export_frequency NUMERIC(10,2), -- Exports per week
  avg_bulk_access_size INTEGER,

  -- Role-specific metrics
  role_peer_group_stats JSONB DEFAULT '{}', -- Stats compared to peers

  -- Profile metadata
  baseline_start_date DATE,
  baseline_end_date DATE,
  baseline_sample_size INTEGER, -- Number of events used to build profile
  profile_confidence NUMERIC(3,2) CHECK (profile_confidence >= 0 AND profile_confidence <= 1),

  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for profile lookups
CREATE INDEX idx_user_behavior_profiles_confidence
ON public.user_behavior_profiles(profile_confidence)
WHERE profile_confidence >= 0.7;

-- =====================================================
-- 2. ANOMALY DETECTIONS
-- =====================================================
-- Stores detected anomalies with detailed scoring

CREATE TABLE IF NOT EXISTS public.anomaly_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event reference
  audit_log_id UUID REFERENCES public.audit_logs(id),
  phi_access_log_id UUID REFERENCES public.phi_access_logs(id),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Anomaly scoring (0-1 scale)
  aggregate_anomaly_score NUMERIC(3,2) NOT NULL CHECK (aggregate_anomaly_score >= 0 AND aggregate_anomaly_score <= 1),

  -- Detailed anomaly breakdown
  anomaly_breakdown JSONB NOT NULL,
  -- Structure: {
  --   "unusual_time": 0.8,
  --   "unusual_location": 0.6,
  --   "impossible_travel": 1.0,
  --   "excessive_access": 0.7,
  --   "unusual_patient": 0.4,
  --   "unusual_for_role": 0.9,
  --   "rapid_succession": 0.5,
  --   "bulk_export_anomaly": 0.0,
  --   "after_hours_access": 0.6
  -- }

  -- Risk classification
  risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),

  -- Context
  event_type TEXT, -- What triggered the detection
  event_timestamp TIMESTAMPTZ NOT NULL,
  ip_address INET,
  geolocation JSONB,
  user_agent TEXT,
  resource_type TEXT,
  resource_id UUID,
  operation TEXT,

  -- Investigation
  investigated BOOLEAN DEFAULT FALSE,
  investigation_outcome TEXT CHECK (investigation_outcome IN (
    'FALSE_POSITIVE',
    'CONFIRMED_THREAT',
    'POLICY_VIOLATION',
    'LEGITIMATE_UNUSUAL',
    'UNDER_INVESTIGATION'
  )),
  investigator_id UUID REFERENCES auth.users(id),
  investigated_at TIMESTAMPTZ,
  investigation_notes TEXT,

  -- Actions taken
  action_taken TEXT CHECK (action_taken IN (
    'NONE',
    'ALERT_SENT',
    'ACCOUNT_SUSPENDED',
    'PASSWORD_RESET_REQUIRED',
    'MFA_REQUIRED',
    'ACCESS_REVOKED',
    'INCIDENT_CREATED'
  )),
  action_timestamp TIMESTAMPTZ,

  -- Metadata
  additional_context JSONB DEFAULT '{}',

  detected_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  CONSTRAINT valid_audit_reference CHECK (
    audit_log_id IS NOT NULL OR phi_access_log_id IS NOT NULL
  )
);

-- Indexes for anomaly queries
CREATE INDEX idx_anomaly_detections_user ON public.anomaly_detections(user_id, detected_at DESC);
CREATE INDEX idx_anomaly_detections_risk ON public.anomaly_detections(risk_level, detected_at DESC);
CREATE INDEX idx_anomaly_detections_uninvestigated
ON public.anomaly_detections(detected_at DESC)
WHERE investigated = FALSE;
CREATE INDEX idx_anomaly_detections_score ON public.anomaly_detections(aggregate_anomaly_score DESC);

-- =====================================================
-- 3. DAILY BEHAVIOR SUMMARY
-- =====================================================
-- Aggregated daily statistics for trending analysis

CREATE TABLE IF NOT EXISTS public.daily_behavior_summary (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL,

  -- Login metrics
  total_logins INTEGER DEFAULT 0,
  login_hours INTEGER[] DEFAULT '{}',
  unique_ip_addresses INTEGER DEFAULT 0,

  -- Access metrics
  total_phi_accesses INTEGER DEFAULT 0,
  unique_patients_accessed INTEGER DEFAULT 0,
  total_session_duration_minutes INTEGER DEFAULT 0,

  -- Operation metrics
  total_views INTEGER DEFAULT 0,
  total_creates INTEGER DEFAULT 0,
  total_updates INTEGER DEFAULT 0,
  total_deletes INTEGER DEFAULT 0,
  total_exports INTEGER DEFAULT 0,

  -- Anomaly metrics
  anomaly_count INTEGER DEFAULT 0,
  anomaly_score_avg NUMERIC(3,2),
  anomaly_score_max NUMERIC(3,2),
  high_risk_anomalies INTEGER DEFAULT 0,

  -- Additional context
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (user_id, summary_date)
);

-- Indexes for trending queries
CREATE INDEX idx_daily_behavior_user_date ON public.daily_behavior_summary(user_id, summary_date DESC);
CREATE INDEX idx_daily_behavior_anomalies
ON public.daily_behavior_summary(summary_date DESC, anomaly_count DESC)
WHERE anomaly_count > 0;

-- =====================================================
-- 4. GEOLOCATION HISTORY
-- =====================================================
-- Track user geolocations for impossible travel detection

CREATE TABLE IF NOT EXISTS public.user_geolocation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  timestamp TIMESTAMPTZ NOT NULL,
  ip_address INET NOT NULL,

  -- Geolocation data
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  city TEXT,
  region TEXT,
  country TEXT,
  country_code TEXT,

  -- Context
  event_type TEXT, -- 'login', 'phi_access', 'api_call'
  event_id UUID, -- Reference to audit_logs or phi_access_logs

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for impossible travel detection
CREATE INDEX idx_geolocation_user_time ON public.user_geolocation_history(user_id, timestamp DESC);

-- =====================================================
-- 5. PEER GROUP STATISTICS
-- =====================================================
-- Pre-calculated statistics for peer group comparison

CREATE TABLE IF NOT EXISTS public.peer_group_statistics (
  role TEXT NOT NULL CHECK (role IN ('admin', 'super_admin')),
  metric_name TEXT NOT NULL,

  -- Statistical measures
  sample_size INTEGER NOT NULL,
  mean_value NUMERIC(10,2) NOT NULL,
  median_value NUMERIC(10,2),
  std_dev NUMERIC(10,2),
  p95_value NUMERIC(10,2), -- 95th percentile
  p99_value NUMERIC(10,2), -- 99th percentile
  min_value NUMERIC(10,2),
  max_value NUMERIC(10,2),

  -- Time period
  calculation_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (role, metric_name, calculation_date)
);

-- Index for peer group lookups
CREATE INDEX idx_peer_stats_role_metric ON public.peer_group_statistics(role, metric_name, calculation_date DESC);

-- =====================================================
-- 6. FUNCTIONS FOR ANOMALY DETECTION
-- =====================================================

-- Function: Calculate distance between two geolocations (Haversine formula)
CREATE OR REPLACE FUNCTION public.calculate_distance_km(
  lat1 NUMERIC,
  lon1 NUMERIC,
  lat2 NUMERIC,
  lon2 NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
  earth_radius CONSTANT NUMERIC := 6371; -- km
  dlat NUMERIC;
  dlon NUMERIC;
  a NUMERIC;
  c NUMERIC;
BEGIN
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);

  a := sin(dlat/2) * sin(dlat/2) +
       cos(radians(lat1)) * cos(radians(lat2)) *
       sin(dlon/2) * sin(dlon/2);

  c := 2 * atan2(sqrt(a), sqrt(1-a));

  RETURN earth_radius * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Detect impossible travel
CREATE OR REPLACE FUNCTION public.detect_impossible_travel(
  p_user_id UUID,
  p_current_lat NUMERIC,
  p_current_lon NUMERIC,
  p_current_timestamp TIMESTAMPTZ
)
RETURNS TABLE (
  is_impossible_travel BOOLEAN,
  previous_location TEXT,
  current_location TEXT,
  distance_km NUMERIC,
  time_elapsed_hours NUMERIC,
  required_speed_kmh NUMERIC,
  anomaly_score NUMERIC
) AS $$
DECLARE
  v_last_location RECORD;
  v_distance NUMERIC;
  v_time_hours NUMERIC;
  v_speed NUMERIC;
  v_max_possible_speed CONSTANT NUMERIC := 900; -- km/h (commercial flight speed)
BEGIN
  -- Get last known location
  SELECT
    latitude,
    longitude,
    city || ', ' || country as location,
    timestamp
  INTO v_last_location
  FROM public.user_geolocation_history
  WHERE user_id = p_user_id
    AND timestamp < p_current_timestamp
    AND latitude IS NOT NULL
    AND longitude IS NOT NULL
  ORDER BY timestamp DESC
  LIMIT 1;

  -- No previous location = no anomaly
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;

  -- Calculate distance
  v_distance := public.calculate_distance_km(
    v_last_location.latitude,
    v_last_location.longitude,
    p_current_lat,
    p_current_lon
  );

  -- Calculate time elapsed (in hours)
  v_time_hours := EXTRACT(EPOCH FROM (p_current_timestamp - v_last_location.timestamp)) / 3600;

  -- Avoid division by zero
  IF v_time_hours < 0.01 THEN
    v_time_hours := 0.01;
  END IF;

  -- Calculate required speed
  v_speed := v_distance / v_time_hours;

  -- Determine if impossible
  RETURN QUERY SELECT
    (v_speed > v_max_possible_speed) as is_impossible_travel,
    v_last_location.location as previous_location,
    'Current location' as current_location,
    v_distance as distance_km,
    v_time_hours as time_elapsed_hours,
    v_speed as required_speed_kmh,
    CASE
      WHEN v_speed > v_max_possible_speed THEN 1.0
      WHEN v_speed > (v_max_possible_speed * 0.8) THEN 0.8
      WHEN v_speed > (v_max_possible_speed * 0.6) THEN 0.6
      ELSE 0.0
    END::NUMERIC as anomaly_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get user behavior baseline
CREATE OR REPLACE FUNCTION public.get_user_behavior_baseline(
  p_user_id UUID
)
RETURNS TABLE (
  has_baseline BOOLEAN,
  confidence NUMERIC,
  avg_daily_access NUMERIC,
  typical_hours INTEGER[],
  typical_ips TEXT[],
  baseline_age_days INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    true as has_baseline,
    ubp.profile_confidence as confidence,
    ubp.avg_phi_access_per_day as avg_daily_access,
    ubp.typical_login_hours as typical_hours,
    ubp.typical_ip_addresses as typical_ips,
    EXTRACT(DAY FROM NOW() - ubp.last_updated_at)::INTEGER as baseline_age_days
  FROM public.user_behavior_profiles ubp
  WHERE ubp.user_id = p_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER[], NULL::TEXT[], NULL::INTEGER;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get uninvestigated anomalies
CREATE OR REPLACE FUNCTION public.get_uninvestigated_anomalies(
  p_min_score NUMERIC DEFAULT 0.5,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_email TEXT,
  user_role TEXT,
  aggregate_score NUMERIC,
  risk_level TEXT,
  event_type TEXT,
  detected_at TIMESTAMPTZ,
  days_since_detection INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ad.id,
    ad.user_id,
    au.email as user_email,
    COALESCE(ur.role, 'unknown') as user_role,
    ad.aggregate_anomaly_score as aggregate_score,
    ad.risk_level,
    ad.event_type,
    ad.detected_at,
    EXTRACT(DAY FROM NOW() - ad.detected_at)::INTEGER as days_since_detection
  FROM public.anomaly_detections ad
  JOIN auth.users au ON au.id = ad.user_id
  LEFT JOIN public.user_roles ur ON ur.user_id = ad.user_id
  WHERE ad.investigated = FALSE
    AND ad.aggregate_anomaly_score >= p_min_score
  ORDER BY ad.aggregate_anomaly_score DESC, ad.detected_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Mark anomaly as investigated
CREATE OR REPLACE FUNCTION public.mark_anomaly_investigated(
  p_anomaly_id UUID,
  p_outcome TEXT,
  p_investigator_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_action_taken TEXT DEFAULT 'NONE'
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.anomaly_detections
  SET
    investigated = TRUE,
    investigation_outcome = p_outcome,
    investigator_id = p_investigator_id,
    investigated_at = NOW(),
    investigation_notes = p_notes,
    action_taken = p_action_taken,
    action_timestamp = CASE WHEN p_action_taken != 'NONE' THEN NOW() ELSE NULL END
  WHERE id = p_anomaly_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. ROW-LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE public.user_behavior_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anomaly_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_behavior_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_geolocation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_group_statistics ENABLE ROW LEVEL SECURITY;

-- User behavior profiles: Users can view their own, admins can view all
CREATE POLICY "Users can view their own behavior profile"
ON public.user_behavior_profiles
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all behavior profiles"
ON public.user_behavior_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin')
  )
);

-- Anomaly detections: Only admins can view
CREATE POLICY "Admins can view anomaly detections"
ON public.anomaly_detections
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin')
  )
);

CREATE POLICY "Admins can update anomaly investigations"
ON public.anomaly_detections
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin')
  )
);

-- Daily behavior summary: Users can view their own, admins can view all
CREATE POLICY "Users can view their own behavior summary"
ON public.daily_behavior_summary
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all behavior summaries"
ON public.daily_behavior_summary
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin')
  )
);

-- Geolocation history: Users can view their own, admins can view all
CREATE POLICY "Users can view their own geolocation history"
ON public.user_geolocation_history
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all geolocation history"
ON public.user_geolocation_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin')
  )
);

-- Peer group statistics: Admins only
CREATE POLICY "Admins can view peer group statistics"
ON public.peer_group_statistics
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin')
  )
);

-- =====================================================
-- 8. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.user_behavior_profiles IS
'Baseline behavior profiles for anomaly detection - tracks typical access patterns';

COMMENT ON TABLE public.anomaly_detections IS
'Detected anomalies with risk scoring and investigation tracking';

COMMENT ON TABLE public.daily_behavior_summary IS
'Daily aggregated behavior statistics for trending analysis';

COMMENT ON TABLE public.user_geolocation_history IS
'Geolocation history for impossible travel detection';

COMMENT ON TABLE public.peer_group_statistics IS
'Pre-calculated peer group statistics for comparison-based anomaly detection';

COMMENT ON FUNCTION public.calculate_distance_km IS
'Calculate distance between two geographic coordinates using Haversine formula';

COMMENT ON FUNCTION public.detect_impossible_travel IS
'Detect impossible travel scenarios based on geolocation and time';

COMMENT ON FUNCTION public.get_user_behavior_baseline IS
'Retrieve user behavior baseline for anomaly detection';

COMMENT ON FUNCTION public.get_uninvestigated_anomalies IS
'Get list of anomalies requiring investigation';

COMMENT ON FUNCTION public.mark_anomaly_investigated IS
'Mark an anomaly as investigated with outcome and actions taken';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- This migration adds comprehensive behavioral anomaly detection:
-- ✅ User behavior profiling
-- ✅ Real-time anomaly detection
-- ✅ Impossible travel detection
-- ✅ Peer group comparison
-- ✅ Investigation workflow
-- ✅ Complete audit trail
-- ✅ RLS policies for data security
-- =====================================================
