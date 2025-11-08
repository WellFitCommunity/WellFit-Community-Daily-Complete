# Enterprise Scalability Implementation Plan
**For Methodist Healthcare Deployment**  
**Prepared:** November 7, 2025  
**Timeline:** 8-10 weeks to production-ready  
**Budget:** $45,000 - $65,000 (labor) + $2,400/year (infrastructure)

---

## EXECUTIVE SUMMARY

This plan outlines the specific technical work required to make WellFit Community enterprise-ready for Methodist Healthcare's 5,000-patient deployment. All recommendations are based on the evidence-based audit report.

**Critical Path Items:**
1. Database-native encryption implementation (2 weeks)
2. Tenant isolation architecture (3 weeks)  
3. APM & monitoring setup (1 week)
4. Load testing & optimization (2 weeks)
5. Security audit & penetration testing (2 weeks)

**Total Timeline:** 10 weeks  
**Risk Level:** MEDIUM (most gaps are solvable with engineering time)

---

## PHASE 1: DATABASE ARCHITECTURE HARDENING (3 weeks)

### Task 1.1: Implement Database-Native Encryption
**Duration:** 2 weeks  
**Priority:** CRITICAL  
**Effort:** 80 hours

**Current State:**
- Application-layer encryption via TypeScript
- Session-based encryption keys
- No database triggers for automatic encryption

**Required Changes:**

**Step 1: Install pgcrypto Extension**
```sql
-- New migration: 20251108000000_add_pgcrypto_encryption.sql

BEGIN;

-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create encryption key management table
CREATE TABLE IF NOT EXISTS public.encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name TEXT UNIQUE NOT NULL,
  encrypted_key TEXT NOT NULL, -- Key encrypted with master key
  key_version INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  rotated_at TIMESTAMPTZ
);

-- Create function to get active encryption key
CREATE OR REPLACE FUNCTION get_encryption_key(key_name TEXT)
RETURNS TEXT AS $$
DECLARE
  active_key TEXT;
BEGIN
  SELECT encrypted_key INTO active_key
  FROM public.encryption_keys
  WHERE key_name = $1 AND active = true
  ORDER BY key_version DESC
  LIMIT 1;
  
  RETURN active_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
```

**Step 2: Add Encrypted Columns to PHI Tables**
```sql
-- Migration: 20251108000001_add_encrypted_phi_columns.sql

BEGIN;

-- Example: Encrypt check_ins.emotional_state
ALTER TABLE public.check_ins 
  ADD COLUMN emotional_state_encrypted BYTEA,
  ADD COLUMN encrypted_at TIMESTAMPTZ;

-- Create encryption trigger
CREATE OR REPLACE FUNCTION encrypt_check_in_phi()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.emotional_state IS NOT NULL THEN
    NEW.emotional_state_encrypted := pgp_sym_encrypt(
      NEW.emotional_state::TEXT,
      get_encryption_key('phi_master_key')
    );
    NEW.encrypted_at := NOW();
    NEW.emotional_state := NULL; -- Clear plaintext
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_encrypt_check_in
  BEFORE INSERT OR UPDATE ON public.check_ins
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_check_in_phi();

COMMIT;
```

**Step 3: Create Decryption Views**
```sql
-- Migration: 20251108000002_create_decryption_views.sql

BEGIN;

CREATE OR REPLACE VIEW public.check_ins_decrypted AS
SELECT
  id,
  user_id,
  label,
  pgp_sym_decrypt(
    emotional_state_encrypted,
    get_encryption_key('phi_master_key')
  )::TEXT AS emotional_state,
  heart_rate,
  pulse_oximeter,
  created_at
FROM public.check_ins
WHERE 
  -- Only show if user has access (via RLS on base table)
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin', 'physician', 'nurse')
  );

-- Apply RLS to view
ALTER VIEW check_ins_decrypted SET (security_barrier = true);

COMMIT;
```

**Files to Update:**
- `src/lib/phi-encryption.ts` - Remove application encryption, use views
- All service calls to PHI tables - Use `*_decrypted` views

**Testing Checklist:**
- [ ] Insert test record, verify column is encrypted (BYTEA type)
- [ ] Query decrypted view, verify plaintext is returned
- [ ] Test key rotation (update encryption_keys table)
- [ ] Benchmark performance (encryption adds ~2ms per operation)

