/**
 * Hospital Workforce Migration Type Definitions
 *
 * This file defines types for the hospital workforce migration schema (hc_* tables).
 * Supports migration from Epic, Cerner, Meditech, Allscripts, and legacy Excel imports.
 *
 * Architecture:
 *   hc_organization ──┬── hc_department (organizational units)
 *                     └── hc_facility (physical locations)
 *
 *   hc_staff ──┬── hc_staff_role (role assignments)
 *              ├── hc_staff_credential (degrees, certs)
 *              ├── hc_staff_license (state licenses)
 *              ├── hc_staff_board_certification (medical boards)
 *              ├── hc_staff_privilege (clinical privileges)
 *              ├── hc_staff_reporting (supervisor relationships)
 *              ├── hc_staff_group_affiliation (provider groups)
 *              └── hc_staff_ehr_mapping (EHR system accounts)
 *
 * Tables are prefixed with 'hc_' (healthcare) to avoid conflicts with existing FHIR tables.
 */

// ============================================================================
// SECTION 1: STAFF CATEGORIES & ROLE TYPES
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
// SECTION 2: CREDENTIAL & LICENSE TYPES
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

// ============================================================================
// SECTION 3: ORGANIZATION STRUCTURE
// ============================================================================

/**
 * Organization types
 */
export type OrganizationType =
  | 'HOSPITAL'
  | 'CLINIC'
  | 'PRACTICE'
  | 'HEALTH_SYSTEM'
  | 'NURSING_HOME';

/**
 * Healthcare organization
 */
export interface HCOrganization {
  organization_id: string;
  tenant_id: string;
  organization_name: string;
  organization_type: OrganizationType;
  parent_organization_id: string | null;
  npi: string | null; // Organizational NPI (Type 2)
  tax_id: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  fax: string | null;
  website: string | null;
  cms_certification_number: string | null; // CCN for Medicare
  is_active: boolean;
  source_system: SourceSystem | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

export type HCOrganizationInsert = Omit<
  HCOrganization,
  'organization_id' | 'created_at' | 'updated_at'
>;
export type HCOrganizationUpdate = Partial<
  Omit<HCOrganizationInsert, 'tenant_id'>
>;

/**
 * Department types
 */
export type DepartmentType = 'CLINICAL' | 'ADMINISTRATIVE' | 'SUPPORT';

/**
 * Department within an organization
 */
export interface HCDepartment {
  department_id: string;
  organization_id: string;
  department_code: string;
  department_name: string;
  department_type: DepartmentType | null;
  parent_department_id: string | null;
  cost_center: string | null;
  location: string | null;
  phone: string | null;
  fax: string | null;
  is_active: boolean;
  source_system: SourceSystem | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

export type HCDepartmentInsert = Omit<
  HCDepartment,
  'department_id' | 'created_at' | 'updated_at'
>;
export type HCDepartmentUpdate = Partial<
  Omit<HCDepartmentInsert, 'organization_id'>
>;

/**
 * Facility types (prefixed with HC to avoid conflicts with facility.ts)
 */
export type HCFacilityType =
  | 'MAIN_CAMPUS'
  | 'SATELLITE'
  | 'CLINIC'
  | 'ASC' // Ambulatory Surgery Center
  | 'URGENT_CARE';

/**
 * Physical facility/location
 */
export interface HCFacility {
  facility_id: string;
  organization_id: string;
  facility_code: string;
  facility_name: string;
  facility_type: HCFacilityType | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  fax: string | null;
  is_active: boolean;
  source_system: SourceSystem | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

export type HCFacilityInsert = Omit<
  HCFacility,
  'facility_id' | 'created_at' | 'updated_at'
>;
export type HCFacilityUpdate = Partial<
  Omit<HCFacilityInsert, 'organization_id'>
>;

// ============================================================================
// SECTION 4: CORE STAFF TABLE
// ============================================================================

/**
 * Source systems for migration
 */
export type SourceSystem =
  | 'EPIC'
  | 'CERNER'
  | 'MEDITECH'
  | 'ALLSCRIPTS'
  | 'ATHENA'
  | 'EXCEL'
  | 'MANUAL';

/**
 * Employment status values
 */
export type HCEmploymentStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'TERMINATED'
  | 'LOA' // Leave of Absence
  | 'RETIRED';

export const HC_EMPLOYMENT_STATUS_DISPLAY: Record<HCEmploymentStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  TERMINATED: 'Terminated',
  LOA: 'Leave of Absence',
  RETIRED: 'Retired',
};

/**
 * Employment type values
 */
export type HCEmploymentType =
  | 'FULL_TIME'
  | 'PART_TIME'
  | 'PRN' // As needed
  | 'CONTRACT'
  | 'LOCUM' // Temporary physician fill-in
  | 'TRAVEL';

export const HC_EMPLOYMENT_TYPE_DISPLAY: Record<HCEmploymentType, string> = {
  FULL_TIME: 'Full Time',
  PART_TIME: 'Part Time',
  PRN: 'PRN (As Needed)',
  CONTRACT: 'Contract',
  LOCUM: 'Locum Tenens',
  TRAVEL: 'Travel',
};

/**
 * Migration status values
 */
export type MigrationStatus =
  | 'PENDING'
  | 'VALIDATED'
  | 'IMPORTED'
  | 'ERROR';

/**
 * Core staff/personnel record
 */
export interface HCStaff {
  staff_id: string;
  organization_id: string;

