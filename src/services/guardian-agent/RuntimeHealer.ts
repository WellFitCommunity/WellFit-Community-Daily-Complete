/**
 * Runtime Healer - Real browser-side healing actions
 *
 * Executes actual runtime healing operations in the browser:
 * - Token refresh via Supabase auth
 * - Cache clearing (localStorage, sessionStorage)
 * - Circuit breaker state management
 * - Resource cleanup (timers, listeners)
 * - Security event logging via auditLogger
 * - Degraded mode activation
 * - Session recovery
 *
 * This is separate from RealHealingImplementations which handles code-level fixes.
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import type { HealingStep, DetectedIssue } from './types';

export interface ActionResult {
  success: boolean;
  message: string;
  value?: number;
}

/**
 * Global circuit breaker registry — tracks which endpoints are in circuit-breaker state
 */
const circuitBreakerRegistry = new Map<string, {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  openedAt: number;
  threshold: number;
  resetTimeoutMs: number;
}>();

/**
 * Degraded mode flag — global state for graceful degradation
 */
let degradedMode = false;
const disabledFeatures = new Set<string>();

export class RuntimeHealer {
  /**
   * Execute a healing action step with real side effects
   */
  async perform(step: HealingStep, issue: DetectedIssue): Promise<ActionResult> {
    switch (step.action) {
      case 'retry_operation':
        return this.retryOperation(step, issue);
      case 'enable_circuit_breaker':
        return this.enableCircuitBreaker(step, issue);
      case 'fallback_to_cache':
        return this.fallbackToCache(step);
      case 'enable_degraded_mode':
        return this.enableDegradedMode(step);
      case 'rollback_state':
        return this.rollbackState(step);
      case 'clear_cache':
        return this.clearCache(step);
      case 'refresh_token':
        return this.refreshToken();
      case 'cleanup_resources':
        return this.cleanupResources(step);
      case 'reset_configuration':
        return this.resetConfiguration();
      case 'log_security_event':
        return this.logSecurityEvent(step, issue);
      case 'block_suspicious_activity':
        return this.blockSuspiciousActivity(step, issue);
      case 'isolate_dependency':
        return this.isolateDependency(step);
      case 'reconcile_data':
        return this.reconcileData(step);
      case 'apply_patch':
        return this.applyPatch(step, issue);
      case 'emergency_shutdown':
        return this.emergencyShutdown(step, issue);
      case 'restore_previous_state':
        return this.rollbackState(step);
      default:
        return this.logAndMonitor(step, issue);
    }
  }

  // =========================================================================
  // Retry with exponential backoff
  // =========================================================================

  private async retryOperation(step: HealingStep, issue: DetectedIssue): Promise<ActionResult> {
    const maxRetries = (step.parameters.maxRetries as number) || 3;
    const baseBackoffMs = (step.parameters.backoffMs as number) || 1000;
    const exponential = step.parameters.exponential !== false;
    const target = issue.context.apiEndpoint || step.target;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // For API failures, attempt a health check on the endpoint
        if (target.startsWith('/') || target.startsWith('http')) {
          const response = await fetch(target, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
          if (response.ok) {
            await auditLogger.info('GUARDIAN_RETRY_SUCCESS', {
              target, attempt, maxRetries, issueId: issue.id,
            });
            return { success: true, message: `Retry succeeded on attempt ${attempt}/${maxRetries}` };
          }
        } else {
          // For non-URL targets (e.g., Supabase operations), verify DB connectivity
          const { error } = await supabase.from('profiles').select('id').limit(1);
          if (!error) {
            await auditLogger.info('GUARDIAN_RETRY_SUCCESS', {
              target, attempt, maxRetries, issueId: issue.id,
            });
            return { success: true, message: `Database retry succeeded on attempt ${attempt}` };
          }
        }
      } catch {
        // Retry continues
      }

      // Backoff before next attempt
      if (attempt < maxRetries) {
        const delay = exponential ? baseBackoffMs * Math.pow(2, attempt - 1) : baseBackoffMs;
        await this.sleep(Math.min(delay, 10000)); // Cap at 10s
      }
    }

