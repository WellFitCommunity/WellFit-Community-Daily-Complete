-- Migration: Create MCP Keys Table for Machine-to-Machine Authentication
-- Purpose: Dedicated table for MCP server API keys with scopes and revocation support
-- Date: 2026-01-31

-- Create MCP keys table
CREATE TABLE IF NOT EXISTS public.mcp_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Key identification
    key_hash TEXT NOT NULL,                    -- SHA-256 hash of the key
    key_prefix VARCHAR(12) NOT NULL,           -- First 8 chars of key for identification (mcp_xxxx)
    name VARCHAR(255) NOT NULL,                -- Friendly name for the key
    description TEXT,                          -- Optional description

    -- Scopes and permissions
    scopes TEXT[] NOT NULL DEFAULT '{}',       -- Array of scopes: 'mcp:admin', 'mcp:fhir', 'mcp:prior_auth', etc.

    -- Ownership and multi-tenant isolation
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Lifecycle management
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,                    -- NULL = never expires
    revoked_at TIMESTAMPTZ,                    -- NULL = active, set = revoked
    revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    revocation_reason TEXT,

    -- Usage tracking
    last_used_at TIMESTAMPTZ,
    use_count BIGINT NOT NULL DEFAULT 0,

    -- Constraints
    CONSTRAINT mcp_keys_key_prefix_unique UNIQUE (key_prefix),
    CONSTRAINT mcp_keys_scopes_not_empty CHECK (array_length(scopes, 1) > 0 OR scopes = '{}')
);

-- Index for fast key lookup by prefix (used during validation)
CREATE INDEX IF NOT EXISTS idx_mcp_keys_prefix ON public.mcp_keys(key_prefix) WHERE revoked_at IS NULL;

-- Index for tenant isolation
CREATE INDEX IF NOT EXISTS idx_mcp_keys_tenant ON public.mcp_keys(tenant_id) WHERE revoked_at IS NULL;

-- Index for listing active keys
CREATE INDEX IF NOT EXISTS idx_mcp_keys_active ON public.mcp_keys(created_at DESC) WHERE revoked_at IS NULL;

-- Add comment
COMMENT ON TABLE public.mcp_keys IS 'Machine-to-machine API keys for MCP server authentication. Keys are hashed at rest.';
COMMENT ON COLUMN public.mcp_keys.key_hash IS 'SHA-256 hash of the actual key. The raw key is never stored.';
COMMENT ON COLUMN public.mcp_keys.key_prefix IS 'First 12 characters of the key (e.g., mcp_abc12345) for identification in logs.';
COMMENT ON COLUMN public.mcp_keys.scopes IS 'Array of permission scopes. Examples: mcp:admin, mcp:fhir, mcp:prior_auth, mcp:read_only';

-- RLS policies
ALTER TABLE public.mcp_keys ENABLE ROW LEVEL SECURITY;

-- Only super_admin can manage MCP keys
CREATE POLICY mcp_keys_super_admin_all ON public.mcp_keys
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.user_id = auth.uid()
            AND r.name = 'super_admin'
        )
    );

-- Service role can read for validation (used by edge functions)
CREATE POLICY mcp_keys_service_read ON public.mcp_keys
    FOR SELECT
    TO service_role
    USING (true);

-- Create audit log table for MCP key usage
CREATE TABLE IF NOT EXISTS public.mcp_key_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id UUID NOT NULL REFERENCES public.mcp_keys(id) ON DELETE CASCADE,
    key_prefix VARCHAR(12) NOT NULL,

    -- Request context
    request_id VARCHAR(64) NOT NULL,
    server_name VARCHAR(100) NOT NULL,
    tool_name VARCHAR(100),

    -- Outcome
    outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('success', 'denied', 'expired', 'revoked', 'scope_mismatch')),
    error_message TEXT,

    -- Metadata
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying by key
CREATE INDEX IF NOT EXISTS idx_mcp_key_audit_key ON public.mcp_key_audit_log(key_id, created_at DESC);

-- Index for querying by time
CREATE INDEX IF NOT EXISTS idx_mcp_key_audit_time ON public.mcp_key_audit_log(created_at DESC);

