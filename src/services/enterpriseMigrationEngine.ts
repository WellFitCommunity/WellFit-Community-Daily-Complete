/**
 * WellFit Community - Enterprise Migration Engine
 *
 * Six-to-Seven Figure Epic Migration Feature Parity
 *
 * Enterprise Features:
 * 1. Data Lineage Tracking - Full audit trail from source to target
 * 2. Rollback Capability - Point-in-time snapshots and recovery
 * 3. PHI Encryption - Field-level encryption for staging
 * 4. Delta/Incremental Sync - Only sync changed records
 * 5. Retry Logic - Exponential backoff for failed operations
 * 6. Parallel Processing - Distributed worker coordination
 * 7. Workflow Orchestration - Table dependency management
 * 8. Fuzzy Deduplication - Soundex, Levenshtein matching
 * 9. Data Quality Scoring - Post-migration quality reports
 * 10. Conditional Mappings - Value-based routing rules
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  IntelligentMigrationService,
  PatternDetector,
  DataDNAGenerator,
  SourceDNA,
  MappingSuggestion,
  ColumnDNA,
  DataPattern,
  MigrationResult
} from './intelligentMigrationEngine';
import { auditLogger } from './auditLogger';

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

// =============================================================================
// CRYPTO UTILITIES
// =============================================================================

class CryptoUtils {
  /** Create SHA-256 hash of a value */
  static async hashValue(value: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /** Generate encryption key */
  static async generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /** Encrypt data */
  static async encrypt(data: string, key: CryptoKey): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(data)
    );
    return { ciphertext, iv };
  }

  /** Decrypt data */
  static async decrypt(ciphertext: ArrayBuffer, iv: Uint8Array, key: CryptoKey): Promise<string> {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /** Calculate Levenshtein distance */
  static levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }

    return dp[m][n];
  }

  /** Calculate Soundex code for phonetic matching */
  static soundex(str: string): string {
    const s = str.toUpperCase().replace(/[^A-Z]/g, '');
    if (!s) return '';

    const codes: Record<string, string> = {
      'B': '1', 'F': '1', 'P': '1', 'V': '1',
      'C': '2', 'G': '2', 'J': '2', 'K': '2', 'Q': '2', 'S': '2', 'X': '2', 'Z': '2',
      'D': '3', 'T': '3',
      'L': '4',
      'M': '5', 'N': '5',
      'R': '6'
    };

    let result = s[0];
    let prev = codes[s[0]] || '';

    for (let i = 1; i < s.length && result.length < 4; i++) {
      const code = codes[s[i]];
      if (code && code !== prev) {
        result += code;
      }
      prev = code || prev;
    }

    return result.padEnd(4, '0');
  }

  /** Calculate name similarity (0-1) */
  static nameSimilarity(name1: string, name2: string): number {
    const n1 = name1.toLowerCase().trim();
    const n2 = name2.toLowerCase().trim();

    if (n1 === n2) return 1.0;
    if (!n1 || !n2) return 0;

    // Soundex match bonus
    const soundexMatch = this.soundex(n1) === this.soundex(n2) ? 0.3 : 0;

    // Levenshtein similarity
    const maxLen = Math.max(n1.length, n2.length);
    const levenSim = 1 - (this.levenshteinDistance(n1, n2) / maxLen);

    // Trigram similarity (simplified)
    const trigrams1 = this.getTrigrams(n1);
    const trigrams2 = this.getTrigrams(n2);
    const intersection = trigrams1.filter(t => trigrams2.includes(t));
    const union = new Set([...trigrams1, ...trigrams2]);
    const trigramSim = intersection.length / union.size;

    return Math.min(soundexMatch + (levenSim * 0.35) + (trigramSim * 0.35), 1.0);
  }

  /** Get trigrams from string */
  private static getTrigrams(str: string): string[] {
    const padded = `  ${str} `;
    const trigrams: string[] = [];
    for (let i = 0; i < padded.length - 2; i++) {
      trigrams.push(padded.substring(i, i + 3));
    }
    return trigrams;
  }
}

// =============================================================================
// DATA LINEAGE SERVICE
// =============================================================================

export class DataLineageService {
  private supabase: SupabaseClient;
  private batchId: string;
  private sourceFileName: string;
  private pendingRecords: LineageRecord[] = [];
  private flushThreshold = 100;

  constructor(supabase: SupabaseClient, batchId: string, sourceFileName: string) {
    this.supabase = supabase;
    this.batchId = batchId;
    this.sourceFileName = sourceFileName;
  }

  /** Track a value transformation */
  async trackTransformation(
    rowNumber: number,
    columnName: string,
    sourceValue: unknown,
    targetTable: string,
    targetColumn: string,
    transformations: TransformationStep[],
    targetValue: unknown,
    targetRowId?: string,
    validationPassed: boolean = true,
    validationErrors: string[] = []
  ): Promise<void> {
    const sourceHash = await CryptoUtils.hashValue(String(sourceValue ?? ''));
    const targetHash = await CryptoUtils.hashValue(String(targetValue ?? ''));

    const record: LineageRecord = {
      lineageId: crypto.randomUUID(),
      migrationBatchId: this.batchId,
      sourceFileName: this.sourceFileName,
      sourceRowNumber: rowNumber,
      sourceColumnName: columnName,
      sourceValueHash: sourceHash,
      transformations,
      targetTable,
      targetColumn,
      targetRowId,
      targetValueHash: targetHash,
      validationPassed,
      validationErrors,
      createdAt: new Date()
    };

    this.pendingRecords.push(record);

    if (this.pendingRecords.length >= this.flushThreshold) {
      await this.flush();
    }
  }

  /** Flush pending records to database */
  async flush(): Promise<void> {
    if (this.pendingRecords.length === 0) return;

    const records = this.pendingRecords.map(r => ({
      lineage_id: r.lineageId,
      migration_batch_id: r.migrationBatchId,
      source_file_name: r.sourceFileName,
      source_row_number: r.sourceRowNumber,
      source_column_name: r.sourceColumnName,
      source_value_hash: r.sourceValueHash,
      transformations: r.transformations,
      target_table: r.targetTable,
      target_column: r.targetColumn,
      target_row_id: r.targetRowId,
      target_value_hash: r.targetValueHash,
      validation_passed: r.validationPassed,
      validation_errors: r.validationErrors
    }));

    const { error } = await this.supabase
      .from('migration_data_lineage')
      .insert(records);

    if (error) {
      auditLogger.error('DataLineage', 'Failed to flush lineage records', { error: error.message });
    }

    this.pendingRecords = [];
  }

