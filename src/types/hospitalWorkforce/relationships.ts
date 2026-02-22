/**
 * Hospital Workforce - Reporting Relationships, Provider Groups & EHR Mappings
 *
 * Defines supervisor/reporting relationships, provider group affiliations,
 * and EHR/EMR system user mappings for the hc_* schema.
 */

import type { SourceSystem } from './organization';

// ============================================================================
// SUPERVISOR/REPORTING RELATIONSHIPS
// ============================================================================

/**
 * Reporting relationship types
 */
export type ReportingRelationshipType =
  | 'DIRECT_REPORT'
  | 'CLINICAL_SUPERVISOR'
  | 'ADMINISTRATIVE';

/**
 * Staff reporting relationship
 */
export interface HCStaffReporting {
  reporting_id: string;
  staff_id: string;
  supervisor_id: string;
  relationship_type: ReportingRelationshipType;
  effective_date: string;
  end_date: string | null;
  source_system: SourceSystem | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

export type HCStaffReportingInsert = Omit<
  HCStaffReporting,
  'reporting_id' | 'created_at' | 'updated_at'
>;
export type HCStaffReportingUpdate = Partial<
  Omit<HCStaffReportingInsert, 'staff_id'>
>;

// ============================================================================
// PROVIDER GROUP AFFILIATIONS
// ============================================================================

/**
 * Provider group
 */
export interface HCProviderGroup {
  group_id: string;
  organization_id: string;
  group_name: string;
  group_npi: string | null;
  tax_id: string | null;
  is_active: boolean;
  source_system: SourceSystem | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

export type HCProviderGroupInsert = Omit<
  HCProviderGroup,
  'group_id' | 'created_at' | 'updated_at'
>;
export type HCProviderGroupUpdate = Partial<
  Omit<HCProviderGroupInsert, 'organization_id'>
>;

/**
 * Affiliation types
 */
export type AffiliationType =
  | 'MEMBER'
  | 'PARTNER'
  | 'EMPLOYEE'
  | 'CONTRACTOR';

/**
 * Staff group affiliation
 */
export interface HCStaffGroupAffiliation {
  affiliation_id: string;
  staff_id: string;
  group_id: string;
  affiliation_type: AffiliationType | null;
  effective_date: string | null;
  end_date: string | null;
  is_primary: boolean;
  source_system: SourceSystem | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

export type HCStaffGroupAffiliationInsert = Omit<
  HCStaffGroupAffiliation,
  'affiliation_id' | 'created_at' | 'updated_at'
>;
export type HCStaffGroupAffiliationUpdate = Partial<
  Omit<HCStaffGroupAffiliationInsert, 'staff_id' | 'group_id'>
>;

// ============================================================================
// EHR/EMR SYSTEM USER MAPPINGS
// ============================================================================

/**
 * EHR system types
 */
export type EHRSystem =
  | 'EPIC'
  | 'CERNER'
  | 'MEDITECH'
  | 'ATHENA'
  | 'ALLSCRIPTS'
  | 'NEXTGEN'
  | 'ECLINICALWORKS';

/**
 * Staff EHR system mapping
 */
export interface HCStaffEHRMapping {
  mapping_id: string;
  staff_id: string;
  ehr_system: EHRSystem;
  ehr_user_id: string;
  ehr_provider_id: string | null;
  ehr_login: string | null;
  ehr_department_id: string | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export type HCStaffEHRMappingInsert = Omit<
  HCStaffEHRMapping,
  'mapping_id' | 'created_at' | 'updated_at'
>;
export type HCStaffEHRMappingUpdate = Partial<
  Omit<HCStaffEHRMappingInsert, 'staff_id' | 'ehr_system'>
>;