-- RLS for audit log
ALTER TABLE public.mcp_key_audit_log ENABLE ROW LEVEL SECURITY;

-- Super admins can read audit logs
CREATE POLICY mcp_key_audit_super_admin_read ON public.mcp_key_audit_log
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.user_id = auth.uid()
            AND r.name = 'super_admin'
        )
    );

-- Service role can insert audit logs
CREATE POLICY mcp_key_audit_service_insert ON public.mcp_key_audit_log
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Function to validate an MCP key and update usage stats
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
        RETURN QUERY SELECT false, v_key.id, v_key.name, v_key.scopes, v_key.tenant_id, 'key_revoked'::TEXT;
        RETURN;
    END IF;

    -- Key expired
    IF v_key.expires_at IS NOT NULL AND v_key.expires_at < NOW() THEN
        RETURN QUERY SELECT false, v_key.id, v_key.name, v_key.scopes, v_key.tenant_id, 'key_expired'::TEXT;
        RETURN;
    END IF;

    -- Scope check (if required)
    IF p_required_scope IS NOT NULL AND NOT (p_required_scope = ANY(v_key.scopes)) THEN
        RETURN QUERY SELECT false, v_key.id, v_key.name, v_key.scopes, v_key.tenant_id, 'scope_mismatch'::TEXT;
        RETURN;
    END IF;

    -- Update usage stats
    UPDATE mcp_keys SET
        last_used_at = NOW(),
        use_count = use_count + 1
    WHERE id = v_key.id;

    -- Return success
    RETURN QUERY SELECT true, v_key.id, v_key.name, v_key.scopes, v_key.tenant_id, NULL::TEXT;
END;
$$;

-- Grant execute to service_role
GRANT EXECUTE ON FUNCTION public.validate_mcp_key TO service_role;

-- Function to create a new MCP key (returns the raw key ONCE)
CREATE OR REPLACE FUNCTION public.create_mcp_key(
    p_name VARCHAR(255),
    p_scopes TEXT[],
    p_tenant_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    key_id UUID,
    raw_key TEXT,
    key_prefix VARCHAR(12)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_raw_key TEXT;
    v_prefix VARCHAR(12);
    v_hash TEXT;
    v_id UUID;
BEGIN
    -- Verify caller is super_admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.user_id = auth.uid()
        AND r.name = 'super_admin'
    ) THEN
        RAISE EXCEPTION 'Only super_admin can create MCP keys';
    END IF;

    -- Generate key: mcp_ + 32 random hex chars
    v_raw_key := 'mcp_' || encode(gen_random_bytes(16), 'hex');
    v_prefix := substring(v_raw_key from 1 for 12);
    v_hash := encode(digest(v_raw_key, 'sha256'), 'hex');

    -- Insert key
    INSERT INTO mcp_keys (
        key_hash, key_prefix, name, description, scopes,
        created_by, tenant_id, expires_at
    ) VALUES (
        v_hash, v_prefix, p_name, p_description, p_scopes,
        auth.uid(), p_tenant_id, p_expires_at
    )
    RETURNING id INTO v_id;

    -- Return the raw key (only time it's ever returned)
    RETURN QUERY SELECT v_id, v_raw_key, v_prefix;
END;
$$;

-- Grant execute to authenticated users (RLS will restrict to super_admin)
GRANT EXECUTE ON FUNCTION public.create_mcp_key TO authenticated;

-- Function to revoke an MCP key
CREATE OR REPLACE FUNCTION public.revoke_mcp_key(
    p_key_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify caller is super_admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.user_id = auth.uid()
        AND r.name = 'super_admin'
    ) THEN
        RAISE EXCEPTION 'Only super_admin can revoke MCP keys';
    END IF;

    -- Revoke the key
    UPDATE mcp_keys SET
        revoked_at = NOW(),
        revoked_by = auth.uid(),
        revocation_reason = p_reason
    WHERE id = p_key_id
    AND revoked_at IS NULL;

    RETURN FOUND;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.revoke_mcp_key TO authenticated;

-- Grant table access
GRANT SELECT ON public.mcp_keys TO authenticated;
GRANT SELECT, INSERT ON public.mcp_key_audit_log TO service_role;
GRANT SELECT ON public.mcp_key_audit_log TO authenticated;
