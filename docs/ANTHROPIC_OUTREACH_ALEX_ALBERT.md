# A Non-Engineer Built Enterprise Healthcare Software with Claude Code

**For:** Alex Albert, Anthropic
**From:** Maria, AI Systems Director — Envision Virtual Edge Group LLC
**Date:** February 2026

---

## The One-Line Pitch

A superintendent with a degree in Social and Behavioral Science — not computer science — used Claude Code to build a HIPAA-compliant, FHIR-interoperable, multi-tenant healthcare platform. Total development cost: **$645**. No engineers. The key wasn't prompting. It was a governance document that controls AI output quality.

---

## Why This Should Matter to Anthropic

You're a safety company. I built a **working proof** that governance documents can control AI behavior at scale — in production, in healthcare, with patient data on the line. This isn't a research paper. It's 8,190 passing tests.

### What I Proved

1. **Domain expertise > coding knowledge.** A 23-year RN (my co-founder Akima) knows what clinical workflows should do. That knowledge is irreplaceable. Coding syntax is not.

2. **Governance documents > prompt engineering.** I don't write better prompts. I wrote a control system (CLAUDE.md) that makes Claude write better code. Every session. Without me watching.

3. **AI failure modes are predictable and preventable.** I catalogued 20+ failure patterns, identified why each one happens (training data bias, completion bias, shortcut instinct), and built specific countermeasures for each.

4. **Non-technical people can direct AI to build enterprise software.** Not a demo. Not a prototype. A platform a hospital president is interested in evaluating.

---

## The Numbers

### Platform Scale

| Metric | Count |
|--------|-------|
| Database tables (PostgreSQL 17) | 248 |
| Edge functions (Deno) | 144 |
| AI-powered services (Claude) | 40+ |
| Test suites | 403 |
| Individual tests | 8,190 |
| Service files | 503 |
| MCP servers | 10 |
| Lint warnings | 0 (down from 1,671) |

### Development Metrics (One Month Sample)

| Metric | Value |
|--------|-------|
| Claude Code sessions | 2,125 |
| Total Claude Code hours | 868 |
| Commits | 1,989 |
| Full task achievement rate | 72% |
| Friction events | 0 |

### Cost

| Item | Cost |
|------|------|
| Claude Code subscription | ~$200/mo |
| Supabase (database) | ~$25/mo |
| Total over 9 months | ~$645 |
| Traditional engineering team estimate | $500K-$2M+ |

---

## The Product

**Two products. One shared spine. Deployable together or independently.**

| Product | Purpose | Users |
|---------|---------|-------|
| **WellFit** | Community wellness engagement (check-ins, mood tracking, gamification) | Seniors, caregivers |
| **Envision Atlus** | Clinical care management (bed board, FHIR, billing, medication safety) | Hospitals, clinicians |

### Healthcare Compliance Built In

- **HIPAA**: PHI never in browser, audit logging on all mutations, PHI access logs
- **FHIR R4**: Full resource CRUD, patient bundles, EHR sync
- **HL7 v2.x**: Message parsing, FHIR conversion, ACK generation
- **X12**: 837P claim generation, 835 remittance processing, 270/271 eligibility
- **21st Century Cures Act**: Patient health record access (My Health Hub)
- **CMS-HCC V28**: Risk adjustment, HCC opportunity detection
- **Multi-tenant**: Row-level security, tenant isolation, white-label branding

---

## The Governance Innovation

This is what I think Anthropic should care about most.

### The Problem

AI coding assistants have predictable failure modes. They use `any` types because it's shorter. They leave `console.log` in production code. They write junk tests that pass for empty components. They guess when they should ask. They take shortcuts because their training rewards task completion over quality.

Every developer using Claude Code fights these same patterns. Most don't realize the patterns are predictable and preventable.

### My Solution: CLAUDE.md as a Control System

I stopped thinking of CLAUDE.md as instructions to AI. I started thinking of it as a **control system over AI**.

**What's in it:**

