/**
 * MPI Matching Service - Master Patient Index Matching Operations
 *
 * Purpose: Probabilistic patient matching using Jaro-Winkler, Soundex, and weighted scoring
 * Features: Duplicate detection, match candidate queueing, cross-tenant enterprise MPI
 *
 * @module services/mpiMatchingService
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

// =============================================================================
// TYPES
// =============================================================================

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

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_MATCH_THRESHOLD = 75.0;
const AUTO_MERGE_THRESHOLD = 98.0;
const MATCH_ALGORITHM_VERSION = 'v1.0-jaro-soundex';
const DEFAULT_FIELD_WEIGHTS: Record<string, number> = {
  first_name: 15,
  last_name: 20,
  date_of_birth: 25,
  ssn_last_four: 15,
  phone: 10,
  address: 10,
  mrn: 5,
};

// =============================================================================
// JARO-WINKLER IMPLEMENTATION (Client-side matching)
// =============================================================================

/**
 * Calculate Jaro similarity between two strings
 */
function jaroSimilarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;

  const str1 = s1.toUpperCase().trim();
  const str2 = s2.toUpperCase().trim();

  if (str1 === str2) return 1.0;

  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0 || len2 === 0) return 0;

  const maxDist = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - maxDist);
    const end = Math.min(i + maxDist + 1, len2);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || str1[i] !== str2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (str1[i] !== str2[k]) transpositions++;
    k++;
  }

  return (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
}

/**
 * Calculate Jaro-Winkler similarity (enhanced with prefix bonus)
 */
export function jaroWinklerSimilarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;

  const jaro = jaroSimilarity(s1, s2);

  // Calculate common prefix (up to 4 characters)
  const str1 = s1.toUpperCase().trim();
  const str2 = s2.toUpperCase().trim();
  let prefixLength = 0;
  const maxPrefix = Math.min(4, Math.min(str1.length, str2.length));

  for (let i = 0; i < maxPrefix; i++) {
    if (str1[i] === str2[i]) {
      prefixLength++;
    } else {
      break;
    }
  }

  // Apply Winkler modification
  return jaro + prefixLength * 0.1 * (1 - jaro);
}

/**
 * Generate Soundex encoding for phonetic matching
 */
export function soundex(input: string): string | null {
  if (!input || input.trim().length === 0) return null;

  const cleaned = input.toUpperCase().replace(/[^A-Z]/g, '');
  if (cleaned.length === 0) return null;

  const firstChar = cleaned[0];
  let result = firstChar;
  let prevCode = '';

  const getCode = (char: string): string => {
    if ('BFPV'.includes(char)) return '1';
    if ('CGJKQSXZ'.includes(char)) return '2';
    if ('DT'.includes(char)) return '3';
    if (char === 'L') return '4';
    if ('MN'.includes(char)) return '5';
    if (char === 'R') return '6';
    return '';
  };

  for (let i = 1; i < cleaned.length && result.length < 4; i++) {
    const code = getCode(cleaned[i]);
    if (code && code !== prevCode) {
      result += code;
    }
    prevCode = code;
  }

  return result.padEnd(4, '0');
}

/**
 * Normalize name for matching (lowercase, remove diacritics, trim)
 */
export function normalizeName(name: string | null | undefined): string | null {
  if (!name) return null;

  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z ]/g, '') // Remove non-alpha
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

/**
 * Normalize phone number (digits only)
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  return phone.replace(/[^0-9]/g, '');
}

// =============================================================================
// SERVICE METHODS
// =============================================================================

/**
 * Create or update an MPI identity record for a patient
 */
