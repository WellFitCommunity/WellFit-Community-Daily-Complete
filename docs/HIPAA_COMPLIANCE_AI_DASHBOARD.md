# HIPAA & SOC 2 Compliance Remediation for AI Dashboard

## 🚨 CRITICAL: COMPLIANCE ISSUES IDENTIFIED

**Status:** AI personalization features are **NOT HIPAA/SOC 2 compliant** and must be remediated before use.

**Date Identified:** 2025-10-19
**Severity:** HIGH - Potential PHI exposure to third-party AI (Anthropic Claude)

---

## ❌ Current Compliance Violations

### 1. **PHI in User Tracking Data**
**Location:** `admin_usage_tracking` table
**Issue:** Stores section names that could contain patient identifiers

```sql
-- CURRENT (NON-COMPLIANT):
INSERT INTO admin_usage_tracking (
  user_id,
  section_name,  -- ❌ Could be "Patient: John Smith Record"
  section_id,
  action
);
```

**Risk Level:** HIGH
**HIPAA Violation:** §164.514(a) - De-identification of PHI
**SOC 2 Concern:** CC6.1 - Logical and physical access controls

### 2. **Unencrypted Browser Storage**
**Location:** `src/services/userBehaviorTracking.ts` (lines 90-108)
**Issue:** Uses localStorage to cache user behavior data

```typescript
// CURRENT (NON-COMPLIANT):
localStorage.setItem('admin_behavior_' + userId, JSON.stringify(data));
```

**Risk Level:** HIGH
**HIPAA Violation:** §164.312(a)(2)(iv) - Encryption and decryption
**SOC 2 Concern:** CC6.7 - Information at rest encryption

### 3. **PHI Sent to External AI (Anthropic)**
**Location:** `supabase/functions/claude-personalization/index.ts`
**Issue:** User behavior prompts sent to Anthropic without PHI scrubbing

```typescript
// CURRENT (NON-COMPLIANT):
const response = await fetch('https://api.anthropic.com/v1/messages', {
  body: JSON.stringify({
    messages: [{ role: 'user', content: prompt }] // ❌ No PHI scrubbing
  })
});
```

**Risk Level:** CRITICAL
**HIPAA Violation:** §164.308(b)(1) - Business Associate Contracts
**SOC 2 Concern:** CC6.6 - Third-party vendor management

### 4. **No Audit Logging**
**Location:** All AI personalization services
**Issue:** No audit trail of AI requests, data access, or PHI handling

**Risk Level:** HIGH
**HIPAA Violation:** §164.308(a)(1)(ii)(D) - Information system activity review
**SOC 2 Concern:** CC7.2 - Monitoring of system operations

### 5. **Missing BAA Configuration**
**Location:** Anthropic API integration
**Issue:** No verification of Business Associate Agreement with Anthropic

**Risk Level:** CRITICAL
**HIPAA Violation:** §164.308(b)(1) - BAA required for PHI disclosure
**SOC 2 Concern:** CC9.2 - Vendor risk management

---

## ✅ REMEDIATION PLAN

### Phase 1: Immediate Actions (Complete Before ANY Use)

#### 1.1 Disable AI Personalization Features
```bash
# Disable Edge Function deployments
# DO NOT deploy:
# - supabase/functions/claude-personalization/
# - Updated edge functions with AI calls

# Mark services as DISABLED
```

**Files to disable (comment out imports):**
- `src/services/dashboardPersonalizationAI.ts`
- `src/services/userBehaviorTracking.ts`
- `src/components/admin/IntelligentAdminPanel.tsx`

