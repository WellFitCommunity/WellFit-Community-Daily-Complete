-- =====================================================
-- CARDIOLOGY MODULE - Database Migration
-- =====================================================
-- Purpose: Comprehensive cardiac care tables for heart failure,
--   ECG, echo, cath lab, arrhythmia, devices, and rehab tracking
-- =====================================================

-- Cardiac patient registry
CREATE TABLE IF NOT EXISTS card_patient_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  conditions text[] NOT NULL DEFAULT '{}',
  risk_factors text[] NOT NULL DEFAULT '{}',
  nyha_class text CHECK (nyha_class IN ('I','II','III','IV')),
  lvef_percent numeric(5,2) CHECK (lvef_percent >= 0 AND lvef_percent <= 100),
  cha2ds2_vasc_score integer CHECK (cha2ds2_vasc_score >= 0 AND cha2ds2_vasc_score <= 9),
  has_score integer CHECK (has_score >= 0),
  enrolled_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','discharged','deceased')),
  primary_cardiologist_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_card_registry_patient ON card_patient_registry(patient_id);
CREATE INDEX idx_card_registry_tenant ON card_patient_registry(tenant_id);
CREATE INDEX idx_card_registry_status ON card_patient_registry(status);

-- ECG/EKG results
CREATE TABLE IF NOT EXISTS card_ecg_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  registry_id uuid NOT NULL REFERENCES card_patient_registry(id),
  performed_date timestamptz NOT NULL DEFAULT now(),
  performed_by uuid,
  rhythm text NOT NULL,
  heart_rate integer NOT NULL CHECK (heart_rate > 0 AND heart_rate < 400),
  pr_interval_ms integer,
  qrs_duration_ms integer,
  qtc_ms integer,
  axis_degrees integer,
  st_changes text NOT NULL DEFAULT 'none',
  is_stemi boolean NOT NULL DEFAULT false,
  interpretation text,
  is_normal boolean NOT NULL DEFAULT true,
  findings text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_card_ecg_patient ON card_ecg_results(patient_id);
CREATE INDEX idx_card_ecg_registry ON card_ecg_results(registry_id);
CREATE INDEX idx_card_ecg_date ON card_ecg_results(performed_date DESC);
CREATE INDEX idx_card_ecg_stemi ON card_ecg_results(is_stemi) WHERE is_stemi = true;

-- Echocardiogram results
CREATE TABLE IF NOT EXISTS card_echo_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  registry_id uuid NOT NULL REFERENCES card_patient_registry(id),
  performed_date timestamptz NOT NULL DEFAULT now(),
  performed_by uuid,
  lvef_percent numeric(5,2) NOT NULL CHECK (lvef_percent >= 0 AND lvef_percent <= 100),
  rv_function text NOT NULL DEFAULT 'normal',
  lv_end_diastolic_diameter_mm numeric(5,1),
  lv_end_systolic_diameter_mm numeric(5,1),
  lv_mass_index numeric(6,1),
  wall_motion_abnormalities text[] NOT NULL DEFAULT '{}',
  valve_results jsonb NOT NULL DEFAULT '[]',
  pericardial_effusion boolean NOT NULL DEFAULT false,
  diastolic_function text,
  interpretation text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_card_echo_patient ON card_echo_results(patient_id);
CREATE INDEX idx_card_echo_registry ON card_echo_results(registry_id);
CREATE INDEX idx_card_echo_date ON card_echo_results(performed_date DESC);

-- Stress test results
CREATE TABLE IF NOT EXISTS card_stress_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  registry_id uuid NOT NULL REFERENCES card_patient_registry(id),
  performed_date timestamptz NOT NULL DEFAULT now(),
  performed_by uuid,
  protocol text NOT NULL,
  duration_min numeric(5,1) NOT NULL,
  max_heart_rate integer NOT NULL,
  target_heart_rate integer NOT NULL,
  percent_target_achieved numeric(5,1) NOT NULL,
  mets_achieved numeric(4,1) NOT NULL,
  duke_score integer,
  is_positive boolean NOT NULL DEFAULT false,
  ischemic_changes boolean NOT NULL DEFAULT false,
  arrhythmias_during text[] NOT NULL DEFAULT '{}',
  symptoms_during text[] NOT NULL DEFAULT '{}',
  bp_peak_systolic integer,
  bp_peak_diastolic integer,
  findings text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_card_stress_patient ON card_stress_tests(patient_id);
CREATE INDEX idx_card_stress_registry ON card_stress_tests(registry_id);

