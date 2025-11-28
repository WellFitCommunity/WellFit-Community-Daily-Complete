-- ============================================================================
-- Tenant Product Licensing Schema
-- ============================================================================
-- Adds product licensing fields to distinguish between:
--   - WellFit Only (community platform) - License digit 9
--   - Envision Atlus Only (clinical engine) - License digit 8
--   - Both Products (full platform) - License digit 0
-- ============================================================================

-- Add product licensing columns to tenants table
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS licensed_products TEXT[] DEFAULT ARRAY['wellfit', 'atlus'],
ADD COLUMN IF NOT EXISTS license_tier TEXT DEFAULT 'standard' CHECK (license_tier IN ('trial', 'basic', 'standard', 'premium', 'enterprise')),
ADD COLUMN IF NOT EXISTS license_start_date DATE,
ADD COLUMN IF NOT EXISTS license_end_date DATE,
ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS max_patients INTEGER DEFAULT 500,
ADD COLUMN IF NOT EXISTS storage_quota_gb INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS api_rate_limit INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS billing_email TEXT,
ADD COLUMN IF NOT EXISTS billing_contact TEXT,
ADD COLUMN IF NOT EXISTS contract_id TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comments
COMMENT ON COLUMN public.tenants.licensed_products IS 'Array of licensed products: wellfit, atlus, or both';
COMMENT ON COLUMN public.tenants.license_tier IS 'License tier: trial, basic, standard, premium, enterprise';
COMMENT ON COLUMN public.tenants.license_start_date IS 'When the license period started';
COMMENT ON COLUMN public.tenants.license_end_date IS 'When the license period ends (null = perpetual)';
COMMENT ON COLUMN public.tenants.max_users IS 'Maximum users allowed for this tenant';
COMMENT ON COLUMN public.tenants.max_patients IS 'Maximum patients allowed for this tenant';
COMMENT ON COLUMN public.tenants.storage_quota_gb IS 'Storage quota in gigabytes';
COMMENT ON COLUMN public.tenants.api_rate_limit IS 'API rate limit per minute';
COMMENT ON COLUMN public.tenants.billing_email IS 'Email for billing notifications';
COMMENT ON COLUMN public.tenants.billing_contact IS 'Name of billing contact';
COMMENT ON COLUMN public.tenants.contract_id IS 'External contract/agreement ID';
COMMENT ON COLUMN public.tenants.notes IS 'Internal notes about this tenant';

-- Create index for product filtering
CREATE INDEX IF NOT EXISTS idx_tenants_licensed_products ON public.tenants USING GIN (licensed_products);
CREATE INDEX IF NOT EXISTS idx_tenants_license_tier ON public.tenants (license_tier);

-- Function to determine license digit from products
CREATE OR REPLACE FUNCTION get_license_digit(products TEXT[])
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF products IS NULL OR array_length(products, 1) IS NULL THEN
    RETURN 0; -- Default to both
  END IF;

  IF 'wellfit' = ANY(products) AND 'atlus' = ANY(products) THEN
    RETURN 0; -- Both products
  ELSIF 'atlus' = ANY(products) AND NOT ('wellfit' = ANY(products)) THEN
    RETURN 8; -- Atlus only
  ELSIF 'wellfit' = ANY(products) AND NOT ('atlus' = ANY(products)) THEN
    RETURN 9; -- WellFit only
  ELSE
    RETURN 0; -- Default to both
  END IF;
END;
$$;

COMMENT ON FUNCTION get_license_digit IS 'Returns license digit based on licensed products: 0=Both, 8=Atlus only, 9=WellFit only';

-- Function to generate tenant code
CREATE OR REPLACE FUNCTION generate_tenant_code(
  org_prefix TEXT,
  products TEXT[]
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  license_digit INTEGER;
  next_sequence INTEGER;
  new_code TEXT;
BEGIN
  -- Get license digit
  license_digit := get_license_digit(products);

  -- Get next sequence number for this prefix
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(tenant_code FROM '[0-9]+$') AS INTEGER)
  ), 0) + 1
  INTO next_sequence
  FROM tenants
  WHERE tenant_code LIKE (UPPER(org_prefix) || '-%');

  -- If no existing codes, start at 001
  IF next_sequence < 1 THEN
    next_sequence := 1;
  END IF;

  -- Format: PREFIX-{license_digit}{sequence padded to 3}
  -- e.g., HH-8001, VG-0002, MC-9003
  new_code := UPPER(org_prefix) || '-' || license_digit::TEXT || LPAD(next_sequence::TEXT, 3, '0');

  RETURN new_code;
END;
$$;

COMMENT ON FUNCTION generate_tenant_code IS 'Generates tenant code in format PREFIX-{license_digit}{sequence}';

