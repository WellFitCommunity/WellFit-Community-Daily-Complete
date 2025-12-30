-- Migration: Demo Data for Methodist Hospital Demo
-- Created: 2025-12-26
-- Purpose: Populate demo data for the December 5th Methodist Hospital demo
-- This adds sample medications, practitioners, observations, and care plans

-- Default tenant ID for WF-0001
-- Using actual auth.users demo accounts
DO $$
DECLARE
  v_tenant_id UUID := '2b902657-6a20-4435-a78a-576f397517ca';
  -- Demo users from auth.users table
  v_gloria_simmons UUID := 'd1a0b0c0-1111-4000-8000-000000000001';   -- gloria.simmons.demo
  v_harold_washington UUID := 'd1a0b0c0-2222-4000-8000-000000000002'; -- harold.washington.demo
  v_betty_coleman UUID := 'd1a0b0c0-3333-4000-8000-000000000003';     -- betty.coleman.demo
  v_marcus_thompson UUID := 'd1a0b0c0-4444-4000-8000-000000000004';   -- marcus.thompson.demo
  v_practitioner1 UUID;
  v_practitioner2 UUID;
  v_practitioner3 UUID;
  v_care_plan1 UUID;
  -- Admin user for created_by fields (Maria)
  v_maria_admin UUID := 'ba4f20ad-2707-467b-a87f-d46fe9255d2f';
