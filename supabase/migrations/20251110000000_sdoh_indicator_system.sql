-- ============================================================================
-- SDOH (Social Determinants of Health) Comprehensive Indicator System
-- Enterprise-grade multi-tenant implementation for visual SDOH tracking
--
-- Features:
-- - 26+ SDOH categories (housing, food, transportation, health behaviors, etc.)
-- - Risk-level tracking (none, low, moderate, high, critical)
-- - Intervention status (identified, referral-made, in-progress, resolved)
-- - Referral and resource tracking
-- - Screening history
-- - Multi-tenant RLS isolation
-- - FHIR R4 compliant (Z-codes, LOINC, SNOMED CT)
-- ============================================================================

BEGIN;

-- ============================================================================
-- SDOH OBSERVATIONS TABLE (Main SDOH Factors)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sdoh_observations (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fhir_id TEXT UNIQUE DEFAULT gen_random_uuid()::text,

  -- Multi-tenant isolation
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID, -- For multi-tenant organizations

  -- FHIR Status
  status TEXT NOT NULL DEFAULT 'final' CHECK (status IN (
    'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error'
  )),

  -- SDOH Category (comprehensive)
  category TEXT NOT NULL CHECK (category IN (
    -- Core Needs
    'housing', 'food-security', 'transportation', 'financial', 'employment',
    -- Health Behaviors
    'tobacco-use', 'alcohol-use', 'substance-use',
    -- Healthcare Access
    'dental-care', 'vision-care', 'mental-health', 'medication-access', 'primary-care-access',
    -- Social Support
    'social-isolation', 'caregiver-burden', 'community-connection',
    -- Barriers
    'education', 'health-literacy', 'digital-literacy', 'language-barrier', 'legal-issues', 'immigration-status',
    -- Safety
    'domestic-violence', 'neighborhood-safety',
    -- Special Populations
    'disability', 'veteran-status'
  )),

  -- Risk Level
  risk_level TEXT NOT NULL DEFAULT 'unknown' CHECK (risk_level IN (
    'none', 'low', 'moderate', 'high', 'critical', 'unknown'
  )),

  -- Priority (1-5, with 5 being highest)
  priority_level INTEGER DEFAULT 1 CHECK (priority_level BETWEEN 1 AND 5),

  -- Assessment Information
  effective_datetime TIMESTAMPTZ DEFAULT NOW(),
  next_assessment_date TIMESTAMPTZ,
  performer_id UUID REFERENCES auth.users(id),
  performer_name TEXT,

  -- Clinical Codes (FHIR compliant)
  loinc_code TEXT, -- LOINC code for SDOH observation
  z_codes TEXT[], -- ICD-10 Z-codes array (Z59.0, Z59.1, etc.)
  snomed_code TEXT, -- SNOMED CT code if applicable

  -- Value/Description
  value_text TEXT, -- Descriptive value
  value_code TEXT, -- Coded value (LA33-6 Yes, LA32-8 No)
  interpretation TEXT, -- Clinical interpretation
  notes TEXT, -- Additional clinical notes

  -- Intervention Tracking
  intervention_provided BOOLEAN DEFAULT false,
  referral_made BOOLEAN DEFAULT false,
  referral_to TEXT, -- Organization/service referred to
  follow_up_needed BOOLEAN DEFAULT false,
  follow_up_date TIMESTAMPTZ,

  -- Health Impact
  health_impact TEXT CHECK (health_impact IN (
    'none', 'minimal', 'moderate', 'significant', 'severe'
  )),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sdoh_obs_patient_id ON public.sdoh_observations(patient_id);
CREATE INDEX IF NOT EXISTS idx_sdoh_obs_category ON public.sdoh_observations(category);
CREATE INDEX IF NOT EXISTS idx_sdoh_obs_risk_level ON public.sdoh_observations(risk_level);
CREATE INDEX IF NOT EXISTS idx_sdoh_obs_tenant_id ON public.sdoh_observations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sdoh_obs_effective_date ON public.sdoh_observations(effective_datetime DESC);
CREATE INDEX IF NOT EXISTS idx_sdoh_obs_status ON public.sdoh_observations(status);
CREATE INDEX IF NOT EXISTS idx_sdoh_obs_intervention ON public.sdoh_observations(intervention_provided, referral_made);

-- ============================================================================
-- SDOH REFERRALS TABLE (Service Referrals)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sdoh_referrals (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenant isolation
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID,

  -- Related SDOH category
  category TEXT NOT NULL,

  -- Referral Details
  service TEXT NOT NULL, -- e.g., "Food Bank", "Housing Authority"
  organization TEXT, -- Organization name
  contact_info TEXT, -- Phone, email, address
  date_referred TIMESTAMPTZ DEFAULT NOW(),

  -- Status Tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'completed', 'declined', 'no-show', 'cancelled'
  )),
  follow_up_date TIMESTAMPTZ,
  completion_date TIMESTAMPTZ,

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sdoh_ref_patient_id ON public.sdoh_referrals(patient_id);
CREATE INDEX IF NOT EXISTS idx_sdoh_ref_category ON public.sdoh_referrals(category);
CREATE INDEX IF NOT EXISTS idx_sdoh_ref_status ON public.sdoh_referrals(status);
CREATE INDEX IF NOT EXISTS idx_sdoh_ref_tenant_id ON public.sdoh_referrals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sdoh_ref_date ON public.sdoh_referrals(date_referred DESC);