**Deliverable:** Migration scripts + updated services + test suite

---

### Task 1.2: Add Tenant Isolation with tenant_id
**Duration:** 3 weeks  
**Priority:** CRITICAL  
**Effort:** 120 hours

**Current State:**
- NO tenant_id columns in any production table
- Subdomain-based UI branding only
- All users share same database

**Required Changes:**

**Step 1: Create Tenants Table**
```sql
-- Migration: 20251108100000_create_tenants_table.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL, -- 'methodist', 'houston', 'miami'
  name TEXT NOT NULL, -- 'Methodist Healthcare'
  subdomain TEXT UNIQUE NOT NULL, -- 'methodist.wellfitcommunity.org'
  
  -- Configuration
  max_users INTEGER DEFAULT 10000,
  max_storage_gb INTEGER DEFAULT 100,
  features JSONB DEFAULT '{}'::jsonb, -- Feature flags per tenant
  
  -- Branding (migrate from branding.config.ts)
  branding JSONB NOT NULL,
  
  -- Billing
  subscription_tier TEXT CHECK (subscription_tier IN ('free', 'basic', 'enterprise')),
  billing_email TEXT,
  
  -- Status
  active BOOLEAN DEFAULT true,
  suspended_at TIMESTAMPTZ,
  suspended_reason TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Methodist tenant
INSERT INTO public.tenants (slug, name, subdomain, subscription_tier, branding)
VALUES (
  'methodist',
  'Methodist Healthcare',
  'methodist.wellfitcommunity.org',
  'enterprise',
  '{
    "appName": "Methodist WellFit",
    "primaryColor": "#004990",
    "secondaryColor": "#00A8E1",
    "logoUrl": "/logos/methodist-logo.png"
  }'::jsonb
);

-- Create function to get current tenant
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
  -- In production, this would check JWT claim or session variable
  -- For now, lookup by subdomain from app.settings
  RETURN (
    SELECT id FROM public.tenants
    WHERE subdomain = current_setting('app.current_subdomain', true)
    AND active = true
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMIT;
```

**Step 2: Add tenant_id to All Tables (100+ tables!)**
```sql
-- Migration: 20251108100001_add_tenant_id_to_tables.sql
-- This is a BIG migration - phased approach required

BEGIN;

-- Phase 1: Core user tables
ALTER TABLE public.profiles ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.user_roles ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.check_ins ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.encounters ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.medications ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);

-- Phase 2: FHIR tables (11 tables)
ALTER TABLE public.fhir_medication_requests ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.fhir_conditions ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.fhir_observations ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
-- ... repeat for all FHIR tables

-- Phase 3: Billing tables
ALTER TABLE public.claims ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.billing_providers ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
-- ... repeat for all billing tables

-- Add indexes (CRITICAL for performance)
CREATE INDEX idx_profiles_tenant_id ON public.profiles(tenant_id);
CREATE INDEX idx_check_ins_tenant_id ON public.check_ins(tenant_id);
CREATE INDEX idx_encounters_tenant_id ON public.encounters(tenant_id);
-- ... repeat for all tables

-- Backfill existing data (assign to default tenant)
UPDATE public.profiles SET tenant_id = (SELECT id FROM tenants WHERE slug = 'wellfit-default');
UPDATE public.check_ins SET tenant_id = (SELECT id FROM tenants WHERE slug = 'wellfit-default');
-- ... repeat for all tables

-- Make tenant_id NOT NULL after backfill
ALTER TABLE public.profiles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.check_ins ALTER COLUMN tenant_id SET NOT NULL;
-- ... repeat for all tables

COMMIT;
```

**Step 3: Update ALL RLS Policies (137 policies!)**
```sql
-- Migration: 20251108100002_update_rls_for_tenants.sql

BEGIN;

-- Example: Update profiles policy
DROP POLICY IF EXISTS "profiles select self" ON public.profiles;
CREATE POLICY "profiles select self"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id 
  AND tenant_id = get_current_tenant_id() -- ADD THIS LINE
);

DROP POLICY IF EXISTS "profiles update self" ON public.profiles;
CREATE POLICY "profiles update self"
ON public.profiles
FOR UPDATE
USING (
  auth.uid() = user_id 
  AND tenant_id = get_current_tenant_id() -- ADD THIS LINE
);

-- Repeat for ALL 137 policies...
-- Consider generating this migration programmatically

COMMIT;
```

