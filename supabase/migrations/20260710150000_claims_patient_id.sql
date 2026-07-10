-- B2: add claims.patient_id as a first-class column (837P-style patient reference).
--
-- Until now a claim linked to a patient only via encounter_id -> encounters.patient_id.
-- That is correct but forces a join for every patient->claims query and made the
-- charge-aggregation fallback impossible (it 42703'd on a nonexistent
-- claims.patient_id — fixed to an encounter-join in the 2026-07-10 drift triage,
-- docs/trackers/mcp-schema-drift-triage-2026-07-10.md). This adds the denormalized
-- column, backfills it from the encounter, and keeps it in sync via a trigger so it
-- can never drift from the encounter's patient.
--
-- GRANT: public.claims already GRANTs SELECT to authenticated (verified via
-- has_table_privilege 2026-07-10); a new column inherits the table-level grant, so
-- no additional GRANT is required (supabase.md §2a — the table gate is already open).
-- Forward-only; no `-- migrate:down` block (db push executes down blocks).

-- 1. Column (mirrors encounters.patient_id, which references auth.users(id)).
ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES auth.users(id);

COMMENT ON COLUMN public.claims.patient_id IS
  'Patient this claim is for. Denormalized from encounters.patient_id and kept in sync by trg_set_claim_patient_id; NULL only for claims with no encounter and no explicit patient.';

-- 2. Index for patient -> claims lookups.
CREATE INDEX IF NOT EXISTS idx_claims_patient_id ON public.claims(patient_id);

-- 3. Backfill from the encounter (no-op when claims is empty; safe/idempotent).
UPDATE public.claims c
SET patient_id = e.patient_id
FROM public.encounters e
WHERE c.encounter_id = e.id
  AND c.patient_id IS DISTINCT FROM e.patient_id
  AND e.patient_id IS NOT NULL;

-- 4. Keep-in-sync trigger: whenever a claim is inserted or its encounter_id changes,
--    derive patient_id from the encounter. SECURITY DEFINER so it can read the
--    encounter regardless of the caller's RLS; search_path pinned (supabase.md §4).
--    When encounter_id is NULL the provided patient_id is left untouched (supports
--    encounter-less claims carrying an explicit patient).
CREATE OR REPLACE FUNCTION public.set_claim_patient_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.encounter_id IS NOT NULL THEN
    SELECT e.patient_id INTO NEW.patient_id
    FROM public.encounters e
    WHERE e.id = NEW.encounter_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_claim_patient_id ON public.claims;
CREATE TRIGGER trg_set_claim_patient_id
  BEFORE INSERT OR UPDATE OF encounter_id ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.set_claim_patient_id();
