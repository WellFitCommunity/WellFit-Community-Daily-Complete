/**
 * Sync Observability Service
 *
 * Provides comprehensive monitoring, metrics, and health reporting for offline sync.
 * Enables operations teams to understand sync health without exposing PHI.
 *
 * Features:
 * - Real-time sync metrics
 * - Health status indicators
 * - Error categorization and trending
 * - Network quality detection
 * - Storage quota monitoring
 * - Anonymized telemetry (no PHI)
 */

import { auditLogger as _auditLogger } from '../../auditLogger';
import type { ServiceResult } from '../../_base/ServiceResult';
import { success, failure } from '../../_base/ServiceResult';
import type { SyncMetrics, SyncState } from './types';
import type { RetentionPolicy as _RetentionPolicy } from './types';

/**
 * Network quality levels
 */
export type NetworkQuality = 'offline' | 'poor' | 'fair' | 'good' | 'excellent';

/**
 * Health status for sync system
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'critical';

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: number;
  checks: {
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message?: string;
    value?: number | string;
  }[];
  metrics: SyncMetrics;
}

/**
 * Error category for tracking
 */
export interface ErrorCategory {
  code: string;
  count: number;
  lastOccurrence: number;
  samples: string[];
}

/**
 * Sync event for telemetry
 */
interface SyncEvent {
  type: 'sync_start' | 'sync_complete' | 'sync_error' | 'conflict_detected' | 'conflict_resolved';
  timestamp: number;
  durationMs?: number;
  recordCount?: number;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Sync Observability Service
 */
export class SyncObservabilityService {
  private metrics: SyncMetrics;
  private errors: Map<string, ErrorCategory> = new Map();
  private events: SyncEvent[] = [];
  private syncDurations: number[] = [];
  private maxEventsToKeep = 1000;
  private maxDurationsToKeep = 100;

  constructor() {
    this.metrics = this.createInitialMetrics();
  }

  /**
   * Record sync start
   */
  recordSyncStart(): number {
    this.metrics.syncAttempts++;

    const event: SyncEvent = {
      type: 'sync_start',
      timestamp: Date.now(),
    };

    this.addEvent(event);
    return event.timestamp;
  }

  /**
   * Record sync completion
   */
  recordSyncComplete(
    startTimestamp: number,
    syncedCount: number,
    failedCount: number
  ): void {
    const durationMs = Date.now() - startTimestamp;

    if (failedCount === 0) {
      this.metrics.syncSuccesses++;
      this.metrics.lastSuccessfulSync = Date.now();
    } else {
      this.metrics.syncFailures++;
    }

    // Update average duration
    this.syncDurations.push(durationMs);
    if (this.syncDurations.length > this.maxDurationsToKeep) {
      this.syncDurations.shift();
    }
    this.metrics.avgSyncDurationMs = this.calculateAverageDuration();

    const event: SyncEvent = {
      type: 'sync_complete',
      timestamp: Date.now(),
      durationMs,
      recordCount: syncedCount,
    };

    this.addEvent(event);
  }

  /**
   * Record sync error
   */
  recordSyncError(errorCode: string, errorMessage: string): void {
    this.metrics.syncFailures++;

    // Track error category
    const category = this.errors.get(errorCode) || {
      code: errorCode,
      count: 0,
      lastOccurrence: 0,
      samples: [],
    };

    category.count++;
    category.lastOccurrence = Date.now();

    // Keep last 5 error messages as samples
    if (category.samples.length >= 5) {
      category.samples.shift();
    }
    category.samples.push(errorMessage);

    this.errors.set(errorCode, category);
    this.metrics.errorsByType[errorCode] = category.count;

    const event: SyncEvent = {
      type: 'sync_error',
      timestamp: Date.now(),
      errorCode,
    };

    this.addEvent(event);
  }

  /**
   * Record conflict detection
   */
  recordConflictDetected(recordId: string): void {
    this.metrics.conflictsDetected++;
    this.metrics.conflictsPending++;

    const event: SyncEvent = {
      type: 'conflict_detected',
      timestamp: Date.now(),
      metadata: { recordId },
    };

    this.addEvent(event);
  }

  /**
   * Record conflict resolution
   */
  recordConflictResolved(recordId: string, strategy: string): void {
    this.metrics.conflictsResolved++;
    this.metrics.conflictsPending = Math.max(0, this.metrics.conflictsPending - 1);

    const event: SyncEvent = {
      type: 'conflict_resolved',
      timestamp: Date.now(),
      metadata: { recordId, strategy },
    };

    this.addEvent(event);
  }

  /**
   * Update pending record count
   */
  updatePendingCount(count: number): void {
    this.metrics.pendingRecordCount = count;
  }

  /**
   * Update records by state
   */
  updateRecordsByState(states: Record<SyncState, number>): void {
    this.metrics.recordsByState = states;
  }

  /**
   * Update oldest pending timestamp
   */
  updateOldestPendingTimestamp(timestamp: number | undefined): void {
    this.metrics.oldestPendingTimestamp = timestamp;
  }