async function createIdentityRecord(
  patientId: string,
  tenantId: string,
  demographics: PatientDemographics
): Promise<ServiceResult<MPIIdentityRecord>> {
  try {
    // Normalize demographics
    const normalizedData = {
      patient_id: patientId,
      tenant_id: tenantId,
      first_name_normalized: normalizeName(demographics.firstName),
      last_name_normalized: normalizeName(demographics.lastName),
      middle_name_normalized: normalizeName(demographics.middleName),
      first_name_soundex: soundex(demographics.firstName),
      last_name_soundex: soundex(demographics.lastName),
      date_of_birth: demographics.dateOfBirth || null,
      gender: demographics.gender || null,
      ssn_last_four: demographics.ssnLastFour || null,
      phone_normalized: normalizePhone(demographics.phone),
      email_normalized: demographics.email?.toLowerCase().trim() || null,
      address_normalized: normalizeName(demographics.address),
      city_normalized: normalizeName(demographics.city),
      state: demographics.state?.toUpperCase() || null,
      zip_code: demographics.zipCode || null,
      mrn: demographics.mrn || null,
      mrn_assigning_authority: demographics.mrnAssigningAuthority || null,
    };

    const { data, error } = await supabase
      .from('mpi_identity_records')
      .upsert(normalizedData, {
        onConflict: 'patient_id,tenant_id',
      })
      .select()
      .single();

    if (error) {
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: string }).message)
        : String(error);
      await auditLogger.error(
        'MPI_IDENTITY_CREATE_FAILED',
        new Error(errorMessage),
        { patientId, tenantId }
      );
      return failure('DATABASE_ERROR', 'Failed to create identity record', error);
    }

    await auditLogger.info('MPI_IDENTITY_CREATED', {
      patientId,
      tenantId,
      identityRecordId: data.id,
    });

    return success(data as MPIIdentityRecord);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MPI_IDENTITY_CREATE_FAILED', error, { patientId, tenantId });
    return failure('OPERATION_FAILED', 'Failed to create identity record', err);
  }
}

/**
 * Get identity record for a patient
 */
async function getIdentityRecord(
  patientId: string,
  tenantId: string
): Promise<ServiceResult<MPIIdentityRecord | null>> {
  try {
    const { data, error } = await supabase
      .from('mpi_identity_records')
      .select('*')
      .eq('patient_id', patientId)
      .eq('tenant_id', tenantId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return failure('DATABASE_ERROR', 'Failed to get identity record', error);
    }

    return success(data as MPIIdentityRecord | null);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MPI_IDENTITY_GET_FAILED', error, { patientId, tenantId });
    return failure('OPERATION_FAILED', 'Failed to get identity record', err);
  }
}

/**
 * Find potential duplicate patients using blocking and scoring
 */
async function findPotentialMatches(
  criteria: MatchSearchCriteria,
  options: MPISearchOptions
): Promise<ServiceResult<MatchResult[]>> {
  try {
    const minScore = criteria.minScore ?? DEFAULT_MATCH_THRESHOLD;

    // Build blocking query (performance optimization - narrows search space)
    let query = supabase
      .from('mpi_identity_records')
      .select('*')
      .eq('tenant_id', options.tenantId)
      .eq('is_active', true);

    // Apply blocking criteria (at least one must match for candidate selection)
    const blockingConditions: string[] = [];

    if (criteria.lastName) {
      const lastNameSoundex = soundex(criteria.lastName);
      if (lastNameSoundex) {
        blockingConditions.push(`last_name_soundex.eq.${lastNameSoundex}`);
      }
    }

    if (criteria.dateOfBirth) {
      blockingConditions.push(`date_of_birth.eq.${criteria.dateOfBirth}`);
    }

    if (criteria.phone) {
      const normalizedPhone = normalizePhone(criteria.phone);
      if (normalizedPhone) {
        blockingConditions.push(`phone_normalized.eq.${normalizedPhone}`);
      }
    }

    if (criteria.mrn) {
      blockingConditions.push(`mrn.eq.${criteria.mrn}`);
    }

    // If we have blocking conditions, apply OR filter
    if (blockingConditions.length > 0) {
      query = query.or(blockingConditions.join(','));
    }

    // Limit results for performance
    query = query.limit(options.limit ?? 100);
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit ?? 100) - 1);
    }

    const { data: candidates, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to search for matches', error);
    }

    if (!candidates || candidates.length === 0) {
      return success([]);
    }

    // Score each candidate
    const matches: MatchResult[] = [];
    const normalizedFirstName = normalizeName(criteria.firstName);
    const normalizedLastName = normalizeName(criteria.lastName);
    const normalizedPhone = normalizePhone(criteria.phone);

    for (const candidate of candidates) {
      const fieldScores: Record<string, number> = {};
      const matchedFields: string[] = [];
      let totalScore = 0;
      let totalWeight = 0;

      // First name comparison
      if (normalizedFirstName && candidate.first_name_normalized) {
        const score = jaroWinklerSimilarity(normalizedFirstName, candidate.first_name_normalized) * 100;
        fieldScores['first_name'] = score;
        totalScore += score * DEFAULT_FIELD_WEIGHTS.first_name;
        totalWeight += DEFAULT_FIELD_WEIGHTS.first_name;
        if (score >= 85) matchedFields.push('first_name');
      }

      // Last name comparison
      if (normalizedLastName && candidate.last_name_normalized) {
        const score = jaroWinklerSimilarity(normalizedLastName, candidate.last_name_normalized) * 100;
        fieldScores['last_name'] = score;
        totalScore += score * DEFAULT_FIELD_WEIGHTS.last_name;
        totalWeight += DEFAULT_FIELD_WEIGHTS.last_name;
        if (score >= 85) matchedFields.push('last_name');
      }

      // Date of birth comparison (exact match)
      if (criteria.dateOfBirth && candidate.date_of_birth) {
        const score = criteria.dateOfBirth === candidate.date_of_birth ? 100 : 0;
        fieldScores['date_of_birth'] = score;
        totalScore += score * DEFAULT_FIELD_WEIGHTS.date_of_birth;
        totalWeight += DEFAULT_FIELD_WEIGHTS.date_of_birth;
        if (score === 100) matchedFields.push('date_of_birth');
      }

      // Phone comparison (exact match on normalized)
      if (normalizedPhone && candidate.phone_normalized) {
        const score = normalizedPhone === candidate.phone_normalized ? 100 : 0;
        fieldScores['phone'] = score;
        totalScore += score * DEFAULT_FIELD_WEIGHTS.phone;
        totalWeight += DEFAULT_FIELD_WEIGHTS.phone;
        if (score === 100) matchedFields.push('phone');
      }

      // MRN comparison (exact match)
      if (criteria.mrn && candidate.mrn) {
        const score = criteria.mrn === candidate.mrn ? 100 : 0;
        fieldScores['mrn'] = score;
        totalScore += score * DEFAULT_FIELD_WEIGHTS.mrn;
        totalWeight += DEFAULT_FIELD_WEIGHTS.mrn;
        if (score === 100) matchedFields.push('mrn');
      }

      // Calculate weighted average
      const overallScore = totalWeight > 0 ? totalScore / totalWeight : 0;

      // Only include if above threshold
      if (overallScore >= minScore) {
        matches.push({
          patientId: candidate.patient_id,
          identityRecordId: candidate.id,
          overallScore,
          fieldScores,
          matchedFields,
          isAutoMatchEligible: overallScore >= AUTO_MERGE_THRESHOLD,
        });
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.overallScore - a.overallScore);

    await auditLogger.info('MPI_SEARCH_COMPLETED', {
      tenantId: options.tenantId,
      criteriaFields: Object.keys(criteria).filter((k) => criteria[k as keyof MatchSearchCriteria]),
      candidateCount: candidates.length,
      matchCount: matches.length,
    });

    return success(matches);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MPI_SEARCH_FAILED', error, { criteria, options });
    return failure('OPERATION_FAILED', 'Failed to find potential matches', err);
  }
}

