-- =====================================================
-- P0-4: Secure execute_safe_query with Tenant Enforcement
-- Purpose: Add caller tenant verification to prevent cross-tenant query execution
-- Backward Compatible: New param defaults to NULL, existing callers unaffected
-- =====================================================

-- Drop existing function to add new parameter
-- (CREATE OR REPLACE cannot change parameter list)
DROP FUNCTION IF EXISTS public.execute_safe_query(TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.execute_safe_query(
  query_text TEXT,
  params JSONB DEFAULT '[]'::JSONB,
  p_caller_tenant_id UUID DEFAULT NULL
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
  query_tenant_id UUID;
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

  -- =====================================================
  -- P0-4: Tenant enforcement
  -- When a caller tenant is provided, verify that the query's
  -- first parameter (tenant_id) matches the caller's tenant.
  -- This prevents SECURITY DEFINER from being used to access
  -- another tenant's data via crafted tool arguments.
  -- =====================================================
  IF p_caller_tenant_id IS NOT NULL AND array_length(param_array, 1) > 0 THEN
    BEGIN
      query_tenant_id := param_array[1]::UUID;
      IF query_tenant_id IS DISTINCT FROM p_caller_tenant_id THEN
        -- Log the mismatch attempt
        BEGIN
          INSERT INTO mcp_query_logs (
            tool_name,
            query_name,
            success,
            error_message,
            tenant_id,
            created_at
          ) VALUES (
            'execute_safe_query',
            left(query_text, 100),
            false,
            format('Tenant mismatch: caller=%s query=%s', p_caller_tenant_id, query_tenant_id),
            p_caller_tenant_id,
            NOW()
          );
        EXCEPTION WHEN undefined_table THEN
          NULL; -- Table doesn't exist, skip logging
        END;

        RAISE EXCEPTION 'Tenant mismatch: caller tenant % does not match query tenant %',
          p_caller_tenant_id, query_tenant_id;
      END IF;
    EXCEPTION
      WHEN invalid_text_representation THEN
        -- First param is not a valid UUID — not a tenant_id, skip check
        NULL;
    END;
  END IF;

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
        tenant_id,
        created_at
      ) VALUES (
        'execute_safe_query',
        left(query_text, 100),
        false,
        SQLERRM,
        p_caller_tenant_id,
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
GRANT EXECUTE ON FUNCTION public.execute_safe_query(TEXT, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_safe_query(TEXT, JSONB, UUID) TO service_role;

COMMENT ON FUNCTION public.execute_safe_query IS
  'Safely execute parameterized SELECT queries for MCP. Validates patterns, prevents SQL injection, enforces tenant isolation when p_caller_tenant_id is provided. Returns JSONB.';
