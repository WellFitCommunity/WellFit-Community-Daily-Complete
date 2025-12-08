-- ============================================================================
-- WELLFIT COMMUNITY - HOSPITAL WORKFORCE MIGRATION SCHEMA
-- Version: 1.0.0
-- Purpose: Comprehensive data model for healthcare staff migration
-- Supports: Epic, Cerner, Meditech, Allscripts, legacy Excel imports
-- ============================================================================

-- ============================================================================
-- SECTION 1: REFERENCE/LOOKUP TABLES (Static data, rarely changes)
-- ============================================================================

-- Staff role categories (top-level classification)
CREATE TABLE IF NOT EXISTS ref_staff_category (
    category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_code VARCHAR(50) NOT NULL UNIQUE,
    category_name VARCHAR(100) NOT NULL,
    display_order INT DEFAULT 0,
    is_clinical BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO ref_staff_category (category_code, category_name, display_order, is_clinical) VALUES
('PHYSICIAN', 'Physicians', 10, true),
('APP', 'Advanced Practice Providers', 20, true),
('NURSING', 'Nursing', 30, true),
('ALLIED_HEALTH', 'Allied Health', 40, true),
('EMERGENCY', 'Emergency & Critical Care', 50, true),
('SURGICAL', 'Surgical Services', 60, true),
('BEHAVIORAL', 'Behavioral Health', 70, true),
('EXEC', 'Executive Leadership', 80, false),
('ADMIN', 'Administrative', 90, false),
('REVENUE_CYCLE', 'Revenue Cycle', 100, false),
('HIM', 'Health Information Management', 110, false),
('PATIENT_ACCESS', 'Patient Access', 120, false),
('SUPPORT', 'Support Services', 130, false),
('IT', 'Information Technology', 140, false),
('QUALITY', 'Quality & Compliance', 150, false),
('EDUCATION', 'Education & Research', 160, false)
ON CONFLICT (category_code) DO NOTHING;

-- Specific role types within categories
CREATE TABLE IF NOT EXISTS ref_role_type (
    role_type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES ref_staff_category(category_id),
    role_code VARCHAR(50) NOT NULL UNIQUE,
    role_name VARCHAR(150) NOT NULL,
    role_abbreviation VARCHAR(20),
    requires_npi BOOLEAN DEFAULT false,
    requires_license BOOLEAN DEFAULT false,
    requires_dea BOOLEAN DEFAULT false,
    is_prescriber BOOLEAN DEFAULT false,
    can_admit_patients BOOLEAN DEFAULT false,
    can_order BOOLEAN DEFAULT false,
    typical_taxonomy_code VARCHAR(20), -- NUCC Healthcare Provider Taxonomy
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Physicians
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'ATTENDING_PHYSICIAN', 'Attending Physician', 'MD/DO', true, true, true, true, true, true, '208D00000X' FROM ref_staff_category WHERE category_code = 'PHYSICIAN' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'RESIDENT', 'Resident Physician', 'Resident', true, true, false, true, false, true, '390200000X' FROM ref_staff_category WHERE category_code = 'PHYSICIAN' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'FELLOW', 'Fellow Physician', 'Fellow', true, true, false, true, false, true, '390200000X' FROM ref_staff_category WHERE category_code = 'PHYSICIAN' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'INTERN', 'Intern Physician', 'Intern', true, true, false, true, false, true, '390200000X' FROM ref_staff_category WHERE category_code = 'PHYSICIAN' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'HOSPITALIST', 'Hospitalist', 'Hospitalist', true, true, true, true, true, true, '208M00000X' FROM ref_staff_category WHERE category_code = 'PHYSICIAN' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'CONSULTING_PHYSICIAN', 'Consulting Physician', 'Consultant', true, true, true, true, false, true, '208D00000X' FROM ref_staff_category WHERE category_code = 'PHYSICIAN' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'MEDICAL_DIRECTOR', 'Medical Director', 'Med Dir', true, true, true, true, true, true, '208D00000X' FROM ref_staff_category WHERE category_code = 'PHYSICIAN' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'CMO', 'Chief Medical Officer', 'CMO', true, true, true, true, true, true, '208D00000X' FROM ref_staff_category WHERE category_code = 'PHYSICIAN' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'DEPARTMENT_CHIEF', 'Department Chief', 'Dept Chief', true, true, true, true, true, true, '208D00000X' FROM ref_staff_category WHERE category_code = 'PHYSICIAN' ON CONFLICT (role_code) DO NOTHING;

-- Advanced Practice Providers
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'NP', 'Nurse Practitioner', 'NP', true, true, true, true, false, true, '363L00000X' FROM ref_staff_category WHERE category_code = 'APP' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'PA', 'Physician Assistant', 'PA', true, true, true, true, false, true, '363A00000X' FROM ref_staff_category WHERE category_code = 'APP' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'CNM', 'Certified Nurse Midwife', 'CNM', true, true, true, true, true, true, '367A00000X' FROM ref_staff_category WHERE category_code = 'APP' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'CRNA', 'Certified Registered Nurse Anesthetist', 'CRNA', true, true, true, true, false, true, '367500000X' FROM ref_staff_category WHERE category_code = 'APP' ON CONFLICT (role_code) DO NOTHING;

-- Nursing
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'RN', 'Registered Nurse', 'RN', false, true, false, false, false, false, '163W00000X' FROM ref_staff_category WHERE category_code = 'NURSING' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'LPN', 'Licensed Practical Nurse', 'LPN/LVN', false, true, false, false, false, false, '164W00000X' FROM ref_staff_category WHERE category_code = 'NURSING' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'CHARGE_NURSE', 'Charge Nurse', 'Charge RN', false, true, false, false, false, false, '163W00000X' FROM ref_staff_category WHERE category_code = 'NURSING' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'NURSE_MANAGER', 'Nurse Manager', 'Nurse Mgr', false, true, false, false, false, false, '163W00000X' FROM ref_staff_category WHERE category_code = 'NURSING' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'DON', 'Director of Nursing', 'DON', false, true, false, false, false, false, '163W00000X' FROM ref_staff_category WHERE category_code = 'NURSING' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'CNO', 'Chief Nursing Officer', 'CNO', false, true, false, false, false, false, '163W00000X' FROM ref_staff_category WHERE category_code = 'NURSING' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'CNS', 'Clinical Nurse Specialist', 'CNS', true, true, false, false, false, true, '364S00000X' FROM ref_staff_category WHERE category_code = 'NURSING' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'NURSE_EDUCATOR', 'Nurse Educator', 'Nurse Edu', false, true, false, false, false, false, '163W00000X' FROM ref_staff_category WHERE category_code = 'NURSING' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'TRAVEL_NURSE', 'Travel Nurse', 'Travel RN', false, true, false, false, false, false, '163W00000X' FROM ref_staff_category WHERE category_code = 'NURSING' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'PER_DIEM_NURSE', 'Per Diem Nurse', 'PRN RN', false, true, false, false, false, false, '163W00000X' FROM ref_staff_category WHERE category_code = 'NURSING' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'CNA', 'Certified Nursing Assistant', 'CNA', false, true, false, false, false, false, '372600000X' FROM ref_staff_category WHERE category_code = 'NURSING' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'PCT', 'Patient Care Technician', 'PCT', false, false, false, false, false, false, '374700000X' FROM ref_staff_category WHERE category_code = 'NURSING' ON CONFLICT (role_code) DO NOTHING;

-- Allied Health
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'PT', 'Physical Therapist', 'PT', true, true, false, false, false, true, '225100000X' FROM ref_staff_category WHERE category_code = 'ALLIED_HEALTH' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'PTA', 'Physical Therapist Assistant', 'PTA', false, true, false, false, false, false, '225200000X' FROM ref_staff_category WHERE category_code = 'ALLIED_HEALTH' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'OT', 'Occupational Therapist', 'OT', true, true, false, false, false, true, '225X00000X' FROM ref_staff_category WHERE category_code = 'ALLIED_HEALTH' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'OTA', 'Occupational Therapy Assistant', 'OTA', false, true, false, false, false, false, '224Z00000X' FROM ref_staff_category WHERE category_code = 'ALLIED_HEALTH' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'SLP', 'Speech-Language Pathologist', 'SLP', true, true, false, false, false, true, '235Z00000X' FROM ref_staff_category WHERE category_code = 'ALLIED_HEALTH' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'RT', 'Respiratory Therapist', 'RT', true, true, false, false, false, true, '227800000X' FROM ref_staff_category WHERE category_code = 'ALLIED_HEALTH' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'DIETITIAN', 'Registered Dietitian', 'RD', true, true, false, false, false, true, '133V00000X' FROM ref_staff_category WHERE category_code = 'ALLIED_HEALTH' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'SOCIAL_WORKER', 'Licensed Clinical Social Worker', 'LCSW', true, true, false, false, false, false, '1041C0700X' FROM ref_staff_category WHERE category_code = 'ALLIED_HEALTH' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'CASE_MANAGER', 'Case Manager', 'CM', false, true, false, false, false, false, '171M00000X' FROM ref_staff_category WHERE category_code = 'ALLIED_HEALTH' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'PHARMACIST', 'Pharmacist', 'PharmD/RPh', true, true, false, false, false, true, '183500000X' FROM ref_staff_category WHERE category_code = 'ALLIED_HEALTH' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'PHARM_TECH', 'Pharmacy Technician', 'Pharm Tech', false, true, false, false, false, false, '183700000X' FROM ref_staff_category WHERE category_code = 'ALLIED_HEALTH' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'LAB_TECH', 'Laboratory Technician', 'Lab Tech', false, true, false, false, false, false, '246QB0000X' FROM ref_staff_category WHERE category_code = 'ALLIED_HEALTH' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'MED_LAB_SCIENTIST', 'Medical Laboratory Scientist', 'MLS', false, true, false, false, false, false, '246Q00000X' FROM ref_staff_category WHERE category_code = 'ALLIED_HEALTH' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'RAD_TECH', 'Radiologic Technologist', 'Rad Tech', false, true, false, false, false, false, '247100000X' FROM ref_staff_category WHERE category_code = 'ALLIED_HEALTH' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'MRI_TECH', 'MRI Technologist', 'MRI Tech', false, true, false, false, false, false, '2471M2300X' FROM ref_staff_category WHERE category_code = 'ALLIED_HEALTH' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'CT_TECH', 'CT Technologist', 'CT Tech', false, true, false, false, false, false, '2471C1106X' FROM ref_staff_category WHERE category_code = 'ALLIED_HEALTH' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'ULTRASOUND_TECH', 'Ultrasound Technologist', 'Sono Tech', false, true, false, false, false, false, '2471S1302X' FROM ref_staff_category WHERE category_code = 'ALLIED_HEALTH' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'NUC_MED_TECH', 'Nuclear Medicine Technologist', 'NM Tech', false, true, false, false, false, false, '247200000X' FROM ref_staff_category WHERE category_code = 'ALLIED_HEALTH' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'PHLEBOTOMIST', 'Phlebotomist', 'Phleb', false, false, false, false, false, false, '246R00000X' FROM ref_staff_category WHERE category_code = 'ALLIED_HEALTH' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'EKG_TECH', 'EKG Technician', 'EKG Tech', false, false, false, false, false, false, '246W00000X' FROM ref_staff_category WHERE category_code = 'ALLIED_HEALTH' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'SURG_TECH', 'Surgical Technologist', 'Surg Tech', false, true, false, false, false, false, '374T00000X' FROM ref_staff_category WHERE category_code = 'ALLIED_HEALTH' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'STERILE_PROC_TECH', 'Sterile Processing Technician', 'SPD Tech', false, false, false, false, false, false, '374700000X' FROM ref_staff_category WHERE category_code = 'ALLIED_HEALTH' ON CONFLICT (role_code) DO NOTHING;

-- Emergency & Critical Care
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'EM_PHYSICIAN', 'Emergency Medicine Physician', 'EM MD', true, true, true, true, true, true, '207P00000X' FROM ref_staff_category WHERE category_code = 'EMERGENCY' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'TRAUMA_SURGEON', 'Trauma Surgeon', 'Trauma Surg', true, true, true, true, true, true, '208G00000X' FROM ref_staff_category WHERE category_code = 'EMERGENCY' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'PARAMEDIC', 'Paramedic', 'Paramedic', false, true, false, false, false, false, '146L00000X' FROM ref_staff_category WHERE category_code = 'EMERGENCY' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'EMT', 'Emergency Medical Technician', 'EMT', false, true, false, false, false, false, '146M00000X' FROM ref_staff_category WHERE category_code = 'EMERGENCY' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'FLIGHT_NURSE', 'Flight Nurse', 'Flight RN', false, true, false, false, false, false, '163WC3500X' FROM ref_staff_category WHERE category_code = 'EMERGENCY' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'ICU_NURSE', 'Critical Care Nurse', 'ICU RN', false, true, false, false, false, false, '163WC0400X' FROM ref_staff_category WHERE category_code = 'EMERGENCY' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'ER_NURSE', 'Emergency Room Nurse', 'ER RN', false, true, false, false, false, false, '163WE0003X' FROM ref_staff_category WHERE category_code = 'EMERGENCY' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'TRIAGE_NURSE', 'Triage Nurse', 'Triage RN', false, true, false, false, false, false, '163W00000X' FROM ref_staff_category WHERE category_code = 'EMERGENCY' ON CONFLICT (role_code) DO NOTHING;

-- Surgical Services
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'SURGEON_GENERAL', 'General Surgeon', 'Gen Surg', true, true, true, true, true, true, '208600000X' FROM ref_staff_category WHERE category_code = 'SURGICAL' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'SURGEON_CARDIO', 'Cardiothoracic Surgeon', 'CT Surg', true, true, true, true, true, true, '208G00000X' FROM ref_staff_category WHERE category_code = 'SURGICAL' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'SURGEON_NEURO', 'Neurosurgeon', 'Neuro Surg', true, true, true, true, true, true, '207T00000X' FROM ref_staff_category WHERE category_code = 'SURGICAL' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'SURGEON_ORTHO', 'Orthopedic Surgeon', 'Ortho Surg', true, true, true, true, true, true, '207X00000X' FROM ref_staff_category WHERE category_code = 'SURGICAL' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'ANESTHESIOLOGIST', 'Anesthesiologist', 'Anes MD', true, true, true, true, false, true, '207L00000X' FROM ref_staff_category WHERE category_code = 'SURGICAL' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'ANES_ASSISTANT', 'Anesthesia Assistant', 'AA', false, true, false, false, false, false, '367H00000X' FROM ref_staff_category WHERE category_code = 'SURGICAL' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'CIRCULATING_NURSE', 'Circulating Nurse', 'Circ RN', false, true, false, false, false, false, '163WS0200X' FROM ref_staff_category WHERE category_code = 'SURGICAL' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'SCRUB_NURSE', 'Scrub Nurse', 'Scrub RN', false, true, false, false, false, false, '163WS0200X' FROM ref_staff_category WHERE category_code = 'SURGICAL' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'PACU_NURSE', 'PACU Nurse', 'PACU RN', false, true, false, false, false, false, '163WP0200X' FROM ref_staff_category WHERE category_code = 'SURGICAL' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'OR_MANAGER', 'Operating Room Manager', 'OR Mgr', false, true, false, false, false, false, '163W00000X' FROM ref_staff_category WHERE category_code = 'SURGICAL' ON CONFLICT (role_code) DO NOTHING;

-- Behavioral Health
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'PSYCHIATRIST', 'Psychiatrist', 'Psych MD', true, true, true, true, true, true, '2084P0800X' FROM ref_staff_category WHERE category_code = 'BEHAVIORAL' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'PSYCHOLOGIST', 'Psychologist', 'PhD/PsyD', true, true, false, false, false, true, '103T00000X' FROM ref_staff_category WHERE category_code = 'BEHAVIORAL' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'PSYCH_NURSE', 'Psychiatric Nurse', 'Psych RN', false, true, false, false, false, false, '163WP0807X' FROM ref_staff_category WHERE category_code = 'BEHAVIORAL' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'MH_COUNSELOR', 'Mental Health Counselor', 'LPC/LMHC', true, true, false, false, false, false, '101YM0800X' FROM ref_staff_category WHERE category_code = 'BEHAVIORAL' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'SUBSTANCE_COUNSELOR', 'Substance Abuse Counselor', 'CASAC/CADC', true, true, false, false, false, false, '101YA0400X' FROM ref_staff_category WHERE category_code = 'BEHAVIORAL' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'BH_TECH', 'Behavioral Health Technician', 'BHT', false, false, false, false, false, false, '374700000X' FROM ref_staff_category WHERE category_code = 'BEHAVIORAL' ON CONFLICT (role_code) DO NOTHING;

-- Executive Leadership
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'CEO', 'Chief Executive Officer', 'CEO', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'EXEC' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'CFO', 'Chief Financial Officer', 'CFO', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'EXEC' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'COO', 'Chief Operating Officer', 'COO', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'EXEC' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'CIO', 'Chief Information Officer', 'CIO', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'EXEC' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'CISO', 'Chief Information Security Officer', 'CISO', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'EXEC' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'CHRO', 'Chief Human Resources Officer', 'CHRO', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'EXEC' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'CCO', 'Chief Compliance Officer', 'CCO', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'EXEC' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'CQO', 'Chief Quality Officer', 'CQO', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'EXEC' ON CONFLICT (role_code) DO NOTHING;

-- Administrative
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'DEPT_MANAGER', 'Department Manager', 'Dept Mgr', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'ADMIN' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'UNIT_MANAGER', 'Unit Manager', 'Unit Mgr', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'ADMIN' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'PRACTICE_MANAGER', 'Practice Manager', 'Practice Mgr', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'ADMIN' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'CLINIC_ADMIN', 'Clinic Administrator', 'Clinic Admin', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'ADMIN' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'OPS_DIRECTOR', 'Operations Director', 'Ops Dir', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'ADMIN' ON CONFLICT (role_code) DO NOTHING;

-- Revenue Cycle
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'MEDICAL_CODER', 'Medical Coder', 'Coder', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'REVENUE_CYCLE' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'MEDICAL_BILLER', 'Medical Biller', 'Biller', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'REVENUE_CYCLE' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'CHARGE_CAPTURE', 'Charge Capture Specialist', 'Charge Spec', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'REVENUE_CYCLE' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'PRIOR_AUTH', 'Prior Authorization Specialist', 'Prior Auth', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'REVENUE_CYCLE' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'CLAIMS_ANALYST', 'Claims Analyst', 'Claims', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'REVENUE_CYCLE' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'REV_CYCLE_MGR', 'Revenue Cycle Manager', 'Rev Cycle Mgr', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'REVENUE_CYCLE' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'PATIENT_FIN_COUNSELOR', 'Patient Financial Counselor', 'Fin Counselor', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'REVENUE_CYCLE' ON CONFLICT (role_code) DO NOTHING;

-- Health Information Management
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'HIM_MANAGER', 'Health Information Manager', 'HIM Mgr', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'HIM' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'MED_RECORDS_TECH', 'Medical Records Technician', 'MR Tech', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'HIM' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'ROI_SPECIALIST', 'Release of Information Specialist', 'ROI Spec', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'HIM' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'TRANSCRIPTIONIST', 'Medical Transcriptionist', 'MT', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'HIM' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'CDI_SPECIALIST', 'Clinical Documentation Specialist', 'CDI', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'HIM' ON CONFLICT (role_code) DO NOTHING;

-- Patient Access
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'PATIENT_ACCESS_REP', 'Patient Access Representative', 'PAR', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'PATIENT_ACCESS' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'REGISTRAR', 'Registrar', 'Registrar', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'PATIENT_ACCESS' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'SCHEDULER', 'Scheduler', 'Scheduler', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'PATIENT_ACCESS' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'ADMISSIONS_COORD', 'Admissions Coordinator', 'Admissions', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'PATIENT_ACCESS' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'INSURANCE_VERIFIER', 'Insurance Verifier', 'Ins Verify', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'PATIENT_ACCESS' ON CONFLICT (role_code) DO NOTHING;

-- Support Services
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'UNIT_CLERK', 'Unit Secretary/Clerk', 'Unit Clerk', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'SUPPORT' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'TRANSPORTER', 'Patient Transporter', 'Transport', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'SUPPORT' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'EVS', 'Environmental Services', 'EVS', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'SUPPORT' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'FOOD_SERVICES', 'Food Services', 'Food Svc', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'SUPPORT' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'SECURITY', 'Security Officer', 'Security', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'SUPPORT' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'FACILITIES', 'Facilities/Maintenance', 'Facilities', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'SUPPORT' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'BIOMED_TECH', 'Biomedical Equipment Technician', 'Biomed', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'SUPPORT' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'SUPPLY_CHAIN', 'Supply Chain/Materials', 'Supply', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'SUPPORT' ON CONFLICT (role_code) DO NOTHING;

-- IT/Informatics
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'HEALTH_IT', 'Health IT Specialist', 'Health IT', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'IT' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'CLINICAL_INFORMATICIST', 'Clinical Informaticist', 'Informatics', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'IT' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'EHR_ANALYST', 'EHR Analyst', 'EHR Analyst', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'IT' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'INTERFACE_ANALYST', 'Interface Analyst', 'Interface', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'IT' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'HELP_DESK', 'Help Desk', 'Help Desk', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'IT' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'NETWORK_ADMIN', 'Network Administrator', 'Net Admin', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'IT' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'SECURITY_ANALYST', 'Security Analyst', 'Sec Analyst', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'IT' ON CONFLICT (role_code) DO NOTHING;

-- Quality & Compliance
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'QI_COORDINATOR', 'Quality Improvement Coordinator', 'QI Coord', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'QUALITY' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'INFECTION_PREVENT', 'Infection Preventionist', 'IP', false, true, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'QUALITY' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'RISK_MANAGER', 'Risk Manager', 'Risk Mgr', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'QUALITY' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'COMPLIANCE_OFFICER', 'Compliance Officer', 'Compliance', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'QUALITY' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'PATIENT_SAFETY', 'Patient Safety Officer', 'PSO', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'QUALITY' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'ACCREDITATION_COORD', 'Accreditation Coordinator', 'Accred Coord', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'QUALITY' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'UR_SPECIALIST', 'Utilization Review Specialist', 'UR Spec', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'QUALITY' ON CONFLICT (role_code) DO NOTHING;

-- Education & Research
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'CLINICAL_EDUCATOR', 'Clinical Educator', 'Clin Edu', false, true, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'EDUCATION' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'SIM_SPECIALIST', 'Simulation Specialist', 'Sim Spec', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'EDUCATION' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'RESEARCH_COORD', 'Research Coordinator', 'Research Coord', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'EDUCATION' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'PI', 'Principal Investigator', 'PI', true, true, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'EDUCATION' ON CONFLICT (role_code) DO NOTHING;
INSERT INTO ref_role_type (category_id, role_code, role_name, role_abbreviation, requires_npi, requires_license, requires_dea, is_prescriber, can_admit_patients, can_order, typical_taxonomy_code)
SELECT category_id, 'IRB_COORDINATOR', 'IRB Coordinator', 'IRB Coord', false, false, false, false, false, false, NULL FROM ref_staff_category WHERE category_code = 'EDUCATION' ON CONFLICT (role_code) DO NOTHING;


-- ============================================================================
-- SECTION 2: CREDENTIAL & LICENSE REFERENCE TABLES
-- ============================================================================

-- Credential types (degrees, certifications)
CREATE TABLE IF NOT EXISTS ref_credential_type (
    credential_type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credential_code VARCHAR(50) NOT NULL UNIQUE,
    credential_name VARCHAR(150) NOT NULL,
    credential_category VARCHAR(50) NOT NULL, -- DEGREE, CERTIFICATION, SPECIALTY_BOARD
    issuing_body VARCHAR(200),
    requires_renewal BOOLEAN DEFAULT false,
    typical_renewal_years INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO ref_credential_type (credential_code, credential_name, credential_category, issuing_body, requires_renewal, typical_renewal_years) VALUES
-- Degrees
('MD', 'Doctor of Medicine', 'DEGREE', NULL, false, NULL),
('DO', 'Doctor of Osteopathic Medicine', 'DEGREE', NULL, false, NULL),
('MBBS', 'Bachelor of Medicine, Bachelor of Surgery', 'DEGREE', NULL, false, NULL),
('PHD', 'Doctor of Philosophy', 'DEGREE', NULL, false, NULL),
('PSYD', 'Doctor of Psychology', 'DEGREE', NULL, false, NULL),
('DNP', 'Doctor of Nursing Practice', 'DEGREE', NULL, false, NULL),
('DPT', 'Doctor of Physical Therapy', 'DEGREE', NULL, false, NULL),
('PHARMD', 'Doctor of Pharmacy', 'DEGREE', NULL, false, NULL),
('MSN', 'Master of Science in Nursing', 'DEGREE', NULL, false, NULL),
('BSN', 'Bachelor of Science in Nursing', 'DEGREE', NULL, false, NULL),
('ADN', 'Associate Degree in Nursing', 'DEGREE', NULL, false, NULL),
('MPH', 'Master of Public Health', 'DEGREE', NULL, false, NULL),
('MHA', 'Master of Health Administration', 'DEGREE', NULL, false, NULL),
('MBA', 'Master of Business Administration', 'DEGREE', NULL, false, NULL),

-- Nursing Certifications
('CCRN', 'Critical Care Registered Nurse', 'CERTIFICATION', 'AACN Certification Corporation', true, 3),
('CEN', 'Certified Emergency Nurse', 'CERTIFICATION', 'BCEN', true, 4),
('CNOR', 'Certified Perioperative Nurse', 'CERTIFICATION', 'CCI', true, 5),
('OCN', 'Oncology Certified Nurse', 'CERTIFICATION', 'ONCC', true, 4),
('PCCN', 'Progressive Care Certified Nurse', 'CERTIFICATION', 'AACN Certification Corporation', true, 3),
('RNC_OB', 'Inpatient Obstetric Nursing', 'CERTIFICATION', 'NCC', true, 3),

-- Medical Coding Certifications
('CPC', 'Certified Professional Coder', 'CERTIFICATION', 'AAPC', true, 2),
('CCS', 'Certified Coding Specialist', 'CERTIFICATION', 'AHIMA', true, 2),
('RHIA', 'Registered Health Information Administrator', 'CERTIFICATION', 'AHIMA', true, 2),
('RHIT', 'Registered Health Information Technician', 'CERTIFICATION', 'AHIMA', true, 2),

-- Other Certifications
('BLS', 'Basic Life Support', 'CERTIFICATION', 'AHA', true, 2),
('ACLS', 'Advanced Cardiovascular Life Support', 'CERTIFICATION', 'AHA', true, 2),
('PALS', 'Pediatric Advanced Life Support', 'CERTIFICATION', 'AHA', true, 2),
('NRP', 'Neonatal Resuscitation Program', 'CERTIFICATION', 'AAP', true, 2),
('TNCC', 'Trauma Nursing Core Course', 'CERTIFICATION', 'ENA', true, 4)
ON CONFLICT (credential_code) DO NOTHING;

-- License types by state
CREATE TABLE IF NOT EXISTS ref_license_type (
    license_type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_code VARCHAR(50) NOT NULL UNIQUE,
    license_name VARCHAR(150) NOT NULL,
    applicable_roles TEXT[], -- Array of role_codes this applies to
    state_specific BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO ref_license_type (license_code, license_name, applicable_roles, state_specific) VALUES
('MD_LICENSE', 'Medical License', ARRAY['ATTENDING_PHYSICIAN', 'RESIDENT', 'FELLOW', 'HOSPITALIST', 'CMO', 'PSYCHIATRIST'], true),
('RN_LICENSE', 'Registered Nurse License', ARRAY['RN', 'CHARGE_NURSE', 'NURSE_MANAGER', 'DON', 'CNO', 'ER_NURSE', 'ICU_NURSE'], true),
('LPN_LICENSE', 'Licensed Practical Nurse License', ARRAY['LPN'], true),
('NP_LICENSE', 'Nurse Practitioner License', ARRAY['NP'], true),
('PA_LICENSE', 'Physician Assistant License', ARRAY['PA'], true),
('PHARM_LICENSE', 'Pharmacist License', ARRAY['PHARMACIST'], true),
('PT_LICENSE', 'Physical Therapist License', ARRAY['PT'], true),
('OT_LICENSE', 'Occupational Therapist License', ARRAY['OT'], true),
('SLP_LICENSE', 'Speech-Language Pathologist License', ARRAY['SLP'], true),
('RT_LICENSE', 'Respiratory Therapist License', ARRAY['RT'], true),
('SW_LICENSE', 'Social Worker License', ARRAY['SOCIAL_WORKER'], true),
('PSYCH_LICENSE', 'Psychologist License', ARRAY['PSYCHOLOGIST'], true),
('COUNSELOR_LICENSE', 'Professional Counselor License', ARRAY['MH_COUNSELOR', 'SUBSTANCE_COUNSELOR'], true),
('EMT_CERT', 'EMT Certification', ARRAY['EMT'], true),
('PARAMEDIC_CERT', 'Paramedic Certification', ARRAY['PARAMEDIC'], true),
('CNA_CERT', 'CNA Certification', ARRAY['CNA'], true)
ON CONFLICT (license_code) DO NOTHING;


-- ============================================================================
-- SECTION 3: ORGANIZATION STRUCTURE TABLES
-- ============================================================================

-- Healthcare organizations (multi-tenant support)
CREATE TABLE IF NOT EXISTS hc_organization (
    organization_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    organization_name VARCHAR(255) NOT NULL,
    organization_type VARCHAR(50) NOT NULL, -- HOSPITAL, CLINIC, PRACTICE, HEALTH_SYSTEM, NURSING_HOME
    parent_organization_id UUID REFERENCES hc_organization(organization_id),
    npi VARCHAR(10) UNIQUE, -- Organizational NPI (Type 2)
    tax_id VARCHAR(20),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(2),
    zip VARCHAR(10),
    phone VARCHAR(20),
    fax VARCHAR(20),
    website VARCHAR(255),
    cms_certification_number VARCHAR(20), -- CCN for Medicare
    is_active BOOLEAN DEFAULT true,
    source_system VARCHAR(100), -- EPIC, CERNER, EXCEL, etc.
    source_id VARCHAR(255), -- ID from source system
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Departments within organizations
CREATE TABLE IF NOT EXISTS hc_department (
    department_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES hc_organization(organization_id),
    department_code VARCHAR(50) NOT NULL,
    department_name VARCHAR(150) NOT NULL,
    department_type VARCHAR(50), -- CLINICAL, ADMINISTRATIVE, SUPPORT
    parent_department_id UUID REFERENCES hc_department(department_id),
    cost_center VARCHAR(50),
    location VARCHAR(255),
    phone VARCHAR(20),
    fax VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    source_system VARCHAR(100),
    source_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, department_code)
);

-- Physical locations/facilities
CREATE TABLE IF NOT EXISTS hc_facility (
    facility_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES hc_organization(organization_id),
    facility_code VARCHAR(50) NOT NULL,
    facility_name VARCHAR(255) NOT NULL,
    facility_type VARCHAR(50), -- MAIN_CAMPUS, SATELLITE, CLINIC, ASC, URGENT_CARE
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(2),
    zip VARCHAR(10),
    phone VARCHAR(20),
    fax VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    source_system VARCHAR(100),
    source_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, facility_code)
);


-- ============================================================================
-- SECTION 4: CORE STAFF/PERSONNEL TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS hc_staff (
    staff_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES hc_organization(organization_id),

    -- Core identity
    employee_id VARCHAR(50), -- Internal employee number
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    suffix VARCHAR(20), -- Jr, Sr, III, etc.
    preferred_name VARCHAR(100),
    former_names TEXT[], -- For maiden names, name changes

    -- Demographics (optional, for HR purposes)
    date_of_birth DATE,
    gender VARCHAR(20),

    -- Contact
    email VARCHAR(255),
    phone_work VARCHAR(20),
    phone_mobile VARCHAR(20),
    phone_home VARCHAR(20),

    -- Address
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(2),
    zip VARCHAR(10),

    -- Employment
    hire_date DATE,
    termination_date DATE,
    employment_status VARCHAR(50), -- ACTIVE, INACTIVE, TERMINATED, LOA, RETIRED
    employment_type VARCHAR(50), -- FULL_TIME, PART_TIME, PRN, CONTRACT, LOCUM, TRAVEL

    -- Clinical identifiers
    npi VARCHAR(10) UNIQUE,
    dea_number VARCHAR(20),
    upin VARCHAR(20), -- Legacy, but still in old systems
    medicare_ptan VARCHAR(50), -- Provider Transaction Access Number
    medicaid_id VARCHAR(50),

    -- Primary role (for quick filtering)
    primary_role_type_id UUID REFERENCES ref_role_type(role_type_id),
    primary_department_id UUID REFERENCES hc_department(department_id),
    primary_facility_id UUID REFERENCES hc_facility(facility_id),

    -- User account linkage
    user_account_id UUID REFERENCES auth.users(id), -- Links to auth system

    -- Migration tracking
    source_system VARCHAR(100), -- EPIC, CERNER, MEDITECH, EXCEL, etc.
    source_id VARCHAR(255), -- ID from source system
    source_data JSONB, -- Raw source record for reference
    migration_batch_id UUID, -- For tracking migration runs
    migration_status VARCHAR(50), -- PENDING, VALIDATED, IMPORTED, ERROR
    migration_notes TEXT,

    -- Audit
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_hc_staff_organization ON hc_staff(organization_id);
CREATE INDEX IF NOT EXISTS idx_hc_staff_npi ON hc_staff(npi) WHERE npi IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hc_staff_name ON hc_staff(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_hc_staff_employee_id ON hc_staff(organization_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_hc_staff_email ON hc_staff(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hc_staff_primary_role ON hc_staff(primary_role_type_id);
CREATE INDEX IF NOT EXISTS idx_hc_staff_primary_department ON hc_staff(primary_department_id);
CREATE INDEX IF NOT EXISTS idx_hc_staff_employment_status ON hc_staff(employment_status);
CREATE INDEX IF NOT EXISTS idx_hc_staff_source ON hc_staff(source_system, source_id);
CREATE INDEX IF NOT EXISTS idx_hc_staff_migration ON hc_staff(migration_batch_id, migration_status);


-- ============================================================================
-- SECTION 5: STAFF ROLE ASSIGNMENTS (Many-to-Many)
-- ============================================================================

-- Staff can have multiple roles
CREATE TABLE IF NOT EXISTS hc_staff_role (
    staff_role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES hc_staff(staff_id) ON DELETE CASCADE,
    role_type_id UUID NOT NULL REFERENCES ref_role_type(role_type_id),
    department_id UUID REFERENCES hc_department(department_id),
    facility_id UUID REFERENCES hc_facility(facility_id),
    is_primary BOOLEAN DEFAULT false,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    fte DECIMAL(3,2), -- Full-time equivalent (0.00 to 1.00+)
    source_system VARCHAR(100),
    source_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hc_staff_role_staff ON hc_staff_role(staff_id);
CREATE INDEX IF NOT EXISTS idx_hc_staff_role_type ON hc_staff_role(role_type_id);
CREATE INDEX IF NOT EXISTS idx_hc_staff_role_department ON hc_staff_role(department_id);
CREATE INDEX IF NOT EXISTS idx_hc_staff_role_active ON hc_staff_role(staff_id) WHERE end_date IS NULL;


-- ============================================================================
-- SECTION 6: CREDENTIALS, LICENSES, AND CERTIFICATIONS
-- ============================================================================

-- Staff credentials (degrees, certifications)
CREATE TABLE IF NOT EXISTS hc_staff_credential (
    staff_credential_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES hc_staff(staff_id) ON DELETE CASCADE,
    credential_type_id UUID NOT NULL REFERENCES ref_credential_type(credential_type_id),
    credential_number VARCHAR(100),
    issued_date DATE,
    expiration_date DATE,
    issuing_institution VARCHAR(255),
    verification_status VARCHAR(50), -- PENDING, VERIFIED, EXPIRED, REVOKED
    verification_date DATE,
    verified_by UUID REFERENCES hc_staff(staff_id),
    document_url VARCHAR(500), -- Link to scanned credential
    notes TEXT,
    source_system VARCHAR(100),
    source_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hc_staff_credential_staff ON hc_staff_credential(staff_id);
CREATE INDEX IF NOT EXISTS idx_hc_staff_credential_expiring ON hc_staff_credential(expiration_date)
    WHERE expiration_date IS NOT NULL AND verification_status = 'VERIFIED';

-- Staff licenses (state-specific)
CREATE TABLE IF NOT EXISTS hc_staff_license (
    staff_license_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES hc_staff(staff_id) ON DELETE CASCADE,
    license_type_id UUID NOT NULL REFERENCES ref_license_type(license_type_id),
    license_number VARCHAR(100) NOT NULL,
    state VARCHAR(2) NOT NULL,
    issued_date DATE,
    expiration_date DATE,
    status VARCHAR(50), -- ACTIVE, INACTIVE, EXPIRED, SUSPENDED, REVOKED
    compact_license BOOLEAN DEFAULT false, -- Nurse Licensure Compact, etc.
    verification_status VARCHAR(50),
    verification_date DATE,
    verified_by UUID REFERENCES hc_staff(staff_id),
    primary_source_verified BOOLEAN DEFAULT false,
    document_url VARCHAR(500),
    notes TEXT,
    source_system VARCHAR(100),
    source_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hc_staff_license_staff ON hc_staff_license(staff_id);
CREATE INDEX IF NOT EXISTS idx_hc_staff_license_state ON hc_staff_license(state);
CREATE INDEX IF NOT EXISTS idx_hc_staff_license_number ON hc_staff_license(license_number, state);
CREATE INDEX IF NOT EXISTS idx_hc_staff_license_expiring ON hc_staff_license(expiration_date)
    WHERE status = 'ACTIVE';

-- Board certifications (medical specialties)
CREATE TABLE IF NOT EXISTS hc_staff_board_certification (
    board_cert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES hc_staff(staff_id) ON DELETE CASCADE,
    board_name VARCHAR(255) NOT NULL, -- ABIM, ABFM, ABS, etc.
    specialty VARCHAR(255) NOT NULL,
    subspecialty VARCHAR(255),
    certificate_number VARCHAR(100),
    initial_certification_date DATE,
    expiration_date DATE,
    moc_status VARCHAR(50), -- Maintenance of Certification status
    status VARCHAR(50), -- ACTIVE, EXPIRED, REVOKED
    verification_status VARCHAR(50),
    verification_date DATE,
    document_url VARCHAR(500),
    source_system VARCHAR(100),
    source_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hc_staff_board_cert_staff ON hc_staff_board_certification(staff_id);
CREATE INDEX IF NOT EXISTS idx_hc_staff_board_cert_specialty ON hc_staff_board_certification(specialty);


-- ============================================================================
-- SECTION 7: PRIVILEGING (for credentialed providers)
-- ============================================================================

-- Clinical privileges granted at facilities
CREATE TABLE IF NOT EXISTS hc_staff_privilege (
    privilege_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES hc_staff(staff_id) ON DELETE CASCADE,
    facility_id UUID NOT NULL REFERENCES hc_facility(facility_id),
    privilege_category VARCHAR(100) NOT NULL, -- ADMITTING, SURGICAL, PROCEDURAL, CONSULTING
    privilege_name VARCHAR(255) NOT NULL,
    privilege_code VARCHAR(50),
    privilege_level VARCHAR(50), -- FULL, LIMITED, SUPERVISED, PROCTORED
    status VARCHAR(50), -- APPROVED, PENDING, DENIED, SUSPENDED, EXPIRED
    effective_date DATE,
    expiration_date DATE,
    approved_by UUID REFERENCES hc_staff(staff_id),
    approval_date DATE,
    conditions TEXT, -- Any conditions on the privilege
    proctoring_required BOOLEAN DEFAULT false,
    proctor_staff_id UUID REFERENCES hc_staff(staff_id),
    cases_required INT, -- Number of proctored cases if applicable
    cases_completed INT,
    source_system VARCHAR(100),
    source_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hc_staff_privilege_staff ON hc_staff_privilege(staff_id);
CREATE INDEX IF NOT EXISTS idx_hc_staff_privilege_facility ON hc_staff_privilege(facility_id);
CREATE INDEX IF NOT EXISTS idx_hc_staff_privilege_status ON hc_staff_privilege(status);
CREATE INDEX IF NOT EXISTS idx_hc_staff_privilege_expiring ON hc_staff_privilege(expiration_date)
    WHERE status = 'APPROVED';


-- ============================================================================
-- SECTION 8: SUPERVISOR/REPORTING RELATIONSHIPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS hc_staff_reporting (
    reporting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES hc_staff(staff_id) ON DELETE CASCADE,
    supervisor_id UUID NOT NULL REFERENCES hc_staff(staff_id),
    relationship_type VARCHAR(50) NOT NULL, -- DIRECT_REPORT, CLINICAL_SUPERVISOR, ADMINISTRATIVE
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    source_system VARCHAR(100),
    source_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hc_staff_reporting_staff ON hc_staff_reporting(staff_id);
CREATE INDEX IF NOT EXISTS idx_hc_staff_reporting_supervisor ON hc_staff_reporting(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_hc_staff_reporting_active ON hc_staff_reporting(staff_id) WHERE end_date IS NULL;


-- ============================================================================
-- SECTION 9: PROVIDER GROUP AFFILIATIONS
-- ============================================================================

-- For tracking group practice affiliations
CREATE TABLE IF NOT EXISTS hc_provider_group (
    group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES hc_organization(organization_id),
    group_name VARCHAR(255) NOT NULL,
    group_npi VARCHAR(10),
    tax_id VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    source_system VARCHAR(100),
    source_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hc_staff_group_affiliation (
    affiliation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES hc_staff(staff_id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES hc_provider_group(group_id),
    affiliation_type VARCHAR(50), -- MEMBER, PARTNER, EMPLOYEE, CONTRACTOR
    effective_date DATE,
    end_date DATE,
    is_primary BOOLEAN DEFAULT false,
    source_system VARCHAR(100),
    source_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hc_staff_group_staff ON hc_staff_group_affiliation(staff_id);
CREATE INDEX IF NOT EXISTS idx_hc_staff_group_group ON hc_staff_group_affiliation(group_id);


-- ============================================================================
-- SECTION 10: EHR/EMR SYSTEM USER MAPPINGS
-- ============================================================================

-- Maps staff to their accounts in various EHR systems
CREATE TABLE IF NOT EXISTS hc_staff_ehr_mapping (
    mapping_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES hc_staff(staff_id) ON DELETE CASCADE,
    ehr_system VARCHAR(100) NOT NULL, -- EPIC, CERNER, MEDITECH, ATHENA, etc.
    ehr_user_id VARCHAR(255) NOT NULL,
    ehr_provider_id VARCHAR(255), -- Provider ID if different from user ID
    ehr_login VARCHAR(255),
    ehr_department_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(staff_id, ehr_system)
);

CREATE INDEX IF NOT EXISTS idx_hc_staff_ehr_mapping_staff ON hc_staff_ehr_mapping(staff_id);
CREATE INDEX IF NOT EXISTS idx_hc_staff_ehr_mapping_system ON hc_staff_ehr_mapping(ehr_system, ehr_user_id);


-- ============================================================================
-- SECTION 11: MIGRATION TRACKING & AUDIT
-- ============================================================================

-- Migration batch runs
CREATE TABLE IF NOT EXISTS hc_migration_batch (
    batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES hc_organization(organization_id),
    source_system VARCHAR(100) NOT NULL,
    source_file_name VARCHAR(255),
    source_file_hash VARCHAR(64), -- SHA-256 of source file
    record_count INT,
    success_count INT DEFAULT 0,
    error_count INT DEFAULT 0,
    warning_count INT DEFAULT 0,
    status VARCHAR(50) NOT NULL, -- PENDING, PROCESSING, COMPLETED, FAILED
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    started_by UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration errors and warnings
CREATE TABLE IF NOT EXISTS hc_migration_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES hc_migration_batch(batch_id),
    source_row_number INT,
    source_record_id VARCHAR(255),
    table_name VARCHAR(100),
    field_name VARCHAR(100),
    severity VARCHAR(20) NOT NULL, -- ERROR, WARNING, INFO
    error_code VARCHAR(50),
    message TEXT NOT NULL,
    source_value TEXT,
    suggested_fix TEXT,
    is_resolved BOOLEAN DEFAULT false,
    resolved_by UUID,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hc_migration_log_batch ON hc_migration_log(batch_id);
CREATE INDEX IF NOT EXISTS idx_hc_migration_log_severity ON hc_migration_log(batch_id, severity);
CREATE INDEX IF NOT EXISTS idx_hc_migration_log_unresolved ON hc_migration_log(batch_id) WHERE NOT is_resolved;

-- General audit trail for workforce tables
CREATE TABLE IF NOT EXISTS hc_audit_log (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    changed_by UUID,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address VARCHAR(50),
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_hc_audit_log_table ON hc_audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_hc_audit_log_time ON hc_audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_hc_audit_log_user ON hc_audit_log(changed_by);


-- ============================================================================
-- SECTION 12: HELPER VIEWS
-- ============================================================================

-- Active staff with their primary role
CREATE OR REPLACE VIEW vw_hc_active_staff AS
SELECT
    s.staff_id,
    s.organization_id,
    s.employee_id,
    s.first_name,
    s.middle_name,
    s.last_name,
    s.suffix,
    s.preferred_name,
    CONCAT(s.last_name, ', ', s.first_name, COALESCE(' ' || s.middle_name, ''), COALESCE(' ' || s.suffix, '')) AS full_name_formal,
    CONCAT(COALESCE(s.preferred_name, s.first_name), ' ', s.last_name) AS full_name_display,
    s.email,
    s.phone_work,
    s.phone_mobile,
    s.npi,
    s.dea_number,
    s.hire_date,
    s.employment_status,
    s.employment_type,
    rt.role_code AS primary_role_code,
    rt.role_name AS primary_role_name,
    rt.role_abbreviation AS primary_role_abbrev,
    sc.category_name AS primary_category,
    sc.is_clinical,
    rt.is_prescriber,
    rt.can_admit_patients,
    rt.can_order,
    d.department_name AS primary_department,
    f.facility_name AS primary_facility
FROM hc_staff s
LEFT JOIN ref_role_type rt ON s.primary_role_type_id = rt.role_type_id
LEFT JOIN ref_staff_category sc ON rt.category_id = sc.category_id
LEFT JOIN hc_department d ON s.primary_department_id = d.department_id
LEFT JOIN hc_facility f ON s.primary_facility_id = f.facility_id
WHERE s.is_active = true
  AND s.employment_status IN ('ACTIVE', 'LOA');

-- Expiring credentials view (next 90 days)
CREATE OR REPLACE VIEW vw_hc_expiring_credentials AS
SELECT
    s.staff_id,
    s.employee_id,
    CONCAT(s.last_name, ', ', s.first_name) AS staff_name,
    s.email,
    'LICENSE' AS credential_type,
    lt.license_name AS credential_name,
    sl.license_number AS credential_number,
    sl.state,
    sl.expiration_date,
    sl.expiration_date - CURRENT_DATE AS days_until_expiration
FROM hc_staff s
JOIN hc_staff_license sl ON s.staff_id = sl.staff_id
JOIN ref_license_type lt ON sl.license_type_id = lt.license_type_id
WHERE sl.status = 'ACTIVE'
  AND sl.expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
  AND s.is_active = true

UNION ALL

SELECT
    s.staff_id,
    s.employee_id,
    CONCAT(s.last_name, ', ', s.first_name) AS staff_name,
    s.email,
    'CERTIFICATION' AS credential_type,
    ct.credential_name,
    sc.credential_number,
    NULL AS state,
    sc.expiration_date,
    sc.expiration_date - CURRENT_DATE AS days_until_expiration
FROM hc_staff s
JOIN hc_staff_credential sc ON s.staff_id = sc.staff_id
JOIN ref_credential_type ct ON sc.credential_type_id = ct.credential_type_id
WHERE sc.verification_status = 'VERIFIED'
  AND sc.expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
  AND s.is_active = true

UNION ALL

SELECT
    s.staff_id,
    s.employee_id,
    CONCAT(s.last_name, ', ', s.first_name) AS staff_name,
    s.email,
    'BOARD_CERTIFICATION' AS credential_type,
    CONCAT(sbc.board_name, ' - ', sbc.specialty) AS credential_name,
    sbc.certificate_number AS credential_number,
    NULL AS state,
    sbc.expiration_date,
    sbc.expiration_date - CURRENT_DATE AS days_until_expiration
FROM hc_staff s
JOIN hc_staff_board_certification sbc ON s.staff_id = sbc.staff_id
WHERE sbc.status = 'ACTIVE'
  AND sbc.expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
  AND s.is_active = true

ORDER BY days_until_expiration;


-- ============================================================================
-- SECTION 13: FHIR R4 MAPPING SUPPORT
-- ============================================================================

-- Maps internal IDs to FHIR resource IDs
CREATE TABLE IF NOT EXISTS hc_fhir_resource_mapping (
    mapping_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    internal_table VARCHAR(100) NOT NULL,
    internal_id UUID NOT NULL,
    fhir_resource_type VARCHAR(100) NOT NULL, -- Practitioner, PractitionerRole, Organization, Location
    fhir_resource_id VARCHAR(255) NOT NULL,
    fhir_server_url VARCHAR(500),
    last_sync_at TIMESTAMPTZ,
    sync_status VARCHAR(50), -- SYNCED, PENDING, ERROR
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(internal_table, internal_id, fhir_resource_type)
);

CREATE INDEX IF NOT EXISTS idx_hc_fhir_mapping_internal ON hc_fhir_resource_mapping(internal_table, internal_id);
CREATE INDEX IF NOT EXISTS idx_hc_fhir_mapping_fhir ON hc_fhir_resource_mapping(fhir_resource_type, fhir_resource_id);


-- ============================================================================
-- SECTION 14: ROW-LEVEL SECURITY (for multi-tenant)
-- ============================================================================

-- Enable RLS on key tables
ALTER TABLE hc_organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE hc_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE hc_department ENABLE ROW LEVEL SECURITY;
ALTER TABLE hc_facility ENABLE ROW LEVEL SECURITY;
ALTER TABLE hc_staff_role ENABLE ROW LEVEL SECURITY;
ALTER TABLE hc_staff_credential ENABLE ROW LEVEL SECURITY;
ALTER TABLE hc_staff_license ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see data from their organization
-- Organization policies
CREATE POLICY hc_organization_tenant_isolation ON hc_organization
    FOR ALL USING (
        tenant_id IN (
            SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid()
        )
    );

-- Staff policies - access through organization
CREATE POLICY hc_staff_org_isolation ON hc_staff
    FOR ALL USING (
        organization_id IN (
            SELECT o.organization_id FROM hc_organization o
            JOIN profiles p ON o.tenant_id = p.tenant_id
            WHERE p.user_id = auth.uid()
        )
    );

-- Department policies
CREATE POLICY hc_department_org_isolation ON hc_department
    FOR ALL USING (
        organization_id IN (
            SELECT o.organization_id FROM hc_organization o
            JOIN profiles p ON o.tenant_id = p.tenant_id
            WHERE p.user_id = auth.uid()
        )
    );

-- Facility policies
CREATE POLICY hc_facility_org_isolation ON hc_facility
    FOR ALL USING (
        organization_id IN (
            SELECT o.organization_id FROM hc_organization o
            JOIN profiles p ON o.tenant_id = p.tenant_id
            WHERE p.user_id = auth.uid()
        )
    );

-- Staff role policies
CREATE POLICY hc_staff_role_org_isolation ON hc_staff_role
    FOR ALL USING (
        staff_id IN (
            SELECT s.staff_id FROM hc_staff s
            JOIN hc_organization o ON s.organization_id = o.organization_id
            JOIN profiles p ON o.tenant_id = p.tenant_id
            WHERE p.user_id = auth.uid()
        )
    );

-- Credential policies
CREATE POLICY hc_staff_credential_org_isolation ON hc_staff_credential
    FOR ALL USING (
        staff_id IN (
            SELECT s.staff_id FROM hc_staff s
            JOIN hc_organization o ON s.organization_id = o.organization_id
            JOIN profiles p ON o.tenant_id = p.tenant_id
            WHERE p.user_id = auth.uid()
        )
    );

-- License policies
CREATE POLICY hc_staff_license_org_isolation ON hc_staff_license
    FOR ALL USING (
        staff_id IN (
            SELECT s.staff_id FROM hc_staff s
            JOIN hc_organization o ON s.organization_id = o.organization_id
            JOIN profiles p ON o.tenant_id = p.tenant_id
            WHERE p.user_id = auth.uid()
        )
    );


-- ============================================================================
-- SECTION 15: USEFUL FUNCTIONS
-- ============================================================================

-- Function to get a staff member's active credentials as a display string
CREATE OR REPLACE FUNCTION get_hc_staff_credentials_display(p_staff_id UUID)
RETURNS TEXT AS $$
DECLARE
    creds TEXT;
BEGIN
    SELECT STRING_AGG(DISTINCT ct.credential_code, ', ' ORDER BY ct.credential_code)
    INTO creds
    FROM hc_staff_credential sc
    JOIN ref_credential_type ct ON sc.credential_type_id = ct.credential_type_id
    WHERE sc.staff_id = p_staff_id
      AND (sc.expiration_date IS NULL OR sc.expiration_date > CURRENT_DATE)
      AND sc.verification_status = 'VERIFIED';

    RETURN creds;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a staff member has an active license in a state
CREATE OR REPLACE FUNCTION has_hc_active_license(p_staff_id UUID, p_state VARCHAR(2))
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM hc_staff_license
        WHERE staff_id = p_staff_id
          AND state = p_state
          AND status = 'ACTIVE'
          AND (expiration_date IS NULL OR expiration_date > CURRENT_DATE)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate NPI (basic Luhn check)
CREATE OR REPLACE FUNCTION validate_hc_npi(p_npi VARCHAR(10))
RETURNS BOOLEAN AS $$
DECLARE
    npi_with_prefix VARCHAR(15);
    sum INT := 0;
    digit INT;
    i INT;
    doubled INT;
BEGIN
    -- NPI must be 10 digits
    IF p_npi IS NULL OR LENGTH(p_npi) != 10 OR p_npi !~ '^\d{10}$' THEN
        RETURN FALSE;
    END IF;

    -- Prefix with 80840 for Luhn validation
    npi_with_prefix := '80840' || p_npi;

    -- Luhn algorithm
    FOR i IN REVERSE 15..1 LOOP
        digit := CAST(SUBSTR(npi_with_prefix, i, 1) AS INT);
        IF (15 - i) % 2 = 0 THEN
            doubled := digit * 2;
            IF doubled > 9 THEN
                doubled := doubled - 9;
            END IF;
            sum := sum + doubled;
        ELSE
            sum := sum + digit;
        END IF;
    END LOOP;

    RETURN (sum % 10 = 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_hc_staff_credentials_display(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION has_hc_active_license(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_hc_npi(VARCHAR) TO authenticated;

-- Grant permissions on views
GRANT SELECT ON vw_hc_active_staff TO authenticated;
GRANT SELECT ON vw_hc_expiring_credentials TO authenticated;


-- ============================================================================
-- MIGRATION NOTES FOR CLAUDE CODE / GUARDIAN AGENT
-- ============================================================================
/*
MIGRATION FIELD MAPPING GUIDE:

EPIC MAPPINGS:
- Epic Provider ID → hc_staff.source_id (source_system = 'EPIC')
- Epic User ID → hc_staff_ehr_mapping.ehr_user_id
- Epic Department ID → hc_department.source_id
- PROV_TYPE → ref_role_type (lookup by role_code)
- NPI → hc_staff.npi
- DEA → hc_staff.dea_number
- STATE_LIC_NUM → hc_staff_license.license_number

CERNER MAPPINGS:
- Cerner Personnel ID → hc_staff.source_id (source_system = 'CERNER')
- Cerner Position → ref_role_type (lookup by role_name)
- Facility Alias → hc_facility.source_id

EXCEL COMMON COLUMNS:
- "Employee ID" / "EMP_ID" / "Staff ID" → hc_staff.employee_id
- "First Name" / "FIRST" / "FName" → hc_staff.first_name
- "Last Name" / "LAST" / "LName" → hc_staff.last_name
- "Title" / "Job Title" / "Position" → ref_role_type lookup
- "Department" / "Dept" → hc_department lookup
- "NPI" / "NPI Number" → hc_staff.npi (validate with validate_hc_npi function)
- "License" / "State License" → hc_staff_license
- "Hire Date" / "Start Date" → hc_staff.hire_date
- "Status" / "Employment Status" → hc_staff.employment_status

VALIDATION RULES:
1. NPI must pass Luhn check (use validate_hc_npi function)
2. Required fields: first_name, last_name, organization_id
3. If role requires NPI (is_prescriber = true), NPI should be present
4. License expiration dates should be validated
5. Email format validation
6. Phone number normalization to consistent format

DUPLICATE DETECTION:
1. Same NPI = definite duplicate
2. Same (first_name, last_name, date_of_birth) = likely duplicate
3. Same (email) = likely duplicate
4. Same (first_name, last_name, employee_id) at same org = duplicate
*/

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE ref_staff_category IS 'Top-level classification of healthcare staff roles (Physicians, Nursing, Allied Health, etc.)';
COMMENT ON TABLE ref_role_type IS 'Specific role types within categories with credentialing requirements';
COMMENT ON TABLE ref_credential_type IS 'Types of credentials including degrees, certifications, and board certifications';
COMMENT ON TABLE ref_license_type IS 'State-specific license types mapped to applicable roles';

COMMENT ON TABLE hc_organization IS 'Healthcare organizations for multi-tenant staff management';
COMMENT ON TABLE hc_department IS 'Departments within healthcare organizations';
COMMENT ON TABLE hc_facility IS 'Physical locations/facilities within organizations';
COMMENT ON TABLE hc_staff IS 'Core staff/personnel table for healthcare workers';

COMMENT ON TABLE hc_staff_role IS 'Staff role assignments (many-to-many) with effective dates';
COMMENT ON TABLE hc_staff_credential IS 'Staff credentials including degrees and certifications';
COMMENT ON TABLE hc_staff_license IS 'State-specific licenses with verification tracking';
COMMENT ON TABLE hc_staff_board_certification IS 'Medical specialty board certifications';
COMMENT ON TABLE hc_staff_privilege IS 'Clinical privileges granted at specific facilities';

COMMENT ON TABLE hc_staff_reporting IS 'Supervisor/reporting relationships';
COMMENT ON TABLE hc_provider_group IS 'Provider group practice affiliations';
COMMENT ON TABLE hc_staff_group_affiliation IS 'Staff membership in provider groups';
COMMENT ON TABLE hc_staff_ehr_mapping IS 'Maps staff to EHR system accounts (Epic, Cerner, etc.)';

COMMENT ON TABLE hc_migration_batch IS 'Tracks bulk migration runs from source systems';
COMMENT ON TABLE hc_migration_log IS 'Migration errors, warnings, and resolution tracking';
COMMENT ON TABLE hc_audit_log IS 'Audit trail for workforce data changes';
COMMENT ON TABLE hc_fhir_resource_mapping IS 'Maps internal records to FHIR R4 resource IDs';

COMMENT ON FUNCTION validate_hc_npi IS 'Validates NPI using standard Luhn algorithm';
COMMENT ON FUNCTION get_hc_staff_credentials_display IS 'Returns comma-separated list of active credentials';
COMMENT ON FUNCTION has_hc_active_license IS 'Checks if staff has active license in specified state';