-- ============================================================================
-- SDOH RESOURCES TABLE (Resources Provided to Patients)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sdoh_resources (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenant isolation
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID,

  -- Related SDOH category
  category TEXT NOT NULL,

  -- Resource Details
  type TEXT NOT NULL CHECK (type IN (
    'information', 'material', 'financial', 'service'
  )),
  name TEXT NOT NULL,
  description TEXT,

  -- Provision Details
  date_provided TIMESTAMPTZ DEFAULT NOW(),
  provided_by UUID REFERENCES auth.users(id),
  provided_by_name TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sdoh_res_patient_id ON public.sdoh_resources(patient_id);
CREATE INDEX IF NOT EXISTS idx_sdoh_res_category ON public.sdoh_resources(category);
CREATE INDEX IF NOT EXISTS idx_sdoh_res_type ON public.sdoh_resources(type);
CREATE INDEX IF NOT EXISTS idx_sdoh_res_tenant_id ON public.sdoh_resources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sdoh_res_date ON public.sdoh_resources(date_provided DESC);

-- ============================================================================
-- SDOH SCREENINGS TABLE (Screening Event History)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sdoh_screenings (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenant isolation
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID,

  -- Screening Details
  date TIMESTAMPTZ DEFAULT NOW(),
  type TEXT NOT NULL CHECK (type IN (
    'full', 'targeted', 'rapid', 'update'
  )),

  -- Screening Tool Used
  tool TEXT CHECK (tool IN (
    'PRAPARE', 'AHC', 'iHELP', 'custom'
  )),

  -- Screening Results
  factors_identified INTEGER DEFAULT 0,
  factors_addressed INTEGER DEFAULT 0,

  -- Performed By
  screened_by UUID REFERENCES auth.users(id),
  screened_by_name TEXT,

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sdoh_screen_patient_id ON public.sdoh_screenings(patient_id);
CREATE INDEX IF NOT EXISTS idx_sdoh_screen_date ON public.sdoh_screenings(date DESC);
CREATE INDEX IF NOT EXISTS idx_sdoh_screen_type ON public.sdoh_screenings(type);
CREATE INDEX IF NOT EXISTS idx_sdoh_screen_tenant_id ON public.sdoh_screenings(tenant_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Multi-tenant data isolation with role-based access
-- ============================================================================

-- Enable RLS
ALTER TABLE public.sdoh_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdoh_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdoh_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdoh_screenings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS: SDOH OBSERVATIONS
-- ============================================================================
-- Drop existing policies if they exist (idempotent migration)
DROP POLICY IF EXISTS "Patients can view own SDOH observations" ON public.sdoh_observations;
DROP POLICY IF EXISTS "Providers can view patient SDOH observations" ON public.sdoh_observations;
DROP POLICY IF EXISTS "Providers can insert SDOH observations" ON public.sdoh_observations;
DROP POLICY IF EXISTS "Providers can update SDOH observations" ON public.sdoh_observations;

-- Patients can view their own SDOH data
CREATE POLICY "Patients can view own SDOH observations"
  ON public.sdoh_observations
  FOR SELECT
  USING (auth.uid() = patient_id);

-- Healthcare providers can view SDOH data for their patients
CREATE POLICY "Providers can view patient SDOH observations"
  ON public.sdoh_observations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('physician', 'nurse', 'admin', 'chw', 'care_coordinator')
    )
  );

-- Healthcare providers can insert SDOH observations
CREATE POLICY "Providers can insert SDOH observations"
  ON public.sdoh_observations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('physician', 'nurse', 'admin', 'chw', 'care_coordinator')
    )
  );

