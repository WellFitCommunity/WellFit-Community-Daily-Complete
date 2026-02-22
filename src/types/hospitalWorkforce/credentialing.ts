/**
 * Hospital Workforce - Credentials, Licenses, Board Certifications & Privileges
 *
 * Defines verification statuses, staff credential/license/board cert records,
 * and clinical privilege types for the hc_* schema.
 */

import type { SourceSystem } from './organization';

// ============================================================================
// VERIFICATION & LICENSE STATUS
// ============================================================================

/**
 * Verification status values
 */
export type VerificationStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'EXPIRED'
  | 'REVOKED';

/**
 * License status values
 */
export type LicenseStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'REVOKED';

/**
 * Board certification status values
 */
export type BoardCertStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

// ============================================================================
// STAFF CREDENTIALS
// ============================================================================

/**
 * Staff credential (degrees, certifications)
 */
export interface HCStaffCredential {
  staff_credential_id: string;
  staff_id: string;
  credential_type_id: string;
  credential_number: string | null;
  issued_date: string | null;
  expiration_date: string | null;
  issuing_institution: string | null;
  verification_status: VerificationStatus | null;
  verification_date: string | null;
  verified_by: string | null;
  document_url: string | null;
  notes: string | null;
  source_system: SourceSystem | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

export type HCStaffCredentialInsert = Omit<
  HCStaffCredential,
  'staff_credential_id' | 'created_at' | 'updated_at'
>;
export type HCStaffCredentialUpdate = Partial<
  Omit<HCStaffCredentialInsert, 'staff_id'>
>;

// ============================================================================
// STAFF LICENSES
// ============================================================================

/**
 * Staff license (state-specific)
 */
export interface HCStaffLicense {
  staff_license_id: string;
  staff_id: string;
  license_type_id: string;
  license_number: string;
  state: string; // 2-letter state code
  issued_date: string | null;
  expiration_date: string | null;
  status: LicenseStatus | null;
  compact_license: boolean; // Nurse Licensure Compact, etc.
  verification_status: VerificationStatus | null;
  verification_date: string | null;
  verified_by: string | null;
  primary_source_verified: boolean;
  document_url: string | null;
  notes: string | null;
  source_system: SourceSystem | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

export type HCStaffLicenseInsert = Omit<
  HCStaffLicense,
  'staff_license_id' | 'created_at' | 'updated_at'
>;
export type HCStaffLicenseUpdate = Partial<
  Omit<HCStaffLicenseInsert, 'staff_id'>
>;

// ============================================================================
// BOARD CERTIFICATIONS
// ============================================================================

/**
 * Staff board certification
 */
export interface HCStaffBoardCertification {
  board_cert_id: string;
  staff_id: string;
  board_name: string;
  specialty: string;
  subspecialty: string | null;
  certificate_number: string | null;
  initial_certification_date: string | null;
  expiration_date: string | null;
  moc_status: string | null; // Maintenance of Certification status
  status: BoardCertStatus | null;
  verification_status: VerificationStatus | null;
  verification_date: string | null;
  document_url: string | null;
  source_system: SourceSystem | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

export type HCStaffBoardCertificationInsert = Omit<
  HCStaffBoardCertification,
  'board_cert_id' | 'created_at' | 'updated_at'
>;
export type HCStaffBoardCertificationUpdate = Partial<
  Omit<HCStaffBoardCertificationInsert, 'staff_id'>
>;

// ============================================================================
// CLINICAL PRIVILEGES
// ============================================================================

/**
 * Privilege categories
 */
export type PrivilegeCategory =
  | 'ADMITTING'
  | 'SURGICAL'
  | 'PROCEDURAL'
  | 'CONSULTING';

/**
 * Privilege levels
 */
export type PrivilegeLevel =
  | 'FULL'
  | 'LIMITED'
  | 'SUPERVISED'
  | 'PROCTORED';

/**
 * Privilege status values
 */
export type PrivilegeStatus =
  | 'APPROVED'
  | 'PENDING'
  | 'DENIED'
  | 'SUSPENDED'
  | 'EXPIRED';

/**
 * Clinical privilege at a facility
 */
export interface HCStaffPrivilege {
  privilege_id: string;
  staff_id: string;
  facility_id: string;
  privilege_category: PrivilegeCategory;
  privilege_name: string;
  privilege_code: string | null;
  privilege_level: PrivilegeLevel | null;
  status: PrivilegeStatus | null;
  effective_date: string | null;
  expiration_date: string | null;
  approved_by: string | null;
  approval_date: string | null;
  conditions: string | null;
  proctoring_required: boolean;
  proctor_staff_id: string | null;
  cases_required: number | null;
  cases_completed: number | null;
  source_system: SourceSystem | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

export type HCStaffPrivilegeInsert = Omit<
  HCStaffPrivilege,
  'privilege_id' | 'created_at' | 'updated_at'
>;
export type HCStaffPrivilegeUpdate = Partial<
  Omit<HCStaffPrivilegeInsert, 'staff_id' | 'facility_id'>
>;
