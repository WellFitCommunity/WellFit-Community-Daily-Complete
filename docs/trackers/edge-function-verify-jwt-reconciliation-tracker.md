# Edge-Function `verify_jwt` Reconciliation + Health-Check Sweep

**Created:** 2026-06-06 · **Owner:** Claude (Maria-directed) · **Status:** ✅ BOTH TASKS DONE 2026-06-06 (awaiting commit + Maria's call on 8 FAILING functions)
**Origin:** Came out of the 2026-06-05/06 cron-auth + email-consolidation work. While fixing guardian/security-alert-processor/send-email/emergency-alert-dispatch, we found `config.toml` has drifted badly from the live gateway state — making any bulk `supabase functions deploy` actively dangerous.

---

## THE PROBLEM (why this exists)

`npx supabase functions deploy` (no name) reads `supabase/config.toml`; for any function **not** declared there it applies the CLI default **`verify_jwt = true`**. Measured 2026-06-06:

| Metric | Count |
|---|---|
| Live edge functions | 168 |
| Live with `verify_jwt = false` | 159 |
| Declared in `config.toml` | 30 |
| **Live-`false` but NOT in `config.toml` → would flip to `true` on bulk deploy** | **129** |

A bulk deploy today would flip **129 functions** to require a JWT and **break every one called by a cron, DB webhook, or service key** (non-JWT `sb_secret_*`). This is not theoretical: on 2026-06-06 deploying `emergency-alert-dispatch` **without** a config entry flipped it to `verify_jwt=true` and it began returning `401 UNAUTHORIZED_INVALID_JWT_FORMAT` to the service key — caught by a health probe, fixed by pinning it `false` + redeploying. The same failure ×129 is the risk.

**Hard rule until this tracker is done:** deploy **per-function only**, and **pin its `verify_jwt` in `config.toml` first**. NO bulk `supabase functions deploy`.

---

## TASK #1 — Reconcile `config.toml` `verify_jwt` for all 159 live-`false` functions

**Goal:** make `config.toml` an accurate, complete declaration of every function's intended `verify_jwt`, so deploys become **idempotent** (a deploy can never silently change a gateway) and bulk-deploy becomes safe.

**This is NOT a blind "set all 129 to false."** Several of the 129 *should* be `verify_jwt = true` (user-facing functions that receive a real Supabase JWT). Each needs a one-line judgment. Buckets:

| Intended `verify_jwt` | Which functions | Why |
|---|---|---|
| **`false`** (pin it) | cron-triggered, DB-webhook-triggered, service-key edge-to-edge callers, pre-auth/public (login, register, sms codes, hcaptcha), MCP servers (own API-key auth), functions that do their OWN in-function auth | gateway can't verify the non-JWT `sb_secret_*` key / caller has no JWT yet |
| **`true`** (let gateway verify) | functions called only from the browser with a logged-in user's JWT and that rely on the gateway for auth | tightening; gateway JWT check is the right layer |

**Data sources (do not guess — read these):**
- Live state: `mcp__claude_ai_Supabase__list_projects` then `list_edge_functions` (project `xkybsjnvuohpqpbkikyn`) → each function's `verify_jwt`. (NOTE: the list result is huge; it gets spilled to a tool-results file — parse with `python3 json.loads(...)['functions']`.)
- Caller discovery per function: `grep -rn "functions/v1/<name>\|invoke('<name>')\|invoke(\"<name>\")" src supabase/functions --include=*.ts` + check `cron.job` (live SQL) + Supabase DB webhooks.
- Current declarations: `grep -n "\[functions\." supabase/config.toml`.

**Method (per function in the 129):** classify into the table above (default to **`false`** for anything cron/webhook/service-key/MCP/pre-auth — that's the majority; reserve `true` for clearly browser-JWT-only ones). Add a `[functions.<name>]\nverify_jwt = <bool>` block with a one-line comment. Group logically (auth, MCP, AI, bed, send-*, cron, etc.).

**Acceptance criteria:**
1. Every one of the 159 live-`false` functions is declared in `config.toml` (or intentionally set `true` with a reason).
2. A dry comparison shows `config.toml` `verify_jwt` == live `verify_jwt` for all 168 (no function would change gateway state on redeploy). Build a tiny checker (extend Task #2 script or a one-off `python3`) that diffs live vs config and prints any mismatch — must be **0 mismatches** before declaring done.
3. Do NOT bulk-deploy as the "test." Verify by the diff, then (optionally) redeploy 1–2 representative functions and confirm their `verify_jwt` is unchanged live.
4. Commit `config.toml` with the full reconciliation; report the before/after counts.

**Guardrail:** flipping any function to `verify_jwt=true` is an auth-posture change (Tier-3 per `ai-repair-authority.md`). For this pass, **prefer pinning the working live value (`false`)**; only propose `true` where you're confident it's browser-JWT-only, and **list those separately for Maria's sign-off** rather than flipping silently.

---

## TASK #2 — Health-check sweep for all 168 functions

**Goal:** one command that pings every deployed function and prints a clean `ALIVE / FAILING` readout, so "is everything working?" has a real answer without redeploying anything.

**Build:** `scripts/edge-function-health-sweep.sh` (or `.py`). For each live function slug:
- Send a minimal probe (most reject on auth/payload — that's fine; we're checking the function is **reachable and not 5xx/dead**, not that the business logic succeeds).
- Classify by status: **`2xx`/`400`/`401`/`403` = ALIVE** (function booted and responded); **`404` = MISSING** (deployed-name mismatch / not found); **`5xx`/timeout/no-response = FAILING** (boot error, bad import, crash).
- MCP servers expose a `ping` tool — use it where available for a true-green check.
- Print a summary table + a non-zero exit if any `5xx`/`404`/timeout.

**Notes / gotchas:**
- The gateway requires *some* auth header even when `verify_jwt=false` (missing header → `401 UNAUTHORIZED_NO_AUTH_HEADER`). Send `Authorization: Bearer <key>` + `apikey: <key>` so probes reach the function. Use the anon/publishable key for probes (do NOT hardcode secrets in the script — read from env / `vault`).
- Don't trigger side-effecting paths: probe with a benign/invalid payload that fails validation **before** any send/DB-write (e.g. emergency-alert-dispatch with `is_emergency:false` → 200 "skipped", no email).
- `get_logs(edge-function)` is the complementary signal — a function can be ALIVE on probe but erroring on real traffic; cross-check the logs for 401/5xx spikes.

**Acceptance criteria:**
1. Script runs, covers all 168 live slugs, prints ALIVE/MISSING/FAILING per function + a summary.
2. Any FAILING/MISSING is investigated (likely a name mismatch or a broken import) — report the list to Maria, don't auto-fix beyond obvious cases.
3. Wire it as a manual ops tool (and consider a nightly cron later); document usage in the script header.

---

## Do-NOT list
- ❌ No bulk `npx supabase functions deploy` until Task #1's diff shows 0 live-vs-config mismatches.
- ❌ No silent flip of any function to `verify_jwt=true` — list those for Maria.
- ❌ No secrets hardcoded in the health-sweep script.

## Definition of done
- `config.toml` declares `verify_jwt` for all 159 live-`false` functions; live-vs-config diff = 0 mismatches; any proposed `true` flips listed for Maria.
- `scripts/edge-function-health-sweep.sh` exists, runs green across 168, FAILING/MISSING list reported.
- Both committed; PROJECT_STATE updated.

---

## ✅ PROGRESS LOG — 2026-06-06 (both tasks done; commit pending)

**Live re-measure (drifted by 1 from the original spec because `send_email` was deleted last session):**
167 live functions · **9 `verify_jwt=true`** · **158 `verify_jwt=false`** · config declared only 30 → **128 live-false were undeclared** (would flip to `true` on bulk deploy).

### Task #1 — config.toml reconciliation — DONE ✅
- Rewrote `supabase/config.toml` to declare **all 167 live functions explicitly** (grouped: pre-auth/public, envision auth, admin auth, MCP, AI, bed, FHIR/interop/SMART, messaging, cron/ops, webhook/device, system/misc, + a `verify_jwt=true` group for the 9). Plus 2 not-yet-deployed-but-source-present (`mcp-patient-context-server`, `weather-proxy`) pinned `false` defensively for correct first-deploy posture.
- **Per the guardrail: pinned every function to its working LIVE value; flipped NOTHING.** All 158 live-false → `false`; the 9 live-true → `true` (documenting existing state, not a flip).
- Built **`scripts/check-verify-jwt-drift.py`** + committed live snapshot **`scripts/live-edge-functions.json`** (slug+verify_jwt only; refresh via MCP `list_edge_functions`). Diffs config-effective (declared, else CLI default `true`) vs live.
- **Result: 0 mismatches across all 167.** Bulk `supabase functions deploy` is now idempotent. Proven: green → injected `send-email`=true drift → checker FAIL (exit 1) → restored → green (exit 0).
- **No `true` flips proposed this pass** (every function works at its live value; flipping is Tier-3). A future "tighten browser-JWT-only functions to `true`" pass remains available for Maria's sign-off — deferred, not needed for the safety goal.

### Task #2 — health-check sweep — DONE ✅
- Built **`scripts/edge-function-health-sweep.sh`**: OPTIONS probe (CORS preflight — zero side effects, proves boot), public key from env/.env (never hardcoded), parallel (-P 8), retry-once on timeout. Classifies 2xx/400/401/403/405/426=ALIVE, 404=MISSING, 5xx/000=FAILING. Exit 1 if any MISSING/FAILING.
- **Run result: 167 probed · 159 ALIVE · 0 MISSING · 8 flagged non-2xx on the preflight probe.**

> **⚠️ IMPORTANT — the probe flags functions worth investigating, NOT confirmed outages.** A function can return non-2xx to an OPTIONS/POST *probe* and still work fine on its real (browser-invoke / cron-POST) path. **Maria confirmed 2026-06-06 that hCaptcha works in production** — so `verify-hcaptcha`'s `000` was a **PROBE FALSE POSITIVE**, not a dead function. Only flags **cross-confirmed in live edge logs as erroring on real method traffic** should be treated as real. Lesson baked into the tool's header: 000/timeout and 5xx-not-in-logs must be log-confirmed before being called FAILING.

| Function | Probe | Real-traffic status |
|---|---|---|
| `verify-hcaptcha` | 000 | ✅ **WORKS — Maria-confirmed.** Probe false positive (raw curl ≠ the working `supabase.functions.invoke` path used by `src/utils/verifyHcaptcha.ts`). NOT an outage. |
| `send-checkin-reminders` | 500 | OPTIONS→500 seen in live logs; **real cron-POST path unconfirmed** — verify before claiming broken |
| `send-consecutive-missed-alerts` | 500 | OPTIONS→500 seen in live logs; real cron-POST path unconfirmed |
| `send-telehealth-appointment-notification` | 500 | OPTIONS→500 seen in live logs; real path unconfirmed |
| `nightly-excel-backup` | 500 | OPTIONS→500 seen in live logs; real cron path unconfirmed |
| `ai-billing-suggester` | 500 | probe-only (not in log window) — unconfirmed |
| `ai-readmission-predictor` | 500 | probe-only (not in log window) — unconfirmed |
| `bed-capacity-monitor` | 503 | probe-only (not in log window) — unconfirmed |

These have `handleOptions`/`corsFromRequest` in source yet error on a preflight — could be a preflight-only CORS bug (real path fine, as with hCaptcha) **or** stale-deploy / module-scope throw. **Not auto-fixed** (Tier-3). The honest next step is to confirm each against real-traffic logs (recent successful cron/invoke 2xx) before opening any repair tracker.

### Other findings (bonus)
- `guardian-pr-service` still **deployed live** (ALIVE 204) but its **source was deleted** in GRD-8 (same orphan pattern as the retired `send_email`). Cleanup candidate — confirm with Maria before undeploying.
- `mcp-patient-context-server` (governance S9 lists it T2) has local source but is **NOT deployed**; `weather-proxy` likewise.
- Likely renames: live `admin-user-questions-and-rate-limit` (true) vs local `admin-user-questions` (false).

**Artifacts:** `supabase/config.toml` (rewritten), `scripts/check-verify-jwt-drift.py`, `scripts/live-edge-functions.json`, `scripts/edge-function-health-sweep.sh`. Validated: TOML parses (169 blocks), bash `-n` clean, py_compile clean, drift checker 0 mismatches.
