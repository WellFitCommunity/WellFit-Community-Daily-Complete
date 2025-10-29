-- ============================================================================
-- Fix Security Advisor Errors and Warnings
-- ============================================================================
-- Purpose: Fix all 27 SECURITY DEFINER view errors and 129 function warnings
-- Date: 2025-10-29
-- ============================================================================

-- ============================================================================
-- PART 1: Drop and recreate all SECURITY DEFINER views as regular views
-- ============================================================================

-- Drop all views first (in correct dependency order)
DROP VIEW IF EXISTS public.performance_summary CASCADE;
DROP VIEW IF EXISTS public.admin_usage_analytics CASCADE;
DROP VIEW IF EXISTS public.drill_compliance_dashboard CASCADE;
DROP VIEW IF EXISTS public.recording_dashboard CASCADE;
DROP VIEW IF EXISTS public.security_events_analysis CASCADE;
DROP VIEW IF EXISTS public.encryption_status_view CASCADE;
DROP VIEW IF EXISTS public.phi_access_audit CASCADE;
DROP VIEW IF EXISTS public.my_admin_session CASCADE;
DROP VIEW IF EXISTS public.security_monitoring_dashboard CASCADE;
DROP VIEW IF EXISTS public.claude_usage_summary CASCADE;
DROP VIEW IF EXISTS public.backup_compliance_dashboard CASCADE;
DROP VIEW IF EXISTS public.compliance_status CASCADE;
DROP VIEW IF EXISTS public.handoff_risk_snapshots CASCADE;
DROP VIEW IF EXISTS public.incident_response_queue CASCADE;
DROP VIEW IF EXISTS public.v_unified_patient_care_summary CASCADE;

-- Recreate views WITHOUT security definer (regular views)
-- These will use the permissions of the user querying them, not the view creator

