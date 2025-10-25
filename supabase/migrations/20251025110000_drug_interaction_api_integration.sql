-- =====================================================================
-- Drug Interaction Checking - API Integration Required
-- =====================================================================
-- CRITICAL: Replace placeholder drug interaction function with real API
-- Current status: check_drug_interactions() returns empty results
-- Production requirement: Integrate with drug interaction database
-- =====================================================================

-- RECOMMENDED APIS (in order of preference):
-- 1. First DataBank (FDB) MedKnowledge - Industry standard for hospitals
-- 2. RxNorm Interaction API (NLM) - Free, government-maintained
-- 3. Lexicomp Drug Interactions - Clinical grade
-- 4. Micromedex Drug Interactions - Evidence-based

-- Current placeholder implementation location:
-- /supabase/migrations/20251017100000_fhir_medication_request.sql lines 219-244

-- =====================================================================
-- Enhanced Drug Interaction Table for API Response Caching
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.drug_interaction_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Drug pair identifiers (RxCUI codes from RxNorm)
  drug_a_rxcui TEXT NOT NULL,
  drug_a_name TEXT NOT NULL,
  drug_b_rxcui TEXT NOT NULL,
  drug_b_name TEXT NOT NULL,

  -- Interaction details
  has_interaction BOOLEAN NOT NULL DEFAULT FALSE,
  severity TEXT, -- 'contraindicated', 'major', 'moderate', 'minor'
  CHECK (severity IS NULL OR severity IN ('contraindicated', 'major', 'moderate', 'minor')),

  -- Clinical information
  interaction_description TEXT,
  clinical_effects TEXT,
  mechanism TEXT,
  management_recommendations TEXT,

  -- Evidence strength
  evidence_level TEXT, -- 'excellent', 'good', 'fair', 'poor'
  documentation_level TEXT,

  -- Source information
  source_api TEXT NOT NULL, -- 'fdb', 'rxnorm', 'lexicomp', 'micromedex'
  source_version TEXT,

  -- Caching metadata
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cache_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure unique drug pairs (bidirectional)
  CONSTRAINT unique_drug_pair UNIQUE (drug_a_rxcui, drug_b_rxcui)
);

CREATE INDEX idx_drug_interaction_cache_drug_a ON public.drug_interaction_cache(drug_a_rxcui);
CREATE INDEX idx_drug_interaction_cache_drug_b ON public.drug_interaction_cache(drug_b_rxcui);
CREATE INDEX idx_drug_interaction_cache_severity ON public.drug_interaction_cache(severity) WHERE has_interaction = TRUE;
CREATE INDEX idx_drug_interaction_cache_expires ON public.drug_interaction_cache(cache_expires_at);

-- =====================================================================
-- Enhanced check_drug_interactions Function with Caching
-- =====================================================================

