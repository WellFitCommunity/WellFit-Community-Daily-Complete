# Risk Assessments — PHI Encryption Trigger Fix (Akima Review)

> **Status:** PROPOSAL — nothing applied. Investigation is read-only. Any fix is
> PHI-encryption code (`.claude/rules/supabase.md` §17, the two-key footgun) and
> needs Akima's clinical/compliance sign-off + a key-scope decision before it is
> written or pushed.
>
> **Prepared:** 2026-07-10 (session that revived the MCP FHIR server). Surfaced while
> seeding synthetic data to prove the FHIR RiskAssessment path end-to-end.

---

## 1. The bug (plain English)

The `risk_assessments` table **cannot accept any new row** in production. Every
`INSERT` (and `UPDATE`) fails immediately with:

```
ERROR: 42883: function public.encrypt_phi_jsonb(jsonb) does not exist
CONTEXT: PL/pgSQL function encrypt_risk_assessments_phi() ...
```

So the entire **risk-assessment write feature is dead live.** The table has **0 rows**
(nothing has been saved since it broke), which is why no one has hit it until now.

## 2. Why it happens

A `BEFORE INSERT OR UPDATE` trigger `trg_ra_encrypt` runs `encrypt_risk_assessments_phi()`,
which encrypts three PHI fields into `*_encrypted` columns and nulls the plaintext:

| Plaintext column | Type | Trigger call | Target |
|---|---|---|---|
| `assessment_notes` | `text` | `encrypt_phi_text(assessment_notes)` ✅ exists | `assessment_notes_encrypted` (text) |
| `risk_factors` | `text[]` | `encrypt_phi_jsonb(to_jsonb(risk_factors))` ❌ **missing** | `risk_factors_encrypted` (text) |
| `recommended_actions` | `text[]` | `encrypt_phi_jsonb(to_jsonb(recommended_actions))` ❌ **missing** | `recommended_actions_encrypted` (text) |

**`encrypt_phi_jsonb` was intentionally dropped** by migration
`20251209110000_drop_broken_functions.sql` (line 367 — the mass "drop ~50 broken
functions" migration already documented in `docs/PROJECT_STATE.md` as a systemic
drift source). The trigger that depends on it was never updated → orphaned reference.

**Only `encrypt_phi_text(data text, use_clinical_key boolean DEFAULT false)` and
`decrypt_phi_text(...)` survive live.** There is no `*_jsonb` variant.

## 3. Two things that make this MORE than a one-line fix

1. **🔑 Which PHI key? (§17 — Akima's call.)** `encrypt_phi_text`'s second arg
   `use_clinical_key` defaults to **`false` = the WellFit Community key** (Supabase
   Secrets `PHI_ENCRYPTION_KEY`, Vault fallback). The trigger calls it with **no
   second arg**, so it would encrypt **clinical** risk-assessment PHI with the
   **WellFit** key. Per §17, clinical (Envision Atlus) data is supposed to use the
   **Vault clinical key** (`use_clinical_key = true`). **Akima must decide which scope
   `risk_assessments` belongs to**, and the same choice must be used on the decrypt
   side. (Good news: 0 rows exist, so there is no already-encrypted data to migrate —
   this is the clean moment to set it correctly.)

2. **No read-back path exists.** `.claude/rules/governance-boundaries.md` lists a
   `risk_assessments_decrypted` view, but **it does not exist live** (dropped/never
   created — more drift). So even once encryption works, nothing can read the PHI back
   until a matching decrypt view/function is created **with the same key choice**.

3. **FHIR interaction (context, not a blocker).** The MCP FHIR RiskAssessment path
   (`export_patient_bundle` `include_ai`, repointed to `risk_assessments` this session,
   commit `96105a51`) reads the **plaintext** `risk_factors`. Because the trigger nulls
   plaintext after encrypting, that field will be **null** on any real row → the FHIR
   `basis` array will be empty (`risk_level` + `overall_score` still populate; they are
   not encrypted). If risk factors should appear in the FHIR bundle, the bundle must
   read + decrypt `risk_factors_encrypted` — a **PHI-in-bundle** decision for Akima.

## 4. Proposed fix — Option A (recommended)

**Change the trigger to use the surviving `encrypt_phi_text` — do not resurrect the
dropped `encrypt_phi_jsonb`.** The `*_encrypted` columns are already `text`, and
`encrypt_phi_text` already does text→encrypted-text, so encrypt the array as its text
form. Illustrative (NOT applied; `<KEY>` = Akima's §17 decision, `true` for clinical):

```sql
-- inside encrypt_risk_assessments_phi(), replacing the two encrypt_phi_jsonb calls:
NEW.risk_factors_encrypted :=
  public.encrypt_phi_text(to_jsonb(NEW.risk_factors)::text, <use_clinical_key>);
NEW.recommended_actions_encrypted :=
  public.encrypt_phi_text(to_jsonb(NEW.recommended_actions)::text, <use_clinical_key>);
-- and make the assessment_notes call explicit about the key too:
NEW.assessment_notes_encrypted :=
  public.encrypt_phi_text(NEW.assessment_notes, <use_clinical_key>);
```

Decrypt side (new `risk_assessments_decrypted` view, same `<KEY>`):
`decrypt_phi_text(risk_factors_encrypted, <KEY>)::jsonb` → back to the array.

**Why A over resurrecting `encrypt_phi_jsonb`:** one PHI function for all fields
(matches how `assessment_notes` already works), nothing intentionally-dropped comes
back, less surface to maintain.

### Option B (if you prefer the trigger untouched)
Recreate `encrypt_phi_jsonb` as a thin wrapper over `encrypt_phi_text`:
```sql
CREATE OR REPLACE FUNCTION public.encrypt_phi_jsonb(data jsonb, use_clinical_key boolean DEFAULT false)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions
AS $$ SELECT public.encrypt_phi_text(data::text, use_clinical_key) $$;
```
Downside: revives a deliberately-dropped function and adds a second PHI function; and
it still leaves the **key-scope default (`false`/WellFit)** wrong for clinical data
unless the trigger is also updated to pass `true`.

## 5. What must ship together (whichever option)

1. The encryption fix (Option A or B) — authored as a **proper forward migration**
   (the trigger is currently untracked live-only drift; the migration should capture the
   whole `encrypt_risk_assessments_phi()` definition so it is version-controlled).
2. A matching **`risk_assessments_decrypted` view** (or decrypt RPC) using the **same
   key choice** and `security_invoker` (governance §3).
3. A **live round-trip proof**: insert a synthetic row → confirm `*_encrypted` populate
   and plaintext are nulled → decrypt view returns the original values.
4. Decision on whether the **FHIR bundle** should surface decrypted risk factors.

## 6. Decisions Akima owns (approve / change / hold)

- [ ] **Key scope:** is `risk_assessments` **WellFit** (`use_clinical_key=false`) or
      **Envision Atlus clinical** (`use_clinical_key=true`)? *(This drives everything.)*
- [ ] **Option A** (fix trigger to `encrypt_phi_text`) vs **Option B** (revive `encrypt_phi_jsonb`).
- [ ] **Decrypt view** scope + who may read it (role/tenant gating).
- [ ] **FHIR:** should `export_patient_bundle` decrypt & include risk factors, or leave
      `basis` empty (PHI-minimization)?

**No code has been written or applied. Awaiting Akima on the four items above.**
