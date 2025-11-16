# Quick Start: Hospital White-Label Deployment

**Deploy a white-labeled instance in 30 minutes**

This guide walks you through deploying WellFit for "Methodist Hospital" with full enterprise features including FHIR integration, medical billing, and telehealth.

---

## Prerequisites

- [ ] Super admin access to WellFit platform
- [ ] Methodist Hospital branding assets (logo, colors)
- [ ] Domain access for DNS configuration
- [ ] Epic/Cerner FHIR credentials (if integrating EHR)
- [ ] Daily.co account for telehealth (HIPAA Business Associate Agreement signed)

---

## Step 1: Create Tenant (5 minutes)

### Option A: SQL (Fastest)

```sql
-- Create tenant
INSERT INTO tenants (
  name,
  subdomain,
  tenant_code,
  app_name,
  primary_color,
  secondary_color,
  is_active
) VALUES (
  'Methodist Hospital',
  'methodist',
  'MH-6702',
  'Methodist Health Portal',
  '#003865',  -- Methodist Blue
  '#8cc63f',  -- Methodist Green
  true
) RETURNING id;

-- Save the tenant ID for next steps
-- Example: '123e4567-e89b-12d3-a456-426614174000'
```

### Option B: Admin UI

1. Navigate to `https://thewellfitcommunity.org/super-admin`
2. Click "Tenant Management" → "Create New Tenant"
3. Fill in form:
   - **Name:** Methodist Hospital
   - **Subdomain:** methodist
   - **Tenant Code:** MH-6702
   - **App Name:** Methodist Health Portal
4. Click "Create Tenant"

---

## Step 2: Configure Branding (5 minutes)

### Upload Logo

```bash
# Using Supabase Storage
supabase storage upload tenant-logos/methodist-logo.png ./methodist-logo.png

# Get public URL
https://yourproject.supabase.co/storage/v1/object/public/tenant-logos/methodist-logo.png
```

### Update Tenant with Logo

```sql
UPDATE tenants
SET
  logo_url = 'https://yourproject.supabase.co/storage/v1/object/public/tenant-logos/methodist-logo.png',
  gradient = 'linear-gradient(to bottom right, #003865, #8cc63f)',
  custom_footer = '© 2025 Methodist Hospital. All rights reserved. HIPAA-compliant healthcare platform.'
WHERE tenant_code = 'MH-6702';
```

---

## Step 3: Enable Enterprise Features (3 minutes)

```sql
-- Configure modules for enterprise hospital deployment
UPDATE tenant_module_config
SET
  -- Core features
  dashboard_enabled = true,
  check_ins_enabled = true,
  community_enabled = true,

  -- Clinical workflows
  telehealth_enabled = true,
  messaging_enabled = true,
  medications_enabled = true,

  -- Enterprise features
  ehr_integration_enabled = true,
  fhir_enabled = true,
  ai_scribe_enabled = true,
  billing_integration_enabled = true,
  rpm_ccm_enabled = true,

  -- SDOH tracking
  sdoh_enabled = true,

  -- Security
  hipaa_audit_logging = true,
  mfa_enforcement = true,

  -- License tier
  license_tier = 'enterprise'

WHERE tenant_id = (SELECT id FROM tenants WHERE tenant_code = 'MH-6702');
```

---

## Step 4: DNS Configuration (5 minutes)

### Add DNS Record

**Using Cloudflare, AWS Route53, or your DNS provider:**

```
Type: CNAME
Name: methodist
Value: cname.vercel-dns.com
TTL: 3600 (1 hour)
```

### Add Domain to Vercel

1. Login to Vercel dashboard
2. Go to project → Settings → Domains
3. Add: `methodist.thewellfitcommunity.org`
4. Wait for SSL provisioning (~2 minutes)

### Verify

```bash
# Test DNS resolution
dig methodist.thewellfitcommunity.org

# Test HTTPS
curl -I https://methodist.thewellfitcommunity.org
# Should return: HTTP/2 200
```

---

## Step 5: Configure FHIR Integration (5 minutes)

### Add Environment Variables to Vercel

1. Go to Vercel → Settings → Environment Variables
2. Add the following:

