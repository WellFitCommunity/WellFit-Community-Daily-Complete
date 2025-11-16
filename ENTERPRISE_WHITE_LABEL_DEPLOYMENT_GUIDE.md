# Enterprise White-Label Deployment Guide

**WellFit Community Daily Complete**
**For Hospitals, Senior Care, & Law Enforcement Partnerships**

---

## Table of Contents

1. [Overview](#overview)
2. [White-Label Architecture](#white-label-architecture)
3. [Deployment Scenarios](#deployment-scenarios)
4. [Step-by-Step Deployment](#step-by-step-deployment)
5. [Hospital Workflow Configuration](#hospital-workflow-configuration)
6. [Law Enforcement Module Setup](#law-enforcement-module-setup)
7. [Multi-Tenant Management](#multi-tenant-management)
8. [Testing & Validation](#testing--validation)

---

## Overview

### What is White-Labeling?

White-labeling allows you to deploy separate branded instances of the WellFit platform for different organizations (hospitals, senior care facilities, law enforcement agencies) while maintaining a single codebase and infrastructure.

### Key Capabilities

- **Complete branding customization** - Logos, colors, app name, subdomain
- **Per-tenant feature control** - Enable/disable 21+ modules per organization
- **Full data isolation** - Each tenant's data is completely separate (Row-Level Security)
- **Unified management** - Super admin panel to manage all tenants
- **License tiers** - Basic, Standard, Premium, Enterprise

---

## White-Label Architecture

### Multi-Tenancy Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Envision VirtualEdge Group               │
│                  (Super Admin Master Panel)                 │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┬────────────────┐
        │            │            │                │
   ┌────▼────┐  ┌───▼────┐  ┌───▼─────┐    ┌────▼──────┐
   │Methodist│  │Houston │  │Precinct │    │ Seattle   │
   │Hospital │  │Senior  │  │3 Sheriff│    │Community  │
   │(MH-6702)│  │Services│  │(P3-1234)│    │Health     │
   └─────────┘  └────────┘  └─────────┘    └───────────┘
      │              │           │               │
   Patients     Seniors    Law Enforcement  Patients
   Providers    Admins     Constables       Providers
```

### Database Isolation

- **Tenant ID on every table** - `tenant_id UUID` references `tenants(id)`
- **Row-Level Security (RLS)** - PostgreSQL enforces data isolation
- **Super admin bypass** - Envision staff can access cross-tenant for support

### Subdomain Routing

Each tenant gets their own subdomain:

- `methodist.thewellfitcommunity.org` → Methodist Hospital
- `houston.thewellfitcommunity.org` → Houston Senior Services
- `precinct3.thewellfitcommunity.org` → Precinct 3 Sheriff
- `seattle.thewellfitcommunity.org` → Seattle Community Health

---

## Deployment Scenarios

### Scenario 1: Hospital System Deployment

**Client:** Methodist Hospital
**Use Case:** Patient engagement, telehealth, FHIR integration, medical billing
**Users:** 10,000 patients, 250 providers
**License:** Enterprise

#### Features Enabled:
- ✅ EHR Integration (FHIR) - Epic, Cerner
- ✅ Medical Billing (CPT/ICD-10 coding, 837P claims)
- ✅ Telehealth (HIPAA-compliant video)
- ✅ Smart Scribe (Riley AI clinical documentation)
- ✅ Patient check-ins
- ✅ Medication management
- ✅ Lab results viewing
- ✅ Care coordination
- ❌ Dental module (not needed)
- ❌ Law enforcement (not needed)

---

### Scenario 2: Senior Care Facility Deployment

**Client:** Houston Senior Services
**Use Case:** Daily wellness checks, community engagement, family communication
**Users:** 500 seniors, 50 staff
**License:** Standard

#### Features Enabled:
- ✅ Daily check-ins
- ✅ Community moments (photo sharing)
- ✅ Trivia games
- ✅ Telehealth
- ✅ Medication reminders
- ✅ Emergency alerts
- ❌ Medical billing (not needed)
- ❌ FHIR integration (not needed)

---

### Scenario 3: Law Enforcement Partnership

**Client:** Precinct 3 Constable Office
**Use Case:** Senior welfare checks, emergency response coordination
**Users:** 200 seniors, 25 constables
**License:** Premium

#### Features Enabled:
- ✅ Daily check-ins with alerts
- ✅ Law enforcement module (Constable Dispatch Dashboard)
- ✅ Emergency contacts & response info
- ✅ Welfare check dispatch
- ✅ Family notifications
- ✅ Emergency alerts
- ❌ Medical billing (not needed)
- ❌ Dental module (not needed)

---

## Step-by-Step Deployment

### Phase 1: Tenant Provisioning

#### 1.1 Create Tenant Record

Navigate to **Super Admin Panel** → **Tenant Management** → **Create New Tenant**

**Or run SQL directly:**

```sql
-- Create Methodist Hospital tenant
INSERT INTO tenants (
  name,
  subdomain,
  tenant_code,
  app_name,
  logo_url,
  primary_color,
  secondary_color,
  gradient,
  custom_footer,
  is_active
) VALUES (
  'Methodist Hospital',
  'methodist',
  'MH-6702',
  'Methodist Health Portal',
  'https://your-storage-bucket.supabase.co/storage/v1/object/public/tenant-logos/methodist-logo.png',
  '#003865',
  '#8cc63f',
  'linear-gradient(to bottom right, #003865, #8cc63f)',
  '© 2025 Methodist Hospital. All rights reserved. HIPAA-compliant healthcare platform.',
  true
);
```

#### 1.2 Configure Branding

**Option A: Use Admin UI**

1. Login as super admin
2. Navigate to `/admin/branding` (if tenant admin) OR `/super-admin` → select tenant → Branding
3. Upload logo
4. Select colors using color picker
5. Set app name
6. Set custom footer text
7. Save (audit logged)

**Option B: SQL**

```sql
UPDATE tenants
SET
  app_name = 'Methodist Health Portal',
  primary_color = '#003865',
  secondary_color = '#8cc63f',
  logo_url = 'https://...',
  custom_footer = '© 2025 Methodist Hospital...'
WHERE tenant_code = 'MH-6702';
```

#### 1.3 Configure Modules

```sql
-- Enable enterprise features for Methodist Hospital
UPDATE tenant_module_config
SET
  -- Core modules
  dashboard_enabled = true,
  check_ins_enabled = true,
  community_enabled = true,

  -- Clinical modules
  telehealth_enabled = true,
  messaging_enabled = true,
  medications_enabled = true,
  pharmacy_enabled = true,

  -- Enterprise features
  ehr_integration_enabled = true,
  fhir_enabled = true,
  ai_scribe_enabled = true,
  billing_integration_enabled = true,
  rpm_ccm_enabled = true,

  -- SDOH & specialty
  sdoh_enabled = true,
  dental_enabled = false,

  -- Law enforcement
  law_enforcement_module = false,

  -- NurseOS
  nurseos_clarity_enabled = true,
  nurseos_shield_enabled = true,
  resilience_hub_enabled = true,

  -- Security & compliance
  hipaa_audit_logging = true,
  mfa_enforcement = true,

  -- License tier
  license_tier = 'enterprise'
WHERE tenant_id = (SELECT id FROM tenants WHERE tenant_code = 'MH-6702');
```

---

### Phase 2: DNS Configuration

#### 2.1 Add DNS Record

Point subdomain to your Vercel deployment:

```
Type: CNAME
Name: methodist
Value: cname.vercel-dns.com
TTL: 3600
```

#### 2.2 Verify DNS

```bash
dig methodist.thewellfitcommunity.org

# Should return Vercel IP addresses
```

#### 2.3 Add Domain to Vercel

1. Login to Vercel dashboard
2. Go to your project → Settings → Domains
3. Add domain: `methodist.thewellfitcommunity.org`
4. Wait for SSL certificate provisioning (automatic)

---

### Phase 3: User Provisioning

#### 3.1 Create Admin User

**Option A: Use Super Admin Panel**

1. Navigate to `/super-admin`
2. Select tenant (Methodist Hospital)
3. Click "Create Admin User"
4. Enter email, name, phone
5. Assign role: `admin`
6. Generate PIN for admin authentication

**Option B: Use Enrollment Flow**

1. Navigate to `/admin/enroll-senior` (as super admin)
2. Select tenant: Methodist Hospital
3. Enter user details
4. Assign role: `admin` or `healthcare_provider`
5. Send invitation email

**Option C: SQL**

```sql
-- First create user in auth.users via Supabase Auth API
-- Then create profile:

INSERT INTO profiles (
  id,
  tenant_id,
  email,
  full_name,
  role,
  phone
) VALUES (
  '...', -- UUID from auth.users
  (SELECT id FROM tenants WHERE tenant_code = 'MH-6702'),
  'admin@methodisthospital.com',
  'Dr. John Smith',
  'admin',
  '+15551234567'
);

-- Add to user_roles
INSERT INTO user_roles (user_id, role)
VALUES ('...', 'admin');
```

#### 3.2 Bulk User Import

Use bulk enrollment endpoint:

```bash
POST /api/admin/bulk-enroll
Authorization: Bearer <super_admin_token>
Content-Type: application/json

{
  "tenantCode": "MH-6702",
  "users": [
    {
      "email": "patient1@example.com",
      "fullName": "Jane Doe",
      "phone": "+15551234567",
      "role": "patient",
      "dateOfBirth": "1945-06-15"
    },
    ...
  ]
}
```

---

## Hospital Workflow Configuration

### FHIR Integration Setup

#### 1. Configure Epic Connection

```env
# Add to Vercel environment variables
REACT_APP_EPIC_FHIR_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
REACT_APP_EPIC_CLIENT_ID=<your_epic_client_id>
REACT_APP_EPIC_CLIENT_SECRET=<your_epic_client_secret>
```

#### 2. Configure Cerner Connection

```env
REACT_APP_CERNER_FHIR_URL=https://fhir-ehr.cerner.com/r4/<tenant_id>
REACT_APP_CERNER_CLIENT_ID=<your_cerner_client_id>
REACT_APP_CERNER_CLIENT_SECRET=<your_cerner_client_secret>
```

#### 3. Test FHIR Connection

```bash
# Use the FHIR test endpoint
curl https://methodist.thewellfitcommunity.org/api/fhir/test-connection
```

---

### Medical Billing Configuration

#### 1. Configure Clearinghouse Integration

```env
# Add billing clearinghouse credentials
BILLING_CLEARINGHOUSE_URL=https://api.clearinghouse.com
BILLING_CLEARINGHOUSE_API_KEY=<api_key>
BILLING_NPI=<facility_npi>
```

#### 2. Upload Fee Schedules

```sql
-- Import CPT codes with facility-specific pricing
INSERT INTO fee_schedules (
  tenant_id,
  code_type,
  code,
  fee_amount,
  effective_date
)
SELECT
  (SELECT id FROM tenants WHERE tenant_code = 'MH-6702'),
  'CPT',
  code,
  fee,
  CURRENT_DATE
FROM csv_import_table;
```

#### 3. Configure Payers

```sql
-- Add insurance payers
INSERT INTO payers (
  tenant_id,
  payer_name,
  payer_id,
  payer_type
) VALUES
  ((SELECT id FROM tenants WHERE tenant_code = 'MH-6702'), 'Medicare', '00000', 'medicare'),
  ((SELECT id FROM tenants WHERE tenant_code = 'MH-6702'), 'Blue Cross Blue Shield', '12345', 'commercial');
```

---

### Telehealth Configuration

#### 1. Configure Daily.co

```env
# Daily.co API key for HIPAA-compliant video
DAILY_API_KEY=<your_daily_api_key>
DAILY_DOMAIN=<your_daily_domain>
```

#### 2. Test Video Rooms

```bash
# Create test room
curl -X POST https://methodist.thewellfitcommunity.org/api/telehealth/create-room \
  -H "Authorization: Bearer <token>" \
  -d '{"appointmentId": "test-123"}'
```

---

## Law Enforcement Module Setup

### For Constable/Sheriff Partnerships

#### 1. Enable Law Enforcement Module

```sql
UPDATE tenant_module_config
SET law_enforcement_module = true
WHERE tenant_id = (SELECT id FROM tenants WHERE tenant_code = 'P3-1234');
```

#### 2. Configure Emergency Response Info

Navigate to **Admin Panel** → **Law Enforcement** → **Emergency Response Setup**

Or use SQL:

```sql
-- Add emergency response info for senior
INSERT INTO law_enforcement_response_info (
  tenant_id,
  patient_id,
  -- Mobility
  wheelchair_bound,
  walker_required,
  -- Medical
  oxygen_dependent,
  oxygen_tank_location,
  -- Access
  floor_number,
  elevator_required,
  door_code,
  key_location,
  -- Contacts
  neighbor_name,
  neighbor_phone,
  -- Priority
  response_priority,
  escalation_delay_hours,
  special_instructions
) VALUES (
  (SELECT id FROM tenants WHERE tenant_code = 'P3-1234'),
  '<patient_id>',
  false,
  true,
  true,
  'Bedroom closet, second shelf',
  2,
  true,
  '1234',
  'Under doormat',
  'John Smith',
  '+15551234567',
  'high',
  6,
  'Patient is hard of hearing. Knock loudly. Call neighbor first if no answer.'
);
```

#### 3. Grant Constable Access

```sql
-- Create constable user
INSERT INTO profiles (
  id,
  tenant_id,
  email,
  full_name,
  role
) VALUES (
  '<user_id>',
  (SELECT id FROM tenants WHERE tenant_code = 'P3-1234'),
  'constable.jones@precinct3.gov',
  'Deputy Jones',
  'admin'
);

-- Grant admin role for constable dispatch dashboard access
INSERT INTO user_roles (user_id, role)
VALUES ('<user_id>', 'admin');
```

#### 4. Test Welfare Check Workflow

1. Login as constable: `https://precinct3.thewellfitcommunity.org/admin-login`
2. Navigate to `/constable-dispatch`
3. View missed check-in alerts
4. Click on senior to view welfare check info
5. Test SMS reminder: Click "Send Reminder"
6. Test family notification: Click "Notify Family"

---

## Multi-Tenant Management

### Super Admin Master Panel

Access: `https://thewellfitcommunity.org/super-admin`

**Capabilities:**

1. **Tenant Management**
   - Create/suspend/activate tenants
   - View tenant metrics (users, patients, activity)
   - Set resource limits (max users, storage quota, API rate limits)

2. **Feature Flags**
   - Enable/disable features globally
   - Emergency kill switch (force disable feature across all tenants)
   - Set defaults for new tenants

3. **Platform-Wide Dashboards**
   - Platform SOC2 compliance dashboard
   - AI cost & usage tracking (all tenants)
   - Guardian agent monitoring (self-healing system)
   - Super admin audit logs

4. **Multi-Tenant Monitoring**
   - Select up to 4 tenants simultaneously
   - Split-screen grid layout
   - HIPAA-compliant metrics only (no PHI)
   - Real-time activity monitoring

### Assigning Envision Staff to Tenants

```sql
-- Assign Maria (Envision staff) to Methodist Hospital
INSERT INTO super_admin_tenant_assignments (
  super_admin_id,
  tenant_id,
  access_level,
  assigned_at
) VALUES (
  (SELECT id FROM super_admin_users WHERE email = 'maria@envisionvirtualedge.com'),
  (SELECT id FROM tenants WHERE tenant_code = 'MH-6702'),
  'full',
  NOW()
);
```

---

## Testing & Validation

### Pre-Launch Checklist

#### 1. Branding Verification

- [ ] Logo displays correctly
- [ ] Primary/secondary colors applied
- [ ] App name correct in header
- [ ] Custom footer displays
- [ ] Subdomain resolves correctly
- [ ] SSL certificate active

#### 2. User Access Testing

- [ ] Admin login works with PIN
- [ ] Patient registration works
- [ ] Email verification sends
- [ ] SMS verification works (Twilio)
- [ ] Password reset works

#### 3. Module Functionality

- [ ] Daily check-ins work
- [ ] Telehealth video rooms create successfully
- [ ] FHIR data imports (if enabled)
- [ ] Medical billing codes suggest (if enabled)
- [ ] Law enforcement dispatch dashboard (if enabled)
- [ ] Emergency alerts send

#### 4. Data Isolation

- [ ] Users can only see their tenant's data
- [ ] Cross-tenant queries return 0 results
- [ ] RLS policies enforced

#### 5. Compliance

- [ ] HIPAA audit logging active
- [ ] PHI encryption working (if enabled)
- [ ] Consent tracking works
- [ ] MFA enforcement (if enabled)

---

### Load Testing

#### Recommended Tools:

- **k6** - Load testing
- **Artillery** - API load testing

#### Sample Test:

```javascript
// k6 load test
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
};

export default function () {
  let res = http.get('https://methodist.thewellfitcommunity.org/api/health');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

---

## Deployment Checklist

### Production Deployment

- [ ] Database migrations applied (`npx supabase db push`)
- [ ] Edge functions deployed (`npx supabase functions deploy`)
- [ ] Environment variables set in Vercel
- [ ] DNS configured and verified
- [ ] SSL certificate active
- [ ] Tenant record created
- [ ] Branding configured
- [ ] Modules enabled
- [ ] Admin users created
- [ ] FHIR integration tested (if applicable)
- [ ] Billing configured (if applicable)
- [ ] Law enforcement module tested (if applicable)
- [ ] Load testing complete
- [ ] Security audit complete
- [ ] HIPAA compliance verified
- [ ] Backup strategy confirmed
- [ ] Monitoring alerts configured

---

## Support & Maintenance

### Ongoing Support

**Envision VirtualEdge Group**
- Email: support@envisionvirtualedge.com
- Phone: +1-555-ENVISION
- Hours: 24/7 for Enterprise clients

### Monthly Maintenance

- Review tenant activity metrics
- Update fee schedules (billing clients)
- Rotate API keys quarterly
- Review audit logs for compliance
- Update FHIR integrations as needed
- Monitor AI usage and costs
- Review Guardian agent alerts

---

## Advanced Topics

### Custom Workflows

For tenant-specific workflows not covered by module configuration, contact Envision development team for custom implementation.

### API Access

Enterprise clients can request API keys for custom integrations:

```sql
-- Generate API key for tenant
SELECT generate_api_key('MH-6702', 'Methodist Hospital Integration');
```

### White-Label Mobile App

Coming soon: iOS and Android white-label mobile apps with custom branding and per-tenant app store listings.

---

## Appendix

### Tenant Codes by Organization Type

- **Hospitals:** `MH-` prefix (Methodist Hospital: MH-6702)
- **Law Enforcement:** `P3-` prefix (Precinct 3: P3-1234)
- **Senior Care:** `SC-` prefix (Senior Care: SC-5001)
- **Envision Internal:** `EVG-` prefix (EVG-0001)

### License Tier Comparison

| Feature | Basic | Standard | Premium | Enterprise |
|---------|-------|----------|---------|------------|
| Users | 100 | 500 | 2,000 | Unlimited |
| Telehealth | ❌ | ✅ | ✅ | ✅ |
| FHIR Integration | ❌ | ❌ | ✅ | ✅ |
| Medical Billing | ❌ | ❌ | ✅ | ✅ |
| AI Scribe | ❌ | ❌ | ✅ | ✅ |
| Law Enforcement | ❌ | ✅ | ✅ | ✅ |
| Custom Branding | ✅ | ✅ | ✅ | ✅ |
| Priority Support | ❌ | ❌ | ✅ | ✅ 24/7 |
| SLA | 99% | 99.5% | 99.9% | 99.95% |

---

**Document Version:** 1.0
**Last Updated:** 2025-11-16
**Maintained By:** Envision VirtualEdge Group LLC
