# Claude Code Skills Reference — Envision ATLUS I.H.I.S.

> **Last Updated:** 2026-03-03
> **Skills:** 8 active

---

## Skills Directory

```
.claude/skills/
├── ship/               /ship              Verify + commit + push
├── plan/               /plan              Structured implementation plan
├── onboard-tenant/     /onboard-tenant    New organization onboarding
├── demo-ready/         /demo-ready        Hospital pilot readiness check
├── security-scan/      /security-scan     HIPAA security compliance scan
├── cost-check/         /cost-check        AI cost analysis
├── test-runner/        /test-runner       Smart test execution
└── pre-commit/         /pre-commit        Pre-commit validation
```

All skills use `SKILL.md` (uppercase) inside their directory.

---

## Skill Summary

### Core Workflow

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/ship` | Typecheck + lint + test, then commit + push | After completing any work |
| `/plan` | Read tracker, create implementation plan | Before starting a new feature |
| `/pre-commit` | Lint + types + tests + PHI scan | Before every commit |

### Operations

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/onboard-tenant` | Full tenant onboarding (CORS, branding, modules, roles, AI config, RLS verification) | When a new organization signs up |
| `/demo-ready` | 12-check hospital pilot readiness validation | Before customer demos or pilot deployments |
| `/security-scan` | 11-check HIPAA compliance scan (PHI, RLS, CORS, MCP, secrets, auth) | Before commits, demos, audits |

### Monitoring

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/cost-check` | AI spending analysis across 26+ edge function skills + 19 service-layer skills | Monthly review, budget planning |
| `/test-runner` | Smart test execution (changed files, full suite, coverage) | During development |

---

## Codebase Baselines (for skill validation)

| Metric | Current Value | As Of |
|--------|--------------|-------|
| Tests | 10,681+ passed, 0 failed | 2026-03-03 |
| Test Suites | 534 | 2026-03-03 |
| Lint | 0 errors, 0 warnings | 2026-03-03 |
| Typecheck | 0 errors | 2026-03-03 |
| Database tables | 248+ | 2026-03-03 |
| Edge functions | 137+ deployed | 2026-03-03 |
| MCP servers | 11 (96 tools) | 2026-03-03 |
| AI skills (edge) | 26+ | 2026-03-03 |
| AI skills (service) | 19+ | 2026-03-03 |
| God files (>600 lines) | 0 | 2026-03-03 |
| `any` types in production | 0 | 2026-03-03 |

---

## Quick Usage

```bash
# Daily development
/ship                    # Verify + commit + push
/test-runner             # Run tests smartly

# Before demos
/demo-ready              # 12-check pilot readiness
/security-scan           # HIPAA compliance scan

# Monthly
/cost-check              # AI spending analysis

# New customer
/onboard-tenant          # Full org onboarding workflow

# Planning
/plan                    # Create implementation plan from tracker
```

---

## Related Documentation

| Document | Path |
|----------|------|
| Project instructions | `CLAUDE.md` |
| Project state | `docs/PROJECT_STATE.md` |
| System readiness | `docs/SYSTEM_READINESS_ASSESSMENT_2026-02-28.md` |
| Skills assessment | `docs/SKILLS_ASSESSMENT_2026-02-28.md` |
| Governance boundaries | `.claude/rules/governance-boundaries.md` |
| AI component reference | `docs/AI_COMPONENT_REFERENCE.md` |
