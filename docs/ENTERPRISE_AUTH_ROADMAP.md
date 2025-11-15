# Enterprise Authentication & CSRF Protection Roadmap

**Status**: 📋 Planned (Not Yet Implemented)
**Priority**: Medium (implement when first enterprise SSO customer signs)
**Estimated Effort**: 2-3 weeks

---

## Current State (v1.0)

### Authentication for ALL Tenants:
- **Method**: JWT tokens in localStorage
- **Provider**: Supabase Auth
- **CSRF Protection**: ❌ Not needed (JWT-based)
- **Tenant Isolation**: Row-Level Security (RLS)

### Supported Tiers:
- ✅ Basic: JWT + Phone OTP
- ✅ Standard: JWT + Phone OTP + Passkeys
- ✅ Premium: JWT + Phone OTP + Passkeys + MFA enforcement
- ✅ Enterprise: JWT + Phone OTP + Passkeys + MFA enforcement

**Limitation**: Enterprise tenants CANNOT use their existing SSO/SAML

---

## Future State (v2.0 - Enterprise Auth)

### New Capabilities:

1. **SAML/SSO Integration**
   - Okta
   - Azure AD (Microsoft Entra ID)
   - Google Workspace
   - Custom SAML providers

2. **Per-Tenant Auth Configuration**
   - Choose: Supabase Auth (JWT) OR Enterprise SSO (cookies)
   - Hybrid: Employees use SSO, patients use phone OTP

3. **CSRF Protection** (SSO tenants only)
   - Automatic for cookie-based auth
   - Not applied to JWT-based tenants

---

## Implementation Phases

### Phase 1: Database Schema (1 week)

```sql
-- Add to tenant_module_config table
ALTER TABLE tenant_module_config
ADD COLUMN sso_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN sso_provider TEXT,
ADD COLUMN sso_metadata JSONB,
ADD COLUMN auth_mechanism TEXT DEFAULT 'jwt' CHECK (auth_mechanism IN ('jwt', 'session_cookie')),
ADD COLUMN csrf_protection_enabled BOOLEAN DEFAULT FALSE;

-- Create SAML configuration table
CREATE TABLE tenant_saml_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL,
  sso_url TEXT NOT NULL,
  slo_url TEXT,
  certificate TEXT NOT NULL,
  name_id_format TEXT DEFAULT 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- Create CSRF token storage (for SSO sessions)
CREATE TABLE csrf_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  INDEX idx_csrf_token (token),
  INDEX idx_csrf_expires (expires_at)
);
```

### Phase 2: SAML Authentication (1 week)

**New Edge Functions:**

1. `saml-login-start` - Initiates SAML SSO flow
   ```typescript
   // Generates SAML AuthnRequest
   // Redirects to IdP
   // Sets state cookie for CSRF protection
   ```

2. `saml-login-callback` - Handles SAML response
   ```typescript
   // Validates SAML assertion
   // Verifies state cookie
   // Creates user session with cookie
   // Generates CSRF token
   ```

3. `saml-metadata` - Provides SP metadata
   ```typescript
   // Returns XML metadata for IdP configuration
   ```

**Libraries:**
- `samlify` - SAML 2.0 implementation
- `cookie` - Secure cookie management
- `crypto` - CSRF token generation

### Phase 3: CSRF Protection (3 days)

**Token Generation (on login):**

```typescript
// supabase/functions/saml-login-callback/index.ts
async function generateCSRFToken(userId: string, tenantId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');

  // Store in database
  await supabase.from('csrf_tokens').insert({
    user_id: userId,
    tenant_id: tenantId,
    token: token,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  });

  return token;
}

// Set as cookie (HttpOnly for security)
res.headers.set('Set-Cookie', `csrf_token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/`);
```

**Token Validation (on state-changing requests):**

```typescript
// supabase/functions/_shared/csrf.ts
export async function validateCSRF(req: Request): Promise<boolean> {
  // Get tenant config
  const tenant = await getCurrentTenant(req);

  // Skip CSRF for JWT-based tenants
  if (tenant.auth_mechanism === 'jwt') {
    return true;
  }

  // For cookie-based auth, validate CSRF
  const csrfHeader = req.headers.get('X-CSRF-Token');
  const csrfCookie = getCookie(req, 'csrf_token');

  if (!csrfHeader || csrfHeader !== csrfCookie) {
    throw new Error('Invalid CSRF token');
  }

  // Verify token exists in database and not expired
  const { data } = await supabase
    .from('csrf_tokens')
    .select('*')
    .eq('token', csrfHeader)
    .gt('expires_at', new Date().toISOString())
    .single();

  return !!data;
}

// Apply to state-changing Edge Functions
Deno.serve(async (req) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
    await validateCSRF(req);
  }
  // ... rest of function
});
```

**Client Updates:**

```typescript
// src/lib/supabaseClient.ts
export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  },
  global: {
    headers: async () => {
      const headers: Record<string, string> = {};

      // Add CSRF token for SSO tenants
      const tenant = await getCurrentTenant();
      if (tenant?.auth_mechanism === 'session_cookie') {
        const csrfToken = getCookie('csrf_token');
        if (csrfToken) {
          headers['X-CSRF-Token'] = csrfToken;
        }
      }

      return headers;
    }
  }
});
```

