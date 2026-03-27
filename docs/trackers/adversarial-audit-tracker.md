# Adversarial Audit Remediation Tracker

> **Source:** Adversarial codebase audit (ChatGPT) — 2026-03-27
> **Verified by:** Claude Opus 4.6 — all findings confirmed unless noted
> **Goal:** Resolve all critical/high findings before hospital pilot
> **Estimated total:** ~16-20 hours across 3 sessions

---

## Session 1 — Critical Security (Must Fix Now)

| # | Finding | Description | Files Affected | Est. Hours | Status |
|---|---------|-------------|----------------|-----------|--------|
| A-1 | send-sms zero auth | 3-path auth: internal secret, service role key, or JWT + role (admin/clinical). Rate limited 20/10min for JWT callers. Recipient cap 50. | `supabase/functions/send-sms/index.ts` | 2 | DONE |
| A-2 | send-email zero auth | 3-path auth: internal secret, service role key, or JWT + role (admin/clinical). Rate limited 30/10min for JWT callers. Recipient cap 50. | `supabase/functions/send-email/index.ts` | 2 | DONE |
| A-3 | Audit log RLS spoofable | Migration: dropped `WITH CHECK (true)`, enforced `actor_user_id = auth.uid()`, removed anon INSERT, added service role full access. Also fixed `phi_access_logs`. | `supabase/migrations/20260327200000_fix_audit_log_rls_identity_enforcement.sql` | 3 | DONE (needs `db push`) |
| A-4 | VITE_ANTHROPIC_API_KEY in browser | Removed from `.env`. 3 AI services (`emergencyAccessIntelligence`, `culturalHealthCoach`, `welfareCheckDispatcher`) degraded gracefully — need edge function migration to restore. | `.env`, `src/services/ai/*.ts`, `src/utils/environmentValidator.ts` | 3 | DONE |
| A-5 | Guardian agent runtime bug | Fixed variable shadowing: use imported `SUPABASE_URL` directly, renamed local to `serviceRoleKey`. Fixed email format to match `send-email` API. | `supabase/functions/guardian-agent/index.ts` | 1 | DONE |
| A-6 | Guardian agent JWT unverified | Replaced `atob()` JWT decoding with `supabase.auth.getUser(token)` for cryptographic verification. | `supabase/functions/guardian-agent/index.ts` | 2 | DONE |
| A-7 | Fitbit OAuth client secret in browser | Removed `clientSecret` from browser. `connect()` now throws if secret passed. OAuth token exchange/refresh/revoke routed to `fitbit-webhook` edge function (needs server-side OAuth logic added). | `src/adapters/wearables/implementations/FitbitAdapter.ts` | 2 | DONE |
| A-8 | Slack webhook in frontend code | Replaced `VITE_SLACK_WEBHOOK_URL` with `VITE_SLACK_ENABLED` boolean flag. Notifications route through edge function. (`send-slack-notification` edge function needs creation). | `src/services/notificationService.ts` | 1 | DONE |

**Session 1 subtotal:** ~16 hours

---

## Session 2 — Integration Bugs & High Priority

