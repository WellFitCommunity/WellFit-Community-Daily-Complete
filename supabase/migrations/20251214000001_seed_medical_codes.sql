-- =====================================================
-- Medical Code Tables: Schema Fixes + Seed Data
-- Purpose: Add missing columns and seed common codes for MCP lookups
-- =====================================================

-- =====================================================
-- 0. FIX NULLABLE CONSTRAINTS FIRST
-- =====================================================

-- Make description columns nullable across all code tables to allow seeding
DO $$
BEGIN
  -- code_cpt: description
  EXECUTE 'ALTER TABLE code_cpt ALTER COLUMN description DROP NOT NULL';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  -- code_hcpcs: description (old column name)
  EXECUTE 'ALTER TABLE code_hcpcs ALTER COLUMN description DROP NOT NULL';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  -- code_hcpcs: desc (if it exists)
  EXECUTE 'ALTER TABLE code_hcpcs ALTER COLUMN "desc" DROP NOT NULL';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  -- code_icd10: desc
  EXECUTE 'ALTER TABLE code_icd10 ALTER COLUMN "desc" DROP NOT NULL';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  -- code_modifiers: desc
  EXECUTE 'ALTER TABLE code_modifiers ALTER COLUMN "desc" DROP NOT NULL';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- =====================================================
-- 1. ADD MISSING COLUMNS TO CODE TABLES
-- =====================================================

-- Add columns to code_cpt that MCP expects
ALTER TABLE code_cpt ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE code_cpt ADD COLUMN IF NOT EXISTS long_description TEXT;
ALTER TABLE code_cpt ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE code_cpt ADD COLUMN IF NOT EXISTS work_rvu DECIMAL(8,2);
ALTER TABLE code_cpt ADD COLUMN IF NOT EXISTS facility_rvu DECIMAL(8,2);
ALTER TABLE code_cpt ADD COLUMN IF NOT EXISTS non_facility_rvu DECIMAL(8,2);
ALTER TABLE code_cpt ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Migrate existing data if short_desc exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'code_cpt' AND column_name = 'short_desc') THEN
    UPDATE code_cpt SET short_description = short_desc WHERE short_description IS NULL AND short_desc IS NOT NULL;
    UPDATE code_cpt SET long_description = long_desc WHERE long_description IS NULL AND long_desc IS NOT NULL;
  END IF;
END $$;

-- Add columns to code_icd10 that MCP expects
ALTER TABLE code_icd10 ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE code_icd10 ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE code_icd10 ADD COLUMN IF NOT EXISTS is_billable BOOLEAN DEFAULT true;
ALTER TABLE code_icd10 ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Migrate existing data
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'code_icd10' AND column_name = 'desc') THEN
    UPDATE code_icd10 SET description = "desc" WHERE description IS NULL AND "desc" IS NOT NULL;
    UPDATE code_icd10 SET is_billable = billable WHERE is_billable IS NULL AND billable IS NOT NULL;
  END IF;
END $$;

-- Add columns to code_hcpcs that MCP expects
ALTER TABLE code_hcpcs ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE code_hcpcs ADD COLUMN IF NOT EXISTS long_description TEXT;
ALTER TABLE code_hcpcs ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'II';
ALTER TABLE code_hcpcs ADD COLUMN IF NOT EXISTS pricing_indicator TEXT;
ALTER TABLE code_hcpcs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Migrate existing data
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'code_hcpcs' AND column_name = 'desc') THEN
    UPDATE code_hcpcs SET short_description = "desc" WHERE short_description IS NULL AND "desc" IS NOT NULL;
  END IF;
END $$;

-- Add columns to code_modifiers
ALTER TABLE code_modifiers ADD COLUMN IF NOT EXISTS modifier TEXT;
ALTER TABLE code_modifiers ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE code_modifiers ADD COLUMN IF NOT EXISTS applies_to TEXT[] DEFAULT '{cpt,hcpcs}';
ALTER TABLE code_modifiers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Migrate existing data
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'code_modifiers' AND column_name = 'desc') THEN
    UPDATE code_modifiers SET description = "desc" WHERE description IS NULL AND "desc" IS NOT NULL;
    UPDATE code_modifiers SET modifier = code WHERE modifier IS NULL AND code IS NOT NULL;
  END IF;
END $$;

-- =====================================================
-- 2. SEED COMMON CPT CODES (E/M, Common Procedures)
-- =====================================================

