-- =====================================================
-- DENTAL HEALTH MODULE - DATABASE SCHEMA
-- =====================================================
-- Version: 1.0.0
-- Created: 2025-11-09
-- Purpose: Comprehensive dental health tracking integrated with chronic disease management
-- FHIR Mapping: Procedure, Observation, Condition resources
-- Billing: CDT code support for reimbursement pathways
-- =====================================================

-- =====================================================
-- 1. ENUMS AND TYPE DEFINITIONS
-- =====================================================

-- Dental provider role types
CREATE TYPE dental_provider_role AS ENUM (
  'dentist',
  'dental_hygienist',
  'orthodontist',
  'periodontist',
  'endodontist',
  'oral_surgeon',
  'prosthodontist',
  'pediatric_dentist'
);

-- Dental visit types
CREATE TYPE dental_visit_type AS ENUM (
  'initial_exam',
  'routine_cleaning',
  'comprehensive_exam',
  'emergency',
  'follow_up',
  'consultation',
  'procedure',
  'screening'
);

-- Dental assessment status
CREATE TYPE dental_assessment_status AS ENUM (
  'draft',
  'completed',
  'reviewed',
  'approved',
  'cancelled'
);

-- Tooth condition types
CREATE TYPE tooth_condition AS ENUM (
  'healthy',
  'cavity',
  'filling',
  'crown',
  'bridge',
  'implant',
  'root_canal',
  'extraction',
  'missing',
  'fractured',
  'abscessed',
  'impacted'
);

-- Periodontal health status
CREATE TYPE periodontal_status AS ENUM (
  'healthy',
  'gingivitis',
  'mild_periodontitis',
  'moderate_periodontitis',
  'severe_periodontitis',
  'advanced_periodontitis'
);

-- Treatment priority levels
CREATE TYPE treatment_priority AS ENUM (
  'emergency',
  'urgent',
  'routine',
  'elective',
  'preventive'
);

-- =====================================================
-- 2. CORE TABLES
-- =====================================================

-- Dental Assessments (main clinical documentation)
CREATE TABLE public.dental_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider_role dental_provider_role,
  visit_type dental_visit_type NOT NULL,
  visit_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  status dental_assessment_status NOT NULL DEFAULT 'draft',

  -- Chief Complaint
  chief_complaint TEXT,
  pain_level INTEGER CHECK (pain_level >= 0 AND pain_level <= 10),
  pain_location TEXT,

  -- Clinical Findings
  overall_oral_health_rating INTEGER CHECK (overall_oral_health_rating >= 1 AND overall_oral_health_rating <= 5),
  periodontal_status periodontal_status,
  plaque_index DECIMAL(3,1) CHECK (plaque_index >= 0 AND plaque_index <= 3),
  bleeding_index DECIMAL(3,1) CHECK (bleeding_index >= 0 AND bleeding_index <= 3),
  gingival_index DECIMAL(3,1) CHECK (gingival_index >= 0 AND gingival_index <= 3),

  -- Risk Factors
  dry_mouth BOOLEAN DEFAULT FALSE,
  smoking_tobacco BOOLEAN DEFAULT FALSE,
  diabetes_present BOOLEAN DEFAULT FALSE,
  heart_disease_present BOOLEAN DEFAULT FALSE,
  immunocompromised BOOLEAN DEFAULT FALSE,
  medications_affecting_oral_health TEXT[],

  -- Hygiene Assessment
  brushing_frequency_per_day INTEGER,
  flossing_frequency_per_week INTEGER,
  last_dental_cleaning_date DATE,
  last_dental_exam_date DATE,

  -- Clinical Notes
  clinical_notes TEXT,
  treatment_recommendations TEXT,
  referral_needed BOOLEAN DEFAULT FALSE,
  referral_specialty dental_provider_role,
  referral_reason TEXT,

  -- Follow-up
  next_appointment_recommended_in_months INTEGER,
  patient_education_provided TEXT[],

  -- FHIR Mapping
  fhir_encounter_id UUID,
  fhir_diagnostic_report_id UUID,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),

  -- Indexes
  CONSTRAINT dental_assessments_patient_date_unique UNIQUE (patient_id, visit_date)
);

