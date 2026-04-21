# Business Continuity & Disaster Recovery Policy

**Document ID:** BCP-004
**Owner:** AI Systems Director (Maria)
**Approver:** Chief Compliance and Accountability Officer (Akima)
**Effective Date:** `<YYYY-MM-DD>`
**Last Reviewed:** `<YYYY-MM-DD>`
**Review Cadence:** Annual; after every tabletop exercise
**Classification:** Internal — Confidential

---

## 1. Purpose

This policy establishes how the Company maintains critical business operations and recovers from disruptive events — including hardware failure, vendor outage, cyber incident, natural disaster, or loss of key personnel — so that patient care coordination and community wellness services are not compromised beyond defined tolerances.

---

## 2. Scope

Covers:
- Production database (Supabase PostgreSQL 17)
- Edge functions and application runtime
- Source code and deployment pipelines (GitHub, Vercel)
- Third-party dependencies (Anthropic, MailerSend, Twilio)
- Key personnel contingencies (Maria, Akima)

---

## 3. Definitions

| Term | Definition |
|------|------------|
| **RTO** (Recovery Time Objective) | Maximum tolerable time between disruption and restoration |
| **RPO** (Recovery Point Objective) | Maximum tolerable data loss measured in time |
| **MTPD** (Maximum Tolerable Period of Disruption) | Absolute ceiling beyond which the business cannot survive |
| **BCP** | Business Continuity Plan — how we keep operating |
| **DR** | Disaster Recovery — how we restore after a disruption |

---

## 4. Policy Statements

### 4.1 Criticality Tiers

System components are classified by tier:

| Tier | Component | RTO | RPO | MTPD |
|------|-----------|-----|-----|------|
| **Tier 1 — Critical** | Database, auth, core edge functions, patient chart access | 4 hours | 1 hour | 24 hours |
| **Tier 2 — High** | AI services, notifications (SMS/email), community features | 24 hours | 24 hours | 72 hours |
| **Tier 3 — Standard** | Reporting, analytics, admin dashboards | 72 hours | 24 hours | 1 week |
| **Tier 4 — Low** | Gamification, trivia games, historical exports | 1 week | 1 week | 1 month |

### 4.2 Backup Strategy

4.2.1 **Database backups:**
- Supabase performs automated daily backups with 7-day retention on Pro plan
- Point-in-time recovery available for the last 7 days
- Nightly Excel backup exports to offsite storage (reference: edge function `nightly-excel-backup`)
- Backup verification runs via `daily-backup-verification` edge function

4.2.2 **Source code backups:**
- Primary: GitHub (managed, with fork+clone redundancy)
- Git history is itself a form of backup
- No single point of developer machine dependency

4.2.3 **Configuration/secrets backups:**
- Supabase secrets documented (names, not values) in `docs/deployment/`
- Secret values stored in Supabase Vault + offline password manager (1Password / Bitwarden)
- Key rotation procedure documented in Access Control Policy

### 4.3 Redundancy

4.3.1 **Infrastructure:**
- Supabase provides managed database replication and redundancy
- Edge functions are stateless and auto-scale
- Vercel/CDN provides geographic distribution (when deployed)

4.3.2 **Vendor alternatives:**
- If Anthropic Claude is unavailable: degrade AI features gracefully (feature flags allow disabling)
- If MailerSend is unavailable: fall back to Twilio SMS for critical notifications
- If Twilio is unavailable: email-only notifications
- If Supabase is unavailable: **no acceptable alternative currently** — this is a single-vendor dependency

### 4.4 Single Points of Failure

4.4.1 The Company acknowledges the following known single points of failure:

| SPOF | Impact | Mitigation Plan |
|------|--------|-----------------|
| Supabase vendor lock | Cannot rebuild elsewhere quickly | Schema + data export retained monthly; could rebuild on AWS RDS + custom auth in ~2-4 weeks |
| Anthropic Claude API | AI features degraded | Feature flags enable graceful degradation; OpenAI fallback removed by design (Claude-only) |
| Maria (sole developer) | Cannot ship critical fixes | Akima has full GitHub access; AI agents (Claude Code) can execute tracked work semi-autonomously |
| Akima (sole clinical reviewer) | Clinical decisions cannot be validated | Maria can approve routine items; clinical AI outputs are advisory only |

### 4.5 Recovery Procedures

4.5.1 **Database failure:**
1. Confirm failure via Supabase dashboard
2. If data corruption: restore from point-in-time backup to a new project
3. If Supabase outage: wait (no alternative); communicate outage to users
4. Verify data integrity using checksums in `audit_logs`
5. Restore edge function configurations
6. Run smoke tests before re-enabling traffic

4.5.2 **Key personnel unavailable:**
- Akima has full GitHub + Supabase access in case of Maria's unavailability
- A designated trusted third party holds sealed credentials (e.g., spouse, attorney) for catastrophic continuity
- AI agents can continue tracked work under Tier 1/2 authority (reference: `/.claude/rules/ai-repair-authority.md`)

4.5.3 **Data breach (see Incident Response Policy IRP-003).**

### 4.6 Testing and Exercises

4.6.1 **Annual tabletop exercise:** Simulate a disruption scenario and walk through the response. Document findings in `docs/compliance/dr-exercises/YYYY-Q#-tabletop.md`.

4.6.2 **Quarterly backup restoration test:** Restore the most recent backup to a test project. Verify:
- Data integrity (row counts, sample queries)
- Schema match
- RLS policies present
- Edge functions deploy cleanly

4.6.3 **Annual full DR rehearsal:** Complete rebuild from backups in an isolated environment. Measure actual RTO/RPO.

### 4.7 Communication During Disruption

4.7.1 If production is disrupted:
- Post status update to company status page (if available) or tenant contacts
- Notify affected tenants via email within 2 hours
- Provide updates every 2 hours until resolution
- Issue final resolution summary within 24 hours of recovery

### 4.8 Vendor Continuity

4.8.1 The Company shall annually review the continuity posture of each critical vendor:
- Supabase: SOC 2 Type II report on file
- Anthropic: SOC 2 status verified
- MailerSend: SOC 2 / SOC 3 status verified
- Twilio: SOC 2 Type II report on file

4.8.2 Vendor SOC 2 reports are stored in `docs/compliance/vendors/<vendor-name>/`.

---

## 5. Roles and Responsibilities

| Role | BCP/DR Responsibility |
|------|----------------------|
| AI Systems Director | Owns plan; leads recovery; approves customer communication |
| Chief Compliance Officer | Clinical impact assessment; HIPAA breach determination; external stakeholder communication |
| All Personnel | Maintain familiarity with recovery procedures; participate in tabletop exercises |
| Designated Third Party | Hold sealed credentials for catastrophic continuity (name and instructions documented privately) |

---

## 6. Evidence and Controls

| Control | Location | TSC Mapping |
|---------|----------|-------------|
| Backup automation | `nightly-excel-backup`, `daily-backup-verification` edge functions | A1.2 |
| Health monitoring | `health-monitor`, `system-status` edge functions | A1.1 |
| Graceful AI degradation | Feature flags in `tenant_module_config` | A1.3 |
| Recovery procedures | This policy §4.5 | A1.3 |
| Tabletop exercise records | `docs/compliance/dr-exercises/` | A1.3 |

---

## 7. Related Documents

- Information Security Policy (ISP-001)
- Incident Response Policy (IRP-003)
- Vendor Risk Management Policy (VRM-007)

---

## 8. Approval and Signatures

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
