/**
 * Centralized Error Reporter Service
 * ===================================
 * Provides error aggregation, rate limiting, and monitoring for application errors
 *
 * Features:
 * - Prevents console spam by aggregating duplicate errors
 * - Rate limiting: Only logs every Nth occurrence
 * - Error statistics tracking
 * - Development vs production modes
 * - Type-safe error categories
 *
 * Usage:
 *   import { errorReporter } from './services/errorReporter';
 *
 *   try {
 *     await riskyOperation();
 *   } catch {
 *     errorReporter.report('AUDIT_LOG_FAILURE', error, {
 *       context: 'User login'
 *     });
 *   }
 */

export type ErrorCategory =
  | 'AUDIT_LOG_FAILURE'
  | 'PHI_ACCESS_LOG_FAILURE'
  | 'REALTIME_SUBSCRIPTION_FAILURE'
  | 'REALTIME_HEARTBEAT_FAILURE'
  | 'DATABASE_OPERATION_FAILURE'
  | 'AUTHENTICATION_FAILURE'
  | 'NETWORK_FAILURE'
  | 'VALIDATION_FAILURE'
  | 'UNKNOWN_FAILURE';

export interface ErrorStats {
  category: ErrorCategory;
  errorKey: string;
  occurrences: number;
  firstSeen: Date;
  lastSeen: Date;
  lastMetadata?: Record<string, unknown>;
}

class ErrorReporter {
  private errors: Map<string, ErrorStats> = new Map();
  private isDevelopment = import.meta.env.MODE === 'development';
  private reportInterval = 10; // Log every 10th occurrence in production
  private devReportInterval = 1; // Log every occurrence in development

  /**
   * Report an error with optional metadata
   */
  report(
    category: ErrorCategory,
    error: Error | string,
    metadata?: Record<string, unknown>
  ): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorKey = `${category}:${errorMessage}`;

    // Get or create error stats
    let stats = this.errors.get(errorKey);

    if (!stats) {
      stats = {
        category,
        errorKey: errorMessage,
        occurrences: 0,
        firstSeen: new Date(),
        lastSeen: new Date(),
        lastMetadata: metadata,
      };
      this.errors.set(errorKey, stats);
    }

    // Update stats
    stats.occurrences++;
    stats.lastSeen = new Date();
    stats.lastMetadata = metadata;

    // Determine if we should log based on interval
    const interval = this.isDevelopment ? this.devReportInterval : this.reportInterval;
    const shouldLog = stats.occurrences % interval === 0 || this.isDevelopment;

    if (shouldLog) {
      this.logError(category, error, stats.occurrences, metadata);
    }
  }

  /**
   * Report a critical error that should always be logged immediately
   */
  reportCritical(
    category: ErrorCategory,
    error: Error | string,
    metadata?: Record<string, unknown>
  ): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorKey = `${category}:${errorMessage}`;

    // Update stats
    let stats = this.errors.get(errorKey);
    if (!stats) {
      stats = {
        category,
        errorKey: errorMessage,
        occurrences: 0,
        firstSeen: new Date(),
        lastSeen: new Date(),
        lastMetadata: metadata,
      };
      this.errors.set(errorKey, stats);
    }

    stats.occurrences++;
    stats.lastSeen = new Date();
    stats.lastMetadata = metadata;

    // Critical errors tracked in stats, accessible via getStats()
    // Console logging disabled for HIPAA compliance
  }

  /**
   * Internal logging method
   */
  private logError(
    _category: ErrorCategory,
    _error: Error | string,
    _occurrences: number,
    _metadata?: Record<string, unknown>
  ): void {
    // Error tracking enabled - errors stored in stats
    // Console logging disabled for HIPAA compliance in all environments
    // Access error data via getStats(), getStatsByCategory(), or exportStats()
  }

  /**
   * Get emoji for error category
   */
  private getCategoryEmoji(category: ErrorCategory): string {
    const emojiMap: Record<ErrorCategory, string> = {
      AUDIT_LOG_FAILURE: '📋',
      PHI_ACCESS_LOG_FAILURE: '🔒',
      REALTIME_SUBSCRIPTION_FAILURE: '🔄',
      REALTIME_HEARTBEAT_FAILURE: '💓',
      DATABASE_OPERATION_FAILURE: '💾',
      AUTHENTICATION_FAILURE: '🔐',
      NETWORK_FAILURE: '🌐',
      VALIDATION_FAILURE: '✅',
      UNKNOWN_FAILURE: '❓',
    };

    return emojiMap[category] || '⚠️';
  }

  /**
   * Get error statistics for monitoring
   */
  getStats(): ErrorStats[] {
    return Array.from(this.errors.values()).sort(
      (a, b) => b.occurrences - a.occurrences
    );
  }

  /**
   * Get stats for a specific category
   */
  getStatsByCategory(category: ErrorCategory): ErrorStats[] {
    return this.getStats().filter((stat) => stat.category === category);
  }

  /**
   * Get total error count
   */
  getTotalErrors(): number {
    return Array.from(this.errors.values()).reduce(
      (sum, stat) => sum + stat.occurrences,
      0
    );
  }

  /**
   * Check if a specific error category has occurred
   */
  hasErrors(category: ErrorCategory): boolean {
    return this.getStatsByCategory(category).length > 0;
  }

  /**
   * Clear all error statistics (useful for testing)
   */
  clear(): void {
    this.errors.clear();
  }

  /**
   * Export error stats as JSON for monitoring dashboards
   */
  exportStats(): string {
    return JSON.stringify(
      {
        totalErrors: this.getTotalErrors(),
        uniqueErrors: this.errors.size,
        timestamp: new Date().toISOString(),
        errors: this.getStats(),
      },
      null,
      2
    );
  }
}

// Export singleton instance
export const errorReporter = new ErrorReporter();

// Convenience functions for common use cases
export const reportAuditFailure = (error: Error | string, metadata?: Record<string, unknown>) =>
  errorReporter.report('AUDIT_LOG_FAILURE', error, metadata);

export const reportPhiFailure = (error: Error | string, metadata?: Record<string, unknown>) =>
  errorReporter.reportCritical('PHI_ACCESS_LOG_FAILURE', error, metadata);

export const reportRealtimeFailure = (error: Error | string, metadata?: Record<string, unknown>) =>
  errorReporter.report('REALTIME_SUBSCRIPTION_FAILURE', error, metadata);

export const reportDatabaseFailure = (error: Error | string, metadata?: Record<string, unknown>) =>
  errorReporter.report('DATABASE_OPERATION_FAILURE', error, metadata);
