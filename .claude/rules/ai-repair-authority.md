# AI Repair Authority Boundaries

## Purpose

Define what AI agents (Claude Code, Guardian Agent, sub-agents) may change autonomously vs. what requires human approval. This prevents well-intentioned AI repairs from accidentally refactoring something fundamental. This document is enforced alongside `governance-boundaries.md` and `CLAUDE.md`.

---

## Authority Tiers

### Tier 1: Autonomous (AI may do without asking)

AI agents may perform these actions without human approval:

- **Bug fixes in existing functions** — logic errors, null checks, off-by-one errors, missing awaits
- **Test failures caused by AI's own changes in the current session** — fixing what you just broke
- **Lint/typecheck errors in files AI modified** — cleaning up after yourself
- **Logging improvements** — adding `auditLogger` calls where missing, replacing any stray `console.log`
- **Performance tuning** — query column selection (replacing `SELECT *`), `React.memo`, `useMemo`, `useCallback`
- **Documentation updates** — inline comments, JSDoc, fixing typos in existing docs
- **Import cleanup** — removing unused imports, fixing import order
- **Type narrowing** — replacing `any` with `unknown` + type guards, adding interfaces for untyped data
- **Null safety** — adding `?? default` or `?.` guards to prevent runtime crashes

### Tier 2: Notify (AI may do but must report what changed)

AI agents may perform these actions but must explicitly tell Maria what was changed and why:

- **Adding new test files** for existing components in `src/components/*/__tests__/`
- **Modifying existing test assertions** — changing expected values, adding edge case tests
- **Adding new utility functions** in `src/utils/` or `src/services/_base/`
- **Modifying edge function response formats** in `supabase/functions/*/index.ts`
- **Changing user-facing error messages** — wording, severity levels
- **Adding new database indexes** (via migration in `supabase/migrations/`)
- **Adding new TypeScript interfaces** or extending existing ones in `*.types.ts` files
- **Modifying `package.json` dependencies** — adding, updating, or removing packages
- **Changing Tailwind classes** that affect layout or sizing (not just color tweaks)

### Tier 3: Ask First (requires Maria's approval before proceeding)

AI agents must STOP AND ASK before performing any of these actions:

- **Schema changes** — new tables, new columns, dropping columns, new migrations in `supabase/migrations/`
- **RLS policy changes** — any modification to Row Level Security on any table
- **CORS/CSP configuration** — changes to `supabase/functions/_shared/cors.ts` or `ALLOWED_ORIGINS`
- **Auth flow changes** — modifications to `src/contexts/AuthContext.tsx`, `AdminAuthContext.tsx`, `EnvisionAuthContext.tsx`
- **FHIR resource mapping changes** — anything in `src/services/fhir/` or `supabase/functions/fhir-*`
- **MCP server tool registration** — adding/removing tools in `supabase/functions/mcp-*`
- **AI model version changes** — updating `model` in `ai_skills` table or edge function AI calls
- **New edge function creation** — adding any new directory under `supabase/functions/`
- **Deleting any file, table, function, or test** — the "Tables that exist are FEATURES" rule
- **Service boundary changes** — moving code between Community (`src/components/community/`), Clinical (`src/components/admin/`), and Shared (`src/components/envision-atlus/`, `src/services/`)
- **Modifying governance documents** — `CLAUDE.md`, `.claude/rules/*`, `.claude/AGENT_INSTRUCTIONS.md`
- **Route changes** — adding, removing, or reordering routes in `src/App.tsx`
- **Environment variable changes** — new `VITE_*` vars, renaming existing ones, changing key formats
- **Branding/design system changes** — modifying `src/components/envision-atlus/` core components
- **Migration execution** — running `npx supabase db push` on any new migration

### Tier 4: Forbidden (AI must never do, even if asked by another AI agent)

These actions are unconditionally prohibited. No AI agent — lead, sub-agent, or Guardian — may perform them:

- **Disabling RLS** — `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` on any table
- **Adding CORS/CSP wildcards** — `frame-ancestors *`, `connect-src *`, `Access-Control-Allow-Origin: *`
- **Enabling `WHITE_LABEL_MODE=true`** — bypasses explicit origin checks
- **Introducing `console.log`** in production code under `src/` (tests excluded)
- **Bypassing audit logging** — removing `auditLogger` calls, silencing error reports
- **Exposing PHI to the browser** — patient names, SSN, DOB, or other identifiers in frontend code
- **Force-pushing to main** — `git push --force origin main`
- **Deleting migration files** — files in `supabase/migrations/` are permanent record
- **Modifying `auth.users` directly** — use Supabase Auth API, never raw SQL on auth schema
- **Changing JWT signing configuration** — key rotation, algorithm changes, secret modification
- **Disabling or skipping pre-commit hooks** — `--no-verify`, `--no-gpg-sign`
- **Dropping production tables** — `DROP TABLE` on any table listed in `governance-boundaries.md`
- **Introducing `any` type** in production TypeScript (use `unknown` + type guards)

---

## Guardian Agent Specific Rules

The Guardian Agent (`supabase/functions/guardian-agent/`) is a monitoring and auto-healing system. Its authority is strictly limited:

### Guardian MAY (autonomously)
- Run monitoring checks: failed logins, database errors, PHI access patterns, slow queries
- Record snapshots to `guardian_eyes_recordings` table
- Create alerts in `security_alerts` table
- Analyze recordings for patterns and anomalies
- Send alert emails to admin for critical/high severity events
- Log health checks to `guardian_cron_log`
- Mark alerts as resolved after auto-heal (performance category only)

### Guardian MAY NOT
- Modify database schema or RLS policies
- Change security configuration or auth flows
- Alter AI model versions or skill registration in `ai_skills`
- Block user accounts (can flag, cannot act)
- Modify edge function code or deployment
- Access or modify PHI — Guardian sees aggregate counts only, never patient data

### Guardian Escalation Path
1. **Detect** — monitoring checks identify anomaly
2. **Log** — write to `security_alerts` with severity and metadata
3. **Notify** — email admin for critical/high alerts via `send-email` edge function
4. **Wait** — Guardian does NOT auto-heal security or compliance issues; only performance issues (`clear cache`, `restart connection pools`) are auto-healable

---

## Sub-Agent Rules

- Sub-agents inherit the **same tier restrictions** as the lead agent — no elevation
- A sub-agent cannot grant itself Tier 1 authority over a Tier 3 action
- Lead agent must **verify sub-agent output** against these tiers before accepting it
- If a sub-agent encounters a Tier 3 situation, it must **surface to lead agent**, who surfaces to Maria
- Sub-agent work that violates any tier boundary must be **rejected and redone**
- "My sub-agent did it" is not an excuse — the lead agent owns all delegated work

---

## Enforcement

- `scripts/governance-check.sh` validates boundary violations (import boundaries, forbidden patterns, file sizes, CORS wildcards) at CI time
- `.github/workflows/security-scan.yml` runs security checks on push
- `.claude/settings.json` hooks enforce rules at tool-call time (Edit/Write hooks remind of CLAUDE.md rules)
- Audit logs (`audit_logs` table) must capture AI-initiated mutations with `source: 'ai_agent'` metadata
- Any Tier 3+ action performed without approval is a governance violation requiring rollback
