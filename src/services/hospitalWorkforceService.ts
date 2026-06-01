/**
 * Hospital Workforce Service
 *
 * Service layer for managing hospital workforce data migrated from
 * Epic, Cerner, Meditech, Allscripts, and legacy Excel imports.
 *
 * Uses ServiceResult pattern for consistent error handling.
 * All PHI remains server-side - client only receives IDs.
 *
 * Decomposed 2026-06-01 (CLAUDE.md Commandment #12, 600-line limit). The
 * implementation now lives in cohesive modules under ./hospital-workforce/*:
 *   - referenceData.ts   ref_* lookup queries
 *   - organizations.ts   org / department / facility structure
 *   - staff.ts           staff CRUD + search + active-staff view
 *   - credentials.ts     roles, credentials, licenses, board certs, privileges
 *   - relationships.ts   reporting relationships + EHR mappings
 *   - migration.ts       expiring credentials, migration batches/logs, provider groups, NPI validation
 * Every named export and the aggregate `HospitalWorkforceService` object are
 * re-exported below, so existing import paths are unchanged — behavior identical.
 */

// Re-export every named function + the StaffSearchOptions interface so existing
// import paths keep working.
export * from './hospital-workforce/referenceData';
export * from './hospital-workforce/organizations';
export * from './hospital-workforce/staff';
export * from './hospital-workforce/credentials';
export * from './hospital-workforce/relationships';
export * from './hospital-workforce/migration';

import {
  getStaffCategories,
  getRoleTypes,
  getCredentialTypes,
  getLicenseTypes,
} from './hospital-workforce/referenceData';
import {
  getOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  getDepartments,
  createDepartment,
  updateDepartment,
  getFacilities,
  createFacility,
  updateFacility,
} from './hospital-workforce/organizations';
import {
  searchStaff,
  getStaff,
  getStaffByNPI,
  createStaff,
  updateStaff,
  deactivateStaff,
  getActiveStaff,
} from './hospital-workforce/staff';
import {
  getStaffRoles,
  assignStaffRole,
  endStaffRole,
  getStaffCredentials,
  addStaffCredential,
  updateStaffCredential,
  getStaffCredentialsDisplay,
  getStaffLicenses,
  addStaffLicense,
  updateStaffLicense,
  hasActiveLicense,
  getStaffBoardCertifications,
  addStaffBoardCertification,
  getStaffPrivileges,
  addStaffPrivilege,
} from './hospital-workforce/credentials';
import {
  getDirectReports,
  getSupervisorChain,
  assignSupervisor,
  getStaffEHRMappings,
  addStaffEHRMapping,
} from './hospital-workforce/relationships';
import {
  getExpiringCredentials,
  createMigrationBatch,
  getMigrationBatch,
  updateMigrationBatch,
  addMigrationLog,
  getMigrationLogs,
  getProviderGroups,
  createProviderGroup,
  validateNPI,
} from './hospital-workforce/migration';

// ============================================================================
// EXPORT SERVICE OBJECT
// ============================================================================

export const HospitalWorkforceService = {
  getStaffCategories,
  getRoleTypes,
  getCredentialTypes,
  getLicenseTypes,
  getOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  getDepartments,
  createDepartment,
  updateDepartment,
  getFacilities,
  createFacility,
  updateFacility,
  searchStaff,
  getStaff,
  getStaffByNPI,
  createStaff,
  updateStaff,
  deactivateStaff,
  getActiveStaff,
  getStaffRoles,
  assignStaffRole,
  endStaffRole,
  getStaffCredentials,
  addStaffCredential,
  updateStaffCredential,
  getStaffCredentialsDisplay,
  getStaffLicenses,
  addStaffLicense,
  updateStaffLicense,
  hasActiveLicense,
  getStaffBoardCertifications,
  addStaffBoardCertification,
  getStaffPrivileges,
  addStaffPrivilege,
  getDirectReports,
  getSupervisorChain,
  assignSupervisor,
  getStaffEHRMappings,
  addStaffEHRMapping,
  getExpiringCredentials,
  createMigrationBatch,
  getMigrationBatch,
  updateMigrationBatch,
  addMigrationLog,
  getMigrationLogs,
  getProviderGroups,
  createProviderGroup,
  validateNPI,
};

export default HospitalWorkforceService;
