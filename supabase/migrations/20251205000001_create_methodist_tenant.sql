-- ============================================================================
-- Create Methodist Hospital Tenant (MH-0001)
-- ============================================================================
-- Creates Houston Methodist Hospital as a properly licensed Envision Atlus tenant
-- Per CLAUDE.md: MH-0001 uses license digit 0 = Both Products (WellFit + Atlus)
-- ============================================================================

BEGIN;

-- Create Methodist Hospital tenant if it doesn't exist
INSERT INTO public.tenants (
  id,
  subdomain,
  display_name,
  tenant_code,
  is_active,
  timezone,
  branding_config,
  licensed_products,
  created_at,
  updated_at
)
VALUES (
  'a1000000-0000-0000-0000-000000000001',  -- Distinct UUID for Methodist
  'methodist',
  'Houston Methodist Hospital',
  'MH-0001',
  true,
  'America/Chicago',  -- Houston timezone
  jsonb_build_object(
    'primaryColor', '#003087',
    'secondaryColor', '#00857a',
    'logoUrl', null,
    'customFooter', '2025 Houston Methodist Hospital. All rights reserved. HIPAA-compliant platform.'
  ),
  jsonb_build_object(
    'wellfit', true,
    'envision_atlus', true
  ),
  now(),
  now()
)
ON CONFLICT (tenant_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  is_active = EXCLUDED.is_active,
  timezone = EXCLUDED.timezone,
  branding_config = EXCLUDED.branding_config,
  licensed_products = EXCLUDED.licensed_products,
  updated_at = now();

-- Add basic module configuration for Methodist
INSERT INTO public.tenant_module_config (tenant_id, module_name, is_entitled, is_enabled, config)
SELECT
  t.id,
  m.module_name,
  true,  -- All entitled
  true,  -- All enabled
  '{}'::jsonb
FROM tenants t
CROSS JOIN (
  VALUES
    ('readmission_prevention'),
    ('care_coordination'),
    ('shift_handoff'),
    ('billing'),
    ('telehealth'),
    ('patient_portal'),
    ('clinical_documentation'),
    ('analytics'),
    ('guardian_agent')
) AS m(module_name)
WHERE t.tenant_code = 'MH-0001'
ON CONFLICT (tenant_id, module_name) DO UPDATE SET
  is_entitled = true,
  is_enabled = true;

-- Update the Methodist demo seed data to use the correct tenant ID
-- (The demo data currently uses WF-0001's ID, we should reference MH-0001's ID)
-- This is a comment for future reference - the demo data migration should be updated

COMMENT ON TABLE tenants IS
'Multi-tenant configuration table. Tenant codes follow format: {ORG}-{LICENSE}{SEQUENCE}
where LICENSE digit: 0=Both products, 8=Atlus Only, 9=WellFit Only.
Example: MH-0001 = Methodist Hospital, Both products, sequence 001';

COMMIT;
