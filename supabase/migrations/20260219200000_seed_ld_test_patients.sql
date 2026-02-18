-- =====================================================
-- L&D TEST PATIENT SEED DATA
-- =====================================================
-- Purpose: 4 realistic L&D patients with full end-to-end data
--   across all ld_* tables for demo and development
-- Safe to run multiple times (ON CONFLICT DO NOTHING)
-- Tenant: WF-0001 (2b902657-6a20-4435-a78a-576f397517ca)
-- =====================================================

-- Demo provider for L&D (OB/GYN)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
  'b5555555-5555-5555-5555-555555555555',
  'dr.martinez@demo.wellfit.com',
  '$2a$10$demo_password_hash_not_real',
  NOW(), NOW() - INTERVAL '2 years', NOW(),
  '{"first_name": "Diana", "last_name": "Martinez"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (user_id, role_id, email, first_name, last_name, phone, dob, gender, city, state, zip_code, tenant_id, onboarded, consent, created_at)
VALUES (
  'b5555555-5555-5555-5555-555555555555',
  2, -- provider role
  'dr.martinez@demo.wellfit.com',
  'Diana', 'Martinez', '555-0200', '1978-06-12', 'Female',
  'Houston', 'TX', '77030',
  '2b902657-6a20-4435-a78a-576f397517ca', true, true,
  NOW() - INTERVAL '2 years'
) ON CONFLICT (user_id) DO NOTHING;

-- Demo L&D nurse
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
  'b6666666-6666-6666-6666-666666666666',
  'nurse.patel@demo.wellfit.com',
  '$2a$10$demo_password_hash_not_real',
  NOW(), NOW() - INTERVAL '1 year', NOW(),
  '{"first_name": "Priya", "last_name": "Patel"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (user_id, role_id, email, first_name, last_name, phone, dob, gender, city, state, zip_code, tenant_id, onboarded, consent, created_at)
VALUES (
  'b6666666-6666-6666-6666-666666666666',
  3, -- nurse role
  'nurse.patel@demo.wellfit.com',
  'Priya', 'Patel', '555-0201', '1990-09-03', 'Female',
  'Houston', 'TX', '77030',
  '2b902657-6a20-4435-a78a-576f397517ca', true, true,
  NOW() - INTERVAL '1 year'
) ON CONFLICT (user_id) DO NOTHING;


-- ============================================================================
-- PATIENT 1: Keisha Williams — Active high-risk, 32 weeks, gestational diabetes
-- ============================================================================
-- G2P1, 28yo, GDM + advanced BMI, multiple prenatal visits, on insulin, active alerts

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
  'c1111111-1111-1111-1111-111111111111',
  'keisha.williams@demo.wellfit.com',
  '$2a$10$demo_password_hash_not_real',
  NOW(), NOW() - INTERVAL '8 months', NOW(),
  '{"first_name": "Keisha", "last_name": "Williams"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (user_id, role_id, email, first_name, last_name, phone, dob, gender, city, state, zip_code, tenant_id, onboarded, consent, created_at)
VALUES (
  'c1111111-1111-1111-1111-111111111111',
  19,
  'keisha.williams@demo.wellfit.com',
  'Keisha', 'Williams', '555-0301', '1997-08-14', 'Female',
  'Houston', 'TX', '77004',
  '2b902657-6a20-4435-a78a-576f397517ca', true, true,
  NOW() - INTERVAL '8 months'
) ON CONFLICT (user_id) DO NOTHING;

-- Pregnancy: active, high-risk, GDM
INSERT INTO ld_pregnancies (id, patient_id, tenant_id, gravida, para, ab, living, edd, lmp, blood_type, rh_factor, gbs_status, risk_level, risk_factors, status, primary_provider_id, notes)
VALUES (
  'd1111111-1111-1111-1111-111111111111',
  'c1111111-1111-1111-1111-111111111111',
  '2b902657-6a20-4435-a78a-576f397517ca',
  2, 1, 0, 1,
  (CURRENT_DATE + INTERVAL '8 weeks')::date,
  (CURRENT_DATE - INTERVAL '32 weeks')::date,
  'O+', 'positive', 'pending', 'high',
  ARRAY['Gestational diabetes', 'BMI > 35', 'Previous macrosomia'],
  'active',
  'b5555555-5555-5555-5555-555555555555',
  'GDM diagnosed at 24w. On insulin sliding scale since 26w. Fetal growth at 75th percentile.'
) ON CONFLICT (id) DO NOTHING;

-- Prenatal visit 1 — 12 weeks (dating scan)
INSERT INTO ld_prenatal_visits (id, patient_id, tenant_id, pregnancy_id, visit_date, provider_id, gestational_age_weeks, gestational_age_days, fundal_height_cm, fetal_heart_rate, fetal_presentation, weight_kg, bp_systolic, bp_diastolic, urine_protein, urine_glucose, edema, complaints, notes)
VALUES (
  'e1111111-0001-1111-1111-111111111111',
  'c1111111-1111-1111-1111-111111111111',
  '2b902657-6a20-4435-a78a-576f397517ca',
  'd1111111-1111-1111-1111-111111111111',
  NOW() - INTERVAL '20 weeks',
  'b5555555-5555-5555-5555-555555555555',
  12, 3, NULL, 162, NULL, 92.5, 118, 72, 'negative', 'negative', false,
  ARRAY[]::text[], 'Dating scan confirms EDD. NT scan normal. Discussed GDM screening schedule.'
) ON CONFLICT (id) DO NOTHING;

-- Prenatal visit 2 — 20 weeks (anatomy scan)
INSERT INTO ld_prenatal_visits (id, patient_id, tenant_id, pregnancy_id, visit_date, provider_id, gestational_age_weeks, gestational_age_days, fundal_height_cm, fetal_heart_rate, fetal_presentation, weight_kg, bp_systolic, bp_diastolic, urine_protein, urine_glucose, edema, complaints, notes)
VALUES (
  'e1111111-0002-1111-1111-111111111111',
  'c1111111-1111-1111-1111-111111111111',
  '2b902657-6a20-4435-a78a-576f397517ca',
  'd1111111-1111-1111-1111-111111111111',
  NOW() - INTERVAL '12 weeks',
  'b5555555-5555-5555-5555-555555555555',
  20, 1, 20.0, 148, NULL, 94.0, 122, 76, 'negative', 'negative', false,
  ARRAY[]::text[], 'Anatomy scan normal. All structures visualized. Anterior placenta.'
) ON CONFLICT (id) DO NOTHING;

-- Prenatal visit 3 — 24 weeks (GDM diagnosis)
INSERT INTO ld_prenatal_visits (id, patient_id, tenant_id, pregnancy_id, visit_date, provider_id, gestational_age_weeks, gestational_age_days, fundal_height_cm, fetal_heart_rate, fetal_presentation, weight_kg, bp_systolic, bp_diastolic, urine_protein, urine_glucose, edema, complaints, notes)
VALUES (
  'e1111111-0003-1111-1111-111111111111',
  'c1111111-1111-1111-1111-111111111111',
  '2b902657-6a20-4435-a78a-576f397517ca',
  'd1111111-1111-1111-1111-111111111111',
  NOW() - INTERVAL '8 weeks',
  'b5555555-5555-5555-5555-555555555555',
  24, 0, 24.5, 145, 'cephalic', 96.0, 126, 78, 'negative', '2+', false,
  ARRAY['Increased thirst'], 'Failed 3-hr GTT: fasting 98, 1hr 195, 2hr 172, 3hr 148. GDM diagnosed. Referred to MFM and dietician. Started glucose monitoring QID.'
) ON CONFLICT (id) DO NOTHING;