  /**
   * Get current metrics
   */
  getMetrics(): SyncMetrics {
    return { ...this.metrics };
  }

  /**
   * Perform health check
   */
  async performHealthCheck(): Promise<ServiceResult<HealthCheckResult>> {
    try {
      const checks: HealthCheckResult['checks'] = [];
      let overallStatus: HealthStatus = 'healthy';

      // Check 1: Sync success rate
      const successRate = this.calculateSuccessRate();
      if (successRate < 0.5) {
        checks.push({
          name: 'sync_success_rate',
          status: 'fail',
          message: `Success rate ${(successRate * 100).toFixed(1)}% is below threshold`,
          value: `${(successRate * 100).toFixed(1)}%`,
        });
        overallStatus = 'critical';
      } else if (successRate < 0.8) {
        checks.push({
          name: 'sync_success_rate',
          status: 'warn',
          message: `Success rate ${(successRate * 100).toFixed(1)}% is below optimal`,
          value: `${(successRate * 100).toFixed(1)}%`,
        });
        if (overallStatus === 'healthy') overallStatus = 'degraded';
      } else {
        checks.push({
          name: 'sync_success_rate',
          status: 'pass',
          value: `${(successRate * 100).toFixed(1)}%`,
        });
      }

      // Check 2: Pending records age
      if (this.metrics.oldestPendingTimestamp) {
        const ageHours = (Date.now() - this.metrics.oldestPendingTimestamp) / (1000 * 60 * 60);
        if (ageHours > 24) {
          checks.push({
            name: 'pending_records_age',
            status: 'fail',
            message: `Records pending for ${ageHours.toFixed(1)} hours`,
            value: `${ageHours.toFixed(1)}h`,
          });
          if (overallStatus !== 'critical') overallStatus = 'unhealthy';
        } else if (ageHours > 4) {
          checks.push({
            name: 'pending_records_age',
            status: 'warn',
            message: `Records pending for ${ageHours.toFixed(1)} hours`,
            value: `${ageHours.toFixed(1)}h`,
          });
          if (overallStatus === 'healthy') overallStatus = 'degraded';
        } else {
          checks.push({
            name: 'pending_records_age',
            status: 'pass',
            value: `${ageHours.toFixed(1)}h`,
          });
        }
      } else {
        checks.push({
          name: 'pending_records_age',
          status: 'pass',
          value: 'No pending records',
        });
      }

      // Check 3: Conflict backlog
      if (this.metrics.conflictsPending > 10) {
        checks.push({
          name: 'conflict_backlog',
          status: 'fail',
          message: `${this.metrics.conflictsPending} unresolved conflicts`,
          value: this.metrics.conflictsPending,
        });
        if (overallStatus !== 'critical') overallStatus = 'unhealthy';
      } else if (this.metrics.conflictsPending > 3) {
        checks.push({
          name: 'conflict_backlog',
          status: 'warn',
          message: `${this.metrics.conflictsPending} unresolved conflicts`,
          value: this.metrics.conflictsPending,
        });
        if (overallStatus === 'healthy') overallStatus = 'degraded';
      } else {
        checks.push({
          name: 'conflict_backlog',
          status: 'pass',
          value: this.metrics.conflictsPending,
        });
      }

      // Check 4: Storage usage
      const storageInfo = await this.checkStorageQuota();
      if (storageInfo.usagePercent > 90) {
        checks.push({
          name: 'storage_usage',
          status: 'fail',
          message: `Storage ${storageInfo.usagePercent.toFixed(1)}% full`,
          value: `${storageInfo.usagePercent.toFixed(1)}%`,
        });
        if (overallStatus !== 'critical') overallStatus = 'unhealthy';
      } else if (storageInfo.usagePercent > 70) {
        checks.push({
          name: 'storage_usage',
          status: 'warn',
          message: `Storage ${storageInfo.usagePercent.toFixed(1)}% full`,
          value: `${storageInfo.usagePercent.toFixed(1)}%`,
        });
        if (overallStatus === 'healthy') overallStatus = 'degraded';
      } else {
        checks.push({
          name: 'storage_usage',
          status: 'pass',
          value: `${storageInfo.usagePercent.toFixed(1)}%`,
        });
      }

      this.metrics.storageUsagePercent = storageInfo.usagePercent;

      // Check 5: Network quality
      const networkQuality = this.detectNetworkQuality();
      this.metrics.networkQuality = networkQuality;

      if (networkQuality === 'offline') {
        checks.push({
          name: 'network_quality',
          status: 'warn',
          message: 'Device is offline',
          value: networkQuality,
        });
        if (overallStatus === 'healthy') overallStatus = 'degraded';
      } else if (networkQuality === 'poor') {
        checks.push({
          name: 'network_quality',
          status: 'warn',
          message: 'Poor network connectivity',
          value: networkQuality,
        });
        if (overallStatus === 'healthy') overallStatus = 'degraded';
      } else {
        checks.push({
          name: 'network_quality',
          status: 'pass',
          value: networkQuality,
        });
      }

      const result: HealthCheckResult = {
        status: overallStatus,
        timestamp: Date.now(),
        checks,
        metrics: this.getMetrics(),
      };

      return success(result);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return failure('OPERATION_FAILED', `Health check failed: ${errorMessage}`, err);
    }
  }