  // Core identity
  employee_id: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  preferred_name: string | null;
  former_names: string[] | null;

  // Demographics
  date_of_birth: string | null; // ISO date
  gender: string | null;

  // Contact
  email: string | null;
  phone_work: string | null;
  phone_mobile: string | null;
  phone_home: string | null;

  // Address
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;

  // Employment
  hire_date: string | null; // ISO date
  termination_date: string | null;
  employment_status: HCEmploymentStatus | null;
  employment_type: HCEmploymentType | null;

  // Clinical identifiers
  npi: string | null;
  dea_number: string | null;
  upin: string | null; // Legacy identifier
  medicare_ptan: string | null; // Provider Transaction Access Number
  medicaid_id: string | null;

  // Primary role (for quick filtering)
  primary_role_type_id: string | null;
  primary_department_id: string | null;
  primary_facility_id: string | null;

  // User account linkage
  user_account_id: string | null;

  // Migration tracking
  source_system: SourceSystem | null;
  source_id: string | null;
  source_data: Record<string, unknown> | null; // Raw source record
  migration_batch_id: string | null;
  migration_status: MigrationStatus | null;
  migration_notes: string | null;

  // Audit
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export type HCStaffInsert = Omit<
  HCStaff,
  'staff_id' | 'created_at' | 'updated_at'
>;
export type HCStaffUpdate = Partial<Omit<HCStaffInsert, 'organization_id'>>;

// ============================================================================
// SECTION 5: STAFF ROLE ASSIGNMENTS
// ============================================================================

/**
 * Staff role assignment (many-to-many)
 */
export interface HCStaffRole {
  staff_role_id: string;
  staff_id: string;
  role_type_id: string;
  department_id: string | null;
  facility_id: string | null;
  is_primary: boolean;
  effective_date: string; // ISO date
  end_date: string | null;
  fte: number | null; // Full-time equivalent (0.00 to 1.00+)
  source_system: SourceSystem | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

export type HCStaffRoleInsert = Omit<
  HCStaffRole,
  'staff_role_id' | 'created_at' | 'updated_at'
>;
export type HCStaffRoleUpdate = Partial<Omit<HCStaffRoleInsert, 'staff_id'>>;

// ============================================================================
// SECTION 6: CREDENTIALS, LICENSES, AND CERTIFICATIONS
// ============================================================================

/**
 * Verification status values
 */
export type VerificationStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'EXPIRED'
  | 'REVOKED';

/**
 * Staff credential (degrees, certifications)
 */
export interface HCStaffCredential {
  staff_credential_id: string;
  staff_id: string;
  credential_type_id: string;
  credential_number: string | null;
  issued_date: string | null;
  expiration_date: string | null;
  issuing_institution: string | null;
  verification_status: VerificationStatus | null;
  verification_date: string | null;
  verified_by: string | null;
  document_url: string | null;
  notes: string | null;
  source_system: SourceSystem | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

export type HCStaffCredentialInsert = Omit<
  HCStaffCredential,
  'staff_credential_id' | 'created_at' | 'updated_at'
>;
export type HCStaffCredentialUpdate = Partial<
  Omit<HCStaffCredentialInsert, 'staff_id'>
>;

/**
 * License status values
 */
export type LicenseStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'REVOKED';

/**
 * Staff license (state-specific)
 */
export interface HCStaffLicense {
  staff_license_id: string;
  staff_id: string;
  license_type_id: string;
  license_number: string;
  state: string; // 2-letter state code
  issued_date: string | null;
  expiration_date: string | null;
  status: LicenseStatus | null;
  compact_license: boolean; // Nurse Licensure Compact, etc.
  verification_status: VerificationStatus | null;
  verification_date: string | null;
  verified_by: string | null;
  primary_source_verified: boolean;
  document_url: string | null;
  notes: string | null;
  source_system: SourceSystem | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

export type HCStaffLicenseInsert = Omit<
  HCStaffLicense,
  'staff_license_id' | 'created_at' | 'updated_at'
>;
export type HCStaffLicenseUpdate = Partial<
  Omit<HCStaffLicenseInsert, 'staff_id'>
>;

/**
 * Board certification status values
 */
export type BoardCertStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

/**
 * Staff board certification
 */
export interface HCStaffBoardCertification {
  board_cert_id: string;
  staff_id: string;
  board_name: string;
  specialty: string;
  subspecialty: string | null;
  certificate_number: string | null;
  initial_certification_date: string | null;
  expiration_date: string | null;
  moc_status: string | null; // Maintenance of Certification status
  status: BoardCertStatus | null;
  verification_status: VerificationStatus | null;
  verification_date: string | null;
  document_url: string | null;
  source_system: SourceSystem | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

export type HCStaffBoardCertificationInsert = Omit<
  HCStaffBoardCertification,
  'board_cert_id' | 'created_at' | 'updated_at'
>;
export type HCStaffBoardCertificationUpdate = Partial<
  Omit<HCStaffBoardCertificationInsert, 'staff_id'>
>;

// ============================================================================
// SECTION 7: PRIVILEGING
// ============================================================================

/**
 * Privilege categories
 */
export type PrivilegeCategory =
  | 'ADMITTING'
  | 'SURGICAL'
  | 'PROCEDURAL'
  | 'CONSULTING';

/**
 * Privilege levels
 */
export type PrivilegeLevel =
  | 'FULL'
  | 'LIMITED'
  | 'SUPERVISED'
  | 'PROCTORED';

/**
 * Privilege status values
 */
export type PrivilegeStatus =
  | 'APPROVED'
  | 'PENDING'
  | 'DENIED'
  | 'SUSPENDED'
  | 'EXPIRED';

/**
 * Clinical privilege at a facility
 */
export interface HCStaffPrivilege {
  privilege_id: string;
  staff_id: string;
  facility_id: string;
  privilege_category: PrivilegeCategory;
  privilege_name: string;
  privilege_code: string | null;
  privilege_level: PrivilegeLevel | null;
  status: PrivilegeStatus | null;
  effective_date: string | null;
  expiration_date: string | null;
  approved_by: string | null;
  approval_date: string | null;
  conditions: string | null;
  proctoring_required: boolean;
  proctor_staff_id: string | null;
  cases_required: number | null;
  cases_completed: number | null;
  source_system: SourceSystem | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

export type HCStaffPrivilegeInsert = Omit<
  HCStaffPrivilege,
  'privilege_id' | 'created_at' | 'updated_at'
>;
export type HCStaffPrivilegeUpdate = Partial<
  Omit<HCStaffPrivilegeInsert, 'staff_id' | 'facility_id'>
>;

// ============================================================================
// SECTION 8: SUPERVISOR/REPORTING RELATIONSHIPS
// ============================================================================

/**
 * Reporting relationship types
 */
export type ReportingRelationshipType =
  | 'DIRECT_REPORT'
  | 'CLINICAL_SUPERVISOR'
  | 'ADMINISTRATIVE';

/**
 * Staff reporting relationship
 */
export interface HCStaffReporting {
  reporting_id: string;
  staff_id: string;
  supervisor_id: string;
  relationship_type: ReportingRelationshipType;
  effective_date: string;
  end_date: string | null;
  source_system: SourceSystem | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

export type HCStaffReportingInsert = Omit<
  HCStaffReporting,
  'reporting_id' | 'created_at' | 'updated_at'
>;
export type HCStaffReportingUpdate = Partial<
  Omit<HCStaffReportingInsert, 'staff_id'>
>;

// ============================================================================
// SECTION 9: PROVIDER GROUP AFFILIATIONS
// ============================================================================

/**
 * Provider group
 */
export interface HCProviderGroup {
  group_id: string;
  organization_id: string;
  group_name: string;
  group_npi: string | null;
  tax_id: string | null;
  is_active: boolean;
  source_system: SourceSystem | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

export type HCProviderGroupInsert = Omit<
  HCProviderGroup,
  'group_id' | 'created_at' | 'updated_at'
>;
export type HCProviderGroupUpdate = Partial<
  Omit<HCProviderGroupInsert, 'organization_id'>
>;

/**
 * Affiliation types
 */
export type AffiliationType =
  | 'MEMBER'
  | 'PARTNER'
  | 'EMPLOYEE'
  | 'CONTRACTOR';

/**
 * Staff group affiliation
 */
export interface HCStaffGroupAffiliation {
  affiliation_id: string;
  staff_id: string;
  group_id: string;
  affiliation_type: AffiliationType | null;
  effective_date: string | null;
  end_date: string | null;
  is_primary: boolean;
  source_system: SourceSystem | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

export type HCStaffGroupAffiliationInsert = Omit<
  HCStaffGroupAffiliation,
  'affiliation_id' | 'created_at' | 'updated_at'
>;
export type HCStaffGroupAffiliationUpdate = Partial<
  Omit<HCStaffGroupAffiliationInsert, 'staff_id' | 'group_id'>
>;

// ============================================================================
// SECTION 10: EHR/EMR SYSTEM USER MAPPINGS
// ============================================================================

/**
 * EHR system types
 */
export type EHRSystem =
  | 'EPIC'
  | 'CERNER'
  | 'MEDITECH'
  | 'ATHENA'
  | 'ALLSCRIPTS'
  | 'NEXTGEN'
  | 'ECLINICALWORKS';

/**
 * Staff EHR system mapping
 */
export interface HCStaffEHRMapping {
  mapping_id: string;
  staff_id: string;
  ehr_system: EHRSystem;
  ehr_user_id: string;
  ehr_provider_id: string | null;
  ehr_login: string | null;
  ehr_department_id: string | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export type HCStaffEHRMappingInsert = Omit<
  HCStaffEHRMapping,
  'mapping_id' | 'created_at' | 'updated_at'
>;
export type HCStaffEHRMappingUpdate = Partial<
  Omit<HCStaffEHRMappingInsert, 'staff_id' | 'ehr_system'>
>;

// ============================================================================
// SECTION 11: MIGRATION TRACKING & AUDIT
// ============================================================================

/**
 * Migration batch status
 */
export type MigrationBatchStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED';

/**
 * Migration batch record
 */
export interface HCMigrationBatch {
  batch_id: string;
  organization_id: string;
  source_system: SourceSystem;
  source_file_name: string | null;
  source_file_hash: string | null; // SHA-256
  record_count: number | null;
  success_count: number;
  error_count: number;
  warning_count: number;
  status: MigrationBatchStatus;
  started_at: string | null;
  completed_at: string | null;
  started_by: string | null;
  notes: string | null;
  created_at: string;
}

export type HCMigrationBatchInsert = Omit<
  HCMigrationBatch,
  'batch_id' | 'created_at'
>;
export type HCMigrationBatchUpdate = Partial<
  Omit<HCMigrationBatchInsert, 'organization_id'>
>;

/**
 * Migration log severity
 */
export type MigrationLogSeverity = 'ERROR' | 'WARNING' | 'INFO';

/**
 * Migration log entry
 */
export interface HCMigrationLog {
  log_id: string;
  batch_id: string;
  source_row_number: number | null;
  source_record_id: string | null;
  table_name: string | null;
  field_name: string | null;
  severity: MigrationLogSeverity;
  error_code: string | null;
  message: string;
  source_value: string | null;
  suggested_fix: string | null;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export type HCMigrationLogInsert = Omit<
  HCMigrationLog,
  'log_id' | 'created_at'
>;
export type HCMigrationLogUpdate = Partial<Omit<HCMigrationLogInsert, 'batch_id'>>;

/**
 * Audit log action types
 */
export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

/**
 * Audit log entry
 */
export interface HCAuditLog {
  audit_id: string;
  table_name: string;
  record_id: string;
  action: AuditAction;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_fields: string[] | null;
  changed_by: string | null;
  changed_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

export type HCAuditLogInsert = Omit<HCAuditLog, 'audit_id' | 'changed_at'>;

// ============================================================================
// SECTION 12: FHIR MAPPING
// ============================================================================

/**
 * FHIR resource types for mapping
 */
export type FHIRResourceType =
  | 'Practitioner'
  | 'PractitionerRole'
  | 'Organization'
  | 'Location';

/**
 * FHIR sync status
 */
export type FHIRSyncStatus = 'SYNCED' | 'PENDING' | 'ERROR';

/**
 * FHIR resource mapping
 */
export interface HCFHIRResourceMapping {
  mapping_id: string;
  internal_table: string;
  internal_id: string;
  fhir_resource_type: FHIRResourceType;
  fhir_resource_id: string;
  fhir_server_url: string | null;
  last_sync_at: string | null;
  sync_status: FHIRSyncStatus | null;
  created_at: string;
  updated_at: string;
}

export type HCFHIRResourceMappingInsert = Omit<
  HCFHIRResourceMapping,
  'mapping_id' | 'created_at' | 'updated_at'
>;
export type HCFHIRResourceMappingUpdate = Partial<
  Omit<HCFHIRResourceMappingInsert, 'internal_table' | 'internal_id' | 'fhir_resource_type'>
>;

// ============================================================================
// SECTION 13: VIEW TYPES
// ============================================================================

/**
 * Active staff view row (from vw_hc_active_staff)
 */
export interface HCActiveStaffView {
  staff_id: string;
  organization_id: string;
  employee_id: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  preferred_name: string | null;
  full_name_formal: string;
  full_name_display: string;
  email: string | null;
  phone_work: string | null;
  phone_mobile: string | null;
  npi: string | null;
  dea_number: string | null;
  hire_date: string | null;
  employment_status: HCEmploymentStatus | null;
  employment_type: HCEmploymentType | null;
  primary_role_code: RoleTypeCode | null;
  primary_role_name: string | null;
  primary_role_abbrev: string | null;
  primary_category: string | null;
  is_clinical: boolean | null;
  is_prescriber: boolean | null;
  can_admit_patients: boolean | null;
  can_order: boolean | null;
  primary_department: string | null;
  primary_facility: string | null;
}

/**
 * Expiring credential view row (from vw_hc_expiring_credentials)
 */
export interface HCExpiringCredentialView {
  staff_id: string;
  employee_id: string | null;
  staff_name: string;
  email: string | null;
  credential_type: 'LICENSE' | 'CERTIFICATION' | 'BOARD_CERTIFICATION';
  credential_name: string;
  credential_number: string | null;
  state: string | null;
  expiration_date: string;
  days_until_expiration: number;
}

// ============================================================================
// SECTION 14: HELPER FUNCTIONS
// ============================================================================

/**
 * Check if staff is currently active
 */
export function isActiveStaff(staff: HCStaff | HCActiveStaffView): boolean {
  return (
    staff.employment_status === 'ACTIVE' ||
    staff.employment_status === 'LOA'
  );
}

/**
 * Check if staff is a clinical provider
 */
export function isClinicalProvider(staff: HCActiveStaffView): boolean {
  return staff.is_clinical === true;
}

/**
 * Check if staff can prescribe medications
 */
export function canPrescribe(staff: HCActiveStaffView): boolean {
  return staff.is_prescriber === true;
}

/**
 * Format staff name for display
 */
export function formatStaffName(staff: HCStaff): string {
  const name = staff.preferred_name || staff.first_name;
  return `${name} ${staff.last_name}${staff.suffix ? ` ${staff.suffix}` : ''}`;
}

/**
 * Format staff name formally (Last, First MI Suffix)
 */
export function formatStaffNameFormal(staff: HCStaff): string {
  const parts = [staff.last_name, staff.first_name];
  if (staff.middle_name) {
    parts.push(staff.middle_name);
  }
  if (staff.suffix) {
    parts.push(staff.suffix);
  }
  return parts.join(', ');
}

/**
 * Check if credential is expiring within N days
 */
export function isExpiringWithinDays(
  credential: { expiration_date: string | null },
  days: number
): boolean {
  if (!credential.expiration_date) return false;

  const expiration = new Date(credential.expiration_date);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + days);

