# Law Enforcement "The SHIELD Program" Deployment Guide

**Deploy a white-labeled instance for law enforcement agencies in 20 minutes**

This guide walks you through deploying WellFit for law enforcement agencies (Constable, Sheriff, Police) with **ONLY** welfare check features - no hospital/medical features.

---

## Overview

### What Gets Deployed

✅ **Law Enforcement Features Only:**
- Senior daily check-ins
- Constable dispatch dashboard
- Missed check-in alerts
- Emergency response information
- Welfare check coordination
- SMS notifications to seniors and families

❌ **What Gets Hidden:**
- Medical billing
- FHIR/EHR integration
- Clinical documentation (SOAP notes, Smart Scribe)
- Telehealth consultations
- Medication management (except emergency info)
- Lab results
- Immunizations
- Care plans

### Use Cases

- **Constable SHIELD Programs** (Senior & Health-Impaired Emergency Liaison Dispatch) - Daily welfare checks for isolated seniors
- **Sheriff Senior Safety Programs** - Community policing for elderly residents
- **Police Department Senior Services** - Proactive senior welfare monitoring

---

## Quick Start: Your Agency Deployment

### Step 1: Create Tenant (3 minutes)

```sql
-- Create law enforcement tenant
INSERT INTO tenants (
  name,
  subdomain,
  tenant_code,
  app_name,
  primary_color,
  secondary_color,
  is_active
) VALUES (
  'Your Agency Name',
  'youragency',
  'LE-1234',
  'Your Agency Senior Safety',
  '#003366',  -- Dark blue (law enforcement blue)
  '#FFD700',  -- Gold (badge color)
  true
) RETURNING id;
```

### Step 2: Configure Feature Flags (5 minutes)

**This is critical:** Turn OFF all non-law-enforcement features

```sql
-- Configure modules for law enforcement ONLY
UPDATE tenant_module_config
SET
  -- Core features (ENABLED)
  dashboard_enabled = true,
  check_ins_enabled = true,
  community_enabled = false,  -- Optional: disable if not needed

  -- Medical features (ALL DISABLED)
  telehealth_enabled = false,
  messaging_enabled = false,  -- Or enable for officer-senior messaging
  medications_enabled = false,
  pharmacy_enabled = false,
  dental_enabled = false,

  -- Clinical features (ALL DISABLED)
  ehr_integration_enabled = false,
  fhir_enabled = false,
  ai_scribe_enabled = false,
  billing_integration_enabled = false,
  rpm_ccm_enabled = false,

  -- SDOH (DISABLED - unless tracking social determinants)
  sdoh_enabled = false,

  -- Law enforcement (ENABLED)
  law_enforcement_module = true,

  -- NurseOS (DISABLED - not relevant)
  nurseos_clarity_enabled = false,
  nurseos_shield_enabled = false,
  resilience_hub_enabled = false,

  -- Security (ENABLED for compliance)
  hipaa_audit_logging = true,
  mfa_enforcement = false,  -- Optional

  -- License tier
  license_tier = 'premium'

WHERE tenant_id = (SELECT id FROM tenants WHERE tenant_code = 'LE-1234');
```

### Step 3: Set Custom Landing Page (2 minutes)

**Option A: Set as Default Route (Recommended)**

Edit tenant settings to use law enforcement landing page as home:

```sql
UPDATE tenants
SET theme_settings = jsonb_set(
  COALESCE(theme_settings, '{}'::jsonb),
  '{defaultLandingPage}',
  '"law-enforcement"'
)
WHERE tenant_code = 'LE-1234';
```

**Option B: Add Route Manually**

If you want to manually control routing, add this to App.tsx:

```typescript
// In App.tsx routes section:
<Route
  path="/"
  element={
    // Check if tenant has law enforcement mode enabled
    tenantConfig?.law_enforcement_module ?
      <LawEnforcementLandingPage /> :
      <WelcomePage />
  }
/>
```

### Step 4: Upload Branding (3 minutes)

```bash
# Upload constable badge/logo
supabase storage upload tenant-logos/youragency-badge.png ./youragency-badge.png
```

