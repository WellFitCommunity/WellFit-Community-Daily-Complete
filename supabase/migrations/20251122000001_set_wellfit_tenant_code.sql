-- Set WellFit tenant code to WF-001
-- Ensures WellFit is properly identified as a regular tenant in the Envision Atlus platform

-- Add tenant_code column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'tenant_code'
  ) THEN
    ALTER TABLE tenants ADD COLUMN tenant_code TEXT UNIQUE;
    CREATE INDEX IF NOT EXISTS idx_tenants_tenant_code ON tenants(tenant_code);
  END IF;
END $$;

-- Ensure WellFit tenant exists with code WF-001
INSERT INTO tenants (id, subdomain, display_name, tenant_code, is_active, created_at)
VALUES (
  gen_random_uuid(),
  'www',
  'WellFit Community',
  'WF-001',
  true,
  NOW()
)
ON CONFLICT (subdomain)
DO UPDATE SET
  tenant_code = 'WF-001',
  display_name = 'WellFit Community'
WHERE tenants.subdomain = 'www';

-- Create function to get tenant by email domain or lookup
CREATE OR REPLACE FUNCTION get_tenant_by_identifier(
  user_identifier TEXT
) RETURNS TABLE (
  tenant_id UUID,
  tenant_code TEXT,
  display_name TEXT,
  subdomain TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Try to find tenant by user's email domain in profiles
  RETURN QUERY
  SELECT
    t.id,
    t.tenant_code,
    t.display_name,
    t.subdomain
  FROM tenants t
  INNER JOIN profiles p ON p.tenant_id = t.id
  WHERE p.email = user_identifier OR p.phone = user_identifier
  LIMIT 1;

  -- If not found, return default WellFit tenant
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      t.id,
      t.tenant_code,
      t.display_name,
      t.subdomain
    FROM tenants t
    WHERE t.subdomain = 'www' OR t.tenant_code = 'WF-001'
    LIMIT 1;
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_tenant_by_identifier(TEXT) TO authenticated, anon;

COMMENT ON FUNCTION get_tenant_by_identifier IS 'Smart tenant detection: finds tenant by user email/phone, defaults to WellFit (WF-001)';
