# SOC 2 Readiness Tracker — Policy & Evidence Gap Closure

> **Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.**
> Proprietary and confidential.

**Tracker ID:** SOC2-READINESS
**Created:** 2026-04-21
**Owner:** Maria (AI Systems Director)
**Reviewer:** Akima (Chief Compliance and Accountability Officer)
**Total items:** 14
**Status:** 0/14 complete
**Estimated effort:** ~32 hours across 3-4 sessions

---

## Context

We are **technically ~80% aligned** with SOC 2 Type II expectations. The remaining 20% is almost entirely **paper** — written policies, signed attestations, vendor DPAs, training records, pen test. Code is not the bottleneck.

This tracker closes the documentation gap so that, when ready, we can engage a SOC 2 auditor with evidence on day one.

**We are NOT declaring SOC 2 compliance.** SOC 2 requires an independent AICPA-certified auditor. This tracker prepares us for that engagement.

---

## Trust Service Criteria Coverage

| TSC | Current Alignment | After Tracker Complete |
|-----|-------------------|------------------------|
| **Security (CC — required)** | Strong (code + controls) | Strong + documented |
| **Availability** | Moderate (no DR runbook) | Good (DR policy + tabletop) |
| **Processing Integrity** | Good (typed schemas, structured AI) | Good + data integrity policy |
| **Confidentiality** | Strong (encryption, tenant isolation) | Strong + data classification |
| **Privacy** | Moderate (no written privacy policy) | Good (privacy policy + GDPR tooling) |

---

## Tracker Items

### Phase 1 — Written Policies (Session 1 focus, ~16 hours)

| ID | Title | TSC | Artifact | Effort | Status |
|----|-------|-----|----------|--------|--------|
| SOC2-1 | Information Security Policy (umbrella) | CC1, CC2, CC5 | `docs/compliance/soc2-policies/01_information_security_policy.md` | 2h | Drafted |
| SOC2-2 | Access Control Policy | CC6.1, CC6.2, CC6.3 | `docs/compliance/soc2-policies/02_access_control_policy.md` | 2h | Drafted |
| SOC2-3 | Incident Response Policy | CC7.3, CC7.4, CC7.5 | `docs/compliance/soc2-policies/03_incident_response_policy.md` | 2h | Drafted |
| SOC2-4 | Business Continuity & Disaster Recovery Policy | A1.2, A1.3 | `docs/compliance/soc2-policies/04_business_continuity_disaster_recovery_policy.md` | 2h | Drafted |
| SOC2-5 | Data Classification & Retention Policy | C1.1, C1.2, PI1.5 | `docs/compliance/soc2-policies/05_data_classification_retention_policy.md` | 2h | Drafted |
| SOC2-6 | Change Management Policy | CC8.1 | `docs/compliance/soc2-policies/06_change_management_policy.md` | 2h | Drafted |
| SOC2-7 | Vendor Risk Management Policy | CC9.2 | `docs/compliance/soc2-policies/07_vendor_risk_management_policy.md` | 2h | Drafted |
| SOC2-8 | Acceptable Use Policy | CC1.4, CC1.5 | `docs/compliance/soc2-policies/08_acceptable_use_policy.md` | 2h | Drafted |

### Phase 2 — Evidence Collection (Session 2 focus, ~10 hours)

| ID | Title | TSC | Artifact | Effort | Status |
|----|-------|-----|----------|--------|--------|
| SOC2-9 | Vendor SOC 2 reports + DPA/BAA collection | CC9.2 | `docs/compliance/vendors/` folder — one sub-folder per vendor | 3h | Pending |
| SOC2-10 | Security training records (Maria + Akima) | CC1.4 | `docs/compliance/training/2026-annual-training.md` | 1h | Pending |
| SOC2-11 | Quarterly access review — first entry | CC6.2 | `docs/compliance/access-reviews/2026-Q2-access-review.md` | 2h | Pending |
| SOC2-12 | Disaster recovery tabletop exercise — first run | A1.3 | `docs/compliance/dr-exercises/2026-Q2-tabletop.md` | 4h | Pending |

### Phase 3 — External Validation (Session 3 focus, ~6h + external)

| ID | Title | TSC | Artifact | Effort | Status |
|----|-------|-----|----------|--------|--------|
| SOC2-13 | Third-party penetration test — scope document + vendor selection | CC7.1 | `docs/compliance/pentest/2026-pentest-scope.md` | 4h internal + external engagement | Pending |
| SOC2-14 | SOC 2 evidence matrix — crosswalk every AICPA TSP 100 criterion to live code/docs | All | `docs/compliance/SOC2_EVIDENCE_MATRIX.md` | 2h | Pending |

---

## Execution Notes for Future Sessions

### Phase 1 (Policies) — Autonomous execution approved

The 8 policy templates are **drafted** in `docs/compliance/soc2-policies/`. Each follows this structure:

