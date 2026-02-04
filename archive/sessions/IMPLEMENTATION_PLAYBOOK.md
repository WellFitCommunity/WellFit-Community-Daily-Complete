# WellFit Community Platform - Implementation Playbook

**Version:** 1.0.0
**Last Updated:** January 2026
**Target Audience:** Implementation Engineers, DevOps, Technical Project Managers

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Summary](#architecture-summary)
3. [Pre-Implementation Requirements](#pre-implementation-requirements)
4. [Phase 1: Environment Setup](#phase-1-environment-setup)
5. [Phase 2: Database Configuration](#phase-2-database-configuration)
6. [Phase 3: Integration Setup](#phase-3-integration-setup)
7. [Phase 4: Security Configuration](#phase-4-security-configuration)
8. [Phase 5: Testing & Validation](#phase-5-testing--validation)
9. [Phase 6: Go-Live](#phase-6-go-live)
10. [Post-Go-Live Support](#post-go-live-support)
11. [Rollback Procedures](#rollback-procedures)
12. [Troubleshooting Guide](#troubleshooting-guide)

---

## Overview

This playbook provides step-by-step guidance for implementing the WellFit Community Platform, an enterprise healthcare platform supporting:

- **WellFit**: Community engagement platform for seniors and caregivers
- **Envision Atlus**: Clinical care management engine for healthcare providers

### Deployment Options

| Option | Use Case |
|--------|----------|
| WellFit Only | Community organizations (wellness programs) |
| Envision Atlus Only | Healthcare organizations (clinical workflows) |
| Both Products | Full integration (community + clinical) |

### Tenant License Types

| Code | License Type | Example |
|------|--------------|---------|
| `0` | Both Products | `VG-0002` |
| `8` | Envision Atlus Only | `HH-8001` |
| `9` | WellFit Only | `MC-9001` |

---

## Architecture Summary

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + Vite + Tailwind CSS 4 |
| Backend | Supabase (PostgreSQL 17) + Edge Functions (Deno) |
| Authentication | Supabase Auth + SMART on FHIR OAuth2 |
| Interoperability | FHIR R4, HL7v2, C-CDA, X12 EDI |
| AI Services | Claude (Anthropic) via API |

### Multi-Tenant Architecture

- Row-Level Security (RLS) enforces tenant isolation
- Each tenant has unique `tenant_id` UUID
- Tenant-specific branding via `useBranding()` hook
- Explicit CORS origins per tenant domain

---

## Pre-Implementation Requirements

### Technical Requirements

- [ ] Supabase project created
- [ ] Domain names registered (per tenant)
- [ ] SSL certificates provisioned
- [ ] DNS records configured
- [ ] CI/CD pipeline configured

### Data Requirements

- [ ] Patient data mapping document approved
- [ ] User role definitions finalized
- [ ] Integration endpoints documented
- [ ] PHI data handling procedures signed

### Compliance Requirements

- [ ] BAA signed with Supabase
- [ ] HIPAA Security Risk Assessment complete
- [ ] Privacy policies approved
- [ ] Consent forms finalized

---

## Phase 1: Environment Setup

### 1.1 Clone and Install

```bash
git clone https://github.com/org/WellFit-Community-Daily-Complete.git
cd WellFit-Community-Daily-Complete
npm install
```

### 1.2 Configure Environment Variables

Create `.env.local` with required variables:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Security
VITE_HCAPTCHA_SITE_KEY=your-hcaptcha-key

# AI (optional)
VITE_ANTHROPIC_API_KEY=your-claude-key

# Feature Flags
VITE_FEATURE_PHYSICAL_THERAPY=true
VITE_FEATURE_CARE_COORDINATION=true
```

### 1.3 Verify Build

```bash
npm run typecheck   # Must pass with 0 errors
npm run lint        # Must pass with 0 warnings
npm test            # All 7,072+ tests must pass
npm run build       # Production build
```

---

## Phase 2: Database Configuration

### 2.1 Link Supabase Project

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
```

### 2.2 Run Migrations

```bash
npx supabase db push
```

### 2.3 Verify Core Tables

Essential tables that must exist:

| Table | Purpose |
|-------|---------|
| `tenants` | Multi-tenant configuration |
| `profiles` | User profiles with role/tenant |
| `patients` | Patient demographics |
| `audit_logs` | HIPAA audit trail |
| `consent_records` | Patient consent tracking |

### 2.4 Create Initial Tenant

```sql
INSERT INTO tenants (id, name, code, domain, settings)
VALUES (
  gen_random_uuid(),
  'Methodist Hospital',
  'MH-0001',
  'methodist.wellfitcommunity.com',
  '{"branding": {"primaryColor": "#1e40af"}}'
);
```

### 2.5 Create Super Admin User

```sql
-- After user signs up via Auth
INSERT INTO profiles (user_id, tenant_id, role, email)
VALUES (
  'user-uuid-from-auth',
  'tenant-uuid',
  'super_admin',
  'admin@hospital.com'
);
```

---

## Phase 3: Integration Setup

### 3.1 SMART on FHIR Configuration

Deploy edge functions:

```bash
npx supabase functions deploy smart-authorize
npx supabase functions deploy smart-token
npx supabase functions deploy smart-revoke
npx supabase functions deploy smart-configuration
npx supabase functions deploy fhir-metadata
```

Register client apps:

```sql
INSERT INTO smart_registered_apps (
  client_id,
  client_name,
  redirect_uris,
  grant_types,
  scope,
  tenant_id
) VALUES (
  'client-app-id',
  'EHR Integration',
  ARRAY['https://ehr.hospital.com/callback'],
  ARRAY['authorization_code'],
  'patient/*.read launch/patient',
  'tenant-uuid'
);
```

### 3.2 HL7v2 Connection Setup

Create inbound connection:

```sql
INSERT INTO hl7_connections (
  tenant_id,
  connection_name,
  connection_type,
  host,
  port,
  is_active
) VALUES (
  'tenant-uuid',
  'Lab Interface',
  'inbound',
  '0.0.0.0',
  2575,
  true
);
```

### 3.3 Clearinghouse Integration

Configure payer connections via MCP server:

```bash
npx supabase functions deploy mcp-clearinghouse-server
```

Set clearinghouse credentials in Supabase secrets:

```bash
npx supabase secrets set CLEARINGHOUSE_API_KEY=your-key
npx supabase secrets set CLEARINGHOUSE_PROVIDER=waystar
```

### 3.4 Alert Notification Channels

Configure Slack/PagerDuty notifications:

```sql
INSERT INTO notification_channels (
  tenant_id,
  channel_type,
  name,
  config,
  filters
) VALUES (
  'tenant-uuid',
  'slack',
  'Critical Alerts',
  '{"webhookUrl": "https://hooks.slack.com/..."}',
  '{"severities": ["critical", "emergency"], "categories": ["security", "clinical"]}'
);
```

---

## Phase 4: Security Configuration

### 4.1 CORS Configuration

Add tenant domain to `ALLOWED_ORIGINS`:

```bash
npx supabase secrets set ALLOWED_ORIGINS="https://methodist.wellfitcommunity.com,https://admin.wellfitcommunity.com"
```

Redeploy edge functions:

```bash
npx supabase functions deploy --no-verify-jwt
```

### 4.2 Row-Level Security Verification

All 329 tables must have RLS enabled:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;
-- Result should be empty
```

### 4.3 Audit Log Immutability

Verify audit log protection:

```sql
-- This should fail
UPDATE audit_logs SET event_type = 'modified';
-- ERROR: Audit logs are immutable
```

### 4.4 42 CFR Part 2 Configuration

For substance use disorder programs:

```sql
UPDATE consent_records
SET special_category = 'substance_use_disorder'
WHERE patient_id = 'patient-uuid'
  AND consent_type = 'treatment';
```

---

## Phase 5: Testing & Validation

### 5.1 Security Scan

Run HIPAA compliance scan:

```bash
# In Claude Code CLI
/security-scan
```

Expected: All checks pass

### 5.2 Demo Readiness Check

Run demo validation:

```bash
# In Claude Code CLI
/demo-ready
```

Expected: All critical systems verified

### 5.3 Integration Tests

| Test | Command | Expected |
|------|---------|----------|
| FHIR Metadata | `curl /fhir/metadata` | CapabilityStatement returned |
| SMART Config | `curl /.well-known/smart-configuration` | OAuth URIs present |
| HL7 ACK | Send ADT^A01 | ACK^A01 returned |
| Eligibility | 270 request | 271 response |

### 5.4 Load Testing

Baseline performance targets:

| Metric | Target |
|--------|--------|
| API response time (p95) | < 500ms |
| Patient search | < 200ms |
| FHIR Bundle export | < 5s for 100 resources |
| Concurrent users | 500+ |

---

## Phase 6: Go-Live

### 6.1 Pre-Go-Live Checklist

See [GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md) for complete checklist.

### 6.2 Cutover Steps

1. **T-24h**: Final data migration
2. **T-12h**: Freeze source system changes
3. **T-4h**: Final sync and validation
4. **T-1h**: DNS switch preparation
5. **T-0**: DNS cutover
6. **T+1h**: Smoke test all critical paths
7. **T+4h**: First status report

### 6.3 Rollback Triggers

Initiate rollback if:

- More than 5% error rate on critical endpoints
- Authentication failures > 10%
- Data integrity issues detected
- PHI exposure suspected

---

## Post-Go-Live Support

### 6.1 Support Tiers

| Tier | Response Time | Examples |
|------|---------------|----------|
| P1 - Critical | 15 minutes | System down, PHI breach |
| P2 - High | 1 hour | Feature broken, data sync failed |
| P3 - Medium | 4 hours | Performance degradation |
| P4 - Low | 24 hours | UI bugs, minor issues |

### 6.2 Monitoring

Key metrics to monitor:

- Error rates by endpoint
- Authentication success rate
- Database connection pool usage
- Edge function invocation counts
- AI API token consumption

### 6.3 Backup Verification

Weekly backup verification:

```sql
SELECT * FROM get_backup_verification_status();
```

Monthly DR drill:

```sql
SELECT * FROM disaster_recovery_drills
WHERE scheduled_date >= NOW() - INTERVAL '30 days';
```

---

## Rollback Procedures

### Database Rollback

```bash
# List recent migrations
npx supabase migration list

# Revert last migration
npx supabase db reset --db-url $DATABASE_URL
```

### Application Rollback

```bash
# Revert to previous version
git checkout <previous-tag>
npm install
npm run build
# Deploy via CI/CD
```

### DNS Rollback

Update DNS to point back to previous infrastructure (TTL considerations apply).

---

## Troubleshooting Guide

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Invalid/expired token | Check Supabase Auth logs |
| RLS policy violation | Missing tenant context | Verify `auth.uid()` set |
| Edge function timeout | Long-running query | Add pagination/limits |
| CORS error | Domain not in allowlist | Add to `ALLOWED_ORIGINS` |
| HL7 NAK | Invalid message format | Check segment terminators |

### Log Locations

| Log Type | Location |
|----------|----------|
| Edge Functions | Supabase Dashboard > Edge Functions > Logs |
| Database | Supabase Dashboard > Database > Logs |
| Auth | Supabase Dashboard > Authentication > Logs |
| Application | Browser DevTools > Console |

### Support Contacts

- **Technical Issues**: support@wellfitcommunity.com
- **Security Incidents**: security@wellfitcommunity.com
- **Emergency Hotline**: [Configure per deployment]

---

## Appendix A: Migration Checklist

| Migration | Status | Notes |
|-----------|--------|-------|
| Core tables | Required | tenants, profiles, patients |
| RBAC system | Required | 25 roles defined |
| Audit logging | Required | 10 audit tables |
| Consent management | Required | 8 consent types |
| SMART on FHIR | Required | OAuth2 + PKCE |
| HL7v2 receive | Optional | If EHR integration needed |
| Clearinghouse | Optional | If billing integration needed |
| MPI matching | Optional | If multi-source patient data |
| Alert routing | Optional | If external notifications needed |

---

## Appendix B: Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key (JWT) |
| `VITE_HCAPTCHA_SITE_KEY` | Yes | hCaptcha site key |
| `VITE_ANTHROPIC_API_KEY` | No | Claude AI API key |
| `SB_SECRET_KEY` | Yes* | Supabase secret key (edge functions) |
| `SB_SERVICE_ROLE_KEY` | Yes* | Supabase service role key (edge functions) |
| `CLEARINGHOUSE_API_KEY` | No | Clearinghouse integration |
| `ALLOWED_ORIGINS` | Yes | Comma-separated tenant domains |

*Required in Supabase secrets for edge functions

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | Jan 2026 | WellFit Team | Initial release |
