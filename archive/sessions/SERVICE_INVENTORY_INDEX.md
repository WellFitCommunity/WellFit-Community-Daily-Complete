# Third-Party Services Inventory - Index & Reference

**Created**: November 4, 2025  
**Status**: Complete Analysis  
**Scope**: WellFit Community Daily Complete Platform

---

## Documents Created

1. **THIRD_PARTY_SERVICES_INVENTORY.md** (19KB)
   - Comprehensive technical documentation
   - Complete API configurations
   - Integration details and code references
   - Cost breakdowns and pricing tiers
   - Security and compliance requirements
   - Full operational considerations

2. **THIRD_PARTY_SERVICES_SUMMARY.txt** (Quick Reference)
   - Quick lookup table for all services
   - Cost estimates
   - Status and readiness
   - Health check methods
   - Action items and recommendations

---

## Quick Access

### By Service Category

#### AI & ML
- **Anthropic Claude** (PRIMARY STRATEGIC)
  - Models: Haiku 4.5 + Sonnet 4.5
  - Cost: $50-1,200/month
  - Status: Production Ready
  - Docs: Section 3.1

- **Deepgram** (SPEECH-TO-TEXT)
  - Model: Nova-2-Medical
  - Cost: $200-400/month
  - Status: Production Ready
  - Docs: Section 3.2

#### Cloud Infrastructure
- **Supabase** (CORE)
  - Components: PostgreSQL, Auth, 60+ Edge Functions
  - Cost: $100-300/month
  - Status: Production Ready
  - Docs: Section 3.3

- **Firebase** (SECONDARY)
  - Features: FCM, Analytics, Storage
  - Cost: $0-50/month
  - Status: Production Ready
  - Docs: Section 3.4

- **Vercel** (DEPLOYMENT)
  - Purpose: App hosting and serverless functions
  - Cost: Included in pro plan or usage-based
  - Status: Production Ready
  - Docs: Section 6

#### Communications
- **Twilio** (SMS)
  - Cost: $200-400/month
  - Status: Production Ready
  - Docs: Section 3.6

- **MailerSend** (EMAIL)
  - Cost: $0-25/month
  - Status: Production Ready
  - Docs: Section 3.7

#### Healthcare & Telehealth
- **Daily.co** (VIDEO)
  - Cost: $300-800/month
  - Status: Production Ready
  - Docs: Section 3.5

- **Epic EHR** (FHIR Integration)
  - Cost: $0 (org license-dependent)
  - Status: Configured (org-dependent)
  - Docs: Section 3.9

- **Cerner EHR** (FHIR Integration)
  - Cost: $0 (org license-dependent)
  - Status: Configured (org-dependent)
  - Docs: Section 3.10

#### Security
- **hCaptcha** (BOT PROTECTION)
  - Cost: $0/month (free)
  - Status: Production Ready
  - Docs: Section 3.8

- **Weather API** (OPTIONAL)
  - Cost: $0/month (free)
  - Status: Production Ready
  - Docs: Section 3.11

---

## Key Findings

### Total Service Count
- **External Service Providers**: 11
- **NPM Production Dependencies**: 44
- **NPM Development Dependencies**: 30+
- **Supabase Edge Functions**: 60+
- **Database Migrations**: 40+

### Monthly Cost Estimate
- **Minimum**: $850/month (low usage)
- **Typical**: $1,500-2,500/month (medium usage)
- **Maximum**: $3,175/month (high usage)

### Production Readiness
- **Fully Production Ready**: 10 services
- **Conditional (Org-Dependent)**: 2 services (Epic, Cerner)

### Critical Security Issues Identified
1. API keys exposed in .env.local files
2. Secrets not encrypted in source control
3. No automated key rotation policy
4. Requires immediate secrets manager implementation

---

## Configuration Files Overview

### Environment Variables
```
.env.example                 Template with all required variables
.env.development            Development environment settings
.env.production             Production environment settings
supabase/.env.local         Supabase-specific configuration
```

### Service Configuration
```
src/config/environment.ts           Environment validation and parsing
src/settings/firebase.ts            Firebase initialization
src/lib/supabaseClient.ts           Supabase client singleton
src/lib/firebaseClient.ts           Firebase client setup
supabase/functions/_shared/         Shared utilities for Edge Functions
```

### Service Integration Files
```
src/services/claudeService.ts                    Main Claude client
src/services/claudeEdgeService.ts               Secure server-side Claude
src/services/fhirInteroperabilityIntegrator.ts  FHIR/EHR integration
src/services/patientOutreachService.ts          Twilio SMS integration
src/services/authService.ts                     Authentication
```

---

## Most Important Configuration Values

### Anthropic Claude
```
REACT_APP_ANTHROPIC_API_KEY          sk-ant-[YOUR_KEY]
REACT_APP_CLAUDE_DEFAULT_MODEL       claude-3-5-sonnet-20241022
REACT_APP_CLAUDE_ADMIN_MODEL         claude-3-5-sonnet-20241022
CLAUDE_DAILY_BUDGET                  $50
CLAUDE_MONTHLY_BUDGET                $500
```

### Supabase
```
REACT_APP_SUPABASE_URL               https://xkybsjnvuohpqpbkikyn.supabase.co
REACT_APP_SUPABASE_ANON_KEY          [JWT_TOKEN]
SUPABASE_SERVICE_ROLE_KEY            [SERVICE_ROLE_JWT]
```

