# Change Management Policy

> **Envision Virtual Edge Group LLC**
> **Regulation:** HIPAA 45 CFR 164.312(e)(2)(ii), SOC 2 CC8.1, NIST SP 800-128
> **Version:** 1.0 | **Effective:** February 10, 2026
> **Next Review:** August 10, 2026 (semi-annual)
> **Owner:** Security Officer (Maria) + CCO (Akima)

---

## 1. Purpose

This policy establishes a formal Change Management process for all modifications to Envision ATLUS I.H.I.S. and WellFit Community systems that process, store, or transmit ePHI. It ensures changes are reviewed, tested, approved, and documented to maintain system integrity and regulatory compliance.

---

## 2. Scope

This policy applies to all changes to:
- Application source code (TypeScript, React, Edge Functions)
- Database schema (migrations, RLS policies, stored procedures)
- Infrastructure configuration (Supabase, Vercel, DNS)
- AI model configurations (skill registry, prompt versions)
- Security controls (CORS, CSP, authentication)
- Third-party integrations (Twilio, MailerSend, Anthropic)

---

## 3. Change Classification

| Classification | Description | Approval Required | Lead Time |
|---------------|-------------|-------------------|-----------|
| **Standard** | Pre-approved, low-risk, routine changes | Automated (Guardian Agent + CI/CD) | None |
| **Normal** | Feature additions, schema changes, new integrations | Change Advisory Board review | 48 hours |
| **Emergency** | Critical security patches, active incident response | Security Officer verbal approval, documented post-hoc | Immediate |

### 3.1 Standard Changes (Pre-Approved)

These changes follow established patterns and are automatically validated:

| Change Type | Automated Gate | Example |
|-------------|---------------|---------|
| Bug fixes (no schema change) | `npm run typecheck && npm run lint && npm test` | Fix null pointer in component |
| UI text or styling changes | Lint + test pass | Update button label |
| Dependency patch updates | `npm audit` clean | Axios 1.13.2 to 1.13.5 |
| Documentation updates | N/A | Update compliance docs |

### 3.2 Normal Changes (CAB Review Required)

| Change Type | Risk Level | Example |
|-------------|-----------|---------|
| Database schema changes (migrations) | High | New table, column modification |
| New Edge Functions | High | New AI service endpoint |
| Authentication or authorization changes | Critical | RLS policy modification |
| New third-party integrations | High | Adding a new BAA-covered vendor |
| AI skill registration or model changes | Medium | New clinical AI skill |
| CORS/CSP policy changes | Critical | Adding new allowed origin |
| Feature flag changes | Medium | Enabling module for tenant |

### 3.3 Emergency Changes

| Trigger | Process | Documentation |
|---------|---------|---------------|
| Active security incident (P0/P1) | Security Officer verbal approval | Post-incident RFC within 24 hours |
| Critical vulnerability (CVSS 9.0+) | Security Officer approval | RFC filed before or during deployment |
| System outage affecting patient care | Security Officer + CCO approval | Post-incident RFC within 24 hours |

---

## 4. Change Advisory Board (CAB)

### 4.1 Membership

| Role | Member | Responsibility |
|------|--------|---------------|
| **Chair** | Maria (Security Officer) | Final approval authority |
| **Clinical Reviewer** | Akima (CCO) | Clinical safety and compliance review |
| **Technical Reviewer** | Claude Code (AI) | Automated code quality, type safety, test coverage |

### 4.2 Review Process

For Normal changes:

1. **Request for Change (RFC)** submitted via Git branch + PR description
2. **Automated Review** — Guardian Agent + CI/CD pipeline validates:
   - `npm run typecheck` — 0 errors
   - `npm run lint` — 0 errors, 0 warnings
   - `npm test` — All tests pass (currently 7,376+)
   - No `any` types, no `console.log`, no CORS wildcards
3. **Clinical Review** (if applicable) — CCO reviews for:
   - Patient safety implications
   - HIPAA compliance
   - Clinical workflow impact
   - PHI handling correctness
