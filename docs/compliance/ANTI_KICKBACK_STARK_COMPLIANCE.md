# Anti-Kickback Statute & Stark Law Compliance

**Envision Virtual Edge Group LLC**
**Effective Date:** February 10, 2026
**Regulatory Framework:**
- Anti-Kickback Statute (AKS): 42 USC 1320a-7b(b)
- Stark Law (Physician Self-Referral): 42 USC 1395nn
- AKS Safe Harbors: 42 CFR 1001.952
**Owner:** Maria (AI System Director), Akima (CCO)
**Review Cycle:** Annual (next: February 2027)

---

## 1. Overview

### 1.1 Anti-Kickback Statute (AKS)

The AKS prohibits the knowing and willful offer, payment, solicitation, or receipt of anything of value to induce or reward referrals for items or services payable by federal healthcare programs (Medicare, Medicaid, TRICARE).

**Penalties:** Criminal (up to $100,000 fine and 10 years imprisonment), civil ($100,000 per violation), exclusion from federal programs.

### 1.2 Stark Law

The Stark Law prohibits physicians from referring patients for designated health services (DHS) to entities with which the physician (or immediate family member) has a financial relationship, unless an exception applies.

**Designated Health Services:** Clinical laboratory, physical therapy, occupational therapy, radiology, radiation therapy, DME, home health, outpatient prescription drugs, inpatient/outpatient hospital services.

---

## 2. Platform Design Safeguards

### 2.1 No Referral Incentives

The Envision Atlus platform is explicitly designed to **prevent** kickback and self-referral violations:

| Safeguard | Implementation | AKS/Stark Relevance |
|-----------|---------------|---------------------|
| No referral bonuses | Platform does not calculate or track referral compensation | Eliminates inducement for referrals |
| No provider-to-provider payments | Billing goes through clearinghouse per fee schedule | No remuneration flow between referring/receiving parties |
| Transparent fee schedules | `fee_schedules` and `fee_schedule_rates` tables are auditable | Fair market value documentation |
| No volume-based incentives | AI billing suggestions based on clinical documentation, not volume | Removes volume incentive |
| Audit trail on all referrals | `ai_referral_letters` table logs all referral activity | Traceability |

### 2.2 Referral System Architecture

The platform's referral system (`docs/product/REFERRAL_SYSTEM.md`) is designed with compliance in mind:

| Feature | Compliance Design |
|---------|-----------------|
| Referral generation | AI generates referral letters from clinical data — no financial incentive |
| Provider selection | Based on specialty, location, and availability — no financial relationships |
| Referral tracking | All referrals logged with clinical justification in audit trail |
| Outcome tracking | Follow-up tracking based on clinical outcomes, not revenue |

### 2.3 AI Billing Safeguards

| AI Skill | Risk | Safeguard |
|----------|------|-----------|
| `ai-billing-suggester` | Could suggest upcoding | Suggestions based on documented clinical findings only; clinician reviews and approves all codes; audit trail |
| `coding-suggest` | Could recommend unnecessary codes | Maps to documented diagnosis and procedure codes; does not suggest services not performed |
| `sdoh-coding-suggest` | Could add unsubstantiated SDOH codes | Requires documented SDOH assessment; clinician attestation |

---

## 3. Safe Harbor Compliance

### 3.1 Applicable Safe Harbors (42 CFR 1001.952)

| Safe Harbor | Applicability | Our Compliance |
|-------------|:------------:|----------------|
| **Personal services and management contracts** | Yes | Platform licensing agreements are written, signed, at fair market value, and specify services |
| **Electronic health records** | Yes | Platform qualifies as EHR technology; no conditions on referral volume |
| **Value-based arrangements** | Potential | If tenants participate in value-based care models, platform supports quality reporting (eCQM, HEDIS, MIPS) |
| **Warranties** | Yes | Standard commercial warranty terms |

### 3.2 Arrangements NOT Involved

The platform explicitly does **not** facilitate or enable:

| Prohibited Arrangement | Platform Position |
|-----------------------|------------------|
| Referral fees between providers | Not supported — no payment routing for referrals |
| Percentage-based compensation for referrals | Not supported — licensing is flat-rate or per-seat |
| Free or discounted services conditioned on referrals | Not supported — pricing is independent of referral volume |
| Exclusive dealing arrangements | Not supported — platform is tenant-agnostic |
| Patient steering based on financial relationships | Not supported — referrals based on clinical criteria only |