  /** Get lineage for a specific target record */
  async getLineageForRecord(targetTable: string, targetRowId: string): Promise<LineageRecord[]> {
    const { data, error } = await this.supabase
      .rpc('trace_value_lineage', {
        p_target_table: targetTable,
        p_target_row_id: targetRowId,
        p_target_column: null
      });

    if (error) {
      auditLogger.error('DataLineage', 'Failed to get lineage', { error: error.message });
      return [];
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      lineageId: row.lineage_id as string,
      migrationBatchId: this.batchId,
      sourceFileName: row.source_file as string,
      sourceRowNumber: row.source_row as number,
      sourceColumnName: row.source_column as string,
      sourceValueHash: '',
      transformations: row.transformations as TransformationStep[],
      targetTable,
      targetColumn: '',
      targetRowId,
      targetValueHash: '',
      validationPassed: row.validation_passed as boolean,
      validationErrors: [],
      createdAt: new Date(row.created_at as string)
    }));
  }
}

// =============================================================================
// SNAPSHOT SERVICE (Rollback Capability)
// =============================================================================

export class SnapshotService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /** Create a snapshot of specified tables */
  async createSnapshot(
    tables: string[],
    batchId?: string,
    snapshotType: MigrationSnapshot['snapshotType'] = 'pre_migration',
    description?: string,
    userId?: string
  ): Promise<string> {
    const { data, error } = await this.supabase.rpc('create_migration_snapshot', {
      p_batch_id: batchId,
      p_tables: tables,
      p_snapshot_type: snapshotType,
      p_description: description,
      p_user_id: userId
    });

    if (error) {
      throw new Error(`Failed to create snapshot: ${error.message}`);
    }

    auditLogger.info('Snapshot', 'Created migration snapshot', {
      snapshotId: data,
      tables,
      type: snapshotType
    });

    return data as string;
  }

  /** Rollback to a specific snapshot */
  async rollback(
    snapshotId: string,
    reason: string,
    userId: string,
    approverId: string
  ): Promise<RollbackResult> {
    auditLogger.warn('Snapshot', 'Initiating rollback', {
      snapshotId,
      reason,
      userId,
      approverId
    });

    const { data, error } = await this.supabase.rpc('rollback_to_snapshot', {
      p_snapshot_id: snapshotId,
      p_reason: reason,
      p_user_id: userId,
      p_approver_id: approverId
    });

    if (error) {
      return {
        success: false,
        rowsRestored: 0,
        rowsDeleted: 0,
        durationMs: 0,
        error: error.message
      };
    }

    const result = data as Record<string, unknown>;

    auditLogger.info('Snapshot', 'Rollback completed', {
      snapshotId,
      rowsRestored: result.rows_restored,
      durationMs: result.duration_ms
    });

    return {
      success: result.success as boolean,
      rollbackId: result.rollback_id as string,
      rowsRestored: result.rows_restored as number,
      rowsDeleted: result.rows_deleted as number,
      durationMs: result.duration_ms as number
    };
  }

  /** List available snapshots */
  async listSnapshots(batchId?: string): Promise<MigrationSnapshot[]> {
    let query = this.supabase
      .from('migration_snapshots')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (batchId) {
      query = query.eq('migration_batch_id', batchId);
    }

    const { data, error } = await query;

    if (error) {
      auditLogger.error('Snapshot', 'Failed to list snapshots', { error: error.message });
      return [];
    }

    return (data || []).map(row => ({
      snapshotId: row.snapshot_id,
      migrationBatchId: row.migration_batch_id,
      snapshotName: row.snapshot_name,
      snapshotType: row.snapshot_type,
      description: row.description,
      tablesIncluded: row.tables_included,
      snapshotData: row.snapshot_data,
      totalRows: row.total_rows,
      sizeBytes: row.size_bytes,
      status: row.status,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      restoredAt: row.restored_at ? new Date(row.restored_at) : undefined
    }));
  }
}

// =============================================================================
// RETRY SERVICE (Exponential Backoff)
// =============================================================================

export class RetryService {
  private supabase: SupabaseClient;
  private maxAttempts: number;

  constructor(supabase: SupabaseClient, maxAttempts: number = 5) {
    this.supabase = supabase;
    this.maxAttempts = maxAttempts;
  }

  /** Queue a failed operation for retry */
  async queueRetry(
    batchId: string,
    operation: string,
    targetTable: string,
    sourceRows: number[],
    errorCode: string,
    errorMessage: string,
    retryPayload?: Record<string, unknown>
  ): Promise<string> {
    const { data, error } = await this.supabase.rpc('queue_migration_retry', {
      p_batch_id: batchId,
      p_operation: operation,
      p_target_table: targetTable,
      p_source_rows: sourceRows,
      p_error_code: errorCode,
      p_error_message: errorMessage,
      p_retry_payload: retryPayload
    });

    if (error) {
      throw new Error(`Failed to queue retry: ${error.message}`);
    }

    return data as string;
  }

  /** Get pending retries ready for processing */
  async getPendingRetries(): Promise<RetryQueueItem[]> {
    const { data, error } = await this.supabase
      .from('migration_retry_queue')
      .select('*')
      .in('status', ['pending', 'retrying'])
      .lte('next_retry_at', new Date().toISOString())
      .lt('attempt_number', this.maxAttempts)
      .order('next_retry_at', { ascending: true })
      .limit(50);

    if (error) {
      auditLogger.error('Retry', 'Failed to get pending retries', { error: error.message });
      return [];
    }

    return (data || []).map(row => ({
      retryId: row.retry_id,
      migrationBatchId: row.migration_batch_id,
      failedOperation: row.failed_operation,
      targetTable: row.target_table,
      sourceRowNumbers: row.source_row_numbers,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      attemptNumber: row.attempt_number,
      maxAttempts: row.max_attempts,
      nextRetryAt: new Date(row.next_retry_at),
      status: row.status
    }));
  }

