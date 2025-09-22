-- Views and Functions for Mobile Data Integration
-- Connects mobile companion app data with existing WellFit Community analytics

-- Comprehensive Patient Health View (combines web + mobile data)
CREATE OR REPLACE VIEW patient_health_overview AS
SELECT
    p.user_id,
    p.first_name,
    p.last_name,
    p.role,
    p.role_code,

    -- Latest web check-in data
    ci.created_at as last_web_checkin,
    ci.mood as latest_mood,
    ci.activity_level as web_activity_level,
    ci.heart_rate as web_heart_rate,
    ci.pulse_oximeter as web_pulse_ox,
    ci.bp_systolic,
    ci.bp_diastolic,

    -- Latest mobile vitals
    mv.measured_at as last_mobile_vitals,
    mv.value_primary as mobile_heart_rate,
    mv.confidence_score as mobile_measurement_confidence,

    -- Location status
    pl.recorded_at as last_location_update,
    pl.latitude as current_latitude,
    pl.longitude as current_longitude,

    -- Device status
    md.last_active_at as device_last_active,
    md.battery_level as device_battery,

    -- Risk indicators
    CASE
        WHEN pl.recorded_at < NOW() - INTERVAL '4 hours' THEN 'LOCATION_STALE'
        WHEN mv.measured_at < NOW() - INTERVAL '24 hours' THEN 'VITALS_STALE'
        WHEN md.battery_level < 20 THEN 'LOW_BATTERY'
        ELSE 'NORMAL'
    END as risk_status,

    -- Emergency alert count (last 24h)
    (SELECT COUNT(*) FROM emergency_alerts ea
     WHERE ea.patient_id = p.user_id
     AND ea.created_at > NOW() - INTERVAL '24 hours'
     AND ea.resolved = false) as active_alerts

FROM profiles p
LEFT JOIN LATERAL (
    SELECT * FROM check_ins
    WHERE user_id = p.user_id
    ORDER BY created_at DESC
    LIMIT 1
) ci ON true
LEFT JOIN LATERAL (
    SELECT * FROM mobile_vitals
    WHERE patient_id = p.user_id
    AND measurement_type = 'heart_rate'
    ORDER BY measured_at DESC
    LIMIT 1
) mv ON true
LEFT JOIN LATERAL (
    SELECT * FROM patient_locations
    WHERE patient_id = p.user_id
    ORDER BY recorded_at DESC
    LIMIT 1
) pl ON true
LEFT JOIN LATERAL (
    SELECT * FROM mobile_devices
    WHERE patient_id = p.user_id
    ORDER BY updated_at DESC
    LIMIT 1
) md ON true
WHERE p.role_code = 4; -- seniors only

-- Daily Activity Summary View
CREATE OR REPLACE VIEW daily_activity_summary AS
SELECT
    patient_id,
    date_tracked,

    -- Movement data
    total_distance_meters,
    active_time_minutes,
    sedentary_time_minutes,
    locations_visited,

    -- Health data from same day
    (SELECT COUNT(*) FROM mobile_vitals mv
     WHERE mv.patient_id = mp.patient_id
     AND DATE(mv.measured_at) = mp.date_tracked) as vitals_recorded,

    (SELECT AVG(value_primary) FROM mobile_vitals mv
     WHERE mv.patient_id = mp.patient_id
     AND DATE(mv.measured_at) = mp.date_tracked
     AND measurement_type = 'heart_rate') as avg_heart_rate,

    -- Web app data from same day
    (SELECT COUNT(*) FROM check_ins ci
     WHERE ci.user_id = mp.patient_id
     AND DATE(ci.created_at) = mp.date_tracked) as web_checkins,

    -- Risk indicators
    movement_regularity_score,
    unusual_activity_detected,
    wandering_detected,

    -- Combined risk score (0-100)
    CASE
        WHEN wandering_detected THEN 90
        WHEN unusual_activity_detected THEN 70
        WHEN movement_regularity_score < 30 THEN 60
        WHEN active_time_minutes < 30 THEN 50
        ELSE movement_regularity_score
    END as daily_risk_score

FROM movement_patterns mp;