-- Tooth Chart (individual tooth tracking)
CREATE TABLE public.dental_tooth_chart (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.dental_assessments(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Tooth Identification (Universal Numbering System 1-32 for adults)
  tooth_number INTEGER NOT NULL CHECK (tooth_number >= 1 AND tooth_number <= 52), -- Supports primary teeth too
  tooth_name TEXT, -- E.g., "Upper Right Central Incisor"
  is_primary_tooth BOOLEAN DEFAULT FALSE,

  -- Tooth Status
  condition tooth_condition NOT NULL,
  mobility_score INTEGER CHECK (mobility_score >= 0 AND mobility_score <= 3), -- 0=none, 3=severe

  -- Periodontal Measurements (6 points per tooth)
  probing_depth_mb INTEGER, -- Mesial-Buccal
  probing_depth_b INTEGER,  -- Buccal
  probing_depth_db INTEGER, -- Distal-Buccal
  probing_depth_ml INTEGER, -- Mesial-Lingual
  probing_depth_l INTEGER,  -- Lingual
  probing_depth_dl INTEGER, -- Distal-Lingual

  -- Recession measurements
  recession_mb INTEGER,
  recession_b INTEGER,
  recession_db INTEGER,
  recession_ml INTEGER,
  recession_l INTEGER,
  recession_dl INTEGER,

  -- Bleeding on Probing
  bleeding_on_probing BOOLEAN DEFAULT FALSE,

  -- Surface Conditions (MODBL - Mesial, Occlusal, Distal, Buccal, Lingual)
  surface_conditions JSONB, -- E.g., {"M": "cavity", "O": "filling", "D": "healthy"}

  -- Clinical Notes
  notes TEXT,

  -- Metadata
  recorded_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT tooth_chart_assessment_tooth_unique UNIQUE (assessment_id, tooth_number)
);

-- Dental Procedures (treatment history)
CREATE TABLE public.dental_procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id UUID REFERENCES public.dental_assessments(id) ON DELETE SET NULL,
  provider_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Procedure Details
  procedure_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  procedure_name TEXT NOT NULL,
  cdt_code VARCHAR(10), -- Current Dental Terminology code (e.g., D0120, D1110)
  snomed_code VARCHAR(20), -- SNOMED CT code for FHIR mapping
  icd10_code VARCHAR(10), -- ICD-10 diagnosis code if applicable

  -- Tooth/Area Affected
  tooth_numbers INTEGER[], -- Array of tooth numbers affected
  quadrant TEXT, -- UR, UL, LR, LL or "full mouth"
  arch TEXT, -- upper, lower, both

  -- Procedure Details
  procedure_description TEXT,
  anesthesia_used BOOLEAN DEFAULT FALSE,
  anesthesia_type TEXT,
  materials_used TEXT[],

  -- Treatment Plan Association
  treatment_plan_id UUID, -- Reference to treatment plan (separate table)
  priority treatment_priority,

  -- Clinical Outcome
  procedure_status TEXT DEFAULT 'completed', -- completed, scheduled, cancelled, in_progress
  complications TEXT,
  follow_up_required BOOLEAN DEFAULT FALSE,
  follow_up_date DATE,

  -- Billing & Insurance
  estimated_cost DECIMAL(10,2),
  insurance_coverage_percentage DECIMAL(5,2),
  patient_responsibility DECIMAL(10,2),
  billing_notes TEXT,

  -- FHIR Mapping
  fhir_procedure_id UUID,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  notes TEXT
);

