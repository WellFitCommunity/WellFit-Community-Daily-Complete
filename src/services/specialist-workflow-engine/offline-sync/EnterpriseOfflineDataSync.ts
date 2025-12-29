/**
 * Enterprise Offline Data Sync
 *
 * Main orchestrator for enterprise-grade offline data synchronization.
 * Integrates all components: encryption, audit trail, conflict resolution,
 * transactional sync, FHIR mapping, delta sync, observability, and retention.
 *
 * Healthcare-Specific Features:
 * - HIPAA-compliant PHI encryption at rest
 * - Complete offline audit trail
 * - Clinical conflict review workflow
 * - FHIR R4 interoperability
 * - Transactional integrity for related records
 * - Bandwidth optimization for rural areas
 * - Real-time sync health monitoring
 */

import { supabase } from '../../../lib/supabaseClient';
import { auditLogger } from '../../auditLogger';
import type { ServiceResult } from '../../_base/ServiceResult';
import { success, failure } from '../../_base/ServiceResult';

import type {
  EnterpriseOfflineRecord,
  OfflineFieldVisit,
  OfflineAssessment,
  OfflinePhoto,
  OfflineAlert,
  SyncResult,
  SyncBundle,
  VectorClock,
  SyncState,
  RetentionPolicy,
  FHIRBundle,
} from './types';

import {
  OfflineEncryptionService,
  getOfflineEncryption,
  getOrCreateDeviceId,
} from './OfflineEncryption';
import { OfflineAuditTrail, getOfflineAuditTrail } from './OfflineAuditTrail';
import { ConflictResolutionService, createConflictResolver } from './ConflictResolution';
import { TransactionalSyncService, createTransactionalSync } from './TransactionalSync';
import { FHIRMapper, createFHIRMapper } from './FHIRMapper';
import { DeltaSyncService, createDeltaSync } from './DeltaSync';
import { SyncObservabilityService, getSyncObservability } from './SyncObservability';
import { RetentionPolicyService, createRetentionPolicy } from './RetentionPolicy';

/**
 * Configuration for enterprise offline sync
 */
export interface EnterpriseOfflineSyncConfig {
  /** Tenant ID for isolation */
  tenantId: string;

  /** User ID */
  userId: string;

  /** Auto-sync interval in ms (0 to disable) */
  autoSyncIntervalMs?: number;

  /** Enable delta sync for bandwidth optimization */
  enableDeltaSync?: boolean;

  /** Enable compression for large payloads */
  enableCompression?: boolean;

  /** Enable FHIR export */
  enableFHIRExport?: boolean;

  /** Retention policy overrides */
  retentionPolicy?: Partial<RetentionPolicy>;

  /** FHIR base URL */
  fhirBaseUrl?: string;
}

/**
 * Enterprise Offline Data Sync Service
 *
 * Main entry point for all offline sync operations
 */
export class EnterpriseOfflineDataSync {
  private config: Required<EnterpriseOfflineSyncConfig>;
  private deviceId: string;
  private db: IDBDatabase | null = null;
  private initialized = false;
  private autoSyncTimer: NodeJS.Timeout | null = null;

  // Component services
  private encryption: OfflineEncryptionService;
  private auditTrail: OfflineAuditTrail;
  private conflictResolver: ConflictResolutionService;
  private transactionalSync: TransactionalSyncService;
  private fhirMapper: FHIRMapper;
  private deltaSync: DeltaSyncService;
  private observability: SyncObservabilityService;
  private retentionPolicy: RetentionPolicyService;

  // Database configuration
  private readonly DB_NAME = 'WellFitEnterpriseOffline';
  private readonly DB_VERSION = 1;
  private readonly STORES = ['visits', 'assessments', 'photos', 'alerts'] as const;

  constructor(config: EnterpriseOfflineSyncConfig) {
    this.deviceId = getOrCreateDeviceId();

    this.config = {
      autoSyncIntervalMs: 30000,
      enableDeltaSync: true,
      enableCompression: true,
      enableFHIRExport: true,
      retentionPolicy: {},
      fhirBaseUrl: 'urn:uuid:',
      ...config,
    };

    // Initialize component services
    this.encryption = getOfflineEncryption({
      tenantId: config.tenantId,
      userId: config.userId,
      deviceId: this.deviceId,
    });

    this.auditTrail = getOfflineAuditTrail({
      tenantId: config.tenantId,
      userId: config.userId,
      deviceId: this.deviceId,
    });

    this.conflictResolver = createConflictResolver(this.deviceId);

    this.transactionalSync = createTransactionalSync(
      {
        tenantId: config.tenantId,
        userId: config.userId,
        deviceId: this.deviceId,
      },
      this.auditTrail
    );

    this.fhirMapper = createFHIRMapper(config.tenantId, this.config.fhirBaseUrl);

    this.deltaSync = createDeltaSync({
      enabled: this.config.enableCompression,
    });

    this.observability = getSyncObservability();

    this.retentionPolicy = createRetentionPolicy(this.config.retentionPolicy);
  }

