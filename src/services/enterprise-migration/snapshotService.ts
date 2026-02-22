/**
 * Enterprise Migration Engine — Snapshot Service
 *
 * Point-in-time snapshots and rollback capability
 * for migration recovery.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { auditLogger } from '../auditLogger';
import type { MigrationSnapshot, RollbackResult } from './types';

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

    auditLogger.info('Snapshot: Created migration snapshot', {
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
    auditLogger.warn('Snapshot: Initiating rollback', {
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

    auditLogger.info('Snapshot: Rollback completed', {
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
      .select('snapshot_id, migration_batch_id, snapshot_name, snapshot_type, description, tables_included, snapshot_data, total_rows, size_bytes, status, created_by, created_at, restored_at')
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