-- Dental Treatment Plans
CREATE TABLE public.dental_treatment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id UUID REFERENCES public.dental_assessments(id) ON DELETE SET NULL,
  provider_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Plan Details
  plan_name TEXT NOT NULL,
  plan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'proposed', -- proposed, approved, in_progress, completed, cancelled

  -- Treatment Goals
  treatment_goals TEXT[],
  expected_duration_months INTEGER,

  -- Phased Treatment Plan (JSON structure for complex plans)
  phases JSONB, -- Array of phases with procedures, timeline, costs

  -- Financial Summary
  total_estimated_cost DECIMAL(10,2),
  insurance_coverage DECIMAL(10,2),
  patient_out_of_pocket DECIMAL(10,2),
  payment_plan_offered BOOLEAN DEFAULT FALSE,
  payment_plan_details TEXT,

  -- Consent & Approval
  patient_consent_obtained BOOLEAN DEFAULT FALSE,
  patient_consent_date DATE,
  patient_signature_url TEXT, -- Link to e-signature if digital

  -- Clinical Notes
  alternative_treatments_discussed TEXT,
  risks_discussed TEXT,
  benefits_discussed TEXT,
  prognosis TEXT,

  -- FHIR Mapping
  fhir_care_plan_id UUID,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  notes TEXT
);

-- Dental Observations (FHIR-compliant measurements)
CREATE TABLE public.dental_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id UUID REFERENCES public.dental_assessments(id) ON DELETE CASCADE,

  -- Observation Type (LOINC codes for dental observations)
  observation_code TEXT NOT NULL, -- LOINC or custom code
  observation_name TEXT NOT NULL,
  observation_category TEXT, -- e.g., "periodontal", "caries-risk", "oral-hygiene"

  -- Value
  value_quantity DECIMAL(10,2),
  value_unit TEXT,
  value_text TEXT,
  value_boolean BOOLEAN,
  value_codeable_concept JSONB,

  -- Reference Ranges
  reference_range_low DECIMAL(10,2),
  reference_range_high DECIMAL(10,2),
  interpretation TEXT, -- normal, high, low, critical

  -- Context
  observation_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  observed_by UUID REFERENCES auth.users(id),

  -- FHIR Mapping
  fhir_observation_id UUID,
  fhir_resource JSONB, -- Full FHIR Observation resource

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- Dental Imaging & Diagnostics (X-rays, photos, etc.)
CREATE TABLE public.dental_imaging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id UUID REFERENCES public.dental_assessments(id) ON DELETE SET NULL,
  procedure_id UUID REFERENCES public.dental_procedures(id) ON DELETE SET NULL,

  -- Image Details
  image_type TEXT NOT NULL, -- periapical, bitewing, panoramic, cephalometric, intraoral_photo, etc.
  image_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  tooth_numbers INTEGER[], -- Specific teeth captured

  -- Storage
  storage_url TEXT NOT NULL, -- Supabase Storage bucket URL
  thumbnail_url TEXT,
  file_size_bytes BIGINT,
  mime_type TEXT,

  -- Clinical Information
  indication TEXT, -- Reason for imaging
  findings TEXT,
  interpretation TEXT,
  interpreted_by UUID REFERENCES auth.users(id),
  interpretation_date TIMESTAMP WITH TIME ZONE,

  -- DICOM Metadata (for advanced imaging)
  dicom_metadata JSONB,

  -- FHIR Mapping
  fhir_imaging_study_id UUID,
  fhir_diagnostic_report_id UUID,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  notes TEXT
);