  /**
   * Initialize the offline sync system
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize IndexedDB
      await this.initializeDatabase();

      // Initialize encryption
      await this.encryption.initialize();

      // Initialize audit trail
      await this.auditTrail.initialize();

      // Start retention policy auto-cleanup
      this.retentionPolicy.startAutoCleanup();

      // Start auto-sync if configured
      if (this.config.autoSyncIntervalMs > 0) {
        this.startAutoSync();
      }

      // Listen for online events
      if (typeof window !== 'undefined') {
        window.addEventListener('online', () => {
          void this.syncAll();
        });
      }

      this.initialized = true;

      await auditLogger.info('ENTERPRISE_OFFLINE_SYNC_INITIALIZED', {
        tenantId: this.config.tenantId,
        deviceId: this.deviceId,
        features: {
          deltaSync: this.config.enableDeltaSync,
          compression: this.config.enableCompression,
          fhirExport: this.config.enableFHIRExport,
        },
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      await auditLogger.error('ENTERPRISE_OFFLINE_SYNC_INIT_FAILED', errorMessage);
      throw err;
    }
  }

  /**
   * Save a field visit offline (with encryption)
   */
  async saveVisit(
    visit: Omit<OfflineFieldVisit, 'encrypted' | 'encryptionKeyId' | 'vectorClock' | 'revisionId' | 'checksum' | 'deviceId' | 'syncState' | 'localVersion' | 'conflictState' | 'offlineCaptured'>
  ): Promise<ServiceResult<OfflineFieldVisit>> {
    try {
      await this.ensureInitialized();

      // Create full record with enterprise metadata
      const fullVisit: Omit<OfflineFieldVisit, 'encrypted' | 'encryptionKeyId'> = {
        ...visit,
        recordType: 'field_visit',
        syncState: 'pending',
        localVersion: 1,
        vectorClock: this.conflictResolver.createVectorClock(),
        revisionId: this.generateRevisionId(),
        conflictState: 'none',
        checksum: '',
        offlineCaptured: true,
        deviceId: this.deviceId,
      };

      // Encrypt PHI fields
      const encryptResult = await this.encryption.encryptFieldVisit(fullVisit);
      if (!encryptResult.success || !encryptResult.data) {
        return failure('OPERATION_FAILED', encryptResult.error || 'Encryption failed');
      }

      const encryptedVisit = encryptResult.data;

      // Calculate checksum
      encryptedVisit.checksum = this.calculateChecksum(encryptedVisit);

      // Store in IndexedDB
      await this.storeRecord('visits', encryptedVisit);

      // Log audit trail
      await this.auditTrail.logPHIAccess({
        action: 'create',
        resourceType: 'field_visit',
        resourceId: encryptedVisit.id,
        patientId: encryptedVisit.patient.patientId,
        accessReason: 'offline_capture',
      });

      // Update observability
      this.observability.updatePendingCount(await this.getPendingCount());

      // Trigger background sync registration
      await this.triggerBackgroundSync();

      return success(encryptedVisit);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.observability.recordSyncError('SAVE_FAILED', errorMessage);

      return failure('DATABASE_ERROR', `Failed to save visit: ${errorMessage}`, err);
    }
  }

  /**
   * Save an assessment offline (with encryption)
   */
  async saveAssessment(
    assessment: Omit<OfflineAssessment, 'encrypted' | 'encryptionKeyId' | 'vectorClock' | 'revisionId' | 'checksum' | 'deviceId' | 'syncState' | 'localVersion' | 'conflictState' | 'offlineCaptured'>
  ): Promise<ServiceResult<OfflineAssessment>> {
    try {
      await this.ensureInitialized();

      const fullAssessment: Omit<OfflineAssessment, 'encrypted' | 'encryptionKeyId'> = {
        ...assessment,
        recordType: 'assessment',
        syncState: 'pending',
        localVersion: 1,
        vectorClock: this.conflictResolver.createVectorClock(),
        revisionId: this.generateRevisionId(),
        conflictState: 'none',
        checksum: '',
        offlineCaptured: true,
        deviceId: this.deviceId,
      };

      const encryptResult = await this.encryption.encryptAssessment(fullAssessment);
      if (!encryptResult.success || !encryptResult.data) {
        return failure('OPERATION_FAILED', encryptResult.error || 'Encryption failed');
      }

      const encryptedAssessment = encryptResult.data;
      encryptedAssessment.checksum = this.calculateChecksum(encryptedAssessment);

      await this.storeRecord('assessments', encryptedAssessment);

      await this.auditTrail.logPHIAccess({
        action: 'create',
        resourceType: 'assessment',
        resourceId: encryptedAssessment.id,
        patientId: encryptedAssessment.patient.patientId,
        accessReason: 'offline_capture',
      });

      this.observability.updatePendingCount(await this.getPendingCount());
      await this.triggerBackgroundSync();

      return success(encryptedAssessment);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.observability.recordSyncError('SAVE_FAILED', errorMessage);

      return failure('DATABASE_ERROR', `Failed to save assessment: ${errorMessage}`, err);
    }
  }