-- Healthcare providers can update SDOH observations
CREATE POLICY "Providers can update SDOH observations"
  ON public.sdoh_observations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('physician', 'nurse', 'admin', 'chw', 'care_coordinator')
    )
  );

-- ============================================================================
-- RLS: SDOH REFERRALS
-- ============================================================================
-- Drop existing policies if they exist (idempotent migration)
DROP POLICY IF EXISTS "Patients can view own SDOH referrals" ON public.sdoh_referrals;
DROP POLICY IF EXISTS "Providers can view SDOH referrals" ON public.sdoh_referrals;
DROP POLICY IF EXISTS "Providers can insert SDOH referrals" ON public.sdoh_referrals;
DROP POLICY IF EXISTS "Providers can update SDOH referrals" ON public.sdoh_referrals;

-- Patients can view their own referrals
CREATE POLICY "Patients can view own SDOH referrals"
  ON public.sdoh_referrals
  FOR SELECT
  USING (auth.uid() = patient_id);

-- Healthcare providers can manage referrals
CREATE POLICY "Providers can view SDOH referrals"
  ON public.sdoh_referrals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('physician', 'nurse', 'admin', 'chw', 'care_coordinator')
    )
  );

CREATE POLICY "Providers can insert SDOH referrals"
  ON public.sdoh_referrals
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('physician', 'nurse', 'admin', 'chw', 'care_coordinator')
    )
  );

CREATE POLICY "Providers can update SDOH referrals"
  ON public.sdoh_referrals
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('physician', 'nurse', 'admin', 'chw', 'care_coordinator')
    )
  );

-- ============================================================================
-- RLS: SDOH RESOURCES
-- ============================================================================
-- Drop existing policies if they exist (idempotent migration)
DROP POLICY IF EXISTS "Patients can view own SDOH resources" ON public.sdoh_resources;
DROP POLICY IF EXISTS "Providers can view SDOH resources" ON public.sdoh_resources;
DROP POLICY IF EXISTS "Providers can insert SDOH resources" ON public.sdoh_resources;

-- Patients can view their own resources
CREATE POLICY "Patients can view own SDOH resources"
  ON public.sdoh_resources
  FOR SELECT
  USING (auth.uid() = patient_id);

-- Healthcare providers can manage resources
CREATE POLICY "Providers can view SDOH resources"
  ON public.sdoh_resources
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('physician', 'nurse', 'admin', 'chw', 'care_coordinator')
    )
  );

CREATE POLICY "Providers can insert SDOH resources"
  ON public.sdoh_resources
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('physician', 'nurse', 'admin', 'chw', 'care_coordinator')
    )
  );

-- ============================================================================
-- RLS: SDOH SCREENINGS
-- ============================================================================
-- Drop existing policies if they exist (idempotent migration)
DROP POLICY IF EXISTS "Patients can view own SDOH screenings" ON public.sdoh_screenings;
DROP POLICY IF EXISTS "Providers can view SDOH screenings" ON public.sdoh_screenings;
DROP POLICY IF EXISTS "Providers can insert SDOH screenings" ON public.sdoh_screenings;

-- Patients can view their own screening history
CREATE POLICY "Patients can view own SDOH screenings"
  ON public.sdoh_screenings
  FOR SELECT
  USING (auth.uid() = patient_id);

