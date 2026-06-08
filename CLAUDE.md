# Claude Instructions for WellFit-Community-Daily-Complete

> **Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.**
> Proprietary and confidential. This document and the software it governs are the exclusive property of Envision Virtual Edge Group LLC. Unauthorized use, disclosure, or distribution is strictly prohibited. See [LICENSE](LICENSE) for full terms. Contact: maria@wellfitcommunity.com

---

> ## Why this document exists
>
> **Maria found a way to make AI build to a standard it has no native ability to hold.**
>
> That is the entire purpose of this file. The AI is fluent, fast, and confident — and it produces plausible, broken code by default. This document is the control system that turns that output into production-grade, HIPAA- and SOC 2-aligned healthcare software. The rules below are not suggestions; they are the standard the AI cannot hold on its own.

---

## Quick Reference - The 10 Commandments

| # | Rule | Violation = Reject |
|---|------|-------------------|
| 1 | **STOP AND ASK** if unclear, blocked, or choosing between approaches | Guessing, improvising |
| 2 | **No `any` type** - use `unknown` + type guards (see `.claude/rules/typescript.md`) | `data: any`, `catch (err: any)` |
| 3 | **No `console.log`** - use `auditLogger` for all logging | Any console.* in production |
| 4 | **Run scoped typecheck** on changed files before considering work done | Skipping type verification |
| 5 | **All tests must pass** - no skips, no deletions | `.skip()`, `.only()`, deleting tests |
| 6 | **No workarounds** - if blocked, ask Maria | "temporary fix", "for now", "hack" |
| 7 | **Vite environment** - `import.meta.env.VITE_*` only | `process.env.REACT_APP_*` |
| 8 | **No PHI in browser** - patient IDs only, data stays server-side | Names, SSN, DOB in frontend |
| 9 | **Run migrations you create** - `npx supabase db push` | Unexecuted migration files |
| 10 | **No CORS/CSP wildcards** - use explicit `ALLOWED_ORIGINS` only | `frame-ancestors *`, `connect-src *`, `WHITE_LABEL_MODE=true` |
| 11 | **Report verification counts** - typecheck/lint/test pass counts before commit | "I checked" without numbers |
| 12 | **No god files** - 600 line max per file, decompose don't degrade | Any file exceeding 600 lines |
| 13 | **Visual acceptance required** - new UI/3D features need Maria's eyes before "done" | Declaring visual work complete without screenshot/verification |
| 14 | **Pin AI model versions** - explicit model ID in `ai_skills.model`, never `latest` | Unversioned model references in clinical AI |
| 15 | **Synthetic test data only** - obviously fake names/DOBs in test fixtures | Realistic-looking PHI in test code |
| 16 | **Structured AI output** - new AI edge functions must define a JSON response schema | Free-text parsing in new AI integrations |
| 17 | **Clean working tree per commit** — every commit either includes ALL working-tree changes or you explicitly tell Maria what you're deferring and why. Never leave the user to discover dirty files. | Pre-existing dirty files silently ignored at commit time |
| 18 | **Verify live DB state, don't trust the repo** — before writing or applying a migration, query the live DB via Supabase MCP `execute_sql` to confirm the table/function/policy is in the state the repo says it's in. `supabase/migrations/` is INPUT, not SOURCE OF TRUTH. | Writing a migration against an aspirational schema (this caused DRIFT-1 and DRIFT-2) |
| 19 | **Sub-agent permission failure = lead agent executes** — if a sub-agent reports it was blocked from writing files, the LEAD agent must do the work in foreground, not defer. The agent's research output is still useful; the agent's silence is not. | "My sub-agent couldn't write, so I left it for next session" |
| 20 | **Two PHI keys, never conflate** — WellFit uses Supabase Secrets `PHI_ENCRYPTION_KEY`; Envision Atlus uses Supabase Vault `app.encryption_key`. They are DIFFERENT credentials for DIFFERENT data scopes. Always read `.claude/rules/supabase.md` §17 before touching PHI encryption code. | Assuming a single master key, breaking clinical-side encryption |
| 21 | **DONE MEANS DONE** — for the scoped task, "done" is **complete, entirely connected, in working order for a real user**. NOT "tests pass" or "code compiles." All seven must be true: (a) code compiles, (b) tests pass, (c) the scoped workflow runs end-to-end against the live system (RLS, auth, audit log all green), (d) the feature is reachable from a real entry point (nav link, button, route — not just a URL you type), (e) all required identity/tenant/audit fields are populated on persist, (f) any "follow-ups" are clearly optional enhancements, not defects you're hiding, (g) the verification report includes evidence the workflow actually worked (a row in the DB, a screenshot, a live curl). Mark "done" before that = a lie. | Calling work done when a defect is filed as "follow-up". Saying "tests pass ✅" when the form fails RLS on real submit. Shipping routes with zero nav links and claiming the feature works. (Caught 2026-05-28 on ONC-1 + ONC-2 — see this commit and PROJECT_STATE.md.) |

