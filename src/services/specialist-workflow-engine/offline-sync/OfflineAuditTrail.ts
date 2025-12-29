/**
 * Offline Audit Trail Service
 *
 * HIPAA §164.312(b) Compliant Audit Controls
 *
 * Captures all PHI access and modifications while offline and ensures
 * the audit trail is synchronized to the server before clinical data.
 *
 * Critical Requirements:
 * 1. Audit logs are written BEFORE the action (intent logging)
 * 2. Audit logs sync BEFORE clinical data (ensures trail even if data sync fails)
 * 3. All PHI access is logged regardless of online/offline state
 * 4. Audit logs are never deleted locally until confirmed synced
 */

import { supabase } from '../../../lib/supabaseClient';
import { auditLogger } from '../../auditLogger';
import type { ServiceResult } from '../../_base/ServiceResult';
import { success, failure } from '../../_base/ServiceResult';
import type { OfflineAuditEntry } from './types';

/**
 * Audit action types for healthcare operations
 */
export type AuditAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'sync'
  | 'encrypt'
  | 'decrypt'
  | 'export'
  | 'print'
  | 'share'
  | 'acknowledge';

/**
 * Resource types that can be audited
 */
export type AuditResourceType =
  | 'field_visit'
  | 'assessment'
  | 'photo'
  | 'alert'
  | 'patient'
  | 'sync_bundle'
  | 'encryption_key';

/**
 * Configuration for the offline audit trail
 */
export interface OfflineAuditConfig {
  /** Tenant ID for isolation */
  tenantId: string;

  /** User performing actions */
  userId: string;

  /** Device identifier */
  deviceId: string;

  /** Database name for IndexedDB */
  dbName?: string;

  /** Database version */
  dbVersion?: number;

  /** Maximum entries to sync at once */
  batchSize?: number;

  /** Whether to sync audit logs before clinical data */
  syncAuditFirst?: boolean;
}

/**
 * Sync result for audit entries
 */
export interface AuditSyncResult {
  synced: number;
  failed: number;
  pending: number;
  errors: string[];
}

/**
 * Offline Audit Trail Service
 *
 * Provides HIPAA-compliant audit logging for offline healthcare operations
 */
export class OfflineAuditTrail {
  private config: OfflineAuditConfig;
  private db: IDBDatabase | null = null;
  private readonly DB_NAME: string;
  private readonly DB_VERSION: number;
  private readonly STORE_NAME = 'auditLogs';
  private readonly BATCH_SIZE: number;

  constructor(config: OfflineAuditConfig) {
    this.config = config;
    this.DB_NAME = config.dbName || 'WellFitOfflineAudit';
    this.DB_VERSION = config.dbVersion || 1;
    this.BATCH_SIZE = config.batchSize || 100;
  }