```sql
UPDATE tenants
SET
  logo_url = 'https://yourproject.supabase.co/storage/v1/object/public/tenant-logos/youragency-badge.png',
  gradient = 'linear-gradient(to bottom right, #003366, #FFD700)',
  custom_footer = '© 2025 Your Agency Name. Protecting our senior community.'
WHERE tenant_code = 'LE-1234';
```

### Step 5: Configure DNS (3 minutes)

```
Type: CNAME
Name: youragency
Value: cname.vercel-dns.com
TTL: 3600
```

Add to Vercel:
- Domain: `youragency.thewellfitcommunity.org`
- Wait for SSL

### Step 6: Create Officer Accounts (2 minutes)

```sql
-- Create constable user
INSERT INTO profiles (
  id,  -- From auth.users
  tenant_id,
  email,
  full_name,
  role
) VALUES (
  '<user_id>',
  (SELECT id FROM tenants WHERE tenant_code = 'LE-1234'),
  'officer@youragency.gov',
  'Officer Michael Jones',
  'admin'
);

-- Grant admin role for dispatch dashboard access
INSERT INTO user_roles (user_id, role)
VALUES ('<user_id>', 'admin');

-- Set PIN for officer login
INSERT INTO admin_pins (user_id, pin_hash)
VALUES ('<user_id>', '<bcrypt_hash>');
```

### Step 7: Enroll Seniors (2 minutes)

**Option A: Bulk Import**

```csv
email,fullName,phone,dateOfBirth,address
senior1@example.com,Mary Johnson,+15551234567,1940-05-15,123 Oak St
senior2@example.com,John Smith,+15559876543,1938-12-20,456 Maple Ave
```

Upload via: `/admin/bulk-enroll`

**Option B: Individual Enrollment**

Navigate to: `/admin/enroll-senior`

Fill in:
- Name
- Phone
- Address
- Emergency contacts
- Emergency response info (mobility, access, etc.)

---

## Feature Flag Reference

### What Each Flag Controls

| Flag | Controls | Law Enforcement Setting |
|------|----------|------------------------|
| `dashboard_enabled` | User dashboard access | ✅ **true** |
| `check_ins_enabled` | Daily check-in feature | ✅ **true** |
| `community_enabled` | Photo sharing, social feed | ⚠️ Optional (usually **false**) |
| `telehealth_enabled` | Video consultations | ❌ **false** |
| `messaging_enabled` | Secure messaging | ⚠️ Optional (enable for officer-senior chat) |
| `medications_enabled` | Medication tracking UI | ❌ **false** |
| `pharmacy_enabled` | Pharmacy integration | ❌ **false** |
| `dental_enabled` | Dental tracking | ❌ **false** |
| `ehr_integration_enabled` | Epic/Cerner FHIR | ❌ **false** |
| `fhir_enabled` | All FHIR features | ❌ **false** |
| `ai_scribe_enabled` | Riley AI clinical docs | ❌ **false** |
| `billing_integration_enabled` | Medical billing | ❌ **false** |
| `rpm_ccm_enabled` | Remote patient monitoring | ❌ **false** |
| `sdoh_enabled` | Social determinants | ⚠️ Optional (useful for welfare) |
| **`law_enforcement_module`** | **Constable dispatch dashboard** | ✅ **true** |
| `nurseos_clarity_enabled` | Nurse handoff tools | ❌ **false** |
| `nurseos_shield_enabled` | Nurse safety tools | ❌ **false** |
| `resilience_hub_enabled` | Nurse wellness | ❌ **false** |
| `hipaa_audit_logging` | Audit trail compliance | ✅ **true** |
| `mfa_enforcement` | Multi-factor auth | ⚠️ Optional |

---

## Navigation Menu Customization

With the above feature flags, the app will automatically hide disabled features from the navigation menu.

### What Seniors See:
- ✅ Home / Dashboard
- ✅ Daily Check-In
- ✅ Emergency Contacts (if messaging enabled)
- ✅ Help / Support
- ❌ Medications (hidden)
- ❌ Telehealth (hidden)
- ❌ Lab Results (hidden)

