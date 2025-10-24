# Epic Integration Guide for WellFit Community

## 🏥 Complete Epic FHIR Integration Setup

This guide will walk you through integrating WellFit Community with Epic EHR systems.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Epic App Orchard Registration](#epic-app-orchard-registration)
3. [Credential Locations](#credential-locations)
4. [Epic Configuration](#epic-configuration)
5. [Testing with Epic Sandbox](#testing-with-epic-sandbox)
6. [Production Deployment](#production-deployment)
7. [Common Issues](#common-issues)

---

## Prerequisites

### What You Need from Epic

1. **Epic App Orchard Account**
   - Website: https://apporchard.epic.com/
   - Sign up as a developer/vendor
   - Request FHIR app approval

2. **Epic FHIR Credentials**
   - **Client ID**: Unique identifier for your app (from App Orchard)
   - **Client Secret** (for backend services): Secret key for server-to-server auth
   - **FHIR Endpoint URL**: Epic's FHIR server URL for your hospital

3. **Hospital/Organization Info**
   - Hospital Epic instance URL
   - Organization ID (if multi-tenant)
   - Contact person at the hospital IT department

---

## Epic App Orchard Registration

### Step 1: Create Your App Profile

1. Go to https://apporchard.epic.com/
2. Click "Sign Up" or "Log In"
3. Navigate to "My Apps" → "Create New App"
4. Fill out app details:
   - **App Name**: WellFit Community Health Platform
   - **App Type**: Web Application (Server-Side)
   - **FHIR Version**: R4
   - **App Category**: Patient Engagement, Remote Monitoring

### Step 2: Request FHIR Scopes

Select the following scopes for WellFit Community:

#### Patient-Level Scopes (for patient-mediated access)
```
patient/Patient.read
patient/Observation.read
patient/Condition.read
patient/MedicationRequest.read
patient/AllergyIntolerance.read
patient/Immunization.read
patient/Procedure.read
patient/Encounter.read
patient/CarePlan.read
patient/CareTeam.read
```

#### System-Level Scopes (for backend services)
```
system/Patient.read
system/Observation.read
system/Condition.read
system/MedicationRequest.read
system/AllergyIntolerance.read
system/Immunization.read
system/Procedure.read
system/Encounter.read
system/CarePlan.read
system/CareTeam.read
```

### Step 3: Configure OAuth Settings

- **Redirect URIs**: Add your callback URLs
  - Development: `http://localhost:3000/smart-callback`
  - Production: `https://yourdomain.com/smart-callback`

- **Auth Type**: OAuth 2.0 with SMART on FHIR
- **Token Endpoint Auth Method**: `client_secret_post` or `client_secret_basic`

### Step 4: Submit for Review

Epic will review your app (typically 1-2 weeks). They'll verify:
- App security measures
- HIPAA compliance documentation
- Privacy policy
- Terms of service
- Data handling practices

### Step 5: Get Your Credentials

After approval, Epic will provide:
- **Production Client ID**: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
- **Client Secret**: `YourSuperSecretKeyHere123!`
- **FHIR Base URL**: `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4`

---

## Credential Locations

### Where Your Credentials Live

#### 1. Environment Variables (`.env.local`)

**Location**: `/workspaces/WellFit-Community-Daily-Complete/.env.local`

**Required Epic Variables**:
```bash
# Epic FHIR Configuration
REACT_APP_EPIC_FHIR_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
REACT_APP_EPIC_CLIENT_ID=your_epic_client_id_here
REACT_APP_EPIC_CLIENT_SECRET=your_epic_client_secret_here

# Epic Sandbox (for testing)
REACT_APP_EPIC_SANDBOX_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
REACT_APP_EPIC_SANDBOX_CLIENT_ID=your_sandbox_client_id

# FHIR Integration Settings
REACT_APP_FHIR_ENABLED=true
REACT_APP_FHIR_AUTO_SYNC_ENABLED=true
REACT_APP_FHIR_SYNC_FREQUENCY=hourly
```

#### 2. Supabase Secrets (for Edge Functions)

**Location**: Stored securely in Supabase dashboard

**Command to set**:
```bash
npx supabase secrets set EPIC_CLIENT_ID="your_client_id"
npx supabase secrets set EPIC_CLIENT_SECRET="your_client_secret"
npx supabase secrets set EPIC_FHIR_URL="https://fhir.epic.com/..."
```

**List current secrets**:
```bash
npx supabase secrets list
```

#### 3. Database (Encrypted)

**Location**: `fhir_connections` table in Supabase

**Storage**:
- Client ID: Stored in plain text (safe, it's public)
- Client Secret: **ENCRYPTED** using Supabase vault
- Access tokens: **ENCRYPTED** with rotation
- Refresh tokens: **ENCRYPTED** with vault

**Example database entry**:
```sql
INSERT INTO fhir_connections (
  name,
  fhir_server_url,
  ehr_system,
  client_id,
  status,
  sync_frequency
) VALUES (
  'Epic - Main Hospital',
  'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
  'EPIC',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'active',
  'hourly'
);
```

#### 4. Source Code References

**Epic Adapter**: `/src/adapters/implementations/EpicFHIRAdapter.ts`
- Implements Epic-specific FHIR features
- Handles Epic OAuth 2.0 flow
- Rate limiting (1000 req/hour)

**SMART on FHIR Client**: `/src/lib/smartOnFhir.ts`
- Epic authentication logic
- PKCE flow implementation
- Token management

---

## Epic Configuration

### Epic-Specific Settings

Epic has unique requirements compared to other EHR systems:

#### 1. OAuth 2.0 PKCE Flow

Epic **requires** PKCE (Proof Key for Code Exchange) for security:

```typescript
// Automatic in EpicFHIRAdapter
const codeVerifier = generateRandomString(128);
const codeChallenge = await sha256(codeVerifier);

// Authorization request
https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize?
  client_id=YOUR_CLIENT_ID&
  response_type=code&
  redirect_uri=YOUR_CALLBACK&
  scope=patient/*.read&
  code_challenge=CHALLENGE&
  code_challenge_method=S256&
  aud=https://fhir.epic.com/...
```

#### 2. Epic-Specific Headers

```typescript
headers: {
  'Authorization': 'Bearer ACCESS_TOKEN',
  'Epic-Client-ID': 'YOUR_CLIENT_ID', // Epic tracks usage by client
  'Accept': 'application/fhir+json'
}
```

#### 3. Rate Limiting

Epic enforces **1000 requests per hour** per client ID.

Our adapter automatically:
- Tracks request count
- Pauses when limit reached
- Resumes after cooldown

#### 4. Bulk Data Export

For large data exports, use Epic's Bulk FHIR API:

```typescript
const adapter = new EpicFHIRAdapter();
await adapter.connect(config);

const exportJob = await adapter.bulkExport({
  resourceTypes: ['Patient', 'Observation', 'Condition'],
  since: new Date('2024-01-01'),
  outputFormat: 'ndjson'
});

// Poll status URL until complete
```

---

## Testing with Epic Sandbox

### Epic Sandbox Environment

**Sandbox URL**: `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4`

**Test Credentials**:
- Epic provides test client IDs for sandbox
- No real patient data (uses synthetic patients)
- Request sandbox access through App Orchard

### Test Patient IDs

Epic sandbox includes test patients:

```javascript
const testPatients = [
  'Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB', // Fhir, Jason
  'erXuFYUfucBZaryVksYEcMg3', // Argonaut, John
  'eq081-VQEgP8drUUqCWzHfw3', // Smart, Joe
];
```

### Running Sandbox Tests

```bash
# Set sandbox mode in .env.local
REACT_APP_EPIC_USE_SANDBOX=true
REACT_APP_EPIC_SANDBOX_CLIENT_ID=your_sandbox_client_id

# Run the app
npm run dev

# Navigate to FHIR integration settings
# Create a connection with Epic sandbox
```

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] Epic App Orchard approval received
- [ ] Production client ID and secret obtained
- [ ] Hospital Epic FHIR URL confirmed
- [ ] SSL/TLS certificate installed (HTTPS required)
- [ ] Privacy policy published
- [ ] HIPAA compliance verified
- [ ] Data security audit completed
- [ ] Epic IT contact established
- [ ] Firewall rules configured (if needed)
- [ ] Backup credentials stored securely

### Production Setup Steps

#### 1. Store Production Credentials

```bash
# In production .env
REACT_APP_EPIC_FHIR_URL=https://fhir.yourhospital.epic.com/FHIR/R4
REACT_APP_EPIC_CLIENT_ID=prod_a1b2c3d4_e5f6_7890
REACT_APP_EPIC_CLIENT_SECRET=prod_secret_key_here

# In Supabase
npx supabase secrets set --project-ref YOUR_PROJECT_REF \
  EPIC_CLIENT_ID="prod_a1b2c3d4_e5f6_7890" \
  EPIC_CLIENT_SECRET="prod_secret_key_here"
```

#### 2. Create FHIR Connection in Admin Panel

1. Log in as admin
2. Navigate to: Admin → FHIR Integrations
3. Click "Add Connection"
4. Select "Epic" from EHR system dropdown
5. Enter:
   - **Name**: Epic - [Hospital Name]
   - **FHIR Server URL**: (from Epic IT)
   - **Client ID**: (from App Orchard)
   - **Sync Frequency**: Hourly (recommended)
   - **Sync Direction**: Bidirectional
6. Click "Test Connection"
7. If successful, click "Activate"

#### 3. Configure Patient Mappings

Epic patients must be mapped to WellFit users:

```sql
-- Example: Map Epic patient to WellFit user
INSERT INTO fhir_patient_mappings (
  community_user_id,
  fhir_patient_id,
  connection_id,
  sync_status
) VALUES (
  'wellfit_user_uuid',
  'epic_patient_fhir_id',
  'connection_uuid',
  'synced'
);
```

#### 4. Enable Auto-Sync

```typescript
// In admin panel or via API
await updateConnection(connectionId, {
  syncFrequency: 'hourly',
  autoSyncEnabled: true,
  syncResources: [
    'Patient',
    'Observation',
    'Condition',
    'MedicationRequest',
    'Immunization',
    'CarePlan'
  ]
});
```

---

## Common Issues

### Issue 1: "Invalid Client ID"

**Cause**: Client ID doesn't match Epic registration

**Solution**:
1. Verify client ID in App Orchard
2. Check for typos in `.env.local`
3. Ensure you're using production ID (not sandbox) in prod

### Issue 2: "Insufficient Scopes"

**Cause**: Missing required FHIR scopes

**Solution**:
1. Go to App Orchard → Your App → Scopes
2. Add missing scopes (see [Request FHIR Scopes](#step-2-request-fhir-scopes))
3. Re-submit app for Epic review
4. Wait for approval

### Issue 3: "Rate Limit Exceeded"

**Cause**: More than 1000 requests/hour

**Solution**:
- Adapter automatically handles this
- If manual: wait 1 hour for reset
- Consider bulk export for large datasets
- Use incremental sync (not full sync)

### Issue 4: "Token Expired"

**Cause**: Access token expired (typically 1 hour)

**Solution**:
- Adapter auto-refreshes tokens
- Check refresh token is stored in DB
- Verify token endpoint in Epic config

### Issue 5: "CORS Error"

**Cause**: Browser blocking cross-origin requests

**Solution**:
- Epic FHIR should be called server-side (not browser)
- Use backend API proxy
- Check redirect URI matches App Orchard config

---

## Epic Support Contacts

### Epic Resources

- **App Orchard Support**: apporchard@epic.com
- **FHIR Documentation**: https://fhir.epic.com/
- **Developer Forums**: https://galaxy.epic.com/
- **Technical Support**: Contact your hospital's Epic team

### WellFit Community Support

- **GitHub Issues**: https://github.com/your-org/wellfit/issues
- **Email**: support@wellfit-community.com
- **FHIR Integration Docs**: `/docs/fhir-integration/`

---

## Next Steps

1. ✅ **Complete App Orchard registration**
2. ✅ **Get credentials and store in `.env.local`**
3. ✅ **Test with Epic sandbox**
4. ✅ **Coordinate with hospital IT team**
5. ✅ **Deploy to production**
6. ✅ **Monitor sync logs in admin panel**
7. ✅ **Resolve any conflicts in Conflict Resolution UI**

---

## Security Best Practices

### DO ✅

- Store credentials in environment variables
- Use Supabase secrets for sensitive data
- Encrypt tokens in database
- Rotate credentials regularly (90 days)
- Monitor access logs
- Use HTTPS only
- Implement rate limiting
- Log all PHI access (SOC 2 compliant)

### DON'T ❌

- Hard-code credentials in source code
- Commit `.env.local` to git
- Share client secrets via email
- Use sandbox credentials in production
- Bypass Epic rate limits
- Store tokens in browser localStorage
- Skip token refresh logic

---

**Last Updated**: October 24, 2024
**Document Version**: 2.0
**Epic FHIR Version**: R4
**WellFit Version**: 2.x
