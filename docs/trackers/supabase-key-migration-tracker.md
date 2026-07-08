# Supabase API Key Migration — Audit & Tracker

> Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.

**Created:** 2026-07-08 (audit)
**Status:** PARKED — do not start the cutover until the pre-auth blocker (below) is solved.
**Owner:** Maria (go/no-go) / Claude (exec)

Migrate off the legacy `anon` / `service_role` JWT keys to the new opaque
`sb_publishable_…` / `sb_secret_…` keys — **without breaking pre-auth flows.**

---

## ⛔ Hard constraint — KEEP `anon` FOR NOW

**Do NOT deactivate the legacy `anon` key, and do NOT remove either hCaptcha function.**

- The new **publishable/secret keys cannot be used in the `Authorization: Bearer` header** — Supabase's platform rejects them as invalid JWTs (their migration doc). `supabase.functions.invoke()` on a **pre-auth** call (signup, no user session) sends the project key as `Authorization: Bearer`. Legacy `anon` IS a JWT → passes; opaque `sb_publishable_` is NOT → rejected → **captcha/signup breaks.** (Maria confirmed live, 2026-07-08.)
- **BOTH `verify-hcaptcha` (`verify_jwt=false`) AND `validate-hcaptcha` (`verify_jwt=true`) are required.** Maria tried removing one → signup broke. `validate-hcaptcha` is a live deployed function (`scripts/live-edge-functions.json`); its code caller wasn't found by grep, but a missing grep hit is NOT evidence it's unused. Do not "clean it up."

**Timeline (Supabase changelog):** legacy phase-out began **2025-11-01**; legacy keys **deleted late-2026** → apps still on them fail. So this must be done before then, but there is no emergency.

---

## Current posture — already ~90% aligned (2026-07-08 audit)

| Signal | State |
|---|---|
| Edge fns `verify_jwt=false` (new-key-compatible: verify-in-code) | **160** |
| Edge fns `verify_jwt=true` | **5** (see below) |
| `SB_SECRET_KEY` refs / `SB_PUBLISHABLE_API_KEY` refs | 323 / 73 (dominant) |
| Legacy `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` refs | 133 / 77 (fallback chain only, `_shared/env.ts`) |

The suite already prefers the new `SB_*` names via the fallback chain, and the
overwhelming majority of edge functions already use `verify_jwt=false` +
in-code auth — which is exactly the pattern the new keys require. Today's
`realtime_medical_transcription` fix (`verify_jwt=false` + internal `getUser`)
moved one more into it.

---

## Work items (do when unparked)

### A. `Authorization: Bearer <KEY>` → move key to the `apikey` header
The opaque key must ride the `apikey` header, never `Authorization: Bearer`.
Real-code offenders:
- [ ] `supabase/functions/_shared/culturalCompetencyClient.ts:93` — `Bearer ${SB_SECRET_KEY}`
- [ ] `supabase/functions/sms-verify-code/index.ts:482` — `Bearer ${SB_SECRET_KEY}`
- [ ] `supabase/functions/health-monitor/index.ts:85, 248` — `Bearer ${serviceKey}`
- [ ] `supabase/functions/mcp-edge-functions-server/toolHandlers.ts:57` — `Bearer ${serviceKey}`
- [ ] ~12 integration test files under `supabase/functions/__tests__/` pass `Bearer ${SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY}` — update to the apikey-header pattern.

### B. The 5 `verify_jwt=true` functions — classify each
| Function | Caller | Verdict |
|---|---|---|
| `create-patient-telehealth-token` | authed user (real user JWT) | `verify_jwt=true` OK — leave |
| `create-telehealth-room` | authed user (real user JWT) | OK — leave |
| `bulk-export` | authed user (real user JWT) | OK — leave |
| `notify-emergency-access` | authed user (real user JWT) | OK — leave |
| `validate-hcaptcha` | pre-auth / public | **KEEP as-is for now** (part of the anon constraint above); revisit only with the pre-auth fix |

**Rule:** `verify_jwt=true` is only a problem when the caller sends a *key* (not a user JWT) as the auth. Where a real logged-in user calls the function, the user's session access_token is a JWT and works fine — that token is unaffected by this migration.

### C. The pre-auth blocker (the thing that unparks this)
- [ ] For the handful of **pre-auth** function calls (captcha, and any other `invoke()` before login), stop relying on default `invoke()` (which sets `Authorization: Bearer <key>`). Use a small raw `fetch` wrapper that sends the publishable key on **`apikey` only**. Then pre-auth calls work on the new key.
- [ ] Once pre-auth works on `sb_publishable_`, the frontend client can be initialized with the publishable key and `anon` can retire.

### D. JWT signing keys (asymmetric) — companion migration
- [ ] Supabase recommends doing this alongside the key migration to get fully off the shared JWT secret (asymmetric ES256/RS256, zero-downtime rotation). Separate from the API-key work but part of the same "off the shared secret" goal.

### E. Cutover (last)
- [ ] Set real `sb_publishable_`/`sb_secret_` values under the `SB_*` env/secret names (fallback chain makes this incremental & safe).
- [ ] Verify nothing depends on legacy keys (repeat this audit).
- [ ] Deactivate `anon` / `service_role` in the Supabase dashboard (reversible) — before late-2026.

---

## Reproduce the audit
```bash
# verify_jwt posture
grep -c "verify_jwt = true"  supabase/config.toml
grep -c "verify_jwt = false" supabase/config.toml
# Authorization: Bearer <key> offenders (exclude user-JWT paths)
grep -rnE "Authorization.{0,12}Bearer.{0,40}(ANON|SERVICE_ROLE|PUBLISHABLE|SECRET|serviceKey)" \
  supabase/functions src --include=*.ts | grep -viE "getUser|access_token|session|user\."
# key env-name usage
grep -rhoE "SB_SECRET_KEY|SB_PUBLISHABLE_API_KEY|SUPABASE_(ANON|SERVICE_ROLE)_KEY" src supabase/functions --include=*.ts | sort | uniq -c | sort -rn
```

## Sources
- Migrating to publishable and secret API keys — https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys
- Understanding API keys — https://supabase.com/docs/guides/getting-started/api-keys
- Upcoming changes to Supabase API Keys (changelog) — https://supabase.com/changelog/29260-upcoming-changes-to-supabase-api-keys
- JWT Signing Keys — https://supabase.com/docs/guides/auth/signing-keys
