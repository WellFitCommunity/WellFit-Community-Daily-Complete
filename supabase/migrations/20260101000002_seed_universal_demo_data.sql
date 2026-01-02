-- Universal Demo Data Seed
-- Purpose: Populate database with realistic demo data for any client presentation
-- Safe to run multiple times (uses ON CONFLICT DO NOTHING)

-- ============================================================================
-- DEMO TENANT (if not exists)
-- ============================================================================
INSERT INTO tenants (id, name, tenant_code, subdomain, created_at)
VALUES (
  '2b902657-6a20-4435-a78a-576f397517ca',
  'WellFit Demo',
  'WF-0001',
  'demo',
  NOW()
) ON CONFLICT (id) DO UPDATE SET name = 'WellFit Demo';

-- ============================================================================
-- DEMO USERS (auth.users) - These need to exist for FK constraints
-- Using fixed UUIDs so we can reference them consistently
-- ============================================================================

-- Demo Patient 1: Eleanor Thompson (Senior with complex care needs)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
  'a1111111-1111-1111-1111-111111111111',
  'eleanor.thompson@demo.wellfit.com',
  '$2a$10$demo_password_hash_not_real',
  NOW(),
  NOW() - INTERVAL '6 months',
  NOW(),
  '{"first_name": "Eleanor", "last_name": "Thompson"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Demo Patient 2: Robert Chen (Diabetic patient)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
  'a2222222-2222-2222-2222-222222222222',
  'robert.chen@demo.wellfit.com',
  '$2a$10$demo_password_hash_not_real',
  NOW(),
  NOW() - INTERVAL '4 months',
  NOW(),
  '{"first_name": "Robert", "last_name": "Chen"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Demo Patient 3: Maria Santos (Post-surgery recovery)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
  'a3333333-3333-3333-3333-333333333333',
  'maria.santos@demo.wellfit.com',
  '$2a$10$demo_password_hash_not_real',
  NOW(),
  NOW() - INTERVAL '2 months',
  NOW(),
  '{"first_name": "Maria", "last_name": "Santos"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Demo Physician: Dr. Sarah Williams
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
  'b1111111-1111-1111-1111-111111111111',
  'dr.williams@demo.wellfit.com',
  '$2a$10$demo_password_hash_not_real',
  NOW(),
  NOW() - INTERVAL '1 year',
  NOW(),
  '{"first_name": "Sarah", "last_name": "Williams"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Demo Nurse: James Rodriguez
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
  'b2222222-2222-2222-2222-222222222222',
  'james.rodriguez@demo.wellfit.com',
  '$2a$10$demo_password_hash_not_real',
  NOW(),
  NOW() - INTERVAL '8 months',
  NOW(),
  '{"first_name": "James", "last_name": "Rodriguez"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Demo Case Manager: Lisa Park
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
  'b3333333-3333-3333-3333-333333333333',
  'lisa.park@demo.wellfit.com',
  '$2a$10$demo_password_hash_not_real',
  NOW(),
  NOW() - INTERVAL '6 months',
  NOW(),
  '{"first_name": "Lisa", "last_name": "Park"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Demo CHW: Marcus Johnson
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
  'b4444444-4444-4444-4444-444444444444',
  'marcus.johnson@demo.wellfit.com',
  '$2a$10$demo_password_hash_not_real',
  NOW(),
  NOW() - INTERVAL '3 months',
  NOW(),
  '{"first_name": "Marcus", "last_name": "Johnson"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- DEMO PROFILES (using INSERT only, no UPDATE to avoid trigger issues)
-- ============================================================================

-- Eleanor Thompson - Senior patient
INSERT INTO profiles (user_id, role_id, email, first_name, last_name, phone, dob, gender, city, state, zip_code, tenant_id, onboarded, consent, created_at)
VALUES (
  'a1111111-1111-1111-1111-111111111111',
  19, -- patient role
  'eleanor.thompson@demo.wellfit.com',
  'Eleanor',
  'Thompson',
  '555-0101',
  '1945-03-15',
  'Female',
  'Houston',
  'TX',
  '77001',
  '2b902657-6a20-4435-a78a-576f397517ca',
  true,
  true,
  NOW() - INTERVAL '6 months'
) ON CONFLICT (user_id) DO NOTHING;

