-- Guardian Learning Patterns — persistent storage for self-healing pattern data
-- The LearningSystem currently stores all learned patterns in-memory.
-- This table persists them per-tenant so learning survives page refreshes.

CREATE TABLE IF NOT EXISTS guardian_learning_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  pattern_key TEXT NOT NULL,
  features JSONB NOT NULL DEFAULT '[]',
  frequency INTEGER NOT NULL DEFAULT 1,
  contexts JSONB NOT NULL DEFAULT '[]',
  outcomes JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, pattern_key)
);

-- Strategy success rate tracking per tenant
CREATE TABLE IF NOT EXISTS guardian_strategy_success_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  strategy TEXT NOT NULL,
  recent_results JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, strategy)
);

-- RLS
ALTER TABLE guardian_learning_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_strategy_success_rates ENABLE ROW LEVEL SECURITY;

-- Only service role and tenant admins can access
CREATE POLICY "guardian_learning_patterns_service_role"
  ON guardian_learning_patterns FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "guardian_learning_patterns_tenant_admin"
  ON guardian_learning_patterns FOR ALL
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin', 'tenant_admin', 'security_admin')
    )
  );

CREATE POLICY "guardian_strategy_success_service_role"
  ON guardian_strategy_success_rates FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "guardian_strategy_success_tenant_admin"
  ON guardian_strategy_success_rates FOR ALL
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin', 'tenant_admin', 'security_admin')
    )
  );

-- Indexes
CREATE INDEX idx_guardian_learning_patterns_tenant
  ON guardian_learning_patterns(tenant_id);

CREATE INDEX idx_guardian_strategy_success_tenant
  ON guardian_strategy_success_rates(tenant_id);

-- Updated_at trigger
CREATE TRIGGER set_guardian_learning_patterns_updated_at
  BEFORE UPDATE ON guardian_learning_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_guardian_strategy_success_updated_at
  BEFORE UPDATE ON guardian_strategy_success_rates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
