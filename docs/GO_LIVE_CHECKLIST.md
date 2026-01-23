# WellFit Community Platform - Go-Live Checklist

**Version:** 1.0.0
**Last Updated:** January 2026
**Target Audience:** Implementation Team, Project Managers, IT Leadership

---

## Overview

This checklist ensures all critical items are verified before going live with the WellFit Community Platform. Complete all items with signatures and dates before cutover.

**Go-Live Date:** _______________
**Organization:** _______________
**Project Lead:** _______________

---

## Section 1: Infrastructure Readiness

### 1.1 Environment Configuration

| Item | Status | Verified By | Date |
|------|--------|-------------|------|
| Production Supabase project created | [ ] | | |
| Database migrations applied successfully | [ ] | | |
| All 329 RLS policies verified enabled | [ ] | | |
| Edge functions deployed | [ ] | | |
| Environment variables configured | [ ] | | |
| SSL certificates valid and not expiring within 90 days | [ ] | | |
| DNS records configured correctly | [ ] | | |
| CDN/caching configured | [ ] | | |

### 1.2 Performance Verification

| Item | Target | Actual | Status |
|------|--------|--------|--------|
| API response time (p95) | < 500ms | ms | [ ] Pass |
| Page load time | < 3s | s | [ ] Pass |
| Database query time (p95) | < 100ms | ms | [ ] Pass |
| Concurrent user capacity | 500+ | | [ ] Pass |

### 1.3 Backup and Recovery

| Item | Status | Verified By | Date |
|------|--------|-------------|------|
| Automated backups configured | [ ] | | |
| Backup retention policy (7 daily, 4 weekly, 12 monthly) | [ ] | | |
| Point-in-time recovery tested | [ ] | | |
| Backup restoration test completed | [ ] | | |
| DR runbook documented | [ ] | | |
| RTO target documented (4 hours) | [ ] | | |
| RPO target documented (15 minutes) | [ ] | | |

---

## Section 2: Security & Compliance

### 2.1 Security Configuration

| Item | Status | Verified By | Date |
|------|--------|-------------|------|
| MFA enforced for all admin accounts | [ ] | | |
| Password policy meets requirements (12+ chars) | [ ] | | |
| Session timeout configured (30 min inactivity) | [ ] | | |
| Account lockout after 5 failed attempts | [ ] | | |
| CORS configured with explicit origins (no wildcards) | [ ] | | |
| CSP headers configured | [ ] | | |
| API rate limiting enabled | [ ] | | |
| JWT signing keys rotated from defaults | [ ] | | |

### 2.2 HIPAA Compliance

| Item | Status | Verified By | Date |
|------|--------|-------------|------|
| BAA signed with Supabase | [ ] | | |
| BAA signed with all subprocessors | [ ] | | |
| Privacy policy published | [ ] | | |
| Notice of Privacy Practices available | [ ] | | |
| HIPAA Security Risk Assessment completed | [ ] | | |
| Workforce training completed (100%) | [ ] | | |
| Encryption at rest verified (AES-256) | [ ] | | |
| Encryption in transit verified (TLS 1.3) | [ ] | | |

### 2.3 Audit Logging

| Item | Status | Verified By | Date |
|------|--------|-------------|------|
| Audit log immutability verified | [ ] | | |
| PHI access logging enabled | [ ] | | |
| Authentication events logged | [ ] | | |
| Admin actions logged | [ ] | | |
| Data exports logged | [ ] | | |
| Audit log retention (7 years) configured | [ ] | | |
| Audit log export tested | [ ] | | |

### 2.4 Security Scan Results

| Scan Type | Date Run | Findings | Resolved |
|-----------|----------|----------|----------|
| /security-scan | | | [ ] |
| Dependency audit (npm audit) | | | [ ] |
| SAST scan | | | [ ] |
| Penetration test | | | [ ] |

---

## Section 3: Data Readiness

### 3.1 Data Migration

| Item | Status | Verified By | Date |
|------|--------|-------------|------|
| Patient data mapping completed | [ ] | | |
| Historical data migrated | [ ] | | |
| Data validation passed (100% accuracy) | [ ] | | |
| Duplicate patients identified and resolved | [ ] | | |
| Data cleansing completed | [ ] | | |
| PHI data encrypted in transit during migration | [ ] | | |

### 3.2 Master Data

| Item | Status | Verified By | Date |
|------|--------|-------------|------|
| Tenant record created | [ ] | | |
| Organization hierarchy configured | [ ] | | |
| Departments/locations configured | [ ] | | |
| User accounts created | [ ] | | |
| Roles assigned correctly | [ ] | | |
| Provider credentials verified | [ ] | | |
| Care teams configured | [ ] | | |

### 3.3 Reference Data

| Item | Status | Verified By | Date |
|------|--------|-------------|------|
| ICD-10 codes loaded | [ ] | | |
| CPT codes loaded | [ ] | | |
| LOINC codes loaded | [ ] | | |
| Drug database loaded | [ ] | | |
| Insurance payers configured | [ ] | | |
| Fee schedules configured | [ ] | | |

---

## Section 4: Integration Readiness

### 4.1 SMART on FHIR

