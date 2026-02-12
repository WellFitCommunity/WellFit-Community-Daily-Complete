/**
 * Enterprise Migration Engine — Parallel Processing Service
 *
 * Distributed worker coordination for parallel migration processing.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { WorkQueueItem } from './types';

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
