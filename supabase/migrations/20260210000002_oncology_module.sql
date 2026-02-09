-- =====================================================
-- ONCOLOGY MODULE - Database Migration
-- =====================================================
-- Purpose: Cancer care tables for diagnosis, TNM staging, treatment,
--   chemotherapy, radiation, CTCAE side effects, lab monitoring,
--   RECIST imaging, and survivorship tracking
-- =====================================================

-- Cancer registry
CREATE TABLE IF NOT EXISTS onc_cancer_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  primary_site text NOT NULL,
  histology text NOT NULL,
  icd10_code text NOT NULL,
  diagnosis_date date NOT NULL,
  biomarkers jsonb NOT NULL DEFAULT '{}',
  ecog_status integer NOT NULL DEFAULT 0 CHECK (ecog_status >= 0 AND ecog_status <= 4),
  status text NOT NULL DEFAULT 'active_treatment',
  treating_oncologist_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_onc_registry_patient ON onc_cancer_registry(patient_id);
CREATE INDEX idx_onc_registry_tenant ON onc_cancer_registry(tenant_id);
CREATE INDEX idx_onc_registry_status ON onc_cancer_registry(status);
CREATE INDEX idx_onc_registry_icd10 ON onc_cancer_registry(icd10_code);

-- TNM Staging
CREATE TABLE IF NOT EXISTS onc_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  registry_id uuid NOT NULL REFERENCES onc_cancer_registry(id),
  staging_date date NOT NULL DEFAULT CURRENT_DATE,
  staging_type text NOT NULL CHECK (staging_type IN ('clinical','pathological')),
  t_stage text NOT NULL,
  n_stage text NOT NULL,
  m_stage text NOT NULL,
  overall_stage text NOT NULL,
  ajcc_edition integer NOT NULL DEFAULT 8,
  staging_basis text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_onc_staging_patient ON onc_staging(patient_id);
CREATE INDEX idx_onc_staging_registry ON onc_staging(registry_id);

-- Treatment plans
CREATE TABLE IF NOT EXISTS onc_treatment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  registry_id uuid NOT NULL REFERENCES onc_cancer_registry(id),
  plan_date date NOT NULL DEFAULT CURRENT_DATE,
  modalities text[] NOT NULL,
  intent text NOT NULL,
  regimen_name text NOT NULL,
  drugs text[] NOT NULL,
  cycle_count integer NOT NULL,
  cycle_length_days integer NOT NULL,
  planned_start_date date,
  actual_start_date date,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','completed','discontinued','modified')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_onc_treatment_patient ON onc_treatment_plans(patient_id);
CREATE INDEX idx_onc_treatment_registry ON onc_treatment_plans(registry_id);
CREATE INDEX idx_onc_treatment_status ON onc_treatment_plans(status);

-- Chemotherapy sessions
CREATE TABLE IF NOT EXISTS onc_chemotherapy_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  registry_id uuid NOT NULL REFERENCES onc_cancer_registry(id),
  treatment_plan_id uuid NOT NULL REFERENCES onc_treatment_plans(id),
  session_date timestamptz NOT NULL DEFAULT now(),
  cycle_number integer NOT NULL,
  day_of_cycle integer NOT NULL DEFAULT 1,
  drugs_administered jsonb NOT NULL DEFAULT '[]',
  dose_modifications text[] NOT NULL DEFAULT '{}',
  bsa_m2 numeric(4,2),
  pre_medications text[] NOT NULL DEFAULT '{}',
  adverse_events_during text[] NOT NULL DEFAULT '{}',
  vitals_pre jsonb,
  vitals_post jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_onc_chemo_patient ON onc_chemotherapy_sessions(patient_id);
CREATE INDEX idx_onc_chemo_plan ON onc_chemotherapy_sessions(treatment_plan_id);
CREATE INDEX idx_onc_chemo_date ON onc_chemotherapy_sessions(session_date DESC);

-- Radiation sessions
CREATE TABLE IF NOT EXISTS onc_radiation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  registry_id uuid NOT NULL REFERENCES onc_cancer_registry(id),
  treatment_plan_id uuid NOT NULL REFERENCES onc_treatment_plans(id),
  session_date timestamptz NOT NULL DEFAULT now(),
  fraction_number integer NOT NULL,
  total_fractions integer NOT NULL,
  dose_per_fraction_gy numeric(6,2) NOT NULL,
  cumulative_dose_gy numeric(7,2) NOT NULL,
  technique text NOT NULL,
  treatment_site text NOT NULL,
  skin_reaction_grade integer CHECK (skin_reaction_grade >= 0 AND skin_reaction_grade <= 4),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_onc_rad_patient ON onc_radiation_sessions(patient_id);