| Item | Status | Verified By | Date |
|------|--------|-------------|------|
| Authorization endpoint responding | [ ] | | |
| Token endpoint responding | [ ] | | |
| SMART configuration published | [ ] | | |
| CapabilityStatement available | [ ] | | |
| Client apps registered | [ ] | | |
| Test authorization flow successful | [ ] | | |

### 4.2 HL7v2 Interfaces

| Interface | Direction | Status | Tested |
|-----------|-----------|--------|--------|
| ADT (Admissions) | Inbound | [ ] | [ ] |
| ORU (Lab Results) | Inbound | [ ] | [ ] |
| ORM (Orders) | Outbound | [ ] | [ ] |
| DFT (Charges) | Outbound | [ ] | [ ] |

### 4.3 Clearinghouse

| Item | Status | Verified By | Date |
|------|--------|-------------|------|
| Clearinghouse connection configured | [ ] | | |
| Provider enrolled with clearinghouse | [ ] | | |
| Test 837P claim submitted | [ ] | | |
| Test 837I claim submitted | [ ] | | |
| 270/271 eligibility test passed | [ ] | | |
| 276/277 status inquiry test passed | [ ] | | |
| 835 remittance processing tested | [ ] | | |

### 4.4 Alert Notifications

| Channel | Configured | Tested |
|---------|------------|--------|
| Slack webhook | [ ] | [ ] |
| PagerDuty integration | [ ] | [ ] |
| Email notifications | [ ] | [ ] |
| SMS notifications | [ ] | [ ] |

---

## Section 5: Application Readiness

### 5.1 Build Verification

| Item | Status | Verified By | Date |
|------|--------|-------------|------|
| `npm run typecheck` passes (0 errors) | [ ] | | |
| `npm run lint` passes (0 warnings) | [ ] | | |
| `npm test` passes (all 7,072+ tests) | [ ] | | |
| `npm run build` succeeds | [ ] | | |
| Production build deployed | [ ] | | |

### 5.2 Feature Configuration

| Feature | Enabled | Tested |
|---------|---------|--------|
| Patient check-in | [ ] | [ ] |
| Care plans | [ ] | [ ] |
| Progress notes | [ ] | [ ] |
| Lab orders | [ ] | [ ] |
| Imaging orders | [ ] | [ ] |
| Prescriptions | [ ] | [ ] |
| Billing/claims | [ ] | [ ] |
| Scheduling | [ ] | [ ] |
| Messaging | [ ] | [ ] |
| Telehealth | [ ] | [ ] |

### 5.3 Consent Configuration

| Consent Type | Template Ready | Workflow Tested |
|--------------|----------------|-----------------|
| Treatment | [ ] | [ ] |
| Research | [ ] | [ ] |
| Marketing | [ ] | [ ] |
| Data sharing | [ ] | [ ] |
| Telehealth | [ ] | [ ] |
| AI-assisted care | [ ] | [ ] |
| Third-party integration | [ ] | [ ] |
| Wearable data collection | [ ] | [ ] |

---

## Section 6: User Readiness

### 6.1 Training

| Role | Training Completed | Sign-off |
|------|-------------------|----------|
| Super admins | [ ] | |
| Administrators | [ ] | |
| Physicians | [ ] | |
| Nurses | [ ] | |
| Care coordinators | [ ] | |
| Front desk | [ ] | |
| Billing staff | [ ] | |

### 6.2 Support Readiness

| Item | Status | Verified By | Date |
|------|--------|-------------|------|
| Help desk trained | [ ] | | |
| Escalation matrix documented | [ ] | | |
| Support portal configured | [ ] | | |
| Knowledge base articles published | [ ] | | |
| Video tutorials available | [ ] | | |

### 6.3 Communication

| Item | Status | Verified By | Date |
|------|--------|-------------|------|
| Go-live announcement drafted | [ ] | | |
| User communication sent (T-7 days) | [ ] | | |
| User communication sent (T-1 day) | [ ] | | |
| Emergency contact list distributed | [ ] | | |

---

## Section 7: Operational Readiness

### 7.1 Monitoring

| Item | Status | Verified By | Date |
|------|--------|-------------|------|
| Application monitoring configured | [ ] | | |
| Error alerting configured | [ ] | | |
| Performance monitoring configured | [ ] | | |
| Security monitoring configured | [ ] | | |
| Dashboard created for go-live | [ ] | | |

### 7.2 Runbooks

| Runbook | Status | Location |
|---------|--------|----------|
| Incident response | [ ] | |
| Backup restoration | [ ] | |
| Rollback procedure | [ ] | |
| Scaling procedure | [ ] | |
| Security incident | [ ] | |

### 7.3 On-Call Schedule

| Role | Primary | Backup |
|------|---------|--------|
| Technical Lead | | |
| DBA | | |
| Security | | |
| Application Support | | |
| Executive Sponsor | | |

---

## Section 8: Demo Readiness (If Applicable)

### 8.1 Demo Validation

Run `/demo-ready` in Claude Code CLI:

