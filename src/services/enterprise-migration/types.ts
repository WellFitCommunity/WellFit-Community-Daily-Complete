/**
 * Enterprise Migration Engine — Type Definitions
 *
 * All interfaces and type definitions for the enterprise migration system.
 */

import { MigrationResult } from '../migration-engine';

// =============================================================================
// ENTERPRISE TYPES
// =============================================================================

/** Data lineage record for tracking transformations */
export interface LineageRecord {
  lineageId: string;
  migrationBatchId: string;
  sourceFileName: string;
  sourceRowNumber: number;
  sourceColumnName: string;
  sourceValueHash: string;
  transformations: TransformationStep[];
  targetTable: string;
  targetColumn: string;
  targetRowId?: string;
  targetValueHash: string;
  validationPassed: boolean;
  validationErrors: string[];
  createdAt: Date;
}

/** Individual transformation step in lineage */
export interface TransformationStep {
  step: number;
  type: string;
  beforeHash: string;
  afterHash: string;
  parameters?: Record<string, unknown>;
}

/** Migration snapshot for rollback */
export interface MigrationSnapshot {
  snapshotId: string;
  migrationBatchId?: string;
  snapshotName: string;
  snapshotType: 'pre_migration' | 'checkpoint' | 'post_migration' | 'manual';
  description?: string;
  tablesIncluded: string[];
  snapshotData: Record<string, unknown[]>;
  totalRows: number;
  sizeBytes: number;
  status: 'active' | 'restored' | 'expired' | 'deleted';
  createdBy?: string;
  createdAt: Date;
  restoredAt?: Date;
}

/** Rollback result */
export interface RollbackResult {
  success: boolean;
  rollbackId?: string;
  rowsRestored: number;
  rowsDeleted: number;
  durationMs: number;
  error?: string;
}

/** Delta sync state */
export interface SyncState {
  syncId: string;
  organizationId?: string;
  sourceSystem: string;
  sourceTable: string;
  targetTable: string;
  lastSyncAt?: Date;
  lastSyncValue?: string;
  lastSyncColumn?: string;
  syncMode: 'full' | 'incremental' | 'cdc';
  isActive: boolean;
}

/** Change detection result */
export interface DetectedChange {
  changeType: 'insert' | 'update' | 'delete';
  recordId: string;
  changedFields?: string[];
  oldValuesHash?: string;
  newValuesHash?: string;
}

/** Retry queue item */
export interface RetryQueueItem {
  retryId: string;
  migrationBatchId: string;
  failedOperation: string;
  targetTable?: string;
  sourceRowNumbers: number[];
  errorCode?: string;
  errorMessage: string;
  attemptNumber: number;
  maxAttempts: number;
  nextRetryAt: Date;
  status: 'pending' | 'retrying' | 'succeeded' | 'exhausted' | 'cancelled';
}

/** Worker status */
export interface WorkerStatus {
  workerId: string;
  workerName: string;
  workerType: 'batch' | 'validation' | 'transform' | 'load';
  status: 'idle' | 'processing' | 'paused' | 'error' | 'shutdown';
  currentBatchId?: string;
  currentTask?: Record<string, unknown>;
  rowsProcessed: number;
  rowsFailed: number;
  lastHeartbeat: Date;
}

/** Work queue item */
export interface WorkQueueItem {
  workId: string;
  migrationBatchId: string;
  workType: 'extract' | 'transform' | 'validate' | 'load' | 'index';
  targetTable: string;
  rowRangeStart: number;
  rowRangeEnd: number;
  dependsOn: string[];
  assignedWorkerId?: string;
  priority: number;
  status: 'pending' | 'assigned' | 'processing' | 'completed' | 'failed' | 'cancelled';
}

/** Workflow template step */
export interface WorkflowStep {
  order: number;
  table: string;
  dependsOn: string[];
  pkColumn?: string;
  fkMappings?: Record<string, string>;
}

/** Deduplication candidate */
export interface DedupCandidate {
  candidateId: string;
  recordAId: string;
  recordAData: Record<string, unknown>;
  recordBId: string;
  recordBData: Record<string, unknown>;
  overallSimilarity: number;
  nameSimilarity?: number;
  dobMatch?: boolean;
  phoneSimilarity?: number;
  emailSimilarity?: number;
  matchMethod: string;
  resolution: 'pending' | 'merge_a' | 'merge_b' | 'keep_both' | 'manual_review' | 'auto_merged';
  requiresHumanReview: boolean;
}

/** Quality score result */
export interface QualityScore {
  overallScore: number;
  completenessScore: number;
  accuracyScore: number;
  consistencyScore: number;
  uniquenessScore: number;
  grade: string;
  recommendations: string[];
  readyForProduction: boolean;
}

/** Conditional mapping */
export interface ConditionalMapping {
  mappingId: string;
  sourceColumn: string;
  condition: {
    type: 'value_equals' | 'value_in' | 'value_matches' | 'value_range' | 'value_null' | 'value_not_null';
    field: string;
    value?: string;
    values?: string[];
    pattern?: string;
    min?: number;
    max?: number;
  };
  actionType: 'map_to_table' | 'map_to_column' | 'transform' | 'skip' | 'flag_review' | 'split';
  actionConfig: Record<string, unknown>;
  priority: number;
}

/** Enterprise migration options */
export interface EnterpriseMigrationOptions {
  // Basic options
  dryRun?: boolean;
  validateOnly?: boolean;
  batchSize?: number;

  // Enterprise features
  enableLineageTracking?: boolean;
  createPreMigrationSnapshot?: boolean;
  enableRetryLogic?: boolean;
  maxRetryAttempts?: number;
  enableParallelProcessing?: boolean;
  workerCount?: number;
  enableDeduplication?: boolean;
  dedupThreshold?: number;
  enableQualityScoring?: boolean;
  enableConditionalMappings?: boolean;
  useWorkflowOrchestration?: boolean;
  workflowTemplateId?: string;

  // PHI handling
  encryptPHI?: boolean;
  phiFields?: string[];

  // Error handling
  stopOnError?: boolean;
  stopOnQualityThreshold?: number;
}

/** Enterprise migration result */
export interface EnterpriseMigrationResult {
  batchId: string;
  totalRecords: number;
  successCount: number;
  errorCount: number;
  errors: Array<{ row: number; field: string; error: string }>;
  results: MigrationResult[];

  // Enterprise metrics
  snapshotId?: string;
  lineageRecordsCreated: number;
  retriesQueued: number;
  duplicatesFound: number;
  qualityScore?: QualityScore;
  workflowExecutionId?: string;
  processingTimeMs: number;
  throughputRowsPerSecond: number;
}
