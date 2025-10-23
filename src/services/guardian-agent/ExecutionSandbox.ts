/**
 * Execution Sandbox - Isolated tool execution with allow-lists
 * Prevents unauthorized network egress and resource access
 *
 * Features:
 * - Domain allow-lists per tool
 * - Network isolation by default
 * - Resource access control
 * - Execution timeout enforcement
 * - Concurrent execution limits
 */

import { ToolMetadata, ToolExecutionContext, ToolExecutionResult } from './ToolRegistry';
import { TokenManager, TokenScope } from './TokenAuth';
import { SchemaValidator } from './SchemaValidator';

/**
 * Execution policy for a tool
 */
export interface ExecutionPolicy {
  /** Allowed domains for network egress */
  allowedDomains: string[];

  /** Allowed database tables */
  allowedTables: string[];

  /** Allowed file system paths */
  allowedPaths: string[];

  /** Maximum execution time (ms) */
  maxExecutionTime: number;

  /** Maximum concurrent executions */
  maxConcurrency: number;

  /** Network isolation enabled */
  networkIsolation: boolean;

  /** File system isolation enabled */
  fileSystemIsolation: boolean;
}

/**
 * Execution statistics
 */
export interface ExecutionStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  lastExecutionTime?: number;
  concurrentExecutions: number;
}

/**
 * Resource access log entry
 */
export interface ResourceAccessLog {
  timestamp: Date;
  toolId: string;
  resourceType: 'network' | 'database' | 'filesystem';
  resource: string;
  allowed: boolean;
  reason?: string;
}

/**
 * Execution Sandbox - Secure tool execution environment
 */
export class ExecutionSandbox {
  private policies: Map<string, ExecutionPolicy> = new Map();
  private stats: Map<string, ExecutionStats> = new Map();
  private accessLogs: ResourceAccessLog[] = [];
  private activeExecutions: Map<string, number> = new Map();
  private tokenManager: TokenManager;
  private schemaValidator: SchemaValidator;

  constructor(tokenManager: TokenManager, schemaValidator: SchemaValidator) {
    this.tokenManager = tokenManager;
    this.schemaValidator = schemaValidator;
  }

  /**
   * Register execution policy for a tool
   */
  registerPolicy(toolId: string, policy: ExecutionPolicy): void {
    this.policies.set(toolId, policy);
    this.stats.set(toolId, {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      concurrentExecutions: 0,
    });
  }

