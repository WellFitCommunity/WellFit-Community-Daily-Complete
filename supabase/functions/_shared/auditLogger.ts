/**
 * HIPAA-Compliant Audit Logger for Supabase Edge Functions
 *
 * Replaces console.log with proper audit trail logging
 * Implements HIPAA §164.312(b) - Audit Controls
 *
 * Usage:
 *   import { logger } from '../_shared/auditLogger.ts';
 *   logger.info('User logged in', { userId: '123' });
 *   logger.error('Login failed', { reason: 'invalid password' });
 *   logger.phi('Accessed patient record', { patientId: 'P123' });
 *
 * @module EdgeFunctionAuditLogger
 * @author WellFit Systems Architecture Team
 * @date 2025-11-01
 */

export type AuditLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'phi' | 'security';

export interface LogContext {
  [key: string]: any;
  userId?: string;
  patientId?: string;
  requestId?: string;
  functionName?: string;
}

/**
 * Edge Function Audit Logger
 *
 * Provides structured logging with automatic context enrichment
 * All logs are output to stdout/stderr for Supabase logging aggregation
 */
class EdgeFunctionLogger {
  private functionName: string;
  private requestId: string;

  constructor(functionName?: string, requestId?: string) {
    this.functionName = functionName || 'unknown';
    this.requestId = requestId || crypto.randomUUID();
  }

  /**
   * Format log message with structured context
   */
  private formatLog(level: AuditLogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      function: this.functionName,
      requestId: this.requestId,
      ...context,
    };

    return JSON.stringify(logEntry);
  }

  /**
   * Debug-level logging (development only)
   */
  debug(message: string, context?: LogContext): void {
    console.log(this.formatLog('debug', message, context));
  }

  /**
   * Info-level logging (general operations)
   */
  info(message: string, context?: LogContext): void {
    console.log(this.formatLog('info', message, context));
  }

  /**
   * Warning-level logging (non-critical issues)
   */
  warn(message: string, context?: LogContext): void {
    console.warn(this.formatLog('warn', message, context));
  }

  /**
   * Error-level logging (failures, exceptions)
   */
  error(message: string, context?: LogContext): void {
    console.error(this.formatLog('error', message, context));
  }

  /**
   * PHI access logging (HIPAA audit trail)
   * CRITICAL: Use for all Protected Health Information access
   */
  phi(message: string, context: LogContext): void {
    const phiContext = {
      ...context,
      _hipaa_audit: true,
      _phi_access: true,
    };
    console.log(this.formatLog('phi', message, phiContext));
  }

  /**
   * Security event logging (auth, authorization, suspicious activity)
   */
  security(message: string, context?: LogContext): void {
    const securityContext = {
      ...context,
      _security_event: true,
    };
    console.warn(this.formatLog('security', message, securityContext));
  }

  /**
   * Performance metrics logging
   */
  perf(operation: string, durationMs: number, context?: LogContext): void {
    this.info(`Performance: ${operation}`, {
      ...context,
      durationMs,
      _metric: true,
    });

    // Warn on slow operations (>1s)
    if (durationMs > 1000) {
      this.warn(`Slow operation: ${operation}`, {
        ...context,
        durationMs,
        _slow_query: true,
      });
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): EdgeFunctionLogger {
    const child = new EdgeFunctionLogger(this.functionName, this.requestId);
    // Override formatLog to include additional context
    const originalFormatLog = child.formatLog.bind(child);
    child.formatLog = (level: AuditLogLevel, message: string, context?: LogContext) => {
      return originalFormatLog(level, message, { ...additionalContext, ...context });
    };
    return child;
  }
}

/**
 * Create logger instance for edge function
 *
 * @param functionName - Name of the edge function
 * @param request - Optional request object for extracting request ID
 *
 * @example
 * const logger = createLogger('claude-chat', req);
 * logger.info('Processing chat request', { userId: user.id });
 */
export function createLogger(functionName?: string, request?: Request): EdgeFunctionLogger {
  const requestId = request?.headers.get('x-request-id') || crypto.randomUUID();
  return new EdgeFunctionLogger(functionName, requestId);
}

/**
 * Default logger instance (use createLogger() for better context)
 */
export const logger = new EdgeFunctionLogger();

/**
 * Measure async operation performance
 *
 * @example
 * const result = await measurePerf('fetchPatientData', async () => {
 *   return await supabase.from('patients').select('*');
 * });
 */
export async function measurePerf<T>(
  operation: string,
  fn: () => Promise<T>,
  logger?: EdgeFunctionLogger
): Promise<T> {
  const log = logger || new EdgeFunctionLogger();
  const start = performance.now();

  try {
    const result = await fn();
    const duration = performance.now() - start;
    log.perf(operation, duration);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    log.error(`Operation failed: ${operation}`, {
      durationMs: duration,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export default {
  createLogger,
  logger,
  measurePerf,
};
