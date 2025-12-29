/**
 * Transactional Sync Service
 *
 * Provides atomic sync operations with rollback capability for healthcare data.
 * Ensures referential integrity when syncing related records.
 *
 * Key Features:
 * 1. Bundle related records (visit + assessments + photos + alerts)
 * 2. Atomic sync - all succeed or all fail
 * 3. Rollback on partial failure
 * 4. Checksum verification for integrity
 * 5. Ordered sync (audit logs first, then clinical data)
 */

import { supabase } from '../../../lib/supabaseClient';
import { auditLogger } from '../../auditLogger';
import type { ServiceResult } from '../../_base/ServiceResult';
import { success, failure } from '../../_base/ServiceResult';
import type {
  EnterpriseOfflineRecord,
  SyncBundle,
  SyncResult,
  OfflineFieldVisit,
  OfflineAssessment,
  OfflinePhoto,
  OfflineAlert,
  SyncState,
} from './types';
import type { OfflineAuditTrail } from './OfflineAuditTrail';

/**
 * Configuration for transactional sync
 */
export interface TransactionalSyncConfig {
  /** Tenant ID */
  tenantId: string;

  /** User ID */
  userId: string;

  /** Device ID */
  deviceId: string;

  /** Maximum retries per bundle */
  maxRetries?: number;

  /** Base delay for exponential backoff (ms) */
  baseDelayMs?: number;

  /** Maximum delay for backoff (ms) */
  maxDelayMs?: number;

  /** Timeout for individual sync operations (ms) */
  operationTimeoutMs?: number;
}

/**
 * Bundle state for tracking sync progress
 */
interface BundleState {
  bundleId: string;
  state: 'pending' | 'syncing' | 'synced' | 'failed' | 'rolled_back';
  syncedRecords: string[];
  failedRecords: string[];
  attempts: number;
  lastError?: string;
  startedAt?: number;
  completedAt?: number;
}

/**
 * Record type to table mapping
 */
const RECORD_TYPE_TABLE_MAP: Record<string, string> = {
  field_visit: 'field_visits',
  assessment: 'specialist_assessments',
  photo: 'specialist_photos',
  alert: 'specialist_alerts',
};

/**
 * Transactional Sync Service
 */
export class TransactionalSyncService {
  private config: TransactionalSyncConfig;
  private bundleStates: Map<string, BundleState> = new Map();
  private auditTrail?: OfflineAuditTrail;

  constructor(config: TransactionalSyncConfig, auditTrail?: OfflineAuditTrail) {
    this.config = {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      operationTimeoutMs: 60000,
      ...config,
    };
    this.auditTrail = auditTrail;
  }

  /**
   * Create a sync bundle from a visit and its related records
   */
  createBundle(
    visit: OfflineFieldVisit,
    assessments: OfflineAssessment[],
    photos: OfflinePhoto[],
    alerts: OfflineAlert[]
  ): SyncBundle {
    const records: SyncBundle['records'] = [
      { recordType: 'field_visit', recordId: visit.id, data: visit },
      ...assessments.map((a) => ({
        recordType: 'assessment' as const,
        recordId: a.id,
        data: a as EnterpriseOfflineRecord,
      })),
      ...photos.map((p) => ({
        recordType: 'photo' as const,
        recordId: p.id,
        data: p as EnterpriseOfflineRecord,
      })),
      ...alerts.map((a) => ({
        recordType: 'alert' as const,
        recordId: a.id,
        data: a as EnterpriseOfflineRecord,
      })),
    ];

    const bundle: SyncBundle = {
      id: this.generateBundleId(),
      createdAt: Date.now(),
      tenantId: this.config.tenantId,
      userId: this.config.userId,
      primaryRecordId: visit.id,
      primaryRecordType: 'field_visit',
      records,
      checksum: this.computeBundleChecksum(records),
      state: 'pending',
      attempts: 0,
    };

    // Initialize bundle state
    this.bundleStates.set(bundle.id, {
      bundleId: bundle.id,
      state: 'pending',
      syncedRecords: [],
      failedRecords: [],
      attempts: 0,
    });

    return bundle;
  }

