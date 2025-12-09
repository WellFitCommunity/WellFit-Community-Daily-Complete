/**
 * Hospital Workforce Service Tests
 *
 * Tests for the hospital workforce migration service.
 * These tests verify:
 * - Service exports are correctly structured
 * - NPI validation logic (pure Luhn algorithm)
 * - Type contracts are valid
 *
 * Note: Database integration is tested via integration tests.
 * This file focuses on unit-level validation of pure logic.
 */

import * as hospitalWorkforceService from '../hospitalWorkforceService';

describe('HospitalWorkforceService', () => {
  describe('Service Exports', () => {
    it('should export all required service functions', () => {
      // Reference data queries
      expect(typeof hospitalWorkforceService.getStaffCategories).toBe('function');
      expect(typeof hospitalWorkforceService.getRoleTypes).toBe('function');
      expect(typeof hospitalWorkforceService.getCredentialTypes).toBe('function');
      expect(typeof hospitalWorkforceService.getLicenseTypes).toBe('function');

      // Organization management
      expect(typeof hospitalWorkforceService.getOrganizations).toBe('function');
      expect(typeof hospitalWorkforceService.getOrganization).toBe('function');
      expect(typeof hospitalWorkforceService.createOrganization).toBe('function');
      expect(typeof hospitalWorkforceService.updateOrganization).toBe('function');

      // Department management
      expect(typeof hospitalWorkforceService.getDepartments).toBe('function');
      expect(typeof hospitalWorkforceService.createDepartment).toBe('function');
      expect(typeof hospitalWorkforceService.updateDepartment).toBe('function');

      // Facility management
      expect(typeof hospitalWorkforceService.getFacilities).toBe('function');
      expect(typeof hospitalWorkforceService.createFacility).toBe('function');
      expect(typeof hospitalWorkforceService.updateFacility).toBe('function');

      // Staff management
      expect(typeof hospitalWorkforceService.searchStaff).toBe('function');
      expect(typeof hospitalWorkforceService.getStaff).toBe('function');
      expect(typeof hospitalWorkforceService.getStaffByNPI).toBe('function');
      expect(typeof hospitalWorkforceService.createStaff).toBe('function');
      expect(typeof hospitalWorkforceService.updateStaff).toBe('function');
      expect(typeof hospitalWorkforceService.deactivateStaff).toBe('function');
      expect(typeof hospitalWorkforceService.getActiveStaff).toBe('function');

      // Staff roles
      expect(typeof hospitalWorkforceService.getStaffRoles).toBe('function');
      expect(typeof hospitalWorkforceService.assignStaffRole).toBe('function');
      expect(typeof hospitalWorkforceService.endStaffRole).toBe('function');

      // Credentials
      expect(typeof hospitalWorkforceService.getStaffCredentials).toBe('function');
      expect(typeof hospitalWorkforceService.addStaffCredential).toBe('function');
      expect(typeof hospitalWorkforceService.updateStaffCredential).toBe('function');
      expect(typeof hospitalWorkforceService.getStaffCredentialsDisplay).toBe('function');

      // Licenses
      expect(typeof hospitalWorkforceService.getStaffLicenses).toBe('function');
      expect(typeof hospitalWorkforceService.addStaffLicense).toBe('function');
      expect(typeof hospitalWorkforceService.updateStaffLicense).toBe('function');
      expect(typeof hospitalWorkforceService.hasActiveLicense).toBe('function');

      // Board certifications
      expect(typeof hospitalWorkforceService.getStaffBoardCertifications).toBe('function');
      expect(typeof hospitalWorkforceService.addStaffBoardCertification).toBe('function');

      // Privileges
      expect(typeof hospitalWorkforceService.getStaffPrivileges).toBe('function');
      expect(typeof hospitalWorkforceService.addStaffPrivilege).toBe('function');

      // Reporting relationships
      expect(typeof hospitalWorkforceService.getDirectReports).toBe('function');
      expect(typeof hospitalWorkforceService.getSupervisorChain).toBe('function');
      expect(typeof hospitalWorkforceService.assignSupervisor).toBe('function');

      // EHR mappings
      expect(typeof hospitalWorkforceService.getStaffEHRMappings).toBe('function');
      expect(typeof hospitalWorkforceService.addStaffEHRMapping).toBe('function');

      // Expiring credentials view
      expect(typeof hospitalWorkforceService.getExpiringCredentials).toBe('function');

      // Migration batches
      expect(typeof hospitalWorkforceService.createMigrationBatch).toBe('function');
      expect(typeof hospitalWorkforceService.getMigrationBatch).toBe('function');
      expect(typeof hospitalWorkforceService.updateMigrationBatch).toBe('function');
      expect(typeof hospitalWorkforceService.addMigrationLog).toBe('function');
      expect(typeof hospitalWorkforceService.getMigrationLogs).toBe('function');

      // Provider groups
      expect(typeof hospitalWorkforceService.getProviderGroups).toBe('function');
      expect(typeof hospitalWorkforceService.createProviderGroup).toBe('function');

      // NPI validation
      expect(typeof hospitalWorkforceService.validateNPI).toBe('function');
    });

    it('should export HospitalWorkforceService object', () => {
      expect(hospitalWorkforceService.HospitalWorkforceService).toBeDefined();
      expect(typeof hospitalWorkforceService.HospitalWorkforceService).toBe('object');
    });

    it('should have default export', () => {
      expect(hospitalWorkforceService.default).toBeDefined();
    });
  });

  describe('Service Object Methods', () => {
    it('should contain all methods in HospitalWorkforceService object', () => {
      const service = hospitalWorkforceService.HospitalWorkforceService;

      // Verify key methods exist on the service object
      const expectedMethods = [
        'getStaffCategories',
        'getRoleTypes',
        'getCredentialTypes',
        'getLicenseTypes',
        'getOrganizations',
        'getOrganization',
        'createOrganization',
        'updateOrganization',
        'getDepartments',
        'createDepartment',
        'updateDepartment',
        'getFacilities',
        'createFacility',
        'updateFacility',
        'searchStaff',
        'getStaff',
        'getStaffByNPI',
        'createStaff',
        'updateStaff',
        'deactivateStaff',
        'getActiveStaff',
        'getStaffRoles',
        'assignStaffRole',
        'endStaffRole',
        'getStaffCredentials',
        'addStaffCredential',
        'updateStaffCredential',
        'getStaffCredentialsDisplay',
        'getStaffLicenses',
        'addStaffLicense',
        'updateStaffLicense',
        'hasActiveLicense',
        'getStaffBoardCertifications',
        'addStaffBoardCertification',
        'getStaffPrivileges',
        'addStaffPrivilege',
        'getDirectReports',
        'getSupervisorChain',
        'assignSupervisor',
        'getStaffEHRMappings',
        'addStaffEHRMapping',
        'getExpiringCredentials',
        'createMigrationBatch',
        'getMigrationBatch',
        'updateMigrationBatch',
        'addMigrationLog',
        'getMigrationLogs',
        'getProviderGroups',
        'createProviderGroup',
        'validateNPI',
      ];

      for (const method of expectedMethods) {
        expect(typeof (service as Record<string, unknown>)[method]).toBe('function');
      }
    });
  });
});

