-- ============================================================================
-- WEARABLE DEVICE INTEGRATION TABLES
-- ============================================================================
-- Creates the 5 wearable tables that were previously in _ARCHIVE_SKIPPED.
-- Adds tenant_id (missing from originals), proper RLS with tenant isolation,
-- clinician read policies, and metadata JSONB column used by deviceService.
--
-- Tables: wearable_connections, wearable_vital_signs, wearable_activity_data,
--         wearable_fall_detections, wearable_gait_analysis
--
-- Source: G-5 system gap (docs/trackers/system-gaps-tracker.md)
-- ============================================================================

-- ============================================================================
-- 1. WEARABLE DEVICE CONNECTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.wearable_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),

    -- Device Information
    device_type TEXT NOT NULL CHECK (device_type IN (
        'apple_watch', 'fitbit', 'garmin', 'samsung_health',
        'withings', 'ihealth', 'empatica', 'other'
    )),
    device_model TEXT,
    device_id TEXT,

    -- Connection Status
    connected BOOLEAN DEFAULT true,
    last_sync TIMESTAMPTZ DEFAULT now(),
    sync_frequency_minutes INTEGER DEFAULT 15,

    -- Permissions
    permissions_granted TEXT[],

    -- Integration Details (OAuth tokens — encrypted at rest by Supabase)
    api_token TEXT,
    refresh_token TEXT,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(user_id, device_type)
);

CREATE INDEX IF NOT EXISTS idx_wearable_connections_user ON public.wearable_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_wearable_connections_tenant ON public.wearable_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wearable_connections_connected ON public.wearable_connections(connected) WHERE connected = true;

-- ============================================================================
-- 2. WEARABLE VITAL SIGNS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.wearable_vital_signs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES public.wearable_connections(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),

    -- Vital Type
    vital_type TEXT NOT NULL CHECK (vital_type IN (
        'heart_rate', 'blood_pressure', 'oxygen_saturation',
        'temperature', 'respiratory_rate', 'blood_glucose',
        'weight', 'body_temperature'
    )),

    -- Measurement
    value NUMERIC NOT NULL,
    unit TEXT NOT NULL,
    measured_at TIMESTAMPTZ NOT NULL,

    -- Context
    activity_state TEXT CHECK (activity_state IN ('resting', 'active', 'sleeping')),
    quality_indicator TEXT CHECK (quality_indicator IN ('good', 'fair', 'poor')),

    -- Alerts
    alert_triggered BOOLEAN DEFAULT false,
    alert_type TEXT CHECK (alert_type IN ('high', 'low', 'irregular')),

    -- Extensible metadata (used by deviceService for device-specific fields)
    metadata JSONB DEFAULT '{}',

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wearable_vitals_user ON public.wearable_vital_signs(user_id);
CREATE INDEX IF NOT EXISTS idx_wearable_vitals_tenant ON public.wearable_vital_signs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wearable_vitals_type ON public.wearable_vital_signs(vital_type);
CREATE INDEX IF NOT EXISTS idx_wearable_vitals_measured ON public.wearable_vital_signs(measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_wearable_vitals_alert ON public.wearable_vital_signs(alert_triggered) WHERE alert_triggered = true;

-- ============================================================================
-- 3. WEARABLE ACTIVITY DATA
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.wearable_activity_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES public.wearable_connections(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),

    -- Date of Activity
    date DATE NOT NULL,

    -- Activity Metrics
    steps INTEGER,
    distance_meters NUMERIC,
    active_minutes INTEGER,
    calories_burned INTEGER,
    floors_climbed INTEGER,

    -- Sleep Data
    sleep_minutes INTEGER,
    deep_sleep_minutes INTEGER,
    rem_sleep_minutes INTEGER,
    sleep_quality_score INTEGER CHECK (sleep_quality_score BETWEEN 0 AND 100),

    -- Sedentary Behavior
    sedentary_minutes INTEGER,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(user_id, device_id, date)
);

