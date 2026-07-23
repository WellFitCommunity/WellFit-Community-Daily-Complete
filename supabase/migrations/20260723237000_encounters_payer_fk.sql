-- B-5 (billing-dashboard-drift tracker 2026-07-22): eligibilityVerificationService
-- queries encounters.payer_id and embeds billing_payers — but the column never
-- existed, so eligibility verification has NEVER run. Decision (delegated to
-- engineering 2026-07-23, per the tracker's recommendation): option (a) — the
-- payer attaches to the ENCOUNTER (eligibility is checked pre-claim, and the
-- coverage_* columns already live on encounters).

ALTER TABLE public.encounters
  ADD COLUMN IF NOT EXISTS payer_id uuid REFERENCES public.billing_payers(id);

CREATE INDEX IF NOT EXISTS idx_encounters_payer_id
  ON public.encounters(payer_id);

COMMENT ON COLUMN public.encounters.payer_id IS
  'Payer for eligibility verification (B-5, 2026-07-23). FK to billing_payers; '
  'PostgREST embed billing_payers(...) resolves through this FK.';
