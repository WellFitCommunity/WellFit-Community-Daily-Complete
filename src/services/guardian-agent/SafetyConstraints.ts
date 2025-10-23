/**
 * Safety Constraints & Compliance Layer
 * Ensures Guardian Agent operates within strict boundaries
 * HIPAA/SOC2 compliant with full audit trail
 */

import { DetectedIssue, HealingAction, HealingStep } from './types';

/**
 * Protected Resources - Never auto-fix these
 */
export const PROTECTED_RESOURCES = {
  // Core libraries that should never be auto-patched
  coreLibraries: [
    'node_modules/',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'src/contexts/',
    'src/services/supabase',
    'src/services/auth',
  ],

  // Shared utilities that require human review
  sharedLibraries: [
    'src/utils/',
    'src/lib/',
    'src/hooks/',
    'src/types/',
  ],

  // Database and infrastructure
  infrastructure: [
    'supabase/migrations/',
    '.env',
    '.env.production',
    'Dockerfile',
    'docker-compose.yml',
  ],

  // Security-critical files
  securityCritical: [
    'src/services/guardian-agent/',  // Don't let agent modify itself
    'src/components/auth/',
    'src/middleware/',
  ],
};

/**
 * Allowed Actions - What the agent CAN do autonomously
 */
export const ALLOWED_AUTONOMOUS_ACTIONS = [
  'retry_with_backoff',
  'circuit_breaker',
  'fallback_to_cache',
  'graceful_degradation',
  'state_rollback',
  'resource_cleanup',
  'session_recovery',
  'dependency_isolation',
];

/**
 * Actions Requiring Human Approval
 */
export const APPROVAL_REQUIRED_ACTIONS = [
  'auto_patch',              // Code changes need review
  'configuration_reset',     // Config changes need review
  'data_reconciliation',     // Data changes need review
  'security_lockdown',       // Security actions need review
  'emergency_shutdown',      // Critical actions need review
];

/**
 * Safety Validator - Checks if action is allowed
 */
export class SafetyValidator {
  /**
   * Validates if a healing action is safe to execute autonomously
   */
  static canExecuteAutonomously(action: HealingAction, issue: DetectedIssue): {
    allowed: boolean;
    reason: string;
    requiresApproval: boolean;
  } {
    // Check if action requires approval
    if (APPROVAL_REQUIRED_ACTIONS.includes(action.strategy)) {
      return {
        allowed: false,
        reason: `Action '${action.strategy}' requires human approval`,
        requiresApproval: true,
      };
    }

    // Check if action is in allowed list
    if (!ALLOWED_AUTONOMOUS_ACTIONS.includes(action.strategy)) {
      return {
        allowed: false,
        reason: `Action '${action.strategy}' is not in allowed autonomous actions`,
        requiresApproval: true,
      };
    }

    // Check if any steps target protected resources
    for (const step of action.steps) {
      const protectedCheck = this.isProtectedResource(step.target);
      if (protectedCheck.protected) {
        return {
          allowed: false,
          reason: `Target '${step.target}' is protected: ${protectedCheck.reason}`,
          requiresApproval: true,
        };
      }
    }

    // Check severity - critical issues need approval
    if (issue.severity === 'critical' && issue.signature.estimatedImpact.dataIntegrity) {
      return {
        allowed: false,
        reason: 'Critical issue affecting data integrity requires approval',
        requiresApproval: true,
      };
    }

    return {
      allowed: true,
      reason: 'Action is safe for autonomous execution',
      requiresApproval: false,
    };
  }

  /**
   * Checks if a resource is protected from auto-modification
   */
  static isProtectedResource(target: string): {
    protected: boolean;
    reason: string;
  } {
    // Check core libraries
    for (const pattern of PROTECTED_RESOURCES.coreLibraries) {
      if (target.includes(pattern)) {
        return {
          protected: true,
          reason: `Core library: ${pattern}`,
        };
      }
    }

    // Check shared libraries
    for (const pattern of PROTECTED_RESOURCES.sharedLibraries) {
      if (target.includes(pattern)) {
        return {
          protected: true,
          reason: `Shared library: ${pattern}`,
        };
      }
    }

    // Check infrastructure
    for (const pattern of PROTECTED_RESOURCES.infrastructure) {
      if (target.includes(pattern)) {
        return {
          protected: true,
          reason: `Infrastructure file: ${pattern}`,
        };
      }
    }

    // Check security-critical
    for (const pattern of PROTECTED_RESOURCES.securityCritical) {
      if (target.includes(pattern)) {
        return {
          protected: true,
          reason: `Security-critical: ${pattern}`,
        };
      }
    }

    return {
      protected: false,
      reason: 'Resource is not protected',
    };
  }

