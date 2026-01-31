/**
 * roleAuthority.ts - Single source of truth for role determination (Edge Functions)
 *
 * This module provides consistent role checking for all edge functions.
 * Mirrors the frontend src/lib/roleAuthority.ts for consistency.
 *
 * Data Flow:
 * 1. Primary: user_roles table (role assignments)
 * 2. Fallback: profiles.role_code (legacy)
 *
 * Deny by Default: If role cannot be proven, access is denied.
 */

// ============================================================================
// ROLE DEFINITIONS (authoritative)
// ============================================================================

/**
 * Role codes - must match src/types/roles.ts RoleCode enum
 */
export const RoleCode = {
  SUPER_ADMIN: 1,
  ADMIN: 2,
  NURSE: 3,
  SENIOR: 4,
  PHYSICIAN: 5,
  VOLUNTEER: 6,
  STAFF: 7,
  NURSE_PRACTITIONER: 8,
  PHYSICIAN_ASSISTANT: 9,
  CLINICAL_SUPERVISOR: 10,
  DEPARTMENT_HEAD: 11,
  PHYSICAL_THERAPIST: 12,
  CAREGIVER: 13,
  CASE_MANAGER: 14,
  SOCIAL_WORKER: 15,
  PATIENT: 16,
  COMMUNITY_HEALTH_WORKER: 17,
  CHW: 18,
  IT_ADMIN: 19,
  PT: 20,
  QUALITY_MANAGER: 21,
  LAB_TECH: 22,
  PHARMACIST: 23,
  RADIOLOGIST: 24,
  BILLING_SPECIALIST: 25,
} as const;

/**
 * Role names that grant admin panel access
 */
export const ADMIN_ROLE_NAMES = [
  'super_admin',
  'admin',
  'it_admin',
  'department_head',
] as const;

/**
 * Role codes that grant admin panel access
 */
export const ADMIN_ROLE_CODES = [
  RoleCode.SUPER_ADMIN,      // 1
  RoleCode.ADMIN,            // 2
  RoleCode.IT_ADMIN,         // 19
  RoleCode.DEPARTMENT_HEAD,  // 11
] as const;

/**
 * Clinical role names
 */
export const CLINICAL_ROLE_NAMES = [
  'nurse',
  'physician',
  'doctor',
  'nurse_practitioner',
  'physician_assistant',
  'clinical_supervisor',
  'case_manager',
  'social_worker',
  'community_health_worker',
  'chw',
  'physical_therapist',
  'pt',
  'pharmacist',
  'radiologist',
  'lab_tech',
] as const;

/**
 * Clinical role codes
 */
export const CLINICAL_ROLE_CODES = [
  RoleCode.NURSE,
  RoleCode.PHYSICIAN,
  RoleCode.NURSE_PRACTITIONER,
  RoleCode.PHYSICIAN_ASSISTANT,
  RoleCode.CLINICAL_SUPERVISOR,
  RoleCode.PHYSICAL_THERAPIST,
  RoleCode.PT,
  RoleCode.CASE_MANAGER,
  RoleCode.SOCIAL_WORKER,
  RoleCode.COMMUNITY_HEALTH_WORKER,
  RoleCode.CHW,
  RoleCode.LAB_TECH,
  RoleCode.PHARMACIST,
  RoleCode.RADIOLOGIST,
] as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface UserRoleRow {
  role: string;
  created_at?: string;
}

export interface ProfileRow {
  role_code?: number | null;
  role?: string | null;
  is_admin?: boolean | null;
}

export interface RoleCheckResult {
  hasAdminAccess: boolean;
  hasClinicalAccess: boolean;
  roles: string[];
  source: 'user_roles' | 'profiles' | 'none';
}

// ============================================================================
// PURE FUNCTIONS
// ============================================================================

/**
 * Check if a role name grants admin access
 */
export function isAdminRoleName(role: string | null | undefined): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return (ADMIN_ROLE_NAMES as readonly string[]).includes(normalized);
}

/**
 * Check if a role code grants admin access
 */
export function isAdminRoleCode(code: number | null | undefined): boolean {
  if (code === null || code === undefined) return false;
  return (ADMIN_ROLE_CODES as readonly number[]).includes(code);
}

/**
 * Check if a role name grants clinical access
 */
export function isClinicalRoleName(role: string | null | undefined): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return (CLINICAL_ROLE_NAMES as readonly string[]).includes(normalized);
}

/**
 * Check if a role code grants clinical access
 */
export function isClinicalRoleCode(code: number | null | undefined): boolean {
  if (code === null || code === undefined) return false;
  return (CLINICAL_ROLE_CODES as readonly number[]).includes(code);
}

/**
 * Determine admin access from user_roles data (primary source)
 */
export function checkAdminFromUserRoles(roles: UserRoleRow[]): boolean {
  if (!roles || roles.length === 0) return false;
  return roles.some(r => isAdminRoleName(r.role));
}

/**
 * Determine clinical access from user_roles data
 */
export function checkClinicalFromUserRoles(roles: UserRoleRow[]): boolean {
  if (!roles || roles.length === 0) return false;
  return roles.some(r => isClinicalRoleName(r.role) || isAdminRoleName(r.role));
}

/**
 * Determine admin access from profiles data (fallback)
 */
export function checkAdminFromProfile(profile: ProfileRow | null): boolean {
  if (!profile) return false;

  // Check role_code first (most reliable)
  if (isAdminRoleCode(profile.role_code)) return true;

  // Check role name
  if (isAdminRoleName(profile.role)) return true;

  // Do NOT trust is_admin boolean alone - it should be backed by a proper role
  return false;
}

/**
 * Determine clinical access from profiles data (fallback)
 */
export function checkClinicalFromProfile(profile: ProfileRow | null): boolean {
  if (!profile) return false;

  if (isClinicalRoleCode(profile.role_code) || isAdminRoleCode(profile.role_code)) return true;
  if (isClinicalRoleName(profile.role) || isAdminRoleName(profile.role)) return true;

  return false;
}

/**
 * Combined role check with source tracking
 * Implements deny-by-default
 */
export function determineRoleAccess(
  userRoles: UserRoleRow[] | null,
  profile: ProfileRow | null
): RoleCheckResult {
  // Priority 1: user_roles table (authoritative)
  if (userRoles && userRoles.length > 0) {
    return {
      hasAdminAccess: checkAdminFromUserRoles(userRoles),
      hasClinicalAccess: checkClinicalFromUserRoles(userRoles),
      roles: userRoles.map(r => r.role),
      source: 'user_roles',
    };
  }

  // Priority 2: profiles table (legacy fallback)
  if (profile && (profile.role_code !== null || profile.role !== null)) {
    return {
      hasAdminAccess: checkAdminFromProfile(profile),
      hasClinicalAccess: checkClinicalFromProfile(profile),
      roles: profile.role ? [profile.role] : [],
      source: 'profiles',
    };
  }

  // Deny by default
  return {
    hasAdminAccess: false,
    hasClinicalAccess: false,
    roles: [],
    source: 'none',
  };
}
