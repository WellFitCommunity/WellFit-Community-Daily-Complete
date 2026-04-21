# Incident Response Policy

**Document ID:** IRP-003
**Owner:** AI Systems Director (Maria)
**Approver:** Chief Compliance and Accountability Officer (Akima)
**Effective Date:** `<YYYY-MM-DD>`
**Last Reviewed:** `<YYYY-MM-DD>`
**Review Cadence:** Annual; after every Severity 1 incident
**Classification:** Internal — Confidential

---

## 1. Purpose

This policy establishes how the Company detects, responds to, contains, eradicates, and recovers from security incidents — including suspected or confirmed unauthorized access, data exposure, service disruption, and HIPAA breach events.

---

## 2. Scope

Covers all security events affecting:
- Production systems (Supabase, edge functions, GitHub)
- Patient PHI or customer data
- Third-party integrations (Anthropic, MailerSend, Twilio)
- Source code and build infrastructure

---

## 3. Incident Classification

### 3.1 Severity Levels

| Severity | Description | Response Target | Example |
|----------|-------------|-----------------|---------|
| **SEV-1 (Critical)** | Active PHI breach, production outage, confirmed unauthorized access | Response within 1 hour; resolution target 4 hours | Tenant isolation bypass, ransomware, credential compromise |
| **SEV-2 (High)** | Potential PHI exposure, major feature down, partial outage | Response within 4 hours; resolution target 24 hours | RLS misconfiguration on sensitive table, suspected compromised API key |
| **SEV-3 (Medium)** | Security weakness found, non-PHI minor data exposure | Response within 24 hours; resolution target 1 week | Missing auth on low-risk endpoint, outdated dependency |
| **SEV-4 (Low)** | Informational, best-practice deviation | Response within 5 business days | Linting regression, minor documentation gap |

### 3.2 Incident Categories

- **Confidentiality** (data exposure, PHI breach)
- **Integrity** (data tampering, unauthorized modification)
- **Availability** (outage, DoS, degraded service)
- **Access** (credential compromise, unauthorized access attempt)
- **Compliance** (HIPAA breach, audit control failure)

---

## 4. Incident Response Lifecycle

### 4.1 Detection

Incidents are detected through:
- **Automated monitoring:** Guardian Agent, security-alert-processor, GitHub Actions security scan
- **Audit log review:** Unusual patterns in `security_events`, `phi_access_logs`, `admin_audit_log`
- **User reports:** Via support channels, customer notifications
- **Adversarial audits:** Cross-AI audits (see `docs/security-audits/ADVERSARIAL_AUDIT_*.md`)
- **Third-party disclosure:** Vendor security notifications, CVE disclosures

### 4.2 Reporting

4.2.1 All suspected incidents must be reported within the following timeframes:
- SEV-1: Immediately (via phone/SMS to AI Systems Director)
- SEV-2: Within 2 hours
- SEV-3/SEV-4: Within 24 hours

4.2.2 Reports go to: **maria@wellfitcommunity.com** and **akima@wellfitcommunity.com**

4.2.3 Every reported incident gets an entry in `docs/compliance/incidents/YYYY-MM-DD-<short-slug>.md` with:
- Reporter, detection method, time of detection
- Initial severity assessment
- Systems/data potentially affected
- Timeline updates as investigation progresses

### 4.3 Containment

4.3.1 **Immediate containment actions** (first hour, SEV-1/SEV-2):
- Revoke compromised credentials
- Disable affected accounts
- Isolate affected systems (e.g., disable edge function, revoke API key)
- Capture evidence (logs, database snapshots) before cleanup

4.3.2 **Short-term containment:**
- Apply temporary patch or WAF rule
- Redirect traffic if necessary
- Increase monitoring scrutiny

### 4.4 Eradication

4.4.1 Root cause analysis performed using the adversarial audit approach:
- Fix the immediate vulnerability
- Grep the codebase for sister occurrences (reference: `/.claude/rules/adversarial-audit-lessons.md` §1)
- Update rules/hooks to prevent regression
- Document in `docs/security-audits/` if significant

