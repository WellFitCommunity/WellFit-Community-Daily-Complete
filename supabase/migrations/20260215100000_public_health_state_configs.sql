-- Public Health State Configurations
-- Purpose: Database-driven state endpoint configuration for syndromic surveillance,
--          immunization registry, and electronic case reporting submissions.
-- ONC Criteria: 170.315(f)(1), (f)(2), (f)(5)

CREATE TABLE IF NOT EXISTS public_health_state_configs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  state_code text NOT NULL,
  reporting_type text NOT NULL CHECK (reporting_type IN ('syndromic', 'immunization', 'ecr')),
  registry_name text NOT NULL,
  endpoint text NOT NULL,
  test_endpoint text NOT NULL,
  format text NOT NULL DEFAULT 'HL7v2',
  auth_type text NOT NULL DEFAULT 'certificate' CHECK (auth_type IN ('certificate', 'oauth2', 'basic')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, state_code, reporting_type)
);

-- Index for fast lookup
CREATE INDEX idx_state_configs_lookup
  ON public_health_state_configs (tenant_id, state_code, reporting_type)
  WHERE is_active = true;

-- RLS
ALTER TABLE public_health_state_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can read state configs"
  ON public_health_state_configs
  FOR SELECT
  USING (tenant_id = (SELECT (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid));

CREATE POLICY "Super admins full access to state configs"
  ON public_health_state_configs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'super_admin'
    )
  );

-- Service role bypass for edge functions
CREATE POLICY "Service role bypass state configs"
  ON public_health_state_configs
  FOR ALL
  USING (auth.role() = 'service_role');

-- Seed Texas defaults for test tenant WF-0001
INSERT INTO public_health_state_configs (tenant_id, state_code, reporting_type, registry_name, endpoint, test_endpoint, format, auth_type)
VALUES
  ('2b902657-6a20-4435-a78a-576f397517ca', 'TX', 'syndromic', 'Texas DSHS', 'https://syndromic.dshs.texas.gov/api/submit', 'https://syndromic-test.dshs.texas.gov/api/submit', 'HL7v2', 'certificate'),
  ('2b902657-6a20-4435-a78a-576f397517ca', 'TX', 'immunization', 'Texas ImmTrac2', 'https://immtrac.dshs.texas.gov/api/vxu', 'https://immtrac-test.dshs.texas.gov/api/vxu', 'HL7v2', 'certificate'),
  ('2b902657-6a20-4435-a78a-576f397517ca', 'TX', 'ecr', 'Texas DSHS Direct', 'https://ecr.dshs.texas.gov/api/eicr', 'https://ecr-test.dshs.texas.gov/api/eicr', 'CDA', 'certificate')
ON CONFLICT (tenant_id, state_code, reporting_type) DO NOTHING;

COMMENT ON TABLE public_health_state_configs IS 'Database-driven state health department endpoint configuration for public health reporting';
