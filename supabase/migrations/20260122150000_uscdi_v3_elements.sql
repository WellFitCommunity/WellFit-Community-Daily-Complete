-- =====================================================
-- USCDI v3 Data Elements Migration
-- ONC Health IT Certification Criteria Compliance
-- Created: January 22, 2026
-- =====================================================

-- This migration adds support for USCDI v3 data elements new in 2024:
-- 1. Tribal Affiliation
-- 2. Disability Status
-- 3. Caregiver Relationships (structured)
-- 4. Time of Death
-- 5. Average Blood Pressure
-- 6. SDOH Goals

-- =====================================================
-- 1. TRIBAL AFFILIATION
-- =====================================================
-- Extension of patient demographics per USCDI v3

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'patients') THEN
    ALTER TABLE patients ADD COLUMN IF NOT EXISTS tribal_affiliation JSONB DEFAULT NULL;
    COMMENT ON COLUMN patients.tribal_affiliation IS 'USCDI v3: Tribal affiliation data per HL7 FHIR US Core. Structure: {code, display, system}';
  END IF;
END $$;

-- Example: {"code": "91", "display": "Cherokee Nation", "system": "http://terminology.hl7.org/CodeSystem/v3-TribalEntityUS"}

-- =====================================================
-- 2. DISABILITY STATUS
-- =====================================================
-- Patient disability information per USCDI v3

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'patients') THEN
    ALTER TABLE patients ADD COLUMN IF NOT EXISTS disability_status JSONB DEFAULT NULL;
    COMMENT ON COLUMN patients.disability_status IS 'USCDI v3: Disability status per ADA categories. Structure: [{type, description, onsetDate}]';
  END IF;
END $$;

-- Create disability reference table
CREATE TABLE IF NOT EXISTS disability_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  display VARCHAR(255) NOT NULL,
  category VARCHAR(100), -- physical, cognitive, sensory, psychiatric, etc.
  description TEXT,
  system VARCHAR(255) DEFAULT 'http://terminology.hl7.org/CodeSystem/disability-type',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed common disability types (per ADA categories)
INSERT INTO disability_types (code, display, category, description) VALUES
  ('mobility', 'Mobility Impairment', 'physical', 'Difficulty with walking, climbing stairs, or using arms/hands'),
  ('visual', 'Visual Impairment', 'sensory', 'Blindness or low vision not correctable with glasses'),
  ('hearing', 'Hearing Impairment', 'sensory', 'Deafness or hard of hearing'),
  ('cognitive', 'Cognitive Impairment', 'cognitive', 'Difficulty with memory, learning, or intellectual function'),
  ('psychiatric', 'Psychiatric Disability', 'psychiatric', 'Mental health conditions affecting daily functioning'),
  ('speech', 'Speech Impairment', 'communication', 'Difficulty with verbal communication'),
  ('chronic', 'Chronic Health Condition', 'physical', 'Long-term health conditions affecting function')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 3. CAREGIVER RELATIONSHIPS (Structured)
-- =====================================================
-- Structured caregiver data per USCDI v3

CREATE TABLE IF NOT EXISTS patient_caregivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,

  -- Caregiver details
  caregiver_type VARCHAR(50) NOT NULL, -- family, professional, legal_guardian, healthcare_proxy
  relationship_code VARCHAR(20), -- spouse, parent, child, sibling, other
  relationship_display VARCHAR(100),

  -- Contact info
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  address_line1 VARCHAR(255),
  address_city VARCHAR(100),
  address_state VARCHAR(2),
  address_postal_code VARCHAR(10),

  -- Legal status
  is_healthcare_proxy BOOLEAN DEFAULT FALSE,
  is_power_of_attorney BOOLEAN DEFAULT FALSE,
  is_emergency_contact BOOLEAN DEFAULT FALSE,
  legal_document_on_file BOOLEAN DEFAULT FALSE,

  -- Effective period
  effective_start DATE,
  effective_end DATE,
  is_active BOOLEAN DEFAULT TRUE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,

  UNIQUE(tenant_id, patient_id, first_name, last_name, caregiver_type)
);

