# Vendor Risk Management Policy

**Document ID:** VRM-007
**Owner:** AI Systems Director (Maria)
**Approver:** Chief Compliance and Accountability Officer (Akima)
**Effective Date:** `<YYYY-MM-DD>`
**Last Reviewed:** `<YYYY-MM-DD>`
**Review Cadence:** Annual; upon addition of new critical vendor
**Classification:** Internal — Confidential

---

## 1. Purpose

This policy governs how the Company selects, assesses, contracts with, monitors, and offboards third-party service providers (vendors) — especially those handling PHI or providing critical infrastructure.

---

## 2. Scope

Applies to all vendors providing:
- Infrastructure (hosting, database, compute)
- AI services (model inference, API access)
- Communications (email, SMS, push)
- Authentication / identity services
- Security tools
- Compliance tools

---

## 3. Vendor Classification

### 3.1 Tier Definitions

| Tier | Description | Criteria | Examples |
|------|-------------|----------|----------|
| **Tier 1 — Critical** | Handles PHI OR single point of failure | BAA required; SOC 2 Type II required; annual review | Supabase (database/auth), Anthropic (AI) |
| **Tier 2 — Important** | Handles sensitive data but not PHI | DPA required; SOC 2 or equivalent; annual review | MailerSend (email), Twilio (SMS), Vercel (hosting) |
| **Tier 3 — Standard** | Supports operations; no sensitive data | Terms of Service acceptable; biennial review | GitHub, monitoring tools |
| **Tier 4 — Informational** | Reference/data-only services | Free-tier acceptable | Public NPI registry, PubMed, CMS APIs |

### 3.2 Current Vendor Register

| Vendor | Tier | Purpose | PHI Access | BAA/DPA | SOC 2 Report on File |
|--------|------|---------|------------|---------|----------------------|
| Supabase | 1 | Database, auth, edge runtime, storage | Yes | Required | `docs/compliance/vendors/supabase/` |
| Anthropic (Claude API) | 1 | AI inference | Yes (in prompts) | Required (enterprise) | `docs/compliance/vendors/anthropic/` |
| MailerSend | 2 | Transactional email | Limited (notification content) | DPA required | `docs/compliance/vendors/mailersend/` |
| Twilio | 2 | SMS notifications | Limited (notification content) | BAA available | `docs/compliance/vendors/twilio/` |
| Vercel | 2 | Frontend hosting (if deployed) | No (static assets only) | DPA required | `docs/compliance/vendors/vercel/` |
| GitHub | 3 | Source code hosting, CI/CD | No (code only, synthetic test data) | Standard ToS | `docs/compliance/vendors/github/` |
| hCaptcha | 3 | Bot protection | No | Standard ToS | `docs/compliance/vendors/hcaptcha/` |
| Firebase (push notifications, if used) | 2 | Push notifications | Limited | DPA required | `docs/compliance/vendors/firebase/` |

---

## 4. Policy Statements

### 4.1 Vendor Selection

4.1.1 Before engaging any Tier 1 or Tier 2 vendor, the AI Systems Director must:
- Evaluate functional fit
- Review security posture (SOC 2, HIPAA readiness, encryption, access controls)
- Negotiate and obtain BAA/DPA as applicable
- Document selection rationale in `docs/compliance/vendors/<vendor-name>/selection-rationale.md`

4.1.2 Tier 1 vendors additionally require Chief Compliance Officer sign-off.

### 4.2 Contractual Requirements

4.2.1 For vendors processing PHI:
- **Business Associate Agreement (BAA)** executed before any PHI is shared
- BAA includes HIPAA breach notification terms, audit rights, subcontractor flow-down
- BAA stored in `docs/compliance/vendors/<vendor-name>/baa-<YYYY-MM-DD>.pdf`

4.2.2 For vendors processing non-PHI sensitive data:
- **Data Processing Agreement (DPA)** or equivalent
- DPA stored in `docs/compliance/vendors/<vendor-name>/dpa-<YYYY-MM-DD>.pdf`

4.2.3 All contracts reviewed for:
- Data location and cross-border transfer terms
- Breach notification SLAs
- Termination and data return/destruction clauses
- Audit rights
- Subprocessor disclosure

### 4.3 Ongoing Monitoring

4.3.1 **Annual review** of each Tier 1/Tier 2 vendor:
- Download latest SOC 2 Type II report (if available)
- Review any published audit exceptions
- Verify BAA/DPA still in force
- Check for subprocessor changes
- Document in `docs/compliance/vendors/<vendor-name>/annual-review-YYYY.md`

4.3.2 **Continuous monitoring:**
- Subscribe to vendor security bulletins
- Monitor for vendor breach disclosures
- Track service outages affecting the Company

4.3.3 **Incident response coordination:**
- Each vendor has a documented security contact
- BAA/DPA defines breach notification timeframes
- Vendor incidents that may affect the Company trigger our Incident Response Policy (IRP-003)

### 4.4 Offboarding

4.4.1 When a vendor relationship ends:
- All Company data is returned or destroyed per contract
- API keys revoked
- Access credentials rotated on remaining systems
- Confirmation of data destruction obtained in writing
- Offboarding documented in `docs/compliance/vendors/<vendor-name>/offboarding-YYYYMMDD.md`

### 4.5 Prohibited Vendor Practices

4.5.1 The Company shall not engage vendors that:
- Cannot provide a BAA when PHI is involved (Tier 1)
- Have a history of breaches with inadequate response
- Refuse subprocessor disclosure
- Are incorporated in jurisdictions with cross-border data transfer restrictions that cannot be mitigated

---

## 5. Roles and Responsibilities

| Role | Responsibility |
|------|----------------|
| AI Systems Director | Vendor selection, annual reviews, contract negotiation |
| Chief Compliance Officer | Approves Tier 1 vendors, reviews BAA terms, PHI-handling assessments |
| All Personnel | Do not sign up for SaaS tools handling Company data without approval |

---

## 6. Evidence and Controls

| Control | Location | TSC Mapping |
|---------|----------|-------------|
| Vendor register | This policy §3.2 | CC9.2 |
| BAA / DPA repository | `docs/compliance/vendors/<vendor>/` | CC9.2 |
| Annual review records | `docs/compliance/vendors/<vendor>/annual-review-YYYY.md` | CC9.2 |
| Vendor SOC 2 reports | `docs/compliance/vendors/<vendor>/soc2-type2-YYYY.pdf` | CC9.2 |

---

## 7. Related Documents

- Information Security Policy (ISP-001)
- Data Classification & Retention Policy (DCR-005)
- Incident Response Policy (IRP-003)

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