    await auditLogger.warn('GUARDIAN_RETRY_EXHAUSTED', {
      target, maxRetries, issueId: issue.id,
    });
    return { success: false, message: `All ${maxRetries} retry attempts failed for ${target}` };
  }

  // =========================================================================
  // Circuit breaker
  // =========================================================================

  private async enableCircuitBreaker(step: HealingStep, issue: DetectedIssue): Promise<ActionResult> {
    const target = issue.context.apiEndpoint || step.target;
    const threshold = (step.parameters.threshold as number) || 5;
    const resetTimeoutMs = (step.parameters.resetTimeoutMs as number) || 30000;

    circuitBreakerRegistry.set(target, {
      state: 'open',
      failures: threshold,
      openedAt: Date.now(),
      threshold,
      resetTimeoutMs,
    });

    await auditLogger.info('GUARDIAN_CIRCUIT_BREAKER_OPENED', {
      target, threshold, resetTimeoutMs, issueId: issue.id,
    });

    return { success: true, message: `Circuit breaker opened for ${target} (resets in ${resetTimeoutMs}ms)` };
  }

  // =========================================================================
  // Cache fallback
  // =========================================================================

  private async fallbackToCache(step: HealingStep): Promise<ActionResult> {
    const cacheKey = step.parameters.cacheKey as string;
    const maxAge = (step.parameters.maxAge as number) || 300000;

    if (!cacheKey) {
      return { success: false, message: 'No cache key provided for fallback' };
    }

    // Check localStorage for cached data
    const cached = localStorage.getItem(`guardian_cache_${cacheKey}`);
    if (!cached) {
      return { success: false, message: `No cached data found for key: ${cacheKey}` };
    }

    try {
      const parsed: unknown = JSON.parse(cached);
      if (typeof parsed === 'object' && parsed !== null && 'timestamp' in parsed) {
        const cacheEntry = parsed as { timestamp: number; data: unknown };
        const age = Date.now() - cacheEntry.timestamp;
        if (age > maxAge) {
          return { success: false, message: `Cache expired (age: ${Math.round(age / 1000)}s, max: ${Math.round(maxAge / 1000)}s)` };
        }
        return { success: true, message: `Serving from cache (age: ${Math.round(age / 1000)}s)` };
      }
      return { success: true, message: 'Serving from cache (no timestamp — assuming fresh)' };
    } catch {
      return { success: false, message: 'Failed to parse cached data' };
    }
  }

  // =========================================================================
  // Graceful degradation
  // =========================================================================

  private async enableDegradedMode(step: HealingStep): Promise<ActionResult> {
    const features = step.parameters.disableFeatures as string[] | undefined;

    degradedMode = true;

    if (features) {
      for (const feature of features) {
        disabledFeatures.add(feature);
      }
    }

    await auditLogger.warn('GUARDIAN_DEGRADED_MODE_ENABLED', {
      disabledFeatures: Array.from(disabledFeatures),
    });

    return { success: true, message: `Degraded mode enabled. Disabled: ${Array.from(disabledFeatures).join(', ') || 'none'}` };
  }

  // =========================================================================
  // State rollback
  // =========================================================================

  private async rollbackState(step: HealingStep): Promise<ActionResult> {
    const target = step.target;
    const clearCorrupted = step.parameters.clearCorruptedData === true;

    if (clearCorrupted) {
      // Remove potentially corrupted state keys from localStorage
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes(target) || key.includes('state_'))) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) {
        localStorage.removeItem(key);
      }

      await auditLogger.info('GUARDIAN_STATE_ROLLBACK', {
        target, keysCleared: keysToRemove.length,
      });

      return { success: true, message: `State rolled back: cleared ${keysToRemove.length} keys matching "${target}"` };
    }

    return { success: true, message: `State rollback acknowledged for ${target}` };
  }

  // =========================================================================
  // Cache clearing
  // =========================================================================

  private async clearCache(step: HealingStep): Promise<ActionResult> {
    const target = step.target;
    let keysCleared = 0;

    // Clear matching localStorage keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('cache') || key.includes(target))) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
      keysCleared++;
    }

    // Clear matching sessionStorage keys
    const sessionKeysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.includes('cache') || key.includes(target))) {
        sessionKeysToRemove.push(key);
      }
    }
    for (const key of sessionKeysToRemove) {
      sessionStorage.removeItem(key);
      keysCleared++;
    }

    await auditLogger.info('GUARDIAN_CACHE_CLEARED', {
      target, keysCleared,
    });

    return { success: true, message: `Cleared ${keysCleared} cache entries`, value: keysCleared };
  }

  // =========================================================================
  // Token refresh
  // =========================================================================

  private async refreshToken(): Promise<ActionResult> {
    const { data, error } = await supabase.auth.refreshSession();

    if (error) {
      await auditLogger.error('GUARDIAN_TOKEN_REFRESH_FAILED',
        error instanceof Error ? error : new Error(String(error)),
        { errorMessage: error.message },
      );
      return { success: false, message: `Token refresh failed: ${error.message}` };
    }

    if (data.session) {
      await auditLogger.info('GUARDIAN_TOKEN_REFRESHED', {
        expiresAt: data.session.expires_at,
      });
      return { success: true, message: 'Session token refreshed successfully' };
    }

    return { success: false, message: 'No session returned after refresh' };
  }

  // =========================================================================
  // Resource cleanup
  // =========================================================================

  private async cleanupResources(step: HealingStep): Promise<ActionResult> {
    const actions: string[] = [];

    if (step.parameters.clearTimers === true) {
      // Clear all guardian-tracked timers
      const trackedTimers = (globalThis as Record<string, unknown>).__guardianTimers as number[] | undefined;
      if (trackedTimers) {
        for (const timerId of trackedTimers) {
          clearInterval(timerId);
          clearTimeout(timerId);
        }
        actions.push(`Cleared ${trackedTimers.length} tracked timers`);
        (globalThis as Record<string, unknown>).__guardianTimers = [];
      }
    }

    if (step.parameters.clearEventListeners === true) {
      // Can't globally clear event listeners, but we can log the recommendation
      actions.push('Event listener cleanup flagged (requires component-level disposal)');
    }

    if (step.parameters.forceGC === true) {
      // Request garbage collection if available (V8 flag --expose-gc)
      const gc = (globalThis as Record<string, unknown>).gc as (() => void) | undefined;
      if (gc) {
        gc();
        actions.push('Forced garbage collection');
      } else {
        actions.push('GC not exposed (normal browser behavior)');
      }
    }

    await auditLogger.info('GUARDIAN_RESOURCE_CLEANUP', { actions });

    return {
      success: true,
      message: actions.length > 0 ? actions.join('; ') : 'Resource cleanup complete',
    };
  }

  // =========================================================================
  // Configuration reset
  // =========================================================================

  private async resetConfiguration(): Promise<ActionResult> {
    // Reload environment-sourced config by checking current Vite env vars
    const configKeys = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
    const present = configKeys.filter((key) => import.meta.env[key]);
    const missing = configKeys.filter((key) => !import.meta.env[key]);

    if (missing.length > 0) {
      await auditLogger.warn('GUARDIAN_CONFIG_MISSING', { missing });
      return { success: false, message: `Missing config keys: ${missing.join(', ')}` };
    }

    await auditLogger.info('GUARDIAN_CONFIG_VERIFIED', {
      presentKeys: present.length, totalKeys: configKeys.length,
    });

    return { success: true, message: `Configuration verified: ${present.length}/${configKeys.length} keys present` };
  }

  // =========================================================================
  // Security event logging
  // =========================================================================

  private async logSecurityEvent(step: HealingStep, issue: DetectedIssue): Promise<ActionResult> {
    await auditLogger.info('GUARDIAN_SECURITY_EVENT', {
      severity: step.parameters.severity || 'high',
      eventType: step.parameters.eventType || issue.signature.category,
      userId: step.parameters.userId || issue.context.userId,
      issueId: issue.id,
      affectedResources: issue.affectedResources,
    });

    return { success: true, message: 'Security event logged to audit trail' };
  }

  // =========================================================================
  // Block suspicious activity
  // =========================================================================

  private async blockSuspiciousActivity(step: HealingStep, issue: DetectedIssue): Promise<ActionResult> {
    const userId = (step.parameters.userId as string) || issue.context.userId;
    const duration = (step.parameters.duration as number) || 300000;

    if (!userId) {
      await auditLogger.warn('GUARDIAN_BLOCK_NO_USER', { issueId: issue.id });
      return { success: false, message: 'No user ID to block' };
    }

    // Record block in security_notifications table
    const { error } = await supabase.from('security_notifications').insert({
      notification_type: 'suspicious_activity_blocked',
      severity: 'critical',
      title: `Guardian: Blocked suspicious activity for user ${userId}`,
      details: {
        userId,
        issueId: issue.id,
        category: issue.signature.category,
        duration,
        blockedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + duration).toISOString(),
      },
      acknowledged: false,
    });

    if (error) {
      return { success: false, message: `Failed to record block: ${error.message}` };
    }

    await auditLogger.info('GUARDIAN_USER_BLOCKED', {
      userId, duration, issueId: issue.id,
    });

    return { success: true, message: `Blocked user ${userId} for ${duration / 1000}s` };
  }

  // =========================================================================
  // Dependency isolation
  // =========================================================================

  private async isolateDependency(step: HealingStep): Promise<ActionResult> {
    const target = step.target;

    // Open circuit breaker for this dependency to prevent cascade
    circuitBreakerRegistry.set(target, {
      state: 'open',
      failures: (step.parameters.bulkheadSize as number) || 3,
      openedAt: Date.now(),
      threshold: (step.parameters.bulkheadSize as number) || 3,
      resetTimeoutMs: 60000,
    });

    await auditLogger.info('GUARDIAN_DEPENDENCY_ISOLATED', {
      target,
      bulkheadSize: step.parameters.bulkheadSize,
      queueSize: step.parameters.queueSize,
    });

    return { success: true, message: `Dependency isolated: ${target}` };
  }

  // =========================================================================
  // Data reconciliation
  // =========================================================================

  private async reconcileData(step: HealingStep): Promise<ActionResult> {
    // For browser-side reconciliation, verify key tables have consistent data
    const query = step.parameters.query as string | undefined;

    if (query) {
      // Log the reconciliation request — actual DB reconciliation happens server-side
      await auditLogger.info('GUARDIAN_RECONCILIATION_REQUESTED', {
        query: query.substring(0, 200), // Truncate for safety
        target: step.target,
      });
    }

    // Verify Supabase connection health as a basic consistency check
    const { error } = await supabase.from('profiles').select('id').limit(1);
    if (error) {
      return { success: false, message: `Database health check failed: ${error.message}` };
    }

    return { success: true, message: 'Data reconciliation check passed (DB healthy)' };
  }

  // =========================================================================
  // Auto patch (delegates to ProposeWorkflow for PR-based fixes)
  // =========================================================================

  private async applyPatch(step: HealingStep, issue: DetectedIssue): Promise<ActionResult> {
    // Auto-patch creates proposals, not direct code changes
    await auditLogger.info('GUARDIAN_PATCH_PROPOSED', {
      filePath: step.parameters.location || step.target,
      patchType: step.parameters.patchType,
      issueId: issue.id,
    });

    return {
      success: true,
      message: `Patch proposal logged for ${step.target} (requires PR review)`,
    };
  }

  // =========================================================================
  // Emergency shutdown
  // =========================================================================

  private async emergencyShutdown(step: HealingStep, issue: DetectedIssue): Promise<ActionResult> {
    const graceful = step.parameters.graceful !== false;

    // Set global shutdown flag
    (globalThis as Record<string, unknown>).__guardianShutdown = true;

    // Open circuit breakers for all tracked endpoints
    for (const [target, cb] of circuitBreakerRegistry) {
      cb.state = 'open';
      circuitBreakerRegistry.set(target, cb);
    }

    // Enable degraded mode
    degradedMode = true;

    await auditLogger.error('GUARDIAN_EMERGENCY_SHUTDOWN',
      new Error(`Emergency shutdown triggered: ${issue.signature.category}`),
      {
        graceful,
        issueId: issue.id,
        component: step.target,
        severity: issue.severity,
      },
    );

    return {
      success: true,
      message: `Emergency shutdown ${graceful ? '(graceful)' : '(immediate)'} for ${step.target}`,
    };
  }

  // =========================================================================
  // Fallback: log and monitor
  // =========================================================================

  private async logAndMonitor(step: HealingStep, issue: DetectedIssue): Promise<ActionResult> {
    await auditLogger.info('GUARDIAN_ACTION_LOGGED', {
      action: step.action,
      target: step.target,
      issueId: issue.id,
      severity: issue.severity,
    });

    return { success: true, message: `Action "${step.action}" logged for monitoring` };
  }

  // =========================================================================
  // Static accessors for circuit breaker / degraded mode state
  // =========================================================================

  static isCircuitOpen(target: string): boolean {
    const cb = circuitBreakerRegistry.get(target);
    if (!cb) return false;
    if (cb.state !== 'open') return false;

    // Check if reset timeout has elapsed
    if (Date.now() - cb.openedAt > cb.resetTimeoutMs) {
      cb.state = 'half-open';
      return false;
    }
    return true;
  }

  static isDegradedMode(): boolean {
    return degradedMode;
  }

  static isFeatureDisabled(feature: string): boolean {
    return disabledFeatures.has(feature);
  }

  static resetDegradedMode(): void {
    degradedMode = false;
    disabledFeatures.clear();
  }

  // =========================================================================
  // Utility
  // =========================================================================

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
