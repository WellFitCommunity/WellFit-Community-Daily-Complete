-- ============================================================
-- Migration: Chain Orchestration System
-- Database-driven state machine for multi-server MCP pipelines
--
-- Tables:
--   chain_definitions      — what chains exist
--   chain_step_definitions — what steps a chain has
--   chain_runs             — execution state per invocation
--   chain_step_results     — per-step execution record
--
-- Architecture: Steps execute sequentially. Approval gates pause
-- the chain. Conditional steps skip when condition not met.
-- Placeholder steps record a message and continue.
-- ============================================================

-- ============================================================
-- Enum: chain_run_status
-- ============================================================
DO $$ BEGIN
  CREATE TYPE chain_run_status AS ENUM (
    'pending',
    'running',
    'awaiting_approval',
    'completed',
    'failed',
    'cancelled',
    'timed_out'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- Enum: chain_step_status
-- ============================================================
DO $$ BEGIN
  CREATE TYPE chain_step_status AS ENUM (
    'pending',
    'running',
    'completed',
    'failed',
    'skipped',
    'awaiting_approval',
    'approved',
    'rejected',
    'timed_out',
    'placeholder'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- Table 1: chain_definitions
-- Registry of available chain pipelines
-- ============================================================
CREATE TABLE IF NOT EXISTS chain_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE chain_definitions IS 'Registry of MCP chain pipelines. Each chain defines a multi-step workflow across one or more MCP servers.';

-- ============================================================
-- Table 2: chain_step_definitions
-- Ordered steps within a chain definition
-- ============================================================
CREATE TABLE IF NOT EXISTS chain_step_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_definition_id UUID NOT NULL REFERENCES chain_definitions(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL CHECK (step_order >= 1),
  step_key TEXT NOT NULL,
  display_name TEXT NOT NULL,

  -- MCP target
  mcp_server TEXT NOT NULL,
  tool_name TEXT NOT NULL,

  -- Approval gate
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  approval_role TEXT,                    -- e.g., 'physician', 'billing_admin'

  -- Conditional execution
  is_conditional BOOLEAN NOT NULL DEFAULT false,
  condition_expression TEXT,             -- JSONPath expression against prior step outputs

  -- Placeholder (not yet functional)
  is_placeholder BOOLEAN NOT NULL DEFAULT false,
  placeholder_message TEXT,

  -- Execution config
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  max_retries INTEGER NOT NULL DEFAULT 0,

  -- Input mapping: JSONB mapping tool args from chain input / prior step output
  -- Keys = tool argument names, Values = JSONPath references:
  --   $.input.field_name      — from chain start input
  --   $.steps.step_key.field  — from a prior step's output
  --   $.literal.value         — hardcoded value
  input_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (chain_definition_id, step_order),
  UNIQUE (chain_definition_id, step_key)
);

COMMENT ON TABLE chain_step_definitions IS 'Ordered steps within a chain. Each step targets an MCP server tool with input mapping, approval gates, and conditional logic.';

-- ============================================================
-- Table 3: chain_runs
-- Execution state for a single chain invocation
-- ============================================================
CREATE TABLE IF NOT EXISTS chain_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_definition_id UUID NOT NULL REFERENCES chain_definitions(id),
  chain_key TEXT NOT NULL,               -- denormalized for fast filtering

  status chain_run_status NOT NULL DEFAULT 'pending',
  current_step_order INTEGER NOT NULL DEFAULT 0,

  -- Input/output
  input_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB,                          -- final chain result

  -- Identity (P0-2 compliant: from JWT, never from args)
  started_by UUID NOT NULL REFERENCES auth.users(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  -- Error tracking
  error_message TEXT,
  error_step_key TEXT,

  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE chain_runs IS 'Execution state for chain invocations. Status tracks the chain through pending → running → completed/failed. tenant_id derived from caller JWT.';

-- ============================================================
-- Table 4: chain_step_results
-- Per-step execution record within a chain run
-- ============================================================
CREATE TABLE IF NOT EXISTS chain_step_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_run_id UUID NOT NULL REFERENCES chain_runs(id) ON DELETE CASCADE,
  step_definition_id UUID NOT NULL REFERENCES chain_step_definitions(id),

  -- Denormalized for fast queries
  step_order INTEGER NOT NULL,
  step_key TEXT NOT NULL,
  mcp_server TEXT NOT NULL,
  tool_name TEXT NOT NULL,

  -- Execution
  status chain_step_status NOT NULL DEFAULT 'pending',
  input_args JSONB,
  output_data JSONB,
  error_message TEXT,
  execution_time_ms INTEGER,

  -- Approval tracking
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,

  -- Placeholder record
  placeholder_message TEXT,

  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (chain_run_id, step_order)
);

COMMENT ON TABLE chain_step_results IS 'Per-step execution record. Tracks input, output, timing, errors, and approval decisions for each step in a chain run.';

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE chain_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chain_step_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chain_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE chain_step_results ENABLE ROW LEVEL SECURITY;

-- chain_definitions: readable by all authenticated users (definitions are global)
CREATE POLICY "chain_definitions_read" ON chain_definitions
  FOR SELECT TO authenticated
  USING (true);

-- chain_step_definitions: readable by all authenticated users
CREATE POLICY "chain_step_definitions_read" ON chain_step_definitions
  FOR SELECT TO authenticated
  USING (true);

-- chain_runs: tenant-scoped read for authenticated users
CREATE POLICY "chain_runs_tenant_read" ON chain_runs
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  );

-- chain_runs: insert by authenticated users in same tenant
CREATE POLICY "chain_runs_tenant_insert" ON chain_runs
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    AND started_by = auth.uid()
  );