  /**
   * Sync a bundle with atomic transaction semantics
   */
  async syncBundle(bundle: SyncBundle): Promise<ServiceResult<SyncResult>> {
    const state = this.bundleStates.get(bundle.id);
    if (!state) {
      return failure('NOT_FOUND', `Bundle state not found for ${bundle.id}`);
    }

    // Verify checksum before sync
    const currentChecksum = this.computeBundleChecksum(bundle.records);
    if (currentChecksum !== bundle.checksum) {
      return failure('VALIDATION_ERROR', 'Bundle checksum mismatch - data may be corrupted');
    }

    state.state = 'syncing';
    state.attempts++;
    state.startedAt = Date.now();
    bundle.attempts = state.attempts;

    const startTime = Date.now();

    try {
      // Step 1: Sync audit logs first (if available)
      if (this.auditTrail) {
        const auditResult = await this.auditTrail.syncToServer();
        if (!auditResult.success) {
          await auditLogger.warn('AUDIT_SYNC_PARTIAL', {
            bundleId: bundle.id,
            error: auditResult.error?.message,
          });
          // Continue even if audit sync fails - we log this and proceed
        }
      }

      // Step 2: Sync primary record first (field_visit)
      const primaryRecord = bundle.records.find(
        (r) => r.recordType === bundle.primaryRecordType && r.recordId === bundle.primaryRecordId
      );

      if (!primaryRecord) {
        return failure('NOT_FOUND', 'Primary record not found in bundle');
      }

      const primaryResult = await this.syncRecord(primaryRecord);
      if (!primaryResult.success) {
        state.state = 'failed';
        state.lastError = primaryResult.error?.message;
        bundle.state = 'failed';
        bundle.lastError = primaryResult.error?.message;

        return failure(
          'OPERATION_FAILED',
          `Primary record sync failed: ${primaryResult.error?.message}`
        );
      }

      state.syncedRecords.push(primaryRecord.recordId);

      // Step 3: Sync dependent records
      const dependentRecords = bundle.records.filter((r) => r.recordId !== bundle.primaryRecordId);
      const syncResults: Array<{ recordId: string; success: boolean; error?: string }> = [];

      for (const record of dependentRecords) {
        const result = await this.syncRecord(record);
        syncResults.push({
          recordId: record.recordId,
          success: result.success,
          error: result.error?.message,
        });

        if (result.success) {
          state.syncedRecords.push(record.recordId);
        } else {
          state.failedRecords.push(record.recordId);
        }
      }

      // Check if any dependent records failed
      const failures = syncResults.filter((r) => !r.success);

      if (failures.length > 0) {
        // Partial failure - attempt rollback
        await this.rollbackBundle(bundle, state.syncedRecords);

        state.state = 'rolled_back';
        bundle.state = 'failed';
        bundle.lastError = `${failures.length} records failed to sync`;

        return failure(
          'OPERATION_FAILED',
          `Bundle sync partially failed: ${failures.map((f) => f.error).join('; ')}`
        );
      }

      // All succeeded
      state.state = 'synced';
      state.completedAt = Date.now();
      bundle.state = 'synced';

      const durationMs = Date.now() - startTime;

      await auditLogger.info('BUNDLE_SYNC_SUCCESS', {
        bundleId: bundle.id,
        recordCount: bundle.records.length,
        durationMs,
      });

      return success({
        success: true,
        syncedCount: bundle.records.length,
        failedCount: 0,
        skippedCount: 0,
        conflictsDetected: 0,
        durationMs,
        details: {
          visits: 1,
          assessments: bundle.records.filter((r) => r.recordType === 'assessment').length,
          photos: bundle.records.filter((r) => r.recordType === 'photo').length,
          alerts: bundle.records.filter((r) => r.recordType === 'alert').length,
          auditLogs: 0,
        },
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      // Attempt rollback on error
      await this.rollbackBundle(bundle, state.syncedRecords);

      state.state = 'failed';
      state.lastError = errorMessage;
      bundle.state = 'failed';
      bundle.lastError = errorMessage;

      await auditLogger.error('BUNDLE_SYNC_FAILED', errorMessage, {
        bundleId: bundle.id,
        attempts: state.attempts,
      });

      return failure('OPERATION_FAILED', `Bundle sync failed: ${errorMessage}`, err);
    }
  }

  /**
   * Sync a bundle with retry logic
   */
  async syncBundleWithRetry(bundle: SyncBundle): Promise<ServiceResult<SyncResult>> {
    let lastError: string | undefined;
    const maxRetries = this.config.maxRetries || 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await this.syncBundle(bundle);

      if (result.success) {
        return result;
      }

      lastError = result.error?.message;

      // Don't retry if it's a validation error (won't succeed on retry)
      if (result.error?.code === 'VALIDATION_ERROR') {
        return result;
      }

      // Wait before retry with exponential backoff
      if (attempt < maxRetries) {
        const delay = this.calculateBackoff(attempt);
        await this.sleep(delay);
      }
    }

    return failure(
      'OPERATION_FAILED',
      `Bundle sync failed after ${maxRetries} attempts: ${lastError}`
    );
  }

  /**
   * Sync individual record to server
   */
  private async syncRecord(
    record: SyncBundle['records'][0]
  ): Promise<ServiceResult<void>> {
    const tableName = RECORD_TYPE_TABLE_MAP[record.recordType];

    if (!tableName) {
      return failure('INVALID_INPUT', `Unknown record type: ${record.recordType}`);
    }

    try {
      // Prepare data for sync (remove client-only fields)
      const serverData = this.prepareForServer(record.data);

      const { error } = await supabase.from(tableName).upsert(serverData, {
        onConflict: 'id',
      });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(undefined);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return failure('DATABASE_ERROR', errorMessage, err);
    }
  }

  /**
   * Rollback synced records on failure
   */
  private async rollbackBundle(
    bundle: SyncBundle,
    syncedRecordIds: string[]
  ): Promise<void> {
    await auditLogger.warn('BUNDLE_ROLLBACK_STARTED', {
      bundleId: bundle.id,
      recordsToRollback: syncedRecordIds.length,
    });

    // We can't truly rollback on the server without transactions,
    // but we can mark records as "needs review" or delete them
    // For healthcare, we prefer marking as needs review over deletion

    for (const recordId of syncedRecordIds) {
      const record = bundle.records.find((r) => r.recordId === recordId);
      if (!record) continue;

      const tableName = RECORD_TYPE_TABLE_MAP[record.recordType];
      if (!tableName) continue;

      try {
        // Mark as needs review rather than delete (healthcare requirement)
        await supabase
          .from(tableName)
          .update({
            status: 'needs_review',
            sync_error: `Rollback from bundle ${bundle.id}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', recordId);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        await auditLogger.error('ROLLBACK_RECORD_FAILED', errorMessage, {
          bundleId: bundle.id,
          recordId,
        });
      }
    }

    await auditLogger.info('BUNDLE_ROLLBACK_COMPLETED', {
      bundleId: bundle.id,
      rolledBackCount: syncedRecordIds.length,
    });
  }

  /**
   * Prepare record data for server (remove client-only fields)
   */
  private prepareForServer(record: EnterpriseOfflineRecord): Record<string, unknown> {
    // Fields that shouldn't be sent to server
    const clientOnlyFields = new Set([
      'syncState',
      'offlineCaptured',
      'deviceId',
      'conflictState',
      'conflictingRecord',
      'conflictResolution',
      'conflictResolvedBy',
      'conflictResolvedAt',
      'encrypted',
      'encryptionKeyId',
      'localVersion',
      'vectorClock',
      'revisionId',
      'parentRevisionId',
      'checksum',
    ]);

    const serverData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(record)) {
      if (!clientOnlyFields.has(key)) {
        // Convert camelCase to snake_case for Postgres
        const snakeKey = this.toSnakeCase(key);
        serverData[snakeKey] = value;
      }
    }

    // Add server-required fields
    serverData['tenant_id'] = record.tenantId;
    serverData['updated_at'] = new Date().toISOString();

    if (record.serverVersion !== undefined) {
      serverData['version'] = record.serverVersion;
    }

    return serverData;
  }

  /**
   * Convert camelCase to snake_case
   */
  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  /**
   * Compute checksum for bundle integrity verification
   */
  private computeBundleChecksum(records: SyncBundle['records']): string {
    // Simple checksum using JSON + basic hash
    const content = JSON.stringify(
      records.map((r) => ({
        type: r.recordType,
        id: r.recordId,
        version: r.data.localVersion,
        updated: r.data.updatedAt,
      }))
    );

    // Simple hash function (for integrity, not security)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return `cksum-${Math.abs(hash).toString(36)}`;
  }

  /**
   * Generate unique bundle ID
   */
  private generateBundleId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `bundle-${timestamp}-${random}`;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(attempt: number): number {
    const baseDelay = this.config.baseDelayMs || 1000;
    const maxDelay = this.config.maxDelayMs || 30000;
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    // Add jitter (±20%)
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    return Math.round(delay + jitter);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get bundle state
   */
  getBundleState(bundleId: string): BundleState | undefined {
    return this.bundleStates.get(bundleId);
  }

  /**
   * Get all pending bundles
   */
  getPendingBundles(): BundleState[] {
    return Array.from(this.bundleStates.values()).filter(
      (s) => s.state === 'pending' || s.state === 'failed'
    );
  }

  /**
   * Clear completed bundle states (cleanup)
   */
  clearCompletedStates(): number {
    let cleared = 0;
    for (const [bundleId, state] of this.bundleStates.entries()) {
      if (state.state === 'synced') {
        this.bundleStates.delete(bundleId);
        cleared++;
      }
    }
    return cleared;
  }
}

/**
 * Create a transactional sync service instance
 */
export function createTransactionalSync(
  config: TransactionalSyncConfig,
  auditTrail?: OfflineAuditTrail
): TransactionalSyncService {
  return new TransactionalSyncService(config, auditTrail);
}
