-- ============================================================================
-- Add Hospital-Specific Columns to Profiles
-- ============================================================================
-- Purpose: Add columns needed for hospital patients that app patients don't need
-- Categories:
--   1. Hospital Administrative (admission, discharge, room)
--   2. Clinical Status (acuity, isolation, code status)
--   3. Care Team & Provider Info
--   4. Medical Equipment & Monitoring
--   5. Insurance & Billing
-- ============================================================================

-- ============================================================================
-- PART 1: HOSPITAL ADMINISTRATIVE
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS admission_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS discharge_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS expected_discharge_date DATE,
ADD COLUMN IF NOT EXISTS admission_source TEXT, -- 'ER', 'Direct Admission', 'Transfer', 'Readmission'
ADD COLUMN IF NOT EXISTS discharge_disposition TEXT, -- 'Home', 'SNF', 'Rehab', 'AMA', 'Deceased'
ADD COLUMN IF NOT EXISTS hospital_unit TEXT, -- 'ICU', 'Med/Surg', 'Tele', 'Oncology', etc.
ADD COLUMN IF NOT EXISTS bed_number TEXT,
ADD COLUMN IF NOT EXISTS attending_physician_id UUID REFERENCES profiles(user_id),
ADD COLUMN IF NOT EXISTS primary_nurse_id UUID REFERENCES profiles(user_id);

-- ============================================================================
-- PART 2: CLINICAL STATUS & ACUITY
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS acuity_level TEXT CHECK (acuity_level IN ('1-Critical', '2-High', '3-Moderate', '4-Low', '5-Stable')),
ADD COLUMN IF NOT EXISTS isolation_precautions TEXT[], -- ['Contact', 'Droplet', 'Airborne', 'Protective']
ADD COLUMN IF NOT EXISTS fall_risk_score INTEGER CHECK (fall_risk_score BETWEEN 0 AND 10),
ADD COLUMN IF NOT EXISTS pressure_injury_risk INTEGER CHECK (pressure_injury_risk BETWEEN 0 AND 10),
ADD COLUMN IF NOT EXISTS mobility_status TEXT CHECK (mobility_status IN ('Ambulatory', 'Assist x1', 'Assist x2', 'Total Lift', 'Bedbound')),
ADD COLUMN IF NOT EXISTS diet_order TEXT, -- 'NPO', 'Clear Liquid', 'Regular', 'Diabetic', 'Cardiac', 'Renal'
ADD COLUMN IF NOT EXISTS code_status TEXT CHECK (code_status IN ('Full Code', 'DNR', 'DNR/DNI', 'Comfort Care', 'AND'));

-- ============================================================================
-- PART 3: MONITORING & EQUIPMENT
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS telemetry_monitoring BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS oxygen_delivery TEXT, -- 'Room Air', 'NC 2L', 'NRB', 'BiPAP', 'Ventilator'
ADD COLUMN IF NOT EXISTS iv_access TEXT[], -- ['PIV x2', 'PICC', 'Central Line', 'Port']
ADD COLUMN IF NOT EXISTS drains_tubes TEXT[], -- ['Foley', 'NG Tube', 'Chest Tube', 'JP Drain']
ADD COLUMN IF NOT EXISTS restraints_ordered BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS special_equipment TEXT[], -- ['Air Mattress', 'Wound VAC', 'PCA Pump', 'Feeding Pump']
ADD COLUMN IF NOT EXISTS glucometer_checks TEXT; -- 'QID', 'AC/HS', 'Q6H', etc.

-- ============================================================================
-- PART 4: ALLERGIES & ALERTS
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS allergies TEXT[], -- ['Penicillin', 'Shellfish', 'Latex', 'NKDA']
ADD COLUMN IF NOT EXISTS allergy_reactions TEXT[], -- ['Anaphylaxis', 'Rash', 'GI Upset']
ADD COLUMN IF NOT EXISTS clinical_alerts TEXT[], -- ['Seizure Precautions', 'Aspiration Risk', 'Elopement Risk']
ADD COLUMN IF NOT EXISTS latex_allergy BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS infection_history TEXT[]; -- ['MRSA', 'C.diff', 'VRE', 'COVID+']

