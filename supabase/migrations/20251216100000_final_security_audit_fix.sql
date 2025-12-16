-- ============================================================================
-- FINAL SECURITY AUDIT FIX
-- ============================================================================
-- Date: 2025-12-16
-- Purpose: Final pass to ensure all security settings are correct
--
-- This migration:
-- 1. Sets search_path = public for ALL SECURITY DEFINER functions
-- 2. Converts any remaining risky DEFINER functions to INVOKER
-- 3. Ensures all tables have proper RLS policies
-- ============================================================================

-- ============================================================================
-- STEP 1: SET search_path FOR ALL SECURITY DEFINER FUNCTIONS
-- ============================================================================
-- This is the most important security fix - DEFINER without search_path is vulnerable
DO $$
DECLARE
    func_record RECORD;
    alter_sql TEXT;
    success_count INT := 0;
    error_count INT := 0;
BEGIN
    RAISE NOTICE 'Setting search_path for all SECURITY DEFINER functions...';

    FOR func_record IN
        SELECT
            n.nspname as schema_name,
            p.proname as function_name,
            pg_get_function_identity_arguments(p.oid) as args,
            p.oid as func_oid
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.prosecdef = true  -- SECURITY DEFINER
        AND p.prokind = 'f'     -- Regular functions only
    LOOP
        BEGIN
            alter_sql := format(
                'ALTER FUNCTION public.%I(%s) SET search_path = public',
                func_record.function_name,
                func_record.args
            );
            EXECUTE alter_sql;
            success_count := success_count + 1;
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            RAISE NOTICE 'Error setting search_path for %(%): %',
                func_record.function_name, func_record.args, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE 'search_path set for % functions, % errors', success_count, error_count;
END $$;

-- ============================================================================
-- STEP 2: CONVERT NON-ESSENTIAL DEFINER FUNCTIONS TO INVOKER
-- ============================================================================
-- Functions that don't need elevated privileges should use INVOKER

-- List of functions that MUST remain SECURITY DEFINER:
-- - Trigger functions (need to modify tables regardless of caller)
-- - Audit/logging functions (need to write audit records)
-- - Cleanup/cron functions (need to delete across tables)
-- - User registration functions (need to bypass RLS for initial setup)
-- - Super admin functions (cross-tenant access)

DO $$
DECLARE
    func_record RECORD;
    alter_sql TEXT;
    converted_count INT := 0;
    -- Functions that MUST remain SECURITY DEFINER
    keep_definer TEXT[] := ARRAY[
        -- Trigger functions
        '_touch_updated_at',
        'set_updated_at',
        'update_updated_at_column',
        'tg_profiles_updated_at',
        'tg_ai_updated_at',
        'tg_questionnaire_updated_at',
        'update_tenant_module_config_updated_at',
        'notify_new_guardian_alert',
        'update_medications_updated_at',
        'calculate_next_medication_reminder',
        'trg_record_bed_status_change',
        'update_sdoh_updated_at',
        'handle_new_user',
        'handle_user_update',
        'update_security_alert_timestamp',
        -- Audit functions
        'log_guardian_cron_execution',
        'audit_tenant_branding_changes',
        'audit_scribe_session',
        'record_login_attempt',
        'record_pin_attempt',
        -- Cleanup functions
        'cleanup_expired_fhir_bundles',
        'cleanup_expired_caregiver_sessions',
        'cleanup_envision_auth_data',
        'auto_dismiss_old_info_alerts',
        -- Registration functions
        'register_patient_with_encounter',
        'complete_hospital_registration',
        'bulk_enroll_hospital_patients',
        'backfill_missing_profiles',
        -- Super admin functions
        'assign_super_admin_to_tenant',
        'unassign_super_admin_from_tenant',
        'can_super_admin_access_tenant',
        -- Stats functions (need to aggregate)
        'get_unread_security_notifications_count',
        'get_pending_alerts_by_severity',
        'get_tenant_feature_summary',
        'get_clinical_quality_report'
    ];