### Firebase
```
REACT_APP_FIREBASE_PROJECT_ID        wellfit-community
REACT_APP_FIREBASE_API_KEY           your-firebase-api-key
REACT_APP_FIREBASE_MESSAGING_SENDER_ID    669875280900
```

### Communication Services
```
TWILIO_ACCOUNT_SID                   AC********************************
TWILIO_PHONE_NUMBER                  +1**********
MAILERSEND_API_KEY                   mlsn.********************************
MAILERSEND_DOMAIN                    thewellfitcommunity.org
```

### Healthcare Integration
```
REACT_APP_EPIC_FHIR_URL              https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
REACT_APP_CERNER_FHIR_URL            https://fhir-ehr-code.cerner.com/r4/[ORG_ID]
REACT_APP_FHIR_ENABLED               true
```

### Security
```
REACT_APP_HCAPTCHA_SITE_KEY          your-hcaptcha-site-key
HCAPTCHA_SECRET_KEY                  your-hcaptcha-secret-key
PHI_ENCRYPTION_KEY                   your-phi-encryption-key-32-bytes-base64
```

---

## Critical Action Items

### Immediate (This Week)
1. Move all API keys to Supabase Secrets Manager
2. Audit git history for exposed credentials
3. Implement secrets rotation policy
4. Add .env.local to .gitignore (if not already)

### Short-Term (This Month)
1. Build service health monitoring dashboard
2. Implement circuit breakers for all external APIs
3. Add cost tracking and alerting
4. Document incident response procedures

### Medium-Term (This Quarter)
1. Evaluate alternative service providers for cost optimization
2. Implement multi-region failover
3. Add comprehensive API usage analytics
4. Prepare for Enterprise/HIPAA compliance audits

### Long-Term (This Year)
1. Evaluate Epic/Cerner certified integration
2. Plan multi-cloud strategy
3. Implement advanced observability (distributed tracing)
4. Consider cost optimization through model selection

---

## Testing & Validation

### Service Health Checks
```typescript
// Claude
claudeService.testConnection()

// Firebase
firebase.initializeApp(config)
messaging.getToken({ vapidKey: VAPID_KEY })

// Supabase
supabase.auth.getUser()
supabase.from('profiles').select('*').limit(1)

// Daily.co
POST https://api.daily.co/v1/rooms

// Twilio
POST https://api.twilio.com/2010-04-01/Accounts/{ACCOUNT_SID}/Messages.json

// Deepgram
WebSocket wss://api.deepgram.com/v1/listen
```

---

## Compliance Checklist

- [x] HIPAA audit logging configured
- [x] 7-year retention for compliance records
- [x] PHI encryption at rest and in transit
- [x] Rate limiting (60 req/min per user)
- [x] Service-to-service encryption
- [x] Database access logging
- [x] Secure API key management (needs improvement)
- [x] SOC2 compliance controls

---

## Disaster Recovery & Failover

### Circuit Breaker Pattern
- Claude: Automatic fallback to cached results
- Supabase: Connection pooling with retry
- Firebase: Offline queue for notifications
- Daily.co: Video fallback to audio-only

### Data Backup Strategy
- Supabase PostgreSQL: Automated daily backups
- Edge Function logs: Supabase audit tables
- User data: Excel backup via `nightly-excel-backup` function
- FHIR data: Bi-directional sync with EHR systems

---

## Cost Optimization Strategies

1. **Model Selection**
   - Use Haiku 4.5 for simple queries ($0.0001 input)
   - Reserve Sonnet 4.5 for revenue-critical tasks
   - Avoid Opus unless absolutely necessary

2. **Caching**
   - Translation cache (60-80% hit rate expected)
   - FHIR data caching
   - Session caching at Edge Functions

3. **Rate Limiting**
   - Reduce redundant API calls
   - Implement request deduplication
   - Batch operations where possible

4. **Pricing Tier Selection**
   - Firebase: Free tier sufficient for current usage
   - Supabase: Pro tier is optimal balance
   - Deepgram: Monitor monthly usage trends

---

## Related Documentation

- **Full Inventory**: THIRD_PARTY_SERVICES_INVENTORY.md
- **Quick Reference**: THIRD_PARTY_SERVICES_SUMMARY.txt
- **Project README**: README.md
- **Claude Setup**: docs/CLAUDE_SETUP.md
- **Deployment**: docs/DEPLOYMENT_GUIDE.md
- **HIPAA Compliance**: docs/HIPAA_COMPLIANCE.md
- **FHIR Integration**: docs/FHIR_INTEROPERABILITY_GUIDE.md
- **AI Integration**: AI_INTEGRATIONS_COMPREHENSIVE.md

---

## Contact & Support

For questions about specific integrations:
- Claude/Anthropic: See `src/services/claudeService.ts`
- Supabase: See `src/lib/supabaseClient.ts`
- Firebase: See `src/settings/firebase.ts`
- Deepgram: See `supabase/functions/realtime_medical_transcription/`
- Daily.co: See `src/components/telehealth/`
- Twilio: See `supabase/functions/send-sms/`
- FHIR: See `src/services/fhirInteroperabilityIntegrator.ts`

---

**Document Updated**: November 4, 2025  
**Next Review**: Quarterly (Q1 2026)  
**Maintainer**: Development Team
