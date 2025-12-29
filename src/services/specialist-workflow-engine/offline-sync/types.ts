/**
 * Enterprise Offline Sync - Type Definitions
 *
 * Comprehensive TypeScript interfaces for enterprise-grade offline data synchronization
 * in healthcare interoperable systems.
 *
 * Features:
 * - FHIR R4 resource mapping
 * - Conflict resolution with version vectors
 * - Transactional sync metadata
 * - PHI encryption markers
 * - Audit trail interfaces
 */

import type { EncryptedField } from '../../guardian-agent/PHIEncryption';

// ============================================================================
// Core Offline Record Types
// ============================================================================

/**
 * Severity levels for clinical alerts
 */
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Sync states for records
 */
export type SyncState =
  | 'pending'      // Not yet synced
  | 'syncing'      // Currently syncing
  | 'synced'       // Successfully synced
  | 'conflict'     // Conflict detected
  | 'failed'       // Sync failed (retryable)
  | 'permanent_failure'; // Sync permanently failed

/**
 * Conflict resolution strategies
 */
export type ConflictStrategy =
  | 'client_wins'      // Local changes override server
  | 'server_wins'      // Server changes override local
  | 'manual'           // Require manual resolution
  | 'merge'            // Attempt automatic merge
  | 'clinical_review'; // Flag for clinical review (healthcare-specific)

/**
 * Vector clock for distributed conflict detection
 * Maps node IDs to logical timestamps
 */
export interface VectorClock {
  [nodeId: string]: number;
}

/**
 * Base interface for all offline-stored records with enterprise features
 */
export interface EnterpriseOfflineRecord {
  /** Unique record identifier */
  id: string;

  /** Tenant ID for multi-tenant isolation */
  tenantId: string;

  /** User who created/owns the record */
  userId: string;

  // Sync metadata
  /** Current sync state */
  syncState: SyncState;

  /** Local creation timestamp */
  createdAt: number;

  /** Local modification timestamp */
  updatedAt: number;

  /** Server-side timestamp (after sync) */
  serverTimestamp?: number;

  /** When record was last synced */
  syncedAt?: number;

  // Version control
  /** Local version number (increments on each change) */
  localVersion: number;

  /** Server version (from last sync) */
  serverVersion?: number;

  /** Vector clock for distributed conflict detection */
  vectorClock: VectorClock;

  /** Unique revision ID for this change */
  revisionId: string;

  /** Previous revision ID (for change tracking) */
  parentRevisionId?: string;

  // Conflict tracking
  /** Conflict state */
  conflictState: 'none' | 'detected' | 'resolved' | 'pending_review';

  /** Conflicting record (if conflict detected) */
  conflictingRecord?: EnterpriseOfflineRecord;

  /** How conflict was resolved */
  conflictResolution?: ConflictStrategy;

  /** Who resolved the conflict */
  conflictResolvedBy?: string;

  /** When conflict was resolved */
  conflictResolvedAt?: number;

  // Integrity
  /** SHA-256 checksum of record content */
  checksum: string;

  /** Whether record was captured offline */
  offlineCaptured: boolean;

  /** Device ID that created/modified the record */
  deviceId: string;

  // Encryption
  /** Whether PHI fields are encrypted */
  encrypted: boolean;

  /** Encryption key ID used */
  encryptionKeyId?: string;
}

// ============================================================================
// Clinical Record Types
// ============================================================================

/**
 * Geographic location for field visits
 */
export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  address?: string;
  capturedAt: number;
}

/**
 * Encrypted patient reference (no PHI in plain text)
 */
export interface EncryptedPatientRef {
  /** Patient UUID (not PHI) */
  patientId: string;

  /** Encrypted patient name (for display when key available) */
  encryptedName?: EncryptedField<string>;

  /** FHIR Patient resource ID (for interop) */
  fhirPatientId?: string;
}

/**
 * Field visit record with enterprise features
 */
export interface OfflineFieldVisit extends EnterpriseOfflineRecord {
  recordType: 'field_visit';

  /** Patient reference (encrypted) */
  patient: EncryptedPatientRef;

  /** Specialist who performed the visit */
  specialistId: string;

  /** Type of visit */
  visitType: 'routine' | 'follow_up' | 'emergency' | 'initial' | 'discharge';

  /** Scheduled date/time */
  scheduledDate: string;

  /** Actual start time */
  startTime?: number;

  /** Actual end time */
  endTime?: number;

  /** Duration in minutes */
  durationMinutes?: number;

  /** Visit status */
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

  /** Check-in location */
  checkInLocation?: GeoLocation;

  /** Check-out location */
  checkOutLocation?: GeoLocation;

  /** Encrypted clinical notes */
  notes?: EncryptedField<string>;

  /** Assessment IDs linked to this visit */
  assessmentIds: string[];

  /** Photo IDs linked to this visit */
  photoIds: string[];

  /** Alert IDs generated during this visit */
  alertIds: string[];

  /** FHIR Encounter resource ID */
  fhirEncounterId?: string;
}

/**
 * Clinical assessment record
 */
