/**
 * MPI Matching — identity records + probabilistic match search
 *
 * Extracted from mpiMatchingService.ts (CLAUDE.md Commandment #12). Behavior unchanged.
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import { ServiceResult, success, failure } from '../_base';
import type {
  MPIIdentityRecord,
  PatientDemographics,
  MatchSearchCriteria,
  MatchResult,
  MPISearchOptions,
} from './types';
import {
  DEFAULT_MATCH_THRESHOLD,
  AUTO_MERGE_THRESHOLD,
  DEFAULT_FIELD_WEIGHTS,
  jaroWinklerSimilarity,
  soundex,
  normalizeName,
  normalizePhone,
} from './matchingUtils';

/**
 * Create or update an MPI identity record for a patient
 */
export async function createIdentityRecord(
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
export async function getIdentityRecord(
  patientId: string,
  tenantId: string
): Promise<ServiceResult<MPIIdentityRecord | null>> {
  try {
    const { data, error } = await supabase
      .from('mpi_identity_records')
      .select('id, patient_id, tenant_id, enterprise_mpi_id, first_name_normalized, last_name_normalized, middle_name_normalized, first_name_soundex, last_name_soundex, first_name_metaphone, last_name_metaphone, date_of_birth, gender, ssn_last_four, phone_normalized, email_normalized, address_normalized, city_normalized, state, zip_code, mrn, mrn_assigning_authority, identity_confidence_score, identity_verified_at, identity_verified_by, verification_method, match_hash, last_matched_at, match_count, is_golden_record, is_active, created_at, updated_at')
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
export async function findPotentialMatches(
  criteria: MatchSearchCriteria,
  options: MPISearchOptions
): Promise<ServiceResult<MatchResult[]>> {
  try {
    const minScore = criteria.minScore ?? DEFAULT_MATCH_THRESHOLD;

    // Build blocking query (performance optimization - narrows search space)
    let query = supabase
      .from('mpi_identity_records')
      .select('id, patient_id, tenant_id, enterprise_mpi_id, first_name_normalized, last_name_normalized, middle_name_normalized, first_name_soundex, last_name_soundex, first_name_metaphone, last_name_metaphone, date_of_birth, gender, ssn_last_four, phone_normalized, email_normalized, address_normalized, city_normalized, state, zip_code, mrn, mrn_assigning_authority, identity_confidence_score, identity_verified_at, identity_verified_by, verification_method, match_hash, last_matched_at, match_count, is_golden_record, is_active, created_at, updated_at')
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