-- ============================================================================
-- PART 5: INSURANCE & FINANCIAL
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS primary_insurance TEXT,
ADD COLUMN IF NOT EXISTS insurance_id TEXT,
ADD COLUMN IF NOT EXISTS insurance_group_number TEXT,
ADD COLUMN IF NOT EXISTS secondary_insurance TEXT,
ADD COLUMN IF NOT EXISTS medicare_number TEXT,
ADD COLUMN IF NOT EXISTS medicaid_number TEXT,
ADD COLUMN IF NOT EXISTS financial_class TEXT, -- 'Commercial', 'Medicare', 'Medicaid', 'Self-Pay', 'Charity'
ADD COLUMN IF NOT EXISTS prior_auth_required BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- PART 6: ADVANCE DIRECTIVES & LEGAL
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS advance_directive_on_file BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS power_of_attorney_name TEXT,
ADD COLUMN IF NOT EXISTS power_of_attorney_phone TEXT,
ADD COLUMN IF NOT EXISTS healthcare_proxy_name TEXT,
ADD COLUMN IF NOT EXISTS healthcare_proxy_phone TEXT,
ADD COLUMN IF NOT EXISTS legal_guardian_name TEXT,
ADD COLUMN IF NOT EXISTS legal_guardian_phone TEXT,
ADD COLUMN IF NOT EXISTS consent_for_treatment BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS hipaa_authorization_signed BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- PART 7: SURGICAL & PROCEDURE
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS surgical_history TEXT[],
ADD COLUMN IF NOT EXISTS last_surgery_date DATE,
ADD COLUMN IF NOT EXISTS upcoming_procedure TEXT,
ADD COLUMN IF NOT EXISTS upcoming_procedure_date DATE,
ADD COLUMN IF NOT EXISTS post_op_day INTEGER, -- POD#1, POD#2, etc.
ADD COLUMN IF NOT EXISTS surgical_service TEXT; -- 'General Surgery', 'Ortho', 'Cardiothoracic', etc.

-- ============================================================================
-- PART 8: SOCIAL & DISCHARGE PLANNING
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS lives_alone BOOLEAN,
ADD COLUMN IF NOT EXISTS home_health_services BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dme_needs TEXT[], -- ['Walker', 'Wheelchair', 'Hospital Bed', 'Oxygen']
ADD COLUMN IF NOT EXISTS social_work_consult BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS case_management_consult BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS discharge_barriers TEXT[], -- ['No caregiver', 'Unstable housing', 'Transportation']
ADD COLUMN IF NOT EXISTS preferred_pharmacy TEXT,
ADD COLUMN IF NOT EXISTS transportation_needs TEXT; -- 'Family', 'Ambulance', 'Medical Transport', 'Taxi'

-- ============================================================================
-- PART 9: ICU-SPECIFIC (for critical patients)
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS icu_admission_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ventilator_start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sedation_protocol TEXT, -- 'Light', 'Moderate', 'Deep', 'None'
ADD COLUMN IF NOT EXISTS vasopressor_support BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cvp_monitoring BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS arterial_line_site TEXT, -- 'Radial', 'Femoral', 'Brachial'
ADD COLUMN IF NOT EXISTS swan_ganz_catheter BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS continuous_renal_replacement BOOLEAN DEFAULT FALSE, -- CRRT
ADD COLUMN IF NOT EXISTS ecmo_support BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- PART 10: METADATA & AUDIT
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_vitals_check TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_medication_admin TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_assessment_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_physician_note TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_care_plan_update TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS flag_for_review BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS review_reason TEXT;

-- ============================================================================
-- INDEXES for Common Hospital Queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_hospital_unit ON profiles(hospital_unit) WHERE enrollment_type = 'hospital';
CREATE INDEX IF NOT EXISTS idx_profiles_room_bed ON profiles(room_number, bed_number) WHERE enrollment_type = 'hospital';
CREATE INDEX IF NOT EXISTS idx_profiles_acuity ON profiles(acuity_level) WHERE enrollment_type = 'hospital';
CREATE INDEX IF NOT EXISTS idx_profiles_admission_date ON profiles(admission_date) WHERE enrollment_type = 'hospital';
CREATE INDEX IF NOT EXISTS idx_profiles_attending ON profiles(attending_physician_id) WHERE enrollment_type = 'hospital';
CREATE INDEX IF NOT EXISTS idx_profiles_primary_nurse ON profiles(primary_nurse_id) WHERE enrollment_type = 'hospital';
CREATE INDEX IF NOT EXISTS idx_profiles_code_status ON profiles(code_status) WHERE enrollment_type = 'hospital';

-- ============================================================================
-- COMMENTS for Documentation
-- ============================================================================

COMMENT ON COLUMN profiles.acuity_level IS 'Patient acuity: 1=Critical (ICU), 2=High, 3=Moderate, 4=Low, 5=Stable';
COMMENT ON COLUMN profiles.code_status IS 'Resuscitation status: Full Code, DNR (Do Not Resuscitate), DNR/DNI (Do Not Intubate), Comfort Care, AND (Allow Natural Death)';
COMMENT ON COLUMN profiles.isolation_precautions IS 'Array of isolation types: Contact, Droplet, Airborne, Protective';
COMMENT ON COLUMN profiles.fall_risk_score IS 'Fall risk assessment 0-10 (Morse Fall Scale or similar)';
COMMENT ON COLUMN profiles.mobility_status IS 'Patient mobility level for nursing care planning';
COMMENT ON COLUMN profiles.financial_class IS 'Insurance category for billing';
COMMENT ON COLUMN profiles.post_op_day IS 'Days since surgery (POD#1, POD#2, etc.) - NULL if not post-op';

-- ============================================================================
-- Verification
-- ============================================================================

-- Count new columns added
SELECT COUNT(*) as new_hospital_columns
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN (
    'admission_date', 'acuity_level', 'isolation_precautions',
    'code_status', 'telemetry_monitoring', 'allergies',
    'primary_insurance', 'advance_directive_on_file',
    'post_op_day', 'lives_alone', 'icu_admission_date'
  );
