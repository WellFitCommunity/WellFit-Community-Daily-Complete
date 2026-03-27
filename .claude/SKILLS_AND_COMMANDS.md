# Claude Code Skills Reference — Envision ATLUS I.H.I.S.

> **Last Updated:** 2026-03-26
> **Skills:** 14 active

---

## Skills Directory

```
.claude/skills/
├── ship/               /ship              Verify + commit + push
├── plan/               /plan              Structured implementation plan
├── session-start/      /session-start     New session initialization
├── onboard-tenant/     /onboard-tenant    New organization onboarding
├── deploy-edge/        /deploy-edge       Deploy edge functions
├── demo-ready/         /demo-ready        Hospital pilot readiness check
├── security-scan/      /security-scan     HIPAA security compliance scan
├── clinical-validate/  /clinical-validate Clinical validation hooks health
├── fhir-check/         /fhir-check        FHIR interoperability health
├── god-check/          /god-check         God file detection (600-line limit)
├── audit-check/        /audit-check       Audit logging compliance
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
| `/session-start` | Read PROJECT_STATE, report 5-line status, confirm priorities | Every new session |
| `/ship` | Typecheck + lint + test, then commit + push | After completing any work |
| `/plan` | Read tracker, create implementation plan | Before starting a new feature |
| `/pre-commit` | Lint + types + tests + PHI scan | Before every commit |
| `/deploy-edge` | Deploy one/all/MCP edge functions with health verification | After edge function changes |

### Operations

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/onboard-tenant` | Full tenant onboarding (CORS, branding, modules, roles, AI config, RLS verification) | When a new organization signs up |
| `/demo-ready` | 12-check hospital pilot readiness validation | Before customer demos or pilot deployments |

### Compliance & Health

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/security-scan` | 11-check HIPAA compliance scan (PHI, RLS, CORS, MCP, secrets, auth) | Before commits, demos, audits |
| `/clinical-validate` | Check AI code validation hooks, rejection rates, reference data freshness | After clinical AI changes |
| `/fhir-check` | Verify FHIR server, patient data, EHR connections, SMART apps | Before demos or after FHIR changes |
| `/god-check` | Scan for files over 600 lines, suggest decomposition | Before commits, during refactoring |
| `/audit-check` | Verify auditLogger coverage, check for console.log violations, DB audit health | Before audits, compliance reviews |

### Monitoring

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/cost-check` | AI spending analysis across 26+ edge function skills + 19 service-layer skills | Monthly review, budget planning |
| `/test-runner` | Smart test execution (changed files, full suite, coverage) | During development |

---

## Codebase Baselines (for skill validation)

| Metric | Current Value | As Of |
|--------|--------------|-------|
| Tests | 11,699 passed, 0 failed | 2026-03-26 |
| Test Suites | 582 | 2026-03-26 |
| Lint | 0 errors, 0 warnings | 2026-03-26 |
| Typecheck | 0 errors in changed files | 2026-03-26 |
| Database tables | 248+ | 2026-03-03 |
| Edge functions | 144+ deployed | 2026-03-26 |
| MCP servers | 15 (13 green, 1 blocked, 1 excluded) | 2026-03-26 |
| AI skills (edge) | 28+ | 2026-03-26 |
| AI skills (service) | 19+ | 2026-03-03 |
| God files (>600 lines) | 0 | 2026-03-03 |
| `any` types in production | 0 | 2026-03-03 |

---

## Quick Usage

```bash
# Session start
/session-start               # Read state, report status, confirm priorities

# Daily development
/ship                        # Verify + commit + push
/test-runner                 # Run tests smartly
/deploy-edge <name>          # Deploy edge function(s)
/god-check                   # Check for oversized files

# Before demos
/demo-ready                  # 12-check pilot readiness
/security-scan               # HIPAA compliance scan
/fhir-check                  # FHIR interop health
/clinical-validate           # AI validation hooks health

# Compliance
/audit-check                 # Audit logging compliance
/security-scan               # HIPAA scan

# Monthly
/cost-check                  # AI spending analysis

# New customer
/onboard-tenant              # Full org onboarding workflow

# Planning
/plan                        # Create implementation plan from tracker
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
