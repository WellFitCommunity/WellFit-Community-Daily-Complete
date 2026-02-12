/**
 * Enterprise Migration Engine — Data Lineage Service
 *
 * Full audit trail tracking from source to target for every
 * value transformation during migration.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { auditLogger } from '../auditLogger';
import { CryptoUtils } from './cryptoUtils';
import type { LineageRecord, TransformationStep } from './types';

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
