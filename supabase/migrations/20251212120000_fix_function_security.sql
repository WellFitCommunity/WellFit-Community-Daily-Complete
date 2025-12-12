-- ============================================================================
-- Fix Missing SECURITY Declarations on Functions
-- ============================================================================
-- PostgreSQL best practice requires explicit SECURITY DEFINER or SECURITY INVOKER
-- This migration adds SECURITY INVOKER to functions that were missing it
-- SECURITY INVOKER = runs with privileges of the calling user (safer default)
-- SECURITY DEFINER = runs with privileges of the function owner (for trusted ops)
-- ============================================================================

-- Trigger functions need SECURITY DEFINER to modify tables properly
DO $$
DECLARE
    func_name TEXT;
    trigger_funcs TEXT[] := ARRAY[
        'tg_profiles_updated_at',
        'tg_ai_updated_at',
        'tg_questionnaire_updated_at',
        'set_updated_at',
        'update_updated_at_column',
        'update_tenant_module_config_updated_at',
        'notify_new_guardian_alert',
        'update_medications_updated_at',
        'calculate_next_medication_reminder',
        'trg_record_bed_status_change',
        'update_sdoh_updated_at'
    ];
BEGIN
    FOREACH func_name IN ARRAY trigger_funcs
    LOOP
        BEGIN
            EXECUTE format('ALTER FUNCTION public.%I() SECURITY DEFINER', func_name);
            EXECUTE format('ALTER FUNCTION public.%I() SET search_path = public', func_name);
            RAISE NOTICE 'Fixed trigger function: %', func_name;
        EXCEPTION WHEN undefined_function THEN
            RAISE NOTICE 'Function % does not exist, skipping', func_name;
        END;
    END LOOP;
END $$;

-- Regular functions get SECURITY INVOKER (safer, runs as calling user)
DO $$
DECLARE
    func_rec RECORD;
BEGIN
    -- Functions with no parameters
    FOR func_rec IN
        SELECT unnest(ARRAY[
            'get_active_prompt',
            'refresh_provider_workload_metrics',
            'get_accuracy_dashboard'
        ]) AS func_name
    LOOP
        BEGIN
            EXECUTE format('ALTER FUNCTION public.%I() SECURITY INVOKER', func_rec.func_name);
            EXECUTE format('ALTER FUNCTION public.%I() SET search_path = public', func_rec.func_name);
            RAISE NOTICE 'Fixed function: %', func_rec.func_name;
        EXCEPTION WHEN undefined_function THEN
            RAISE NOTICE 'Function % does not exist, skipping', func_rec.func_name;
        END;
    END LOOP;
END $$;

-- Fix is_admin function (typically takes uuid)
DO $$
BEGIN
    ALTER FUNCTION public.is_admin(uuid) SECURITY INVOKER;
    ALTER FUNCTION public.is_admin(uuid) SET search_path = public;
    RAISE NOTICE 'Fixed is_admin(uuid)';
EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'is_admin(uuid) does not exist, skipping';
END $$;

-- Fix next_seq function (typically takes text)
DO $$
BEGIN
    ALTER FUNCTION public.next_seq(text) SECURITY INVOKER;
    ALTER FUNCTION public.next_seq(text) SET search_path = public;
    RAISE NOTICE 'Fixed next_seq(text)';
EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'next_seq(text) does not exist, skipping';
END $$;

-- Fix get_latest_risk_assessment (typically takes uuid)
DO $$
BEGIN
    ALTER FUNCTION public.get_latest_risk_assessment(uuid) SECURITY INVOKER;
    ALTER FUNCTION public.get_latest_risk_assessment(uuid) SET search_path = public;
    RAISE NOTICE 'Fixed get_latest_risk_assessment';
EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'get_latest_risk_assessment does not exist, skipping';
END $$;

-- Fix get_active_emergency_alerts
DO $$
BEGIN
    ALTER FUNCTION public.get_active_emergency_alerts() SECURITY INVOKER;
    ALTER FUNCTION public.get_active_emergency_alerts() SET search_path = public;
    RAISE NOTICE 'Fixed get_active_emergency_alerts';
EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'get_active_emergency_alerts does not exist, skipping';
END $$;

-- Fix cleanup_expired_fhir_bundles
DO $$
BEGIN
    ALTER FUNCTION public.cleanup_expired_fhir_bundles() SECURITY DEFINER;
    ALTER FUNCTION public.cleanup_expired_fhir_bundles() SET search_path = public;
    RAISE NOTICE 'Fixed cleanup_expired_fhir_bundles';
EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'cleanup_expired_fhir_bundles does not exist, skipping';
END $$;

-- Fix questionnaire functions
DO $$
BEGIN
    ALTER FUNCTION public.calculate_questionnaire_score(uuid) SECURITY INVOKER;
    ALTER FUNCTION public.calculate_questionnaire_score(uuid) SET search_path = public;
    RAISE NOTICE 'Fixed calculate_questionnaire_score';
EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'calculate_questionnaire_score does not exist, skipping';
END $$;

DO $$
BEGIN
    ALTER FUNCTION public.get_questionnaire_stats(uuid) SECURITY INVOKER;
    ALTER FUNCTION public.get_questionnaire_stats(uuid) SET search_path = public;
    RAISE NOTICE 'Fixed get_questionnaire_stats';
EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'get_questionnaire_stats does not exist, skipping';
END $$;

