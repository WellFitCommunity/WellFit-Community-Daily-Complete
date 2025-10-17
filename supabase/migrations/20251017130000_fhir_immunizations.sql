-- =====================================================
-- FHIR R4 Immunization Resource Implementation
-- US Core Immunization Profile Compliant
-- =====================================================
-- This migration creates a complete FHIR R4 Immunization table
-- for tracking vaccines administered to patients.
--
-- US Core Requirements:
-- - status (required)
-- - statusReason (if status != completed)
-- - vaccineCode (required - CVX codes)
-- - patient (required)
-- - occurrenceDateTime or occurrenceString (required)
-- - primarySource (required)
--
-- Common Use Cases:
-- - Flu shots, COVID-19 vaccines
-- - Pneumonia vaccines (PCV13, PPSV23)
-- - Shingles vaccine (Shingrix)
-- - Tdap boosters
-- - Import from state registries
-- - Care gap identification
-- =====================================================

-- Drop existing table if exists (for clean re-creation)
DROP TABLE IF EXISTS fhir_immunizations CASCADE;

-- Create FHIR Immunization table
CREATE TABLE fhir_immunizations (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- External System Integration
  external_id TEXT, -- ID from external EHR/registry
  external_system TEXT, -- System that provided the ID

  -- FHIR Meta
  version_id TEXT DEFAULT '1',
  last_updated TIMESTAMPTZ DEFAULT NOW(),

  -- Required Fields (US Core)
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('completed', 'entered-in-error', 'not-done')),
  vaccine_code TEXT NOT NULL, -- CVX code (e.g., '141' for Influenza)
  vaccine_display TEXT NOT NULL, -- Human readable (e.g., 'Influenza, seasonal, injectable')
  occurrence_datetime TIMESTAMPTZ, -- When vaccine was given
  primary_source BOOLEAN NOT NULL DEFAULT true, -- Was this reported by person who administered?

  -- Status Reason (required if status != completed)
  status_reason_code TEXT, -- Why vaccine was not given
  status_reason_display TEXT,

  -- Vaccine Details
  lot_number TEXT, -- Manufacturer lot number
  expiration_date DATE, -- Vaccine expiration
  manufacturer TEXT, -- Vaccine manufacturer name

  -- Administration Details
  site_code TEXT, -- Body site (e.g., 'LA' = left arm)
  site_display TEXT,
  route_code TEXT, -- Route of administration (e.g., 'IM' = intramuscular)
  route_display TEXT,
  dose_quantity_value DECIMAL, -- Amount given (e.g., 0.5)
  dose_quantity_unit TEXT, -- Unit (e.g., 'mL')

  -- Performer (who gave the vaccine)
  performer_actor_reference TEXT, -- Reference to Practitioner
  performer_actor_display TEXT, -- Practitioner name
  performer_function_code TEXT, -- Role (e.g., 'AP' = administering provider)
  performer_function_display TEXT,

  -- Location
  location_reference TEXT, -- Reference to Location resource
  location_display TEXT, -- Clinic/pharmacy name

  -- Reason for Immunization
  reason_code TEXT[], -- Clinical reasons (SNOMED codes)
  reason_display TEXT[],

  -- Reactions (adverse events)
  reaction_date TIMESTAMPTZ, -- When reaction occurred
  reaction_detail_reference TEXT, -- Reference to Observation with details
  reaction_reported BOOLEAN, -- Was reaction reported?

  -- Protocol Applied (vaccine dose number in series)
  protocol_dose_number_positive_int INTEGER, -- Which dose in series (e.g., 1, 2)
  protocol_series_doses_positive_int INTEGER, -- Total doses in series (e.g., 2)
  protocol_target_disease TEXT[], -- Diseases targeted (e.g., 'INFLUENZA')
  protocol_target_disease_display TEXT[],

  -- Funding Source
  funding_source_code TEXT, -- Who paid (e.g., 'private', 'public')
  funding_source_display TEXT,

  -- Education (patient education given)
  education_document_type TEXT, -- Type of document given
  education_reference TEXT, -- Document reference
  education_publication_date DATE, -- When document was published
  education_presentation_date TIMESTAMPTZ, -- When education was provided

  -- Notes
  note TEXT, -- Free text notes

  -- Audit Fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- =====================================================
-- Indexes for Performance
-- =====================================================

-- Primary lookup indexes
CREATE INDEX idx_fhir_immunizations_patient ON fhir_immunizations(patient_id);
CREATE INDEX idx_fhir_immunizations_status ON fhir_immunizations(status);
CREATE INDEX idx_fhir_immunizations_vaccine_code ON fhir_immunizations(vaccine_code);
CREATE INDEX idx_fhir_immunizations_occurrence ON fhir_immunizations(occurrence_datetime DESC);