/**
 * Create a match candidate for review
 */
async function createMatchCandidate(
  patientIdA: string,
  patientIdB: string,
  identityRecordA: string,
  identityRecordB: string,
  tenantId: string,
  overallScore: number,
  fieldScores: Record<string, number>,
  matchedFields: string[]
): Promise<ServiceResult<MPIMatchCandidate>> {
  try {
    // Ensure consistent ordering (A < B)
    const [orderedA, orderedB] =
      patientIdA < patientIdB ? [patientIdA, patientIdB] : [patientIdB, patientIdA];
    const [orderedRecA, orderedRecB] =
      patientIdA < patientIdB
        ? [identityRecordA, identityRecordB]
        : [identityRecordB, identityRecordA];

    // Determine priority based on score
    let priority: MPIPriority = 'normal';
    if (overallScore >= 95) priority = 'high';
    if (overallScore >= 98) priority = 'urgent';

    const { data, error } = await supabase
      .from('mpi_match_candidates')
      .upsert(
        {
          patient_id_a: orderedA,
          patient_id_b: orderedB,
          identity_record_a: orderedRecA,
          identity_record_b: orderedRecB,
          tenant_id: tenantId,
          overall_match_score: overallScore,
          match_algorithm_version: MATCH_ALGORITHM_VERSION,
          field_scores: fieldScores,
          matching_fields_used: matchedFields,
          status: 'pending',
          priority,
          auto_match_eligible: overallScore >= AUTO_MERGE_THRESHOLD,
        },
        {
          onConflict: 'patient_id_a,patient_id_b',
        }
      )
      .select()
      .single();

    if (error) {
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: string }).message)
        : String(error);
      await auditLogger.error(
        'MPI_CANDIDATE_CREATE_FAILED',
        new Error(errorMessage),
        { patientIdA: orderedA, patientIdB: orderedB }
      );
      return failure('DATABASE_ERROR', 'Failed to create match candidate', error);
    }

    await auditLogger.info('MPI_CANDIDATE_CREATED', {
      candidateId: data.id,
      patientIdA: orderedA,
      patientIdB: orderedB,
      overallScore,
      priority,
    });

    return success(data as MPIMatchCandidate);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MPI_CANDIDATE_CREATE_FAILED', error, { patientIdA, patientIdB });
    return failure('OPERATION_FAILED', 'Failed to create match candidate', err);
  }
}

