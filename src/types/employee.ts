/**
 * Employee Profile Type Definitions
 *
 * This file defines types for the employee_profiles table and related structures.
 * The employee_profiles table extends the profiles table with employment-specific data.
 *
 * Architecture:
 *   profiles (all users) ──┬── employee_profiles (staff only - employment data)
 *                          └── fhir_practitioners (licensed providers - clinical credentials)
 */

// ============================================================================
// EMPLOYMENT ENUMS
// ============================================================================

/**
 * Employment type classifications
 */
export type EmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'temporary'
  | 'per_diem'
  | 'intern';

/**
 * Employment status values
 */
export type EmploymentStatus =
  | 'active'
  | 'on_leave'
  | 'terminated'
  | 'suspended'
  | 'pending_start';

/**
 * Default shift assignments
 */
export type ShiftType =
  | 'day'
  | 'evening'
  | 'night'
  | 'rotating'
  | 'flexible'
  | 'on_call';

/**
 * Background check status values
 */
export type BackgroundCheckStatus =
  | 'pending'
  | 'passed'
  | 'failed'
  | 'expired'
  | 'waived';

// ============================================================================
// DISPLAY NAMES
// ============================================================================

export const EMPLOYMENT_TYPE_DISPLAY: Record<EmploymentType, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  contract: 'Contract',
  temporary: 'Temporary',
  per_diem: 'Per Diem',
  intern: 'Intern',
};

export const EMPLOYMENT_STATUS_DISPLAY: Record<EmploymentStatus, string> = {
  active: 'Active',
  on_leave: 'On Leave',
  terminated: 'Terminated',
  suspended: 'Suspended',
  pending_start: 'Pending Start',
};

export const SHIFT_TYPE_DISPLAY: Record<ShiftType, string> = {
  day: 'Day Shift',
  evening: 'Evening Shift',
  night: 'Night Shift',
  rotating: 'Rotating',
  flexible: 'Flexible',
  on_call: 'On Call',
};

export const BACKGROUND_CHECK_STATUS_DISPLAY: Record<BackgroundCheckStatus, string> = {
  pending: 'Pending',
  passed: 'Passed',
  failed: 'Failed',
  expired: 'Expired',
  waived: 'Waived',
};

// ============================================================================
// EMPLOYEE PROFILE INTERFACE
// ============================================================================

/**
 * Employee profile database row type
 */
export interface EmployeeProfile {
  id: string;
  user_id: string;
  tenant_id: string;

  // Employment
  employee_number: string | null;
  job_title: string | null;
  employment_type: EmploymentType | null;
  hire_date: string | null; // ISO date string
  termination_date: string | null;
  employment_status: EmploymentStatus;

  // Organization
  department_id: string | null;
  manager_id: string | null;
  cost_center: string | null;

  // Contact
  office_location: string | null;
  desk_phone: string | null;
  phone_extension: string | null;
  work_email: string | null;

  // Scheduling
  default_shift: ShiftType | null;
  fte_percentage: number;
  max_weekly_hours: number | null;

  // Credentials/Compliance
  credentials_verified: boolean;
  credentials_verified_at: string | null;
  credentials_verified_by: string | null;
  background_check_date: string | null;
  background_check_status: BackgroundCheckStatus | null;
  last_compliance_training: string | null;
  hipaa_training_date: string | null;

  // Notes
  notes: string | null;

  // Audit
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

/**
 * Input type for creating a new employee profile
 */
export interface EmployeeProfileInsert {
  user_id: string;
  tenant_id: string;

  // Employment (all optional on create)
  employee_number?: string;
  job_title?: string;
  employment_type?: EmploymentType;
  hire_date?: string;
  termination_date?: string;
  employment_status?: EmploymentStatus;

  // Organization
  department_id?: string;
  manager_id?: string;
  cost_center?: string;

  // Contact
  office_location?: string;
  desk_phone?: string;
  phone_extension?: string;
  work_email?: string;

  // Scheduling
  default_shift?: ShiftType;
  fte_percentage?: number;
  max_weekly_hours?: number;

  // Credentials/Compliance
  credentials_verified?: boolean;
  credentials_verified_at?: string;
  credentials_verified_by?: string;
  background_check_date?: string;
  background_check_status?: BackgroundCheckStatus;
  last_compliance_training?: string;
  hipaa_training_date?: string;

  // Notes
  notes?: string;

  // Audit
  created_by?: string;
}

/**
 * Input type for updating an employee profile
 */
export type EmployeeProfileUpdate = Partial<Omit<EmployeeProfileInsert, 'user_id' | 'tenant_id'>>;

// ============================================================================
// EMPLOYEE DIRECTORY VIEW TYPE
// ============================================================================

/**
 * Employee directory view - unified view of employee data
 * Joins profiles + employee_profiles + fhir_practitioners + departments
 */
export interface EmployeeDirectoryEntry {
  // Core identity from profiles
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  personal_email: string | null;
  personal_phone: string | null;
  role: string | null;
  role_code: number | null;

