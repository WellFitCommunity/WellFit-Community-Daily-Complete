/**
 * roleAuthority.ts - Single source of truth for role determination
 *
 * This module consolidates all role checking logic into one authoritative location.
 * All components that need to check user roles MUST use this module.
 *
 * Data Flow:
 * 1. Primary: user_roles table (role assignments)
 * 2. Fallback: profiles.role_code (legacy)
 * 3. Emergency: user metadata (for recovery scenarios only)
 *
 * Deny by Default: If role cannot be proven, access is denied.
 */

import { RoleCode, StaffRole, isAdministrativeRole } from '../types/roles';

// ============================================================================
// ADMIN ROLE DEFINITIONS (authoritative)
// ============================================================================

/**
 * Role names that grant admin panel access
 * These are the ONLY roles that should be considered "admin"
 */
export const ADMIN_ROLE_NAMES: readonly StaffRole[] = [
  'super_admin',      // Platform administrators
  'admin',            // Facility administrators
  'it_admin',         // Tenant IT administrators
  'department_head',  // Executive leadership (CNO, CMO)
] as const;

/**
 * Role codes that grant admin panel access
 * Must match ADMIN_ROLE_NAMES exactly
 */
export const ADMIN_ROLE_CODES: readonly RoleCode[] = [
  RoleCode.SUPER_ADMIN,      // 1
  RoleCode.ADMIN,            // 2
  RoleCode.IT_ADMIN,         // 19
  RoleCode.DEPARTMENT_HEAD,  // 11
] as const;

/**
 * Clinical role names for clinical access verification
 */
export const CLINICAL_ROLE_NAMES: readonly StaffRole[] = [
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
export const CLINICAL_ROLE_CODES: readonly RoleCode[] = [
  RoleCode.NURSE,                    // 3
  RoleCode.PHYSICIAN,                // 5
  RoleCode.NURSE_PRACTITIONER,       // 8
  RoleCode.PHYSICIAN_ASSISTANT,      // 9
  RoleCode.CLINICAL_SUPERVISOR,      // 10
  RoleCode.PHYSICAL_THERAPIST,       // 12
  RoleCode.PT,                       // 20
  RoleCode.CASE_MANAGER,             // 14
  RoleCode.SOCIAL_WORKER,            // 15
  RoleCode.COMMUNITY_HEALTH_WORKER,  // 17
  RoleCode.CHW,                      // 18
  RoleCode.LAB_TECH,                 // 22
  RoleCode.PHARMACIST,               // 23
  RoleCode.RADIOLOGIST,              // 24
] as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface UserRoleData {
  role: string;
  created_at?: string;
}

export interface ProfileRoleData {
  role_code?: number | null;
  role?: string | null;
  is_admin?: boolean | null;
}

export interface RoleCheckResult {
  hasAdminAccess: boolean;
  hasClinicalAccess: boolean;
  roles: string[];
  source: 'user_roles' | 'profiles' | 'metadata' | 'none';
}

// ============================================================================
// PURE FUNCTIONS (no side effects, testable)
// ============================================================================

/**
 * Check if a role name grants admin access
 */
export function isAdminRoleName(role: string | null | undefined): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return ADMIN_ROLE_NAMES.includes(normalized as StaffRole);
}

/**
 * Check if a role code grants admin access
 */
export function isAdminRoleCode(code: number | null | undefined): boolean {
  if (code === null || code === undefined) return false;
  return ADMIN_ROLE_CODES.includes(code as RoleCode);
}

/**
 * Check if a role name grants clinical access
 */
export function isClinicalRoleName(role: string | null | undefined): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return CLINICAL_ROLE_NAMES.includes(normalized as StaffRole);
}

/**
 * Check if a role code grants clinical access
 */
export function isClinicalRoleCode(code: number | null | undefined): boolean {
  if (code === null || code === undefined) return false;
  return CLINICAL_ROLE_CODES.includes(code as RoleCode);
}

/**
 * Determine admin access from user_roles data (primary source)
 */
export function checkAdminFromUserRoles(roles: UserRoleData[]): boolean {
  if (!roles || roles.length === 0) return false;
  return roles.some(r => isAdminRoleName(r.role));
}

/**
 * Determine clinical access from user_roles data
 */
export function checkClinicalFromUserRoles(roles: UserRoleData[]): boolean {
  if (!roles || roles.length === 0) return false;
  return roles.some(r => isClinicalRoleName(r.role) || isAdminRoleName(r.role));
}

/**
 * Determine admin access from profiles data (fallback)
 */
export function checkAdminFromProfile(profile: ProfileRoleData | null): boolean {
  if (!profile) return false;

  // Check role_code first (most reliable)
  if (isAdminRoleCode(profile.role_code)) return true;

  // Check role name
  if (isAdminRoleName(profile.role)) return true;

  // Do NOT trust is_admin boolean alone - it should be backed by a proper role
  // This prevents orphaned is_admin flags from granting access
  return false;
}

/**
 * Determine clinical access from profiles data (fallback)
 */
export function checkClinicalFromProfile(profile: ProfileRoleData | null): boolean {
  if (!profile) return false;

  // Check role_code first
  if (isClinicalRoleCode(profile.role_code) || isAdminRoleCode(profile.role_code)) return true;

  // Check role name
  if (isClinicalRoleName(profile.role) || isAdminRoleName(profile.role)) return true;

  return false;
}

/**
 * Determine admin access from user metadata (emergency fallback)
 */
export function checkAdminFromMetadata(
  appMetadata: Record<string, unknown> | null,
  userMetadata: Record<string, unknown> | null
): boolean {
  if (appMetadata) {
    if (appMetadata.role === 'admin' || appMetadata.role === 'super_admin') return true;
    // Do NOT trust is_admin boolean in metadata
  }
  if (userMetadata) {
    if (userMetadata.role === 'admin' || userMetadata.role === 'super_admin') return true;
  }
  return false;
}

/**
 * Combined role check with source tracking
 * Implements deny-by-default: returns false if role cannot be proven
 */
export function determineRoleAccess(
  userRoles: UserRoleData[] | null,
  profile: ProfileRoleData | null,
  appMetadata: Record<string, unknown> | null = null,
  userMetadata: Record<string, unknown> | null = null
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

  // Priority 3: metadata (emergency only)
  if (appMetadata || userMetadata) {
    const hasAdmin = checkAdminFromMetadata(appMetadata, userMetadata);
    if (hasAdmin) {
      return {
        hasAdminAccess: true,
        hasClinicalAccess: false, // Cannot determine clinical from metadata
        roles: [String(appMetadata?.role || userMetadata?.role || 'unknown')],
        source: 'metadata',
      };
    }
  }

  // Deny by default
  return {
    hasAdminAccess: false,
    hasClinicalAccess: false,
    roles: [],
    source: 'none',
  };
}

// ============================================================================
// RE-EXPORT FOR CONVENIENCE
// ============================================================================

export { isAdministrativeRole };