CREATE INDEX idx_onc_rad_plan ON onc_radiation_sessions(treatment_plan_id);
CREATE INDEX idx_onc_rad_date ON onc_radiation_sessions(session_date DESC);

-- CTCAE side effects
CREATE TABLE IF NOT EXISTS onc_side_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  registry_id uuid NOT NULL REFERENCES onc_cancer_registry(id),
  reported_date timestamptz NOT NULL DEFAULT now(),
  ctcae_term text NOT NULL,
  ctcae_grade integer NOT NULL CHECK (ctcae_grade >= 1 AND ctcae_grade <= 5),
  ctcae_category text NOT NULL,
  attribution text NOT NULL DEFAULT 'possible',
  intervention text,
  outcome text NOT NULL DEFAULT 'ongoing',
  resolved_date timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_onc_side_patient ON onc_side_effects(patient_id);
CREATE INDEX idx_onc_side_registry ON onc_side_effects(registry_id);
CREATE INDEX idx_onc_side_grade ON onc_side_effects(ctcae_grade);
CREATE INDEX idx_onc_side_active ON onc_side_effects(outcome) WHERE outcome IN ('ongoing','resolving');

-- Lab monitoring
CREATE TABLE IF NOT EXISTS onc_lab_monitoring (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  registry_id uuid NOT NULL REFERENCES onc_cancer_registry(id),
  lab_date timestamptz NOT NULL DEFAULT now(),
  wbc numeric(6,2),
  anc numeric(8,1),
  hemoglobin numeric(4,1),
  platelets integer,
  creatinine numeric(4,2),
  alt integer,
  ast integer,
  tumor_marker_name text,
  tumor_marker_value numeric(10,2),
  tumor_marker_unit text,
  baseline_marker_value numeric(10,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_onc_lab_patient ON onc_lab_monitoring(patient_id);
CREATE INDEX idx_onc_lab_registry ON onc_lab_monitoring(registry_id);
CREATE INDEX idx_onc_lab_date ON onc_lab_monitoring(lab_date DESC);

-- Imaging results (RECIST)
CREATE TABLE IF NOT EXISTS onc_imaging_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  registry_id uuid NOT NULL REFERENCES onc_cancer_registry(id),
  imaging_date timestamptz NOT NULL DEFAULT now(),
  modality text NOT NULL,
  body_region text NOT NULL,
  recist_response text,
  target_lesions jsonb NOT NULL DEFAULT '[]',
  sum_of_diameters_mm numeric(6,1),
  baseline_sum_mm numeric(6,1),
  new_lesions boolean NOT NULL DEFAULT false,
  findings text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_onc_imaging_patient ON onc_imaging_results(patient_id);
CREATE INDEX idx_onc_imaging_registry ON onc_imaging_results(registry_id);
CREATE INDEX idx_onc_imaging_date ON onc_imaging_results(imaging_date DESC);

-- Survivorship tracking
CREATE TABLE IF NOT EXISTS onc_survivorship (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  registry_id uuid NOT NULL REFERENCES onc_cancer_registry(id),
  assessment_date timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active_surveillance',
  remission_date date,
  surveillance_schedule text,
  late_effects text[] NOT NULL DEFAULT '{}',
  psychosocial_concerns text[] NOT NULL DEFAULT '{}',
  recurrence_date date,
  recurrence_site text,
  quality_of_life_score integer CHECK (quality_of_life_score >= 0 AND quality_of_life_score <= 100),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_onc_surv_patient ON onc_survivorship(patient_id);
CREATE INDEX idx_onc_surv_registry ON onc_survivorship(registry_id);

-- Standard regimens reference table
CREATE TABLE IF NOT EXISTS onc_standard_regimens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  drugs text[] NOT NULL,
  cycle_length_days integer NOT NULL,
  typical_cycles integer NOT NULL,
  cancer_types text[] NOT NULL DEFAULT '{}',
  notes text
);

-- Seed common regimens
INSERT INTO onc_standard_regimens (name, drugs, cycle_length_days, typical_cycles, cancer_types) VALUES
  ('FOLFOX', ARRAY['5-FU','Leucovorin','Oxaliplatin'], 14, 12, ARRAY['Colon','Rectal']),
  ('R-CHOP', ARRAY['Rituximab','Cyclophosphamide','Doxorubicin','Vincristine','Prednisone'], 21, 6, ARRAY['Non-Hodgkin Lymphoma']),
  ('AC-T', ARRAY['Doxorubicin','Cyclophosphamide','Paclitaxel'], 21, 8, ARRAY['Breast']),
  ('Cisplatin/Etoposide', ARRAY['Cisplatin','Etoposide'], 21, 4, ARRAY['Small Cell Lung','Testicular']),
  ('FOLFIRINOX', ARRAY['5-FU','Leucovorin','Irinotecan','Oxaliplatin'], 14, 12, ARRAY['Pancreatic']),
  ('Carboplatin/Paclitaxel', ARRAY['Carboplatin','Paclitaxel'], 21, 6, ARRAY['Ovarian','NSCLC']),
  ('ABVD', ARRAY['Doxorubicin','Bleomycin','Vinblastine','Dacarbazine'], 28, 6, ARRAY['Hodgkin Lymphoma']),
  ('Pembrolizumab', ARRAY['Pembrolizumab'], 21, 35, ARRAY['NSCLC','Melanoma','Head and Neck'])
ON CONFLICT (name) DO NOTHING;

-- RLS policies
ALTER TABLE onc_cancer_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE onc_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE onc_treatment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE onc_chemotherapy_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE onc_radiation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE onc_side_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE onc_lab_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE onc_imaging_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE onc_survivorship ENABLE ROW LEVEL SECURITY;
ALTER TABLE onc_standard_regimens ENABLE ROW LEVEL SECURITY;

-- Tenant-scoped read policies
CREATE POLICY onc_registry_tenant_read ON onc_cancer_registry FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = (SELECT (current_setting('app.current_tenant_id', true))::uuid)));

