-- =====================================================
-- Electronic Clinical Quality Measures (eCQM) System
-- ONC Criteria: 170.315(c)(1), (c)(2), (c)(3)
-- Purpose: Calculate and export clinical quality measures for CMS reporting
-- =====================================================

-- Store CMS measure definitions (updated annually by CMS)
CREATE TABLE IF NOT EXISTS ecqm_measure_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    measure_id VARCHAR(20) NOT NULL UNIQUE,
    cms_id VARCHAR(20) NOT NULL,
    version VARCHAR(10) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    measure_type VARCHAR(50) NOT NULL,
    measure_scoring VARCHAR(50) NOT NULL,

    -- Population criteria descriptions
    initial_population_description TEXT,
    denominator_description TEXT,
    denominator_exclusion_description TEXT,
    denominator_exception_description TEXT,
    numerator_description TEXT,
    numerator_exclusion_description TEXT,

    -- CQL reference
    cql_library_name VARCHAR(100),
    cql_library_version VARCHAR(20),

    -- Value sets (OIDs for terminology)
    value_sets JSONB DEFAULT '[]',

    -- Reporting period
    reporting_year INTEGER,
    reporting_period_start DATE,
    reporting_period_end DATE,

    -- Applicable settings
    applicable_settings TEXT[] DEFAULT '{}',
    clinical_focus TEXT,

    -- Metadata
    steward TEXT,
    nqf_number VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(cms_id, version)
);

-- Store patient-level calculation results
CREATE TABLE IF NOT EXISTS ecqm_patient_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    measure_id VARCHAR(20) NOT NULL,
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Reporting period
    reporting_period_start DATE NOT NULL,
    reporting_period_end DATE NOT NULL,

    -- Population membership flags
    initial_population BOOLEAN DEFAULT false,
    denominator BOOLEAN DEFAULT false,
    denominator_exclusion BOOLEAN DEFAULT false,
    denominator_exception BOOLEAN DEFAULT false,
    numerator BOOLEAN DEFAULT false,
    numerator_exclusion BOOLEAN DEFAULT false,

    -- For continuous variable measures
    measure_observation DECIMAL(10,4),

    -- Data elements that contributed to calculation
    data_elements_used JSONB DEFAULT '{}',

    -- Calculation metadata
    calculation_datetime TIMESTAMPTZ DEFAULT NOW(),
    cql_engine_version VARCHAR(20),
    calculation_duration_ms INTEGER,

    UNIQUE(tenant_id, measure_id, patient_id, reporting_period_start)
);

-- Store aggregate results for reporting
CREATE TABLE IF NOT EXISTS ecqm_aggregate_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    measure_id VARCHAR(20) NOT NULL,

    -- Reporting period
    reporting_period_start DATE NOT NULL,
    reporting_period_end DATE NOT NULL,

    -- Population counts
    initial_population_count INTEGER DEFAULT 0,
    denominator_count INTEGER DEFAULT 0,
    denominator_exclusion_count INTEGER DEFAULT 0,
    denominator_exception_count INTEGER DEFAULT 0,
    numerator_count INTEGER DEFAULT 0,
    numerator_exclusion_count INTEGER DEFAULT 0,

    -- Performance metrics
    performance_rate DECIMAL(5,4),
    performance_rate_formatted VARCHAR(10),

    -- For continuous variable measures
    measure_observation_mean DECIMAL(10,4),
    measure_observation_median DECIMAL(10,4),

    -- Calculation metadata
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    patient_count INTEGER DEFAULT 0,

    -- Export tracking
    exported_qrda1_at TIMESTAMPTZ,
    exported_qrda3_at TIMESTAMPTZ,
    submitted_to_cms_at TIMESTAMPTZ,

    UNIQUE(tenant_id, measure_id, reporting_period_start)
);

-- Track QRDA exports
CREATE TABLE IF NOT EXISTS ecqm_qrda_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Export type
    export_type VARCHAR(10) NOT NULL CHECK (export_type IN ('QRDA_I', 'QRDA_III')),

    -- What was exported
    measure_ids TEXT[],
    patient_id UUID REFERENCES auth.users(id),
    patient_count INTEGER,

    -- Reporting period
    reporting_period_start DATE NOT NULL,
    reporting_period_end DATE NOT NULL,

    -- File details
    file_path TEXT,
    file_size_bytes INTEGER,
    file_hash VARCHAR(64),

    -- Validation
    validation_status VARCHAR(20) DEFAULT 'pending',
    validation_errors JSONB DEFAULT '[]',
    validation_warnings JSONB DEFAULT '[]',
    validated_at TIMESTAMPTZ,

    -- CMS submission
    submitted_to_cms BOOLEAN DEFAULT false,
    cms_submission_id VARCHAR(100),
    cms_submission_status VARCHAR(50),
    cms_submission_response JSONB,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Store CQL library files
