-- =============================================================================
-- FLOYD LEBLANC DEMO DATA + STAFF AUTH FIXES + PATIENT AVATAR
-- =============================================================================
-- Purpose: Enrich Floyd LeBlanc's account with rich clinical data for
--          tap-through hospital demos. Also fix demo staff auth accounts
--          so persona switcher works with real Supabase auth.
--
-- Clinical Profile: 68M, Post-Hip Surgery + CHF + Type 2 Diabetes
-- Phone: +19728025786  |  Password: Password123!
--
-- Demo Staff (all use DemoStaff2026!):
--   Dr. Sarah Williams (Physician)  - b1111111-1111-1111-1111-111111111111
--   James Rodriguez (Nurse)         - b2222222-2222-2222-2222-222222222222
--   Lisa Park (Case Manager)        - b3333333-3333-3333-3333-333333333333
-- =============================================================================

-- Temporarily disable profile triggers that block seed operations:
-- trg_profiles_restrict: blocks updates when auth.uid() is NULL (migration context)
-- trg_sync_user_roles: auto-syncs user_roles on profile insert/update (causes duplicates)
ALTER TABLE profiles DISABLE TRIGGER trg_profiles_restrict;
ALTER TABLE profiles DISABLE TRIGGER trg_sync_user_roles;

-- Use a DO block so we can look up Floyd's UUID dynamically
DO $$
DECLARE
  v_floyd_id UUID;
  v_tenant_id UUID := '2b902657-6a20-4435-a78a-576f397517ca';
  v_dr_williams_id UUID := 'b1111111-1111-1111-1111-111111111111';
  v_james_id UUID := 'b2222222-2222-2222-2222-222222222222';
  v_lisa_id UUID := 'b3333333-3333-3333-3333-333333333333';
BEGIN

-- =============================================================================
-- PART 1: DEMO STAFF AUTH ACCOUNTS (real bcrypt passwords)
-- =============================================================================
-- These must work with real Supabase auth. The previous seed used fake hashes.
-- ON CONFLICT DO UPDATE ensures the password is fixed if account already exists.

-- Dr. Sarah Williams (Physician)
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_user_meta_data, role, aud,
  confirmation_token, recovery_token
) VALUES (
  v_dr_williams_id,
  '00000000-0000-0000-0000-000000000000',
  'dr.williams@demo.wellfit.com',
  crypt('DemoStaff2026!', gen_salt('bf')),
  NOW(),
  NOW() - INTERVAL '6 months',
  NOW(),
  '{"first_name": "Sarah", "last_name": "Williams", "role": "physician"}'::jsonb,
  'authenticated',
  'authenticated',
  '', ''
) ON CONFLICT (id) DO UPDATE SET
  encrypted_password = crypt('DemoStaff2026!', gen_salt('bf')),
  email_confirmed_at = COALESCE(auth.users.email_confirmed_at, NOW()),
  raw_user_meta_data = '{"first_name": "Sarah", "last_name": "Williams", "role": "physician"}'::jsonb,
  updated_at = NOW();

-- James Rodriguez (Nurse)
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_user_meta_data, role, aud,
  confirmation_token, recovery_token
) VALUES (
  v_james_id,
  '00000000-0000-0000-0000-000000000000',
  'james.rodriguez@demo.wellfit.com',
  crypt('DemoStaff2026!', gen_salt('bf')),
  NOW(),
  NOW() - INTERVAL '6 months',
  NOW(),
  '{"first_name": "James", "last_name": "Rodriguez", "role": "nurse"}'::jsonb,
  'authenticated',
  'authenticated',
  '', ''
) ON CONFLICT (id) DO UPDATE SET
  encrypted_password = crypt('DemoStaff2026!', gen_salt('bf')),
  email_confirmed_at = COALESCE(auth.users.email_confirmed_at, NOW()),
  raw_user_meta_data = '{"first_name": "James", "last_name": "Rodriguez", "role": "nurse"}'::jsonb,
  updated_at = NOW();

-- Lisa Park (Case Manager)
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_user_meta_data, role, aud,
  confirmation_token, recovery_token
) VALUES (
  v_lisa_id,
  '00000000-0000-0000-0000-000000000000',
  'lisa.park@demo.wellfit.com',
  crypt('DemoStaff2026!', gen_salt('bf')),
  NOW(),
  NOW() - INTERVAL '6 months',
  NOW(),
  '{"first_name": "Lisa", "last_name": "Park", "role": "case_manager"}'::jsonb,
  'authenticated',
  'authenticated',
  '', ''
) ON CONFLICT (id) DO UPDATE SET
  encrypted_password = crypt('DemoStaff2026!', gen_salt('bf')),
  email_confirmed_at = COALESCE(auth.users.email_confirmed_at, NOW()),
  raw_user_meta_data = '{"first_name": "Lisa", "last_name": "Park", "role": "case_manager"}'::jsonb,
  updated_at = NOW();

-- Staff profiles (ON CONFLICT DO UPDATE to fix incomplete profiles)
INSERT INTO profiles (user_id, role_id, email, first_name, last_name, phone, dob, gender, city, state, zip_code, tenant_id, onboarded, consent, created_at)
VALUES
  (v_dr_williams_id, 7, 'dr.williams@demo.wellfit.com', 'Sarah', 'Williams', '555-0201', '1975-06-20', 'Female', 'Houston', 'TX', '77030', v_tenant_id, true, true, NOW() - INTERVAL '6 months'),
  (v_james_id, 3, 'james.rodriguez@demo.wellfit.com', 'James', 'Rodriguez', '555-0202', '1988-09-14', 'Male', 'Houston', 'TX', '77030', v_tenant_id, true, true, NOW() - INTERVAL '6 months'),
  (v_lisa_id, 14, 'lisa.park@demo.wellfit.com', 'Lisa', 'Park', '555-0203', '1982-11-03', 'Female', 'Houston', 'TX', '77030', v_tenant_id, true, true, NOW() - INTERVAL '6 months')
ON CONFLICT (user_id) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  zip_code = EXCLUDED.zip_code,
  tenant_id = EXCLUDED.tenant_id,
  onboarded = true,
  consent = true,
  updated_at = NOW();

-- User roles for staff
INSERT INTO user_roles (user_id, role_id, role, tenant_id)
VALUES
  (v_dr_williams_id, 7, 'physician', v_tenant_id),
  (v_james_id, 3, 'nurse', v_tenant_id),
  (v_lisa_id, 14, 'case_manager', v_tenant_id)
ON CONFLICT (user_id) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  role = EXCLUDED.role,
  tenant_id = EXCLUDED.tenant_id;

-- Staff PINs (all use 1234)
INSERT INTO staff_pins (user_id, role, pin_hash)
VALUES
  (v_dr_williams_id, 'physician', crypt('1234', gen_salt('bf'))),
  (v_james_id, 'nurse', crypt('1234', gen_salt('bf'))),
  (v_lisa_id, 'case_manager', crypt('1234', gen_salt('bf')))
ON CONFLICT (user_id, role) DO UPDATE SET
  pin_hash = crypt('1234', gen_salt('bf')),
  updated_at = NOW();


-- =============================================================================
-- PART 2: FIND FLOYD'S UUID
-- =============================================================================
SELECT id INTO v_floyd_id FROM auth.users WHERE phone = '+19728025786';

IF v_floyd_id IS NULL THEN
  RAISE NOTICE 'Floyd LeBlanc not found by phone +19728025786. Skipping clinical data seed.';
  RETURN;
END IF;

RAISE NOTICE 'Found Floyd LeBlanc: %', v_floyd_id;


-- =============================================================================
-- PART 3: UPDATE FLOYD'S PROFILE
-- =============================================================================
UPDATE profiles SET
  first_name = 'Floyd',
  last_name = 'LeBlanc',
  dob = '1957-08-22',
  gender = 'Male',
  city = 'Houston',
  state = 'TX',
  zip_code = '77001',
  tenant_id = v_tenant_id,
  onboarded = true,
  consent = true,
  demographics_complete = true,
  updated_at = NOW()
WHERE user_id = v_floyd_id;


-- =============================================================================
-- PART 4: PATIENT AVATAR (for body map demo)
-- =============================================================================
INSERT INTO patient_avatars (id, patient_id, skin_tone, gender_presentation, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  v_floyd_id,
  'medium',
  'male',
  NOW(),
  NOW()
) ON CONFLICT (patient_id) DO UPDATE SET
  skin_tone = 'medium',
  gender_presentation = 'male',
  updated_at = NOW();

