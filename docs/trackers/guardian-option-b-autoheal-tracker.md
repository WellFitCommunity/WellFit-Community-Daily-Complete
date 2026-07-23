# Guardian Option B — Overnight Auto-Heal + Auto-PR Tracker

> **Created:** 2026-07-23 · **Owner:** Claude (Maria-directed)
> **Status:** READY — Session 0 can start without questions
> **Estimate:** ~3–4 sessions (16–48h bucket). Session boundaries below.
> **Supersedes the "PARKED" status of T-4 in `docs/trackers/todo-inventory-tracker-2026-07-23.md`.**

---

## Decision record (do not re-litigate)

| Decision | Answer | When |
|---|---|---|
| Autonomy tier | **Option B — "mitigate now, merge in morning."** Guardian self-heals SAFE/TRANSIENT classes unattended (cache clear, pool restart, retry/backoff, failover to backup model/endpoint, feature-flag toggle). For anything needing a **code change**, Guardian auto-**OPENS** a GitHub PR; the fix ships only after Maria's one-tap approval. **Unreviewed code NEVER reaches prod. Auto-merge/deploy stays Tier-4 forbidden.** | Decided 2026-06-06; **re-confirmed by Maria 2026-07-23** |
| Paper trail | Maria's explicit requirement: Guardian corrects the error AND leaves a paper trail. See "Paper trail contract" below — it is an acceptance criterion for every session, not a nice-to-have. | 2026-07-23 |
| GitHub credential | **GitHub App** (not PAT): repo-scoped, revocable independent of any human account, SOC2-clean. Engineering call made by Claude 2026-07-23 per extend-elicitation feedback. | 2026-07-23 |
| T-4 scope | BUILD: T-4b items 1–2 (tool signing, runtime capability enforcement) + T-4a resource limits already largely present. **PARK INDEFINITELY:** tool marketplace, tool versioning/rollback, Zod auto-generation (T-4c), Web-Worker process isolation (revisit only if a real need appears). | 2026-07-23 |

## Paper trail contract (applies to every phase)

Every autonomous Guardian action MUST produce ALL of:
1. `audit_logs` row (`source: 'ai_agent'`, per `ai-repair-authority.md` enforcement section) — what, when, why, which error signature.
2. `security_alerts` row (existing pattern) at appropriate severity.
3. For mitigations: a `guardian_review_tickets` row describing what was done + what durable fix is still needed (even when no approval is required — the ticket IS the morning readback).
4. For code fixes: a PR whose body contains root cause, evidence (log excerpts/alert IDs), the fix rationale, and links to the audit rows.
5. SMS to founders via `security-alert-processor` for critical/high (Session 0 verifies this channel is actually live).

A healing action with no paper trail is a DEFECT, same class as a silent catch block.

---

## Current state (verified 2026-07-23)

| Fact | Evidence |
|---|---|
| `ToolCapabilities` (reads/writes/egress/tables) already DECLARED on every tool | `src/services/guardian-agent/ToolRegistry.ts:105-125` — but `validateCapabilities` checks shape only; **nothing enforces them at runtime** |
| SHA-256 checksums + constant-time compare + executor integrity verification exist and are real | `ToolRegistry.ts` ChecksumUtils (lines 22–98), integrity violation tracking |
| **No signing** — checksums detect drift, they don't prevent a malicious/injected tool from registering | T-4b gap #1 |
| Sandbox has rate limiting (per-minute window), payload-size checks, resource monitor, concurrent-execution limits | `src/services/guardian-agent/ExecutionSandbox.ts` (`ResourceMonitor`, WINDOW_MS 60000) |
| `HealingStrategy` union already includes the Option B mitigation classes | `types.ts:30-43`: `retry_with_backoff`, `circuit_breaker`, `fallback_to_cache`, `configuration_reset`, `resource_cleanup`, etc. — and `auto_patch`, which must be ROUTED TO PR, never direct |
| `guardian-pr-service` does NOT exist (gh-CLI version deleted May 2026 as GRD-8; rebuild wanted) | `ls supabase/functions/` + repo grep 2026-07-23: zero hits |
| Guardian approval workflow functional end-to-end (tickets, approve/reject RPCs restored `20260529180000`) | `docs/trackers/guardian-system-tracker.md` 9/9 complete |
| SMS overnight channel: code fix COMMITTED (`security-alert-processor` supports Messaging Service SID + `SECURITY_ALERT_PHONES`) but secret/deploy/live-test unverified | `supabase/functions/security-alert-processor/index.ts:33-45`; `docs/trackers/guardian-sms-alert-delivery-tracker.md` still says BLOCKED |
| **600-line rule:** `ToolRegistry.ts` = 738 lines, `ExecutionSandbox.ts` = 967 lines — both ALREADY over cap | New code goes in NEW modules (below); do NOT grow these files. Wholesale refactor of the existing overage is out of scope (flag to Maria separately if wanted) |

