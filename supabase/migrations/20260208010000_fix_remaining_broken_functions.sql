-- Fix Remaining Broken Database Functions (Batch 2)
-- Addresses 11 additional function errors found by `supabase db lint`:
--   1. get_appointment_history — p.full_name does not exist
--   2. get_staff_wellness_list — column names don't match view
--   3. calculate_average_blood_pressure — table 'observations' does not exist
--   4. reschedule_appointment — record-to-jsonb cast via check_appointment_availability
--   5. complete_evs_request — status_changed_by is UUID, not text
--   6. create_ncpdp_claim — date_of_birth column does not exist (it's 'dob')
--   7. check_capacity_alerts — 'message' column doesn't exist in guardian_alerts
--   8. compare_config_snapshots — ambiguous config_table reference
--   9. detect_ai_bias_disparities — created_at → predicted_at
--  10. detect_migration_changes — ambiguous record_id reference
--  11. evaluate_conditional_mapping — jsonb ->> jsonb operator error

-- =============================================================================
-- FIX 1: get_appointment_history — p.full_name → first_name || last_name
-- =============================================================================
CREATE OR REPLACE FUNCTION get_appointment_history(
    p_appointment_id UUID
)
RETURNS TABLE (
    id UUID,
    change_type TEXT,
    previous_appointment_time TIMESTAMPTZ,
    new_appointment_time TIMESTAMPTZ,
    previous_duration_minutes INTEGER,
    new_duration_minutes INTEGER,
    previous_status TEXT,
    new_status TEXT,
    change_reason TEXT,
    changed_by UUID,
    changed_by_role TEXT,
    changed_by_name TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verify user has access to this appointment
    IF NOT EXISTS (
        SELECT 1 FROM telehealth_appointments ta
        WHERE ta.id = p_appointment_id
        AND (ta.patient_id = auth.uid() OR ta.provider_id = auth.uid())
    ) THEN
        -- Check if admin
        IF NOT EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
        ) THEN
            RAISE EXCEPTION 'Permission denied';
        END IF;
    END IF;

    RETURN QUERY
    SELECT
        ah.id,
        ah.change_type,
        ah.previous_appointment_time,
        ah.new_appointment_time,
        ah.previous_duration_minutes,
        ah.new_duration_minutes,
        ah.previous_status,
        ah.new_status,
        ah.change_reason,
        ah.changed_by,
        ah.changed_by_role,
        COALESCE(p.first_name || ' ' || p.last_name, 'System') AS changed_by_name,
        ah.created_at
    FROM appointment_history ah
    LEFT JOIN profiles p ON p.user_id = ah.changed_by
    WHERE ah.appointment_id = p_appointment_id
    ORDER BY ah.created_at DESC;
END;
$$;

-- =============================================================================
-- FIX 2: get_staff_wellness_list — view columns vs RETURNS TABLE mismatch
-- The view 'vw_staff_wellness_summary' has 'full_name' (text). The function
-- RETURNS TABLE expects it. But the SELECT aliases don't match perfectly.
-- Fix: ensure column names in SELECT match RETURNS TABLE exactly.
-- =============================================================================
CREATE OR REPLACE FUNCTION get_staff_wellness_list(
    p_organization_id UUID DEFAULT NULL,
    p_department_id UUID DEFAULT NULL,
    p_facility_id UUID DEFAULT NULL,
    p_risk_filter TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    staff_id UUID,
    full_name TEXT,
    title TEXT,
    department_name TEXT,
    burnout_risk_level TEXT,
    compassion_score INTEGER,
    documentation_debt_hours NUMERIC,
    last_break TEXT,
    shift_hours INTEGER,
    patient_count INTEGER,
    mood_trend TEXT,
    user_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sws.staff_id,
    sws.full_name,
    sws.title,
    sws.department_name::TEXT,
    COALESCE(sws.burnout_risk_level, 'unknown')::TEXT AS burnout_risk_level,
    sws.compassion_score,
    sws.estimated_documentation_debt_hours AS documentation_debt_hours,
    sws.estimated_last_break AS last_break,
    sws.shift_hours_worked AS shift_hours,
    sws.current_patient_count AS patient_count,
    COALESCE(sws.mood_trend, 'unknown')::TEXT AS mood_trend,
    sws.user_account_id AS user_id
  FROM vw_staff_wellness_summary sws
  WHERE (p_organization_id IS NULL OR sws.organization_id = p_organization_id)
    AND (p_department_id IS NULL OR sws.primary_department_id = p_department_id)
    AND (p_facility_id IS NULL OR sws.primary_facility_id = p_facility_id)
    AND (
      p_risk_filter IS NULL
      OR (p_risk_filter = 'at_risk' AND sws.burnout_risk_level IN ('high', 'critical'))
      OR sws.burnout_risk_level = p_risk_filter
    )
  ORDER BY
    CASE sws.burnout_risk_level
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'moderate' THEN 3
      WHEN 'low' THEN 4
      ELSE 5
    END,
    sws.compassion_score ASC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- =============================================================================
-- FIX 3: calculate_average_blood_pressure — 'observations' → 'fhir_observations'
-- Also fix column references: effective_date → effective_datetime,
-- context → encounter_id, value->>'systolic' → components-based BP reading
-- =============================================================================
CREATE OR REPLACE FUNCTION calculate_average_blood_pressure(
    p_tenant_id UUID,
    p_patient_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_context VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    avg_systolic NUMERIC,
    avg_diastolic NUMERIC,
    readings_count INTEGER,
    classification VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_systolic DECIMAL(5,1);
  v_diastolic DECIMAL(5,1);
  v_count INTEGER;
  v_class VARCHAR(50);
BEGIN
  -- Calculate averages from fhir_observations table
  -- BP observations use LOINC 85354-9 (panel) with components for systolic/diastolic
  -- or individual observations with 8480-6 (systolic) and 8462-4 (diastolic)
  SELECT
    ROUND(AVG(
      CASE
        WHEN fo.code = '8480-6' THEN fo.value_quantity_value
        WHEN fo.code = '85354-9' THEN (fo.components->0->>'value_quantity_value')::DECIMAL
        ELSE NULL
      END
    ), 1),
    ROUND(AVG(
      CASE
        WHEN fo.code = '8462-4' THEN fo.value_quantity_value
        WHEN fo.code = '85354-9' THEN (fo.components->1->>'value_quantity_value')::DECIMAL
        ELSE NULL
      END
    ), 1),
    COUNT(*)::INTEGER
  INTO v_systolic, v_diastolic, v_count
  FROM fhir_observations fo
  WHERE fo.tenant_id = p_tenant_id
    AND fo.patient_id = p_patient_id
    AND fo.code IN ('85354-9', '8480-6', '8462-4')
    AND fo.effective_datetime::DATE BETWEEN p_start_date AND p_end_date
    AND (p_context IS NULL OR fo.encounter_id::TEXT = p_context);

  -- Classify per ACC/AHA guidelines
  IF v_systolic IS NULL THEN
    v_class := 'insufficient_data';
  ELSIF v_systolic >= 180 OR v_diastolic >= 120 THEN
    v_class := 'hypertensive_crisis';
  ELSIF v_systolic >= 140 OR v_diastolic >= 90 THEN
    v_class := 'hypertension_stage_2';
  ELSIF v_systolic >= 130 OR v_diastolic >= 80 THEN
    v_class := 'hypertension_stage_1';
  ELSIF v_systolic >= 120 THEN
    v_class := 'elevated';
  ELSE
    v_class := 'normal';
  END IF;

  RETURN QUERY SELECT v_systolic, v_diastolic, v_count, v_class;
END;
$$;

-- =============================================================================
-- FIX 4: reschedule_appointment — record-to-jsonb cast issue
-- check_appointment_availability returns TABLE, not a scalar jsonb.
-- Must call it with a SELECT INTO and access fields directly.
-- =============================================================================
CREATE OR REPLACE FUNCTION reschedule_appointment(
    p_appointment_id UUID,
    p_new_appointment_time TIMESTAMPTZ,
    p_new_duration_minutes INTEGER DEFAULT NULL,
    p_change_reason TEXT DEFAULT NULL,
    p_changed_by_role TEXT DEFAULT 'provider'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_appointment RECORD;
    v_conflict RECORD;
    v_new_duration INTEGER;
    v_result JSONB;
BEGIN
    -- 1. Get the current appointment
    SELECT * INTO v_appointment
    FROM telehealth_appointments
    WHERE id = p_appointment_id
    AND status NOT IN ('cancelled', 'completed', 'no-show');

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'APPOINTMENT_NOT_FOUND',
            'message', 'Appointment not found or cannot be rescheduled (already cancelled/completed)'
        );
    END IF;

    -- 2. Verify the user has permission (patient or provider of this appointment)
    IF v_appointment.patient_id != auth.uid() AND v_appointment.provider_id != auth.uid() THEN
        -- Check if user is admin
        IF NOT EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
        ) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'PERMISSION_DENIED',
                'message', 'You do not have permission to reschedule this appointment'
            );
        END IF;
    END IF;

    -- 3. Use new duration or keep existing
    v_new_duration := COALESCE(p_new_duration_minutes, v_appointment.duration_minutes);

    -- 4. Check for conflicts at new time (excluding this appointment)
    -- check_appointment_availability returns TABLE(has_conflict, conflict_count, conflicting_appointments)
    SELECT * INTO v_conflict
    FROM check_appointment_availability(
        v_appointment.provider_id,
        p_new_appointment_time,
        v_new_duration,
        p_appointment_id
    );

    IF v_conflict.has_conflict THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'APPOINTMENT_CONFLICT',
            'message', 'Provider has a conflicting appointment at the requested time',
            'conflicts', v_conflict.conflicting_appointments
        );
    END IF;

    -- 5. Check provider availability at new time
    IF NOT is_provider_available(v_appointment.provider_id, p_new_appointment_time, v_new_duration) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'PROVIDER_UNAVAILABLE',
            'message', 'Provider is not available at the requested time'
        );
    END IF;

    -- 6. Log the change to history BEFORE updating
    INSERT INTO appointment_history (
        appointment_id,
        tenant_id,
        change_type,
        previous_appointment_time,
        previous_duration_minutes,
        previous_status,
        new_appointment_time,
        new_duration_minutes,
        new_status,
        change_reason,
        changed_by,
        changed_by_role
    ) VALUES (
        p_appointment_id,
        v_appointment.tenant_id,
        'rescheduled',
        v_appointment.appointment_time,
        v_appointment.duration_minutes,
        v_appointment.status,
        p_new_appointment_time,
        v_new_duration,
        'scheduled',
        p_change_reason,
        auth.uid(),
        p_changed_by_role
    );

    -- 7. Update the appointment
    UPDATE telehealth_appointments
    SET
        appointment_time = p_new_appointment_time,
        duration_minutes = v_new_duration,
        status = 'scheduled',
        reminder_sent = false,
        notification_sent = false,
        updated_at = NOW()
    WHERE id = p_appointment_id;

    -- 8. Return success with updated appointment details
    SELECT jsonb_build_object(
        'success', true,
        'appointment_id', ta.id,
        'previous_time', v_appointment.appointment_time,
        'new_time', ta.appointment_time,
        'previous_duration', v_appointment.duration_minutes,
        'new_duration', ta.duration_minutes,
        'status', ta.status,
        'provider_id', ta.provider_id,
        'patient_id', ta.patient_id
    ) INTO v_result
    FROM telehealth_appointments ta
    WHERE ta.id = p_appointment_id;

    RETURN v_result;
