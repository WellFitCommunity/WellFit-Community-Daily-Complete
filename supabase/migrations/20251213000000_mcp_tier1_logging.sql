-- =====================================================
-- MCP Tier 1 Logging Tables Migration
-- Purpose: Audit logging for PostgreSQL, Edge Functions, and Medical Codes MCP servers
-- =====================================================

-- =====================================================
-- MCP Query Logs (PostgreSQL MCP)
-- =====================================================

CREATE TABLE IF NOT EXISTS mcp_query_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  tenant_id UUID,
  tool_name TEXT NOT NULL,
  query_name TEXT,
  rows_returned INTEGER DEFAULT 0,
  execution_time_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for query logs
CREATE INDEX IF NOT EXISTS idx_mcp_query_logs_user ON mcp_query_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_query_logs_tenant ON mcp_query_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mcp_query_logs_created ON mcp_query_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_query_logs_query ON mcp_query_logs(query_name);

-- RLS for query logs
ALTER TABLE mcp_query_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own query logs" ON mcp_query_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to query logs" ON mcp_query_logs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- MCP Function Logs (Edge Functions MCP)
-- =====================================================

CREATE TABLE IF NOT EXISTS mcp_function_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  tenant_id UUID,
  function_name TEXT NOT NULL,
  success BOOLEAN DEFAULT true,
  execution_time_ms INTEGER,
  error_message TEXT,
  payload_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for function logs
CREATE INDEX IF NOT EXISTS idx_mcp_function_logs_user ON mcp_function_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_function_logs_tenant ON mcp_function_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mcp_function_logs_created ON mcp_function_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_function_logs_function ON mcp_function_logs(function_name);

-- RLS for function logs
ALTER TABLE mcp_function_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own function logs" ON mcp_function_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to function logs" ON mcp_function_logs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- MCP Code Lookup Logs (Medical Codes MCP)
-- =====================================================

CREATE TABLE IF NOT EXISTS mcp_code_lookup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  tool_name TEXT NOT NULL,
  search_query TEXT,
  codes_returned INTEGER DEFAULT 0,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for code lookup logs
CREATE INDEX IF NOT EXISTS idx_mcp_code_logs_user ON mcp_code_lookup_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_code_logs_created ON mcp_code_lookup_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_code_logs_tool ON mcp_code_lookup_logs(tool_name);

-- RLS for code lookup logs
ALTER TABLE mcp_code_lookup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own code lookup logs" ON mcp_code_lookup_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to code lookup logs" ON mcp_code_lookup_logs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- Analytics Views
-- =====================================================

-- Daily MCP usage summary
CREATE OR REPLACE VIEW mcp_daily_usage AS
SELECT
  DATE_TRUNC('day', created_at) as date,
  'query' as mcp_type,
  COUNT(*) as total_calls,
  COUNT(*) FILTER (WHERE success = true) as successful_calls,
  AVG(execution_time_ms) as avg_execution_time_ms,
  SUM(rows_returned) as total_rows
FROM mcp_query_logs
GROUP BY DATE_TRUNC('day', created_at)
UNION ALL
SELECT
  DATE_TRUNC('day', created_at) as date,
  'function' as mcp_type,
  COUNT(*) as total_calls,
  COUNT(*) FILTER (WHERE success = true) as successful_calls,
  AVG(execution_time_ms) as avg_execution_time_ms,
  NULL as total_rows
FROM mcp_function_logs
GROUP BY DATE_TRUNC('day', created_at)
UNION ALL
SELECT
  DATE_TRUNC('day', created_at) as date,
  'code_lookup' as mcp_type,
  COUNT(*) as total_calls,
  COUNT(*) as successful_calls, -- code lookups don't fail
  AVG(execution_time_ms) as avg_execution_time_ms,
  SUM(codes_returned) as total_rows
FROM mcp_code_lookup_logs
GROUP BY DATE_TRUNC('day', created_at);

-- Top queries by usage
CREATE OR REPLACE VIEW mcp_top_queries AS
SELECT
  query_name,
  COUNT(*) as usage_count,
  AVG(execution_time_ms) as avg_execution_time_ms,
  AVG(rows_returned) as avg_rows_returned,
  COUNT(*) FILTER (WHERE success = false) as error_count
FROM mcp_query_logs
WHERE query_name IS NOT NULL
GROUP BY query_name
ORDER BY usage_count DESC;

-- Top functions by usage
CREATE OR REPLACE VIEW mcp_top_functions AS
SELECT
  function_name,
  COUNT(*) as usage_count,
  AVG(execution_time_ms) as avg_execution_time_ms,
  COUNT(*) FILTER (WHERE success = false) as error_count,
  AVG(payload_size) as avg_payload_size
FROM mcp_function_logs
GROUP BY function_name
ORDER BY usage_count DESC;

-- Top code lookups by usage
CREATE OR REPLACE VIEW mcp_top_code_lookups AS
SELECT
  tool_name,
  COUNT(*) as usage_count,
  AVG(execution_time_ms) as avg_execution_time_ms,
  AVG(codes_returned) as avg_codes_returned
FROM mcp_code_lookup_logs
GROUP BY tool_name
ORDER BY usage_count DESC;

-- =====================================================
-- Cleanup function for old logs (30 day retention)
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
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION cleanup_old_mcp_logs() TO service_role;

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON TABLE mcp_query_logs IS 'Audit logs for PostgreSQL MCP server queries';
COMMENT ON TABLE mcp_function_logs IS 'Audit logs for Edge Functions MCP server invocations';
COMMENT ON TABLE mcp_code_lookup_logs IS 'Audit logs for Medical Codes MCP server lookups';
COMMENT ON VIEW mcp_daily_usage IS 'Daily aggregated MCP usage statistics';
COMMENT ON VIEW mcp_top_queries IS 'Most frequently used PostgreSQL MCP queries';
COMMENT ON VIEW mcp_top_functions IS 'Most frequently invoked Edge Functions via MCP';
COMMENT ON VIEW mcp_top_code_lookups IS 'Most frequently used Medical Code lookup tools';
