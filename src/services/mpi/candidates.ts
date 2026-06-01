/**
 * MPI Matching — match candidate lifecycle (create, list, review, stats)
 *
 * Extracted from mpiMatchingService.ts (CLAUDE.md Commandment #12). Behavior unchanged.
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import { ServiceResult, success, failure } from '../_base';
import type { MPIMatchCandidate, MPIPriority } from './types';
import { AUTO_MERGE_THRESHOLD, MATCH_ALGORITHM_VERSION } from './matchingUtils';

/**
 * Create a match candidate for review
 */
export async function createMatchCandidate(
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
export async function getPendingCandidates(
  tenantId: string,
  options: { limit?: number; offset?: number; priority?: MPIPriority } = {}
): Promise<ServiceResult<MPIMatchCandidate[]>> {
  try {
    let query = supabase
      .from('mpi_match_candidates')
      .select('id, patient_id_a, patient_id_b, identity_record_a, identity_record_b, tenant_id, overall_match_score, match_algorithm_version, field_scores, matching_fields_used, blocking_key, status, priority, reviewed_by, reviewed_at, review_decision, review_notes, auto_match_eligible, auto_match_blocked_reason, detected_at, created_at, updated_at')
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
export async function reviewMatchCandidate(
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
 * Get candidate statistics for a tenant
 */
export async function getCandidateStats(
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