**Step 4: Update Application Code**
```typescript
// src/lib/supabaseClient.ts
export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
  global: {
    fetch: fetch.bind(globalThis),
    headers: {
      // Set tenant context from subdomain
      'X-Tenant-Subdomain': window.location.hostname.split('.')[0]
    }
  }
});

// Add middleware to set PostgreSQL session variable
supabase.rpc('set_config', {
  setting_name: 'app.current_subdomain',
  new_value: window.location.hostname,
  is_local: true
});
```

**Testing Checklist:**
- [ ] Create test tenant in staging
- [ ] Verify cross-tenant data isolation (User A can't see User B's data)
- [ ] Test all 137 RLS policies still work
- [ ] Benchmark query performance with tenant_id indexes
- [ ] Test tenant switching (change subdomain, verify different data)

**Risk Mitigation:**
- This is a LARGE migration - requires extensive testing
- Consider doing in phases (core tables first, then FHIR, then billing)
- Create rollback plan (snapshot database before migration)

**Deliverable:** Migration scripts + updated services + test suite

---

## PHASE 2: PERFORMANCE & MONITORING (3 weeks)

### Task 2.1: Implement Query Batching (DataLoader)
**Duration:** 2 weeks  
**Priority:** HIGH  
**Effort:** 80 hours

**Current State:**
- Each service call is separate query
- N+1 query problem on list views
- No request batching

**Implementation:**

**Step 1: Install DataLoader**
```bash
npm install dataloader
npm install @types/dataloader --save-dev
```

**Step 2: Create DataLoader Service**
```typescript
// src/services/dataloader/DataLoaderService.ts

import DataLoader from 'dataloader';
import { supabase } from '../../lib/supabaseClient';

class DataLoaderService {
  // Patient loader - batch fetch patients by ID
  patientLoader = new DataLoader<string, Patient>(async (patientIds) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', patientIds);
    
    // Map results back to input order
    return patientIds.map(id => data?.find(p => p.user_id === id) || null);
  });
  
  // Medication loader - batch fetch meds by patient
  medicationLoader = new DataLoader<string, Medication[]>(async (patientIds) => {
    const { data } = await supabase
      .from('medications')
      .select('*')
      .in('user_id', patientIds);
    
    // Group by patient
    return patientIds.map(id => data?.filter(m => m.user_id === id) || []);
  });
  
  // Add loaders for: encounters, check_ins, fhir_conditions, etc.
}

export const dataLoader = new DataLoaderService();
```

**Step 3: Use in Services**
```typescript
// Before (N+1 queries):
for (const encounter of encounters) {
  const patient = await supabase.from('profiles').select('*').eq('user_id', encounter.patient_id).single();
  // Called 50 times for 50 encounters!
}

// After (1 batch query):
for (const encounter of encounters) {
  const patient = await dataLoader.patientLoader.load(encounter.patient_id);
  // Batched into single query for all 50 patients
}
```

**Expected Performance Improvement:**
- Patient list page: 50 queries → 3 queries (94% reduction)
- Care team dashboard: 100 queries → 5 queries (95% reduction)
- Response time: 500ms → 50ms (10x faster)

**Deliverable:** DataLoader service + updated components + benchmarks

---

### Task 2.2: Add APM Monitoring (New Relic)
**Duration:** 1 week  
**Priority:** HIGH  
**Effort:** 40 hours

**Implementation:**

**Step 1: Install New Relic**
```bash
npm install newrelic
```

**Step 2: Configure**
```javascript
// newrelic.js (root of project)
'use strict';

exports.config = {
  app_name: ['WellFit Community - Methodist'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  logging: { level: 'info' },
  
  transaction_tracer: {
    enabled: true,
    transaction_threshold: 0.5, // Alert on queries > 500ms
    record_sql: 'obfuscated'
  },
  
  error_collector: {
    enabled: true,
    ignore_status_codes: [404]
  },
  
  distributed_tracing: { enabled: true },
  
  // Custom attributes
  attributes: {
    include: ['request.headers.x-tenant-subdomain']
  }
};
```

