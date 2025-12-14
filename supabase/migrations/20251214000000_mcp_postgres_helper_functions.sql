-- =====================================================
-- MCP PostgreSQL Helper Functions Migration
-- Purpose: RPC functions for safe database operations via MCP
-- Fixes: execute_safe_query and get_table_columns missing
-- =====================================================

-- =====================================================
-- 1. EXECUTE_SAFE_QUERY FUNCTION
-- Purpose: Execute parameterized queries safely with audit logging
-- Security: SECURITY DEFINER with strict query validation
-- =====================================================

CREATE OR REPLACE FUNCTION public.execute_safe_query(
  query_text TEXT,
  params JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  param_array TEXT[];
  sanitized_query TEXT;
  i INTEGER;
BEGIN
  -- Security: Reject dangerous patterns
  IF query_text ~* '(drop|truncate|delete\s+from|update\s+.*\s+set|insert\s+into|alter|create|grant|revoke)'
     AND query_text !~* 'select' THEN
    RAISE EXCEPTION 'Query type not allowed: Only SELECT queries are permitted';
  END IF;

  -- Security: Reject multi-statement queries
  IF query_text ~ ';.*\S' THEN
    RAISE EXCEPTION 'Multi-statement queries are not allowed';
  END IF;

  -- Security: Reject common SQL injection patterns
  IF query_text ~* '(--|/\*|\*/|xp_|sp_|exec\s|execute\s)' THEN
    RAISE EXCEPTION 'Potentially dangerous SQL pattern detected';
  END IF;

  -- Convert JSONB params to array
  SELECT ARRAY(SELECT jsonb_array_elements_text(params))
  INTO param_array;

  -- Replace $N placeholders with properly quoted values
  sanitized_query := query_text;
  FOR i IN 1..array_length(param_array, 1) LOOP
    -- Use format() for proper quoting
    sanitized_query := regexp_replace(
      sanitized_query,
      '\$' || i::text || '(?![0-9])',
      quote_literal(param_array[i]),
      'g'
    );
  END LOOP;

  -- Execute and return as JSONB array
  EXECUTE 'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (' || sanitized_query || ') t'
  INTO result;

  RETURN result;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error to mcp_query_logs if table exists
    BEGIN
      INSERT INTO mcp_query_logs (
        tool_name,
        query_name,
        success,
        error_message,
        created_at
      ) VALUES (
        'execute_safe_query',
        left(query_text, 100),
        false,
        SQLERRM,
        NOW()
      );
    EXCEPTION WHEN undefined_table THEN
      -- Table doesn't exist, skip logging
      NULL;
    END;
    RAISE;
END;
$$;

-- Grant execute to authenticated and service role
GRANT EXECUTE ON FUNCTION public.execute_safe_query(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_safe_query(TEXT, JSONB) TO service_role;

COMMENT ON FUNCTION public.execute_safe_query IS
  'Execute parameterized SELECT queries safely for MCP PostgreSQL server. Validates query patterns and prevents SQL injection.';

-- =====================================================
-- 2. GET_TABLE_COLUMNS FUNCTION
-- Purpose: Return column schema information for allowed tables
-- Security: Whitelist of safe tables only
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_table_columns(
  p_table_name TEXT
)
RETURNS TABLE (
  column_name TEXT,
  data_type TEXT,
  is_nullable TEXT,
  column_default TEXT,
  ordinal_position INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, information_schema
AS $$
DECLARE
  safe_tables TEXT[] := ARRAY[
    'patients', 'encounters', 'claims', 'care_plans', 'care_tasks',
    'medications', 'allergies', 'sdoh_flags', 'referral_alerts',
    'beds', 'shift_handoffs', 'quality_measures', 'code_cpt',
    'code_icd10', 'code_hcpcs', 'questionnaire_responses',
    'profiles', 'check_ins', 'tenants', 'daily_wellness_checkin',
    'external_referral_sources', 'patient_referrals'
  ];
BEGIN
  -- Security: Only allow whitelisted tables
  IF NOT (p_table_name = ANY(safe_tables)) THEN
    RAISE EXCEPTION 'Table % is not accessible via this function', p_table_name;
  END IF;

  RETURN QUERY
  SELECT
    c.column_name::TEXT,
    c.data_type::TEXT,
    c.is_nullable::TEXT,
    c.column_default::TEXT,
    c.ordinal_position::INTEGER
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = p_table_name
  ORDER BY c.ordinal_position;
END;
$$;

-- Grant execute to authenticated and service role
GRANT EXECUTE ON FUNCTION public.get_table_columns(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_columns(TEXT) TO service_role;

COMMENT ON FUNCTION public.get_table_columns IS
  'Get column schema information for whitelisted tables. Used by MCP PostgreSQL server for schema introspection.';

-- =====================================================
-- 3. GET_TABLE_ROW_COUNT FUNCTION (BONUS)
-- Purpose: Get row count with optional tenant filter
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_table_row_count(
  p_table_name TEXT,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_tables TEXT[] := ARRAY[
    'patients', 'encounters', 'claims', 'care_plans', 'care_tasks',
    'medications', 'allergies', 'sdoh_flags', 'referral_alerts',
    'beds', 'shift_handoffs', 'quality_measures', 'questionnaire_responses',
    'profiles', 'check_ins', 'daily_wellness_checkin'
  ];
  row_count BIGINT;
  query_text TEXT;
BEGIN
  -- Security: Only allow whitelisted tables
  IF NOT (p_table_name = ANY(safe_tables)) THEN
    RAISE EXCEPTION 'Table % is not accessible via this function', p_table_name;
  END IF;

  -- Build count query
  query_text := 'SELECT COUNT(*) FROM ' || quote_ident(p_table_name);

  IF p_tenant_id IS NOT NULL THEN
    query_text := query_text || ' WHERE tenant_id = ' || quote_literal(p_tenant_id);
  END IF;

  EXECUTE query_text INTO row_count;

  RETURN row_count;
END;
$$;

-- Grant execute to authenticated and service role
GRANT EXECUTE ON FUNCTION public.get_table_row_count(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_row_count(TEXT, UUID) TO service_role;

COMMENT ON FUNCTION public.get_table_row_count IS
  'Get row count for whitelisted tables with optional tenant filter. Used by MCP PostgreSQL server.';

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON FUNCTION public.execute_safe_query IS
  'Safely execute parameterized SELECT queries for MCP. Validates patterns, prevents SQL injection, returns JSONB.';
COMMENT ON FUNCTION public.get_table_columns IS
  'Get column schema for whitelisted tables. Used by MCP PostgreSQL server for schema introspection.';
COMMENT ON FUNCTION public.get_table_row_count IS
  'Get row count for whitelisted tables. Supports tenant filtering.';