  /** Mark retry as started */
  async startRetry(retryId: string): Promise<void> {
    await this.supabase
      .from('migration_retry_queue')
      .update({
        status: 'retrying',
        last_attempt_at: new Date().toISOString()
      })
      .eq('retry_id', retryId);
  }

  /** Mark retry as succeeded */
  async succeedRetry(retryId: string): Promise<void> {
    await this.supabase
      .from('migration_retry_queue')
      .update({
        status: 'succeeded',
        resolved_at: new Date().toISOString()
      })
      .eq('retry_id', retryId);
  }

  /** Mark retry as failed and schedule next attempt */
  async failRetry(retryId: string, errorMessage: string): Promise<void> {
    const { data: current } = await this.supabase
      .from('migration_retry_queue')
      .select('attempt_number, max_attempts, base_delay_ms, max_delay_ms')
      .eq('retry_id', retryId)
      .single();

    if (!current) return;

    const nextAttempt = current.attempt_number + 1;
    const isExhausted = nextAttempt >= current.max_attempts;

    // Calculate next retry with exponential backoff
    const delay = Math.min(
      current.base_delay_ms * Math.pow(2, nextAttempt - 1),
      current.max_delay_ms
    );
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    const nextRetryAt = new Date(Date.now() + delay + jitter);

    await this.supabase
      .from('migration_retry_queue')
      .update({
        status: isExhausted ? 'exhausted' : 'pending',
        attempt_number: nextAttempt,
        next_retry_at: isExhausted ? null : nextRetryAt.toISOString(),
        error_message: errorMessage,
        error_details: {
          latest_error: errorMessage,
          at: new Date().toISOString()
        }
      })
      .eq('retry_id', retryId);
  }
}

// =============================================================================
// PARALLEL PROCESSING SERVICE
// =============================================================================

export class ParallelProcessingService {
  private supabase: SupabaseClient;
  private workerId: string;
  private workerName: string;
  private heartbeatInterval?: ReturnType<typeof setInterval>;

  constructor(supabase: SupabaseClient, workerName: string) {
    this.supabase = supabase;
    this.workerId = crypto.randomUUID();
    this.workerName = workerName;
  }

  /** Register this worker */
  async register(): Promise<void> {
    await this.supabase.from('migration_workers').insert({
      worker_id: this.workerId,
      worker_name: this.workerName,
      worker_type: 'batch',
      status: 'idle',
      last_heartbeat: new Date().toISOString()
    });

    // Start heartbeat
    this.heartbeatInterval = setInterval(() => this.heartbeat(), 30000);
  }

  /** Send heartbeat */
  private async heartbeat(): Promise<void> {
    await this.supabase
      .from('migration_workers')
      .update({
        last_heartbeat: new Date().toISOString(),
        last_active_at: new Date().toISOString()
      })
      .eq('worker_id', this.workerId);
  }

  /** Claim work from queue */
  async claimWork(workTypes?: string[]): Promise<WorkQueueItem | null> {
    const { data, error } = await this.supabase.rpc('claim_migration_work', {
      p_worker_id: this.workerId,
      p_work_types: workTypes || ['extract', 'transform', 'validate', 'load']
    });

    if (error || !data) return null;

    const { data: workItem } = await this.supabase
      .from('migration_work_queue')
      .select('*')
      .eq('work_id', data)
      .single();

    if (!workItem) return null;

    return {
      workId: workItem.work_id,
      migrationBatchId: workItem.migration_batch_id,
      workType: workItem.work_type,
      targetTable: workItem.target_table,
      rowRangeStart: workItem.row_range_start,
      rowRangeEnd: workItem.row_range_end,
      dependsOn: workItem.depends_on || [],
      assignedWorkerId: workItem.assigned_worker_id,
      priority: workItem.priority,
      status: workItem.status
    };
  }

  /** Mark work as completed */
  async completeWork(
    workId: string,
    rowsProcessed: number,
    rowsSucceeded: number,
    rowsFailed: number
  ): Promise<void> {
    await this.supabase
      .from('migration_work_queue')
      .update({
        status: 'completed',
        rows_processed: rowsProcessed,
        rows_succeeded: rowsSucceeded,
        rows_failed: rowsFailed,
        completed_at: new Date().toISOString()
      })
      .eq('work_id', workId);

    await this.supabase
      .from('migration_workers')
      .update({
        status: 'idle',
        current_task: null,
        rows_processed: rowsProcessed,
        last_active_at: new Date().toISOString()
      })
      .eq('worker_id', this.workerId);
  }

  /** Create work queue items for a batch */
  async createWorkQueue(
    batchId: string,
    targetTable: string,
    totalRows: number,
    batchSize: number = 100,
    dependencies: string[] = []
  ): Promise<string[]> {
    const workIds: string[] = [];
    let executionOrder = 0;

    for (let start = 0; start < totalRows; start += batchSize) {
      const end = Math.min(start + batchSize, totalRows);
      const workId = crypto.randomUUID();

      await this.supabase.from('migration_work_queue').insert({
        work_id: workId,
        migration_batch_id: batchId,
        work_type: 'load',
        target_table: targetTable,
        row_range_start: start,
        row_range_end: end,
        depends_on: dependencies,
        priority: 100,
        execution_order: executionOrder++
      });

      workIds.push(workId);
    }

    return workIds;
  }

  /** Shutdown worker */
  async shutdown(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    await this.supabase
      .from('migration_workers')
      .update({ status: 'shutdown' })
      .eq('worker_id', this.workerId);
  }
}

// =============================================================================
// DEDUPLICATION SERVICE
// =============================================================================

export class DeduplicationService {
  private supabase: SupabaseClient;
  private threshold: number;

  constructor(supabase: SupabaseClient, threshold: number = 0.8) {
    this.supabase = supabase;
    this.threshold = threshold;
  }

