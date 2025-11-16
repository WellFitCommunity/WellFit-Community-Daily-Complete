-- Mobile App Integration Tables
-- Integrates mobile companion app data with existing WellFit Community system

-- Location and Geofencing Data
CREATE TABLE public.patient_locations (
    id BIGSERIAL PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION, -- GPS accuracy in meters
    altitude DOUBLE PRECISION,
    speed DOUBLE PRECISION, -- speed in m/s
    heading DOUBLE PRECISION, -- direction in degrees
    location_source TEXT DEFAULT 'gps', -- gps, network, passive
    is_significant_change BOOLEAN DEFAULT false, -- significant location change
    battery_level INTEGER, -- device battery level when recorded
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Geofence Zones Configuration
CREATE TABLE public.geofence_zones (
    id BIGSERIAL PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    zone_name TEXT NOT NULL,
    zone_type TEXT DEFAULT 'safe_zone', -- safe_zone, restricted_zone, alert_zone
    center_latitude DOUBLE PRECISION NOT NULL,
    center_longitude DOUBLE PRECISION NOT NULL,
    radius_meters DOUBLE PRECISION NOT NULL,
    is_active BOOLEAN DEFAULT true,
    notification_enabled BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Geofence Events (breaches, entries, exits)
CREATE TABLE public.geofence_events (
    id BIGSERIAL PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    geofence_zone_id BIGINT REFERENCES public.geofence_zones(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- enter, exit, breach, dwell
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    distance_from_center DOUBLE PRECISION, -- meters from zone center
    duration_seconds INTEGER, -- for dwell events
    trigger_accuracy DOUBLE PRECISION,
    notification_sent BOOLEAN DEFAULT false,
    emergency_alert_triggered BOOLEAN DEFAULT false,
    occurred_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mobile Health Measurements (continuous monitoring)
CREATE TABLE public.mobile_vitals (
    id BIGSERIAL PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    measurement_type TEXT NOT NULL, -- heart_rate, spo2, blood_pressure, activity_level
    value_primary DOUBLE PRECISION NOT NULL, -- main measurement value
    value_secondary DOUBLE PRECISION, -- for BP diastolic, etc.
    unit TEXT NOT NULL, -- bpm, %, mmHg, steps, etc.
    measurement_method TEXT, -- camera_ppg, sensor, manual, estimated
    device_info JSONB, -- device model, app version, sensor details
    measurement_quality TEXT, -- excellent, good, fair, poor
    confidence_score INTEGER, -- 0-100 confidence in measurement
    environmental_factors JSONB, -- lighting, movement, etc.
    measured_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Emergency Incidents from Mobile App
CREATE TABLE public.mobile_emergency_incidents (
    id BIGSERIAL PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    incident_type TEXT NOT NULL, -- geofence_breach, health_alert, manual_emergency, fall_detected, no_movement
    severity TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, critical
    auto_detected BOOLEAN DEFAULT false, -- vs manually triggered
    location_latitude DOUBLE PRECISION,
    location_longitude DOUBLE PRECISION,
    location_accuracy DOUBLE PRECISION,
    vital_signs JSONB, -- snapshot of vitals at time of incident
    description TEXT,

    -- Response tracking
    notification_sent_at TIMESTAMPTZ,
    emergency_contacts_notified INTEGER DEFAULT 0,
    first_responder_alerted BOOLEAN DEFAULT false,
    incident_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    resolution_notes TEXT,

    -- System tracking
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mobile Device and App Status
CREATE TABLE public.mobile_devices (
    id BIGSERIAL PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id TEXT UNIQUE NOT NULL, -- unique device identifier
    device_name TEXT, -- user-friendly device name
    device_model TEXT,
    os_version TEXT,
    app_version TEXT,
    push_token TEXT, -- for notifications

    -- Feature capabilities
    has_gps BOOLEAN DEFAULT true,
    has_camera BOOLEAN DEFAULT true,
    has_accelerometer BOOLEAN DEFAULT false,

    -- Status tracking
    last_active_at TIMESTAMPTZ,
    battery_level INTEGER,
    is_charging BOOLEAN,
    network_type TEXT, -- wifi, cellular, offline
    location_permission_granted BOOLEAN DEFAULT false,
    camera_permission_granted BOOLEAN DEFAULT false,
    notification_permission_granted BOOLEAN DEFAULT false,

    registered_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity and Movement Patterns
CREATE TABLE public.movement_patterns (
    id BIGSERIAL PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date_tracked DATE NOT NULL,

    -- Daily aggregates
    total_distance_meters DOUBLE PRECISION DEFAULT 0,
    active_time_minutes INTEGER DEFAULT 0,
    sedentary_time_minutes INTEGER DEFAULT 0,
    locations_visited INTEGER DEFAULT 0,
    max_distance_from_home DOUBLE PRECISION DEFAULT 0,

    -- Movement analysis
    movement_regularity_score INTEGER, -- 0-100, consistency of daily patterns
    unusual_activity_detected BOOLEAN DEFAULT false,
    activity_level TEXT, -- very_low, low, normal, high, very_high

    -- Hourly breakdown
    hourly_activity JSONB, -- 24-hour activity breakdown

    -- Risk indicators
    confined_to_home BOOLEAN DEFAULT false,
    wandering_detected BOOLEAN DEFAULT false,
    irregular_sleep_pattern BOOLEAN DEFAULT false,

    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(patient_id, date_tracked)
);

-- Mobile App Emergency Contacts
CREATE TABLE public.mobile_emergency_contacts (
    id BIGSERIAL PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_name TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    contact_email TEXT,
    relationship TEXT, -- spouse, child, caregiver, doctor, facility
    priority_order INTEGER DEFAULT 1, -- notification order

    -- Contact preferences
    call_enabled BOOLEAN DEFAULT true,
    sms_enabled BOOLEAN DEFAULT true,
    email_enabled BOOLEAN DEFAULT false,

    -- Response tracking
    last_contacted_at TIMESTAMPTZ,
    total_notifications_sent INTEGER DEFAULT 0,
    average_response_time_minutes INTEGER,

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mobile Data Sync Status (for offline capability)
CREATE TABLE public.mobile_sync_status (
    id BIGSERIAL PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    data_type TEXT NOT NULL, -- locations, vitals, incidents, contacts

    last_sync_at TIMESTAMPTZ,
    pending_upload_count INTEGER DEFAULT 0,
    last_successful_upload TIMESTAMPTZ,
    sync_errors JSONB, -- error details

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(patient_id, device_id, data_type)
);

-- Indexes for performance
CREATE INDEX idx_patient_locations_patient_time ON public.patient_locations(patient_id, recorded_at DESC);
CREATE INDEX idx_patient_locations_coords ON public.patient_locations(latitude, longitude);
CREATE INDEX idx_geofence_events_patient_time ON public.geofence_events(patient_id, occurred_at DESC);
CREATE INDEX idx_mobile_vitals_patient_time ON public.mobile_vitals(patient_id, measured_at DESC);
CREATE INDEX idx_mobile_vitals_type ON public.mobile_vitals(measurement_type);
CREATE INDEX idx_emergency_incidents_patient_time ON public.mobile_emergency_incidents(patient_id, triggered_at DESC);
CREATE INDEX idx_movement_patterns_patient_date ON public.movement_patterns(patient_id, date_tracked DESC);

-- Row Level Security (RLS) Policies
ALTER TABLE public.patient_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofence_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofence_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_emergency_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movement_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_sync_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data
CREATE POLICY "Users can view own location data" ON public.patient_locations
    FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "Users can insert own location data" ON public.patient_locations
    FOR INSERT WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Users can view own geofence zones" ON public.geofence_zones
    FOR ALL USING (auth.uid() = patient_id);

CREATE POLICY "Users can view own geofence events" ON public.geofence_events
    FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "Users can insert own geofence events" ON public.geofence_events
    FOR INSERT WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Users can view own mobile vitals" ON public.mobile_vitals
    FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "Users can insert own mobile vitals" ON public.mobile_vitals
    FOR INSERT WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Users can view own emergency incidents" ON public.mobile_emergency_incidents
    FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "Users can insert own emergency incidents" ON public.mobile_emergency_incidents
    FOR INSERT WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Users can manage own devices" ON public.mobile_devices
    FOR ALL USING (auth.uid() = patient_id);

CREATE POLICY "Users can view own movement patterns" ON public.movement_patterns
    FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "Users can insert own movement patterns" ON public.movement_patterns
    FOR INSERT WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Users can manage own emergency contacts" ON public.mobile_emergency_contacts
    FOR ALL USING (auth.uid() = patient_id);

CREATE POLICY "Users can manage own sync status" ON public.mobile_sync_status
    FOR ALL USING (auth.uid() = patient_id);

-- Admin/Caregiver policies (can view patients they're authorized for)
CREATE POLICY "Admins can view all location data" ON public.patient_locations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid()
            AND role_code IN (1, 2, 3, 12) -- admin, super_admin, moderator, contractor_nurse
        )
    );

CREATE POLICY "Admins can view all mobile vitals" ON public.mobile_vitals
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid()
            AND role_code IN (1, 2, 3, 12)
        )
    );

CREATE POLICY "Admins can view all emergency incidents" ON public.mobile_emergency_incidents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid()
            AND role_code IN (1, 2, 3, 12)
        )
    );

-- Comments for documentation
COMMENT ON TABLE public.patient_locations IS 'GPS location history from mobile companion app';
COMMENT ON TABLE public.geofence_zones IS 'Safe zone configurations for patients';
COMMENT ON TABLE public.geofence_events IS 'Geofence breach/entry/exit events';
COMMENT ON TABLE public.mobile_vitals IS 'Health measurements from mobile app camera/sensors';
COMMENT ON TABLE public.mobile_emergency_incidents IS 'Emergency situations detected or triggered via mobile app';
COMMENT ON TABLE public.mobile_devices IS 'Mobile device registration and status tracking';
COMMENT ON TABLE public.movement_patterns IS 'Daily movement and activity pattern analysis';
COMMENT ON TABLE public.mobile_emergency_contacts IS 'Emergency contacts specific to mobile app notifications';
COMMENT ON TABLE public.mobile_sync_status IS 'Tracks data synchronization between mobile app and server';