-- Prenatal visit 4 — 28 weeks (insulin started)
INSERT INTO ld_prenatal_visits (id, patient_id, tenant_id, pregnancy_id, visit_date, provider_id, gestational_age_weeks, gestational_age_days, fundal_height_cm, fetal_heart_rate, fetal_presentation, weight_kg, bp_systolic, bp_diastolic, urine_protein, urine_glucose, edema, complaints, notes)
VALUES (
  'e1111111-0004-1111-1111-111111111111',
  'c1111111-1111-1111-1111-111111111111',
  '2b902657-6a20-4435-a78a-576f397517ca',
  'd1111111-1111-1111-1111-111111111111',
  NOW() - INTERVAL '4 weeks',
  'b5555555-5555-5555-5555-555555555555',
  28, 0, 29.0, 140, 'cephalic', 97.5, 130, 82, 'trace', '1+', false,
  ARRAY['Fatigue'], 'Fasting glucose consistently 95-110 despite diet. Starting insulin glargine 10u qhs. Growth scan shows EFW 75th percentile.'
) ON CONFLICT (id) DO NOTHING;

-- Prenatal visit 5 — 31 weeks (most recent)
INSERT INTO ld_prenatal_visits (id, patient_id, tenant_id, pregnancy_id, visit_date, provider_id, gestational_age_weeks, gestational_age_days, fundal_height_cm, fetal_heart_rate, fetal_presentation, weight_kg, bp_systolic, bp_diastolic, urine_protein, urine_glucose, edema, complaints, notes)
VALUES (
  'e1111111-0005-1111-1111-111111111111',
  'c1111111-1111-1111-1111-111111111111',
  '2b902657-6a20-4435-a78a-576f397517ca',
  'd1111111-1111-1111-1111-111111111111',
  NOW() - INTERVAL '1 week',
  'b5555555-5555-5555-5555-555555555555',
  31, 0, 31.5, 138, 'cephalic', 98.0, 134, 84, 'trace', 'negative', true,
  ARRAY['Mild ankle edema', 'Occasional Braxton-Hicks'], 'Glucose improved on insulin. A1c 5.9. Fetal kick counts reassuring. Discussed delivery plan at 39w if controlled.'
) ON CONFLICT (id) DO NOTHING;

-- Fetal monitoring — Category I (reassuring)
INSERT INTO ld_fetal_monitoring (id, patient_id, tenant_id, pregnancy_id, assessment_time, assessed_by, fhr_baseline, variability, accelerations_present, deceleration_type, fhr_category, uterine_activity, interpretation)
VALUES (
  'f1111111-0001-1111-1111-111111111111',
  'c1111111-1111-1111-1111-111111111111',
  '2b902657-6a20-4435-a78a-576f397517ca',
  'd1111111-1111-1111-1111-111111111111',
  NOW() - INTERVAL '1 week',
  'b6666666-6666-6666-6666-666666666666',
  138, 'moderate', true, 'none', 'I',
  'Irregular, non-painful contractions Q12-15 min',
  'Category I tracing. Reactive NST. No decelerations. Reassuring.'
) ON CONFLICT (id) DO NOTHING;

-- Medications: insulin
INSERT INTO ld_medication_administrations (id, patient_id, tenant_id, pregnancy_id, administered_datetime, administered_by, medication_name, dose, route, indication, notes)
VALUES
  ('01111111-0001-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', '2b902657-6a20-4435-a78a-576f397517ca', 'd1111111-1111-1111-1111-111111111111', NOW() - INTERVAL '4 weeks', 'b5555555-5555-5555-5555-555555555555', 'Insulin glargine', '10 units', 'subcutaneous', 'Gestational diabetes — fasting glucose control', 'Bedtime dose. Patient educated on injection technique.'),
  ('01111111-0002-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', '2b902657-6a20-4435-a78a-576f397517ca', 'd1111111-1111-1111-1111-111111111111', NOW() - INTERVAL '2 weeks', 'b5555555-5555-5555-5555-555555555555', 'Insulin glargine', '14 units', 'subcutaneous', 'Gestational diabetes — dose increase', 'Fasting glucose 105-115, increased from 10u to 14u qhs.'),
  ('01111111-0003-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', '2b902657-6a20-4435-a78a-576f397517ca', 'd1111111-1111-1111-1111-111111111111', NOW() - INTERVAL '28 weeks', NULL, 'Prenatal vitamins with DHA', '1 tablet', 'oral', 'Prenatal supplementation', NULL)
ON CONFLICT (id) DO NOTHING;

-- Risk assessment
INSERT INTO ld_risk_assessments (id, patient_id, tenant_id, pregnancy_id, assessment_date, assessed_by, risk_level, risk_factors, score, scoring_system, notes)
VALUES (
  'a0111111-0001-1111-1111-111111111111',
  'c1111111-1111-1111-1111-111111111111',
  '2b902657-6a20-4435-a78a-576f397517ca',
  'd1111111-1111-1111-1111-111111111111',
  NOW() - INTERVAL '1 week',
  'b5555555-5555-5555-5555-555555555555',
  'high',
  ARRAY['Gestational diabetes on insulin', 'BMI > 35', 'Previous macrosomia (4200g)', 'Trace proteinuria'],
  72, 'WellFit OB Risk Score',
  'High risk due to insulin-requiring GDM. Plan: biweekly NSTs from 32w, growth scans Q4w, target delivery at 39w.'
) ON CONFLICT (id) DO NOTHING;

-- Active alerts for Patient 1
INSERT INTO ld_alerts (id, patient_id, tenant_id, pregnancy_id, alert_type, severity, message, acknowledged, resolved)
VALUES
  ('61111111-0001-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', '2b902657-6a20-4435-a78a-576f397517ca', 'd1111111-1111-1111-1111-111111111111', 'gdm_insulin_required', 'high', 'Patient requires insulin for gestational diabetes — glucose not controlled by diet alone', false, false),
  ('61111111-0002-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', '2b902657-6a20-4435-a78a-576f397517ca', 'd1111111-1111-1111-1111-111111111111', 'elevated_bp', 'medium', 'BP trending up: 134/84 at last visit (was 118/72 at booking). Monitor for preeclampsia.', false, false)
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- PATIENT 2: Amara Okafor — Active low-risk, 37 weeks, routine, nearly due
-- ============================================================================
-- G1P0, 25yo, healthy primigravida, normal labs, no complications, nearing term

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
  'c2222222-2222-2222-2222-222222222222',
  'amara.okafor@demo.wellfit.com',
  '$2a$10$demo_password_hash_not_real',
  NOW(), NOW() - INTERVAL '10 months', NOW(),
  '{"first_name": "Amara", "last_name": "Okafor"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (user_id, role_id, email, first_name, last_name, phone, dob, gender, city, state, zip_code, tenant_id, onboarded, consent, created_at)
