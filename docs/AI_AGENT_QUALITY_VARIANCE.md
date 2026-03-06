# Not All Claude Agents Are Created Equal

> **Author:** Maria (AI System Director) + Claude Opus 4.6
> **Date:** 2026-03-06
> **Purpose:** Document the observed quality variance across AI agent sessions, sub-agents, and models — and what governance controls actually work.

---

## The Core Observation

Every Claude session, sub-agent, and parallel worker uses the same model weights. They all have access to CLAUDE.md. They all "know" the rules.

**But they do not all follow them equally.**

This is not a bug — it's a property of how large language models work. Each session is a fresh context window. Each sub-agent gets a subset of instructions. The result is **predictable variance** that must be governed, not wished away.

---

## Where Variance Shows Up

### 1. Lead Agent vs Sub-Agent Quality Gap

| Behavior | Lead Agent | Sub-Agent |
|----------|-----------|-----------|
| Reads CLAUDE.md thoroughly | Usually (with reminders) | Rarely unless explicitly told |
| Follows `any` type ban | ~90% compliance | ~60% compliance |
| Uses `auditLogger` over `console.log` | ~95% compliance | ~70% compliance |
| Runs typecheck before declaring "done" | With hooks enforcing it | Almost never unless instructed |
| Stops when stuck | Sometimes | Almost never — iterates blindly |
| Reads type definitions before writing code | With reminders | Skims or guesses |

**Why:** Sub-agents receive compressed instructions. The lead agent may say "follow CLAUDE.md" but the sub-agent gets a summary, not the full 600+ line governance document. Rules that aren't in the sub-agent's context window don't exist for that sub-agent.

### 2. Session-to-Session Drift

The same model in Monday's session may produce different quality than Thursday's session, even with identical instructions. Contributing factors:

| Factor | Impact |
|--------|--------|
| Context window position | Rules read at message #1 carry less weight by message #50 |
| Compaction events | Context compression can drop early-session constraints |
| Task complexity | Complex multi-file changes increase error rate regardless of rules |
| Training weight competition | CLAUDE.md rules compete with patterns learned during training |
| Skim vs Ingest | AI may skim a file looking for what it expects rather than reading what's there |

### 3. The "Confident But Wrong" Pattern

AI agents don't say "I'm not sure." They produce output that reads as confident even when the underlying logic is flawed. This manifests as:

- Writing code against an API that doesn't exist (assumed from method name)
- Using enum values that "sound right" without checking the union type
- Declaring work "done" when typecheck hasn't been run
- Writing tests that test what the code *should* do rather than what it *actually* does
- Claiming "I verified" without running the verification

**This is the most dangerous variance** because it's invisible without external checks.

---

## What Actually Controls Variance

### Tier 1: Structural Controls (Most Effective)

These work because they don't rely on the AI choosing to comply.

| Control | Mechanism | Effectiveness |
|---------|-----------|---------------|
| **Hooks** (`.claude/settings.json`) | Automated reminders triggered on every tool call | High — AI sees rules at point of action |
| **Pre-commit gates** | `npm run typecheck && npm run lint && npm test` must pass | High — broken code physically can't ship |
| **Type system** | TypeScript compiler rejects `any`, wrong types, missing fields | High — errors are caught mechanically |
| **RLS policies** | Database rejects unauthorized access regardless of code | High — security is structural |

### Tier 2: Governance Documents (Moderately Effective)

These work when the AI reads and retains them, which is not guaranteed.

| Control | Mechanism | Effectiveness |
|---------|-----------|---------------|
| **CLAUDE.md** | Comprehensive rule document loaded at session start | Medium — degrades over long sessions |
| **Rules files** (`.claude/rules/`) | Topic-specific rules always in context | Medium-High — smaller, more focused |
| **MEMORY.md** | Persistent cross-session patterns | Medium — helps with known issues |
| **Trackers** | `docs/trackers/*.md` for progress tracking | Medium — prevents duplicate work |

### Tier 3: Verbal Instructions (Least Reliable)

These depend entirely on context window position and attention.

| Control | Mechanism | Effectiveness |
|---------|-----------|---------------|
| "Remember to check types" | One-time instruction in conversation | Low — forgotten within 10 messages |
| "Follow the rules" to sub-agents | Delegation instruction | Low — compressed away |
| "Be careful" | General caution | Near zero — too vague to act on |

---

