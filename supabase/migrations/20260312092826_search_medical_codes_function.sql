-- ============================================================================
-- search_medical_codes — Full-text search across CPT, ICD-10, HCPCS
-- ============================================================================
-- Leverages existing GIN/tsvector indexes on code_cpt, code_icd10, code_hcpcs.
-- Returns unified results ranked by relevance.
-- Used by GlobalSearchBar for medical code search.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.search_medical_codes(
    p_query TEXT,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    code TEXT,
    code_system TEXT,
    description TEXT,
    category TEXT,
    relevance REAL
)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
DECLARE
    tsq tsquery;
BEGIN
    -- Build tsquery from user input (handles multi-word, partial matches)
    -- Use plainto_tsquery for natural language input, then also do ILIKE fallback
    tsq := plainto_tsquery('english', p_query);

    RETURN QUERY
    (
        -- CPT codes (full-text match)
        SELECT
            c.code,
            'CPT'::TEXT AS code_system,
            COALESCE(c.short_description, c.description, c.short_desc, '')::TEXT AS description,
            COALESCE(c.category, '')::TEXT AS category,
            ts_rank(
                to_tsvector('english', COALESCE(c.short_description, '') || ' ' || COALESCE(c.long_description, '')),
                tsq
            ) AS relevance
        FROM code_cpt c
        WHERE
            to_tsvector('english', COALESCE(c.short_description, '') || ' ' || COALESCE(c.long_description, '')) @@ tsq
            OR c.code ILIKE ('%' || p_query || '%')
        LIMIT p_limit
    )
    UNION ALL
    (
        -- ICD-10 codes (full-text match)
        SELECT
            i.code,
            'ICD-10'::TEXT AS code_system,
            COALESCE(i.description, i."desc", '')::TEXT AS description,
            COALESCE(i.category, i.chapter, '')::TEXT AS category,
            ts_rank(
                to_tsvector('english', COALESCE(i.description, '')),
                tsq
            ) AS relevance
        FROM code_icd10 i
        WHERE
            to_tsvector('english', COALESCE(i.description, '')) @@ tsq
            OR i.code ILIKE ('%' || p_query || '%')
        LIMIT p_limit
    )
    UNION ALL
    (
        -- HCPCS codes (full-text match)
        SELECT
            h.code,
            'HCPCS'::TEXT AS code_system,
            COALESCE(h.short_description, h."desc", '')::TEXT AS description,
            COALESCE(h.category, '')::TEXT AS category,
            ts_rank(
                to_tsvector('english', COALESCE(h.short_description, '') || ' ' || COALESCE(h.long_description, '')),
                tsq
            ) AS relevance
        FROM code_hcpcs h
        WHERE
            to_tsvector('english', COALESCE(h.short_description, '') || ' ' || COALESCE(h.long_description, '')) @@ tsq
            OR h.code ILIKE ('%' || p_query || '%')
        LIMIT p_limit
    )
    ORDER BY relevance DESC
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.search_medical_codes IS 'Full-text search across CPT, ICD-10, HCPCS code tables. Used by GlobalSearchBar.';
