/**
 * Conflict Resolution Service
 *
 * Implements distributed conflict detection and resolution for offline healthcare data.
 * Uses vector clocks for accurate causality tracking across devices.
 *
 * Healthcare-Specific Requirements:
 * 1. Clinical data conflicts require review (never auto-resolve PHI)
 * 2. Vital signs and medications use "most recent wins" for safety
 * 3. Assessments and notes require manual merge
 * 4. Photos/media are never auto-deleted (regulatory requirement)
 */

import { auditLogger } from '../../auditLogger';
import type { ServiceResult } from '../../_base/ServiceResult';
import { success, failure } from '../../_base/ServiceResult';
import type {
  EnterpriseOfflineRecord,
  VectorClock,
  ConflictStrategy,
  ConflictDetectionResult,
  OfflineFieldVisit,
  OfflineAssessment,
  OfflinePhoto,
  OfflineAlert,
} from './types';

/**
 * Conflict severity for prioritization
 */
export type ConflictSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Detailed conflict information
 */
export interface ConflictInfo {
  /** Unique conflict ID */
  conflictId: string;

  /** When conflict was detected */
  detectedAt: number;

  /** Type of conflict */
  type: 'version_mismatch' | 'concurrent_edit' | 'deleted_on_server' | 'schema_mismatch';

  /** Severity of the conflict */
  severity: ConflictSeverity;

  /** Local record */
  localRecord: EnterpriseOfflineRecord;

  /** Server record (if available) */
  serverRecord?: EnterpriseOfflineRecord;

  /** Fields that conflict */
  conflictingFields: string[];

  /** Recommended resolution strategy */
  recommendedStrategy: ConflictStrategy;

  /** Whether this affects PHI */
  affectsPHI: boolean;

  /** Clinical significance (for healthcare) */
  clinicalSignificance?: 'none' | 'minor' | 'significant' | 'critical';
}

/**
 * Merge result for conflict resolution
 */
export interface MergeResult<T extends EnterpriseOfflineRecord> {
  /** Whether merge was successful */
  success: boolean;

  /** Merged record (if successful) */
  mergedRecord?: T;

  /** Fields that couldn't be auto-merged */
  unresolvedFields?: string[];

  /** Whether manual review is required */
  requiresManualReview: boolean;

  /** Reason for manual review */
  manualReviewReason?: string;
}

/**
 * PHI fields that require clinical review for conflicts
 */
const CLINICAL_REVIEW_FIELDS = [
  'findings',
  'recommendations',
  'severity',
  'diagnosis',
  'medication',
  'allergies',
  'vitalSigns',
  'labResults',
  'clinicalNotes',
  'progressNotes',
  'treatmentPlan',
  'riskLevel',
  'alertType',
];

/**
 * Fields that can be auto-merged with "last write wins"
 */
const AUTO_MERGE_FIELDS = [
  'status',
  'acknowledged',
  'acknowledgedBy',
  'acknowledgedAt',
  'checkOutLocation',
  'endTime',
  'durationMinutes',
  'storageUrl',
];

/**
 * Conflict Resolution Service
 */
export class ConflictResolutionService {
  private deviceId: string;

  constructor(deviceId: string) {
    this.deviceId = deviceId;
  }

  /**
   * Detect if there's a conflict between local and server records
   */
  detectConflict(
    local: EnterpriseOfflineRecord,
    server: EnterpriseOfflineRecord | null
  ): ConflictDetectionResult {
    // No server record means it was deleted or doesn't exist
    if (!server) {
      return {
        hasConflict: local.serverVersion !== undefined && local.serverVersion > 0,
        conflictType: 'deleted_on_server',
        localRecord: local,
        serverRecord: undefined,
        recommendedStrategy: 'manual',
        conflictingFields: ['*'],
      };
    }

    // Compare vector clocks
    const clockComparison = this.compareVectorClocks(local.vectorClock, server.vectorClock);

    // Concurrent edits (neither clock dominates)
    if (clockComparison === 'concurrent') {
      const conflictingFields = this.findConflictingFields(local, server);

      return {
        hasConflict: true,
        conflictType: 'concurrent_edit',
        localRecord: local,
        serverRecord: server,
        recommendedStrategy: this.determineStrategy(local, conflictingFields),
        conflictingFields,
      };
    }

    // Local is behind server
    if (clockComparison === 'before') {
      return {
        hasConflict: true,
        conflictType: 'version_mismatch',
        localRecord: local,
        serverRecord: server,
        recommendedStrategy: 'server_wins',
        conflictingFields: this.findConflictingFields(local, server),
      };
    }

    // Local is ahead (normal case - local changes to sync)
    return {
      hasConflict: false,
      conflictType: undefined,
      localRecord: local,
      serverRecord: server,
      recommendedStrategy: 'client_wins',
    };
  }

