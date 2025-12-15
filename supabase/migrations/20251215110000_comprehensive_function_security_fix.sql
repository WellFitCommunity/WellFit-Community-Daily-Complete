-- ============================================================================
-- COMPREHENSIVE FUNCTION SECURITY FIX
-- ============================================================================
-- This migration fixes ALL functions in the public schema to have:
-- 1. Explicit SECURITY INVOKER (default, safer) or SECURITY DEFINER (when needed)
-- 2. search_path = public for all SECURITY DEFINER functions
--
-- SECURITY DEFINER functions run with the privileges of the function owner.
-- This is a security risk if search_path is not set because an attacker could
-- create malicious functions in another schema that get called instead.
--
-- Rule of thumb:
-- - Trigger functions: SECURITY DEFINER (need to modify tables)
-- - RLS bypass functions: SECURITY DEFINER (need elevated privileges)
-- - Everything else: SECURITY INVOKER (runs as calling user, respects RLS)
-- ============================================================================

-- Step 1: Set search_path for ALL existing SECURITY DEFINER functions
-- This is critical - SECURITY DEFINER without search_path is a vulnerability
DO $$
DECLARE
    func_record RECORD;
    alter_sql TEXT;
BEGIN
    FOR func_record IN
        SELECT
            n.nspname as schema_name,
            p.proname as function_name,
            pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.prosecdef = true  -- SECURITY DEFINER
        AND p.prokind = 'f'     -- Regular functions
    LOOP
        BEGIN
            alter_sql := format(
                'ALTER FUNCTION public.%I(%s) SET search_path = public',
                func_record.function_name,
                func_record.args
            );
            EXECUTE alter_sql;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not set search_path for %.%(%): %',
                func_record.schema_name, func_record.function_name, func_record.args, SQLERRM;
        END;
    END LOOP;
END $$;

-- Step 2: Define functions that MUST remain SECURITY DEFINER
-- These are functions that need elevated privileges
DO $$
DECLARE
    definer_functions TEXT[] := ARRAY[
        -- Trigger functions (must modify tables)
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

        -- Audit/logging functions (need to write to audit tables)
        'log_guardian_cron_execution',
        'audit_tenant_branding_changes',
        'audit_scribe_session',
        'record_login_attempt',
        'record_pin_attempt',

        -- Cleanup functions (need to delete across tables)
        'cleanup_expired_fhir_bundles',
        'cleanup_expired_caregiver_sessions',
        'cleanup_envision_auth_data',
        'auto_dismiss_old_info_alerts',

        -- Registration/auth functions (bypass RLS for user creation)
        'register_patient_with_encounter',
        'complete_hospital_registration',
        'bulk_enroll_hospital_patients',
        'backfill_missing_profiles',

        -- Cross-tenant operations (need elevated access)
        'assign_super_admin_to_tenant',
        'unassign_super_admin_from_tenant',
        'can_super_admin_access_tenant',

        -- Dispatch/alert functions (need to write across schemas)
        'auto_dispatch_departments',
        'acknowledge_department_dispatch',
        'complete_department_dispatch',
        'update_dispatch_transport',
        'cancel_department_dispatch',

        -- Billing functions (sensitive operations)
        'process_claim_payment',
        'approve_claim',
        'deny_claim',
        'approve_denial_appeal',
        'record_claim_timeline_event',

        -- Patient management functions
        'admit_patient',
        'discharge_patient',
        'transfer_patient',
        'assign_patient_to_bed',

        -- Migration functions
        'claim_migration_work',
        'complete_migration_work',
        'fail_migration_work',

        -- Sequence functions
        'next_seq'
    ];
    func_name TEXT;
    func_rec RECORD;
BEGIN
    RAISE NOTICE 'Functions marked to keep SECURITY DEFINER: %', array_length(definer_functions, 1);
END $$;