-- Emergency Response View
CREATE OR REPLACE VIEW emergency_response_dashboard AS
SELECT
    ei.id,
    ei.patient_id,
    p.first_name,
    p.last_name,
    ei.incident_type,
    ei.severity,
    ei.auto_detected,
    ei.triggered_at,
    ei.incident_resolved,
    ei.resolved_at,

    -- Location context
    ei.location_latitude,
    ei.location_longitude,

    -- Nearest geofence zone
    (SELECT zone_name FROM geofence_zones gz
     WHERE gz.patient_id = ei.patient_id
     AND gz.is_active = true
     ORDER BY SQRT(
         POWER(gz.center_latitude - ei.location_latitude, 2) +
         POWER(gz.center_longitude - ei.location_longitude, 2)
     ) ASC
     LIMIT 1) as nearest_safe_zone,

    -- Response time metrics
    EXTRACT(EPOCH FROM (ei.resolved_at - ei.triggered_at))/60 as response_time_minutes,

    -- Emergency contacts notified
    ei.emergency_contacts_notified,

    -- Related alerts
    (SELECT COUNT(*) FROM emergency_alerts ea
     WHERE ea.patient_id = ei.patient_id
     AND ea.created_at BETWEEN ei.triggered_at - INTERVAL '1 hour'
                           AND ei.triggered_at + INTERVAL '1 hour') as related_alerts

FROM mobile_emergency_incidents ei
JOIN profiles p ON p.user_id = ei.patient_id
ORDER BY ei.triggered_at DESC;

-- Geofence Analysis View
CREATE OR REPLACE VIEW geofence_analytics AS
SELECT
    gz.id as zone_id,
    gz.patient_id,
    gz.zone_name,
    gz.zone_type,
    gz.radius_meters,

    -- Event statistics (last 30 days)
    (SELECT COUNT(*) FROM geofence_events ge
     WHERE ge.geofence_zone_id = gz.id
     AND ge.occurred_at > NOW() - INTERVAL '30 days') as total_events_30d,

    (SELECT COUNT(*) FROM geofence_events ge
     WHERE ge.geofence_zone_id = gz.id
     AND ge.event_type = 'breach'
     AND ge.occurred_at > NOW() - INTERVAL '30 days') as breach_events_30d,

    -- Average time spent in zone per day
    (SELECT AVG(duration_seconds)/60 FROM geofence_events ge
     WHERE ge.geofence_zone_id = gz.id
     AND ge.event_type = 'dwell'
     AND ge.occurred_at > NOW() - INTERVAL '7 days') as avg_dwell_minutes,

    -- Last activity
    (SELECT MAX(occurred_at) FROM geofence_events ge
     WHERE ge.geofence_zone_id = gz.id) as last_activity,

    -- Zone effectiveness score (fewer breaches = higher score)
    CASE
        WHEN (SELECT COUNT(*) FROM geofence_events ge
              WHERE ge.geofence_zone_id = gz.id
              AND ge.event_type = 'breach'
              AND ge.occurred_at > NOW() - INTERVAL '30 days') = 0 THEN 100
        ELSE GREATEST(0, 100 - (SELECT COUNT(*) FROM geofence_events ge
                                WHERE ge.geofence_zone_id = gz.id
                                AND ge.event_type = 'breach'
                                AND ge.occurred_at > NOW() - INTERVAL '30 days') * 10)
    END as effectiveness_score

FROM geofence_zones gz
WHERE gz.is_active = true;

-- Function to generate AI risk assessment from mobile data
CREATE OR REPLACE FUNCTION generate_mobile_risk_assessment(patient_uuid UUID)
RETURNS TABLE (
    risk_level TEXT,
    risk_score INTEGER,
    risk_factors TEXT[],
    recommendations TEXT[]
) AS $$
DECLARE
    location_risk INTEGER := 0;
    vitals_risk INTEGER := 0;
    activity_risk INTEGER := 0;
    device_risk INTEGER := 0;
    total_risk INTEGER;
    factors TEXT[] := '{}';
    recs TEXT[] := '{}';