  /**
   * Initialize the audit trail database
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open audit database: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });

          // Indexes for efficient querying
          store.createIndex('synced', 'synced', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('resourceType', 'resourceType', { unique: false });
          store.createIndex('patientId', 'patientId', { unique: false });
          store.createIndex('action', 'action', { unique: false });

          // Compound indexes for common queries
          store.createIndex('synced_timestamp', ['synced', 'timestamp'], { unique: false });
          store.createIndex('resourceType_resourceId', ['resourceType', 'resourceId'], {
            unique: false,
          });
        }
      };
    });
  }

  /**
   * Log an action to the offline audit trail
   *
   * This method is synchronous-feeling but actually async -
   * it writes to IndexedDB immediately and returns.
   */
  async log(params: {
    action: AuditAction;
    resourceType: AuditResourceType;
    resourceId: string;
    patientId?: string;
    affectedFields?: string[];
    success?: boolean;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ServiceResult<OfflineAuditEntry>> {
    try {
      await this.ensureInitialized();

      const entry: OfflineAuditEntry = {
        id: this.generateAuditId(),
        timestamp: Date.now(),
        userId: this.config.userId,
        tenantId: this.config.tenantId,
        deviceId: this.config.deviceId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        patientId: params.patientId,
        affectedFields: params.affectedFields,
        success: params.success ?? true,
        errorMessage: params.errorMessage,
        synced: false,
        metadata: params.metadata,
      };

      await this.writeEntry(entry);

      return success(entry);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      // Critical: Even if we can't write to IndexedDB, try to log to console
      // This is a fallback for audit compliance - we never silently fail
      await auditLogger.error('OFFLINE_AUDIT_WRITE_FAILED', errorMessage, {
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
      });

      return failure('DATABASE_ERROR', `Failed to write audit entry: ${errorMessage}`, err);
    }
  }

  /**
   * Log PHI access (convenience method for HIPAA compliance)
   */
  async logPHIAccess(params: {
    action: 'read' | 'create' | 'update' | 'delete' | 'export' | 'print';
    resourceType: AuditResourceType;
    resourceId: string;
    patientId: string;
    affectedFields?: string[];
    accessReason?: string;
  }): Promise<ServiceResult<OfflineAuditEntry>> {
    return this.log({
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      patientId: params.patientId,
      affectedFields: params.affectedFields,
      success: true,
      metadata: {
        accessType: 'PHI',
        accessReason: params.accessReason || 'treatment',
        hipaaCategory: 'access',
      },
    });
  }

  /**
   * Log encryption/decryption operation
   */
  async logEncryptionOp(params: {
    action: 'encrypt' | 'decrypt';
    resourceType: AuditResourceType;
    resourceId: string;
    patientId?: string;
    fieldCount: number;
    success: boolean;
    errorMessage?: string;
  }): Promise<ServiceResult<OfflineAuditEntry>> {
    return this.log({
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      patientId: params.patientId,
      success: params.success,
      errorMessage: params.errorMessage,
      metadata: {
        fieldCount: params.fieldCount,
        encryptionType: 'AES-256-GCM',
      },
    });
  }

  /**
   * Sync audit logs to the server
   *
   * CRITICAL: This must be called BEFORE syncing clinical data
   * to ensure audit trail is preserved even if data sync fails.
   */
  async syncToServer(): Promise<ServiceResult<AuditSyncResult>> {
    try {
      await this.ensureInitialized();

      const unsynced = await this.getUnsyncedEntries();

      if (unsynced.length === 0) {
        return success({
          synced: 0,
          failed: 0,
          pending: 0,
          errors: [],
        });
      }

      let synced = 0;
      let failed = 0;
      const errors: string[] = [];

      // Process in batches to avoid overwhelming the server
      for (let i = 0; i < unsynced.length; i += this.BATCH_SIZE) {
        const batch = unsynced.slice(i, i + this.BATCH_SIZE);

        try {
          // Convert to server format
          const serverEntries = batch.map((entry) => ({
            event_type: `OFFLINE_${entry.action.toUpperCase()}`,
            event_category: entry.patientId ? 'PHI_ACCESS' : 'SYSTEM_EVENT',
            actor_user_id: entry.userId,
            operation: entry.action,
            resource_type: entry.resourceType,
            resource_id: entry.resourceId,
            success: entry.success,
            error_message: entry.errorMessage,
            metadata: {
              ...entry.metadata,
              offlineTimestamp: entry.timestamp,
              deviceId: entry.deviceId,
              patientId: entry.patientId,
              affectedFields: entry.affectedFields,
              tenantId: entry.tenantId,
              syncedFromOffline: true,
            },
          }));

          const { error } = await supabase.from('audit_logs').insert(serverEntries);

          if (error) {
            failed += batch.length;
            errors.push(`Batch ${i / this.BATCH_SIZE}: ${error.message}`);
          } else {
            // Mark entries as synced
            await Promise.all(batch.map((entry) => this.markAsSynced(entry.id)));
            synced += batch.length;
          }
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          failed += batch.length;
          errors.push(`Batch ${i / this.BATCH_SIZE}: ${errorMessage}`);
        }
      }

      const pending = await this.getUnsyncedCount();

      return success({
        synced,
        failed,
        pending,
        errors,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      await auditLogger.error('AUDIT_SYNC_FAILED', errorMessage);

      return failure('OPERATION_FAILED', `Audit sync failed: ${errorMessage}`, err);
    }
  }

  /**
   * Get count of unsynced audit entries
   */
  async getUnsyncedCount(): Promise<number> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('synced');
      const request = index.count(IDBKeyRange.only(false));

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get audit entries for a specific resource
   */
  async getEntriesForResource(
    resourceType: AuditResourceType,
    resourceId: string
  ): Promise<OfflineAuditEntry[]> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('resourceType_resourceId');
      const request = index.getAll(IDBKeyRange.only([resourceType, resourceId]));

      request.onsuccess = () => {
        const entries = request.result as OfflineAuditEntry[];
        resolve(entries.sort((a, b) => b.timestamp - a.timestamp));
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get audit entries for a specific patient
   */
  async getEntriesForPatient(patientId: string): Promise<OfflineAuditEntry[]> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('patientId');
      const request = index.getAll(patientId);

      request.onsuccess = () => {
        const entries = request.result as OfflineAuditEntry[];
        resolve(entries.sort((a, b) => b.timestamp - a.timestamp));
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get recent audit entries
   */
  async getRecentEntries(limit: number = 100): Promise<OfflineAuditEntry[]> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('timestamp');
      const entries: OfflineAuditEntry[] = [];

      const request = index.openCursor(null, 'prev');

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor && entries.length < limit) {
          entries.push(cursor.value as OfflineAuditEntry);
          cursor.continue();
        } else {
          resolve(entries);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear synced entries older than retention period
   */
  async clearSyncedEntries(retentionMs: number): Promise<number> {
    await this.ensureInitialized();

    const cutoff = Date.now() - retentionMs;
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('synced_timestamp');

      // Only delete synced entries older than cutoff
      const range = IDBKeyRange.bound([true, 0], [true, cutoff]);
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        }
      };

      transaction.oncomplete = () => resolve(deletedCount);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Private helper methods

  /**
   * Ensure the database is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }
  }

  /**
   * Write an entry to IndexedDB
   */
  private async writeEntry(entry: OfflineAuditEntry): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.add(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all unsynced entries
   */
  private async getUnsyncedEntries(): Promise<OfflineAuditEntry[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('synced');
      const request = index.getAll(IDBKeyRange.only(false));

      request.onsuccess = () => {
        const entries = request.result as OfflineAuditEntry[];
        // Sort by timestamp to maintain order
        resolve(entries.sort((a, b) => a.timestamp - b.timestamp));
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Mark an entry as synced
   */
  private async markAsSynced(entryId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const getRequest = store.get(entryId);

      getRequest.onsuccess = () => {
        const entry = getRequest.result as OfflineAuditEntry | undefined;
        if (entry) {
          entry.synced = true;
          const updateRequest = store.put(entry);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Generate a unique audit entry ID
   */
  private generateAuditId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 11);
    return `audit-${timestamp}-${random}`;
  }
}

/**
 * Singleton instance for the offline audit trail
 */
let auditTrailInstance: OfflineAuditTrail | null = null;

/**
 * Get or create the offline audit trail instance
 */
export function getOfflineAuditTrail(config: OfflineAuditConfig): OfflineAuditTrail {
  if (
    !auditTrailInstance ||
    auditTrailInstance['config'].tenantId !== config.tenantId ||
    auditTrailInstance['config'].userId !== config.userId
  ) {
    auditTrailInstance = new OfflineAuditTrail(config);
  }
  return auditTrailInstance;
}
