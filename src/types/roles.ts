/**
 * Healthcare Role-Based Access Control (RBAC) Type Definitions
 *
 * This file defines all staff roles and permission structures for the WellFit Community platform.
 * Based on real-world healthcare organizational hierarchy and HIPAA compliance requirements.
 */

// ============================================================================
// STAFF ROLES
// ============================================================================

/**
 * All staff roles in the system
 * Ordered by hierarchy level (highest to lowest)
 */
export type StaffRole =
  | 'super_admin'         // Level 1: Platform administrators (Envision employees only)
  | 'it_admin'            // Level 2: Tenant IT administrators (technical ops for their org)
  | 'department_head'     // Level 2: Executive leadership (CNO, CMO)
  | 'clinical_supervisor' // Level 3: Operational managers (Nurse Managers)
  | 'nurse_practitioner'  // Level 4: Advanced practice (independent)
  | 'physician_assistant' // Level 4: Advanced practice (collaborative)
  | 'physician'           // Level 5: Attending physicians
  | 'doctor'              // Level 5: Synonym for physician
  | 'nurse'                    // Level 5: RNs, LPNs
  | 'case_manager'             // Level 5: Care coordination and discharge planning
  | 'social_worker'            // Level 5: Psychosocial services and community resources
  | 'community_health_worker'  // Level 5: CHW field workers
  | 'chw'                      // Level 5: Synonym for community_health_worker
  | 'physical_therapist'       // Level 6: Allied health (future)
  | 'pt'                       // Level 6: Synonym for physical_therapist
  | 'quality_manager'          // Level 6: Quality assurance and compliance
  | 'admin';                   // Level 7: Administrative staff

/**
 * Legacy admin roles (for backwards compatibility)
 */
export type AdminRole = 'admin' | 'super_admin';

/**
 * All user roles including community members
 */
export type UserRole =
  | StaffRole
  | 'patient'   // Care recipients (all ages) - FHIR-aligned
  | 'senior'    // DEPRECATED: Use 'patient' + age demographics instead
  | 'volunteer' // Community volunteers
  | 'caregiver' // Family caregivers (separate from staff)
  | 'staff';    // General staff

// ============================================================================
// DEPARTMENT TYPES
// ============================================================================

/**
 * Department categorization for scoped access control
 * Used primarily by department_head role
 */
export type Department =
  | 'nursing'        // Nursing department
  | 'medical'        // Physician/medical department
  | 'therapy'        // Physical therapy, occupational therapy
  | 'administration' // Administrative department
  | null;            // null = all departments (super_admin only)

// ============================================================================
// ROLE CODES
// ============================================================================

/**
 * Numeric role codes for database storage and legacy compatibility
 */
export enum RoleCode {
  SUPER_ADMIN = 1,
  ADMIN = 2,
  NURSE = 3,
  SENIOR = 4,  // DEPRECATED: Use PATIENT instead
  PHYSICIAN = 5,
  VOLUNTEER = 6,
  STAFF = 7,
  NURSE_PRACTITIONER = 8,
  PHYSICIAN_ASSISTANT = 9,
  CLINICAL_SUPERVISOR = 10,
  DEPARTMENT_HEAD = 11,
  PHYSICAL_THERAPIST = 12,
  CAREGIVER = 13,  // Unique code for caregiver (family caregivers, not volunteers)
  CASE_MANAGER = 14,  // Care coordination and discharge planning
  SOCIAL_WORKER = 15,  // Psychosocial services and community resources
  PATIENT = 16,  // Universal care recipient role (all ages) - FHIR-aligned
  COMMUNITY_HEALTH_WORKER = 17,  // Community Health Worker (CHW)
  CHW = 18,  // Synonym for COMMUNITY_HEALTH_WORKER
  IT_ADMIN = 19,  // Tenant IT Administrator (technical ops for their organization)
  PT = 20,  // Synonym for PHYSICAL_THERAPIST
  QUALITY_MANAGER = 21,  // Quality assurance and compliance
}

/**
 * Map role strings to role codes
 */