4.4.2 Verify the fix:
- Apply the verification checkpoint (typecheck + lint + tests)
- Run targeted regression tests
- Run the relevant security scan gate

### 4.5 Recovery

4.5.1 Restore services to normal operation:
- Re-enable disabled accounts/functions
- Reload monitoring alerts
- Notify affected users (if required by HIPAA Breach Notification Rule)

4.5.2 Monitor for recurrence for minimum 48 hours post-resolution.

### 4.6 Post-Incident Review

4.6.1 Within 7 days of SEV-1/SEV-2 resolution, conduct a post-incident review (PIR):
- Timeline reconstruction
- What worked, what didn't
- Root cause summary
- Preventive actions and owners
- Policy or rule updates required

4.6.2 PIR document stored in `docs/compliance/incidents/<incident-id>/post-incident-review.md`.

4.6.3 Preventive actions become items in the relevant tracker with assigned owners and due dates.

---

## 5. HIPAA Breach Notification

5.1 If an incident involves unauthorized access to, use, or disclosure of PHI:
- Determine whether it constitutes a "breach" under 45 CFR § 164.402
- If so, the Chief Compliance and Accountability Officer initiates breach notification within 60 days:
  - Notify affected individuals
  - Notify HHS (Office for Civil Rights) — annually if <500 affected, immediately if 500+
  - Notify media if 500+ individuals in a single state/jurisdiction affected
- Document in `docs/compliance/incidents/<incident-id>/hipaa-breach-notification.md`

5.2 Business Associate Agreements (BAAs) with Supabase, Anthropic (if applicable), MailerSend, Twilio may require additional vendor notifications within defined timeframes — consult each BAA.

---

## 6. Roles and Responsibilities

| Role | Incident Response Responsibility |
|------|----------------------------------|
| **Incident Commander** (default: AI Systems Director) | Coordinates response; makes containment decisions; authorizes communications |
| **Technical Lead** (default: AI Systems Director) | Performs root cause analysis, eradication, recovery |
| **Compliance Lead** (Chief Compliance and Accountability Officer) | HIPAA breach determination; clinical impact assessment; external notifications |
| **All Personnel** | Report suspected incidents immediately; cooperate with investigation; do not discuss incident externally without authorization |

---

## 7. Evidence and Controls

| Control | Location | TSC Mapping |
|---------|----------|-------------|
| Security event logging | `security_events`, `audit_logs`, `phi_access_logs` tables | CC7.2 |
| Guardian monitoring | `supabase/functions/guardian-agent/`, `guardian_cron_log` | CC7.3 |
| Alert dispatch | `supabase/functions/security-alert-processor/` | CC7.4 |
| Adversarial audit reports | `docs/security-audits/` | CC7.5 |
| Incident documentation | `docs/compliance/incidents/` | CC7.4 |

---

## 8. Testing

8.1 The incident response process shall be tested annually via tabletop exercise. Test scenarios include:
- Simulated PHI breach
- Compromised admin credential
- Database ransomware
- Supabase vendor outage

8.2 Tabletop outcomes documented in `docs/compliance/ir-exercises/YYYY-tabletop.md`.

---

## 9. Communication

9.1 **Internal:** Real-time via SMS/phone for SEV-1; email thread for SEV-2+.

9.2 **External customer communication:** Drafted and approved by the AI Systems Director; reviewed by Chief Compliance Officer before release.

9.3 **Public statements:** Only authorized by the AI Systems Director. Personnel do not speak to media or post on social media about active incidents.

---

## 10. Related Documents

- Information Security Policy (ISP-001)
- Access Control Policy (ACP-002)
- Business Continuity & Disaster Recovery Policy (BCP-004)
- `/.claude/rules/adversarial-audit-lessons.md`

---

## 11. Approval and Signatures

**AI Systems Director**
Name: Maria LeBlanc
Signature: _______________________________
Date: _____________________________________

**Chief Compliance and Accountability Officer**
Name: Akima Nelson
Signature: _______________________________
Date: _____________________________________

---

## Revision History

| Version | Date | Author | Change Summary |
|---------|------|--------|----------------|
| 1.0 | `<YYYY-MM-DD>` | Maria LeBlanc | Initial policy |