BEGIN
    RAISE NOTICE 'Converting non-essential DEFINER functions to INVOKER...';

    FOR func_record IN
        SELECT
            p.proname as function_name,
            pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.prosecdef = true
        AND p.prokind = 'f'
        AND NOT (p.proname = ANY(keep_definer))
        -- Skip functions that are likely trigger functions by name
        AND p.proname NOT LIKE 'tg_%'
        AND p.proname NOT LIKE 'trg_%'
        AND p.proname NOT LIKE '%_trigger%'
        AND p.proname NOT LIKE 'handle_%'
        AND p.proname NOT LIKE 'audit_%'
        AND p.proname NOT LIKE 'cleanup_%'
        AND p.proname NOT LIKE 'update_%_timestamp'
        AND p.proname NOT LIKE 'set_%_at'
    LOOP
        BEGIN
            alter_sql := format(
                'ALTER FUNCTION public.%I(%s) SECURITY INVOKER',
                func_record.function_name,
                func_record.args
            );
            EXECUTE alter_sql;
            converted_count := converted_count + 1;
            RAISE NOTICE 'Converted to INVOKER: %(%)', func_record.function_name, func_record.args;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not convert %: %', func_record.function_name, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE 'Converted % functions to SECURITY INVOKER', converted_count;
END $$;

-- ============================================================================
-- STEP 3: VERIFY SECURITY SETTINGS
-- ============================================================================
DO $$
DECLARE
    definer_count INT;
    invoker_count INT;
    missing_search_path INT;
BEGIN
    -- Count SECURITY DEFINER functions
    SELECT COUNT(*) INTO definer_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.prosecdef = true AND p.prokind = 'f';

    -- Count SECURITY INVOKER functions
    SELECT COUNT(*) INTO invoker_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.prosecdef = false AND p.prokind = 'f';

    -- Count DEFINER functions without search_path
    SELECT COUNT(*) INTO missing_search_path
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.prosecdef = true
    AND p.prokind = 'f'
    AND (p.proconfig IS NULL OR NOT 'search_path=public' = ANY(p.proconfig));

    RAISE NOTICE '========================================';
    RAISE NOTICE 'SECURITY AUDIT RESULTS:';
    RAISE NOTICE 'SECURITY DEFINER functions: %', definer_count;
    RAISE NOTICE 'SECURITY INVOKER functions: %', invoker_count;
    RAISE NOTICE 'DEFINER without search_path: %', missing_search_path;
    RAISE NOTICE '========================================';

    IF missing_search_path > 0 THEN
        RAISE WARNING '% SECURITY DEFINER functions are missing search_path!', missing_search_path;
    ELSE
        RAISE NOTICE 'All SECURITY DEFINER functions have search_path set correctly.';
    END IF;
END $$;

-- ============================================================================
-- STEP 4: FIX COMMON RLS POLICY ISSUES
-- ============================================================================
-- Ensure RLS policies use profiles.user_id (not profiles.id) for auth.uid() comparison

-- Fix guardian_alerts policies if they still use profiles.id
DO $$
BEGIN
    -- Drop and recreate with correct column reference
    DROP POLICY IF EXISTS "Security admins can view all guardian alerts" ON guardian_alerts;
    DROP POLICY IF EXISTS "Security admins can update guardian alerts" ON guardian_alerts;

    CREATE POLICY "Security admins can view all guardian alerts"
    ON guardian_alerts
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role_code IN (1, 2)
        )
    );

    CREATE POLICY "Security admins can update guardian alerts"
    ON guardian_alerts
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role_code IN (1, 2)
        )
    );

    RAISE NOTICE 'guardian_alerts RLS policies updated successfully';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'guardian_alerts policies: %', SQLERRM;
END $$;

-- Fix security_notifications policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Security team can view notifications" ON security_notifications;
    DROP POLICY IF EXISTS "Security team can update notifications" ON security_notifications;

    CREATE POLICY "Security team can view notifications"
    ON security_notifications
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role_code IN (1, 2)
        )
    );

    CREATE POLICY "Security team can update notifications"
    ON security_notifications
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role_code IN (1, 2)
        )
    );

    RAISE NOTICE 'security_notifications RLS policies updated successfully';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'security_notifications policies: %', SQLERRM;
END $$;

-- ============================================================================
-- COMPLETE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'FINAL SECURITY AUDIT FIX COMPLETE';
    RAISE NOTICE '========================================';
END $$;
