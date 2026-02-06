# Disaster Recovery Plan

**Envision Virtual Edge Group LLC**
**Effective Date:** February 6, 2026
**Last Review:** February 6, 2026
**Next Review:** August 6, 2026
**HIPAA Reference:** 45 CFR 164.308(a)(7) - Contingency Plan

---

## Purpose

This document defines the disaster recovery (DR) procedures for the WellFit Community and Envision Atlus platforms. It establishes Recovery Time Objectives (RTO), Recovery Point Objectives (RPO), and step-by-step recovery procedures for all infrastructure components.

---

## Recovery Objectives

| Tier | Component | RTO | RPO | Justification |
|------|-----------|-----|-----|---------------|
| **1 - Critical** | Database (Supabase PostgreSQL) | 1 hour | 5 minutes | Clinical data, active patient care |
| **1 - Critical** | Authentication (Supabase Auth) | 1 hour | 0 (stateless JWT) | Staff and patient access |
| **1 - Critical** | Edge Functions (clinical) | 2 hours | N/A (stateless) | AI services, clinical workflows |
| **2 - Important** | Frontend (Vercel) | 4 hours | N/A (static deploy) | User interface access |
| **2 - Important** | MCP Servers | 4 hours | N/A (stateless) | FHIR, HL7, NPI, CMS integrations |
| **3 - Standard** | SMS notifications (Twilio) | 8 hours | N/A | Non-critical communications |
| **3 - Standard** | Email delivery (MailerSend) | 8 hours | N/A | Non-critical communications |
| **3 - Standard** | AI services (Anthropic) | 8 hours | N/A | Clinical AI (manual fallback available) |

---

## Infrastructure Architecture

```
 COMPONENT           PROVIDER          REGION          REDUNDANCY
 =========           ========          ======          ==========

 Frontend CDN        Vercel            Global Edge     Multi-region automatic
 DNS / SSL           Vercel            Global          Automatic failover

 Database            Supabase (AWS)    us-east-1       Single region*
 Auth Service        Supabase (AWS)    us-east-1       Managed HA
 Edge Functions      Supabase (Deno)   us-east-1       Managed scaling
 Storage             Supabase (S3)     us-east-1       S3 cross-AZ

 SMS                 Twilio            Multi-region    Twilio managed HA
 Email               MailerSend        Multi-region    Provider managed HA
 AI Services         Anthropic         Multi-region    Provider managed HA

 *Supabase Pro plan includes automated failover within region
```

---

## Backup Strategy

### Database Backups

| Backup Type | Frequency | Retention | Recovery Method |
|-------------|-----------|-----------|-----------------|
| Automated daily backup | Every 24 hours | 30 days | Supabase Dashboard restore |
| Point-in-Time Recovery (PITR) | Continuous (WAL streaming) | 7 days | Restore to any second within window |
| Pre-migration snapshot | Before each migration | Until next migration verified | Supabase Dashboard restore |

### Application Backups

| Component | Backup Method | Location |
|-----------|---------------|----------|
| Source code | Git (GitHub) | github.com/WellFitCommunity |
| Edge Functions | Git + deployed versions | GitHub + Supabase |
| Environment secrets | Supabase Vault + documented | Supabase Dashboard |
| DNS configuration | Documented in deployment guide | docs/deployment/ |

### What Is NOT Backed Up (By Design)

| Item | Reason |
|------|--------|
| Browser localStorage | No PHI stored; session tokens regenerated |
| Offline IndexedDB queue | Auto-deleted after sync; temporary by design |
| Vercel build cache | Rebuilds from source in minutes |
| Edge function logs | Operational only; 30-day Supabase retention |

---

## Disaster Scenarios and Response

### Scenario 1: Database Outage (Supabase)

**Impact:** All data access lost. Clinical workflows halted.
**RTO:** 1 hour | **RPO:** 5 minutes (PITR)

**Detection:**
- Supabase status page alerts
- Edge Function health checks fail
- Frontend shows connection errors

