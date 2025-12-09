-- ============================================================================
-- FIX FUNCTION OVERLOADS - DROP ALL VERSIONS THEN CREATE CORRECT ONE
-- ============================================================================
-- These functions have multiple overloads with errors, need to drop all and recreate
-- ============================================================================

-- Helper to drop all overloads of a function
CREATE OR REPLACE FUNCTION pg_temp.drop_all_overloads(p_function_name TEXT)
RETURNS VOID AS $helper$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure::text as func_signature
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = p_function_name
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
    END LOOP;
END;
$helper$ LANGUAGE plpgsql;

-- ============================================================================
-- Drop all overloads of the problematic functions
-- ============================================================================

SELECT pg_temp.drop_all_overloads('approve_claim');
SELECT pg_temp.drop_all_overloads('reject_claim');
SELECT pg_temp.drop_all_overloads('approve_denial_appeal');
SELECT pg_temp.drop_all_overloads('submit_denial_appeal');
SELECT pg_temp.drop_all_overloads('mark_claim_ready_for_hospital');
SELECT pg_temp.drop_all_overloads('get_top_ai_users');
SELECT pg_temp.drop_all_overloads('send_appointment_notification');
SELECT pg_temp.drop_all_overloads('identify_high_burden_caregivers');
SELECT pg_temp.drop_all_overloads('get_dementia_patients_due_for_assessment');

-- Drop other problematic functions that need missing schema
SELECT pg_temp.drop_all_overloads('get_nurse_bypass_count_last_7_days');
SELECT pg_temp.drop_all_overloads('caregiver_verify_pin_grant');
SELECT pg_temp.drop_all_overloads('run_security_monitoring');
SELECT pg_temp.drop_all_overloads('run_all_data_retention_cleanup');
SELECT pg_temp.drop_all_overloads('test_backup_restore');
SELECT pg_temp.drop_all_overloads('update_kiosk_last_seen');
SELECT pg_temp.drop_all_overloads('auto_generate_clinical_data_for_all_hospital_patients');
SELECT pg_temp.drop_all_overloads('reset_methodist_demo');

-- ============================================================================
-- Recreate functions that have valid tables/columns to work with
-- ============================================================================

-- get_top_ai_users - uses mcp_usage_logs and profiles (both exist)
CREATE OR REPLACE FUNCTION public.get_top_ai_users(
    p_tenant_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    user_id UUID,
    user_email TEXT,
    full_name TEXT,
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
        (COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, ''))::TEXT as full_name,
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
-- Claims functions - simplified since claims table lacks some columns
-- ============================================================================

-- Check what columns claims table has
DO $$
DECLARE
    v_has_notes BOOLEAN;
    v_has_rejection_reason BOOLEAN;
BEGIN
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'claims' AND column_name = 'notes') INTO v_has_notes;
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'claims' AND column_name = 'rejection_reason') INTO v_has_rejection_reason;

    -- Add notes column if missing
    IF NOT v_has_notes THEN
        ALTER TABLE claims ADD COLUMN IF NOT EXISTS notes TEXT;
    END IF;

    -- Add rejection_reason column if missing
    IF NOT v_has_rejection_reason THEN
        ALTER TABLE claims ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
    END IF;
END $$;

-- approve_claim - with notes column
CREATE OR REPLACE FUNCTION public.approve_claim(p_claim_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();

    UPDATE claims
    SET status = 'approved',
        approved_by = v_user_id,
        approved_at = NOW(),
        notes = COALESCE(p_notes, notes)
    WHERE id = p_claim_id;

    RETURN p_claim_id;
END;
$$;

-- reject_claim - with rejection_reason column
CREATE OR REPLACE FUNCTION public.reject_claim(p_claim_id UUID, p_reason TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();

    UPDATE claims
    SET status = 'rejected',
        rejection_reason = p_reason
    WHERE id = p_claim_id;

    RETURN p_claim_id;
END;
$$;

-- mark_claim_ready_for_hospital - simplified
CREATE OR REPLACE FUNCTION public.mark_claim_ready_for_hospital(p_claim_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE claims
    SET status = 'ready_for_hospital',
        updated_at = NOW()
    WHERE id = p_claim_id;

    RETURN p_claim_id;
END;
$$;

-- ============================================================================
-- Claim denials functions - add missing columns
-- ============================================================================

DO $$
BEGIN
    ALTER TABLE claim_denials ADD COLUMN IF NOT EXISTS appeal_reason TEXT;
    ALTER TABLE claim_denials ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION WHEN undefined_table THEN
    -- claim_denials doesn't exist, skip
    NULL;
END $$;

-- approve_denial_appeal
CREATE OR REPLACE FUNCTION public.approve_denial_appeal(p_denial_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE claim_denials
    SET appeal_status = 'approved',
        updated_at = NOW()
    WHERE id = p_denial_id;

    RETURN p_denial_id;
END;
$$;

-- submit_denial_appeal
CREATE OR REPLACE FUNCTION public.submit_denial_appeal(p_denial_id UUID, p_appeal_reason TEXT, p_supporting_docs TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE claim_denials
    SET appeal_status = 'submitted',
        appeal_reason = p_appeal_reason,
        updated_at = NOW()
    WHERE id = p_denial_id;

    RETURN p_denial_id;
END;
$$;

-- ============================================================================
-- Note: The following functions are NOT recreated because their required
-- tables don't exist. They will be recreated when those tables are added:
--
-- - send_appointment_notification (needs: appointments table)
-- - identify_high_burden_caregivers (needs: caregiver_patients table)
-- - get_dementia_patients_due_for_assessment (needs: dementia_patients table)
-- - get_nurse_bypass_count_last_7_days (needs: shift_handoff_override_log.nurse_id)
-- - caregiver_verify_pin_grant (needs: caregiver_verify_pin function)
-- - run_security_monitoring (needs: detect_failed_login_spike function)
-- - run_all_data_retention_cleanup (needs: cleanup_expired_geolocation function)
-- - test_backup_restore (needs: check_mfa_required function)
-- - update_kiosk_last_seen (needs: chw_kiosk_devices table)
-- - auto_generate_clinical_data_for_all_hospital_patients (needs: auto_generate_clinical_data_for_hospital_patient function)
-- - reset_methodist_demo (needs: provider_burnout_assessments.provider_id column)
-- ============================================================================