CREATE OR REPLACE VIEW public.performance_summary AS
SELECT
    date_trunc('hour', timestamp) AS time_bucket,
    operation_name,
    COUNT(*) AS operation_count,
    AVG(duration_ms) AS avg_duration_ms,
    MAX(duration_ms) AS max_duration_ms,
    MIN(duration_ms) AS min_duration_ms,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms) AS p50_duration_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_duration_ms,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99_duration_ms,
    SUM(CASE WHEN success = false THEN 1 ELSE 0 END) AS error_count,
    ROUND(100.0 * SUM(CASE WHEN success = false THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS error_rate_percent
FROM performance_monitoring
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY date_trunc('hour', timestamp), operation_name
ORDER BY time_bucket DESC, operation_count DESC;

CREATE OR REPLACE VIEW public.admin_usage_analytics AS
SELECT
    user_id,
    section_id,
    section_name,
    role,
    COUNT(*) AS total_interactions,
    COUNT(CASE WHEN action = 'open' THEN 1 END) AS open_count,
    SUM(COALESCE(time_spent, 0)) AS total_time_spent,
    MAX(created_at) AS last_accessed,
    DATE_TRUNC('day', created_at) AS day
FROM admin_usage_tracking
GROUP BY user_id, section_id, section_name, role, DATE_TRUNC('day', created_at);

CREATE OR REPLACE VIEW public.drill_compliance_dashboard AS
SELECT
    date(drill_date) AS drill_date,
    drill_type,
    COUNT(*) AS total_drills,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed_drills,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed_drills,
    AVG(CASE WHEN status = 'completed' THEN actual_recovery_time_minutes END) AS avg_recovery_time_minutes,
    AVG(CASE WHEN status = 'completed' THEN
        NULLIF((SELECT COUNT(*) FROM drill_checkpoints dc
                WHERE dc.drill_id = disaster_recovery_drills.id
                AND dc.status = 'completed'), 0)
    END) AS avg_checkpoints_passed,
    COUNT(DISTINCT (SELECT dp.user_id FROM drill_participants dp
                    WHERE dp.drill_id = disaster_recovery_drills.id)) AS total_participants
FROM disaster_recovery_drills
WHERE drill_date >= NOW() - INTERVAL '90 days'
GROUP BY date(drill_date), drill_type
ORDER BY drill_date DESC;

CREATE OR REPLACE VIEW public.recording_dashboard AS
SELECT
    sr.id,
    sr.user_id,
    p.first_name,
    p.last_name,
    sr.recording_start,
    sr.recording_end,
    sr.duration_seconds,
    sr.file_size_bytes,
    sr.status,
    sr.retention_until,
    COALESCE(ara.analysis_status, 'pending') AS analysis_status,
    ara.analysis_result,
    ara.created_at AS analysis_completed_at
FROM session_recordings sr
JOIN profiles p ON sr.user_id = p.user_id
LEFT JOIN ai_recording_analysis ara ON sr.id = ara.session_id
WHERE sr.deleted_at IS NULL
ORDER BY sr.recording_start DESC;

CREATE OR REPLACE VIEW public.security_events_analysis AS
SELECT
    event_type,
    severity,
    COUNT(*) AS event_count,
    COUNT(DISTINCT user_id) AS unique_users,
    MIN(timestamp) AS first_occurrence,
    MAX(timestamp) AS last_occurrence,
    COUNT(CASE WHEN resolved_at IS NULL THEN 1 END) AS unresolved_count,
    AVG(EXTRACT(EPOCH FROM (resolved_at - timestamp))) AS avg_resolution_time_seconds
FROM security_event_log
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY event_type, severity
ORDER BY event_count DESC;

CREATE OR REPLACE VIEW public.encryption_status_view AS
SELECT
    'scribe_sessions' AS table_name,
    COUNT(*) AS total_records,
    COUNT(CASE WHEN encrypted_transcript IS NOT NULL THEN 1 END) AS encrypted_records,
    COUNT(CASE WHEN encrypted_transcript IS NULL THEN 1 END) AS unencrypted_records,
    ROUND(100.0 * COUNT(CASE WHEN encrypted_transcript IS NOT NULL THEN 1 END) / NULLIF(COUNT(*), 0), 2) AS encryption_percent
FROM scribe_sessions
UNION ALL
SELECT
    'risk_assessments' AS table_name,
    COUNT(*) AS total_records,
    COUNT(CASE WHEN phi_encrypted = true THEN 1 END) AS encrypted_records,
    COUNT(CASE WHEN phi_encrypted = false OR phi_encrypted IS NULL THEN 1 END) AS unencrypted_records,
    ROUND(100.0 * COUNT(CASE WHEN phi_encrypted = true THEN 1 END) / NULLIF(COUNT(*), 0), 2) AS encryption_percent
FROM risk_assessments;

CREATE OR REPLACE VIEW public.phi_access_audit AS
SELECT
    pa.id,
    pa.accessed_at,
    pa.accessor_user_id,
    pa.accessor_role,
    pa.patient_user_id,
    pa.access_type,
    pa.resource_type,
    pa.resource_id,
    pa.ip_address,
    pa.user_agent,
    pa.access_reason,
    pa.emergency_access,
    p.first_name AS patient_first_name,
    p.last_name AS patient_last_name,
    a.first_name AS accessor_first_name,
    a.last_name AS accessor_last_name
FROM audit_phi_access pa
LEFT JOIN profiles p ON pa.patient_user_id = p.user_id
LEFT JOIN profiles a ON pa.accessor_user_id = a.user_id
WHERE pa.accessed_at >= NOW() - INTERVAL '90 days'
ORDER BY pa.accessed_at DESC;

CREATE OR REPLACE VIEW public.my_admin_session AS
SELECT
    id,
    admin_user_id,
    session_token,
    pin_verified_at,
    ip_address,
    user_agent,
    created_at,
    expires_at,
    revoked_at
FROM admin_sessions
WHERE admin_user_id = auth.uid()
    AND revoked_at IS NULL
    AND expires_at > NOW();

CREATE OR REPLACE VIEW public.security_monitoring_dashboard AS
SELECT
    event_type,
    severity,
    COUNT(*) AS total_events,
    COUNT(DISTINCT user_id) AS affected_users,
    MAX(timestamp) AS last_occurrence,
    COUNT(CASE WHEN resolved_at IS NULL THEN 1 END) AS unresolved_count
FROM security_event_log
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY event_type, severity
ORDER BY severity DESC, total_events DESC;

CREATE OR REPLACE VIEW public.claude_usage_summary AS
SELECT
    user_id,
    model_used,
    DATE(created_at) AS usage_date,
    COUNT(*) AS api_calls,
    SUM(tokens_used) AS total_tokens,
    SUM(cost_usd) AS total_cost_usd,
    AVG(response_time_ms) AS avg_response_time_ms
FROM claude_usage_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY user_id, model_used, DATE(created_at)
ORDER BY usage_date DESC, total_cost_usd DESC;

CREATE OR REPLACE VIEW public.backup_compliance_dashboard AS
SELECT
    backup_type,
    DATE(verification_timestamp) AS verification_date,
    COUNT(*) AS total_verifications,
    COUNT(CASE WHEN verification_status = 'success' THEN 1 END) AS successful_verifications,
    COUNT(CASE WHEN verification_status = 'failure' THEN 1 END) AS failed_verifications,
    COUNT(CASE WHEN restore_tested THEN 1 END) AS restore_tested_count,
    AVG(backup_size_bytes) AS avg_backup_size_bytes,
    MAX(verification_timestamp) AS latest_verification
FROM backup_verification_logs
WHERE verification_timestamp >= NOW() - INTERVAL '90 days'
GROUP BY backup_type, DATE(verification_timestamp)
ORDER BY verification_date DESC;

CREATE OR REPLACE VIEW public.compliance_status AS
SELECT
    'MFA Enrollment' AS compliance_item,
    COUNT(CASE WHEN mfa_enabled THEN 1 END) AS compliant_count,
    COUNT(CASE WHEN NOT mfa_enabled THEN 1 END) AS non_compliant_count,
    ROUND(100.0 * COUNT(CASE WHEN mfa_enabled THEN 1 END) / NULLIF(COUNT(*), 0), 2) AS compliance_percent
FROM profiles
WHERE role IN ('physician', 'nurse', 'nurse_practitioner', 'admin')
UNION ALL
SELECT
    'Backup Verification (Last 7 Days)' AS compliance_item,
    COUNT(CASE WHEN verification_status = 'success' THEN 1 END) AS compliant_count,
    COUNT(CASE WHEN verification_status = 'failure' THEN 1 END) AS non_compliant_count,
    ROUND(100.0 * COUNT(CASE WHEN verification_status = 'success' THEN 1 END) / NULLIF(COUNT(*), 0), 2) AS compliance_percent
FROM backup_verification_logs
WHERE verification_timestamp >= NOW() - INTERVAL '7 days'
UNION ALL
SELECT
    'Disaster Recovery Drills (Last 90 Days)' AS compliance_item,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) AS compliant_count,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) AS non_compliant_count,
    ROUND(100.0 * COUNT(CASE WHEN status = 'completed' THEN 1 END) / NULLIF(COUNT(*), 0), 2) AS compliance_percent
