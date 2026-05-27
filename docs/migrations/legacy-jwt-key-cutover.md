# Legacy JWT Key Cutover Plan

> **Status:** Plan only — no code changes pending. Maria + Akima approval required before execution.
> **Created:** 2026-05-27 (Claude self-audit S-HK-3)
> **Owner:** Maria (AI System Director)
> **Reviewer:** Akima (CCO)
> **Tracker:** `docs/trackers/claude-self-audit-2026-05-20-tracker.md` (Session 2, S-HK-3)

---

## Background

In late 2025 Supabase introduced a new API key format:

| Legacy (deprecated) | New (current standard) | Format |
|---|---|---|
| `SUPABASE_ANON_KEY` / `SB_ANON_KEY` | `SB_PUBLISHABLE_API_KEY` | `sb_publishable_*` (was JWT `eyJhbGci…`) |
| `SUPABASE_SERVICE_ROLE_KEY` / `SB_SERVICE_ROLE_KEY` | `SB_SECRET_KEY` | `sb_secret_*` (was JWT `eyJhbGci…`) |

**These are different credentials, not aliases.** New keys are issued separately; legacy JWT keys are losing privileges over time (per `.claude/rules/supabase.md` §14).

Our codebase migrated to the new keys as PRIMARY in Q1 2026. We retained the legacy names as FALLBACK in env-resolution chains:

```ts
// supabase/functions/_shared/env.ts
export const SB_SECRET_KEY: string =
  envGet("SB_SECRET_KEY") || envGet("SB_SERVICE_ROLE_KEY") || envGet("SUPABASE_SERVICE_ROLE_KEY");

export const SB_ANON_KEY: string =
  envGet("SB_PUBLISHABLE_API_KEY") || envGet("SB_ANON_KEY") || envGet("SUPABASE_ANON_KEY");
```

```ts
// src/lib/supabaseClient.ts
const url = SB_URL || SUPABASE_URL;
const key = SB_PUBLISHABLE_API_KEY || SUPABASE_PUBLISHABLE_API_KEY;
```

This document plans the cutover that removes the legacy fallback once we are confident the new keys are stable.

---

## Current State (verified 2026-05-27)

| Surface | Files with legacy fallback | Notes |
|---|---|---|
| Edge functions | **72** files reference `SUPABASE_ANON_KEY` or `SUPABASE_SERVICE_ROLE_KEY` (mostly via the centralised `_shared/env.ts`) | Most read through `env.ts`; a smaller set inline `Deno.env.get("SUPABASE_…")` directly |
| Frontend | `src/lib/supabaseClient.ts` falls back to `SUPABASE_PUBLISHABLE_API_KEY` | Single import path; cleanup is one file |
| `.github/workflows/` | Several CI workflows export `SUPABASE_ANON_KEY` env vars to test environments | Must update CI secrets in lockstep |
| `vercel env` | Production env has both new and legacy keys set | Both names continue to resolve to a working value today |

**Why keep the fallback today:** if Supabase has a regression on the new keys (e.g., RLS exception, token introspection bug), the legacy chain still resolves to a working credential. Removing the fallback is a one-way decision — once removed, any environment that hasn't yet been configured with `SB_*` names will fail closed.

---

## Cutover Phases

**Order matters.** Edge functions cut over first because they are server-side, easily redeployable, and protected by Vercel/Supabase deployment gates. The frontend is last because a misconfigured frontend produces an immediate white-screen on every user's device.

### Phase 0 — Pre-flight (one session, no code changes)

| # | Task |
|---|------|
| 0.1 | Verify `SB_URL`, `SB_PUBLISHABLE_API_KEY`, `SB_SECRET_KEY` are set in all three environments: local `.env*`, GitHub Actions secrets, Vercel project env (Preview AND Production) |
| 0.2 | Run `vercel env ls --environment production \| grep -E "SB_\|SUPABASE_"` and confirm both new and legacy names are present |
| 0.3 | Confirm new keys are NOT rotated/expired (test a sample edge function deploy + frontend smoke load) |
| 0.4 | Snapshot the legacy keys to a 1Password / secret vault entry tagged `phase-out-2026-Q2-rollback` so we can restore them if cutover fails |

