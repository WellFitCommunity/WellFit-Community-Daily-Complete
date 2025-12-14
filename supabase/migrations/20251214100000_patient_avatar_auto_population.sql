-- Patient Avatar Auto-Population System
-- Migration: 20251214100000_patient_avatar_auto_population.sql
--
-- Creates triggers and functions to automatically populate patient markers
-- from diagnoses, orders, and conditions tables.

-- ============================================================================
-- CONDITION-TO-MARKER MAPPING TABLE
-- Stores ICD-10 and text-based mappings to marker types
-- ============================================================================

CREATE TABLE IF NOT EXISTS condition_marker_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Matching criteria (at least one required)
  icd10_pattern TEXT,           -- Regex pattern for ICD-10 codes (e.g., 'E11.*' for Type 2 Diabetes)
  snomed_code TEXT,             -- SNOMED CT code
  text_pattern TEXT,            -- Regex pattern for condition text

  -- Target marker
  marker_type TEXT NOT NULL,    -- Maps to marker_type in patient_markers
  marker_category TEXT NOT NULL CHECK (marker_category IN ('critical', 'moderate', 'informational', 'monitoring', 'chronic', 'neurological')),
  marker_display_name TEXT NOT NULL,
  body_region TEXT NOT NULL,
  position_x DECIMAL(5,2) NOT NULL,
  position_y DECIMAL(5,2) NOT NULL,
  body_view TEXT NOT NULL DEFAULT 'front' CHECK (body_view IN ('front', 'back')),

  -- Status badge indicator
  is_status_badge BOOLEAN DEFAULT false,

  -- Priority for disambiguation (higher = preferred)
  priority INTEGER DEFAULT 0,

  -- Active flag
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE condition_marker_mappings IS 'Maps ICD-10 codes, SNOMED codes, and text patterns to avatar markers';
COMMENT ON COLUMN condition_marker_mappings.icd10_pattern IS 'SQL LIKE pattern for ICD-10 codes (e.g., E11.% for Type 2 Diabetes)';

CREATE INDEX IF NOT EXISTS idx_condition_marker_mappings_icd10 ON condition_marker_mappings(icd10_pattern) WHERE icd10_pattern IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_condition_marker_mappings_snomed ON condition_marker_mappings(snomed_code) WHERE snomed_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_condition_marker_mappings_active ON condition_marker_mappings(is_active) WHERE is_active = true;

-- ============================================================================
-- SEED CONDITION-TO-MARKER MAPPINGS
-- ============================================================================

INSERT INTO condition_marker_mappings (icd10_pattern, marker_type, marker_category, marker_display_name, body_region, position_x, position_y, body_view, priority) VALUES
-- Diabetes
('E10.%', 'diabetes_type1', 'chronic', 'Type 1 Diabetes', 'pancreas', 55, 50, 'front', 100),
('E11.%', 'diabetes_type2', 'chronic', 'Type 2 Diabetes', 'pancreas', 55, 50, 'front', 100),
('E13.%', 'diabetes_other', 'chronic', 'Diabetes (Other)', 'pancreas', 55, 50, 'front', 90),

-- Heart / Cardiac
('I50.%', 'chf', 'chronic', 'Heart Failure (CHF)', 'heart', 45, 38, 'front', 100),
('I48.%', 'afib', 'chronic', 'Atrial Fibrillation', 'heart', 45, 38, 'front', 95),
('I25.%', 'cad', 'chronic', 'Coronary Artery Disease', 'heart', 45, 38, 'front', 90),
('I21.%', 'mi', 'critical', 'Myocardial Infarction', 'heart', 45, 38, 'front', 120),
('I10', 'hypertension', 'chronic', 'Hypertension', 'heart', 45, 38, 'front', 80),

-- Respiratory
('J44.%', 'copd', 'chronic', 'COPD', 'lungs', 50, 40, 'front', 100),
('J45.%', 'asthma', 'chronic', 'Asthma', 'lungs', 50, 40, 'front', 95),
('J18.%', 'pneumonia', 'moderate', 'Pneumonia', 'lungs', 50, 40, 'front', 90),
('I26.%', 'pe', 'critical', 'Pulmonary Embolism', 'lungs', 50, 40, 'front', 120),

-- Renal
('N18.1', 'ckd_stage1', 'chronic', 'CKD Stage 1', 'kidneys', 45, 52, 'back', 70),
('N18.2', 'ckd_stage2', 'chronic', 'CKD Stage 2', 'kidneys', 45, 52, 'back', 75),
('N18.3%', 'ckd_stage3', 'chronic', 'CKD Stage 3', 'kidneys', 45, 52, 'back', 80),
('N18.4', 'ckd_stage4', 'chronic', 'CKD Stage 4', 'kidneys', 45, 52, 'back', 90),
('N18.5', 'ckd_stage5', 'chronic', 'CKD Stage 5', 'kidneys', 45, 52, 'back', 100),
('N18.6', 'esrd', 'critical', 'End Stage Renal Disease', 'kidneys', 45, 52, 'back', 110),

