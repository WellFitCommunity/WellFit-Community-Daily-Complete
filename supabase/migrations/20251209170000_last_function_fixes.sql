-- ============================================================================
-- LAST FUNCTION FIXES - Correct column names for fhir_practitioners
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

-- ============================================================================
-- 1. Fix search_practitioners - use family_name/given_names columns
-- ============================================================================
SELECT pg_temp.drop_func('search_practitioners');

CREATE OR REPLACE FUNCTION public.search_practitioners(
    p_search_term TEXT DEFAULT NULL,
    p_specialty TEXT DEFAULT NULL,
    p_tenant_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    specialty TEXT,
    npi TEXT,
    email TEXT,
    phone TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        fp.id,
        (COALESCE(fp.given_names[1], '') || ' ' || COALESCE(fp.family_name, ''))::TEXT as full_name,
        COALESCE(fp.specialty, fp.taxonomy_code)::TEXT as specialty,
        fp.npi,
        fp.email,
        fp.phone
    FROM fhir_practitioners fp
    WHERE (p_tenant_id IS NULL OR fp.tenant_id = p_tenant_id)
        AND (p_search_term IS NULL OR
             fp.family_name ILIKE '%' || p_search_term || '%' OR
             fp.given_names[1] ILIKE '%' || p_search_term || '%' OR
             fp.npi ILIKE '%' || p_search_term || '%')
        AND (p_specialty IS NULL OR fp.specialty = p_specialty OR fp.taxonomy_code = p_specialty)
    ORDER BY fp.family_name, fp.given_names[1]
    LIMIT p_limit;
END;
$$;

-- ============================================================================
-- 2. Fix calculate_questionnaire_score - remove unused v_response variable
-- ============================================================================
SELECT pg_temp.drop_func('calculate_questionnaire_score');

CREATE OR REPLACE FUNCTION public.calculate_questionnaire_score(
    p_response_id UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total_score NUMERIC := 0;
    v_max_score NUMERIC := 0;
    v_exists BOOLEAN;
BEGIN
    -- Check if response exists
    SELECT EXISTS(
        SELECT 1 FROM questionnaire_responses WHERE id = p_response_id
    ) INTO v_exists;

    IF NOT v_exists THEN
        RETURN jsonb_build_object('error', 'Response not found');
    END IF;

    -- Calculate score from responses column
    SELECT
        COALESCE(SUM((answer->>'score')::NUMERIC), 0),
        COALESCE(SUM(COALESCE((answer->>'max_score')::NUMERIC, 10)), 100)
    INTO v_total_score, v_max_score
    FROM questionnaire_responses qr,
         jsonb_array_elements(COALESCE(qr.responses, '[]'::JSONB)) AS answer
    WHERE qr.id = p_response_id;

    RETURN jsonb_build_object(
        'response_id', p_response_id,
        'total_score', v_total_score,
        'max_score', v_max_score,
        'percentage', CASE WHEN v_max_score > 0 THEN ROUND((v_total_score / v_max_score) * 100, 1) ELSE 0 END
    );
END;
$$;

-- ============================================================================
-- Done - all application functions should be clean
-- ============================================================================
