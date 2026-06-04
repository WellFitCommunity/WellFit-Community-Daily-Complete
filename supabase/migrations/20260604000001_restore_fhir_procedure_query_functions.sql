-- Restore: fhir_procedures query helper functions
--
-- DRIFT FORENSIC (DB-reference drift triage #11 + #20 — rpc::get_billable_procedures,
-- rpc::get_procedures_by_encounter):
--   Original migration 20251017100003_fhir_procedure.sql created fhir_procedures +
--   6 helper functions, but carries a `-- migrate:down` block after the up COMMIT.
--   Applied via `supabase db push` (which runs the whole file, ignoring the
--   migrate:up/down markers), it self-destructed — created everything, then dropped
--   it. A next-day recovery migration 20251018000000_ensure_fhir_procedures_exists.sql
--   restored the TABLE and get_recent_procedures(), but NOT these query helpers.
--   Live state confirmed before authoring: fhir_procedures table + get_recent_procedures
--   exist; get_billable_procedures + get_procedures_by_encounter are absent.
--   Both are reachable (src/services/fhir/ProcedureService.ts:84 and :170).
--
--   Only the two CALLED helpers are restored (the other two from the original set,
--   get_surgical_procedures / search_procedures_by_code, have no caller and stay
--   out to avoid dead surface). All referenced columns (encounter_id, patient_id,
--   billing_code, status, performed_datetime, performed_period_start) verified
--   present on the LIVE fhir_procedures table. Bodies are verbatim from the original
--   up-section. No migrate:down block.

BEGIN;

-- Procedures for a given encounter, newest first.
CREATE OR REPLACE FUNCTION public.get_procedures_by_encounter(encounter_id_param UUID)
RETURNS SETOF public.fhir_procedures
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.fhir_procedures
  WHERE encounter_id = encounter_id_param
  ORDER BY COALESCE(performed_datetime, performed_period_start) DESC;
END;
$$;

-- Completed, billing-coded procedures for a patient (optionally scoped to an encounter).
CREATE OR REPLACE FUNCTION public.get_billable_procedures(
  patient_id_param UUID,
  encounter_id_param UUID DEFAULT NULL
)
RETURNS SETOF public.fhir_procedures
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF encounter_id_param IS NOT NULL THEN
    RETURN QUERY
    SELECT * FROM public.fhir_procedures
    WHERE encounter_id = encounter_id_param
      AND billing_code IS NOT NULL
      AND status = 'completed'
    ORDER BY performed_datetime DESC;
  ELSE
    RETURN QUERY
    SELECT * FROM public.fhir_procedures
    WHERE patient_id = patient_id_param
      AND billing_code IS NOT NULL
      AND status = 'completed'
    ORDER BY performed_datetime DESC;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_procedures_by_encounter IS 'Returns fhir_procedures rows for an encounter, newest first.';
COMMENT ON FUNCTION public.get_billable_procedures IS 'Returns completed, billing-coded fhir_procedures for a patient (optionally scoped to an encounter).';

COMMIT;
