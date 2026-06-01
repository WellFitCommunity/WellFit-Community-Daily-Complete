/**
 * MPI Matching — per-patient duplicate detection orchestration
 *
 * Extracted from mpiMatchingService.ts (CLAUDE.md Commandment #12). Behavior unchanged.
 */

import { auditLogger } from '../auditLogger';
import { ServiceResult, success, failure } from '../_base';
import type { MatchSearchCriteria } from './types';
import { getIdentityRecord, findPotentialMatches } from './identity';
import { createMatchCandidate } from './candidates';

/**
 * Run duplicate detection for a patient (find all potential duplicates)
 */
export async function runDuplicateDetection(
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