export interface OfflineAssessment extends EnterpriseOfflineRecord {
  recordType: 'assessment';

  /** Visit this assessment belongs to */
  visitId: string;

  /** Patient reference */
  patient: EncryptedPatientRef;

  /** Assessment type */
  assessmentType: string;

  /** Encrypted assessment findings */
  findings: EncryptedField<Record<string, unknown>>;

  /** Encrypted recommendations */
  recommendations?: EncryptedField<string>;

  /** Clinical severity */
  severity?: AlertSeverity;

  /** Assessment score (if applicable) */
  score?: number;

  /** Maximum possible score */
  maxScore?: number;

  /** Risk level based on assessment */
  riskLevel?: 'low' | 'moderate' | 'high' | 'critical';

  /** FHIR DiagnosticReport resource ID */
  fhirDiagnosticReportId?: string;

  /** ICD-10 codes (if applicable) */
  icd10Codes?: string[];

  /** SNOMED codes (if applicable) */
  snomedCodes?: string[];
}

/**
 * Clinical photo/media record
 */
export interface OfflinePhoto extends EnterpriseOfflineRecord {
  recordType: 'photo';

  /** Visit this photo belongs to */
  visitId: string;

  /** Patient reference */
  patient: EncryptedPatientRef;

  /** Encrypted photo data (base64 or blob reference) */
  encryptedData: EncryptedField<string>;

  /** Original file type */
  mimeType: string;

  /** File size in bytes */
  sizeBytes: number;

  /** Photo description */
  description?: string;

  /** Body site (for wound photos, etc.) */
  bodySite?: string;

  /** SNOMED code for body site */
  bodySiteSnomedCode?: string;

  /** Thumbnail (encrypted, smaller version) */
  thumbnail?: EncryptedField<string>;

  /** Storage URL (after upload) */
  storageUrl?: string;

  /** FHIR Media resource ID */
  fhirMediaId?: string;
}

/**
 * Clinical alert record
 */
export interface OfflineAlert extends EnterpriseOfflineRecord {
  recordType: 'alert';

  /** Visit that generated this alert */
  visitId: string;

  /** Patient reference */
  patient: EncryptedPatientRef;

  /** Alert type */
  alertType: string;

  /** Alert severity */
  severity: AlertSeverity;

  /** Alert message */
  message: string;

  /** Whether alert has been acknowledged */
  acknowledged: boolean;

  /** Who acknowledged the alert */
  acknowledgedBy?: string;

  /** When alert was acknowledged */
  acknowledgedAt?: number;

  /** Triggering value (e.g., BP reading) */
  triggerValue?: string;

  /** Threshold that was exceeded */
  thresholdValue?: string;

  /** Action taken in response */
  actionTaken?: string;

  /** FHIR Flag resource ID */
  fhirFlagId?: string;
}

// ============================================================================
// Audit Trail Types
// ============================================================================

/**
 * Offline audit log entry
 * Captures all PHI access and modifications while offline
 */
export interface OfflineAuditEntry {
  /** Unique audit entry ID */
  id: string;

  /** When the action occurred */
  timestamp: number;

  /** User who performed the action */
  userId: string;

  /** Tenant context */
  tenantId: string;

  /** Device where action occurred */
  deviceId: string;

  /** Action type */
  action: 'create' | 'read' | 'update' | 'delete' | 'sync' | 'encrypt' | 'decrypt' | 'export' | 'print' | 'share' | 'acknowledge';

  /** Resource type affected */
  resourceType: 'field_visit' | 'assessment' | 'photo' | 'alert' | 'patient' | 'sync_bundle' | 'encryption_key';

  /** Resource ID affected */
  resourceId: string;

  /** Patient ID (for PHI tracking) */
  patientId?: string;

  /** Fields that were accessed/modified */
  affectedFields?: string[];

  /** Whether action succeeded */
  success: boolean;

  /** Error message if failed */
  errorMessage?: string;

  /** Whether this audit entry has been synced to server */
  synced: boolean;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Sync Operation Types
// ============================================================================

/**
 * Sync bundle for transactional sync
 * Groups related records for atomic sync operations
 */
export interface SyncBundle {
  /** Unique bundle ID */
  id: string;

  /** Bundle creation timestamp */
  createdAt: number;

  /** Tenant context */
  tenantId: string;

  /** User who initiated sync */
  userId: string;

  /** Primary record (e.g., visit) */
  primaryRecordId: string;

  /** Primary record type */
  primaryRecordType: 'field_visit' | 'assessment' | 'photo' | 'alert';

  /** All records in this bundle */
  records: Array<{
    recordType: string;
    recordId: string;
    data: EnterpriseOfflineRecord;
  }>;

  /** Bundle checksum for integrity verification */
  checksum: string;

  /** Sync state */
  state: 'pending' | 'syncing' | 'synced' | 'failed' | 'partial';

  /** Number of sync attempts */
  attempts: number;

  /** Last attempt timestamp */
  lastAttemptAt?: number;

