/**
 * Unit Tests for Healthcare Role System
 *
 * Tests role hierarchy, permissions, and helper functions
 */

import {
  StaffRole,
  Department,
  RoleCode,
  ROLE_TO_CODE,
  CODE_TO_ROLE,
  ROLE_HIERARCHY,
  roleHasAccess,
  roleHasAnyAccess,
  isClinicalRole,
  isAdministrativeRole,
  isAdvancedPracticeProvider,
  hasSupervisoryCapabilities,
  ROLE_DISPLAY_NAMES,
  DEPARTMENT_DISPLAY_NAMES,
} from '../roles';

describe('Role Type System', () => {
  describe('Role Codes', () => {
    it('should map all staff roles to codes', () => {
      expect(ROLE_TO_CODE['super_admin']).toBe(RoleCode.SUPER_ADMIN);
      expect(ROLE_TO_CODE['admin']).toBe(RoleCode.ADMIN);
      expect(ROLE_TO_CODE['nurse']).toBe(RoleCode.NURSE);
      expect(ROLE_TO_CODE['physician']).toBe(RoleCode.PHYSICIAN);
      expect(ROLE_TO_CODE['doctor']).toBe(RoleCode.PHYSICIAN); // Synonym
      expect(ROLE_TO_CODE['nurse_practitioner']).toBe(RoleCode.NURSE_PRACTITIONER);
      expect(ROLE_TO_CODE['physician_assistant']).toBe(RoleCode.PHYSICIAN_ASSISTANT);
      expect(ROLE_TO_CODE['clinical_supervisor']).toBe(RoleCode.CLINICAL_SUPERVISOR);
      expect(ROLE_TO_CODE['department_head']).toBe(RoleCode.DEPARTMENT_HEAD);
      expect(ROLE_TO_CODE['physical_therapist']).toBe(RoleCode.PHYSICAL_THERAPIST);
    });

    it('should map all codes back to role strings', () => {
      expect(CODE_TO_ROLE[RoleCode.SUPER_ADMIN]).toBe('super_admin');
      expect(CODE_TO_ROLE[RoleCode.ADMIN]).toBe('admin');
      expect(CODE_TO_ROLE[RoleCode.NURSE]).toBe('nurse');
      expect(CODE_TO_ROLE[RoleCode.PHYSICIAN]).toBe('physician');
      expect(CODE_TO_ROLE[RoleCode.NURSE_PRACTITIONER]).toBe('nurse_practitioner');
      expect(CODE_TO_ROLE[RoleCode.PHYSICIAN_ASSISTANT]).toBe('physician_assistant');
      expect(CODE_TO_ROLE[RoleCode.CLINICAL_SUPERVISOR]).toBe('clinical_supervisor');
      expect(CODE_TO_ROLE[RoleCode.DEPARTMENT_HEAD]).toBe('department_head');
      expect(CODE_TO_ROLE[RoleCode.PHYSICAL_THERAPIST]).toBe('physical_therapist');
    });

    it('should have bidirectional mapping consistency', () => {
      Object.entries(ROLE_TO_CODE).forEach(([role, code]) => {
        if (role !== 'doctor') { // Skip synonym
          expect(CODE_TO_ROLE[code]).toBe(role);
        }
      });
    });
  });

  describe('Role Hierarchy - Super Admin', () => {
    it('should grant super_admin access to all roles', () => {
      const allRoles: StaffRole[] = [
        'admin',
        'nurse',
        'physician',
        'doctor',
        'nurse_practitioner',
        'physician_assistant',
        'clinical_supervisor',
        'department_head',
        'physical_therapist',
      ];

      allRoles.forEach((role) => {
        expect(roleHasAccess('super_admin', role)).toBe(true);
      });
    });
  });

  describe('Role Hierarchy - Department Head', () => {
    it('should grant department_head access to clinical roles', () => {
      expect(roleHasAccess('department_head', 'nurse')).toBe(true);
      expect(roleHasAccess('department_head', 'physician')).toBe(true);
      expect(roleHasAccess('department_head', 'nurse_practitioner')).toBe(true);
      expect(roleHasAccess('department_head', 'physician_assistant')).toBe(true);
      expect(roleHasAccess('department_head', 'clinical_supervisor')).toBe(true);
    });

    it('should NOT grant department_head access to super_admin', () => {
      expect(roleHasAccess('department_head', 'super_admin')).toBe(false);
    });
  });

  describe('Role Hierarchy - Clinical Supervisor', () => {
    it('should grant clinical_supervisor access to clinical staff', () => {
      expect(roleHasAccess('clinical_supervisor', 'nurse')).toBe(true);
      expect(roleHasAccess('clinical_supervisor', 'physician')).toBe(true);
      expect(roleHasAccess('clinical_supervisor', 'nurse_practitioner')).toBe(true);
      expect(roleHasAccess('clinical_supervisor', 'physician_assistant')).toBe(true);
    });

    it('should NOT grant clinical_supervisor admin access', () => {
      expect(roleHasAccess('clinical_supervisor', 'admin')).toBe(false);
      expect(roleHasAccess('clinical_supervisor', 'department_head')).toBe(false);
    });
  });

  describe('Role Hierarchy - Nurse Practitioner', () => {
    it('should grant NP dual access to nurse and physician views', () => {
      expect(roleHasAccess('nurse_practitioner', 'nurse')).toBe(true);
      expect(roleHasAccess('nurse_practitioner', 'physician')).toBe(true);
      expect(roleHasAccess('nurse_practitioner', 'doctor')).toBe(true);
    });

    it('should NOT grant NP supervisory access', () => {
      expect(roleHasAccess('nurse_practitioner', 'clinical_supervisor')).toBe(false);
      expect(roleHasAccess('nurse_practitioner', 'admin')).toBe(false);
    });
  });

  describe('Role Hierarchy - Physician Assistant', () => {
    it('should grant PA dual access to physician and nurse views', () => {
      expect(roleHasAccess('physician_assistant', 'physician')).toBe(true);
      expect(roleHasAccess('physician_assistant', 'doctor')).toBe(true);
      expect(roleHasAccess('physician_assistant', 'nurse')).toBe(true);
    });

    it('should NOT grant PA supervisory access', () => {
      expect(roleHasAccess('physician_assistant', 'clinical_supervisor')).toBe(false);
    });
  });

  describe('Role Hierarchy - Physician', () => {
    it('should grant physician access to physician/doctor views only', () => {
      expect(roleHasAccess('physician', 'physician')).toBe(true);
      expect(roleHasAccess('physician', 'doctor')).toBe(true);
    });

    it('should NOT grant physician access to nurse views', () => {
      expect(roleHasAccess('physician', 'nurse')).toBe(false);
    });
  });

  describe('Role Hierarchy - Nurse', () => {
    it('should grant nurse access to nurse views only', () => {
      expect(roleHasAccess('nurse', 'nurse')).toBe(true);
    });

    it('should NOT grant nurse access to physician views', () => {
      expect(roleHasAccess('nurse', 'physician')).toBe(false);
      expect(roleHasAccess('nurse', 'doctor')).toBe(false);
    });
  });

  describe('roleHasAnyAccess', () => {
    it('should return true if role has any of the required roles', () => {
      expect(roleHasAnyAccess('nurse_practitioner', ['nurse', 'physician'])).toBe(true);
      expect(roleHasAnyAccess('clinical_supervisor', ['nurse', 'admin'])).toBe(true);
    });

    it('should return false if role has none of the required roles', () => {
      expect(roleHasAnyAccess('nurse', ['physician', 'admin'])).toBe(false);
      expect(roleHasAnyAccess('physical_therapist', ['nurse', 'physician'])).toBe(false);
    });
  });

  describe('Role Classification Helpers', () => {
    describe('isClinicalRole', () => {
      it('should identify clinical roles', () => {
        expect(isClinicalRole('nurse')).toBe(true);
        expect(isClinicalRole('physician')).toBe(true);
        expect(isClinicalRole('nurse_practitioner')).toBe(true);
        expect(isClinicalRole('physician_assistant')).toBe(true);
        expect(isClinicalRole('physical_therapist')).toBe(true);
        expect(isClinicalRole('clinical_supervisor')).toBe(true);
      });

      it('should identify non-clinical roles', () => {
        expect(isClinicalRole('admin')).toBe(false);
        expect(isClinicalRole('super_admin')).toBe(false);
        expect(isClinicalRole('department_head')).toBe(false);
      });
    });

    describe('isAdministrativeRole', () => {
      it('should identify administrative roles', () => {
        expect(isAdministrativeRole('admin')).toBe(true);
        expect(isAdministrativeRole('super_admin')).toBe(true);
        expect(isAdministrativeRole('department_head')).toBe(true);
      });

      it('should identify non-administrative roles', () => {
        expect(isAdministrativeRole('nurse')).toBe(false);
        expect(isAdministrativeRole('physician')).toBe(false);
        expect(isAdministrativeRole('nurse_practitioner')).toBe(false);
      });
    });

    describe('isAdvancedPracticeProvider', () => {
      it('should identify APPs', () => {
        expect(isAdvancedPracticeProvider('nurse_practitioner')).toBe(true);
        expect(isAdvancedPracticeProvider('physician_assistant')).toBe(true);
      });

      it('should identify non-APPs', () => {
        expect(isAdvancedPracticeProvider('nurse')).toBe(false);
        expect(isAdvancedPracticeProvider('physician')).toBe(false);
        expect(isAdvancedPracticeProvider('clinical_supervisor')).toBe(false);
      });
    });

    describe('hasSupervisoryCapabilities', () => {
      it('should identify supervisory roles', () => {
        expect(hasSupervisoryCapabilities('super_admin')).toBe(true);
        expect(hasSupervisoryCapabilities('department_head')).toBe(true);
        expect(hasSupervisoryCapabilities('clinical_supervisor')).toBe(true);
      });

      it('should identify non-supervisory roles', () => {
        expect(hasSupervisoryCapabilities('nurse')).toBe(false);
        expect(hasSupervisoryCapabilities('physician')).toBe(false);
        expect(hasSupervisoryCapabilities('nurse_practitioner')).toBe(false);
      });
    });
  });

  describe('Display Names', () => {
    it('should have display names for all staff roles', () => {
      const staffRoles: StaffRole[] = [
        'super_admin',
        'admin',
        'nurse',
        'physician',
        'doctor',
        'nurse_practitioner',
        'physician_assistant',
        'clinical_supervisor',
        'department_head',
        'physical_therapist',
      ];

      staffRoles.forEach((role) => {
        expect(ROLE_DISPLAY_NAMES[role]).toBeDefined();
        expect(typeof ROLE_DISPLAY_NAMES[role]).toBe('string');
        expect(ROLE_DISPLAY_NAMES[role].length).toBeGreaterThan(0);
      });
    });

    it('should have display names for all departments', () => {
      const departments: Department[] = ['nursing', 'medical', 'therapy', 'administration'];

      departments.forEach((dept) => {
        if (dept !== null) {
          expect(DEPARTMENT_DISPLAY_NAMES[dept]).toBeDefined();
          expect(typeof DEPARTMENT_DISPLAY_NAMES[dept]).toBe('string');
        }
      });
    });
  });

  describe('Department Types', () => {
    it('should support all department types', () => {
      const validDepartments: Department[] = [
        'nursing',
        'medical',
        'therapy',
        'administration',
        null,
      ];

      validDepartments.forEach((dept) => {
        // Type check - this will fail at compile time if types are wrong
        const d: Department = dept;
        expect(d === dept).toBe(true);
      });
    });
  });
});