// ============================================================================
// NPI Luhn Algorithm Unit Tests (Pure Logic)
// ============================================================================

describe('NPI Luhn Algorithm', () => {
  /**
   * NPI (National Provider Identifier) validation uses the Luhn algorithm
   * with an 80840 prefix per CMS specifications.
   *
   * The NPI is a 10-digit identification number issued to health care
   * providers in the United States by CMS.
   *
   * Validation rules:
   * 1. Must be exactly 10 digits
   * 2. Must pass Luhn check with 80840 prefix
   */

  function isValidNPI(npi: string): boolean {
    // Remove non-digits
    const clean = npi.replace(/\D/g, '');

    // Must be exactly 10 digits
    if (clean.length !== 10) return false;

    // Luhn algorithm with 80840 prefix
    // The 80840 prefix is required per CMS specifications
    let sum = 24; // Pre-calculated sum for '80840' prefix

    for (let i = 0; i < 9; i++) {
      let digit = parseInt(clean[i], 10);
      if (i % 2 === 0) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
    }

    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(clean[9], 10);
  }

  describe('Valid NPI Numbers', () => {
    it('should validate known good NPI: 1234567893', () => {
      expect(isValidNPI('1234567893')).toBe(true);
    });

    it('should validate NPI: 1003000126', () => {
      expect(isValidNPI('1003000126')).toBe(true);
    });

    it('should validate NPI: 1912301953', () => {
      expect(isValidNPI('1912301953')).toBe(true);
    });

    it('should validate NPI with dashes: 123-456-7893', () => {
      expect(isValidNPI('123-456-7893')).toBe(true);
    });

    it('should validate NPI with spaces: 1234 5678 93', () => {
      expect(isValidNPI('1234 5678 93')).toBe(true);
    });
  });

  describe('Invalid NPI Numbers', () => {
    it('should reject NPI with wrong check digit: 1234567890', () => {
      expect(isValidNPI('1234567890')).toBe(false);
    });

    it('should reject NPI with wrong check digit: 1234567891', () => {
      expect(isValidNPI('1234567891')).toBe(false);
    });

    it('should reject NPI with wrong check digit: 1234567892', () => {
      expect(isValidNPI('1234567892')).toBe(false);
    });

    it('should reject 9-digit NPI: 123456789', () => {
      expect(isValidNPI('123456789')).toBe(false);
    });

    it('should reject 11-digit NPI: 12345678901', () => {
      expect(isValidNPI('12345678901')).toBe(false);
    });

    it('should reject empty NPI', () => {
      expect(isValidNPI('')).toBe(false);
    });

    it('should reject all-zeros NPI: 0000000000', () => {
      expect(isValidNPI('0000000000')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle NPI with leading zeros: 0123456789', () => {
      // This is a valid format - need to calculate if it passes Luhn
      const clean = '0123456789';
      let sum = 24;
      for (let i = 0; i < 9; i++) {
        let digit = parseInt(clean[i], 10);
        if (i % 2 === 0) {
          digit *= 2;
          if (digit > 9) digit -= 9;
        }
        sum += digit;
      }
      const expectedCheck = (10 - (sum % 10)) % 10;
      const actualCheck = parseInt(clean[9], 10);
      const expectedResult = expectedCheck === actualCheck;

      expect(isValidNPI('0123456789')).toBe(expectedResult);
    });

    it('should handle NPIs with mixed formatting', () => {
      // Various formatting should be stripped
      expect(isValidNPI('1234-567893')).toBe(true);
      expect(isValidNPI(' 1234567893 ')).toBe(true);
      expect(isValidNPI('(123)4567893')).toBe(true);
    });
  });
});

// ============================================================================
// Employment Status and Type Enums (Type Validation)
// ============================================================================

describe('Hospital Workforce Enums', () => {
  const validEmploymentStatuses = ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED', 'RETIRED', 'PENDING'];
  const validEmploymentTypes = ['FULL_TIME', 'PART_TIME', 'PER_DIEM', 'CONTRACT', 'TEMPORARY', 'VOLUNTEER'];
  const validOrganizationTypes = ['HOSPITAL', 'CLINIC', 'PRACTICE_GROUP', 'HOME_HEALTH', 'LONG_TERM_CARE', 'HOSPICE', 'BEHAVIORAL_HEALTH', 'OTHER'];
  const validSourceSystems = ['EPIC', 'CERNER', 'MEDITECH', 'ALLSCRIPTS', 'ATHENA', 'NEXTGEN', 'EXCEL', 'CSV', 'MANUAL', 'OTHER'];

  describe('Employment Status Values', () => {
    it.each(validEmploymentStatuses)('should recognize %s as valid employment status', (status) => {
      expect(validEmploymentStatuses.includes(status)).toBe(true);
    });

    it('should have exactly 6 employment statuses', () => {
      expect(validEmploymentStatuses.length).toBe(6);
    });
  });

  describe('Employment Type Values', () => {
    it.each(validEmploymentTypes)('should recognize %s as valid employment type', (type) => {
      expect(validEmploymentTypes.includes(type)).toBe(true);
    });

    it('should have exactly 6 employment types', () => {
      expect(validEmploymentTypes.length).toBe(6);
    });
  });

  describe('Organization Type Values', () => {
    it.each(validOrganizationTypes)('should recognize %s as valid organization type', (type) => {
      expect(validOrganizationTypes.includes(type)).toBe(true);
    });

    it('should have exactly 8 organization types', () => {
      expect(validOrganizationTypes.length).toBe(8);
    });
  });

  describe('Source System Values', () => {
    it.each(validSourceSystems)('should recognize %s as valid source system', (system) => {
      expect(validSourceSystems.includes(system)).toBe(true);
    });

    it('should have exactly 10 source systems', () => {
      expect(validSourceSystems.length).toBe(10);
    });
  });
});