-- Robert Chen - Diabetic patient
INSERT INTO profiles (user_id, role_id, email, first_name, last_name, phone, dob, gender, city, state, zip_code, tenant_id, onboarded, consent, created_at)
VALUES (
  'a2222222-2222-2222-2222-222222222222',
  19,
  'robert.chen@demo.wellfit.com',
  'Robert',
  'Chen',
  '555-0102',
  '1958-07-22',
  'Male',
  'Houston',
  'TX',
  '77002',
  '2b902657-6a20-4435-a78a-576f397517ca',
  true,
  true,
  NOW() - INTERVAL '4 months'
) ON CONFLICT (user_id) DO NOTHING;

-- Maria Santos - Post-surgery
INSERT INTO profiles (user_id, role_id, email, first_name, last_name, phone, dob, gender, city, state, zip_code, tenant_id, onboarded, consent, created_at)
VALUES (
  'a3333333-3333-3333-3333-333333333333',
  19,
  'maria.santos@demo.wellfit.com',
  'Maria',
  'Santos',
  '555-0103',
  '1962-11-08',
  'Female',
  'Houston',
  'TX',
  '77003',
  '2b902657-6a20-4435-a78a-576f397517ca',
  true,
  true,
  NOW() - INTERVAL '2 months'
) ON CONFLICT (user_id) DO NOTHING;

-- Dr. Sarah Williams - Physician
INSERT INTO profiles (user_id, role_id, email, first_name, last_name, phone, tenant_id, onboarded, created_at)
VALUES (
  'b1111111-1111-1111-1111-111111111111',
  7, -- physician role
  'dr.williams@demo.wellfit.com',
  'Sarah',
  'Williams',
  '555-0201',
  '2b902657-6a20-4435-a78a-576f397517ca',
  true,
  NOW() - INTERVAL '1 year'
) ON CONFLICT (user_id) DO NOTHING;

-- James Rodriguez - Nurse
INSERT INTO profiles (user_id, role_id, email, first_name, last_name, phone, tenant_id, onboarded, created_at)
VALUES (
  'b2222222-2222-2222-2222-222222222222',
  8, -- nurse role
  'james.rodriguez@demo.wellfit.com',
  'James',
  'Rodriguez',
  '555-0202',
  '2b902657-6a20-4435-a78a-576f397517ca',
  true,
  NOW() - INTERVAL '8 months'
) ON CONFLICT (user_id) DO NOTHING;

-- Lisa Park - Case Manager
INSERT INTO profiles (user_id, role_id, email, first_name, last_name, phone, tenant_id, onboarded, created_at)
VALUES (
  'b3333333-3333-3333-3333-333333333333',
  16, -- case_manager role
  'lisa.park@demo.wellfit.com',
  'Lisa',
  'Park',
  '555-0203',
  '2b902657-6a20-4435-a78a-576f397517ca',
  true,
  NOW() - INTERVAL '6 months'
) ON CONFLICT (user_id) DO NOTHING;