INSERT INTO code_cpt (code, short_description, long_description, category, work_rvu, status) VALUES
-- E/M Office Visits - New Patients
('99201', 'Office visit, new, minimal', 'Office or other outpatient visit for the evaluation and management of a new patient - straightforward medical decision making', 'E/M', 0.48, 'active'),
('99202', 'Office visit, new, low', 'Office or other outpatient visit - low level medical decision making (15-29 min)', 'E/M', 0.93, 'active'),
('99203', 'Office visit, new, moderate', 'Office or other outpatient visit - moderate level medical decision making (30-44 min)', 'E/M', 1.60, 'active'),
('99204', 'Office visit, new, moderate-high', 'Office or other outpatient visit - moderate level medical decision making (45-59 min)', 'E/M', 2.60, 'active'),
('99205', 'Office visit, new, high', 'Office or other outpatient visit - high level medical decision making (60-74 min)', 'E/M', 3.50, 'active'),

-- E/M Office Visits - Established Patients
('99211', 'Office visit, est, minimal', 'Office or other outpatient visit - may not require presence of physician', 'E/M', 0.18, 'active'),
('99212', 'Office visit, est, straightforward', 'Office or other outpatient visit - straightforward medical decision making (10-19 min)', 'E/M', 0.70, 'active'),
('99213', 'Office visit, est, low', 'Office or other outpatient visit - low level medical decision making (20-29 min)', 'E/M', 1.30, 'active'),
('99214', 'Office visit, est, moderate', 'Office or other outpatient visit - moderate level medical decision making (30-39 min)', 'E/M', 1.92, 'active'),
('99215', 'Office visit, est, high', 'Office or other outpatient visit - high level medical decision making (40-54 min)', 'E/M', 2.80, 'active'),

-- Telehealth
('99441', 'Phone E/M, 5-10 min', 'Telephone E/M by physician 5-10 minutes', 'E/M', 0.25, 'active'),
('99442', 'Phone E/M, 11-20 min', 'Telephone E/M by physician 11-20 minutes', 'E/M', 0.50, 'active'),
('99443', 'Phone E/M, 21-30 min', 'Telephone E/M by physician 21-30 minutes', 'E/M', 0.75, 'active'),

-- Chronic Care Management
('99490', 'CCM, 20 min/month', 'Chronic care management services, first 20 minutes', 'Care Management', 0.61, 'active'),
('99491', 'CCM, complex, 30 min', 'Chronic care management, complex, first 30 minutes', 'Care Management', 1.00, 'active'),
('99487', 'CCM, complex, 60 min', 'Complex chronic care management, 60 minutes', 'Care Management', 1.00, 'active'),

-- Remote Patient Monitoring
('99453', 'RPM device setup', 'Remote monitoring of physiologic parameters, initial setup', 'Remote Monitoring', 0.00, 'active'),
('99454', 'RPM device supply', 'Remote monitoring device supply with daily recordings', 'Remote Monitoring', 0.00, 'active'),
('99457', 'RPM treatment mgmt, 20 min', 'Remote physiologic monitoring treatment management, first 20 min', 'Remote Monitoring', 0.61, 'active'),
('99458', 'RPM treatment mgmt, add 20 min', 'Remote physiologic monitoring treatment management, each additional 20 min', 'Remote Monitoring', 0.61, 'active'),

-- Behavioral Health Integration
('99484', 'BHI care mgmt, 20 min', 'Care management for behavioral health conditions, 20 min', 'Behavioral Health', 0.61, 'active'),
('99492', 'Psych collab care, first 70 min', 'Initial psychiatric collaborative care management, first 70 min', 'Behavioral Health', 1.36, 'active'),
('99493', 'Psych collab care, subsequent', 'Subsequent psychiatric collaborative care management', 'Behavioral Health', 1.00, 'active'),

-- Preventive Medicine
('99381', 'Preventive visit, new, infant', 'Initial comprehensive preventive medicine, infant (age <1)', 'Preventive', 1.50, 'active'),
('99391', 'Preventive visit, est, infant', 'Periodic comprehensive preventive medicine, infant (age <1)', 'Preventive', 1.30, 'active'),
('99385', 'Preventive visit, new, 18-39', 'Initial comprehensive preventive medicine, 18-39 years', 'Preventive', 1.50, 'active'),
('99395', 'Preventive visit, est, 18-39', 'Periodic comprehensive preventive medicine, 18-39 years', 'Preventive', 1.30, 'active'),
('99386', 'Preventive visit, new, 40-64', 'Initial comprehensive preventive medicine, 40-64 years', 'Preventive', 1.70, 'active'),
('99396', 'Preventive visit, est, 40-64', 'Periodic comprehensive preventive medicine, 40-64 years', 'Preventive', 1.50, 'active'),
('99387', 'Preventive visit, new, 65+', 'Initial comprehensive preventive medicine, 65 years and older', 'Preventive', 2.00, 'active'),
('99397', 'Preventive visit, est, 65+', 'Periodic comprehensive preventive medicine, 65 years and older', 'Preventive', 1.70, 'active'),

