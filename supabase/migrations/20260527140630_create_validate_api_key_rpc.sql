-- _APPLIED_20260527140630_create_validate_api_key_rpc.sql
--
-- API-3d — Self-Audit Session 6 wave 2 (continued)
--
-- Applied to live DB via Supabase MCP `apply_migration` on 2026-05-27
-- (version 20260527140630 in supabase_migrations.schema_migrations).
--
-- Creates public.validate_api_key RPC: SECURITY DEFINER validation +
-- usage tracking + audit logging for the external-partner API channel.
--
-- Mirrors validate_mcp_key (verified live via pg_get_functiondef) with three
-- intentional deviations:
--   1. AUDITS inside the RPC. validate_mcp_key does not audit;
--      mcp_key_audit_log writes happen elsewhere. The whole point of API-3c
--      was to give the external channel a first-class audit trail, so this
--      RPC writes one row per validation attempt (except key_not_found,
--      where there's no api_key_id/tenant_id to reference — callers should
--      log unknown-key attempts to the general audit_logs table).
--   2. Adds p_ip_address / p_user_agent / p_caller_function params so the
--      audit row captures full request context.
--   3. p_key_hash is the required arg; p_key_prefix is optional. Legacy keys
--      have no prefix (column is nullable until API-3i backfill). The lookup
--      filters by prefix only when supplied.
--
-- Future extension points (NO-OP today, wired in Session B):
--   - p_required_scope: accepted for forward-compat but ignored. When API-3j
--     lands the scopes column, add scope-mismatch handling that returns
--     valid=false, error_reason='scope_denied', and audits as 'scope_denied'.
--   - expires_at check: not yet possible (column doesn't exist). When API-3h
--     adds expires_at, insert an expiration check that returns
--     valid=false, error_reason='expired', and audits as 'expired'.
--
-- Verified live state pre-migration via Supabase MCP execute_sql:
--   - api_keys columns now include {last_used_at, use_count, key_prefix,
--     revocation_reason} (API-3b applied at version 20260527135915)
--   - api_key_audit_log exists with FK to api_keys ON DELETE CASCADE
--     (API-3c applied at version 20260527140338)
--   - validate_mcp_key signature: (key_prefix, key_hash, required_scope DEFAULT NULL)
--   - mcp pattern returns a TABLE row even on failure (with valid=false +
--     error_reason); we follow the same pattern, not the tracker's literal
--     phrase "Returns NULL or raises EXCEPTION on failure" — the codebase
--     standard is TABLE-with-valid-bool.

CREATE OR REPLACE FUNCTION public.validate_api_key(
  p_key_hash         text,
  p_key_prefix       text DEFAULT NULL,
  p_required_scope   text DEFAULT NULL,
  p_ip_address       inet DEFAULT NULL,
  p_user_agent       text DEFAULT NULL,
  p_caller_function  text DEFAULT NULL
)
RETURNS TABLE (
  valid         boolean,
  key_id        uuid,
  tenant_id     uuid,
  error_reason  text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key RECORD;
BEGIN
  -- Required arg validation.
  IF p_key_hash IS NULL OR length(p_key_hash) = 0 THEN
    RAISE EXCEPTION 'validate_api_key: p_key_hash is required';
  END IF;

  -- Lookup: hash always matches; prefix filters only when supplied.
  SELECT ak.* INTO v_key
  FROM api_keys ak
  WHERE ak.key_hash = p_key_hash
    AND (p_key_prefix IS NULL OR ak.key_prefix = p_key_prefix);

  -- Not found. No api_key_id / tenant_id to write an audit row.
  -- Caller logs unknown-key attempts to general audit_logs table.
  IF v_key.id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, 'invalid'::text;
    RETURN;
  END IF;

  -- Revoked.
  IF v_key.revoked_at IS NOT NULL THEN
    INSERT INTO api_key_audit_log (
      api_key_id, tenant_id, outcome, ip_address, user_agent, caller_function
    ) VALUES (
      v_key.id, v_key.tenant_id, 'revoked', p_ip_address, p_user_agent, p_caller_function
    );
    RETURN QUERY SELECT false, v_key.id, v_key.tenant_id, 'revoked'::text;
    RETURN;
  END IF;

  -- Expiration check — NO-OP until API-3h adds expires_at column.
  -- When API-3h lands, insert here:
  --   IF v_key.expires_at IS NOT NULL AND v_key.expires_at < NOW() THEN
  --     INSERT INTO api_key_audit_log (..., outcome='expired', ...);
  --     RETURN QUERY SELECT false, v_key.id, v_key.tenant_id, 'expired'::text;
  --     RETURN;
  --   END IF;

  -- Scope check — NO-OP until API-3j adds scopes column.
  -- p_required_scope accepted now for forward-compat. When API-3j lands:
  --   IF p_required_scope IS NOT NULL AND NOT (p_required_scope = ANY(v_key.scopes)) THEN
  --     INSERT INTO api_key_audit_log (..., outcome='scope_denied', ...);
  --     RETURN QUERY SELECT false, v_key.id, v_key.tenant_id, 'scope_denied'::text;
  --     RETURN;
  --   END IF;

  -- Success: bump tracking, write audit row, return.
  UPDATE api_keys
  SET use_count    = use_count + 1,
      last_used_at = NOW()
  WHERE id = v_key.id;

  INSERT INTO api_key_audit_log (
    api_key_id, tenant_id, outcome, ip_address, user_agent, caller_function
  ) VALUES (
    v_key.id, v_key.tenant_id, 'success', p_ip_address, p_user_agent, p_caller_function
  );

  RETURN QUERY SELECT true, v_key.id, v_key.tenant_id, NULL::text;
END;
$$;

COMMENT ON FUNCTION public.validate_api_key(text, text, text, inet, text, text) IS
  'Validate external-partner API key. Looks up by hash (+ optional prefix), checks revocation, bumps use_count/last_used_at, writes api_key_audit_log row. Returns TABLE(valid, key_id, tenant_id, error_reason). API-3d.';

-- Lock down execution: only service_role calls this RPC. Edge functions
-- using service_role key (or the validate-api-key edge fn with SECURITY DEFINER
-- semantics via the wrapper) will be the only callers.
REVOKE EXECUTE ON FUNCTION public.validate_api_key(text, text, text, inet, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_api_key(text, text, text, inet, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_api_key(text, text, text, inet, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.validate_api_key(text, text, text, inet, text, text) TO service_role;