| Section | Purpose |
|---------|---------|
| 12 Commandments | Non-negotiable rules that catch 80% of issues |
| AI Failure Mode Table | 20+ patterns with root cause analysis and countermeasures |
| The STOP AND ASK Protocol | Forces AI to pause instead of guessing |
| Sub-Agent Governance | Same rules apply to background workers — no exceptions |
| Verification Checkpoint | Hard gate: typecheck + lint + test with reported numbers |
| Test Quality Standards (Deletion Test) | "Would this test fail for an empty `<div/>`?" |
| 600-Line File Limit | Prevents god files, forces modular architecture |
| Governance Boundary Map | Separates two products with explicit coupling rules |

**What makes it different from other CLAUDE.md files:**

Most CLAUDE.md files are 20-50 lines of project context. Mine is 600+ lines of behavioral control. It doesn't describe the project — it governs the AI building it.

### Automated Enforcement (Hooks)

Rules without enforcement are suggestions. I added PreToolUse hooks that fire before every tool call:

- **Bash hook**: Reminds Claude to use native Grep/Glob/Read instead of shell commands
- **Edit/Write hook**: Reinforces no `console.log`, no `any`, no wildcards

This solved the "reminder between friends" problem. The governance document competes with Claude's training weights. Automated enforcement tips the balance.

### Cross-AI Auditing

I used Claude Code AND ChatGPT to audit each other's work. This is how we went from 1,671 lint warnings to 0. One AI's blind spots are different from the other's. Cross-auditing catches what self-review misses.

---

## The Methodology

I wrote a full methodology document: **"AI Development Methodology — Building Enterprise Software Without Writing Code."**

Core framework:

1. **Observe** AI failure modes as they happen
2. **Document** each failure with root cause analysis
3. **Encode** countermeasures as unambiguous rules
4. **Consolidate** into a governance document
5. **Enforce** through automation, checklists, and verification gates
6. **Iterate** — when a rule fails, improve it; when AI ignores it, add stronger enforcement

**Key insight:** You don't fight the AI. You redirect it — like guardrails on a river. The water still flows, but now it goes where you need it.

---

## Who We Are

**Maria** — AI Systems Director. Degree in Social and Behavioral Science. Assistant Pastor. Developed the AI Development Methodology through 9 months of trial and error. Not a coder. Directed every line of code through Claude.

**Akima** — Chief Compliance and Accountability Officer. MDiv, BSN, RN, CCM. 23 years nursing experience. Reviews code quality and clinical compliance. The domain expertise that no AI can replace.

**Company:** Envision Virtual Edge Group LLC

**Product:** Envision ATLUS I.H.I.S. — Intelligent Healthcare Interoperability System
- ATLUS = Accountable Technology Leading in Unity and Service

---

## What I'm Asking For

1. **Look at this codebase.** Not just the code — the governance system. The CLAUDE.md. The methodology document. The hooks. The boundary map. The 8,190 tests.

2. **Consider this as a case study.** If Anthropic wants to show the world what Claude Code can do in the hands of a non-engineer, this is the strongest proof I'm aware of. $645. Two non-engineers. Enterprise healthcare.

3. **Consider the governance methodology.** The AI Development Methodology could help every Claude Code user write better software. It's not proprietary — it's a framework. If Anthropic published something like it, every user benefits.

4. **Talk to us.** We're building something real. A hospital president is interested. We're ready for a conversation about what this means for Claude Code, for AI-assisted development, and for healthcare.

---

## Links

| Resource | Location |
|----------|----------|
| CLAUDE.md (governance document) | `/CLAUDE.md` |
| Governance Boundary Map | `/.claude/rules/governance-boundaries.md` |
| AI Development Methodology | `/docs/architecture/AI_DEVELOPMENT_METHODOLOGY.md` |
| Claude Code Insights Report | `/docs/CLAUDE_CODE_INSIGHTS_REPORT.md` |
| Full codebase | This repository |

---

## Contact

**Maria** — maria@wellfitcommunity.com
**Akima** — akima@wellfitcommunity.com

---

*Built with Claude Code. Governed by CLAUDE.md. Proven by 8,190 tests.*