  /**
   * Get error summary
   */
  getErrorSummary(): ErrorCategory[] {
    return Array.from(this.errors.values()).sort((a, b) => b.count - a.count);
  }

  /**
   * Get recent events (for debugging)
   */
  getRecentEvents(limit: number = 50): SyncEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Detect network quality
   */
  detectNetworkQuality(): NetworkQuality {
    if (!navigator.onLine) {
      return 'offline';
    }

    // Use Network Information API if available
    const connection = (navigator as Navigator & {
      connection?: {
        effectiveType?: string;
        downlink?: number;
        rtt?: number;
      };
    }).connection;

    if (connection) {
      const { effectiveType, downlink, rtt } = connection;

      if (effectiveType === 'slow-2g' || effectiveType === '2g') {
        return 'poor';
      }

      if (effectiveType === '3g' || (rtt && rtt > 500)) {
        return 'fair';
      }

      if (downlink && downlink > 10) {
        return 'excellent';
      }

      if (effectiveType === '4g') {
        return 'good';
      }
    }

    // Default based on online status
    return 'fair';
  }

  /**
   * Check storage quota
   */
  async checkStorageQuota(): Promise<{ quota: number; usage: number; usagePercent: number }> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const quota = estimate.quota || 0;
        const usage = estimate.usage || 0;
        const usagePercent = quota > 0 ? (usage / quota) * 100 : 0;

        return { quota, usage, usagePercent };
      }
    } catch {
      // Storage API not available
    }

    return { quota: 0, usage: 0, usagePercent: 0 };
  }

  /**
   * Export metrics for telemetry (anonymized - no PHI)
   */
  exportTelemetry(): Record<string, unknown> {
    return {
      timestamp: Date.now(),
      syncAttempts: this.metrics.syncAttempts,
      syncSuccesses: this.metrics.syncSuccesses,
      syncFailures: this.metrics.syncFailures,
      avgSyncDurationMs: this.metrics.avgSyncDurationMs,
      pendingRecordCount: this.metrics.pendingRecordCount,
      conflictsDetected: this.metrics.conflictsDetected,
      conflictsResolved: this.metrics.conflictsResolved,
      conflictsPending: this.metrics.conflictsPending,
      networkQuality: this.metrics.networkQuality,
      storageUsagePercent: this.metrics.storageUsagePercent,
      errorCounts: Object.fromEntries(this.errors),
      // No record IDs, patient IDs, or other PHI
    };
  }

  /**
   * Reset metrics (for testing or new session)
   */
  resetMetrics(): void {
    this.metrics = this.createInitialMetrics();
    this.errors.clear();
    this.events = [];
    this.syncDurations = [];
  }

  // Private helper methods

  /**
   * Create initial metrics object
   */
  private createInitialMetrics(): SyncMetrics {
    return {
      syncAttempts: 0,
      syncSuccesses: 0,
      syncFailures: 0,
      avgSyncDurationMs: 0,
      pendingRecordCount: 0,
      oldestPendingTimestamp: undefined,
      lastSuccessfulSync: undefined,
      conflictsDetected: 0,
      conflictsResolved: 0,
      conflictsPending: 0,
      pendingBytesTotal: 0,
      recordsByState: {
        pending: 0,
        syncing: 0,
        synced: 0,
        conflict: 0,
        failed: 0,
        permanent_failure: 0,
      },
      errorsByType: {},
      networkQuality: 'fair',
      storageUsagePercent: 0,
    };
  }

  /**
   * Add event to history
   */
  private addEvent(event: SyncEvent): void {
    this.events.push(event);
    if (this.events.length > this.maxEventsToKeep) {
      this.events.shift();
    }
  }

  /**
   * Calculate success rate
   */
  private calculateSuccessRate(): number {
    const total = this.metrics.syncAttempts;
    if (total === 0) return 1;
    return this.metrics.syncSuccesses / total;
  }

  /**
   * Calculate average sync duration
   */
  private calculateAverageDuration(): number {
    if (this.syncDurations.length === 0) return 0;
    const sum = this.syncDurations.reduce((a, b) => a + b, 0);
    return sum / this.syncDurations.length;
  }
}

/**
 * Create observability service instance
 */
export function createSyncObservability(): SyncObservabilityService {
  return new SyncObservabilityService();
}

/**
 * Singleton instance
 */
let observabilityInstance: SyncObservabilityService | null = null;

/**
 * Get or create the sync observability service
 */
export function getSyncObservability(): SyncObservabilityService {
  if (!observabilityInstance) {
    observabilityInstance = new SyncObservabilityService();
  }
  return observabilityInstance;
}
