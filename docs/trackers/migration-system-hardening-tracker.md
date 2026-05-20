# Migration System Hardening Tracker

> **Last Updated:** 2026-05-20
> **Owner:** Maria (AI System Director)
> **Reviewer:** Akima (CCO)
> **Estimated Effort:** ~14–22 hours across 4–6 sessions
> **Origin:** Audit findings from 2026-05-20 session (Compass Riley pilot prep)

---

## How to Read This

| Symbol | Meaning |
|--------|---------|
| TODO | Not started |
| IN PROGRESS | Work underway in a branch |
| DONE | Implementation merged + verified |
| DEFER | Intentionally deferred (note column required) |

This tracker covers **two distinct migration concerns** that the 2026-05-20 audit conflated:

- **Part A — Schema Migration Workflow** = `supabase/migrations/` + `supabase db push` + the `_APPLIED_` prefix convention. Pure DevOps plumbing for evolving the database schema over time.
- **Part B — Intelligent Migration Engine** = `src/services/migration-engine/` + `src/services/enterprise-migration/` + `supabase/migrations/20251210100000` + `20251212100000`. Patent-pending IP for ingesting heterogeneous healthcare data into the WellFit schema with DNA fingerprinting and learned mappings.

The two share the word "migration" and almost nothing else. They are tracked separately below so the right team (DevOps vs Product) can pick up the right items.

---

## Part A — Schema Migration Workflow Hardening

### Numbers from the audit (verified 2026-05-20)

| Metric | Value | Concern |
|--------|-------|---------|
| Total migration files | 608 (490 active + 118 archived) | Operationally fine, narratively large |
| Files marked `_APPLIED_` | 30 of 453 applied | Manual prefix system is **6.6% maintained** — convention is broken |
| Fix/repair/force migrations | **98 (16% of total)** | High rework rate — typically caused by committing migrations without dry-running against the live schema first |
| Drift between local and remote `schema_migrations` | 1 file (453 remote vs 452 standard-format local) | Small but real |
| Monthly volume trend | Sep'25 (12) → Dec'25 peak (134) → Apr'26 (1) | **Trending down — good sign of stabilization** |
| CI workflows that validate migrations | **0** | The single highest-leverage gap |

### A1 — Add a CI dry-run gate (HIGHEST LEVERAGE)

| # | Task | Files | Status |
|---|------|-------|--------|
| A1.1 | New GitHub Action workflow `.github/workflows/migration-dry-run.yml` that triggers on PRs touching `supabase/migrations/**` | New file | TODO |
| A1.2 | Step: checkout, install supabase CLI, run `npx supabase db push --dry-run --db-url $STAGING_DB_URL` | — | TODO |
| A1.3 | Parse output — if any migration would FAIL to apply (e.g., the audit_logs INSERT bug from 2026-05-20), block the PR with an annotation | — | TODO |
| A1.4 | Required secret: `STAGING_DB_URL` — read-only staging postgres connection string. Document in repo README that this secret is required. | README + Vercel/GitHub secrets | TODO |
| A1.5 | Optional: post the dry-run diff as a PR comment so reviewers can see "what tables/columns would change" | — | TODO |

**Why this matters:** The 2026-05-20 audit found that the April 21 cron migration's `INSERT INTO audit_logs (event_type, severity, message, metadata)` referenced columns (`severity`, `message`) that **don't exist in production**. Author wrote against an aspirational schema (probably copied from `20251106000005_security_data_retention.sql` which uses that shape) without checking live. A CI dry-run gate would have caught this on the PR.

**Estimate:** 2 hours.

### A2 — Delete the 3 dead-script artifacts

