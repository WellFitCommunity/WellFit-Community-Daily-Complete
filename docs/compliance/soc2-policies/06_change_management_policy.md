# Change Management Policy

**Document ID:** CMP-006
**Owner:** AI Systems Director (Maria)
**Approver:** Chief Compliance and Accountability Officer (Akima)
**Effective Date:** `<YYYY-MM-DD>`
**Last Reviewed:** `<YYYY-MM-DD>`
**Review Cadence:** Annual
**Classification:** Internal — Confidential

---

## 1. Purpose

This policy defines how changes to production systems — including source code, database schema, infrastructure configuration, and third-party integrations — are proposed, reviewed, tested, approved, deployed, and documented.

---

## 2. Scope

Applies to all changes affecting:
- Production source code (anything on `main` branch)
- Production Supabase project (schema, RLS, edge functions, secrets)
- Deployment pipelines (`.github/workflows/*`)
- Third-party SaaS configuration (Anthropic, MailerSend, Twilio, Vercel)
- Governance documents (`CLAUDE.md`, `.claude/rules/*`)

---

## 3. Change Classification

### 3.1 Change Types

| Type | Description | Approval Required | Review Required |
|------|-------------|-------------------|-----------------|
| **Standard** | Pre-approved, low-risk, repeatable | None (auto-approved) | No (CI/CD gates sufficient) |
| **Normal** | Requires review and approval before merge | AI Systems Director | Yes (human or cross-AI review) |
| **Emergency** | Required to resolve active incident | AI Systems Director (verbal, documented after) | Retrospective review within 48 hours |
| **Forbidden** | Tier 4 actions per `/.claude/rules/ai-repair-authority.md` | Never | N/A |

### 3.2 Examples by Type

**Standard changes (no approval needed):**
- Typo fixes in comments/docs
- Lint warning remediation
- Dependency patch version bumps (verified by `audit-ci`)
- Test additions that don't modify production code

**Normal changes (require approval):**
- New features or components
- Database migrations
- RLS policy changes
- Edge function creation or significant modification
- Dependency major/minor version upgrades
- CORS / CSP / auth flow changes
- AI model version changes

**Emergency changes:**
- Critical security patches (CVE in production dependencies)
- Active incident mitigations
- Vendor-forced migrations (e.g., API deprecation)

**Forbidden changes:**
- Disabling RLS
- CORS/CSP wildcards
- `WHITE_LABEL_MODE=true`
- Force-pushing to `main`
- `console.log` in production code
- `any` type usage
- Disabling pre-commit hooks

---

## 4. Change Management Lifecycle

### 4.1 Proposal

4.1.1 Changes are proposed via:
- Git branches (naming: `claude/<feature-description>-<id>`)
- Pull requests to `main`
- Tracker items in `docs/trackers/*` for multi-session work

4.1.2 Every normal change PR must include:
- Description of what changed and why
- Test plan
- Verification checkpoint output (typecheck + lint + tests)
- Rollback plan (if non-trivial)

### 4.2 Review

4.2.1 **Human review** by AI Systems Director or delegated reviewer.

4.2.2 **Automated review** via:
- CI/CD pipeline (`.github/workflows/ci-cd.yml`)
- Security scan (`.github/workflows/security-scan.yml`)
- Integration tests (`.github/workflows/integration-tests.yml`)
- Governance hooks (`.claude/settings.json`)

4.2.3 **Cross-AI adversarial review** is required before:
- Major feature releases
- Hospital pilot demos
- Changes affecting authentication, authorization, or tenant isolation
- Documented in `docs/security-audits/`

### 4.3 Testing

4.3.1 All changes require passing:
- Scoped typecheck (`bash scripts/typecheck-changed.sh`)
- Lint (`npm run lint`) with 0 new warnings
- Test suite (`npm test`) with 100% pass rate

4.3.2 Database migrations require:
- `npx supabase db push` tested on a development project first
- Verification query confirming new schema exists
- Rollback SQL documented (if migration is non-trivial)

4.3.3 Edge function changes require:
- `npx supabase functions deploy`
- Post-deploy health check via `health-monitor` or direct invocation test
- Wait minimum 60 seconds before validating

### 4.4 Approval

4.4.1 Approval granted by:
- AI Systems Director for normal changes (via PR merge)
- Chief Compliance Officer additionally for clinical workflow changes
- AI agents are never permitted to self-approve Tier 3 or Tier 4 changes

4.4.2 Approval is recorded via Git commit signature, PR merge event, or explicit written approval in `docs/compliance/change-approvals/` for emergency changes.

### 4.5 Deployment

4.5.1 Production deployment occurs via:
- Git merge to `main` → Vercel auto-deploy (frontend)
- `npx supabase functions deploy` (edge functions)
- `npx supabase db push` (migrations)

4.5.2 Deployment windows: Any time, but avoid:
- Peak user hours for non-emergency changes (9 AM - 8 PM ET)
- Known high-sensitivity periods (pilot demos, customer showcases)

### 4.6 Post-Deployment Validation

4.6.1 Within 1 hour of deployment:
- Verify no new errors in Supabase logs
- Verify no new alerts in `security_events` or `guardian_cron_log`
- Spot-check affected features

4.6.2 If issues found:
- Minor: Fix forward with a new change
- Major: Roll back via `git revert` + deployment

### 4.7 Documentation

4.7.1 Every significant change produces:
- Git commit with descriptive message following project conventions
- Updates to `docs/PROJECT_STATE.md` for tracker progress
- Updates to relevant `.claude/rules/*` if behavior rules change

---

## 5. Emergency Change Procedure

5.1 For active security incidents or production outages:
- AI Systems Director may authorize immediate change
- Verbal/SMS approval acceptable; formal documentation follows within 48 hours
- Change must still pass automated gates (typecheck, tests, security scan)
- Exception: if gates are themselves broken, Compliance Officer co-authorizes and records justification

5.2 All emergency changes are reviewed retrospectively. Post-Incident Review (per IRP-003) captures:
- Why emergency was justified
- What controls were bypassed
- Whether additional preventive changes are needed

---

## 6. Roles and Responsibilities

| Role | Responsibility |
|------|----------------|
| AI Systems Director | Approves normal changes; authorizes emergency changes; owns this policy |
| Chief Compliance Officer | Approves clinical-workflow changes; reviews emergency change records |
| AI Coding Agents | Follow CLAUDE.md rules; cannot self-elevate; surface blockers to humans |
| All Personnel | Follow change process; do not merge without approval; document changes |

---

## 7. Evidence and Controls

| Control | Location | TSC Mapping |
|---------|----------|-------------|
| Version control | Git repository on GitHub | CC8.1 |
| CI/CD gates | `.github/workflows/*.yml` | CC8.1 |
| Governance hooks | `.claude/settings.json` | CC8.1 |
| Verification checkpoint | CLAUDE.md §"Mandatory Verification Checkpoint" | CC8.1 |
| Change tracker system | `docs/trackers/*.md` | CC8.1 |
| Emergency change log | `docs/compliance/change-approvals/` | CC8.1 |
| Adversarial audits | `docs/security-audits/` | CC4.1, CC8.1 |

---

## 8. Change Metrics (tracked quarterly)

- Number of changes by classification
- Emergency change frequency (target: <5% of all changes)
- Post-deployment incident rate
- Mean time to detect post-deployment issue
- Rollback frequency

---

## 9. Related Documents

- Information Security Policy (ISP-001)
- Incident Response Policy (IRP-003)
- `/.claude/rules/ai-repair-authority.md`
- CLAUDE.md (primary governance)

---

## 10. Approval and Signatures

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