**Response Procedure:**
1. **Immediate (0-5 min):** Check [status.supabase.com](https://status.supabase.com) for known incidents
2. **Assessment (5-15 min):** Determine if outage is Supabase-wide or project-specific
3. **If Supabase-wide:** Monitor status page; activate offline mode for field staff
4. **If project-specific:**
   - Check Supabase Dashboard for project health
   - Review recent migrations for potential cause
   - Contact Supabase support (Pro plan priority support)
5. **If data corruption detected:**
   - Use PITR to restore to last known good state
   - Verify data integrity after restore
   - Document incident and data loss window
6. **Recovery verification:**
   - Run health check on all Edge Functions
   - Verify RLS policies are intact
   - Confirm authentication flow works
   - Spot-check clinical data integrity

**Offline Mode Activation:**
- PWA continues operating with cached data
- Check-ins queue in IndexedDB with device encryption
- Auto-sync when connection restores
- Staff notified via SMS (Twilio) if database exceeds 30-min downtime

---

### Scenario 2: Frontend Outage (Vercel)

**Impact:** Users cannot access web application. Backend still operational.
**RTO:** 4 hours | **RPO:** N/A (static assets)

**Response Procedure:**
1. **Immediate:** Check [vercel.com/status](https://vercel.com/status)
2. **If Vercel-wide:** Monitor; PWA cached version may still work for existing sessions
3. **If deployment-specific:**
   - Check Vercel deployment logs for errors
   - Roll back to previous deployment: `vercel rollback` or via Dashboard
   - If rollback fails, redeploy from last known good commit
4. **Recovery verification:**
   - Verify all routes load correctly
   - Test authentication flow
   - Confirm API connectivity to Supabase

---

### Scenario 3: Edge Function Failure

**Impact:** Specific clinical or integration workflows unavailable.
**RTO:** 2 hours | **RPO:** N/A (stateless)

**Response Procedure:**
1. **Identify affected functions** via error logs in Supabase Dashboard
2. **Check recent deployments** - did a new deploy break something?
3. **Rollback if needed:**
   ```bash
   # Redeploy from last known good commit
   git checkout <last-good-commit>
   npx supabase functions deploy <function-name> --no-verify-jwt
   ```
4. **If Supabase Deno runtime issue:** Monitor Supabase status; functions auto-recover
5. **Recovery verification:** Test affected endpoints with health check calls

---

### Scenario 4: Authentication Service Failure

**Impact:** No new logins. Existing sessions may continue until JWT expiry.
**RTO:** 1 hour | **RPO:** 0

**Response Procedure:**
1. **Check Supabase Auth status** in Dashboard
2. **Existing sessions:** Users with valid JWTs continue working until token expires
3. **If Auth is down:**
   - Emergency: Use service role key for critical clinical operations only
   - Monitor Supabase status for resolution
4. **If caused by signing key issue:**
   - Do NOT rotate keys during outage (makes it worse)
   - Wait for Supabase resolution
   - After recovery: verify JWKS endpoint is responding
5. **Recovery verification:**
   - Test login flow (patient, staff, admin)
   - Verify PIN-based caregiver access
   - Confirm JWT refresh works

---

### Scenario 5: External Service Outage

| Service | Impact | Fallback |
|---------|--------|----------|
| Anthropic (Claude) | AI clinical services unavailable | Manual clinical workflows; AI features gracefully degrade |
| Twilio | SMS notifications stop | Email fallback; in-app notifications continue |
| MailerSend | Email delivery stops | SMS fallback; in-app notifications continue |
| Clearinghouse | Claims submission delayed | Queue claims; submit when service restores |
| External FHIR (Epic) | EHR sync paused | Local data continues; sync resumes on recovery |

**Response:** Monitor provider status pages. No manual intervention needed - services auto-recover and queued operations process on restoration.

---

### Scenario 6: Security Incident / Data Breach

**Impact:** Potential PHI exposure. See SECURITY.md for full incident response.
**RTO:** Varies | **RPO:** 0 (no data should be lost)

**Response Procedure:**
1. **Immediate containment** per SECURITY.md P0-P3 classification
2. **Preserve evidence** - do not delete logs or modify data
3. **Activate incident response team** (Security Officer, Clinical Director)
4. **If credentials compromised:**
   - Rotate affected API keys in Supabase Dashboard
   - Rotate JWT signing keys (follow 20-minute propagation protocol)
   - Force session invalidation for affected users
5. **HIPAA breach notification** within 60 days if PHI confirmed exposed (500+ individuals: HHS notification within 60 days)
6. **Post-incident:** Document in incident log, update risk assessment

---

### Scenario 7: Complete Infrastructure Loss

**Impact:** All services unavailable. Full rebuild required.
**RTO:** 24 hours | **RPO:** 5 minutes (PITR)

**Response Procedure:**
1. **Database recovery:**
   - Create new Supabase project (or contact Supabase for project recovery)
   - Restore from most recent backup or PITR
   - Verify all RLS policies restored
2. **Edge Functions:**
   - Deploy all functions from GitHub source
   - Restore environment secrets from documented list
3. **Frontend:**
   - Redeploy to Vercel from GitHub
   - Verify DNS and SSL certificates
4. **External integrations:**
   - Re-verify all API keys and connections
   - Test clearinghouse, FHIR, Twilio, MailerSend connectivity
5. **Validation:**
   - Full end-to-end testing of all workflows
   - Verify audit logging operational
   - Confirm multi-tenant isolation intact

---

## Communication Plan

### Internal Escalation

| Severity | Who to Notify | Timeline | Method |
|----------|---------------|----------|--------|
| P0 (data breach, complete outage) | Security Officer + Clinical Director + All Staff | Immediate | Phone + SMS |
| P1 (major service degraded) | Engineering + Clinical Director | Within 15 min | SMS + Email |
| P2 (minor service degraded) | Engineering | Within 1 hour | Email |
| P3 (cosmetic/non-urgent) | Engineering | Next business day | Email |

### External Communication

| Audience | When | Method | Template |
|----------|------|--------|----------|
| Active clinical staff | Service outage > 15 min | SMS via Twilio | "WellFit platform experiencing [issue]. ETA for resolution: [time]. Use offline mode for check-ins." |
| Patients | Service outage > 2 hours | In-app banner on recovery | "We experienced a brief service interruption. All data has been preserved." |
| Hospital partners | Any P0/P1 incident | Email from Clinical Director | Formal incident notification with timeline |
| Regulatory (HHS) | Confirmed PHI breach | Written notification | HIPAA Breach Notification form |

---

## Testing Schedule

| Test | Frequency | Last Performed | Next Due |
|------|-----------|----------------|----------|
| Backup restoration test | Quarterly | Not yet performed | Q2 2026 |
| PITR recovery test | Semi-annually | Not yet performed | Q2 2026 |
| Edge Function redeployment drill | Quarterly | Not yet performed | Q2 2026 |
| Full DR simulation | Annually | Not yet performed | Q3 2026 |
| Communication plan test | Semi-annually | Not yet performed | Q2 2026 |

---

## Responsibilities

| Role | DR Responsibility |
|------|-------------------|
| Security Officer | Owns DR plan; leads P0 incidents; ensures HIPAA compliance |
| Clinical Director | Clinical workflow continuity; staff communication; regulatory notification |
| Engineering | Technical recovery execution; infrastructure monitoring; testing |
| Supabase (vendor) | Database infrastructure; automated backups; platform availability |
| Vercel (vendor) | Frontend CDN; deployment infrastructure |

---

## Document Maintenance

- **Quarterly:** Review and update recovery procedures
- **On infrastructure change:** Update when new services are added
- **After any incident:** Conduct post-mortem and update procedures
- **After DR test:** Document results and update plan based on findings

---

*Document Owner: Envision Virtual Edge Group LLC*
*Contact: maria@wellfitcommunity.com*