-- Annual Wellness Visit
('G0438', 'AWV, initial', 'Annual wellness visit, includes personalized prevention plan', 'Preventive', 2.43, 'active'),
('G0439', 'AWV, subsequent', 'Annual wellness visit, subsequent', 'Preventive', 1.50, 'active'),

-- Care Plan Oversight
('99339', 'Care plan oversight, 15-29 min', 'Individual physician supervision of patient home health, 15-29 min', 'Care Management', 1.16, 'active'),
('99340', 'Care plan oversight, 30+ min', 'Individual physician supervision of patient home health, 30+ min', 'Care Management', 1.74, 'active'),

-- Transitional Care Management
('99495', 'TCM, moderate, 14 days', 'Transitional care management, moderate complexity, face-to-face within 14 days', 'Care Management', 2.36, 'active'),
('99496', 'TCM, high, 7 days', 'Transitional care management, high complexity, face-to-face within 7 days', 'Care Management', 3.10, 'active'),

-- Common Lab/Diagnostic
('36415', 'Venipuncture', 'Collection of venous blood by venipuncture', 'Lab', 0.03, 'active'),
('81001', 'Urinalysis, auto, w/micro', 'Urinalysis by dip stick, automated with microscopy', 'Lab', 0.00, 'active'),
('81002', 'Urinalysis, non-auto, w/o micro', 'Urinalysis by dip stick, non-automated without microscopy', 'Lab', 0.00, 'active'),
('81003', 'Urinalysis, auto, w/o micro', 'Urinalysis by dip stick, automated without microscopy', 'Lab', 0.00, 'active'),
('85025', 'CBC w/diff', 'Complete blood count with automated differential', 'Lab', 0.00, 'active'),
('80053', 'CMP', 'Comprehensive metabolic panel', 'Lab', 0.00, 'active'),
('80061', 'Lipid panel', 'Lipid panel', 'Lab', 0.00, 'active'),
('83036', 'HbA1c', 'Hemoglobin A1c', 'Lab', 0.00, 'active'),

-- Injections/Immunizations
('90471', 'Immunization admin, 1st', 'Immunization administration, first vaccine', 'Immunization', 0.17, 'active'),
('90472', 'Immunization admin, each add', 'Immunization administration, each additional vaccine', 'Immunization', 0.15, 'active'),
('96372', 'Therapeutic injection, SC/IM', 'Therapeutic, prophylactic, or diagnostic injection, subcutaneous or intramuscular', 'Injection', 0.17, 'active'),

-- Physical Therapy
('97110', 'Therapeutic exercises', 'Therapeutic exercises, each 15 minutes', 'Physical Therapy', 0.45, 'active'),
('97112', 'Neuromuscular re-education', 'Neuromuscular reeducation, each 15 minutes', 'Physical Therapy', 0.45, 'active'),
('97140', 'Manual therapy', 'Manual therapy techniques, each 15 minutes', 'Physical Therapy', 0.43, 'active'),
('97530', 'Therapeutic activities', 'Therapeutic activities, each 15 minutes', 'Physical Therapy', 0.44, 'active'),
('97542', 'Wheelchair mgmt training', 'Wheelchair management training, each 15 minutes', 'Physical Therapy', 0.44, 'active'),
('97161', 'PT eval, low complexity', 'Physical therapy evaluation, low complexity', 'Physical Therapy', 1.20, 'active'),
('97162', 'PT eval, moderate complexity', 'Physical therapy evaluation, moderate complexity', 'Physical Therapy', 1.20, 'active'),
('97163', 'PT eval, high complexity', 'Physical therapy evaluation, high complexity', 'Physical Therapy', 1.20, 'active'),

-- Mental Health
('90791', 'Psychiatric eval', 'Psychiatric diagnostic evaluation', 'Mental Health', 3.00, 'active'),
('90832', 'Psychotherapy, 30 min', 'Psychotherapy, 30 minutes with patient', 'Mental Health', 1.10, 'active'),
('90834', 'Psychotherapy, 45 min', 'Psychotherapy, 45 minutes with patient', 'Mental Health', 1.50, 'active'),
('90837', 'Psychotherapy, 60 min', 'Psychotherapy, 60 minutes with patient', 'Mental Health', 2.20, 'active'),
('90839', 'Psychotherapy, crisis, first 60 min', 'Psychotherapy for crisis, first 60 minutes', 'Mental Health', 2.60, 'active'),
('90847', 'Family psychotherapy w/patient', 'Family psychotherapy with patient present, 50 minutes', 'Mental Health', 1.65, 'active'),
('90846', 'Family psychotherapy w/o patient', 'Family psychotherapy without patient present, 50 minutes', 'Mental Health', 1.65, 'active'),