END;
$$;

-- =============================================================================
-- FIX 5: complete_evs_request — beds.status_changed_by is UUID, not text
-- Remove the ::text cast on COALESCE result
-- =============================================================================
CREATE OR REPLACE FUNCTION complete_evs_request(
    p_request_id UUID,
    p_completed_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
  v_turnaround INTEGER;
  v_actual_duration INTEGER;
BEGIN
  -- Get the request
  SELECT * INTO v_request
  FROM evs_requests
  WHERE id = p_request_id
    AND status IN ('assigned', 'in_progress');

  IF v_request IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Request not found or not in progress'
    );
  END IF;

  -- Calculate durations
  v_turnaround := EXTRACT(EPOCH FROM (now() - v_request.requested_at)) / 60;
  v_actual_duration := CASE
    WHEN v_request.started_at IS NOT NULL THEN
      EXTRACT(EPOCH FROM (now() - v_request.started_at)) / 60
    ELSE v_turnaround
  END;

  -- Update the request
  UPDATE evs_requests
  SET status = 'completed',
      completed_at = now(),
      completed_by = COALESCE(p_completed_by, v_request.assigned_to),
      turnaround_minutes = v_turnaround,
      actual_duration_minutes = v_actual_duration,
      updated_at = now()
  WHERE id = p_request_id;

  -- Update the bed status to 'available'
  -- beds.status_changed_by is UUID, so no ::text cast
  UPDATE beds
  SET status = 'available',
      status_changed_at = now(),
      status_changed_by = COALESCE(p_completed_by, v_request.assigned_to),
      status_notes = 'Cleaned by EVS'
  WHERE id = v_request.bed_id;

  -- Update EVS staff
  IF v_request.assigned_to IS NOT NULL THEN
    UPDATE evs_staff
    SET status = 'available',
        current_request_id = NULL,
        requests_completed_today = requests_completed_today + 1,
        updated_at = now()
    WHERE id = v_request.assigned_to;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'bed_id', v_request.bed_id,
    'turnaround_minutes', v_turnaround,
    'actual_duration_minutes', v_actual_duration
  );