| Check | Status |
|-------|--------|
| Database connectivity | [ ] |
| Authentication working | [ ] |
| Patient search functional | [ ] |
| Care plans loading | [ ] |
| Notes saving | [ ] |
| All integrations responding | [ ] |

### 8.2 Demo Data

| Item | Status |
|------|--------|
| Test patients created | [ ] |
| Sample care plans available | [ ] |
| Demo orders ready | [ ] |
| Demo reports configured | [ ] |

---

## Section 9: Final Approvals

### 9.1 Technical Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Technical Lead | | | |
| Security Officer | | | |
| DBA | | | |
| Infrastructure Lead | | | |

### 9.2 Business Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Project Sponsor | | | |
| Clinical Director | | | |
| Compliance Officer | | | |
| IT Director | | | |

### 9.3 Go/No-Go Decision

| Criteria | Met | Notes |
|----------|-----|-------|
| All critical items complete | [ ] | |
| No P1/P2 open issues | [ ] | |
| Rollback plan tested | [ ] | |
| Support team ready | [ ] | |
| Executive approval | [ ] | |

**FINAL DECISION:**

[ ] **GO** - Proceed with go-live as scheduled

[ ] **NO-GO** - Postpone go-live (document reasons below)

**Decision Made By:** _______________

**Date:** _______________

**Reasons for No-Go (if applicable):**

_______________________________________________

_______________________________________________

---

## Section 10: Cutover Timeline

### T-24 Hours

| Time | Activity | Owner | Status |
|------|----------|-------|--------|
| T-24h | Final data migration batch | | [ ] |
| T-24h | Notify users of upcoming go-live | | [ ] |
| T-24h | Verify backup completion | | [ ] |

### T-12 Hours

| Time | Activity | Owner | Status |
|------|----------|-------|--------|
| T-12h | Freeze changes in source system | | [ ] |
| T-12h | Begin final data sync | | [ ] |
| T-12h | Verify integration endpoints | | [ ] |

### T-4 Hours

| Time | Activity | Owner | Status |
|------|----------|-------|--------|
| T-4h | Complete data validation | | [ ] |
| T-4h | Final security scan | | [ ] |
| T-4h | Team briefing call | | [ ] |

### T-1 Hour

| Time | Activity | Owner | Status |
|------|----------|-------|--------|
| T-1h | Prepare DNS changes | | [ ] |
| T-1h | Notify on-call team | | [ ] |
| T-1h | Final go/no-go confirmation | | [ ] |

### T-0 (Go-Live)

| Time | Activity | Owner | Status |
|------|----------|-------|--------|
| T-0 | Execute DNS cutover | | [ ] |
| T-0 | Monitor for errors | | [ ] |
| T-0 | Confirm access working | | [ ] |

### T+1 Hour

| Time | Activity | Owner | Status |
|------|----------|-------|--------|
| T+1h | Smoke test all critical paths | | [ ] |
| T+1h | Verify first user logins | | [ ] |
| T+1h | Check integration message flow | | [ ] |

### T+4 Hours

| Time | Activity | Owner | Status |
|------|----------|-------|--------|
| T+4h | First status report | | [ ] |
| T+4h | Review error logs | | [ ] |
| T+4h | Confirm rollback not needed | | [ ] |

### T+24 Hours

| Time | Activity | Owner | Status |
|------|----------|-------|--------|
| T+24h | Comprehensive status report | | [ ] |
| T+24h | User feedback collection | | [ ] |
| T+24h | Lessons learned documentation | | [ ] |

---

## Section 11: Post-Go-Live Monitoring

### First 72 Hours

Monitor these metrics every hour:

| Metric | Target | Hour 1 | Hour 4 | Hour 24 | Hour 72 |
|--------|--------|--------|--------|---------|---------|
| Error rate | < 0.1% | | | | |
| Response time (p95) | < 500ms | | | | |
| Failed logins | < 5% | | | | |
| Support tickets | < 10 | | | | |

### Rollback Criteria

Initiate rollback if ANY of these occur:

| Criteria | Threshold | Observed |
|----------|-----------|----------|
| Error rate | > 5% for 15 min | |
| System unavailable | > 5 min | |
| PHI exposure confirmed | Any | |
| Data integrity issue | Any | |
| Executive decision | Any | |

---

## Appendix A: Emergency Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| WellFit Support | | | support@wellfitcommunity.com |
| WellFit Security | | | security@wellfitcommunity.com |
| Supabase Support | | | (via dashboard) |
| [Clearinghouse] | | | |
| [EHR Vendor] | | | |

---

## Appendix B: Rollback Procedure Summary

1. **Decision**: Project sponsor authorizes rollback
2. **Communication**: Notify all stakeholders
3. **DNS**: Revert DNS to previous infrastructure
4. **Database**: Restore from pre-cutover backup if needed
5. **Verification**: Confirm previous system operational
6. **Documentation**: Record all actions and timeline
7. **Post-mortem**: Schedule review within 48 hours

---

## Appendix C: Issue Log

| # | Date/Time | Issue | Severity | Owner | Resolution | Status |
|---|-----------|-------|----------|-------|------------|--------|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |
| 4 | | | | | | |
| 5 | | | | | | |

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | Jan 2026 | WellFit Team | Initial release |
