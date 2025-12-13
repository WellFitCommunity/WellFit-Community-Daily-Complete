-- =====================================================
-- MCP FHIR Logging Table Migration
-- Purpose: Audit logging for FHIR MCP server operations
-- =====================================================

-- =====================================================
-- MCP FHIR Logs
-- =====================================================

CREATE TABLE IF NOT EXISTS mcp_fhir_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  tenant_id UUID,
  operation TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  success BOOLEAN DEFAULT true,
  execution_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for FHIR logs
CREATE INDEX IF NOT EXISTS idx_mcp_fhir_logs_user ON mcp_fhir_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_fhir_logs_tenant ON mcp_fhir_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mcp_fhir_logs_created ON mcp_fhir_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_fhir_logs_operation ON mcp_fhir_logs(operation);
CREATE INDEX IF NOT EXISTS idx_mcp_fhir_logs_resource_type ON mcp_fhir_logs(resource_type);

-- RLS for FHIR logs
ALTER TABLE mcp_fhir_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own FHIR logs" ON mcp_fhir_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to FHIR logs" ON mcp_fhir_logs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- Analytics Views
-- =====================================================

-- FHIR operations by resource type
CREATE OR REPLACE VIEW mcp_fhir_resource_usage AS
SELECT
  resource_type,
  operation,
  COUNT(*) as usage_count,
  AVG(execution_time_ms) as avg_execution_time_ms,
  COUNT(*) FILTER (WHERE success = false) as error_count
FROM mcp_fhir_logs
WHERE resource_type IS NOT NULL
GROUP BY resource_type, operation
ORDER BY usage_count DESC;

-- FHIR operations summary
CREATE OR REPLACE VIEW mcp_fhir_daily_usage AS
SELECT
  DATE_TRUNC('day', created_at) as date,
  operation,
  COUNT(*) as total_calls,
  COUNT(*) FILTER (WHERE success = true) as successful_calls,
  AVG(execution_time_ms) as avg_execution_time_ms
FROM mcp_fhir_logs
GROUP BY DATE_TRUNC('day', created_at), operation
ORDER BY date DESC, total_calls DESC;

-- Top FHIR operations
CREATE OR REPLACE VIEW mcp_fhir_top_operations AS
SELECT
  operation,
  COUNT(*) as usage_count,
  AVG(execution_time_ms) as avg_execution_time_ms,
  COUNT(*) FILTER (WHERE success = false) as error_count,
  COUNT(DISTINCT user_id) as unique_users
FROM mcp_fhir_logs
GROUP BY operation
ORDER BY usage_count DESC;

-- =====================================================
-- Update cleanup function to include FHIR logs
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_old_mcp_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM mcp_query_logs WHERE created_at < NOW() - INTERVAL '30 days';
  DELETE FROM mcp_function_logs WHERE created_at < NOW() - INTERVAL '30 days';
  DELETE FROM mcp_code_lookup_logs WHERE created_at < NOW() - INTERVAL '30 days';
  DELETE FROM mcp_fhir_logs WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON TABLE mcp_fhir_logs IS 'Audit logs for FHIR MCP server operations';
COMMENT ON VIEW mcp_fhir_resource_usage IS 'FHIR operations grouped by resource type';
COMMENT ON VIEW mcp_fhir_daily_usage IS 'Daily FHIR MCP usage statistics';
COMMENT ON VIEW mcp_fhir_top_operations IS 'Most frequently used FHIR MCP operations';