-- Step 3: Change all OTHER functions to SECURITY INVOKER
-- This is the safe default - functions run with caller's privileges
DO $$
DECLARE
    func_record RECORD;
    alter_sql TEXT;
    skip_count INT := 0;
    change_count INT := 0;
    -- Functions to keep as SECURITY DEFINER (from step 2)
    definer_patterns TEXT[] := ARRAY[
        -- Patterns for trigger functions
        '%_updated_at%',
        'tg_%',
        'trg_%',
        'handle_new_%',
        'handle_user_%',
        'notify_%',

        -- Patterns for audit functions
        'audit_%',
        'log_%',
        'record_%_attempt',

        -- Patterns for cleanup functions
        'cleanup_%',
        'auto_dismiss_%',

        -- Patterns for registration functions
        'register_%',
        'complete_%_registration',
        'bulk_enroll_%',
        'backfill_%',

        -- Patterns for admin functions
        'assign_%_admin%',
        'unassign_%_admin%',
        'can_super_admin_%',

        -- Patterns for dispatch functions
        '%_dispatch%',
        '%_department_dispatch%',

        -- Patterns for billing functions
        'process_claim_%',
        'approve_claim%',
        'deny_claim%',
        'approve_denial_%',
        '%_timeline_event',

        -- Patterns for patient management
        'admit_patient%',
        'discharge_patient%',
        'transfer_patient%',
        'assign_patient_%',

        -- Patterns for migration functions
        '%_migration_work',

        -- Sequence function
        'next_seq'
    ];
    should_skip BOOLEAN;
    pattern TEXT;
BEGIN
    FOR func_record IN
        SELECT
            n.nspname as schema_name,
            p.proname as function_name,
            pg_get_function_identity_arguments(p.oid) as args,
            p.prosecdef as is_definer
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.prokind = 'f'  -- Regular functions only
        AND p.proname NOT LIKE 'st_%'  -- Skip PostGIS functions
        AND p.proname NOT LIKE '_st_%'
        AND p.proname NOT LIKE 'postgis_%'
        AND p.proname NOT LIKE 'geometry_%'
        AND p.proname NOT LIKE 'geography_%'
        AND p.proname NOT LIKE 'box%'
        AND p.proname NOT LIKE 'path_%'
        ORDER BY p.proname
    LOOP
        -- Check if this function should stay SECURITY DEFINER
        should_skip := FALSE;
        FOREACH pattern IN ARRAY definer_patterns
        LOOP
            IF func_record.function_name LIKE pattern THEN
                should_skip := TRUE;
                EXIT;
            END IF;
        END LOOP;

        IF should_skip THEN
            skip_count := skip_count + 1;
            -- Ensure it has search_path set
            BEGIN
                alter_sql := format(
                    'ALTER FUNCTION public.%I(%s) SECURITY DEFINER SET search_path = public',
                    func_record.function_name,
                    func_record.args
                );
                EXECUTE alter_sql;
            EXCEPTION WHEN OTHERS THEN
                NULL; -- Ignore errors
            END;
        ELSE
            -- Change to SECURITY INVOKER
            BEGIN
                alter_sql := format(
                    'ALTER FUNCTION public.%I(%s) SECURITY INVOKER',
                    func_record.function_name,
                    func_record.args
                );
                EXECUTE alter_sql;
                change_count := change_count + 1;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Could not change %.%(%): %',
                    func_record.schema_name, func_record.function_name, func_record.args, SQLERRM;
            END;
        END IF;
    END LOOP;

    RAISE NOTICE 'Changed % functions to SECURITY INVOKER', change_count;
    RAISE NOTICE 'Kept % functions as SECURITY DEFINER', skip_count;
END $$;

-- Step 4: Verification - count the results
DO $$
DECLARE
    total_count INT;
    definer_count INT;
    invoker_count INT;
    definer_with_path INT;
BEGIN
    SELECT COUNT(*) INTO total_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.prokind = 'f';

    SELECT COUNT(*) INTO definer_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.prosecdef = true;

    invoker_count := total_count - definer_count;

    SELECT COUNT(*) INTO definer_with_path
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.prokind = 'f'
    AND p.prosecdef = true
    AND p.proconfig IS NOT NULL
    AND array_to_string(p.proconfig, ',') LIKE '%search_path%';

    RAISE NOTICE '========================================';
    RAISE NOTICE 'FUNCTION SECURITY SUMMARY';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total functions in public schema: %', total_count;
    RAISE NOTICE 'SECURITY DEFINER: % (should be ~50-100)', definer_count;
    RAISE NOTICE 'SECURITY INVOKER: % (should be majority)', invoker_count;
    RAISE NOTICE 'DEFINER with search_path: %', definer_with_path;
    RAISE NOTICE '========================================';
END $$;
