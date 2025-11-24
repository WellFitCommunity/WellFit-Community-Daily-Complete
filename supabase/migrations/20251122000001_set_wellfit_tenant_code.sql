-- Set WellFit tenant code to WF-001
-- Ensures WellFit is properly identified as a regular tenant in the Envision Atlus platform

-- Add tenant_code column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'tenant_code'
  ) THEN
    ALTER TABLE public.tenants ADD COLUMN tenant_code TEXT UNIQUE;
    CREATE INDEX IF NOT EXISTS idx_tenants_tenant_code ON public.tenants(tenant_code);
  END IF;
END $$;

-- Add display_name column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE public.tenants ADD COLUMN display_name TEXT;
  END IF;
END $$;

-- Set WellFit tenant code on existing row
UPDATE public.tenants
SET
  tenant_code = COALESCE(tenant_code, 'WF-001'),
  display_name = COALESCE(display_name, 'WellFit Community')
WHERE subdomain = 'www' OR tenant_code IS NULL;

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
