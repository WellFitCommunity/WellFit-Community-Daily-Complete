# Skills Assessment — What You Have, What's Outdated, What's Missing

> **Date:** 2026-02-28
> **Context:** Maria asked: "locate my skills markdown and tell me if what's left would be beneficial"

---

## Current Skills (7 Active)

| # | Skill | Command | Status | Verdict |
|---|-------|---------|--------|---------|
| 1 | Ship | `/ship` | Current | Keep as-is |
| 2 | Plan | `/plan` | Current | Keep as-is |
| 3 | Security Scan | `/security-scan` | Outdated | Update needed |
| 4 | Demo Ready | `/demo-ready` | Very outdated | Needs rewrite |
| 5 | Cost Check | `/cost-check` | Outdated | Update needed |
| 6 | Test Runner | `/test-runner` | Outdated | Update needed |
| 7 | Pre-Commit | `/pre-commit` | Outdated | Update needed |

---

## Detailed Assessment of Each Skill

### 1. `/ship` — KEEP AS-IS
**File:** `.claude/skills/ship/SKILL.md`
**Assessment:** Clean, current, essential. The verify-commit-push workflow is exactly right. No changes needed.

### 2. `/plan` — KEEP AS-IS
**File:** `.claude/skills/plan/SKILL.md`
**Assessment:** Solid structured planning skill. Correctly checks tracker paths, creates plan files. No changes needed.

### 3. `/security-scan` — NEEDS UPDATE
**File:** `.claude/skills/security-scan/SKILL.md`
**Issues:**
- References old grep-based approach (should use Grep tool instead)
- Table count is old (says "87 tables" — now 248)
- Missing: MCP server security checks, rate limiting verification, CORS/CSP validation
- Missing: Edge function auth gate verification
- Missing: JWT/JWKS verification checks

**Recommended updates:**
- Add MCP server auth verification
- Add CORS wildcard scanning
- Update table counts
- Add edge function security checks
- Add `any` type scanning (to prevent regression)

### 4. `/demo-ready` — NEEDS REWRITE
**File:** `.claude/skills/demo-ready/SKILL.md`
**Issues (severe):**
- Still references **Methodist Hospital demo (Dec 5th, 2025)** — 3 months ago
- References `REACT_APP_*` env vars — should be `VITE_*` (migrated Dec 2025)
- Says "625+ tests" — now 10,304
- References old directory structure (`build/static/js/`)
- Lists only 3 edge functions — now 137
- References 87 RLS tables — now 248

**Recommended rewrite:**
- Rename concept from "Methodist demo" to "Hospital pilot readiness"
- Update all counts, paths, and env var references
- Add: MCP server health checks (all 11)
- Add: AI skill validation (confidence scoring, model pinning)
- Add: Cultural competency server check (once built)
- Add: FHIR interoperability smoke test
- Add: Compass Riley grounding verification