**Step 3: Add Custom Instrumentation**
```typescript
// src/services/monitoring/newRelicMonitor.ts

import newrelic from 'newrelic';

export function trackDatabaseQuery(
  tableName: string,
  operation: 'select' | 'insert' | 'update' | 'delete',
  duration: number
) {
  newrelic.recordMetric(`Database/${tableName}/${operation}`, duration);
}

export function trackCacheHit(namespace: string, hit: boolean) {
  const metricName = hit ? 'Cache/Hit' : 'Cache/Miss';
  newrelic.recordMetric(`${metricName}/${namespace}`, 1);
}

export function setUserContext(userId: string, tenantId: string) {
  newrelic.addCustomAttributes({
    userId,
    tenantId
  });
}
```

**Step 4: Dashboard Setup**
- Create "Methodist Production" dashboard
- Widgets: Response time, error rate, throughput, Apdex score
- Alerts: Response time > 1s, error rate > 1%, DB connections > 80

**Monthly Cost:** $99/mo for Pro tier (100GB data)

**Deliverable:** New Relic integration + custom dashboard + alert rules

---

### Task 2.3: Load Testing & Optimization
**Duration:** 2 weeks  
**Priority:** HIGH  
**Effort:** 80 hours

**Implementation:**

**Step 1: Install k6**
```bash
# Local testing
brew install k6  # macOS
# OR
wget https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz
```

**Step 2: Create Load Test Scripts**
```javascript
// tests/load/methodist-realistic-load.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp to 100 users
    { duration: '5m', target: 100 },  // Stay at 100
    { duration: '2m', target: 300 },  // Spike to 300 (peak load)
    { duration: '3m', target: 300 },  // Hold peak
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests < 500ms
    errors: ['rate<0.01'],            // Error rate < 1%
  },
};

export default function () {
  // Simulate patient login
  const loginRes = http.post('https://methodist.wellfitcommunity.org/api/login', {
    email: `patient${__VU}@test.com`,
    password: 'TestPassword123!'
  });
  
  check(loginRes, {
    'login successful': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  const authToken = loginRes.json('access_token');
  
  // Simulate check-in submission
  const checkInRes = http.post(
    'https://methodist.wellfitcommunity.org/api/check-ins',
    JSON.stringify({
      emotional_state: 'good',
      heart_rate: 75,
      blood_pressure: '120/80'
    }),
    {
      headers: { 
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  check(checkInRes, {
    'check-in created': (r) => r.status === 201,
  }) || errorRate.add(1);
  
  sleep(5); // Think time between actions
}
```

**Step 3: Run Tests**
```bash
# Baseline test (current state)
k6 run --out json=baseline-results.json tests/load/methodist-realistic-load.js

# After optimizations
k6 run --out json=optimized-results.json tests/load/methodist-realistic-load.js

# Compare results
k6 compare baseline-results.json optimized-results.json
```

**Step 4: Analyze & Optimize**

**Expected Bottlenecks:**
1. Check-in endpoint (high write volume)
   - **Fix:** Add write-behind cache for analytics
   
2. Patient dashboard (N+1 queries)
   - **Fix:** DataLoader implementation (Task 2.1)
   
3. FHIR resource queries (large payloads)
   - **Fix:** Add field selection, pagination

**Target Metrics:**
- p95 response time: < 500ms
- p99 response time: < 1000ms
- Error rate: < 0.1%
- Throughput: > 1000 req/s

**Deliverable:** Load test scripts + optimization report + before/after benchmarks

---

## PHASE 3: SECURITY & COMPLIANCE (2 weeks)

### Task 3.1: Third-Party Security Audit
**Duration:** 2 weeks  
**Priority:** CRITICAL  
**Effort:** External vendor

**Vendor Recommendation:** Coalfire or Schellman (both HITRUST certified)

**Scope of Audit:**
1. **Penetration Testing**
   - External network scan
   - Web application testing (OWASP Top 10)
   - API endpoint fuzzing
   - Authentication bypass attempts
   
2. **Code Review**
   - PHI handling in application code
   - Encryption key management
   - RLS policy effectiveness
   - SQL injection vulnerability scan
   
3. **Infrastructure Review**
   - Supabase configuration audit
   - Vercel security headers
   - Backup encryption verification
   - Access control review

**Deliverables:**
- Penetration test report with severity ratings
- Remediation plan for findings
- Re-test after fixes
- Executive summary for Methodist