-- Marcus Johnson - CHW
INSERT INTO profiles (user_id, role_id, email, first_name, last_name, phone, tenant_id, onboarded, created_at)
VALUES (
  'b4444444-4444-4444-4444-444444444444',
  17, -- community_health_worker role
  'marcus.johnson@demo.wellfit.com',
  'Marcus',
  'Johnson',
  '555-0204',
  '2b902657-6a20-4435-a78a-576f397517ca',
  true,
  NOW() - INTERVAL '3 months'
) ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- USER ROLES
-- ============================================================================
INSERT INTO user_roles (user_id, role_id, role, tenant_id)
VALUES
  ('b1111111-1111-1111-1111-111111111111', 7, 'physician', '2b902657-6a20-4435-a78a-576f397517ca'),
  ('b2222222-2222-2222-2222-222222222222', 8, 'nurse', '2b902657-6a20-4435-a78a-576f397517ca'),
  ('b3333333-3333-3333-3333-333333333333', 16, 'case_manager', '2b902657-6a20-4435-a78a-576f397517ca'),
  ('b4444444-4444-4444-4444-444444444444', 17, 'community_health_worker', '2b902657-6a20-4435-a78a-576f397517ca')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- FHIR CONDITIONS (Diagnoses)
-- ============================================================================

-- Eleanor Thompson's conditions
INSERT INTO fhir_conditions (id, patient_id, clinical_status, verification_status, code_system, code, code_display, category, onset_datetime, tenant_id)
VALUES
  (gen_random_uuid(), 'a1111111-1111-1111-1111-111111111111', 'active', 'confirmed', 'http://snomed.info/sct', '38341003', 'Hypertension', ARRAY['problem-list-item'], NOW() - INTERVAL '5 years', '2b902657-6a20-4435-a78a-576f397517ca'),
  (gen_random_uuid(), 'a1111111-1111-1111-1111-111111111111', 'active', 'confirmed', 'http://snomed.info/sct', '84114007', 'Heart Failure', ARRAY['problem-list-item'], NOW() - INTERVAL '2 years', '2b902657-6a20-4435-a78a-576f397517ca'),
  (gen_random_uuid(), 'a1111111-1111-1111-1111-111111111111', 'active', 'confirmed', 'http://snomed.info/sct', '195967001', 'Asthma', ARRAY['problem-list-item'], NOW() - INTERVAL '10 years', '2b902657-6a20-4435-a78a-576f397517ca')
ON CONFLICT DO NOTHING;

-- Robert Chen's conditions
INSERT INTO fhir_conditions (id, patient_id, clinical_status, verification_status, code_system, code, code_display, category, onset_datetime, tenant_id)
VALUES
  (gen_random_uuid(), 'a2222222-2222-2222-2222-222222222222', 'active', 'confirmed', 'http://snomed.info/sct', '44054006', 'Type 2 Diabetes Mellitus', ARRAY['problem-list-item'], NOW() - INTERVAL '8 years', '2b902657-6a20-4435-a78a-576f397517ca'),
  (gen_random_uuid(), 'a2222222-2222-2222-2222-222222222222', 'active', 'confirmed', 'http://snomed.info/sct', '13644009', 'Hypercholesterolemia', ARRAY['problem-list-item'], NOW() - INTERVAL '6 years', '2b902657-6a20-4435-a78a-576f397517ca'),
  (gen_random_uuid(), 'a2222222-2222-2222-2222-222222222222', 'active', 'confirmed', 'http://snomed.info/sct', '431855005', 'Chronic Kidney Disease Stage 3', ARRAY['problem-list-item'], NOW() - INTERVAL '3 years', '2b902657-6a20-4435-a78a-576f397517ca')
ON CONFLICT DO NOTHING;

-- Maria Santos's conditions
INSERT INTO fhir_conditions (id, patient_id, clinical_status, verification_status, code_system, code, code_display, category, onset_datetime, tenant_id)
VALUES
  (gen_random_uuid(), 'a3333333-3333-3333-3333-333333333333', 'active', 'confirmed', 'http://snomed.info/sct', '396275006', 'Osteoarthritis of Hip', ARRAY['problem-list-item'], NOW() - INTERVAL '4 years', '2b902657-6a20-4435-a78a-576f397517ca'),
  (gen_random_uuid(), 'a3333333-3333-3333-3333-333333333333', 'resolved', 'confirmed', 'http://snomed.info/sct', '161891005', 'Post Hip Replacement', ARRAY['encounter-diagnosis'], NOW() - INTERVAL '2 months', '2b902657-6a20-4435-a78a-576f397517ca')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ENCOUNTERS