  /**
   * Validates a healing step before execution
   */
  static validateStep(step: HealingStep): {
    valid: boolean;
    reason: string;
  } {
    // No file system writes
    if (step.action.includes('write_file') || step.action.includes('modify_file')) {
      return {
        valid: false,
        reason: 'File system writes not allowed',
      };
    }

    // No network writes to production
    if (step.action.includes('deploy') || step.action.includes('publish')) {
      return {
        valid: false,
        reason: 'Network writes to production not allowed',
      };
    }

    // No code generation
    if (step.action.includes('generate_code') || step.action.includes('ai_fix')) {
      return {
        valid: false,
        reason: 'AI code generation not allowed without approval',
      };
    }

    // No database schema changes
    if (step.action.includes('alter_table') || step.action.includes('drop_table')) {
      return {
        valid: false,
        reason: 'Database schema changes not allowed',
      };
    }

    return {
      valid: true,
      reason: 'Step is safe to execute',
    };
  }
}

/**
 * Sandbox Environment for Testing Fixes
 */
export class SandboxEnvironment {
  private sandboxedFixes: Map<string, any> = new Map();

  /**
   * Test a fix in sandbox before applying
   */
  async testFix(action: HealingAction, issue: DetectedIssue): Promise<{
    success: boolean;
    errors: string[];
    sideEffects: string[];
  }> {
    const errors: string[] = [];
    const sideEffects: string[] = [];

    try {
      // Simulate the fix in isolation
      for (const step of action.steps) {
        // Track what would be affected
        sideEffects.push(`Would execute: ${step.action} on ${step.target}`);

        // Validate step
        const validation = SafetyValidator.validateStep(step);
        if (!validation.valid) {
          errors.push(validation.reason);
        }
      }

      return {
        success: errors.length === 0,
        errors,
        sideEffects,
      };
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
        sideEffects,
      };
    }
  }

  /**
   * Store a fix for later human review
   */
  storePendingFix(actionId: string, action: HealingAction, issue: DetectedIssue): void {
    this.sandboxedFixes.set(actionId, {
      action,
      issue,
      timestamp: new Date(),
      status: 'pending_review',
    });
  }

  /**
   * Get all pending fixes for review
   */
  getPendingFixes(): any[] {
    return Array.from(this.sandboxedFixes.values());
  }
}

/**
 * Version Manifest - Golden versions for rollback
 */
export class VersionManifest {
  private goldenVersions: Map<string, string> = new Map();

  constructor() {
    this.initializeGoldenVersions();
  }

  /**
   * Initialize with known-good versions
   */
  private initializeGoldenVersions(): void {
    // These should be loaded from a config file in production
    this.goldenVersions.set('react', '18.2.0');
    this.goldenVersions.set('react-dom', '18.2.0');
    this.goldenVersions.set('@supabase/supabase-js', '2.39.0');
    // Add more as needed
  }

  /**
   * Get golden version for a package
   */
  getGoldenVersion(packageName: string): string | null {
    return this.goldenVersions.get(packageName) || null;
  }

  /**
   * Check if current version matches golden version
   */
  isGoldenVersion(packageName: string, currentVersion: string): boolean {
    const golden = this.goldenVersions.get(packageName);
    return golden === currentVersion;
  }

  /**
   * Get rollback target version
   */
  getRollbackVersion(packageName: string): string | null {
    return this.getGoldenVersion(packageName);
  }
}

/**
 * Action Constraints - Runtime limits
 */
export const ACTION_CONSTRAINTS = {
  // Max time a healing action can take
  maxExecutionTimeMs: 30000, // 30 seconds

  // Max number of retries
  maxRetries: 3,

  // Max concurrent healings
  maxConcurrentHealings: 5,

  // Cooldown period between same action type
  actionCooldownMs: 60000, // 1 minute

  // Max memory usage allowed
  maxMemoryUsagePercent: 85,

  // Max number of affected resources
  maxAffectedResources: 10,
};

/**
 * Rate Limiter - Prevents action storms
 */
export class RateLimiter {
  private actionHistory: Map<string, Date[]> = new Map();

  /**
   * Check if action is rate-limited
   */
  isRateLimited(actionType: string): boolean {
    const history = this.actionHistory.get(actionType) || [];
    const now = Date.now();
    const recentActions = history.filter(
      (timestamp) => now - timestamp.getTime() < ACTION_CONSTRAINTS.actionCooldownMs
    );

    // Update history
    this.actionHistory.set(actionType, recentActions);

    // Check if we've exceeded rate
    return recentActions.length >= 3; // Max 3 of same action per cooldown period
  }

  /**
   * Record an action execution
   */
  recordAction(actionType: string): void {
    const history = this.actionHistory.get(actionType) || [];
    history.push(new Date());
    this.actionHistory.set(actionType, history);
  }
}