```env
# Epic FHIR
REACT_APP_EPIC_FHIR_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
REACT_APP_EPIC_CLIENT_ID=your_epic_client_id
REACT_APP_EPIC_CLIENT_SECRET=your_epic_client_secret

# Cerner FHIR (if applicable)
REACT_APP_CERNER_FHIR_URL=https://fhir-ehr.cerner.com/r4/your_tenant_id
REACT_APP_CERNER_CLIENT_ID=your_cerner_client_id
REACT_APP_CERNER_CLIENT_SECRET=your_cerner_client_secret

# Enable FHIR
REACT_APP_FHIR_ENABLED=true
```

3. **Redeploy** - Vercel will auto-redeploy with new env vars

### Test FHIR Connection

```bash
# Test Epic connection
curl -X POST https://methodist.thewellfitcommunity.org/api/fhir/test-epic

# Expected response:
{
  "success": true,
  "message": "Epic FHIR connection successful",
  "server": "https://fhir.epic.com/..."
}
```

---

## Step 6: Configure Telehealth (3 minutes)

### Add Daily.co Credentials

```env
# Add to Vercel environment variables
DAILY_API_KEY=your_daily_api_key
DAILY_DOMAIN=your-domain.daily.co
```

### Test Video Room Creation

```bash
# Create test telehealth room
curl -X POST https://methodist.thewellfitcommunity.org/api/telehealth/create-room \
  -H "Authorization: Bearer <admin_token>" \
  -d '{"appointmentId": "test-123", "patientId": "patient-456"}'

# Expected response:
{
  "success": true,
  "roomUrl": "https://your-domain.daily.co/test-room-123",
  "expiresAt": "2025-11-17T10:00:00Z"
}
```

---

## Step 7: Create Admin Users (4 minutes)

### Create Hospital Administrator

```sql
-- First, create auth user via Supabase Auth
-- Then create profile:

INSERT INTO profiles (
  id,  -- Must match auth.users.id
  tenant_id,
  email,
  full_name,
  role,
  phone
) VALUES (
  '<user_id_from_auth>',
  (SELECT id FROM tenants WHERE tenant_code = 'MH-6702'),
  'admin@methodisthospital.com',
  'Dr. Sarah Johnson',
  'admin',
  '+15551234567'
);

-- Add admin role
INSERT INTO user_roles (user_id, role)
VALUES ('<user_id_from_auth>', 'admin');

-- Set admin PIN (hash with bcrypt)
INSERT INTO admin_pins (user_id, pin_hash)
VALUES ('<user_id_from_auth>', '<bcrypt_hash_of_1234>');
```

### Or Use Admin Panel UI

1. Navigate to `/super-admin`
2. Select tenant: Methodist Hospital
3. Click "Create Admin User"
4. Fill in:
   - Email: admin@methodisthospital.com
   - Name: Dr. Sarah Johnson
   - Phone: +15551234567
   - Role: Admin
5. Generate PIN: 1234
6. Send invitation email

---

## Step 8: Verify Deployment (5 minutes)

### 1. Test Branding

Visit: `https://methodist.thewellfitcommunity.org`

- [ ] Logo displays correctly
- [ ] Colors are Methodist blue/green
- [ ] Header shows "Methodist Health Portal"
- [ ] Footer shows custom text

### 2. Test Admin Login

1. Go to `https://methodist.thewellfitcommunity.org/admin-login`
2. Enter:
   - **Email:** admin@methodisthospital.com
   - **Tenant Code:** MH-6702
   - **PIN:** 1234
3. Should redirect to admin dashboard

### 3. Test Features

- [ ] Navigate to Dashboard - Should see Methodist branding
- [ ] Check "Modules" tab - Should show enterprise features enabled
- [ ] Test telehealth - Click "Schedule Appointment" → Should create room
- [ ] Test FHIR - View patient records (if test data available)
- [ ] Test billing - Navigate to `/admin/billing` → Should load

### 4. Test Patient Registration

1. Logout
2. Click "Register" on homepage
3. Fill in patient details
4. Complete hCaptcha
5. Enter phone verification code
6. Should redirect to patient dashboard

### 5. Verify Data Isolation

