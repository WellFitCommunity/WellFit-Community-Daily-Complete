# /onboard-tenant — New Organization Onboarding Checklist

Onboard a new tenant organization into the Envision ATLUS I.H.I.S. platform. Covers database, CORS, branding, modules, roles, AI config, and verification.

## Input Required

Before running, ask the user for:

| Field | Example | Required |
|-------|---------|----------|
| Organization name | `Valley General Hospital` | Yes |
| Tenant code | `VG-0002` (format: `{ORG}-{LICENSE}{SEQUENCE}`) | Yes |
| License type | `0` = Both, `8` = Atlus Only, `9` = WellFit Only | Yes |
| Primary domain | `valleygeneral.wellfitcommunity.com` | Yes |
| Admin name | `Dr. Sarah Chen` | Yes |
| Admin email | `sarah.chen@valleygeneral.org` | Yes |
| Logo URL | (optional — can be added later) | No |
| Brand primary color | `#1E40AF` (optional — defaults to Atlus blue) | No |

## Steps

### Step 1: Validate Tenant Code Format

Verify the tenant code follows the convention:

| License Digit | Meaning | Products Enabled |
|---------------|---------|------------------|
| `0` | Both products | WellFit + Envision Atlus |
| `8` | Atlus only | Envision Atlus |
| `9` | WellFit only | WellFit |

```
Tenant code: VG-0002
  ├── VG = org abbreviation (2-4 chars)
  ├── 0 = license type (both products)
  └── 002 = sequence number
```

If the code doesn't match `{2-4 letters}-{digit}{3 digits}`, STOP and ask for correction.

### Step 2: Create Tenant Record

Write and execute a Supabase migration:

```sql
-- Migration: create_tenant_{tenant_code_lowercase}
INSERT INTO tenants (
  tenant_code,
  organization_name,
  primary_domain,
  license_type,
  is_active,
  created_at
) VALUES (
  '{TENANT_CODE}',
  '{ORG_NAME}',
  '{PRIMARY_DOMAIN}',
  '{LICENSE_DIGIT}',
  true,
  now()
)
ON CONFLICT (tenant_code) DO NOTHING
RETURNING id;
```

Save the returned tenant UUID — it's needed for all subsequent steps.

Run: `npx supabase db push`

### Step 3: Configure CORS Origins

Add the tenant's domain to the `ALLOWED_ORIGINS` Supabase secret:

```bash
# 1. Read current origins
npx supabase secrets list

# 2. Add new domain (comma-separated, no wildcards)
npx supabase secrets set ALLOWED_ORIGINS="https://existing1.com,https://existing2.com,https://{PRIMARY_DOMAIN}"
```

**NEVER use wildcards.** Each domain must be explicit. This is a HIPAA requirement.

### Step 4: Configure Branding

Insert tenant branding configuration:

```sql
INSERT INTO admin_settings (
  tenant_id,
  setting_key,
  setting_value
) VALUES
  ('{TENANT_UUID}', 'brand_name', '"{ORG_NAME}"'),
  ('{TENANT_UUID}', 'brand_primary_color', '"{PRIMARY_COLOR}"'),
  ('{TENANT_UUID}', 'brand_logo_url', '"{LOGO_URL}"')
ON CONFLICT (tenant_id, setting_key)
DO UPDATE SET setting_value = EXCLUDED.setting_value;
```

Run: `npx supabase db push`

### Step 5: Configure Module Access

Based on the license type, enable the correct modules in `tenant_module_config`:

**License 0 (Both products):**
```sql
INSERT INTO tenant_module_config (tenant_id, module_key, is_entitled, is_enabled)
VALUES
  ('{TENANT_UUID}', 'wellfit_community', true, true),
  ('{TENANT_UUID}', 'envision_atlus', true, true),
  ('{TENANT_UUID}', 'fhir_interop', true, true),
  ('{TENANT_UUID}', 'ai_clinical', true, true),
  ('{TENANT_UUID}', 'ai_community', true, true),
  ('{TENANT_UUID}', 'billing', true, true),
  ('{TENANT_UUID}', 'mcp_servers', true, true),
  ('{TENANT_UUID}', 'telehealth', true, false),
  ('{TENANT_UUID}', 'smart_on_fhir', true, false)
ON CONFLICT (tenant_id, module_key) DO NOTHING;
```

**License 8 (Atlus only):** Omit `wellfit_community` and `ai_community`.
**License 9 (WellFit only):** Omit `envision_atlus`, `ai_clinical`, `billing`, `smart_on_fhir`.

Ask the user which optional modules to enable (telehealth, SMART on FHIR).