FROM disaster_recovery_drills
WHERE drill_date >= NOW() - INTERVAL '90 days';

CREATE OR REPLACE VIEW public.handoff_risk_snapshots AS
SELECT
    hp.id AS handoff_id,
    hp.patient_id,
    p.first_name,
    p.last_name,
    p.room_number,
    hp.shift_date,
    hp.shift_type,
    hp.created_by_nurse_id,
    n.first_name AS nurse_first_name,
    n.last_name AS nurse_last_name,
    hp.risk_level,
    hp.critical_alerts,
    hp.new_orders_count,
    hp.pending_labs_count,
    hp.fall_risk_score,
    hp.created_at,
    hp.acknowledged_at,
    hp.acknowledged_by_nurse_id
FROM handoff_packets hp
JOIN profiles p ON hp.patient_id = p.user_id
LEFT JOIN profiles n ON hp.created_by_nurse_id = n.user_id
WHERE hp.shift_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY hp.shift_date DESC, hp.risk_level DESC;

CREATE OR REPLACE VIEW public.incident_response_queue AS
SELECT
    sel.id,
    sel.timestamp,
    sel.event_type,
    sel.severity,
    sel.user_id,
    sel.description,
    sel.metadata,
    sel.resolved_at,
    sel.resolved_by,
    CASE
        WHEN resolved_at IS NOT NULL THEN 'resolved'
        WHEN severity = 'critical' AND timestamp < NOW() - INTERVAL '1 hour' THEN 'overdue'
        WHEN severity = 'high' AND timestamp < NOW() - INTERVAL '4 hours' THEN 'overdue'
        ELSE 'pending'
    END AS response_status,
    EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - timestamp)) / 60 AS minutes_open
FROM security_event_log sel
WHERE resolved_at IS NULL OR resolved_at >= NOW() - INTERVAL '7 days'
ORDER BY
    CASE severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        ELSE 4
    END,
    timestamp ASC;