### Session Start Protocol — EVERY NEW SESSION

**Before any work, read these two files in order:**

1. `docs/PROJECT_STATE.md` — Where we left off, current priorities, blocked items
2. `CLAUDE.md` — Governance rules (this file)

**Then report a 5-line status summary:**
```
1. Last session: [date] — [what was completed]
2. Current priority: [tracker name] — [next item]
3. Codebase health: [tests/lint/typecheck from last known]
4. Blocked: [items or "None"]
5. Estimated remaining: [sessions for current priority]
```

**Confirm with Maria before starting work.**

### Before Every Task
```bash
git log --oneline -3     # Review recent commits
npm run lint             # Check for warnings
```

**Note:** Full `npm run typecheck` and `npm test` are run AFTER your work, not before. Don't waste time typechecking code you haven't touched yet.

### Error Handling Template
```typescript
catch (err: unknown) {
  await auditLogger.error('OPERATION_FAILED',
    err instanceof Error ? err : new Error(String(err)),
    { context: 'data here' }
  );
  return failure('OPERATION_FAILED', 'User-friendly message');
}
```

### Mandatory Verification Checkpoint - NO EXCEPTIONS

**Before ANY commit or declaring work "done", you MUST run and report:**

```bash
# Scoped typecheck — only YOUR changes, not the whole system
bash scripts/typecheck-changed.sh && npm run lint && npm test
```

**When to use which typecheck:**

| Situation | Command | Why |
|-----------|---------|-----|
| After completing a task | `bash scripts/typecheck-changed.sh` | Fast — only checks files you touched |
| Before a major release/demo | `npm run typecheck` | Full system verification (rare) |
| Debugging a type issue | `npx tsc --noEmit 2>&1 \| grep "src/path/to/file"` | Targeted investigation |

**Report format (copy exactly):**
```
✅ typecheck (scoped): 0 errors in changed files
✅ lint: 0 errors, 0 warnings
✅ tests: X passed, 0 failed
```

Or if failing:
```
❌ typecheck (scoped): 3 errors in changed files (list them)
❌ lint: 1 error in src/components/Foo.tsx:42
❌ tests: X passed, Y failed (list failed test names)
```

**Rules:**
1. **Run the actual commands** - Do not skip or claim "I already checked"
2. **Report the final counts** - Not 500 lines, just the summary numbers
3. **If ANY fail, FIX FIRST** - Do not commit broken code
4. **If stuck fixing for 2+ attempts, STOP AND ASK** - Don't keep iterating blindly
5. **You are responsible for YOUR errors, not pre-existing ones** - Scoped typecheck separates the two

**This is a HARD GATE. Work is not complete without this checkpoint.**

---

## Common AI Mistakes - Why These Rules Exist

This codebase eliminated 1,400+ `any` violations and 1,671 total lint warnings in January 2026. These rules exist because AI coding assistants consistently make these mistakes:

| AI Mistake | Our Prevention | Why AIs Do This |
|------------|----------------|-----------------|
| `catch (err)` or `catch (e: any)` | Requires `err: unknown` | AIs copy legacy patterns from training data |
| `console.log` debugging left in code | Requires `auditLogger` | Quick output during generation |
| Creating new files instead of editing | "Prefer editing existing files" | Starting fresh feels easier than understanding |
| Guessing when blocked | STOP AND ASK protocol | AIs want to appear helpful, not "stuck" |
| "Temporary" workarounds | No workarounds policy | Solves immediate problem, defers pain |
| `process.env.REACT_APP_*` | Requires `import.meta.env.VITE_*` | CRA patterns dominate training data |
| `forwardRef()` wrapper | React 19 ref-as-prop | Pre-React 19 patterns in training |
| Deleting "unused" code aggressively | "Tables that exist are FEATURES" | Cleanup instinct without context |
| Skipping tests with `.skip()` | Explicitly forbidden | Makes the error "go away" |
| Over-engineering simple requests | "Surgeon, not butcher" | AIs love showing off abstractions |
| Not verifying routes are wired | Route connectivity check | Writes component, forgets App.tsx |
| Silent error swallowing | Must log + return `failure()` | Empty catch blocks "handle" errors |
| PHI in frontend code | HIPAA section | Doesn't understand data sensitivity |
| Committing without running typecheck | Required before completion | Eager to show "done" |
| Using `as Error` instead of narrowing | `err instanceof Error ? ...` | Shorter = seems better |
| CORS/CSP wildcards (`*`) | Explicit `ALLOWED_ORIGINS` required | "Permissive = easier" mentality |
| Claiming "I verified" without proof | Must report pass/fail counts | Poor self-debugging; sees intent not reality |
| Iterating on broken code instead of stopping | STOP AND ASK when stuck | Wants to appear helpful, not stuck |
| Writing junk tests (`toBeTruthy`, "renders") | Deletion Test: would it fail for empty `<div>`? | Optimizes for test count, not test quality |
| Testing CSS classes instead of behavior | Test user-visible outcomes | CSS tests are easy, behavior tests require understanding |
| Creating god files (600+ lines) | Decompose into focused modules | Bolting features onto one file is easiest path |
| Claiming refactor was done without verifying | Check `wc -l` on the actual file | AI sees intent ("I planned to") as completion ("I did it") |
| Sub-agents ignoring CLAUDE.md rules | Sub-Agent Governance: same rules, no exceptions | Lead agent delegates but forgets to enforce rules on workers |
| Declaring visual work "done" without showing it | Visual Acceptance Checkpoint: Maria must see it rendered | AI cannot judge visual quality from code — SVG paths that compile can still look like a gingerbread man |
| Re-reading own buggy code and seeing "looks right" | STOP AND ASK after 2+ failed fix attempts | AI sees what it *intended* to write, not what it *actually* wrote — like a typo your brain autocompletes |
| `vi.clearAllMocks()` doesn't reset `mockImplementation` | Reset mock implementations explicitly in `beforeEach` | AI assumes "clear all" means "reset all" — one test's mock setup silently poisons every test after it |
| `<label>` next to `<input>` without `htmlFor`/`id` pairing | Always pair `htmlFor` + `id` on label/input | AI thinks visually ("they're next to each other") but `getByLabelText` needs DOM association, not proximity |
| Typing an API response interface from one sample | Test with `null`, absent, and empty-array variants | AI builds the type from *one example* — fields that are sometimes `null` or missing get typed as `string` |
| Importing `.ts` files in edge functions without extension | Deno requires explicit `.ts` extensions; Node/Vite strips them | AI doesn't track which runtime it's writing for — same import syntax, different rules |
| Writing service code before confirming migration was pushed | Run `npx supabase db push` immediately after creating migration | AI sees the migration *file* as proof the column exists — but the real database doesn't have it until pushed |
| Writing tests that mirror implementation instead of specifying behavior | Deletion Test: would it fail if component logic was removed? | AI writes code and test simultaneously, unconsciously shaping the test to pass what it just wrote (confirmation bias) |
| Losing early-session decisions after 50+ tool calls | Summarize at compaction: what's done, what's next, constraints established | Context window compression drops early decisions — AI may re-introduce patterns it already fixed or forget constraints from message #3 |
| Fixing a bug in one file but not grepping for sisters | Codebase-wide grep on EVERY fix (see `adversarial-audit-lessons.md`) | AI fixes the file it's looking at but doesn't search for the same bug in 50 other files — bug "fixed" but still broken in 3 places |
| Shipping edge functions with zero auth | Every edge function MUST have JWT + role + tenant check | AI writes the business logic first and "plans to add auth later" — then forgets or declares it done |
| Putting API keys in `VITE_*` env vars | `VITE_` = browser-visible; secrets go in edge functions only | AI sees `VITE_` as "config" without understanding it ships to every browser |
| `WITH CHECK (true)` on audit/security tables | Identity columns must enforce `auth.uid()` | AI makes RLS "work" by making it permissive — passing tests but destroying security |
| Querying `profiles.id` instead of `profiles.user_id` | `profiles` PK is `user_id` — see rule 8 in `adversarial-audit-lessons.md` | AI assumes `id` is the primary key because that's the convention in most tables |
| `functions.invoke('send_email')` when directory is `send-email` | Invocation names = directory names (dashes, not underscores) | AI guesses the name instead of checking `ls supabase/functions/` |
| Decoding JWT with `atob()` instead of verifying | ALWAYS use `supabase.auth.getUser(token)` in edge functions | AI sees decoding as "reading" the token — doesn't understand verification vs parsing |
| Shadowing imported variables (`const X = X`) | Use imports directly or rename local variables | AI creates "local copies" of imports out of habit — creates confusion and potential TDZ bugs |
| Grading own work without codebase-wide audit | Run adversarial audit with different AI before demos/pilots | AI has confirmation bias — sees what it intended to write, not what's actually there across 500+ files |
| Leaving dirty working-tree files at session end | Every commit either includes ALL working-tree changes OR explicitly tell Maria what is being deferred. Untracked docs from prior sessions get the same disposition decision. | AI defaults to "not my work, not my problem" and leaves the user to discover dirty files later (2026-05-27 incident: 5 prior-session strategy docs + a tracked .temp file all left behind after a 42-file commit) |
| Trusting `supabase/migrations/` as the source of truth for live DB state | Live DB can drift — functions get dropped, tables get repurposed, RLS policies get replaced out-of-band. Before writing a migration that depends on a known table/function existing, query the live DB via Supabase MCP `execute_sql`. | AI reads the migration files and assumes they reflect what's in production. DRIFT-1 (RLS already correct in prod but migrations source was outdated) and DRIFT-2 (log_handoff_override RPC silently dropped, client code kept calling it) both came from this gap. |
| Assuming Supabase MCP can reach the WellFit project | Run `mcp__claude_ai_Supabase__list_projects` at session start when DB work is in scope. If `xkybsjnvuohpqpbkikyn` isn't in the list, you cannot apply migrations via MCP — fall back to `npx supabase db push` and tell Maria. | AI assumes MCP works for all projects. On 2026-05-27 the MCP allowlist had two unrelated projects (NoRework + Dominion City church app) but NOT WellFit — wasted ~15 min before Maria added the WellFit project to the allowlist. |
| Sub-agent reports "blocked from writing files" and AI defers | The lead agent must EXECUTE the work in foreground based on the agent's research output. The agent's design is still useful; the agent's silent failure is not. Surface to Maria only after attempting foreground execution. | AI defers to "next session" because the sub-agent stopped. (2026-05-27 incident: Withings webhook sub-agent got blocked; lead agent had to apply the fix from the agent's transcript directly.) |
| Conflating WellFit's PHI key with Envision Atlus's PHI key | WellFit uses Supabase Secrets `PHI_ENCRYPTION_KEY`. Envision Atlus uses Supabase Vault `app.encryption_key`. They are DIFFERENT credentials selected via the `use_clinical_key` parameter in `encrypt_phi_text`. See `.claude/rules/supabase.md` §17 before touching any PHI encryption code. | AI assumes one master key. Maria caught this on 2026-05-27 when nearly committing PHI-related changes that would have conflated the two paths. |
| Calling a Postgres function without verifying it exists in live DB | `pg_proc` is the source of truth for what exists in production. Query `SELECT proname FROM pg_proc WHERE proname='<name>'` before assuming an RPC is callable. | AI sees the function defined in `supabase/migrations/` and assumes it's still there. log_handoff_override was defined in Oct 2025, dropped in Dec 2025, and the client kept calling it for 5 months. |
| Calling work "done" when it doesn't work end-to-end | Done means done. The scoped workflow must run live: form persists, route is reachable from real UI, tenant_id + requester populated, audit log fires. Tests passing on mocks is NOT done. "Filed as a follow-up" is NOT done when the follow-up is a defect that blocks the workflow. | AI optimizes for "task complete" feeling rather than functional outcome. (2026-05-28 incident: ONC-1 + ONC-2 were declared "Tier 1: 3 of 5 done" but neither could submit — INSERT RLS rejected the payload because tenant_id was unset, and zero nav links existed to either route. Maria caught it.) |
| Designing a form/service payload to include fields the target table doesn't have | **Verify target column set BEFORE designing the writer.** Before writing a form, service, or transform that maps to a FHIR resource (or any DB table), query `information_schema.columns` for that table's actual column set. Don't assume a field exists because it's in the FHIR R4 spec — local schema may not have implemented it yet. | AI conflates "FHIR R4 spec says this resource has field X" with "the local fhir_* table has column X." The strict types eventually catch it at submit time, but only after the form is built. (2026-05-28 incident on ONC-7: form was wired to pass `ndc_code` to `CreateMedicationRequest` — `MedicationAffordabilityCheck` has it, `MedicationRequest` doesn't. Strict typing caught it at the pre-commit gate; verifying earlier would have saved ~10 minutes and a partial restructure of the FHIR payload shape.) |

**The STOP AND ASK protocol is the highest-value rule.** Most AI mistakes stem from continuing when uncertain rather than asking.

**The "DONE MEANS DONE" rule (Commandment #21) is the second-highest-value rule.** Most AI partial-completion incidents stem from optimizing for "tests pass + code compiles" instead of "the scoped workflow works for a real user."

---

# ⛔ NO SHORTCUTS. NO EXCUSES. NO EXCEPTIONS. ⛔

**THIS CODEBASE REQUIRES ANTHROPIC-QUALITY ENGINEERING.**

We do NOT accept:
- Sloppy, error-ridden code that leaves technical debt
- "Quick fixes" that break other things
- Removing variables without checking if they're used
- Ignoring CLAUDE.md rules to save time
- Sub-agent work that isn't verified before completion
- ANY pattern that prioritizes speed over correctness

We REQUIRE:
- **Seasoned, stable, careful coding** that Anthropic is known for
- Every change verified with scoped typecheck (`scripts/typecheck-changed.sh`) before considering it done
- Reading and following EVERY rule in this document
- Asking questions when uncertain instead of guessing

**If you take a shortcut, Maria has to fix it. That is unacceptable.**

**Do it right the first time. There is no second chance.**

---

## CRITICAL RULES - READ FIRST

### Development Philosophy - NON-NEGOTIABLE

**"I have time to do it right. I do not have time to do it twice."**

**"Always be a pace car, never a race car."**

**"Be a surgeon, never a butcher."**

These are not suggestions. They are requirements.

---

### Default Assumption - PRODUCTION FIRST

**ALL code in this codebase is enterprise-grade, HIPAA-compliant, production-ready.**

There is no "quick version" followed by "real version."
The first version IS the real version.

- No hardcoded values that should be fetched from database
- No placeholder implementations
- No "we can improve this later"
- No shortcuts that require a second commit to fix

**Every line of code must be shippable to a hospital pilot tomorrow.**

---

### Pre-Implementation Checklist - MANDATORY

**Before writing ANY code, you MUST answer these questions:**

1. **What data does this need?** Where does it come from? (Database, API, props, context?)
2. **Am I hardcoding anything that should be dynamic?** (Values, IDs, config that varies by patient/tenant)
3. **Is this the complete solution or a placeholder?** (If placeholder, STOP - do the real thing)
4. **Would I ship this to a hospital pilot tomorrow?** (If "no" - stop and do it right)

**If you cannot answer "yes, this is production-ready" to #4 - do NOT write the code.**

Ask Maria for clarification instead of implementing something incomplete.

---

### NO WORKAROUNDS POLICY - ABSOLUTE

- **Do NOT implement workarounds, hacks, or "temporary" solutions**
- If blocked, **STOP and ASK** - do not improvise
- If you find yourself typing "workaround", "hack", "temporary fix", "for now", or "we can refactor later" - **STOP IMMEDIATELY**
- Workarounds ARE technical debt. Technical debt is forbidden.
- Violating this requires **explicit written approval from Maria**

---

### STOP AND ASK PROTOCOL

**When ANY of these apply, STOP and ask before proceeding:**

- Requirements are unclear or ambiguous
- Multiple valid implementation approaches exist
- You're about to change an existing pattern
- You're about to delete anything (tables, functions, files, tests)
- The "right" solution seems harder than a shortcut
- You're unsure if something violates these rules
- **You've tried to fix the same error 2+ times** - you likely have a blind spot
- **Tests or typecheck keep failing** - stop iterating, ask for help

**Do NOT guess. Do NOT improvise. ASK.**

**AI models have poor fine motor skills for self-debugging.** We see what we *intended* to write, not what we *actually* wrote. When stuck in a debug loop, the fastest path forward is to STOP and let Maria or adversarial checking identify the blind spot.

---

### Sub-Agent Governance - SAME RULES, NO EXCEPTIONS

**All sub-agents (background tasks, parallel workers, delegated operations) are subject to the EXACT same rules as the lead agent.**

Sub-agents are NOT exempt from:
- The `any` type ban — `unknown` + type guards required
- The `console.log` ban — `auditLogger` required
- The type cast boundary rules — proper casts at system boundaries only
- The test quality standards — no junk tests, deletion test required
- The 600-line file limit — decompose, don't degrade
- The verification checkpoint — `bash scripts/typecheck-changed.sh && npm run lint && npm test`
- The STOP AND ASK protocol — if stuck, surface to lead agent

**Sub-agent work MUST be verified before it is considered complete.** The lead agent is responsible for:
1. Providing sub-agents with clear instructions that reference these rules
2. Verifying sub-agent output against these rules before accepting it
3. Rejecting and redoing sub-agent work that violates any rule
4. Never committing sub-agent output without running the verification checkpoint

**The lead agent owns the quality of all delegated work. "My sub-agent did it" is not an excuse.**

---

### Zero Technical Debt - ENFORCED

- Do NOT introduce technical debt with quick fixes
- Always implement proper, maintainable solutions
- Refactor when necessary to maintain code quality
- "We can fix it later" is not acceptable
- Every shortcut creates future problems during enterprise deployments

---

## Detailed Standards — `.claude/rules/` Files

The following detailed standards are auto-loaded from `.claude/rules/`. Each is mandatory:

| File | What It Covers |
|------|---------------|
| **`typescript.md`** | `any` ban, type guards, cast boundaries, lint warning policy |
| **`python.md`** | Python error handling, typed I/O (Pydantic), model-output validation, PHI scoping, secrets, audit logging, ML structure, Claude-specific mistakes |
| **`ai-services.md`** | Skill registration, AI service pattern, model pinning, structured output, HTI-2, cost tracking |
| **`architecture-patterns.md`** | ServiceResult pattern, audit logging, error handling, patient context spine (ATLUS) |
| **`supabase.md`** | Migrations, RLS, views, functions, edge function clients, CORS, JWT standards, key migration, auth session security, query standards, Deno rules, cleanup policy, realtime subscriptions |
| **`governance-boundaries.md`** | Two-product architecture, system A/B/Shared ownership, coupling rules, refactor guardrails |
| **`ai-repair-authority.md`** | Tier 1-4 authority levels, Guardian Agent rules, sub-agent restrictions |
| **`component-structure.md`** | File layout, naming conventions, component template |
| **`accessibility.md`** | WCAG compliance, senior-friendly UI, touch targets, contrast |
| **`performance.md`** | Code splitting, image optimization, DB performance, virtualization |
| **`visual-acceptance.md`** | No visual work is "done" until Maria sees it rendered |
| **`implementation-discipline.md`** | Plan internally, time estimates, pre-push checks, test timing |
| **`component-library.md`** | EA design system component reference (read before using EA components) |
| **`adversarial-audit-lessons.md`** | Codebase-wide grep rule, edge function auth checklist, VITE_ secrets ban, RLS identity enforcement, profiles.user_id, function naming, JWT verification, regression prevention |

---

## Test Standards - MANDATORY

### Test Baseline
| Metric | Current |
|--------|---------|
| Total Tests | See `docs/PROJECT_STATE.md` → Codebase Health Snapshot (single source of truth) |
| Test Suites | See `docs/PROJECT_STATE.md` → Codebase Health Snapshot |
| Pass Rate Required | 100% |

### Test Quality Standard - THE DELETION TEST

**Every test must answer YES to this question:**

> "If I deleted the component's logic and left an empty `<div />`, would this test fail?"

If the answer is NO, the test is junk. Do not write it.

### Junk Test Patterns - FORBIDDEN

| Junk Pattern | Why It's Junk | Write This Instead |
|--------------|---------------|-------------------|
| `expect(component).toBeTruthy()` | Passes for empty `<div />` | Assert specific content renders |
| `"renders without crashing"` (no assertions) | Tests React, not your code | Assert the component's actual output |
| `"module exports a React component"` | Tests the import system | Test what the component does |
| `"should have animate-pulse class"` | Tests CSS, not behavior | Test what triggers the animation state |
| `expect(wrapper.find('div')).toHaveLength(1)` | Every component has a div | Assert meaningful DOM structure |
| `"matches snapshot"` (alone) | Approves anything on first run | Pair with behavioral assertions |

### Test Quality Tiers

| Tier | What It Tests | Value |
|------|--------------|-------|
| **Tier 1: Behavior** | User-visible actions and outcomes | Highest |
| **Tier 2: State** | Data flow, loading/error/success states | High |
| **Tier 3: Integration** | Service calls, context interactions | High |
| **Tier 4: Edge Cases** | Null data, empty arrays, timeouts, permissions | Medium |
| **Tier 5: Structure** | Static rendering checks with no behavior | **Zero - Do not write** |

### Test Rules
- **All tests must pass** before any work is considered complete
- New components MUST include corresponding test files
- Do NOT delete, skip, or disable existing tests. Do NOT use `.skip()` or `.only()`
- **Synthetic test data only** — `'Test Patient Alpha'`, DOB `'2000-01-01'`, phone `'555-0100'` (see Rule #15)

---

## React 19 / Vite Standards - ENFORCED

**This project migrated to Vite + React 19 in December 2025.**

| Do This | Not This |
|---------|----------|
| `import.meta.env.VITE_*` | `process.env.REACT_APP_*` |
| `ref` as prop directly | `forwardRef()` wrapper |
| `use()` hook for promises | `useEffect` + state for data fetching |
| Entry: `/index.html` (root) | `/public/index.html` |

- NO `process.env` anywhere in client code
- NO `forwardRef` - React 19 passes ref as prop
- NO Create React App patterns or assumptions

---

## Project Overview

This codebase contains **two separate white-label products** that can be used independently or together:

| Product | Purpose | Target Users |
|---------|---------|--------------|
| **WellFit** | Community engagement platform | Seniors, caregivers, community orgs |
| **Envision Atlus** | Clinical care management engine | Healthcare providers, clinicians |

### Tenant ID Convention: `{ORG}-{LICENSE}{SEQUENCE}` — `0`=Both, `8`=Atlus Only, `9`=WellFit Only

**Default Tenant for Testing:** `WF-0001` (UUID: `2b902657-6a20-4435-a78a-576f397517ca`)

### White-Label Architecture
- **Multi-tenant**: Multiple organizations use the same codebase with their own domains
- **Explicit origins**: CORS uses `ALLOWED_ORIGINS` env var (no wildcards)
- **Tenant branding**: Each tenant can customize appearance via `useBranding()` hook
- **Shared backend**: All tenants share Supabase database with RLS for isolation

---

## HIPAA Compliance & PHI Protection - CRITICAL

- **NEVER introduce PHI (Protected Health Information) to the browser**
- All PHI must remain server-side only
- Use patient IDs/tokens for client-side operations, never names, SSN, DOB, etc.
- Use audit logger for all logging - **NEVER use console.log**
- All security-sensitive operations must be logged via the audit system

---

## Code Quality Standards

### Surgical Precision Required
- **Be a surgeon, never a butcher** - make precise, targeted changes
- Respect the existing codebase architecture and patterns
- Only modify what is necessary to complete the task
- Preserve existing functionality unless explicitly asked to change it

### Before Starting ANY Work
1. Review the last 3 commits: `git log --oneline -3`
2. Understand recent changes and their purpose
3. Review the affected schema/database tables
4. Identify existing patterns in similar code
5. If unclear, **STOP and ASK**

### Finding Prior Work — SEARCH, DON'T GUESS

1. **Search git log FIRST:** `git log --oneline --all --grep="tracker"` or `git log --oneline -20`
2. **Search committed files:** Check `docs/PROJECT_STATE.md`, then `docs/`, then `docs/trackers/`
3. **If not found in 2 attempts, ASK Maria**
4. **Never recreate from scratch** without confirming the original is truly lost

### Debugging CI/CD Failures — CHECK THE OUTPUT FIRST

1. **Check the CI system or GitHub output FIRST** — `gh run list`, `gh run view`, actual error logs
2. **Do NOT start by analyzing local code changes** as the assumed cause
3. Only investigate code after confirming the CI output points to a code issue

### No God Files - 600 Line Maximum Per File

- **Maximum 600 lines per file** — Before adding code, run `wc -l` first
- If approaching 500 lines, **proactively decompose**
- **Decomposition pattern:** Extract by responsibility → barrel re-export → shared types → verify with typecheck + tests

### Route Connectivity & Wiring

1. **Verify routes exist in `src/App.tsx`**
2. **Check lazy imports** - Components must be imported with `React.lazy()`
3. **Validate route references** - Links must point to actual routes
4. After creating any new page/component, verify it's accessible in the browser

### Visual Acceptance Checkpoint

See `.claude/rules/visual-acceptance.md`. Summary: **no visual work is "done" until Maria sees it rendered.**

---

## Development Commands

```bash
npm run dev                        # Start development server
npm run build                      # Build the project
npm run lint                       # Run linting
bash scripts/typecheck-changed.sh  # Scoped typecheck (changed files only)
npm run typecheck                  # Full typecheck (releases/demos only)
npm test                           # Run tests
```

---

## Quality Assurance Checklist - REQUIRED

1. `npm run lint` - Must pass with 0 errors
2. `bash scripts/typecheck-changed.sh` - Verify TypeScript types in changed files
3. `npm test` - All tests must pass
4. Visual inspection - Ensure UI/UX functions correctly
5. Route verification - New pages are accessible

---

## Git Workflow

- Main branch: `main`
- Only commit when explicitly requested
- Follow existing commit message patterns
- Always review last 3 commits before starting work
- Branch naming: `claude/{feature-description}-{unique-id}`

---

## Available Skills

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/session-start` | Read PROJECT_STATE, report status | Every new session |
| `/ship` | Verify, commit, and push | After completing implementation |
| `/plan` | Structured implementation plan | Before starting a new feature |
| `/deploy-edge` | Deploy edge function(s) with health check | After edge function changes |
| `/security-scan` | HIPAA compliance check | Before commits, demos, audits |
| `/demo-ready` | Hospital pilot demo validation | Before customer demos |
| `/clinical-validate` | AI code validation hooks health | After clinical AI changes |
| `/fhir-check` | FHIR interop health check | Before demos, after FHIR changes |
| `/god-check` | 600-line file limit scan | Before commits, during refactoring |
| `/audit-check` | Audit logging compliance | Before audits, compliance reviews |
| `/cost-check` | AI cost analysis | Monthly review, budget planning |
| `/test-runner` | Smart test execution | During development, before commits |
| `/pre-commit` | Pre-commit validation | Before every commit |
| `/onboard-tenant` | New organization onboarding | When a new org signs up |

---

## Security Requirements

- All authentication must use secure tokens
- Rate limiting on sensitive endpoints
- Input validation on all user inputs
- SQL injection prevention via parameterized queries
- XSS prevention via proper output encoding

---

## Important Directories

| Directory | Purpose |
|-----------|---------|
| `src/components/admin/` | Admin dashboards and management panels |
| `src/components/envision-atlus/` | Shared UI component library (EA design system) |
| `src/components/patient-avatar/` | Patient Avatar Visualization System |
| `src/services/_base/` | ServiceResult pattern utilities |
| `src/hooks/` | Custom React hooks |
| `supabase/functions/` | Edge functions (Deno runtime) |
| `supabase/functions/_shared/` | Shared utilities for edge functions |

---

## Feature Documentation

Detailed documentation for specific features is in the `docs/` folder:

| Document | Description |
|----------|-------------|
| [docs/architecture/AI_FIRST_ARCHITECTURE.md](docs/architecture/AI_FIRST_ARCHITECTURE.md) | AI-first design paradigm & MCP server architecture |
| [docs/architecture/AI_DEVELOPMENT_METHODOLOGY.md](docs/architecture/AI_DEVELOPMENT_METHODOLOGY.md) | How to build software with AI (patterns, counter-measures, governance) |
| [docs/architecture/ENVISION_ATLUS_DESIGN.md](docs/architecture/ENVISION_ATLUS_DESIGN.md) | EA design system components |
| [docs/product/REFERRAL_SYSTEM.md](docs/product/REFERRAL_SYSTEM.md) | External referral & reporting system |
| [docs/clinical/CAREGIVER_SUITE.md](docs/clinical/CAREGIVER_SUITE.md) | Family caregiver PIN-based access |
| [docs/product/REGISTRATION_FLOWS.md](docs/product/REGISTRATION_FLOWS.md) | Three registration flows |
| [docs/product/FEATURE_DASHBOARDS.md](docs/product/FEATURE_DASHBOARDS.md) | Feature dashboard routes & config |
| [docs/product/VOICE_COMMANDS.md](docs/product/VOICE_COMMANDS.md) | Voice command infrastructure |
| [docs/clinical/PATIENT_AVATAR.md](docs/clinical/PATIENT_AVATAR.md) | Patient avatar visualization system |
| [docs/clinical/PATIENT_CONTEXT_SPINE.md](docs/clinical/PATIENT_CONTEXT_SPINE.md) | Canonical patient data access |
| [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md) | Current dev status & ATLUS alignment |

---

## Quick Reference

### Super Admin Credentials
| User | Email | UUID |
|------|-------|------|
| Maria | maria@wellfitcommunity.com | `ba4f20ad-2707-467b-a87f-d46fe9255d2f` |
| Akima | akima@wellfitcommunity.com | `06ce7189-1da3-4e22-a6b2-ede88aa1445a` |

### Feature Flags
```env
VITE_FEATURE_PHYSICAL_THERAPY=true
VITE_FEATURE_CARE_COORDINATION=true
VITE_FEATURE_REFERRAL_MANAGEMENT=true
VITE_FEATURE_QUESTIONNAIRE_ANALYTICS=true
VITE_FEATURE_NEURO_SUITE=true
```

---

## Current Status
- **Architecture**: White-label multi-tenant SaaS
- **Database**: PostgreSQL 17 via Supabase with RLS (fully migrated December 2025)
- **Authentication**: JWT anon keys + new sb_publishable/sb_secret key format (hybrid until Supabase SDK full support)
- **UI**: Envision Atlus design system migration in progress
- **Build**: Vite + React 19 (migrated December 2025)
- **CSS**: Tailwind CSS 4.1.18 (migrated December 2025)
- **Tests**: 100% pass rate, 0 skipped — current counts in `docs/PROJECT_STATE.md` → Codebase Health Snapshot (single source of truth)