export const ROLE_TO_CODE: Record<UserRole, RoleCode> = {
  super_admin: RoleCode.SUPER_ADMIN,
  it_admin: RoleCode.IT_ADMIN,
  admin: RoleCode.ADMIN,
  nurse: RoleCode.NURSE,
  senior: RoleCode.SENIOR,  // DEPRECATED: Maps to SENIOR for backward compatibility
  patient: RoleCode.PATIENT,  // Preferred role for all care recipients
  physician: RoleCode.PHYSICIAN,
  doctor: RoleCode.PHYSICIAN, // Synonym
  volunteer: RoleCode.VOLUNTEER,
  caregiver: RoleCode.CAREGIVER,
  staff: RoleCode.STAFF,
  nurse_practitioner: RoleCode.NURSE_PRACTITIONER,
  physician_assistant: RoleCode.PHYSICIAN_ASSISTANT,
  clinical_supervisor: RoleCode.CLINICAL_SUPERVISOR,
  department_head: RoleCode.DEPARTMENT_HEAD,
  physical_therapist: RoleCode.PHYSICAL_THERAPIST,
  pt: RoleCode.PT,  // Synonym for physical_therapist
  quality_manager: RoleCode.QUALITY_MANAGER,
  case_manager: RoleCode.CASE_MANAGER,
  social_worker: RoleCode.SOCIAL_WORKER,
  community_health_worker: RoleCode.COMMUNITY_HEALTH_WORKER,
  chw: RoleCode.CHW,
};

/**
 * Map role codes to role strings
 */
export const CODE_TO_ROLE: Record<RoleCode, UserRole> = {
  [RoleCode.SUPER_ADMIN]: 'super_admin',
  [RoleCode.IT_ADMIN]: 'it_admin',
  [RoleCode.ADMIN]: 'admin',
  [RoleCode.NURSE]: 'nurse',
  [RoleCode.SENIOR]: 'senior',  // DEPRECATED: Kept for backward compatibility
  [RoleCode.PATIENT]: 'patient',  // Preferred role for all care recipients
  [RoleCode.PHYSICIAN]: 'physician',
  [RoleCode.VOLUNTEER]: 'volunteer',
  [RoleCode.STAFF]: 'staff',
  [RoleCode.NURSE_PRACTITIONER]: 'nurse_practitioner',
  [RoleCode.PHYSICIAN_ASSISTANT]: 'physician_assistant',
  [RoleCode.CLINICAL_SUPERVISOR]: 'clinical_supervisor',
  [RoleCode.DEPARTMENT_HEAD]: 'department_head',
  [RoleCode.PHYSICAL_THERAPIST]: 'physical_therapist',
  [RoleCode.PT]: 'pt',  // Synonym for physical_therapist
  [RoleCode.QUALITY_MANAGER]: 'quality_manager',
  [RoleCode.CAREGIVER]: 'caregiver',
  [RoleCode.CASE_MANAGER]: 'case_manager',
  [RoleCode.SOCIAL_WORKER]: 'social_worker',
  [RoleCode.COMMUNITY_HEALTH_WORKER]: 'community_health_worker',
  [RoleCode.CHW]: 'chw',
};

// ============================================================================
// PERMISSION STRUCTURES
// ============================================================================

/**
 * Access scope permissions returned from database
 */
export interface RoleAccessScopes {
  canViewNurse: boolean;
  canViewPhysician: boolean;
  canViewAdmin: boolean;
  canSupervise: boolean;
  canManageDepartment: boolean;
  department: Department;
  roles: StaffRole[];
}

/**
 * User role assignment from database
 */
export interface UserRoleAssignment {
  user_id: string;
  role: StaffRole;
  department?: Department;
  created_at: string;
  updated_at?: string;
}

// ============================================================================
// ROLE HIERARCHY & PERMISSIONS
// ============================================================================

/**
 * Role hierarchy for permission inheritance
 * Higher-level roles inherit permissions from lower-level roles
 */