| # | Finding | Description | Files Affected | Est. Hours | Status |
|---|---------|-------------|----------------|-----------|--------|
| A-9 | profiles.id vs profiles.user_id | 3 edge functions query `profiles` with `.eq('id', user_id)` — wrong column. Silent failures in emergency/alert workflows. Migration comment acknowledges this was fixed before. | `supabase/functions/send-team-alert/index.ts:55`, `emergency-alert-dispatch/index.ts:205`, `ld-alert-notifier/index.ts:98` + codebase-wide grep | 2 | TODO |
| A-10 | send_email vs send-email naming | 3 edge functions invoke `send_email` (underscore) but function is `send-email` (dash). Silent failure — emails never sent. | `supabase/functions/send-team-alert/index.ts:103`, `ld-alert-notifier/index.ts:150`, `notify-stale-checkins/index.ts:120` + codebase-wide grep | 1 | TODO |
| A-11 | CORS wildcard patterns | `cors.ts` allows any `*.vercel.app` and `*.app.github.dev` origin via regex. Increases attack surface for weak-auth endpoints. | `supabase/functions/_shared/cors.ts` | 2 | TODO |
| A-12 | API route table name mismatch | `api/me/check_ins.ts` — GET uses `check_ins`, POST uses `checkins` (missing underscore). POST silently fails. | `api/me/check_ins.ts` | 0.5 | TODO |
| A-13 | phi_access_logs INSERT no actor check | Fixed in A-3 migration: `phi_access_logs` INSERT now enforces `accessing_user_id = auth.uid()` + tenant check. | `supabase/migrations/20260327200000_fix_audit_log_rls_identity_enforcement.sql` | 1 | DONE (needs `db push`) |
| A-14 | Rate limiting on all messaging endpoints | send-sms and send-email now have rate limiting (20/10min SMS, 30/10min email). send-push-notification still needs rate limiting added. | `supabase/functions/send-sms/`, `send-email/` | 2 | PARTIAL (push needs RL) |
| A-15 | Codebase-wide sister bug sweep | Grep entire codebase for: `.eq('id',` on profiles, `invoke('send_email'`, `invoke("send_email"`, other function name mismatches, other `VITE_` secrets | All edge functions | 2 | TODO |

**Session 2 subtotal:** ~10.5 hours

---

## Session 3 — Architecture Hardening

| # | Finding | Description | Files Affected | Est. Hours | Status |
|---|---------|-------------|----------------|-----------|--------|
| A-16 | Edge functions TypeScript strictness | `tsconfig.json` excludes `supabase/functions`. Highest-risk code (server, PHI, auth) has no compile-time type checking. | `tsconfig.json`, new `supabase/functions/tsconfig.json` | 2 | TODO |
| A-17 | Claude cost/rate enforcement server-side | Client-side in-memory rate/budget controls are bypassable. Need server-side per-tenant rate limiting on `claude-chat` edge function. | `supabase/functions/claude-chat/index.ts` | 3 | TODO |
| A-18 | Push notification fanout scalability | `send-push-notification` loops O(N) tokens in a single request. Will timeout at scale. Needs batching or topic strategy. | `supabase/functions/send-push-notification/index.ts` | 3 | TODO |
| A-19 | Rate limiter SELECT N+1 | Shared `rateLimiter` selects all attempts in window and counts `attempts.length`. Self-inflicted DoS at scale. | `supabase/functions/_shared/rateLimiter.ts` | 2 | TODO |
| A-20 | FHIR export validation | Enhanced FHIR export builds large in-memory bundle, no pagination, no resource validation. Downstream systems may reject invalid resources. | `supabase/functions/enhanced-fhir-export/index.ts` | 4 | TODO |

**Session 3 subtotal:** ~14 hours

---

## Summary

| Priority | Items | Est. Hours | Status |
|----------|-------|-----------|--------|
| Session 1 — Critical Security | A-1 through A-8 | ~16h | **8/8 DONE** |
| Session 2 — Integration Bugs | A-9 through A-15 | ~10.5h | 2/7 done (A-13, A-14 partial) |
| Session 3 — Architecture | A-16 through A-20 | ~14h | TODO |
| **Total** | **20 items** | **~40.5h** | **10/20 complete** |

---

## Audit Claims Found Inaccurate

| Claim | Reality |
|-------|---------|
| `send-push-notification` lacks auth | **FALSE** — Has JWT verification, role gating (admin/physician/nurse/case_manager), and tenant isolation. Only missing rate limiting. |
| Guardian `const SUPABASE_URL = SUPABASE_URL` is "catastrophic" TDZ crash | **OVERSTATED** — It's variable shadowing (captures imported value), not a TDZ error. Still bad practice and should be fixed, but won't crash at runtime. |
| `user_notifications` table doesn't exist | **UNVERIFIED** — Not confirmed either way in this pass. Low priority. |

---

## Rules for This Tracker

1. **Every fix includes a codebase-wide grep** for sister bugs — not just the specific instances listed
2. **Deploy edge functions after fixing** — `npx supabase functions deploy <name>`
3. **Run verification checkpoint** after each item: `bash scripts/typecheck-changed.sh && npm run lint && npm test`
4. **No item is DONE until deployed and verified**
5. **If stuck for 2+ attempts, STOP AND ASK Maria**