-- ============================================================================
INSERT INTO encounters (id, patient_id, provider_id, encounter_type, date_of_service, status, chief_complaint, tenant_id, created_by)
VALUES
  -- Eleanor's encounters
  (gen_random_uuid(), 'a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'follow_up', CURRENT_DATE - INTERVAL '7 days', 'completed', 'Heart failure follow-up, medication adjustment', '2b902657-6a20-4435-a78a-576f397517ca', 'b1111111-1111-1111-1111-111111111111'),
  (gen_random_uuid(), 'a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'follow_up', CURRENT_DATE - INTERVAL '30 days', 'completed', 'Routine cardiac check', '2b902657-6a20-4435-a78a-576f397517ca', 'b1111111-1111-1111-1111-111111111111'),
  -- Robert's encounters
  (gen_random_uuid(), 'a2222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111', 'follow_up', CURRENT_DATE - INTERVAL '14 days', 'completed', 'Diabetes management review, A1C elevated', '2b902657-6a20-4435-a78a-576f397517ca', 'b1111111-1111-1111-1111-111111111111'),
  -- Maria's encounters
  (gen_random_uuid(), 'a3333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111', 'follow_up', CURRENT_DATE - INTERVAL '3 days', 'completed', 'Post-surgical follow-up, wound healing well', '2b902657-6a20-4435-a78a-576f397517ca', 'b1111111-1111-1111-1111-111111111111'),
  -- Upcoming appointments
  (gen_random_uuid(), 'a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'follow_up', CURRENT_DATE + INTERVAL '3 days', 'draft', 'Scheduled follow-up', '2b902657-6a20-4435-a78a-576f397517ca', 'b1111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- FHIR OBSERVATIONS (Vitals)
-- ============================================================================

-- Eleanor's vitals
INSERT INTO fhir_observations (id, patient_id, status, code_system, code, code_display, value_quantity_value, value_quantity_unit, effective_datetime, tenant_id)
VALUES
  -- Blood Pressure
  (gen_random_uuid(), 'a1111111-1111-1111-1111-111111111111', 'final', 'http://loinc.org', '85354-9', 'Blood Pressure Systolic', 142, 'mmHg', NOW() - INTERVAL '1 day', '2b902657-6a20-4435-a78a-576f397517ca'),
  (gen_random_uuid(), 'a1111111-1111-1111-1111-111111111111', 'final', 'http://loinc.org', '8462-4', 'Blood Pressure Diastolic', 88, 'mmHg', NOW() - INTERVAL '1 day', '2b902657-6a20-4435-a78a-576f397517ca'),
  -- Heart Rate
  (gen_random_uuid(), 'a1111111-1111-1111-1111-111111111111', 'final', 'http://loinc.org', '8867-4', 'Heart Rate', 78, 'bpm', NOW() - INTERVAL '1 day', '2b902657-6a20-4435-a78a-576f397517ca'),
  -- Weight
  (gen_random_uuid(), 'a1111111-1111-1111-1111-111111111111', 'final', 'http://loinc.org', '29463-7', 'Body Weight', 165, 'lb', NOW() - INTERVAL '1 day', '2b902657-6a20-4435-a78a-576f397517ca'),
  -- Oxygen Saturation
  (gen_random_uuid(), 'a1111111-1111-1111-1111-111111111111', 'final', 'http://loinc.org', '2708-6', 'Oxygen Saturation', 96, '%', NOW() - INTERVAL '1 day', '2b902657-6a20-4435-a78a-576f397517ca')
ON CONFLICT DO NOTHING;

-- Robert's vitals (diabetic focus)
INSERT INTO fhir_observations (id, patient_id, status, code_system, code, code_display, value_quantity_value, value_quantity_unit, effective_datetime, tenant_id)
VALUES
  -- Blood Glucose
  (gen_random_uuid(), 'a2222222-2222-2222-2222-222222222222', 'final', 'http://loinc.org', '2339-0', 'Blood Glucose', 156, 'mg/dL', NOW() - INTERVAL '1 day', '2b902657-6a20-4435-a78a-576f397517ca'),
  -- HbA1c
  (gen_random_uuid(), 'a2222222-2222-2222-2222-222222222222', 'final', 'http://loinc.org', '4548-4', 'Hemoglobin A1c', 7.8, '%', NOW() - INTERVAL '14 days', '2b902657-6a20-4435-a78a-576f397517ca'),
  -- Blood Pressure
  (gen_random_uuid(), 'a2222222-2222-2222-2222-222222222222', 'final', 'http://loinc.org', '85354-9', 'Blood Pressure Systolic', 138, 'mmHg', NOW() - INTERVAL '1 day', '2b902657-6a20-4435-a78a-576f397517ca'),
  -- eGFR (kidney function)
  (gen_random_uuid(), 'a2222222-2222-2222-2222-222222222222', 'final', 'http://loinc.org', '48642-3', 'eGFR', 52, 'mL/min/1.73m2', NOW() - INTERVAL '14 days', '2b902657-6a20-4435-a78a-576f397517ca')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MEDICATIONS (using correct column names: medication_name, prescribed_by, prescribed_date)
-- ============================================================================

-- Eleanor's medications
INSERT INTO medications (id, user_id, medication_name, dosage, frequency, prescribed_by, prescribed_date, status, tenant_id)
VALUES
  (gen_random_uuid(), 'a1111111-1111-1111-1111-111111111111', 'Lisinopril', '20mg', 'Once daily', 'Dr. Williams', CURRENT_DATE - INTERVAL '2 years', 'active', '2b902657-6a20-4435-a78a-576f397517ca'),
  (gen_random_uuid(), 'a1111111-1111-1111-1111-111111111111', 'Metoprolol', '50mg', 'Twice daily', 'Dr. Williams', CURRENT_DATE - INTERVAL '2 years', 'active', '2b902657-6a20-4435-a78a-576f397517ca'),
  (gen_random_uuid(), 'a1111111-1111-1111-1111-111111111111', 'Furosemide', '40mg', 'Once daily', 'Dr. Williams', CURRENT_DATE - INTERVAL '1 year', 'active', '2b902657-6a20-4435-a78a-576f397517ca'),
  (gen_random_uuid(), 'a1111111-1111-1111-1111-111111111111', 'Albuterol Inhaler', '2 puffs', 'As needed', 'Dr. Williams', CURRENT_DATE - INTERVAL '5 years', 'active', '2b902657-6a20-4435-a78a-576f397517ca')
ON CONFLICT DO NOTHING;

-- Robert's medications
INSERT INTO medications (id, user_id, medication_name, dosage, frequency, prescribed_by, prescribed_date, status, tenant_id)
VALUES
  (gen_random_uuid(), 'a2222222-2222-2222-2222-222222222222', 'Metformin', '1000mg', 'Twice daily', 'Dr. Williams', CURRENT_DATE - INTERVAL '8 years', 'active', '2b902657-6a20-4435-a78a-576f397517ca'),
  (gen_random_uuid(), 'a2222222-2222-2222-2222-222222222222', 'Jardiance', '25mg', 'Once daily', 'Dr. Williams', CURRENT_DATE - INTERVAL '2 years', 'active', '2b902657-6a20-4435-a78a-576f397517ca'),
  (gen_random_uuid(), 'a2222222-2222-2222-2222-222222222222', 'Atorvastatin', '40mg', 'Once daily at bedtime', 'Dr. Williams', CURRENT_DATE - INTERVAL '6 years', 'active', '2b902657-6a20-4435-a78a-576f397517ca'),
  (gen_random_uuid(), 'a2222222-2222-2222-2222-222222222222', 'Lisinopril', '10mg', 'Once daily', 'Dr. Williams', CURRENT_DATE - INTERVAL '3 years', 'active', '2b902657-6a20-4435-a78a-576f397517ca')
ON CONFLICT DO NOTHING;

-- Maria's medications
INSERT INTO medications (id, user_id, medication_name, dosage, frequency, prescribed_by, prescribed_date, status, tenant_id)
VALUES
  (gen_random_uuid(), 'a3333333-3333-3333-3333-333333333333', 'Acetaminophen', '500mg', 'Every 6 hours as needed', 'Dr. Williams', CURRENT_DATE - INTERVAL '2 months', 'active', '2b902657-6a20-4435-a78a-576f397517ca'),
  (gen_random_uuid(), 'a3333333-3333-3333-3333-333333333333', 'Enoxaparin', '40mg', 'Once daily (blood thinner)', 'Dr. Williams', CURRENT_DATE - INTERVAL '2 months', 'active', '2b902657-6a20-4435-a78a-576f397517ca')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- FHIR IMMUNIZATIONS (using correct column names: vaccine_code, vaccine_display)
-- ============================================================================
INSERT INTO fhir_immunizations (id, patient_id, status, vaccine_code, vaccine_display, occurrence_datetime, tenant_id)
VALUES
  -- Eleanor's immunizations
  (gen_random_uuid(), 'a1111111-1111-1111-1111-111111111111', 'completed', '141', 'Influenza Vaccine 2024-2025', NOW() - INTERVAL '2 months', '2b902657-6a20-4435-a78a-576f397517ca'),
  (gen_random_uuid(), 'a1111111-1111-1111-1111-111111111111', 'completed', '33', 'Pneumococcal Vaccine', NOW() - INTERVAL '3 years', '2b902657-6a20-4435-a78a-576f397517ca'),
  -- Robert's immunizations
  (gen_random_uuid(), 'a2222222-2222-2222-2222-222222222222', 'completed', '141', 'Influenza Vaccine 2024-2025', NOW() - INTERVAL '1 month', '2b902657-6a20-4435-a78a-576f397517ca')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- CHECK-INS (using correct column names: label, emotional_state; id is bigint auto-increment)
-- ============================================================================
INSERT INTO check_ins (user_id, label, emotional_state, bp_systolic, bp_diastolic, created_at, tenant_id)
VALUES
  -- Eleanor's check-ins
  ('a1111111-1111-1111-1111-111111111111', 'Daily Check-in', 'okay', 142, 88, NOW() - INTERVAL '1 day', '2b902657-6a20-4435-a78a-576f397517ca'),
  ('a1111111-1111-1111-1111-111111111111', 'Daily Check-in', 'tired', 145, 90, NOW() - INTERVAL '2 days', '2b902657-6a20-4435-a78a-576f397517ca'),
  ('a1111111-1111-1111-1111-111111111111', 'Daily Check-in', 'good', 138, 85, NOW() - INTERVAL '3 days', '2b902657-6a20-4435-a78a-576f397517ca'),
  -- Robert's check-ins
  ('a2222222-2222-2222-2222-222222222222', 'Daily Check-in', 'okay', 138, 82, NOW() - INTERVAL '1 day', '2b902657-6a20-4435-a78a-576f397517ca'),
  ('a2222222-2222-2222-2222-222222222222', 'Daily Check-in', 'great', 135, 80, NOW() - INTERVAL '2 days', '2b902657-6a20-4435-a78a-576f397517ca'),
  -- Maria's check-ins
  ('a3333333-3333-3333-3333-333333333333', 'Daily Check-in', 'okay', 125, 78, NOW() - INTERVAL '1 day', '2b902657-6a20-4435-a78a-576f397517ca'),
  ('a3333333-3333-3333-3333-333333333333', 'Daily Check-in', 'tired', 128, 80, NOW() - INTERVAL '2 days', '2b902657-6a20-4435-a78a-576f397517ca')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- READMISSION RISK PREDICTIONS (with all required columns)
-- ============================================================================
INSERT INTO readmission_risk_predictions (id, patient_id, tenant_id, discharge_date, readmission_risk_score, risk_category, predicted_readmission_window_days, primary_risk_factors, secondary_risk_factors, recommended_interventions, ai_model_used, prediction_generated_at)
VALUES
  (gen_random_uuid(), 'a1111111-1111-1111-1111-111111111111', '2b902657-6a20-4435-a78a-576f397517ca', CURRENT_DATE - INTERVAL '7 days', 0.68, 'high', 14,
   '[{"factor": "Heart failure diagnosis", "weight": 0.35}, {"factor": "Recent hospitalization", "weight": 0.25}, {"factor": "Multiple medications", "weight": 0.15}]'::jsonb,
   '[{"factor": "Age over 75", "weight": 0.10}]'::jsonb,
   '["Daily weight monitoring", "Medication adherence checks", "Follow-up within 7 days"]'::jsonb,
   'claude-3-5-sonnet-20241022', NOW() - INTERVAL '1 day'),
  (gen_random_uuid(), 'a2222222-2222-2222-2222-222222222222', '2b902657-6a20-4435-a78a-576f397517ca', CURRENT_DATE - INTERVAL '14 days', 0.42, 'medium', 30,
   '[{"factor": "Diabetes with kidney disease", "weight": 0.30}, {"factor": "Elevated A1C", "weight": 0.20}]'::jsonb,
   '[{"factor": "Multiple comorbidities", "weight": 0.10}]'::jsonb,
   '["Blood sugar monitoring", "Diet counseling", "Nephrology follow-up"]'::jsonb,
   'claude-3-5-sonnet-20241022', NOW() - INTERVAL '1 day'),
  (gen_random_uuid(), 'a3333333-3333-3333-3333-333333333333', '2b902657-6a20-4435-a78a-576f397517ca', CURRENT_DATE - INTERVAL '60 days', 0.25, 'low', 60,
   '[{"factor": "Recent surgery", "weight": 0.20}]'::jsonb,
   '[]'::jsonb,
   '["Physical therapy", "Wound care follow-up"]'::jsonb,
   'claude-3-5-sonnet-20241022', NOW() - INTERVAL '1 day')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TELEHEALTH APPOINTMENTS (Upcoming)
-- ============================================================================
INSERT INTO telehealth_appointments (id, patient_id, provider_id, appointment_time, duration_minutes, encounter_type, status, reason_for_visit, tenant_id)
VALUES
  (gen_random_uuid(), 'a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
   NOW() + INTERVAL '2 days' + INTERVAL '10 hours', 30, 'outpatient', 'scheduled',
   'Heart failure management follow-up', '2b902657-6a20-4435-a78a-576f397517ca'),
  (gen_random_uuid(), 'a2222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111',
   NOW() + INTERVAL '5 days' + INTERVAL '14 hours', 30, 'outpatient', 'scheduled',
   'Diabetes management review', '2b902657-6a20-4435-a78a-576f397517ca')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SUMMARY
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Universal Demo Data Seed Complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'Demo Patients:';
  RAISE NOTICE '  • Eleanor Thompson (79F) - Heart failure, hypertension, asthma';
  RAISE NOTICE '  • Robert Chen (66M) - Type 2 diabetes, CKD stage 3, high cholesterol';
  RAISE NOTICE '  • Maria Santos (62F) - Post hip replacement surgery';
  RAISE NOTICE '';
  RAISE NOTICE 'Demo Staff:';
  RAISE NOTICE '  • Dr. Sarah Williams (Physician)';
  RAISE NOTICE '  • James Rodriguez (Nurse)';
  RAISE NOTICE '  • Lisa Park (Case Manager)';
  RAISE NOTICE '  • Marcus Johnson (CHW)';
  RAISE NOTICE '';
  RAISE NOTICE 'Note: Demo accounts use @demo.wellfit.com emails';
END $$;
