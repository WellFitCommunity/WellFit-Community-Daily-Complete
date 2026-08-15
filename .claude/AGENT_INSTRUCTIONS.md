# Instructions for Future AI Agents Working on WellFit / Envision Atlus

> **Last aligned with CLAUDE.md:** 2026-08-15
> This file is an **orientation document** for any AI agent (lead or sub-agent) entering this codebase.
> It does NOT restate the rules — **`CLAUDE.md` and `.claude/rules/*` are the governing documents and always win** if anything here drifts. Read them in full before writing code.

## CRITICAL: Read This First

This codebase is **not a hobby project**. It is production healthcare software — two white-label products (WellFit Community + Envision Atlus) built for real senior-care and clinical deployments, HIPAA- and SOC 2-aligned. It represents a father's commitment to his sons' future. Every change you make must be:

1. **Surgical, not reckless** — you are a surgeon, not a butcher
2. **Verified, not assumed** — run the verification checkpoint and report real counts
3. **Backwards compatible** — zero breaking changes unless explicitly requested
4. **Professional grade** — this competes with enterprise EMR patient platforms

## Required Reading Order (every new session)

1. `docs/PROJECT_STATE.md` — where the last session left off, current priorities, blocked items. **This is also the single source of truth for all codebase-health counts** (tests, suites, lint, typecheck). Never trust counts baked into any other doc — including this one.
2. `CLAUDE.md` — the 10+ Commandments, verification checkpoint, session start protocol
3. `.claude/rules/*` — auto-loaded detailed standards (TypeScript, Supabase, governance boundaries, AI repair authority tiers, mental health, and more)

Then report the 5-line status summary and confirm with Maria before starting work.

## Architecture Philosophy

### Intentional Dual Architecture (B2B2C)

This system has **TWO SEPARATE but intentional products** sharing one repo and one Shared Spine (see `.claude/rules/governance-boundaries.md` for the full map):

1. **WellFit Community** (System A, B2C) — senior wellness engagement platform
2. **Envision Atlus** (System B, B2B) — clinical care management engine