  /** Error from last failed attempt */
  lastError?: string;
}

/**
 * Delta change for efficient sync
 * Uses JSON Patch (RFC 6902) format
 */
export interface DeltaChange {
  /** Record ID being changed */
  recordId: string;

  /** Record type */
  recordType: string;

  /** Base version this delta applies to */
  baseVersion: number;

  /** Target version after applying delta */
  targetVersion: number;

  /** JSON Patch operations */
  patches: JSONPatchOperation[];

  /** Compressed patch data (for large changes) */
  compressedPatches?: string;

  /** Whether patches are compressed */
  isCompressed: boolean;

  /** Delta checksum */
  checksum: string;
}

/**
 * JSON Patch operation (RFC 6902)
 */
export interface JSONPatchOperation {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: unknown;
  from?: string;
}

// ============================================================================
// Sync Metrics Types
// ============================================================================

/**
 * Sync health metrics for observability
 */
export interface SyncMetrics {
  /** Total sync attempts in current session */
  syncAttempts: number;

  /** Successful syncs */
  syncSuccesses: number;

  /** Failed syncs */
  syncFailures: number;

  /** Average sync duration in milliseconds */
  avgSyncDurationMs: number;

  /** Records pending sync */
  pendingRecordCount: number;

  /** Oldest pending record timestamp */
  oldestPendingTimestamp?: number;

  /** Last successful sync timestamp */
  lastSuccessfulSync?: number;

  /** Conflicts detected */
  conflictsDetected: number;

  /** Conflicts resolved */
  conflictsResolved: number;

  /** Conflicts pending review */
  conflictsPending: number;

  /** Total bytes pending sync */
  pendingBytesTotal: number;

  /** Records by state */
  recordsByState: Record<SyncState, number>;

  /** Errors by type */
  errorsByType: Record<string, number>;

  /** Network quality indicator */
  networkQuality: 'offline' | 'poor' | 'fair' | 'good' | 'excellent';

  /** Storage usage percentage */
  storageUsagePercent: number;
}

// ============================================================================
// Retention Policy Types
// ============================================================================

/**
 * Data retention policy configuration
 */
export interface RetentionPolicy {
  /** How long to keep synced records (milliseconds) */
  syncedRecordsRetention: number;

  /** How long to keep failed records (milliseconds) */
  failedRecordsRetention: number;

  /** How long to keep audit logs (milliseconds) */
  auditLogsRetention: number;

  /** Maximum storage in bytes */
  maxStorageBytes: number;

  /** Warning threshold percentage */
  storageWarningThreshold: number;

  /** Critical threshold percentage */
  storageCriticalThreshold: number;

  /** Whether to auto-cleanup */
  autoCleanupEnabled: boolean;

  /** Cleanup interval in milliseconds */
  cleanupIntervalMs: number;
}

// ============================================================================
// FHIR Mapping Types
// ============================================================================

/**
 * FHIR resource type mapping
 */
export type FHIRResourceType =
  | 'Encounter'
  | 'DiagnosticReport'
  | 'Observation'
  | 'Media'
  | 'Flag'
  | 'DocumentReference'
  | 'CommunicationRequest';

/**
 * FHIR bundle entry for batch operations
 */
export interface FHIRBundleEntry {
  /** Full URL for the resource */
  fullUrl?: string;

  /** The FHIR resource */
  resource: FHIRResource;

  /** Request details for transaction bundles */
  request?: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    url: string;
  };
}

/**
 * Base FHIR resource interface
 */
export interface FHIRResource {
  resourceType: FHIRResourceType;
  id?: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
    profile?: string[];
  };
  [key: string]: unknown;
}

/**
 * FHIR transaction bundle
 */
export interface FHIRBundle {
  resourceType: 'Bundle';
  type: 'transaction' | 'batch' | 'collection';
  entry: FHIRBundleEntry[];
}

// ============================================================================
// Service Result Types
// ============================================================================

/**
 * Sync operation result
 */
export interface SyncResult {
  /** Whether sync was successful */
  success: boolean;

  /** Records successfully synced */
  syncedCount: number;

  /** Records that failed */
  failedCount: number;

  /** Records skipped (e.g., in backoff) */
  skippedCount: number;

  /** Conflicts detected during sync */
  conflictsDetected: number;

  /** Time taken in milliseconds */
  durationMs: number;

  /** Error message if failed */
  error?: string;

  /** Details per record type */
  details: {
    visits: number;
    assessments: number;
    photos: number;
    alerts: number;
    auditLogs: number;
  };
}

/**
 * Conflict detection result
 */
export interface ConflictDetectionResult {
  /** Whether conflict exists */
  hasConflict: boolean;

  /** Type of conflict */
  conflictType?: 'version_mismatch' | 'concurrent_edit' | 'deleted_on_server';

  /** Local record */
  localRecord: EnterpriseOfflineRecord;

  /** Server record (if available) */
  serverRecord?: EnterpriseOfflineRecord;

  /** Recommended resolution strategy */
  recommendedStrategy: ConflictStrategy;

  /** Fields that conflict */
  conflictingFields?: string[];
}
