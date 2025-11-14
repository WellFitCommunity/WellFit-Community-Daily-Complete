-- Rename wellfit tenant to Envision VirtualEdge Group
-- This tenant will use PIN-only authentication (no tenant_code required)

-- Update tenant name and subdomain
UPDATE tenants
SET
  name = 'Envision VirtualEdge Group',
  app_name = 'Envision Atlus'
WHERE subdomain = 'wellfit' OR name ILIKE '%wellfit%';

-- Ensure tenant_code remains NULL for PIN-only authentication
UPDATE tenants
SET tenant_code = NULL
WHERE name = 'Envision VirtualEdge Group';
