# Information Security Policy

**Document ID:** ISP-001
**Owner:** AI Systems Director (Maria)
**Approver:** Chief Compliance and Accountability Officer (Akima)
**Effective Date:** `<YYYY-MM-DD to be filled at signing>`
**Last Reviewed:** `<YYYY-MM-DD>`
**Review Cadence:** Annual (or upon significant change)
**Classification:** Internal — Confidential

---

## 1. Purpose

This Information Security Policy establishes Envision Virtual Edge Group LLC's (the "Company") commitment to protecting the confidentiality, integrity, and availability of information assets — including Protected Health Information (PHI) — and defines the governance framework under which all other security policies operate.

This is the **umbrella policy**. All subordinate policies (Access Control, Incident Response, Change Management, etc.) derive their authority from this document.

---

## 2. Scope

This policy applies to:
- All Company personnel (currently: Maria LeBlanc, Akima Nelson)
- All systems owned or operated by the Company, including but not limited to:
  - Production and non-production environments
  - Source code repositories
  - Supabase-hosted databases and edge functions
  - Third-party AI services (Anthropic Claude)
  - Communication services (MailerSend, Twilio)
- All information created, received, stored, or transmitted by the Company, including:
  - Patient PHI
  - Employee and customer data
  - Business records
  - Source code and intellectual property

---

## 3. Policy Statements

### 3.1 Governance

3.1.1 The Company maintains a codified governance system, principally expressed in `/CLAUDE.md` and `/.claude/rules/*`, which establishes binding rules for software development, security, and operational practices.

3.1.2 All subordinate security policies (Access Control, Incident Response, Business Continuity, Data Classification, Change Management, Vendor Risk Management, Acceptable Use) derive authority from this policy and are reviewed annually.

3.1.3 Security decisions follow a tiered authority model defined in `/.claude/rules/ai-repair-authority.md`:
- **Tier 1:** Autonomous (bug fixes, type safety, documentation)
- **Tier 2:** Notify (test changes, new utilities, dependency updates)
- **Tier 3:** Ask First (schema changes, RLS policies, CORS config, auth flows)
- **Tier 4:** Forbidden (disabling RLS, CORS wildcards, PHI in browser, force-pushing main)

### 3.2 Confidentiality

3.2.1 Protected Health Information (PHI) shall never be exposed to the browser. Patient IDs/tokens are used for client-side operations; PHI remains server-side only.

3.2.2 Field-level encryption is applied to PHI fields using pgcrypto (see migrations `20251112150000_phi_encryption_functions_only.sql` and `20260103000004_encrypt_critical_phi_fields.sql`).

3.2.3 Multi-tenant data isolation is enforced via PostgreSQL Row Level Security (RLS) on all tables. Every new table requires RLS enabled with at least one policy (reference: `/.claude/rules/supabase.md` §2).

### 3.3 Integrity

3.3.1 All mutations to sensitive data are audit-logged via `audit_logs`, `phi_access_logs`, `admin_audit_log`, and `security_events` tables. Audit log RLS enforces `actor_user_id = auth.uid()` to prevent spoofing.

3.3.2 The TypeScript `any` type is prohibited in production code. Type safety is enforced via `scripts/typecheck-changed.sh` before every commit.

3.3.3 Code changes require passing the mandatory verification checkpoint before commit: scoped typecheck, lint, and test suite (reference: CLAUDE.md §"Mandatory Verification Checkpoint").

### 3.4 Availability

3.4.1 Production databases are managed by Supabase with built-in redundancy. Nightly backups are retained for 7 days.

3.4.2 Availability controls and recovery targets are defined in the Business Continuity & Disaster Recovery Policy (BCP-004).

### 3.5 Continuous Monitoring

3.5.1 The Guardian Agent (`supabase/functions/guardian-agent/`) runs scheduled security checks and creates alerts in `security_alerts` for critical/high-severity events.

3.5.2 GitHub Actions security scans (`.github/workflows/security-scan.yml`) run on every push and weekly, gating merges on: CodeQL, npm audit, hardcoded secret detection, insecure protocol scan, and CORS wildcard scan.

