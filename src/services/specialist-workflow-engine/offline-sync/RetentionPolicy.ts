/**
 * Retention Policy Service
 *
 * Manages data retention and storage quota for offline healthcare data.
 * Ensures compliance with healthcare data retention requirements while
 * preventing storage overflow.
 *
 * Features:
 * - Configurable retention periods by data type
 * - Automatic cleanup of synced data
 * - Storage quota monitoring and enforcement
 * - Graceful eviction when quota exceeded
 * - Preservation of unsynced data (never lose clinical data)
 */

import { auditLogger } from '../../auditLogger';
import type { ServiceResult } from '../../_base/ServiceResult';
import { success, failure } from '../../_base/ServiceResult';
import type { RetentionPolicy, SyncState, EnterpriseOfflineRecord } from './types';

/**
 * Default retention policy (HIPAA-aligned)
 */
const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  // Synced records: keep for 7 days (local cache)
  syncedRecordsRetention: 7 * 24 * 60 * 60 * 1000,

  // Failed records: keep for 30 days (allow manual retry)
  failedRecordsRetention: 30 * 24 * 60 * 60 * 1000,

  // Audit logs: keep for 90 days (compliance requirement)
  auditLogsRetention: 90 * 24 * 60 * 60 * 1000,

  // Maximum storage: 100MB
  maxStorageBytes: 100 * 1024 * 1024,

  // Warning at 70% usage
  storageWarningThreshold: 0.7,

  // Critical at 90% usage
  storageCriticalThreshold: 0.9,

  // Auto-cleanup enabled
  autoCleanupEnabled: true,

  // Cleanup every hour
  cleanupIntervalMs: 60 * 60 * 1000,
};

/**
 * Cleanup result
 */
export interface CleanupResult {
  /** Records cleaned up */
  recordsRemoved: number;

  /** Bytes freed */
  bytesFreed: number;

  /** Time taken in ms */
  durationMs: number;

  /** Errors encountered */
  errors: string[];

  /** Records preserved (unsynced) */
  recordsPreserved: number;
}

/**
 * Storage status
 */
export interface StorageStatus {
  /** Total quota in bytes */
  quota: number;

  /** Current usage in bytes */
  usage: number;

  /** Usage percentage (0-100) */
  usagePercent: number;

  /** Status level */
  level: 'normal' | 'warning' | 'critical' | 'exceeded';

  /** Available space in bytes */
  available: number;
}

/**
 * Eviction candidate
 */
interface EvictionCandidate {
  id: string;
  store: string;
  syncState: SyncState;
  updatedAt: number;
  sizeBytes: number;
  priority: number; // Lower = evict first
}

/**
 * Retention Policy Service
 */
export class RetentionPolicyService {
  private policy: RetentionPolicy;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private isCleanupRunning = false;

  constructor(policy?: Partial<RetentionPolicy>) {
    this.policy = {
      ...DEFAULT_RETENTION_POLICY,
      ...policy,
    };
  }

  /**
   * Start automatic cleanup
   */
  startAutoCleanup(): void {
    if (!this.policy.autoCleanupEnabled) return;

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(async () => {
      await this.runCleanup();
    }, this.policy.cleanupIntervalMs);

    // Run initial cleanup
    void this.runCleanup();
  }

  /**
   * Stop automatic cleanup
   */
  stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Run cleanup based on retention policy
   */
  async runCleanup(): Promise<ServiceResult<CleanupResult>> {
    if (this.isCleanupRunning) {
      return failure('OPERATION_FAILED', 'Cleanup already in progress');
    }

    this.isCleanupRunning = true;
    const startTime = Date.now();
    const errors: string[] = [];
    let recordsRemoved = 0;
    let bytesFreed = 0;
    let recordsPreserved = 0;

    try {
      const now = Date.now();

      // Get all stores to clean
      const stores = ['visits', 'assessments', 'photos', 'alerts'];

      for (const storeName of stores) {
        try {
          const storeResult = await this.cleanupStore(
            storeName,
            now - this.policy.syncedRecordsRetention,
            now - this.policy.failedRecordsRetention
          );

          recordsRemoved += storeResult.removed;
          bytesFreed += storeResult.bytesFreed;
          recordsPreserved += storeResult.preserved;
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`${storeName}: ${errorMessage}`);
        }
      }

      // Clean audit logs separately (longer retention)
      try {
        const auditResult = await this.cleanupAuditLogs(now - this.policy.auditLogsRetention);
        recordsRemoved += auditResult.removed;
        bytesFreed += auditResult.bytesFreed;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`auditLogs: ${errorMessage}`);
      }

      const result: CleanupResult = {
        recordsRemoved,
        bytesFreed,
        durationMs: Date.now() - startTime,
        errors,
        recordsPreserved,
      };

      if (recordsRemoved > 0) {
        await auditLogger.info('RETENTION_CLEANUP_COMPLETED', {
          recordsRemoved,
          bytesFreed,
          recordsPreserved,
          durationMs: result.durationMs,
          errorCount: errors.length,
        });
      }

      return success(result);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      await auditLogger.error('RETENTION_CLEANUP_FAILED', errorMessage);