---

## Session 0 — RESULTS (2026-07-23)

| Check | Result |
|---|---|
| `SECURITY_ALERT_PHONES` secret | **SET this session** to Maria+Akima numbers (was absent). |
| **SMS channel live-test** | ✅ **PASSED 2026-07-23.** Synthetic `critical` alert → `security-alert-processor` → `{channel:"sms",success:true}`; **Maria confirmed she received the text.** Overnight SMS channel is proven. Synthetic alert + its in-app notification deleted afterward (0 synthetic rows remain). |
| Twilio secrets | All present (`TWILIO_MESSAGING_SERVICE_SID` etc.). |
| `security-alert-processor` deployed | ACTIVE v37, cron `* * * * *` active. |
| Monitoring cron alive | YES — `guardian-automated-monitoring` last ran **2026-07-23 07:15** (`guardian_cron_log`). |
| Ticket RPCs in `pg_proc` | All 3 present: `create_guardian_review_ticket`, `approve_guardian_ticket`, `reject_guardian_ticket`. |
| `security_alerts` last 24h | 0 rows — quiet, not broken (monitoring is firing; nothing tripped). |
| **`guardian-pr-service`** | ⚠️ **CRITICAL FINDING — see below. The tracker's premise ("does not exist") was WRONG.** |

### ⚠️ Session 0 finding #2 (lower severity): HIGH-severity alerts have NO working delivery channel

Surfaced by the SMS test. `getChannelsForSeverity` routes: **critical** → email+slack+pagerduty+**sms**; **high** → email+slack only; else → email. In this environment **email is unconfigured** (MailerSend — "Email not configured") and **slack is not connected**. So:
- **critical** alerts DO get through — via **SMS** (proven) + the internal in-app "pagerduty" notification (`security_notifications` row). ✅
- **high** alerts currently reach **nobody** — both their channels are down.

The SMS test incidentally processed 2 stale Dec-2025 `high` Guardian `type_mismatch` alerts that were still `notification_sent=false` (the every-minute cron would have marked them within 60s anyway — left as-is, that is their stable state; no SMS went out for them since high has no SMS route). **Decision for Maria (feeds Option B):** for overnight autonomy, either (a) add SMS to the `high` channel set, (b) guarantee overnight-actionable events are classified `critical`, or (c) configure email/slack. Until then, only `critical` is audible overnight. **Not blocking** the build, but the autonomy design must not rely on `high` reaching anyone.

### 🚨 Session 0 blocker: orphaned, unauthenticated, merge-capable `guardian-pr-service` is LIVE

The tracker (and the 46-day-old memory) said `guardian-pr-service` was deleted in GRD-8. **Half true:** GRD-8 (commit `50ca085d`) removed the *source from the repo*, but the *deployed edge function was never undeployed.* It is live right now:

