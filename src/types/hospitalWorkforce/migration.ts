/**
 * Hospital Workforce - Migration Tracking, Audit, FHIR Mapping & Helpers
 *
 * Defines migration batch/log records, audit log types, FHIR resource mappings,
 * helper functions, and source system field mapping constants.
 */

import type {
  HCEmploymentStatus,
  HCActiveStaffView,
  HCStaff,
  SourceSystem,
} from './organization';
import type { LicenseStatus, PrivilegeStatus, VerificationStatus } from './credentialing';

// ============================================================================
// MIGRATION TRACKING
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

// ============================================================================
// AUDIT LOG
// ============================================================================

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
// FHIR MAPPING
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
// HELPER FUNCTIONS
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
// MIGRATION FIELD MAPPINGS (for reference)
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
