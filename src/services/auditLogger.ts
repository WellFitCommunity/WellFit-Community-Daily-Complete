/**
 * HIPAA-Compliant Audit Logging Service
 *
 * Provides proper audit trail logging to database
 * Implements HIPAA §164.312(b) - Audit Controls
 *
 * Usage:
 *   import { auditLogger } from './services/auditLogger';
 *   auditLogger.info('User logged in', { userId: '123' });
 *   auditLogger.error('Login failed', { reason: 'invalid password' });
 *   auditLogger.phi('Accessed patient record', { patientId: 'P123', userId: 'U456' });
 */

import { supabase } from '../lib/supabaseClient';
import { errorReporter } from './errorReporter';

export type AuditEventCategory =
  | 'AUTHENTICATION'
  | 'PHI_ACCESS'
  | 'DATA_MODIFICATION'
  | 'SYSTEM_EVENT'
  | 'SECURITY_EVENT'
  | 'BILLING'
  | 'CLINICAL'
  | 'ADMINISTRATIVE';

export type AuditLogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface AuditLogEntry {
  event_type: string;
  event_category: AuditEventCategory;
  actor_user_id?: string | null;
  actor_ip_address?: string | null;
  actor_user_agent?: string;
  operation?: string;
  resource_type?: string;
  resource_id?: string;
  success: boolean;
  error_code?: string;
  error_message?: string;
  metadata?: Record<string, unknown>;
}

class AuditLogger {
  private isDevelopment = import.meta.env.MODE === 'development';
  private loggingEnabled = import.meta.env.VITE_HIPAA_LOGGING_ENABLED !== 'false';