-- RLS for patient_caregivers
ALTER TABLE patient_caregivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for patient_caregivers"
  ON patient_caregivers FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_patient_caregivers_patient ON patient_caregivers(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_caregivers_tenant ON patient_caregivers(tenant_id);

-- =====================================================
-- 4. TIME OF DEATH
-- =====================================================
-- Structured death information per USCDI v3

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'patients') THEN
    ALTER TABLE patients ADD COLUMN IF NOT EXISTS date_of_death DATE DEFAULT NULL;
    ALTER TABLE patients ADD COLUMN IF NOT EXISTS time_of_death TIME DEFAULT NULL;
    ALTER TABLE patients ADD COLUMN IF NOT EXISTS death_datetime TIMESTAMPTZ DEFAULT NULL;
    ALTER TABLE patients ADD COLUMN IF NOT EXISTS death_location VARCHAR(255) DEFAULT NULL;
    ALTER TABLE patients ADD COLUMN IF NOT EXISTS death_cause_code VARCHAR(20) DEFAULT NULL;
    ALTER TABLE patients ADD COLUMN IF NOT EXISTS death_cause_display VARCHAR(255) DEFAULT NULL;
    ALTER TABLE patients ADD COLUMN IF NOT EXISTS death_manner VARCHAR(50) DEFAULT NULL;
    ALTER TABLE patients ADD COLUMN IF NOT EXISTS death_certificate_number VARCHAR(50) DEFAULT NULL;
    ALTER TABLE patients ADD COLUMN IF NOT EXISTS death_verified_by UUID DEFAULT NULL;
    ALTER TABLE patients ADD COLUMN IF NOT EXISTS death_verified_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN patients.death_datetime IS 'USCDI v3: Combined date and time of death';
    COMMENT ON COLUMN patients.death_manner IS 'Manner of death: natural, accident, suicide, homicide, pending, undetermined';
  END IF;
END $$;

-- =====================================================
-- 5. AVERAGE BLOOD PRESSURE
-- =====================================================
-- Calculated average BP per USCDI v3

CREATE TABLE IF NOT EXISTS patient_average_blood_pressure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,

  -- Average values
  average_systolic DECIMAL(5,1) NOT NULL,
  average_diastolic DECIMAL(5,1) NOT NULL,

  -- Calculation details
  calculation_period_start DATE NOT NULL,
  calculation_period_end DATE NOT NULL,
  readings_count INTEGER NOT NULL,
  calculation_method VARCHAR(50) DEFAULT 'simple_mean', -- simple_mean, weighted, excluding_outliers

  -- Context
  measurement_context VARCHAR(50), -- office, home, ambulatory
  excluded_readings_count INTEGER DEFAULT 0,

  -- Classification (per ACC/AHA guidelines)
  classification VARCHAR(50), -- normal, elevated, hypertension_stage_1, hypertension_stage_2, crisis

  -- Metadata
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  calculated_by UUID,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for average BP
ALTER TABLE patient_average_blood_pressure ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for patient_average_blood_pressure"
  ON patient_average_blood_pressure FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_avg_bp_patient ON patient_average_blood_pressure(patient_id);
CREATE INDEX IF NOT EXISTS idx_avg_bp_period ON patient_average_blood_pressure(calculation_period_start, calculation_period_end);

-- Function to calculate average BP
CREATE OR REPLACE FUNCTION calculate_average_blood_pressure(
  p_tenant_id UUID,
  p_patient_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_context VARCHAR DEFAULT NULL
) RETURNS TABLE (
  avg_systolic DECIMAL(5,1),
  avg_diastolic DECIMAL(5,1),
  readings_count INTEGER,
  classification VARCHAR(50)
) AS $$
DECLARE
  v_systolic DECIMAL(5,1);
  v_diastolic DECIMAL(5,1);
  v_count INTEGER;
  v_class VARCHAR(50);
BEGIN
  -- Calculate averages from vital_signs or observations table
  SELECT
    ROUND(AVG((value->>'systolic')::DECIMAL), 1),
    ROUND(AVG((value->>'diastolic')::DECIMAL), 1),
    COUNT(*)
  INTO v_systolic, v_diastolic, v_count
  FROM observations
  WHERE tenant_id = p_tenant_id
    AND patient_id = p_patient_id
    AND code IN ('85354-9', '8480-6') -- LOINC for BP
    AND effective_date BETWEEN p_start_date AND p_end_date
    AND (p_context IS NULL OR context = p_context);

  -- Classify per ACC/AHA guidelines
  IF v_systolic IS NULL THEN
    v_class := 'insufficient_data';
  ELSIF v_systolic >= 180 OR v_diastolic >= 120 THEN
    v_class := 'hypertensive_crisis';
  ELSIF v_systolic >= 140 OR v_diastolic >= 90 THEN
    v_class := 'hypertension_stage_2';
  ELSIF v_systolic >= 130 OR v_diastolic >= 80 THEN
    v_class := 'hypertension_stage_1';
  ELSIF v_systolic >= 120 THEN
    v_class := 'elevated';
  ELSE
    v_class := 'normal';
  END IF;

  RETURN QUERY SELECT v_systolic, v_diastolic, v_count, v_class;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. SDOH GOALS
