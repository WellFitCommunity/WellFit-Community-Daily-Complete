/**
 * Hospital Workforce - Staff Categories & Role Types
 *
 * Defines staff category codes, role type codes, credential categories,
 * and license type reference data for the hc_* schema.
 */

// ============================================================================
// STAFF CATEGORIES
// ============================================================================

/**
 * Top-level staff category codes
 */
export type StaffCategoryCode =
  | 'PHYSICIAN'
  | 'APP' // Advanced Practice Providers
  | 'NURSING'
  | 'ALLIED_HEALTH'
  | 'EMERGENCY'
  | 'SURGICAL'
  | 'BEHAVIORAL'
  | 'EXEC'
  | 'ADMIN'
  | 'REVENUE_CYCLE'
  | 'HIM' // Health Information Management
  | 'PATIENT_ACCESS'
  | 'SUPPORT'
  | 'IT'
  | 'QUALITY'
  | 'EDUCATION';

export const STAFF_CATEGORY_DISPLAY: Record<StaffCategoryCode, string> = {
  PHYSICIAN: 'Physicians',
  APP: 'Advanced Practice Providers',
  NURSING: 'Nursing',
  ALLIED_HEALTH: 'Allied Health',
  EMERGENCY: 'Emergency & Critical Care',
  SURGICAL: 'Surgical Services',
  BEHAVIORAL: 'Behavioral Health',
  EXEC: 'Executive Leadership',
  ADMIN: 'Administrative',
  REVENUE_CYCLE: 'Revenue Cycle',
  HIM: 'Health Information Management',
  PATIENT_ACCESS: 'Patient Access',
  SUPPORT: 'Support Services',
  IT: 'Information Technology',
  QUALITY: 'Quality & Compliance',
  EDUCATION: 'Education & Research',
};

/**
 * Staff category reference table row
 */
