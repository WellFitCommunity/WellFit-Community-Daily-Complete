-- Agent Health Monitoring Schema
-- Tracks health status of all agents in the framework
-- Copyright (c) 2026 Envision VirtualEdge Group LLC. All rights reserved.

-- =============================================================================
-- AGENT REGISTRY
-- =============================================================================

-- Agent registry table
CREATE TABLE IF NOT EXISTS public.agent_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL UNIQUE,
  agent_type text NOT NULL CHECK (agent_type IN ('system', 'domain', 'business', 'mcp')),
  endpoint text NOT NULL,
  is_critical boolean DEFAULT false,
  health_check_interval_seconds integer DEFAULT 60,
  max_consecutive_failures integer DEFAULT 3,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add comment for documentation
COMMENT ON TABLE public.agent_registry IS 'Registry of all agents in the orchestration framework';
COMMENT ON COLUMN public.agent_registry.agent_type IS 'system=core infrastructure, domain=business domain, business=enterprise logic, mcp=MCP server';
COMMENT ON COLUMN public.agent_registry.is_critical IS 'If true, failures trigger immediate alerts';

-- =============================================================================
-- HEALTH CHECK RESULTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.agent_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.agent_registry(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'unreachable')),
  response_time_ms integer,
  error_message text,
  metadata jsonb DEFAULT '{}',
  checked_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.agent_health_checks IS 'Historical health check results for agents';

-- =============================================================================
-- AGENT INCIDENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.agent_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.agent_registry(id) ON DELETE CASCADE,
  incident_type text NOT NULL CHECK (incident_type IN ('failure', 'timeout', 'degraded', 'recovered')),
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  message text NOT NULL,
  metadata jsonb DEFAULT '{}',
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.agent_incidents IS 'Incidents (failures requiring attention) for agents';

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Index for quick health lookups by agent and time
CREATE INDEX IF NOT EXISTS idx_agent_health_checks_agent_time
  ON public.agent_health_checks(agent_id, checked_at DESC);

-- Index for finding unresolved incidents
CREATE INDEX IF NOT EXISTS idx_agent_incidents_unresolved
  ON public.agent_incidents(agent_id) WHERE resolved_at IS NULL;

-- Index for agent lookups by name
CREATE INDEX IF NOT EXISTS idx_agent_registry_name
  ON public.agent_registry(agent_name);

-- Index for finding critical agents
CREATE INDEX IF NOT EXISTS idx_agent_registry_critical
  ON public.agent_registry(is_critical) WHERE is_critical = true;

-- =============================================================================
-- DEFAULT AGENTS
-- =============================================================================

-- Insert default agents (on conflict do nothing to be idempotent)
INSERT INTO public.agent_registry (agent_name, agent_type, endpoint, is_critical, health_check_interval_seconds)
VALUES
  ('guardian-agent', 'system', 'guardian-agent', true, 30),
  ('bed-management', 'domain', 'bed-management', true, 60),
  ('bed-optimizer', 'domain', 'bed-optimizer', false, 120),
  ('bed-capacity-monitor', 'domain', 'bed-capacity-monitor', true, 60),
  ('mcp-fhir-server', 'mcp', 'mcp-fhir-server', true, 60),
  ('mcp-clearinghouse-server', 'mcp', 'mcp-clearinghouse-server', false, 120),
  ('mcp-medical-codes-server', 'mcp', 'mcp-medical-codes-server', false, 120),
  ('mcp-npi-server', 'mcp', 'mcp-npi-server', false, 120),
  ('agent-orchestrator', 'system', 'agent-orchestrator', true, 30),
  ('health-monitor', 'system', 'health-monitor', true, 30)
ON CONFLICT (agent_name) DO NOTHING;

-- =============================================================================
-- HEALTH SUMMARY FUNCTION
-- =============================================================================

-- Function to get agent health summary (aggregates recent data)
CREATE OR REPLACE FUNCTION get_agent_health_summary()
RETURNS TABLE (
  agent_name text,
  agent_type text,
  is_critical boolean,
  current_status text,
  last_check timestamptz,
  avg_response_time_ms numeric,
  failure_count_24h bigint,
  has_open_incident boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ar.agent_name,
    ar.agent_type,
    ar.is_critical,
    COALESCE(latest.status, 'unknown') as current_status,
    latest.checked_at as last_check,
    COALESCE(stats.avg_response_time, 0) as avg_response_time_ms,
    COALESCE(stats.failure_count, 0) as failure_count_24h,
    EXISTS(
      SELECT 1 FROM agent_incidents ai
      WHERE ai.agent_id = ar.id AND ai.resolved_at IS NULL
    ) as has_open_incident
  FROM agent_registry ar
  LEFT JOIN LATERAL (
    SELECT ahc.status, ahc.checked_at
    FROM agent_health_checks ahc
    WHERE ahc.agent_id = ar.id
    ORDER BY ahc.checked_at DESC
    LIMIT 1
  ) latest ON true
  LEFT JOIN LATERAL (
    SELECT
      AVG(ahc.response_time_ms)::numeric as avg_response_time,
      COUNT(*) FILTER (WHERE ahc.status IN ('unhealthy', 'unreachable')) as failure_count
    FROM agent_health_checks ahc
    WHERE ahc.agent_id = ar.id
      AND ahc.checked_at > now() - interval '24 hours'
  ) stats ON true
  ORDER BY ar.is_critical DESC, ar.agent_name;
END;
$$;

COMMENT ON FUNCTION get_agent_health_summary() IS 'Returns aggregated health summary for all registered agents';

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.agent_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_incidents ENABLE ROW LEVEL SECURITY;

-- Service role has full access (these are system tables)
CREATE POLICY "Service role full access on agent_registry"
  ON public.agent_registry
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on agent_health_checks"
  ON public.agent_health_checks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on agent_incidents"
  ON public.agent_incidents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read (for admin dashboards)
CREATE POLICY "Authenticated users can read agent_registry"
  ON public.agent_registry
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read agent_health_checks"
  ON public.agent_health_checks
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read agent_incidents"
  ON public.agent_incidents
  FOR SELECT
  TO authenticated
  USING (true);

-- =============================================================================
-- CLEANUP FUNCTION (for maintenance)
-- =============================================================================

-- Function to clean up old health checks (keep last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_health_checks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM agent_health_checks
  WHERE checked_at < now() - interval '7 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_old_health_checks() IS 'Deletes health check records older than 7 days';

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================

-- Trigger to update updated_at on agent_registry changes
CREATE OR REPLACE FUNCTION update_agent_registry_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_agent_registry_updated_at ON public.agent_registry;
CREATE TRIGGER trigger_update_agent_registry_updated_at
  BEFORE UPDATE ON public.agent_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_registry_updated_at();