### Step 6: Create Admin Account

```sql
-- 1. Create auth user (via Supabase Auth API or edge function)
-- The admin will complete registration via the normal flow.
-- Pre-register them in pending_registrations:
INSERT INTO pending_registrations (
  email,
  first_name,
  last_name,
  tenant_id,
  requested_role,
  status,
  created_at
) VALUES (
  '{ADMIN_EMAIL}',
  '{ADMIN_FIRST_NAME}',
  '{ADMIN_LAST_NAME}',
  '{TENANT_UUID}',
  'tenant_admin',
  'approved',
  now()
);
```

After the admin registers through the normal auth flow, assign the role:

```sql
INSERT INTO user_roles (
  user_id,
  role,
  tenant_id,
  assigned_by
) VALUES (
  '{ADMIN_USER_UUID}',
  'tenant_admin',
  '{TENANT_UUID}',
  'ba4f20ad-2707-467b-a87f-d46fe9255d2f' -- Maria (super admin)
);
```

Run: `npx supabase db push`

### Step 7: Configure AI Skills

Enable AI skills for the tenant based on license type:

```sql
INSERT INTO tenant_ai_skill_config (
  tenant_id,
  skill_key,
  is_enabled,
  custom_config
)
SELECT
  '{TENANT_UUID}',
  skill_key,
  true,
  '{}'::jsonb
FROM ai_skills
WHERE is_active = true
  AND (
    -- Filter by license type
    CASE
      WHEN '{LICENSE_DIGIT}' = '0' THEN true  -- Both: all skills
      WHEN '{LICENSE_DIGIT}' = '8' THEN skill_key NOT LIKE 'community_%'
      WHEN '{LICENSE_DIGIT}' = '9' THEN skill_key NOT LIKE 'clinical_%'
    END
  )
ON CONFLICT (tenant_id, skill_key) DO NOTHING;
```

Run: `npx supabase db push`

### Step 8: Redeploy Edge Functions

After CORS changes, redeploy all edge functions to pick up the new origins:

```bash
npx supabase functions deploy --no-verify-jwt
```

Wait 60 seconds for propagation before testing.

### Step 9: Verify Tenant Isolation (RLS)

Run these verification queries to confirm the new tenant is properly isolated:

```sql
-- 1. Verify tenant record exists
SELECT id, tenant_code, organization_name, is_active
FROM tenants WHERE tenant_code = '{TENANT_CODE}';

-- 2. Verify module config
SELECT module_key, is_entitled, is_enabled
FROM tenant_module_config WHERE tenant_id = '{TENANT_UUID}';

-- 3. Verify AI skills enabled
SELECT COUNT(*) as enabled_skills
FROM tenant_ai_skill_config
WHERE tenant_id = '{TENANT_UUID}' AND is_enabled = true;

-- 4. Verify branding
SELECT setting_key, setting_value
FROM admin_settings WHERE tenant_id = '{TENANT_UUID}';

-- 5. Verify RLS prevents cross-tenant access
-- (This should return 0 rows when run as the new tenant's admin)
SELECT COUNT(*) FROM profiles
WHERE tenant_id != '{TENANT_UUID}';
```

### Step 10: Send Welcome & Report

Provide the onboarding summary to Maria:

```
TENANT ONBOARDED
---
Organization: {ORG_NAME}
Tenant Code: {TENANT_CODE}
Tenant UUID: {TENANT_UUID}
License: {LICENSE_TYPE_NAME}
Domain: https://{PRIMARY_DOMAIN}
Admin: {ADMIN_NAME} ({ADMIN_EMAIL})
Modules: {COUNT} enabled
AI Skills: {COUNT} enabled
CORS: Domain added to ALLOWED_ORIGINS
Edge Functions: Redeployed
RLS: Verified (tenant isolation confirmed)

Next steps for the tenant admin:
  1. Register at https://{PRIMARY_DOMAIN}/register
  2. Complete 2FA setup
  3. Configure branding in Admin Panel > Tenant Branding
  4. Invite staff via Admin Panel > User Provisioning
```

## Rules

- NEVER use CORS wildcards. Each tenant domain must be explicit.
- ALWAYS run migrations immediately after creating them (`npx supabase db push`).
- ALWAYS verify RLS isolation in Step 9 — do not skip.
- If ANY step fails, STOP and report the failure. Do not continue to the next step.
- The tenant admin registers through the normal auth flow — do NOT create auth.users records directly.
- Ask Maria before enabling expensive modules (telehealth, SMART on FHIR).
- Document the onboarding in the git commit message: `feat(tenant): onboard {TENANT_CODE} — {ORG_NAME}`