CREATE OR REPLACE FUNCTION public.check_drug_interactions_enhanced(
  p_medication_rxcui TEXT,
  p_patient_id UUID
)
RETURNS TABLE (
  has_interaction BOOLEAN,
  interaction_severity TEXT,
  interacting_medication TEXT,
  interaction_description TEXT,
  management_recommendation TEXT,
  source_api TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_active_med RECORD;
  v_cached_interaction RECORD;
BEGIN
  -- Get all active medications for this patient
  FOR v_active_med IN
    SELECT
      medication_codeable_concept->>'rxcui' AS rxcui,
      medication_codeable_concept->'coding'->0->>'display' AS medication_name
    FROM public.fhir_medication_requests
    WHERE patient_id = p_patient_id
      AND status = 'active'
      AND medication_codeable_concept->>'rxcui' IS NOT NULL
      AND medication_codeable_concept->>'rxcui' != p_medication_rxcui
  LOOP
    -- Check cache first (bidirectional lookup)
    SELECT * INTO v_cached_interaction
    FROM public.drug_interaction_cache
    WHERE (
      (drug_a_rxcui = p_medication_rxcui AND drug_b_rxcui = v_active_med.rxcui)
      OR
      (drug_a_rxcui = v_active_med.rxcui AND drug_b_rxcui = p_medication_rxcui)
    )
    AND cache_expires_at > NOW()
    LIMIT 1;

    IF FOUND AND v_cached_interaction.has_interaction THEN
      -- Return cached interaction
      RETURN QUERY SELECT
        v_cached_interaction.has_interaction,
        v_cached_interaction.severity,
        v_active_med.medication_name,
        v_cached_interaction.interaction_description,
        v_cached_interaction.management_recommendations,
        v_cached_interaction.source_api;
    ELSIF NOT FOUND THEN
      -- TODO: Call external API here
      -- For now, return placeholder indicating API call needed
      RETURN QUERY SELECT
        FALSE,
        NULL::TEXT,
        v_active_med.medication_name,
        'API integration required - see migration 20251025110000'::TEXT,
        'Manually verify drug interactions until API is integrated'::TEXT,
        'placeholder'::TEXT;
    END IF;
  END LOOP;

  RETURN;
END;
$$;

-- =====================================================================
-- Patient Safety Alert: Log when interactions are not checked
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.drug_interaction_check_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medication_request_id UUID REFERENCES public.fhir_medication_requests(id) ON DELETE SET NULL,
  medication_rxcui TEXT,
  medication_name TEXT,
  check_performed BOOLEAN NOT NULL DEFAULT TRUE,
  interactions_found INTEGER DEFAULT 0,
  highest_severity TEXT,
  api_used TEXT,
  check_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  prescriber_id UUID REFERENCES auth.users(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_drug_check_logs_patient ON public.drug_interaction_check_logs(patient_id);
CREATE INDEX idx_drug_check_logs_timestamp ON public.drug_interaction_check_logs(check_timestamp DESC);
CREATE INDEX idx_drug_check_logs_severity ON public.drug_interaction_check_logs(highest_severity) WHERE highest_severity IS NOT NULL;

-- Enable RLS
ALTER TABLE public.drug_interaction_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drug_interaction_check_logs ENABLE ROW LEVEL SECURITY;

-- Policies: Cache is read-only for authenticated users
CREATE POLICY "Anyone can read drug interaction cache"
  ON public.drug_interaction_cache FOR SELECT TO authenticated
  USING (true);

-- Policies: Only admins and prescribers can see check logs
CREATE POLICY "Prescribers can view own check logs"
  ON public.drug_interaction_check_logs FOR SELECT TO authenticated
  USING (
    prescriber_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'physician', 'nurse_practitioner'))
  );

GRANT SELECT ON public.drug_interaction_cache TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_drug_interactions_enhanced(TEXT, UUID) TO authenticated;
GRANT SELECT ON public.drug_interaction_check_logs TO authenticated;
GRANT INSERT ON public.drug_interaction_check_logs TO authenticated;

-- =====================================================================
-- Documentation and Comments
-- =====================================================================

COMMENT ON TABLE public.drug_interaction_cache IS 'Cache for drug-drug interaction checks from external APIs (FDB, RxNorm, etc.) - reduces API calls and costs';
COMMENT ON TABLE public.drug_interaction_check_logs IS 'Audit log of all drug interaction checks performed - required for patient safety and regulatory compliance';
COMMENT ON FUNCTION public.check_drug_interactions_enhanced IS 'Enhanced drug interaction checker with caching - requires external API integration for production use';

-- =====================================================================
-- Integration Instructions for Development Team
-- =====================================================================

-- STEP 1: Choose API Provider
-- - Sign up for FDB MedKnowledge (recommended for hospitals)
-- - OR use free RxNorm Interaction API: https://rxnav.nlm.nih.gov/InteractionAPIs.html

-- STEP 2: Create Supabase Edge Function
-- File: supabase/functions/check-drug-interactions/index.ts
-- - Accept medication RxCUI codes as input
-- - Call external API
-- - Cache results in drug_interaction_cache table
-- - Return interaction details

-- STEP 3: Update check_drug_interactions_enhanced function
-- Replace TODO section with:
-- - Call to Supabase Edge Function
-- - Parse and cache results
-- - Return formatted interaction data

-- STEP 4: Integration Testing
-- - Test with known interacting drug pairs:
--   * Warfarin + Aspirin (major bleeding risk)
--   * Simvastatin + Clarithromycin (contraindicated)
--   * Lisinopril + Spironolactone (hyperkalemia risk)
-- - Verify severity levels are accurate
-- - Confirm caching works (no duplicate API calls)

-- STEP 5: Clinical Validation
-- - Have clinical pharmacist review interaction alerts
-- - Adjust severity thresholds for clinical workflow
-- - Configure alert fatigue prevention (suppress minor interactions in non-critical contexts)

-- =====================================================================
-- Migration Complete - API Integration Required
-- =====================================================================
-- This migration creates the infrastructure for drug interaction
-- checking, but DOES NOT implement the actual API integration.
--
-- CRITICAL: Before production use, you must:
-- 1. Integrate with a drug interaction API (FDB, RxNorm, Lexicomp)
-- 2. Implement caching logic in check_drug_interactions_enhanced()
-- 3. Create Supabase Edge Function for API calls
-- 4. Test with clinical pharmacist oversight
--
-- Current status: PLACEHOLDER - Manual review required
-- =====================================================================