-- Neurological
('I63.%', 'stroke', 'neurological', 'Stroke (CVA)', 'brain', 50, 8, 'front', 110),
('I61.%', 'hemorrhagic_stroke', 'neurological', 'Hemorrhagic Stroke', 'brain', 50, 8, 'front', 115),
('G20', 'parkinsons', 'neurological', 'Parkinson''s Disease', 'brain', 50, 8, 'front', 100),
('G30.%', 'alzheimers', 'neurological', 'Alzheimer''s Disease', 'brain', 50, 8, 'front', 100),
('F03.%', 'dementia', 'neurological', 'Dementia', 'brain', 50, 8, 'front', 95),
('G40.%', 'epilepsy', 'neurological', 'Epilepsy', 'brain', 50, 8, 'front', 100),
('S06.%', 'tbi', 'neurological', 'Traumatic Brain Injury', 'brain', 50, 8, 'front', 105),
('G35', 'ms', 'neurological', 'Multiple Sclerosis', 'brain', 50, 8, 'front', 100),

-- Mental Health
('F32.%', 'depression', 'chronic', 'Major Depression', 'brain', 50, 8, 'front', 80),
('F33.%', 'depression_recurrent', 'chronic', 'Recurrent Depression', 'brain', 50, 8, 'front', 85),
('F41.%', 'anxiety', 'chronic', 'Anxiety Disorder', 'brain', 50, 8, 'front', 75),
('F31.%', 'bipolar', 'chronic', 'Bipolar Disorder', 'brain', 50, 8, 'front', 85),
('F20.%', 'schizophrenia', 'chronic', 'Schizophrenia', 'brain', 50, 8, 'front', 90),

-- Vascular
('I82.%', 'dvt', 'moderate', 'Deep Vein Thrombosis', 'leg_left', 35, 85, 'front', 95),

-- Metabolic
('E66.%', 'obesity', 'chronic', 'Obesity', 'abdomen', 50, 55, 'front', 70),
('E78.%', 'hyperlipidemia', 'chronic', 'Hyperlipidemia', 'heart', 45, 38, 'front', 65),
('E03.%', 'hypothyroidism', 'chronic', 'Hypothyroidism', 'neck', 50, 18, 'front', 60),

-- GI
('K21.%', 'gerd', 'chronic', 'GERD', 'esophagus', 50, 45, 'front', 55),

-- Sleep
('G47.33', 'sleep_apnea', 'chronic', 'Sleep Apnea', 'neck', 50, 18, 'front', 65),

-- Pain
('G89.%', 'chronic_pain', 'chronic', 'Chronic Pain', 'spine', 50, 50, 'back', 70),

-- Musculoskeletal
('M15.%', 'osteoarthritis', 'chronic', 'Osteoarthritis', 'joints', 50, 65, 'front', 60),
('M16.%', 'hip_oa', 'chronic', 'Hip Osteoarthritis', 'hip_left', 35, 65, 'front', 60),
('M17.%', 'knee_oa', 'chronic', 'Knee Osteoarthritis', 'knee_left', 35, 78, 'front', 60),
('M81.%', 'osteoporosis', 'chronic', 'Osteoporosis', 'spine', 50, 50, 'back', 65),

-- Blood
('D64.%', 'anemia', 'chronic', 'Anemia', 'heart', 45, 38, 'front', 55)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STATUS BADGE MAPPINGS (displayed around avatar, not on body)
-- ============================================================================