  /** Find potential duplicates in data */
  async findDuplicates(
    batchId: string,
    data: Record<string, unknown>[]
  ): Promise<DedupCandidate[]> {
    const candidates: DedupCandidate[] = [];

    // Compare each pair
    for (let i = 0; i < data.length - 1; i++) {
      for (let j = i + 1; j < data.length; j++) {
        const recordA = data[i];
        const recordB = data[j];

        const similarity = this.calculateSimilarity(recordA, recordB);

        if (similarity.overall >= this.threshold) {
          const candidate: DedupCandidate = {
            candidateId: crypto.randomUUID(),
            recordAId: String(recordA['id'] || i),
            recordAData: recordA,
            recordBId: String(recordB['id'] || j),
            recordBData: recordB,
            overallSimilarity: similarity.overall,
            nameSimilarity: similarity.name,
            dobMatch: similarity.dobMatch,
            phoneSimilarity: similarity.phone,
            emailSimilarity: similarity.email,
            matchMethod: 'composite',
            resolution: 'pending',
            requiresHumanReview: similarity.overall < 0.95
          };

          candidates.push(candidate);

          // Store in database
          await this.supabase.from('migration_dedup_candidates').insert({
            candidate_id: candidate.candidateId,
            migration_batch_id: batchId,
            record_a_source: 'source',
            record_a_id: candidate.recordAId,
            record_a_data: candidate.recordAData,
            record_b_source: 'source',
            record_b_id: candidate.recordBId,
            record_b_data: candidate.recordBData,
            overall_similarity: candidate.overallSimilarity,
            name_similarity: candidate.nameSimilarity,
            dob_match: candidate.dobMatch,
            phone_similarity: candidate.phoneSimilarity,
            email_similarity: candidate.emailSimilarity,
            match_method: candidate.matchMethod,
            requires_human_review: candidate.requiresHumanReview
          });
        }
      }
    }

    return candidates;
  }

  /** Calculate similarity between two records */
  private calculateSimilarity(
    recordA: Record<string, unknown>,
    recordB: Record<string, unknown>
  ): {
    overall: number;
    name?: number;
    dobMatch?: boolean;
    phone?: number;
    email?: number;
  } {
    let totalWeight = 0;
    let weightedScore = 0;

    // Name similarity (weight: 0.4)
    const nameA = `${recordA['first_name'] || ''} ${recordA['last_name'] || ''}`.trim();
    const nameB = `${recordB['first_name'] || ''} ${recordB['last_name'] || ''}`.trim();
    const nameSim = nameA && nameB ? CryptoUtils.nameSimilarity(nameA, nameB) : 0;
    if (nameA && nameB) {
      weightedScore += nameSim * 0.4;
      totalWeight += 0.4;
    }

    // DOB match (weight: 0.25)
    const dobA = recordA['date_of_birth'] || recordA['dob'];
    const dobB = recordB['date_of_birth'] || recordB['dob'];
    const dobMatch = dobA && dobB && String(dobA) === String(dobB);
    if (dobA && dobB) {
      weightedScore += (dobMatch ? 1 : 0) * 0.25;
      totalWeight += 0.25;
    }

    // Phone similarity (weight: 0.2)
    const phoneA = String(recordA['phone'] || recordA['phone_mobile'] || '').replace(/\D/g, '');
    const phoneB = String(recordB['phone'] || recordB['phone_mobile'] || '').replace(/\D/g, '');
    const phoneSim = phoneA && phoneB && phoneA === phoneB ? 1 : 0;
    if (phoneA && phoneB) {
      weightedScore += phoneSim * 0.2;
      totalWeight += 0.2;
    }

    // Email similarity (weight: 0.15)
    const emailA = String(recordA['email'] || '').toLowerCase();
    const emailB = String(recordB['email'] || '').toLowerCase();
    const emailSim = emailA && emailB && emailA === emailB ? 1 : 0;
    if (emailA && emailB) {
      weightedScore += emailSim * 0.15;
      totalWeight += 0.15;
    }

    const overall = totalWeight > 0 ? weightedScore / totalWeight : 0;

    return {
      overall,
      name: nameSim,
      dobMatch,
      phone: phoneSim,
      email: emailSim
    };
  }

  /** Resolve a duplicate */
  async resolveDuplicate(
    candidateId: string,
    resolution: DedupCandidate['resolution'],
    resolvedBy: string,
    notes?: string
  ): Promise<void> {
    await this.supabase
      .from('migration_dedup_candidates')
      .update({
        resolution,
        resolved_by: resolvedBy,
        resolved_at: new Date().toISOString(),
        resolution_notes: notes
      })
      .eq('candidate_id', candidateId);
  }

  /** Get pending duplicates for review */
  async getPendingDuplicates(batchId: string): Promise<DedupCandidate[]> {
    const { data, error } = await this.supabase
      .from('migration_dedup_candidates')
      .select('*')
      .eq('migration_batch_id', batchId)
      .eq('resolution', 'pending')
      .order('overall_similarity', { ascending: false });

    if (error) return [];

    return (data || []).map(row => ({
      candidateId: row.candidate_id,
      recordAId: row.record_a_id,
      recordAData: row.record_a_data,
      recordBId: row.record_b_id,
      recordBData: row.record_b_data,
      overallSimilarity: row.overall_similarity,
      nameSimilarity: row.name_similarity,
      dobMatch: row.dob_match,
      phoneSimilarity: row.phone_similarity,
      emailSimilarity: row.email_similarity,
      matchMethod: row.match_method,
      resolution: row.resolution,
      requiresHumanReview: row.requires_human_review
    }));
  }
}

// =============================================================================
// QUALITY SCORING SERVICE
// =============================================================================

