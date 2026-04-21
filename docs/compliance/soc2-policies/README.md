# SOC 2 Policy Templates — Envision Virtual Edge Group LLC

This directory contains the Company's written information security policies, drafted for SOC 2 Type II readiness.

---

## Status

**Drafted:** 2026-04-21
**Signed:** Pending Maria + Akima review and signature
**Review cadence:** Annual (or upon significant change)

---

## Policy Index

| # | Policy ID | Title | TSC Coverage |
|---|-----------|-------|--------------|
| 1 | ISP-001 | [Information Security Policy](01_information_security_policy.md) | CC1, CC2, CC5 (umbrella) |
| 2 | ACP-002 | [Access Control Policy](02_access_control_policy.md) | CC6.1, CC6.2, CC6.3, CC6.6, CC6.7 |
| 3 | IRP-003 | [Incident Response Policy](03_incident_response_policy.md) | CC7.3, CC7.4, CC7.5 |
| 4 | BCP-004 | [Business Continuity & Disaster Recovery Policy](04_business_continuity_disaster_recovery_policy.md) | A1.1, A1.2, A1.3 |
| 5 | DCR-005 | [Data Classification & Retention Policy](05_data_classification_retention_policy.md) | C1.1, C1.2, PI1.5, P4.2, P5.1 |
| 6 | CMP-006 | [Change Management Policy](06_change_management_policy.md) | CC8.1 |
| 7 | VRM-007 | [Vendor Risk Management Policy](07_vendor_risk_management_policy.md) | CC9.2 |
| 8 | AUP-008 | [Acceptable Use Policy](08_acceptable_use_policy.md) | CC1.4, CC1.5 |

---

## How These Were Drafted

These are **not generic boilerplate**. They reflect the actual controls in this codebase:
- Cross-references to `/CLAUDE.md` and `/.claude/rules/*`
- Cross-references to specific tables, edge functions, and migration files
- Cross-references to GitHub Actions workflows
- Cross-references to the tiered AI authority model

Every "Evidence and Controls" section points to existing code that implements the policy.

---

## Before Signing

1. **Read each policy in order** (they build on each other)
2. **Fill in `<PLACEHOLDER>` fields** — these are marked with angle brackets, e.g. `<YYYY-MM-DD>`
3. **Verify the "Evidence and Controls" sections** — run the referenced commands, confirm controls exist
4. **Review jointly** with Akima (Chief Compliance Officer)
5. **Sign** — both Maria and Akima signatures required on each
6. **Commit** — signed PDFs (or markdown with typed signatures + date) should be committed

---

## After Signing — Annual Review Process

Each year:
1. Review each policy in order
2. Verify all "Evidence and Controls" references still exist and work
3. Update the "Last Reviewed" date
4. Add an entry to the "Revision History"
5. Re-sign if substantive changes
6. Commit

---

## Tracker

Progress on SOC 2 readiness is tracked in [`docs/trackers/soc2-readiness-tracker.md`](../../trackers/soc2-readiness-tracker.md).

---

## Related

- [`/CLAUDE.md`](../../../CLAUDE.md) — Primary governance document
- [`/.claude/rules/`](../../../.claude/rules/) — Detailed technical standards
- [`docs/security-audits/`](../../security-audits/) — Adversarial audit findings