### What Officers See (Admin Panel):
- ✅ Constable Dispatch Dashboard (`/constable-dispatch`)
- ✅ Enroll Senior
- ✅ View Senior List
- ✅ Emergency Response Info
- ✅ Audit Logs
- ❌ Billing Dashboard (hidden)
- ❌ FHIR Export (hidden)
- ❌ Smart Scribe (hidden)

---

## Emergency Response Information Setup

### Critical Data for Officers

When enrolling seniors, collect this information (displayed in Constable Dispatch):

#### Access Information
- Floor number
- Elevator required? Code?
- Door code / key location
- Building type (apartment, house, senior center)
- Best entrance
- Parking instructions
- Gated community code

#### Mobility Status
- Bed-bound?
- Wheelchair-bound?
- Walker/cane required?
- Stairs to unit?

#### Medical Equipment
- Oxygen dependent? Tank location?
- Dialysis required?
- Other equipment (wheelchair, hospital bed, etc.)

#### Communication Needs
- Hearing impaired? (knock loudly, use doorbell)
- Vision impaired?
- Cognitive impairment? (dementia, Alzheimer's)
- Non-verbal?
- Language barrier?

#### Safety Information
- Fall risk?
- Pets in home? (dogs, cats)
- Home hazards (loose rugs, stairs)

#### Contacts
- Neighbor name, address, phone
- Building manager
- Emergency contacts (family)

#### Priority Level
- **Critical** - Immediate response (<2 hours)
- **High** - Priority response (<6 hours)
- **Standard** - Normal welfare check (<24 hours)

---

## Testing the Deployment

### 1. Verify Landing Page

Visit: `https://youragency.thewellfitcommunity.org`

- [ ] Should show law enforcement landing page (not standard WelcomePage)
- [ ] Branding shows constable badge
- [ ] Colors are law enforcement blue/gold
- [ ] Explains The SHIELD Program (Senior & Health-Impaired Emergency Liaison Dispatch)

### 2. Test Officer Login

1. Navigate to `/admin-login`
2. Enter:
   - Email: officer@youragency.gov
   - Tenant Code: LE-1234
   - PIN: (officer PIN)
3. Should redirect to `/admin`

### 3. Test Dispatch Dashboard

1. Click "Constable Dispatch" in admin menu
2. Should show `/constable-dispatch`
3. Should display missed check-in alerts (if any)
4. Click on alert → Should show full emergency response info
5. Test "Send Reminder" button
6. Test "Notify Family" button

### 4. Test Senior Check-In

1. Register test senior
2. Complete daily check-in
3. Verify shows up as "OK" in dispatch dashboard
4. Don't check in next day
5. Verify appears in "Missed Check-In Alerts"

### 5. Verify Features Hidden

1. Login as senior
2. Navigation menu should NOT show:
   - Medications
   - Telehealth
   - Lab Results
   - Immunizations
   - Care Plans
3. Admin menu should NOT show:
   - Billing Dashboard
   - FHIR Export
   - Smart Scribe

---

## Configuring Alert Escalation

### Set Custom Escalation Delays

Different seniors may need different check-in frequencies:

```sql
-- Critical priority: 2-hour escalation
UPDATE law_enforcement_response_info
SET
  response_priority = 'critical',
  escalation_delay_hours = 2
WHERE patient_id = '<high_risk_senior_id>';

-- Standard priority: 24-hour escalation
UPDATE law_enforcement_response_info
SET
  response_priority = 'standard',
  escalation_delay_hours = 24
WHERE patient_id = '<low_risk_senior_id>';
```

---

## SMS Notifications

### What Gets Sent

1. **Daily Check-In Reminder** (if missed)
   - Sent to senior's phone
   - Example: "Hi Mary, this is your daily check-in reminder from Your Agency Senior Safety. Please complete your check-in at your earliest convenience."

2. **Family Notification** (if missed + escalated)
   - Sent to emergency contact
   - Example: "ALERT: Mary Johnson has missed their scheduled check-in. Please attempt to contact them or request a welfare check if you cannot reach them."

### Configure SMS Settings

```env
# Twilio credentials (add to Vercel env vars)
TWILIO_ACCOUNT_SID=<your_sid>
TWILIO_AUTH_TOKEN=<your_token>
TWILIO_FROM_NUMBER=+15551234567
```

Test SMS:

```bash
curl -X POST https://youragency.thewellfitcommunity.org/api/functions/send-check-in-reminder-sms \
  -d '{"phone": "+15559876543", "name": "Mary"}'
```

---

## Workflow Example

### Daily Workflow for Constable Office

**Morning (8:00 AM)**
1. Officer logs into dispatch dashboard
2. Reviews overnight missed check-ins
3. Prioritizes by urgency score:
   - Red = Critical (immediate welfare check needed)
   - Orange = High priority (check within 6 hours)
   - Yellow = Standard (check within 24 hours)

**Action for Each Alert**
1. Click on alert to view full emergency response info
2. Review:
   - Last check-in time
   - Address & access information
   - Mobility status
   - Medical equipment
   - Special instructions
3. Decide action:
   - **Send Reminder** - Sends SMS to senior
   - **Notify Family** - Sends SMS to emergency contact
   - **Dispatch Officer** - Perform welfare check in person
4. Officer performs welfare check using access info
5. Mark as resolved in system

**Weekly Review**
- Review seniors with frequent missed check-ins
- Update emergency response info if needed
- Contact family if pattern of non-compliance

---

## Troubleshooting

### Dashboard Shows Medical Features

**Problem:** Admin panel shows billing, FHIR, etc.

**Solution:**
```sql
-- Verify feature flags are set correctly
SELECT * FROM tenant_module_config
WHERE tenant_id = (SELECT id FROM tenants WHERE tenant_code = 'LE-1234');

-- Should show false for medical features
-- If not, run the configuration SQL from Step 2 again
```

### Landing Page Shows Standard Welcome Page

**Problem:** Homepage shows generic WelcomePage instead of law enforcement page

**Solution:**
1. Check tenant settings:
   ```sql
   SELECT theme_settings FROM tenants WHERE tenant_code = 'LE-1234';
   ```
2. Set law enforcement landing:
   ```sql
   UPDATE tenants
   SET theme_settings = jsonb_set(
     COALESCE(theme_settings, '{}'::jsonb),
     '{defaultLandingPage}',
     '"law-enforcement"'
   )
   WHERE tenant_code = 'LE-1234';
   ```

### Constable Dispatch Dashboard Not Accessible

**Problem:** 404 error when visiting `/constable-dispatch`

**Solution:**
1. Verify route added to App.tsx (should be done automatically)
2. Verify officer has admin role:
   ```sql
   SELECT * FROM user_roles WHERE user_id = '<officer_id>';
   ```
3. Add admin role if missing

---

## Best Practices

### 1. Senior Onboarding

- Schedule in-person enrollment sessions
- Collect emergency info in person (more complete)
- Test check-in process before leaving
- Provide printed instructions with phone number

### 2. Emergency Response Info

- Update quarterly or after any change
- Verify key codes still work
- Confirm neighbor contact info
- Review medical equipment status

### 3. Officer Training

- Train all officers on dispatch dashboard
- Practice welfare checks with test data
- Review escalation procedures
- Establish protocol for non-responsive seniors

### 4. Family Communication

- Inform families of program enrollment
- Provide emergency contact instructions
- Set expectations for notifications
- Get consent for SMS notifications

---

## Support

**Envision VirtualEdge Group**
- Email: lawenforcement@envisionvirtualedge.com
- Phone: +1-555-WELFARE
- Emergency: 24/7 for Premium+ clients

---

**Deployment Time:** ~20 minutes
**Difficulty:** Easy
**Cost:** Premium tier (~$500-1000/month for 200 seniors)

**You're all set!** Your agency now has a dedicated senior welfare check platform with NO medical features cluttering the interface.