-- Composite indexes for common queries
CREATE INDEX idx_fhir_immunizations_patient_status ON fhir_immunizations(patient_id, status);
CREATE INDEX idx_fhir_immunizations_patient_vaccine ON fhir_immunizations(patient_id, vaccine_code);
CREATE INDEX idx_fhir_immunizations_patient_date ON fhir_immunizations(patient_id, occurrence_datetime DESC);

-- External system integration
CREATE INDEX idx_fhir_immunizations_external ON fhir_immunizations(external_id, external_system);

-- Full text search on vaccine display
CREATE INDEX idx_fhir_immunizations_vaccine_text ON fhir_immunizations USING gin(to_tsvector('english', vaccine_display));

-- Updated timestamp for sync
CREATE INDEX idx_fhir_immunizations_updated ON fhir_immunizations(last_updated DESC);

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

ALTER TABLE fhir_immunizations ENABLE ROW LEVEL SECURITY;

-- Patients can view their own immunizations
CREATE POLICY fhir_immunizations_patient_select ON fhir_immunizations
  FOR SELECT
  USING (
    patient_id = auth.uid()
    OR
    -- Staff can view all
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('doctor', 'nurse', 'admin', 'caregiver', 'pharmacist')
    )
  );

-- Patients can insert their own immunizations (self-reported)
CREATE POLICY fhir_immunizations_patient_insert ON fhir_immunizations
  FOR INSERT
  WITH CHECK (
    patient_id = auth.uid()
    OR
    -- Staff can create for any patient
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('doctor', 'nurse', 'admin', 'pharmacist')
    )
  );

-- Staff can update immunizations
CREATE POLICY fhir_immunizations_staff_update ON fhir_immunizations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('doctor', 'nurse', 'admin', 'pharmacist')
    )
  );

-- Only admins can delete
CREATE POLICY fhir_immunizations_admin_delete ON fhir_immunizations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- =====================================================
-- Triggers
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_fhir_immunizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_updated = NOW();
  NEW.version_id = (COALESCE(OLD.version_id::INTEGER, 0) + 1)::TEXT;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fhir_immunizations_updated_at
  BEFORE UPDATE ON fhir_immunizations
  FOR EACH ROW
  EXECUTE FUNCTION update_fhir_immunizations_updated_at();

-- =====================================================
-- Helper Functions
-- =====================================================