BEGIN
    -- Analyze location patterns
    SELECT
        CASE
            WHEN MAX(recorded_at) < NOW() - INTERVAL '6 hours' THEN 60
            WHEN COUNT(*) FILTER (WHERE recorded_at > NOW() - INTERVAL '24 hours') < 10 THEN 40
            ELSE 10
        END
    INTO location_risk
    FROM patient_locations
    WHERE patient_id = patient_uuid
    AND recorded_at > NOW() - INTERVAL '24 hours';

    IF location_risk > 30 THEN
        factors := factors || 'Irregular location tracking';
        recs := recs || 'Check device GPS settings and battery';
    END IF;

    -- Analyze vital signs
    SELECT
        CASE
            WHEN AVG(value_primary) > 100 OR AVG(value_primary) < 60 THEN 70
            WHEN AVG(confidence_score) < 60 THEN 40
            WHEN MAX(measured_at) < NOW() - INTERVAL '48 hours' THEN 50
            ELSE 15
        END
    INTO vitals_risk
    FROM mobile_vitals
    WHERE patient_id = patient_uuid
    AND measurement_type = 'heart_rate'
    AND measured_at > NOW() - INTERVAL '7 days';

    IF vitals_risk > 40 THEN
        factors := factors || 'Concerning vital signs pattern';
        recs := recs || 'Schedule medical evaluation';
    END IF;

    -- Analyze activity patterns
    SELECT
        CASE
            WHEN AVG(daily_risk_score) > 70 THEN 60
            WHEN AVG(active_time_minutes) < 30 THEN 45
            WHEN BOOL_OR(wandering_detected) THEN 80
            ELSE 20
        END
    INTO activity_risk
    FROM daily_activity_summary
    WHERE patient_id = patient_uuid
    AND date_tracked > CURRENT_DATE - INTERVAL '7 days';

    IF activity_risk > 50 THEN
        factors := factors || 'Irregular activity patterns';
        recs := recs || 'Increase activity monitoring and support';
    END IF;

    -- Check device connectivity
    SELECT
        CASE
            WHEN MAX(last_active_at) < NOW() - INTERVAL '4 hours' THEN 50
            WHEN AVG(battery_level) < 30 THEN 30
            ELSE 5
        END
    INTO device_risk
    FROM mobile_devices
    WHERE patient_id = patient_uuid;

    IF device_risk > 25 THEN
        factors := factors || 'Device connectivity issues';
        recs := recs || 'Check device settings and charging';
    END IF;

    -- Calculate total risk
    total_risk := location_risk + vitals_risk + activity_risk + device_risk;

    RETURN QUERY SELECT
        CASE
            WHEN total_risk > 150 THEN 'CRITICAL'
            WHEN total_risk > 100 THEN 'HIGH'
            WHEN total_risk > 60 THEN 'MODERATE'
            ELSE 'LOW'
        END,
        LEAST(total_risk, 100),
        factors,
        recs;
END;
$$ LANGUAGE plpgsql;