END;
$$;

-- =============================================================================
-- FIX 6: create_ncpdp_claim — profiles.date_of_birth → profiles.dob
-- Also: profiles.id → profiles.user_id for patient lookup
-- =============================================================================
CREATE OR REPLACE FUNCTION create_ncpdp_claim(
    p_patient_id UUID,
    p_prescriber_npi TEXT,
    p_ndc_code TEXT,
    p_quantity NUMERIC,
    p_days_supply INTEGER,
    p_pharmacy_ncpdp TEXT,
    p_date_of_service DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_claim_id UUID;
  v_claim_number TEXT;
  v_patient RECORD;
  v_result JSONB;
BEGIN
  -- Generate claim number
  v_claim_number := generate_ncpdp_claim_number();

  -- Get patient info (profiles uses user_id, not id, and dob not date_of_birth)
  SELECT first_name, last_name, dob
  INTO v_patient
  FROM profiles
  WHERE user_id = p_patient_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Patient not found');
  END IF;

  -- Create claim
  INSERT INTO ncpdp_claims (
    claim_number,
    patient_id,
    patient_first_name,
    patient_last_name,
    patient_dob,
    prescriber_npi,
    prescriber_name,
    service_provider_ncpdp,
    ndc_code,
    drug_name,
    quantity_dispensed,
    days_supply,
    date_of_service,
    claim_status,
    transaction_code
  ) VALUES (
    v_claim_number,
    p_patient_id,
    v_patient.first_name,
    v_patient.last_name,
    v_patient.dob,
    p_prescriber_npi,
    'Provider',
    p_pharmacy_ncpdp,
    p_ndc_code,
    'Drug Name',
    p_quantity,
    p_days_supply,
    p_date_of_service,
    'pending',
    'B1'
  )
  RETURNING id INTO v_claim_id;

  -- Log history
  INSERT INTO ncpdp_claim_history (
    claim_id,
    transaction_type,
    transaction_code,
    claim_status
  ) VALUES (
    v_claim_id,
    'original',
    'B1',
    'pending'
  );

  v_result := jsonb_build_object(
    'success', TRUE,
    'claim_id', v_claim_id,
    'claim_number', v_claim_number,
    'message', 'Claim created successfully'
  );

  RETURN v_result;
END;
$$;

-- =============================================================================
-- FIX 7: check_capacity_alerts — guardian_alerts has 'description' not 'message'
-- Remove 'message' from INSERT, use 'description' instead
-- =============================================================================
CREATE OR REPLACE FUNCTION check_capacity_alerts(
    p_facility_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_facility RECORD;
  v_occupancy_percent NUMERIC;
  v_rule RECORD;
  v_existing_alert_count INTEGER;
  v_alerts_created INTEGER := 0;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- Get facility capacity
  SELECT * INTO v_facility
  FROM facility_capacity_snapshots
  WHERE facility_id = p_facility_id
  ORDER BY snapshot_at DESC
  LIMIT 1;

  IF v_facility IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No capacity data for facility');
  END IF;

  v_occupancy_percent := v_facility.occupancy_percent;

  -- Check each applicable rule
  FOR v_rule IN
    SELECT * FROM capacity_alert_rules
    WHERE tenant_id = v_facility.tenant_id
      AND is_active = true
      AND threshold_type = 'occupancy_percent'
      AND (applies_to_facility_id IS NULL OR applies_to_facility_id = p_facility_id)
    ORDER BY threshold_value DESC
  LOOP
    -- Check if threshold is breached
    IF (v_rule.threshold_operator = '>=' AND v_occupancy_percent >= v_rule.threshold_value)
       OR (v_rule.threshold_operator = '>' AND v_occupancy_percent > v_rule.threshold_value)
    THEN
      -- Check cooldown (no alert in last N minutes)
      SELECT COUNT(*) INTO v_existing_alert_count
      FROM guardian_alerts
      WHERE reference_id = p_facility_id::text
        AND alert_type = v_rule.alert_type
        AND triggered_at > v_now - (v_rule.cooldown_minutes || ' minutes')::interval;

      IF v_existing_alert_count = 0 THEN
        -- Create alert (guardian_alerts uses 'description' not 'message')
        INSERT INTO guardian_alerts (
          tenant_id, alert_type, severity, title, description,
          reference_type, reference_id, status, escalation_level,
          escalation_targets, triggered_at, metadata
        ) VALUES (
          v_facility.tenant_id,
          v_rule.alert_type,
          v_rule.severity,
          v_facility.facility_name || ' at ' || round(v_occupancy_percent, 1) || '% capacity',
          'Capacity threshold breached: ' || v_rule.rule_name,
          'facility',
          p_facility_id::text,
          'active',
          v_rule.escalation_level,
          v_rule.escalation_targets,
          v_now,
          jsonb_build_object(
            'rule_id', v_rule.id,
            'rule_name', v_rule.rule_name,
            'occupancy_percent', v_occupancy_percent,
            'threshold_value', v_rule.threshold_value,
            'available_beds', v_facility.available_beds
          )
        );

        v_alerts_created := v_alerts_created + 1;
      END IF;
    END IF;
  END LOOP;

  -- Auto-resolve alerts if occupancy dropped below lowest threshold
  IF v_occupancy_percent < 70 THEN
    UPDATE guardian_alerts
    SET status = 'resolved',
        resolved_at = v_now,
        resolution_notes = 'Auto-resolved: occupancy dropped to ' || round(v_occupancy_percent, 1) || '%'
    WHERE reference_id = p_facility_id::text
      AND reference_type = 'facility'
      AND alert_type LIKE 'capacity_%'
      AND status = 'active';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'facility_id', p_facility_id,
    'occupancy_percent', v_occupancy_percent,
    'alerts_created', v_alerts_created
  );
END;
$$;

-- =============================================================================
-- FIX 8: compare_config_snapshots — ambiguous config_table/field_name in SELECT
-- The COALESCE in the final SELECT must use the CTE aliases t1/t2
-- =============================================================================
CREATE OR REPLACE FUNCTION compare_config_snapshots(
    p_tenant_id UUID,
    p_timestamp_1 TIMESTAMPTZ,
    p_timestamp_2 TIMESTAMPTZ
)
RETURNS TABLE (
    config_table TEXT,
    field_name TEXT,
    value_at_t1 JSONB,
    value_at_t2 JSONB,
    changed_between BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH t1_values AS (
    SELECT DISTINCT ON (tca.config_table, tca.field_name)
      tca.config_table,
      tca.field_name,
      CASE
        WHEN tca.action = 'DELETE' THEN NULL
        ELSE tca.new_value
      END AS value
    FROM tenant_config_audit tca
    WHERE tca.tenant_id = p_tenant_id
      AND tca.changed_at <= p_timestamp_1
    ORDER BY tca.config_table, tca.field_name, tca.changed_at DESC
  ),
  t2_values AS (
    SELECT DISTINCT ON (tca.config_table, tca.field_name)
      tca.config_table,
      tca.field_name,
      CASE
        WHEN tca.action = 'DELETE' THEN NULL
        ELSE tca.new_value
      END AS value
    FROM tenant_config_audit tca
    WHERE tca.tenant_id = p_tenant_id
      AND tca.changed_at <= p_timestamp_2
    ORDER BY tca.config_table, tca.field_name, tca.changed_at DESC
  )
  SELECT
    COALESCE(t1.config_table, t2.config_table) AS config_table,
    COALESCE(t1.field_name, t2.field_name) AS field_name,
    t1.value AS value_at_t1,
    t2.value AS value_at_t2,
    t1.value IS DISTINCT FROM t2.value AS changed_between
  FROM t1_values t1
  FULL OUTER JOIN t2_values t2
    ON t1.config_table = t2.config_table
    AND t1.field_name = t2.field_name
  WHERE t1.value IS DISTINCT FROM t2.value;
END;
$$;

-- =============================================================================
-- FIX 9: detect_ai_bias_disparities — created_at → predicted_at
-- The ai_predictions table uses predicted_at, not created_at
-- =============================================================================
CREATE OR REPLACE FUNCTION detect_ai_bias_disparities(
    p_skill_name TEXT,
    p_min_sample_size INTEGER DEFAULT 30,
    p_disparity_threshold NUMERIC DEFAULT 0.10
)
RETURNS TABLE (
    demographic_type TEXT,
    demographic_value TEXT,
    accuracy_rate NUMERIC,
    baseline_rate NUMERIC,
    disparity NUMERIC,
    sample_size BIGINT,
    is_significant BOOLEAN,
    alert_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_baseline_rate NUMERIC;
BEGIN
    -- Calculate overall baseline accuracy for this skill
    SELECT
        CASE
            WHEN COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL) > 0
            THEN COUNT(*) FILTER (WHERE ap.is_accurate = true)::NUMERIC /
                 COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL)
            ELSE NULL
        END
    INTO v_baseline_rate
    FROM ai_predictions ap
    WHERE ap.skill_name = p_skill_name
    AND ap.predicted_at > NOW() - INTERVAL '90 days';

    IF v_baseline_rate IS NULL THEN
        RETURN;
    END IF;

    -- Age group disparities
    RETURN QUERY
    SELECT
        'age_group'::TEXT,
        ap.patient_age_group,
        ROUND(
            COUNT(*) FILTER (WHERE ap.is_accurate = true)::NUMERIC /
            NULLIF(COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL), 0) * 100,
            2
        ),
        ROUND(v_baseline_rate * 100, 2),
        ROUND(
            ABS(
                COUNT(*) FILTER (WHERE ap.is_accurate = true)::NUMERIC /
                NULLIF(COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL), 0) - v_baseline_rate
            ) * 100,
            2
        ),
        COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL),
        COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL) >= p_min_sample_size AND
        ABS(
            COUNT(*) FILTER (WHERE ap.is_accurate = true)::NUMERIC /
            NULLIF(COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL), 0) - v_baseline_rate
        ) >= p_disparity_threshold,
        CASE
            WHEN COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL) >= p_min_sample_size AND
                 ABS(
                     COUNT(*) FILTER (WHERE ap.is_accurate = true)::NUMERIC /
                     NULLIF(COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL), 0) - v_baseline_rate
                 ) >= p_disparity_threshold
            THEN 'Significant accuracy disparity detected for age group: ' || ap.patient_age_group
            ELSE NULL
        END
    FROM ai_predictions ap
    WHERE ap.skill_name = p_skill_name
    AND ap.patient_age_group IS NOT NULL
    AND ap.predicted_at > NOW() - INTERVAL '90 days'
    GROUP BY ap.patient_age_group
    HAVING COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL) > 0;

    -- Race disparities
    RETURN QUERY
    SELECT
        'race'::TEXT,
        ap.patient_race,
        ROUND(
            COUNT(*) FILTER (WHERE ap.is_accurate = true)::NUMERIC /
            NULLIF(COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL), 0) * 100,
            2
        ),
        ROUND(v_baseline_rate * 100, 2),
        ROUND(
            ABS(
                COUNT(*) FILTER (WHERE ap.is_accurate = true)::NUMERIC /
                NULLIF(COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL), 0) - v_baseline_rate
            ) * 100,
            2
        ),
        COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL),
        COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL) >= p_min_sample_size AND
        ABS(
            COUNT(*) FILTER (WHERE ap.is_accurate = true)::NUMERIC /
            NULLIF(COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL), 0) - v_baseline_rate
        ) >= p_disparity_threshold,
        CASE
            WHEN COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL) >= p_min_sample_size AND
                 ABS(
                     COUNT(*) FILTER (WHERE ap.is_accurate = true)::NUMERIC /
                     NULLIF(COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL), 0) - v_baseline_rate
                 ) >= p_disparity_threshold
            THEN 'Significant accuracy disparity detected for race: ' || ap.patient_race
            ELSE NULL
        END
    FROM ai_predictions ap
    WHERE ap.skill_name = p_skill_name
    AND ap.patient_race IS NOT NULL
    AND ap.predicted_at > NOW() - INTERVAL '90 days'
    GROUP BY ap.patient_race
    HAVING COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL) > 0;

    -- Payer disparities
    RETURN QUERY
    SELECT
        'payer'::TEXT,
        ap.patient_payer,
        ROUND(
            COUNT(*) FILTER (WHERE ap.is_accurate = true)::NUMERIC /
            NULLIF(COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL), 0) * 100,
            2
        ),
        ROUND(v_baseline_rate * 100, 2),
        ROUND(
            ABS(
                COUNT(*) FILTER (WHERE ap.is_accurate = true)::NUMERIC /
                NULLIF(COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL), 0) - v_baseline_rate
            ) * 100,
            2
        ),
        COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL),
        COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL) >= p_min_sample_size AND
        ABS(
            COUNT(*) FILTER (WHERE ap.is_accurate = true)::NUMERIC /
            NULLIF(COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL), 0) - v_baseline_rate
        ) >= p_disparity_threshold,
        CASE
            WHEN COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL) >= p_min_sample_size AND
                 ABS(
                     COUNT(*) FILTER (WHERE ap.is_accurate = true)::NUMERIC /
                     NULLIF(COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL), 0) - v_baseline_rate
                 ) >= p_disparity_threshold
            THEN 'Significant accuracy disparity detected for payer: ' || ap.patient_payer
            ELSE NULL
        END
    FROM ai_predictions ap
    WHERE ap.skill_name = p_skill_name
    AND ap.patient_payer IS NOT NULL
    AND ap.predicted_at > NOW() - INTERVAL '90 days'
    GROUP BY ap.patient_payer
    HAVING COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL) > 0;

    -- Rurality disparities
    RETURN QUERY
    SELECT
        'rurality'::TEXT,
        ap.patient_rurality,
        ROUND(
            COUNT(*) FILTER (WHERE ap.is_accurate = true)::NUMERIC /
            NULLIF(COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL), 0) * 100,
            2
        ),
        ROUND(v_baseline_rate * 100, 2),
        ROUND(
            ABS(
                COUNT(*) FILTER (WHERE ap.is_accurate = true)::NUMERIC /
                NULLIF(COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL), 0) - v_baseline_rate
            ) * 100,
            2
        ),
        COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL),
        COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL) >= p_min_sample_size AND
        ABS(
            COUNT(*) FILTER (WHERE ap.is_accurate = true)::NUMERIC /
            NULLIF(COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL), 0) - v_baseline_rate
        ) >= p_disparity_threshold,
        CASE
            WHEN COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL) >= p_min_sample_size AND
                 ABS(
                     COUNT(*) FILTER (WHERE ap.is_accurate = true)::NUMERIC /
                     NULLIF(COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL), 0) - v_baseline_rate
                 ) >= p_disparity_threshold
            THEN 'Significant accuracy disparity detected for rurality: ' || ap.patient_rurality
            ELSE NULL
        END
    FROM ai_predictions ap
    WHERE ap.skill_name = p_skill_name
    AND ap.patient_rurality IS NOT NULL
    AND ap.predicted_at > NOW() - INTERVAL '90 days'
    GROUP BY ap.patient_rurality
    HAVING COUNT(*) FILTER (WHERE ap.is_accurate IS NOT NULL) > 0;