-- Home Health
('G0151', 'PT services, home health', 'Services of physical therapist in home health setting', 'Home Health', 0.00, 'active'),
('G0152', 'OT services, home health', 'Services of occupational therapist in home health setting', 'Home Health', 0.00, 'active'),
('G0153', 'SLP services, home health', 'Services of speech-language pathologist in home health setting', 'Home Health', 0.00, 'active'),
('G0155', 'SW services, home health', 'Services of clinical social worker in home health setting', 'Home Health', 0.00, 'active'),
('G0156', 'Aide services, home health', 'Services of home health/hospice aide in home health setting', 'Home Health', 0.00, 'active'),
('G0299', 'Skilled nursing, direct contact', 'Direct skilled nursing services of RN in home health', 'Home Health', 0.00, 'active'),
('G0300', 'Skilled nursing, direct LPN', 'Direct skilled nursing services of LPN in home health', 'Home Health', 0.00, 'active')

ON CONFLICT (code) DO UPDATE SET
  short_description = EXCLUDED.short_description,
  long_description = EXCLUDED.long_description,
  category = EXCLUDED.category,
  work_rvu = EXCLUDED.work_rvu,
  status = EXCLUDED.status;

-- =====================================================
-- 3. SEED COMMON ICD-10 CODES
-- =====================================================

INSERT INTO code_icd10 (code, description, chapter, category, is_billable, status) VALUES
-- Diabetes
('E119', 'Type 2 diabetes mellitus without complications', 'E00-E89', 'Diabetes', true, 'active'),
('E1165', 'Type 2 diabetes mellitus with hyperglycemia', 'E00-E89', 'Diabetes', true, 'active'),
('E1122', 'Type 2 diabetes with diabetic chronic kidney disease', 'E00-E89', 'Diabetes', true, 'active'),
('E1140', 'Type 2 diabetes with diabetic neuropathy, unspecified', 'E00-E89', 'Diabetes', true, 'active'),
('E1142', 'Type 2 diabetes with diabetic polyneuropathy', 'E00-E89', 'Diabetes', true, 'active'),
('E1151', 'Type 2 diabetes with diabetic peripheral angiopathy without gangrene', 'E00-E89', 'Diabetes', true, 'active'),
('E1121', 'Type 2 diabetes with diabetic nephropathy', 'E00-E89', 'Diabetes', true, 'active'),
('E1169', 'Type 2 diabetes with other specified complication', 'E00-E89', 'Diabetes', true, 'active'),

-- Hypertension
('I10', 'Essential (primary) hypertension', 'I00-I99', 'Cardiovascular', true, 'active'),
('I110', 'Hypertensive heart disease with heart failure', 'I00-I99', 'Cardiovascular', true, 'active'),
('I119', 'Hypertensive heart disease without heart failure', 'I00-I99', 'Cardiovascular', true, 'active'),
('I120', 'Hypertensive CKD with stage 5 CKD or ESRD', 'I00-I99', 'Cardiovascular', true, 'active'),
('I129', 'Hypertensive CKD with stage 1-4 CKD or unspecified', 'I00-I99', 'Cardiovascular', true, 'active'),
('I130', 'Hypertensive heart and CKD with heart failure and stage 1-4 CKD', 'I00-I99', 'Cardiovascular', true, 'active'),

-- Heart Disease
('I2510', 'ASCVD of native coronary artery without angina pectoris', 'I00-I99', 'Cardiovascular', true, 'active'),
('I2511', 'ASCVD of native coronary artery with angina pectoris with documented spasm', 'I00-I99', 'Cardiovascular', true, 'active'),
('I509', 'Heart failure, unspecified', 'I00-I99', 'Cardiovascular', true, 'active'),
('I5020', 'Unspecified systolic heart failure', 'I00-I99', 'Cardiovascular', true, 'active'),
('I5030', 'Unspecified diastolic heart failure', 'I00-I99', 'Cardiovascular', true, 'active'),
('I5040', 'Unspecified combined systolic and diastolic heart failure', 'I00-I99', 'Cardiovascular', true, 'active'),
('I480', 'Paroxysmal atrial fibrillation', 'I00-I99', 'Cardiovascular', true, 'active'),
('I4891', 'Unspecified atrial fibrillation', 'I00-I99', 'Cardiovascular', true, 'active'),

-- CKD
('N181', 'Chronic kidney disease, stage 1', 'N00-N99', 'Renal', true, 'active'),
('N182', 'Chronic kidney disease, stage 2 (mild)', 'N00-N99', 'Renal', true, 'active'),
('N183', 'Chronic kidney disease, stage 3 (moderate)', 'N00-N99', 'Renal', true, 'active'),
('N184', 'Chronic kidney disease, stage 4 (severe)', 'N00-N99', 'Renal', true, 'active'),
('N185', 'Chronic kidney disease, stage 5', 'N00-N99', 'Renal', true, 'active'),
('N186', 'End stage renal disease', 'N00-N99', 'Renal', true, 'active'),
('N189', 'Chronic kidney disease, unspecified', 'N00-N99', 'Renal', true, 'active'),