INSERT INTO condition_marker_mappings (text_pattern, marker_type, marker_category, marker_display_name, body_region, position_x, position_y, body_view, is_status_badge, priority) VALUES
-- Fall Risk
('fall risk|falls|fall precautions', 'fall_risk', 'critical', 'Fall Risk', 'badge_area', 5, 5, 'front', true, 120),
-- Aspiration
('aspiration risk|aspiration precautions|dysphagia', 'aspiration_risk', 'critical', 'Aspiration Risk', 'badge_area', 5, 15, 'front', true, 115),
-- NPO
('npo|nothing by mouth|nil per os', 'npo', 'critical', 'NPO', 'badge_area', 5, 25, 'front', true, 110),
-- Seizure Precautions
('seizure precautions|seizure risk', 'seizure_precautions', 'critical', 'Seizure Precautions', 'badge_area', 5, 35, 'front', true, 105),
-- Bleeding Precautions
('bleeding precautions|anticoagulated|blood thinner', 'bleeding_precautions', 'critical', 'Bleeding Precautions', 'badge_area', 5, 45, 'front', true, 110),
-- Elopement
('elopement risk|wandering|flight risk', 'elopement_risk', 'critical', 'Elopement Risk', 'badge_area', 5, 55, 'front', true, 100),
-- Isolation
('contact isolation|contact precautions|mrsa|vre|c.diff', 'isolation_contact', 'critical', 'Contact Isolation', 'badge_area', 95, 5, 'front', true, 120),
('droplet isolation|droplet precautions|flu|influenza', 'isolation_droplet', 'critical', 'Droplet Isolation', 'badge_area', 95, 15, 'front', true, 120),
('airborne isolation|airborne precautions|tb|tuberculosis|covid', 'isolation_airborne', 'critical', 'Airborne Isolation', 'badge_area', 95, 25, 'front', true, 125),
('protective isolation|reverse isolation|neutropenic', 'isolation_protective', 'critical', 'Protective Isolation', 'badge_area', 95, 35, 'front', true, 115)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- HELPER FUNCTION: Find matching marker type for a condition
-- ============================================================================