export const ROLE_HIERARCHY: Record<StaffRole, StaffRole[]> = {
  super_admin: [
    'super_admin',
    'it_admin',
    'department_head',
    'clinical_supervisor',
    'nurse_practitioner',
    'physician_assistant',
    'physician',
    'doctor',
    'nurse',
    'case_manager',
    'social_worker',
    'community_health_worker',
    'chw',
    'physical_therapist',
    'pt',
    'quality_manager',
    'admin',
  ],
  it_admin: [
    'it_admin',
    'admin',
  ], // IT Admin manages technical/admin staff within their tenant only
  department_head: [
    'department_head',
    'clinical_supervisor',
    'nurse_practitioner',
    'physician_assistant',
    'physician',
    'doctor',
    'nurse',
    'case_manager',
    'social_worker',
  ],
  clinical_supervisor: [
    'clinical_supervisor',
    'nurse_practitioner',
    'physician_assistant',
    'physician',
    'doctor',
    'nurse',
    'case_manager',
    'social_worker',
  ],
  nurse_practitioner: ['nurse_practitioner', 'nurse', 'physician', 'doctor'],
  physician_assistant: ['physician_assistant', 'physician', 'doctor', 'nurse'],
  physician: ['physician', 'doctor'],
  doctor: ['physician', 'doctor'],
  nurse: ['nurse'],
  case_manager: ['case_manager'], // Care coordination role
  social_worker: ['social_worker'], // Psychosocial services role
  community_health_worker: ['community_health_worker', 'chw'], // CHW field workers
  chw: ['community_health_worker', 'chw'], // Synonym for community_health_worker
  physical_therapist: ['physical_therapist', 'pt'],
  pt: ['physical_therapist', 'pt'],  // Synonym for physical_therapist
  quality_manager: ['quality_manager'],  // Quality assurance role
  admin: ['admin'],
};

// ============================================================================
// PERMISSION HELPERS
// ============================================================================

/**
 * Check if a role has access to a specific permission level
 */
export function roleHasAccess(userRole: StaffRole, requiredRole: StaffRole): boolean {
  return ROLE_HIERARCHY[userRole]?.includes(requiredRole) ?? false;
}

/**
 * Check if a role has any of the required roles
 */
export function roleHasAnyAccess(userRole: StaffRole, requiredRoles: StaffRole[]): boolean {
  return requiredRoles.some((required) => roleHasAccess(userRole, required));
}

/**
 * Get display name for a role
 */
export const ROLE_DISPLAY_NAMES: Record<StaffRole, string> = {
  super_admin: 'Platform Administrator',
  it_admin: 'IT Administrator',
  department_head: 'Department Head',
  clinical_supervisor: 'Clinical Supervisor',
  nurse_practitioner: 'Nurse Practitioner',
  physician_assistant: 'Physician Assistant',
  physician: 'Physician',
  doctor: 'Doctor',
  nurse: 'Nurse',
  case_manager: 'Case Manager',
  social_worker: 'Social Worker',
  community_health_worker: 'Community Health Worker',
  chw: 'CHW',
  physical_therapist: 'Physical Therapist',
  pt: 'Physical Therapist',  // Synonym display
  quality_manager: 'Quality Manager',
  admin: 'Administrator',
};

/**
 * Get display name for a department
 */
export const DEPARTMENT_DISPLAY_NAMES: Record<NonNullable<Department>, string> = {
  nursing: 'Nursing',
  medical: 'Medical',
  therapy: 'Therapy',
  administration: 'Administration',
};

/**
 * Check if role is a clinical role (provides patient care)
 */
export function isClinicalRole(role: StaffRole): boolean {
  return [
    'nurse',
    'physician',
    'doctor',
    'nurse_practitioner',
    'physician_assistant',
    'physical_therapist',
    'clinical_supervisor',
  ].includes(role);
}

/**
 * Check if role is an administrative role
 */
export function isAdministrativeRole(role: StaffRole): boolean {
  return ['admin', 'super_admin', 'it_admin', 'department_head'].includes(role);
}

/**
 * Check if role is advanced practice provider (APP)
 */
export function isAdvancedPracticeProvider(role: StaffRole): boolean {
  return ['nurse_practitioner', 'physician_assistant'].includes(role);
}

/**
 * Check if role has supervisory capabilities
 */
export function hasSupervisoryCapabilities(role: StaffRole): boolean {
  return ['super_admin', 'department_head', 'clinical_supervisor'].includes(role);
}

/**
 * Check if role is a tenant IT role (technical administration within a tenant)
 */
export function isTenantITRole(role: StaffRole): boolean {
  return role === 'it_admin';
}

/**
 * Check if role is a platform administrator (Envision employees only)
 */
export function isPlatformAdmin(role: StaffRole): boolean {
  return role === 'super_admin';
}
