# Governance Knowledge Map

**Purpose:** Make the platform's governance system transferable. If Maria is unavailable, any qualified person (or AI agent) should be able to understand how this system is governed by reading the documents below in order.

**Last Updated:** 2026-03-12

---

## The Problem This Solves

The governance knowledge for WellFit + Envision Atlus was built by Maria (AI System Director) over 11 months. Without this map, that knowledge lives in one person's head — a single point of failure for an enterprise system.

This document is the **table of contents for governance**. It does not contain rules itself. It tells you where every rule lives and why it exists.

---

## Reading Order for New Team Members

Read these in order. Each builds on the previous.

| # | Document | What You Learn | Time |
|---|----------|----------------|------|
| 1 | `docs/architecture/AI_DEVELOPMENT_METHODOLOGY.md` | Why this system exists and the philosophy behind it | 15 min |
| 2 | `CLAUDE.md` (project root) | Every rule AI agents must follow | 20 min |
| 3 | `.claude/rules/governance-boundaries.md` | System A vs System B vs Shared Spine boundaries | 15 min |
| 4 | `docs/DEVELOPER_ONBOARDING.md` | How to set up and start contributing | 10 min |
| 5 | `.claude/rules/supabase.md` | Database, RLS, migration, and edge function rules | 10 min |
| 6 | `docs/compliance/DATA_GOVERNANCE.md` | PHI handling, retention, deletion, classification | 10 min |
| 7 | `docs/compliance/AI_DECISION_AUDIT_CHAIN.md` | How AI decisions are traced and audited | 10 min |

**Total onboarding time: ~90 minutes** to understand the governance system.

---

## Governance Document Inventory

### Tier 1: Authority Documents (Override Everything)

These are the highest-authority governance docs. If any other document contradicts these, these win.

| Document | Path | Governs |
|----------|------|---------|
| **CLAUDE.md** | `/CLAUDE.md` | All AI agent behavior, coding standards, verification gates |
| **Governance Boundaries** | `/.claude/rules/governance-boundaries.md` | System A/B/Shared separation, table ownership, coupling rules |
| **AI Repair Authority** | `/.claude/rules/ai-repair-authority.md` | What AI can change autonomously vs. what requires approval |

### Tier 2: Domain Rules

| Document | Path | Governs |
|----------|------|---------|
| Supabase Rules | `/.claude/rules/supabase.md` | Database, RLS, migrations, edge functions |
| Visual Acceptance | `/.claude/rules/visual-acceptance.md` | UI/3D verification requirements |
| Implementation Discipline | `/.claude/rules/implementation-discipline.md` | Planning, time estimates, pre-push checks |
| Component Library | `/.claude/rules/component-library.md` | EA design system usage |

### Tier 3: Compliance & Operations

| Document | Path | Governs |
|----------|------|---------|
| Data Governance | `/docs/compliance/DATA_GOVERNANCE.md` | PHI, PII, retention, deletion, export |
| AI Decision Audit Chain | `/docs/compliance/AI_DECISION_AUDIT_CHAIN.md` | Causal traceability for AI decisions |
| Incident Playbooks | `/docs/operations/INCIDENT_PLAYBOOKS.md` | Response procedures for 17 incident types |
| HIPAA Risk Assessment | `/docs/compliance/HIPAA_RISK_ASSESSMENT.md` | HIPAA gap analysis |
| Access Control Matrix | `/docs/compliance/ACCESS_CONTROL_MATRIX.md` | Role-based access rules |
| Data Retention Policy | `/docs/compliance/DATA_RETENTION_POLICY.md` | What we keep and for how long |

### Tier 4: Architecture & Design

| Document | Path | Governs |
|----------|------|---------|
| AI-First Architecture | `/docs/architecture/AI_FIRST_ARCHITECTURE.md` | MCP servers, AI service design |
| AI Development Methodology | `/docs/architecture/AI_DEVELOPMENT_METHODOLOGY.md` | How to build software with AI governance |
| Envision Atlus Design | `/docs/architecture/ENVISION_ATLUS_DESIGN.md` | EA design system spec |
| MCP Server Architecture | `/docs/architecture/MCP_SERVER_ARCHITECTURE.md` | MCP server patterns |

### Tier 5: Enforcement Scripts

| Script | Path | What It Enforces |
|--------|------|-----------------|
| Governance Check | `/scripts/governance-check.sh` | Import boundaries, forbidden patterns, file limits |
| Governance Drift | `/scripts/governance-drift-check.sh` | Documented state vs. actual state |
| Scoped Typecheck | `/scripts/typecheck-changed.sh` | TypeScript errors in changed files only |
| Security Check | `/scripts/security-check.sh` | Secrets, CORS, vulnerability scan |

### Tier 6: Skills (Automated Workflows)

| Skill | Path | When Used |
|-------|------|-----------|
| `/ship` | `/.claude/skills/ship/SKILL.md` | Verify + commit + push |
| `/pre-commit` | `/.claude/skills/pre-commit/SKILL.md` | Pre-commit quality gate |
| `/security-scan` | `/.claude/skills/security-scan/SKILL.md` | HIPAA compliance check |
| `/demo-ready` | `/.claude/skills/demo-ready/SKILL.md` | Hospital pilot readiness |
| `/plan` | `/.claude/skills/plan/SKILL.md` | Implementation planning |
| `/cost-check` | `/.claude/skills/cost-check/SKILL.md` | AI cost analysis |
| `/test-runner` | `/.claude/skills/test-runner/SKILL.md` | Smart test execution |

---

## Decision Authority Matrix

Who can approve what:

| Decision Type | Maria | Akima | AI (Tier 1) | AI (Tier 2) | AI (Tier 3+) |
|---------------|-------|-------|-------------|-------------|--------------|
| Code changes (bug fixes) | Yes | Yes | Yes | Notify | No |
| Schema changes | Yes | No | No | No | No |
| Security config changes | Yes | Review | No | No | No |
| Clinical AI model changes | Yes | Review | No | No | No |
| Governance doc changes | Yes | Review | No | No | No |
| Test additions | Yes | Yes | Yes | Notify | No |
| Delete anything | Yes | No | No | No | No |
| New edge functions | Yes | No | No | No | No |
| FHIR mapping changes | Yes | Akima reviews clinical accuracy | No | No | No |

---

## Governance Maintenance Schedule

| Frequency | Task | Script/Process |
|-----------|------|----------------|
| Every commit | Scoped typecheck + lint + tests | `bash scripts/typecheck-changed.sh && npm run lint && npm test` |
| Weekly | Run governance check | `bash scripts/governance-check.sh` |
| Monthly | Run governance drift report | `bash scripts/governance-drift-check.sh` |
| Monthly | Review AI cost metrics | `/cost-check` skill |
| Quarterly | Full security scan | `/security-scan` skill |
| Quarterly | Review and update this document | Manual review |
| Before any demo | Full readiness check | `/demo-ready` skill |

---

## Key Contacts

| Role | Person | Expertise | Approves |
|------|--------|-----------|----------|
| AI System Director | Maria | Architecture, governance, AI methodology | Everything |
| Chief Compliance & Accountability Officer | Akima | Clinical accuracy, HIPAA, nursing workflows | Clinical content, compliance |

---

## If Maria Is Unavailable

1. **Read this document** and the Tier 1 authority docs
2. **Do NOT change governance documents** without Maria's review
3. **Do NOT change schema** without Maria's approval
4. **Bug fixes and test additions** are safe (Tier 1 AI authority)
5. **Run `/demo-ready`** to verify system health
6. **When in doubt, don't change it** — wait for Maria