BEGIN

  -- ============================================
  -- FHIR PRACTITIONERS (Demo Healthcare Providers)
  -- ============================================

  -- Dr. Sarah Chen - Primary Care Physician
  INSERT INTO fhir_practitioners (
    id, family_name, given_names, prefix, npi, taxonomy_code,
    specialties, specialty_codes, specialty_display, gender, active,
    email, phone, bio, tenant_id
  ) VALUES (
    gen_random_uuid(),
    'Chen',
    ARRAY['Sarah', 'Elizabeth'],
    ARRAY['Dr.'],
    '1234567890',
    '208D00000X',
    ARRAY['Internal Medicine', 'Geriatrics'],
    ARRAY['207R00000X', '207RG0100X'],
    ARRAY['Internal Medicine', 'Geriatric Medicine'],
    'female',
    true,
    'sarah.chen@methodist.org',
    '713-555-0101',
    'Board-certified internist specializing in geriatric care with 15 years of experience.',
    v_tenant_id
  ) RETURNING id INTO v_practitioner1;

  -- Dr. Michael Torres - Cardiologist
  INSERT INTO fhir_practitioners (
    id, family_name, given_names, prefix, npi, taxonomy_code,
    specialties, specialty_codes, specialty_display, gender, active,
    email, phone, bio, tenant_id
  ) VALUES (
    gen_random_uuid(),
    'Torres',
    ARRAY['Michael', 'Antonio'],
    ARRAY['Dr.'],
    '1234567891',
    '207RC0000X',
    ARRAY['Cardiology'],
    ARRAY['207RC0000X'],
    ARRAY['Cardiovascular Disease'],
    'male',
    true,
    'michael.torres@methodist.org',
    '713-555-0102',
    'Interventional cardiologist focusing on preventive cardiac care.',
    v_tenant_id
  ) RETURNING id INTO v_practitioner2;

  -- Nurse Practitioner Angela Davis
  INSERT INTO fhir_practitioners (
    id, family_name, given_names, prefix, npi, taxonomy_code,
    specialties, specialty_codes, specialty_display, gender, active,
    email, phone, bio, tenant_id
  ) VALUES (
    gen_random_uuid(),
    'Davis',
    ARRAY['Angela', 'Marie'],
    ARRAY['NP'],
    '1234567892',
    '363L00000X',
    ARRAY['Family Nurse Practitioner'],
    ARRAY['363L00000X'],
    ARRAY['Nurse Practitioner'],
    'female',
    true,
    'angela.davis@methodist.org',
    '713-555-0103',
    'Experienced nurse practitioner specializing in chronic disease management.',
    v_tenant_id
  ) RETURNING id INTO v_practitioner3;

  -- ============================================
  -- MEDICATIONS (Sample prescriptions)
  -- ============================================

  -- Gloria Simmons - Hypertension & Diabetes (Senior patient)
  INSERT INTO medications (
    id, user_id, medication_name, generic_name, brand_name, dosage, dosage_form,
    strength, instructions, frequency, route, prescribed_by, prescribed_date,
    quantity, refills_remaining, purpose, status, tenant_id
  ) VALUES
  (gen_random_uuid(), v_gloria_simmons, 'Lisinopril', 'Lisinopril', 'Zestril', '10mg', 'tablet',
   '10mg', 'Take one tablet daily in the morning', 'once daily', 'oral', 'Dr. Sarah Chen',
   CURRENT_DATE - INTERVAL '30 days', 90, 3, 'Blood pressure control', 'active', v_tenant_id),

  (gen_random_uuid(), v_gloria_simmons, 'Metformin', 'Metformin HCl', 'Glucophage', '500mg', 'tablet',
   '500mg', 'Take one tablet twice daily with meals', 'twice daily', 'oral', 'Dr. Sarah Chen',
   CURRENT_DATE - INTERVAL '30 days', 180, 5, 'Type 2 diabetes management', 'active', v_tenant_id),

  (gen_random_uuid(), v_gloria_simmons, 'Atorvastatin', 'Atorvastatin Calcium', 'Lipitor', '20mg', 'tablet',
   '20mg', 'Take one tablet at bedtime', 'once daily', 'oral', 'Dr. Michael Torres',
   CURRENT_DATE - INTERVAL '60 days', 90, 2, 'Cholesterol management', 'active', v_tenant_id);

  -- Harold Washington - Heart conditions
  INSERT INTO medications (
    id, user_id, medication_name, generic_name, brand_name, dosage, dosage_form,
    strength, instructions, frequency, route, prescribed_by, prescribed_date,
    quantity, refills_remaining, purpose, status, tenant_id
  ) VALUES
  (gen_random_uuid(), v_harold_washington, 'Amlodipine', 'Amlodipine Besylate', 'Norvasc', '5mg', 'tablet',
   '5mg', 'Take one tablet daily', 'once daily', 'oral', 'Dr. Michael Torres',
   CURRENT_DATE - INTERVAL '45 days', 90, 4, 'Blood pressure control', 'active', v_tenant_id),

  (gen_random_uuid(), v_harold_washington, 'Aspirin', 'Aspirin', 'Bayer', '81mg', 'tablet',
   '81mg', 'Take one tablet daily with food', 'once daily', 'oral', 'Dr. Michael Torres',
   CURRENT_DATE - INTERVAL '90 days', 100, 5, 'Heart attack prevention', 'active', v_tenant_id),

  (gen_random_uuid(), v_harold_washington, 'Metoprolol', 'Metoprolol Succinate', 'Toprol-XL', '50mg', 'tablet',
   '50mg', 'Take one tablet daily in the morning', 'once daily', 'oral', 'Dr. Michael Torres',
   CURRENT_DATE - INTERVAL '45 days', 90, 3, 'Heart rate control', 'active', v_tenant_id);

  -- Betty Coleman - Arthritis & Pain management
  INSERT INTO medications (
    id, user_id, medication_name, generic_name, brand_name, dosage, dosage_form,
    strength, instructions, frequency, route, prescribed_by, prescribed_date,
    quantity, refills_remaining, purpose, status, tenant_id
  ) VALUES
  (gen_random_uuid(), v_betty_coleman, 'Meloxicam', 'Meloxicam', 'Mobic', '15mg', 'tablet',
   '15mg', 'Take one tablet daily with food', 'once daily', 'oral', 'Dr. Sarah Chen',
   CURRENT_DATE - INTERVAL '20 days', 30, 2, 'Arthritis pain relief', 'active', v_tenant_id),

  (gen_random_uuid(), v_betty_coleman, 'Omeprazole', 'Omeprazole', 'Prilosec', '20mg', 'capsule',
   '20mg', 'Take one capsule before breakfast', 'once daily', 'oral', 'Dr. Sarah Chen',
   CURRENT_DATE - INTERVAL '20 days', 30, 3, 'Stomach protection', 'active', v_tenant_id),

  (gen_random_uuid(), v_betty_coleman, 'Calcium + Vitamin D', 'Calcium Carbonate/D3', 'Caltrate', '600mg/400IU', 'tablet',
   '600mg/400IU', 'Take one tablet twice daily with meals', 'twice daily', 'oral', 'Dr. Sarah Chen',
   CURRENT_DATE - INTERVAL '30 days', 60, 5, 'Bone health', 'active', v_tenant_id);

  -- Marcus Thompson - Respiratory & Chronic conditions
  INSERT INTO medications (
    id, user_id, medication_name, generic_name, brand_name, dosage, dosage_form,
    strength, instructions, frequency, route, prescribed_by, prescribed_date,
    quantity, refills_remaining, purpose, status, tenant_id
  ) VALUES
  (gen_random_uuid(), v_marcus_thompson, 'Montelukast', 'Montelukast Sodium', 'Singulair', '10mg', 'tablet',
   '10mg', 'Take one tablet at bedtime', 'once daily', 'oral', 'Dr. Sarah Chen',
   CURRENT_DATE - INTERVAL '30 days', 30, 4, 'Asthma prevention', 'active', v_tenant_id),

  (gen_random_uuid(), v_marcus_thompson, 'Albuterol', 'Albuterol Sulfate', 'ProAir HFA', '90mcg', 'inhaler',
   '90mcg/actuation', 'Use 2 puffs every 4-6 hours as needed for shortness of breath', 'as needed', 'inhalation', 'Dr. Sarah Chen',
   CURRENT_DATE - INTERVAL '30 days', 1, 2, 'Asthma rescue', 'active', v_tenant_id),

  (gen_random_uuid(), v_marcus_thompson, 'Gabapentin', 'Gabapentin', 'Neurontin', '300mg', 'capsule',
   '300mg', 'Take one capsule three times daily', 'three times daily', 'oral', 'Dr. Sarah Chen',
   CURRENT_DATE - INTERVAL '45 days', 90, 3, 'Nerve pain management', 'active', v_tenant_id);

  -- ============================================
  -- FHIR OBSERVATIONS (Vitals data)
  -- ============================================

  -- Gloria Simmons - Recent vitals (Diabetic with HTN)
  INSERT INTO fhir_observations (
    id, fhir_id, status, category, code_system, code, code_display,
    patient_id, effective_datetime, value_quantity_value, value_quantity_unit,
    value_quantity_code, value_quantity_system, tenant_id
  ) VALUES
  -- Blood Pressure Systolic
  (gen_random_uuid(), 'obs-' || gen_random_uuid()::text, 'final',
   ARRAY['vital-signs'], 'http://loinc.org', '8480-6', 'Systolic blood pressure',
   v_gloria_simmons, NOW() - INTERVAL '2 hours', 138, 'mmHg', 'mm[Hg]', 'http://unitsofmeasure.org', v_tenant_id),
  -- Blood Pressure Diastolic
  (gen_random_uuid(), 'obs-' || gen_random_uuid()::text, 'final',
   ARRAY['vital-signs'], 'http://loinc.org', '8462-4', 'Diastolic blood pressure',
   v_gloria_simmons, NOW() - INTERVAL '2 hours', 85, 'mmHg', 'mm[Hg]', 'http://unitsofmeasure.org', v_tenant_id),
  -- Heart Rate
  (gen_random_uuid(), 'obs-' || gen_random_uuid()::text, 'final',
   ARRAY['vital-signs'], 'http://loinc.org', '8867-4', 'Heart rate',
   v_gloria_simmons, NOW() - INTERVAL '2 hours', 72, 'beats/min', '/min', 'http://unitsofmeasure.org', v_tenant_id),
  -- Blood Glucose
  (gen_random_uuid(), 'obs-' || gen_random_uuid()::text, 'final',
   ARRAY['vital-signs'], 'http://loinc.org', '2339-0', 'Glucose [Mass/volume] in Blood',
   v_gloria_simmons, NOW() - INTERVAL '4 hours', 118, 'mg/dL', 'mg/dL', 'http://unitsofmeasure.org', v_tenant_id),
  -- Weight
  (gen_random_uuid(), 'obs-' || gen_random_uuid()::text, 'final',
   ARRAY['vital-signs'], 'http://loinc.org', '29463-7', 'Body weight',
   v_gloria_simmons, NOW() - INTERVAL '1 day', 165, 'lb', '[lb_av]', 'http://unitsofmeasure.org', v_tenant_id);

  -- Harold Washington - Recent vitals (Cardiac patient)
  INSERT INTO fhir_observations (
    id, fhir_id, status, category, code_system, code, code_display,
    patient_id, effective_datetime, value_quantity_value, value_quantity_unit,
    value_quantity_code, value_quantity_system, tenant_id
  ) VALUES
  (gen_random_uuid(), 'obs-' || gen_random_uuid()::text, 'final',
   ARRAY['vital-signs'], 'http://loinc.org', '8480-6', 'Systolic blood pressure',
   v_harold_washington, NOW() - INTERVAL '3 hours', 142, 'mmHg', 'mm[Hg]', 'http://unitsofmeasure.org', v_tenant_id),
  (gen_random_uuid(), 'obs-' || gen_random_uuid()::text, 'final',
   ARRAY['vital-signs'], 'http://loinc.org', '8462-4', 'Diastolic blood pressure',
   v_harold_washington, NOW() - INTERVAL '3 hours', 88, 'mmHg', 'mm[Hg]', 'http://unitsofmeasure.org', v_tenant_id),
  (gen_random_uuid(), 'obs-' || gen_random_uuid()::text, 'final',
   ARRAY['vital-signs'], 'http://loinc.org', '8867-4', 'Heart rate',
   v_harold_washington, NOW() - INTERVAL '3 hours', 68, 'beats/min', '/min', 'http://unitsofmeasure.org', v_tenant_id),
  (gen_random_uuid(), 'obs-' || gen_random_uuid()::text, 'final',
   ARRAY['vital-signs'], 'http://loinc.org', '2708-6', 'Oxygen saturation',
   v_harold_washington, NOW() - INTERVAL '3 hours', 97, '%', '%', 'http://unitsofmeasure.org', v_tenant_id);

  -- Betty Coleman - Recent vitals (Arthritis patient)
  INSERT INTO fhir_observations (
    id, fhir_id, status, category, code_system, code, code_display,
    patient_id, effective_datetime, value_quantity_value, value_quantity_unit,
    value_quantity_code, value_quantity_system, tenant_id
  ) VALUES
  (gen_random_uuid(), 'obs-' || gen_random_uuid()::text, 'final',
   ARRAY['vital-signs'], 'http://loinc.org', '8480-6', 'Systolic blood pressure',
   v_betty_coleman, NOW() - INTERVAL '1 day', 128, 'mmHg', 'mm[Hg]', 'http://unitsofmeasure.org', v_tenant_id),
  (gen_random_uuid(), 'obs-' || gen_random_uuid()::text, 'final',
   ARRAY['vital-signs'], 'http://loinc.org', '8462-4', 'Diastolic blood pressure',
   v_betty_coleman, NOW() - INTERVAL '1 day', 78, 'mmHg', 'mm[Hg]', 'http://unitsofmeasure.org', v_tenant_id),
  (gen_random_uuid(), 'obs-' || gen_random_uuid()::text, 'final',
   ARRAY['vital-signs'], 'http://loinc.org', '8310-5', 'Body temperature',
   v_betty_coleman, NOW() - INTERVAL '1 day', 98.4, 'degF', '[degF]', 'http://unitsofmeasure.org', v_tenant_id);

  -- Marcus Thompson - Recent vitals (Respiratory patient)
  INSERT INTO fhir_observations (
    id, fhir_id, status, category, code_system, code, code_display,
    patient_id, effective_datetime, value_quantity_value, value_quantity_unit,
    value_quantity_code, value_quantity_system, tenant_id
  ) VALUES
  (gen_random_uuid(), 'obs-' || gen_random_uuid()::text, 'final',
   ARRAY['vital-signs'], 'http://loinc.org', '8480-6', 'Systolic blood pressure',
   v_marcus_thompson, NOW() - INTERVAL '6 hours', 125, 'mmHg', 'mm[Hg]', 'http://unitsofmeasure.org', v_tenant_id),
  (gen_random_uuid(), 'obs-' || gen_random_uuid()::text, 'final',
   ARRAY['vital-signs'], 'http://loinc.org', '8462-4', 'Diastolic blood pressure',
   v_marcus_thompson, NOW() - INTERVAL '6 hours', 80, 'mmHg', 'mm[Hg]', 'http://unitsofmeasure.org', v_tenant_id),
  (gen_random_uuid(), 'obs-' || gen_random_uuid()::text, 'final',
   ARRAY['vital-signs'], 'http://loinc.org', '8867-4', 'Heart rate',
   v_marcus_thompson, NOW() - INTERVAL '6 hours', 76, 'beats/min', '/min', 'http://unitsofmeasure.org', v_tenant_id),
  (gen_random_uuid(), 'obs-' || gen_random_uuid()::text, 'final',
   ARRAY['vital-signs'], 'http://loinc.org', '2708-6', 'Oxygen saturation',
   v_marcus_thompson, NOW() - INTERVAL '6 hours', 95, '%', '%', 'http://unitsofmeasure.org', v_tenant_id);

  -- ============================================
  -- CARE COORDINATION PLANS
  -- ============================================

  -- Care plan for Gloria Simmons - Diabetes & HTN management
  INSERT INTO care_coordination_plans (
    id, patient_id, tenant_id, plan_type, status, priority, title, goals,
    interventions, start_date, next_review_date, primary_coordinator_id, created_by
  ) VALUES (
    gen_random_uuid(),
    v_gloria_simmons,
    v_tenant_id,
    'chronic_care',
    'active',
    'high',
    'Diabetes & Hypertension Management Plan',
    '["Maintain A1C below 7%", "Blood pressure goal < 130/80", "Daily glucose monitoring", "Weight loss of 10 lbs in 6 months"]'::jsonb,
    '["Medication adherence monitoring", "Lifestyle counseling", "Monthly lab reviews", "Diet modification support"]'::jsonb,
    CURRENT_DATE - INTERVAL '30 days',
    CURRENT_DATE + INTERVAL '60 days',
    v_maria_admin,
    v_maria_admin
  ) RETURNING id INTO v_care_plan1;

  -- Care plan for Harold Washington - Cardiac care
  INSERT INTO care_coordination_plans (
    id, patient_id, tenant_id, plan_type, status, priority, title, goals,
    interventions, start_date, next_review_date, primary_coordinator_id, created_by
  ) VALUES (
    gen_random_uuid(),
    v_harold_washington,
    v_tenant_id,
    'readmission_prevention',
    'active',
    'high',
    'Cardiac Health Optimization Plan',
    '["Blood pressure < 130/80", "LDL cholesterol < 70", "Exercise 150 min/week", "Medication adherence > 95%"]'::jsonb,
    '["Cardiac rehabilitation program", "Medication optimization", "Lifestyle modification", "Regular cardiology follow-up"]'::jsonb,
    CURRENT_DATE - INTERVAL '45 days',
    CURRENT_DATE + INTERVAL '45 days',
    v_maria_admin,
    v_maria_admin
  );

  -- Care plan for Betty Coleman - Arthritis management
  INSERT INTO care_coordination_plans (
    id, patient_id, tenant_id, plan_type, status, priority, title, goals,
    interventions, start_date, next_review_date, primary_coordinator_id, created_by
  ) VALUES (
    gen_random_uuid(),
    v_betty_coleman,
    v_tenant_id,
    'chronic_care',
    'active',
    'medium',
    'Arthritis & Bone Health Management Plan',
    '["Pain level < 4/10", "Maintain mobility", "Fall prevention exercises daily", "Calcium/Vitamin D compliance"]'::jsonb,
    '["Physical therapy referral", "Pain management", "Fall risk assessment", "Bone density monitoring"]'::jsonb,
    CURRENT_DATE - INTERVAL '20 days',
    CURRENT_DATE + INTERVAL '70 days',
    v_maria_admin,
    v_maria_admin
  );

  -- ============================================
  -- CARE TEAM MEMBERS
  -- ============================================

  -- Gloria Simmons' care team
  INSERT INTO care_team_members (
    id, patient_id, member_id, member_name, member_role, member_specialty,
    member_email, is_primary, start_date, tenant_id
  ) VALUES
  (gen_random_uuid(), v_gloria_simmons, v_maria_admin, 'Dr. Sarah Chen', 'Primary Care Physician',
   'Internal Medicine', 'sarah.chen@methodist.org', true, CURRENT_DATE - INTERVAL '90 days', v_tenant_id),
  (gen_random_uuid(), v_gloria_simmons, v_maria_admin, 'Dr. Michael Torres', 'Consulting Cardiologist',
   'Cardiology', 'michael.torres@methodist.org', false, CURRENT_DATE - INTERVAL '30 days', v_tenant_id);

  -- Harold Washington's care team
  INSERT INTO care_team_members (
    id, patient_id, member_id, member_name, member_role, member_specialty,
    member_email, is_primary, start_date, tenant_id
  ) VALUES
  (gen_random_uuid(), v_harold_washington, v_maria_admin, 'Dr. Michael Torres', 'Primary Cardiologist',
   'Cardiology', 'michael.torres@methodist.org', true, CURRENT_DATE - INTERVAL '60 days', v_tenant_id),
  (gen_random_uuid(), v_harold_washington, v_maria_admin, 'Dr. Sarah Chen', 'Primary Care Physician',
   'Internal Medicine', 'sarah.chen@methodist.org', false, CURRENT_DATE - INTERVAL '120 days', v_tenant_id);

  -- Betty Coleman's care team
  INSERT INTO care_team_members (
    id, patient_id, member_id, member_name, member_role, member_specialty,
    member_email, is_primary, start_date, tenant_id
  ) VALUES
  (gen_random_uuid(), v_betty_coleman, v_maria_admin, 'Dr. Sarah Chen', 'Primary Care Physician',
   'Internal Medicine', 'sarah.chen@methodist.org', true, CURRENT_DATE - INTERVAL '60 days', v_tenant_id),
  (gen_random_uuid(), v_betty_coleman, v_maria_admin, 'NP Angela Davis', 'Care Coordinator',
   'Nursing', 'angela.davis@methodist.org', false, CURRENT_DATE - INTERVAL '20 days', v_tenant_id);

  -- ============================================
  -- CARE COORDINATION NOTES
  -- ============================================

  INSERT INTO care_coordination_notes (
    id, patient_id, author_id, note_type, content, is_confidential, tenant_id
  ) VALUES
  (gen_random_uuid(), v_gloria_simmons, v_maria_admin, 'progress',
   'Patient reports improved compliance with medication regimen. Blood glucose readings trending down. Continue current plan.',
   false, v_tenant_id),
  (gen_random_uuid(), v_gloria_simmons, v_maria_admin, 'care_plan',
   'Recent labs show A1C at 7.2%, down from 7.8%. Blood pressure well controlled at 138/85. Recommend continuing current medications.',
   false, v_tenant_id);

  RAISE NOTICE 'Demo data migration completed successfully';
  RAISE NOTICE 'Created: 3 practitioners, 12 medications, 16 observations, 3 care plans, 6 care team members, 2 care notes';

END $$;

-- Verify the migration
DO $$
BEGIN
  RAISE NOTICE 'Verification:';
  RAISE NOTICE '- Practitioners: %', (SELECT COUNT(*) FROM fhir_practitioners WHERE tenant_id = '2b902657-6a20-4435-a78a-576f397517ca');
  RAISE NOTICE '- Medications: %', (SELECT COUNT(*) FROM medications WHERE tenant_id = '2b902657-6a20-4435-a78a-576f397517ca');
  RAISE NOTICE '- Observations: %', (SELECT COUNT(*) FROM fhir_observations WHERE tenant_id = '2b902657-6a20-4435-a78a-576f397517ca');
  RAISE NOTICE '- Care Plans: %', (SELECT COUNT(*) FROM care_coordination_plans WHERE tenant_id = '2b902657-6a20-4435-a78a-576f397517ca');
  RAISE NOTICE '- Care Team Members: %', (SELECT COUNT(*) FROM care_team_members WHERE tenant_id = '2b902657-6a20-4435-a78a-576f397517ca');
END $$;
