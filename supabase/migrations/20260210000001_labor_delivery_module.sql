-- =====================================================
-- LABOR & DELIVERY MODULE - Database Migration
-- =====================================================
-- Purpose: Maternal-fetal care tables for pregnancies, prenatal visits,
--   labor tracking, fetal monitoring, delivery, newborn, and postpartum
-- =====================================================

-- Pregnancy registry
CREATE TABLE IF NOT EXISTS ld_pregnancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  gravida integer NOT NULL CHECK (gravida > 0),
  para integer NOT NULL DEFAULT 0 CHECK (para >= 0),
  ab integer NOT NULL DEFAULT 0 CHECK (ab >= 0),
  living integer NOT NULL DEFAULT 0 CHECK (living >= 0),
  edd date NOT NULL,
  lmp date,
  blood_type text NOT NULL,
  rh_factor text NOT NULL CHECK (rh_factor IN ('positive','negative')),
  gbs_status text NOT NULL DEFAULT 'unknown' CHECK (gbs_status IN ('positive','negative','unknown','pending')),
  risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','moderate','high','critical')),
  risk_factors text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','delivered','loss','terminated')),
  primary_provider_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ld_preg_patient ON ld_pregnancies(patient_id);
CREATE INDEX idx_ld_preg_tenant ON ld_pregnancies(tenant_id);
CREATE INDEX idx_ld_preg_status ON ld_pregnancies(status);
CREATE INDEX idx_ld_preg_edd ON ld_pregnancies(edd);

-- Prenatal visits
CREATE TABLE IF NOT EXISTS ld_prenatal_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  pregnancy_id uuid NOT NULL REFERENCES ld_pregnancies(id),
  visit_date timestamptz NOT NULL DEFAULT now(),
  provider_id uuid,
  gestational_age_weeks integer NOT NULL CHECK (gestational_age_weeks >= 0 AND gestational_age_weeks <= 45),
  gestational_age_days integer NOT NULL DEFAULT 0 CHECK (gestational_age_days >= 0 AND gestational_age_days < 7),
  fundal_height_cm numeric(4,1),
  fetal_heart_rate integer CHECK (fetal_heart_rate > 0 AND fetal_heart_rate < 300),
  fetal_presentation text,
  weight_kg numeric(5,1) NOT NULL,
  bp_systolic integer NOT NULL,
  bp_diastolic integer NOT NULL,
  urine_protein text,
  urine_glucose text,
  cervical_dilation_cm numeric(3,1),
  cervical_effacement_percent integer CHECK (cervical_effacement_percent >= 0 AND cervical_effacement_percent <= 100),
  cervical_station integer CHECK (cervical_station >= -5 AND cervical_station <= 5),
  edema boolean NOT NULL DEFAULT false,
  complaints text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ld_prenatal_patient ON ld_prenatal_visits(patient_id);
CREATE INDEX idx_ld_prenatal_pregnancy ON ld_prenatal_visits(pregnancy_id);
CREATE INDEX idx_ld_prenatal_date ON ld_prenatal_visits(visit_date DESC);

-- Labor events (partogram)
CREATE TABLE IF NOT EXISTS ld_labor_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  pregnancy_id uuid NOT NULL REFERENCES ld_pregnancies(id),
  event_time timestamptz NOT NULL DEFAULT now(),
  stage text NOT NULL,
  dilation_cm numeric(3,1) NOT NULL CHECK (dilation_cm >= 0 AND dilation_cm <= 10),
  effacement_percent integer NOT NULL CHECK (effacement_percent >= 0 AND effacement_percent <= 100),
  station integer NOT NULL CHECK (station >= -5 AND station <= 5),
  contraction_frequency_per_10min integer,
  contraction_duration_seconds integer,
  contraction_intensity text CHECK (contraction_intensity IN ('mild','moderate','strong')),
  membrane_status text NOT NULL DEFAULT 'intact' CHECK (membrane_status IN ('intact','srom','arom','unknown')),
  membrane_rupture_time timestamptz,
  fluid_color text,
  maternal_bp_systolic integer,
  maternal_bp_diastolic integer,
  maternal_hr integer,
  maternal_temp_c numeric(4,1),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ld_labor_patient ON ld_labor_events(patient_id);
CREATE INDEX idx_ld_labor_pregnancy ON ld_labor_events(pregnancy_id);
CREATE INDEX idx_ld_labor_time ON ld_labor_events(event_time DESC);

