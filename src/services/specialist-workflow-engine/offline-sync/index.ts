/**
 * Enterprise Offline Sync Module
 *
 * Comprehensive offline data synchronization for enterprise healthcare systems.
 *
 * @module offline-sync
 */

// Types
export * from './types';

// Core encryption service
export {
  OfflineEncryptionService,
  getOfflineEncryption,
  getOrCreateDeviceId,
  type OfflineEncryptionConfig,
  type EncryptionResult,
} from './OfflineEncryption';

// Audit trail for HIPAA compliance
export {
  OfflineAuditTrail,
  getOfflineAuditTrail,
  type OfflineAuditConfig,
  type AuditAction,
  type AuditResourceType,
  type AuditSyncResult,
} from './OfflineAuditTrail';

// Conflict resolution with vector clocks
export {
  ConflictResolutionService,
  createConflictResolver,
  type ConflictSeverity,
  type ConflictInfo,
  type MergeResult,
} from './ConflictResolution';

// Transactional sync with rollback
export {
  TransactionalSyncService,
  createTransactionalSync,
  type TransactionalSyncConfig,
} from './TransactionalSync';

// FHIR R4 resource mapping
export {
  FHIRMapper,
  createFHIRMapper,
} from './FHIRMapper';

// Delta sync with compression
export {
  DeltaSyncService,
  createDeltaSync,
  type DeltaResult,
  type CompressionOptions,
} from './DeltaSync';

// Observability and health monitoring
export {
  SyncObservabilityService,
  getSyncObservability,
  createSyncObservability,
  type NetworkQuality,
  type HealthStatus,
  type HealthCheckResult,
  type ErrorCategory,
} from './SyncObservability';

// Retention policy and quota management
export {
  RetentionPolicyService,
  createRetentionPolicy,
  getDefaultRetentionPolicy,
  type CleanupResult,
  type StorageStatus,
} from './RetentionPolicy';

// Main orchestrator
export {
  EnterpriseOfflineDataSync,
  createEnterpriseOfflineSync,
  type EnterpriseOfflineSyncConfig,
} from './EnterpriseOfflineDataSync';