### Phase 4: Testing & Documentation (3 days)

**Test Cases:**
- ✅ JWT tenants: No CSRF validation
- ✅ SSO tenants: CSRF required on POST/PUT/DELETE
- ✅ CSRF token expiry handling
- ✅ Cross-tenant CSRF token isolation
- ✅ Logout clears CSRF tokens

**Documentation:**
- Enterprise onboarding guide
- SAML configuration instructions
- Security architecture docs
- Compliance evidence (SOC 2, HIPAA)

---

## Tenant Configuration Example

```typescript
// Basic/Standard/Premium tenant (current)
{
  tenant_id: "abc-123",
  license_tier: "premium",
  auth_mechanism: "jwt",           // ← Uses Supabase Auth
  sso_enabled: false,
  csrf_protection_enabled: false   // ← Not needed for JWT
}

// Enterprise tenant with SSO (future)
{
  tenant_id: "xyz-789",
  license_tier: "enterprise",
  auth_mechanism: "session_cookie", // ← Uses SAML SSO
  sso_enabled: true,
  sso_provider: "azure_ad",
  csrf_protection_enabled: true    // ← Required for cookies
}
```

---

## Cost-Benefit Analysis

### Benefits:
- ✅ Win enterprise hospital contracts ($50K+ ARR)
- ✅ Government healthcare compliance (FISMA, FedRAMP)
- ✅ Competitive advantage (most SaaS don't offer SSO)
- ✅ Higher ASP (2-3x pricing for SSO feature)

### Costs:
- ⚠️ Development: 2-3 weeks (1 engineer)
- ⚠️ Testing: 1 week
- ⚠️ Infrastructure: +$50/month (SAML lib licenses)
- ⚠️ Support: SSO troubleshooting complexity

### ROI:
- **Breakeven**: 1 enterprise customer
- **Expected**: 5-10 enterprise customers in year 1
- **Revenue impact**: +$250K-500K ARR

---

## Competitive Landscape

### Competitors with SSO:
- Epic MyChart: ✅ SAML, ✅ OAuth
- Cerner HealtheLife: ✅ SAML only
- Athenahealth Patient Portal: ✅ SAML, ✅ OAuth

### Your Advantage:
- Passkey biometric auth (more secure than SSO)
- Hybrid model: SSO for staff, phone OTP for patients
- Faster than traditional EMR SSO setup

---

## Decision Criteria

### Implement when ANY of these happen:

1. **Sales Signal**
   - Enterprise prospect asks: "Do you support SAML/SSO?"
   - Deal size: >$50K ARR
   - Customer has existing IdP (Okta, Azure AD)

2. **Regulatory Requirement**
   - Government contract requires SSO
   - Healthcare network mandates corporate auth
   - Compliance audit recommends it

3. **Market Pressure**
   - Competitor wins deal because of SSO
   - 3+ prospects request SSO in same quarter
   - RFP requirements consistently include SSO

---

## Pre-Implementation Checklist

Before starting Phase 1:

- [ ] Confirm customer commitment ($50K+ ARR contract signed)
- [ ] Identify SAML provider (Okta, Azure AD, Google, Custom)
- [ ] Get sample SAML metadata from customer
- [ ] Assign 1 engineer for 3 weeks
- [ ] Budget $5K for SAML library licenses
- [ ] Plan 2-week customer testing window
- [ ] Document support escalation path

---

## Alternative: SaaS Solutions

If you want SSO without building:

### Option 1: Auth0 (Okta)
- **Cost**: $13/MAU + $50K/year for SAML
- **Time**: 1 week integration
- **Trade-off**: Lock-in, higher cost

### Option 2: WorkOS
- **Cost**: $0.05/MAU (SAML included)
- **Time**: 3 days integration
- **Trade-off**: New vendor, less control

### Option 3: SuperTokens (Open Source)
- **Cost**: Free (self-hosted) or $0.02/MAU
- **Time**: 1 week integration
- **Trade-off**: Maintenance burden

**Recommendation**: Build in-house (you have the expertise, full control, lower long-term cost)

---

## Summary

### Current Decision: ❌ Do NOT implement CSRF
**Reason**: No tenants use cookie-based auth (all use JWT)

### Future Decision: ✅ Implement CSRF when adding SSO
**Trigger**: First enterprise customer requests SAML/SSO
**Timeline**: 2-3 weeks from trigger
**Cost**: ~$5K + 3 weeks engineering

### Action Items:
1. ✅ Keep this roadmap document
2. ✅ Rename `adminRoles.ts` to `_future_enterprise_auth.ts.disabled`
3. ✅ Add "Enterprise SSO" to product roadmap (Q2 2026)
4. ✅ Include SSO questions in enterprise sales calls
5. ✅ Monitor competitor SSO offerings

---

**Last Updated**: November 15, 2025
**Owner**: Engineering Team
**Next Review**: When first enterprise SSO request received
