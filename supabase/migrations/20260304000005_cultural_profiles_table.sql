-- Cultural Profiles Table — S5-3 Configuration Debt Fix
-- Moves hardcoded cultural competency profiles to database.
-- Enables tenant customization, audit, and content updates without redeployment.
--
-- Design: One row per population per tenant. profile_data is JSONB containing
-- the full CulturalProfile structure (communication, clinical considerations,
-- barriers, practices, trust factors, support systems, SDOH codes, remedies).
-- tenant_id NULL = global built-in profile (available to all tenants).

CREATE TABLE IF NOT EXISTS cultural_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  population_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  caveat TEXT NOT NULL,
  profile_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(population_key, tenant_id)
);

-- Index for fast lookup by population + tenant
CREATE INDEX IF NOT EXISTS idx_cultural_profiles_population
  ON cultural_profiles(population_key, tenant_id)
  WHERE is_active = true;

-- RLS policies
ALTER TABLE cultural_profiles ENABLE ROW LEVEL SECURITY;

-- Global profiles (tenant_id IS NULL) readable by all authenticated users
CREATE POLICY "Global cultural profiles readable by authenticated users"
  ON cultural_profiles FOR SELECT
  TO authenticated
  USING (tenant_id IS NULL AND is_active = true);

-- Tenant-specific profiles readable by same-tenant users
CREATE POLICY "Tenant cultural profiles readable by same-tenant users"
  ON cultural_profiles FOR SELECT
  TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND tenant_id = (SELECT (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
    AND is_active = true
  );

-- Only admins can insert/update/delete
CREATE POLICY "Admins can manage cultural profiles"
  ON cultural_profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('super_admin', 'admin', 'tenant_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('super_admin', 'admin', 'tenant_admin')
    )
  );

-- Service role has full access (for edge functions)
CREATE POLICY "Service role full access to cultural profiles"
  ON cultural_profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_cultural_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cultural_profiles_updated_at
  BEFORE UPDATE ON cultural_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_cultural_profiles_updated_at();

-- Comment for documentation
COMMENT ON TABLE cultural_profiles IS 'Cultural competency profiles for population-specific clinical guidance. Supports tenant customization. Global profiles (tenant_id NULL) are built-in defaults.';
COMMENT ON COLUMN cultural_profiles.profile_data IS 'JSONB containing: communication, clinicalConsiderations, barriers, culturalPractices, trustFactors, supportSystems, sdohCodes, culturalRemedies';