-- Cardiac catheterization reports
CREATE TABLE IF NOT EXISTS card_cath_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  registry_id uuid NOT NULL REFERENCES card_patient_registry(id),
  performed_date timestamptz NOT NULL DEFAULT now(),
  performed_by uuid,
  access_site text NOT NULL DEFAULT 'radial' CHECK (access_site IN ('radial','femoral')),
  coronary_arteries jsonb NOT NULL DEFAULT '{}',
  interventions text[] NOT NULL DEFAULT '{}',
  stents_placed jsonb NOT NULL DEFAULT '[]',
  hemodynamics jsonb,
  complications text[] NOT NULL DEFAULT '{}',
  contrast_volume_ml numeric(6,1),
  fluoroscopy_time_min numeric(5,1),
  findings text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_card_cath_patient ON card_cath_reports(patient_id);
CREATE INDEX idx_card_cath_registry ON card_cath_reports(registry_id);

-- Heart failure management
CREATE TABLE IF NOT EXISTS card_heart_failure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  registry_id uuid NOT NULL REFERENCES card_patient_registry(id),
  assessment_date timestamptz NOT NULL DEFAULT now(),
  assessed_by uuid,
  nyha_class text NOT NULL CHECK (nyha_class IN ('I','II','III','IV')),
  bnp_pg_ml numeric(8,1),
  nt_pro_bnp_pg_ml numeric(10,1),
  daily_weight_kg numeric(5,1) NOT NULL,
  previous_weight_kg numeric(5,1),
  weight_change_kg numeric(4,1),
  fluid_status text NOT NULL DEFAULT 'euvolemic' CHECK (fluid_status IN ('euvolemic','hypervolemic','hypovolemic')),
  edema_grade integer NOT NULL DEFAULT 0 CHECK (edema_grade >= 0 AND edema_grade <= 4),
  dyspnea_at_rest boolean NOT NULL DEFAULT false,
  orthopnea boolean NOT NULL DEFAULT false,
  pnd boolean NOT NULL DEFAULT false,
  jugular_venous_distension boolean NOT NULL DEFAULT false,
  crackles boolean NOT NULL DEFAULT false,
  s3_gallop boolean NOT NULL DEFAULT false,
  fluid_restriction_ml integer,
  sodium_restriction_mg integer,
  diuretic_adjustment text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_card_hf_patient ON card_heart_failure(patient_id);
CREATE INDEX idx_card_hf_registry ON card_heart_failure(registry_id);
CREATE INDEX idx_card_hf_date ON card_heart_failure(assessment_date DESC);

-- Arrhythmia events
CREATE TABLE IF NOT EXISTS card_arrhythmia_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  registry_id uuid NOT NULL REFERENCES card_patient_registry(id),
  event_date timestamptz NOT NULL DEFAULT now(),
  detected_by text NOT NULL CHECK (detected_by IN ('ecg','monitor','device','patient_report')),
  type text NOT NULL,
  duration_seconds integer,
  heart_rate_during integer,
  hemodynamically_stable boolean NOT NULL DEFAULT true,
  symptoms text[] NOT NULL DEFAULT '{}',
  treatment_given text,
  cardioversion_performed boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_card_arrhythmia_patient ON card_arrhythmia_events(patient_id);
CREATE INDEX idx_card_arrhythmia_registry ON card_arrhythmia_events(registry_id);
CREATE INDEX idx_card_arrhythmia_date ON card_arrhythmia_events(event_date DESC);