VALUES (
  'c2222222-2222-2222-2222-222222222222',
  19,
  'amara.okafor@demo.wellfit.com',
  'Amara', 'Okafor', '555-0302', '2000-12-01', 'Female',
  'Houston', 'TX', '77006',
  '2b902657-6a20-4435-a78a-576f397517ca', true, true,
  NOW() - INTERVAL '10 months'
) ON CONFLICT (user_id) DO NOTHING;

-- Pregnancy: active, low-risk, nearing term
INSERT INTO ld_pregnancies (id, patient_id, tenant_id, gravida, para, ab, living, edd, lmp, blood_type, rh_factor, gbs_status, risk_level, risk_factors, status, primary_provider_id, notes)
VALUES (
  'd2222222-2222-2222-2222-222222222222',
  'c2222222-2222-2222-2222-222222222222',
  '2b902657-6a20-4435-a78a-576f397517ca',
  1, 0, 0, 0,
  (CURRENT_DATE + INTERVAL '3 weeks')::date,
  (CURRENT_DATE - INTERVAL '37 weeks')::date,
  'A+', 'positive', 'negative', 'low',
  ARRAY[]::text[],
  'active',
  'b5555555-5555-5555-5555-555555555555',
  'Uncomplicated primigravida. All screens negative. GBS negative. Cephalic presentation confirmed.'
) ON CONFLICT (id) DO NOTHING;

-- Prenatal visit 1 — 10 weeks
INSERT INTO ld_prenatal_visits (id, patient_id, tenant_id, pregnancy_id, visit_date, provider_id, gestational_age_weeks, gestational_age_days, fundal_height_cm, fetal_heart_rate, fetal_presentation, weight_kg, bp_systolic, bp_diastolic, urine_protein, urine_glucose, edema, complaints, notes)
VALUES (
  'e2222222-0001-2222-2222-222222222222',
  'c2222222-2222-2222-2222-222222222222',
  '2b902657-6a20-4435-a78a-576f397517ca',
  'd2222222-2222-2222-2222-222222222222',
  NOW() - INTERVAL '27 weeks',
  'b5555555-5555-5555-5555-555555555555',
  10, 0, NULL, NULL, NULL, 62.0, 110, 68, 'negative', 'negative', false,
  ARRAY['Morning nausea'], 'First prenatal visit. CBC, blood type, rubella, HIV, HepB, syphilis ordered. Discussed exercise and nutrition.'
) ON CONFLICT (id) DO NOTHING;

-- Prenatal visit 2 — 20 weeks
INSERT INTO ld_prenatal_visits (id, patient_id, tenant_id, pregnancy_id, visit_date, provider_id, gestational_age_weeks, gestational_age_days, fundal_height_cm, fetal_heart_rate, fetal_presentation, weight_kg, bp_systolic, bp_diastolic, urine_protein, urine_glucose, edema, complaints, notes)
VALUES (
  'e2222222-0002-2222-2222-222222222222',
  'c2222222-2222-2222-2222-222222222222',
  '2b902657-6a20-4435-a78a-576f397517ca',
  'd2222222-2222-2222-2222-222222222222',
  NOW() - INTERVAL '17 weeks',
  'b5555555-5555-5555-5555-555555555555',
  20, 0, 20.0, 152, NULL, 64.5, 112, 70, 'negative', 'negative', false,
  ARRAY[]::text[], 'Anatomy scan normal. Gender: female. Placenta posterior. AFI normal.'
) ON CONFLICT (id) DO NOTHING;

-- Prenatal visit 3 — 28 weeks
INSERT INTO ld_prenatal_visits (id, patient_id, tenant_id, pregnancy_id, visit_date, provider_id, gestational_age_weeks, gestational_age_days, fundal_height_cm, fetal_heart_rate, fetal_presentation, weight_kg, bp_systolic, bp_diastolic, urine_protein, urine_glucose, edema, complaints, notes)
VALUES (
  'e2222222-0003-2222-2222-222222222222',
  'c2222222-2222-2222-2222-222222222222',
  '2b902657-6a20-4435-a78a-576f397517ca',
  'd2222222-2222-2222-2222-222222222222',
  NOW() - INTERVAL '9 weeks',
  'b5555555-5555-5555-5555-555555555555',
  28, 0, 28.0, 146, 'cephalic', 66.5, 108, 66, 'negative', 'negative', false,
  ARRAY[]::text[], 'GTT: 1-hr 118 (normal). Rhogam not needed (Rh+). Tdap given today. CBC normal. Anti-D antibody screen negative.'
) ON CONFLICT (id) DO NOTHING;

-- Prenatal visit 4 — 34 weeks
INSERT INTO ld_prenatal_visits (id, patient_id, tenant_id, pregnancy_id, visit_date, provider_id, gestational_age_weeks, gestational_age_days, fundal_height_cm, fetal_heart_rate, fetal_presentation, weight_kg, bp_systolic, bp_diastolic, urine_protein, urine_glucose, edema, complaints, notes)
VALUES (
  'e2222222-0004-2222-2222-222222222222',
  'c2222222-2222-2222-2222-222222222222',
  '2b902657-6a20-4435-a78a-576f397517ca',
  'd2222222-2222-2222-2222-222222222222',
  NOW() - INTERVAL '3 weeks',
  'b5555555-5555-5555-5555-555555555555',
  34, 0, 33.5, 142, 'cephalic', 68.0, 114, 72, 'negative', 'negative', false,
  ARRAY[]::text[], 'Growth appropriate. Discussed birth plan, labor signs, when to come in. Registered at hospital.'
) ON CONFLICT (id) DO NOTHING;

-- Prenatal visit 5 — 36 weeks (most recent, GBS swab)
INSERT INTO ld_prenatal_visits (id, patient_id, tenant_id, pregnancy_id, visit_date, provider_id, gestational_age_weeks, gestational_age_days, fundal_height_cm, fetal_heart_rate, fetal_presentation, weight_kg, bp_systolic, bp_diastolic, urine_protein, urine_glucose, cervical_dilation_cm, cervical_effacement_percent, edema, complaints, notes)
VALUES (
  'e2222222-0005-2222-2222-222222222222',
  'c2222222-2222-2222-2222-222222222222',
  '2b902657-6a20-4435-a78a-576f397517ca',
  'd2222222-2222-2222-2222-222222222222',
  NOW() - INTERVAL '4 days',
  'b5555555-5555-5555-5555-555555555555',
  36, 3, 36.0, 140, 'cephalic', 69.0, 116, 74, 'negative', 'negative',
  1.0, 30, false,
  ARRAY['Pelvic pressure'], 'GBS swab negative (result received). Cervix 1cm / 30% / -2. Engaged. Weekly visits from now. Discussed epidural options.'
) ON CONFLICT (id) DO NOTHING;

