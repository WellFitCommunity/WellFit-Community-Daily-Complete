-- ============================================================================
-- Auto-Generate Realistic Clinical Data for Hospital Patients
-- ============================================================================
-- Purpose: Generate vitals, medications, conditions for testing
-- ============================================================================

-- Function to generate realistic vitals based on acuity
CREATE OR REPLACE FUNCTION generate_hospital_patient_vitals(
  p_patient_id UUID,
  p_acuity_level TEXT DEFAULT '3-Moderate'
) RETURNS VOID AS $$
DECLARE
  v_bp_systolic INTEGER;
  v_bp_diastolic INTEGER;
  v_heart_rate INTEGER;
  v_o2_sat INTEGER;
  v_temp NUMERIC;
  v_resp_rate INTEGER;
BEGIN
  -- Set vitals based on acuity
  CASE p_acuity_level
    WHEN '1-Critical' THEN
      v_bp_systolic := 80 + (random() * 30)::INTEGER;  -- 80-110 (low)
      v_bp_diastolic := 50 + (random() * 20)::INTEGER;
      v_heart_rate := 110 + (random() * 40)::INTEGER;  -- 110-150 (high)
      v_o2_sat := 88 + (random() * 7)::INTEGER;        -- 88-95 (low)
      v_temp := 38.5 + (random() * 2);                 -- 38.5-40.5 (fever)
      v_resp_rate := 24 + (random() * 10)::INTEGER;
    WHEN '2-High' THEN
      v_bp_systolic := 140 + (random() * 30)::INTEGER; -- 140-170 (high)
      v_bp_diastolic := 85 + (random() * 15)::INTEGER;
      v_heart_rate := 90 + (random() * 30)::INTEGER;
      v_o2_sat := 92 + (random() * 6)::INTEGER;        -- 92-98
      v_temp := 37.8 + (random() * 1.5);
      v_resp_rate := 20 + (random() * 8)::INTEGER;
    ELSE -- Moderate/Low/Stable
      v_bp_systolic := 110 + (random() * 30)::INTEGER; -- 110-140 (normal)
      v_bp_diastolic := 70 + (random() * 15)::INTEGER;
      v_heart_rate := 65 + (random() * 25)::INTEGER;   -- 65-90 (normal)
      v_o2_sat := 95 + (random() * 5)::INTEGER;        -- 95-100
      v_temp := 36.5 + (random() * 1);                 -- 36.5-37.5 (normal)
      v_resp_rate := 12 + (random() * 8)::INTEGER;
  END CASE;

  -- Insert FHIR observations
  INSERT INTO fhir_observations (
    id, patient_id, status, category, code, value_quantity, effective_datetime, issued
  ) VALUES
  -- Blood Pressure
  (gen_random_uuid(), p_patient_id, 'final',
   '[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/observation-category","code":"vital-signs"}]}]'::JSONB,
   '85354-9', -- BP panel LOINC
   jsonb_build_object('value', v_bp_systolic || '/' || v_bp_diastolic, 'unit', 'mmHg'),
   NOW(), NOW()),
  -- Heart Rate
  (gen_random_uuid(), p_patient_id, 'final',
   '[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/observation-category","code":"vital-signs"}]}]'::JSONB,
   '8867-4', -- HR LOINC
   jsonb_build_object('value', v_heart_rate, 'unit', 'bpm'),
   NOW(), NOW()),
  -- O2 Saturation
  (gen_random_uuid(), p_patient_id, 'final',
   '[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/observation-category","code":"vital-signs"}]}]'::JSONB,
   '2708-6', -- O2 sat LOINC
   jsonb_build_object('value', v_o2_sat, 'unit', '%'),
   NOW(), NOW()),
  -- Temperature
  (gen_random_uuid(), p_patient_id, 'final',
   '[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/observation-category","code":"vital-signs"}]}]'::JSONB,
   '8310-5', -- Temp LOINC
   jsonb_build_object('value', ROUND(v_temp::NUMERIC, 1), 'unit', 'Cel'),
   NOW(), NOW()),
  -- Respiratory Rate
  (gen_random_uuid(), p_patient_id, 'final',
   '[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/observation-category","code":"vital-signs"}]}]'::JSONB,
   '9279-1', -- RR LOINC
   jsonb_build_object('value', v_resp_rate, 'unit', '/min'),
   NOW(), NOW());
END;
$$ LANGUAGE plpgsql;