  return expiration <= threshold && expiration > new Date();
}

/**
 * Check if credential is expired
 */
export function isExpired(credential: { expiration_date: string | null }): boolean {
  if (!credential.expiration_date) return false;
  return new Date(credential.expiration_date) < new Date();
}

/**
 * Validate NPI format (basic check - 10 digits)
 * Full Luhn validation is done server-side via validate_hc_npi function
 */
export function isValidNPIFormat(npi: string | null | undefined): boolean {
  if (!npi) return false;
  return /^\d{10}$/.test(npi);
}

/**
 * Get employment status badge color (prefixed with HC to avoid conflicts with employee.ts)
 */
export function getHCEmploymentStatusColor(status: HCEmploymentStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'green';
    case 'LOA':
      return 'yellow';
    case 'INACTIVE':
      return 'gray';
    case 'TERMINATED':
      return 'red';
    case 'RETIRED':
      return 'blue';
    default:
      return 'gray';
  }
}

/**
 * Get license status badge color
 */
export function getLicenseStatusColor(status: LicenseStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'green';
    case 'INACTIVE':
      return 'gray';
    case 'EXPIRED':
      return 'red';
    case 'SUSPENDED':
      return 'orange';
    case 'REVOKED':
      return 'red';
    default:
      return 'gray';
  }
}

/**
 * Get privilege status badge color
 */
export function getPrivilegeStatusColor(status: PrivilegeStatus): string {
  switch (status) {
    case 'APPROVED':
      return 'green';
    case 'PENDING':
      return 'yellow';
    case 'DENIED':
      return 'red';
    case 'SUSPENDED':
      return 'orange';
    case 'EXPIRED':
      return 'gray';
    default:
      return 'gray';
  }
}

/**
 * Get verification status badge color
 */
export function getVerificationStatusColor(status: VerificationStatus): string {
  switch (status) {
    case 'VERIFIED':
      return 'green';
    case 'PENDING':
      return 'yellow';
    case 'EXPIRED':
      return 'gray';
    case 'REVOKED':
      return 'red';
    default:
      return 'gray';
  }
}

// ============================================================================
// SECTION 15: MIGRATION FIELD MAPPINGS (for reference)
// ============================================================================

/**
 * Common field mappings from source systems
 * Used for documentation and migration tooling
 */
export const EPIC_FIELD_MAPPINGS = {
  'Epic Provider ID': 'source_id',
  'Epic User ID': 'hc_staff_ehr_mapping.ehr_user_id',
  'Epic Department ID': 'hc_department.source_id',
  'PROV_TYPE': 'ref_role_type.role_code',
  'NPI': 'hc_staff.npi',
  'DEA': 'hc_staff.dea_number',
  'STATE_LIC_NUM': 'hc_staff_license.license_number',
} as const;

export const CERNER_FIELD_MAPPINGS = {
  'Cerner Personnel ID': 'source_id',
  'Cerner Position': 'ref_role_type.role_name',
  'Facility Alias': 'hc_facility.source_id',
} as const;

export const EXCEL_COMMON_COLUMNS = {
  'Employee ID': 'employee_id',
  'EMP_ID': 'employee_id',
  'Staff ID': 'employee_id',
  'First Name': 'first_name',
  'FIRST': 'first_name',
  'FName': 'first_name',
  'Last Name': 'last_name',
  'LAST': 'last_name',
  'LName': 'last_name',
  'Title': 'ref_role_type',
  'Job Title': 'ref_role_type',
  'Position': 'ref_role_type',
  'Department': 'hc_department',
  'Dept': 'hc_department',
  'NPI': 'npi',
  'NPI Number': 'npi',
  'License': 'hc_staff_license',
  'State License': 'hc_staff_license',
  'Hire Date': 'hire_date',
  'Start Date': 'hire_date',
  'Status': 'employment_status',
  'Employment Status': 'employment_status',
} as const;