-- Dental Referrals
CREATE TABLE public.dental_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id UUID REFERENCES public.dental_assessments(id) ON DELETE SET NULL,
  referring_provider_id UUID REFERENCES auth.users(id),

  -- Referral Details
  referral_date DATE NOT NULL DEFAULT CURRENT_DATE,
  specialty_needed dental_provider_role NOT NULL,
  urgency treatment_priority NOT NULL,
  reason TEXT NOT NULL,
  clinical_summary TEXT,

  -- Specialist Information
  specialist_name TEXT,
  specialist_organization TEXT,
  specialist_phone TEXT,
  specialist_fax TEXT,
  specialist_email TEXT,

  -- Status Tracking
  status TEXT DEFAULT 'pending', -- pending, scheduled, completed, cancelled, declined
  appointment_scheduled_date DATE,
  appointment_completed_date DATE,

  -- Follow-up
  specialist_report_received BOOLEAN DEFAULT FALSE,
  specialist_report TEXT,
  specialist_recommendations TEXT,

  -- FHIR Mapping
  fhir_service_request_id UUID,
  fhir_task_id UUID,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- Patient-Reported Dental Health (for WellFit Community self-tracking)
CREATE TABLE public.patient_dental_health_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Self-Reported Data
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Symptoms
  tooth_pain BOOLEAN DEFAULT FALSE,
  tooth_pain_severity INTEGER CHECK (tooth_pain_severity >= 0 AND tooth_pain_severity <= 10),
  gum_bleeding BOOLEAN DEFAULT FALSE,
  dry_mouth BOOLEAN DEFAULT FALSE,
  bad_breath BOOLEAN DEFAULT FALSE,
  sensitive_teeth BOOLEAN DEFAULT FALSE,
  jaw_pain BOOLEAN DEFAULT FALSE,

  -- Hygiene Habits
  brushed_today BOOLEAN,
  flossed_today BOOLEAN,
  used_mouthwash BOOLEAN,

  -- Dietary Impact
  difficulty_chewing BOOLEAN DEFAULT FALSE,
  avoided_foods_due_to_teeth BOOLEAN DEFAULT FALSE,
  foods_avoided TEXT[],

  -- Quality of Life Impact
  self_consciousness_about_smile BOOLEAN DEFAULT FALSE,
  dental_health_affects_nutrition BOOLEAN DEFAULT FALSE,
  dental_health_affects_social_life BOOLEAN DEFAULT FALSE,

  -- Last Professional Care
  last_dentist_visit_date DATE,
  months_since_last_cleaning INTEGER,

  -- Notes
  additional_concerns TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. INDEXES FOR PERFORMANCE
-- =====================================================

-- Dental Assessments Indexes
CREATE INDEX idx_dental_assessments_patient_id ON public.dental_assessments(patient_id);
CREATE INDEX idx_dental_assessments_provider_id ON public.dental_assessments(provider_id);
CREATE INDEX idx_dental_assessments_visit_date ON public.dental_assessments(visit_date DESC);
CREATE INDEX idx_dental_assessments_status ON public.dental_assessments(status);
CREATE INDEX idx_dental_assessments_patient_status ON public.dental_assessments(patient_id, status);

-- Tooth Chart Indexes
CREATE INDEX idx_tooth_chart_patient_id ON public.dental_tooth_chart(patient_id);
CREATE INDEX idx_tooth_chart_assessment_id ON public.dental_tooth_chart(assessment_id);
CREATE INDEX idx_tooth_chart_tooth_number ON public.dental_tooth_chart(tooth_number);

-- Dental Procedures Indexes
CREATE INDEX idx_dental_procedures_patient_id ON public.dental_procedures(patient_id);
CREATE INDEX idx_dental_procedures_provider_id ON public.dental_procedures(provider_id);
CREATE INDEX idx_dental_procedures_date ON public.dental_procedures(procedure_date DESC);
CREATE INDEX idx_dental_procedures_cdt_code ON public.dental_procedures(cdt_code);
CREATE INDEX idx_dental_procedures_status ON public.dental_procedures(procedure_status);

-- Treatment Plans Indexes
CREATE INDEX idx_treatment_plans_patient_id ON public.dental_treatment_plans(patient_id);
CREATE INDEX idx_treatment_plans_status ON public.dental_treatment_plans(status);
CREATE INDEX idx_treatment_plans_date ON public.dental_treatment_plans(plan_date DESC);