**Cost:** $15,000 - $25,000

**Timeline:**
- Week 1: Initial testing
- Week 2: Remediation + re-test

---

### Task 3.2: SOC2 Type II Acceleration
**Duration:** 3-6 months (parallel with above work)  
**Priority:** HIGH  
**Effort:** External auditor

**Current State:** Planned for Q1 2026

**Recommendation:** Accelerate to December 2025 for Methodist

**Process:**
1. **Select Auditor** (Schellman, Deloitte, or A-LIGN)
2. **Readiness Assessment** (2 weeks)
   - Gap analysis
   - Policy review
   - Control testing
   
3. **Remediation** (4-8 weeks)
   - Implement missing controls
   - Update policies
   - Staff training
   
4. **Type II Audit** (12 weeks observation period)
   - Auditor monitors controls
   - Collect evidence
   - Final report

**Cost:** $25,000 - $40,000

**Deliverable:** SOC2 Type II report (required for Methodist contract)

---

## PHASE 4: DEPLOYMENT & CUTOVER (1 week)

### Task 4.1: Methodist Dedicated Instance Setup
**Duration:** 1 week  
**Priority:** CRITICAL  
**Effort:** 40 hours

**Step 1: Create Supabase Project**
```bash
# Via Supabase Dashboard
1. New Project: "wellfit-methodist-prod"
2. Region: US West (same as current)
3. Plan: Pro ($25/mo + usage)
4. Enable: Point-in-Time Recovery (PITR)
5. Enable: Daily backups to S3
```

**Step 2: Configure Custom Domain**
```bash
# Add to Vercel
vercel domains add methodist.wellfitcommunity.org

# Update DNS (Methodist IT team)
CNAME methodist.wellfitcommunity.org -> cname.vercel-dns.com
```

**Step 3: Deploy Methodist-Specific Configuration**
```typescript
// .env.methodist.production
REACT_APP_SUPABASE_URL=https://wellfit-methodist-prod.supabase.co
REACT_APP_SUPABASE_KEY=methodist_anon_key_here
REACT_APP_TENANT_SLUG=methodist
REACT_APP_ENVIRONMENT=methodist-production

// Deploy command
vercel --prod --env-file .env.methodist.production
```

**Step 4: Run All Migrations**
```bash
# Connect to Methodist database
export PGPASSWORD="methodist_db_password"
export PGHOST="wellfit-methodist-prod.supabase.co"

# Run migrations
npm run sb:migrations apply --all

# Verify tenant record
psql -h $PGHOST -c "SELECT * FROM tenants WHERE slug = 'methodist';"
```

**Step 5: Initial Data Load (if migrating from existing system)**
```bash
# Use FHIR interoperability to pull data
node scripts/methodist-data-migration.js \
  --source methodist-epic-fhir-server \
  --batch-size 100 \
  --start-date 2024-01-01
```

**Deliverable:** Production Methodist instance + smoke tests passing

---

## BUDGET BREAKDOWN

### Engineering Costs (10 weeks)

| Phase | Task | Hours | Rate | Subtotal |
|-------|------|-------|------|----------|
| **Phase 1** | Database encryption | 80 | $150 | $12,000 |
| | Tenant isolation | 120 | $150 | $18,000 |
| **Phase 2** | Query batching | 80 | $150 | $12,000 |
| | APM setup | 40 | $150 | $6,000 |
| | Load testing | 80 | $150 | $12,000 |
| **Phase 3** | Security audit | - | External | $20,000 |
| | SOC2 acceleration | - | External | $30,000 |
| **Phase 4** | Methodist deployment | 40 | $150 | $6,000 |
| **TOTAL** | | **440 hours** | | **$116,000** |

### Infrastructure Costs (Annual)

| Service | Monthly | Annual | Notes |
|---------|---------|--------|-------|
| Supabase Pro | $25 | $300 | Base + ~$200/mo usage = $2,700/year |
| Vercel Pro | $20 | $240 | Static hosting |
| New Relic APM | $99 | $1,188 | Monitoring |
| Domain/SSL | $5 | $60 | methodist.wellfitcommunity.org |
| **TOTAL** | **$149** | **$1,788** | **First year** |

### GRAND TOTAL
- **One-Time:** $116,000 (labor)
- **Annual Recurring:** $1,788 (infrastructure)
- **Total Year 1:** $117,788

