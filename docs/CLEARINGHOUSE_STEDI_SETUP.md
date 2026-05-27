# Stedi Clearinghouse — Setup Checklist for Maria

> Things YOU do before I (Claude) start coding the Stedi integration.
> Once you finish Part 1 + Part 2 + Part 4, drop the credentials in Supabase secrets and ping me — I'll start Session 1 of the build.

Authoritative docs (check for current UI / pricing — Stedi's product changes faster than this file):
https://www.stedi.com/docs

---

## Part 1 — Create the Stedi account

1. Go to **https://stedi.com**
2. Sign up. Use a business email (e.g., maria@wellfitcommunity.com), not a personal one.
3. When asked for a product line, pick **Healthcare** (the EDI / claims path — not the general B2B EDI path).
4. Verify your email.
5. You'll land in the Stedi dashboard. **Sandbox is free.** Production requires payment + business verification (don't worry about production yet).

**Decision point — pricing tier:**
- Stedi shows current pricing in-dashboard once you sign up. They charge per transaction (per claim, per eligibility check, etc.). No commitment for sandbox.
- For the pilot: stay in **sandbox** until we've tested the full submit → ack → status → remittance flow end-to-end. Then upgrade.

---

## Part 2 — Business credentials to have ready

Gather these BEFORE you start configuring Stedi. Stedi will ask for most of them during onboarding, and I'll need the same set to fill in your `clearinghouse_config` row.

### Entity-level
| Item | Where to get it | Notes |
|---|---|---|
| **EIN** (business tax ID) | IRS / your records | Required |
| **Legal business name** (exact, as on EIN) | IRS records | Must match exactly |
| **Business mailing address** | Your records | Required |
| **Type 2 NPI** (organization NPI) | https://nppes.cms.hhs.gov | Free; if you don't have one yet, apply — takes ~10 business days |

### Per-provider (for every clinician you'll bill for)
| Item | Where to get it | Notes |
|---|---|---|
| **Individual NPI** (Type 1) | NPPES | Each provider has their own |
| **Tax ID** they bill under | Your records | Could be EIN or SSN |
| **Medicare PTAN** | Issued by your MAC (Novitas for TX) | Required for Medicare submissions |
| **Texas Medicaid TPI** | TMHP (tmhp.com) | Required for TMHP submissions |
| **License number + state** | Your records | Required on the 837P |

### Bank info (production only — skip for sandbox)
| Item | Used for |
|---|---|
| **Bank routing + account number** | ERA/EFT enrollment so remittances flow back electronically |

---

## Part 3 — Inside the Stedi dashboard

After login, do these in order:

1. **Create a sandbox environment** (Stedi usually auto-creates one).
2. **Generate an API key** (in dashboard → settings/API keys area; UI changes — use Stedi's docs as truth).
3. **Note your Submitter ID** — Stedi assigns one to your account. This goes on every 837 you send.
4. **Enable these EDI transactions** in the dashboard (if Stedi requires opt-in per transaction type):
   - 837P (professional claims)
   - 837I (institutional claims — only if you're billing facility services)
   - 270/271 (eligibility request/response)
   - 276/277 (claim status request/response)
   - 999 (functional acknowledgment)
   - 277CA (claim acknowledgment from payer)
   - 835 (remittance advice)
5. **(Optional) Set up a webhook endpoint** for async events (claim status updates, 835 arrivals). If you want push notifications, configure the URL Stedi will POST to. Skip for now — we can use polling first.
6. **Note your sandbox base URL** (looks like `https://healthcare.us.stedi.com` or similar — confirm in their docs).

---

## Part 4 — Hand these to me

Once you have them, store them in **Supabase secrets** (NOT `VITE_*` env vars — those ship to every browser, which would be a HIPAA disaster):

```
STEDI_API_KEY          = <sandbox API key from Stedi dashboard>
STEDI_SUBMITTER_ID     = <submitter ID Stedi assigned you>
STEDI_BASE_URL         = <Stedi healthcare base URL — check their docs>
STEDI_WEBHOOK_SECRET   = <if you set up a webhook; skip if not>
STEDI_ENVIRONMENT      = sandbox
```

To set them:
```bash
npx supabase secrets set STEDI_API_KEY=<value> --project-ref xkybsjnvuohpqpbkikyn
```

(Or use the Supabase dashboard → Edge Functions → Secrets.)

### Also tell me (or drop in a row in `clearinghouse_config` — I'll create the schema)
| Field | Example | Notes |
|---|---|---|
| **Default billing provider NPI** | `1234567890` | For pilot clinic |
| **Default billing Tax ID** | `12-3456789` | EIN or SSN |
| **Default Place of Service code** | `11` (office) | CMS POS code |
| **First payers to enroll** | `Medicare Novitas, TMHP` | Two is fine to start |

---

## Part 5 — Payer enrollment (Stedi guides you)

After API integration works in sandbox, before you can submit to a real payer, each provider × each payer needs an **EDI enrollment** on file with that payer that names Stedi as the authorized submitter. Stedi has a self-service enrollment portal for this.

| Payer | Enrollment lead time |
|---|---|
| **Medicare (Novitas, Jurisdiction H, Part B)** | 2–4 weeks |
| **Texas Medicaid (TMHP)** | 2–6 weeks |
| **Commercial (BCBS-TX, UHC, Aetna, etc.)** | 2–4 weeks each |

You don't need this done before I start coding — but you do need it done before you can submit a real claim to a real payer. **Sandbox testing works without payer enrollment.**

### ERA enrollment (separate from claim submission enrollment)
For remittances (835s) to come back through Stedi to us, you also enroll each provider for ERA with each payer (CMS-588 form for Medicare; TMHP has its own form). Stedi has guided workflows for this too.

---

## Part 6 — What I'll do once you finish Parts 1–4

Reference, not your action items:

| Session | I build |
|---|---|
| **1** | Stedi adapter (Deno, `https://esm.sh/` imports, no `jsr:`/`npm:`), `clearinghouse_config` schema additions, credential reader, types. Reads & writes DB only. |
| **2** | Submission edge function: pulls 837P from existing generator → POSTs to Stedi → stores claim control numbers. JWT + role + tenant gated per `adversarial-audit-lessons.md`. |
| **3** | Acknowledgment poller: pulls 999, 277CA, 835 from Stedi → normalizes status → updates `claims` / `claim_status_history`. Scheduled. |
| **4** | UI: extend `ClearinghouseConfigPanel.tsx`, build submission/retry dashboard. Audit logging via `auditLogger`. Tests (behavioral, deletion-test compliant). |

---

## Questions to answer back to me (with the credentials)

1. Are you billing **professional only (837P)** for the pilot, or also **institutional (837I)**?
2. First payer for live submission — **Medicare Novitas first, or TMHP first?**
3. Do you want **webhooks** (push from Stedi) or are we OK with **polling** (we fetch on a schedule)?
4. ERA/EFT enrollment now or later?

That's it. Once Parts 1–4 are done, ping me and I start Session 1.
