-- ============================================================================
-- FIX CLAIMS TABLE AND FUNCTIONS
-- ============================================================================
-- Add missing columns to claims and claim_denials tables
-- Recreate functions with proper column references
-- ============================================================================

-- ============================================================================
-- 1. Add missing columns to claims table
-- ============================================================================
ALTER TABLE claims ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ============================================================================
-- 2. Drop and recreate claims functions with correct schema
-- ============================================================================

-- Helper to drop all overloads
CREATE OR REPLACE FUNCTION pg_temp.drop_func(p_name TEXT)
RETURNS VOID AS $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure::text as sig
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = p_name
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
    END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT pg_temp.drop_func('approve_claim');
SELECT pg_temp.drop_func('reject_claim');
SELECT pg_temp.drop_func('approve_denial_appeal');

-- Recreate approve_claim
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

-- Recreate reject_claim
CREATE OR REPLACE FUNCTION public.reject_claim(p_claim_id UUID, p_reason TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE claims
    SET status = 'rejected',
        rejection_reason = p_reason
    WHERE id = p_claim_id;

    RETURN p_claim_id;
END;
$$;

-- ============================================================================
-- 3. Fix claim_denials table
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'claim_denials') THEN
        ALTER TABLE claim_denials ADD COLUMN IF NOT EXISTS appeal_reason TEXT;
        ALTER TABLE claim_denials ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Recreate approve_denial_appeal
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
