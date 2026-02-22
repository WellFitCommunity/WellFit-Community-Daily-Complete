/**
 * Enterprise Migration Engine — Retry Service
 *
 * Exponential backoff retry logic for failed migration operations.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { auditLogger } from '../auditLogger';
import type { RetryQueueItem } from './types';

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
      .select('retry_id, migration_batch_id, failed_operation, target_table, source_row_numbers, error_code, error_message, attempt_number, max_attempts, next_retry_at, status')
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
