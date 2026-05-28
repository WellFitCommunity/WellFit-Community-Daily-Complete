-- =============================================================================
-- ONC 170.315(a)(10) — Test formulary data seed
-- =============================================================================
-- Seeds 5 common medications under a generic test BIN so the ONC certification
-- demo has something to display when the prescriber enters an NDC. Real
-- deployments will be populated by the eRx/PBM integration; this seed only
-- runs once and only inserts rows that don't already exist.
--
-- BIN 'TEST-FORMULARY' is a deliberate non-routable placeholder — it will
-- never match a real payer routing number, so it won't accidentally surface
-- under a real patient's plan check.
-- =============================================================================

INSERT INTO public.formulary_cache (
  bin_number, ndc_code, drug_name,
  formulary_status, tier, copay_amount, coinsurance_percent,
  requires_prior_auth, requires_step_therapy,
  quantity_limit, quantity_limit_days,
  preferred_alternatives,
  fetched_at, expires_at, is_valid
)
-- formulary_status CHECK constraint allows:
--   'covered' | 'not_covered' | 'prior_auth' | 'step_therapy' | 'quantity_limit'
-- Tier carries the preferred/non-preferred semantics (1-2 = preferred, 3+ = covered, NULL = non-formulary).
VALUES
  -- Lisinopril 10 mg — preferred generic for hypertension
  ('TEST-FORMULARY', '00071-0222-23', 'Lisinopril 10 mg tablet',
   'covered', 1, 5, NULL, false, false, 30, 30,
   ARRAY[]::TEXT[],
   now(), now() + INTERVAL '1 year', true),

  -- Metformin 500 mg — preferred generic for T2DM
  ('TEST-FORMULARY', '00093-1048-01', 'Metformin 500 mg tablet',
   'covered', 1, 5, NULL, false, false, 60, 30,
   ARRAY[]::TEXT[],
   now(), now() + INTERVAL '1 year', true),

  -- Atorvastatin 10 mg — preferred generic for hyperlipidemia
  ('TEST-FORMULARY', '00071-0155-23', 'Atorvastatin 10 mg tablet',
   'covered', 1, 5, NULL, false, false, 30, 30,
   ARRAY[]::TEXT[],
   now(), now() + INTERVAL '1 year', true),

  -- Eliquis 5 mg — covered brand with prior auth
  ('TEST-FORMULARY', '00003-0894-21', 'Eliquis 5 mg tablet',
   'prior_auth', 3, 75, 25, true, false, 60, 30,
   ARRAY['Warfarin 5 mg tablet']::TEXT[],
   now(), now() + INTERVAL '1 year', true),

  -- Humira 40 mg — specialty tier, prior auth + step therapy
  ('TEST-FORMULARY', '00074-3799-02', 'Humira 40 mg/0.4 mL pen',
   'step_therapy', 4, 250, NULL, true, true, 2, 28,
   ARRAY['Methotrexate 2.5 mg tablet', 'Etanercept 50 mg auto-injector']::TEXT[],
   now(), now() + INTERVAL '1 year', true)
ON CONFLICT DO NOTHING;
