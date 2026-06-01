# Edge-Function SDK Hygiene Tracker

> **Created:** 2026-06-01 — after a claude-chat structured-output change (RF-8) shipped broken because its SDK was pinned to an ancient version and three sister Anthropic-SDK functions were never type-checked in CI.
> **Goal:** Make SDK version drift and type-check coverage gaps in `supabase/functions/` mechanically impossible to ship.
> **Gate:** `scripts/check-edge-sdk-hygiene.sh` (wired into the CI `deno-typecheck` job 2026-06-01).

---

## Mechanism (built)

`scripts/check-edge-sdk-hygiene.sh` — grep-only, env-independent. Per tracked SDK it enforces:
- **Version consistency** — one pinned version across all importers.
- **Type-check coverage** — every importer is in `scripts/deno-typecheck.sh` HIGH_RISK.

Policy is per-SDK (`enforce` | `report`). The HIGH_RISK list is parsed out of `deno-typecheck.sh` so the guard can never drift from the gate it guards.

---

## DONE — Anthropic slice (2026-06-01)

- ✅ All 4 `@anthropic-ai/sdk` importers pinned to **`0.39.0?target=deno`** (was 0.20.9 / 0.39.0 / 0.63.1). Chosen because it deno-checks clean in CI (0.63.1 pulls an unresolvable transitive `npm:@types/node`; 0.20.9 is ancient).
- ✅ `coding-suggest`, `mcp-claude-server`, `ai-medication-instructions` added to the Deno type-check list (`claude-chat` already there).
- ✅ Latent bugs the new coverage exposed, all fixed + `deno check` clean:
  - `coding-suggest` — `new Date(dob)` with `string | null | undefined` (TS2769 null-safety).
  - `mcp-claude-server` — `caller.tenantId` (`string | null`) → `?? undefined` at 2 sites; `'meta_triage'` added to the shared `safetyFlags` union in `_shared/mcpServerBase.ts` (the code already emitted it).
- ✅ Anthropic policy = `enforce`. Gate is green: single version + all 4 covered.

---

## TODO — Supabase slice (deferred — larger, mechanical)

`@supabase/supabase-js` is currently `report`-only in the gate. Findings to remediate before flipping to `enforce`:

- ◻️ **Version sprawl: 8 distinct versions** — `2.28.0, 2.38.4, 2.39.0, 2.39.3, 2.39.4, 2.45.4, 2.49.1, 2.57.2`. Pin every edge-function importer to ONE approved version. ~110 files. Mechanical (find/replace per file) but must `deno check` after — pinning a newer version may expose latent type errors the same way the Anthropic pin did.
  - **Decision needed (Maria):** which version to standardize on. Recommend the newest that deno-checks clean across a sample (test 2.57.2 first; fall back if it pulls unresolvable transitive types like the Anthropic 0.63.1 did).
- ◻️ **Coverage: 117 importers not type-checked.** Putting all ~110 supabase importers in the per-file Deno gate is too slow. **Decision needed (Maria):** either (a) keep `report`-only and rely on spot-checking high-risk ones, or (b) add a `deno check --all` CI job on a schedule (nightly) rather than per-push.
- ◻️ Once a version is pinned + a coverage policy chosen, flip `@supabase/supabase-js` to `enforce` (or keep `report` with the nightly `--all` job).

---

## TODO — remaining hardening gates

- ◻️ **Gate 2 — `req.json()` validation.** Add a `governance-check.sh` rule flagging any `await req.json()` whose destructured result isn't passed through a schema validator (Zod or a `_shared` validator). Addresses untyped server-boundary `any` flowing into edge-function logic. Start `report`-only, then enforce. ~1–2h.
- ◻️ **Gate 3 — pre-push `audit-ci --high`.** The vitest critical CVE (fixed 2026-06-01) was only caught by CI *after* push. Add a pre-push hook (or a fast CI job on PRs) running `audit-ci --high` so dependency CVEs are caught before main. ~30m.

---

## Regression checks

```bash
# Anthropic slice must stay clean:
bash scripts/check-edge-sdk-hygiene.sh            # exit 0

# Every Anthropic-SDK importer is on one version:
grep -rhoE "@anthropic-ai/sdk@[0-9.]+" supabase/functions --include="*.ts" | sort -u   # one line only
```
