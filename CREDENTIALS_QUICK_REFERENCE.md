# Epic/FHIR Credentials - Quick Reference

**Last Updated**: October 24, 2024

---

## 🔑 Where Are My Credentials?

Your Epic/FHIR credentials are stored in **4 locations** for different purposes.

---

## 📍 Location 1: `.env.local` (Local Development)

**File Path**: `/workspaces/WellFit-Community-Daily-Complete/.env.local`

**What to Add**:
```bash
# Epic FHIR Configuration
REACT_APP_EPIC_FHIR_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
REACT_APP_EPIC_CLIENT_ID=your_epic_client_id_from_app_orchard
REACT_APP_EPIC_CLIENT_SECRET=your_epic_client_secret_from_app_orchard

# Epic Sandbox (for testing)
REACT_APP_EPIC_SANDBOX_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
REACT_APP_EPIC_SANDBOX_CLIENT_ID=your_sandbox_client_id

# FHIR Integration Toggles
REACT_APP_FHIR_ENABLED=true
REACT_APP_FHIR_AUTO_SYNC_ENABLED=true
REACT_APP_FHIR_SYNC_FREQUENCY=hourly
REACT_APP_FHIR_SYNC_BATCH_SIZE=50

# Cerner Configuration (if using)
REACT_APP_CERNER_FHIR_URL=https://fhir-ehr-code.cerner.com/r4/your-tenant-id
REACT_APP_CERNER_CLIENT_ID=your_cerner_client_id

# Meditech Configuration (if using)
REACT_APP_MEDITECH_FHIR_URL=https://fhir.yourhospital.com/api/FHIR/R4
REACT_APP_MEDITECH_CLIENT_ID=your_meditech_client_id
```

**How to Create**:
```bash
# Copy the example file
cp .env.example .env.local

# Edit with your values
nano .env.local
# or
code .env.local
```

**Security Note**: ⚠️ **NEVER commit `.env.local` to git!**

Already in `.gitignore`:
```
.env.local
.env.*.local
```

---

## 📍 Location 2: Supabase Secrets (Edge Functions)

**Storage**: Supabase Cloud (encrypted)

**How to Set**:
```bash
# Epic credentials
npx supabase secrets set EPIC_CLIENT_ID="your_epic_client_id"
npx supabase secrets set EPIC_CLIENT_SECRET="your_epic_client_secret"
npx supabase secrets set EPIC_FHIR_URL="https://fhir.epic.com/..."

# Cerner credentials (if using)
npx supabase secrets set CERNER_CLIENT_ID="your_cerner_client_id"
npx supabase secrets set CERNER_CLIENT_SECRET="your_cerner_client_secret"

# Meditech credentials (if using)
npx supabase secrets set MEDITECH_CLIENT_ID="your_meditech_client_id"
npx supabase secrets set MEDITECH_CLIENT_SECRET="your_meditech_client_secret"
```

**How to View**:
```bash
# List all secrets (values are hidden)
npx supabase secrets list

# Output example:
# NAME                    DIGEST
# EPIC_CLIENT_ID          a1b2c3d4...
# EPIC_CLIENT_SECRET      e5f6g7h8...
# EPIC_FHIR_URL           i9j0k1l2...
```

**How to Delete**:
```bash
npx supabase secrets unset EPIC_CLIENT_SECRET
```

**Security Note**: These are encrypted at rest in Supabase.

---

## 📍 Location 3: Database (`fhir_connections` table)

**Table**: `public.fhir_connections`

**Columns**:
```sql
CREATE TABLE fhir_connections (
  id UUID PRIMARY KEY,
  name TEXT,                    -- "Epic - Main Hospital"
  fhir_server_url TEXT,         -- Epic FHIR endpoint
  ehr_system TEXT,              -- 'EPIC', 'CERNER', 'MEDITECH', 'CUSTOM'
  client_id TEXT,               -- Epic client ID (NOT secret)
  client_secret TEXT,           -- ⚠️ ENCRYPTED (use vault)
  access_token TEXT,            -- ⚠️ ENCRYPTED (auto-refreshed)
  refresh_token TEXT,           -- ⚠️ ENCRYPTED
  token_expiry TIMESTAMPTZ,
  status TEXT,                  -- 'active', 'inactive', 'error'
  sync_frequency TEXT,          -- 'realtime', 'hourly', 'daily', 'manual'
  sync_direction TEXT,          -- 'pull', 'push', 'bidirectional'
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**How to Insert** (via Admin UI):
1. Navigate to: http://localhost:3000/admin/fhir-integrations
2. Click "Add Connection"
3. Fill in form:
   - **Name**: Epic - [Hospital Name]
   - **EHR System**: Epic
   - **FHIR Server URL**: `https://fhir.epic.com/...`
   - **Client ID**: (from Epic App Orchard)
   - **Client Secret**: (will be encrypted)
   - **Sync Frequency**: Hourly
   - **Sync Direction**: Bidirectional
4. Click "Test Connection"
5. Click "Save"