## The Sub-Agent Problem — In Detail

When the lead agent delegates to sub-agents, quality drops because:

1. **Compressed context** — Sub-agents get a task description, not the full governance framework
2. **No hooks** — Sub-agents may not trigger the same PreToolUse hooks
3. **No verification gate** — Sub-agents often declare "done" without running typecheck
4. **No STOP AND ASK** — Sub-agents optimize for completion, not correctness
5. **Lead agent trusts output** — The lead agent may accept sub-agent work without verifying it

### Current Mitigation (CLAUDE.md Section: Sub-Agent Governance)

> "All sub-agents are subject to the EXACT same rules as the lead agent."
> "The lead agent owns the quality of all delegated work."

**Reality check:** This rule is stated but not structurally enforced. The lead agent must manually verify sub-agent output. When the lead agent is also managing 5 parallel sub-agents, verification depth drops.

---

## Items Requiring Akima's Review

The following items from the MCP Production Readiness Tracker need clinical review before they can be marked complete. These are NOT code tasks — they require domain expertise.

### P1-1: DRG Grouper Validation Table

**What it is:** The DRG grouper uses Claude AI to suggest DRG codes. Currently there's no reference table to validate whether the AI's suggested DRG code actually exists in the current MS-DRG table.

**What Akima should review:**
- [ ] Is Option 1 (build `ms_drg_reference` table with valid codes + weights + MDC mappings) sufficient for pilot?
- [ ] Should we require Option 2 (external grouper API like Optum/3M) before any hospital demo?
- [ ] Which DRG version year should we seed? (FY2026 starts October 2025)
- [ ] Are there specific high-risk DRG categories (cardiac, orthopedic, maternal) that need priority validation?

**Risk if not reviewed:** Revenue cycle decisions based on unvalidated AI output. No hospital will accept this.

### P4-4: Cultural Competency Profiles — Clinical Accuracy

**What it is:** The Cultural Competency MCP server contains detailed profiles for veteran, African American, Hispanic/Latino, and Native American populations. These include prevalence rates, screening tools, drug interactions, and trust-building guidance.

**What Akima should review:**
- [ ] Are prevalence rates current and sourced correctly?
- [ ] Are screening tools (PHQ-9, AUDIT-C, PC-PTSD-5, etc.) correctly referenced?
- [ ] Are drug interaction warnings (e.g., ACE inhibitor + African American patients) clinically accurate?
- [ ] Are trust-building recommendations culturally appropriate and not stereotyping?
- [ ] Are there missing populations that should be added for pilot readiness?

**Risk if not reviewed:** Clinically detailed content that looks authoritative but may contain AI-generated inaccuracies. One wrong prevalence rate undermines credibility of the entire system.

### P1-6: Adversarial Constraint Testing (Post-Implementation Review)

**What it is:** After the ~50 adversarial test cases are built, Akima should review whether the test scenarios represent realistic clinical edge cases.

**What Akima should review (after tests are built):**
- [ ] Do the adversarial test inputs represent things that would actually appear in clinical documentation?
- [ ] Are there additional edge cases from nursing experience that should be tested? (e.g., verbal orders, abbreviation interpretation, medication reconciliation discrepancies)
- [ ] Are the "expected correct responses" actually correct? (e.g., when the AI correctly refuses to upcode, is the refusal message clinically appropriate?)

**Status:** Not ready for review yet — P1-6 is not started. Flag for Akima after implementation.

---

## Implications for System Design

The variance problem doesn't go away with better prompts. It requires **structural enforcement** — controls that work regardless of whether the AI "remembers" the rules.

This is why:
- **Hooks > verbal instructions** — they fire every time, not just when remembered
- **Type systems > code review** — the compiler doesn't have attention drift
- **Database constraints > application logic** — RLS doesn't care what the AI "intended"
- **Post-output validation > prompt constraints** — catching bad output is more reliable than preventing it

The governance system Maria built (CLAUDE.md + hooks + rules + trackers) is the right architecture. The gap is in **structural enforcement density** — more hooks, more automated gates, more mechanical checks that don't depend on AI compliance.

---

## Next Step: Custom Hooks for Consistent AI Output

See discussion with Maria on expanding `.claude/settings.json` hooks to add more structural controls for AI output consistency.

---

*This document is part of the Envision ATLUS governance framework. It reflects observed patterns from 2,000+ AI coding sessions across 9 months of development.*