-- COPD
('J449', 'Chronic obstructive pulmonary disease, unspecified', 'J00-J99', 'Respiratory', true, 'active'),
('J440', 'COPD with acute lower respiratory infection', 'J00-J99', 'Respiratory', true, 'active'),
('J441', 'COPD with acute exacerbation', 'J00-J99', 'Respiratory', true, 'active'),
('J45909', 'Unspecified asthma, uncomplicated', 'J00-J99', 'Respiratory', true, 'active'),
('J45901', 'Unspecified asthma with acute exacerbation', 'J00-J99', 'Respiratory', true, 'active'),

-- Obesity/Lipids
('E669', 'Obesity, unspecified', 'E00-E89', 'Metabolic', true, 'active'),
('E6601', 'Morbid (severe) obesity due to excess calories', 'E00-E89', 'Metabolic', true, 'active'),
('Z6841', 'BMI 40.0-44.9, adult', 'Z00-Z99', 'Metabolic', true, 'active'),
('Z6845', 'BMI 70 or greater, adult', 'Z00-Z99', 'Metabolic', true, 'active'),
('E785', 'Hyperlipidemia, unspecified', 'E00-E89', 'Metabolic', true, 'active'),
('E780', 'Pure hypercholesterolemia, unspecified', 'E00-E89', 'Metabolic', true, 'active'),
('E781', 'Pure hyperglyceridemia', 'E00-E89', 'Metabolic', true, 'active'),

-- Mental Health
('F329', 'Major depressive disorder, single episode, unspecified', 'F01-F99', 'Mental Health', true, 'active'),
('F339', 'Major depressive disorder, recurrent, unspecified', 'F01-F99', 'Mental Health', true, 'active'),
('F411', 'Generalized anxiety disorder', 'F01-F99', 'Mental Health', true, 'active'),
('F419', 'Anxiety disorder, unspecified', 'F01-F99', 'Mental Health', true, 'active'),
('F4310', 'Post-traumatic stress disorder, unspecified', 'F01-F99', 'Mental Health', true, 'active'),
('F319', 'Bipolar disorder, unspecified', 'F01-F99', 'Mental Health', true, 'active'),
('F209', 'Schizophrenia, unspecified', 'F01-F99', 'Mental Health', true, 'active'),

-- Substance Use
('F1010', 'Alcohol use disorder, mild', 'F01-F99', 'Substance Use', true, 'active'),
('F1020', 'Alcohol use disorder, moderate', 'F01-F99', 'Substance Use', true, 'active'),
('F1120', 'Opioid use disorder, moderate', 'F01-F99', 'Substance Use', true, 'active'),
('F1121', 'Opioid use disorder, in remission', 'F01-F99', 'Substance Use', true, 'active'),
('F17210', 'Nicotine dependence, cigarettes, uncomplicated', 'F01-F99', 'Substance Use', true, 'active'),

-- Pain
('G89.29', 'Other chronic pain', 'G00-G99', 'Pain', true, 'active'),
('G89.4', 'Chronic pain syndrome', 'G00-G99', 'Pain', true, 'active'),
('M545', 'Low back pain', 'M00-M99', 'Musculoskeletal', true, 'active'),
('M5416', 'Radiculopathy, lumbar region', 'M00-M99', 'Musculoskeletal', true, 'active'),
('M5417', 'Radiculopathy, lumbosacral region', 'M00-M99', 'Musculoskeletal', true, 'active'),
('M542', 'Cervicalgia', 'M00-M99', 'Musculoskeletal', true, 'active'),

-- Dementia/Cognitive
('F0390', 'Unspecified dementia without behavioral disturbance', 'F01-F99', 'Cognitive', true, 'active'),
('G309', 'Alzheimers disease, unspecified', 'G00-G99', 'Cognitive', true, 'active'),
('G3184', 'Mild cognitive impairment', 'G00-G99', 'Cognitive', true, 'active'),
('F0150', 'Vascular dementia without behavioral disturbance', 'F01-F99', 'Cognitive', true, 'active'),

-- Parkinsons
('G20', 'Parkinsons disease', 'G00-G99', 'Neurological', true, 'active'),
('G2111', 'Secondary parkinsonism due to other external agents', 'G00-G99', 'Neurological', true, 'active'),

-- Stroke
('I639', 'Cerebral infarction, unspecified', 'I00-I99', 'Neurological', true, 'active'),
('Z8673', 'Personal history of TIA and cerebral infarction without residual deficits', 'Z00-Z99', 'History', true, 'active'),
('I69398', 'Other sequelae of cerebral infarction', 'I00-I99', 'Neurological', true, 'active'),