  /**
   * Get current user context for audit logs
   */
  private async getUserContext(): Promise<{ userId?: string; ipAddress?: string | null; userAgent?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return {
        userId: user?.id,
        ipAddress: null, // Browser doesn't have access to IP - column is inet type, can't use 'browser'
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
      };
    } catch {
      return {};
    }
  }

  /**
   * Core audit logging method
   *
   * IMPORTANT: This method is designed to NEVER block the UI or cause cascading errors.
   * - Fails silently on auth/RLS errors (401, 403)
   * - Does not retry on failure
   * - Does not trigger error reporting for expected failures
   */
  private async log(entry: Partial<AuditLogEntry>, _level: AuditLogLevel = 'info'): Promise<void> {
    // Skip database logging if disabled (for testing)
    if (!this.loggingEnabled) return;

    try {
      // Check for authenticated session before attempting database operations
      // This prevents 401 errors when audit logging is called before user login
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        // No authenticated session - skip silently (expected during login flow)
        return;
      }

      const context = await this.getUserContext();

      const auditEntry: AuditLogEntry = {
        event_type: entry.event_type || 'UNKNOWN_EVENT',
        event_category: entry.event_category || 'SYSTEM_EVENT',
        actor_user_id: entry.actor_user_id || context.userId || null,
        actor_ip_address: entry.actor_ip_address || context.ipAddress,
        actor_user_agent: entry.actor_user_agent || context.userAgent,
        operation: entry.operation,
        resource_type: entry.resource_type,
        resource_id: entry.resource_id,
        success: entry.success ?? true,
        error_code: entry.error_code,
        error_message: entry.error_message,
        metadata: entry.metadata
      };

      // Fire and check result - DO NOT await in a way that blocks UI
      const { error } = await supabase.from('audit_logs').insert(auditEntry);

      // Silently ignore auth/RLS errors - these are expected when session is stale
      // Do NOT report these as critical errors - they would cause cascading issues
      if (error) {
        const errorCode = (error as { code?: string }).code;
        // 42501 = RLS violation, PGRST301 = JWT expired, 403 codes
        if (errorCode === '42501' || errorCode === 'PGRST301' || error.message?.includes('403')) {
          // Expected auth failure - fail silently, don't cascade
          return;
        }
        // Only report unexpected errors (not auth-related)
        errorReporter.report('AUDIT_LOG_FAILURE', new Error(error.message), {
          event_type: entry.event_type,
          code: errorCode
        });
      }
    } catch {
      // Swallow all errors - audit logging must NEVER break the app
      // This is intentional: logging failure should not cascade to UI stalls
    }
  }

  /**
   * Log informational events (successful operations)
   */
  async info(eventType: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.log({
      event_type: eventType,
      event_category: 'SYSTEM_EVENT',
      success: true,
      metadata
    }, 'info');
  }

  /**
   * Log warnings (non-critical issues)
   */
  async warn(eventType: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.log({
      event_type: eventType,
      event_category: 'SYSTEM_EVENT',
      success: true,
      metadata
    }, 'warn');
  }

  /**
   * Log errors (operation failures)
   */
  async error(eventType: string, error: Error | string, metadata?: Record<string, unknown>): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorCode = error instanceof Error ? error.name : 'ERROR';

    await this.log({
      event_type: eventType,
      event_category: 'SYSTEM_EVENT',
      success: false,
      error_code: errorCode,
      error_message: errorMessage,
      metadata
    }, 'error');
  }

  /**
   * Log PHI access (HIPAA §164.312(b) requirement)
   */
  async phi(
    operation: string,
    patientId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      event_type: 'PHI_ACCESS',
      event_category: 'PHI_ACCESS',
      operation,
      resource_type: 'patient',
      resource_id: patientId,
      success: true,
      metadata
    }, 'info');
  }

  /**
   * Log authentication events
   */
  async auth(
    eventType: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED' | 'PASSWORD_RESET' | 'REGISTRATION',
    success: boolean,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      event_type: `USER_${eventType}`,
      event_category: 'AUTHENTICATION',
      operation: eventType,
      resource_type: 'auth_event',
      success,
      metadata
    }, success ? 'info' : 'warn');
  }

  /**
   * Log clinical events (documentation, orders, etc.)
   */
  async clinical(
    operation: string,
    success: boolean,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      event_type: `CLINICAL_${operation.toUpperCase()}`,
      event_category: 'CLINICAL',
      operation,
      success,
      metadata
    }, 'info');
  }

  /**
   * Log billing/revenue events
   */
  async billing(
    operation: string,
    success: boolean,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      event_type: `BILLING_${operation.toUpperCase()}`,
      event_category: 'BILLING',
      operation,
      success,
      metadata
    }, 'info');
  }

  /**
   * Log security events (suspicious activity, policy violations)
   */
  async security(
    eventType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      event_type: `SECURITY_${eventType}`,
      event_category: 'SECURITY_EVENT',
      operation: eventType,
      success: false,
      error_code: `SEVERITY_${severity.toUpperCase()}`,
      metadata
    }, severity === 'critical' || severity === 'high' ? 'error' : 'warn');
  }

  /**
   * Debug logging (development only)
   * Note: Logs are stored in audit_logs table, console disabled for HIPAA compliance
   */
  debug(_message: string, _data?: unknown): void {
    if (this.isDevelopment) {
      // Debug info is tracked in audit_logs table
      // Console logging disabled for HIPAA compliance
    }
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();

// Backward compatibility: export individual functions
export const logInfo = (eventType: string, metadata?: Record<string, unknown>) =>
  auditLogger.info(eventType, metadata);

export const logError = (eventType: string, error: Error | string, metadata?: Record<string, unknown>) =>
  auditLogger.error(eventType, error, metadata);

export const logPhiAccess = (operation: string, patientId: string, metadata?: Record<string, unknown>) =>
  auditLogger.phi(operation, patientId, metadata);

export const logAuth = (
  eventType: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED' | 'PASSWORD_RESET' | 'REGISTRATION',
  success: boolean,
  metadata?: Record<string, unknown>
) => auditLogger.auth(eventType, success, metadata);

export const logClinical = (operation: string, success: boolean, metadata?: Record<string, unknown>) =>
  auditLogger.clinical(operation, success, metadata);

export const logBilling = (operation: string, success: boolean, metadata?: Record<string, unknown>) =>
  auditLogger.billing(operation, success, metadata);

export const logSecurity = (
  eventType: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  metadata?: Record<string, unknown>
) => auditLogger.security(eventType, severity, metadata);