export interface RefStaffCategory {
  category_id: string;
  category_code: StaffCategoryCode;
  category_name: string;
  display_order: number;
  is_clinical: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// ROLE TYPE CODES
// ============================================================================

/**
 * Role type codes (comprehensive list from schema)
 */
export type RoleTypeCode =
  // Physicians
  | 'ATTENDING_PHYSICIAN'
  | 'RESIDENT'
  | 'FELLOW'
  | 'INTERN'
  | 'HOSPITALIST'
  | 'CONSULTING_PHYSICIAN'
  | 'MEDICAL_DIRECTOR'
  | 'CMO'
  | 'DEPARTMENT_CHIEF'
  // Advanced Practice Providers
  | 'NP'
  | 'PA'
  | 'CNM'
  | 'CRNA'
  // Nursing
  | 'RN'
  | 'LPN'
  | 'CHARGE_NURSE'
  | 'NURSE_MANAGER'
  | 'DON'
  | 'CNO'
  | 'CNS'
  | 'NURSE_EDUCATOR'
  | 'TRAVEL_NURSE'
  | 'PER_DIEM_NURSE'
  | 'CNA'
  | 'PCT'
  // Allied Health
  | 'PT'
  | 'PTA'
  | 'OT'
  | 'OTA'
  | 'SLP'
  | 'RT'
  | 'DIETITIAN'
  | 'SOCIAL_WORKER'
  | 'CASE_MANAGER'
  | 'PHARMACIST'
  | 'PHARM_TECH'
  | 'LAB_TECH'
  | 'MED_LAB_SCIENTIST'
  | 'RAD_TECH'
  | 'MRI_TECH'
  | 'CT_TECH'
  | 'ULTRASOUND_TECH'
  | 'NUC_MED_TECH'
  | 'PHLEBOTOMIST'
  | 'EKG_TECH'
  | 'SURG_TECH'
  | 'STERILE_PROC_TECH'
  // Emergency & Critical Care
  | 'EM_PHYSICIAN'
  | 'TRAUMA_SURGEON'
  | 'PARAMEDIC'
  | 'EMT'
  | 'FLIGHT_NURSE'
  | 'ICU_NURSE'
  | 'ER_NURSE'
  | 'TRIAGE_NURSE'
  // Surgical Services
  | 'SURGEON_GENERAL'
  | 'SURGEON_CARDIO'
  | 'SURGEON_NEURO'
  | 'SURGEON_ORTHO'
  | 'ANESTHESIOLOGIST'
  | 'ANES_ASSISTANT'
  | 'CIRCULATING_NURSE'
  | 'SCRUB_NURSE'
  | 'PACU_NURSE'
  | 'OR_MANAGER'
  // Behavioral Health
  | 'PSYCHIATRIST'
  | 'PSYCHOLOGIST'
  | 'PSYCH_NURSE'
  | 'MH_COUNSELOR'
  | 'SUBSTANCE_COUNSELOR'
  | 'BH_TECH'
  // Executive
  | 'CEO'
  | 'CFO'
  | 'COO'
  | 'CIO'
  | 'CISO'
  | 'CHRO'
  | 'CCO'
  | 'CQO'
  // Administrative
  | 'DEPT_MANAGER'
  | 'UNIT_MANAGER'
  | 'PRACTICE_MANAGER'
  | 'CLINIC_ADMIN'
  | 'OPS_DIRECTOR'
  // Revenue Cycle
  | 'MEDICAL_CODER'
  | 'MEDICAL_BILLER'
  | 'CHARGE_CAPTURE'
  | 'PRIOR_AUTH'
  | 'CLAIMS_ANALYST'
  | 'REV_CYCLE_MGR'
  | 'PATIENT_FIN_COUNSELOR'
  // HIM
  | 'HIM_MANAGER'
  | 'MED_RECORDS_TECH'
  | 'ROI_SPECIALIST'
  | 'TRANSCRIPTIONIST'
  | 'CDI_SPECIALIST'
  // Patient Access
  | 'PATIENT_ACCESS_REP'
  | 'REGISTRAR'
  | 'SCHEDULER'
  | 'ADMISSIONS_COORD'
  | 'INSURANCE_VERIFIER'
  // Support Services
  | 'UNIT_CLERK'
  | 'TRANSPORTER'
  | 'EVS'
  | 'FOOD_SERVICES'
  | 'SECURITY'
  | 'FACILITIES'
  | 'BIOMED_TECH'
  | 'SUPPLY_CHAIN'
  // IT/Informatics
  | 'HEALTH_IT'
  | 'CLINICAL_INFORMATICIST'
  | 'EHR_ANALYST'
  | 'INTERFACE_ANALYST'
  | 'HELP_DESK'
  | 'NETWORK_ADMIN'
  | 'SECURITY_ANALYST'
  // Quality & Compliance
  | 'QI_COORDINATOR'
  | 'INFECTION_PREVENT'
  | 'RISK_MANAGER'
  | 'COMPLIANCE_OFFICER'
  | 'PATIENT_SAFETY'
  | 'ACCREDITATION_COORD'
  | 'UR_SPECIALIST'
  // Education & Research
  | 'CLINICAL_EDUCATOR'
  | 'SIM_SPECIALIST'
  | 'RESEARCH_COORD'
  | 'PI'
  | 'IRB_COORDINATOR';

/**
 * Role type reference table row
 */
export interface RefRoleType {
  role_type_id: string;
  category_id: string;
  role_code: RoleTypeCode;
  role_name: string;
  role_abbreviation: string | null;
  requires_npi: boolean;
  requires_license: boolean;
  requires_dea: boolean;
  is_prescriber: boolean;
  can_admit_patients: boolean;
  can_order: boolean;
  typical_taxonomy_code: string | null; // NUCC Healthcare Provider Taxonomy
  created_at: string;
  updated_at: string;
}

// ============================================================================
// CREDENTIAL & LICENSE TYPE CODES
// ============================================================================

/**
 * Credential categories
 */
export type CredentialCategory = 'DEGREE' | 'CERTIFICATION' | 'SPECIALTY_BOARD';

/**
 * Common credential codes
 */
export type CredentialCode =
  // Degrees
  | 'MD'
  | 'DO'
  | 'MBBS'
  | 'PHD'
  | 'PSYD'
  | 'DNP'
  | 'DPT'
  | 'PHARMD'
  | 'MSN'
  | 'BSN'
  | 'ADN'
  | 'MPH'
  | 'MHA'
  | 'MBA'
  // Nursing Certifications
  | 'CCRN'
  | 'CEN'
  | 'CNOR'
  | 'OCN'
  | 'PCCN'
  | 'RNC_OB'
  // Medical Coding Certifications
  | 'CPC'
  | 'CCS'
  | 'RHIA'
  | 'RHIT'
  // Life Support Certifications
  | 'BLS'
  | 'ACLS'
  | 'PALS'
  | 'NRP'
  | 'TNCC';

/**
 * Credential type reference table row
 */
export interface RefCredentialType {
  credential_type_id: string;
  credential_code: string;
  credential_name: string;
  credential_category: CredentialCategory;
  issuing_body: string | null;
  requires_renewal: boolean;
  typical_renewal_years: number | null;
  created_at: string;
}

/**
 * License type codes
 */
export type LicenseCode =
  | 'MD_LICENSE'
  | 'RN_LICENSE'
  | 'LPN_LICENSE'
  | 'NP_LICENSE'
  | 'PA_LICENSE'
  | 'PHARM_LICENSE'
  | 'PT_LICENSE'
  | 'OT_LICENSE'
  | 'SLP_LICENSE'
  | 'RT_LICENSE'
  | 'SW_LICENSE'
  | 'PSYCH_LICENSE'
  | 'COUNSELOR_LICENSE'
  | 'EMT_CERT'
  | 'PARAMEDIC_CERT'
  | 'CNA_CERT';

/**
 * License type reference table row
 */
export interface RefLicenseType {
  license_type_id: string;
  license_code: LicenseCode;
  license_name: string;
  applicable_roles: RoleTypeCode[];
  state_specific: boolean;
  created_at: string;
}
