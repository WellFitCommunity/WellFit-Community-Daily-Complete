/**
 * Hospital Workforce - Organization Structure & Core Staff
 *
 * Defines organization, department, facility, source system, employment,
 * core staff record, and staff role assignment types.
 */

import type { RoleTypeCode } from './staffCategories';

// ============================================================================
// SOURCE SYSTEMS & EMPLOYMENT
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

// ============================================================================
// ORGANIZATION STRUCTURE
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
// CORE STAFF TABLE
// ============================================================================

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
// STAFF ROLE ASSIGNMENTS
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
// VIEW TYPES
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
