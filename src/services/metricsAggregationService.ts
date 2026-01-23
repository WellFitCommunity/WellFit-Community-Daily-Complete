/**
 * Metrics Aggregation Service - System and Healthcare Metrics
 *
 * Purpose: Collect, aggregate, and expose metrics for monitoring
 * Features: Prometheus export, healthcare metrics, custom counters
 * Integration: Prometheus /metrics endpoint
 *
 * @module services/metricsAggregationService
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

// =============================================================================
// TYPES
// =============================================================================

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export interface Metric {
  name: string;
  type: MetricType;
  help?: string;
  labels?: Record<string, string>;
  value: number;
}

export interface HealthcareMetrics {
  total_patients: number;
  total_clinical_staff: number;
  active_users_7d: number;
  check_ins_24h: number;
  check_ins_7d: number;
  lab_orders_24h: number;
  lab_orders_sla_breach: number;
  imaging_orders_24h: number;
  imaging_orders_sla_breach: number;
  audit_events_24h: number;
  security_events_24h: number;
  critical_security_events_24h: number;
  pending_alerts: number;
  critical_pending_alerts: number;
  successful_backups_24h: number;
  drills_completed_30d: number;
  collected_at: string;
}

export interface SystemMetrics {
  healthcare: HealthcareMetrics;
  custom: Metric[];
}

// =============================================================================
// SERVICE METHODS
// =============================================================================

/**
 * Record a custom metric
 */
async function recordMetric(
  name: string,
  type: MetricType,
  value: number,
  labels: Record<string, string> = {},
  help?: string
): Promise<ServiceResult<string>> {
  try {
    const { data, error } = await supabase.rpc('record_metric', {
      p_name: name,
      p_type: type,
      p_value: value,
      p_labels: labels,
      p_help: help || null,
    });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to record metric', error);
    }

    return success(data as string);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('METRIC_RECORD_FAILED', error, { name, type, value });
    return failure('OPERATION_FAILED', 'Failed to record metric', err);
  }
}

/**
 * Increment a counter metric
 */
async function incrementCounter(
  name: string,
  labels: Record<string, string> = {},
  increment: number = 1
): Promise<ServiceResult<void>> {
  try {
    const { error } = await supabase.rpc('increment_counter', {
      p_name: name,
      p_labels: labels,
      p_increment: increment,
    });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to increment counter', error);
    }

    return success(undefined);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('COUNTER_INCREMENT_FAILED', error, { name, increment });
    return failure('OPERATION_FAILED', 'Failed to increment counter', err);
  }
}

/**
 * Get healthcare metrics
 */
async function getHealthcareMetrics(): Promise<ServiceResult<HealthcareMetrics>> {
  try {
    const { data, error } = await supabase
      .from('healthcare_metrics')
      .select('*')
      .single();

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get healthcare metrics', error);
    }

    return success(data as HealthcareMetrics);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('HEALTHCARE_METRICS_FAILED', error, {});
    return failure('OPERATION_FAILED', 'Failed to get healthcare metrics', err);
  }
}

/**
 * Get metrics in Prometheus text format
 */
async function getPrometheusMetrics(): Promise<ServiceResult<string>> {
  try {
    const { data, error } = await supabase.rpc('get_prometheus_metrics');

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get Prometheus metrics', error);
    }

    return success(data as string);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('PROMETHEUS_METRICS_FAILED', error, {});
    return failure('OPERATION_FAILED', 'Failed to get Prometheus metrics', err);
  }
}

/**
 * Get latest values for all custom metrics
 */
async function getLatestMetrics(): Promise<ServiceResult<Metric[]>> {
  try {
    const { data, error } = await supabase
      .from('metrics_latest')
      .select('*')
      .order('metric_name');

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get latest metrics', error);
    }

    const metrics = (data || []).map((row) => ({
      name: row.metric_name,
      type: row.metric_type as MetricType,
      help: row.metric_help,
      labels: row.labels,
      value: row.value,
    }));

    return success(metrics);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('LATEST_METRICS_FAILED', error, {});
    return failure('OPERATION_FAILED', 'Failed to get latest metrics', err);
  }
}

/**
 * Cleanup old metric data
 */
async function cleanupOldMetrics(): Promise<ServiceResult<number>> {
  try {
    const { data, error } = await supabase.rpc('cleanup_old_metrics');

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to cleanup metrics', error);
    }

    await auditLogger.info('METRICS_CLEANUP', { deletedCount: data });

    return success(data as number);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('METRICS_CLEANUP_FAILED', error, {});
    return failure('OPERATION_FAILED', 'Failed to cleanup metrics', err);
  }
}

/**
 * Record API latency metric
 */
async function recordApiLatency(
  endpoint: string,
  method: string,
  latencyMs: number,
  statusCode: number
): Promise<ServiceResult<void>> {
  return recordMetric(
    'wellfit_api_request_duration_ms',
    'histogram',
    latencyMs,
    { endpoint, method, status: statusCode.toString() },
    'API request duration in milliseconds'
  ).then(() => success(undefined));
}

/**
 * Record error count
 */
async function recordError(
  errorType: string,
  component: string
): Promise<ServiceResult<void>> {
  return incrementCounter(
    'wellfit_errors_total',
    { type: errorType, component },
    1
  );
}

/**
 * Get all system metrics combined
 */
async function getAllMetrics(): Promise<ServiceResult<SystemMetrics>> {
  try {
    const [healthcareResult, customResult] = await Promise.all([
      getHealthcareMetrics(),
      getLatestMetrics(),
    ]);

    if (!healthcareResult.success) {
      return failure('OPERATION_FAILED', 'Failed to get healthcare metrics', healthcareResult.error);
    }

    if (!customResult.success) {
      return failure('OPERATION_FAILED', 'Failed to get custom metrics', customResult.error);
    }

    return success({
      healthcare: healthcareResult.data,
      custom: customResult.data,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('ALL_METRICS_FAILED', error, {});
    return failure('OPERATION_FAILED', 'Failed to get all metrics', err);
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export const metricsAggregationService = {
  // Recording
  recordMetric,
  incrementCounter,
  recordApiLatency,
  recordError,

  // Retrieval
  getHealthcareMetrics,
  getPrometheusMetrics,
  getLatestMetrics,
  getAllMetrics,

  // Maintenance
  cleanupOldMetrics,
};

export default metricsAggregationService;