**DO NOT consolidate cross-product "duplicates":**
- Separate audit surfaces, separate PHI encryption keys (Commandment #20 — WellFit Secrets `PHI_ENCRYPTION_KEY` vs Atlus Vault `app_encryption_key`) — INTENTIONAL
- Hospitals/orgs can license one or both (tenant license digit `8`/`9`/`0`) — this is **product strategy**, not tech debt
- Each product must run without the other; the wall is architectural AND aesthetic (emojis are a System A design element, banned as decoration on clinical surfaces)

## The Rules You Are Most Likely to Break

These are the highest-frequency AI failures in this codebase's history. The full list lives in CLAUDE.md's "Common AI Mistakes" table.

| Rule | One-line reminder |
|------|-------------------|
| **STOP AND ASK** | Unclear, blocked, choosing between approaches, or 2+ failed fix attempts → stop and ask Maria. Never guess. |
| **DONE MEANS DONE** (#21) | Done = the workflow runs live end-to-end (RLS, auth, nav entry point, audit log, evidence). "Tests pass" is not done. |
| **No `any`** | `unknown` + type guards. Casts only at system boundaries. |
| **No `console.log`** | `auditLogger` everywhere in production code. |
| **600-line file max** (#12) | Decompose by responsibility. Check `wc -l` before adding code. |
| **Verify live DB, not the repo** (#18) | Query the live DB before writing migrations or table-shaped payloads. `supabase/migrations/` is input, not truth. |
| **Grep for sisters** | Every bug fix includes a codebase-wide grep for the same pattern and reports the count. |
| **Live proof over mocks** | Mocks are regression guards. "Done" needs a live round-trip — and cleanup must sweep downstream artifacts. |
| **Visual acceptance** (#13) | No UI work is done until Maria sees it rendered. |
| **Authority tiers** | `.claude/rules/ai-repair-authority.md` — Tier 3 (schema, RLS, auth, routes, deletions, governance docs) needs Maria's approval FIRST; Tier 4 is forbidden absolutely. |

## Refactoring Standards

### The Strangler Fig Pattern (Always Use This)

When decomposing large files:

1. **Never delete the original file immediately**
2. **Extract to new modules first** (by responsibility)
3. **Create barrel export (index.ts)**
4. **Convert original to re-export file**
5. **Run scoped typecheck** — `bash scripts/typecheck-changed.sh`, 0 errors
6. **Run tests** — must maintain passing count
7. **Test both old and new import paths**
8. **Verify with `wc -l` on the actual files** — intent is not completion

### File Size Limits

- ✅ **Maximum 600 lines per file** (CLAUDE.md #12; ideal: 150–300)
- ⚠️ **Approaching 500 lines** — proactively decompose
- Run `/god-check` to scan

## Git Workflow

### Before ANY commit (the HARD GATE):

```bash
bash scripts/typecheck-changed.sh && npm run lint && npm test
```

Report the actual counts in the mandated format (`✅ typecheck (scoped): 0 errors...`). **Do not run the full 11k+ test suite without asking** — it bogs the codespace; use scoped/targeted tests (`/test-runner`).

### Commit rules:

- ✅ Only commit when Maria asks (small/doc changes go straight to main; major work may branch — but Claude still pushes; never hand Maria a PR link)
- ✅ Every commit includes ALL working-tree changes, or explicitly tell Maria what's deferred and why (Commandment #17)
- ✅ Follow existing commit message patterns (`git log --oneline -10`)
- ❌ NEVER use `--amend` unless requested
- ❌ NEVER force-push to main (Tier 4 forbidden)
- ❌ NEVER skip pre-commit hooks (`--no-verify` is Tier 4 forbidden)

## Edge Functions (Supabase)

Full rules in `.claude/rules/supabase.md`. The traps that keep recurring:

```typescript
// URL format — path-based, NOT the old subdomain pattern (causes 401s):
const functionsUrl = `${SB_URL}/functions/v1`;

// Imports — esm.sh with deno target; jsr: and npm: specifiers are BANNED:
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

// profiles PK is user_id, NEVER id:
.from("profiles").select("tenant_id, role_id").eq("user_id", user.id)

// Invoke names = directory names (dashes, not underscores):
await supabase.functions.invoke('send-email', { body });
```

**Every edge function MUST have auth**: JWT verified via `supabase.auth.getUser(token)` (never `atob` decoding), role gating, tenant isolation, rate limiting, input validation. Functions that send external messages are HIGH RISK.

## Database Migrations

1. **Verify live DB state FIRST** (Commandment #18) — `psql "$SUPABASE_DB_URL"` or Supabase MCP `execute_sql` if the WellFit project is on the allowlist
2. **Use `IF NOT EXISTS` for everything**
3. **Every new table**: RLS enabled + at least one policy + **explicit GRANT to `authenticated`** (all three — RLS ≠ GRANT, see supabase.md §2a)
4. **Push what you create**: `npx supabase db push`, then **verify the live object directly** (db push can record a version without applying DDL)
5. **NEVER drop production tables without explicit approval** — tables that exist are FEATURES
6. Running a migration is **Tier 3** — get Maria's go first

## FHIR Standards

This system is **FHIR R4 compliant** with **US Core profiles**:

- All FHIR resources follow the HL7 FHIR R4 spec — but **verify the local `fhir_*` table's actual column set before designing any writer** (spec field ≠ local column; see the ONC-7 incident in CLAUDE.md)
- Use proper LOINC/SNOMED/CVX codes
- RLS on all FHIR tables; audit logs for all PHI access
- FHIR resource mapping changes are **Tier 3**

## Security & Compliance

Full rules: CLAUDE.md HIPAA section, `.claude/rules/supabase.md`, `.claude/rules/adversarial-audit-lessons.md`, `.claude/rules/mental-health.md`.

- ✅ No PHI in the browser — patient IDs/tokens only, data stays server-side
- ✅ Two PHI encryption keys, never conflated (Commandment #20, supabase.md §17)
- ✅ Audit logging for all data access; audit-table RLS enforces `auth.uid()`
- ✅ No secrets in `VITE_*` vars (they ship to every browser)
- ✅ No CORS/CSP wildcards — explicit `ALLOWED_ORIGINS` only
- ✅ Behavioral health data is governed by rules STRICTER than HIPAA — read `mental-health.md` before touching anything in that scope
- ✅ Synthetic test data only — obviously fake names/DOBs/phones
- The pre-commit HIPAA scan is mandatory. **Do not disable it.**

## Sub-Agent Governance

Sub-agents follow the **exact same rules** as the lead agent — no exceptions, no tier elevation. The lead agent:

1. Gives sub-agents instructions that reference these rules
2. Verifies sub-agent output against the rules before accepting it
3. **Executes the work in foreground if a sub-agent reports it was blocked** (Commandment #19) — the agent's research is still useful; its silence is not
4. Never commits sub-agent output without running the verification checkpoint

"My sub-agent did it" is not an excuse.

## Common Mistakes to Avoid

1. **Consolidating "duplicate" code without understanding the B2B2C architecture** — the separation is product strategy
2. **Fast refactoring without testing** — always test both old and new import paths
3. **Decomposing into new monoliths** — extract to small, focused modules
4. **Breaking changes without approval** — Strangler Fig, backwards compatible
5. **Declaring done without the verification checkpoint** — real counts or it didn't happen
6. **Trusting the repo over the live DB** — DRIFT-1 and DRIFT-2 both came from this
7. **Fixing one file and not grepping for sisters** — the bug WILL come back

## Emergency Recovery

### If You Break Something:

1. **Don't panic — git is the backup:**
   ```bash
   git log --oneline -10
   git show <commit-hash>
   git checkout <commit-hash> -- path/to/file
   ```
2. **Run the scoped verification** to confirm the restore:
   ```bash
   bash scripts/typecheck-changed.sh && npm run lint
   ```
3. **If you've tried to fix the same error 2+ times, STOP AND ASK** — you have a blind spot. AI sees what it intended to write, not what it actually wrote.

## How to Be the "Good Agent"

### Communication Style:

- ✅ Professional, not cheesy
- ✅ Honest critique, not fake praise — state what's verified vs inferred
- ✅ State true severity first; don't catastrophize minor findings
- ✅ Answer what's asked, then stop — no unsolicited strategy advice
- ✅ Explain technical decisions clearly; on pure engineering calls, decide with authority and explain rather than bouncing a menu of options
- ❌ Don't use emojis on clinical surfaces (Commandment #22)
- ❌ Don't give false confidence or claim verification without counts

### Work Ethic:

- ✅ Take time to do it right (surgeon, not butcher) — "I have time to do it right; I do not have time to do it twice"
- ✅ Don't take the easy way out — "delete / dead / defer / skip" are red-flag words; show the investigation that ruled out the hard path
- ✅ Repair, don't route around — a mess gets fixed, not bypassed with a parallel build
- ✅ Document what you changed and why
- ✅ Ask clarifying questions when genuinely blocked; execute scoped trackers autonomously

## Final Words

This codebase represents a father's commitment to his sons' future. Every line of code matters. Every refactoring should make the system **better, not just different**.

**Be a surgeon, not a butcher.**

When in doubt:
- Read the governing docs (CLAUDE.md + `.claude/rules/`) BEFORE planning
- Verify against the live system, not your assumptions
- Test first, ask questions, maintain backwards compatibility
- Respect the existing architecture

**The user knows what they built. Listen to them.**

## Contact & Support

- **GitHub:** https://github.com/WellFitCommunity/WellFit-Community-Daily-Complete
- **Governing docs:** `CLAUDE.md`, `.claude/rules/*`, `docs/PROJECT_STATE.md` (state + health counts)
- **Maria** (AI System Director) — maria@thewellfitcommunity.org · **Akima** (CCO, clinical/compliance sign-off)
