/**
 * Hospital Workforce Migration Type Definitions
 *
 * Barrel re-export from modular sub-files.
 * All imports from '@/types/hospitalWorkforce' or '../types/hospitalWorkforce'
 * continue to work without changes.
 *
 * Architecture:
 *   hc_organization --+-- hc_department (organizational units)
 *                     +-- hc_facility (physical locations)
 *
 *   hc_staff --+-- hc_staff_role (role assignments)
 *              +-- hc_staff_credential (degrees, certs)
 *              +-- hc_staff_license (state licenses)
 *              +-- hc_staff_board_certification (medical boards)
 *              +-- hc_staff_privilege (clinical privileges)
 *              +-- hc_staff_reporting (supervisor relationships)
 *              +-- hc_staff_group_affiliation (provider groups)
 *              +-- hc_staff_ehr_mapping (EHR system accounts)
 *
 * Tables are prefixed with 'hc_' (healthcare) to avoid conflicts with existing FHIR tables.
 */

// Staff categories, role types, credential/license type codes
export type {
  StaffCategoryCode,
  RefStaffCategory,
  RoleTypeCode,
  RefRoleType,
  CredentialCategory,
  CredentialCode,
  RefCredentialType,
  LicenseCode,
  RefLicenseType,
} from './staffCategories';

export { STAFF_CATEGORY_DISPLAY } from './staffCategories';

// Organization structure, core staff, employment, views
export type {
  SourceSystem,
  HCEmploymentStatus,
  HCEmploymentType,
  MigrationStatus,
  OrganizationType,
  HCOrganization,
  HCOrganizationInsert,
  HCOrganizationUpdate,
  DepartmentType,
  HCDepartment,
  HCDepartmentInsert,
  HCDepartmentUpdate,
  HCFacilityType,
  HCFacility,
  HCFacilityInsert,
  HCFacilityUpdate,
  HCStaff,
  HCStaffInsert,
  HCStaffUpdate,
  HCStaffRole,
  HCStaffRoleInsert,
  HCStaffRoleUpdate,
  HCActiveStaffView,
  HCExpiringCredentialView,
} from './organization';

export {
  HC_EMPLOYMENT_STATUS_DISPLAY,
  HC_EMPLOYMENT_TYPE_DISPLAY,
} from './organization';

// Credentials, licenses, board certifications, privileges
export type {
  VerificationStatus,
  LicenseStatus,
  BoardCertStatus,
  HCStaffCredential,
  HCStaffCredentialInsert,
  HCStaffCredentialUpdate,
  HCStaffLicense,
  HCStaffLicenseInsert,
  HCStaffLicenseUpdate,
  HCStaffBoardCertification,
  HCStaffBoardCertificationInsert,
  HCStaffBoardCertificationUpdate,
  PrivilegeCategory,
  PrivilegeLevel,
  PrivilegeStatus,
  HCStaffPrivilege,
  HCStaffPrivilegeInsert,
  HCStaffPrivilegeUpdate,
} from './credentialing';

// Reporting relationships, provider groups, EHR mappings
export type {
  ReportingRelationshipType,
  HCStaffReporting,
  HCStaffReportingInsert,
  HCStaffReportingUpdate,
  HCProviderGroup,
  HCProviderGroupInsert,
  HCProviderGroupUpdate,
  AffiliationType,
  HCStaffGroupAffiliation,
  HCStaffGroupAffiliationInsert,
  HCStaffGroupAffiliationUpdate,
  EHRSystem,
  HCStaffEHRMapping,
  HCStaffEHRMappingInsert,
  HCStaffEHRMappingUpdate,
} from './relationships';

// Migration tracking, audit, FHIR mapping, helpers, field mappings
export type {
  MigrationBatchStatus,
  HCMigrationBatch,
  HCMigrationBatchInsert,
  HCMigrationBatchUpdate,
  MigrationLogSeverity,
  HCMigrationLog,
  HCMigrationLogInsert,
  HCMigrationLogUpdate,
  AuditAction,
  HCAuditLog,
  HCAuditLogInsert,
  FHIRResourceType,
  FHIRSyncStatus,
  HCFHIRResourceMapping,
  HCFHIRResourceMappingInsert,
  HCFHIRResourceMappingUpdate,
} from './migration';

export {
  isActiveStaff,
  isClinicalProvider,
  canPrescribe,
  formatStaffName,
  formatStaffNameFormal,
  isExpiringWithinDays,
  isExpired,
  isValidNPIFormat,
  getHCEmploymentStatusColor,
  getLicenseStatusColor,
  getPrivilegeStatusColor,
  getVerificationStatusColor,
  EPIC_FIELD_MAPPINGS,
  CERNER_FIELD_MAPPINGS,
  EXCEL_COMMON_COLUMNS,
} from './migration';