-- Fetal monitoring — Category I
INSERT INTO ld_fetal_monitoring (id, patient_id, tenant_id, pregnancy_id, assessment_time, assessed_by, fhr_baseline, variability, accelerations_present, deceleration_type, fhr_category, interpretation)
VALUES (
  'f2222222-0001-2222-2222-222222222222',
  'c2222222-2222-2222-2222-222222222222',
  '2b902657-6a20-4435-a78a-576f397517ca',
  'd2222222-2222-2222-2222-222222222222',
  NOW() - INTERVAL '4 days',
  'b6666666-6666-6666-6666-666666666666',
  140, 'moderate', true, 'none', 'I',
  'Category I. Reactive NST at 36w. Normal baseline, good variability, accelerations present.'
) ON CONFLICT (id) DO NOTHING;

-- Medications — prenatal only
INSERT INTO ld_medication_administrations (id, patient_id, tenant_id, pregnancy_id, administered_datetime, medication_name, dose, route, indication)
VALUES
  ('02222222-0001-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', '2b902657-6a20-4435-a78a-576f397517ca', 'd2222222-2222-2222-2222-222222222222', NOW() - INTERVAL '37 weeks', 'Prenatal vitamins with DHA', '1 tablet', 'oral', 'Prenatal supplementation'),
  ('02222222-0002-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', '2b902657-6a20-4435-a78a-576f397517ca', 'd2222222-2222-2222-2222-222222222222', NOW() - INTERVAL '9 weeks', 'Tdap vaccine', '0.5 mL', 'intramuscular', 'Maternal pertussis immunization at 28w')
ON CONFLICT (id) DO NOTHING;

-- Risk assessment — low
INSERT INTO ld_risk_assessments (id, patient_id, tenant_id, pregnancy_id, assessment_date, assessed_by, risk_level, risk_factors, score, scoring_system, notes)
VALUES (
  '52222222-0001-2222-2222-222222222222',
  'c2222222-2222-2222-2222-222222222222',
  '2b902657-6a20-4435-a78a-576f397517ca',
  'd2222222-2222-2222-2222-222222222222',
  NOW() - INTERVAL '4 days',
  'b5555555-5555-5555-5555-555555555555',
  'low',
  ARRAY[]::text[],
  15, 'WellFit OB Risk Score',
  'Low risk primigravida. All screens normal. GBS negative. Appropriate growth. Plan: spontaneous labor, epidural available.'
) ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- PATIENT 3: Sarah Chen — Recently delivered (2 days ago), routine vaginal
-- ============================================================================
-- G3P2→P3, 30yo, delivered healthy girl, APGAR 8/9, rooming in, breastfeeding

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
  'c3333333-3333-3333-3333-333333333333',
  'sarah.chen.ld@demo.wellfit.com',
  '$2a$10$demo_password_hash_not_real',
  NOW(), NOW() - INTERVAL '10 months', NOW(),
  '{"first_name": "Sarah", "last_name": "Chen"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (user_id, role_id, email, first_name, last_name, phone, dob, gender, city, state, zip_code, tenant_id, onboarded, consent, created_at)
VALUES (
  'c3333333-3333-3333-3333-333333333333',
  19,
  'sarah.chen.ld@demo.wellfit.com',
  'Sarah', 'Chen', '555-0303', '1996-03-22', 'Female',
  'Houston', 'TX', '77019',
  '2b902657-6a20-4435-a78a-576f397517ca', true, true,
  NOW() - INTERVAL '10 months'
) ON CONFLICT (user_id) DO NOTHING;

-- Pregnancy: delivered
INSERT INTO ld_pregnancies (id, patient_id, tenant_id, gravida, para, ab, living, edd, lmp, blood_type, rh_factor, gbs_status, risk_level, risk_factors, status, primary_provider_id, notes)
VALUES (
  'd3333333-3333-3333-3333-333333333333',
  'c3333333-3333-3333-3333-333333333333',
  '2b902657-6a20-4435-a78a-576f397517ca',
  3, 3, 0, 3,
  (CURRENT_DATE - INTERVAL '5 days')::date,
  (CURRENT_DATE - INTERVAL '40 weeks 5 days')::date,
  'B+', 'positive', 'negative', 'low',
  ARRAY[]::text[],
  'delivered',
  'b5555555-5555-5555-5555-555555555555',
  'Uncomplicated multiparous pregnancy. Spontaneous labor at 39+5. Normal vaginal delivery.'
) ON CONFLICT (id) DO NOTHING;

-- Prenatal visits (last two)
INSERT INTO ld_prenatal_visits (id, patient_id, tenant_id, pregnancy_id, visit_date, provider_id, gestational_age_weeks, gestational_age_days, fundal_height_cm, fetal_heart_rate, fetal_presentation, weight_kg, bp_systolic, bp_diastolic, urine_protein, urine_glucose, cervical_dilation_cm, cervical_effacement_percent, edema, complaints, notes)
VALUES
  ('e3333333-0001-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', '2b902657-6a20-4435-a78a-576f397517ca', 'd3333333-3333-3333-3333-333333333333', NOW() - INTERVAL '2 weeks', 'b5555555-5555-5555-5555-555555555555', 38, 0, 37.0, 144, 'cephalic', 72.0, 118, 74, 'negative', 'negative', 2.0, 60, false, ARRAY['Braxton-Hicks increasing'], 'Cervix 2cm/60%/-1. Discussed labor signs. Fetal movement active.'),
  ('e3333333-0002-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', '2b902657-6a20-4435-a78a-576f397517ca', 'd3333333-3333-3333-3333-333333333333', NOW() - INTERVAL '3 days', 'b5555555-5555-5555-5555-555555555555', 39, 4, 38.5, 140, 'cephalic', 72.5, 120, 76, 'negative', 'negative', 3.0, 80, false, ARRAY['Regular contractions started 6 hours ago'], 'Admitted to L&D in active labor. 3cm/80%/0 station. ROM not yet.')
ON CONFLICT (id) DO NOTHING;

-- Labor events (partogram progression)
INSERT INTO ld_labor_events (id, patient_id, tenant_id, pregnancy_id, event_time, stage, dilation_cm, effacement_percent, station, contraction_frequency_per_10min, contraction_duration_seconds, contraction_intensity, membrane_status, maternal_bp_systolic, maternal_bp_diastolic, maternal_hr, maternal_temp_c, notes)
VALUES
  ('73333333-0001-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', '2b902657-6a20-4435-a78a-576f397517ca', 'd3333333-3333-3333-3333-333333333333', NOW() - INTERVAL '56 hours', 'first_active', 3.0, 80, 0, 3, 45, 'moderate', 'intact', 120, 76, 88, 37.0, 'Admitted. Regular contractions Q3-4min. Epidural requested.'),
  ('73333333-0002-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', '2b902657-6a20-4435-a78a-576f397517ca', 'd3333333-3333-3333-3333-333333333333', NOW() - INTERVAL '54 hours', 'first_active', 5.0, 90, 0, 4, 50, 'moderate', 'intact', 118, 74, 90, 37.0, 'Epidural placed. Good pain relief. Progressing well.'),
  ('73333333-0003-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', '2b902657-6a20-4435-a78a-576f397517ca', 'd3333333-3333-3333-3333-333333333333', NOW() - INTERVAL '52 hours', 'first_active', 7.0, 100, 1, 4, 55, 'strong', 'srom', 116, 72, 85, 37.1, 'SROM — clear fluid. Progressing. FHR reassuring.'),
  ('73333333-0004-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', '2b902657-6a20-4435-a78a-576f397517ca', 'd3333333-3333-3333-3333-333333333333', NOW() - INTERVAL '50 hours', 'transition', 9.0, 100, 2, 5, 60, 'strong', 'srom', 122, 78, 92, 37.1, 'Transition. Feeling pressure. Complete soon.'),
  ('73333333-0005-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', '2b902657-6a20-4435-a78a-576f397517ca', 'd3333333-3333-3333-3333-333333333333', NOW() - INTERVAL '49 hours', 'second', 10.0, 100, 3, 5, 60, 'strong', 'srom', 124, 80, 95, 37.2, 'Complete. Pushing. Crowning within 15 min.')