  /**
   * Get detailed conflict information
   */
  getConflictInfo(
    local: EnterpriseOfflineRecord,
    server: EnterpriseOfflineRecord | null
  ): ServiceResult<ConflictInfo | null> {
    try {
      const detection = this.detectConflict(local, server);

      if (!detection.hasConflict) {
        return success(null);
      }

      const conflictingFields = detection.conflictingFields || [];
      const affectsPHI = conflictingFields.some((f) =>
        CLINICAL_REVIEW_FIELDS.some((cf) => f.toLowerCase().includes(cf.toLowerCase()))
      );

      const info: ConflictInfo = {
        conflictId: `conflict-${local.id}-${Date.now()}`,
        detectedAt: Date.now(),
        type: detection.conflictType || 'concurrent_edit',
        severity: this.calculateConflictSeverity(conflictingFields, affectsPHI),
        localRecord: local,
        serverRecord: server || undefined,
        conflictingFields,
        recommendedStrategy: detection.recommendedStrategy,
        affectsPHI,
        clinicalSignificance: affectsPHI ? 'significant' : 'none',
      };

      return success(info);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return failure('OPERATION_FAILED', `Failed to analyze conflict: ${errorMessage}`, err);
    }
  }

  /**
   * Attempt to automatically merge conflicting records
   */
  attemptAutoMerge<T extends EnterpriseOfflineRecord>(
    local: T,
    server: T
  ): MergeResult<T> {
    const conflictingFields = this.findConflictingFields(local, server);

    // Check if any conflicting field requires clinical review
    const requiresReview = conflictingFields.some((field) =>
      CLINICAL_REVIEW_FIELDS.some((cf) => field.toLowerCase().includes(cf.toLowerCase()))
    );

    if (requiresReview) {
      return {
        success: false,
        unresolvedFields: conflictingFields,
        requiresManualReview: true,
        manualReviewReason: 'Clinical data conflicts require clinician review',
      };
    }

    // Try auto-merge for safe fields
    const merged = { ...server } as T;
    const unresolvedFields: string[] = [];

    for (const field of conflictingFields) {
      if (AUTO_MERGE_FIELDS.includes(field)) {
        // Last write wins for auto-merge fields
        if (local.updatedAt > server.updatedAt) {
          (merged as Record<string, unknown>)[field] = (local as Record<string, unknown>)[field];
        }
      } else {
        unresolvedFields.push(field);
      }
    }

    if (unresolvedFields.length > 0) {
      return {
        success: false,
        mergedRecord: merged,
        unresolvedFields,
        requiresManualReview: true,
        manualReviewReason: `Fields require manual resolution: ${unresolvedFields.join(', ')}`,
      };
    }

    // Update version metadata
    merged.localVersion = Math.max(local.localVersion, server.localVersion || 0) + 1;
    merged.vectorClock = this.mergeVectorClocks(local.vectorClock, server.vectorClock);
    merged.updatedAt = Date.now();
    merged.conflictState = 'resolved';
    merged.conflictResolution = 'merge';

    return {
      success: true,
      mergedRecord: merged,
      requiresManualReview: false,
    };
  }