---

## 4. Stark Law Exceptions

### 4.1 Applicable Exceptions

| Exception | 42 USC 1395nn | Our Compliance |
|-----------|:------------:|----------------|
| **In-office ancillary services** | (b)(2) | Platform supports in-office services with proper supervision documentation |
| **Electronic prescribing** | (d)(4) | Platform prescribing (FHIR MedicationRequest) follows e-prescribing standards |
| **EHR exception** | (d)(4) | Platform qualifies; interoperable, certified, no conditions on referrals |
| **Fair market value** | (e)(1)(A) | All platform licensing at commercially reasonable rates |

### 4.2 Financial Relationship Transparency

The platform provides tools that support Stark compliance for tenant organizations:

| Tool | Purpose |
|------|---------|
| Provider profiles (`billing_providers`) | Document provider relationships and affiliations |
| Fee schedule management | Maintain fair market value documentation |
| Audit logs | Complete trail of referral decisions and financial transactions |
| Claims transparency | All billing visible to compliance officers via dashboard |

---

## 5. Compliance Program Requirements

### 5.1 Organizational Policies (Tenant Responsibility)

Each tenant organization using the platform must maintain their own:

- [ ] Written compliance plan addressing AKS and Stark
- [ ] Designated compliance officer
- [ ] Regular compliance training for workforce
- [ ] Mechanism for reporting potential violations
- [ ] Internal monitoring and auditing procedures
- [ ] Response protocol for detected violations
- [ ] Non-retaliation policy for whistleblowers

### 5.2 Platform Support for Tenant Compliance

| Requirement | Platform Feature |
|-------------|-----------------|
| Monitoring & auditing | `audit_logs`, `admin_audit_log` — complete trail of financial transactions |
| Training documentation | `training_courses`, `training_completions` — track compliance training |
| Reporting mechanism | Incident reporting system, `breach_incidents` table |
| Non-retaliation | Platform audit trail prevents tampering with reports |

---

## 6. OIG Compliance Guidance

Per OIG (Office of Inspector General) compliance program guidance for hospitals and clinical practices:

### 6.1 Seven Elements of Effective Compliance

| Element | Platform Support |
|---------|-----------------|
| 1. Written standards of conduct | CLAUDE.md governance, HIPAA compliance docs |
| 2. Compliance officer/committee | Akima designated as CCO |
| 3. Effective training and education | Training tracking dashboard (Gap 9 remediation) |
| 4. Effective lines of communication | Audit logging, incident reporting |
| 5. Internal monitoring and auditing | SOC 2 dashboard, audit logs, compliance reports |
| 6. Enforcement through discipline | Workforce sanction policy (in development) |
| 7. Prompt response to detected issues | Breach notification engine (Gap 2 remediation) |

---

## 7. Risk Areas and Mitigations

| Risk Area | Description | Mitigation |
|-----------|-------------|-----------|
| AI upcoding | AI billing suggestions could recommend higher codes | Clinician reviews all codes; AI shows reasoning; audit trail |
| Referral steering | Platform could direct patients to financially-linked providers | Referrals based on clinical criteria only; no financial relationship tracking |
| Free services as inducement | Free tier could induce referrals | Community (WellFit) product is general wellness, not DHS |
| Volume-based pricing | Per-transaction pricing could incentivize overutilization | Flat-rate or per-seat licensing; no per-claim fees |
| Lab result routing | Lab orders could be directed to affiliated labs | Platform routes orders based on tenant configuration, not financial relationships |

---

## 8. Annual Certification

This compliance document will be reviewed annually. The review will verify:

1. No new features introduce referral incentive mechanisms
2. AI billing suggestions remain documentation-based (not volume-based)
3. Platform licensing remains at fair market value
4. Audit trail integrity is maintained
5. Tenant compliance tools remain operational

---

## Signatures

| Role | Name | Date |
|------|------|------|
| Compliance Officer (CCO) | Akima — MDiv, BSN, RN, CCM | ________ |
| AI System Director | Maria | ________ |

---

*Document Owner: Envision Virtual Edge Group LLC*
*Contact: maria@wellfitcommunity.com*