-- Dental Observations Indexes
CREATE INDEX idx_dental_observations_patient_id ON public.dental_observations(patient_id);
CREATE INDEX idx_dental_observations_assessment_id ON public.dental_observations(assessment_id);
CREATE INDEX idx_dental_observations_code ON public.dental_observations(observation_code);
CREATE INDEX idx_dental_observations_date ON public.dental_observations(observation_date DESC);

-- Dental Imaging Indexes
CREATE INDEX idx_dental_imaging_patient_id ON public.dental_imaging(patient_id);
CREATE INDEX idx_dental_imaging_assessment_id ON public.dental_imaging(assessment_id);
CREATE INDEX idx_dental_imaging_date ON public.dental_imaging(image_date DESC);
CREATE INDEX idx_dental_imaging_type ON public.dental_imaging(image_type);

-- Dental Referrals Indexes
CREATE INDEX idx_dental_referrals_patient_id ON public.dental_referrals(patient_id);
CREATE INDEX idx_dental_referrals_status ON public.dental_referrals(status);
CREATE INDEX idx_dental_referrals_specialty ON public.dental_referrals(specialty_needed);

-- Patient Tracking Indexes
CREATE INDEX idx_patient_dental_tracking_patient_id ON public.patient_dental_health_tracking(patient_id);
CREATE INDEX idx_patient_dental_tracking_date ON public.patient_dental_health_tracking(report_date DESC);

