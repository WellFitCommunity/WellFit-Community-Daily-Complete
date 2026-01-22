-- =====================================================
-- Public Health Reporting Infrastructure
-- ONC Criteria: 170.315(f)(1), (f)(2), (f)(3), (f)(4)
--
-- Modules:
--   1. Syndromic Surveillance (f)(2)
--   2. Immunization Registry - IIS (f)(1)
--   3. Electronic Case Reporting - eCR (f)(3)
--   4. Antimicrobial Use/Resistance - AU/AR (f)(4)
--
-- Target Market: Texas (DSHS, ImmTrac2)
-- =====================================================

-- =====================================================
-- MODULE 1: SYNDROMIC SURVEILLANCE
-- ONC 170.315(f)(2) - Transmission to public health
-- agencies of syndromic surveillance data
-- =====================================================

-- Encounters flagged for syndromic surveillance
CREATE TABLE IF NOT EXISTS syndromic_surveillance_encounters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    encounter_id UUID NOT NULL,
    patient_id UUID NOT NULL REFERENCES auth.users(id),

    -- Encounter details
    encounter_date TIMESTAMPTZ NOT NULL,
    encounter_type VARCHAR(50) NOT NULL, -- ED, Urgent Care, Ambulatory
    facility_id UUID,

    -- Chief complaint / reason for visit
    chief_complaint TEXT,
    chief_complaint_code VARCHAR(20), -- ICD-10 or SNOMED
    chief_complaint_code_system VARCHAR(50),

    -- Diagnosis
    diagnosis_codes TEXT[], -- Array of ICD-10 codes
    diagnosis_descriptions TEXT[],

    -- Patient disposition
    disposition_code VARCHAR(20),
    disposition_description VARCHAR(255),

    -- Surveillance flags
    is_reportable BOOLEAN DEFAULT false,
    surveillance_category VARCHAR(100), -- Respiratory, GI, Fever, etc.

    -- Processing status
    status VARCHAR(50) DEFAULT 'pending', -- pending, transmitted, failed, excluded
    transmission_id UUID,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id, encounter_id)
);

-- Syndromic surveillance transmission history
CREATE TABLE IF NOT EXISTS syndromic_surveillance_transmissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,

    -- Destination
    destination_agency VARCHAR(100) NOT NULL, -- TX_DSHS, CDC_ESSENCE, etc.
    destination_endpoint VARCHAR(500),

    -- Message details
    message_type VARCHAR(20) NOT NULL, -- ADT_A01, ADT_A03, ADT_A04, ADT_A08
    message_control_id VARCHAR(50) NOT NULL,
    hl7_version VARCHAR(10) DEFAULT '2.5.1',

    -- Content
    hl7_message TEXT NOT NULL,
    encounter_count INTEGER DEFAULT 1,
    encounter_ids UUID[],

    -- Transmission status
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, acknowledged, rejected, error
    sent_at TIMESTAMPTZ,
    acknowledgment_received_at TIMESTAMPTZ,
    acknowledgment_code VARCHAR(20), -- AA, AE, AR
    acknowledgment_message TEXT,

    -- Error handling
    error_code VARCHAR(50),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for syndromic surveillance queries
CREATE INDEX IF NOT EXISTS idx_ss_encounters_tenant_date
    ON syndromic_surveillance_encounters(tenant_id, encounter_date);
