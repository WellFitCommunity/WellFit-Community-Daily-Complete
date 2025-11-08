# Disaster Recovery Plan - WellFit Community Platform

**Document Version:** 1.0
**Last Updated:** November 7, 2025
**Owner:** WellFit Engineering Team
**Review Cycle:** Quarterly

---

## Executive Summary

This Disaster Recovery (DR) Plan ensures business continuity for WellFit Community Platform and its enterprise clients (including Methodist Healthcare). It defines Recovery Time Objective (RTO) and Recovery Point Objective (RPO) commitments, backup procedures, and incident response protocols.

**Key Commitments:**
- **RTO (Recovery Time Objective):** < 4 hours
- **RPO (Recovery Point Objective):** < 24 hours
- **Uptime Target:** 99.9% (43.8 minutes downtime/month allowed)
- **Data Loss Tolerance:** Zero for PHI (HIPAA requirement)

---

## 1. Disaster Scenarios & Response

### Scenario A: Database Failure/Corruption

**Trigger:** Database unavailable, data corruption, accidental deletion

**Impact:** Complete service outage, patient data inaccessible

**Response Procedure:**
1. **Immediate (0-15 min):**
   - Activate incident response team
   - Post status update: "Investigating database connectivity issues"
   - Notify Methodist primary contact via phone

2. **Assessment (15-30 min):**
   - Check Supabase status page: https://status.supabase.com
   - Verify database connectivity from multiple locations
   - Review recent migrations/changes
   - Check database logs in Supabase Dashboard

3. **Recovery (30 min - 2 hours):**

   **Option 1: Supabase outage (their issue)**
   - Monitor Supabase status for ETA
   - Communicate updates to Methodist every 30 minutes
   - Wait for Supabase resolution
   - Verify data integrity after restoration

   **Option 2: Data corruption (our issue)**
   ```bash
   # Restore from Supabase point-in-time backup
   # Via Supabase Dashboard:
   # 1. Project Settings → Database → Backups
   # 2. Select backup timestamp (last 7 days available)
   # 3. Click "Restore"
   # 4. Confirm - takes 15-45 minutes

   # Alternative: CLI restore
   supabase db restore --project-ref xkybsjnvuohpqpbkikyn --backup-id [backup-id]
   ```

4. **Verification (2-3 hours):**
   - Test patient data queries across all tenants
   - Verify RLS policies intact
   - Run smoke tests: `k6 run load-tests/smoke-test.js`
   - Confirm with Methodist that their data is accessible

5. **Post-Incident (3-4 hours):**
   - Document root cause
   - Update Methodist with incident report
   - Schedule post-mortem meeting

**RTO:** 2-4 hours
**RPO:** < 24 hours (Supabase daily backups)

---

### Scenario B: Application Deployment Failure

**Trigger:** Bad deploy breaks production, app crashes, critical bug introduced

**Impact:** Partial/complete service outage, features broken

**Response Procedure:**
1. **Immediate (0-5 min):**
   - Identify broken deployment from monitoring alerts
   - Initiate rollback procedure

2. **Rollback (5-10 min):**
   ```bash
   # Option 1: Git revert (recommended)
   git log --oneline -5  # Find last good commit
   git revert HEAD --no-edit
   git push origin main
   # Vercel/deployment platform auto-deploys in 2-3 minutes

   # Option 2: Vercel dashboard rollback (faster)
   # 1. Go to Vercel Dashboard → Project → Deployments
   # 2. Find last successful deployment
   # 3. Click "..." → "Promote to Production"
   # Takes 30-60 seconds
   ```

3. **Verification (10-15 min):**
   - Test critical paths: login, patient enrollment, check-ins
   - Verify across all tenants (houston, miami, dallas, atlanta)
   - Check error rates in Sentry (should drop to baseline)

4. **Communication (15-20 min):**
   - Post status update: "Issue resolved, service restored"
   - Email Methodist: "Brief service disruption resolved, all systems operational"
   - Document what broke and why

**RTO:** 10-20 minutes
**RPO:** 0 (no data loss for deployment issues)

---

### Scenario C: Security Breach / Data Leak

**Trigger:** Unauthorized access detected, PHI exposure, RLS policy failure

**Impact:** HIPAA violation, legal liability, trust breach

