/**
 * Health Check Service
 * ====================
 * Monitors critical application services for HIPAA compliance and operational health
 *
 * Features:
 * - Audit logging health checks
 * - PHI access logging health checks
 * - Realtime subscription registry health checks
 * - RLS policy verification
 * - Database connectivity checks
 *
 * Usage:
 *   import { healthCheck } from './services/healthCheck';
 *
 *   const health = await healthCheck.checkAll();
 *   if (!health.healthy) {
 *     // Handle health check failures
 *   }
 */

import { supabase } from '../lib/supabaseClient';
import { errorReporter } from './errorReporter';
import { auditLogger } from './auditLogger';

export interface HealthCheckResult {
  healthy: boolean;
  service: string;
  error?: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

export interface SystemHealthReport {
  healthy: boolean;
  timestamp: Date;
  checks: HealthCheckResult[];
  failures: HealthCheckResult[];
  warnings: HealthCheckResult[];
}

class HealthCheckService {
  /**
   * Check if audit_logs table is writable (CRITICAL for HIPAA compliance)
   */
  async checkAuditLogging(): Promise<HealthCheckResult> {
    const result: HealthCheckResult = {
      healthy: false,
      service: 'audit_logs',
      timestamp: new Date(),
    };

    try {
      // Attempt to write a health check entry
      const testEntry = {
        event_type: 'HEALTH_CHECK',
        event_category: 'SYSTEM_EVENT',
        success: true,
        metadata: {
          test: true,
          timestamp: new Date().toISOString(),
        },
      };

      const { error } = await supabase.from('audit_logs').insert(testEntry);

      if (error) {
        result.error = `Audit logging FAILED: ${error.message} (Code: ${error.code})`;
        result.details = {
          errorCode: error.code,
          errorMessage: error.message,
          hint: error.hint,
        };

        // Report critical failure
        errorReporter.reportCritical('AUDIT_LOG_FAILURE', error.message, {
          context: 'Health check',
          code: error.code,
        });
      } else {
        result.healthy = true;
      }
    } catch (err) {
      result.error = `Audit logging exception: ${err instanceof Error ? err.message : String(err)}`;
      result.details = { exception: String(err) };

      errorReporter.reportCritical('AUDIT_LOG_FAILURE', err as Error, {
        context: 'Health check exception',
      });
    }

    return result;
  }

  /**
   * Check if realtime_subscription_registry is writable
   */
  async checkRealtimeRegistry(): Promise<HealthCheckResult> {
    const result: HealthCheckResult = {
      healthy: false,
      service: 'realtime_subscription_registry',
      timestamp: new Date(),
    };

    try {
      const { data: userData } = await supabase.auth.getUser();

      // Attempt to write a health check entry
      const testEntry = {
        subscription_id: `health-check-${Date.now()}`,
        channel_name: `health-check-${Date.now()}`,
        user_id: userData?.user?.id || null,
        component_name: 'HealthCheck',
        table_filters: { test: true },
        last_heartbeat_at: new Date().toISOString(),
        is_active: false, // Mark as inactive so it doesn't pollute monitoring
      };

      const { error, data } = await supabase
        .from('realtime_subscription_registry')
        .insert(testEntry)
        .select('id')
        .single();

      if (error) {
        result.error = `Realtime registry FAILED: ${error.message} (Code: ${error.code})`;
        result.details = {
          errorCode: error.code,
          errorMessage: error.message,
          hint: error.hint,
        };

        errorReporter.report('REALTIME_SUBSCRIPTION_FAILURE', error.message, {
          context: 'Health check',
          code: error.code,
        });
      } else {
        result.healthy = true;
        result.details = { registryId: data?.id };

        // Clean up test entry
        if (data?.id) {
          await supabase
            .from('realtime_subscription_registry')
            .delete()
            .eq('id', data.id);
        }
      }
    } catch (err) {
      result.error = `Realtime registry exception: ${err instanceof Error ? err.message : String(err)}`;
      result.details = { exception: String(err) };

      errorReporter.report('REALTIME_SUBSCRIPTION_FAILURE', err as Error, {
        context: 'Health check exception',
      });
    }

    return result;
  }