-- Function to create a new tenant with proper licensing
CREATE OR REPLACE FUNCTION create_tenant(
  p_name TEXT,
  p_org_prefix TEXT,
  p_subdomain TEXT,
  p_products TEXT[] DEFAULT ARRAY['wellfit', 'atlus'],
  p_license_tier TEXT DEFAULT 'standard',
  p_max_users INTEGER DEFAULT 100,
  p_max_patients INTEGER DEFAULT 500,
  p_billing_email TEXT DEFAULT NULL,
  p_super_admin_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_tenant_id UUID;
  new_tenant_code TEXT;
BEGIN
  -- Generate tenant code
  new_tenant_code := generate_tenant_code(p_org_prefix, p_products);

  -- Create tenant
  INSERT INTO tenants (
    name,
    tenant_code,
    subdomain,
    licensed_products,
    license_tier,
    license_start_date,
    max_users,
    max_patients,
    billing_email,
    is_active,
    created_at
  ) VALUES (
    p_name,
    new_tenant_code,
    LOWER(p_subdomain),
    p_products,
    p_license_tier,
    CURRENT_DATE,
    p_max_users,
    p_max_patients,
    p_billing_email,
    true,
    NOW()
  )
  RETURNING id INTO new_tenant_id;

  -- Create tenant_system_status record
  INSERT INTO tenant_system_status (
    tenant_id,
    is_active,
    is_suspended,
    max_users,
    max_patients,
    storage_quota_gb,
    api_rate_limit,
    created_at
  ) VALUES (
    new_tenant_id,
    true,
    false,
    p_max_users,
    p_max_patients,
    50,
    1000,
    NOW()
  )
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Create tenant_module_config with defaults based on products
  INSERT INTO tenant_module_config (
    tenant_id,
    -- WellFit modules (enabled if WellFit licensed)
    community_enabled, community_entitled,
    dashboard_enabled, dashboard_entitled,
    check_ins_enabled, check_ins_entitled,
    messaging_enabled, messaging_entitled,
    -- Atlus modules (enabled if Atlus licensed)
    ai_scribe_enabled, ai_scribe_entitled,
    ehr_integration_enabled, ehr_integration_entitled,
    fhir_enabled, fhir_entitled,
    telehealth_enabled, telehealth_entitled,
    sdoh_enabled, sdoh_entitled,
    -- License tier
    license_tier,
    created_at
  ) VALUES (
    new_tenant_id,
    -- WellFit modules
    'wellfit' = ANY(p_products), 'wellfit' = ANY(p_products),
    'wellfit' = ANY(p_products), 'wellfit' = ANY(p_products),
    'wellfit' = ANY(p_products), 'wellfit' = ANY(p_products),
    'wellfit' = ANY(p_products), 'wellfit' = ANY(p_products),
    -- Atlus modules
    'atlus' = ANY(p_products), 'atlus' = ANY(p_products),
    'atlus' = ANY(p_products), 'atlus' = ANY(p_products),
    'atlus' = ANY(p_products), 'atlus' = ANY(p_products),
    'atlus' = ANY(p_products), 'atlus' = ANY(p_products),
    'atlus' = ANY(p_products), 'atlus' = ANY(p_products),
    -- License tier
    p_license_tier,
    NOW()
  )
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Log audit event if super admin provided
  IF p_super_admin_id IS NOT NULL THEN
    INSERT INTO super_admin_audit_log (
      super_admin_id,
      super_admin_email,
      action,
      target_type,
      target_id,
      target_name,
      new_value,
      severity,
      created_at
    )
    SELECT
      p_super_admin_id,
      COALESCE(sa.email, 'system'),
      'tenant.create',
      'tenant',
      new_tenant_id::TEXT,
      p_name,
      jsonb_build_object(
        'tenant_code', new_tenant_code,
        'products', p_products,
        'license_tier', p_license_tier
      ),
      'info',
      NOW()
    FROM super_admin_users sa
    WHERE sa.id = p_super_admin_id;
  END IF;

  RETURN new_tenant_id;
END;
$$;

COMMENT ON FUNCTION create_tenant IS 'Creates a new tenant with proper licensing, auto-generated tenant code, and initial configuration';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_license_digit(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_tenant_code(TEXT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION create_tenant(TEXT, TEXT, TEXT, TEXT[], TEXT, INTEGER, INTEGER, TEXT, UUID) TO authenticated;

-- Update WellFit Community (WF-0001) with both products
UPDATE tenants
SET
  licensed_products = ARRAY['wellfit', 'atlus'],
  license_tier = 'enterprise',
  license_start_date = '2024-01-01',
  max_users = 10000,
  max_patients = 50000
WHERE tenant_code = 'WF-0001' OR subdomain = 'www';

-- Update RPC to include product info
CREATE OR REPLACE FUNCTION get_all_tenants_with_status()
RETURNS TABLE (
  tenant_id UUID,
  tenant_name TEXT,
  subdomain TEXT,
  tenant_code TEXT,
  licensed_products TEXT[],
  license_tier TEXT,
  license_end_date DATE,
  is_active BOOLEAN,
  is_suspended BOOLEAN,
  suspension_reason TEXT,
  max_users INTEGER,
  max_patients INTEGER,
  user_count BIGINT,
  patient_count BIGINT,
  last_activity TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.subdomain,
    t.tenant_code,
    COALESCE(t.licensed_products, ARRAY['wellfit', 'atlus']) AS licensed_products,
    COALESCE(t.license_tier, 'standard') AS license_tier,
    t.license_end_date,
    COALESCE(ts.is_active, true) AS is_active,
    COALESCE(ts.is_suspended, false) AS is_suspended,
    ts.suspension_reason,
    COALESCE(ts.max_users, t.max_users, 100) AS max_users,
    COALESCE(ts.max_patients, t.max_patients, 500) AS max_patients,
    (SELECT COUNT(*) FROM profiles p WHERE p.tenant_id = t.id) AS user_count,
    (SELECT COUNT(*) FROM patient_profiles pp WHERE pp.tenant_id = t.id) AS patient_count,
    (
      SELECT MAX(al.created_at)
      FROM audit_logs al
      WHERE al.tenant_id = t.id
    ) AS last_activity,
    t.created_at
  FROM tenants t
  LEFT JOIN tenant_system_status ts ON ts.tenant_id = t.id
  ORDER BY t.name;
END;
$$;

COMMENT ON FUNCTION get_all_tenants_with_status IS 'Returns all tenants with status, licensing, and usage metrics for super-admin panel';