END;
$$;

-- =============================================================================
-- FIX 10: detect_migration_changes — ambiguous record_id
-- The RETURNS TABLE has record_id, and the function body assigns to it
-- directly. Must use the out-parameter name with proper scoping.
-- =============================================================================
CREATE OR REPLACE FUNCTION detect_migration_changes(
    p_sync_id UUID,
    p_new_data JSONB
)
RETURNS TABLE (
    change_type TEXT,
    record_id TEXT,
    changed_fields TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sync RECORD;
    v_record JSONB;
    v_existing_hash TEXT;
    v_new_hash TEXT;
    v_record_id TEXT;
BEGIN
    -- Get sync state
    SELECT * INTO v_sync FROM migration_sync_state WHERE sync_id = p_sync_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sync state not found: %', p_sync_id;
    END IF;

    -- Process each record in new data
    FOR v_record IN SELECT * FROM jsonb_array_elements(p_new_data)
    LOOP
        -- Get record ID (assumes 'id' field, could be configurable)
        v_record_id := v_record->>'id';
        IF v_record_id IS NULL THEN
            v_record_id := v_record->>'record_id';
        END IF;

        -- Calculate hash of new record
        v_new_hash := encode(sha256(v_record::text::bytea), 'hex');

        -- Check if record exists in change log
        SELECT mcl.new_values_hash INTO v_existing_hash
        FROM migration_change_log mcl
        WHERE mcl.sync_id = p_sync_id AND mcl.record_id = v_record_id
        ORDER BY mcl.detected_at DESC
        LIMIT 1;

        IF v_existing_hash IS NULL THEN
            -- New record - assign to output columns explicitly
            detect_migration_changes.change_type := 'insert';
            detect_migration_changes.record_id := v_record_id;
            detect_migration_changes.changed_fields := ARRAY(SELECT jsonb_object_keys(v_record));

            INSERT INTO migration_change_log (sync_id, change_type, record_id, new_values_hash)
            VALUES (p_sync_id, 'insert', v_record_id, v_new_hash);

            RETURN NEXT;
        ELSIF v_existing_hash != v_new_hash THEN
            -- Updated record
            detect_migration_changes.change_type := 'update';
            detect_migration_changes.record_id := v_record_id;
            detect_migration_changes.changed_fields := ARRAY(SELECT jsonb_object_keys(v_record));

            INSERT INTO migration_change_log (sync_id, change_type, record_id, old_values_hash, new_values_hash)
            VALUES (p_sync_id, 'update', v_record_id, v_existing_hash, v_new_hash);

            RETURN NEXT;
        END IF;
    END LOOP;
END;
$$;

-- =============================================================================
-- FIX 11: evaluate_conditional_mapping — jsonb ->> jsonb operator error
-- p_record->>v_condition->>'field' is parsed as (p_record >> (v_condition->>'field'))
-- but the inner expression returns jsonb, not text. Extract field name first.
-- =============================================================================
CREATE OR REPLACE FUNCTION evaluate_conditional_mapping(
    p_source_column TEXT,
    p_record JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_mapping RECORD;
    v_condition JSONB;
    v_field_name TEXT;
    v_field_value TEXT;
    v_matches BOOLEAN;
BEGIN
    -- Iterate through mappings in priority order
    FOR v_mapping IN
        SELECT * FROM migration_conditional_mappings
        WHERE source_column = p_source_column
          AND is_active = true
        ORDER BY priority ASC
    LOOP
        v_condition := v_mapping.condition;
        -- Extract field name as text FIRST, then use it to index p_record
        v_field_name := v_condition->>'field';
        v_field_value := p_record->>v_field_name;
        v_matches := false;

        -- Evaluate condition based on type
        CASE v_condition->>'type'
            WHEN 'value_equals' THEN
                v_matches := v_field_value = v_condition->>'value';

            WHEN 'value_in' THEN
                v_matches := v_field_value = ANY(ARRAY(SELECT jsonb_array_elements_text(v_condition->'values')));

            WHEN 'value_matches' THEN
                v_matches := v_field_value ~ (v_condition->>'pattern');

            WHEN 'value_not_matches' THEN
                v_matches := NOT (v_field_value ~ (v_condition->>'pattern'));

            WHEN 'value_range' THEN
                v_matches := (
                    (v_condition->>'min' IS NULL OR v_field_value::NUMERIC >= (v_condition->>'min')::NUMERIC)
                    AND
                    (v_condition->>'max' IS NULL OR v_field_value::NUMERIC <= (v_condition->>'max')::NUMERIC)
                );

            WHEN 'value_null' THEN
                v_matches := v_field_value IS NULL;

            WHEN 'value_not_null' THEN
                v_matches := v_field_value IS NOT NULL;

            ELSE
                v_matches := false;
        END CASE;

        -- Return first matching action
        IF v_matches THEN
            RETURN jsonb_build_object(
                'matched', true,
                'mapping_id', v_mapping.mapping_id,
                'action_type', v_mapping.action_type,
                'action_config', v_mapping.action_config,
                'condition_matched', v_condition
            );
        END IF;
    END LOOP;

    -- No condition matched - return default mapping
    RETURN jsonb_build_object(
        'matched', false,
        'action_type', 'default',
        'action_config', '{}'::jsonb
    );
END;
$$;