-- Get immunization history for a patient
CREATE OR REPLACE FUNCTION get_patient_immunizations(
  p_patient_id UUID,
  p_days INTEGER DEFAULT 365
)
RETURNS TABLE (
  id UUID,
  vaccine_display TEXT,
  occurrence_datetime TIMESTAMPTZ,
  status TEXT,
  lot_number TEXT,
  performer_actor_display TEXT,
  location_display TEXT,
  dose_number INTEGER,
  series_doses INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.vaccine_display,
    i.occurrence_datetime,
    i.status,
    i.lot_number,
    i.performer_actor_display,
    i.location_display,
    i.protocol_dose_number_positive_int,
    i.protocol_series_doses_positive_int
  FROM fhir_immunizations i
  WHERE i.patient_id = p_patient_id
    AND i.status = 'completed'
    AND (p_days IS NULL OR i.occurrence_datetime >= NOW() - (p_days || ' days')::INTERVAL)
  ORDER BY i.occurrence_datetime DESC;
END;
$$ LANGUAGE plpgsql;

-- Get immunizations by vaccine type
CREATE OR REPLACE FUNCTION get_immunizations_by_vaccine(
  p_patient_id UUID,
  p_vaccine_code TEXT
)
RETURNS TABLE (
  id UUID,
  occurrence_datetime TIMESTAMPTZ,
  dose_number INTEGER,
  series_doses INTEGER,
  lot_number TEXT,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.occurrence_datetime,
    i.protocol_dose_number_positive_int,
    i.protocol_series_doses_positive_int,
    i.lot_number,
    i.status
  FROM fhir_immunizations i
  WHERE i.patient_id = p_patient_id
    AND i.vaccine_code = p_vaccine_code
    AND i.status = 'completed'
  ORDER BY i.occurrence_datetime DESC;
END;
$$ LANGUAGE plpgsql;

-- Check if patient needs specific vaccine (care gap)
CREATE OR REPLACE FUNCTION check_vaccine_due(
  p_patient_id UUID,
  p_vaccine_code TEXT,
  p_months_since_last INTEGER DEFAULT 12
)
RETURNS BOOLEAN AS $$
DECLARE
  last_vaccine_date TIMESTAMPTZ;
BEGIN
  SELECT MAX(occurrence_datetime) INTO last_vaccine_date
  FROM fhir_immunizations
  WHERE patient_id = p_patient_id
    AND vaccine_code = p_vaccine_code
    AND status = 'completed';

  -- If never vaccinated or last vaccine was more than X months ago
  RETURN (
    last_vaccine_date IS NULL
    OR
    last_vaccine_date < NOW() - (p_months_since_last || ' months')::INTERVAL
  );
END;
$$ LANGUAGE plpgsql;

-- Get vaccine gaps for patient (care opportunities)
CREATE OR REPLACE FUNCTION get_vaccine_gaps(p_patient_id UUID)
RETURNS TABLE (
  vaccine_code TEXT,
  vaccine_name TEXT,
  last_received_date TIMESTAMPTZ,
  months_since_last INTEGER,
  recommendation TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH vaccine_history AS (
    SELECT
      vaccine_code,
      vaccine_display,
      MAX(occurrence_datetime) as last_date
    FROM fhir_immunizations
    WHERE patient_id = p_patient_id
      AND status = 'completed'
    GROUP BY vaccine_code, vaccine_display
  ),
  recommended_vaccines AS (
    -- Common vaccines for seniors
    VALUES
      ('141', 'Influenza, seasonal', 12, 'Annual flu vaccine recommended'),
      ('213', 'COVID-19', 12, 'Annual COVID booster recommended'),
      ('121', 'Zoster (Shingles)', NULL, 'One-time series for adults 50+'),
      ('152', 'Pneumococcal PCV13', NULL, 'One-time vaccine'),
      ('33', 'Pneumococcal PPSV23', 60, 'Booster every 5 years'),
      ('115', 'Tdap', 120, 'Booster every 10 years')
  )
  SELECT
    rv.column1::TEXT as vaccine_code,
    rv.column2::TEXT as vaccine_name,
    vh.last_date as last_received_date,
    EXTRACT(MONTH FROM (NOW() - COALESCE(vh.last_date, '1900-01-01'::TIMESTAMPTZ)))::INTEGER as months_since_last,
    rv.column4::TEXT as recommendation
  FROM recommended_vaccines rv
  LEFT JOIN vaccine_history vh ON vh.vaccine_code = rv.column1
  WHERE
    -- Never received OR due for booster
    vh.last_date IS NULL
    OR
    (rv.column3::INTEGER IS NOT NULL AND vh.last_date < NOW() - (rv.column3::INTEGER || ' months')::INTERVAL)
  ORDER BY
    CASE
      WHEN vh.last_date IS NULL THEN 0 -- Never received first
      ELSE 1
    END,
    COALESCE(vh.last_date, '1900-01-01'::TIMESTAMPTZ) ASC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Sample Data (Optional - for testing)
-- =====================================================

-- Insert sample immunizations for testing
-- COMMENT OUT THIS SECTION FOR PRODUCTION
/*
INSERT INTO fhir_immunizations (
  patient_id,
  status,
  vaccine_code,
  vaccine_display,
  occurrence_datetime,
  primary_source,
  lot_number,
  site_code,
  site_display,
  route_code,
  route_display,
  dose_quantity_value,
  dose_quantity_unit,
  performer_actor_display,
  location_display,
  protocol_dose_number_positive_int,
  protocol_series_doses_positive_int,
  protocol_target_disease,
  protocol_target_disease_display
)
SELECT
  u.id,
  'completed',
  '141',
  'Influenza, seasonal, injectable',
  NOW() - INTERVAL '45 days',
  true,
  'LOT123456',
  'LA',
  'Left arm',
  'IM',
  'Intramuscular',
  0.5,
  'mL',
  'Dr. Sarah Johnson',
  'WellFit Community Health Center',
  1,
  1,
  ARRAY['INFLUENZA'],
  ARRAY['Influenza']
FROM auth.users u
WHERE u.id IN (SELECT id FROM auth.users LIMIT 5);
*/

-- =====================================================
-- Comments & Documentation
-- =====================================================

COMMENT ON TABLE fhir_immunizations IS 'FHIR R4 Immunization resource - tracks vaccines administered to patients. US Core compliant.';
COMMENT ON COLUMN fhir_immunizations.vaccine_code IS 'CVX code for vaccine type (CDC standard)';
COMMENT ON COLUMN fhir_immunizations.primary_source IS 'True if information came from person who administered vaccine';
COMMENT ON COLUMN fhir_immunizations.protocol_dose_number_positive_int IS 'Which dose in the series (e.g., dose 1 of 2)';
COMMENT ON COLUMN fhir_immunizations.protocol_target_disease IS 'Diseases this vaccine protects against';

-- =====================================================
-- Grant Permissions
-- =====================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON fhir_immunizations TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =====================================================
-- End of Migration
-- =====================================================