CREATE TABLE IF NOT EXISTS ecqm_cql_libraries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_name VARCHAR(100) NOT NULL,
    library_version VARCHAR(20) NOT NULL,

    -- CQL source and compiled ELM
    cql_source TEXT,
    elm_json JSONB,

    -- Dependencies
    dependencies JSONB DEFAULT '[]',

    -- Value set bindings
    value_set_bindings JSONB DEFAULT '[]',

    -- Metadata
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(library_name, library_version)
);

-- Store value set expansions (cached from VSAC)
CREATE TABLE IF NOT EXISTS ecqm_value_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oid VARCHAR(100) NOT NULL,
    version VARCHAR(20),
    name TEXT NOT NULL,

    -- Expansion
    codes JSONB NOT NULL DEFAULT '[]',
    code_count INTEGER DEFAULT 0,

    -- Source
    source VARCHAR(50) DEFAULT 'VSAC',
    last_updated_from_source TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(oid, version)
);

-- Calculation job queue
CREATE TABLE IF NOT EXISTS ecqm_calculation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Job parameters
    measure_ids TEXT[] NOT NULL,
    reporting_period_start DATE NOT NULL,
    reporting_period_end DATE NOT NULL,
    patient_ids TEXT[],

    -- Status
    status VARCHAR(20) DEFAULT 'pending',
    progress_percentage INTEGER DEFAULT 0,
    patients_processed INTEGER DEFAULT 0,
    patients_total INTEGER DEFAULT 0,

    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Results
    result_summary JSONB,
    error_message TEXT,

    -- Audit
    created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_ecqm_patient_results_tenant ON ecqm_patient_results(tenant_id);
CREATE INDEX idx_ecqm_patient_results_measure ON ecqm_patient_results(measure_id);
CREATE INDEX idx_ecqm_patient_results_patient ON ecqm_patient_results(patient_id);
CREATE INDEX idx_ecqm_patient_results_period ON ecqm_patient_results(reporting_period_start);
CREATE INDEX idx_ecqm_aggregate_tenant ON ecqm_aggregate_results(tenant_id);
CREATE INDEX idx_ecqm_aggregate_measure ON ecqm_aggregate_results(measure_id);
CREATE INDEX idx_ecqm_exports_tenant ON ecqm_qrda_exports(tenant_id);
CREATE INDEX idx_ecqm_exports_type ON ecqm_qrda_exports(export_type);
CREATE INDEX idx_ecqm_jobs_tenant ON ecqm_calculation_jobs(tenant_id);
CREATE INDEX idx_ecqm_jobs_status ON ecqm_calculation_jobs(status);
CREATE INDEX idx_ecqm_value_sets_oid ON ecqm_value_sets(oid);

-- RLS Policies
ALTER TABLE ecqm_measure_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecqm_patient_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecqm_aggregate_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecqm_qrda_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecqm_cql_libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecqm_value_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecqm_calculation_jobs ENABLE ROW LEVEL SECURITY;

-- Measure definitions readable by all
CREATE POLICY "ecqm_definitions_read" ON ecqm_measure_definitions
    FOR SELECT TO authenticated USING (true);

-- CQL libraries readable by all
CREATE POLICY "ecqm_cql_read" ON ecqm_cql_libraries
    FOR SELECT TO authenticated USING (true);

-- Value sets readable by all
CREATE POLICY "ecqm_value_sets_read" ON ecqm_value_sets
    FOR SELECT TO authenticated USING (true);

-- Patient results are tenant-scoped
CREATE POLICY "ecqm_patient_results_tenant" ON ecqm_patient_results
    FOR ALL TO authenticated
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

-- Aggregate results are tenant-scoped
CREATE POLICY "ecqm_aggregate_tenant" ON ecqm_aggregate_results
    FOR ALL TO authenticated
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

-- Exports are tenant-scoped
CREATE POLICY "ecqm_exports_tenant" ON ecqm_qrda_exports
    FOR ALL TO authenticated
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

-- Jobs are tenant-scoped
CREATE POLICY "ecqm_jobs_tenant" ON ecqm_calculation_jobs
    FOR ALL TO authenticated
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

-- Insert common CMS eCQM measure definitions for 2026
INSERT INTO ecqm_measure_definitions (
    measure_id, cms_id, version, title, description, measure_type, measure_scoring,
    initial_population_description, denominator_description, numerator_description,
    reporting_year, applicable_settings, clinical_focus, steward
) VALUES
-- Diabetes measures
('CMS122v12', 'CMS122', 'v12', 'Diabetes: Hemoglobin A1c (HbA1c) Poor Control (> 9%)',
 'Percentage of patients 18-75 years of age with diabetes who had hemoglobin A1c > 9.0% during the measurement period.',
 'process', 'proportion',
 'Patients 18-75 years of age with diabetes with a visit during the measurement period',
 'Equals Initial Population',
 'Patients whose most recent HbA1c level during the measurement period was > 9.0%',
 2026, ARRAY['ambulatory'], 'Diabetes', 'NCQA'),