-- =====================================================
-- Social Determinants of Health Goals per USCDI v3

CREATE TABLE IF NOT EXISTS sdoh_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,

  -- Goal identification
  goal_type VARCHAR(100) NOT NULL, -- food_security, housing_stability, transportation, employment, etc.
  description TEXT NOT NULL,

  -- SDOH domain (per Gravity Project)
  sdoh_domain VARCHAR(100) NOT NULL, -- food_insecurity, housing_instability, transportation_insecurity, etc.
  sdoh_code VARCHAR(20), -- LOINC or SNOMED code
  sdoh_code_system VARCHAR(255),

  -- Goal details
  target TEXT,
  target_date DATE,

  -- Linked condition (if applicable)
  related_condition_id UUID,
  related_condition_code VARCHAR(20),
  related_condition_display VARCHAR(255),

  -- Status
  status VARCHAR(50) DEFAULT 'proposed', -- proposed, planned, accepted, active, completed, cancelled
  achievement_status VARCHAR(50), -- in_progress, improving, worsening, no_change, achieved, not_achieved

  -- Progress tracking
  progress_notes TEXT[],
  last_reviewed DATE,
  reviewed_by UUID,

  -- Interventions
  interventions JSONB DEFAULT '[]',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,

  start_date DATE,
  end_date DATE
);

-- RLS for SDOH goals
ALTER TABLE sdoh_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for sdoh_goals"
  ON sdoh_goals FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sdoh_goals_patient ON sdoh_goals(patient_id);
CREATE INDEX IF NOT EXISTS idx_sdoh_goals_domain ON sdoh_goals(sdoh_domain);
CREATE INDEX IF NOT EXISTS idx_sdoh_goals_status ON sdoh_goals(status);

-- SDOH domain reference table
CREATE TABLE IF NOT EXISTS sdoh_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  display VARCHAR(255) NOT NULL,
  category VARCHAR(100), -- economic_stability, education_access, healthcare_access, neighborhood_environment, social_community_context
  description TEXT,
  loinc_code VARCHAR(20),
  snomed_code VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed SDOH domains (per Gravity Project)
INSERT INTO sdoh_domains (code, display, category, description) VALUES
  ('food_insecurity', 'Food Insecurity', 'economic_stability', 'Limited or uncertain access to adequate food'),
  ('housing_instability', 'Housing Instability', 'economic_stability', 'Unstable or inadequate housing'),
  ('homelessness', 'Homelessness', 'economic_stability', 'Lack of permanent housing'),
  ('transportation_insecurity', 'Transportation Insecurity', 'neighborhood_environment', 'Limited access to reliable transportation'),
  ('utility_insecurity', 'Utility Insecurity', 'economic_stability', 'Difficulty paying for utilities'),
  ('financial_strain', 'Financial Strain', 'economic_stability', 'General financial hardship'),
  ('employment_status', 'Employment Status', 'economic_stability', 'Unemployment or underemployment'),
  ('education_access', 'Education Access', 'education_access', 'Limited access to education'),
  ('social_isolation', 'Social Isolation', 'social_community_context', 'Lack of social connections'),
  ('intimate_partner_violence', 'Intimate Partner Violence', 'social_community_context', 'Experience of domestic violence'),
  ('veteran_status', 'Veteran Status', 'social_community_context', 'Military service history')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- UPDATE CERTIFICATION TRACKER
-- =====================================================

-- Log migration (only if audit_logs exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    INSERT INTO audit_logs (
      action,
      entity_type,
      entity_id,
      new_data,
      performed_at
    ) VALUES (
      'USCDI_V3_MIGRATION',
      'database',
      'migration',
      jsonb_build_object(
        'elements_added', ARRAY[
          'tribal_affiliation',
          'disability_status',
          'patient_caregivers',
          'time_of_death',
          'average_blood_pressure',
          'sdoh_goals'
        ],
        'uscdi_version', 'v3',
        'compliance_date', '2026-01-22'
      ),
      NOW()
    );
  END IF;
END $$;

COMMENT ON TABLE patient_caregivers IS 'USCDI v3: Structured caregiver relationships';
COMMENT ON TABLE patient_average_blood_pressure IS 'USCDI v3: Average blood pressure calculations';
COMMENT ON TABLE sdoh_goals IS 'USCDI v3: Social Determinants of Health goals linked to conditions';
COMMENT ON TABLE sdoh_domains IS 'USCDI v3: SDOH domain reference per Gravity Project';
COMMENT ON TABLE disability_types IS 'USCDI v3: Disability type reference per ADA categories';
