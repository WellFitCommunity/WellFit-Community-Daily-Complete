-- Migration: Fix validate_mcp_key return type mismatch
-- Problem: Function declares RETURNS TABLE with key_name TEXT, but mcp_keys.name is VARCHAR(255)
-- PostgreSQL error: "structure of query does not match function result type"
-- "Returned type character varying(255) does not match expected type text in column 3."
-- Fix: Cast name to TEXT in all RETURN QUERY statements
-- Date: 2026-02-21

CREATE OR REPLACE FUNCTION public.validate_mcp_key(
    p_key_prefix VARCHAR(12),
    p_key_hash TEXT,
    p_required_scope TEXT DEFAULT NULL
)
RETURNS TABLE (
    valid BOOLEAN,
    key_id UUID,
    key_name TEXT,
    scopes TEXT[],
    tenant_id UUID,
    error_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key RECORD;
BEGIN
    -- Look up key by prefix and hash
    SELECT mk.* INTO v_key
    FROM mcp_keys mk
    WHERE mk.key_prefix = p_key_prefix
    AND mk.key_hash = p_key_hash;

    -- Key not found
    IF v_key IS NULL THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::TEXT[], NULL::UUID, 'key_not_found'::TEXT;
        RETURN;
    END IF;

    -- Key revoked
    IF v_key.revoked_at IS NOT NULL THEN
        RETURN QUERY SELECT false, v_key.id, v_key.name::TEXT, v_key.scopes, v_key.tenant_id, 'key_revoked'::TEXT;
        RETURN;
    END IF;

    -- Key expired
    IF v_key.expires_at IS NOT NULL AND v_key.expires_at < NOW() THEN
        RETURN QUERY SELECT false, v_key.id, v_key.name::TEXT, v_key.scopes, v_key.tenant_id, 'key_expired'::TEXT;
        RETURN;
    END IF;

    -- Scope check (if required)
    IF p_required_scope IS NOT NULL AND NOT (p_required_scope = ANY(v_key.scopes)) THEN
        RETURN QUERY SELECT false, v_key.id, v_key.name::TEXT, v_key.scopes, v_key.tenant_id, 'scope_mismatch'::TEXT;
        RETURN;
    END IF;

    -- Update usage stats
    UPDATE mcp_keys SET
        last_used_at = NOW(),
        use_count = use_count + 1
    WHERE id = v_key.id;

    -- Return success
    RETURN QUERY SELECT true, v_key.id, v_key.name::TEXT, v_key.scopes, v_key.tenant_id, NULL::TEXT;
END;
$$;

-- Ensure grants remain
GRANT EXECUTE ON FUNCTION public.validate_mcp_key TO service_role;
