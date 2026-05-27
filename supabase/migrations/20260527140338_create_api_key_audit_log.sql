-- _APPLIED_20260527140338_create_api_key_audit_log.sql
--
-- API-3c — Self-Audit Session 6 wave 2 (continued)
--
-- Applied to live DB via Supabase MCP `apply_migration` on 2026-05-27
-- (version 20260527140338 in supabase_migrations.schema_migrations).
--
-- Creates public.api_key_audit_log: per-validation audit trail for the
-- external-partner API channel. Populated exclusively by the (future)
-- validate_api_key RPC (API-3d, SECURITY DEFINER).
--
-- Mirrors the SHAPE of mcp_key_audit_log but with external-channel concepts:
--   - tenant_id (mcp audit log has none; partner audit needs tenant-scoped read)
--   - caller_function (mcp uses server_name/tool_name/request_id which don't apply)
--   - validated_at (mcp uses created_at; "validated_at" is more precise)
--   - outcome enum: success/invalid/revoked/expired/scope_denied
--     (mcp uses success/denied/expired/revoked/scope_mismatch — slightly
--     different vocabulary for the partner channel)
--
-- Verified live state pre-migration via Supabase MCP execute_sql:
--   - mcp_key_audit_log: 11 columns, RLS on, INSERT service_role, SELECT
--     super_admin cross-tenant, ON DELETE CASCADE FK to mcp_keys
--   - api_keys.tenant_id has FK to tenants(id) ON DELETE RESTRICT
--   - mcp_key_audit_log convention: GRANT SELECT TO authenticated explicitly
--
-- Index strategy: tracker spec called for one index (api_key_id, validated_at
-- DESC). Adding a second on (tenant_id, validated_at DESC) because the primary
-- UI use case is "show all activity across all keys for my tenant" — without
-- this, the tenant-scoped RLS path does a sequential scan, which is fatal once
-- the table grows past trivial size.

CREATE TABLE IF NOT EXISTS public.api_key_audit_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id      UUID        NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  validated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  outcome         VARCHAR     NOT NULL,
  ip_address      INET,
  user_agent      TEXT,
  caller_function TEXT,
  CONSTRAINT api_key_audit_log_outcome_check
    CHECK (outcome IN ('success', 'invalid', 'revoked', 'expired', 'scope_denied'))
);

ALTER TABLE public.api_key_audit_log ENABLE ROW LEVEL SECURITY;

-- SELECT: tenant-scoped admin can read their own tenant's audit history.
DROP POLICY IF EXISTS api_key_audit_log_tenant_admin_read ON public.api_key_audit_log;
CREATE POLICY api_key_audit_log_tenant_admin_read ON public.api_key_audit_log
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_current_tenant_id()
    AND is_tenant_admin()
  );

-- INSERT: service_role only. The validate_api_key RPC (SECURITY DEFINER) is
-- the only intended writer. Direct INSERT by clients is rejected by RLS.
-- Note: service_role bypasses RLS so this policy is documentation-as-defense;
-- the practical effect is that authenticated/anon cannot INSERT.
DROP POLICY IF EXISTS api_key_audit_log_service_insert ON public.api_key_audit_log;
CREATE POLICY api_key_audit_log_service_insert ON public.api_key_audit_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_key_audit_log_api_key
  ON public.api_key_audit_log (api_key_id, validated_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_key_audit_log_tenant_time
  ON public.api_key_audit_log (tenant_id, validated_at DESC);

-- Permissions (mirror mcp_key_audit_log convention).
GRANT SELECT ON public.api_key_audit_log TO authenticated;

COMMENT ON TABLE public.api_key_audit_log IS
  'Audit trail of every api_key validation attempt. Populated exclusively by validate_api_key RPC (SECURITY DEFINER). Tenant-scoped admin read via RLS.';
COMMENT ON COLUMN public.api_key_audit_log.outcome IS
  'One of: success, invalid (key not found / hash mismatch), revoked (revoked_at set), expired (past expires_at), scope_denied (key lacks required scope).';
COMMENT ON COLUMN public.api_key_audit_log.caller_function IS
  'Edge function name that triggered the validation (e.g. "fhir-r4", "webhook-receiver"). Helps diagnose which partner integration generated activity.';
