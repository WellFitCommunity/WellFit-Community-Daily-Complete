-- =====================================================
-- Unified MCP Audit Log Table (P2-4)
-- Purpose: Single audit table for all MCP server operations
-- replacing per-server tables (mcp_query_logs, mcp_fhir_logs,
-- mcp_function_logs, mcp_transformation_logs) with one
-- consistent schema.
-- =====================================================

CREATE TABLE IF NOT EXISTS mcp_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_name TEXT NOT NULL,          -- e.g., 'mcp-fhir-server', 'mcp-postgres-server'
  tool_name TEXT NOT NULL,            -- e.g., 'get_resource', 'execute_query'
  request_id TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT,                       -- caller user ID (from JWT)
  tenant_id TEXT,                     -- caller tenant ID (from identity)
  auth_method TEXT,                   -- 'jwt', 'mcp_key', 'anon'
  execution_time_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::JSONB, -- server-specific data (resource_type, query_name, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for common query patterns
CREATE INDEX IF NOT EXISTS idx_mcp_audit_logs_server_created
  ON mcp_audit_logs (server_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mcp_audit_logs_tenant_created
  ON mcp_audit_logs (tenant_id, created_at DESC)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mcp_audit_logs_user_created
  ON mcp_audit_logs (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mcp_audit_logs_success
  ON mcp_audit_logs (success, created_at DESC)
  WHERE success = false;

-- RLS: service role only (MCP servers write with service role)
ALTER TABLE mcp_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on mcp_audit_logs"
  ON mcp_audit_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admin read access (for health dashboard)
CREATE POLICY "Admins can read mcp_audit_logs"
  ON mcp_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
  );

-- Retention: auto-delete after 90 days (scheduled via pg_cron if available)
COMMENT ON TABLE mcp_audit_logs IS 'Unified audit trail for all MCP server operations. Retention: 90 days.';