-- Fall Risk
('R2981', 'History of falling', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('Z9181', 'History of falling', 'Z00-Z99', 'History', true, 'active'),
('W19XXXA', 'Unspecified fall, initial encounter', 'V00-Y99', 'External Causes', true, 'active'),

-- SDOH Z-Codes (core set)
('Z590', 'Homelessness', 'Z00-Z99', 'SDOH', true, 'active'),
('Z591', 'Inadequate housing', 'Z00-Z99', 'SDOH', true, 'active'),
('Z5941', 'Food insecurity', 'Z00-Z99', 'SDOH', true, 'active'),
('Z5982', 'Transportation insecurity', 'Z00-Z99', 'SDOH', true, 'active'),
('Z560', 'Unemployment, unspecified', 'Z00-Z99', 'SDOH', true, 'active'),
('Z550', 'Illiteracy and low-level literacy', 'Z00-Z99', 'SDOH', true, 'active'),
('Z604', 'Social exclusion and rejection', 'Z00-Z99', 'SDOH', true, 'active'),
('Z595', 'Extreme poverty', 'Z00-Z99', 'SDOH', true, 'active'),
('Z596', 'Low income', 'Z00-Z99', 'SDOH', true, 'active'),
('Z59811', 'Housing instability, housed, with risk of homelessness', 'Z00-Z99', 'SDOH', true, 'active'),
('Z71.89', 'Other specified counseling', 'Z00-Z99', 'Encounters', true, 'active')

ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description,
  chapter = EXCLUDED.chapter,
  category = EXCLUDED.category,
  is_billable = EXCLUDED.is_billable,
  status = EXCLUDED.status;

-- =====================================================
-- 4. SEED COMMON HCPCS CODES
-- =====================================================

INSERT INTO code_hcpcs (code, short_description, long_description, level, status) VALUES
-- DME
('A4253', 'Glucose strips', 'Blood glucose test or reagent strips, 50 strips per box', 'II', 'active'),
('A4256', 'Glucose calibration solution', 'Normal, low and high calibrator solution for glucose monitor', 'II', 'active'),
('A4259', 'Lancets', 'Lancets, 100 per box', 'II', 'active'),
('E0607', 'Home blood glucose monitor', 'Home blood glucose monitor', 'II', 'active'),
('A6216', 'Gauze', 'Gauze, non-impregnated, sterile, pad or sheet, any size', 'II', 'active'),
('A7030', 'Nebulizer tubing', 'Full face cushion for use with continuous positive airway pressure device', 'II', 'active'),
('E0260', 'Hospital bed, semi-electric', 'Hospital bed, semi-electric', 'II', 'active'),
('E0601', 'CPAP device', 'Continuous positive airway pressure (CPAP) device', 'II', 'active'),
('E0431', 'Portable O2 system', 'Portable gaseous oxygen system, rental', 'II', 'active'),
('K0823', 'Power wheelchair, group 2', 'Power wheelchair, group 2 standard, sling seat', 'II', 'active'),

-- Drugs (J codes)
('J3301', 'Kenalog injection 10mg', 'Injection, triamcinolone acetonide, 10 mg', 'II', 'active'),
('J0585', 'Botox injection', 'Injection, onabotulinumtoxinA, 1 unit', 'II', 'active'),
('J1100', 'Dexamethasone 1mg', 'Injection, dexamethasone sodium phosphate, 1 mg', 'II', 'active'),
('J1885', 'Ketorolac 15mg', 'Injection, ketorolac tromethamine, 15 mg', 'II', 'active'),
('J2001', 'Lidocaine 10mg', 'Injection, lidocaine HCL, 10 mg', 'II', 'active'),
('J2250', 'Midazolam 1mg', 'Injection, midazolam hydrochloride, 1 mg', 'II', 'active'),
('J2550', 'Promethazine 50mg', 'Injection, promethazine HCL, up to 50 mg', 'II', 'active'),
('J2930', 'Methylprednisolone 40mg', 'Injection, methylprednisolone sodium succinate, 40 mg', 'II', 'active'),
('J3010', 'Fentanyl 0.1mg', 'Injection, fentanyl citrate, 0.1 mg', 'II', 'active'),
('J3490', 'Unclassified drug', 'Unclassified drugs', 'II', 'active'),

-- Telehealth
('G2012', 'Virtual check-in', 'Brief communication technology-based service, 5-10 minutes', 'II', 'active'),
('G2010', 'Remote patient evaluation', 'Remote evaluation of recorded video/images, 5-10 minutes', 'II', 'active'),

-- Wellness visits (AWV)
('G0438', 'AWV initial', 'Annual wellness visit, initial visit, includes PPPS', 'II', 'active'),
('G0439', 'AWV subsequent', 'Annual wellness visit, subsequent visit', 'II', 'active'),

-- CCM/Care Management
('G0506', 'CCM care plan', 'Comprehensive assessment and care plan for chronic care management', 'II', 'active'),
('G2058', 'CCM add-on, 20 min', 'Chronic care management, each additional 20 minutes', 'II', 'active'),
('G2064', 'Principal care mgmt, 30 min', 'Principal care management for single high-risk condition, 30 min', 'II', 'active'),

-- Flu vaccines
('Q2034', 'Influenza vaccine, adult', 'Influenza virus vaccine, split virus, quadrivalent, adult preservative free', 'II', 'active'),
('Q2035', 'Influenza vaccine, high-dose', 'Influenza virus vaccine, split virus, quadrivalent, high-dose, 65+', 'II', 'active'),
('Q2038', 'Influenza vaccine, pediatric', 'Influenza virus vaccine, split virus, pediatric, quadrivalent', 'II', 'active'),

-- COVID vaccines
('91300', 'COVID vaccine, Pfizer', 'SARS-CoV-2 (COVID-19) vaccine, mRNA-LNP, Pfizer, 30 mcg/0.3 mL', 'II', 'active'),
('91301', 'COVID vaccine, Moderna', 'SARS-CoV-2 (COVID-19) vaccine, mRNA-LNP, Moderna, 100 mcg/0.5 mL', 'II', 'active'),

-- Transport
('A0425', 'Ground ambulance, BLS', 'Ground mileage, per statute mile', 'II', 'active'),
('A0428', 'BLS ambulance, emergency', 'Ambulance service, basic life support, emergency transport', 'II', 'active'),
('A0429', 'BLS ambulance, non-emergency', 'Ambulance service, basic life support, non-emergency transport', 'II', 'active'),

-- Home Health
('G0151', 'PT services, home health', 'Services of physical therapist in home health setting', 'II', 'active'),
('G0152', 'OT services, home health', 'Services of occupational therapist in home health setting', 'II', 'active'),
('G0153', 'SLP services, home health', 'Services of speech-language pathologist in home health setting', 'II', 'active'),
('G0155', 'SW services, home health', 'Services of clinical social worker in home health setting', 'II', 'active')

ON CONFLICT (code) DO UPDATE SET
  short_description = EXCLUDED.short_description,
  long_description = EXCLUDED.long_description,
  level = EXCLUDED.level,
  status = EXCLUDED.status;

-- =====================================================
-- 5. SEED COMMON MODIFIERS
-- =====================================================

-- First ensure modifier column matches code column if needed
UPDATE code_modifiers SET modifier = code WHERE modifier IS NULL;

INSERT INTO code_modifiers (code, modifier, description, applies_to, status) VALUES
-- E/M modifiers
('25', '25', 'Significant, separately identifiable E/M service by the same physician on the same day', '{cpt}', 'active'),
('24', '24', 'Unrelated E/M service by the same physician during a postoperative period', '{cpt}', 'active'),
('57', '57', 'Decision for surgery', '{cpt}', 'active'),

-- Procedure modifiers
('50', '50', 'Bilateral procedure', '{cpt,hcpcs}', 'active'),
('51', '51', 'Multiple procedures', '{cpt}', 'active'),
('52', '52', 'Reduced services', '{cpt,hcpcs}', 'active'),
('59', '59', 'Distinct procedural service', '{cpt,hcpcs}', 'active'),
('76', '76', 'Repeat procedure by same physician', '{cpt,hcpcs}', 'active'),
('77', '77', 'Repeat procedure by another physician', '{cpt,hcpcs}', 'active'),
('78', '78', 'Return to the operating room for a related procedure during the postoperative period', '{cpt}', 'active'),
('79', '79', 'Unrelated procedure by the same physician during the postoperative period', '{cpt}', 'active'),
('XE', 'XE', 'Separate encounter', '{cpt,hcpcs}', 'active'),
('XS', 'XS', 'Separate structure', '{cpt,hcpcs}', 'active'),
('XP', 'XP', 'Separate practitioner', '{cpt,hcpcs}', 'active'),
('XU', 'XU', 'Unusual non-overlapping service', '{cpt,hcpcs}', 'active'),

-- Technical/Professional
('26', '26', 'Professional component', '{cpt}', 'active'),
('TC', 'TC', 'Technical component', '{cpt}', 'active'),

-- Anatomical
('LT', 'LT', 'Left side', '{cpt,hcpcs}', 'active'),
('RT', 'RT', 'Right side', '{cpt,hcpcs}', 'active'),
('F1', 'F1', 'Left hand, second digit', '{cpt,hcpcs}', 'active'),
('F2', 'F2', 'Left hand, third digit', '{cpt,hcpcs}', 'active'),
('F3', 'F3', 'Left hand, fourth digit', '{cpt,hcpcs}', 'active'),
('F4', 'F4', 'Left hand, fifth digit', '{cpt,hcpcs}', 'active'),
('F5', 'F5', 'Right hand, thumb', '{cpt,hcpcs}', 'active'),
('F6', 'F6', 'Right hand, second digit', '{cpt,hcpcs}', 'active'),
('F7', 'F7', 'Right hand, third digit', '{cpt,hcpcs}', 'active'),
('F8', 'F8', 'Right hand, fourth digit', '{cpt,hcpcs}', 'active'),
('F9', 'F9', 'Right hand, fifth digit', '{cpt,hcpcs}', 'active'),
('FA', 'FA', 'Left hand, thumb', '{cpt,hcpcs}', 'active'),

-- Anesthesia
('AA', 'AA', 'Anesthesia services performed personally by anesthesiologist', '{cpt}', 'active'),
('AD', 'AD', 'Medical supervision by a physician: more than 4 concurrent anesthesia procedures', '{cpt}', 'active'),
('QK', 'QK', 'Medical direction of 2-4 concurrent anesthesia procedures by a qualified individual', '{cpt}', 'active'),
('QX', 'QX', 'CRNA service: with medical direction by a physician', '{cpt}', 'active'),
('QY', 'QY', 'Medical direction of one CRNA by an anesthesiologist', '{cpt}', 'active'),
('QZ', 'QZ', 'CRNA service: without medical direction by a physician', '{cpt}', 'active'),

-- Telehealth
('95', '95', 'Synchronous telemedicine service rendered via real-time interactive audio and video', '{cpt}', 'active'),
('93', '93', 'Synchronous telemedicine service rendered via telephone or other real-time audio-only', '{cpt}', 'active'),
('GT', 'GT', 'Via interactive audio and video telecommunication systems', '{cpt,hcpcs}', 'active'),
('FQ', 'FQ', 'Service furnished using audio-only communication technology', '{cpt,hcpcs}', 'active'),

-- Reduced/Assistant
('80', '80', 'Assistant surgeon', '{cpt}', 'active'),
('81', '81', 'Minimum assistant surgeon', '{cpt}', 'active'),
('82', '82', 'Assistant surgeon (when qualified resident surgeon not available)', '{cpt}', 'active'),
('AS', 'AS', 'Physician assistant, nurse practitioner, or clinical nurse specialist services for assistant at surgery', '{cpt,hcpcs}', 'active'),
('62', '62', 'Two surgeons', '{cpt}', 'active'),
('66', '66', 'Surgical team', '{cpt}', 'active'),

-- Place of service variations
('PO', 'PO', 'Services, procedures, and/or surgeries furnished at off-campus provider-based department of a hospital', '{hcpcs}', 'active'),

-- Medicare specific
('GY', 'GY', 'Item or service statutorily excluded, does not meet the definition of any Medicare benefit', '{cpt,hcpcs}', 'active'),
('GZ', 'GZ', 'Item or service expected to be denied as not reasonable and necessary', '{cpt,hcpcs}', 'active'),
('GA', 'GA', 'Waiver of liability statement issued as required by payer policy', '{cpt,hcpcs}', 'active'),
('KX', 'KX', 'Requirements specified in the medical policy have been met', '{cpt,hcpcs}', 'active')

ON CONFLICT (code) DO UPDATE SET
  modifier = EXCLUDED.modifier,
  description = EXCLUDED.description,
  applies_to = EXCLUDED.applies_to,
  status = EXCLUDED.status;

-- =====================================================
-- 6. CREATE INDEXES FOR SEARCH PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_code_cpt_description ON code_cpt USING gin(to_tsvector('english', COALESCE(short_description, '') || ' ' || COALESCE(long_description, '')));
CREATE INDEX IF NOT EXISTS idx_code_cpt_category ON code_cpt(category);
CREATE INDEX IF NOT EXISTS idx_code_icd10_description ON code_icd10 USING gin(to_tsvector('english', COALESCE(description, '')));
CREATE INDEX IF NOT EXISTS idx_code_icd10_category ON code_icd10(category);
CREATE INDEX IF NOT EXISTS idx_code_hcpcs_description ON code_hcpcs USING gin(to_tsvector('english', COALESCE(short_description, '') || ' ' || COALESCE(long_description, '')));

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE code_cpt IS 'CPT codes with descriptions and RVU values for billing';
COMMENT ON TABLE code_icd10 IS 'ICD-10 diagnosis codes with descriptions and categories';
COMMENT ON TABLE code_hcpcs IS 'HCPCS Level II codes for supplies, drugs, and services';
COMMENT ON TABLE code_modifiers IS 'Billing modifiers for CPT and HCPCS codes';