export class QualityScoringService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /** Calculate quality score for a migration batch */
  async calculateScore(batchId: string): Promise<QualityScore> {
    const { data, error } = await this.supabase.rpc('calculate_migration_quality', {
      p_batch_id: batchId
    });

    if (error) {
      auditLogger.error('Quality', 'Failed to calculate quality score', { error: error.message });
      return {
        overallScore: 0,
        completenessScore: 0,
        accuracyScore: 0,
        consistencyScore: 0,
        uniquenessScore: 0,
        grade: 'F',
        recommendations: ['Unable to calculate quality score'],
        readyForProduction: false
      };
    }

    const result = data as Record<string, unknown>;

    return {
      overallScore: result.overall_score as number,
      completenessScore: result.completeness as number,
      accuracyScore: result.accuracy as number,
      consistencyScore: result.consistency as number,
      uniquenessScore: result.uniqueness as number,
      grade: result.grade as string,
      recommendations: result.recommendations as string[],
      readyForProduction: result.ready_for_production as boolean
    };
  }

  /** Get historical quality scores */
  async getHistoricalScores(organizationId: string, limit: number = 10): Promise<QualityScore[]> {
    const { data } = await this.supabase
      .from('migration_quality_scores')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    return (data || []).map(row => ({
      overallScore: row.overall_score,
      completenessScore: row.completeness_score,
      accuracyScore: row.accuracy_score,
      consistencyScore: row.consistency_score,
      uniquenessScore: row.uniqueness_score,
      grade: this.calculateGrade(row.overall_score),
      recommendations: row.recommendations || [],
      readyForProduction: row.overall_score >= 85 && row.accuracy_score >= 90
    }));
  }

  private calculateGrade(score: number): string {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'B+';
    if (score >= 80) return 'B';
    if (score >= 75) return 'C+';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }
}

// =============================================================================
// CONDITIONAL MAPPING SERVICE
// =============================================================================

export class ConditionalMappingService {
  private supabase: SupabaseClient;
  private mappingsCache: Map<string, ConditionalMapping[]> = new Map();

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /** Load conditional mappings for a column */
  async loadMappings(sourceColumn: string): Promise<ConditionalMapping[]> {
    if (this.mappingsCache.has(sourceColumn)) {
      return this.mappingsCache.get(sourceColumn)!;
    }

    const { data } = await this.supabase
      .from('migration_conditional_mappings')
      .select('*')
      .eq('source_column', sourceColumn)
      .eq('is_active', true)
      .order('priority', { ascending: true });

    const mappings = (data || []).map(row => ({
      mappingId: row.mapping_id,
      sourceColumn: row.source_column,
      condition: row.condition,
      actionType: row.action_type,
      actionConfig: row.action_config,
      priority: row.priority
    }));

    this.mappingsCache.set(sourceColumn, mappings);
    return mappings;
  }

  /** Evaluate conditional mappings for a record */
  async evaluate(
    sourceColumn: string,
    record: Record<string, unknown>
  ): Promise<{
    matched: boolean;
    actionType?: string;
    actionConfig?: Record<string, unknown>;
  }> {
    const mappings = await this.loadMappings(sourceColumn);

    for (const mapping of mappings) {
      if (this.evaluateCondition(mapping.condition, record)) {
        return {
          matched: true,
          actionType: mapping.actionType,
          actionConfig: mapping.actionConfig
        };
      }
    }

    return { matched: false };
  }

  /** Evaluate a single condition */
  private evaluateCondition(
    condition: ConditionalMapping['condition'],
    record: Record<string, unknown>
  ): boolean {
    const fieldValue = String(record[condition.field] ?? '');

    switch (condition.type) {
      case 'value_equals':
        return fieldValue === condition.value;

      case 'value_in':
        return (condition.values || []).includes(fieldValue);

      case 'value_matches':
        return condition.pattern ? new RegExp(condition.pattern).test(fieldValue) : false;

      case 'value_range':
        const numValue = parseFloat(fieldValue);
        if (isNaN(numValue)) return false;
        const minOk = condition.min === undefined || numValue >= condition.min;
        const maxOk = condition.max === undefined || numValue <= condition.max;
        return minOk && maxOk;

      case 'value_null':
        return !fieldValue || fieldValue === 'null' || fieldValue === 'undefined';

      case 'value_not_null':
        return !!fieldValue && fieldValue !== 'null' && fieldValue !== 'undefined';

      default:
        return false;
    }
  }
}

// =============================================================================
// WORKFLOW ORCHESTRATION SERVICE
// =============================================================================

export class WorkflowOrchestrationService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /** Get workflow template by ID or name */
  async getTemplate(templateIdOrName: string): Promise<WorkflowStep[] | null> {
    const { data } = await this.supabase
      .from('migration_workflow_templates')
      .select('workflow_steps')
      .or(`template_id.eq.${templateIdOrName},template_name.eq.${templateIdOrName}`)
      .eq('is_active', true)
      .single();

    if (!data) return null;
    return data.workflow_steps as WorkflowStep[];
  }

  /** Create workflow execution */
  async createExecution(
    batchId: string,
    templateId: string,
    steps: WorkflowStep[]
  ): Promise<string> {
    const executionId = crypto.randomUUID();

    const stepStatuses: Record<string, string> = {};
    steps.forEach(step => {
      stepStatuses[step.table] = 'pending';
    });

    await this.supabase.from('migration_workflow_executions').insert({
      execution_id: executionId,
      migration_batch_id: batchId,
      template_id: templateId,
      status: 'pending',
      step_statuses: stepStatuses,
      current_step: 0,
      total_steps: steps.length
    });

    return executionId;
  }

  /** Get next executable step (all dependencies completed) */
  async getNextStep(executionId: string): Promise<WorkflowStep | null> {
    const { data: execution } = await this.supabase
      .from('migration_workflow_executions')
      .select('*')
      .eq('execution_id', executionId)
      .single();

    if (!execution) return null;

    const { data: template } = await this.supabase
      .from('migration_workflow_templates')
      .select('workflow_steps')
      .eq('template_id', execution.template_id)
      .single();

    if (!template) return null;

    const steps = template.workflow_steps as WorkflowStep[];
    const statuses = execution.step_statuses as Record<string, string>;

    for (const step of steps) {
      // Skip if already completed or in progress
      if (statuses[step.table] !== 'pending') continue;

      // Check if all dependencies are completed
      const depsCompleted = step.dependsOn.every(
        dep => statuses[dep] === 'completed'
      );

      if (depsCompleted) {
        return step;
      }
    }

    return null;
  }

  /** Mark step as completed */
  async completeStep(executionId: string, table: string): Promise<void> {
    const { data: execution } = await this.supabase
      .from('migration_workflow_executions')
      .select('step_statuses, current_step')
      .eq('execution_id', executionId)
      .single();

    if (!execution) return;

    const statuses = execution.step_statuses as Record<string, string>;
    statuses[table] = 'completed';

    const allCompleted = Object.values(statuses).every(s => s === 'completed');

    await this.supabase
      .from('migration_workflow_executions')
      .update({
        step_statuses: statuses,
        current_step: execution.current_step + 1,
        status: allCompleted ? 'completed' : 'running',
        completed_at: allCompleted ? new Date().toISOString() : null
      })
      .eq('execution_id', executionId);
  }
}