ON CONFLICT (id) DO NOTHING;

-- Fetal monitoring during labor
INSERT INTO ld_fetal_monitoring (id, patient_id, tenant_id, pregnancy_id, assessment_time, assessed_by, fhr_baseline, variability, accelerations_present, deceleration_type, fhr_category, uterine_activity, interpretation, action_taken)
VALUES
  ('f3333333-0001-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', '2b902657-6a20-4435-a78a-576f397517ca', 'd3333333-3333-3333-3333-333333333333', NOW() - INTERVAL '54 hours', 'b6666666-6666-6666-6666-666666666666', 140, 'moderate', true, 'none', 'I', 'Regular Q3-4min', 'Category I. Reassuring. Continue labor.', NULL),
  ('f3333333-0002-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', '2b902657-6a20-4435-a78a-576f397517ca', 'd3333333-3333-3333-3333-333333333333', NOW() - INTERVAL '50 hours', 'b6666666-6666-6666-6666-666666666666', 145, 'moderate', true, 'early', 'I', 'Strong Q2-3min', 'Category I with early decelerations — head compression, normal for transition.', NULL)
ON CONFLICT (id) DO NOTHING;

-- Delivery record — normal vaginal
INSERT INTO ld_delivery_records (id, patient_id, tenant_id, pregnancy_id, delivery_datetime, delivery_provider_id, method, anesthesia, labor_duration_hours, second_stage_duration_min, estimated_blood_loss_ml, complications, episiotomy, laceration_degree, cord_clamping, cord_gases_ph, placenta_delivery_time, placenta_intact, notes)
VALUES (
  '83333333-0001-3333-3333-333333333333',
  'c3333333-3333-3333-3333-333333333333',
  '2b902657-6a20-4435-a78a-576f397517ca',
  'd3333333-3333-3333-3333-333333333333',
  NOW() - INTERVAL '48 hours',
  'b5555555-5555-5555-5555-555555555555',
  'NSVD', 'epidural', 8.0, 22, 350,
  ARRAY[]::text[],
  false, 1, 'delayed_60s', 7.28,
  NOW() - INTERVAL '47 hours 50 minutes',
  true,
  'Spontaneous vaginal delivery at 39+5. Infant cried immediately. Delayed cord clamping 60 sec. Skin-to-skin initiated. 1st degree perineal laceration repaired with 3-0 Vicryl.'
) ON CONFLICT (id) DO NOTHING;

-- Newborn assessment
INSERT INTO ld_newborn_assessments (id, patient_id, tenant_id, pregnancy_id, delivery_id, birth_datetime, sex, weight_g, length_cm, head_circumference_cm, apgar_1_min, apgar_5_min, temperature_c, heart_rate, respiratory_rate, disposition, skin_color, reflexes, anomalies, vitamin_k_given, erythromycin_given, hepatitis_b_vaccine, notes)
VALUES (
  '93333333-0001-3333-3333-333333333333',
  'c3333333-3333-3333-3333-333333333333',
  '2b902657-6a20-4435-a78a-576f397517ca',
  'd3333333-3333-3333-3333-333333333333',
  '83333333-0001-3333-3333-333333333333',
  NOW() - INTERVAL '48 hours',
  'female', 3250, 50.5, 34.0,
  8, 9,
  36.8, 142, 44,
  'rooming_in',
  'Pink, acrocyanosis resolved within 5 min',
  'Active, strong cry, good tone',
  ARRAY[]::text[],
  true, true, true,
  'Healthy term female infant. Breastfed within 1 hour. Passed meconium. Hearing screen PASS bilateral. Pulse ox 98%.'
) ON CONFLICT (id) DO NOTHING;

-- Postpartum assessment — 6 hours
INSERT INTO ld_postpartum_assessments (id, patient_id, tenant_id, pregnancy_id, assessment_datetime, assessed_by, hours_postpartum, fundal_height, fundal_firmness, lochia, lochia_amount, bp_systolic, bp_diastolic, heart_rate, temperature_c, breastfeeding_status, lactation_notes, pain_score, pain_location, emotional_status, voiding, bowel_movement, notes)
VALUES (
  '23333333-0001-3333-3333-333333333333',
  'c3333333-3333-3333-3333-333333333333',
  '2b902657-6a20-4435-a78a-576f397517ca',
  'd3333333-3333-3333-3333-333333333333',
  NOW() - INTERVAL '42 hours',
  'b6666666-6666-6666-6666-666666666666',
  6.0, 'at umbilicus', 'firm', 'rubra', 'moderate',
  116, 72, 78, 37.0,
  'initiated', 'Good latch. Colostrum expressing. Lactation consult scheduled.',
  4, 'Perineum', 'stable',
  true, false,
  'Postpartum day 0. Fundus firm at umbilicus. Lochia rubra moderate. Perineal ice and ibuprofen for comfort. Voided 300cc clear urine.'
) ON CONFLICT (id) DO NOTHING;

-- Postpartum assessment — 24 hours
INSERT INTO ld_postpartum_assessments (id, patient_id, tenant_id, pregnancy_id, assessment_datetime, assessed_by, hours_postpartum, fundal_height, fundal_firmness, lochia, lochia_amount, bp_systolic, bp_diastolic, heart_rate, temperature_c, breastfeeding_status, lactation_notes, pain_score, pain_location, emotional_status, voiding, bowel_movement, notes)
VALUES (
  '23333333-0002-3333-3333-333333333333',
  'c3333333-3333-3333-3333-333333333333',
  '2b902657-6a20-4435-a78a-576f397517ca',
  'd3333333-3333-3333-3333-333333333333',
  NOW() - INTERVAL '24 hours',
  'b6666666-6666-6666-6666-666666666666',
  24.0, '1 below umbilicus', 'firm', 'rubra', 'moderate',
  112, 70, 72, 36.9,
  'established', 'Milk transitioning. Baby feeding Q2-3hr. Weight loss 4% (normal).',
  3, 'Perineum', 'stable',
  true, false,
  'PP day 1. Ambulating well. Tolerating regular diet. Bonding well with infant. Newborn screen collected. Planning discharge tomorrow if stable.'
) ON CONFLICT (id) DO NOTHING;