-- Function to trigger automated analysis
CREATE OR REPLACE FUNCTION update_patient_risk_assessment()
RETURNS TRIGGER AS $$
BEGIN
    -- Update AI risk assessment when new mobile data arrives
    INSERT INTO ai_risk_assessments (
        patient_id,
        risk_level,
        risk_score,
        risk_factors,
        recommendations,
        assessment_version
    )
    SELECT
        NEW.patient_id,
        risk_level,
        risk_score,
        risk_factors,
        recommendations,
        '2.0-mobile'
    FROM generate_mobile_risk_assessment(NEW.patient_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automated analysis
CREATE TRIGGER trigger_vitals_risk_assessment
    AFTER INSERT ON mobile_vitals
    FOR EACH ROW
    EXECUTE FUNCTION update_patient_risk_assessment();

CREATE TRIGGER trigger_emergency_risk_assessment
    AFTER INSERT ON mobile_emergency_incidents
    FOR EACH ROW
    EXECUTE FUNCTION update_patient_risk_assessment();

-- Function for FHIR export enhancement
CREATE OR REPLACE FUNCTION get_mobile_fhir_observations(patient_uuid UUID, since_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days')
RETURNS JSONB AS $$
DECLARE
    observations JSONB := '[]'::JSONB;
    vital_record RECORD;
    location_record RECORD;
BEGIN
    -- Add mobile vital signs as FHIR Observations
    FOR vital_record IN
        SELECT * FROM mobile_vitals
        WHERE patient_id = patient_uuid
        AND measured_at >= since_date
        ORDER BY measured_at DESC
    LOOP
        observations := observations || jsonb_build_object(
            'resourceType', 'Observation',
            'id', 'mobile-vital-' || vital_record.id,
            'status', 'final',
            'category', jsonb_build_array(
                jsonb_build_object(
                    'coding', jsonb_build_array(
                        jsonb_build_object(
                            'system', 'http://terminology.hl7.org/CodeSystem/observation-category',
                            'code', 'vital-signs',
                            'display', 'Vital Signs'
                        )
                    )
                )
            ),
            'code', jsonb_build_object(
                'coding', jsonb_build_array(
                    jsonb_build_object(
                        'system', 'http://loinc.org',
                        'code', CASE vital_record.measurement_type
                            WHEN 'heart_rate' THEN '8867-4'
                            WHEN 'spo2' THEN '2708-6'
                            ELSE '33747-0'
                        END,
                        'display', CASE vital_record.measurement_type
                            WHEN 'heart_rate' THEN 'Heart rate'
                            WHEN 'spo2' THEN 'Oxygen saturation'
                            ELSE 'General observation'
                        END
                    )
                )
            ),
            'subject', jsonb_build_object(
                'reference', 'Patient/' || patient_uuid
            ),
            'effectiveDateTime', vital_record.measured_at,
            'valueQuantity', jsonb_build_object(
                'value', vital_record.value_primary,
                'unit', vital_record.unit,
                'system', 'http://unitsofmeasure.org'
            ),
            'device', jsonb_build_object(
                'display', 'Mobile Companion App - ' || COALESCE(vital_record.measurement_method, 'unknown')
            ),
            'extension', jsonb_build_array(
                jsonb_build_object(
                    'url', 'http://wellfitcommunity.org/fhir/confidence-score',
                    'valueInteger', vital_record.confidence_score
                ),
                jsonb_build_object(
                    'url', 'http://wellfitcommunity.org/fhir/measurement-quality',
                    'valueString', vital_record.measurement_quality
                )
            )
        );
    END LOOP;

    -- Add location data as FHIR Observations
    FOR location_record IN
        SELECT DISTINCT ON (DATE(recorded_at)) *
        FROM patient_locations
        WHERE patient_id = patient_uuid
        AND recorded_at >= since_date
        ORDER BY DATE(recorded_at), recorded_at DESC
    LOOP
        observations := observations || jsonb_build_object(
            'resourceType', 'Observation',
            'id', 'mobile-location-' || location_record.id,
            'status', 'final',
            'category', jsonb_build_array(
                jsonb_build_object(
                    'coding', jsonb_build_array(
                        jsonb_build_object(
                            'system', 'http://terminology.hl7.org/CodeSystem/observation-category',
                            'code', 'survey',
                            'display', 'Survey'
                        )
                    )
                )
            ),
            'code', jsonb_build_object(
                'coding', jsonb_build_array(
                    jsonb_build_object(
                        'system', 'http://wellfitcommunity.org/fhir/codes',
                        'code', 'patient-location',
                        'display', 'Patient Location'
                    )
                )
            ),
            'subject', jsonb_build_object(
                'reference', 'Patient/' || patient_uuid
            ),
            'effectiveDateTime', location_record.recorded_at,
            'component', jsonb_build_array(
                jsonb_build_object(
                    'code', jsonb_build_object(
                        'coding', jsonb_build_array(
                            jsonb_build_object(
                                'system', 'http://wellfitcommunity.org/fhir/codes',
                                'code', 'latitude'
                            )
                        )
                    ),
                    'valueQuantity', jsonb_build_object(
                        'value', location_record.latitude,
                        'unit', 'degrees'
                    )
                ),
                jsonb_build_object(
                    'code', jsonb_build_object(
                        'coding', jsonb_build_array(
                            jsonb_build_object(
                                'system', 'http://wellfitcommunity.org/fhir/codes',
                                'code', 'longitude'
                            )
                        )
                    ),
                    'valueQuantity', jsonb_build_object(
                        'value', location_record.longitude,
                        'unit', 'degrees'
                    )
                )
            )
        );
    END LOOP;

    RETURN observations;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON VIEW patient_health_overview IS 'Unified view combining web app and mobile app health data';
COMMENT ON VIEW daily_activity_summary IS 'Daily summary of patient activity from mobile tracking';
COMMENT ON VIEW emergency_response_dashboard IS 'Emergency incident tracking and response metrics';
COMMENT ON VIEW geofence_analytics IS 'Geofence zone effectiveness and usage analytics';
COMMENT ON FUNCTION generate_mobile_risk_assessment IS 'AI risk assessment incorporating mobile app data';
COMMENT ON FUNCTION get_mobile_fhir_observations IS 'Generate FHIR observations from mobile app data';