/**
 * roleAuthority.test.ts - Tests for centralized role authority
 */
import { describe, it, expect } from 'vitest';
import {
  isAdminRoleName,
  isAdminRoleCode,
  isClinicalRoleName,
  isClinicalRoleCode,
  checkAdminFromUserRoles,
  checkClinicalFromUserRoles,
  checkAdminFromProfile,
  checkClinicalFromProfile,
  checkAdminFromMetadata,
  determineRoleAccess,
  ADMIN_ROLE_NAMES,
  ADMIN_ROLE_CODES,
  CLINICAL_ROLE_NAMES,
  CLINICAL_ROLE_CODES,
} from '../roleAuthority';
import { RoleCode } from '../../types/roles';

describe('roleAuthority', () => {
  describe('ADMIN_ROLE_NAMES and ADMIN_ROLE_CODES consistency', () => {
    it('should have matching admin role names and codes', () => {
      // Admin roles: super_admin(1), admin(2), it_admin(19), department_head(11)
      expect(ADMIN_ROLE_NAMES).toContain('super_admin');
      expect(ADMIN_ROLE_NAMES).toContain('admin');
      expect(ADMIN_ROLE_NAMES).toContain('it_admin');
      expect(ADMIN_ROLE_NAMES).toContain('department_head');
      expect(ADMIN_ROLE_NAMES).toHaveLength(4);

      expect(ADMIN_ROLE_CODES).toContain(RoleCode.SUPER_ADMIN); // 1
      expect(ADMIN_ROLE_CODES).toContain(RoleCode.ADMIN); // 2
      expect(ADMIN_ROLE_CODES).toContain(RoleCode.IT_ADMIN); // 19
      expect(ADMIN_ROLE_CODES).toContain(RoleCode.DEPARTMENT_HEAD); // 11
      expect(ADMIN_ROLE_CODES).toHaveLength(4);
    });

    it('should NOT include non-admin roles', () => {
      expect(ADMIN_ROLE_NAMES).not.toContain('nurse');
      expect(ADMIN_ROLE_NAMES).not.toContain('physician');
      expect(ADMIN_ROLE_NAMES).not.toContain('physical_therapist');
      expect(ADMIN_ROLE_NAMES).not.toContain('staff');

      expect(ADMIN_ROLE_CODES).not.toContain(RoleCode.NURSE); // 3
      expect(ADMIN_ROLE_CODES).not.toContain(RoleCode.PHYSICAL_THERAPIST); // 12
      expect(ADMIN_ROLE_CODES).not.toContain(RoleCode.STAFF); // 7
    });
  });

  describe('isAdminRoleName', () => {
    it('returns true for admin role names', () => {
      expect(isAdminRoleName('super_admin')).toBe(true);
      expect(isAdminRoleName('admin')).toBe(true);
      expect(isAdminRoleName('it_admin')).toBe(true);
      expect(isAdminRoleName('department_head')).toBe(true);
    });

    it('returns true for case-insensitive admin role names', () => {
      expect(isAdminRoleName('SUPER_ADMIN')).toBe(true);
      expect(isAdminRoleName('Admin')).toBe(true);
      expect(isAdminRoleName('IT_ADMIN')).toBe(true);
    });

    it('returns false for non-admin roles', () => {
      expect(isAdminRoleName('nurse')).toBe(false);
      expect(isAdminRoleName('physician')).toBe(false);
      expect(isAdminRoleName('physical_therapist')).toBe(false);
      expect(isAdminRoleName('staff')).toBe(false);
      expect(isAdminRoleName('moderator')).toBe(false); // Not in our list
    });

    it('returns false for null/undefined', () => {
      expect(isAdminRoleName(null)).toBe(false);
      expect(isAdminRoleName(undefined)).toBe(false);
      expect(isAdminRoleName('')).toBe(false);
    });
  });

  describe('isAdminRoleCode', () => {
    it('returns true for admin role codes', () => {
      expect(isAdminRoleCode(RoleCode.SUPER_ADMIN)).toBe(true); // 1
      expect(isAdminRoleCode(RoleCode.ADMIN)).toBe(true); // 2
      expect(isAdminRoleCode(RoleCode.IT_ADMIN)).toBe(true); // 19
      expect(isAdminRoleCode(RoleCode.DEPARTMENT_HEAD)).toBe(true); // 11
    });

    it('returns false for non-admin role codes', () => {
      expect(isAdminRoleCode(RoleCode.NURSE)).toBe(false); // 3
      expect(isAdminRoleCode(RoleCode.PHYSICAL_THERAPIST)).toBe(false); // 12
      expect(isAdminRoleCode(RoleCode.PHYSICIAN)).toBe(false); // 5
      expect(isAdminRoleCode(RoleCode.STAFF)).toBe(false); // 7
    });

    it('returns false for null/undefined', () => {
      expect(isAdminRoleCode(null)).toBe(false);
      expect(isAdminRoleCode(undefined)).toBe(false);
    });
  });

  describe('checkAdminFromUserRoles', () => {
    it('returns true when user has admin role', () => {
      expect(checkAdminFromUserRoles([{ role: 'admin' }])).toBe(true);
      expect(checkAdminFromUserRoles([{ role: 'super_admin' }])).toBe(true);
      expect(checkAdminFromUserRoles([{ role: 'it_admin' }])).toBe(true);
      expect(checkAdminFromUserRoles([{ role: 'department_head' }])).toBe(true);
    });

    it('returns true when user has multiple roles including admin', () => {
      expect(checkAdminFromUserRoles([
        { role: 'nurse' },
        { role: 'admin' },
      ])).toBe(true);
    });

    it('returns false when user has no admin role', () => {
      expect(checkAdminFromUserRoles([{ role: 'nurse' }])).toBe(false);
      expect(checkAdminFromUserRoles([{ role: 'physician' }])).toBe(false);
      expect(checkAdminFromUserRoles([
        { role: 'nurse' },
        { role: 'physician' },
      ])).toBe(false);
    });

    it('returns false for empty roles array', () => {
      expect(checkAdminFromUserRoles([])).toBe(false);
    });
  });

  describe('checkAdminFromProfile', () => {
    it('returns true for admin role_code', () => {
      expect(checkAdminFromProfile({ role_code: RoleCode.SUPER_ADMIN })).toBe(true);
      expect(checkAdminFromProfile({ role_code: RoleCode.ADMIN })).toBe(true);
      expect(checkAdminFromProfile({ role_code: RoleCode.IT_ADMIN })).toBe(true);
      expect(checkAdminFromProfile({ role_code: RoleCode.DEPARTMENT_HEAD })).toBe(true);
    });

    it('returns true for admin role name', () => {
      expect(checkAdminFromProfile({ role: 'admin' })).toBe(true);
      expect(checkAdminFromProfile({ role: 'super_admin' })).toBe(true);
    });

    it('returns false for non-admin role_code', () => {
      expect(checkAdminFromProfile({ role_code: RoleCode.NURSE })).toBe(false); // 3
      expect(checkAdminFromProfile({ role_code: RoleCode.PHYSICAL_THERAPIST })).toBe(false); // 12
    });

    it('does NOT trust is_admin boolean alone', () => {
      // This is intentional - is_admin without proper role should not grant access
      expect(checkAdminFromProfile({ is_admin: true })).toBe(false);
      expect(checkAdminFromProfile({ is_admin: true, role_code: null })).toBe(false);
    });

    it('returns false for null profile', () => {
      expect(checkAdminFromProfile(null)).toBe(false);
    });
  });

  describe('checkAdminFromMetadata', () => {
    it('returns true for admin role in app_metadata', () => {
      expect(checkAdminFromMetadata({ role: 'admin' }, null)).toBe(true);
      expect(checkAdminFromMetadata({ role: 'super_admin' }, null)).toBe(true);
    });

    it('returns true for admin role in user_metadata', () => {
      expect(checkAdminFromMetadata(null, { role: 'admin' })).toBe(true);
      expect(checkAdminFromMetadata(null, { role: 'super_admin' })).toBe(true);
    });

    it('does NOT trust is_admin boolean in metadata', () => {
      expect(checkAdminFromMetadata({ is_admin: true }, null)).toBe(false);
    });

    it('returns false for non-admin roles', () => {
      expect(checkAdminFromMetadata({ role: 'nurse' }, null)).toBe(false);
      expect(checkAdminFromMetadata(null, { role: 'physician' })).toBe(false);
    });

    it('returns false for null metadata', () => {
      expect(checkAdminFromMetadata(null, null)).toBe(false);
    });
  });

  describe('determineRoleAccess', () => {
    it('prioritizes user_roles over profiles', () => {
      const result = determineRoleAccess(
        [{ role: 'admin' }],
        { role_code: RoleCode.NURSE } // This should be ignored
      );
      expect(result.hasAdminAccess).toBe(true);
      expect(result.source).toBe('user_roles');
    });

    it('falls back to profiles when user_roles is empty', () => {
      const result = determineRoleAccess(
        [],
        { role_code: RoleCode.ADMIN }
      );
      expect(result.hasAdminAccess).toBe(true);
      expect(result.source).toBe('profiles');
    });

    it('denies by default when no role data', () => {
      const result = determineRoleAccess(null, null);
      expect(result.hasAdminAccess).toBe(false);
      expect(result.hasClinicalAccess).toBe(false);
      expect(result.source).toBe('none');
    });

    it('includes all roles in result', () => {
      const result = determineRoleAccess(
        [{ role: 'admin' }, { role: 'nurse' }],
        null
      );
      expect(result.roles).toContain('admin');
      expect(result.roles).toContain('nurse');
    });
  });

  describe('clinical role checks', () => {
    it('identifies clinical roles correctly', () => {
      expect(isClinicalRoleName('nurse')).toBe(true);
      expect(isClinicalRoleName('physician')).toBe(true);
      expect(isClinicalRoleName('physical_therapist')).toBe(true);
      expect(isClinicalRoleName('nurse_practitioner')).toBe(true);
    });

    it('identifies clinical role codes correctly', () => {
      expect(isClinicalRoleCode(RoleCode.NURSE)).toBe(true);
      expect(isClinicalRoleCode(RoleCode.PHYSICIAN)).toBe(true);
      expect(isClinicalRoleCode(RoleCode.PHYSICAL_THERAPIST)).toBe(true);
    });

    it('grants clinical access to clinical roles', () => {
      expect(checkClinicalFromUserRoles([{ role: 'nurse' }])).toBe(true);
      expect(checkClinicalFromProfile({ role_code: RoleCode.PHYSICIAN })).toBe(true);
    });

    it('grants clinical access to admin roles (admins can access clinical)', () => {
      expect(checkClinicalFromUserRoles([{ role: 'admin' }])).toBe(true);
      expect(checkClinicalFromProfile({ role_code: RoleCode.SUPER_ADMIN })).toBe(true);
    });
  });

  describe('regression tests for AuthGate bug', () => {
    // This test ensures the bug where NURSE (3) and PHYSICAL_THERAPIST (12)
    // were incorrectly treated as admin roles is fixed
    it('NURSE role code (3) is NOT admin', () => {
      expect(isAdminRoleCode(3)).toBe(false);
      expect(checkAdminFromProfile({ role_code: 3 })).toBe(false);
    });

    it('PHYSICAL_THERAPIST role code (12) is NOT admin', () => {
      expect(isAdminRoleCode(12)).toBe(false);
      expect(checkAdminFromProfile({ role_code: 12 })).toBe(false);
    });

    it('role names "staff" and "moderator" are NOT admin', () => {
      expect(isAdminRoleName('staff')).toBe(false);
      expect(isAdminRoleName('moderator')).toBe(false);
    });
  });
});