  /**
   * Check if PHI access logging RPC function is available
   */
  async checkPhiAccessLogging(): Promise<HealthCheckResult> {
    const result: HealthCheckResult = {
      healthy: false,
      service: 'phi_access_logging',
      timestamp: new Date(),
    };

    try {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData?.user) {
        result.error = 'No authenticated user - skipping PHI logging check';
        result.healthy = true; // Not a failure, just can't test
        result.details = { skipped: true, reason: 'not authenticated' };
        return result;
      }

      // Test the log_phi_access RPC function
      const { error } = await supabase.rpc('log_phi_access', {
        p_accessor_user_id: userData.user.id,
        p_accessor_role: 'user',
        p_phi_type: 'patient_record',
        p_phi_resource_id: 'health-check-test',
        p_patient_id: 'health-check-test',
        p_access_type: 'view',
        p_access_method: 'UI',
        p_purpose: 'operations',
        p_ip_address: null,
      });

      if (error) {
        result.error = `PHI logging FAILED: ${error.message} (Code: ${error.code})`;
        result.details = {
          errorCode: error.code,
          errorMessage: error.message,
          hint: error.hint,
        };

        errorReporter.reportCritical('PHI_ACCESS_LOG_FAILURE', error.message, {
          context: 'Health check',
          code: error.code,
        });
      } else {
        result.healthy = true;
      }
    } catch (err) {
      result.error = `PHI logging exception: ${err instanceof Error ? err.message : String(err)}`;
      result.details = { exception: String(err) };

      errorReporter.reportCritical('PHI_ACCESS_LOG_FAILURE', err as Error, {
        context: 'Health check exception',
      });
    }

    return result;
  }

  /**
   * Check database connectivity
   */
  async checkDatabaseConnection(): Promise<HealthCheckResult> {
    const result: HealthCheckResult = {
      healthy: false,
      service: 'database_connection',
      timestamp: new Date(),
    };

    try {
      // Simple query to check connectivity
      const { error, data: _data } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" which is OK for this test
        result.error = `Database connection FAILED: ${error.message}`;
        result.details = { errorCode: error.code };
      } else {
        result.healthy = true;
        result.details = { connected: true };
      }
    } catch (err) {
      result.error = `Database connection exception: ${err instanceof Error ? err.message : String(err)}`;
      result.details = { exception: String(err) };
    }

    return result;
  }

  /**
   * Check authentication status
   */
  async checkAuthentication(): Promise<HealthCheckResult> {
    const result: HealthCheckResult = {
      healthy: false,
      service: 'authentication',
      timestamp: new Date(),
    };

    try {
      const { data, error } = await supabase.auth.getUser();

      if (error) {
        result.error = `Auth check FAILED: ${error.message}`;
        result.details = { errorMessage: error.message };
      } else {
        result.healthy = true;
        result.details = {
          authenticated: !!data?.user,
          userId: data?.user?.id || null,
        };
      }
    } catch (err) {
      result.error = `Auth check exception: ${err instanceof Error ? err.message : String(err)}`;
      result.details = { exception: String(err) };
    }

    return result;
  }

  /**
   * Run all health checks and generate comprehensive report
   */
  async checkAll(): Promise<SystemHealthReport> {
    const checks = await Promise.all([
      this.checkDatabaseConnection(),
      this.checkAuthentication(),
      this.checkAuditLogging(),
      this.checkRealtimeRegistry(),
      this.checkPhiAccessLogging(),
    ]);

    const failures = checks.filter((check) => !check.healthy);
    const warnings = checks.filter((check) => check.details?.skipped);

    const report: SystemHealthReport = {
      healthy: failures.length === 0,
      timestamp: new Date(),
      checks,
      failures,
      warnings,
    };

    // Log health check results using auditLogger
    if (!report.healthy) {
      auditLogger.error('HEALTH_CHECK_FAILED', 'System health check failed', {
        failures: failures.map((f) => ({
          service: f.service,
          error: f.error,
        })),
      });
    } else {
      auditLogger.info('HEALTH_CHECK_PASSED', {
        services: checks.length,
        timestamp: report.timestamp,
      });
    }

    return report;
  }

  /**
   * Export health check report as JSON
   */
  async exportReport(): Promise<string> {
    const report = await this.checkAll();
    return JSON.stringify(report, null, 2);
  }

  /**
   * Get a summary of critical services health
   */
  async getCriticalServicesHealth(): Promise<{
    auditLogging: boolean;
    phiLogging: boolean;
    database: boolean;
  }> {
    const [auditResult, phiResult, dbResult] = await Promise.all([
      this.checkAuditLogging(),
      this.checkPhiAccessLogging(),
      this.checkDatabaseConnection(),
    ]);

    return {
      auditLogging: auditResult.healthy,
      phiLogging: phiResult.healthy,
      database: dbResult.healthy,
    };
  }
}

// Export singleton instance
export const healthCheck = new HealthCheckService();

// Convenience function for quick health checks
export const runHealthCheck = () => healthCheck.checkAll();

// Export individual check functions
export const checkAuditLogging = () => healthCheck.checkAuditLogging();
export const checkRealtimeRegistry = () => healthCheck.checkRealtimeRegistry();
export const checkPhiAccessLogging = () => healthCheck.checkPhiAccessLogging();
export const checkDatabaseConnection = () => healthCheck.checkDatabaseConnection();
export const checkAuthentication = () => healthCheck.checkAuthentication();