### 5. `/cost-check` — NEEDS UPDATE
**File:** `.claude/skills/cost-check/SKILL.md`
**Issues:**
- Says "11 AI automation skills" — now 26 edge function skills + 19 service-layer
- References deprecated skill numbers (#1, #5, #8 marked deprecated/not implemented)
- Budget figures may be stale ($100/month)
- Missing: MCP cost tracking (`mcp_cost_metrics` table now exists)

**Recommended updates:**
- Update skill count to reflect current 26+19 AI skills
- Add MCP cost metrics
- Remove deprecated skill references
- Update budget figures if changed

### 6. `/test-runner` — NEEDS UPDATE
**File:** `.claude/skills/test-runner/SKILL.md`
**Issues:**
- Says "625+ tests" — now 10,304 tests across 517 suites
- Performance estimates are wrong (50-60s for full suite — now much longer with 10K tests)
- Smart mode detection rules are basic — could include more patterns

**Recommended updates:**
- Update test baseline to 10,304
- Update suite count to 517
- Adjust performance estimates
- Add pattern for `src/components/admin/__tests__/` (most new tests live here)

### 7. `/pre-commit` — NEEDS UPDATE
**File:** `.claude/skills/pre-commit/SKILL.md`
**Issues:**
- Says "625+ tests" — now 10,304
- References GPG signing as required — verify this is still enforced
- Missing: `any` type regression check
- Missing: God file check (no file > 600 lines)
- Missing: Console.log check in all source files (not just PHI directories)

**Recommended updates:**
- Update test baseline
- Add god file check (`wc -l` on modified files)
- Add `any` type scan on modified files
- Expand console.log scan to all `src/` directories

---

## SKILLS_AND_COMMANDS.md — SEVERELY OUTDATED

**File:** `.claude/SKILLS_AND_COMMANDS.md`
**Last updated:** November 16, 2025 (4 months ago)

**Problems:**
- References Methodist Hospital demo (Dec 5th, 2025)
- Shows old directory structure (`commands/` directory — no longer exists)
- Lists old skill paths (`hipaa-check/`, `deploy/`, `ai-cost-monitor/`)
- All numbers are wrong (tests, tables, skills, functions)
- References `REACT_APP_*` env vars
- Lists 5 skills — now 7
- Entire "Methodist Demo Checklist" section is irrelevant

**Verdict:** This file should be rewritten from scratch to reflect the current 7 skills with correct paths, counts, and context.

---

## Skills That Would Be Beneficial to Add

### HIGH VALUE — Directly supports hospital readiness

| # | Proposed Skill | Command | What It Does | Why It Matters |
|---|---------------|---------|--------------|----------------|
| 1 | **Pilot Prep** | `/pilot-prep` | Hospital pilot readiness checklist — evolved from `/demo-ready` with real deployment validation | The thing you need NEXT when you find a pilot site |
| 2 | **Session Start** | `/session-start` | Automates the Session Start Protocol — reads PROJECT_STATE.md, reads CLAUDE.md, reports 5-line status | You require this every session; automating it saves time and prevents skipping |
| 3 | **FHIR Check** | `/fhir-check` | Validates FHIR R4 resource compliance, tests interoperability endpoints, verifies SMART on FHIR | Hospitals will ask "does your FHIR actually work?" |
| 4 | **Clinical Validation** | `/clinical-validate` | Runs SOAP note accuracy tests, checks readmission prediction format, validates grounding rules | Builds the validation data CMOs will want to see |

### MEDIUM VALUE — Operational efficiency

| # | Proposed Skill | Command | What It Does | Why It Matters |
|---|---------------|---------|--------------|----------------|
| 5 | **Deploy Edge** | `/deploy-edge` | Deploy edge functions with pre/post verification | You do this frequently; a skill standardizes the process |
| 6 | **God File Check** | `/god-check` | Scan all files for >600 line violations, report decomposition needed | Prevents the problem you've solved 14+ times already |
| 7 | **Tenant Onboard** | `/onboard-tenant` | Checklist for onboarding a new organization: CORS origins, branding, module config, user roles | You'll need this the moment a second org signs up |

### NICE TO HAVE — Future value

| # | Proposed Skill | Command | What It Does | Why It Matters |
|---|---------------|---------|--------------|----------------|
| 8 | **Audit Trail** | `/audit-check` | Verify audit logging coverage across services | SOC2 auditors will test this |
| 9 | **AI Transparency Report** | `/ai-report` | Generate HTI-2 transparency report for all AI skills | Regulatory requirement — automates compliance doc |
| 10 | **Codebase Health** | `/health` | Quick snapshot: tests, lint, typecheck, god files, any-type count, bundle size | Faster than running 3 separate commands |

---

## Recommended Action Plan

### Immediate (This Session or Next)

1. **Rewrite `SKILLS_AND_COMMANDS.md`** — it's embarrassingly outdated. If a hospital evaluator or Anthropic sees it referencing "Methodist demo Dec 5th" and "625 tests," it undermines credibility.

2. **Update test baselines in all 4 outdated skills** — change "625+" to "10,304" in `/security-scan`, `/demo-ready`, `/test-runner`, `/pre-commit`.

3. **Rewrite `/demo-ready` as `/pilot-prep`** — shift from a single demo event to an ongoing pilot readiness check.

### Near-Term (Next 2-3 Sessions)

4. **Add `/session-start`** — you already require this protocol; making it a skill ensures consistency.

5. **Add `/health`** — quick codebase snapshot; most useful skill for daily work.

6. **Enhance `/security-scan`** — add MCP server checks, CORS validation, edge function auth.

### When Pilot Site Is Found

7. **Add `/pilot-prep`** — comprehensive deployment checklist for real hospital use.

8. **Add `/fhir-check`** — prove interoperability works.

9. **Add `/clinical-validate`** — build the validation data.

10. **Add `/onboard-tenant`** — first customer onboarding workflow.

---

## Summary

**Your 7 skills are the right skills.** The problem isn't what you have — it's that 5 of 7 haven't been updated since the codebase quadrupled in size. The numbers are wrong, the references are stale, and `/demo-ready` still talks about a demo from 3 months ago.

**Fix the outdated ones first.** Then add `/session-start`, `/health`, and `/pilot-prep` as the highest-value new skills. The rest can wait until you have a pilot site.
