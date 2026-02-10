# Incident Response Plan (IRP)

> **Envision Virtual Edge Group LLC**
> **Regulation:** 45 CFR 164.308(a)(6) — Security Incident Procedures
> **Version:** 1.0 | **Effective:** February 10, 2026
> **Next Review:** August 10, 2026 (semi-annual)
> **Owner:** Security Officer (Maria) + CCO (Akima)

---

## 1. Purpose

This Incident Response Plan establishes procedures for detecting, reporting, containing, eradicating, and recovering from security incidents affecting Envision ATLUS I.H.I.S. and WellFit Community platforms. It satisfies HIPAA Security Rule requirements for security incident procedures and response.

---

## 2. Scope

This plan covers all systems that process, store, or transmit ePHI:
- Frontend (Vercel CDN)
- Backend (Supabase Edge Functions)
- Database (Supabase PostgreSQL 17)
- AI Services (Anthropic Claude API)
- Messaging (Twilio SMS, MailerSend email)
- MCP Servers (FHIR, HL7, clearinghouse, NPI, CMS)

---

## 3. Incident Classification

| Priority | Severity | Description | Examples | Response SLA |
|----------|----------|-------------|----------|-------------|
| **P0** | Critical | Active data breach, system-wide compromise | ePHI exfiltration, ransomware, admin account takeover | 15 minutes |
| **P1** | High | Authentication bypass, privilege escalation | RLS bypass, unauthorized PHI access, MFA compromise | 1 hour |
| **P2** | Medium | Information disclosure, service degradation | Error messages leaking data, partial outage, failed backups | 4 hours |
| **P3** | Low | Configuration issues, policy violations | Weak password detected, failed login spike, certificate warnings | 24 hours |

---

## 4. Incident Response Team

| Role | Primary | Backup | Contact |
|------|---------|--------|---------|
| **Security Officer** | Maria | Akima | maria@wellfitcommunity.com |
| **Clinical Director (CCO)** | Akima | Maria | akima@wellfitcommunity.com |
| **Privacy Officer** | Akima | Maria | akima@wellfitcommunity.com |
| **Communications Lead** | Maria | Akima | maria@wellfitcommunity.com |

### External Contacts

| Organization | Contact | When to Engage |
|-------------|---------|---------------|
| **HHS Office for Civil Rights** | ocrportal.hhs.gov | Breach affecting 500+ individuals (within 60 days) |
| **State Attorney General** | State-specific | Breach affecting 500+ individuals in any state |
| **FBI / IC3** | ic3.gov | Suspected criminal activity, ransomware |
| **Supabase Security** | support@supabase.io | Infrastructure compromise |
| **Anthropic Security** | security@anthropic.com | AI service abuse or compromise |
| **Twilio Security** | security@twilio.com | SMS service abuse |

---

## 5. Detection and Reporting

### 5.1 Detection Sources

| Source | Implementation | Monitoring |
|--------|---------------|------------|
| **Guardian Agent** | 13,700+ lines autonomous monitoring | Continuous (real-time) |
| **SOC 2 Monitoring** | soc2MonitoringService.ts — SecurityEvent tracking with auto-block | Continuous |
| **Audit Logs** | auditLogger.ts — 8 event categories (PHI, auth, clinical, billing, security) | Continuous |
| **PHI Access Logs** | phiAccessLogger.ts — dedicated PHI read/write audit | Continuous |
| **Login Security** | loginSecurityService.ts — failed attempt detection, account lockout | Continuous |
| **Dependency Scanning** | npm audit + CodeQL | Every push + weekly |
| **Security Headers** | Custom CSP/CORS validation | Every push |

### 5.2 Reporting Procedures

**Any workforce member** who suspects a security incident must:

1. **Immediately report** to the Security Officer via secure channel
2. **Do NOT** attempt to investigate independently
3. **Do NOT** discuss externally until authorized by Communications Lead
4. **Preserve evidence** — do not delete logs, emails, or system data
5. **Document** what was observed (date, time, description, systems affected)

---

## 6. Response Phases

### Phase 1: Identification (0-15 minutes for P0)

- [ ] Confirm the incident is real (not a false positive)
- [ ] Classify severity (P0-P3)
- [ ] Activate the Incident Response Team (per severity)
- [ ] Create incident record in `breach_incidents` table
- [ ] Begin incident log (timestamps for all actions)

### Phase 2: Containment (15 minutes - 4 hours)