-- Fetal monitoring
CREATE TABLE IF NOT EXISTS ld_fetal_monitoring (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  pregnancy_id uuid NOT NULL REFERENCES ld_pregnancies(id),
  assessment_time timestamptz NOT NULL DEFAULT now(),
  assessed_by uuid,
  fhr_baseline integer NOT NULL CHECK (fhr_baseline > 0 AND fhr_baseline < 300),
  variability text NOT NULL CHECK (variability IN ('absent','minimal','moderate','marked')),
  accelerations_present boolean NOT NULL DEFAULT false,
  deceleration_type text NOT NULL DEFAULT 'none',
  deceleration_depth_bpm integer,
  fhr_category text NOT NULL CHECK (fhr_category IN ('I','II','III')),
  uterine_activity text,
  interpretation text,
  action_taken text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ld_fetal_patient ON ld_fetal_monitoring(patient_id);
CREATE INDEX idx_ld_fetal_pregnancy ON ld_fetal_monitoring(pregnancy_id);
CREATE INDEX idx_ld_fetal_category ON ld_fetal_monitoring(fhr_category);

-- Delivery records
CREATE TABLE IF NOT EXISTS ld_delivery_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  pregnancy_id uuid NOT NULL REFERENCES ld_pregnancies(id),
  delivery_datetime timestamptz NOT NULL DEFAULT now(),
  delivery_provider_id uuid,
  method text NOT NULL,
  anesthesia text NOT NULL DEFAULT 'none',
  labor_duration_hours numeric(5,1),
  second_stage_duration_min integer,
  estimated_blood_loss_ml integer NOT NULL DEFAULT 0,
  complications text[] NOT NULL DEFAULT '{}',
  episiotomy boolean NOT NULL DEFAULT false,
  laceration_degree integer CHECK (laceration_degree >= 0 AND laceration_degree <= 4),
  cord_clamping text NOT NULL DEFAULT 'delayed_60s',
  cord_gases_ph numeric(4,2),
  cord_gases_base_excess numeric(4,1),
  placenta_delivery_time timestamptz,
  placenta_intact boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ld_delivery_patient ON ld_delivery_records(patient_id);
CREATE INDEX idx_ld_delivery_pregnancy ON ld_delivery_records(pregnancy_id);

-- Newborn assessments
CREATE TABLE IF NOT EXISTS ld_newborn_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  pregnancy_id uuid NOT NULL REFERENCES ld_pregnancies(id),
  delivery_id uuid NOT NULL REFERENCES ld_delivery_records(id),
  newborn_patient_id uuid,
  birth_datetime timestamptz NOT NULL,
  sex text NOT NULL CHECK (sex IN ('male','female','ambiguous')),
  weight_g integer NOT NULL CHECK (weight_g > 0 AND weight_g < 10000),
  length_cm numeric(4,1) NOT NULL,
  head_circumference_cm numeric(4,1) NOT NULL,
  apgar_1_min integer NOT NULL CHECK (apgar_1_min >= 0 AND apgar_1_min <= 10),
  apgar_5_min integer NOT NULL CHECK (apgar_5_min >= 0 AND apgar_5_min <= 10),
  apgar_10_min integer CHECK (apgar_10_min >= 0 AND apgar_10_min <= 10),
  ballard_gestational_age_weeks integer,
  temperature_c numeric(4,1),
  heart_rate integer,
  respiratory_rate integer,
  disposition text NOT NULL DEFAULT 'rooming_in',
  skin_color text,
  reflexes text,
  anomalies text[] NOT NULL DEFAULT '{}',
  vitamin_k_given boolean NOT NULL DEFAULT true,
  erythromycin_given boolean NOT NULL DEFAULT true,
  hepatitis_b_vaccine boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ld_newborn_patient ON ld_newborn_assessments(patient_id);
CREATE INDEX idx_ld_newborn_delivery ON ld_newborn_assessments(delivery_id);

-- Postpartum assessments
CREATE TABLE IF NOT EXISTS ld_postpartum_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  pregnancy_id uuid NOT NULL REFERENCES ld_pregnancies(id),
  assessment_datetime timestamptz NOT NULL DEFAULT now(),
  assessed_by uuid,
  hours_postpartum numeric(6,1) NOT NULL,
  fundal_height text NOT NULL,
  fundal_firmness text NOT NULL DEFAULT 'firm' CHECK (fundal_firmness IN ('firm','boggy')),
  lochia text NOT NULL DEFAULT 'rubra' CHECK (lochia IN ('rubra','serosa','alba','abnormal')),
  lochia_amount text NOT NULL DEFAULT 'moderate' CHECK (lochia_amount IN ('scant','light','moderate','heavy')),
  bp_systolic integer NOT NULL,
  bp_diastolic integer NOT NULL,
  heart_rate integer NOT NULL,
  temperature_c numeric(4,1) NOT NULL,
  breastfeeding_status text NOT NULL DEFAULT 'not_initiated',
  lactation_notes text,
  pain_score integer NOT NULL DEFAULT 0 CHECK (pain_score >= 0 AND pain_score <= 10),
  pain_location text,
  emotional_status text NOT NULL DEFAULT 'stable',
  epds_score integer CHECK (epds_score >= 0 AND epds_score <= 30),
  voiding boolean NOT NULL DEFAULT false,
  bowel_movement boolean NOT NULL DEFAULT false,
  incision_intact boolean,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ld_postpartum_patient ON ld_postpartum_assessments(patient_id);
CREATE INDEX idx_ld_postpartum_pregnancy ON ld_postpartum_assessments(pregnancy_id);

-- Medication administrations
CREATE TABLE IF NOT EXISTS ld_medication_administrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  pregnancy_id uuid NOT NULL REFERENCES ld_pregnancies(id),
  administered_datetime timestamptz NOT NULL DEFAULT now(),
  administered_by uuid,
  medication_name text NOT NULL,
  dose text NOT NULL,
  route text NOT NULL,
  indication text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ld_med_patient ON ld_medication_administrations(patient_id);
CREATE INDEX idx_ld_med_pregnancy ON ld_medication_administrations(pregnancy_id);

-- Risk assessments
CREATE TABLE IF NOT EXISTS ld_risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  pregnancy_id uuid NOT NULL REFERENCES ld_pregnancies(id),
  assessment_date timestamptz NOT NULL DEFAULT now(),
  assessed_by uuid,
  risk_level text NOT NULL CHECK (risk_level IN ('low','moderate','high','critical')),
  risk_factors text[] NOT NULL DEFAULT '{}',
  score integer,
  scoring_system text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ld_risk_patient ON ld_risk_assessments(patient_id);
CREATE INDEX idx_ld_risk_pregnancy ON ld_risk_assessments(pregnancy_id);

-- RLS policies
ALTER TABLE ld_pregnancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ld_prenatal_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE ld_labor_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ld_fetal_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE ld_delivery_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE ld_newborn_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ld_postpartum_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ld_medication_administrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ld_risk_assessments ENABLE ROW LEVEL SECURITY;

-- Tenant-scoped read policies
CREATE POLICY ld_preg_tenant_read ON ld_pregnancies FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = (SELECT (current_setting('app.current_tenant_id', true))::uuid)));