CREATE OR REPLACE FUNCTION find_marker_for_condition(
  p_icd10_code TEXT,
  p_snomed_code TEXT,
  p_condition_text TEXT
)
RETURNS TABLE (
  marker_type TEXT,
  marker_category TEXT,
  marker_display_name TEXT,
  body_region TEXT,
  position_x DECIMAL,
  position_y DECIMAL,
  body_view TEXT,
  is_status_badge BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.marker_type,
    m.marker_category,
    m.marker_display_name,
    m.body_region,
    m.position_x,
    m.position_y,
    m.body_view,
    m.is_status_badge
  FROM condition_marker_mappings m
  WHERE m.is_active = true
    AND (
      -- Match by ICD-10 pattern
      (m.icd10_pattern IS NOT NULL AND p_icd10_code IS NOT NULL AND p_icd10_code LIKE m.icd10_pattern)
      -- Match by SNOMED code
      OR (m.snomed_code IS NOT NULL AND p_snomed_code IS NOT NULL AND m.snomed_code = p_snomed_code)
      -- Match by text pattern (case insensitive)
      OR (m.text_pattern IS NOT NULL AND p_condition_text IS NOT NULL AND lower(p_condition_text) ~* m.text_pattern)
    )
  ORDER BY m.priority DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Auto-create marker from condition
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_create_marker_from_condition(
  p_patient_id UUID,
  p_icd10_code TEXT,
  p_snomed_code TEXT,
  p_condition_text TEXT,
  p_source_id UUID DEFAULT NULL,
  p_severity_stage TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_mapping RECORD;
  v_existing_marker_id UUID;
  v_new_marker_id UUID;
BEGIN
  -- Find matching marker mapping
  SELECT * INTO v_mapping FROM find_marker_for_condition(p_icd10_code, p_snomed_code, p_condition_text);

  IF v_mapping IS NULL THEN
    -- No mapping found
    RETURN NULL;
  END IF;

  -- Check if marker already exists for this patient and type
  SELECT id INTO v_existing_marker_id
  FROM patient_markers
  WHERE patient_id = p_patient_id
    AND marker_type = v_mapping.marker_type
    AND is_active = true
  LIMIT 1;

  IF v_existing_marker_id IS NOT NULL THEN
    -- Marker already exists, optionally update it
    RETURN v_existing_marker_id;
  END IF;

  -- Create new marker
  INSERT INTO patient_markers (
    patient_id,
    category,
    marker_type,
    display_name,
    body_region,
    position_x,
    position_y,
    body_view,
    source,
    status,
    details,
    is_active,
    requires_attention
  ) VALUES (
    p_patient_id,
    v_mapping.marker_category,
    v_mapping.marker_type,
    v_mapping.marker_display_name,
    v_mapping.body_region,
    v_mapping.position_x,
    v_mapping.position_y,
    v_mapping.body_view,
    'import',
    'pending_confirmation',
    jsonb_build_object(
      'icd10_code', p_icd10_code,
      'snomed_code', p_snomed_code,
      'condition_text', p_condition_text,
      'severity_stage', p_severity_stage,
      'auto_created', true,
      'source_condition_id', p_source_id
    ),
    true,
    true
  )
  RETURNING id INTO v_new_marker_id;

  RETURN v_new_marker_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: Auto-populate from fhir_conditions
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_auto_populate_marker_from_fhir_condition()
RETURNS TRIGGER AS $$
DECLARE
  v_marker_id UUID;
BEGIN
  -- Only process active conditions
  IF NEW.clinical_status NOT IN ('active', 'recurrence', 'relapse') THEN
    RETURN NEW;
  END IF;

  -- Only process confirmed or provisional conditions
  IF NEW.verification_status NOT IN ('confirmed', 'provisional') THEN
    RETURN NEW;
  END IF;

  -- Auto-create marker
  v_marker_id := auto_create_marker_from_condition(
    NEW.patient_id,
    CASE WHEN NEW.code_system LIKE '%icd-10%' THEN NEW.code ELSE NULL END,
    CASE WHEN NEW.code_system LIKE '%snomed%' THEN NEW.code ELSE NULL END,
    NEW.code_display,
    NEW.id,
    NEW.severity_display
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on fhir_conditions if the table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fhir_conditions') THEN
    DROP TRIGGER IF EXISTS trg_auto_populate_marker_from_fhir_condition ON fhir_conditions;
    CREATE TRIGGER trg_auto_populate_marker_from_fhir_condition
      AFTER INSERT ON fhir_conditions
      FOR EACH ROW
      EXECUTE FUNCTION trigger_auto_populate_marker_from_fhir_condition();
  END IF;
END $$;

-- ============================================================================
-- TRIGGER: Auto-populate from encounter_diagnoses
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_auto_populate_marker_from_encounter_diagnosis()
RETURNS TRIGGER AS $$
DECLARE
  v_patient_id UUID;
  v_marker_id UUID;
BEGIN
  -- Get patient_id from the encounter
  SELECT patient_id INTO v_patient_id
  FROM encounters
  WHERE id = NEW.encounter_id;

  IF v_patient_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Auto-create marker (code is ICD-10 format)
  v_marker_id := auto_create_marker_from_condition(
    v_patient_id,
    NEW.code,
    NULL,
    NEW.description,
    NEW.id,
    NULL
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on encounter_diagnoses if the table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'encounter_diagnoses') THEN
    DROP TRIGGER IF EXISTS trg_auto_populate_marker_from_encounter_diagnosis ON encounter_diagnoses;
    CREATE TRIGGER trg_auto_populate_marker_from_encounter_diagnosis
      AFTER INSERT ON encounter_diagnoses
      FOR EACH ROW
      EXECUTE FUNCTION trigger_auto_populate_marker_from_encounter_diagnosis();
  END IF;
END $$;

-- ============================================================================
-- FUNCTION: Bulk sync markers for a patient
-- Useful for initial population or resync
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_patient_markers_from_conditions(p_patient_id UUID)
RETURNS TABLE (
  created_count INTEGER,
  skipped_count INTEGER,
  conditions_processed INTEGER
) AS $$
DECLARE
  v_created INTEGER := 0;
  v_skipped INTEGER := 0;
  v_processed INTEGER := 0;
  v_condition RECORD;
  v_marker_id UUID;
BEGIN
  -- Process fhir_conditions if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fhir_conditions') THEN
    FOR v_condition IN
      SELECT
        id,
        CASE WHEN code_system LIKE '%icd-10%' THEN code ELSE NULL END as icd10,
        CASE WHEN code_system LIKE '%snomed%' THEN code ELSE NULL END as snomed,
        code_display,
        severity_display
      FROM fhir_conditions
      WHERE patient_id = p_patient_id
        AND clinical_status IN ('active', 'recurrence', 'relapse')
        AND verification_status IN ('confirmed', 'provisional')
    LOOP
      v_processed := v_processed + 1;

      v_marker_id := auto_create_marker_from_condition(
        p_patient_id,
        v_condition.icd10,
        v_condition.snomed,
        v_condition.code_display,
        v_condition.id,
        v_condition.severity_display
      );

      IF v_marker_id IS NOT NULL THEN
        -- Check if it was newly created (has pending status)
        IF EXISTS (SELECT 1 FROM patient_markers WHERE id = v_marker_id AND status = 'pending_confirmation') THEN
          v_created := v_created + 1;
        ELSE
          v_skipped := v_skipped + 1;
        END IF;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN QUERY SELECT v_created, v_skipped, v_processed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE condition_marker_mappings ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read mappings
CREATE POLICY "condition_marker_mappings_select" ON condition_marker_mappings
  FOR SELECT TO authenticated
  USING (true);

-- Only admins can modify mappings
CREATE POLICY "condition_marker_mappings_admin_modify" ON condition_marker_mappings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT ON condition_marker_mappings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON condition_marker_mappings TO authenticated;
GRANT EXECUTE ON FUNCTION find_marker_for_condition TO authenticated;
GRANT EXECUTE ON FUNCTION auto_create_marker_from_condition TO authenticated;
GRANT EXECUTE ON FUNCTION sync_patient_markers_from_conditions TO authenticated;
