/**
 * MPI Matching — shared types
 *
 * Extracted from mpiMatchingService.ts (CLAUDE.md Commandment #12).
 */

export interface MPIIdentityRecord {
  id: string;
  patient_id: string;
  tenant_id: string;
  enterprise_mpi_id: string;
  first_name_normalized: string | null;
  last_name_normalized: string | null;
  middle_name_normalized: string | null;
  first_name_soundex: string | null;
  last_name_soundex: string | null;
  first_name_metaphone: string | null;
  last_name_metaphone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  ssn_last_four: string | null;
  phone_normalized: string | null;
  email_normalized: string | null;
  address_normalized: string | null;
  city_normalized: string | null;
  state: string | null;
  zip_code: string | null;
  mrn: string | null;
  mrn_assigning_authority: string | null;
  identity_confidence_score: number;
  identity_verified_at: string | null;
  identity_verified_by: string | null;
  verification_method: string | null;
  match_hash: string | null;
  last_matched_at: string | null;
  match_count: number;
  is_golden_record: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MPIMatchCandidate {
  id: string;
  patient_id_a: string;
  patient_id_b: string;
  identity_record_a: string;
  identity_record_b: string;
  tenant_id: string;
  overall_match_score: number;
  match_algorithm_version: string;
  field_scores: Record<string, number>;
  matching_fields_used: string[];
  blocking_key: string | null;
  status: MPIMatchStatus;
  priority: MPIPriority;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_decision: string | null;
  review_notes: string | null;
  auto_match_eligible: boolean;
  auto_match_blocked_reason: string | null;
  detected_at: string;
  created_at: string;
  updated_at: string;
}

export interface MPIMatchingConfig {
  id: string;
  tenant_id: string;
  auto_merge_threshold: number;
  review_threshold: number;
  definite_no_match_threshold: number;
  field_weights: Record<string, number>;
  blocking_keys: string[];
  use_jaro_winkler: boolean;
  use_soundex: boolean;
  use_metaphone: boolean;
  jaro_winkler_threshold: number;
  require_dob_match: boolean;
  allow_partial_ssn_match: boolean;
  phone_match_weight_boost: number;
  auto_merge_enabled: boolean;
  auto_merge_requires_mrn_match: boolean;
  auto_merge_max_per_day: number;
  default_review_priority: MPIPriority;
  escalate_high_volume: boolean;
  high_volume_threshold: number;
  audit_all_matches: boolean;
  retain_match_history_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type MPIMatchStatus =
  | 'pending'
  | 'under_review'
  | 'confirmed_match'
  | 'confirmed_not_match'
  | 'merged'
  | 'deferred';

export type MPIPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface PatientDemographics {
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth?: string;
  gender?: string;
  ssnLastFour?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  mrn?: string;
  mrnAssigningAuthority?: string;
}

export interface MatchSearchCriteria {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  phone?: string;
  mrn?: string;
  minScore?: number;
}

export interface MatchResult {
  patientId: string;
  identityRecordId: string;
  overallScore: number;
  fieldScores: Record<string, number>;
  matchedFields: string[];
  isAutoMatchEligible: boolean;
}

export interface MPISearchOptions {
  tenantId: string;
  limit?: number;
  offset?: number;
  includeInactive?: boolean;
}