**Response Procedure:**
1. **IMMEDIATE (0-5 min) - STOP THE BLEEDING:**
   ```bash
   # If breach is via API key compromise
   # 1. Revoke compromised API key in Supabase Dashboard
   # 2. Rotate all secrets immediately

   # If breach is via RLS policy failure
   # 1. Enable maintenance mode (optional)
   # 2. Review RLS policies for gaps
   ```

2. **Assessment (5-30 min):**
   - Identify scope: Which tenant(s) affected?
   - Identify data exposed: Patient names, PHI, credentials?
   - Identify attack vector: SQL injection, XSS, RLS failure?
   - Capture evidence: Database logs, API logs, network logs

3. **Containment (30 min - 2 hours):**
   - Fix vulnerability (patch code, fix RLS policy)
   - Force password reset for affected users
   - Deploy fix to production
   - Verify vulnerability is closed

4. **Notification (2-4 hours) - HIPAA REQUIRED:**
   - **If PHI exposed:** MUST notify affected individuals within 60 days (HIPAA)
   - **Immediate notification to:**
     - Methodist Healthcare IT Director (phone call)
     - Affected tenant administrators (email + phone)
     - Legal counsel (if > 500 individuals affected)

   - **Documentation required:**
     - Date/time of breach
     - Data types exposed
     - Number of individuals affected
     - Mitigation steps taken
     - Prevention steps for future

5. **Post-Incident (24-48 hours):**
   - File breach report with HHS (if required by HIPAA)
   - Conduct security audit
   - Implement additional safeguards
   - Update security policies

**RTO:** 2-4 hours (for service restoration)
**Compliance:** HIPAA breach notification within 60 days

---

### Scenario D: Infrastructure Provider Outage

**Trigger:** Supabase down, Vercel down, AWS outage

**Impact:** Complete service outage, no workaround available

**Response Procedure:**
1. **Immediate (0-10 min):**
   - Verify outage on provider status page
   - Post status update: "Experiencing issues due to [Provider] outage"
   - Notify Methodist: "Third-party infrastructure issue, monitoring for resolution"

2. **Monitoring (10 min - X hours):**
   - Monitor provider status page for updates
   - Communicate to Methodist every 30 minutes
   - Document start time, duration, impact

3. **No Action Required:**
   - This is provider's responsibility to resolve
   - We cannot restore service faster than provider

4. **Post-Resolution:**
   - Verify all services operational
   - Run smoke tests
   - Send incident summary to Methodist
   - Review SLA credits with provider

**RTO:** Dependent on provider (typically 1-4 hours)
**RPO:** 0 (provider handles data durability)

**Mitigation:** Consider multi-cloud strategy if Methodist requires > 99.9% uptime

---

## 2. Backup Strategy

### Database Backups (Supabase)

**Automated Backups:**
- **Frequency:** Daily at 2:00 AM UTC
- **Retention:** 7 days point-in-time recovery
- **Storage:** Supabase-managed (encrypted at rest)
- **Verification:** Monthly test restore (3rd Friday of each month)

**Backup Contents:**
- All PostgreSQL tables
- RLS policies
- Database functions
- Indexes
- User authentication data (via Supabase Auth)

**Manual Backup Procedure (Before Risky Changes):**
```bash
# Export schema
supabase db dump --project-ref xkybsjnvuohpqpbkikyn --schema public > backup-$(date +%Y%m%d).sql

# Or via pg_dump
PGPASSWORD="your-password" pg_dump -h db.xkybsjnvuohpqpbkikyn.supabase.co -U postgres -d postgres > backup.sql
```

### Application Code Backups