-- Medications for delivery
INSERT INTO ld_medication_administrations (id, patient_id, tenant_id, pregnancy_id, administered_datetime, administered_by, medication_name, dose, route, indication, notes)
VALUES
  ('03333333-0001-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', '2b902657-6a20-4435-a78a-576f397517ca', 'd3333333-3333-3333-3333-333333333333', NOW() - INTERVAL '54 hours', 'b6666666-6666-6666-6666-666666666666', 'Epidural (bupivacaine/fentanyl)', 'Standard L&D concentration', 'epidural', 'Labor pain management', 'Patient-controlled epidural analgesia.'),
  ('03333333-0002-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', '2b902657-6a20-4435-a78a-576f397517ca', 'd3333333-3333-3333-3333-333333333333', NOW() - INTERVAL '48 hours', 'b5555555-5555-5555-5555-555555555555', 'Oxytocin', '10 units', 'intramuscular', 'Active management of third stage', 'Given after placenta delivery for uterine atony prevention.'),
  ('03333333-0003-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', '2b902657-6a20-4435-a78a-576f397517ca', 'd3333333-3333-3333-3333-333333333333', NOW() - INTERVAL '42 hours', 'b6666666-6666-6666-6666-666666666666', 'Ibuprofen', '600 mg', 'oral', 'Postpartum pain — perineal laceration', NULL)
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- PATIENT 4: Jennifer Rodriguez — Complex: preeclampsia, emergency C-section (5 days ago)
-- ============================================================================
-- G2P1→P2, 36yo, severe preeclampsia at 37w, emergency C-section, baby in observation

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
  'c4444444-4444-4444-4444-444444444444',
  'jennifer.rodriguez.ld@demo.wellfit.com',
  '$2a$10$demo_password_hash_not_real',
  NOW(), NOW() - INTERVAL '10 months', NOW(),
  '{"first_name": "Jennifer", "last_name": "Rodriguez"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (user_id, role_id, email, first_name, last_name, phone, dob, gender, city, state, zip_code, tenant_id, onboarded, consent, created_at)
VALUES (
  'c4444444-4444-4444-4444-444444444444',
  19,
  'jennifer.rodriguez.ld@demo.wellfit.com',
  'Jennifer', 'Rodriguez', '555-0304', '1989-11-30', 'Female',
  'Houston', 'TX', '77027',
  '2b902657-6a20-4435-a78a-576f397517ca', true, true,
  NOW() - INTERVAL '10 months'
) ON CONFLICT (user_id) DO NOTHING;

-- Pregnancy: delivered (C-section for preeclampsia)
INSERT INTO ld_pregnancies (id, patient_id, tenant_id, gravida, para, ab, living, edd, lmp, blood_type, rh_factor, gbs_status, risk_level, risk_factors, status, primary_provider_id, notes)
VALUES (
  'd4444444-4444-4444-4444-444444444444',
  'c4444444-4444-4444-4444-444444444444',
  '2b902657-6a20-4435-a78a-576f397517ca',
  2, 2, 0, 2,
  (CURRENT_DATE + INTERVAL '16 days')::date,
  (CURRENT_DATE - INTERVAL '37 weeks 5 days')::date,
  'AB-', 'negative', 'unknown', 'critical',
  ARRAY['Severe preeclampsia', 'Advanced maternal age', 'Rh-negative', 'Previous C-section'],
  'delivered',
  'b5555555-5555-5555-5555-555555555555',
  'History of C-section with first child (breech). Developed severe preeclampsia at 36+6. Emergency repeat C-section at 37+2.'
) ON CONFLICT (id) DO NOTHING;

-- Prenatal visits
INSERT INTO ld_prenatal_visits (id, patient_id, tenant_id, pregnancy_id, visit_date, provider_id, gestational_age_weeks, gestational_age_days, fundal_height_cm, fetal_heart_rate, fetal_presentation, weight_kg, bp_systolic, bp_diastolic, urine_protein, urine_glucose, edema, complaints, notes)
VALUES
  ('e4444444-0001-4444-4444-444444444444', 'c4444444-4444-4444-4444-444444444444', '2b902657-6a20-4435-a78a-576f397517ca', 'd4444444-4444-4444-4444-444444444444', NOW() - INTERVAL '4 weeks', 'b5555555-5555-5555-5555-555555555555', 33, 5, 33.0, 148, 'cephalic', 78.0, 132, 84, 'trace', 'negative', true, ARRAY['Headache', 'Ankle swelling'], 'BP elevated from baseline (was 110/70 at 20w). Trace proteinuria. 24hr urine ordered. Labs: platelets 180k, creatinine 0.8, LFTs normal.'),
  ('e4444444-0002-4444-4444-444444444444', 'c4444444-4444-4444-4444-444444444444', '2b902657-6a20-4435-a78a-576f397517ca', 'd4444444-4444-4444-4444-444444444444', NOW() - INTERVAL '2 weeks', 'b5555555-5555-5555-5555-555555555555', 35, 5, 35.5, 150, 'cephalic', 79.5, 148, 92, '2+', 'negative', true, ARRAY['Severe headache', 'Visual disturbances', 'Epigastric pain', 'Rapid weight gain'], 'Severe features: BP 148/92, proteinuria 2+, headache with scotomata, epigastric pain. Labs: platelets 145k (dropping), AST 58, ALT 52, LDH 280. Admitted for monitoring. Betamethasone given for fetal lung maturity.'),
  ('e4444444-0003-4444-4444-444444444444', 'c4444444-4444-4444-4444-444444444444', '2b902657-6a20-4435-a78a-576f397517ca', 'd4444444-4444-4444-4444-444444444444', NOW() - INTERVAL '6 days', 'b5555555-5555-5555-5555-555555555555', 37, 0, 36.5, 155, 'cephalic', 81.0, 162, 98, '3+', 'negative', true, ARRAY['Severe headache worsening', 'RUQ pain', 'Blurred vision'], 'Worsening preeclampsia: BP 162/98, proteinuria 3+, platelets 118k, AST 85, ALT 78, LDH 350. Decision for emergency C-section. Magnesium sulfate started. Consent obtained.')
ON CONFLICT (id) DO NOTHING;

-- Labor events (brief — progressed to C-section)
INSERT INTO ld_labor_events (id, patient_id, tenant_id, pregnancy_id, event_time, stage, dilation_cm, effacement_percent, station, contraction_frequency_per_10min, contraction_intensity, membrane_status, maternal_bp_systolic, maternal_bp_diastolic, maternal_hr, maternal_temp_c, notes)
VALUES
  ('74444444-0001-4444-4444-444444444444', 'c4444444-4444-4444-4444-444444444444', '2b902657-6a20-4435-a78a-576f397517ca', 'd4444444-4444-4444-4444-444444444444', NOW() - INTERVAL '5 days 6 hours', 'first_latent', 1.0, 30, -3, 1, 'mild', 'intact', 158, 96, 98, 37.0, 'Prepped for emergency C-section. Magnesium sulfate 4g IV bolus then 2g/hr. Labetalol 20mg IV for BP. Not in active labor — delivery for maternal indication.'),
  ('74444444-0002-4444-4444-444444444444', 'c4444444-4444-4444-4444-444444444444', '2b902657-6a20-4435-a78a-576f397517ca', 'd4444444-4444-4444-4444-444444444444', NOW() - INTERVAL '5 days 5 hours', 'first_latent', 1.0, 30, -3, 1, 'mild', 'intact', 146, 90, 95, 37.1, 'Anesthesia evaluation. Spinal anesthesia planned. Labs checked: platelets 112k (adequate for spinal). To OR.')