/**
 * Get pending match candidates for review
 */
async function getPendingCandidates(
  tenantId: string,
  options: { limit?: number; offset?: number; priority?: MPIPriority } = {}
): Promise<ServiceResult<MPIMatchCandidate[]>> {
  try {
    let query = supabase
      .from('mpi_match_candidates')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('overall_match_score', { ascending: false })
      .order('detected_at', { ascending: true });

    if (options.priority) {
      query = query.eq('priority', options.priority);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit ?? 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get pending candidates', error);
    }

    return success((data || []) as MPIMatchCandidate[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MPI_GET_CANDIDATES_FAILED', error, { tenantId });
    return failure('OPERATION_FAILED', 'Failed to get pending candidates', err);
  }
}

/**
 * Review a match candidate (confirm or reject)
 */
async function reviewMatchCandidate(
  candidateId: string,
  reviewerId: string,
  decision: 'confirmed_match' | 'confirmed_not_match' | 'deferred',
  notes?: string
): Promise<ServiceResult<MPIMatchCandidate>> {
  try {
    const { data, error } = await supabase
      .from('mpi_match_candidates')
      .update({
        status: decision,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        review_decision:
          decision === 'confirmed_match' ? 'merge' : decision === 'confirmed_not_match' ? 'not_match' : 'defer',
        review_notes: notes,
      })
      .eq('id', candidateId)
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to review candidate', error);
    }

    await auditLogger.info('MPI_CANDIDATE_REVIEWED', {
      candidateId,
      reviewerId,
      decision,
    });

    return success(data as MPIMatchCandidate);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MPI_REVIEW_FAILED', error, { candidateId, reviewerId, decision });
    return failure('OPERATION_FAILED', 'Failed to review candidate', err);
  }
}

/**
 * Get matching configuration for a tenant
 */
async function getMatchingConfig(tenantId: string): Promise<ServiceResult<MPIMatchingConfig | null>> {
  try {
    const { data, error } = await supabase
      .from('mpi_matching_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      return failure('DATABASE_ERROR', 'Failed to get matching config', error);
    }

    return success(data as MPIMatchingConfig | null);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MPI_CONFIG_GET_FAILED', error, { tenantId });
    return failure('OPERATION_FAILED', 'Failed to get matching config', err);
  }
}

/**
 * Update matching configuration for a tenant
 */
async function updateMatchingConfig(
  tenantId: string,
  config: Partial<Omit<MPIMatchingConfig, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>
): Promise<ServiceResult<MPIMatchingConfig>> {
  try {
    const { data, error } = await supabase
      .from('mpi_matching_config')
      .upsert(
        {
          tenant_id: tenantId,
          ...config,
        },
        {
          onConflict: 'tenant_id',
        }
      )
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to update matching config', error);
    }

    await auditLogger.info('MPI_CONFIG_UPDATED', {
      tenantId,
      updatedFields: Object.keys(config),
    });

    return success(data as MPIMatchingConfig);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MPI_CONFIG_UPDATE_FAILED', error, { tenantId });
    return failure('OPERATION_FAILED', 'Failed to update matching config', err);
  }
}

/**
 * Run duplicate detection for a patient (find all potential duplicates)
 */