| # | Task | File | Status |
|---|------|------|--------|
| A2.1 | Delete `scripts/apply-migration-directly.sh` | Hardcoded to ONE 2025-09-23 migration. Useless. | TODO |
| A2.2 | Delete `scripts/deploy-mcp-migration.sh` | Hardcoded to ONE 2025-11-06 migration. Useless. | TODO |
| A2.3 | Delete `scripts/apply-community-migration.js` | Embeds migration SQL inline; uses banned `REACT_APP_SUPABASE_URL` env var (CLAUDE.md rule #7); depends on a non-existent `exec_sql` RPC. Would fail if anyone tried it today. | TODO |

**Why this matters:** Dead scripts confuse future sessions ("which one do I use?") and the third one actively violates CLAUDE.md.

**Estimate:** 15 minutes.

### A3 — Modernize or delete `scripts/verify-migrations.sh`

| # | Task | File | Status |
|---|------|------|--------|
| A3.1 | Decide: (a) modernize the script to grow with the schema, (b) delete and rely on `supabase db push --dry-run` instead, OR (c) keep the script but mark it as a legacy 2025-10-01 baseline check only | `scripts/verify-migrations.sh` | TODO |
| A3.2 | If modernizing: replace the 15 hardcoded check lines with a `pg_dump --schema-only` diff against an expected snapshot, OR generate the check list from a YAML file that's easier to update | — | TODO |

**Why this matters:** The script's 15 checks are anchored to 2025-10-01. The schema has 7 months of evolution since then. Running it today gives false confidence — it says "✓ all checks passed" while ignoring everything added after Oct 1.

**Estimate:** 1 hour for delete, 4 hours for modernize.

### A4 — Create a single source of truth for `audit_logs` schema

| # | Task | Files | Status |
|---|------|-------|--------|
| A4.1 | Document the canonical `audit_logs` column list in `docs/schema/audit_logs.md` — every legitimate column with its purpose, who writes to it, who reads from it | New file | TODO |
| A4.2 | Add a `CREATE OR REPLACE VIEW v_audit_logs_canonical AS SELECT (every legitimate column) FROM audit_logs` in a new migration. New migrations that need to INSERT can INSERT against the view (Postgres allows this with `INSTEAD OF` triggers) and get a clean error if a column is missing. | New migration | TODO |
| A4.3 | Add a regression test: every existing migration that does `INSERT INTO audit_logs` should be re-validated against the view shape | New test | TODO |

**Why this matters:** Tonight's bug was caused by writers assuming the table had columns it didn't. The `_SKIP_20251018160000_soc2_security_foundation.sql` migration in the archive defines a richer audit_logs shape with `severity` + `message` that was never applied. Without a single source of truth, future authors will keep copying from whichever migration they happen to read first.

**Estimate:** 3 hours.

### A5 — Decide on the `_APPLIED_` prefix convention

| # | Task | Files | Status |
|---|------|-------|--------|
| A5.1 | Decide: (a) delete the convention entirely (the `supabase_migrations.schema_migrations` table is authoritative anyway), (b) automate the convention with `scripts/mark-applied.sh` that pulls remote-applied list and renames local files | All migrations | TODO |
| A5.2 | If deleting: rename 30 `_APPLIED_*` files back to standard `YYYYMMDD_*` format (no behavior change — the schema_migrations table is the truth) | 30 files | TODO |
| A5.3 | If automating: write the rename script, document it in the README, run it once to bring all 453 applied files into prefix-consistency | New script | TODO |

**Why this matters:** 30 of 453 applied migrations have the prefix (6.6%). The convention is more confusion than documentation at this rate.

**Estimate:** 1 hour (delete option), 3 hours (automate option).

---

## Part B — Intelligent Migration Engine Hardening

### Numbers from the audit (verified 2026-05-20)

| Metric | Value |
|--------|-------|
| SQL schema (engine + enterprise tables) | 2,100 lines across 2 migrations (both applied to remote) |
| TypeScript implementation | 4,398 lines across 23 files |
| Test count | **136 behavioral tests** across 4 files |
| Patent specification | 546 lines (`docs/patent/PATENT_SPECIFICATION_MIGRATION_ENGINE.md`, drafted 2026-03-10) |
| Edge function wrapper | **0** — entire engine runs client-side |

### B1 — Decompose `EnterpriseMigrationDashboard.tsx`

| # | Task | File | Status |
|---|------|------|--------|
| B1.1 | The dashboard is **931 lines** — violates the 600-line rule. Already added to the god-file decomposition tracker. Decompose into: panel-per-feature (lineage, snapshot, retry, workflow, quality, dedup) + shared types + barrel re-export | `src/components/migration/EnterpriseMigrationDashboard.tsx` | TODO |

**Why this matters:** This is the operator-facing surface for a patent-pending IP system. If it's the first thing a hospital pilot evaluator sees, it should be exemplary. Currently it violates your own published 600-line rule.

**Estimate:** 3 hours.

### B2 — Edge function wrapper (PHI safety + production-grade story)

| # | Task | Files | Status |
|---|------|-------|--------|
| B2.1 | New edge function `supabase/functions/migration-engine-job/` that accepts a batch upload (signed URL to source file), runs the engine server-side, writes results to `migration_batch` / `migration_results`, returns a job ID | New | TODO |
| B2.2 | Auth: clinical-or-admin role + tenant isolation via `mcpAuthGate` pattern (per `.claude/rules/adversarial-audit-lessons.md` edge-function checklist) | Edge function | TODO |
| B2.3 | Rate limit: import from `_shared/mcpRateLimiter.ts` (low limit — engine runs are expensive) | Edge function | TODO |
| B2.4 | Client refactor: `IntelligentMigrationService` calls the edge function instead of running engine logic in-browser | `src/services/migration-engine/IntelligentMigrationService.ts` | TODO |
| B2.5 | Keep client-side classes for **types + small helpers** but move the heavy lifting (pattern detection, DNA generation, LLM calls) server-side | All engine services | TODO |

**Why this matters:** Right now the engine runs client-side. That means:
- Source healthcare data passes through the browser (PHI exposure risk if browser is compromised)
- Anthropic API key would have to be `VITE_*` exposed to call the LLM from client (CLAUDE.md rule violation)
- Hospital security review will flag client-side data processing as a non-starter

**Estimate:** 6 hours.

### B3 — CI test gate for the engine specifically

| # | Task | Files | Status |
|---|------|-------|--------|
| B3.1 | Add a dedicated test workflow that runs `npx vitest run src/services/migration-engine src/services/enterprise-migration` separately from the main test suite, with its own pass/fail badge | New workflow | TODO |
| B3.2 | Report the engine test count in the build summary so a pilot evaluator can see "136 tests passed" specifically for the engine | — | TODO |

**Why this matters:** Pilot evaluators want to see "the migration engine specifically had X passing tests at deploy time," not buried in a 11,554-test pile.

**Estimate:** 1 hour.

### B4 — Sample 3 tests for quality (defend the "136 tests" claim)

| # | Task | Files | Status |
|---|------|-------|--------|
| B4.1 | Pick one test from each of the 4 engine test files. Verify each passes the deletion test (would fail if implementation was stubbed to `() => null`) | 4 test files | TODO |
| B4.2 | If any are junk per the deletion test rule, replace with behavioral assertions | — | TODO |

**Why this matters:** "136 tests" is a marketing number until quality is sampled. CLAUDE.md's deletion test is the right standard.

**Estimate:** 1 hour.

### B5 — End-to-end demo of round-trip migration

| # | Task | Status |
|---|------|--------|
| B5.1 | Pick a synthetic source dataset (e.g., a CSV mimicking Epic's `PAT_*` column conventions). Document it in `docs/demos/migration-engine-demo-data/` | TODO |
| B5.2 | Run the engine against it. Capture the output: DNA fingerprint, detected patterns, learned mappings, confidence scores | TODO |
| B5.3 | Document the run in `docs/demos/migration-engine-walkthrough.md` with screenshots from the dashboard | TODO |
| B5.4 | Re-run with the same dataset to demonstrate the learning loop closes (confidence increases on second run) | TODO |

**Why this matters:** "We have a learning engine that gets better with every migration" is a sentence Epic can't say. Proving it with a demo turns the patent spec into a sales asset.

**Estimate:** 4 hours.

### B6 — Patent claims ↔ implementation alignment check

| # | Task | Files | Status |
|---|------|-------|--------|
| B6.1 | Read `docs/patent/PATENT_SPECIFICATION_MIGRATION_ENGINE.md` end-to-end | — | TODO |
| B6.2 | For each claim in the patent's "Detailed Description" section, verify the corresponding code exists. Note any aspirational claims that need code to back them | — | TODO |
| B6.3 | Update either the patent spec OR the implementation so 1:1 alignment exists before filing | — | TODO |

**Why this matters:** Patent applications that claim more than the implementation supports are vulnerable to invalidation. Better to file a tighter spec that the code clearly demonstrates than a broad spec with gaps.

**Estimate:** 3 hours.

---

## Suggested Execution Order

If you can spare one session to harden this, do it in this order — highest leverage first:

1. **A1** (CI dry-run gate, 2h) — prevents future audit_logs-style bugs at PR time
2. **A2** (Delete dead scripts, 15min) — cleanup, removes confusion
3. **B1** (Decompose EnterpriseMigrationDashboard, 3h) — fixes a god file that's tied to a pitch asset
4. **B5** (End-to-end demo, 4h) — converts patent into sales asset
5. **B2** (Edge function wrapper, 6h) — only needed before a hospital security review
6. **A4** (audit_logs SoT, 3h) — only needed if audit_logs schema continues to drift
7. Everything else as time permits

Total if you do all of it: ~22 hours across 4-6 sessions.

---

## Cross-References

- `docs/PROJECT_STATE.md` — top-level state
- `docs/trackers/god-file-decomposition-tracker.md` — includes `EnterpriseMigrationDashboard.tsx` as item F1
- `docs/patent/PATENT_SPECIFICATION_MIGRATION_ENGINE.md` — the patent spec
- `scripts/governance-drift-check.sh` — runs the dry-run check Maria can run manually today
- `scripts/weekly-housekeeping.py` — the Sunday-night automation that already checks migration drift
- `.claude/rules/adversarial-audit-lessons.md` — the edge function auth checklist (relevant to B2)
- `.claude/rules/supabase.md` — migration discipline rules
- Audit origin commit: 2026-05-20 session (see `git log --grep="Compass Riley\|migration"` near this date)