- [ ] Login as patient user
- [ ] Should ONLY see Methodist Hospital branding
- [ ] Patient should NOT see data from other tenants
- [ ] Verify RLS policies working

---

## Step 9: Production Readiness

### Run Database Migrations

```bash
# Apply all pending migrations
cd /workspaces/WellFit-Community-Daily-Complete
npx supabase db push

# Verify migrations applied
psql $DATABASE_URL -c "SELECT * FROM tenants WHERE tenant_code = 'MH-6702';"
```

### Deploy Edge Functions

```bash
# Deploy all edge functions
npx supabase functions deploy

# Verify deployment
npx supabase functions list
```

### Security Checklist

- [ ] SSL certificate active (HTTPS)
- [ ] HIPAA audit logging enabled
- [ ] MFA enforcement configured
- [ ] RLS policies verified
- [ ] API rate limits set
- [ ] CORS configured correctly
- [ ] CSP headers configured

---

## Step 10: Go Live

### Pre-Launch Checklist

- [ ] Tenant record created
- [ ] Branding configured and verified
- [ ] DNS configured, SSL active
- [ ] Modules enabled correctly
- [ ] Admin users created
- [ ] FHIR integration tested
- [ ] Telehealth tested
- [ ] Patient registration tested
- [ ] Data isolation verified
- [ ] Security audit complete
- [ ] Load testing complete (if high volume expected)
- [ ] Backup strategy confirmed
- [ ] Monitoring alerts configured

### Launch!

1. **Notify stakeholders:** Send email to Methodist Hospital team
2. **Monitor:** Watch logs for first 24 hours
3. **Support:** Be available for questions

---

## Troubleshooting

### DNS Not Resolving

**Problem:** `methodist.thewellfitcommunity.org` not resolving

**Solution:**
1. Check DNS propagation: `dig methodist.thewellfitcommunity.org`
2. Wait 5-10 minutes for DNS propagation
3. Flush local DNS cache: `sudo dscacheutil -flushcache` (Mac)

---

### SSL Certificate Error

**Problem:** Browser shows "Not Secure"

**Solution:**
1. Verify domain added to Vercel
2. Wait for SSL provisioning (up to 5 minutes)
3. Check Vercel dashboard for SSL status

---

### FHIR Connection Failed

**Problem:** Epic/Cerner FHIR test fails

**Solution:**
1. Verify credentials are correct
2. Check if IP whitelisted with Epic/Cerner
3. Test OAuth flow manually
4. Check environment variables deployed to Vercel

---

### Users Can See Other Tenants' Data

**Problem:** Data isolation not working

**Solution:**
1. Verify RLS policies enabled:
   ```sql
   SELECT tablename, rowsecurity
   FROM pg_tables
   WHERE schemaname = 'public'
   AND rowsecurity = false;
   ```
2. Re-run RLS migration: `20250916000000_new_init_roles_and_security.sql`
3. Test query: `SELECT * FROM check_ins;` (should only return tenant's data)

---

## Next Steps

### Onboard Patients

1. **Bulk Import:** Use `/admin/bulk-enroll` to upload patient CSV
2. **Individual Registration:** Share registration link with patients
3. **Provider Invites:** Invite providers to create accounts

### Configure Billing

1. Upload fee schedules
2. Add insurance payers
3. Configure clearinghouse integration
4. Test claim generation

### Train Staff

1. Schedule training session with Methodist staff
2. Share documentation
3. Create custom workflows (if needed)

### Monitor & Optimize

1. Set up monitoring dashboards
2. Review audit logs weekly
3. Monitor AI usage and costs
4. Optimize performance based on usage patterns

---

## Support

**Envision VirtualEdge Group**

- **Email:** support@envisionvirtualedge.com
- **Phone:** +1-555-ENVISION
- **Emergency Hotline (Enterprise):** 24/7
- **Portal:** https://support.envisionvirtualedge.com

---

**Deployment Time:** ~30 minutes
**Difficulty:** Intermediate
**Prerequisites:** Super admin access, domain control, FHIR credentials

**Congratulations!** Methodist Hospital is now live with a fully white-labeled enterprise healthcare platform.
