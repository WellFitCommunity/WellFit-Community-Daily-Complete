# Failing Edge Functions — Boot-Crash Repair

**Created:** 2026-06-07 · **Owner:** Claude (Maria-directed) · **Status:** 🔴 DIAGNOSED — fixes + deploys pending laptop
**Origin:** The `edge-function-health-sweep.sh` (from the verify_jwt tracker) flagged 8 functions. `verify-hcaptcha` was a **probe false positive** (Maria confirmed it works on every login). The other **7 are genuinely broken** — confirmed across two sweeps + direct probe: they return `WORKER_ERROR` (500) or `BOOT_ERROR` (503), i.e. the isolate **crashes at module load before any handler runs**. A cron POST hits the identical crash, so these are down for ALL traffic, not just the probe.

> ⚠️ **Patient/operational impact:** `send-checkin-reminders` (cron utc14/utc15) and `send-consecutive-missed-alerts` (cron 15:00 UTC daily) are **scheduled and firing — and silently boot-crashing every run.** Seniors' daily check-in reminders and the missed-check-in escalation (a safety feature) have not been working. These two should be prioritized.

---

## Confirmed live state (2026-06-07)
| Function | Probe | Error | Cron-scheduled? |
|---|---|---|---|
| `send-checkin-reminders` | 500 | WORKER_ERROR | ✅ utc14 + utc15 daily |
| `send-consecutive-missed-alerts` | 500 | WORKER_ERROR | ✅ 15:00 UTC daily |
| `nightly-excel-backup` | 500 | Internal Server Error | (backup) |
| `ai-billing-suggester` | 500 | WORKER_ERROR | on-demand + batch |
| `ai-readmission-predictor` | 500 | WORKER_ERROR | discharge-triggered |
| `bed-capacity-monitor` | 503 | BOOT_ERROR | cron |
| `send-telehealth-appointment-notification` | 500 | WORKER_ERROR | appointment-triggered |

---

## ROOT CAUSES (by class)

### Class A — shadowed import = boot SyntaxError  ✅ root-caused
**`ai-billing-suggester`** (`index.ts:16`):
```ts
import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
...
const SUPABASE_URL = SUPABASE_URL!;   // ← redeclares the imported binding → "Identifier already declared"
const SERVICE_KEY  = SB_SECRET_KEY!;
```
Redeclaring an imported name with `const` is a load-time SyntaxError → the whole module fails to start. This is exactly adversarial-audit **lesson #5 (no shadowing imports)** — reintroduced here.
**Fix:** delete the `const SUPABASE_URL = SUPABASE_URL!;` line; use the imported `SUPABASE_URL` directly (keep `SERVICE_KEY` — that name isn't imported, so it's fine). Then `grep -rn "= SUPABASE_URL!\|= SB_SECRET_KEY!\|const \([A-Z_]*\) = \1" supabase/functions --include=*.ts` for sister occurrences (Rule #1).

### Class B — module-scope `validateEnvVars([...])` throws on a missing/legacy var  ✅ root-caused
`shared/types.ts:192` — `validateEnvVars` **throws** if any listed env var is unset. Called at **module scope** (so it crashes the isolate at load):
- `send-checkin-reminders:21` → `validateEnvVars(["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","FCM_SERVER_KEY"])`
- `send-consecutive-missed-alerts` → same shape (`FCM_SERVER_KEY!`)
- `nightly-excel-backup:42` → `validateEnvVars(["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","BACKUP_BUCKET","BACKUP_PATH_PREFIX"])`

Almost certainly the missing var is **`SUPABASE_SERVICE_ROLE_KEY`** (legacy name — the project migrated to `SB_SECRET_KEY`, so the legacy var may be unset) and/or **`FCM_SERVER_KEY`** / the BACKUP_* vars.
**Fix:** (1) move env validation **inside the handler** and fail gracefully (a missing secret should return 500-with-message, not crash the isolate at load); (2) validate the **new** key names (`SB_SECRET_KEY`, already imported) instead of the legacy `SUPABASE_SERVICE_ROLE_KEY`; (3) set any genuinely-missing secrets (`BACKUP_BUCKET`/`BACKUP_PATH_PREFIX`) — confirm with Maria. Note these also import from `../shared/types.ts` (the non-`_shared` `shared/` dir) — verify that path is intended.

> 🚩 **STRATEGIC FLAG (needs Maria) — legacy FCM/Firebase push is a DEAD Google API.** `send-checkin-reminders`, `send-consecutive-missed-alerts`, and `send-telehealth-appointment-notification` push via the **legacy** endpoint `https://fcm.googleapis.com/fcm/send` with `FCM_SERVER_KEY`/`FIREBASE_SERVER_KEY`. **Google shut down the legacy FCM API in June 2024.** Even after the boot crash is fixed, push won't deliver — these need migration to **FCM HTTP v1** (OAuth service-account, different payload). Decision for Maria: migrate to v1, or drop the push leg and rely on SMS/email? (Ties into the Guardian-SMS direction.)

### Class C — boot crash not yet pinned to a line  🔍 investigate at laptop
- **`ai-readmission-predictor`** — many `_shared/compass-riley/*`, `decisionChain`, `culturalCompetencyClient` imports; likely a transitive load-time error in one of them. Bisect imports.
- **`bed-capacity-monitor`** — `BOOT_ERROR` (parse/import failure, not a runtime throw); suspect the version-pinned `esm.sh/@supabase/supabase-js@2.39.0` import or a transitive `jsr:`. Check `deno check`.
- **`send-telehealth-appointment-notification`** — uses `esm.sh/@supabase/supabase-js@2.45.4?dts` (the `?dts` param is unusual and may not resolve under Deno deploy). Try `?target=deno`.

---

## Method (per function — laptop)
1. `bash scripts/deno-typecheck.sh` won't run here (Deno not installed in codespace) — install Deno or run `deno check supabase/functions/<fn>/index.ts` locally to reproduce the boot error pre-deploy.
2. Apply the fix above (Class A/B are known; Class C: bisect imports / fix the esm.sh specifier).
3. Deploy per-function: `npx supabase functions deploy <fn>` (needs `supabase login`; config.toml is reconciled so verify_jwt won't flip).
4. **Live-prove:** re-probe with the health sweep → must be ALIVE; for cron senders, trigger one real run (or wait for cron) and confirm a 200 in `get_logs`, plus the intended side effect (reminder/alert actually sent).
5. Rule #1 grep for sister occurrences of each bug class across all functions.

## Acceptance criteria (DONE MEANS DONE)
- [ ] All 7 return ALIVE on `edge-function-health-sweep.sh` (0 FAILING).
- [ ] `send-checkin-reminders` + `send-consecutive-missed-alerts` proven to run a real cron cycle 200 (highest priority — patient impact).
- [ ] FCM-legacy decision made + push leg migrated or removed (Maria).
- [ ] Each fix deployed + live-proven; sister-occurrence grep clean.
- [ ] PROJECT_STATE updated.

## Notes
- This resolves the "8 flagged functions" open item from `edge-function-verify-jwt-reconciliation-tracker.md` (1 false positive + 7 real, now diagnosed here).
- No code edited yet — diagnosis only. Fixes held for a laptop session so each can be deployed + live-verified (DONE MEANS DONE; can't verify a deploy on mobile).