4. **Security Review** (if applicable) — Security Officer reviews for:
   - Authentication/authorization changes
   - PHI exposure risk
   - Third-party data sharing
   - Encryption requirements
5. **Approval** — Chair approves or requests changes
6. **Deployment** — Merge to main, automated deployment

### 4.3 Meeting Schedule

| Type | Frequency | Purpose |
|------|-----------|---------|
| **Async Review** | Per PR | Standard and Normal change review via Git |
| **Sync Meeting** | As needed for high-risk changes | Complex architectural decisions |
| **Post-Incident Review** | After any P0/P1 | Emergency change documentation |

---

## 5. Automated Change Controls

### 5.1 Pre-Commit Gates (CLAUDE.md Enforced)

| Gate | Tool | Failure Action |
|------|------|---------------|
| TypeScript type safety | `npm run typecheck` | Block commit |
| Code quality | `npm run lint` | Block commit |
| Test suite | `npm test` | Block commit |
| No `any` types | ESLint rule | Block commit |
| No `console.log` | ESLint rule | Block commit |
| No CORS wildcards | Custom check | Block commit |
| 600-line file limit | Manual check | Block commit |

### 5.2 Guardian Agent Controls

| Control | Description |
|---------|-------------|
| **Schema Validation** | Validates migration files before execution |
| **Security Scanning** | Scans for vulnerabilities in code changes |
| **PHI Detection** | Flags potential PHI exposure in frontend code |
| **Approval Workflows** | Requires explicit approval for high-risk changes |

### 5.3 Pre-Deployment Verification

```
npm run typecheck: 0 errors
npm run lint: 0 errors, 0 warnings
npm test: X passed, 0 failed
```

This verification checkpoint is a **hard gate** per CLAUDE.md. No deployment proceeds without it.

---

## 6. Database Change Management

### 6.1 Migration Workflow

| Step | Action | Verification |
|------|--------|-------------|
| 1 | Create migration file in `supabase/migrations/` | Timestamped filename |
| 2 | Review SQL for RLS policies on new tables | CCO review if PHI involved |
| 3 | Push migration: `npx supabase db push` | Verify success (no errors) |
| 4 | Test new schema | Verify queries work correctly |
| 5 | Update type definitions | Run `npm run typecheck` |

### 6.2 Rollback Procedure

- Supabase supports PITR (Point-in-Time Recovery) with 7-day window
- Migration rollback scripts should be prepared for schema changes
- Data-destructive migrations require Security Officer + CCO approval

---

## 7. Rollback Procedures

| Change Type | Rollback Method | Timeline |
|-------------|----------------|----------|
| Code deployment | Revert Git commit, redeploy | Minutes |
| Edge Function | Redeploy previous version | Minutes |
| Database migration | PITR restore or rollback script | 15-60 minutes |
| Infrastructure config | Restore from documented state | Varies |

---

## 8. Change Documentation

Every change must produce:

| Artifact | Location | Retention |
|----------|----------|-----------|
| Git commit message | Git history | Permanent |
| PR description (for Normal changes) | GitHub | Permanent |
| Migration file | `supabase/migrations/` | Permanent |
| Test results | CI/CD logs | 1 year |
| CAB approval (for Normal changes) | PR approval record | 7 years |
| Post-incident RFC (for Emergency) | `docs/incidents/` | 7 years |

---

## 9. Audit and Compliance

| Metric | Target | Measurement |
|--------|--------|-------------|
| Changes with automated testing | 100% | CI/CD pipeline records |
| Normal changes with CAB review | 100% | PR approval records |
| Emergency changes documented post-hoc | 100% within 24 hours | Incident records |
| Failed deployments | < 5% | Deployment logs |
| Mean time to rollback | < 30 minutes | Incident records |

---

## 10. Policy Maintenance

- **Review frequency:** Semi-annual (February + August)
- **Update triggers:** After incident, regulatory change, or process gap identified
- **Approval:** Security Officer + CCO
- **Training:** All team members with deployment access must complete change management training annually

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-10 | Maria + Claude Code | Initial formal change management policy |