  // Employment data
  employee_profile_id: string;
  employee_number: string | null;
  job_title: string | null;
  employment_type: EmploymentType | null;
  employment_status: EmploymentStatus;
  hire_date: string | null;
  termination_date: string | null;
  fte_percentage: number;
  default_shift: ShiftType | null;
  work_email: string | null;
  desk_phone: string | null;
  phone_extension: string | null;
  office_location: string | null;
  cost_center: string | null;

  // Department info
  department_id: string | null;
  department_code: string | null;
  department_name: string | null;
  department_floor: string | null;

  // Manager info
  manager_id: string | null;
  manager_name: string | null;
  manager_title: string | null;

  // Credentials/compliance
  credentials_verified: boolean;
  credentials_verified_at: string | null;
  background_check_date: string | null;
  background_check_status: BackgroundCheckStatus | null;
  last_compliance_training: string | null;
  hipaa_training_date: string | null;

  // Clinical credentials from fhir_practitioners (if applicable)
  npi: string | null;
  state_license_number: string | null;
  dea_number: string | null;
  specialties: string[] | null;
  qualifications: unknown | null; // JSONB

  // Tenant
  tenant_id: string;

  // Audit
  employee_profile_created_at: string;
  employee_profile_updated_at: string;
}

// ============================================================================
// DIRECT REPORTS TYPE
// ============================================================================

/**
 * Direct report summary returned by get_direct_reports function
 */
export interface DirectReport {
  user_id: string;
  full_name: string | null;
  job_title: string | null;
  department_name: string | null;
  employment_status: EmploymentStatus;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if an employee is currently active
 */
export function isActiveEmployee(employee: EmployeeProfile | EmployeeDirectoryEntry): boolean {
  return employee.employment_status === 'active';
}

/**
 * Check if an employee needs credential verification
 */
export function needsCredentialVerification(employee: EmployeeProfile | EmployeeDirectoryEntry): boolean {
  return !employee.credentials_verified;
}

/**
 * Check if an employee's background check has expired
 * Typically background checks expire after 1-3 years depending on policy
 */
export function isBackgroundCheckExpired(
  employee: EmployeeProfile | EmployeeDirectoryEntry,
  expirationYears: number = 2
): boolean {
  if (!employee.background_check_date) return true;
  if (employee.background_check_status === 'expired') return true;

  const checkDate = new Date(employee.background_check_date);
  const expirationDate = new Date(checkDate.getTime());
  expirationDate.setFullYear(expirationDate.getFullYear() + expirationYears);

  return new Date() > expirationDate;
}

/**
 * Check if an employee needs HIPAA training
 * HIPAA training is typically required annually
 */
export function needsHIPAATraining(employee: EmployeeProfile | EmployeeDirectoryEntry): boolean {
  if (!employee.hipaa_training_date) return true;

  const trainingDate = new Date(employee.hipaa_training_date);
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  return trainingDate < oneYearAgo;
}

/**
 * Calculate years of service based on hire date
 */
export function calculateYearsOfService(hireDate: string | null): number {
  if (!hireDate) return 0;

  const hire = new Date(hireDate);
  const now = new Date();
  const years = (now.getTime() - hire.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

  return Math.max(0, Math.floor(years * 10) / 10); // Round to 1 decimal place
}

/**
 * Get display-friendly employment status with color coding
 */
export function getEmploymentStatusColor(status: EmploymentStatus): string {
  switch (status) {
    case 'active':
      return 'green';
    case 'on_leave':
      return 'yellow';
    case 'pending_start':
      return 'blue';
    case 'suspended':
      return 'orange';
    case 'terminated':
      return 'red';
    default:
      return 'gray';
  }
}

// ============================================================================
// STAFF ROLE CODES (for filtering employees)
// ============================================================================

/**
 * Role codes that represent staff/employees (not patients or community members)
 * Used for filtering when creating/querying employee profiles
 */
export const STAFF_ROLE_CODES = [
  1,  // SUPER_ADMIN
  2,  // ADMIN
  3,  // NURSE
  5,  // PHYSICIAN
  7,  // STAFF
  8,  // NURSE_PRACTITIONER
  9,  // PHYSICIAN_ASSISTANT
  10, // CLINICAL_SUPERVISOR
  11, // DEPARTMENT_HEAD
  12, // PHYSICAL_THERAPIST
  14, // CASE_MANAGER
  15, // SOCIAL_WORKER
  17, // COMMUNITY_HEALTH_WORKER
  18, // CHW
  19, // IT_ADMIN
] as const;

/**
 * Check if a role code represents a staff member
 */
export function isStaffRoleCode(roleCode: number | null | undefined): boolean {
  if (roleCode == null) return false;
  // Convert to array and use indexOf for broader TypeScript compatibility
  const staffCodes: number[] = [1, 2, 3, 5, 7, 8, 9, 10, 11, 12, 14, 15, 17, 18, 19];
  return staffCodes.indexOf(roleCode) !== -1;
}