      return failure('OPERATION_FAILED', `Cleanup failed: ${errorMessage}`, err);
    } finally {
      this.isCleanupRunning = false;
    }
  }

  /**
   * Check storage status
   */
  async checkStorageStatus(): Promise<ServiceResult<StorageStatus>> {
    try {
      let quota = this.policy.maxStorageBytes;
      let usage = 0;

      // Try to get actual storage quota if available
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        if (estimate.quota) {
          // Use the smaller of browser quota and configured max
          quota = Math.min(estimate.quota, this.policy.maxStorageBytes);
        }
        usage = estimate.usage || 0;
      }

      const usagePercent = quota > 0 ? (usage / quota) * 100 : 0;
      const available = Math.max(0, quota - usage);

      let level: StorageStatus['level'] = 'normal';
      if (usagePercent >= 100) {
        level = 'exceeded';
      } else if (usagePercent >= this.policy.storageCriticalThreshold * 100) {
        level = 'critical';
      } else if (usagePercent >= this.policy.storageWarningThreshold * 100) {
        level = 'warning';
      }

      return success({
        quota,
        usage,
        usagePercent,
        level,
        available,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return failure('OPERATION_FAILED', `Storage check failed: ${errorMessage}`, err);
    }
  }

  /**
   * Handle quota exceeded situation
   * Evicts least important synced data to make room
   */
  async handleQuotaExceeded(bytesNeeded: number): Promise<ServiceResult<number>> {
    try {
      const evicted = await this.evictSyncedData(bytesNeeded);

      if (evicted < bytesNeeded) {
        // Couldn't free enough space
        await auditLogger.warn('QUOTA_EVICTION_INSUFFICIENT', {
          bytesNeeded,
          bytesEvicted: evicted,
        });

        return failure(
          'OPERATION_FAILED',
          `Could only free ${evicted} bytes of ${bytesNeeded} needed`
        );
      }

      await auditLogger.info('QUOTA_EVICTION_SUCCESS', {
        bytesNeeded,
        bytesEvicted: evicted,
      });

      return success(evicted);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return failure('OPERATION_FAILED', `Quota handling failed: ${errorMessage}`, err);
    }
  }

  /**
   * Get retention policy
   */
  getPolicy(): RetentionPolicy {
    return { ...this.policy };
  }

  /**
   * Update retention policy
   */
  updatePolicy(updates: Partial<RetentionPolicy>): void {
    this.policy = {
      ...this.policy,
      ...updates,
    };

    // Restart auto-cleanup with new interval if changed
    if (updates.cleanupIntervalMs && this.cleanupTimer) {
      this.stopAutoCleanup();
      this.startAutoCleanup();
    }
  }

  /**
   * Calculate storage needed for a record
   */
  estimateRecordSize(record: EnterpriseOfflineRecord): number {
    // Rough estimate based on JSON stringification
    return JSON.stringify(record).length * 2; // UTF-16 characters = 2 bytes each
  }

  /**
   * Check if there's room for a new record
   */
  async canStoreRecord(recordSizeBytes: number): Promise<boolean> {
    const statusResult = await this.checkStorageStatus();

    if (!statusResult.success) {
      return false;
    }

    return statusResult.data.available >= recordSizeBytes;
  }

  // Private helper methods

  /**
   * Clean up a specific store based on retention rules
   */
  private async cleanupStore(
    _storeName: string,
    _syncedCutoff: number,
    _failedCutoff: number
  ): Promise<{ removed: number; bytesFreed: number; preserved: number }> {
    // This would interface with the actual IndexedDB store
    // For now, return mock result - actual implementation would query IndexedDB

    // In real implementation:
    // 1. Open transaction on the store
    // 2. Query records where syncState = 'synced' AND syncedAt < syncedCutoff
    // 3. Query records where syncState = 'permanent_failure' AND updatedAt < failedCutoff
    // 4. Delete those records
    // 5. Never delete 'pending' or 'failed' records (unsynced data)

    return {
      removed: 0,
      bytesFreed: 0,
      preserved: 0,
    };
  }

  /**
   * Clean up audit logs based on retention
   */
  private async cleanupAuditLogs(
    _cutoff: number
  ): Promise<{ removed: number; bytesFreed: number }> {
    // This would interface with the audit log IndexedDB store
    // Only delete logs that have been synced to server

    return {
      removed: 0,
      bytesFreed: 0,
    };
  }

  /**
   * Evict synced data to free space
   * Prioritizes oldest, least important synced data
   */
  private async evictSyncedData(bytesNeeded: number): Promise<number> {
    // Get eviction candidates (synced records only - never evict unsynced)
    const candidates = await this.getEvictionCandidates();

    // Sort by priority (lowest first)
    candidates.sort((a, b) => a.priority - b.priority);

    let bytesEvicted = 0;

    for (const candidate of candidates) {
      if (bytesEvicted >= bytesNeeded) break;

      try {
        await this.deleteRecord(candidate.store, candidate.id);
        bytesEvicted += candidate.sizeBytes;
      } catch {
        // Continue with next candidate
      }
    }

    return bytesEvicted;
  }

  /**
   * Get candidates for eviction
   */
  private async getEvictionCandidates(): Promise<EvictionCandidate[]> {
    // In real implementation:
    // 1. Query all stores for synced records
    // 2. Calculate priority based on:
    //    - Age (older = lower priority)
    //    - Type (photos > assessments > visits)
    //    - Size (larger = evict first to free more space)
    // 3. Never include unsynced records

    return [];
  }

  /**
   * Delete a record from a store
   */
  private async deleteRecord(_store: string, _id: string): Promise<void> {
    // In real implementation:
    // Open IndexedDB transaction and delete the record
  }
}

/**
 * Create retention policy service instance
 */
export function createRetentionPolicy(
  policy?: Partial<RetentionPolicy>
): RetentionPolicyService {
  return new RetentionPolicyService(policy);
}

/**
 * Get default retention policy
 */
export function getDefaultRetentionPolicy(): RetentionPolicy {
  return { ...DEFAULT_RETENTION_POLICY };
}