CREATE POLICY onc_staging_tenant_read ON onc_staging FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = (SELECT (current_setting('app.current_tenant_id', true))::uuid)));

CREATE POLICY onc_treatment_tenant_read ON onc_treatment_plans FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = (SELECT (current_setting('app.current_tenant_id', true))::uuid)));

CREATE POLICY onc_chemo_tenant_read ON onc_chemotherapy_sessions FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = (SELECT (current_setting('app.current_tenant_id', true))::uuid)));

CREATE POLICY onc_rad_tenant_read ON onc_radiation_sessions FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = (SELECT (current_setting('app.current_tenant_id', true))::uuid)));

CREATE POLICY onc_side_tenant_read ON onc_side_effects FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = (SELECT (current_setting('app.current_tenant_id', true))::uuid)));

CREATE POLICY onc_lab_tenant_read ON onc_lab_monitoring FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = (SELECT (current_setting('app.current_tenant_id', true))::uuid)));

CREATE POLICY onc_imaging_tenant_read ON onc_imaging_results FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = (SELECT (current_setting('app.current_tenant_id', true))::uuid)));

CREATE POLICY onc_surv_tenant_read ON onc_survivorship FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = (SELECT (current_setting('app.current_tenant_id', true))::uuid)));

-- Reference table is readable by all
CREATE POLICY onc_regimens_read ON onc_standard_regimens FOR SELECT USING (true);

-- Service role insert policies
CREATE POLICY onc_registry_service_insert ON onc_cancer_registry FOR INSERT WITH CHECK (true);
CREATE POLICY onc_staging_service_insert ON onc_staging FOR INSERT WITH CHECK (true);
CREATE POLICY onc_treatment_service_insert ON onc_treatment_plans FOR INSERT WITH CHECK (true);
CREATE POLICY onc_chemo_service_insert ON onc_chemotherapy_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY onc_rad_service_insert ON onc_radiation_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY onc_side_service_insert ON onc_side_effects FOR INSERT WITH CHECK (true);
CREATE POLICY onc_lab_service_insert ON onc_lab_monitoring FOR INSERT WITH CHECK (true);
CREATE POLICY onc_imaging_service_insert ON onc_imaging_results FOR INSERT WITH CHECK (true);
CREATE POLICY onc_surv_service_insert ON onc_survivorship FOR INSERT WITH CHECK (true);

-- Service role update policies
CREATE POLICY onc_registry_service_update ON onc_cancer_registry FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY onc_treatment_service_update ON onc_treatment_plans FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY onc_side_service_update ON onc_side_effects FOR UPDATE USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER trg_onc_registry_updated
  BEFORE UPDATE ON onc_cancer_registry
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
