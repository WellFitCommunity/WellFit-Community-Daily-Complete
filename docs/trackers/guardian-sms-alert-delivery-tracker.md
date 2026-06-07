# Guardian Overnight SMS Alert Delivery — Finish at Laptop

**Created:** 2026-06-07 · **Owner:** Claude (Maria-directed) · **Status:** ⏸️ CODE FIX DONE (in working tree) — BLOCKED on laptop: needs `supabase login` + secret + deploy + live test
**Why:** Maria's goal — *"so my systems are not down while we sleep."* Guardian should TEXT her (and Akima) when a security alert fires overnight. The Twilio account is fully working (registration/enrollment SMS send fine), but Guardian's alert processor never delivered SMS. Maria nailed it: *"Twilio is set, it just isn't set in the Guardian."*

---

## ROOT CAUSE (confirmed in code 2026-06-07)

`security-alert-processor` re-implemented its **own** Twilio call that only supported a plain **From-number** (`TWILIO_FROM_NUMBER`) and bailed with `"SMS not configured"` if it was unset. But the app's working SMS path (`send-sms`) sends via a **Messaging Service SID** (`TWILIO_MESSAGING_SERVICE_SID`) — so the project likely has the Messaging Service set and **no** `TWILIO_FROM_NUMBER`, which is why Guardian SMS silently never sent even though Twilio worked everywhere else. There was also no configured recipient list.

---

## ✅ ALREADY DONE — code fix (uncommitted, in working tree)

**File:** `supabase/functions/security-alert-processor/index.ts`
1. Added `const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");` (next to the other Twilio env reads, ~line 33).
2. `sendSMSNotification()` now:
   - Gate accepts **EITHER** a Messaging Service SID **OR** a From-number (`hasSender = Boolean(TWILIO_MESSAGING_SERVICE_SID || TWILIO_FROM_NUMBER)`) — mirrors the proven `send-sms` resolution, so Guardian inherits the existing working Twilio config regardless of which is set.
   - In the per-recipient loop, sets `MessagingServiceSid` when present, else `From`.
   - **Resilient multi-recipient:** sends to ALL of `SECURITY_ALERT_PHONES`; one bad number no longer blocks the rest. Succeeds if ≥1 delivered; reports partial failures.

> Not deno-checked locally (Deno not installed in the codespace). Manually type-verified (both Twilio branches narrow cleanly, no casts). CI's `scripts/deno-typecheck.sh` includes this function and will check it; the deploy bundle step also catches syntax errors.

---

## ▶ REMAINING STEPS — do these at the laptop

**Pre-req: authenticate the CLI (it's linked to `xkybsjnvuohpqpbkikyn` but has no access token):**
```
npx supabase login
```

**Step 1 — set the recipient secret.** The two recipient cell numbers (Maria + Akima, E.164, comma-separated) are recorded in Claude's private session memory (`project_guardian_autoheal_direction` notes) — NOT committed here (PII). Claude will run:
```
npx supabase secrets set SECURITY_ALERT_PHONES="<Maria-cell>,<Akima-cell>"
```
(Changing a secret does NOT require redeploy — the function reads it at runtime — but we deploy anyway in Step 2 for the code change.)

**Step 2 — deploy the updated function** (CLI, not MCP — it has `_shared` deps the CLI bundles automatically; safe to deploy now that `config.toml` is reconciled and this fn is pinned `verify_jwt=false`):
```
npx supabase functions deploy security-alert-processor
```

**Step 3 — live proof (the real "done"):**
1. Insert ONE synthetic `security_alerts` row (severity `critical`, recognizable title like `TEST — Guardian SMS delivery check`, status `new`) via MCP `execute_sql`.
2. Wait ≤90s for the every-minute cron (`security-alert-processor` job) to fire.
3. Confirm via MCP `get_logs(edge-function)` that the processor ran 200 AND that SMS was attempted/succeeded (NOT `"SMS not configured"`).
4. **Confirm Maria + Akima actually received the text.**
5. DELETE the synthetic alert row + any test `security_notifications` it generated (self-clean).

---

## Acceptance criteria (DONE MEANS DONE)
- [ ] `security-alert-processor` deployed with the Messaging-Service fix.
- [ ] `SECURITY_ALERT_PHONES` secret set (both numbers, E.164).
- [ ] A synthetic critical alert produced a real text to **both** phones (live-proven, not mocked).
- [ ] Synthetic alert + test notifications cleaned up.
- [ ] Code fix committed to `main`; PROJECT_STATE updated.

## Caveats
- **MailerSend is over its monthly cap** → email alerts won't deliver until it resets. **SMS (Twilio) is the primary/reliable overnight channel** — this tracker makes that the working path. Email can be revisited after the quota resets.
- This does NOT add autonomous auto-heal (that's the deferred Option B build in [[project_guardian_autoheal_direction]]). This is purely: Guardian reliably TEXTS the founders so they can act. That alone addresses "don't let systems stay down while we sleep."