**Security Note**:
- ✅ Client ID: Plain text (safe - it's public)
- ⚠️ Client Secret: **MUST BE ENCRYPTED** via Supabase Vault
- ⚠️ Tokens: **MUST BE ENCRYPTED** and auto-rotated

---

## 📍 Location 4: Source Code (Adapter Defaults)

**Files**:
- `src/adapters/implementations/EpicFHIRAdapter.ts`
- `src/adapters/implementations/CernerFHIRAdapter.ts`
- `src/adapters/implementations/MeditechFHIRAdapter.ts`

**What's Stored**:
```typescript
// Epic defaults
private readonly EPIC_PROD_BASE = 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4';
private readonly EPIC_SANDBOX_BASE = 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4';

// Cerner defaults
private readonly CERNER_SANDBOX_BASE = 'https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d';

// Rate limits
private readonly MAX_REQUESTS_PER_HOUR = 1000; // Epic
private readonly MAX_REQUESTS_PER_HOUR = 2000; // Cerner
private readonly MAX_REQUESTS_PER_HOUR = 500;  // Meditech
```

**Security Note**: ✅ These are **public constants** - no secrets here!

---

## 🎯 What Epic Provides You

When you register at https://apporchard.epic.com/, Epic gives you:

### Sandbox Credentials (for testing)
```
Epic Sandbox Client ID: abc123-sandbox
Epic Sandbox URL: https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
```

### Production Credentials (after approval)
```
Epic Production Client ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
Epic Production Client Secret: YourSuperSecretKeyHere123!
Epic Production FHIR URL: https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
```

Or hospital-specific:
```
Hospital Epic FHIR URL: https://fhir.yourhospital.epic.com/FHIR/R4
```

---

## 🔐 How to Get Epic Credentials

### Step 1: Register at Epic App Orchard

1. Go to: https://apporchard.epic.com/
2. Click "Sign Up" (or "Log In" if you have an account)
3. Choose "Developer/Vendor" account type
4. Verify your email

### Step 2: Create Your App

1. Navigate to "My Apps"
2. Click "Create New App"
3. Fill in app details:
   - **App Name**: WellFit Community Health Platform
   - **App Type**: Web Application (Server-Side)
   - **FHIR Version**: R4
   - **Category**: Patient Engagement, Remote Monitoring

### Step 3: Request Scopes

Add these scopes:

**Patient-Level Scopes**:
- `patient/Patient.read`
- `patient/Observation.read`
- `patient/Condition.read`
- `patient/MedicationRequest.read`
- `patient/AllergyIntolerance.read`
- `patient/Immunization.read`
- `patient/Procedure.read`
- `patient/Encounter.read`
- `patient/CarePlan.read`
- `patient/CareTeam.read`

**System-Level Scopes** (for backend):
- `system/Patient.read`
- `system/Observation.read`
- (... same resources with system scope)

### Step 4: Configure OAuth

- **Redirect URIs**:
  - Development: `http://localhost:3000/smart-callback`
  - Production: `https://yourdomain.com/smart-callback`

- **Token Endpoint Auth Method**: `client_secret_post`

### Step 5: Submit for Review

Epic will review (1-2 weeks) and check:
- [ ] Privacy Policy
- [ ] Terms of Service
- [ ] HIPAA Compliance Documentation
- [ ] SOC 2 Compliance (you have this!)
- [ ] Security Measures

### Step 6: Receive Credentials

After approval, Epic sends:
```
Production Client ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
Client Secret: YourSuperSecretKeyHere123!
FHIR Base URL: https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
```

**IMPORTANT**:
- ⚠️ Client Secret is **ONE-TIME VIEW** - save it immediately!
- 📧 Epic sends it via secure email
- 🔒 Store it in password manager or Supabase secrets

---

## 🚨 Security Best Practices

### DO ✅

- ✅ Store secrets in `.env.local` (local dev)
- ✅ Use Supabase secrets (production)
- ✅ Encrypt tokens in database
- ✅ Rotate credentials every 90 days
- ✅ Use HTTPS only (no HTTP)
- ✅ Commit `.env.example` (template only)

### DON'T ❌

- ❌ **NEVER** commit `.env.local` to git
- ❌ **NEVER** hard-code secrets in source code
- ❌ **NEVER** share secrets via email/Slack
- ❌ **NEVER** use production credentials in development
- ❌ **NEVER** store secrets in browser localStorage

---

## 🧪 Testing with Sandbox

Epic provides a sandbox environment for testing:

**Sandbox URL**:
```
https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
```

**Test Patient IDs**:
```javascript
const testPatients = [
  'Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB', // Fhir, Jason
  'erXuFYUfucBZaryVksYEcMg3',                      // Argonaut, John
  'eq081-VQEgP8drUUqCWzHfw3',                      // Smart, Joe
];
```

**Enable Sandbox Mode**:
```bash
# In .env.local
REACT_APP_EPIC_USE_SANDBOX=true
REACT_APP_EPIC_SANDBOX_CLIENT_ID=your_sandbox_client_id
```

---

## 📞 Support

### Epic Issues

- **Email**: apporchard@epic.com
- **Docs**: https://fhir.epic.com/
- **Forums**: https://galaxy.epic.com/

### WellFit Community Issues

- **GitHub**: https://github.com/your-org/wellfit/issues
- **Email**: support@wellfit-community.com
- **FHIR Docs**: `/docs/fhir-integration/`

---

## ✅ Quick Start Checklist

- [ ] Register at Epic App Orchard
- [ ] Create app and request scopes
- [ ] Receive Epic credentials
- [ ] Add credentials to `.env.local`
- [ ] Test with Epic sandbox
- [ ] Deploy secrets to Supabase (`npx supabase secrets set`)
- [ ] Create FHIR connection in Admin UI
- [ ] Test connection
- [ ] Enable auto-sync
- [ ] Monitor sync logs

---

## 📚 More Documentation

- **Full Epic Guide**: [docs/EPIC_INTEGRATION_GUIDE.md](./docs/EPIC_INTEGRATION_GUIDE.md)
- **Integration Summary**: [docs/EPIC_INTEGRATION_SUMMARY.md](./docs/EPIC_INTEGRATION_SUMMARY.md)

---

**Need Help?** Contact support@wellfit-community.com

**Last Updated**: October 24, 2024