-- Avatar markers showing clinical conditions on body map
INSERT INTO patient_markers (id, patient_id, category, marker_type, display_name, body_region, position_x, position_y, body_view, source, status, confidence_score, details, is_active, requires_attention, created_by)
VALUES
  -- Hip surgery marker (right hip)
  (gen_random_uuid(), v_floyd_id, 'critical', 'surgical_site', 'Right Hip Arthroplasty', 'right_hip', 38.0, 58.0, 'front', 'manual', 'confirmed', 0.99,
   '{"procedure": "Total hip arthroplasty", "date": "2 weeks ago", "surgeon": "Dr. Sarah Williams", "notes": "Healing well, sutures removed"}'::jsonb,
   true, true, v_dr_williams_id),
  -- CHF marker (heart)
  (gen_random_uuid(), v_floyd_id, 'chronic', 'condition', 'Congestive Heart Failure', 'chest', 52.0, 32.0, 'front', 'manual', 'confirmed', 0.95,
   '{"condition": "CHF NYHA Class II", "ejection_fraction": "40%", "last_echo": "3 months ago", "notes": "Stable on current medication regimen"}'::jsonb,
   true, true, v_dr_williams_id),
  -- Diabetes marker (pancreas area)
  (gen_random_uuid(), v_floyd_id, 'chronic', 'condition', 'Type 2 Diabetes', 'abdomen', 48.0, 45.0, 'front', 'manual', 'confirmed', 0.95,
   '{"condition": "T2DM", "last_a1c": "7.8%", "on_insulin": true, "notes": "Blood glucose moderately controlled, insulin glargine at bedtime"}'::jsonb,
   true, false, v_dr_williams_id),
  -- Hypertension marker
  (gen_random_uuid(), v_floyd_id, 'monitoring', 'vital_sign', 'Hypertension', 'left_arm', 22.0, 38.0, 'front', 'manual', 'confirmed', 0.90,
   '{"condition": "Essential hypertension", "target_bp": "< 130/80", "current_avg": "138/82", "notes": "Monitoring closely post-surgery"}'::jsonb,
   true, false, v_dr_williams_id),
  -- Post-op pain marker (right hip, back view)
  (gen_random_uuid(), v_floyd_id, 'moderate', 'symptom', 'Post-Surgical Pain', 'right_hip', 62.0, 55.0, 'back', 'manual', 'confirmed', 0.85,
   '{"pain_level": "4/10 and decreasing", "trend": "improving", "management": "Oxycodone PRN, transitioning to acetaminophen", "notes": "Pain well-controlled, decreasing daily"}'::jsonb,
   true, true, v_james_id),
  -- Surgical scar (back view)
  (gen_random_uuid(), v_floyd_id, 'informational', 'surgical_site', 'Surgical Incision Site', 'right_hip', 60.0, 57.0, 'back', 'manual', 'confirmed', 0.95,
   '{"incision_length": "15cm", "healing_status": "Good granulation", "sutures": "Removed", "infection_signs": "None"}'::jsonb,
   true, false, v_james_id),
  -- PICC line (right inner arm)
  (gen_random_uuid(), v_floyd_id, 'critical', 'access_line', 'PICC Line - Right Arm', 'right_arm', 72.0, 40.0, 'front', 'manual', 'confirmed', 0.99,
   '{"line_type": "PICC", "insertion_site": "Right basilic vein", "inserted_date": "2 weeks ago (day of surgery)", "lumen": "Double lumen", "french_size": "5 Fr", "tip_position": "Cavoatrial junction confirmed by CXR", "flush_schedule": "Heparin lock Q12H", "dressing_change": "Every 7 days or PRN", "next_dressing_due": "Tomorrow", "complications": "None", "use": "IV antibiotics (cefazolin prophylaxis completed), IV fluids PRN, blood draws", "notes": "Placed perioperatively for surgical antibiotic prophylaxis. Maintained for post-op IV access and lab draws. Evaluate for removal at 3-week post-op visit if no longer needed."}'::jsonb,
   true, true, v_james_id);


