# Acceptable Use Policy

**Document ID:** AUP-008
**Owner:** AI Systems Director (Maria)
**Approver:** Chief Compliance and Accountability Officer (Akima)
**Effective Date:** `<YYYY-MM-DD>`
**Last Reviewed:** `<YYYY-MM-DD>`
**Review Cadence:** Annual
**Classification:** Internal

---

## 1. Purpose

This policy defines what is and is not acceptable use of Company information systems, credentials, and data — by personnel, contractors, and AI coding agents.

---

## 2. Scope

Applies to:
- All Company personnel (Maria, Akima, future hires or contractors)
- AI agents performing work on behalf of the Company (Claude Code, ChatGPT, sub-agents)
- Anyone granted access to Company systems or data

---

## 3. Acceptable Use

### 3.1 Personnel and Contractors

Personnel and contractors **shall:**

3.1.1 Use Company systems only for Company business and authorized purposes.

3.1.2 Protect credentials: use strong unique passwords, enable MFA, never share credentials, rotate suspected-exposed credentials within 1 hour.

3.1.3 Classify data before handling it; apply controls appropriate to its classification (reference: DCR-005).

3.1.4 Use Company-approved tools for communication and storage. Do not use personal email, personal cloud storage, or unapproved SaaS for Company data.

3.1.5 Complete annual security awareness training.

3.1.6 Report suspected incidents within 24 hours (immediately for SEV-1).

3.1.7 Keep developer machines:
- Running supported OS with security updates applied within 14 days
- Encrypted at rest (FileVault / BitLocker)
- Screen-locked when unattended
- Free of unauthorized software that could exfiltrate data

3.1.8 When engaging AI coding tools (Claude Code, ChatGPT, Copilot), ensure:
- The tool is configured to follow CLAUDE.md governance
- No PHI is pasted into AI prompts beyond what the licensed service (Claude via Supabase) is contractually permitted to process
- Outputs are verified before committing

### 3.2 AI Agents

AI coding agents (including Claude Code, sub-agents, and scheduled automation) **shall:**

3.2.1 Follow all rules in `/CLAUDE.md` and `/.claude/rules/*`.

3.2.2 Respect the tiered authority model in `/.claude/rules/ai-repair-authority.md`:
- Tier 1: Autonomous
- Tier 2: Notify
- Tier 3: Ask First
- Tier 4: Forbidden

3.2.3 Perform the verification checkpoint (typecheck + lint + tests) before declaring work complete.

3.2.4 Stop and ask when uncertain instead of guessing.

3.2.5 Not introduce Tier 4 forbidden patterns even if instructed to — surface the conflict to the human operator.

---

## 4. Prohibited Use

### 4.1 Personnel, Contractors, and AI Agents shall NOT:

4.1.1 Access data or systems beyond what is needed for their role (principle of least privilege).

4.1.2 Share credentials or session tokens with any other party, including other personnel.

4.1.3 Attempt to bypass security controls (RLS, authentication, rate limits, hooks, verification gates).

4.1.4 Disable, skip, or weaken security scans, hooks, pre-commit gates, or governance rules.

4.1.5 Expose PHI to any system or environment that is not contractually authorized to receive it.

4.1.6 Use Company data, credentials, or systems to:
- Conduct personal business
- Harass, threaten, or harm any individual
- Violate any applicable law (HIPAA, GDPR, state privacy law)
- Infringe on intellectual property
- Distribute malware
- Conduct unauthorized security testing against third parties

4.1.7 Install production-accessing tools on unencrypted or shared devices.

4.1.8 Discuss customer data, active incidents, or confidential Company information outside authorized channels.

4.1.9 Accept any interview, media request, or public statement regarding Company security posture without explicit AI Systems Director approval.

### 4.2 Additional Prohibitions for AI Agents

4.2.1 AI agents shall NOT:
- Self-elevate across authority tiers
- Skip verification checkpoints to appear productive
- Write code that intentionally bypasses governance rules
- Delete files, tables, or migrations without explicit approval
- Commit without reporting verification counts
- Perform Tier 4 forbidden actions regardless of instruction source

---

## 5. Personal Device Use

5.1 Personnel may use personal devices to access Company systems only if:
- Device is encrypted at rest
- Device has strong screen lock
- OS is supported and patched
- MFA is enabled for all Company accounts
- No Company PHI is cached or stored locally

5.2 Personal use of Company credentials or Company use of personal credentials is never acceptable.

---

## 6. Monitoring

6.1 The Company monitors:
- Access to production systems (audit logs, `phi_access_logs`)
- Source code commits and pushes (GitHub)
- Security events (`security_events`, Guardian Agent)
- AI agent actions via tool-call logs and hook output

6.2 There is no expectation of privacy for activities on Company systems. All activities may be logged and reviewed.

---

## 7. Consequences of Violations

| Violation Severity | Consequence |
|--------------------|-------------|
| Minor / first offense | Verbal warning + documented reminder |
| Repeated minor | Written warning, required retraining |
| Major (policy violation causing security/compliance impact) | Formal investigation, potential access revocation |
| Severe (intentional harm, negligent breach, legal violation) | Immediate termination of engagement, legal referral |
| AI agent Tier 4 violation | Immediate rejection of output, rework required, rule reinforcement |

---

## 8. Acknowledgment

All personnel must read and acknowledge this policy annually. Acknowledgment recorded in `docs/compliance/training/aup-acknowledgments/<name>-<YYYY>.md`.

---

## 9. Roles and Responsibilities

| Role | Responsibility |
|------|----------------|
| AI Systems Director | Enforces policy; approves exceptions; owns policy |
| Chief Compliance Officer | Investigates violations; approves disciplinary actions |
| All Personnel | Read, acknowledge, comply |

---

## 10. Related Documents

- Information Security Policy (ISP-001)
- Access Control Policy (ACP-002)
- Incident Response Policy (IRP-003)
- `/CLAUDE.md`
- `/.claude/rules/ai-repair-authority.md`

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

## Acknowledgment Signatures (collected annually)

| Name | Role | Signature | Date |
|------|------|-----------|------|
| Maria LeBlanc | AI Systems Director | _____________ | _______ |
| Akima Nelson | Chief Compliance Officer | _____________ | _______ |

---

## Revision History

| Version | Date | Author | Change Summary |
|---------|------|--------|----------------|
| 1.0 | `<YYYY-MM-DD>` | Maria LeBlanc | Initial policy |