async function runDuplicateDetection(
  patientId: string,
  tenantId: string
): Promise<ServiceResult<{ matchesFound: number; candidatesCreated: number }>> {
  try {
    // Get the patient's identity record
    const identityResult = await getIdentityRecord(patientId, tenantId);
    if (!identityResult.success || !identityResult.data) {
      return failure('NOT_FOUND', 'Patient identity record not found');
    }

    const identity = identityResult.data;

    // Build search criteria from identity
    const criteria: MatchSearchCriteria = {
      firstName: identity.first_name_normalized || undefined,
      lastName: identity.last_name_normalized || undefined,
      dateOfBirth: identity.date_of_birth || undefined,
      phone: identity.phone_normalized || undefined,
      mrn: identity.mrn || undefined,
    };

    // Find potential matches
    const matchResult = await findPotentialMatches(criteria, {
      tenantId,
      limit: 100,
    });

    if (!matchResult.success) {
      return failure(matchResult.error.code, matchResult.error.message);
    }

    const matches = matchResult.data;

    // Filter out self-match
    const otherMatches = matches.filter((m) => m.patientId !== patientId);

    let candidatesCreated = 0;

    // Create match candidates for each potential duplicate
    for (const match of otherMatches) {
      const candidateResult = await createMatchCandidate(
        patientId,
        match.patientId,
        identity.id,
        match.identityRecordId,
        tenantId,
        match.overallScore,
        match.fieldScores,
        match.matchedFields
      );

      if (candidateResult.success) {
        candidatesCreated++;
      }
    }

    await auditLogger.info('MPI_DUPLICATE_DETECTION_COMPLETED', {
      patientId,
      tenantId,
      matchesFound: otherMatches.length,
      candidatesCreated,
    });

    return success({
      matchesFound: otherMatches.length,
      candidatesCreated,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MPI_DUPLICATE_DETECTION_FAILED', error, { patientId, tenantId });
    return failure('OPERATION_FAILED', 'Failed to run duplicate detection', err);
  }
}

/**
 * Get candidate statistics for a tenant
 */
async function getCandidateStats(
  tenantId: string
): Promise<
  ServiceResult<{
    total: number;
    pending: number;
    underReview: number;
    merged: number;
    confirmedNotMatch: number;
    highPriority: number;
    urgentPriority: number;
  }>
> {
  try {
    // Get counts by status
    const { data: statusCounts, error: statusError } = await supabase
      .from('mpi_match_candidates')
      .select('status, priority')
      .eq('tenant_id', tenantId);

    if (statusError) {
      return failure('DATABASE_ERROR', 'Failed to get candidate stats', statusError);
    }

    const stats = {
      total: statusCounts?.length || 0,
      pending: statusCounts?.filter((c) => c.status === 'pending').length || 0,
      underReview: statusCounts?.filter((c) => c.status === 'under_review').length || 0,
      merged: statusCounts?.filter((c) => c.status === 'merged').length || 0,
      confirmedNotMatch: statusCounts?.filter((c) => c.status === 'confirmed_not_match').length || 0,
      highPriority: statusCounts?.filter((c) => c.priority === 'high' && c.status === 'pending').length || 0,
      urgentPriority: statusCounts?.filter((c) => c.priority === 'urgent' && c.status === 'pending').length || 0,
    };

    return success(stats);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MPI_STATS_FAILED', error, { tenantId });
    return failure('OPERATION_FAILED', 'Failed to get candidate stats', err);
  }
}

/**
 * Link patient to enterprise MPI ID (cross-tenant linking)
 */
async function linkToEnterpriseMPI(
  patientId: string,
  tenantId: string,
  enterpriseMpiId: string
): Promise<ServiceResult<MPIIdentityRecord>> {
  try {
    const { data, error } = await supabase
      .from('mpi_identity_records')
      .update({
        enterprise_mpi_id: enterpriseMpiId,
      })
      .eq('patient_id', patientId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to link to enterprise MPI', error);
    }

    await auditLogger.info('MPI_ENTERPRISE_LINK_CREATED', {
      patientId,
      tenantId,
      enterpriseMpiId,
    });

    return success(data as MPIIdentityRecord);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MPI_ENTERPRISE_LINK_FAILED', error, { patientId, tenantId, enterpriseMpiId });
    return failure('OPERATION_FAILED', 'Failed to link to enterprise MPI', err);
  }
}

/**
 * Get all patients linked to an enterprise MPI ID
 */
async function getEnterpriseMPILinks(
  enterpriseMpiId: string
): Promise<ServiceResult<MPIIdentityRecord[]>> {
  try {
    const { data, error } = await supabase
      .from('mpi_identity_records')
      .select('*')
      .eq('enterprise_mpi_id', enterpriseMpiId)
      .eq('is_active', true);

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get enterprise MPI links', error);
    }

    return success((data || []) as MPIIdentityRecord[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MPI_ENTERPRISE_LINKS_FAILED', error, { enterpriseMpiId });
    return failure('OPERATION_FAILED', 'Failed to get enterprise MPI links', err);
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export const mpiMatchingService = {
  // Core operations
  createIdentityRecord,
  getIdentityRecord,
  findPotentialMatches,

  // Candidate management
  createMatchCandidate,
  getPendingCandidates,
  reviewMatchCandidate,
  getCandidateStats,

  // Duplicate detection
  runDuplicateDetection,

  // Configuration
  getMatchingConfig,
  updateMatchingConfig,

  // Enterprise MPI
  linkToEnterpriseMPI,
  getEnterpriseMPILinks,

  // Utility functions (exported for testing)
  jaroWinklerSimilarity,
  soundex,
  normalizeName,
  normalizePhone,
};

export default mpiMatchingService;