**Keep active (COMPLIANT):**
- `src/components/admin/AdminPanel.tsx` (original)
- `src/components/admin/WhatsNewModal.tsx`
- Model routing (doesn't track user data)

#### 1.2 Database Rollback
```sql
-- Drop non-compliant table
DROP TABLE IF EXISTS admin_usage_tracking CASCADE;
DROP VIEW IF EXISTS admin_usage_analytics CASCADE;

-- Or disable with RLS
ALTER TABLE admin_usage_tracking DISABLE ROW LEVEL SECURITY;
REVOKE ALL ON admin_usage_tracking FROM PUBLIC;
```

#### 1.3 Remove localStorage Usage
```typescript
// Delete all code using localStorage for user tracking
// Search codebase for: localStorage.setItem('admin_behavior_'
```

---

### Phase 2: Compliant Redesign

#### 2.1 De-Identified Section Tracking

**Principle:** Track WHAT sections are used, not WHO used them or WHICH patient

```typescript
// ✅ COMPLIANT APPROACH:
interface AnonymousUsageMetric {
  section_category: 'revenue' | 'patient-care' | 'clinical' | 'security' | 'admin';
  section_type: string;  // Generic: "patient-record-viewer" NOT "Patient Smith"
  aggregate_count: number;
  date: string;
  role_type: string;  // "physician" NOT specific user ID
  // NO user_id, NO patient identifiers, NO section_name
}

// Store aggregated counts only
CREATE TABLE section_usage_aggregates (
  id UUID PRIMARY KEY,
  section_category TEXT NOT NULL,
  section_type TEXT NOT NULL,
  role_type TEXT NOT NULL,
  usage_count INTEGER DEFAULT 1,
  date DATE NOT NULL,
  -- NO user_id, NO created_by, NO PHI
  UNIQUE(section_category, section_type, role_type, date)
);
```

#### 2.2 Anonymous User Preferences (Optional)

If personalization is REQUIRED, use anonymized approach:

```typescript
// ✅ COMPLIANT: Hashed user preferences
interface AnonymousUserPreferences {
  preference_id: string;  // SHA-256 hash of (user_id + salt)
  preferred_sections: string[];  // Generic IDs only: ["revenue-dashboard", "billing"]
  last_updated: Date;
  // NO linkage to auth.users table
  // NO ability to reverse-engineer to real user
}

// One-way hash function
function generatePreferenceId(userId: string): string {
  const salt = process.env.PREFERENCE_SALT!; // Store in vault
  return sha256(userId + salt).substring(0, 32);
}
```

#### 2.3 PHI Scrubbing for AI Prompts

**If using Claude for insights, scrub ALL potential PHI:**

```typescript
function scrubPHI(text: string): string {
  return text
    // Remove names (common patterns)
    .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, '[NAME]')
    // Remove dates
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, '[DATE]')
    .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b/gi, '[DATE]')
    // Remove medical record numbers (common formats)
    .replace(/\bMRN:?\s*\d+\b/gi, '[MRN]')
    .replace(/\b\d{6,10}\b/g, '[ID]')
    // Remove addresses
    .replace(/\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)\b/gi, '[ADDRESS]')
    // Remove phone numbers
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]')
    // Remove email addresses
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
    // Remove SSN patterns (just in case)
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');
}

// ALWAYS verify before sending
function isPromptSafe(prompt: string): boolean {
  const phiPatterns = [
    /\b[A-Z][a-z]+ [A-Z][a-z]+\b/,  // Names
    /\b\d{3}-\d{2}-\d{4}\b/,         // SSN
    /\bMRN/i,                         // Medical Record Numbers
    /\bpatient\s+[A-Z]/i              // "Patient John..."
  ];

  return !phiPatterns.some(pattern => pattern.test(prompt));
}
```

#### 2.4 Anthropic BAA Configuration

**Required steps:**
1. Contact Anthropic to execute BAA
2. Enable HIPAA-compliant API endpoints
3. Configure audit logging
4. Verify in code:

```typescript
const ANTHROPIC_HIPAA_ENDPOINT = 'https://api.anthropic.com/v1/messages'; // Verify this
const ANTHROPIC_BAA_ENABLED = process.env.ANTHROPIC_BAA_SIGNED === 'true';

if (!ANTHROPIC_BAA_ENABLED) {
  throw new Error('HIPAA BAA not configured with Anthropic - cannot process');
}
```

**Anthropic HIPAA Documentation:**
- https://www.anthropic.com/legal/privacy-policy
- Contact: enterprise@anthropic.com for BAA

#### 2.5 Comprehensive Audit Logging

```sql
CREATE TABLE ai_request_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_role TEXT NOT NULL,  -- Role type, not specific user
  request_type TEXT NOT NULL,  -- 'dashboard_personalization', 'billing_coding', etc.
  model_used TEXT NOT NULL,  -- 'claude-haiku-4-5', etc.
  prompt_scrubbed BOOLEAN NOT NULL,  -- Verification flag
  phi_detected BOOLEAN NOT NULL,  -- Post-scrubbing verification
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd DECIMAL(10, 6),
  response_time_ms INTEGER,
  error_occurred BOOLEAN DEFAULT FALSE,
  compliance_verified BOOLEAN NOT NULL,  -- Manual audit flag
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Only admins can view audit logs
ALTER TABLE ai_request_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only super_admin can view AI audit logs"
ON ai_request_audit_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'super_admin'
  )
);
```

#### 2.6 Encrypted Preference Storage

**Replace localStorage with encrypted Supabase storage:**

```typescript
// ✅ COMPLIANT: Server-side encrypted storage
async function saveUserPreference(userId: string, preferences: any) {
  const anonymousId = generatePreferenceId(userId);

  // Store in Supabase (encrypted at rest)
  await supabase
    .from('encrypted_user_preferences')
    .upsert({
      preference_id: anonymousId,
      preferences_encrypted: encryptPreferences(preferences),
      updated_at: new Date()
    });
}

// No localStorage - all server-side
```

---

### Phase 3: Compliance Verification

#### 3.1 HIPAA Checklist

- [ ] **Administrative Safeguards**
  - [ ] Risk assessment completed
  - [ ] BAA with Anthropic executed
  - [ ] Staff training on PHI handling
  - [ ] Incident response plan updated

- [ ] **Physical Safeguards**
  - [ ] Data at rest encryption (Supabase default)
  - [ ] No PHI in browser storage
  - [ ] Secure disposal procedures

- [ ] **Technical Safeguards**
  - [ ] Access controls (RLS policies)
  - [ ] Audit controls (ai_request_audit_log)
  - [ ] Integrity controls (checksums on AI prompts)
  - [ ] Transmission security (HTTPS + TLS 1.3)

#### 3.2 SOC 2 Checklist

**CC6: Logical and Physical Access Controls**
- [ ] RLS policies on all tables
- [ ] Role-based access for AI features
- [ ] Audit logging of privileged access

**CC7: System Operations**
- [ ] Monitoring dashboards for AI usage
- [ ] Anomaly detection for unusual patterns
- [ ] Regular log reviews

**CC9: Risk Mitigation**
- [ ] Third-party vendor assessment (Anthropic)
- [ ] Data flow diagrams
- [ ] Privacy impact assessment

#### 3.3 Penetration Testing

**Test scenarios:**
1. Attempt to extract user_id from anonymized data
2. Inject PHI into AI prompts
3. Access other users' preferences
4. Bypass RLS policies
5. Retrieve data from browser storage

---

## 🔧 Implementation Order

### **Step 1: Emergency Disable (Immediate)**
```bash
# 1. Comment out imports in AdminPanel
# 2. Do NOT deploy Edge Functions
# 3. Drop admin_usage_tracking table (or disable with RLS)
```

### **Step 2: Execute BAA with Anthropic**
- Contact Anthropic enterprise team
- Sign Business Associate Agreement
- Get HIPAA-compliant API access
- Document in `docs/VENDOR_AGREEMENTS.md`

### **Step 3: Rebuild with Compliant Architecture**
- Implement de-identified section tracking
- Add PHI scrubbing functions
- Create audit logging tables
- Remove all localStorage usage

### **Step 4: Security Review**
- Internal code review
- External HIPAA compliance audit
- Penetration testing
- Document findings

### **Step 5: Gradual Rollout**
- Enable for super_admin role only (testing)
- Monitor audit logs for 2 weeks
- Expand to admin role
- Full deployment after verification

---

## 📋 Files Requiring Changes

### **Disable Immediately:**
1. `src/components/admin/IntelligentAdminPanel.tsx` - Comment out completely
2. `src/services/dashboardPersonalizationAI.ts` - Disable imports
3. `src/services/userBehaviorTracking.ts` - Disable localStorage code
4. `supabase/functions/claude-personalization/index.ts` - DO NOT DEPLOY

### **Keep Active (Safe):**
1. `src/components/admin/AdminPanel.tsx` - Original UI (no tracking)
2. `src/components/admin/WhatsNewModal.tsx` - Modal with links (safe)
3. `src/services/intelligentModelRouter.ts` - Model selection (no user data)
4. `src/types/claude.ts` - Type definitions (safe)

### **Update for Compliance:**
1. Create: `src/services/phiScrubber.ts` - PHI detection and removal
2. Create: `src/services/complianceValidator.ts` - Pre-send validation
3. Create: `supabase/migrations/20251019100000_compliant_analytics.sql` - New schema
4. Update: `src/config/environment.ts` - Add BAA verification flags

---

## 🚨 RED FLAGS - Never Do This

1. ❌ **Never store patient names in analytics tables**
2. ❌ **Never send user prompts to external APIs without scrubbing**
3. ❌ **Never use localStorage for healthcare data**
4. ❌ **Never deploy without BAA with third-party AI**
5. ❌ **Never skip audit logging**
6. ❌ **Never allow direct user_id → patient_id linkage in analytics**

---

## 💡 Alternative: Rule-Based Personalization (No AI)

**If Anthropic BAA is delayed, use simple rule-based approach:**

```typescript
// ✅ COMPLIANT: No external AI, no user tracking
function getDefaultLayout(role: string, timeOfDay: number): DashboardLayout {
  // Hardcoded role-based defaults
  if (role === 'physician' && timeOfDay < 12) {
    return { topSections: ['patient-engagement', 'revenue-dashboard'] };
  }
  // ... simple rules, no learning, no external calls
}
```

**Pros:**
- ✅ No PHI risk
- ✅ No BAA needed
- ✅ Fully compliant
- ✅ Predictable behavior

**Cons:**
- ❌ No personalization
- ❌ No learning over time
- ❌ Static experience

---

## 📞 Next Steps - Action Items

### For Next Chat Session:

1. **Confirm BAA Status:**
   - Do you have existing BAA with Anthropic?
   - If not, should we contact them or use rule-based approach?

2. **Choose Approach:**
   - **Option A:** Full AI with compliant rebuild (2-3 days)
   - **Option B:** Simple rule-based personalization (4 hours)
   - **Option C:** Disable personalization, keep static dashboard (1 hour)

3. **Risk Tolerance:**
   - Can we proceed with non-personalized dashboard while compliance work happens?
   - Or is personalization critical to user experience?

4. **Compliance Review:**
   - Do you have internal compliance officer to review?
   - External HIPAA auditor available?

---

## 📚 References

**HIPAA Regulations:**
- 45 CFR §164.308(b)(1) - Business Associate Contracts
- 45 CFR §164.312(a)(2)(iv) - Encryption
- 45 CFR §164.514 - De-identification

**SOC 2 Trust Service Criteria:**
- CC6 - Logical and Physical Access Controls
- CC7 - System Operations
- CC9 - Risk Mitigation

**Anthropic Resources:**
- Privacy Policy: https://www.anthropic.com/legal/privacy-policy
- Enterprise Contact: enterprise@anthropic.com
- API Documentation: https://docs.anthropic.com/

**Best Practices:**
- NIST Cybersecurity Framework
- HITRUST CSF for Healthcare
- ISO 27001 Information Security

---

## ✅ Summary

**Current State:** AI dashboard has HIPAA/SOC 2 compliance gaps
**Immediate Action:** Disable AI features, keep basic admin panel
**Path Forward:** Rebuild with de-identification, PHI scrubbing, and BAA
**Timeline:** 2-3 days for compliant implementation
**Alternative:** Rule-based personalization (no AI) in 4 hours

**CRITICAL:** Do not enable user tracking or AI personalization until compliance review completed.

---

**Document Version:** 1.0
**Last Updated:** 2025-10-19
**Next Review:** After BAA execution and compliant rebuild
**Owner:** Compliance Team + Engineering Lead