('CMS134v12', 'CMS134', 'v12', 'Diabetes: Medical Attention for Nephropathy',
 'Percentage of patients 18-75 years of age with diabetes who had a nephropathy screening test or evidence of nephropathy.',
 'process', 'proportion',
 'Patients 18-75 years of age with diabetes with a visit during the measurement period',
 'Equals Initial Population',
 'Patients with nephropathy screening or evidence of nephropathy during measurement period',
 2026, ARRAY['ambulatory'], 'Diabetes', 'NCQA'),

-- Hypertension
('CMS165v12', 'CMS165', 'v12', 'Controlling High Blood Pressure',
 'Percentage of patients 18-85 years of age who had a diagnosis of hypertension and whose BP was adequately controlled.',
 'outcome', 'proportion',
 'Patients 18-85 years of age with hypertension diagnosis',
 'Equals Initial Population',
 'Patients whose most recent BP is adequately controlled (< 140/90 mmHg)',
 2026, ARRAY['ambulatory'], 'Hypertension', 'NCQA'),

-- Preventive care
('CMS127v12', 'CMS127', 'v12', 'Pneumococcal Vaccination Status for Older Adults',
 'Percentage of patients 66 years of age and older who have ever received a pneumococcal vaccine.',
 'process', 'proportion',
 'Patients 66 years and older with a visit during measurement period',
 'Equals Initial Population',
 'Patients who have received pneumococcal vaccination',
 2026, ARRAY['ambulatory'], 'Preventive Care', 'NCQA'),

('CMS147v13', 'CMS147', 'v13', 'Preventive Care and Screening: Influenza Immunization',
 'Percentage of patients aged 6 months and older who received an influenza immunization.',
 'process', 'proportion',
 'Patients 6 months and older with a visit during flu season',
 'Equals Initial Population',
 'Patients who received influenza immunization',
 2026, ARRAY['ambulatory'], 'Preventive Care', 'AMA-PCPI'),

-- Depression
('CMS159v12', 'CMS159', 'v12', 'Depression Remission at Twelve Months',
 'Percentage of patients aged 12 years and older with major depression who reached remission at twelve months.',
 'outcome', 'proportion',
 'Patients 12 years and older with depression diagnosis and PHQ-9 score > 9',
 'Equals Initial Population',
 'Patients who achieved remission (PHQ-9 score < 5) at 12 months',
 2026, ARRAY['ambulatory'], 'Behavioral Health', 'MN Community Measurement'),

-- Screening
('CMS130v12', 'CMS130', 'v12', 'Colorectal Cancer Screening',
 'Percentage of adults 45-75 years of age who had appropriate screening for colorectal cancer.',
 'process', 'proportion',
 'Patients 45-75 years of age with a visit during measurement period',
 'Equals Initial Population',
 'Patients with appropriate colorectal cancer screening',
 2026, ARRAY['ambulatory'], 'Cancer Screening', 'NCQA'),

('CMS125v12', 'CMS125', 'v12', 'Breast Cancer Screening',
 'Percentage of women 50-74 years of age who had a mammogram to screen for breast cancer.',
 'process', 'proportion',
 'Women 50-74 years of age with a visit during measurement period',
 'Equals Initial Population',
 'Patients with mammogram during measurement period or prior 15 months',
 2026, ARRAY['ambulatory'], 'Cancer Screening', 'NCQA')

ON CONFLICT (measure_id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Function to calculate performance rate
CREATE OR REPLACE FUNCTION calculate_ecqm_performance_rate(
    p_numerator INTEGER,
    p_denominator INTEGER,
    p_exclusions INTEGER,
    p_exceptions INTEGER
) RETURNS DECIMAL(5,4) AS $$
DECLARE
    eligible_denominator INTEGER;
BEGIN
    eligible_denominator := p_denominator - COALESCE(p_exclusions, 0) - COALESCE(p_exceptions, 0);

    IF eligible_denominator <= 0 THEN
        RETURN NULL;
    END IF;

    RETURN ROUND(p_numerator::DECIMAL / eligible_denominator::DECIMAL, 4);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add comments
COMMENT ON TABLE ecqm_measure_definitions IS 'CMS eCQM measure definitions - updated annually';
COMMENT ON TABLE ecqm_patient_results IS 'Patient-level eCQM calculation results for QRDA I export';
COMMENT ON TABLE ecqm_aggregate_results IS 'Aggregate eCQM results for QRDA III export';
COMMENT ON TABLE ecqm_qrda_exports IS 'QRDA I and III export history and validation status';
COMMENT ON TABLE ecqm_cql_libraries IS 'CQL library storage for measure calculation';
COMMENT ON TABLE ecqm_value_sets IS 'Cached VSAC value set expansions';
COMMENT ON TABLE ecqm_calculation_jobs IS 'Background eCQM calculation job queue';