### Phase 1 — Edge function cleanup (one session, scoped change)

| # | Task |
|---|------|
| 1.1 | Update `supabase/functions/_shared/env.ts` — remove the `\|\| envGet("SUPABASE_ANON_KEY")` and `\|\| envGet("SUPABASE_SERVICE_ROLE_KEY")` tail of both fallback chains. Keep the `SB_SECRET_KEY \|\| SB_SERVICE_ROLE_KEY` chain (those are both new-format aliases). |
| 1.2 | Codebase-wide grep for inline legacy references: `grep -rn "SUPABASE_ANON_KEY\|SUPABASE_SERVICE_ROLE_KEY" supabase/functions --include="*.ts"`. Each must be either (a) using the centralised env.ts (clean — already covered by 1.1) or (b) inlining `Deno.env.get("SUPABASE_…")` directly. For (b) — replace the inline references with the centralised import. |
| 1.3 | Redeploy ALL affected edge functions in a batch. `npx supabase functions deploy --no-verify-jwt` deploys all of them; use targeted deploys if you want a smaller blast radius first (recommended: deploy `phi-encrypt`, `weather-proxy`, `withings-webhook`, `garmin-webhook`, `fitbit-webhook` first as a canary, then the rest). |
| 1.4 | Smoke test: invoke `phi-encrypt` from the browser (any tenant), verify 200. Invoke a webhook with a valid sig, verify 200. If either fails 401/500: rollback. |
| 1.5 | Wait 24 hours. Watch `audit_logs` for new `PHI_ENCRYPT_KEY_MISSING` events. If clean → proceed to Phase 2. If not clean → restore legacy fallback via revert of step 1.1, redeploy. |

### Phase 2 — Frontend cleanup (one session, scoped change)

| # | Task |
|---|------|
| 2.1 | Update `src/lib/supabaseClient.ts` — remove the `\|\| SUPABASE_PUBLISHABLE_API_KEY` fallback. Single line change. |
| 2.2 | Update `src/settings/settings.ts` `assertClientSupabaseEnv()` to require `SB_PUBLISHABLE_API_KEY` instead of accepting either name. |
| 2.3 | Run `bash scripts/typecheck-changed.sh && npm run lint && npm test`. |
| 2.4 | Deploy to Preview env first. Smoke test login flow, dashboard load, weather widget call. |
| 2.5 | Promote to Production. Watch error rates for 30 minutes via Vercel runtime logs + Supabase dashboard. |

### Phase 3 — Documentation + env hygiene (one session)

| # | Task |
|---|------|
| 3.1 | Update `.env.example` — remove `VITE_SUPABASE_ANON_KEY=` and `VITE_SUPABASE_PUBLISHABLE_KEY=` lines. Keep only `VITE_SB_*`. |
| 3.2 | Update `src/vite-env.d.ts` — remove `readonly VITE_SUPABASE_ANON_KEY?: string;` and `readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;`. |
| 3.3 | Update `src/custom.d.ts` (process.env declarations) — remove the legacy entries. |
| 3.4 | Update `CLAUDE.md` Rule #14 (Supabase Key Migration) to mark legacy keys as removed, not deprecated. |
| 3.5 | Update `.claude/rules/supabase.md` §13 (Environment Variables) — remove the legacy fallback rows from the env var tables. |
| 3.6 | Vercel: remove the legacy env var entries (`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`) from Preview + Production. |
| 3.7 | GitHub Actions secrets: remove the legacy entries from repo settings. |

### Phase 4 — Verification + close-out (one session)