ON CONFLICT (id) DO NOTHING;

-- Fetal monitoring — Category II (indeterminate)
INSERT INTO ld_fetal_monitoring (id, patient_id, tenant_id, pregnancy_id, assessment_time, assessed_by, fhr_baseline, variability, accelerations_present, deceleration_type, deceleration_depth_bpm, fhr_category, uterine_activity, interpretation, action_taken)
VALUES (
  'f4444444-0001-4444-4444-444444444444',
  'c4444444-4444-4444-4444-444444444444',
  '2b902657-6a20-4435-a78a-576f397517ca',
  'd4444444-4444-4444-4444-444444444444',
  NOW() - INTERVAL '5 days 5 hours',
  'b6666666-6666-6666-6666-666666666666',
  155, 'minimal', false, 'variable', 15, 'II',
  'Irregular uterine activity',
  'Category II: tachycardic baseline (155), minimal variability, variable decelerations. Likely fetal stress from maternal preeclampsia.',
  'Emergency C-section proceeding for maternal indication. Pediatrics notified.'
) ON CONFLICT (id) DO NOTHING;

-- Delivery record — emergency C-section
INSERT INTO ld_delivery_records (id, patient_id, tenant_id, pregnancy_id, delivery_datetime, delivery_provider_id, method, anesthesia, labor_duration_hours, estimated_blood_loss_ml, complications, episiotomy, cord_clamping, cord_gases_ph, cord_gases_base_excess, placenta_delivery_time, placenta_intact, notes)
VALUES (
  '84444444-0001-4444-4444-444444444444',
  'c4444444-4444-4444-4444-444444444444',
  '2b902657-6a20-4435-a78a-576f397517ca',
  'd4444444-4444-4444-4444-444444444444',
  NOW() - INTERVAL '5 days 4 hours',
  'b5555555-5555-5555-5555-555555555555',
  'Repeat cesarean (emergency)', 'spinal', NULL, 800,
  ARRAY['Severe preeclampsia', 'Elevated blood loss'],
  false, 'immediate', 7.22, -5.2,
  NOW() - INTERVAL '5 days 3 hours 55 minutes',
  true,
  'Emergency repeat C-section under spinal anesthesia for worsening preeclampsia with severe features. Pfannenstiel incision. Low transverse uterine incision. Male infant delivered in vertex. Immediate cord clamping due to maternal condition. Neonatology team present. EBL 800cc — uterotonics given (oxytocin, methylergonovine). Uterus well-contracted at closure. Magnesium continued postop.'
) ON CONFLICT (id) DO NOTHING;

-- Newborn assessment — needs observation
INSERT INTO ld_newborn_assessments (id, patient_id, tenant_id, pregnancy_id, delivery_id, birth_datetime, sex, weight_g, length_cm, head_circumference_cm, apgar_1_min, apgar_5_min, apgar_10_min, temperature_c, heart_rate, respiratory_rate, disposition, skin_color, reflexes, anomalies, vitamin_k_given, erythromycin_given, hepatitis_b_vaccine, notes)
VALUES (
  '94444444-0001-4444-4444-444444444444',
  'c4444444-4444-4444-4444-444444444444',
  '2b902657-6a20-4435-a78a-576f397517ca',
  'd4444444-4444-4444-4444-444444444444',
  '84444444-0001-4444-4444-444444444444',
  NOW() - INTERVAL '5 days 4 hours',
  'male', 2650, 47.5, 33.0,
  6, 8, 9,
  36.5, 158, 52,
  'observation_nursery',
  'Pale, acrocyanosis, mild grunting at 1 min',
  'Slightly decreased tone at 1 min, improved by 5 min',
  ARRAY['Transient tachypnea of newborn'],
  true, true, false,
  'Late preterm (37+2) male. Initial grunting and tachypnea — TTN suspected. Supplemental O2 brief (15 min). Resolved by 2 hours of life. Observation nursery for 24hr monitoring. Blood glucose stable. Started feeding at 4 hours — formula initially, then expressed breast milk. Birth weight 2650g (10th percentile — IUGR concern, likely related to preeclampsia).'
) ON CONFLICT (id) DO NOTHING;

-- Postpartum assessments — complex
INSERT INTO ld_postpartum_assessments (id, patient_id, tenant_id, pregnancy_id, assessment_datetime, assessed_by, hours_postpartum, fundal_height, fundal_firmness, lochia, lochia_amount, bp_systolic, bp_diastolic, heart_rate, temperature_c, breastfeeding_status, lactation_notes, pain_score, pain_location, emotional_status, epds_score, voiding, bowel_movement, incision_intact, notes)
VALUES
  ('24444444-0001-4444-4444-444444444444', 'c4444444-4444-4444-4444-444444444444', '2b902657-6a20-4435-a78a-576f397517ca', 'd4444444-4444-4444-4444-444444444444', NOW() - INTERVAL '5 days', 'b6666666-6666-6666-6666-666666666666', 4.0, 'at umbilicus', 'firm', 'rubra', 'heavy', 148, 88, 92, 37.2, 'not_initiated', 'Baby in observation nursery. Pumping colostrum for transport.', 7, 'Incision and uterine cramping', 'anxious', NULL, false, false, true, 'PP 4 hours post C-section. Magnesium sulfate continuing 2g/hr. BP still elevated 148/88 — labetalol 200mg PO Q8h started. I&O strict monitoring. Foley catheter in place. PCA morphine for pain. Baby in observation — mother anxious about separation.'),
  ('24444444-0002-4444-4444-444444444444', 'c4444444-4444-4444-4444-444444444444', '2b902657-6a20-4435-a78a-576f397517ca', 'd4444444-4444-4444-4444-444444444444', NOW() - INTERVAL '4 days', 'b6666666-6666-6666-6666-666666666666', 24.0, '1 below umbilicus', 'firm', 'rubra', 'moderate', 142, 84, 82, 37.0, 'pumping', 'Pumping Q3hr. Colostrum transported to nursery for baby.', 5, 'Incision', 'tearful', 12, true, false, true, 'PP day 1. Magnesium discontinued (24hr completed). BP improving: 142/84 on labetalol. Foley removed — voiding well. Ambulating with assistance. Incision clean, dry, intact. Staples in place. EPDS screening: 12 (borderline — will rescreen at discharge). Baby improving — moved to rooming-in this afternoon.'),
  ('24444444-0003-4444-4444-444444444444', 'c4444444-4444-4444-4444-444444444444', '2b902657-6a20-4435-a78a-576f397517ca', 'd4444444-4444-4444-4444-444444444444', NOW() - INTERVAL '1 day', 'b6666666-6666-6666-6666-666666666666', 96.0, '3 below umbilicus', 'firm', 'serosa', 'light', 132, 78, 76, 36.8, 'established', 'Breastfeeding well. Baby gaining weight — birth weight regained. No formula supplementation needed.', 3, 'Incision — improving', 'improving', 8, true, true, true, 'PP day 4. BP well-controlled on labetalol 200mg BID — trending down. Labs improving: platelets 168k, AST 32, ALT 28. EPDS rescreen: 8 (improved from 12). Baby rooming-in, breastfeeding established. Plan discharge tomorrow with 1-week BP check and OB follow-up.')
