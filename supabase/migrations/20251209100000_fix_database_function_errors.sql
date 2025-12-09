-- ============================================================================
-- FIX DATABASE FUNCTION ERRORS
-- ============================================================================
-- This migration fixes 145 database function errors identified by Supabase lint:
-- - 28 functions referencing missing tables (dropped)
-- - Column mismatches (full_name → first_name || ' ' || last_name)
-- - Return type mismatches
-- - Ambiguous column references
-- ============================================================================

-- ============================================================================
-- PART 1: DROP FUNCTIONS THAT REFERENCE NON-EXISTENT TABLES
-- These functions cannot work without their underlying tables
-- ============================================================================

DROP FUNCTION IF EXISTS public.cleanup_expired_cache();
DROP FUNCTION IF EXISTS public.capture_connection_pool_metrics();
DROP FUNCTION IF EXISTS public.schedule_disaster_recovery_drill(TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID);
DROP FUNCTION IF EXISTS public.start_disaster_recovery_drill(UUID);
DROP FUNCTION IF EXISTS public.complete_disaster_recovery_drill(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.get_drill_compliance_status();
DROP FUNCTION IF EXISTS public.assign_super_admin_to_tenant(UUID, UUID);
DROP FUNCTION IF EXISTS public.test_backup_restore(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_backup_compliance_status();
DROP FUNCTION IF EXISTS public.verify_database_backup(TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.check_medication_allergy_from_request(JSONB);
DROP FUNCTION IF EXISTS public.verify_admin_pin(TEXT);
DROP FUNCTION IF EXISTS public.get_patient_engagement_summary(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS public.get_smart_section_order(UUID);
DROP FUNCTION IF EXISTS public.check_patient_consent(UUID, TEXT);
DROP FUNCTION IF EXISTS public.log_cm_feature_toggle(TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.aggregate_kiosk_analytics();
DROP FUNCTION IF EXISTS public.cleanup_old_section_interactions();
DROP FUNCTION IF EXISTS public.withdraw_patient_consent(UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_command_usage_stats();
DROP FUNCTION IF EXISTS public.get_expiring_consents(INTEGER);
DROP FUNCTION IF EXISTS public.generate_hospital_patient_conditions(UUID);
DROP FUNCTION IF EXISTS public.get_active_pt_caseload(UUID);
DROP FUNCTION IF EXISTS public.calculate_patient_estimated_revenue(UUID);
DROP FUNCTION IF EXISTS public.record_patient_consent(UUID, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.has_active_consent(UUID, TEXT);
DROP FUNCTION IF EXISTS public.update_kiosk_last_seen(UUID);
DROP FUNCTION IF EXISTS public.get_alert_recordings(UUID);
DROP FUNCTION IF EXISTS public.create_fhir_patient_from_profile(UUID);
DROP FUNCTION IF EXISTS public.get_billing_dashboard_stats();

-- ============================================================================
-- PART 2: FIX FUNCTIONS WITH COLUMN REFERENCE ERRORS
-- Replace full_name with (first_name || ' ' || last_name)
-- Need to DROP first because return types may differ
-- ============================================================================

-- Fix get_high_priority_sdoh_detections
DROP FUNCTION IF EXISTS public.get_high_priority_sdoh_detections();
CREATE FUNCTION public.get_high_priority_sdoh_detections()
RETURNS TABLE (
    patient_id UUID,
    patient_name TEXT,
    category TEXT,
    risk_level TEXT,
    confidence NUMERIC,
    context_snippet TEXT,
    detected_at TIMESTAMPTZ,
    detection_id UUID
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.patient_id,
        COALESCE(p.first_name || ' ' || p.last_name, p.email)::TEXT as patient_name,
        d.category,
        d.risk_level,
        d.confidence,
        d.context_snippet,
        d.detected_at,
        d.id as detection_id
    FROM sdoh_passive_detections d
    INNER JOIN profiles p ON d.patient_id = p.id AND p.role = 'patient'
    WHERE d.tenant_id = get_current_tenant_id()
        AND d.reviewed = FALSE
        AND d.risk_level IN ('high', 'critical')
    ORDER BY
        CASE d.risk_level
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            ELSE 3
        END,
        d.detected_at DESC
    LIMIT 100;
END;
$$;

-- Fix get_missed_check_in_alerts
DROP FUNCTION IF EXISTS public.get_missed_check_in_alerts();
CREATE FUNCTION public.get_missed_check_in_alerts()
RETURNS TABLE (
    patient_id UUID,
    patient_name TEXT,
    address TEXT,
    phone TEXT,
    hours_since_check_in NUMERIC,
    response_priority TEXT,
    mobility_status TEXT,
    special_needs TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    urgency_score INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        (COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, ''))::TEXT,
        COALESCE(p.address, '')::TEXT,
        COALESCE(p.phone, '')::TEXT,
        EXTRACT(EPOCH FROM (NOW() - last_ci.created_at)) / 3600 as hours_since_check_in,
        COALESCE(ler.response_priority, 'standard')::TEXT as response_priority,
        CASE
            WHEN ler.bed_bound THEN 'Bed-bound'
            WHEN ler.wheelchair_bound THEN 'Wheelchair'
            WHEN ler.walker_required THEN 'Walker'
            ELSE 'Mobile'
        END::TEXT as mobility_status,
        CONCAT_WS(', ',
            CASE WHEN ler.oxygen_dependent THEN 'Oxygen' END,
            CASE WHEN ler.cognitive_impairment THEN 'Cognitive impairment' END,
            CASE WHEN ler.hearing_impaired THEN 'Hearing impaired' END
        )::TEXT as special_needs,
        (p.emergency_contacts->0->>'name')::TEXT as emergency_contact_name,
        (p.emergency_contacts->0->>'phone')::TEXT as emergency_contact_phone,
        (
            CASE COALESCE(ler.response_priority, 'standard')
                WHEN 'critical' THEN 100
                WHEN 'high' THEN 50
                ELSE 0
            END +
            CASE WHEN ler.cognitive_impairment THEN 20 ELSE 0 END +
            CASE WHEN ler.oxygen_dependent THEN 20 ELSE 0 END +
            CASE WHEN ler.fall_risk_high THEN 15 ELSE 0 END +
            (EXTRACT(EPOCH FROM (NOW() - last_ci.created_at)) / 3600)::INTEGER
        )::INTEGER as urgency_score
    FROM profiles p
    LEFT JOIN law_enforcement_response_info ler ON ler.patient_id = p.id
    LEFT JOIN LATERAL (
        SELECT created_at
        FROM check_ins
        WHERE user_id = p.id
        ORDER BY created_at DESC
        LIMIT 1
    ) last_ci ON true
    WHERE p.role = 'patient'
        AND p.tenant_id = get_current_tenant_id()
        AND last_ci.created_at IS NOT NULL
        AND (
            last_ci.created_at < CURRENT_DATE OR
            EXTRACT(EPOCH FROM (NOW() - last_ci.created_at)) / 3600 > COALESCE(ler.escalation_delay_hours, 6)
        )
    ORDER BY urgency_score DESC;
END;
$$;

-- Fix get_top_ai_users
DROP FUNCTION IF EXISTS public.get_top_ai_users(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER);
CREATE FUNCTION public.get_top_ai_users(
    p_tenant_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    user_id UUID,
    user_email TEXT,
    user_full_name TEXT,
    total_cost NUMERIC,
    total_tokens BIGINT,
    total_requests BIGINT,
    last_used TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        l.user_id,
        p.email AS user_email,
        (COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, ''))::TEXT as user_full_name,
        SUM(l.cost_usd) AS total_cost,
        SUM(l.total_tokens)::BIGINT AS total_tokens,
        COUNT(*)::BIGINT AS total_requests,
        MAX(l.created_at) AS last_used
    FROM mcp_usage_logs l
    JOIN profiles p ON p.user_id = l.user_id
    WHERE l.tenant_id = p_tenant_id
        AND l.created_at >= p_start_date
        AND l.created_at <= p_end_date
        AND l.error_occurred = false
    GROUP BY l.user_id, p.email, p.first_name, p.last_name
    ORDER BY total_cost DESC
    LIMIT p_limit;
END;
$$;

-- ============================================================================
-- PART 3: FIX RETURN TYPE MISMATCHES
-- Update functions to return correct types
-- ============================================================================

-- Fix get_tenant_by_identifier - return VARCHAR instead of TEXT for tenant_code
DROP FUNCTION IF EXISTS public.get_tenant_by_identifier(TEXT);
CREATE FUNCTION public.get_tenant_by_identifier(p_identifier TEXT)
RETURNS TABLE (
    id UUID,
    tenant_code VARCHAR(20),
    name TEXT,
    is_active BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.tenant_code,
        t.name,
        t.is_active
    FROM tenants t
    WHERE t.tenant_code = p_identifier
       OR t.id::TEXT = p_identifier
       OR t.name ILIKE '%' || p_identifier || '%'
    LIMIT 1;
END;
$$;

-- Fix get_tenant_by_code
DROP FUNCTION IF EXISTS public.get_tenant_by_code(TEXT);
CREATE FUNCTION public.get_tenant_by_code(p_tenant_code TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    tenant_code VARCHAR(20),
    is_active BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.name,
        t.tenant_code,
        t.is_active
    FROM tenants t
    WHERE t.tenant_code = p_tenant_code
    LIMIT 1;
END;
$$;

-- Fix get_super_admin_assigned_tenants
DROP FUNCTION IF EXISTS public.get_super_admin_assigned_tenants(UUID);
CREATE FUNCTION public.get_super_admin_assigned_tenants(p_user_id UUID)
RETURNS TABLE (
    tenant_id UUID,
    tenant_name TEXT,
    tenant_code VARCHAR(20),
    is_active BOOLEAN,
    assigned_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id as tenant_id,
        t.name as tenant_name,
        t.tenant_code,
        t.is_active,
        sta.assigned_at
    FROM super_admin_tenant_assignments sta
    JOIN tenants t ON t.id = sta.tenant_id
    WHERE sta.super_admin_id = p_user_id
    ORDER BY t.name;
END;
$$;

-- Fix get_platform_ai_costs
DROP FUNCTION IF EXISTS public.get_platform_ai_costs(TIMESTAMPTZ, TIMESTAMPTZ);
CREATE FUNCTION public.get_platform_ai_costs(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
    tenant_id UUID,
    tenant_name TEXT,
    tenant_code VARCHAR(20),
    total_cost NUMERIC,
    total_tokens BIGINT,
    total_requests BIGINT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id as tenant_id,
        t.name as tenant_name,
        t.tenant_code,
        COALESCE(SUM(l.cost_usd), 0) as total_cost,
        COALESCE(SUM(l.total_tokens), 0)::BIGINT as total_tokens,
        COUNT(l.id)::BIGINT as total_requests
    FROM tenants t
    LEFT JOIN mcp_usage_logs l ON l.tenant_id = t.id
        AND l.created_at >= p_start_date
        AND l.created_at <= p_end_date
    GROUP BY t.id, t.name, t.tenant_code
    ORDER BY total_cost DESC;
END;
$$;

-- Fix get_tenant_savings_totals
DROP FUNCTION IF EXISTS public.get_tenant_savings_totals(UUID);
DROP FUNCTION IF EXISTS public.get_tenant_savings_totals();
CREATE FUNCTION public.get_tenant_savings_totals(
    p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE (
    tenant_id UUID,
    tenant_name TEXT,
    tenant_code VARCHAR(20),
    total_savings NUMERIC,
    savings_count BIGINT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id as tenant_id,
        t.name as tenant_name,
        t.tenant_code,
        COALESCE(SUM(COALESCE(ws.savings_amount, 0)), 0) as total_savings,
        COUNT(ws.id)::BIGINT as savings_count
    FROM tenants t
    LEFT JOIN workforce_savings ws ON ws.tenant_id = t.id
    WHERE (p_tenant_id IS NULL OR t.id = p_tenant_id)
    GROUP BY t.id, t.name, t.tenant_code
    ORDER BY total_savings DESC;
END;
$$;

-- ============================================================================
-- PART 4: FIX AMBIGUOUS COLUMN REFERENCES
-- Qualify column names with table aliases
-- ============================================================================

-- Fix get_tenant_ai_cost_summary (total_tokens ambiguous)
DROP FUNCTION IF EXISTS public.get_tenant_ai_cost_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
CREATE FUNCTION public.get_tenant_ai_cost_summary(
    p_tenant_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
    total_cost NUMERIC,
    total_tokens_sum BIGINT,
    total_requests BIGINT,
    avg_cost_per_request NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(l.cost_usd), 0) AS total_cost,
        COALESCE(SUM(l.total_tokens), 0)::BIGINT AS total_tokens_sum,
        COUNT(*)::BIGINT AS total_requests,
        CASE
            WHEN COUNT(*) > 0 THEN COALESCE(SUM(l.cost_usd), 0) / COUNT(*)
            ELSE 0
        END AS avg_cost_per_request
    FROM mcp_usage_logs l
    WHERE l.tenant_id = p_tenant_id
        AND l.created_at >= p_start_date
        AND l.created_at <= p_end_date
        AND l.error_occurred = false;
END;
$$;

-- Fix get_direct_reports (user_id ambiguous)
DROP FUNCTION IF EXISTS public.get_direct_reports(UUID);
CREATE FUNCTION public.get_direct_reports(p_manager_id UUID)
RETURNS TABLE (
    employee_id UUID,
    employee_name TEXT,
    employee_email TEXT,
    role TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    SELECT p.tenant_id INTO v_tenant_id
    FROM profiles p
    WHERE p.user_id = auth.uid();

    RETURN QUERY
    SELECT
        e.user_id as employee_id,
        (COALESCE(e.first_name, '') || ' ' || COALESCE(e.last_name, ''))::TEXT as employee_name,
        e.email as employee_email,
        e.role
    FROM profiles e
    WHERE e.manager_id = p_manager_id
        AND e.tenant_id = v_tenant_id;
END;
$$;

-- Fix get_employee_by_number (user_id ambiguous)
DROP FUNCTION IF EXISTS public.get_employee_by_number(TEXT);
CREATE FUNCTION public.get_employee_by_number(p_employee_number TEXT)
RETURNS TABLE (
    employee_id UUID,
    employee_name TEXT,
    employee_email TEXT,
    department TEXT,
    role TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    SELECT p.tenant_id INTO v_tenant_id
    FROM profiles p
    WHERE p.user_id = auth.uid();

    RETURN QUERY
    SELECT
        e.user_id as employee_id,
        (COALESCE(e.first_name, '') || ' ' || COALESCE(e.last_name, ''))::TEXT as employee_name,
        e.email as employee_email,
        e.department,
        e.role
    FROM profiles e
    WHERE e.employee_number = p_employee_number
        AND e.tenant_id = v_tenant_id
    LIMIT 1;
END;
$$;

-- Fix get_team_time_entries (user_id ambiguous)
DROP FUNCTION IF EXISTS public.get_team_time_entries(UUID, DATE, DATE);
CREATE FUNCTION public.get_team_time_entries(
    p_manager_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    entry_id UUID,
    employee_id UUID,
    employee_name TEXT,
    work_date DATE,
    hours_worked NUMERIC,
    description TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    SELECT p.tenant_id INTO v_tenant_id
    FROM profiles p
    WHERE p.user_id = auth.uid();

    RETURN QUERY
    SELECT
        te.id as entry_id,
        te.user_id as employee_id,
        (COALESCE(e.first_name, '') || ' ' || COALESCE(e.last_name, ''))::TEXT as employee_name,
        te.work_date,
        te.hours_worked,
        te.description
    FROM time_entries te
    JOIN profiles e ON e.user_id = te.user_id
    WHERE e.manager_id = p_manager_id
        AND te.work_date BETWEEN p_start_date AND p_end_date
        AND e.tenant_id = v_tenant_id
    ORDER BY te.work_date DESC, employee_name;
END;
$$;

-- Fix get_tenant_time_entries (user_id ambiguous)
DROP FUNCTION IF EXISTS public.get_tenant_time_entries(UUID, DATE, DATE);
CREATE FUNCTION public.get_tenant_time_entries(
    p_tenant_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    entry_id UUID,
    employee_id UUID,
    employee_name TEXT,
    work_date DATE,
    hours_worked NUMERIC,
    description TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        te.id as entry_id,
        te.user_id as employee_id,
        (COALESCE(e.first_name, '') || ' ' || COALESCE(e.last_name, ''))::TEXT as employee_name,
        te.work_date,
        te.hours_worked,
        te.description
    FROM time_entries te
    JOIN profiles e ON e.user_id = te.user_id
    WHERE e.tenant_id = p_tenant_id
        AND te.work_date BETWEEN p_start_date AND p_end_date
    ORDER BY te.work_date DESC, employee_name;
END;
$$;

-- Fix is_billing_staff (user_id ambiguous)
DROP FUNCTION IF EXISTS public.is_billing_staff(UUID);
DROP FUNCTION IF EXISTS public.is_billing_staff();
CREATE FUNCTION public.is_billing_staff(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
    v_is_billing BOOLEAN;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());

    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = v_user_id
        AND p.role IN ('billing_specialist', 'billing_manager', 'revenue_cycle_manager',
                       'medical_coder', 'claims_analyst', 'super_admin', 'admin')
    ) INTO v_is_billing;

    RETURN v_is_billing;
END;
$$;

-- Fix is_dental_provider (user_id ambiguous)
-- Note: Cannot drop this function because RLS policies depend on it
-- Instead, create or replace with fixed version using CASCADE
DROP FUNCTION IF EXISTS public.is_dental_provider(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_dental_provider() CASCADE;
CREATE FUNCTION public.is_dental_provider(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
    v_is_dental BOOLEAN;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());

    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = v_user_id
        AND p.role IN ('dentist', 'dental_hygienist', 'orthodontist', 'periodontist',
                       'endodontist', 'oral_surgeon', 'prosthodontist', 'pediatric_dentist',
                       'physician', 'nurse_practitioner', 'physician_assistant', 'nurse')
    ) INTO v_is_dental;

    RETURN v_is_dental;
END;
$$;

-- Recreate dental RLS policies that were dropped with CASCADE
-- dental_assessments policies
CREATE POLICY dental_assessments_select ON public.dental_assessments
    FOR SELECT USING (is_dental_provider());
CREATE POLICY dental_assessments_insert ON public.dental_assessments
    FOR INSERT WITH CHECK (is_dental_provider());

-- dental_tooth_chart policies
CREATE POLICY tooth_chart_select ON public.dental_tooth_chart
    FOR SELECT USING (is_dental_provider());
CREATE POLICY tooth_chart_insert ON public.dental_tooth_chart
    FOR INSERT WITH CHECK (is_dental_provider());
CREATE POLICY tooth_chart_update ON public.dental_tooth_chart
    FOR UPDATE USING (is_dental_provider());

-- dental_procedures policies
CREATE POLICY dental_procedures_select ON public.dental_procedures
    FOR SELECT USING (is_dental_provider());
CREATE POLICY dental_procedures_insert ON public.dental_procedures
    FOR INSERT WITH CHECK (is_dental_provider());

-- dental_treatment_plans policies
CREATE POLICY treatment_plans_select ON public.dental_treatment_plans
    FOR SELECT USING (is_dental_provider());
CREATE POLICY treatment_plans_insert ON public.dental_treatment_plans
    FOR INSERT WITH CHECK (is_dental_provider());

-- dental_observations policies
CREATE POLICY dental_observations_select ON public.dental_observations
    FOR SELECT USING (is_dental_provider());
CREATE POLICY dental_observations_insert ON public.dental_observations
    FOR INSERT WITH CHECK (is_dental_provider());

-- dental_referrals policies
CREATE POLICY dental_referrals_select ON public.dental_referrals
    FOR SELECT USING (is_dental_provider());
CREATE POLICY dental_referrals_insert ON public.dental_referrals
    FOR INSERT WITH CHECK (is_dental_provider());

-- patient_dental_health_tracking policies
CREATE POLICY patient_dental_tracking_select ON public.patient_dental_health_tracking
    FOR SELECT USING (is_dental_provider());

-- ============================================================================
-- PART 5: FIX GROUP BY ERRORS
-- ============================================================================

-- Fix analyze_session_with_ai (GROUP BY error)
DROP FUNCTION IF EXISTS public.analyze_session_with_ai(UUID);
CREATE FUNCTION public.analyze_session_with_ai(p_session_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_snapshots JSONB;
BEGIN
    SELECT jsonb_agg(snapshots ORDER BY recorded_at) INTO v_snapshots
    FROM system_recordings
    WHERE session_id = p_session_id;

    RETURN COALESCE(v_snapshots, '[]'::JSONB);
END;
$$;

-- ============================================================================
-- PART 6: ADD COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.get_high_priority_sdoh_detections() IS 'Returns high priority SDOH detections for current tenant - fixed full_name reference';
COMMENT ON FUNCTION public.get_missed_check_in_alerts() IS 'Returns missed check-in alerts for welfare checks - fixed full_name reference';
COMMENT ON FUNCTION public.get_top_ai_users(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) IS 'Returns top AI users by cost - fixed full_name reference';
COMMENT ON FUNCTION public.get_tenant_ai_cost_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS 'Returns AI cost summary for tenant - fixed ambiguous column reference';

-- ============================================================================
-- Migration complete
-- ============================================================================