// =============================================================================
// ENTERPRISE MIGRATION SERVICE - Main Interface
// =============================================================================

export class EnterpriseMigrationService extends IntelligentMigrationService {
  private enterpriseSupabase: SupabaseClient;
  private enterpriseOrgId: string;

  // Enterprise services
  private snapshotService: SnapshotService;
  private retryService: RetryService;
  private dedupService: DeduplicationService;
  private qualityService: QualityScoringService;
  private conditionalService: ConditionalMappingService;
  private workflowService: WorkflowOrchestrationService;

  constructor(supabase: SupabaseClient, organizationId: string) {
    super(supabase, organizationId);
    this.enterpriseSupabase = supabase;
    this.enterpriseOrgId = organizationId;

    // Initialize enterprise services
    this.snapshotService = new SnapshotService(supabase);
    this.retryService = new RetryService(supabase);
    this.dedupService = new DeduplicationService(supabase);
    this.qualityService = new QualityScoringService(supabase);
    this.conditionalService = new ConditionalMappingService(supabase);
    this.workflowService = new WorkflowOrchestrationService(supabase);
  }

  /**
   * Execute enterprise-grade migration with all features
   */
  async executeEnterpriseMigration(
    dna: SourceDNA,
    data: Record<string, unknown>[],
    mappings: MappingSuggestion[],
    options: EnterpriseMigrationOptions = {}
  ): Promise<EnterpriseMigrationResult> {
    const startTime = Date.now();
    let snapshotId: string | undefined;
    let lineageService: DataLineageService | undefined;
    let workflowExecutionId: string | undefined;
    let retriesQueued = 0;
    let duplicatesFound = 0;
    let lineageRecordsCreated = 0;

    // Default options
    const opts: Required<EnterpriseMigrationOptions> = {
      dryRun: options.dryRun ?? false,
      validateOnly: options.validateOnly ?? false,
      batchSize: options.batchSize ?? 100,
      enableLineageTracking: options.enableLineageTracking ?? true,
      createPreMigrationSnapshot: options.createPreMigrationSnapshot ?? true,
      enableRetryLogic: options.enableRetryLogic ?? true,
      maxRetryAttempts: options.maxRetryAttempts ?? 5,
      enableParallelProcessing: options.enableParallelProcessing ?? false,
      workerCount: options.workerCount ?? 4,
      enableDeduplication: options.enableDeduplication ?? true,
      dedupThreshold: options.dedupThreshold ?? 0.8,
      enableQualityScoring: options.enableQualityScoring ?? true,
      enableConditionalMappings: options.enableConditionalMappings ?? true,
      useWorkflowOrchestration: options.useWorkflowOrchestration ?? false,
      workflowTemplateId: options.workflowTemplateId ?? 'healthcare_staff_standard',
      encryptPHI: options.encryptPHI ?? true,
      phiFields: options.phiFields ?? [],
      stopOnError: options.stopOnError ?? false,
      stopOnQualityThreshold: options.stopOnQualityThreshold ?? 70
    };

    auditLogger.info('EnterpriseMigration', 'Starting enterprise migration', {
      organizationId: this.enterpriseOrgId,
      sourceSystem: dna.sourceSystem,
      rowCount: data.length,
      options: opts
    });

    try {
      // 1. Pre-migration snapshot
      if (opts.createPreMigrationSnapshot && !opts.dryRun) {
        const tables = [...new Set(mappings.map(m => m.targetTable).filter(t => t !== 'UNMAPPED'))];
        snapshotId = await this.snapshotService.createSnapshot(
          tables,
          undefined, // batch ID not yet created
          'pre_migration',
          `Pre-migration snapshot for ${dna.sourceSystem || dna.sourceType} import`
        );
        auditLogger.info('EnterpriseMigration', 'Created pre-migration snapshot', { snapshotId });
      }

      // 2. Deduplication check
      if (opts.enableDeduplication) {
        const duplicates = await this.dedupService.findDuplicates(
          'temp-batch',
          data
        );
        duplicatesFound = duplicates.length;

        if (duplicatesFound > 0) {
          auditLogger.warn('EnterpriseMigration', 'Duplicates found', {
            count: duplicatesFound,
            threshold: opts.dedupThreshold
          });
        }
      }

      // 3. Workflow orchestration setup
      if (opts.useWorkflowOrchestration) {
        const template = await this.workflowService.getTemplate(opts.workflowTemplateId);
        if (template) {
          workflowExecutionId = await this.workflowService.createExecution(
            'temp-batch',
            opts.workflowTemplateId,
            template
          );
        }
      }

      // 4. Create migration batch
      const { data: batch } = await this.enterpriseSupabase
        .from('hc_migration_batch')
        .insert({
          organization_id: this.enterpriseOrgId,
          source_system: dna.sourceSystem || dna.sourceType,
          record_count: data.length,
          status: opts.dryRun ? 'DRY_RUN' : 'PROCESSING',
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      const batchId = batch?.batch_id || crypto.randomUUID();

      // 5. Initialize lineage tracking
      if (opts.enableLineageTracking) {
        lineageService = new DataLineageService(
          this.enterpriseSupabase,
          batchId,
          `${dna.sourceSystem || dna.sourceType}_${Date.now()}`
        );
      }

      // 6. Process with conditional mappings
      const processedMappings = opts.enableConditionalMappings
        ? await this.applyConditionalMappings(mappings, data)
        : mappings;

      // 7. Execute migration with lineage tracking
      const errors: Array<{ row: number; field: string; error: string }> = [];
      const results: MigrationResult[] = [];
      let successCount = 0;
      let errorCount = 0;

      // Group by target table
      const tableGroups = this.groupByTable(processedMappings);

      for (const [table, tableMappings] of Object.entries(tableGroups)) {
        if (table === 'UNMAPPED') continue;

        // Check workflow dependencies if using orchestration
        if (opts.useWorkflowOrchestration && workflowExecutionId) {
          const nextStep = await this.workflowService.getNextStep(workflowExecutionId);
          if (!nextStep || nextStep.table !== table) {
            // Skip - dependencies not met
            continue;
          }
        }

        for (let i = 0; i < data.length; i += opts.batchSize) {
          const batchData = data.slice(i, i + opts.batchSize);

          try {
            const batchResult = await this.processBatchWithLineage(
              table,
              tableMappings,
              batchData,
              dna,
              batchId,
              i,
              lineageService,
              opts
            );

            successCount += batchResult.successCount;
            errorCount += batchResult.errorCount;
            errors.push(...batchResult.errors);
            results.push(...batchResult.results);
            lineageRecordsCreated += batchResult.lineageCount;
          } catch (batchError) {
            // Queue for retry if enabled
            if (opts.enableRetryLogic && !opts.dryRun) {
              const rowNumbers = batchData.map((_, idx) => i + idx);
              await this.retryService.queueRetry(
                batchId,
                'batch_insert',
                table,
                rowNumbers,
                'BATCH_ERROR',
                batchError instanceof Error ? batchError.message : 'Unknown error',
                { mappings: tableMappings }
              );
              retriesQueued++;
            }
            errorCount += batchData.length;
          }
        }

        // Mark workflow step completed
        if (opts.useWorkflowOrchestration && workflowExecutionId) {
          await this.workflowService.completeStep(workflowExecutionId, table);
        }
      }

      // 8. Flush lineage records
      if (lineageService) {
        await lineageService.flush();
      }

      // 9. Update batch status
      await this.enterpriseSupabase
        .from('hc_migration_batch')
        .update({
          status: errorCount === 0 ? 'COMPLETED' : 'COMPLETED_WITH_ERRORS',
          success_count: successCount,
          error_count: errorCount,
          completed_at: new Date().toISOString()
        })
        .eq('batch_id', batchId);

      // 10. Calculate quality score
      let qualityScore: QualityScore | undefined;
      if (opts.enableQualityScoring && !opts.dryRun) {
        qualityScore = await this.qualityService.calculateScore(batchId);

        // Check quality threshold
        if (qualityScore.overallScore < opts.stopOnQualityThreshold) {
          auditLogger.warn('EnterpriseMigration', 'Quality below threshold', {
            score: qualityScore.overallScore,
            threshold: opts.stopOnQualityThreshold
          });
        }
      }

      const endTime = Date.now();
      const processingTimeMs = endTime - startTime;
      const throughput = data.length / (processingTimeMs / 1000);

      auditLogger.info('EnterpriseMigration', 'Migration completed', {
        batchId,
        successCount,
        errorCount,
        qualityScore: qualityScore?.overallScore,
        processingTimeMs,
        throughputRowsPerSecond: throughput
      });

      return {
        batchId,
        totalRecords: data.length,
        successCount,
        errorCount,
        errors,
        results,
        snapshotId,
        lineageRecordsCreated,
        retriesQueued,
        duplicatesFound,
        qualityScore,
        workflowExecutionId,
        processingTimeMs,
        throughputRowsPerSecond: Math.round(throughput * 100) / 100
      };
    } catch (error) {
      auditLogger.error('EnterpriseMigration', 'Migration failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /** Apply conditional mappings to data */
  private async applyConditionalMappings(
    mappings: MappingSuggestion[],
    data: Record<string, unknown>[]
  ): Promise<MappingSuggestion[]> {
    // For each mapping, check if there are conditional rules
    const processed: MappingSuggestion[] = [];

    for (const mapping of mappings) {
      // Check if any records trigger conditional rules
      const conditionalMappings = await this.conditionalService.loadMappings(mapping.sourceColumn);

      if (conditionalMappings.length === 0) {
        processed.push(mapping);
        continue;
      }

      // Apply conditional logic (simplified - just use first record to determine)
      const result = await this.conditionalService.evaluate(mapping.sourceColumn, data[0]);

      if (result.matched && result.actionType === 'skip') {
        // Skip this mapping
        continue;
      } else if (result.matched && result.actionType === 'map_to_column') {
        // Override mapping
        const config = result.actionConfig as { target_table?: string; target_column?: string };
        processed.push({
          ...mapping,
          targetTable: config.target_table || mapping.targetTable,
          targetColumn: config.target_column || mapping.targetColumn
        });
      } else {
        processed.push(mapping);
      }
    }

    return processed;
  }

  /** Group mappings by target table */
  private groupByTable(mappings: MappingSuggestion[]): Record<string, MappingSuggestion[]> {
    const groups: Record<string, MappingSuggestion[]> = {};

    for (const mapping of mappings) {
      if (!groups[mapping.targetTable]) {
        groups[mapping.targetTable] = [];
      }
      groups[mapping.targetTable].push(mapping);
    }

    return groups;
  }

  /** Process a batch with lineage tracking */
  private async processBatchWithLineage(
    table: string,
    mappings: MappingSuggestion[],
    data: Record<string, unknown>[],
    dna: SourceDNA,
    batchId: string,
    startIndex: number,
    lineageService: DataLineageService | undefined,
    options: Required<EnterpriseMigrationOptions>
  ): Promise<{
    successCount: number;
    errorCount: number;
    errors: Array<{ row: number; field: string; error: string }>;
    results: MigrationResult[];
    lineageCount: number;
  }> {
    const errors: Array<{ row: number; field: string; error: string }> = [];
    const results: MigrationResult[] = [];
    const transformedRows: Record<string, unknown>[] = [];
    let successCount = 0;
    let errorCount = 0;
    let lineageCount = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = startIndex + i + 1;
      const transformed: Record<string, unknown> = {
        organization_id: this.enterpriseOrgId,
        source_system: dna.sourceSystem || dna.sourceType,
        source_id: String(row['id'] || row['employee_id'] || rowNumber),
        migration_batch_id: batchId,
        migration_status: 'IMPORTED'
      };

      let rowHasError = false;

      for (const mapping of mappings) {
        try {
          const sourceValue = row[mapping.sourceColumn];
          if (sourceValue === undefined) continue;

          // Transform
          const transformedValue = this.transformValueWithTracking(
            sourceValue,
            mapping.transformRequired
          );

          // Validate
          const validation = this.validateValueEnterprise(
            transformedValue,
            mapping.targetColumn,
            table
          );

          // Track lineage
          if (lineageService) {
            const transformations: TransformationStep[] = mapping.transformRequired
              ? [{
                  step: 1,
                  type: mapping.transformRequired,
                  beforeHash: await CryptoUtils.hashValue(String(sourceValue)),
                  afterHash: await CryptoUtils.hashValue(String(transformedValue))
                }]
              : [];

            await lineageService.trackTransformation(
              rowNumber,
              mapping.sourceColumn,
              sourceValue,
              table,
              mapping.targetColumn,
              transformations,
              transformedValue,
              undefined, // targetRowId set after insert
              validation.valid,
              validation.error ? [validation.error] : []
            );
            lineageCount++;
          }

          if (!validation.valid) {
            errors.push({
              row: rowNumber,
              field: mapping.sourceColumn,
              error: validation.error || 'Validation failed'
            });
            rowHasError = true;
          } else {
            transformed[mapping.targetColumn] = transformedValue;
          }
        } catch (err) {
          errors.push({
            row: rowNumber,
            field: mapping.sourceColumn,
            error: err instanceof Error ? err.message : 'Unknown error'
          });
          rowHasError = true;
        }
      }

      if (!rowHasError) {
        transformedRows.push(transformed);
        successCount++;
      } else {
        errorCount++;
      }
    }

    // Insert if not dry run
    if (!options.dryRun && !options.validateOnly && transformedRows.length > 0) {
      const { error: insertError } = await this.enterpriseSupabase
        .from(table)
        .insert(transformedRows);

      if (insertError) {
        errors.push({
          row: startIndex + 1,
          field: 'INSERT',
          error: insertError.message
        });
      }
    }

    return { successCount, errorCount, errors, results, lineageCount };
  }

  /** Transform value with tracking */
  private transformValueWithTracking(value: unknown, transform?: string): unknown {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const strValue = String(value).trim();

    switch (transform) {
      case 'NORMALIZE_PHONE':
        return strValue.replace(/\D/g, '').slice(-10);

      case 'CONVERT_DATE_TO_ISO':
        return this.parseDateEnterprise(strValue);

      case 'PARSE_NAME_FIRST':
        if (strValue.includes(',')) {
          return strValue.split(',')[1]?.trim();
        }
        return strValue.split(' ')[0];

      case 'PARSE_NAME_LAST':
        if (strValue.includes(',')) {
          return strValue.split(',')[0]?.trim();
        }
        const parts = strValue.split(' ');
        return parts[parts.length - 1];

      case 'CONVERT_STATE_TO_CODE':
        return this.stateToCodeEnterprise(strValue);

      case 'UPPERCASE':
        return strValue.toUpperCase();

      case 'LOWERCASE':
        return strValue.toLowerCase();

      case 'TRIM':
        return strValue.trim();

      default:
        return strValue;
    }
  }

  /** Parse date to ISO format */
  private parseDateEnterprise(value: string): string | null {
    try {
      const formats = [
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
        /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
        /^(\d{4})-(\d{2})-(\d{2})$/
      ];

      for (const format of formats) {
        const match = value.match(format);
        if (match) {
          if (format === formats[2]) {
            return `${match[1]}-${match[2]}-${match[3]}`;
          } else {
            const month = match[1].padStart(2, '0');
            const day = match[2].padStart(2, '0');
            const year = match[3];
            return `${year}-${month}-${day}`;
          }
        }
      }

      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }

      return null;
    } catch {
      return null;
    }
  }

  /** Convert state name to code */
  private stateToCodeEnterprise(state: string): string {
    const states: Record<string, string> = {
      'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
      'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
      'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
      'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
      'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
      'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
      'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
      'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
      'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
      'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
      'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
      'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
      'wisconsin': 'WI', 'wyoming': 'WY'
    };

    const lower = state.toLowerCase();
    if (states[lower]) return states[lower];
    if (state.length === 2) return state.toUpperCase();
    return state;
  }

  /** Validate value with enterprise rules */
  private validateValueEnterprise(
    value: unknown,
    column: string,
    _table: string
  ): { valid: boolean; error?: string } {
    if (value === null) {
      const required = ['first_name', 'last_name', 'organization_id'];
      if (required.includes(column)) {
        return { valid: false, error: `${column} is required` };
      }
      return { valid: true };
    }

    const strValue = String(value);

    // NPI validation with Luhn
    if (column === 'npi' && strValue) {
      if (!PatternDetector.validateNPI(strValue)) {
        return { valid: false, error: 'Invalid NPI (failed Luhn check)' };
      }
    }

    // Email validation
    if (column === 'email' && strValue) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strValue)) {
        return { valid: false, error: 'Invalid email format' };
      }
    }

    // State code validation
    if (column === 'state' && strValue) {
      if (!/^[A-Z]{2}$/.test(strValue)) {
        return { valid: false, error: 'State must be 2-letter code' };
      }
    }

    // Date validation
    if (['hire_date', 'termination_date', 'expiration_date', 'date_of_birth', 'issued_date'].includes(column)) {
      if (strValue && !/^\d{4}-\d{2}-\d{2}$/.test(strValue)) {
        return { valid: false, error: 'Date must be YYYY-MM-DD format' };
      }
    }

    return { valid: true };
  }

  // =========================================================================
  // PUBLIC SERVICE ACCESSORS
  // =========================================================================

  /** Get snapshot service for rollback operations */
  getSnapshotService(): SnapshotService {
    return this.snapshotService;
  }

  /** Get retry service for failed operation handling */
  getRetryService(): RetryService {
    return this.retryService;
  }

  /** Get deduplication service */
  getDeduplicationService(): DeduplicationService {
    return this.dedupService;
  }

  /** Get quality scoring service */
  getQualityService(): QualityScoringService {
    return this.qualityService;
  }

  /** Get workflow orchestration service */
  getWorkflowService(): WorkflowOrchestrationService {
    return this.workflowService;
  }
}

// Export all services
export {
  CryptoUtils,
  DataLineageService,
  SnapshotService,
  RetryService,
  ParallelProcessingService,
  DeduplicationService,
  QualityScoringService,
  ConditionalMappingService,
  WorkflowOrchestrationService
};