3.5.3 Adversarial audits using a secondary AI model are performed before major releases, pilots, or demos. Audit findings are recorded in `docs/security-audits/`.

---

## 4. Roles and Responsibilities

| Role | Responsibilities |
|------|------------------|
| **AI Systems Director** (Maria) | Maintains CLAUDE.md and governance rules; approves Tier 3 security decisions; owns this policy |
| **Chief Compliance and Accountability Officer** (Akima) | Reviews clinical compliance; approves clinical data access decisions; approves this policy |
| **All Personnel** | Comply with all policies; report suspected incidents within 24 hours; complete annual security training |
| **AI Coding Agents (Claude Code, ChatGPT, sub-agents)** | Bound by CLAUDE.md rules; cannot elevate themselves across authority tiers; decisions verified by human before merge |

---

## 5. Evidence and Controls

The following existing controls implement this policy. Auditors should inspect these as evidence:

| Control | Location | TSC Mapping |
|---------|----------|-------------|
| Governance rule system | `/CLAUDE.md`, `/.claude/rules/*` | CC1.1, CC1.4, CC2.2 |
| Automated rule enforcement | `/.claude/settings.json` (PreToolUse hooks) | CC2.2, CC5.2 |
| RLS on all tables | `supabase/migrations/*_security_*.sql` | CC6.1, CC6.3 |
| PHI encryption | `supabase/migrations/*_phi_encryption*.sql` | CC6.7, C1.1 |
| Audit log infrastructure | `audit_logs`, `phi_access_logs`, `security_events` tables | CC7.2, CC7.3 |
| Security scan pipeline | `.github/workflows/security-scan.yml` | CC7.1 |
| Guardian monitoring | `supabase/functions/guardian-agent/` | CC7.2, CC7.4 |
| Mandatory verification checkpoint | CLAUDE.md §"Mandatory Verification Checkpoint" | CC8.1 |
| Adversarial audit cadence | `docs/security-audits/ADVERSARIAL_AUDIT_*.md` | CC4.1, CC7.5 |

---

## 6. Policy Exceptions

Exceptions to this policy require written approval from both the AI Systems Director and the Chief Compliance and Accountability Officer. Approved exceptions are documented in `docs/compliance/exceptions/` with expiration dates and are re-evaluated at each annual review.

---

## 7. Enforcement and Violations

Violations of this policy may result in:
- Immediate correction of the violating control
- Removal of access privileges
- Engagement termination (for personnel)
- Legal action (for third parties)

AI agents (Claude Code, sub-agents) that violate Tier 4 forbidden actions have their output rejected and redone.

---

## 8. Review and Maintenance

This policy shall be reviewed at minimum annually by the AI Systems Director and Chief Compliance and Accountability Officer. Interim reviews are triggered by:
- Significant changes to the codebase (e.g., new major systems, acquisitions)
- Material security incidents
- Regulatory changes (HIPAA, ONC certification criteria, SOC 2 TSP updates)
- Adversarial audit findings exceeding "Low" severity

---

## 9. Related Documents

- Access Control Policy (`02_access_control_policy.md`)
- Incident Response Policy (`03_incident_response_policy.md`)
- Business Continuity & Disaster Recovery Policy (`04_business_continuity_disaster_recovery_policy.md`)
- Data Classification & Retention Policy (`05_data_classification_retention_policy.md`)
- Change Management Policy (`06_change_management_policy.md`)
- Vendor Risk Management Policy (`07_vendor_risk_management_policy.md`)
- Acceptable Use Policy (`08_acceptable_use_policy.md`)

---

## 10. Approval and Signatures

**AI Systems Director**

Name: Maria LeBlanc
Signature: _______________________________
Date: _____________________________________

**Chief Compliance and Accountability Officer**

Name: Akima Nelson, MDiv, BSN, RN, CCM
Signature: _______________________________
Date: _____________________________________

---

## Revision History

| Version | Date | Author | Change Summary |
|---------|------|--------|----------------|
| 1.0 | `<YYYY-MM-DD>` | Maria LeBlanc | Initial policy |