  /**
   * Resolve conflict with specified strategy
   */
  async resolveConflict<T extends EnterpriseOfflineRecord>(
    local: T,
    server: T | null,
    strategy: ConflictStrategy,
    resolvedBy: string
  ): Promise<ServiceResult<T>> {
    try {
      let resolved: T;

      switch (strategy) {
        case 'client_wins':
          resolved = this.applyClientWins(local, server);
          break;

        case 'server_wins':
          if (!server) {
            return failure('INVALID_INPUT', 'Cannot use server_wins without server record');
          }
          resolved = this.applyServerWins(local, server);
          break;

        case 'merge':
          if (!server) {
            return failure('INVALID_INPUT', 'Cannot merge without server record');
          }
          const mergeResult = this.attemptAutoMerge(local, server);
          if (!mergeResult.success || !mergeResult.mergedRecord) {
            return failure(
              'OPERATION_FAILED',
              `Merge failed: ${mergeResult.manualReviewReason}`
            );
          }
          resolved = mergeResult.mergedRecord;
          break;

        case 'clinical_review':
          // Mark for clinical review - don't auto-resolve
          resolved = {
            ...local,
            conflictState: 'pending_review',
            conflictingRecord: server || undefined,
          } as T;
          break;

        case 'manual':
        default:
          // Keep local but mark as needing review
          resolved = {
            ...local,
            conflictState: 'detected',
            conflictingRecord: server || undefined,
          } as T;
          break;
      }

      // Update resolution metadata
      resolved.conflictResolvedBy = resolvedBy;
      resolved.conflictResolvedAt = Date.now();

      await auditLogger.info('CONFLICT_RESOLVED', {
        recordId: local.id,
        strategy,
        resolvedBy,
        conflictType: server ? 'concurrent_edit' : 'deleted_on_server',
      });

      return success(resolved);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      await auditLogger.error('CONFLICT_RESOLUTION_FAILED', errorMessage, {
        recordId: local.id,
        strategy,
      });

      return failure('OPERATION_FAILED', `Conflict resolution failed: ${errorMessage}`, err);
    }
  }

  /**
   * Increment vector clock for local changes
   */
  incrementVectorClock(clock: VectorClock): VectorClock {
    const newClock = { ...clock };
    newClock[this.deviceId] = (newClock[this.deviceId] || 0) + 1;
    return newClock;
  }

  /**
   * Create initial vector clock for new record
   */
  createVectorClock(): VectorClock {
    return {
      [this.deviceId]: 1,
    };
  }

  /**
   * Compare two vector clocks
   * Returns: 'before' | 'after' | 'equal' | 'concurrent'
   */
  compareVectorClocks(
    clock1: VectorClock,
    clock2: VectorClock
  ): 'before' | 'after' | 'equal' | 'concurrent' {
    const allNodes = new Set([...Object.keys(clock1), ...Object.keys(clock2)]);

    let clock1Ahead = false;
    let clock2Ahead = false;

    for (const node of allNodes) {
      const t1 = clock1[node] || 0;
      const t2 = clock2[node] || 0;

      if (t1 > t2) clock1Ahead = true;
      if (t2 > t1) clock2Ahead = true;
    }

    if (clock1Ahead && clock2Ahead) return 'concurrent';
    if (clock1Ahead) return 'after';
    if (clock2Ahead) return 'before';
    return 'equal';
  }

  /**
   * Merge two vector clocks (take maximum for each node)
   */
  mergeVectorClocks(clock1: VectorClock, clock2: VectorClock): VectorClock {
    const merged: VectorClock = { ...clock1 };

    for (const [node, time] of Object.entries(clock2)) {
      merged[node] = Math.max(merged[node] || 0, time);
    }

    // Increment for the merge operation
    merged[this.deviceId] = (merged[this.deviceId] || 0) + 1;

    return merged;
  }

  // Private helper methods

