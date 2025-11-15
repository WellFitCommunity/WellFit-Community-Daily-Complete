/**
 * AI Cost Tracking System
 *
 * Tracks AI usage (tokens, costs, requests) per user and per tenant
 * For Platform AI Cost Dashboard and Tenant AI Usage Dashboard
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

-- ============================================================================
-- AI USAGE LOGS
-- ============================================================================

/**
 * MCP usage logs - detailed tracking of every AI request
 * Note: Named mcp_usage_logs to match existing component queries
 */
CREATE TABLE IF NOT EXISTS mcp_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Request details
  request_type TEXT NOT NULL, -- 'chat', 'completion', 'embedding', 'image', 'audio'
  model TEXT NOT NULL, -- 'gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', etc.
  provider TEXT NOT NULL DEFAULT 'openai', -- 'openai', 'anthropic', etc.

  -- Usage metrics
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,

  -- Cost calculation
  cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0, -- Cost in USD with 6 decimal precision

  -- Context
  feature_context TEXT, -- 'scribe', 'guardian', 'care_assistant', 'sdoh_analysis', etc.
  endpoint TEXT, -- API endpoint that triggered this

  -- Metadata
  request_duration_ms INTEGER, -- How long the request took
  error_occurred BOOLEAN DEFAULT false,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_mcp_usage_logs_tenant_id ON mcp_usage_logs(tenant_id);
CREATE INDEX idx_mcp_usage_logs_user_id ON mcp_usage_logs(user_id);
CREATE INDEX idx_mcp_usage_logs_created_at ON mcp_usage_logs(created_at DESC);
CREATE INDEX idx_mcp_usage_logs_tenant_created ON mcp_usage_logs(tenant_id, created_at DESC);
CREATE INDEX idx_mcp_usage_logs_user_created ON mcp_usage_logs(user_id, created_at DESC);
CREATE INDEX idx_mcp_usage_logs_model ON mcp_usage_logs(model);
CREATE INDEX idx_mcp_usage_logs_feature_context ON mcp_usage_logs(feature_context);

COMMENT ON TABLE mcp_usage_logs IS 'Detailed MCP/AI usage tracking for cost monitoring and analytics';
COMMENT ON COLUMN mcp_usage_logs.cost_usd IS 'Calculated cost in USD based on token usage and model pricing';
COMMENT ON COLUMN mcp_usage_logs.feature_context IS 'Which feature triggered this AI request';

-- ============================================================================
-- AI COST SUMMARY (Materialized View Alternative)
-- ============================================================================

/**
 * Function to get AI cost summary for a tenant within a time range
 */
CREATE OR REPLACE FUNCTION get_tenant_ai_cost_summary(
  p_tenant_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  total_cost NUMERIC,
  total_tokens BIGINT,
  total_requests BIGINT,
  avg_cost_per_request NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(cost_usd), 0) AS total_cost,
    COALESCE(SUM(total_tokens), 0) AS total_tokens,
    COUNT(*)::BIGINT AS total_requests,
    CASE
      WHEN COUNT(*) > 0 THEN COALESCE(SUM(cost_usd), 0) / COUNT(*)
      ELSE 0
    END AS avg_cost_per_request
  FROM mcp_usage_logs
  WHERE tenant_id = p_tenant_id
    AND created_at >= p_start_date
    AND created_at <= p_end_date
    AND error_occurred = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

/**
 * Function to get top AI users for a tenant
 */
CREATE OR REPLACE FUNCTION get_top_ai_users(
  p_tenant_id UUID,
  p_limit INTEGER DEFAULT 5,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  user_id UUID,
  user_email TEXT,
  full_name TEXT,
  total_cost NUMERIC,
  total_tokens BIGINT,
  total_requests BIGINT,
  last_used TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.user_id,
    p.email AS user_email,
    p.full_name,
    SUM(l.cost_usd) AS total_cost,
    SUM(l.total_tokens) AS total_tokens,
    COUNT(*)::BIGINT AS total_requests,
    MAX(l.created_at) AS last_used
  FROM mcp_usage_logs l
  JOIN profiles p ON p.user_id = l.user_id
  WHERE l.tenant_id = p_tenant_id
    AND l.created_at >= p_start_date
    AND l.created_at <= p_end_date
    AND l.error_occurred = false
  GROUP BY l.user_id, p.email, p.full_name
  ORDER BY total_cost DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

/**
 * Function to get platform-wide AI costs (all tenants)
 * Super admin only
 */
CREATE OR REPLACE FUNCTION get_platform_ai_costs(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  tenant_id UUID,
  tenant_name TEXT,
  tenant_code TEXT,
  total_cost NUMERIC,
  total_tokens BIGINT,
  total_requests BIGINT,
  avg_cost_per_request NUMERIC
) AS $$
BEGIN
  -- Verify caller is super admin
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Super admin only';
  END IF;

  RETURN QUERY
  SELECT
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.tenant_code,
    COALESCE(SUM(l.cost_usd), 0) AS total_cost,
    COALESCE(SUM(l.total_tokens), 0) AS total_tokens,
    COUNT(l.id)::BIGINT AS total_requests,
    CASE
      WHEN COUNT(l.id) > 0 THEN COALESCE(SUM(l.cost_usd), 0) / COUNT(l.id)
      ELSE 0
    END AS avg_cost_per_request
  FROM tenants t
  LEFT JOIN mcp_usage_logs l ON l.tenant_id = t.id
    AND l.created_at >= p_start_date
    AND l.created_at <= p_end_date
    AND l.error_occurred = false
  GROUP BY t.id, t.name, t.tenant_code
  ORDER BY total_cost DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- HELPER FUNCTIONS FOR RLS
-- ============================================================================

/**
 * Get current user's tenant_id from profiles
 */
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT tenant_id
    FROM profiles
    WHERE user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- SECURITY POLICIES (RLS)
-- ============================================================================

ALTER TABLE mcp_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can see their own AI usage within their tenant
CREATE POLICY mcp_usage_logs_user_select
  ON mcp_usage_logs
  FOR SELECT
  USING (
    tenant_id = get_user_tenant_id()
    AND user_id = auth.uid()
  );

-- Admins can see all AI usage in their tenant
CREATE POLICY mcp_usage_logs_admin_select
  ON mcp_usage_logs
  FOR SELECT
  USING (
    tenant_id = get_user_tenant_id()
    AND is_admin()
  );

-- Super admins can see everything
CREATE POLICY mcp_usage_logs_super_admin_all
  ON mcp_usage_logs
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM super_admin_users WHERE is_active = true
    )
  );

-- System can insert AI usage logs (service role)
CREATE POLICY mcp_usage_logs_service_insert
  ON mcp_usage_logs
  FOR INSERT
  WITH CHECK (true); -- Service role has full access

COMMENT ON TABLE mcp_usage_logs IS 'MCP/AI usage tracking with RLS - users see own usage, admins see tenant usage, super admins see all';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION get_tenant_ai_cost_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_ai_users(UUID, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_platform_ai_costs(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
