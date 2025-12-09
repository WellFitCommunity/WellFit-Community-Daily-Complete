-- ============================================================================
-- FIX search_practitioners - use only columns that exist
-- ============================================================================

-- First ensure the columns exist
ALTER TABLE fhir_practitioners ADD COLUMN IF NOT EXISTS specialty_codes TEXT[];
ALTER TABLE fhir_practitioners ADD COLUMN IF NOT EXISTS specialty_display TEXT[];

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
        COALESCE(fp.specialty_display[1], fp.specialty_codes[1], fp.taxonomy_code)::TEXT as specialty,
        fp.npi,
        fp.email,
        fp.phone
    FROM fhir_practitioners fp
    WHERE (p_tenant_id IS NULL OR fp.tenant_id = p_tenant_id)
        AND (p_search_term IS NULL OR
             fp.family_name ILIKE '%' || p_search_term || '%' OR
             fp.given_names[1] ILIKE '%' || p_search_term || '%' OR
             fp.npi ILIKE '%' || p_search_term || '%')
        AND (p_specialty IS NULL OR
             p_specialty = ANY(fp.specialty_codes) OR
             p_specialty = ANY(fp.specialty_display) OR
             fp.taxonomy_code = p_specialty)
    ORDER BY fp.family_name, fp.given_names[1]
    LIMIT p_limit;
END;
$$;