  /**
   * Find fields that have different values between two records
   */
  private findConflictingFields(
    local: EnterpriseOfflineRecord,
    server: EnterpriseOfflineRecord
  ): string[] {
    const conflicts: string[] = [];

    // Fields to check (excluding metadata)
    const excludeFields = new Set([
      'id',
      'tenantId',
      'userId',
      'syncState',
      'createdAt',
      'updatedAt',
      'serverTimestamp',
      'syncedAt',
      'localVersion',
      'serverVersion',
      'vectorClock',
      'revisionId',
      'parentRevisionId',
      'conflictState',
      'conflictingRecord',
      'conflictResolution',
      'conflictResolvedBy',
      'conflictResolvedAt',
      'checksum',
      'deviceId',
      'encrypted',
      'encryptionKeyId',
    ]);

    const allKeys = new Set([
      ...Object.keys(local),
      ...Object.keys(server),
    ]);

    for (const key of allKeys) {
      if (excludeFields.has(key)) continue;

      // Type cast at boundary - we're inspecting record properties
      const localValue = (local as unknown as Record<string, unknown>)[key];
      const serverValue = (server as unknown as Record<string, unknown>)[key];

      if (!this.deepEqual(localValue, serverValue)) {
        conflicts.push(key);
      }
    }

    return conflicts;
  }

  /**
   * Deep equality check
   */
  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== typeof b) return false;

    if (typeof a === 'object' && typeof b === 'object') {
      const aObj = a as Record<string, unknown>;
      const bObj = b as Record<string, unknown>;

      const aKeys = Object.keys(aObj);
      const bKeys = Object.keys(bObj);

      if (aKeys.length !== bKeys.length) return false;

      for (const key of aKeys) {
        if (!this.deepEqual(aObj[key], bObj[key])) return false;
      }

      return true;
    }

    return false;
  }

  /**
   * Determine best strategy based on record type and conflicting fields
   */
  private determineStrategy(
    record: EnterpriseOfflineRecord,
    conflictingFields: string[]
  ): ConflictStrategy {
    // Check if any field requires clinical review
    const hasClinicalFields = conflictingFields.some((f) =>
      CLINICAL_REVIEW_FIELDS.some((cf) => f.toLowerCase().includes(cf.toLowerCase()))
    );

    if (hasClinicalFields) {
      return 'clinical_review';
    }

    // Check if all fields can be auto-merged
    const allAutoMergeable = conflictingFields.every((f) => AUTO_MERGE_FIELDS.includes(f));

    if (allAutoMergeable) {
      return 'merge';
    }

    // Default to manual for safety
    return 'manual';
  }

  /**
   * Calculate conflict severity
   */
  private calculateConflictSeverity(
    conflictingFields: string[],
    affectsPHI: boolean
  ): ConflictSeverity {
    if (affectsPHI) {
      // PHI conflicts are always high severity
      const hasCriticalFields = conflictingFields.some((f) =>
        ['medication', 'allergies', 'diagnosis', 'treatmentPlan'].some((cf) =>
          f.toLowerCase().includes(cf.toLowerCase())
        )
      );

      return hasCriticalFields ? 'critical' : 'high';
    }

    if (conflictingFields.length > 5) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Apply "client wins" strategy
   */
  private applyClientWins<T extends EnterpriseOfflineRecord>(
    local: T,
    server: T | null
  ): T {
    return {
      ...local,
      localVersion: local.localVersion + 1,
      serverVersion: server?.serverVersion,
      vectorClock: server
        ? this.mergeVectorClocks(local.vectorClock, server.vectorClock)
        : this.incrementVectorClock(local.vectorClock),
      conflictState: 'resolved',
      conflictResolution: 'client_wins',
      updatedAt: Date.now(),
    };
  }

  /**
   * Apply "server wins" strategy
   */
  private applyServerWins<T extends EnterpriseOfflineRecord>(
    local: T,
    server: T
  ): T {
    return {
      ...server,
      // Preserve local tracking metadata
      syncState: 'synced',
      syncedAt: Date.now(),
      deviceId: local.deviceId,
      conflictState: 'resolved',
      conflictResolution: 'server_wins',
    };
  }
}

/**
 * Create a conflict resolution service instance
 */
export function createConflictResolver(deviceId: string): ConflictResolutionService {
  return new ConflictResolutionService(deviceId);
}