**Git Repository:**
- **Primary:** GitHub (https://github.com/your-org/WellFit-Community-Daily-Complete)
- **Backup:** Git history is backup (every commit preserved)
- **Release Tags:** Each production deploy tagged as `v1.0.0`, `v1.1.0`, etc.
- **Retention:** Infinite (Git history)

**Deployment History:**
- **Platform:** Vercel maintains last 100 deployments
- **Rollback:** 1-click rollback to any previous deployment
- **Retention:** 6 months for Pro tier

### Configuration Backups

**Environment Variables:**
- **Location:** Stored in Vercel dashboard + local .env (not in Git)
- **Backup:** Manually export monthly, store in secure password manager
- **Critical vars:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

**Supabase Configuration:**
- **RLS Policies:** Backed up via `supabase db dump`
- **Edge Functions:** Stored in Git at `supabase/functions/`
- **Migrations:** Stored in Git at `supabase/migrations/`

---

## 3. Testing & Validation

### Quarterly DR Testing Schedule

**Q1 (January):** Test database restore
```bash
# 1. Create test Supabase project
# 2. Restore production backup to test project
# 3. Verify data integrity
# 4. Document time taken and issues
```

**Q2 (April):** Test application rollback
```bash
# 1. Deploy intentional breaking change to staging
# 2. Practice rollback procedure
# 3. Measure time to rollback
# 4. Document lessons learned
```

**Q3 (July):** Test multi-tenant isolation under DR
```bash
# 1. Simulate tenant A data corruption
# 2. Restore tenant A data without affecting B, C, D
# 3. Verify other tenants unaffected
```

**Q4 (October):** Full DR simulation
```bash
# 1. Simulate complete database failure
# 2. Execute full recovery procedure
# 3. Involve all team members
# 4. Measure actual RTO/RPO achieved
```

### Monthly Backup Verification

**Every 3rd Friday:**
1. Log into Supabase Dashboard
2. Check latest backup timestamp (should be < 24 hours old)
3. Verify backup size is reasonable (not 0 bytes, not 10x larger than expected)
4. Document verification in ops log

**Alert if:**
- Backup older than 48 hours
- Backup size changed > 50% from previous month
- Backup status shows "failed"

---

## 4. Communication Plan

### Incident Notification Hierarchy

**Tier 1: Service Degradation (Response time > 2s)**
- **Notification:** Automated alert to on-call engineer
- **Customer notification:** Not required (internal monitoring)
- **Response time:** Investigate within 15 minutes

**Tier 2: Partial Outage (1 feature broken)**
- **Notification:** Alert to on-call + engineering lead
- **Customer notification:** Status page update + email to affected tenants
- **Response time:** Fix within 2 hours
- **Methodist notification:** Email within 30 minutes if affects them

**Tier 3: Complete Outage (App down)**
- **Notification:** Alert to entire team + executive leadership
- **Customer notification:** Status page + email + phone call to Methodist
- **Response time:** Immediate (activate DR plan)
- **Methodist notification:** Phone call within 15 minutes

### Methodist Healthcare Contacts

**Primary Technical Contact:**
- Name: [To be provided by Methodist]
- Role: IT Director / CTO
- Phone: [XXX-XXX-XXXX]
- Email: [email@methodist.org]
- Availability: 8 AM - 6 PM CST, Mon-Fri

**After-Hours Emergency Contact:**
- Name: [To be provided by Methodist]
- Phone: [XXX-XXX-XXXX]
- Use only for: Complete outage, security breach, data loss

**Notification Templates:**

**Template 1: Outage Notification**
```
Subject: WellFit Service Disruption - [Date/Time]

Dear [Name],

We are currently experiencing a service disruption affecting the WellFit platform.

Incident Details:
- Started: [Time]
- Impact: [Description]
- Affected Services: [List]
- Current Status: [Investigating/Restoring/Resolved]
- Estimated Resolution: [Time or "under investigation"]

We have activated our incident response team and are working to resolve this as quickly as possible.

Updates: We will provide updates every 30 minutes until resolution.

Contact: [Your Name] at [Phone] for immediate questions.

We apologize for the inconvenience.

WellFit Engineering Team
```

**Template 2: Resolution Notification**
```
Subject: WellFit Service Restored - [Date/Time]

Dear [Name],

The service disruption reported at [Start Time] has been resolved as of [End Time].

Incident Summary:
- Duration: [X hours/minutes]
- Root Cause: [Brief explanation]
- Resolution: [What was done]
- Data Impact: [None/Minimal/Details]

Next Steps:
- Post-mortem report will be shared within 48 hours
- Preventive measures: [Brief list]

We apologize for the disruption and appreciate your patience.

Please contact us at [Email/Phone] if you experience any residual issues.

WellFit Engineering Team
```

---

## 5. Roles & Responsibilities

### Incident Commander
- **Primary:** Lead Engineer (you)
- **Backup:** Senior Developer
- **Responsibilities:**
  - Declare incident severity
  - Activate DR plan
  - Coordinate response team
  - Communicate with Methodist
  - Make final decisions on recovery actions

### Technical Lead
- **Primary:** Database/Backend Engineer
- **Backup:** Full-stack Developer
- **Responsibilities:**
  - Execute technical recovery procedures
  - Restore database from backups
  - Verify data integrity
  - Fix application bugs

### Communications Lead
- **Primary:** Project Manager / Account Manager
- **Backup:** Incident Commander
- **Responsibilities:**
  - Send notifications to Methodist
  - Update status page
  - Coordinate post-incident report
  - Handle escalations

---

## 6. Post-Incident Procedures

### Within 24 Hours:
1. Document incident timeline
2. Identify root cause
3. Document actual RTO/RPO achieved
4. Send preliminary report to Methodist

### Within 48 Hours:
1. Conduct post-mortem meeting
2. Identify preventive measures
3. Create action items with owners
4. Send final incident report to Methodist

### Within 1 Week:
1. Implement quick preventive fixes
2. Update DR plan if needed
3. Schedule long-term improvements
4. Review DR insurance coverage (if applicable)

### Post-Mortem Template:
```markdown
# Incident Post-Mortem: [Title]

**Date:** [Date]
**Duration:** [Start - End]
**Severity:** [Tier 1/2/3]
**Impact:** [Description]

## Timeline
- [Time] - Issue detected
- [Time] - Team notified
- [Time] - Recovery started
- [Time] - Service restored
- [Time] - Verification complete

## Root Cause
[Technical explanation of what went wrong]

## Resolution
[What was done to fix it]

## Actual RTO/RPO
- RTO Target: 4 hours | Actual: [X hours]
- RPO Target: 24 hours | Actual: [X hours]

## What Went Well
- [Positive aspects]

## What Went Wrong
- [Issues during response]

## Action Items
1. [Action] - Owner: [Name] - Due: [Date]
2. [Action] - Owner: [Name] - Due: [Date]

## Preventive Measures
- Short-term: [List]
- Long-term: [List]
```

---

## 7. Service Level Commitments

### Current Commitments (Methodist Contract)

**Uptime:**
- **Target:** 99.9% monthly uptime
- **Allowed Downtime:** 43.8 minutes/month
- **Measurement:** Excludes scheduled maintenance (announced 48 hours in advance)

**Recovery Objectives:**
- **RTO:** 4 hours (from incident detection to service restoration)
- **RPO:** 24 hours (maximum data loss - daily backups)

**Maintenance Windows:**
- **Scheduled:** Sundays 2:00 AM - 4:00 AM CST
- **Notification:** 48 hours advance notice via email
- **Frequency:** Monthly (first Sunday of month)

### SLA Credits (if applicable)

**If uptime < 99.9%:**
- 99.0% - 99.9%: 10% service credit
- 95.0% - 99.0%: 25% service credit
- < 95.0%: 50% service credit

**Exclusions from SLA:**
- Force majeure events
- Third-party provider outages (Supabase, AWS)
- Customer-caused issues (bad data, misuse)
- Scheduled maintenance (with proper notice)

---

## 8. DR Plan Maintenance

### Review Schedule
- **Quarterly:** Review entire DR plan
- **After incidents:** Update based on lessons learned
- **Annually:** Full DR simulation test

### Version History
| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-11-07 | Initial plan creation | Engineering Team |

### Next Review Date
**Scheduled:** February 7, 2026

---

## Appendix A: Quick Reference Card

**Print this page and keep accessible**

### Emergency Contacts
- **On-Call Engineer:** [Phone]
- **Backup Engineer:** [Phone]
- **Methodist Primary:** [Phone]
- **Supabase Support:** support@supabase.io

### Common Commands

**Rollback deploy:**
```bash
git revert HEAD && git push
```

**Check Supabase status:**
```
https://status.supabase.com
```

**View recent logs:**
```
Supabase Dashboard → Logs → Database/API
```

**Test restore backup:**
```bash
supabase db restore --project-ref xkybsjnvuohpqpbkikyn --backup-id [id]
```

### Decision Tree
```
Is service down?
├─ Yes → Call team, activate Tier 3 response
└─ No → Is performance degraded?
    ├─ Yes → Investigate (Tier 1)
    └─ No → Monitor
```

---

**Document Owner:** WellFit Engineering Team
**Approval:** [To be signed by leadership before Methodist demo]
**Next Review:** February 7, 2026