**Immediate Containment:**
- [ ] Isolate affected systems (disable user accounts, rotate API keys)
- [ ] Preserve forensic evidence (database snapshots, log exports)
- [ ] Block attack vectors (IP bans, disable compromised functions)

**Short-Term Containment:**
- [ ] Apply temporary fixes to prevent further damage
- [ ] Enable enhanced monitoring on affected systems
- [ ] Verify tenant isolation is intact (RLS policies functioning)

### Phase 3: Eradication (4-48 hours)

- [ ] Identify root cause
- [ ] Remove malicious artifacts
- [ ] Patch vulnerabilities
- [ ] Reset all potentially compromised credentials
- [ ] Verify Guardian Agent scanning passes

### Phase 4: Recovery (48 hours - 7 days)

- [ ] Restore systems from verified clean backups if needed
- [ ] Gradually restore services (database first, then auth, then frontend)
- [ ] Monitor for recurrence with enhanced logging
- [ ] Verify RTO/RPO targets met (per `DISASTER_RECOVERY_PLAN.md`)

### Phase 5: Post-Incident (7-30 days)

- [ ] Conduct post-incident review with all team members
- [ ] Document lessons learned
- [ ] Update this IRP if gaps are found
- [ ] Implement preventive measures
- [ ] File required regulatory notifications

---

## 7. Breach Notification Triggers

When a security incident involves ePHI, evaluate for breach notification per `breachNotificationService.ts`:

1. **4-Factor Risk Assessment** (45 CFR 164.402(2)):
   - Nature and extent of PHI involved
   - Unauthorized person who accessed PHI
   - Whether PHI was actually acquired or viewed
   - Extent of risk mitigation

2. **Safe Harbor:** If 4-factor assessment determines "low probability" of compromise, notification is NOT required. Document the assessment.

3. **Notification Deadlines:**
   - **Individual notification:** Within 60 days of discovery
   - **HHS notification:** Within 60 days (if 500+ individuals, report immediately)
   - **Media notification:** If 500+ individuals in a single state/jurisdiction
   - **State Attorney General:** If 500+ individuals in any state

---

## 8. Tabletop Exercise Schedule

| Exercise | Frequency | Scenario | Next Scheduled |
|----------|-----------|----------|----------------|
| **Breach Notification Drill** | Semi-annual | Simulated ePHI breach requiring 60-day notification | August 2026 |
| **Ransomware Response** | Annual | Simulated system encryption and recovery | February 2027 |
| **Account Compromise** | Quarterly | Admin account takeover and containment | May 2026 |
| **Disaster Recovery** | Annual | Full DR failover test | Per `DISASTER_RECOVERY_PLAN.md` |

### Tabletop Exercise Procedure

1. Security Officer selects scenario and affected systems
2. Team walks through response phases without actual system changes
3. Document decisions, timing, and gaps identified
4. Update IRP with improvements
5. Record exercise completion in `training_completions` table

---

## 9. Evidence Preservation

During any P0 or P1 incident:

- **Database:** Create point-in-time snapshot before any remediation
- **Audit Logs:** Export all logs from `audit_logs`, `phi_access_logs`, `admin_audit_log` for affected time period
- **Edge Function Logs:** Export Supabase function invocation logs
- **Network Logs:** Request logs from Supabase/Vercel for affected period
- **Chain of Custody:** Document who accessed evidence, when, and why

---

## 10. Communication Plan

### Internal Communication

| Severity | Notify | Channel | Timing |
|----------|--------|---------|--------|
| P0 | All team members | Phone call + SMS | Immediately |
| P1 | Security Officer + CCO | SMS + email | Within 1 hour |
| P2 | Security Officer | Email | Within 4 hours |
| P3 | Security Officer | Next business day | Within 24 hours |

### External Communication

| Audience | When | Who Communicates | Template |
|----------|------|-----------------|----------|
| Affected patients | After breach confirmed | Privacy Officer | HIPAA individual notice |
| HHS OCR | After breach confirmed | Security Officer | HHS breach portal |
| Media | If 500+ affected | Communications Lead | Prepared statement |
| Business associates | If their data involved | Security Officer | BAA notification clause |

---

## 11. Plan Maintenance

- **Review frequency:** Semi-annual (February + August)
- **Update triggers:** After any P0/P1 incident, regulatory change, or tabletop exercise
- **Approval:** Security Officer + CCO sign-off required
- **Distribution:** All workforce members with PHI access
- **Training:** Annual IRP awareness training (tracked in `training_completions`)

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-10 | Maria + Claude Code | Initial formal IRP |