  /**
   * Execute a tool in sandbox with full security checks
   */
  async execute<TInput, TOutput>(
    tool: ToolMetadata,
    input: TInput,
    context: ToolExecutionContext,
    executor: (input: TInput) => Promise<TOutput>
  ): Promise<ToolExecutionResult<TOutput>> {
    const startTime = Date.now();
    const resourcesAccessed: string[] = [];
    const egressCalls: Array<{ domain: string; endpoint: string }> = [];

    try {
      // 1. Check execution policy
      const policy = this.policies.get(tool.id);
      if (!policy) {
        throw new Error(`No execution policy registered for tool ${tool.id}`);
      }

      // 2. Validate token and scopes
      const tokenValidation = this.tokenManager.validateToken(
        context.token,
        tool.requiredScopes
      );

      if (!tokenValidation.valid) {
        throw new Error(`Token validation failed: ${tokenValidation.errorMessage}`);
      }

      // 3. Check concurrency limits
      const currentConcurrency = this.activeExecutions.get(tool.id) || 0;
      if (currentConcurrency >= policy.maxConcurrency) {
        throw new Error(
          `Max concurrency (${policy.maxConcurrency}) reached for tool ${tool.id}`
        );
      }

      // 4. Increment active executions
      this.activeExecutions.set(tool.id, currentConcurrency + 1);

      // 5. Create isolated execution context
      const isolatedExecutor = this.createIsolatedExecutor(
        tool,
        policy,
        executor,
        resourcesAccessed,
        egressCalls
      );

      // 6. Execute with timeout
      const timeout = context.timeout || policy.maxExecutionTime;
      const result = await this.executeWithTimeout(isolatedExecutor, input, timeout);

      // 7. Update stats (success)
      this.updateStats(tool.id, Date.now() - startTime, true);

      return {
        success: true,
        data: result,
        executionTime: Date.now() - startTime,
        resourcesAccessed,
        egressCalls,
      };
    } catch (error) {
      // Update stats (failure)
      this.updateStats(tool.id, Date.now() - startTime, false);

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
        resourcesAccessed,
        egressCalls,
      };
    } finally {
      // Decrement active executions
      const currentConcurrency = this.activeExecutions.get(tool.id) || 0;
      this.activeExecutions.set(tool.id, Math.max(0, currentConcurrency - 1));
    }
  }

  /**
   * Create isolated executor with allow-list enforcement
   */
  private createIsolatedExecutor<TInput, TOutput>(
    tool: ToolMetadata,
    policy: ExecutionPolicy,
    executor: (input: TInput) => Promise<TOutput>,
    resourcesAccessed: string[],
    egressCalls: Array<{ domain: string; endpoint: string }>
  ): (input: TInput) => Promise<TOutput> {
    return async (input: TInput): Promise<TOutput> => {
      // Wrap executor with resource access checks
      const originalFetch = globalThis.fetch;

      // Override fetch to enforce egress allow-list
      if (policy.networkIsolation) {
        globalThis.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
          const urlString = typeof url === 'string' ? url : url.toString();
          const domain = new URL(urlString).origin;

          // Check if domain is in allow-list
          if (!this.isDomainAllowed(domain, policy.allowedDomains)) {
            const logEntry: ResourceAccessLog = {
              timestamp: new Date(),
              toolId: tool.id,
              resourceType: 'network',
              resource: urlString,
              allowed: false,
              reason: `Domain ${domain} not in allow-list`,
            };
            this.accessLogs.push(logEntry);

            throw new Error(
              `Network access denied: ${domain} not in allow-list for tool ${tool.id}`
            );
          }

          // Log allowed egress
          egressCalls.push({ domain, endpoint: urlString });
          resourcesAccessed.push(urlString);

          const logEntry: ResourceAccessLog = {
            timestamp: new Date(),
            toolId: tool.id,
            resourceType: 'network',
            resource: urlString,
            allowed: true,
          };
          this.accessLogs.push(logEntry);

          return originalFetch(url, init);
        };
      }

      try {
        // Execute with isolated context
        const result = await executor(input);
        return result;
      } finally {
        // Restore original fetch
        globalThis.fetch = originalFetch;
      }
    };
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<TInput, TOutput>(
    executor: (input: TInput) => Promise<TOutput>,
    input: TInput,
    timeout: number
  ): Promise<TOutput> {
    return Promise.race([
      executor(input),
      new Promise<TOutput>((_, reject) =>
        setTimeout(() => reject(new Error(`Execution timeout after ${timeout}ms`)), timeout)
      ),
    ]);
  }

  /**
   * Check if domain is allowed
   */
  private isDomainAllowed(domain: string, allowedDomains: string[]): boolean {
    // Exact match
    if (allowedDomains.includes(domain)) {
      return true;
    }

    // Wildcard match (e.g., *.wellfit.community)
    for (const allowed of allowedDomains) {
      if (allowed.startsWith('*.')) {
        const baseDomain = allowed.substring(2);
        if (domain.endsWith(baseDomain)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if database table access is allowed
   */
  checkDatabaseAccess(toolId: string, tableName: string): {
    allowed: boolean;
    reason?: string;
  } {
    const policy = this.policies.get(toolId);
    if (!policy) {
      return { allowed: false, reason: 'No policy registered' };
    }

    const allowed = policy.allowedTables.includes(tableName);

    const logEntry: ResourceAccessLog = {
      timestamp: new Date(),
      toolId,
      resourceType: 'database',
      resource: tableName,
      allowed,
      reason: allowed ? undefined : `Table ${tableName} not in allow-list`,
    };
    this.accessLogs.push(logEntry);

    return {
      allowed,
      reason: allowed ? undefined : `Table ${tableName} not in allow-list for tool ${toolId}`,
    };
  }

  /**
   * Check if file system access is allowed
   */
  checkFileSystemAccess(toolId: string, filePath: string): {
    allowed: boolean;
    reason?: string;
  } {
    const policy = this.policies.get(toolId);
    if (!policy) {
      return { allowed: false, reason: 'No policy registered' };
    }

    // Check if path is in allow-list
    const allowed = policy.allowedPaths.some((allowedPath) =>
      filePath.startsWith(allowedPath)
    );

    const logEntry: ResourceAccessLog = {
      timestamp: new Date(),
      toolId,
      resourceType: 'filesystem',
      resource: filePath,
      allowed,
      reason: allowed ? undefined : `Path ${filePath} not in allow-list`,
    };
    this.accessLogs.push(logEntry);

    return {
      allowed,
      reason: allowed ? undefined : `Path ${filePath} not in allow-list for tool ${toolId}`,
    };
  }

  /**
   * Update execution statistics
   */
  private updateStats(toolId: string, executionTime: number, success: boolean): void {
    const stats = this.stats.get(toolId);
    if (!stats) return;

    stats.totalExecutions++;
    if (success) {
      stats.successfulExecutions++;
    } else {
      stats.failedExecutions++;
    }

    // Update average execution time
    const totalTime = stats.averageExecutionTime * (stats.totalExecutions - 1) + executionTime;
    stats.averageExecutionTime = totalTime / stats.totalExecutions;
    stats.lastExecutionTime = executionTime;

    this.stats.set(toolId, stats);
  }

  /**
   * Get execution statistics for a tool
   */
  getStats(toolId: string): ExecutionStats | undefined {
    return this.stats.get(toolId);
  }

  /**
   * Get all execution statistics
   */
  getAllStats(): Map<string, ExecutionStats> {
    return new Map(this.stats);
  }

  /**
   * Get resource access logs
   */
  getAccessLogs(filters?: {
    toolId?: string;
    resourceType?: 'network' | 'database' | 'filesystem';
    allowed?: boolean;
  }): ResourceAccessLog[] {
    let logs = [...this.accessLogs];

    if (filters?.toolId) {
      logs = logs.filter((log) => log.toolId === filters.toolId);
    }

    if (filters?.resourceType) {
      logs = logs.filter((log) => log.resourceType === filters.resourceType);
    }

    if (filters?.allowed !== undefined) {
      logs = logs.filter((log) => log.allowed === filters.allowed);
    }

    return logs;
  }

  /**
   * Get denied access attempts (security monitoring)
   */
  getDeniedAccess(): ResourceAccessLog[] {
    return this.getAccessLogs({ allowed: false });
  }

  /**
   * Clear old access logs (cleanup)
   */
  clearOldLogs(olderThanMs: number): void {
    const cutoff = Date.now() - olderThanMs;
    this.accessLogs = this.accessLogs.filter(
      (log) => log.timestamp.getTime() > cutoff
    );
  }
}

/**
 * Default policies for built-in tools
 */
export class DefaultPolicies {
  static createPolicies(): Map<string, ExecutionPolicy> {
    const policies = new Map<string, ExecutionPolicy>();

    // API Retry Tool - No network isolation (reuses existing calls)
    policies.set('guardian.retry-api', {
      allowedDomains: [], // Inherits from original call
      allowedTables: [],
      allowedPaths: [],
      maxExecutionTime: 30000,
      maxConcurrency: 10,
      networkIsolation: false,
      fileSystemIsolation: true,
    });

    // Circuit Breaker Tool - No external access
    policies.set('guardian.circuit-breaker', {
      allowedDomains: [],
      allowedTables: [],
      allowedPaths: [],
      maxExecutionTime: 5000,
      maxConcurrency: 1,
      networkIsolation: true,
      fileSystemIsolation: true,
    });

    // Cache Fallback Tool - No external access
    policies.set('guardian.cache-fallback', {
      allowedDomains: [],
      allowedTables: [],
      allowedPaths: [],
      maxExecutionTime: 10000,
      maxConcurrency: 20,
      networkIsolation: true,
      fileSystemIsolation: true,
    });

    // State Rollback Tool - No external access
    policies.set('guardian.state-rollback', {
      allowedDomains: [],
      allowedTables: [],
      allowedPaths: [],
      maxExecutionTime: 15000,
      maxConcurrency: 5,
      networkIsolation: true,
      fileSystemIsolation: true,
    });

    // Resource Cleanup Tool - No external access
    policies.set('guardian.resource-cleanup', {
      allowedDomains: [],
      allowedTables: [],
      allowedPaths: [],
      maxExecutionTime: 20000,
      maxConcurrency: 3,
      networkIsolation: true,
      fileSystemIsolation: true,
    });

    // Session Recovery Tool - Only our API
    policies.set('guardian.session-recovery', {
      allowedDomains: ['https://api.wellfit.community'],
      allowedTables: ['sessions', 'auth_tokens'],
      allowedPaths: [],
      maxExecutionTime: 10000,
      maxConcurrency: 10,
      networkIsolation: true,
      fileSystemIsolation: true,
    });

    // FHIR Observation Read Tool
    policies.set('fhir.read-observation', {
      allowedDomains: ['https://fhir.wellfit.community'],
      allowedTables: ['fhir_observations'],
      allowedPaths: [],
      maxExecutionTime: 15000,
      maxConcurrency: 20,
      networkIsolation: true,
      fileSystemIsolation: true,
    });

    // EHR Note Writer Tool
    policies.set('ehr.write-note', {
      allowedDomains: ['https://ehr.wellfit.community'],
      allowedTables: ['clinical_notes', 'note_templates'],
      allowedPaths: [],
      maxExecutionTime: 20000,
      maxConcurrency: 10,
      networkIsolation: true,
      fileSystemIsolation: true,
    });

    return policies;
  }
}

/**
 * Production TODO:
 *
 * 1. Implement actual network isolation:
 *    - Use VM or container isolation
 *    - Implement network proxy with allow-list
 *    - Block all unauthorized egress
 *
 * 2. Implement file system isolation:
 *    - Use chroot or containers
 *    - Virtual file system for tools
 *    - Read-only mounts for sensitive paths
 *
 * 3. Add resource limits:
 *    - CPU limits per tool
 *    - Memory limits per tool
 *    - Disk I/O limits
 *
 * 4. Add execution monitoring:
 *    - Real-time execution tracking
 *    - Alert on policy violations
 *    - Automatic tool suspension on abuse
 *
 * 5. Add security scanning:
 *    - Scan tool inputs for malicious payloads
 *    - Detect command injection attempts
 *    - Monitor for data exfiltration
 */
