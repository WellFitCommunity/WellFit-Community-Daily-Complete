-- ============================================================================
-- FINAL FUNCTION FIXES - Correct column names and eliminate shadowed variables
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
-- 1. Fix calculate_questionnaire_score - column is 'responses' not 'response_data'
-- ============================================================================
SELECT pg_temp.drop_func('calculate_questionnaire_score');

CREATE OR REPLACE FUNCTION public.calculate_questionnaire_score(
    p_response_id UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_response RECORD;
    v_total_score NUMERIC := 0;
    v_max_score NUMERIC := 0;
BEGIN
    SELECT * INTO v_response
    FROM questionnaire_responses
    WHERE id = p_response_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Response not found');
    END IF;

    -- Column is 'responses' not 'response_data'
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
-- 2. Fix search_practitioners - use fhir_practitioners table
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
        (COALESCE(fp.first_name, '') || ' ' || COALESCE(fp.last_name, ''))::TEXT as full_name,
        COALESCE(fp.specialty, fp.qualification_code)::TEXT as specialty,
        fp.npi,
        p.email,
        p.phone
    FROM fhir_practitioners fp
    LEFT JOIN profiles p ON p.user_id = fp.user_id
    WHERE (p_tenant_id IS NULL OR fp.tenant_id = p_tenant_id)
        AND (p_search_term IS NULL OR
             fp.first_name ILIKE '%' || p_search_term || '%' OR
             fp.last_name ILIKE '%' || p_search_term || '%' OR
             fp.npi ILIKE '%' || p_search_term || '%')
        AND (p_specialty IS NULL OR fp.specialty = p_specialty OR fp.qualification_code = p_specialty)
    ORDER BY fp.last_name, fp.first_name
    LIMIT p_limit;
END;
$$;

-- ============================================================================
-- 3. Fix validate_hc_npi - use WHILE loop instead of FOR to avoid shadowing
-- ============================================================================
SELECT pg_temp.drop_func('validate_hc_npi');

CREATE OR REPLACE FUNCTION public.validate_hc_npi(p_npi TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    v_npi_clean TEXT;
    v_sum INTEGER := 0;
    v_digit INTEGER;
    v_idx INTEGER := 1;
BEGIN
    v_npi_clean := regexp_replace(p_npi, '[^0-9]', '', 'g');

    IF length(v_npi_clean) != 10 THEN
        RETURN FALSE;
    END IF;

    v_sum := 24;

    WHILE v_idx <= 9 LOOP
        v_digit := substring(v_npi_clean, v_idx, 1)::INTEGER;
        IF v_idx % 2 = 1 THEN
            v_digit := v_digit * 2;
            IF v_digit > 9 THEN
                v_digit := v_digit - 9;
            END IF;
        END IF;
        v_sum := v_sum + v_digit;
        v_idx := v_idx + 1;
    END LOOP;

    RETURN (10 - (v_sum % 10)) % 10 = substring(v_npi_clean, 10, 1)::INTEGER;
END;
$$;

-- ============================================================================
-- 4. Fix bulk_enroll_hospital_patients - use WHILE loop
-- ============================================================================
SELECT pg_temp.drop_func('bulk_enroll_hospital_patients');

CREATE OR REPLACE FUNCTION public.bulk_enroll_hospital_patients(
    p_patients JSONB,
    p_tenant_id UUID,
    p_enrolled_by UUID
)
RETURNS TABLE (
    patient_name TEXT,
    status TEXT,
    user_id UUID
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_patient JSONB;
    v_user_id UUID;
    v_count INTEGER;
    v_idx INTEGER := 0;
BEGIN
    v_count := jsonb_array_length(p_patients);

    WHILE v_idx < v_count LOOP
        v_patient := p_patients->v_idx;

        BEGIN
            INSERT INTO profiles (
                first_name,
                last_name,
                email,
                phone,
                dob,
                tenant_id,
                enrollment_type,
                enrolled_by,
                role_code,
                created_at
            ) VALUES (
                v_patient->>'first_name',
                v_patient->>'last_name',
                v_patient->>'email',
                v_patient->>'phone',
                (v_patient->>'date_of_birth')::DATE,
                p_tenant_id,
                'hospital',
                p_enrolled_by,
                1,
                NOW()
            )
            RETURNING profiles.user_id INTO v_user_id;

            patient_name := (v_patient->>'first_name') || ' ' || (v_patient->>'last_name');
            status := 'enrolled';
            user_id := v_user_id;
            RETURN NEXT;

        EXCEPTION WHEN OTHERS THEN
            patient_name := (v_patient->>'first_name') || ' ' || (v_patient->>'last_name');
            status := 'failed: ' || SQLERRM;
            user_id := NULL;
            RETURN NEXT;
        END;

        v_idx := v_idx + 1;
    END LOOP;
END;
$$;

-- ============================================================================
-- 5. Fix generate_totp_backup_codes - use WHILE loop
-- ============================================================================
SELECT pg_temp.drop_func('generate_totp_backup_codes');

CREATE OR REPLACE FUNCTION public.generate_totp_backup_codes(p_user_id UUID, p_count INTEGER DEFAULT 10)
RETURNS TEXT[] LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_codes TEXT[] := ARRAY[]::TEXT[];
    v_code TEXT;
    v_idx INTEGER := 1;
BEGIN
    WHILE v_idx <= p_count LOOP
        v_code := upper(substring(md5(random()::text || clock_timestamp()::text) for 8));
        v_codes := array_append(v_codes, v_code);
        v_idx := v_idx + 1;
    END LOOP;

    DELETE FROM totp_backup_codes WHERE user_id = p_user_id;

    FOREACH v_code IN ARRAY v_codes LOOP
        INSERT INTO totp_backup_codes (user_id, code_hash, created_at)
        VALUES (p_user_id, crypt(v_code, gen_salt('bf')), NOW());
    END LOOP;

    RETURN v_codes;
END;
$$;

-- ============================================================================
-- All application functions should now be clean
-- ============================================================================