**Amortized Over 3-Year Methodist Contract:**
- Year 1: $117,788
- Year 2: $1,788 (just infrastructure)
- Year 3: $1,788
- **3-Year Total:** $121,364
- **Per Patient (5,000):** $24.27 over 3 years = $8/patient/year

---

## TIMELINE GANTT CHART

```
Week 1-2:   [████████████] Database Encryption
Week 2-4:   [        ████████████████] Tenant Isolation
Week 3-5:   [            ████████████] Query Batching
Week 4:     [               ████] APM Setup
Week 5-6:   [                   ████████] Load Testing
Week 7-8:   [                           ████████] Security Audit
Week 9:     [                                   ████] Deployment
Week 10:    [                                       ████] Testing & Handoff

Critical Path: Database Encryption → Tenant Isolation → Security Audit → Deployment
Parallel Work: Query Batching, APM, Load Testing can run alongside Tenant Isolation
```

---

## RISK REGISTER

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Tenant migration breaks existing data** | MEDIUM | HIGH | Phased rollout, extensive testing, rollback plan |
| **Security audit finds critical vulnerabilities** | MEDIUM | HIGH | Address findings before Methodist go-live |
| **SOC2 timeline slips past Methodist deadline** | LOW | HIGH | Start immediately, use interim compliance report |
| **Load testing reveals performance issues** | MEDIUM | MEDIUM | Budget 2 weeks for optimization |
| **Methodist changes requirements mid-project** | HIGH | MEDIUM | Weekly check-ins, change order process |

---

## SUCCESS CRITERIA

### Technical Metrics
- ✅ All 115+ tables have `tenant_id` column with NOT NULL constraint
- ✅ All 137 RLS policies include tenant check
- ✅ PHI fields encrypted at rest in database (verified via pg_dump)
- ✅ p95 response time < 500ms under 300 concurrent users
- ✅ Cache hit rate > 85%
- ✅ Zero cross-tenant data leakage (verified by security audit)

### Compliance Metrics
- ✅ SOC2 Type II report delivered (or interim report if timeline constrained)
- ✅ Penetration test passed with no HIGH or CRITICAL findings
- ✅ HIPAA BAA signed with Methodist
- ✅ All PHI access logged to immutable audit tables

### Business Metrics
- ✅ Methodist instance deployed to production
- ✅ 5,000 patient records migrated (if applicable)
- ✅ 200 staff users trained and onboarded
- ✅ Zero downtime during cutover
- ✅ Methodist IT team signed off on security review

---

## ONGOING SUPPORT (Post-Launch)

### Monthly Tasks
- **Week 1:** Review New Relic dashboards, optimize slow queries
- **Week 2:** Audit log analysis, security event review
- **Week 3:** Capacity planning review (storage, connections, API usage)
- **Week 4:** Backup testing, disaster recovery drill

### Quarterly Tasks
- Update dependencies (npm audit fix)
- Re-run penetration tests
- Review and rotate encryption keys
- SOC2 control testing (for annual re-certification)

### Annual Tasks
- SOC2 Type II re-certification audit
- Third-party security audit
- Disaster recovery full drill
- Capacity planning for year ahead

**Estimated Support Cost:** 10 hours/week = $78,000/year (1 FTE at $150/hr)

---

## CONCLUSION

This plan provides a realistic, evidence-based roadmap to make WellFit Community enterprise-ready for Methodist Healthcare. The 10-week timeline is achievable with dedicated engineering resources, and the $117K investment is justified by the Methodist contract value (likely $500K+ over 3 years for 5,000 patients).

**Critical Success Factors:**
1. ✅ Executive buy-in for 10-week timeline
2. ✅ Dedicated engineering team (not part-time)
3. ✅ Early engagement with Methodist IT for requirements
4. ✅ Budget approval for external audits ($50K)
5. ✅ Commitment to SOC2 acceleration

**Recommendation:** Proceed with Phase 1 (Database Architecture) immediately while negotiating Methodist contract terms. This work is valuable regardless of Methodist, as it makes the platform multi-tenant ready for future enterprise clients.

---

**Document Version:** 1.0  
**Prepared By:** Technical Architecture Team  
**Date:** November 7, 2025  
**Next Review:** Weekly during implementation