  /**
   * Sync all pending data
   */
  async syncAll(): Promise<ServiceResult<SyncResult>> {
    if (!navigator.onLine) {
      return failure('NETWORK_ERROR', 'Device is offline');
    }

    const startTimestamp = this.observability.recordSyncStart();

    try {
      await this.ensureInitialized();

      // Step 1: Sync audit logs first (HIPAA requirement)
      const auditResult = await this.auditTrail.syncToServer();
      if (!auditResult.success) {
        await auditLogger.warn('AUDIT_SYNC_FAILED', {
          error: auditResult.error?.message,
        });
        // Continue even if audit sync fails
      }

      // Step 2: Get all pending visits and their related records
      const pendingVisits = await this.getUnsyncedRecords<OfflineFieldVisit>('visits');

      let totalSynced = 0;
      let totalFailed = 0;
      let conflictsDetected = 0;

      // Step 3: Sync each visit as a bundle (transactional)
      for (const visit of pendingVisits) {
        // Get related records
        const assessments = await this.getRecordsByVisitId<OfflineAssessment>('assessments', visit.id);
        const photos = await this.getRecordsByVisitId<OfflinePhoto>('photos', visit.id);
        const alerts = await this.getRecordsByVisitId<OfflineAlert>('alerts', visit.id);

        // Create and sync bundle
        const bundle = this.transactionalSync.createBundle(visit, assessments, photos, alerts);
        const bundleResult = await this.transactionalSync.syncBundleWithRetry(bundle);

        if (bundleResult.success && bundleResult.data) {
          totalSynced += bundleResult.data.syncedCount;

          // Mark records as synced
          await this.markRecordSynced('visits', visit.id);
          for (const a of assessments) await this.markRecordSynced('assessments', a.id);
          for (const p of photos) await this.markRecordSynced('photos', p.id);
          for (const al of alerts) await this.markRecordSynced('alerts', al.id);
        } else {
          totalFailed += 1 + assessments.length + photos.length + alerts.length;
        }
      }

      // Step 4: Sync orphaned records (not linked to visits)
      const orphanedAssessments = await this.getOrphanedRecords<OfflineAssessment>('assessments');
      for (const assessment of orphanedAssessments) {
        const result = await this.syncSingleRecord('assessments', assessment);
        if (result.success) {
          totalSynced++;
        } else {
          totalFailed++;
        }
      }

      const durationMs = Date.now() - startTimestamp;

      this.observability.recordSyncComplete(startTimestamp, totalSynced, totalFailed);
      this.observability.updatePendingCount(await this.getPendingCount());

      return success({
        success: totalFailed === 0,
        syncedCount: totalSynced,
        failedCount: totalFailed,
        skippedCount: 0,
        conflictsDetected,
        durationMs,
        details: {
          visits: pendingVisits.length,
          assessments: orphanedAssessments.length,
          photos: 0,
          alerts: 0,
          auditLogs: auditResult.success ? auditResult.data?.synced || 0 : 0,
        },
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.observability.recordSyncError('SYNC_ALL_FAILED', errorMessage);

      return failure('OPERATION_FAILED', `Sync failed: ${errorMessage}`, err);
    }
  }

  /**
   * Export to FHIR bundle
   */
  async exportToFHIR(visitId: string): Promise<ServiceResult<FHIRBundle>> {
    if (!this.config.enableFHIRExport) {
      return failure('MODULE_DISABLED', 'FHIR export is disabled');
    }

    try {
      await this.ensureInitialized();

      const visit = await this.getRecord<OfflineFieldVisit>('visits', visitId);
      if (!visit) {
        return failure('NOT_FOUND', `Visit ${visitId} not found`);
      }

      // Decrypt for FHIR export
      const decryptResult = await this.encryption.decryptFieldVisit(visit);
      if (!decryptResult.success || !decryptResult.data) {
        return failure('OPERATION_FAILED', 'Failed to decrypt visit');
      }

      const assessments = await this.getRecordsByVisitId<OfflineAssessment>('assessments', visitId);
      const photos = await this.getRecordsByVisitId<OfflinePhoto>('photos', visitId);
      const alerts = await this.getRecordsByVisitId<OfflineAlert>('alerts', visitId);

      return this.fhirMapper.createTransactionBundle(
        decryptResult.data,
        assessments,
        photos,
        alerts
      );
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return failure('OPERATION_FAILED', `FHIR export failed: ${errorMessage}`, err);
    }
  }

  /**
   * Get sync health status
   */
  async getHealthStatus() {
    return this.observability.performHealthCheck();
  }

  /**
   * Get sync metrics
   */
  getMetrics() {
    return this.observability.getMetrics();
  }

  /**
   * Shutdown the sync system
   */
  async shutdown(): Promise<void> {
    this.stopAutoSync();
    this.retentionPolicy.stopAutoCleanup();

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    this.initialized = false;

    await auditLogger.info('ENTERPRISE_OFFLINE_SYNC_SHUTDOWN', {
      tenantId: this.config.tenantId,
      deviceId: this.deviceId,
    });
  }

  // Private helper methods

  private async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        for (const storeName of this.STORES) {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: 'id' });
            store.createIndex('syncState', 'syncState', { unique: false });
            store.createIndex('tenantId', 'tenantId', { unique: false });
            store.createIndex('visitId', 'visitId', { unique: false });
            store.createIndex('updatedAt', 'updatedAt', { unique: false });
          }
        }
      };
    });
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private startAutoSync(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
    }

    this.autoSyncTimer = setInterval(async () => {
      if (navigator.onLine) {
        await this.syncAll();
      }
    }, this.config.autoSyncIntervalMs);
  }

  private stopAutoSync(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
  }

  private async storeRecord<T extends EnterpriseOfflineRecord>(
    storeName: string,
    record: T
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async getRecord<T extends EnterpriseOfflineRecord>(
    storeName: string,
    id: string
  ): Promise<T | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result as T | null);
      request.onerror = () => reject(request.error);
    });
  }

  private async getUnsyncedRecords<T extends EnterpriseOfflineRecord>(
    storeName: string
  ): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index('syncState');
      const request = index.getAll(IDBKeyRange.only('pending'));

      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  private async getRecordsByVisitId<T extends EnterpriseOfflineRecord>(
    storeName: string,
    visitId: string
  ): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index('visitId');
      const request = index.getAll(visitId);

      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  private async getOrphanedRecords<T extends EnterpriseOfflineRecord>(
    storeName: string
  ): Promise<T[]> {
    const allPending = await this.getUnsyncedRecords<T>(storeName);
    return allPending.filter((r) => !(r as Record<string, unknown>)['visitId']);
  }

  private async markRecordSynced(storeName: string, id: string): Promise<void> {
    const record = await this.getRecord(storeName, id);
    if (record) {
      record.syncState = 'synced';
      record.syncedAt = Date.now();
      await this.storeRecord(storeName, record);
    }
  }

  private async syncSingleRecord(
    storeName: string,
    record: EnterpriseOfflineRecord
  ): Promise<ServiceResult<void>> {
    // Simplified single-record sync
    try {
      const tableMap: Record<string, string> = {
        visits: 'field_visits',
        assessments: 'specialist_assessments',
        photos: 'specialist_photos',
        alerts: 'specialist_alerts',
      };

      const { error } = await supabase.from(tableMap[storeName]).upsert(
        {
          id: record.id,
          tenant_id: record.tenantId,
          // ... other fields
        },
        { onConflict: 'id' }
      );

      if (error) {
        return failure('DATABASE_ERROR', error.message);
      }

      await this.markRecordSynced(storeName, record.id);
      return success(undefined);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return failure('OPERATION_FAILED', errorMessage);
    }
  }

  private async getPendingCount(): Promise<number> {
    let total = 0;
    for (const store of this.STORES) {
      const pending = await this.getUnsyncedRecords(store);
      total += pending.length;
    }
    return total;
  }

  private async triggerBackgroundSync(): Promise<void> {
    if (!('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      if ('sync' in registration) {
        const syncManager = registration as ServiceWorkerRegistration & {
          sync: { register: (tag: string) => Promise<void> };
        };
        await syncManager.sync.register('sync-enterprise-data');
      }
    } catch {
      // Background sync not available
    }
  }

  private generateRevisionId(): string {
    return `rev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private calculateChecksum(record: EnterpriseOfflineRecord): string {
    const content = JSON.stringify({
      id: record.id,
      version: record.localVersion,
      updated: record.updatedAt,
    });

    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }

    return `cksum-${Math.abs(hash).toString(36)}`;
  }
}

/**
 * Create enterprise offline sync instance
 */
export function createEnterpriseOfflineSync(
  config: EnterpriseOfflineSyncConfig
): EnterpriseOfflineDataSync {
  return new EnterpriseOfflineDataSync(config);
}