-- Function to generate common hospital medications based on acuity
CREATE OR REPLACE FUNCTION generate_hospital_patient_medications(
  p_patient_id UUID,
  p_acuity_level TEXT DEFAULT '3-Moderate'
) RETURNS VOID AS $$
BEGIN
  -- Common medications based on acuity
  CASE p_acuity_level
    WHEN '1-Critical' THEN
      -- ICU medications
      INSERT INTO fhir_medication_requests (patient_id, status, intent, medication_codeable_concept, dosage_instruction, authored_on)
      VALUES
      (p_patient_id, 'active', 'order',
       '{"coding":[{"system":"http://www.nlm.nih.gov/research/umls/rxnorm","code":"4603","display":"Norepinephrine"}]}'::JSONB,
       '[{"text":"0.1 mcg/kg/min IV continuous","timing":{"repeat":{"frequency":1,"period":1,"periodUnit":"d"}}}]'::JSONB, NOW()),
      (p_patient_id, 'active', 'order',
       '{"coding":[{"system":"http://www.nlm.nih.gov/research/umls/rxnorm","code":"7512","display":"Fentanyl"}]}'::JSONB,
       '[{"text":"50 mcg IV q2h PRN pain","timing":{"repeat":{"frequency":12,"period":1,"periodUnit":"d"}}}]'::JSONB, NOW()),
      (p_patient_id, 'active', 'order',
       '{"coding":[{"system":"http://www.nlm.nih.gov/research/umls/rxnorm","code":"8782","display":"Propofol"}]}'::JSONB,
       '[{"text":"20 mcg/kg/min IV continuous","timing":{"repeat":{"frequency":1,"period":1,"periodUnit":"d"}}}]'::JSONB, NOW());
    WHEN '2-High' THEN
      -- Step-down/telemetry medications
      INSERT INTO fhir_medication_requests (patient_id, status, intent, medication_codeable_concept, dosage_instruction, authored_on)
      VALUES
      (p_patient_id, 'active', 'order',
       '{"coding":[{"system":"http://www.nlm.nih.gov/research/umls/rxnorm","code":"197622","display":"Metoprolol"}]}'::JSONB,
       '[{"text":"25 mg PO BID","timing":{"repeat":{"frequency":2,"period":1,"periodUnit":"d"}}}]'::JSONB, NOW()),
      (p_patient_id, 'active', 'order',
       '{"coding":[{"system":"http://www.nlm.nih.gov/research/umls/rxnorm","code":"29046","display":"Lisinopril"}]}'::JSONB,
       '[{"text":"10 mg PO daily","timing":{"repeat":{"frequency":1,"period":1,"periodUnit":"d"}}}]'::JSONB, NOW()),
      (p_patient_id, 'active', 'order',
       '{"coding":[{"system":"http://www.nlm.nih.gov/research/umls/rxnorm","code":"4337","display":"Heparin"}]}'::JSONB,
       '[{"text":"5000 units SC q12h","timing":{"repeat":{"frequency":2,"period":1,"periodUnit":"d"}}}]'::JSONB, NOW());
    ELSE
      -- Med/surg floor medications
      INSERT INTO fhir_medication_requests (patient_id, status, intent, medication_codeable_concept, dosage_instruction, authored_on)
      VALUES
      (p_patient_id, 'active', 'order',
       '{"coding":[{"system":"http://www.nlm.nih.gov/research/umls/rxnorm","code":"161","display":"Acetaminophen"}]}'::JSONB,
       '[{"text":"650 mg PO q6h PRN pain/fever","timing":{"repeat":{"frequency":4,"period":1,"periodUnit":"d"}}}]'::JSONB, NOW()),
      (p_patient_id, 'active', 'order',
       '{"coding":[{"system":"http://www.nlm.nih.gov/research/umls/rxnorm","code":"6809","display":"Docusate"}]}'::JSONB,
       '[{"text":"100 mg PO BID","timing":{"repeat":{"frequency":2,"period":1,"periodUnit":"d"}}}]'::JSONB, NOW()),
      (p_patient_id, 'active', 'order',
       '{"coding":[{"system":"http://www.nlm.nih.gov/research/umls/rxnorm","code":"203151","display":"Omeprazole"}]}'::JSONB,
       '[{"text":"20 mg PO daily","timing":{"repeat":{"frequency":1,"period":1,"periodUnit":"d"}}}]'::JSONB, NOW());
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to generate common hospital conditions
CREATE OR REPLACE FUNCTION generate_hospital_patient_conditions(
  p_patient_id UUID,
  p_enrollment_notes TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  -- Parse common conditions from enrollment notes
  IF p_enrollment_notes ILIKE '%post-surgery%' OR p_enrollment_notes ILIKE '%CABG%' THEN
    INSERT INTO fhir_conditions (patient_id, clinical_status, verification_status, category, code, onset_datetime, recorded_date)
    VALUES (p_patient_id, 'active', 'confirmed',
            '[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/condition-category","code":"encounter-diagnosis"}]}]'::JSONB,
            '{"coding":[{"system":"http://snomed.info/sct","code":"429559004","display":"Coronary artery bypass graft"}]}'::JSONB,
            NOW() - INTERVAL '3 days', NOW());
  END IF;

  IF p_enrollment_notes ILIKE '%diabetes%' THEN
    INSERT INTO fhir_conditions (patient_id, clinical_status, verification_status, category, code, onset_datetime, recorded_date)
    VALUES (p_patient_id, 'active', 'confirmed',
            '[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/condition-category","code":"problem-list-item"}]}]'::JSONB,
            '{"coding":[{"system":"http://snomed.info/sct","code":"44054006","display":"Type 2 diabetes mellitus"}]}'::JSONB,
            NOW() - INTERVAL '5 years', NOW());
  END IF;

  IF p_enrollment_notes ILIKE '%CHF%' OR p_enrollment_notes ILIKE '%heart failure%' THEN
    INSERT INTO fhir_conditions (patient_id, clinical_status, verification_status, category, code, onset_datetime, recorded_date)
    VALUES (p_patient_id, 'active', 'confirmed',
            '[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/condition-category","code":"problem-list-item"}]}]'::JSONB,
            '{"coding":[{"system":"http://snomed.info/sct","code":"42343007","display":"Congestive heart failure"}]}'::JSONB,
            NOW() - INTERVAL '2 years', NOW());
  END IF;

  IF p_enrollment_notes ILIKE '%stroke%' THEN
    INSERT INTO fhir_conditions (patient_id, clinical_status, verification_status, category, code, onset_datetime, recorded_date)
    VALUES (p_patient_id, 'active', 'confirmed',
            '[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/condition-category","code":"encounter-diagnosis"}]}]'::JSONB,
            '{"coding":[{"system":"http://snomed.info/sct","code":"230690007","display":"Cerebrovascular accident"}]}'::JSONB,
            NOW() - INTERVAL '1 month', NOW());
  END IF;

  IF p_enrollment_notes ILIKE '%COPD%' THEN
    INSERT INTO fhir_conditions (patient_id, clinical_status, verification_status, category, code, onset_datetime, recorded_date)
    VALUES (p_patient_id, 'active', 'confirmed',
            '[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/condition-category","code":"problem-list-item"}]}]'::JSONB,
            '{"coding":[{"system":"http://snomed.info/sct","code":"13645005","display":"Chronic obstructive pulmonary disease"}]}'::JSONB,
            NOW() - INTERVAL '10 years', NOW());
  END IF;

  -- Always add hypertension for hospital patients (common)
  INSERT INTO fhir_conditions (patient_id, clinical_status, verification_status, category, code, onset_datetime, recorded_date)
  VALUES (p_patient_id, 'active', 'confirmed',
          '[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/condition-category","code":"problem-list-item"}]}]'::JSONB,
          '{"coding":[{"system":"http://snomed.info/sct","code":"38341003","display":"Essential hypertension"}]}'::JSONB,
          NOW() - INTERVAL '3 years', NOW());
END;
$$ LANGUAGE plpgsql;

-- Main function to auto-generate ALL clinical data
CREATE OR REPLACE FUNCTION auto_generate_clinical_data_for_hospital_patient(
  p_patient_id UUID
) RETURNS TEXT AS $$
DECLARE
  v_patient RECORD;
  v_result TEXT;
BEGIN
  -- Get patient info
  SELECT acuity_level, enrollment_notes
  INTO v_patient
  FROM profiles
  WHERE user_id = p_patient_id AND enrollment_type = 'hospital';

  IF NOT FOUND THEN
    RETURN 'ERROR: Patient not found or not a hospital patient';
  END IF;

  -- Generate vitals
  PERFORM generate_hospital_patient_vitals(p_patient_id, v_patient.acuity_level);

  -- Generate medications
  PERFORM generate_hospital_patient_medications(p_patient_id, v_patient.acuity_level);

  -- Generate conditions
  PERFORM generate_hospital_patient_conditions(p_patient_id, v_patient.enrollment_notes);

  -- Generate handoff risk score
  PERFORM calculate_shift_handoff_risk(p_patient_id, 'night');

  RETURN 'SUCCESS: Generated vitals, medications, conditions, and risk scores for patient ' || p_patient_id::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Bulk generate for ALL hospital patients
CREATE OR REPLACE FUNCTION auto_generate_clinical_data_for_all_hospital_patients()
RETURNS TABLE(patient_name TEXT, result TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (first_name || ' ' || last_name)::TEXT as patient_name,
    auto_generate_clinical_data_for_hospital_patient(user_id)::TEXT as result
  FROM profiles
  WHERE enrollment_type = 'hospital'
    AND user_id NOT IN (
      -- Skip if already has vitals
      SELECT DISTINCT patient_id FROM fhir_observations WHERE patient_id IS NOT NULL
    );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION generate_hospital_patient_vitals TO authenticated;
GRANT EXECUTE ON FUNCTION generate_hospital_patient_medications TO authenticated;
GRANT EXECUTE ON FUNCTION generate_hospital_patient_conditions TO authenticated;
GRANT EXECUTE ON FUNCTION auto_generate_clinical_data_for_hospital_patient TO authenticated;
GRANT EXECUTE ON FUNCTION auto_generate_clinical_data_for_all_hospital_patients TO authenticated;

-- Usage:
-- SELECT * FROM auto_generate_clinical_data_for_all_hospital_patients();