| # | Task |
|---|------|
| 4.1 | `grep -rn "SUPABASE_ANON_KEY\|SUPABASE_SERVICE_ROLE_KEY\|SUPABASE_PUBLISHABLE_KEY" .` (excluding `node_modules`, `dist`, `build`) → must return 0 hits in source code. |
| 4.2 | `grep -rn "VITE_SUPABASE_ANON_KEY" src` → must return 0. |
| 4.3 | Update this document's status header to `Status: Executed YYYY-MM-DD, ratified by Maria + Akima`. |

---

## Rollback Plan

Each phase is independently revertible.

### Rollback from Phase 1 (edge functions)

| Symptom | Action |
|---|---|
| Edge function 500s with "PHI_ENCRYPTION_KEY not configured" or similar key-missing errors | Revert the `_shared/env.ts` change (re-add legacy fallback tail), redeploy affected functions. Investigate which env var name is missing in the runtime — likely a Supabase secret needs to be set with the `SB_*` name. |
| Token-introspection failures (e.g., `getUser()` returns "invalid token") | The new `SB_PUBLISHABLE_API_KEY` may not match the project. Confirm the key value in Supabase dashboard matches what `vercel env pull` shows. |
| Edge function deploy itself fails | This is a Supabase platform issue, not a key issue. Roll back the deploy. |

### Rollback from Phase 2 (frontend)

| Symptom | Action |
|---|---|
| Users see "Failed to load" on first navigation | The frontend can't find `SB_URL` or `SB_PUBLISHABLE_API_KEY` in Vercel env. Verify Vercel env vars and redeploy. |
| Login flow fails with "Invalid API key" | The publishable key doesn't match the project URL. Confirm `VITE_SB_URL` matches the `SB_URL` in Supabase dashboard. Restore the legacy fallback by reverting `supabaseClient.ts` and `settings.ts`. |
| White screen with no error | `assertClientSupabaseEnv()` failed — check Vercel build logs. |

### Phase 3+4 rollback

Cosmetic — restore from git revert. No service impact.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Supabase deprecates legacy keys before we cut over | Medium (sometime in 2026) | High — sudden 401s across the platform | Stay current with the Supabase changelog; expedite this plan if a deprecation date is announced |
| New keys silently lose a privilege legacy keys had | Low | Medium — specific operations fail (RLS-bypassing service-role calls, etc.) | Phase 1 canary catches this in 24h before broad rollout |
| Vercel env var migration mishap | Low | High — all production users get a white screen | Maintain BOTH names in Vercel through Phase 2, only remove in Phase 3 |
| Edge function deploy churn unintended consequences | Low | Medium | Deploy in batches (canary first), watch `audit_logs` for new error types |
| Legacy fallback removed AND new key rotates simultaneously | Very low | High — cold start can't find ANY credential | Schedule cutover and key rotation > 30 days apart |

---

## Pre-Cutover Approval Checklist

Before starting Phase 0, Maria and Akima sign off:

- [ ] Supabase has NOT publicly announced a deprecation deadline for legacy keys (if they have, this becomes urgent rather than discretionary)
- [ ] All current Vercel environments have `SB_*` keys configured
- [ ] No pending vendor integration is depending on the legacy key names (review `docs/compliance/vendors/` if applicable)
- [ ] We have a 1-hour maintenance window available to do Phase 2 + watch error rates
- [ ] Akima has confirmed no compliance documentation references the legacy variable names that would need to be revised

---

## Cross-references

- `.claude/rules/supabase.md` §13 (Environment Variables), §14 (Supabase Key Migration), §15 (JWT Standards)
- `supabase/functions/_shared/env.ts` — current fallback resolver
- `src/lib/supabaseClient.ts` — frontend client init
- `src/settings/settings.ts` — `assertClientSupabaseEnv` guard
- `docs/trackers/claude-self-audit-2026-05-20-tracker.md` — origin task S-HK-3