-- Cardiac device monitoring
CREATE TABLE IF NOT EXISTS card_device_monitoring (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  registry_id uuid NOT NULL REFERENCES card_patient_registry(id),
  device_type text NOT NULL,
  device_manufacturer text,
  device_model text,
  implant_date date,
  check_date timestamptz NOT NULL DEFAULT now(),
  checked_by uuid,
  battery_status text NOT NULL DEFAULT 'good' CHECK (battery_status IN ('good','elective_replacement','end_of_life')),
  battery_voltage numeric(3,1),
  battery_longevity_months integer,
  atrial_pacing_percent numeric(5,1),
  ventricular_pacing_percent numeric(5,1),
  lead_impedance_atrial_ohms integer,
  lead_impedance_ventricular_ohms integer,
  sensing_atrial_mv numeric(4,1),
  sensing_ventricular_mv numeric(4,1),
  threshold_atrial_v numeric(3,1),
  threshold_ventricular_v numeric(3,1),
  shocks_delivered integer NOT NULL DEFAULT 0,
  anti_tachycardia_pacing_events integer NOT NULL DEFAULT 0,
  atrial_arrhythmia_burden_percent numeric(5,1),
  alerts text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_card_device_patient ON card_device_monitoring(patient_id);
CREATE INDEX idx_card_device_registry ON card_device_monitoring(registry_id);
CREATE INDEX idx_card_device_date ON card_device_monitoring(check_date DESC);

-- Cardiac rehab
CREATE TABLE IF NOT EXISTS card_cardiac_rehab (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  registry_id uuid NOT NULL REFERENCES card_patient_registry(id),
  phase integer NOT NULL CHECK (phase IN (1,2,3)),
  session_date timestamptz NOT NULL DEFAULT now(),
  session_number integer NOT NULL,
  total_sessions_prescribed integer NOT NULL DEFAULT 36,
  exercise_type text NOT NULL,
  duration_min integer NOT NULL,
  peak_heart_rate integer,
  target_heart_rate integer,
  resting_bp_systolic integer,
  resting_bp_diastolic integer,
  mets_achieved numeric(4,1),
  rpe_score integer CHECK (rpe_score >= 6 AND rpe_score <= 20),
  symptoms_during text[] NOT NULL DEFAULT '{}',
  functional_improvement_notes text,
  completed boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_card_rehab_patient ON card_cardiac_rehab(patient_id);
CREATE INDEX idx_card_rehab_registry ON card_cardiac_rehab(registry_id);
CREATE INDEX idx_card_rehab_date ON card_cardiac_rehab(session_date DESC);

-- RLS policies
ALTER TABLE card_patient_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_ecg_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_echo_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_stress_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_cath_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_heart_failure ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_arrhythmia_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_device_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_cardiac_rehab ENABLE ROW LEVEL SECURITY;

-- Tenant-scoped read policies
CREATE POLICY card_registry_tenant_read ON card_patient_registry FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = (SELECT (current_setting('app.current_tenant_id', true))::uuid)));

CREATE POLICY card_ecg_tenant_read ON card_ecg_results FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = (SELECT (current_setting('app.current_tenant_id', true))::uuid)));

CREATE POLICY card_echo_tenant_read ON card_echo_results FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = (SELECT (current_setting('app.current_tenant_id', true))::uuid)));

CREATE POLICY card_stress_tenant_read ON card_stress_tests FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = (SELECT (current_setting('app.current_tenant_id', true))::uuid)));

CREATE POLICY card_cath_tenant_read ON card_cath_reports FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = (SELECT (current_setting('app.current_tenant_id', true))::uuid)));

CREATE POLICY card_hf_tenant_read ON card_heart_failure FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = (SELECT (current_setting('app.current_tenant_id', true))::uuid)));

CREATE POLICY card_arrhythmia_tenant_read ON card_arrhythmia_events FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = (SELECT (current_setting('app.current_tenant_id', true))::uuid)));

CREATE POLICY card_device_tenant_read ON card_device_monitoring FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = (SELECT (current_setting('app.current_tenant_id', true))::uuid)));

CREATE POLICY card_rehab_tenant_read ON card_cardiac_rehab FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = (SELECT (current_setting('app.current_tenant_id', true))::uuid)));

-- Service role insert policies
CREATE POLICY card_registry_service_insert ON card_patient_registry FOR INSERT
  WITH CHECK (true);

CREATE POLICY card_ecg_service_insert ON card_ecg_results FOR INSERT
  WITH CHECK (true);

CREATE POLICY card_echo_service_insert ON card_echo_results FOR INSERT
  WITH CHECK (true);

CREATE POLICY card_stress_service_insert ON card_stress_tests FOR INSERT
  WITH CHECK (true);

CREATE POLICY card_cath_service_insert ON card_cath_reports FOR INSERT
  WITH CHECK (true);

CREATE POLICY card_hf_service_insert ON card_heart_failure FOR INSERT
  WITH CHECK (true);

CREATE POLICY card_arrhythmia_service_insert ON card_arrhythmia_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY card_device_service_insert ON card_device_monitoring FOR INSERT
  WITH CHECK (true);

CREATE POLICY card_rehab_service_insert ON card_cardiac_rehab FOR INSERT
  WITH CHECK (true);

-- Service role update policies
CREATE POLICY card_registry_service_update ON card_patient_registry FOR UPDATE
  USING (true) WITH CHECK (true);

CREATE POLICY card_hf_service_update ON card_heart_failure FOR UPDATE
  USING (true) WITH CHECK (true);

-- Auto-calculate weight change trigger
CREATE OR REPLACE FUNCTION calc_weight_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.previous_weight_kg IS NOT NULL THEN
    NEW.weight_change_kg := NEW.daily_weight_kg - NEW.previous_weight_kg;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_card_hf_weight_change
  BEFORE INSERT OR UPDATE ON card_heart_failure
  FOR EACH ROW EXECUTE FUNCTION calc_weight_change();

-- Updated_at trigger for registry
CREATE TRIGGER trg_card_registry_updated
  BEFORE UPDATE ON card_patient_registry
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