CREATE POLICY ld_prenatal_tenant_read ON ld_prenatal_visits FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = (SELECT (current_setting('app.current_tenant_id', true))::uuid)));

CREATE POLICY ld_labor_tenant_read ON ld_labor_events FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = (SELECT (current_setting('app.current_tenant_id', true))::uuid)));

CREATE POLICY ld_fetal_tenant_read ON ld_fetal_monitoring FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = (SELECT (current_setting('app.current_tenant_id', true))::uuid)));

CREATE POLICY ld_delivery_tenant_read ON ld_delivery_records FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = (SELECT (current_setting('app.current_tenant_id', true))::uuid)));

CREATE POLICY ld_newborn_tenant_read ON ld_newborn_assessments FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = (SELECT (current_setting('app.current_tenant_id', true))::uuid)));

CREATE POLICY ld_postpartum_tenant_read ON ld_postpartum_assessments FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = (SELECT (current_setting('app.current_tenant_id', true))::uuid)));

CREATE POLICY ld_med_tenant_read ON ld_medication_administrations FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = (SELECT (current_setting('app.current_tenant_id', true))::uuid)));

CREATE POLICY ld_risk_tenant_read ON ld_risk_assessments FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = (SELECT (current_setting('app.current_tenant_id', true))::uuid)));

-- Service role insert policies
CREATE POLICY ld_preg_service_insert ON ld_pregnancies FOR INSERT WITH CHECK (true);
CREATE POLICY ld_prenatal_service_insert ON ld_prenatal_visits FOR INSERT WITH CHECK (true);
CREATE POLICY ld_labor_service_insert ON ld_labor_events FOR INSERT WITH CHECK (true);
CREATE POLICY ld_fetal_service_insert ON ld_fetal_monitoring FOR INSERT WITH CHECK (true);
CREATE POLICY ld_delivery_service_insert ON ld_delivery_records FOR INSERT WITH CHECK (true);
CREATE POLICY ld_newborn_service_insert ON ld_newborn_assessments FOR INSERT WITH CHECK (true);
CREATE POLICY ld_postpartum_service_insert ON ld_postpartum_assessments FOR INSERT WITH CHECK (true);
CREATE POLICY ld_med_service_insert ON ld_medication_administrations FOR INSERT WITH CHECK (true);
CREATE POLICY ld_risk_service_insert ON ld_risk_assessments FOR INSERT WITH CHECK (true);

-- Service role update policies
CREATE POLICY ld_preg_service_update ON ld_pregnancies FOR UPDATE USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER trg_ld_preg_updated
  BEFORE UPDATE ON ld_pregnancies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