-- =============================================================================
-- PART 5: FHIR CONDITIONS (Diagnoses)
-- =============================================================================
INSERT INTO fhir_conditions (id, clinical_status, verification_status, category, code_system, code, code_display, patient_id, onset_datetime, recorded_date, note, is_primary)
VALUES
  -- CHF
  (gen_random_uuid(), 'active', 'confirmed', ARRAY['problem-list-item'], 'http://hl7.org/fhir/sid/icd-10-cm', 'I50.9', 'Heart failure, unspecified', v_floyd_id,
   NOW() - INTERVAL '2 years', NOW() - INTERVAL '2 years', 'NYHA Class II. EF 40%. Stable on carvedilol + furosemide + lisinopril.', true),
  -- Type 2 Diabetes
  (gen_random_uuid(), 'active', 'confirmed', ARRAY['problem-list-item'], 'http://hl7.org/fhir/sid/icd-10-cm', 'E11.9', 'Type 2 diabetes mellitus without complications', v_floyd_id,
   NOW() - INTERVAL '5 years', NOW() - INTERVAL '5 years', 'A1C 7.8%. On metformin 1000mg BID + insulin glargine 20 units at bedtime.', false),
  -- Hypertension
  (gen_random_uuid(), 'active', 'confirmed', ARRAY['problem-list-item'], 'http://hl7.org/fhir/sid/icd-10-cm', 'I10', 'Essential (primary) hypertension', v_floyd_id,
   NOW() - INTERVAL '8 years', NOW() - INTERVAL '8 years', 'Target < 130/80. Currently averaging 138/82 on lisinopril 20mg daily.', false),
  -- Hyperlipidemia
  (gen_random_uuid(), 'active', 'confirmed', ARRAY['problem-list-item'], 'http://hl7.org/fhir/sid/icd-10-cm', 'E78.5', 'Hyperlipidemia, unspecified', v_floyd_id,
   NOW() - INTERVAL '6 years', NOW() - INTERVAL '6 years', 'LDL 118 on atorvastatin 40mg. Target < 100 given CHF.', false),
  -- Status post hip arthroplasty
  (gen_random_uuid(), 'active', 'confirmed', ARRAY['encounter-diagnosis'], 'http://hl7.org/fhir/sid/icd-10-cm', 'Z96.641', 'Presence of right artificial hip joint', v_floyd_id,
   NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days', 'Right total hip arthroplasty 2 weeks ago. Healing well, PT started.', false)
ON CONFLICT DO NOTHING;


-- =============================================================================
-- PART 6: MEDICATIONS
-- =============================================================================
INSERT INTO medications (id, user_id, medication_name, generic_name, dosage, dosage_form, strength, frequency, route, instructions, prescribed_by, prescribed_date, purpose, status, needs_review, created_at)
VALUES
  -- CHF medications
  (gen_random_uuid(), v_floyd_id, 'Lisinopril', 'Lisinopril', '20mg', 'tablet', '20mg', 'Once daily', 'oral', 'Take once daily in the morning. Monitor blood pressure.', 'Dr. Sarah Williams', CURRENT_DATE - 730, 'Blood pressure / Heart failure', 'active', false, NOW()),
  (gen_random_uuid(), v_floyd_id, 'Carvedilol', 'Carvedilol', '12.5mg', 'tablet', '12.5mg', 'Twice daily', 'oral', 'Take twice daily with food. Do not stop suddenly.', 'Dr. Sarah Williams', CURRENT_DATE - 730, 'Heart failure / Blood pressure', 'active', false, NOW()),
  (gen_random_uuid(), v_floyd_id, 'Furosemide', 'Furosemide', '40mg', 'tablet', '40mg', 'Once daily', 'oral', 'Take in the morning. Weigh yourself daily - report gain > 2 lbs.', 'Dr. Sarah Williams', CURRENT_DATE - 365, 'Heart failure fluid management', 'active', false, NOW()),
  -- Diabetes medications
  (gen_random_uuid(), v_floyd_id, 'Metformin', 'Metformin HCl', '1000mg', 'tablet', '1000mg', 'Twice daily', 'oral', 'Take with meals to reduce stomach upset.', 'Dr. Sarah Williams', CURRENT_DATE - 1825, 'Type 2 Diabetes', 'active', false, NOW()),
  (gen_random_uuid(), v_floyd_id, 'Insulin Glargine', 'Insulin glargine', '20 units', 'injection', '100 units/mL', 'Once daily at bedtime', 'subcutaneous', 'Inject 20 units subcutaneously at bedtime. Rotate injection sites.', 'Dr. Sarah Williams', CURRENT_DATE - 365, 'Type 2 Diabetes - basal insulin', 'active', false, NOW()),
  -- Cholesterol
  (gen_random_uuid(), v_floyd_id, 'Atorvastatin', 'Atorvastatin', '40mg', 'tablet', '40mg', 'Once daily at bedtime', 'oral', 'Take at bedtime. Report any muscle pain or weakness.', 'Dr. Sarah Williams', CURRENT_DATE - 2190, 'High cholesterol', 'active', false, NOW()),
  -- Cardiovascular
  (gen_random_uuid(), v_floyd_id, 'Aspirin', 'Aspirin', '81mg', 'tablet', '81mg', 'Once daily', 'oral', 'Take low-dose aspirin daily with food.', 'Dr. Sarah Williams', CURRENT_DATE - 730, 'Cardiovascular prevention', 'active', false, NOW()),
  -- Post-op pain (short-term)
  (gen_random_uuid(), v_floyd_id, 'Oxycodone', 'Oxycodone HCl', '5mg', 'tablet', '5mg', 'Every 6 hours as needed', 'oral', 'Take every 6 hours as needed for moderate-severe pain. Do not exceed 4 doses/day. Taper as pain improves.', 'Dr. Sarah Williams', CURRENT_DATE - 14, 'Post-operative pain (hip surgery)', 'active', true, NOW())
ON CONFLICT DO NOTHING;


-- =============================================================================
-- PART 7: FHIR OBSERVATIONS (Vitals - trending data)
-- =============================================================================
INSERT INTO fhir_observations (id, status, category, code_system, code, code_display, patient_id, effective_datetime, value_quantity_value, value_quantity_unit, value_quantity_code, value_quantity_system, note)
VALUES
  -- Blood pressure readings (systolic) - trending down post-surgery
  (gen_random_uuid(), 'final', ARRAY['vital-signs'], 'http://loinc.org', '8480-6', 'Systolic blood pressure', v_floyd_id, NOW() - INTERVAL '14 days', 152, 'mmHg', 'mm[Hg]', 'http://unitsofmeasure.org', 'Post-op day 0 - elevated from surgical stress'),
  (gen_random_uuid(), 'final', ARRAY['vital-signs'], 'http://loinc.org', '8480-6', 'Systolic blood pressure', v_floyd_id, NOW() - INTERVAL '10 days', 144, 'mmHg', 'mm[Hg]', 'http://unitsofmeasure.org', 'Post-op day 4 - improving'),
  (gen_random_uuid(), 'final', ARRAY['vital-signs'], 'http://loinc.org', '8480-6', 'Systolic blood pressure', v_floyd_id, NOW() - INTERVAL '7 days', 140, 'mmHg', 'mm[Hg]', 'http://unitsofmeasure.org', 'Post-op follow-up'),
  (gen_random_uuid(), 'final', ARRAY['vital-signs'], 'http://loinc.org', '8480-6', 'Systolic blood pressure', v_floyd_id, NOW() - INTERVAL '3 days', 136, 'mmHg', 'mm[Hg]', 'http://unitsofmeasure.org', 'Cardiology visit - trending toward goal'),
  (gen_random_uuid(), 'final', ARRAY['vital-signs'], 'http://loinc.org', '8480-6', 'Systolic blood pressure', v_floyd_id, NOW(), 134, 'mmHg', 'mm[Hg]', 'http://unitsofmeasure.org', 'Today - approaching target of 130'),

  -- Diastolic BP
  (gen_random_uuid(), 'final', ARRAY['vital-signs'], 'http://loinc.org', '8462-4', 'Diastolic blood pressure', v_floyd_id, NOW() - INTERVAL '14 days', 92, 'mmHg', 'mm[Hg]', 'http://unitsofmeasure.org', NULL),
  (gen_random_uuid(), 'final', ARRAY['vital-signs'], 'http://loinc.org', '8462-4', 'Diastolic blood pressure', v_floyd_id, NOW() - INTERVAL '7 days', 86, 'mmHg', 'mm[Hg]', 'http://unitsofmeasure.org', NULL),
  (gen_random_uuid(), 'final', ARRAY['vital-signs'], 'http://loinc.org', '8462-4', 'Diastolic blood pressure', v_floyd_id, NOW(), 80, 'mmHg', 'mm[Hg]', 'http://unitsofmeasure.org', NULL),

  -- Blood glucose readings (with a spike on post-op day 3)
  (gen_random_uuid(), 'final', ARRAY['vital-signs'], 'http://loinc.org', '2339-0', 'Glucose [Mass/volume] in Blood', v_floyd_id, NOW() - INTERVAL '14 days', 198, 'mg/dL', 'mg/dL', 'http://unitsofmeasure.org', 'Post-op day 0 - stress hyperglycemia'),
  (gen_random_uuid(), 'final', ARRAY['vital-signs'], 'http://loinc.org', '2339-0', 'Glucose [Mass/volume] in Blood', v_floyd_id, NOW() - INTERVAL '11 days', 224, 'mg/dL', 'mg/dL', 'http://unitsofmeasure.org', 'Post-op day 3 SPIKE - steroid effect, insulin sliding scale applied'),
  (gen_random_uuid(), 'final', ARRAY['vital-signs'], 'http://loinc.org', '2339-0', 'Glucose [Mass/volume] in Blood', v_floyd_id, NOW() - INTERVAL '7 days', 168, 'mg/dL', 'mg/dL', 'http://unitsofmeasure.org', 'Improving after insulin adjustment'),
  (gen_random_uuid(), 'final', ARRAY['vital-signs'], 'http://loinc.org', '2339-0', 'Glucose [Mass/volume] in Blood', v_floyd_id, NOW() - INTERVAL '3 days', 142, 'mg/dL', 'mg/dL', 'http://unitsofmeasure.org', 'Trending to target'),
  (gen_random_uuid(), 'final', ARRAY['vital-signs'], 'http://loinc.org', '2339-0', 'Glucose [Mass/volume] in Blood', v_floyd_id, NOW(), 138, 'mg/dL', 'mg/dL', 'http://unitsofmeasure.org', 'Fasting glucose - approaching goal'),

  -- Heart rate
  (gen_random_uuid(), 'final', ARRAY['vital-signs'], 'http://loinc.org', '8867-4', 'Heart rate', v_floyd_id, NOW() - INTERVAL '14 days', 92, '/min', '/min', 'http://unitsofmeasure.org', 'Post-op - slightly elevated'),
  (gen_random_uuid(), 'final', ARRAY['vital-signs'], 'http://loinc.org', '8867-4', 'Heart rate', v_floyd_id, NOW() - INTERVAL '7 days', 78, '/min', '/min', 'http://unitsofmeasure.org', 'Improving'),
  (gen_random_uuid(), 'final', ARRAY['vital-signs'], 'http://loinc.org', '8867-4', 'Heart rate', v_floyd_id, NOW(), 72, '/min', '/min', 'http://unitsofmeasure.org', 'Normal resting rate on carvedilol'),

  -- O2 saturation
  (gen_random_uuid(), 'final', ARRAY['vital-signs'], 'http://loinc.org', '2708-6', 'Oxygen saturation in Arterial blood', v_floyd_id, NOW() - INTERVAL '14 days', 94, '%', '%', 'http://unitsofmeasure.org', 'Post-op - monitoring for CHF decompensation'),
  (gen_random_uuid(), 'final', ARRAY['vital-signs'], 'http://loinc.org', '2708-6', 'Oxygen saturation in Arterial blood', v_floyd_id, NOW(), 97, '%', '%', 'http://unitsofmeasure.org', 'Good - no CHF exacerbation'),

  -- Weight (important for CHF monitoring)
  (gen_random_uuid(), 'final', ARRAY['vital-signs'], 'http://loinc.org', '29463-7', 'Body weight', v_floyd_id, NOW() - INTERVAL '14 days', 210, 'lbs', '[lb_av]', 'http://unitsofmeasure.org', 'Post-op baseline weight'),
  (gen_random_uuid(), 'final', ARRAY['vital-signs'], 'http://loinc.org', '29463-7', 'Body weight', v_floyd_id, NOW() - INTERVAL '7 days', 212, 'lbs', '[lb_av]', 'http://unitsofmeasure.org', 'Slight gain - fluid retention monitored'),
  (gen_random_uuid(), 'final', ARRAY['vital-signs'], 'http://loinc.org', '29463-7', 'Body weight', v_floyd_id, NOW(), 209, 'lbs', '[lb_av]', 'http://unitsofmeasure.org', 'Weight stable - furosemide effective'),

  -- Temperature
  (gen_random_uuid(), 'final', ARRAY['vital-signs'], 'http://loinc.org', '8310-5', 'Body temperature', v_floyd_id, NOW() - INTERVAL '14 days', 99.1, 'degF', 'Cel', 'http://unitsofmeasure.org', 'Mild post-op elevation - no infection'),
  (gen_random_uuid(), 'final', ARRAY['vital-signs'], 'http://loinc.org', '8310-5', 'Body temperature', v_floyd_id, NOW(), 98.4, 'degF', 'Cel', 'http://unitsofmeasure.org', 'Normal'),

  -- Pain scores (decreasing post-op)
  (gen_random_uuid(), 'final', ARRAY['survey'], 'http://loinc.org', '72514-3', 'Pain severity - 0-10 verbal numeric rating', v_floyd_id, NOW() - INTERVAL '14 days', 8, '{score}', '{score}', 'http://unitsofmeasure.org', 'Post-op day 0 - expected severe pain'),
  (gen_random_uuid(), 'final', ARRAY['survey'], 'http://loinc.org', '72514-3', 'Pain severity - 0-10 verbal numeric rating', v_floyd_id, NOW() - INTERVAL '10 days', 6, '{score}', '{score}', 'http://unitsofmeasure.org', 'Improving with oxycodone PRN'),
  (gen_random_uuid(), 'final', ARRAY['survey'], 'http://loinc.org', '72514-3', 'Pain severity - 0-10 verbal numeric rating', v_floyd_id, NOW() - INTERVAL '7 days', 5, '{score}', '{score}', 'http://unitsofmeasure.org', 'Post-op follow-up - good progress'),
  (gen_random_uuid(), 'final', ARRAY['survey'], 'http://loinc.org', '72514-3', 'Pain severity - 0-10 verbal numeric rating', v_floyd_id, NOW() - INTERVAL '3 days', 3, '{score}', '{score}', 'http://unitsofmeasure.org', 'Transitioning to acetaminophen'),
  (gen_random_uuid(), 'final', ARRAY['survey'], 'http://loinc.org', '72514-3', 'Pain severity - 0-10 verbal numeric rating', v_floyd_id, NOW(), 2, '{score}', '{score}', 'http://unitsofmeasure.org', 'Minimal pain - recovery on track')
ON CONFLICT DO NOTHING;


-- =============================================================================
-- PART 8: ENCOUNTERS
-- =============================================================================
INSERT INTO encounters (id, patient_id, date_of_service, status, notes, created_by, created_at)
VALUES
  -- Hip surgery
  (gen_random_uuid(), v_floyd_id, CURRENT_DATE - 14, 'paid', 'Right total hip arthroplasty. Procedure uneventful. Discharged POD 2.', v_dr_williams_id, NOW() - INTERVAL '14 days'),
  -- Post-op follow-up
  (gen_random_uuid(), v_floyd_id, CURRENT_DATE - 7, 'submitted', 'Post-op follow-up: Wound healing well, sutures removed. PT initiated. Continue current medications.', v_dr_williams_id, NOW() - INTERVAL '7 days'),
  -- Cardiology visit
  (gen_random_uuid(), v_floyd_id, CURRENT_DATE - 3, 'submitted', 'Cardiology follow-up: CHF stable post-surgery. No decompensation. Continue carvedilol/furosemide/lisinopril. Echo in 3 months.', v_dr_williams_id, NOW() - INTERVAL '3 days'),
  -- Upcoming PT session
  (gen_random_uuid(), v_floyd_id, CURRENT_DATE + 2, 'draft', 'Scheduled: Physical therapy session - gait training, hip ROM exercises, strength building.', v_james_id, NOW())
ON CONFLICT DO NOTHING;


-- =============================================================================
-- PART 9: DAILY CHECK-INS (30+ days — pre-surgery baseline + recovery)
-- =============================================================================
INSERT INTO check_ins (user_id, timestamp, label, notes, is_emergency, emotional_state, heart_rate, pulse_oximeter, bp_systolic, bp_diastolic, glucose_mg_dl)
VALUES
  -- Pre-surgery baseline (routine CHF/diabetes management)
  (v_floyd_id, NOW() - INTERVAL '35 days', 'Daily Wellness', 'Routine day. Walked 15 minutes. Blood sugar a little high after breakfast.', false, 'good', 74, 96, 138, 84, 162),
  (v_floyd_id, NOW() - INTERVAL '34 days', 'Daily Wellness', 'Went to senior center for bingo. Had a great time seeing friends.', false, 'great', 72, 97, 136, 82, 148),
  (v_floyd_id, NOW() - INTERVAL '33 days', 'Daily Wellness', 'Hip pain flared up today. Hard to walk around house. Need to talk to doctor about surgery.', false, 'okay', 76, 96, 140, 86, 155),
  (v_floyd_id, NOW() - INTERVAL '32 days', 'Doctor Appointment', 'Met with Dr. Williams about hip replacement. Surgery scheduled for 2 weeks out. Nervous but ready.', false, 'anxious', 78, 96, 142, 86, 160),
  (v_floyd_id, NOW() - INTERVAL '30 days', 'Daily Wellness', 'Daughter came over. Helped me organize medications for surgery prep. Feeling better about it.', false, 'good', 74, 97, 134, 82, 145),
  (v_floyd_id, NOW() - INTERVAL '28 days', 'Daily Wellness', 'Good day. Pre-op bloodwork done. All results normal. Walking is getting harder on the hip.', false, 'okay', 75, 96, 136, 84, 152),
  (v_floyd_id, NOW() - INTERVAL '26 days', 'Attending Event', 'Went to community potluck. Made my famous gumbo. Everyone loved it. Hip was aching by end of night.', false, 'great', 76, 97, 138, 84, 158),
  (v_floyd_id, NOW() - INTERVAL '24 days', 'Daily Wellness', 'Quiet day at home. Did my exercises. Counting down to surgery.', false, 'okay', 74, 96, 136, 82, 148),
  (v_floyd_id, NOW() - INTERVAL '22 days', 'Daily Wellness', 'Church this morning. Community prayer was uplifting. Blood sugar was good today.', false, 'good', 73, 97, 134, 80, 140),
  (v_floyd_id, NOW() - INTERVAL '20 days', 'Daily Wellness', 'Met with case manager Lisa about post-surgery care plan. Feel prepared.', false, 'good', 74, 97, 136, 82, 146),
  (v_floyd_id, NOW() - INTERVAL '18 days', 'Daily Wellness', 'Played trivia on the app. Got 8 out of 10! Still sharp. Hip pain moderate today.', false, 'good', 75, 96, 138, 84, 150),
  (v_floyd_id, NOW() - INTERVAL '16 days', 'Daily Wellness', 'Last day before surgery tomorrow. Packed hospital bag. Daughter will drive me. Prayers up.', false, 'anxious', 80, 96, 142, 86, 158),
  (v_floyd_id, NOW() - INTERVAL '15 days', 'In Hospital', 'Surgery day. Checked in at 6 AM. Feeling nervous but Dr. Williams is confident.', false, 'anxious', 84, 95, 148, 90, 172),
  -- Post-surgery recovery (in hospital)
  (v_floyd_id, NOW() - INTERVAL '13 days', 'In Hospital', 'Post-op day 1. Pain is manageable with medication. Nurses are wonderful. Stood up with walker for first time.', false, 'okay', 82, 94, 146, 88, 188),
  -- Discharged, recovering at home
  (v_floyd_id, NOW() - INTERVAL '12 days', 'Daily Wellness', 'Home from hospital! So glad to be in my own bed. Daughter staying with me this week.', false, 'okay', 80, 95, 144, 88, 178),
  (v_floyd_id, NOW() - INTERVAL '11 days', 'Daily Wellness', 'Rough night - pain woke me up. Took oxycodone and it helped. Ate good breakfast.', false, 'okay', 82, 95, 142, 86, 168),
  (v_floyd_id, NOW() - INTERVAL '10 days', 'Daily Wellness', 'Better day. Made it to the kitchen on my own with walker. Blood sugar spiked after lunch.', false, 'okay', 80, 96, 140, 86, 192),
  (v_floyd_id, NOW() - INTERVAL '9 days', 'Daily Wellness', 'PT came for first home visit. Did gentle exercises. Sore afterwards but therapist says its normal.', false, 'okay', 78, 96, 140, 84, 165),
  (v_floyd_id, NOW() - INTERVAL '8 days', 'Daily Wellness', 'Slept through the night for first time since surgery. Taking less pain medicine.', false, 'good', 78, 96, 138, 84, 158),
  (v_floyd_id, NOW() - INTERVAL '7 days', 'Daily Wellness', 'First day home from hospital. Hip is sore but manageable. Daughter helping with meals.', false, 'good', 82, 95, 142, 88, 172),
  (v_floyd_id, NOW() - INTERVAL '6 days', 'Daily Wellness', 'Slept better last night. Used walker to get to kitchen. Taking all medications.', false, 'okay', 80, 96, 140, 86, 158),
  (v_floyd_id, NOW() - INTERVAL '5 days', 'Daily Wellness', 'PT visited today. Did exercises. Hip feels a little stiff but therapist says normal. Blood sugar was high before lunch.', false, 'okay', 78, 96, 138, 84, 165),
  (v_floyd_id, NOW() - INTERVAL '4 days', 'Daily Wellness', 'Good day overall. Walked to mailbox and back with walker. Less pain medication needed.', false, 'good', 76, 97, 136, 82, 148),
  (v_floyd_id, NOW() - INTERVAL '3 days', 'Doctor Appointment', 'Cardiology appointment went well. Doctor happy with heart. Reduced oxycodone to only at night.', false, 'good', 74, 97, 136, 82, 142),
  (v_floyd_id, NOW() - INTERVAL '2 days', 'Daily Wellness', 'Feeling stronger each day. PT exercises getting easier. Blood sugar finally in better range.', false, 'good', 73, 97, 134, 80, 140),
  (v_floyd_id, NOW() - INTERVAL '1 day', 'Daily Wellness', 'Best day yet. Walked around block with cane (graduated from walker). Very little pain. Mood is great.', false, 'great', 72, 98, 132, 80, 136)
ON CONFLICT DO NOTHING;


-- =============================================================================
-- PART 10: IMMUNIZATIONS
-- =============================================================================
INSERT INTO fhir_immunizations (id, patient_id, status, vaccine_code, vaccine_display, occurrence_datetime, primary_source, note)
VALUES
  (gen_random_uuid(), v_floyd_id, 'completed', '141', 'Influenza, seasonal, injectable', NOW() - INTERVAL '3 months', true, 'Annual flu shot - Fall 2025'),
  (gen_random_uuid(), v_floyd_id, 'completed', '213', 'SARS-COV-2 (COVID-19) vaccine, mRNA, LNP-S, bivalent', NOW() - INTERVAL '6 months', true, 'COVID-19 bivalent booster'),
  (gen_random_uuid(), v_floyd_id, 'completed', '133', 'Pneumococcal conjugate PCV 13', NOW() - INTERVAL '1 year', true, 'Pneumococcal vaccine - recommended for CHF patients over 65')
ON CONFLICT DO NOTHING;


-- =============================================================================
-- PART 11: READMISSION RISK PREDICTION
-- =============================================================================
INSERT INTO readmission_risk_predictions (id, patient_id, tenant_id, discharge_date, readmission_risk_score, risk_category, predicted_readmission_window_days, primary_risk_factors, secondary_risk_factors, recommended_interventions, ai_model_used, prediction_generated_at)
VALUES (
  gen_random_uuid(), v_floyd_id, v_tenant_id,
  CURRENT_DATE - 14,  -- discharge from hip surgery
  0.52,  -- moderate risk
  'medium',
  30,
  '[{"factor": "Post-surgical recovery (hip arthroplasty)", "weight": 0.25}, {"factor": "Congestive heart failure comorbidity", "weight": 0.20}, {"factor": "Type 2 diabetes with glucose instability", "weight": 0.15}]'::jsonb,
  '[{"factor": "Age 68", "weight": 0.08}, {"factor": "Multiple chronic medications (8)", "weight": 0.07}, {"factor": "Post-op opioid use", "weight": 0.05}]'::jsonb,
  '["Daily weight monitoring for CHF", "Blood glucose checks 4x daily during recovery", "PT 3x weekly for hip mobility", "Post-op wound assessment weekly", "Medication reconciliation at each visit", "Fall prevention assessment"]'::jsonb,
  'claude-3-5-sonnet-20241022',
  NOW() - INTERVAL '13 days'
) ON CONFLICT DO NOTHING;


-- =============================================================================
-- PART 12: CARE COORDINATION PLANS
-- =============================================================================
-- Post-surgical rehab plan
INSERT INTO care_coordination_plans (id, patient_id, plan_type, status, priority, title, goals, interventions, primary_coordinator_id, start_date, end_date, clinical_notes, created_by, created_at)
VALUES (
  gen_random_uuid(), v_floyd_id,
  'transitional_care', 'active', 'high',
  'Post-Hip Arthroplasty Recovery Plan',
  '[{"goal": "Regain independent ambulation within 6 weeks", "target_date": "6 weeks post-op", "status": "in_progress"}, {"goal": "Pain level consistently < 3/10 without opioids", "target_date": "4 weeks post-op", "status": "in_progress"}, {"goal": "Return to daily activities", "target_date": "8 weeks post-op", "status": "pending"}]'::jsonb,
  '[{"intervention": "Physical therapy 3x/week", "frequency": "3x weekly", "provider": "PT"}, {"intervention": "Home exercise program daily", "frequency": "daily", "provider": "Patient"}, {"intervention": "Wound care assessment weekly", "frequency": "weekly", "provider": "Nurse"}, {"intervention": "Opioid taper per schedule", "frequency": "weekly review", "provider": "Physician"}]'::jsonb,
  v_james_id,
  CURRENT_DATE - 14,
  CURRENT_DATE + 42,
  'Patient motivated and compliant. Good family support (daughter assists with ADLs). Progressing well - transitioned from walker to cane at day 12.',
  v_dr_williams_id,
  NOW() - INTERVAL '14 days'
) ON CONFLICT DO NOTHING;

-- CHF management plan
INSERT INTO care_coordination_plans (id, patient_id, plan_type, status, priority, title, goals, interventions, primary_coordinator_id, start_date, end_date, clinical_notes, created_by, created_at)
VALUES (
  gen_random_uuid(), v_floyd_id,
  'chronic_care', 'active', 'medium',
  'CHF + Diabetes Chronic Disease Management',
  '[{"goal": "Maintain weight within 2 lbs of dry weight", "target_date": "ongoing", "status": "in_progress"}, {"goal": "A1C below 7.5%", "target_date": "3 months", "status": "in_progress"}, {"goal": "BP consistently below 130/80", "target_date": "1 month", "status": "in_progress"}, {"goal": "No CHF exacerbation during surgical recovery", "target_date": "6 weeks post-op", "status": "in_progress"}]'::jsonb,
  '[{"intervention": "Daily weight monitoring", "frequency": "daily", "provider": "Patient"}, {"intervention": "Blood glucose checks", "frequency": "4x daily during recovery, then 2x", "provider": "Patient"}, {"intervention": "Cardiology follow-up", "frequency": "monthly during recovery", "provider": "Cardiologist"}, {"intervention": "Low-sodium diet counseling", "frequency": "as needed", "provider": "Dietitian"}]'::jsonb,
  v_lisa_id,
  CURRENT_DATE - 730,
  NULL,
  'Chronic management plan updated post-surgery. Close monitoring for CHF decompensation during recovery period. No signs of fluid overload. Glucose stabilizing after post-op spike.',
  v_dr_williams_id,
  NOW() - INTERVAL '2 years'
) ON CONFLICT DO NOTHING;


-- =============================================================================
-- PART 13: CARE TEAM MEMBERS
-- =============================================================================
INSERT INTO care_team_members (id, patient_id, member_id, member_name, member_role, member_specialty, member_phone, member_email, is_primary, start_date, tenant_id)
VALUES
  (gen_random_uuid(), v_floyd_id, v_dr_williams_id, 'Dr. Sarah Williams', 'Physician', 'Orthopedic Surgery / Cardiology', '713-555-0201', 'dr.williams@demo.wellfit.com', true, CURRENT_DATE - 730, v_tenant_id),
  (gen_random_uuid(), v_floyd_id, v_james_id, 'James Rodriguez, RN', 'Nurse', 'Post-Surgical Care', '713-555-0202', 'james.rodriguez@demo.wellfit.com', false, CURRENT_DATE - 14, v_tenant_id),
  (gen_random_uuid(), v_floyd_id, v_lisa_id, 'Lisa Park, MSW', 'Case Manager', 'Care Coordination', '713-555-0203', 'lisa.park@demo.wellfit.com', false, CURRENT_DATE - 365, v_tenant_id),
  (gen_random_uuid(), v_floyd_id, NULL, 'Dr. Michael Chen', 'Physician', 'Cardiology', '713-555-0204', 'dr.chen@demo.wellfit.com', false, CURRENT_DATE - 730, v_tenant_id)
ON CONFLICT DO NOTHING;


-- =============================================================================
-- PART 14: CARE COORDINATION NOTES
-- =============================================================================
INSERT INTO care_coordination_notes (id, patient_id, author_id, note_type, content, is_confidential, created_at, tenant_id)
VALUES
  -- Surgery summary
  (gen_random_uuid(), v_floyd_id, v_dr_williams_id, 'transition',
   'Patient discharged POD 2 following uncomplicated right total hip arthroplasty. Surgical site clean, dry, intact. Weight-bearing as tolerated with walker. Discharge medications reviewed including oxycodone 5mg q6h PRN for pain. Home PT arranged starting POD 5. Follow-up in 1 week for suture removal. CHF medications continued without change. Blood glucose monitored - post-op spike to 224 on day 3 due to steroid use, managed with insulin sliding scale.',
   false, NOW() - INTERVAL '12 days', v_tenant_id),
  -- PT progress note
  (gen_random_uuid(), v_floyd_id, v_james_id, 'progress',
   'PT session #4: Patient progressing well. Hip ROM improved to 95 degrees flexion (goal 110). Gait steady with cane - graduated from walker today. Strength 4/5 in right lower extremity. Patient performing home exercises consistently. Pain 3/10 during activity, 1/10 at rest. Target: Independent ambulation without assistive device by week 6.',
   false, NOW() - INTERVAL '2 days', v_tenant_id),
  -- Medication adjustment note
  (gen_random_uuid(), v_floyd_id, v_dr_williams_id, 'care_plan',
   'Medication review at cardiology follow-up: CHF stable - continue current regimen (carvedilol 12.5mg BID, furosemide 40mg daily, lisinopril 20mg daily). Blood glucose stabilizing - continuing metformin 1000mg BID + insulin glargine 20 units at bedtime. Oxycodone use decreasing - patient taking 1-2 doses/day (down from 4). Plan to discontinue opioid by end of week 3 post-op. Weight 209 lbs, within 1 lb of baseline. Next echo in 3 months.',
   false, NOW() - INTERVAL '3 days', v_tenant_id)
ON CONFLICT DO NOTHING;


-- =============================================================================
-- PART 15: FHIR PROCEDURE (Hip Surgery)
-- =============================================================================
INSERT INTO fhir_procedures (id, status, code_system, code, code_display, patient_id, performed_datetime, performer_actor_display, location_display, outcome_display, note, body_site_code, body_site_display, body_site_system)
VALUES (
  gen_random_uuid(),
  'completed',
  'http://www.ama-assn.org/go/cpt',
  '27130',
  'Total hip arthroplasty',
  v_floyd_id,
  NOW() - INTERVAL '14 days',
  ARRAY['Dr. Sarah Williams'],
  'Houston Methodist Hospital',
  'Successful - no complications',
  'Right total hip arthroplasty. Posterior approach. Ceramic-on-polyethylene bearing. Cementless fixation. Estimated blood loss 350mL. No intraoperative complications. Patient tolerated procedure well.',
  '24136001',
  'Right hip joint',
  'http://snomed.info/sct'
) ON CONFLICT DO NOTHING;


-- =============================================================================
-- PART 16: TELEHEALTH APPOINTMENT (Upcoming virtual PT follow-up)
-- =============================================================================
INSERT INTO telehealth_appointments (id, patient_id, provider_id, appointment_time, duration_minutes, encounter_type, status, reason_for_visit, tenant_id)
VALUES (
  gen_random_uuid(),
  v_floyd_id,
  v_dr_williams_id,
  NOW() + INTERVAL '3 days' + INTERVAL '14 hours',
  30,
  'outpatient',
  'scheduled',
  'Post-hip arthroplasty virtual follow-up - review PT progress, medication adjustment, CHF monitoring',
  v_tenant_id
) ON CONFLICT DO NOTHING;


-- =============================================================================
-- PART 17: SELF-REPORTS (mood, vitals, activity — 30+ days of history)
-- =============================================================================
INSERT INTO self_reports (id, user_id, mood, symptoms, bp_systolic, bp_diastolic, heart_rate, spo2, blood_sugar, weight, physical_activity, social_engagement, activity_description, created_at)
VALUES
  -- Pre-surgery baseline (active senior managing chronic conditions)
  (gen_random_uuid(), v_floyd_id, 'good', NULL, 136, 82, 74, 97, 148, 210.5, 'Walked 20 minutes around neighborhood', 'Lunch with church group', 'Morning walk, afternoon at senior center', NOW() - INTERVAL '35 days'),
  (gen_random_uuid(), v_floyd_id, 'great', NULL, 134, 80, 72, 97, 142, 210.0, 'Bingo night at senior center - lots of walking', 'Bingo with 12 friends at community center', 'Active social day', NOW() - INTERVAL '34 days'),
  (gen_random_uuid(), v_floyd_id, 'neutral', 'Hip pain flare-up, stiffness in right hip', 140, 86, 76, 96, 155, 211.0, 'Limited - hip pain too bad', 'Phone call with daughter', 'Resting day due to hip', NOW() - INTERVAL '33 days'),
  (gen_random_uuid(), v_floyd_id, 'good', NULL, 138, 84, 74, 97, 146, 210.5, 'Gentle stretching at home', 'Met with neighbor for coffee', 'Light day, saving energy for surgery prep', NOW() - INTERVAL '30 days'),
  (gen_random_uuid(), v_floyd_id, 'good', NULL, 136, 82, 73, 97, 140, 210.0, 'Walked to mailbox and back twice', 'Church service in morning', 'Good spirits, staying active', NOW() - INTERVAL '28 days'),
  (gen_random_uuid(), v_floyd_id, 'great', NULL, 138, 84, 76, 97, 158, 211.0, 'Cooking for potluck - on my feet for 2 hours', 'Community potluck dinner - saw 20+ people', 'Made gumbo, great community event', NOW() - INTERVAL '26 days'),
  (gen_random_uuid(), v_floyd_id, 'good', NULL, 134, 82, 74, 97, 145, 210.5, 'PT exercises at home, 15 min walk', 'Video call with son in Dallas', 'Steady routine', NOW() - INTERVAL '24 days'),
  (gen_random_uuid(), v_floyd_id, 'good', NULL, 136, 82, 73, 97, 148, 210.0, 'Walked 10 min, hip limiting distance', 'Sunday church service', 'Community prayer group was uplifting', NOW() - INTERVAL '22 days'),
  (gen_random_uuid(), v_floyd_id, 'good', NULL, 138, 84, 75, 96, 150, 210.5, 'Played trivia on app, walked 10 min', 'Care plan meeting with Lisa', 'Feeling prepared for surgery', NOW() - INTERVAL '18 days'),
  (gen_random_uuid(), v_floyd_id, 'neutral', 'Pre-surgery anxiety, trouble sleeping', 142, 86, 80, 96, 158, 211.0, 'Packed hospital bag, light walk', 'Daughter came over to help prep', 'Last day before surgery', NOW() - INTERVAL '16 days'),
  -- Post-surgery recovery
  (gen_random_uuid(), v_floyd_id, 'sad', 'Surgical site pain 7/10, nausea, drowsy from pain meds', 148, 90, 84, 94, 188, 212.0, 'Stood with walker for 2 minutes', NULL, 'Post-op day 1 in hospital', NOW() - INTERVAL '13 days'),
  (gen_random_uuid(), v_floyd_id, 'neutral', 'Hip pain 6/10, some swelling, fatigue', 144, 88, 80, 95, 178, 212.5, 'Walker to bathroom and back', 'Daughter visited in hospital', 'Discharged today', NOW() - INTERVAL '12 days'),
  (gen_random_uuid(), v_floyd_id, 'neutral', 'Night pain 5/10, stiffness in morning', 142, 86, 82, 95, 168, 212.0, 'Walker around house 3 times', 'Daughter staying with me', 'First full day home', NOW() - INTERVAL '11 days'),
  (gen_random_uuid(), v_floyd_id, 'neutral', 'Pain 5/10 during movement, blood sugar spike', 140, 86, 80, 96, 192, 212.5, 'Walker to kitchen independently', 'Phone calls from church friends', 'Blood sugar worried me', NOW() - INTERVAL '10 days'),
  (gen_random_uuid(), v_floyd_id, 'good', 'Pain 4/10, improving', 140, 84, 78, 96, 165, 211.5, 'First PT session - gentle exercises', 'PT James visited', 'Sore but hopeful after therapy', NOW() - INTERVAL '9 days'),
  (gen_random_uuid(), v_floyd_id, 'good', 'Pain 3/10 at rest', 138, 84, 78, 96, 158, 211.0, 'PT exercises, walked hallway 4 times', 'Neighbor brought dinner', 'Slept through the night!', NOW() - INTERVAL '8 days'),
  (gen_random_uuid(), v_floyd_id, 'good', NULL, 136, 82, 76, 97, 152, 210.5, 'Walker to mailbox! PT exercises', 'Daughter visiting', 'Getting stronger', NOW() - INTERVAL '7 days'),
  (gen_random_uuid(), v_floyd_id, 'good', NULL, 136, 82, 74, 97, 148, 210.0, 'Walked further with walker, exercises', 'Phone call with son', 'More independent each day', NOW() - INTERVAL '5 days'),
  (gen_random_uuid(), v_floyd_id, 'good', NULL, 136, 82, 74, 97, 142, 209.5, 'Cardiology visit - walked in with cane!', 'Saw Dr. Chen at cardiology', 'Great appointment, heart is stable', NOW() - INTERVAL '3 days'),
  (gen_random_uuid(), v_floyd_id, 'great', NULL, 134, 80, 73, 97, 140, 209.0, 'PT exercises easy now, walked around block with cane', 'Community friend visited', 'Feeling like myself again', NOW() - INTERVAL '2 days'),
  (gen_random_uuid(), v_floyd_id, 'great', NULL, 132, 80, 72, 98, 136, 209.0, 'Walked around block twice! No walker needed', 'Played trivia on app, video call with grandkids', 'Best day since surgery', NOW() - INTERVAL '1 day')
ON CONFLICT DO NOTHING;


-- =============================================================================
-- PART 18: COMMUNITY MOMENTS (shared photos)
-- =============================================================================
INSERT INTO community_moments (user_id, title, description, emoji, tags, created_at)
VALUES
  (v_floyd_id, 'My Famous Gumbo', 'Made my family recipe gumbo for the community potluck. Everyone asked for seconds!', NULL, 'cooking,potluck,community', NOW() - INTERVAL '26 days'),
  (v_floyd_id, 'Bingo Night Champions', 'Won 3 rounds at bingo night! The secret is concentration and a lucky seat.', NULL, 'bingo,community,fun', NOW() - INTERVAL '34 days'),
  (v_floyd_id, 'Walking Again!', 'First walk around the block since hip surgery. Using a cane now instead of walker. Small victories!', NULL, 'recovery,walking,milestone', NOW() - INTERVAL '2 days'),
  (v_floyd_id, 'Grandkids Video Call', 'Video call with my grandkids in Dallas. They made me a get well card. Heart is full.', NULL, 'family,grandkids,love', NOW() - INTERVAL '5 days'),
  (v_floyd_id, 'Sunday Church', 'Beautiful service this morning. Community prayer group lifted my spirits before surgery.', NULL, 'church,community,faith', NOW() - INTERVAL '22 days')
ON CONFLICT DO NOTHING;


-- =============================================================================
-- PART 19: TRIVIA GAME RESULTS (Memory Lane)
-- =============================================================================
INSERT INTO trivia_game_results (id, user_id, game_date, started_at, completed_at, completion_time_seconds, score, total_questions, difficulty_breakdown, average_response_time_seconds, completion_status, created_at)
VALUES
  (gen_random_uuid(), v_floyd_id, CURRENT_DATE - 34, NOW() - INTERVAL '34 days' + INTERVAL '14 hours', NOW() - INTERVAL '34 days' + INTERVAL '14 hours 8 minutes', 480, 8, 10, '{"Easy": 4, "Medium": 4, "Hard": 2}'::jsonb, 48.0, 'completed', NOW() - INTERVAL '34 days'),
  (gen_random_uuid(), v_floyd_id, CURRENT_DATE - 28, NOW() - INTERVAL '28 days' + INTERVAL '10 hours', NOW() - INTERVAL '28 days' + INTERVAL '10 hours 6 minutes', 360, 7, 10, '{"Easy": 4, "Medium": 3, "Hard": 3}'::jsonb, 36.0, 'completed', NOW() - INTERVAL '28 days'),
  (gen_random_uuid(), v_floyd_id, CURRENT_DATE - 22, NOW() - INTERVAL '22 days' + INTERVAL '15 hours', NOW() - INTERVAL '22 days' + INTERVAL '15 hours 7 minutes', 420, 9, 10, '{"Easy": 3, "Medium": 4, "Hard": 3}'::jsonb, 42.0, 'completed', NOW() - INTERVAL '22 days'),
  (gen_random_uuid(), v_floyd_id, CURRENT_DATE - 18, NOW() - INTERVAL '18 days' + INTERVAL '11 hours', NOW() - INTERVAL '18 days' + INTERVAL '11 hours 5 minutes', 300, 8, 10, '{"Easy": 4, "Medium": 3, "Hard": 3}'::jsonb, 30.0, 'completed', NOW() - INTERVAL '18 days'),
  -- Post-surgery: played from phone in hospital and during recovery
  (gen_random_uuid(), v_floyd_id, CURRENT_DATE - 10, NOW() - INTERVAL '10 days' + INTERVAL '20 hours', NOW() - INTERVAL '10 days' + INTERVAL '20 hours 10 minutes', 600, 6, 10, '{"Easy": 5, "Medium": 3, "Hard": 2}'::jsonb, 60.0, 'completed', NOW() - INTERVAL '10 days'),
  (gen_random_uuid(), v_floyd_id, CURRENT_DATE - 5, NOW() - INTERVAL '5 days' + INTERVAL '16 hours', NOW() - INTERVAL '5 days' + INTERVAL '16 hours 7 minutes', 420, 7, 10, '{"Easy": 4, "Medium": 3, "Hard": 3}'::jsonb, 42.0, 'completed', NOW() - INTERVAL '5 days'),
  (gen_random_uuid(), v_floyd_id, CURRENT_DATE - 1, NOW() - INTERVAL '1 day' + INTERVAL '19 hours', NOW() - INTERVAL '1 day' + INTERVAL '19 hours 5 minutes', 300, 9, 10, '{"Easy": 3, "Medium": 4, "Hard": 3}'::jsonb, 30.0, 'completed', NOW() - INTERVAL '1 day')
ON CONFLICT DO NOTHING;


-- =============================================================================
-- PART 20: WORD GAME RESULTS (Word Find)
-- =============================================================================
INSERT INTO word_game_results (id, user_id, game_date, started_at, completed_at, completion_time_seconds, words_found, total_words, hints_used, difficulty_level, completion_status, created_at)
VALUES
  (gen_random_uuid(), v_floyd_id, CURRENT_DATE - 33, NOW() - INTERVAL '33 days' + INTERVAL '9 hours', NOW() - INTERVAL '33 days' + INTERVAL '9 hours 12 minutes', 720, 12, 15, 'medium', 'completed', NOW() - INTERVAL '33 days'),
  (gen_random_uuid(), v_floyd_id, CURRENT_DATE - 26, NOW() - INTERVAL '26 days' + INTERVAL '10 hours', NOW() - INTERVAL '26 days' + INTERVAL '10 hours 8 minutes', 480, 14, 15, 'medium', 'completed', NOW() - INTERVAL '26 days'),
  (gen_random_uuid(), v_floyd_id, CURRENT_DATE - 20, NOW() - INTERVAL '20 days' + INTERVAL '15 hours', NOW() - INTERVAL '20 days' + INTERVAL '15 hours 10 minutes', 600, 10, 15, 'medium', 'completed', NOW() - INTERVAL '20 days'),
  (gen_random_uuid(), v_floyd_id, CURRENT_DATE - 8, NOW() - INTERVAL '8 days' + INTERVAL '20 hours', NOW() - INTERVAL '8 days' + INTERVAL '20 hours 15 minutes', 900, 8, 15, 'easy', 'completed', NOW() - INTERVAL '8 days'),
  (gen_random_uuid(), v_floyd_id, CURRENT_DATE - 3, NOW() - INTERVAL '3 days' + INTERVAL '18 hours', NOW() - INTERVAL '3 days' + INTERVAL '18 hours 9 minutes', 540, 13, 15, 'medium', 'completed', NOW() - INTERVAL '3 days')
ON CONFLICT DO NOTHING;


-- =============================================================================
-- PART 21: MEAL INTERACTIONS (DASH diet engagement)
-- =============================================================================
INSERT INTO meal_interactions (id, user_id, meal_id, meal_name, will_make_it, viewed_at, responded_at, notes, rating, created_at)
VALUES
  (gen_random_uuid(), v_floyd_id, 'dash-001', 'Heart-Healthy Salmon with Roasted Vegetables', true, NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days', 'This looks delicious. My daughter can help me make it.', 5, NOW() - INTERVAL '30 days'),
  (gen_random_uuid(), v_floyd_id, 'dash-002', 'Low-Sodium Chicken Stir-Fry', true, NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days', 'Made this tonight. Used low sodium soy sauce. Very tasty!', 4, NOW() - INTERVAL '25 days'),
  (gen_random_uuid(), v_floyd_id, 'dash-003', 'Diabetic-Friendly Oatmeal Bowl', true, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days', 'Good breakfast option. Blood sugar stayed stable after eating this.', 5, NOW() - INTERVAL '20 days'),
  (gen_random_uuid(), v_floyd_id, 'dash-004', 'Mediterranean Quinoa Salad', false, NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days', 'Too complicated for right now while recovering. Maybe later.', NULL, NOW() - INTERVAL '15 days'),
  (gen_random_uuid(), v_floyd_id, 'dash-005', 'Easy One-Pot Lentil Soup', true, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days', 'Perfect recovery meal. Easy to make even with limited mobility.', 5, NOW() - INTERVAL '10 days'),
  (gen_random_uuid(), v_floyd_id, 'dash-006', 'Grilled Chicken with Sweet Potato', true, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', 'Daughter made this for me. High protein for recovery.', 4, NOW() - INTERVAL '5 days'),
  (gen_random_uuid(), v_floyd_id, 'dash-007', 'Berry Smoothie Bowl', true, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', 'Easy to make myself now. Good for blood sugar management.', 5, NOW() - INTERVAL '2 days')
ON CONFLICT DO NOTHING;


-- =============================================================================
-- PART 22: FEATURE ENGAGEMENT (cross-feature usage tracking)
-- =============================================================================
INSERT INTO feature_engagement (id, user_id, tenant_id, feature_type, feature_id, metadata, created_at)
VALUES
  -- Meal views
  (gen_random_uuid(), v_floyd_id, v_tenant_id, 'meal_view', 'dash-001', '{"meal_name": "Heart-Healthy Salmon"}'::jsonb, NOW() - INTERVAL '30 days'),
  (gen_random_uuid(), v_floyd_id, v_tenant_id, 'meal_view', 'dash-002', '{"meal_name": "Low-Sodium Chicken Stir-Fry"}'::jsonb, NOW() - INTERVAL '25 days'),
  (gen_random_uuid(), v_floyd_id, v_tenant_id, 'meal_view', 'dash-005', '{"meal_name": "Easy One-Pot Lentil Soup"}'::jsonb, NOW() - INTERVAL '10 days'),
  (gen_random_uuid(), v_floyd_id, v_tenant_id, 'meal_view', 'dash-007', '{"meal_name": "Berry Smoothie Bowl"}'::jsonb, NOW() - INTERVAL '2 days'),
  -- Trivia plays
  (gen_random_uuid(), v_floyd_id, v_tenant_id, 'trivia_play', NULL, '{"score": 8, "total": 10}'::jsonb, NOW() - INTERVAL '34 days'),
  (gen_random_uuid(), v_floyd_id, v_tenant_id, 'trivia_play', NULL, '{"score": 9, "total": 10}'::jsonb, NOW() - INTERVAL '22 days'),
  (gen_random_uuid(), v_floyd_id, v_tenant_id, 'trivia_play', NULL, '{"score": 8, "total": 10}'::jsonb, NOW() - INTERVAL '18 days'),
  (gen_random_uuid(), v_floyd_id, v_tenant_id, 'trivia_play', NULL, '{"score": 9, "total": 10}'::jsonb, NOW() - INTERVAL '1 day'),
  -- Weather checks
  (gen_random_uuid(), v_floyd_id, v_tenant_id, 'weather_check', NULL, '{"location": "Houston, TX"}'::jsonb, NOW() - INTERVAL '30 days'),
  (gen_random_uuid(), v_floyd_id, v_tenant_id, 'weather_check', NULL, '{"location": "Houston, TX"}'::jsonb, NOW() - INTERVAL '20 days'),
  (gen_random_uuid(), v_floyd_id, v_tenant_id, 'weather_check', NULL, '{"location": "Houston, TX"}'::jsonb, NOW() - INTERVAL '7 days'),
  (gen_random_uuid(), v_floyd_id, v_tenant_id, 'weather_check', NULL, '{"location": "Houston, TX"}'::jsonb, NOW() - INTERVAL '1 day'),
  -- Scripture/affirmation views
  (gen_random_uuid(), v_floyd_id, v_tenant_id, 'scripture_view', NULL, '{}'::jsonb, NOW() - INTERVAL '34 days'),
  (gen_random_uuid(), v_floyd_id, v_tenant_id, 'scripture_view', NULL, '{}'::jsonb, NOW() - INTERVAL '28 days'),
  (gen_random_uuid(), v_floyd_id, v_tenant_id, 'scripture_view', NULL, '{}'::jsonb, NOW() - INTERVAL '22 days'),
  (gen_random_uuid(), v_floyd_id, v_tenant_id, 'scripture_view', NULL, '{}'::jsonb, NOW() - INTERVAL '5 days'),
  (gen_random_uuid(), v_floyd_id, v_tenant_id, 'scripture_view', NULL, '{}'::jsonb, NOW() - INTERVAL '1 day'),
  -- Affirmation views
  (gen_random_uuid(), v_floyd_id, v_tenant_id, 'affirmation_view', NULL, '{}'::jsonb, NOW() - INTERVAL '30 days'),
  (gen_random_uuid(), v_floyd_id, v_tenant_id, 'affirmation_view', NULL, '{}'::jsonb, NOW() - INTERVAL '18 days'),
  (gen_random_uuid(), v_floyd_id, v_tenant_id, 'affirmation_view', NULL, '{}'::jsonb, NOW() - INTERVAL '3 days'),
  -- Exercise/PT completions (post-surgery)
  (gen_random_uuid(), v_floyd_id, v_tenant_id, 'exercise_complete', NULL, '{"type": "PT home exercises", "duration_min": 20}'::jsonb, NOW() - INTERVAL '9 days'),
  (gen_random_uuid(), v_floyd_id, v_tenant_id, 'exercise_complete', NULL, '{"type": "PT home exercises", "duration_min": 25}'::jsonb, NOW() - INTERVAL '7 days'),
  (gen_random_uuid(), v_floyd_id, v_tenant_id, 'exercise_complete', NULL, '{"type": "PT home exercises", "duration_min": 30}'::jsonb, NOW() - INTERVAL '5 days'),
  (gen_random_uuid(), v_floyd_id, v_tenant_id, 'exercise_complete', NULL, '{"type": "Walking with cane", "duration_min": 20}'::jsonb, NOW() - INTERVAL '3 days'),
  (gen_random_uuid(), v_floyd_id, v_tenant_id, 'exercise_complete', NULL, '{"type": "Walking - no assistive device", "duration_min": 25}'::jsonb, NOW() - INTERVAL '1 day'),
  -- Tech tip views
  (gen_random_uuid(), v_floyd_id, v_tenant_id, 'tech_tip_view', 'tip-001', '{"tip_title": "How to video call your grandkids"}'::jsonb, NOW() - INTERVAL '20 days'),
  (gen_random_uuid(), v_floyd_id, v_tenant_id, 'tech_tip_view', 'tip-002', '{"tip_title": "Using the medicine reminder"}'::jsonb, NOW() - INTERVAL '12 days')
ON CONFLICT DO NOTHING;


-- =============================================================================
-- PART 23: USER QUESTIONS (support interactions)
-- =============================================================================
INSERT INTO user_questions (id, user_id, question_text, category, priority, status, response_text, responded_by, responded_at, created_at)
VALUES
  (gen_random_uuid(), v_floyd_id, 'How do I check my blood sugar readings on the app?', 'technical', 'normal', 'answered',
   'Go to My Health Hub > My Vitals & Labs to see all your glucose readings. You can also check them on the Glucometer page under connected devices.',
   v_james_id, NOW() - INTERVAL '29 days', NOW() - INTERVAL '30 days'),
  (gen_random_uuid(), v_floyd_id, 'When should I call the doctor about my blood sugar being over 200?', 'health', 'high', 'answered',
   'If your blood sugar stays above 200 for more than 2 readings in a row, or if you feel dizzy, very thirsty, or confused, call Dr. Williams office at 713-555-0201 right away. For the post-surgery blood sugar spikes, we are monitoring closely and adjusting your insulin.',
   v_dr_williams_id, NOW() - INTERVAL '9 days', NOW() - INTERVAL '10 days'),
  (gen_random_uuid(), v_floyd_id, 'Is it normal for my hip to make clicking sounds when I walk?', 'health', 'normal', 'answered',
   'Some clicking or popping sounds are normal after hip replacement surgery, especially in the first few weeks. This is usually the new joint settling. If you have pain with the clicking, swelling, or the hip feels unstable, call us right away.',
   v_james_id, NOW() - INTERVAL '4 days', NOW() - INTERVAL '5 days')
ON CONFLICT DO NOTHING;


RAISE NOTICE 'Floyd LeBlanc demo data seeded successfully with avatar, clinical records, self-reports, and community activity for user %', v_floyd_id;

END $$;

-- Re-enable profile triggers
ALTER TABLE profiles ENABLE TRIGGER trg_profiles_restrict;
ALTER TABLE profiles ENABLE TRIGGER trg_sync_user_roles;