ON CONFLICT (id) DO NOTHING;

-- Medications for Patient 4
INSERT INTO ld_medication_administrations (id, patient_id, tenant_id, pregnancy_id, administered_datetime, administered_by, medication_name, dose, route, indication, notes)
VALUES
  ('04444444-0001-4444-4444-444444444444', 'c4444444-4444-4444-4444-444444444444', '2b902657-6a20-4435-a78a-576f397517ca', 'd4444444-4444-4444-4444-444444444444', NOW() - INTERVAL '2 weeks', 'b5555555-5555-5555-5555-555555555555', 'Betamethasone', '12 mg', 'intramuscular', 'Fetal lung maturity — preeclampsia, possible preterm delivery', 'First dose. Second dose 24hr later.'),
  ('04444444-0002-4444-4444-444444444444', 'c4444444-4444-4444-4444-444444444444', '2b902657-6a20-4435-a78a-576f397517ca', 'd4444444-4444-4444-4444-444444444444', NOW() - INTERVAL '5 days 6 hours', 'b6666666-6666-6666-6666-666666666666', 'Magnesium sulfate', '4g IV bolus then 2g/hr', 'intravenous', 'Seizure prophylaxis — severe preeclampsia', 'Continued for 24 hours postpartum.'),
  ('04444444-0003-4444-4444-444444444444', 'c4444444-4444-4444-4444-444444444444', '2b902657-6a20-4435-a78a-576f397517ca', 'd4444444-4444-4444-4444-444444444444', NOW() - INTERVAL '5 days 6 hours', 'b5555555-5555-5555-5555-555555555555', 'Labetalol', '20 mg IV push', 'intravenous', 'Acute hypertension — BP 162/98', 'Transitioned to PO 200mg BID postoperatively.'),
  ('04444444-0004-4444-4444-444444444444', 'c4444444-4444-4444-4444-444444444444', '2b902657-6a20-4435-a78a-576f397517ca', 'd4444444-4444-4444-4444-444444444444', NOW() - INTERVAL '4 days', 'b6666666-6666-6666-6666-666666666666', 'Labetalol', '200 mg', 'oral', 'Postpartum hypertension control', 'BID dosing. Target BP <140/90.'),
  ('04444444-0005-4444-4444-444444444444', 'c4444444-4444-4444-4444-444444444444', '2b902657-6a20-4435-a78a-576f397517ca', 'd4444444-4444-4444-4444-444444444444', NOW() - INTERVAL '4 days', 'b6666666-6666-6666-6666-666666666666', 'Ketorolac', '30 mg', 'intravenous', 'Post-cesarean pain management', 'Q6hr x 48hr then transition to ibuprofen.'),
  ('04444444-0006-4444-4444-444444444444', 'c4444444-4444-4444-4444-444444444444', '2b902657-6a20-4435-a78a-576f397517ca', 'd4444444-4444-4444-4444-444444444444', NOW() - INTERVAL '10 months', NULL, 'Prenatal vitamins with iron', '1 tablet', 'oral', 'Prenatal supplementation + iron for Rh-negative', NULL),
  ('04444444-0007-4444-4444-444444444444', 'c4444444-4444-4444-4444-444444444444', '2b902657-6a20-4435-a78a-576f397517ca', 'd4444444-4444-4444-4444-444444444444', NOW() - INTERVAL '9 weeks', 'b5555555-5555-5555-5555-555555555555', 'RhoGAM (Anti-D immunoglobulin)', '300 mcg', 'intramuscular', 'Rh-negative prophylaxis at 28 weeks', NULL)
ON CONFLICT (id) DO NOTHING;

-- Risk assessment — critical
INSERT INTO ld_risk_assessments (id, patient_id, tenant_id, pregnancy_id, assessment_date, assessed_by, risk_level, risk_factors, score, scoring_system, notes)
VALUES (
  '54444444-0001-4444-4444-444444444444',
  'c4444444-4444-4444-4444-444444444444',
  '2b902657-6a20-4435-a78a-576f397517ca',
  'd4444444-4444-4444-4444-444444444444',
  NOW() - INTERVAL '6 days',
  'b5555555-5555-5555-5555-555555555555',
  'critical',
  ARRAY['Severe preeclampsia with severe features', 'Thrombocytopenia (platelets 112k)', 'Elevated liver enzymes (approaching HELLP)', 'Rh-negative sensitization risk', 'Previous cesarean delivery', 'Advanced maternal age (36)'],
  92, 'WellFit OB Risk Score',
  'Critical risk. Worsening preeclampsia with lab derangements approaching HELLP criteria. Emergency delivery indicated. MFM consulted. Neonatology on standby.'
) ON CONFLICT (id) DO NOTHING;

-- Active alerts for Patient 4
INSERT INTO ld_alerts (id, patient_id, tenant_id, pregnancy_id, alert_type, severity, message, acknowledged, acknowledged_by, acknowledged_at, resolved, resolved_by, resolved_at, resolution_notes)
VALUES
  ('64444444-0001-4444-4444-444444444444', 'c4444444-4444-4444-4444-444444444444', '2b902657-6a20-4435-a78a-576f397517ca', 'd4444444-4444-4444-4444-444444444444', 'severe_preeclampsia', 'critical', 'Severe preeclampsia: BP 162/98, proteinuria 3+, platelets 112k, elevated LFTs. Emergency delivery performed.', true, 'b5555555-5555-5555-5555-555555555555', NOW() - INTERVAL '5 days 5 hours', true, 'b5555555-5555-5555-5555-555555555555', NOW() - INTERVAL '5 days 4 hours', 'Delivered via emergency C-section. Magnesium sulfate administered.'),
  ('64444444-0002-4444-4444-444444444444', 'c4444444-4444-4444-4444-444444444444', '2b902657-6a20-4435-a78a-576f397517ca', 'd4444444-4444-4444-4444-444444444444', 'postpartum_hypertension', 'high', 'Postpartum BP elevated: 148/88 at 4hr PP, 142/84 at 24hr. On labetalol 200mg BID. Trending down but requires outpatient follow-up.', true, 'b5555555-5555-5555-5555-555555555555', NOW() - INTERVAL '4 days', false, NULL, NULL, NULL),
  ('64444444-0003-4444-4444-444444444444', 'c4444444-4444-4444-4444-444444444444', '2b902657-6a20-4435-a78a-576f397517ca', 'd4444444-4444-4444-4444-444444444444', 'ppd_positive_screen', 'medium', 'EPDS score 12 at PP day 1 (borderline). Improved to 8 at PP day 4. Continue monitoring at outpatient visit.', false, NULL, NULL, false, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- Done. 4 patients seeded with full end-to-end L&D data.
-- ============================================================================
-- Patient 1 (Keisha Williams):  Active high-risk, GDM on insulin, 32 weeks
-- Patient 2 (Amara Okafor):     Active low-risk, primigravida, 37 weeks, near term
-- Patient 3 (Sarah Chen):       2 days post vaginal delivery, healthy baby, rooming in
-- Patient 4 (Jennifer Rodriguez): 5 days post emergency C-section for preeclampsia, complex recovery
-- ============================================================================