DO $$
BEGIN
    ALTER FUNCTION public.deploy_questionnaire_to_wellfit(uuid) SECURITY INVOKER;
    ALTER FUNCTION public.deploy_questionnaire_to_wellfit(uuid) SET search_path = public;
    RAISE NOTICE 'Fixed deploy_questionnaire_to_wellfit';
EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'deploy_questionnaire_to_wellfit does not exist, skipping';
END $$;

-- Fix calculate_early_warning_score
DO $$
BEGIN
    ALTER FUNCTION public.calculate_early_warning_score(uuid) SECURITY INVOKER;
    ALTER FUNCTION public.calculate_early_warning_score(uuid) SET search_path = public;
    RAISE NOTICE 'Fixed calculate_early_warning_score';
EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'calculate_early_warning_score does not exist, skipping';
END $$;

-- Fix calculate_consecutive_missed_days
DO $$
BEGIN
    ALTER FUNCTION public.calculate_consecutive_missed_days(uuid) SECURITY INVOKER;
    ALTER FUNCTION public.calculate_consecutive_missed_days(uuid) SET search_path = public;
    RAISE NOTICE 'Fixed calculate_consecutive_missed_days';
EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'calculate_consecutive_missed_days does not exist, skipping';
END $$;

-- Fix log_guardian_cron_execution
DO $$
BEGIN
    ALTER FUNCTION public.log_guardian_cron_execution(text, text, jsonb) SECURITY DEFINER;
    ALTER FUNCTION public.log_guardian_cron_execution(text, text, jsonb) SET search_path = public;
    RAISE NOTICE 'Fixed log_guardian_cron_execution';
EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'log_guardian_cron_execution does not exist, skipping';
END $$;

-- Fix generate_tenant_code
DO $$
BEGIN
    ALTER FUNCTION public.generate_tenant_code(text, integer) SECURITY INVOKER;
    ALTER FUNCTION public.generate_tenant_code(text, integer) SET search_path = public;
    RAISE NOTICE 'Fixed generate_tenant_code';
EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'generate_tenant_code does not exist, skipping';
END $$;

-- Fix AI prediction functions
DO $$
BEGIN
    ALTER FUNCTION public.record_ai_prediction(text, text, numeric, jsonb, text, uuid) SECURITY INVOKER;
    ALTER FUNCTION public.record_ai_prediction(text, text, numeric, jsonb, text, uuid) SET search_path = public;
    RAISE NOTICE 'Fixed record_ai_prediction';
EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'record_ai_prediction does not exist, skipping';
END $$;

DO $$
BEGIN
    ALTER FUNCTION public.record_prediction_outcome(uuid, text, jsonb) SECURITY INVOKER;
    ALTER FUNCTION public.record_prediction_outcome(uuid, text, jsonb) SET search_path = public;
    RAISE NOTICE 'Fixed record_prediction_outcome';
EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'record_prediction_outcome does not exist, skipping';
END $$;

-- IMMUTABLE functions - these are pure computation, SECURITY INVOKER is safest
-- get_race_display, get_ethnicity_display, get_license_digit, validate_hc_npi, calculate_age_group, calculate_next_retry
DO $$
DECLARE
    func_name TEXT;
    immutable_funcs TEXT[] := ARRAY[
        'get_race_display',
        'get_ethnicity_display',
        'get_license_digit',
        'calculate_age_group'
    ];
BEGIN
    FOREACH func_name IN ARRAY immutable_funcs
    LOOP
        BEGIN
            -- These functions typically take text parameters
            EXECUTE format('ALTER FUNCTION public.%I(text) SECURITY INVOKER', func_name);
            EXECUTE format('ALTER FUNCTION public.%I(text) SET search_path = public', func_name);
            RAISE NOTICE 'Fixed immutable function: %', func_name;
        EXCEPTION WHEN undefined_function THEN
            RAISE NOTICE 'Function %(text) does not exist, skipping', func_name;
        END;
    END LOOP;
END $$;

-- Fix validate_hc_npi (may have multiple overloads)
DO $$
BEGIN
    ALTER FUNCTION public.validate_hc_npi(text) SECURITY INVOKER;
    ALTER FUNCTION public.validate_hc_npi(text) SET search_path = public;
    RAISE NOTICE 'Fixed validate_hc_npi(text)';
EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'validate_hc_npi(text) does not exist, skipping';
END $$;

-- Fix calculate_next_retry (from enterprise migration)
DO $$
BEGIN
    ALTER FUNCTION public.calculate_next_retry(integer, interval) SECURITY INVOKER;
    ALTER FUNCTION public.calculate_next_retry(integer, interval) SET search_path = public;
    RAISE NOTICE 'Fixed calculate_next_retry';
EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'calculate_next_retry does not exist, skipping';
END $$;

-- ============================================================================
-- VERIFICATION: Log all functions and their security settings
-- ============================================================================
DO $$
DECLARE
    func_count INTEGER;
    definer_count INTEGER;
    invoker_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO func_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.prokind = 'f';

    SELECT COUNT(*) INTO definer_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.prosecdef = true;

    invoker_count := func_count - definer_count;

    RAISE NOTICE '=== FUNCTION SECURITY SUMMARY ===';
    RAISE NOTICE 'Total functions: %', func_count;
    RAISE NOTICE 'SECURITY DEFINER: %', definer_count;
    RAISE NOTICE 'SECURITY INVOKER: %', invoker_count;
END $$;