-- =====================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.dental_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dental_tooth_chart ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dental_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dental_treatment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dental_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dental_imaging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dental_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_dental_health_tracking ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is a dental provider
CREATE OR REPLACE FUNCTION public.is_dental_provider(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id
    AND role IN ('dentist', 'dental_hygienist', 'orthodontist', 'periodontist',
                 'endodontist', 'oral_surgeon', 'prosthodontist', 'pediatric_dentist',
                 'physician', 'nurse_practitioner', 'physician_assistant', 'nurse')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dental Assessments RLS Policies
CREATE POLICY "dental_assessments_select" ON public.dental_assessments
  FOR SELECT
  USING (
    patient_id = auth.uid()
    OR provider_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.is_dental_provider(auth.uid())
  );

CREATE POLICY "dental_assessments_insert" ON public.dental_assessments
  FOR INSERT
  WITH CHECK (
    public.is_dental_provider(auth.uid())
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "dental_assessments_update" ON public.dental_assessments
  FOR UPDATE
  USING (
    provider_id = auth.uid()
    OR created_by = auth.uid()
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    provider_id = auth.uid()
    OR created_by = auth.uid()
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "dental_assessments_delete" ON public.dental_assessments
  FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Tooth Chart RLS Policies
CREATE POLICY "tooth_chart_select" ON public.dental_tooth_chart
  FOR SELECT
  USING (
    patient_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.is_dental_provider(auth.uid())
  );

CREATE POLICY "tooth_chart_insert" ON public.dental_tooth_chart
  FOR INSERT
  WITH CHECK (
    public.is_dental_provider(auth.uid())
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "tooth_chart_update" ON public.dental_tooth_chart
  FOR UPDATE
  USING (
    public.is_dental_provider(auth.uid())
    OR public.is_admin(auth.uid())
  );

-- Dental Procedures RLS Policies
CREATE POLICY "dental_procedures_select" ON public.dental_procedures
  FOR SELECT
  USING (
    patient_id = auth.uid()
    OR provider_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.is_dental_provider(auth.uid())
  );

CREATE POLICY "dental_procedures_insert" ON public.dental_procedures
  FOR INSERT
  WITH CHECK (
    public.is_dental_provider(auth.uid())
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "dental_procedures_update" ON public.dental_procedures
  FOR UPDATE
  USING (
    provider_id = auth.uid()
    OR created_by = auth.uid()
    OR public.is_admin(auth.uid())
  );

-- Treatment Plans RLS Policies
CREATE POLICY "treatment_plans_select" ON public.dental_treatment_plans
  FOR SELECT
  USING (
    patient_id = auth.uid()
    OR provider_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.is_dental_provider(auth.uid())
  );

CREATE POLICY "treatment_plans_insert" ON public.dental_treatment_plans
  FOR INSERT
  WITH CHECK (
    public.is_dental_provider(auth.uid())
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "treatment_plans_update" ON public.dental_treatment_plans
  FOR UPDATE
  USING (
    provider_id = auth.uid()
    OR created_by = auth.uid()
    OR public.is_admin(auth.uid())
  );

-- Dental Observations RLS Policies
CREATE POLICY "dental_observations_select" ON public.dental_observations
  FOR SELECT
  USING (
    patient_id = auth.uid()
    OR observed_by = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.is_dental_provider(auth.uid())
  );

CREATE POLICY "dental_observations_insert" ON public.dental_observations
  FOR INSERT
  WITH CHECK (
    public.is_dental_provider(auth.uid())
    OR public.is_admin(auth.uid())
  );

-- Dental Imaging RLS Policies
CREATE POLICY "dental_imaging_select" ON public.dental_imaging
  FOR SELECT
  USING (
    patient_id = auth.uid()
    OR created_by = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.is_dental_provider(auth.uid())
  );

CREATE POLICY "dental_imaging_insert" ON public.dental_imaging
  FOR INSERT
  WITH CHECK (
    public.is_dental_provider(auth.uid())
    OR public.is_admin(auth.uid())
  );

-- Dental Referrals RLS Policies
CREATE POLICY "dental_referrals_select" ON public.dental_referrals
  FOR SELECT
  USING (
    patient_id = auth.uid()
    OR referring_provider_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.is_dental_provider(auth.uid())
  );

CREATE POLICY "dental_referrals_insert" ON public.dental_referrals
  FOR INSERT
  WITH CHECK (
    public.is_dental_provider(auth.uid())
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "dental_referrals_update" ON public.dental_referrals
  FOR UPDATE
  USING (
    referring_provider_id = auth.uid()
    OR public.is_admin(auth.uid())
  );

-- Patient Tracking RLS Policies (patients can only manage their own data)
CREATE POLICY "patient_dental_tracking_select" ON public.patient_dental_health_tracking
  FOR SELECT
  USING (
    patient_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.is_dental_provider(auth.uid())
  );

CREATE POLICY "patient_dental_tracking_insert" ON public.patient_dental_health_tracking
  FOR INSERT
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "patient_dental_tracking_update" ON public.patient_dental_health_tracking
  FOR UPDATE
  USING (patient_id = auth.uid())
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "patient_dental_tracking_delete" ON public.patient_dental_health_tracking
  FOR DELETE
  USING (patient_id = auth.uid());

-- =====================================================
-- 5. TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dental_assessments_updated_at
  BEFORE UPDATE ON public.dental_assessments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dental_tooth_chart_updated_at
  BEFORE UPDATE ON public.dental_tooth_chart
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dental_procedures_updated_at
  BEFORE UPDATE ON public.dental_procedures
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dental_treatment_plans_updated_at
  BEFORE UPDATE ON public.dental_treatment_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dental_referrals_updated_at
  BEFORE UPDATE ON public.dental_referrals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. SAMPLE REFERENCE DATA - CDT CODES
-- =====================================================

-- Table for CDT code reference (for billing and documentation)
CREATE TABLE public.dental_cdt_codes (
  code VARCHAR(10) PRIMARY KEY,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  typical_fee_range_low DECIMAL(10,2),
  typical_fee_range_high DECIMAL(10,2),
  medicare_covered BOOLEAN DEFAULT FALSE,
  medicaid_covered BOOLEAN DEFAULT FALSE,
  preventive BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  effective_date DATE,
  termination_date DATE,
  notes TEXT
);

-- Insert common CDT codes (sample)
INSERT INTO public.dental_cdt_codes (code, category, description, typical_fee_range_low, typical_fee_range_high, preventive) VALUES
('D0120', 'Diagnostic', 'Periodic oral evaluation', 50.00, 100.00, TRUE),
('D0140', 'Diagnostic', 'Limited oral evaluation - problem focused', 50.00, 100.00, TRUE),
('D0150', 'Diagnostic', 'Comprehensive oral evaluation', 75.00, 150.00, TRUE),
('D0210', 'Diagnostic', 'Intraoral - complete series of radiographic images', 100.00, 200.00, TRUE),
('D0220', 'Diagnostic', 'Intraoral - periapical first radiographic image', 25.00, 50.00, TRUE),
('D0230', 'Diagnostic', 'Intraoral - periapical each additional radiographic image', 15.00, 30.00, TRUE),
('D0330', 'Diagnostic', 'Panoramic radiographic image', 75.00, 150.00, TRUE),
('D1110', 'Preventive', 'Prophylaxis - adult', 75.00, 150.00, TRUE),
('D1120', 'Preventive', 'Prophylaxis - child', 50.00, 100.00, TRUE),
('D1206', 'Preventive', 'Topical application of fluoride varnish', 25.00, 50.00, TRUE),
('D1208', 'Preventive', 'Topical application of fluoride - excluding varnish', 25.00, 50.00, TRUE),
('D1351', 'Preventive', 'Sealant - per tooth', 30.00, 60.00, TRUE),
('D2140', 'Restorative', 'Amalgam - one surface, primary or permanent', 100.00, 200.00, FALSE),
('D2150', 'Restorative', 'Amalgam - two surfaces, primary or permanent', 125.00, 250.00, FALSE),
('D2330', 'Restorative', 'Resin-based composite - one surface, anterior', 100.00, 200.00, FALSE),
('D2391', 'Restorative', 'Resin-based composite - one surface, posterior', 125.00, 250.00, FALSE),
('D2740', 'Restorative', 'Crown - porcelain/ceramic substrate', 800.00, 1500.00, FALSE),
('D2750', 'Restorative', 'Crown - porcelain fused to high noble metal', 900.00, 1600.00, FALSE),
('D3310', 'Endodontics', 'Endodontic therapy, anterior tooth', 500.00, 900.00, FALSE),
('D3320', 'Endodontics', 'Endodontic therapy, premolar tooth', 600.00, 1000.00, FALSE),
('D3330', 'Endodontics', 'Endodontic therapy, molar tooth', 700.00, 1200.00, FALSE),
('D4210', 'Periodontics', 'Gingivectomy or gingivoplasty - four or more contiguous teeth', 300.00, 600.00, FALSE),
('D4341', 'Periodontics', 'Periodontal scaling and root planing - four or more teeth per quadrant', 150.00, 300.00, FALSE),
('D5110', 'Prosthodontics', 'Complete denture - upper', 1000.00, 2000.00, FALSE),
('D5120', 'Prosthodontics', 'Complete denture - lower', 1000.00, 2000.00, FALSE),
('D5213', 'Prosthodontics', 'Partial denture - upper - flexible base', 1200.00, 2200.00, FALSE),
('D6010', 'Implant Services', 'Surgical placement of implant body: endosteal implant', 1500.00, 2500.00, FALSE),
('D7140', 'Oral Surgery', 'Extraction, erupted tooth or exposed root', 75.00, 200.00, FALSE),
('D7210', 'Oral Surgery', 'Extraction, erupted tooth requiring removal of bone', 150.00, 350.00, FALSE),
('D7240', 'Oral Surgery', 'Removal of impacted tooth - completely bony', 300.00, 600.00, FALSE),
('D9310', 'Adjunctive Services', 'Consultation - diagnostic service', 50.00, 150.00, FALSE),
('D9430', 'Adjunctive Services', 'Office visit for observation - no other services performed', 30.00, 75.00, FALSE);

-- =====================================================
-- 7. VIEWS FOR COMMON QUERIES
-- =====================================================
-- NOTE: Views commented out pending profiles table schema verification
-- These views reference p.full_name and p.date_of_birth which may not exist in profiles table
-- Uncomment and update after verifying correct column names

/*
-- View: Patient Dental Health Summary
CREATE OR REPLACE VIEW public.patient_dental_health_summary AS
SELECT
  p.id AS patient_id,
  p.full_name,
  p.date_of_birth,
  da.id AS latest_assessment_id,
  da.visit_date AS last_visit_date,
  da.periodontal_status,
  da.overall_oral_health_rating,
  da.next_appointment_recommended_in_months,
  COUNT(DISTINCT dp.id) AS total_procedures_count,
  MAX(dp.procedure_date) AS last_procedure_date,
  COUNT(DISTINCT CASE WHEN dr.status = 'pending' THEN dr.id END) AS pending_referrals_count,
  COUNT(DISTINCT dtp.id) AS active_treatment_plans_count
FROM public.profiles p
LEFT JOIN LATERAL (
  SELECT * FROM public.dental_assessments
  WHERE patient_id = p.id
  ORDER BY visit_date DESC
  LIMIT 1
) da ON TRUE
LEFT JOIN public.dental_procedures dp ON p.id = dp.patient_id
LEFT JOIN public.dental_referrals dr ON p.id = dr.patient_id
LEFT JOIN public.dental_treatment_plans dtp ON p.id = dtp.patient_id AND dtp.status IN ('proposed', 'approved', 'in_progress')
GROUP BY p.id, p.full_name, p.date_of_birth, da.id, da.visit_date,
         da.periodontal_status, da.overall_oral_health_rating,
         da.next_appointment_recommended_in_months;

-- View: Dental Procedures with CDT Code Details
CREATE OR REPLACE VIEW public.dental_procedures_with_codes AS
SELECT
  dp.*,
  cdt.category AS cdt_category,
  cdt.description AS cdt_description,
  cdt.preventive AS is_preventive,
  p.full_name AS patient_name,
  prov.full_name AS provider_name
FROM public.dental_procedures dp
LEFT JOIN public.dental_cdt_codes cdt ON dp.cdt_code = cdt.code
LEFT JOIN public.profiles p ON dp.patient_id = p.id
LEFT JOIN public.profiles prov ON dp.provider_id = prov.id;
*/

-- =====================================================
-- 8. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.dental_assessments IS 'Comprehensive dental clinical assessments and examinations';
COMMENT ON TABLE public.dental_tooth_chart IS 'Individual tooth-level tracking with periodontal measurements';
COMMENT ON TABLE public.dental_procedures IS 'Dental treatment procedures with CDT coding for billing';
COMMENT ON TABLE public.dental_treatment_plans IS 'Multi-phase treatment plans with cost estimates';
COMMENT ON TABLE public.dental_observations IS 'FHIR-compliant dental observations and measurements';
COMMENT ON TABLE public.dental_imaging IS 'Dental X-rays, photos, and diagnostic imaging';
COMMENT ON TABLE public.dental_referrals IS 'Specialist referrals for advanced dental care';
COMMENT ON TABLE public.patient_dental_health_tracking IS 'Patient self-reported dental health data for WellFit Community';

COMMENT ON COLUMN public.dental_tooth_chart.tooth_number IS 'Universal Numbering System: 1-32 for permanent teeth, 51-82 for primary teeth (ISO 3950)';
COMMENT ON COLUMN public.dental_procedures.cdt_code IS 'Current Dental Terminology code for billing and documentation';
COMMENT ON COLUMN public.dental_procedures.snomed_code IS 'SNOMED CT code for clinical interoperability and FHIR mapping';

-- =====================================================
-- END OF DENTAL HEALTH MODULE MIGRATION
-- =====================================================