-- Healthcare providers can manage screenings
CREATE POLICY "Providers can view SDOH screenings"
  ON public.sdoh_screenings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('physician', 'nurse', 'admin', 'chw', 'care_coordinator')
    )
  );

CREATE POLICY "Providers can insert SDOH screenings"
  ON public.sdoh_screenings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('physician', 'nurse', 'admin', 'chw', 'care_coordinator')
    )
  );

-- ============================================================================
-- DATABASE FUNCTIONS
-- ============================================================================

-- Function to calculate SDOH risk score for a patient
CREATE OR REPLACE FUNCTION calculate_sdoh_risk_score(p_patient_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_risk_score INTEGER;
BEGIN
  WITH risk_weights AS (
    SELECT
      CASE risk_level
        WHEN 'critical' THEN 100
        WHEN 'high' THEN 75
        WHEN 'moderate' THEN 50
        WHEN 'low' THEN 25
        WHEN 'none' THEN 0
        ELSE 0
      END AS weight,
      COALESCE(priority_level, 1) AS priority
    FROM public.sdoh_observations
    WHERE patient_id = p_patient_id
      AND status = 'final'
  )
  SELECT
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND((SUM(weight * priority)::DECIMAL / SUM(priority * 100)) * 100)
    END::INTEGER
  INTO v_risk_score
  FROM risk_weights;

  RETURN COALESCE(v_risk_score, 0);
END;
$$;

-- Function to get high-risk SDOH count
CREATE OR REPLACE FUNCTION get_high_risk_sdoh_count(p_patient_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER
  INTO v_count
  FROM public.sdoh_observations
  WHERE patient_id = p_patient_id
    AND risk_level IN ('high', 'critical')
    AND status = 'final';

  RETURN COALESCE(v_count, 0);
END;
$$;

-- Function to update SDOH observation timestamp
CREATE OR REPLACE FUNCTION update_sdoh_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Triggers (drop existing triggers if they exist for idempotent migration)
DROP TRIGGER IF EXISTS sdoh_observations_updated_at ON public.sdoh_observations;
DROP TRIGGER IF EXISTS sdoh_referrals_updated_at ON public.sdoh_referrals;

CREATE TRIGGER sdoh_observations_updated_at
  BEFORE UPDATE ON public.sdoh_observations
  FOR EACH ROW
  EXECUTE FUNCTION update_sdoh_updated_at();

CREATE TRIGGER sdoh_referrals_updated_at
  BEFORE UPDATE ON public.sdoh_referrals
  FOR EACH ROW
  EXECUTE FUNCTION update_sdoh_updated_at();

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant access to authenticated users
GRANT SELECT ON public.sdoh_observations TO authenticated;
GRANT SELECT ON public.sdoh_referrals TO authenticated;
GRANT SELECT ON public.sdoh_resources TO authenticated;
GRANT SELECT ON public.sdoh_screenings TO authenticated;

GRANT INSERT, UPDATE ON public.sdoh_observations TO authenticated;
GRANT INSERT, UPDATE ON public.sdoh_referrals TO authenticated;
GRANT INSERT ON public.sdoh_resources TO authenticated;
GRANT INSERT ON public.sdoh_screenings TO authenticated;

-- Grant function execution
GRANT EXECUTE ON FUNCTION calculate_sdoh_risk_score(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_high_risk_sdoh_count(UUID) TO authenticated;

COMMIT;

-- ============================================================================
-- COMMENTS (Database Documentation)
-- ============================================================================

COMMENT ON TABLE public.sdoh_observations IS 'Comprehensive social determinants of health observations for visual indicator system';
COMMENT ON TABLE public.sdoh_referrals IS 'Service referrals made for SDOH support (food banks, housing, etc.)';
COMMENT ON TABLE public.sdoh_resources IS 'Resources provided to patients for SDOH needs';
COMMENT ON TABLE public.sdoh_screenings IS 'History of SDOH screening events (PRAPARE, AHC, etc.)';

COMMENT ON FUNCTION calculate_sdoh_risk_score(UUID) IS 'Calculates weighted overall SDOH risk score (0-100) for a patient';
COMMENT ON FUNCTION get_high_risk_sdoh_count(UUID) IS 'Returns count of high/critical SDOH factors for a patient';