CREATE INDEX IF NOT EXISTS idx_ss_encounters_status
    ON syndromic_surveillance_encounters(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ss_transmissions_tenant_status
    ON syndromic_surveillance_transmissions(tenant_id, status);

-- =====================================================
-- MODULE 2: IMMUNIZATION REGISTRY (IIS)
-- ONC 170.315(f)(1) - Transmission to immunization
-- registries
-- =====================================================

-- Immunization registry submissions (VXU messages)
CREATE TABLE IF NOT EXISTS immunization_registry_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,

    -- Patient
    patient_id UUID NOT NULL REFERENCES auth.users(id),

    -- Immunization details
    immunization_id UUID NOT NULL,
    vaccine_cvx_code VARCHAR(10) NOT NULL,
    vaccine_name VARCHAR(255),
    administration_date DATE NOT NULL,
    lot_number VARCHAR(50),
    expiration_date DATE,
    manufacturer_mvx_code VARCHAR(10),

    -- Administration details
    administered_by_npi VARCHAR(10),
    administration_site VARCHAR(50), -- LA (left arm), RA, etc.
    administration_route VARCHAR(50), -- IM, SC, ID, etc.
    dose_number INTEGER,
    series_name VARCHAR(100),

    -- Registry destination
    registry_name VARCHAR(100) NOT NULL, -- TX_IMMTRAC2, etc.
    registry_endpoint VARCHAR(500),

    -- HL7 message
    message_type VARCHAR(20) DEFAULT 'VXU_V04',
    message_control_id VARCHAR(50) NOT NULL,
    hl7_message TEXT NOT NULL,

    -- Submission status
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, accepted, rejected, error
    sent_at TIMESTAMPTZ,
    response_received_at TIMESTAMPTZ,
    response_code VARCHAR(20), -- AA, AE, AR
    response_message TEXT,

    -- Query/response for forecast (if supported)
    forecast_requested BOOLEAN DEFAULT false,
    forecast_response TEXT,

    -- Error handling
    error_code VARCHAR(50),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for immunization registry queries
CREATE INDEX IF NOT EXISTS idx_imm_registry_tenant_patient
    ON immunization_registry_submissions(tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_imm_registry_status
    ON immunization_registry_submissions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_imm_registry_date
    ON immunization_registry_submissions(tenant_id, administration_date);

-- =====================================================
-- MODULE 3: ELECTRONIC CASE REPORTING (eCR)
-- ONC 170.315(f)(3) - Transmission to public health
-- agencies of reportable condition data
-- =====================================================

-- Reportable conditions reference table (CDC/State trigger codes)
CREATE TABLE IF NOT EXISTS reportable_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Condition identification
    condition_code VARCHAR(20) NOT NULL, -- SNOMED or ICD-10
    condition_code_system VARCHAR(50) NOT NULL,
    condition_name VARCHAR(255) NOT NULL,

    -- RCKMS (Reportable Condition Knowledge Management System) data
    rckms_oid VARCHAR(100), -- OID from RCKMS

    -- Reporting requirements
    reporting_jurisdiction VARCHAR(10)[], -- States that require reporting
    reporting_timeframe VARCHAR(50), -- immediate, 24h, 72h, 7d
    is_nationally_notifiable BOOLEAN DEFAULT false,

    -- Trigger criteria
    trigger_codes TEXT[], -- Lab LOINC codes, diagnosis codes that trigger
    trigger_description TEXT,

    -- Category
    condition_category VARCHAR(100), -- Infectious, STI, Foodborne, etc.

    -- Status
    is_active BOOLEAN DEFAULT true,
    effective_date DATE,
    end_date DATE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(condition_code, condition_code_system)
);

-- Electronic case reports
CREATE TABLE IF NOT EXISTS electronic_case_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,

    -- Patient
    patient_id UUID NOT NULL REFERENCES auth.users(id),

    -- Triggering event
    trigger_encounter_id UUID,
    trigger_condition_id UUID REFERENCES reportable_conditions(id),
    trigger_type VARCHAR(50), -- diagnosis, lab_result, provider_reported
    trigger_code VARCHAR(20),
    trigger_description TEXT,
    trigger_date TIMESTAMPTZ NOT NULL,

    -- Report details
    report_type VARCHAR(50) DEFAULT 'initial', -- initial, update, cancel
    eicr_document_id VARCHAR(100), -- CDA document ID
    eicr_version VARCHAR(20) DEFAULT '3.1',

    -- CDA document
    eicr_document TEXT, -- Full eICR CDA XML

    -- Submission details
    destination VARCHAR(100) DEFAULT 'AIMS', -- AIMS, direct to state
    aims_transaction_id VARCHAR(100),

    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, submitted, accepted, rejected, rr_received
    submitted_at TIMESTAMPTZ,

    -- Reportability Response (RR)
    rr_received_at TIMESTAMPTZ,
    rr_document TEXT, -- RR CDA document
    rr_determination VARCHAR(50), -- reportable, may_be_reportable, not_reportable, no_rule
    rr_routing_entities TEXT[], -- Where the report was routed

    -- Error handling
    error_code VARCHAR(50),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for eCR queries
CREATE INDEX IF NOT EXISTS idx_ecr_tenant_patient
    ON electronic_case_reports(tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_ecr_status
    ON electronic_case_reports(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ecr_trigger_date
    ON electronic_case_reports(tenant_id, trigger_date);
CREATE INDEX IF NOT EXISTS idx_reportable_conditions_code
    ON reportable_conditions(condition_code);

-- =====================================================
-- MODULE 4: ANTIMICROBIAL USE & RESISTANCE (AU/AR)
-- ONC 170.315(f)(4) - Transmission of antimicrobial
-- use and resistance data to public health agencies
-- =====================================================

-- Antimicrobial usage tracking
CREATE TABLE IF NOT EXISTS antimicrobial_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,

    -- Patient
    patient_id UUID NOT NULL REFERENCES auth.users(id),
    encounter_id UUID,

    -- Prescription details
    medication_code VARCHAR(20) NOT NULL, -- RxNorm or NDC
    medication_code_system VARCHAR(50) NOT NULL,
    medication_name VARCHAR(255) NOT NULL,

    -- Antimicrobial classification
    antimicrobial_class VARCHAR(100), -- Penicillins, Cephalosporins, Fluoroquinolones, etc.
    antimicrobial_subclass VARCHAR(100),

    -- Dosing
    dose_quantity DECIMAL(10,3),
    dose_unit VARCHAR(20),
    route VARCHAR(50), -- PO, IV, IM, etc.
    frequency VARCHAR(50),
    duration_days INTEGER,

    -- Indication
    indication_code VARCHAR(20),
    indication_description TEXT,

    -- Prescriber
    prescriber_npi VARCHAR(10),

    -- Dates
    prescribed_date DATE NOT NULL,
    start_date DATE,
    end_date DATE,

    -- Therapy type
    therapy_type VARCHAR(50), -- empiric, targeted, prophylaxis

    -- NHSN reporting
    included_in_nhsn_report BOOLEAN DEFAULT false,
    nhsn_submission_id UUID,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Antimicrobial resistance data (from microbiology labs)
CREATE TABLE IF NOT EXISTS antimicrobial_resistance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,

    -- Patient
    patient_id UUID NOT NULL REFERENCES auth.users(id),
    encounter_id UUID,

    -- Specimen
    specimen_id VARCHAR(100),
    specimen_type VARCHAR(100), -- Blood, Urine, Sputum, etc.
    specimen_collection_date TIMESTAMPTZ NOT NULL,
    specimen_source VARCHAR(100), -- Body site

    -- Organism
    organism_code VARCHAR(20) NOT NULL, -- SNOMED
    organism_code_system VARCHAR(50) DEFAULT 'SNOMED-CT',
    organism_name VARCHAR(255) NOT NULL,

    -- Resistance pattern
    antimicrobial_tested VARCHAR(100) NOT NULL,
    antimicrobial_code VARCHAR(20),
    interpretation VARCHAR(20) NOT NULL, -- S (susceptible), I (intermediate), R (resistant)
    mic_value DECIMAL(10,4), -- Minimum Inhibitory Concentration
    mic_unit VARCHAR(20),

    -- Special resistance patterns
    is_mdro BOOLEAN DEFAULT false, -- Multi-drug resistant organism
    mdro_type VARCHAR(100), -- MRSA, VRE, CRE, ESBL, etc.

    -- Lab details
    lab_name VARCHAR(255),
    lab_npi VARCHAR(10),
    result_date DATE,

    -- NHSN reporting
    included_in_nhsn_report BOOLEAN DEFAULT false,
    nhsn_submission_id UUID,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NHSN submissions
CREATE TABLE IF NOT EXISTS nhsn_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,

    -- Submission details
    submission_type VARCHAR(50) NOT NULL, -- AU (antimicrobial use), AR (resistance)
    reporting_period_start DATE NOT NULL,
    reporting_period_end DATE NOT NULL,

    -- Facility
    facility_id UUID,
    nhsn_org_id VARCHAR(50), -- NHSN Organization ID
    nhsn_facility_id VARCHAR(50), -- NHSN Facility ID

    -- CDA document
    document_type VARCHAR(50) DEFAULT 'CDA', -- CDA or FHIR
    cda_document TEXT,

    -- Record counts
    usage_record_count INTEGER DEFAULT 0,
    resistance_record_count INTEGER DEFAULT 0,

    -- Submission status
    status VARCHAR(50) DEFAULT 'pending', -- pending, submitted, accepted, rejected, error
    submitted_at TIMESTAMPTZ,
    submission_method VARCHAR(50), -- direct_upload, api, sftp

    -- Response
    nhsn_submission_id VARCHAR(100),
    response_received_at TIMESTAMPTZ,
    response_status VARCHAR(50),
    response_message TEXT,

    -- Error handling
    error_code VARCHAR(50),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for antimicrobial queries
CREATE INDEX IF NOT EXISTS idx_am_usage_tenant_patient
    ON antimicrobial_usage(tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_am_usage_date
    ON antimicrobial_usage(tenant_id, prescribed_date);
CREATE INDEX IF NOT EXISTS idx_am_resistance_tenant_patient
    ON antimicrobial_resistance(tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_am_resistance_organism
    ON antimicrobial_resistance(tenant_id, organism_code);
CREATE INDEX IF NOT EXISTS idx_nhsn_submissions_tenant
    ON nhsn_submissions(tenant_id, status);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE syndromic_surveillance_encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE syndromic_surveillance_transmissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE immunization_registry_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reportable_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE electronic_case_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE antimicrobial_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE antimicrobial_resistance ENABLE ROW LEVEL SECURITY;
ALTER TABLE nhsn_submissions ENABLE ROW LEVEL SECURITY;

-- Syndromic Surveillance policies
CREATE POLICY syndromic_encounters_tenant_isolation ON syndromic_surveillance_encounters
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY syndromic_transmissions_tenant_isolation ON syndromic_surveillance_transmissions
    FOR ALL USING (tenant_id = get_current_tenant_id());

-- Immunization Registry policies
CREATE POLICY imm_registry_tenant_isolation ON immunization_registry_submissions
    FOR ALL USING (tenant_id = get_current_tenant_id());

-- Reportable Conditions is a reference table - allow read access
CREATE POLICY reportable_conditions_read_all ON reportable_conditions
    FOR SELECT USING (true);

-- eCR policies
CREATE POLICY ecr_tenant_isolation ON electronic_case_reports
    FOR ALL USING (tenant_id = get_current_tenant_id());

-- Antimicrobial policies
CREATE POLICY am_usage_tenant_isolation ON antimicrobial_usage
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY am_resistance_tenant_isolation ON antimicrobial_resistance
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY nhsn_submissions_tenant_isolation ON nhsn_submissions
    FOR ALL USING (tenant_id = get_current_tenant_id());

-- =====================================================
-- SEED DATA: Common Reportable Conditions (Texas Focus)
-- =====================================================

INSERT INTO reportable_conditions (
    condition_code, condition_code_system, condition_name,
    reporting_jurisdiction, reporting_timeframe, is_nationally_notifiable,
    condition_category, trigger_codes
) VALUES
-- Immediately Reportable (Texas)
('27836007', 'SNOMED-CT', 'Pertussis (Whooping Cough)',
 ARRAY['TX', 'ALL'], 'immediate', true, 'Vaccine-Preventable',
 ARRAY['27836007', 'A37.0', 'A37.1', 'A37.8', 'A37.9']),

('76902006', 'SNOMED-CT', 'Tetanus',
 ARRAY['TX', 'ALL'], 'immediate', true, 'Vaccine-Preventable',
 ARRAY['76902006', 'A34', 'A35']),

('14189004', 'SNOMED-CT', 'Measles',
 ARRAY['TX', 'ALL'], 'immediate', true, 'Vaccine-Preventable',
 ARRAY['14189004', 'B05.0', 'B05.1', 'B05.2', 'B05.3', 'B05.4', 'B05.8', 'B05.9']),

('36989005', 'SNOMED-CT', 'Mumps',
 ARRAY['TX', 'ALL'], 'immediate', true, 'Vaccine-Preventable',
 ARRAY['36989005', 'B26.0', 'B26.1', 'B26.2', 'B26.3', 'B26.8', 'B26.9']),

('36653000', 'SNOMED-CT', 'Rubella',
 ARRAY['TX', 'ALL'], 'immediate', true, 'Vaccine-Preventable',
 ARRAY['36653000', 'B06.0', 'B06.8', 'B06.9']),

('398102009', 'SNOMED-CT', 'Acute Flaccid Myelitis',
 ARRAY['TX', 'ALL'], 'immediate', true, 'Neurological',
 ARRAY['398102009', 'G04.82']),

('409498004', 'SNOMED-CT', 'Anthrax',
 ARRAY['TX', 'ALL'], 'immediate', true, 'Bioterrorism',
 ARRAY['409498004', 'A22.0', 'A22.1', 'A22.2', 'A22.7', 'A22.8', 'A22.9']),

('75702008', 'SNOMED-CT', 'Brucellosis',
 ARRAY['TX', 'ALL'], '24h', true, 'Zoonotic',
 ARRAY['75702008', 'A23.0', 'A23.1', 'A23.2', 'A23.3', 'A23.8', 'A23.9']),

('4834000', 'SNOMED-CT', 'Typhoid Fever',
 ARRAY['TX', 'ALL'], '24h', true, 'Foodborne',
 ARRAY['4834000', 'A01.0']),

-- STIs
('76272004', 'SNOMED-CT', 'Syphilis',
 ARRAY['TX', 'ALL'], '72h', true, 'STI',
 ARRAY['76272004', 'A50', 'A51', 'A52', 'A53']),

('15628003', 'SNOMED-CT', 'Gonorrhea',
 ARRAY['TX', 'ALL'], '72h', true, 'STI',
 ARRAY['15628003', 'A54.0', 'A54.1', 'A54.2', 'A54.3', 'A54.4', 'A54.5', 'A54.6', 'A54.8', 'A54.9']),

('240589008', 'SNOMED-CT', 'Chlamydia',
 ARRAY['TX', 'ALL'], '72h', true, 'STI',
 ARRAY['240589008', 'A55', 'A56.0', 'A56.1', 'A56.2', 'A56.3', 'A56.4', 'A56.8']),

-- Respiratory
('840539006', 'SNOMED-CT', 'COVID-19',
 ARRAY['TX', 'ALL'], '24h', true, 'Respiratory',
 ARRAY['840539006', 'U07.1', 'U07.2']),

('6142004', 'SNOMED-CT', 'Influenza (Novel)',
 ARRAY['TX', 'ALL'], 'immediate', true, 'Respiratory',
 ARRAY['6142004', 'J09', 'J10', 'J11']),

('56717001', 'SNOMED-CT', 'Tuberculosis',
 ARRAY['TX', 'ALL'], '24h', true, 'Respiratory',
 ARRAY['56717001', 'A15', 'A16', 'A17', 'A18', 'A19']),

-- Hepatitis
('66071002', 'SNOMED-CT', 'Hepatitis B (Acute)',
 ARRAY['TX', 'ALL'], '72h', true, 'Hepatitis',
 ARRAY['66071002', 'B16.0', 'B16.1', 'B16.2', 'B16.9']),

('235866006', 'SNOMED-CT', 'Hepatitis C (Acute)',
 ARRAY['TX', 'ALL'], '72h', true, 'Hepatitis',
 ARRAY['235866006', 'B17.1']),

('40468003', 'SNOMED-CT', 'Hepatitis A',
 ARRAY['TX', 'ALL'], '24h', true, 'Hepatitis',
 ARRAY['40468003', 'B15.0', 'B15.9']),

-- Foodborne/Waterborne
('302231008', 'SNOMED-CT', 'Salmonellosis',
 ARRAY['TX', 'ALL'], '72h', true, 'Foodborne',
 ARRAY['302231008', 'A02.0', 'A02.1', 'A02.2', 'A02.8', 'A02.9']),

('111838007', 'SNOMED-CT', 'Shigellosis',
 ARRAY['TX', 'ALL'], '72h', true, 'Foodborne',
 ARRAY['111838007', 'A03.0', 'A03.1', 'A03.2', 'A03.3', 'A03.8', 'A03.9']),

('398565003', 'SNOMED-CT', 'E. coli O157:H7',
 ARRAY['TX', 'ALL'], '24h', true, 'Foodborne',
 ARRAY['398565003', 'A04.3']),

-- Vector-borne (Important for Texas)
('61462000', 'SNOMED-CT', 'West Nile Virus',
 ARRAY['TX', 'ALL'], '72h', true, 'Vector-borne',
 ARRAY['61462000', 'A92.3']),

('38362002', 'SNOMED-CT', 'Dengue',
 ARRAY['TX', 'ALL'], '24h', true, 'Vector-borne',
 ARRAY['38362002', 'A90', 'A91']),

('3928002', 'SNOMED-CT', 'Zika Virus',
 ARRAY['TX', 'ALL'], '24h', true, 'Vector-borne',
 ARRAY['3928002', 'A92.5']),

('77377001', 'SNOMED-CT', 'Lyme Disease',
 ARRAY['TX', 'ALL'], '7d', true, 'Vector-borne',
 ARRAY['77377001', 'A69.2']),

-- MDROs (for AU/AR module)
('115329001', 'SNOMED-CT', 'MRSA Infection',
 ARRAY['TX', 'ALL'], '7d', false, 'MDRO',
 ARRAY['115329001', 'A49.02', 'B95.62']),

('715940005', 'SNOMED-CT', 'CRE Infection',
 ARRAY['TX', 'ALL'], '7d', false, 'MDRO',
 ARRAY['715940005', 'B96.2'])

ON CONFLICT (condition_code, condition_code_system) DO NOTHING;

-- =====================================================
-- TRIGGER FUNCTIONS
-- =====================================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_public_health_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_ss_encounters_timestamp
    BEFORE UPDATE ON syndromic_surveillance_encounters
    FOR EACH ROW EXECUTE FUNCTION update_public_health_timestamp();

CREATE TRIGGER update_ss_transmissions_timestamp
    BEFORE UPDATE ON syndromic_surveillance_transmissions
    FOR EACH ROW EXECUTE FUNCTION update_public_health_timestamp();

CREATE TRIGGER update_imm_registry_timestamp
    BEFORE UPDATE ON immunization_registry_submissions
    FOR EACH ROW EXECUTE FUNCTION update_public_health_timestamp();

CREATE TRIGGER update_ecr_timestamp
    BEFORE UPDATE ON electronic_case_reports
    FOR EACH ROW EXECUTE FUNCTION update_public_health_timestamp();

CREATE TRIGGER update_am_usage_timestamp
    BEFORE UPDATE ON antimicrobial_usage
    FOR EACH ROW EXECUTE FUNCTION update_public_health_timestamp();

CREATE TRIGGER update_am_resistance_timestamp
    BEFORE UPDATE ON antimicrobial_resistance
    FOR EACH ROW EXECUTE FUNCTION update_public_health_timestamp();

CREATE TRIGGER update_nhsn_submissions_timestamp
    BEFORE UPDATE ON nhsn_submissions
    FOR EACH ROW EXECUTE FUNCTION update_public_health_timestamp();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE syndromic_surveillance_encounters IS 'ONC 170.315(f)(2) - Encounters flagged for syndromic surveillance reporting';
COMMENT ON TABLE syndromic_surveillance_transmissions IS 'ONC 170.315(f)(2) - HL7 ADT message transmission history';
COMMENT ON TABLE immunization_registry_submissions IS 'ONC 170.315(f)(1) - HL7 VXU submissions to state immunization registries';
COMMENT ON TABLE reportable_conditions IS 'ONC 170.315(f)(3) - CDC/State reportable condition trigger codes (RCKMS)';
COMMENT ON TABLE electronic_case_reports IS 'ONC 170.315(f)(3) - eICR documents and AIMS submissions';
COMMENT ON TABLE antimicrobial_usage IS 'ONC 170.315(f)(4) - Antibiotic prescription tracking for NHSN AU';
COMMENT ON TABLE antimicrobial_resistance IS 'ONC 170.315(f)(4) - Microbiology resistance data for NHSN AR';
COMMENT ON TABLE nhsn_submissions IS 'ONC 170.315(f)(4) - NHSN CDA document submissions';
