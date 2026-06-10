-- Batch 17 (DB-reference drift triage) — restore rpc::generate_patient_lab_token (#10).
--
-- Bucket: B-restore, but a SCHEMA REBUILD (the backing table self-destructed too).
-- Caller: src/services/labResultVaultService.ts:318
--   .rpc('generate_patient_lab_token', { mrn }) → URL `/patient/labs/<token>` (QR code).
--
-- Drift forensic (CLAUDE.md #18, verified live 2026-06-10):
--   Original migration 20251003200000_lab_result_vault.sql defines the table + fn but carries a
--   `-- migrate:down` block after COMMIT (SYSTEMIC FINDING #1). Applied via `db push` it created
--   then DROPPED the token table + 3 functions in one run. `lab_results` survived (re-created
--   elsewhere); `patient_lab_access_tokens` + generate_patient_lab_token did NOT (both absent live).
--
-- ⚠️ SECURITY — the original design had a real hole, fixed here (do NOT restore verbatim):
--   * generate_patient_lab_token was SECURITY DEFINER with NO search_path and NO EXECUTE
--     restriction and NO caller check → ANY caller (incl. anon) could mint a lab-PHI access
--     token for ANY MRN. This restore gates minting to an authenticated ADMIN (is_admin),
--     pins search_path, and revokes anon/PUBLIC EXECUTE.
--   * access_token defaulted to base64, which is NOT URL-safe (+ / =) yet is placed directly
--     in a URL path. Switched to URL-safe hex (32 bytes = 256-bit, 64 hex chars).
--   * Default TTL reduced 30d → 7d (a bearer token in a URL leaks via history/logs/referrer;
--     a shorter window limits exposure). ⚠️ AKIMA/Maria: confirm the TTL + the whole
--     URL-bearer-token-to-PHI pattern before the patient-facing route is built.
--
-- SCOPE NOTE: this restores the DATA LAYER only (table + lifecycle fns). The feature is
-- currently UNWIRED on both ends — generatePatientQRCode has 0 callers and there is no
-- `/patient/labs/:token` route. The public token-validation route + patient lab page is a
-- Tier-3 PHI-exposure surface and is intentionally NOT built here — it needs Akima's
-- compliance/threat-model sign-off first. Restoring the inert data layer clears the drift and
-- makes the generator correct + safe for when the feature is wired.
--
-- Forward migration only (NO migrate:down block) per SYSTEMIC FINDING #1.

CREATE TABLE IF NOT EXISTS public.patient_lab_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_mrn text NOT NULL,
  -- URL-safe hex token (256-bit). NOT base64 (base64 contains +,/,= which break in a URL path).
  access_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  -- Conservative TTL for a PHI bearer token (was 30d in the original). See Akima note above.
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_accessed_at timestamptz,
  access_count int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_patient_lab_tokens_mrn   ON public.patient_lab_access_tokens(patient_mrn);
CREATE INDEX IF NOT EXISTS idx_patient_lab_tokens_token ON public.patient_lab_access_tokens(access_token);

-- RLS: direct table access is admin-only (faithful to the original posture). The fns below
-- are SECURITY DEFINER so the (Akima-gated) token-validation path can bypass this without
-- exposing the table to non-admins.
ALTER TABLE public.patient_lab_access_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_lab_tokens_admin" ON public.patient_lab_access_tokens;
CREATE POLICY "patient_lab_tokens_admin"
ON public.patient_lab_access_tokens FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

COMMENT ON TABLE public.patient_lab_access_tokens IS
  'Opaque bearer tokens granting a patient read access to their own lab history via QR/URL. '
  'Minted only by an admin (generate_patient_lab_token). Drift-triage Batch 17 (#10). '
  'Patient-facing validation route is Akima-gated and not yet built.';

-- Mint (or return an existing unexpired) lab-access token for an MRN.
-- Hardened: admin-only caller, pinned search_path.
CREATE OR REPLACE FUNCTION public.generate_patient_lab_token(mrn text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_token text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to generate patient lab access tokens';
  END IF;

  IF mrn IS NULL OR length(trim(mrn)) = 0 THEN
    RAISE EXCEPTION 'mrn is required';
  END IF;

  -- Reuse an existing unexpired token for this MRN (idempotent, faithful to the original).
  SELECT access_token INTO new_token
  FROM public.patient_lab_access_tokens
  WHERE patient_mrn = mrn
    AND expires_at > now()
  ORDER BY expires_at DESC
  LIMIT 1;

  IF new_token IS NULL THEN
    INSERT INTO public.patient_lab_access_tokens (patient_mrn)
    VALUES (mrn)
    RETURNING access_token INTO new_token;
  END IF;

  RETURN new_token;
END;
$$;

-- Lifecycle helper: bump access bookkeeping when a token is used. Restored for completeness;
-- inert until the Akima-gated validation route calls it.
CREATE OR REPLACE FUNCTION public.update_patient_lab_token_access(token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.patient_lab_access_tokens
  SET last_accessed_at = now(),
      access_count = access_count + 1
  WHERE access_token = token
    AND expires_at > now();
END;
$$;

-- Minting is an admin action; never anon/PUBLIC.
REVOKE ALL ON FUNCTION public.generate_patient_lab_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_patient_lab_token(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.generate_patient_lab_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_patient_lab_token(text) TO service_role;

REVOKE ALL ON FUNCTION public.update_patient_lab_token_access(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_patient_lab_token_access(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_patient_lab_token_access(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_patient_lab_token_access(text) TO service_role;

COMMENT ON FUNCTION public.generate_patient_lab_token(text) IS
  'Admin-only: mint or return an unexpired URL-safe lab-access token for an MRN (7-day TTL). '
  'Hardened restore of the lab_result_vault token fn (was anon-mintable). Drift-triage Batch 17 (#10).';