CREATE INDEX IF NOT EXISTS idx_wearable_activity_user ON public.wearable_activity_data(user_id);
CREATE INDEX IF NOT EXISTS idx_wearable_activity_tenant ON public.wearable_activity_data(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wearable_activity_date ON public.wearable_activity_data(date DESC);

-- ============================================================================
-- 4. WEARABLE FALL DETECTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.wearable_fall_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES public.wearable_connections(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),

    -- Fall Event
    detected_at TIMESTAMPTZ NOT NULL,
    fall_severity TEXT CHECK (fall_severity IN ('low', 'medium', 'high')),

    -- Location (if GPS available)
    latitude NUMERIC,
    longitude NUMERIC,
    location_accuracy_meters NUMERIC,

    -- Response
    user_responded BOOLEAN DEFAULT false,
    user_response_time_seconds INTEGER,
    emergency_contact_notified BOOLEAN DEFAULT false,
    ems_dispatched BOOLEAN DEFAULT false,

    -- Outcome
    injury_reported BOOLEAN,
    hospital_transport BOOLEAN,

    -- Clinical Follow-up
    clinical_assessment_id UUID,
    follow_up_completed BOOLEAN DEFAULT false,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wearable_falls_user ON public.wearable_fall_detections(user_id);
CREATE INDEX IF NOT EXISTS idx_wearable_falls_tenant ON public.wearable_fall_detections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wearable_falls_detected ON public.wearable_fall_detections(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_wearable_falls_not_responded ON public.wearable_fall_detections(user_responded) WHERE user_responded = false;

-- ============================================================================
-- 5. WEARABLE GAIT ANALYSIS (Parkinson's / Neurological Monitoring)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.wearable_gait_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES public.wearable_connections(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),

    -- Recording Details
    recorded_at TIMESTAMPTZ NOT NULL,
    duration_seconds INTEGER NOT NULL,

    -- Gait Metrics
    step_count INTEGER,
    cadence INTEGER,
    stride_length_cm NUMERIC,
    gait_speed_m_per_s NUMERIC,
    double_support_time_percent NUMERIC,
    gait_variability_score NUMERIC,

    -- Balance Metrics
    postural_sway_mm NUMERIC,
    balance_confidence_score INTEGER CHECK (balance_confidence_score BETWEEN 0 AND 100),

    -- Tremor Detection (accelerometer-based)
    tremor_detected BOOLEAN,
    tremor_frequency_hz NUMERIC,
    tremor_amplitude NUMERIC,

    -- Clinical Correlation
    freezing_of_gait_episodes INTEGER,
    medication_state TEXT CHECK (medication_state IN ('on', 'off', 'wearing_off')),

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wearable_gait_user ON public.wearable_gait_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_wearable_gait_tenant ON public.wearable_gait_analysis(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wearable_gait_recorded ON public.wearable_gait_analysis(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_wearable_gait_tremor ON public.wearable_gait_analysis(tremor_detected) WHERE tremor_detected = true;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.wearable_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wearable_vital_signs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wearable_activity_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wearable_fall_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wearable_gait_analysis ENABLE ROW LEVEL SECURITY;

-- User owns their own wearable data (tenant-scoped)
DROP POLICY IF EXISTS "wearable_connections_user" ON public.wearable_connections;
CREATE POLICY "wearable_connections_user" ON public.wearable_connections
    FOR ALL USING (user_id = auth.uid() AND tenant_id = get_current_tenant_id())
    WITH CHECK (user_id = auth.uid() AND tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "wearable_vitals_user" ON public.wearable_vital_signs;
CREATE POLICY "wearable_vitals_user" ON public.wearable_vital_signs
    FOR ALL USING (user_id = auth.uid() AND tenant_id = get_current_tenant_id())
    WITH CHECK (user_id = auth.uid() AND tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "wearable_activity_user" ON public.wearable_activity_data;
CREATE POLICY "wearable_activity_user" ON public.wearable_activity_data
    FOR ALL USING (user_id = auth.uid() AND tenant_id = get_current_tenant_id())
    WITH CHECK (user_id = auth.uid() AND tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "wearable_falls_user" ON public.wearable_fall_detections;
CREATE POLICY "wearable_falls_user" ON public.wearable_fall_detections
    FOR ALL USING (user_id = auth.uid() AND tenant_id = get_current_tenant_id())
    WITH CHECK (user_id = auth.uid() AND tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "wearable_gait_user" ON public.wearable_gait_analysis;
CREATE POLICY "wearable_gait_user" ON public.wearable_gait_analysis
    FOR ALL USING (user_id = auth.uid() AND tenant_id = get_current_tenant_id())
    WITH CHECK (user_id = auth.uid() AND tenant_id = get_current_tenant_id());

-- Clinicians can READ wearable data for patients in their tenant
DROP POLICY IF EXISTS "wearable_connections_clinician_read" ON public.wearable_connections;
CREATE POLICY "wearable_connections_clinician_read" ON public.wearable_connections
    FOR SELECT USING (
        tenant_id = get_current_tenant_id()
        AND EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
              AND p.is_admin = true
              AND p.tenant_id = wearable_connections.tenant_id
        )
    );

DROP POLICY IF EXISTS "wearable_vitals_clinician_read" ON public.wearable_vital_signs;
CREATE POLICY "wearable_vitals_clinician_read" ON public.wearable_vital_signs
    FOR SELECT USING (
        tenant_id = get_current_tenant_id()
        AND EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
              AND p.is_admin = true
              AND p.tenant_id = wearable_vital_signs.tenant_id
        )
    );

DROP POLICY IF EXISTS "wearable_activity_clinician_read" ON public.wearable_activity_data;
CREATE POLICY "wearable_activity_clinician_read" ON public.wearable_activity_data
    FOR SELECT USING (
        tenant_id = get_current_tenant_id()
        AND EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
              AND p.is_admin = true
              AND p.tenant_id = wearable_activity_data.tenant_id
        )
    );

DROP POLICY IF EXISTS "wearable_falls_clinician_read" ON public.wearable_fall_detections;
CREATE POLICY "wearable_falls_clinician_read" ON public.wearable_fall_detections
    FOR SELECT USING (
        tenant_id = get_current_tenant_id()
        AND EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
              AND p.is_admin = true
              AND p.tenant_id = wearable_fall_detections.tenant_id
        )
    );

DROP POLICY IF EXISTS "wearable_gait_clinician_read" ON public.wearable_gait_analysis;
CREATE POLICY "wearable_gait_clinician_read" ON public.wearable_gait_analysis
    FOR SELECT USING (
        tenant_id = get_current_tenant_id()
        AND EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
              AND p.is_admin = true
              AND p.tenant_id = wearable_gait_analysis.tenant_id
        )
    );

-- ============================================================================
-- COMMENTS
-- ============================================================================

-- Add metadata column if table pre-existed without it
ALTER TABLE public.wearable_vital_signs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

COMMENT ON TABLE public.wearable_connections IS 'Wearable device connections (Apple Watch, Fitbit, Garmin, Withings, iHealth, etc.)';
COMMENT ON TABLE public.wearable_vital_signs IS 'Vital sign measurements from wearable devices with alert detection';
COMMENT ON TABLE public.wearable_activity_data IS 'Daily activity summary (steps, sleep, calories) from wearables';
COMMENT ON TABLE public.wearable_fall_detections IS 'Fall detection events from wearables with emergency response tracking';
COMMENT ON TABLE public.wearable_gait_analysis IS 'Gait and tremor analysis for Parkinson''s and neurological monitoring';
