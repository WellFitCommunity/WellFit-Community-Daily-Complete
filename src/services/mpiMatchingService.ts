/**
 * MPI Matching Service - Master Patient Index Matching Operations
 *
 * Purpose: Probabilistic patient matching using Jaro-Winkler, Soundex, and weighted scoring
 * Features: Duplicate detection, match candidate queueing, cross-tenant enterprise MPI
 *
 * @module services/mpiMatchingService
 *
 * Decomposed 2026-06-01 (CLAUDE.md Commandment #12, 600-line limit). The
 * implementation now lives in cohesive modules under ./mpi/*:
 *   - types.ts            identity/candidate/config/result types
 *   - matchingUtils.ts    Jaro-Winkler, Soundex, normalizers + scoring constants
 *   - identity.ts         identity records + probabilistic match search
 *   - candidates.ts       match candidate create/list/review/stats
 *   - duplicateDetection.ts per-patient duplicate detection orchestration
 *   - config.ts           tenant matching config + enterprise MPI linking
 * The `mpiMatchingService` object, the exported utils, and all types are
 * re-exported below so existing import paths are unchanged.
 */

import {
  createIdentityRecord,
  getIdentityRecord,
  findPotentialMatches,
} from './mpi/identity';
import {
  createMatchCandidate,
  getPendingCandidates,
  reviewMatchCandidate,
  getCandidateStats,
} from './mpi/candidates';
import { runDuplicateDetection } from './mpi/duplicateDetection';
import {
  getMatchingConfig,
  updateMatchingConfig,
  linkToEnterpriseMPI,
  getEnterpriseMPILinks,
} from './mpi/config';
import {
  jaroWinklerSimilarity,
  soundex,
  normalizeName,
  normalizePhone,
} from './mpi/matchingUtils';

// Re-export the public type surface + similarity utilities so existing import
// paths keep working.
export type {
  MPIIdentityRecord,
  MPIMatchCandidate,
  MPIMatchingConfig,
  MPIMatchStatus,
  MPIPriority,
  PatientDemographics,
  MatchSearchCriteria,
  MatchResult,
  MPISearchOptions,
} from './mpi/types';
export {
  jaroWinklerSimilarity,
  soundex,
  normalizeName,
  normalizePhone,
} from './mpi/matchingUtils';

// =============================================================================
// SERVICE OBJECT
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