-- chain_runs: update by authenticated users in same tenant
-- (service role handles most updates; this allows cancellation from UI)
CREATE POLICY "chain_runs_tenant_update" ON chain_runs
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  );

-- chain_step_results: readable by users who can read the parent chain_run
CREATE POLICY "chain_step_results_tenant_read" ON chain_step_results
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chain_runs cr
      WHERE cr.id = chain_step_results.chain_run_id
      AND cr.tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- chain_step_results: clinicians can update approval fields
CREATE POLICY "chain_step_results_approval_update" ON chain_step_results
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chain_runs cr
      WHERE cr.id = chain_step_results.chain_run_id
      AND cr.tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('physician', 'nurse', 'charge_nurse', 'care_manager', 'billing_admin', 'admin', 'super_admin')
    )
  );

-- ============================================================
-- Indexes
-- ============================================================

-- chain_definitions: lookup by key
CREATE INDEX idx_chain_definitions_key
  ON chain_definitions (chain_key) WHERE is_active = true;

-- chain_step_definitions: ordered steps per chain
CREATE INDEX idx_chain_step_definitions_chain_order
  ON chain_step_definitions (chain_definition_id, step_order);

-- chain_runs: tenant + status (dashboard queries)
CREATE INDEX idx_chain_runs_tenant_status
  ON chain_runs (tenant_id, status);

-- chain_runs: chain_key filter
CREATE INDEX idx_chain_runs_chain_key
  ON chain_runs (chain_key, status);

-- chain_runs: started_by (user's runs)
CREATE INDEX idx_chain_runs_started_by
  ON chain_runs (started_by, created_at DESC);

-- chain_runs: active runs (pending/running/awaiting_approval)
CREATE INDEX idx_chain_runs_active
  ON chain_runs (tenant_id, chain_key)
  WHERE status IN ('pending', 'running', 'awaiting_approval');

-- chain_step_results: steps per run
CREATE INDEX idx_chain_step_results_run_order
  ON chain_step_results (chain_run_id, step_order);

-- chain_step_results: awaiting approval (approval dashboard)
CREATE INDEX idx_chain_step_results_awaiting
  ON chain_step_results (status)
  WHERE status = 'awaiting_approval';

-- ============================================================
-- Updated-at triggers (reuse existing function if available)
-- ============================================================
CREATE TRIGGER chain_definitions_updated_at
  BEFORE UPDATE ON chain_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER chain_runs_updated_at
  BEFORE UPDATE ON chain_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER chain_step_results_updated_at
  BEFORE UPDATE ON chain_step_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
