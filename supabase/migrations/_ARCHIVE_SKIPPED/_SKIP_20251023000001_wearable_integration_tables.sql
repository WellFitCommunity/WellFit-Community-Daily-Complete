-- =====================================================
-- WEARABLE DEVICE INTEGRATION TABLES
-- =====================================================
-- Apple Watch, Fitbit, Garmin Integration
-- Fall Detection, Vitals Monitoring, Activity Tracking
-- =====================================================

-- =====================================================
-- 1. WEARABLE DEVICE CONNECTIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS wearable_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Device Information
    device_type TEXT NOT NULL CHECK (device_type IN (
        'apple_watch',
        'fitbit',
        'garmin',
        'samsung_health',
        'withings',
        'empatica',
        'other'
    )),
    device_model TEXT,
    device_id TEXT, -- Unique device identifier from manufacturer

    -- Connection Status
    connected BOOLEAN DEFAULT true,
    last_sync TIMESTAMP WITH TIME ZONE DEFAULT now(),
    sync_frequency_minutes INTEGER DEFAULT 15,

    -- Permissions
    permissions_granted TEXT[], -- e.g., ['heart_rate', 'steps', 'fall_detection', 'sleep']

    -- Integration Details
    api_token TEXT, -- Encrypted OAuth token
    refresh_token TEXT, -- Encrypted refresh token

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    UNIQUE(user_id, device_type)
);

CREATE INDEX idx_wearable_connections_user ON wearable_connections(user_id);
CREATE INDEX idx_wearable_connections_connected ON wearable_connections(connected) WHERE connected = true;

-- =====================================================
-- 2. WEARABLE VITAL SIGNS
-- =====================================================

CREATE TABLE IF NOT EXISTS wearable_vital_signs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES wearable_connections(id) ON DELETE CASCADE,

    -- Vital Type
    vital_type TEXT NOT NULL CHECK (vital_type IN (
        'heart_rate',
        'blood_pressure',
        'oxygen_saturation',
        'temperature',
        'respiratory_rate'
    )),

    -- Measurement
    value NUMERIC NOT NULL,
    unit TEXT NOT NULL, -- bpm, mmHg, %, F, breaths/min
    measured_at TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Context
    activity_state TEXT CHECK (activity_state IN ('resting', 'active', 'sleeping')),
    quality_indicator TEXT CHECK (quality_indicator IN ('good', 'fair', 'poor')),

    -- Alerts
    alert_triggered BOOLEAN DEFAULT false,
    alert_type TEXT CHECK (alert_type IN ('high', 'low', 'irregular')),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_wearable_vitals_user ON wearable_vital_signs(user_id);
CREATE INDEX idx_wearable_vitals_type ON wearable_vital_signs(vital_type);
CREATE INDEX idx_wearable_vitals_measured ON wearable_vital_signs(measured_at DESC);
CREATE INDEX idx_wearable_vitals_alert ON wearable_vital_signs(alert_triggered) WHERE alert_triggered = true;

-- =====================================================
-- 3. WEARABLE ACTIVITY DATA
-- =====================================================

CREATE TABLE IF NOT EXISTS wearable_activity_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES wearable_connections(id) ON DELETE CASCADE,

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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    UNIQUE(user_id, device_id, date)
);

CREATE INDEX idx_wearable_activity_user ON wearable_activity_data(user_id);
CREATE INDEX idx_wearable_activity_date ON wearable_activity_data(date DESC);

-- =====================================================
-- 4. WEARABLE FALL DETECTIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS wearable_fall_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES wearable_connections(id) ON DELETE CASCADE,

    -- Fall Event
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
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
    clinical_assessment_id UUID, -- Link to clinical assessment if fall led to injury
    follow_up_completed BOOLEAN DEFAULT false,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_wearable_falls_user ON wearable_fall_detections(user_id);
CREATE INDEX idx_wearable_falls_detected ON wearable_fall_detections(detected_at DESC);
CREATE INDEX idx_wearable_falls_not_responded ON wearable_fall_detections(user_responded) WHERE user_responded = false;

-- =====================================================
-- 5. WEARABLE GAIT ANALYSIS (Advanced - Parkinson's)
-- =====================================================

CREATE TABLE IF NOT EXISTS wearable_gait_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES wearable_connections(id) ON DELETE CASCADE,

    -- Recording Details
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_seconds INTEGER NOT NULL,

    -- Gait Metrics
    step_count INTEGER,
    cadence INTEGER, -- Steps per minute
    stride_length_cm NUMERIC,
    gait_speed_m_per_s NUMERIC,
    double_support_time_percent NUMERIC, -- % of gait cycle with both feet on ground
    gait_variability_score NUMERIC, -- Higher = more variable = worse

    -- Balance Metrics
    postural_sway_mm NUMERIC,
    balance_confidence_score INTEGER CHECK (balance_confidence_score BETWEEN 0 AND 100),

    -- Tremor Detection (accelerometer-based)
    tremor_detected BOOLEAN,
    tremor_frequency_hz NUMERIC,
    tremor_amplitude NUMERIC,

    -- Clinical Correlation
    freezing_of_gait_episodes INTEGER, -- FOG episodes during recording
    medication_state TEXT CHECK (medication_state IN ('on', 'off', 'wearing_off')),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_wearable_gait_user ON wearable_gait_analysis(user_id);
CREATE INDEX idx_wearable_gait_recorded ON wearable_gait_analysis(recorded_at DESC);
CREATE INDEX idx_wearable_gait_tremor ON wearable_gait_analysis(tremor_detected) WHERE tremor_detected = true;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE wearable_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE wearable_vital_signs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wearable_activity_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE wearable_fall_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE wearable_gait_analysis ENABLE ROW LEVEL SECURITY;

-- Users can only see their own wearable data
CREATE POLICY wearable_connections_user_policy ON wearable_connections
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY wearable_vitals_user_policy ON wearable_vital_signs
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY wearable_activity_user_policy ON wearable_activity_data
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY wearable_falls_user_policy ON wearable_fall_detections
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY wearable_gait_user_policy ON wearable_gait_analysis
    FOR ALL USING (user_id = auth.uid());

-- Healthcare providers can view patient wearable data if they have care relationship
CREATE POLICY wearable_vitals_provider_policy ON wearable_vital_signs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM encounters e
            WHERE e.patient_id = wearable_vital_signs.user_id
              AND e.provider_id = auth.uid()
        )
    );

CREATE POLICY wearable_falls_provider_policy ON wearable_fall_detections
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM encounters e
            WHERE e.patient_id = wearable_fall_detections.user_id
              AND e.provider_id = auth.uid()
        )
    );

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE wearable_connections IS 'Stores connections to wearable devices (Apple Watch, Fitbit, Garmin, etc.)';
COMMENT ON TABLE wearable_vital_signs IS 'Vital sign measurements from wearable devices with alert detection';
COMMENT ON TABLE wearable_activity_data IS 'Daily activity summary data (steps, sleep, calories) from wearables';
COMMENT ON TABLE wearable_fall_detections IS 'Fall detection events from wearables with emergency response tracking';
COMMENT ON TABLE wearable_gait_analysis IS 'Advanced gait and tremor analysis for Parkinson''s and neurological monitoring';