1. Purpose
2. Scope
3. Policy Statements (the actual rules)
4. Roles and Responsibilities
5. Evidence and Controls (crosswalk to existing code/tables)
6. Review Cadence (annual minimum)
7. Signature Block

**To finalize a policy:**
1. Read the draft in `docs/compliance/soc2-policies/`
2. Verify the "Evidence and Controls" section matches current codebase state (run the grep commands listed in each)
3. Fill in any `<PLACEHOLDER>` fields specific to the current company (contact info, review dates, etc.)
4. Commit. Policies are ready for Maria + Akima to sign.

The templates are opinionated and reflect actual controls in the codebase (CLAUDE.md rules, RLS policies, edge function auth, audit logs). They are not generic boilerplate.

### Phase 2 (Evidence) — Requires external inputs

- **SOC2-9:** Download SOC 2 Type II reports from:
  - Supabase (supabase.com/security)
  - Anthropic (anthropic.com/legal — request via support)
  - MailerSend (mailersend.com/security)
  - Twilio (twilio.com/legal)
  - Vercel (vercel.com/security) if deployed there
  Save each in `docs/compliance/vendors/<vendor-name>/soc2-report-YYYY.pdf`. Also collect signed BAA for any vendor handling PHI (Supabase has BAA available; Anthropic requires enterprise plan).

- **SOC2-10:** 1-day effort. Maria + Akima each complete annual training (any AICPA-aligned security awareness course — e.g., KnowBe4, Ninjio, or even a well-documented self-directed review of CLAUDE.md + rules/). Record completion.

- **SOC2-11:** Quarterly cadence. Review who has `super_admin`, `admin`, `clinical` roles. Verify each is still necessary. Record in markdown.

- **SOC2-12:** Simulated recovery. Restore database from backup to a test project. Verify edge functions deploy. Time the recovery. Record RTO/RPO actuals vs targets.

### Phase 3 (External Validation) — Requires vendor engagement

- **SOC2-13:** Third-party pen test. Budget $8-15K. Recommended vendors: Cobalt, HackerOne, Bishop Fox, or a boutique firm specializing in healthcare. Scope: web app + edge functions + auth flows. Do NOT use our internal adversarial audits as a substitute — auditors want an independent qualified firm.

- **SOC2-14:** Final crosswalk. Map every AICPA TSP 100 criterion (CC1.1 through P9.1) to a line of code, a policy, a migration, or an audit artifact. This is the document the auditor opens first.

---

## Verification Steps

### After Phase 1 (Policies Drafted)

```bash
# Confirm all 8 policy files exist
ls /workspaces/WellFit-Community-Daily-Complete/docs/compliance/soc2-policies/ | wc -l
# Expected: 8 files (or 9 if README)

# Verify each has a signature block
grep -l "Signature:" /workspaces/WellFit-Community-Daily-Complete/docs/compliance/soc2-policies/*.md | wc -l
# Expected: 8
```

### After Phase 2 (Evidence Collected)

```bash
# Vendor evidence present
ls /workspaces/WellFit-Community-Daily-Complete/docs/compliance/vendors/
# Expected: folders for supabase, anthropic, mailersend, twilio, vercel (if used)

# Training records
ls /workspaces/WellFit-Community-Daily-Complete/docs/compliance/training/
```

### After Phase 3 (External Validation)

```bash
# Evidence matrix complete
grep -c "^| " /workspaces/WellFit-Community-Daily-Complete/docs/compliance/SOC2_EVIDENCE_MATRIX.md
# Expected: >60 rows (covering all TSC criteria)
```

---

## Regression Checks (run in future sessions)

```bash
# Policies haven't regressed below 8
ls /workspaces/WellFit-Community-Daily-Complete/docs/compliance/soc2-policies/*.md | wc -l
# Expected: >= 8

# Evidence matrix exists once Phase 3 complete
test -f /workspaces/WellFit-Community-Daily-Complete/docs/compliance/SOC2_EVIDENCE_MATRIX.md && echo "exists" || echo "MISSING"
```

---

## Out of Scope for This Tracker

- **SOC 2 audit engagement itself** — that's a vendor selection + contract decision separate from readiness
- **HIPAA-specific controls** — already covered by existing HIPAA work in `docs/security-audits/`
- **HITRUST certification** — different framework, separate tracker if pursued
- **ONC certification** — separate tracker (`docs/trackers/onc-certification-tracker.md`)

---

## Why This Matters — One Paragraph for the Auditor

Our control environment is unusual. We are a two-person organization (Maria, Akima) that built a production HIPAA-compliant healthcare platform using AI-assisted development with a governance-first approach. Our primary control is a codified rule system (`CLAUDE.md` + `.claude/rules/*`) with automated enforcement hooks, mandatory verification checkpoints, and cross-AI adversarial audits. This replaces what traditional organizations achieve through headcount (security team, QA, code review) with process and tooling. The policies in this tracker formalize what is already in practice — they do not create new controls, they document existing ones for audit evidence.