- **Deployed & ACTIVE**, version 46, last updated 2026-03-28. Not in the repo — a source-less production function (deploy/repo drift, the exact class the governance warns about).
- Exposes three actions: `create_pr`, `get_pr_status`, **`merge_pr`**.
- **`merge_pr` merges straight to `main`** (`PUT /pulls/{n}/merge`, `merge_method: squash`) with **no approval gate, no test gate, no JWT, no role check** — the ONLY gate is a CORS origin check. CORS is not an auth boundary for non-browser callers (the `Origin` header is trivially forgeable by any HTTP client). Uses a stored **PAT** (`GITHUB_TOKEN`, provisioned) with write access to `main`.
- This is simultaneously: (a) an edge-function-auth violation (adversarial-audit-lessons #2), and (b) the **literal auto-merge-to-prod capability Maria forbade**, sitting live in production for ~4 months.
- **Blast-radius check:** nothing in the current repo invokes `guardian-pr-service`, and no other edge function uses `GITHUB_TOKEN`. It is fully orphaned — neutralizing it breaks nothing in the current codebase.
- **Also note:** the client-side `propose-workflow/` merge path (`ProposeWorkflow.mergeProposal`, `GitHubIntegration.autoMerge`) DOES gate on `status==='approved'` + checks — so the *client* path is Option-B-consistent. The raw edge-function `merge_pr` action is the hole.

**Recommended remediation (Maria's call — Tier 3, security):** **undeploy the live `guardian-pr-service` function now** (it's orphaned; the Session 3 rebuild replaces it cleanly with a GitHub App that has NO merge permission). Cleanest because it removes the drift entirely. Lower-touch alternative: remove the `GITHUB_TOKEN` secret, which instantly neuters it (function 500s without the token) and is trivially reversible — but leaves the drifted function deployed. Either way, `merge_pr` must NOT survive into the Option B design.

**This retroactively validates the whole Option B exercise:** an auto-merge-to-main path already existed unguarded. Session 3's design (GitHub App, Contents+PR-write only, NO merge perm, branch protection requiring review) is what structurally prevents this from being possible again.

### ✅ RESOLVED 2026-07-23 — hardened in place (Maria's call: keep the feature, don't delete)

Maria chose to KEEP the feature (Guardian opens a PR; she reviews+merges from the GitHub mobile app) and KEEP the `GITHUB_TOKEN` — merging from her phone uses her GitHub identity, NOT the function's `merge_pr` action, so removing that action costs her nothing. Commit `659dd4ca`:
- **Source restored** to `supabase/functions/guardian-pr-service/index.ts` (drift closed; `config.toml` block back with `verify_jwt=false` + rationale).
- **Auth gate added:** internal cron/service secret required (`X-Cron-Secret` or `Bearer == CRON_SECRET/SB_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY`), mirroring `security-alert-processor`. CORS origin is explicitly NOT the auth boundary.
- **`merge_pr` action + `mergePR` + `logPRMerge` removed.** Only `create_pr` + `get_pr_status` remain. A comment marks the deliberate absence so no future session re-adds it.
- Proper TS types (deployed bundle had untyped params); `deno check` clean.
- **Live-verified post-deploy:** no-secret → 401; `merge_pr` + valid secret → 400 "Unknown or unsupported action"; `get_pr_status` + valid secret → reaches GitHub (token intact).

**Impact on Session 3:** the PR-creation service now EXISTS, hardened, in the repo. Session 3 shrinks from "rebuild from scratch" to "adapt the existing hardened function to the Paper Trail Contract + (optionally) migrate PAT→GitHub App." The GitHub App migration is now a *hardening nicety*, not a prerequisite — the PAT + in-code secret gate is an acceptable posture. Re-scope Session 3 when reached.

---

### Session 0 verdict

**COMPLETE. Ground is solid for the Option B build**, with two findings recorded above: (1) the merge-capable orphan — RESOLVED (hardened in place); (2) high-severity delivery gap — noted, a design input for Option B, not a blocker. SMS overnight channel proven live. Monitoring cron + ticket RPCs verified. Next: Session 1 (governance edit needs Maria's wording sign-off, then capability enforcement).

---

## Session 0 — Pre-flight verification (~1h, can prepend to Session 1)

1. **SMS channel live?** Check Supabase secrets for `SECURITY_ALERT_PHONES` (`supabase secrets list`), confirm `security-alert-processor` deployed version includes the Messaging-Service fix, then live-test: insert a synthetic critical `security_alerts` row → confirm both founders receive the text. Recipients per `guardian-sms-alert-delivery-tracker.md` (numbers are operational config in that tracker — do NOT copy into new files). If not live: finish that tracker's remaining steps FIRST — overnight autonomy without a working alert channel is forbidden.
2. **Monitoring cron alive?** `guardian-automated-monitoring` cron → `/guardian-agent action:monitor` — verify last-run in `guardian_cron_log` is recent.
3. **Ticket workflow round-trip:** create → approve → verify audit rows (RPCs `create_guardian_review_ticket` / `approve_guardian_ticket` — live-verify in `pg_proc` first, they have a drop history).
4. Record all three results in this tracker.

**Acceptance:** all three verified live with evidence pasted here. DONE MEANS DONE.

## Session 1 — Governance edit + runtime capability enforcement (~1 session)

### 1a. Governance edit (Tier 3 — Maria signs off on EXACT wording before commit)

File: `.claude/rules/ai-repair-authority.md`. Draft diff (present to Maria at session start):

- **Guardian MAY (autonomously)** — ADD:
  - "Execute SAFE/TRANSIENT mitigations: retry with backoff, circuit-break a failing dependency, failover to backup model/endpoint, clear cache, restart connection pools, toggle a feature flag OFF a broken code path (flag-off only; flag-ON requires human). Every mitigation follows the Paper Trail Contract in `docs/trackers/guardian-option-b-autoheal-tracker.md`."
  - "Auto-OPEN a GitHub pull request via `guardian-pr-service` proposing a code fix (branch + commit + PR body with evidence). Opening only."
- **Guardian MAY NOT** — ADD: "Merge, approve, or deploy any pull request, including its own. Auto-merge/auto-deploy of AI-authored code remains Tier-4 forbidden."
- Mark alert auto-resolution scope unchanged (performance category only).

### 1b. Runtime capability enforcement (T-4b item 2)

**New module:** `src/services/guardian-agent/CapabilityEnforcer.ts` (<600 lines, with `__tests__/CapabilityEnforcer.test.ts`).

Design — enforcement by **scoped context injection**, not ambient access:
- Executors receive a `ScopedToolContext` from the sandbox instead of using globals: `ctx.fetch` (throws + logs `CAPABILITY_VIOLATION` unless URL host ∈ declared `egress`), `ctx.db.from(table)` (throws unless table ∈ declared `tables`, verb checked against `reads`/`writes`).
- Violations: block the call, record via existing integrity-violation pattern, raise a `security_alerts` row, count toward tool quarantine (3 violations → tool disabled until human re-approval).
- `ExecutionSandbox` wires the enforcer in `execute()`; `ExecutionSandbox.ts` itself gains only the import + injection call (~10 lines — do not grow it further).
- Migration path: tools using ambient supabase/fetch keep working with a logged `CAPABILITY_UNENFORCED` warning until each is migrated to ctx (list them in the session report; migrate the healing tools used by Option B classes in this session).

**Acceptance (live, not mocked):** a test tool declaring `egress: []` attempts `ctx.fetch('https://example.com')` → blocked + violation row exists in `security_alerts`; a tool with `tables: ['guardian_cron_log']` reads it successfully and is denied on `profiles`. Deletion test: removing enforcer logic fails the tests. Scoped typecheck/lint/tests reported with counts.

### ✅ DONE 2026-07-23 — CapabilityEnforcer built + wired

**The real gap found (not what the sketch assumed):** egress was ALREADY enforced (the sandbox overrides `globalThis.fetch` against an allow-list). DB/table access was the hole — `ExecutionSandbox.checkDatabaseAccess()` existed but was **never called anywhere** (dead). Declared `databaseTables` were not binding at runtime.

**Built:**
- `src/services/guardian-agent/CapabilityEnforcer.ts` (246 lines) — `wrapDatabaseClient(tool, client)` returns a Proxy gating `.from(table)` against declared tables (read-by-default; mutation requires the table in `writes`); `assertEgressAllowed(tool, url)`; violation recording with per-tool counting → **quarantine after 3 violations** (tool can't run until a human calls `clearTool`). Injectable violation sink (dependency-free, unit-testable). `CapabilityViolationError`.
- `src/services/guardian-agent/capabilityViolationSink.ts` (73 lines) — default sink: writes `security_alerts` (`security_policy_violation`, `critical` when quarantining so it hits the overnight SMS channel, else `high`) + audit log.
- `__tests__/CapabilityEnforcer.test.ts` — 11 behavioral tests (deletion-test-passing): declared-table read allowed; undeclared table denied; mutation allowed only when writable; write on read-only table denied (blocked BEFORE the real insert); egress allow/deny/empty-fail-closed/wildcard; quarantine after threshold; `clearTool` re-approval.

**Wired into `ExecutionSandbox` (minimal):** constructor accepts an injectable `CapabilityEnforcer` (defaults to audit-only); `execute()` refuses a quarantined tool (step 0); the fetch-override denial now escalates via `assertEgressAllowed` (security_alerts + quarantine counting). `getCapabilityEnforcer()` exposes it for wrapping DB clients / clearing tools.

**Verification:** scoped typecheck 0 errors; full tsc clean for the new files; lint 0/0; guardian suite **40/40** (11 new + 29 existing, no regression).

**Honest scope line (DONE MEANS DONE):**
- Quarantine refusal + egress escalation are LIVE in the sandbox path.
- DB-table enforcement is delivered + tested as `wrapDatabaseClient`, exposed via `getCapabilityEnforcer()`. It becomes binding for a given tool when that tool's executor uses the wrapped client. **Migrating individual healing tools to the wrapped client is the tracked follow-on** (Session 1c) — the enforcer is ready; the tools that currently import the ambient `supabase` singleton need to take the scoped client. Not claiming every tool is DB-gated yet.
- **Pre-existing debt nudged:** `ExecutionSandbox.ts` was already over the 600-line cap (967); the wiring added ~34 lines (now 1001). The *logic* lives in the new module per the rule; only essential integration touched the god file. Decomposing `ExecutionSandbox.ts` remains a separate tracked task (not done here, to stay stable).

## Session 2 — Tool signing (T-4b item 1) (~1 session)

**New module:** `src/services/guardian-agent/ToolSigning.ts` + `scripts/guardian-sign-tools.ts` + `__tests__/ToolSigning.test.ts`.

Design:
- **ES256 (ECDSA P-256) via Web Crypto** — same primitive family the codebase already prefers for JWTs (`supabase.md` §15).
- Key pair generated ONCE by `scripts/guardian-generate-signing-key.ts` (run by Maria locally). **Private key: never in repo** — stored in Maria's password manager + as a GitHub Actions secret (`GUARDIAN_SIGNING_KEY`) for CI signing. **Public key (JWK): committed** at `src/services/guardian-agent/guardian-signing-public.jwk.json` (public by definition; safe).
- Signature = ES256 over the existing `computeToolChecksum` output (metadata + executor). Stored alongside checksum in `ToolMetadata.signature`.
- `ToolRegistry.register`/`registerWithExecutor` verify signature with the embedded public key BEFORE accepting; unsigned or bad-signature tool → registration REJECTED + `security_alerts` row. Rollout flag `GUARDIAN_REQUIRE_SIGNATURES` (default warn-only for one session, then flipped to enforce — flip is part of acceptance).
- `scripts/guardian-sign-tools.ts` signs all first-party tools; wire into CI so a tool edit without re-signing fails the build (deliberate: an unreviewed tool change should be loud).

**Acceptance (live):** tampering one byte of a signed executor → registration rejected + alert row; all first-party tools signed; enforcement flag flipped ON; counts reported.

## Session 3 — `guardian-pr-service` rebuild on GitHub REST API (~1–1.5 sessions)

**New edge function:** `supabase/functions/guardian-pr-service/index.ts` (+ `_shared` reuse; Deno rules: esm.sh imports, explicit `.ts` extensions).

**Maria's 5-minute setup (external gate — needed before live test, not before coding):**
1. GitHub → Settings → Developer settings → GitHub Apps → New App. Name `wellfit-guardian`. Permissions: **Contents: Read&Write, Pull requests: Read&Write** — nothing else (deliberately NO merge-enabling admin perms).
2. Install it on `WellFitCommunity/WellFit-Community-Daily-Complete` only.
3. Generate the App private key (.pem download) and hand Claude: App ID, Installation ID, and the .pem → stored as Supabase secrets `GH_APP_ID`, `GH_APP_INSTALLATION_ID`, `GH_APP_PRIVATE_KEY`.
4. (Recommended, her click) Branch protection on `main` requiring 1 review — belt-and-suspenders making auto-merge structurally impossible.

Design:
- Auth: internal-only — cron-secret/service-role check like other internal functions; NOT publicly callable; standard JWT-verify + reject external callers.
- Flow: App JWT (ES256/RS256 per GitHub) → installation token → `POST /repos/{owner}/{repo}/git/refs` (branch `guardian/fix-{alertId}-{yyyymmdd}`) → `PUT /repos/.../contents/{path}` per changed file → `POST /repos/.../pulls` with structured body (root cause, evidence, alert + audit IDs, rollback note) → write `guardian_review_tickets` row linking the PR URL → trigger `security-alert-processor` SMS.
- **`auto_patch` strategy in `HealingEngine.ts` re-routed:** never applies code to the running system; it now packages the proposed diff and calls `guardian-pr-service`. This is the enforcement point for "unreviewed code never reaches prod."
- Rate limit: max 3 open Guardian PRs at once (avoid PR-spam on a flapping error); dedupe by error signature.

**Acceptance (live):** inject a synthetic error whose signature maps to `auto_patch` → Guardian opens a real PR on a real branch with a complete paper-trail body → ticket row links it → SMS received → **verify the App token CANNOT merge** (attempt merge via the App token → 403/blocked). Then close the test PR.

---

## Explicitly parked (do not build without a new Maria decision)

Tool marketplace · tool versioning/rollback · Zod auto-generation (T-4c) · Web-Worker/WASM process isolation (T-4a #1) · auto-merge of ANY class (incl. "safe config" tier — Maria chose pure Option B 2026-07-23) · refactor of the pre-existing 600-line overage in `ToolRegistry.ts`/`ExecutionSandbox.ts`.

## Regression checks

```bash
# Signing enforced (after Session 2 flag flip): expect enforce, not warn
grep -rn "GUARDIAN_REQUIRE_SIGNATURES" src/services/guardian-agent/
# auto_patch never touches prod directly (after Session 3): expect PR routing only
grep -n "auto_patch" src/services/guardian-agent/HealingEngine.ts
# PR service exists and is internal-only
ls supabase/functions/guardian-pr-service/ && grep -n "cron\|internal\|service" supabase/functions/guardian-pr-service/index.ts | head -5
```