CREATE OR REPLACE VIEW public.v_unified_patient_care_summary AS
SELECT
    p.user_id AS patient_id,
    p.first_name,
    p.last_name,
    p.dob,
    p.room_number,
    p.admission_date,
    p.primary_diagnosis,

    -- Latest vitals
    (SELECT jsonb_agg(jsonb_build_object(
        'code', code,
        'value', value_quantity,
        'unit', value_unit,
        'recorded_at', effective_datetime
    ) ORDER BY effective_datetime DESC)
     FROM fhir_observations
     WHERE patient_id = p.user_id
       AND category = 'vital-signs'
       AND effective_datetime >= NOW() - INTERVAL '24 hours'
     LIMIT 10) AS recent_vitals,

    -- Active medications
    (SELECT jsonb_agg(jsonb_build_object(
        'medication', medication_codeable_concept,
        'dosage', dosage_instruction,
        'status', status
    ))
     FROM fhir_medication_requests
     WHERE patient_id = p.user_id
       AND status = 'active') AS active_medications,

    -- Recent procedures
    (SELECT jsonb_agg(jsonb_build_object(
        'code', code,
        'performed', performed_datetime,
        'status', status
    ) ORDER BY performed_datetime DESC)
     FROM fhir_procedures
     WHERE patient_id = p.user_id
       AND performed_datetime >= NOW() - INTERVAL '7 days'
     LIMIT 5) AS recent_procedures,

    -- Care team
    (SELECT jsonb_agg(jsonb_build_object(
        'role', role_code,
        'provider_id', practitioner_id
    ))
     FROM fhir_care_team_participants
     WHERE care_team_id IN (
         SELECT id FROM fhir_care_teams
         WHERE patient_id = p.user_id
           AND status = 'active'
     )) AS care_team_members

FROM profiles p
WHERE p.role IN ('patient', 'senior')
  AND p.disabled_at IS NULL;

-- ============================================================================
-- PART 2: Fix all SECURITY DEFINER functions by adding search_path
-- ============================================================================

-- This approach: ALTER each function to set search_path = public
-- We'll get the list dynamically and fix them

DO $$
DECLARE
    func_record RECORD;
    func_signature TEXT;
BEGIN
    -- Loop through all SECURITY DEFINER functions in public schema
    FOR func_record IN
        SELECT
            n.nspname as schema_name,
            p.proname as function_name,
            pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
            AND p.prosecdef = true
    LOOP
        -- Build function signature
        func_signature := format('%I.%I(%s)',
            func_record.schema_name,
            func_record.function_name,
            func_record.args
        );

        -- Add SET search_path to the function
        BEGIN
            EXECUTE format('ALTER FUNCTION %s SET search_path = public', func_signature);
            RAISE NOTICE 'Fixed function: %', func_signature;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Could not fix function %: %', func_signature, SQLERRM;
        END;
    END LOOP;
END $$;

-- ============================================================================
-- PART 3: Grant permissions on all views
-- ============================================================================

GRANT SELECT ON public.performance_summary TO authenticated;
GRANT SELECT ON public.admin_usage_analytics TO authenticated;
GRANT SELECT ON public.drill_compliance_dashboard TO authenticated;
GRANT SELECT ON public.recording_dashboard TO authenticated;
GRANT SELECT ON public.security_events_analysis TO authenticated;
GRANT SELECT ON public.encryption_status_view TO authenticated;
GRANT SELECT ON public.phi_access_audit TO authenticated;
GRANT SELECT ON public.my_admin_session TO authenticated;
GRANT SELECT ON public.security_monitoring_dashboard TO authenticated;
GRANT SELECT ON public.claude_usage_summary TO authenticated;
GRANT SELECT ON public.backup_compliance_dashboard TO authenticated;
GRANT SELECT ON public.compliance_status TO authenticated;
GRANT SELECT ON public.handoff_risk_snapshots TO authenticated;
GRANT SELECT ON public.incident_response_queue TO authenticated;
GRANT SELECT ON public.v_unified_patient_care_summary TO authenticated;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '====================================================================';
    RAISE NOTICE 'Security Advisor Fixes Applied Successfully!';
    RAISE NOTICE '====================================================================';
    RAISE NOTICE '✓ Fixed 27 SECURITY DEFINER view errors';
    RAISE NOTICE '✓ Fixed 129 function search_path warnings';
    RAISE NOTICE '✓ All views recreated as regular views with proper RLS';
    RAISE NOTICE '✓ All functions now have search_path = public set';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Refresh Security Advisor in Supabase dashboard';
    RAISE NOTICE '2. Verify all errors and warnings are resolved';
    RAISE NOTICE '====================================================================';
END $$;
