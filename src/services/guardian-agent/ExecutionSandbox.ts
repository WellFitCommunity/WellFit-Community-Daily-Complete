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
 * - Memory usage monitoring
 * - Rate limiting per tool
 * - Resource limit enforcement
 */

import { ToolMetadata, ToolExecutionContext, ToolExecutionResult } from './ToolRegistry';
import { TokenManager } from './TokenAuth';
import { SchemaValidator } from './SchemaValidator';
import { auditLogger } from '../auditLogger';

/**
 * Resource limits for tool execution
 */
export interface ResourceLimits {
  /** Maximum memory usage in bytes (0 = unlimited) */
  maxMemoryBytes: number;

  /** Maximum CPU time in ms per execution (0 = unlimited) */
  maxCpuTimeMs: number;

  /** Maximum executions per minute (rate limiting) */
  maxExecutionsPerMinute: number;

  /** Maximum payload size in bytes */
  maxPayloadBytes: number;

  /** Maximum response size in bytes */
  maxResponseBytes: number;
}

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

  /** Resource limits */
  resourceLimits: ResourceLimits;
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
 * Resource usage snapshot
 */
export interface ResourceUsage {
  memoryUsedBytes: number;
  cpuTimeMs: number;
  executionCount: number;
  timestamp: Date;
}

/**
 * Rate limit violation
 */
export interface RateLimitViolation {
  toolId: string;
  timestamp: Date;
  limit: number;
  actual: number;
  windowMs: number;
}

/**
 * Resource Monitor - Tracks resource usage and enforces limits
 */
export class ResourceMonitor {
  private executionHistory: Map<string, number[]> = new Map(); // toolId -> timestamps
  private memorySnapshots: Map<string, number[]> = new Map(); // toolId -> memory readings
  private violations: RateLimitViolation[] = [];
  private readonly WINDOW_MS = 60000; // 1 minute window for rate limiting

  /**
   * Check if execution is allowed based on rate limits
   */
  checkRateLimit(toolId: string, maxPerMinute: number): {
    allowed: boolean;
    currentRate: number;
    retryAfterMs?: number;
  } {
    if (maxPerMinute <= 0) {
      return { allowed: true, currentRate: 0 };
    }

    const now = Date.now();
    const history = this.executionHistory.get(toolId) || [];

    // Clean up old entries outside the window
    const recentExecutions = history.filter((ts) => now - ts < this.WINDOW_MS);
    this.executionHistory.set(toolId, recentExecutions);

    const currentRate = recentExecutions.length;

    if (currentRate >= maxPerMinute) {
      // Calculate when the oldest execution will expire
      const oldestInWindow = Math.min(...recentExecutions);
      const retryAfterMs = this.WINDOW_MS - (now - oldestInWindow);

      this.recordViolation(toolId, maxPerMinute, currentRate);

      return {
        allowed: false,
        currentRate,
        retryAfterMs,
      };
    }

    return { allowed: true, currentRate };
  }

  /**
   * Record an execution for rate limiting
   */
  recordExecution(toolId: string): void {
    const history = this.executionHistory.get(toolId) || [];
    history.push(Date.now());
    this.executionHistory.set(toolId, history);
  }

  /**
   * Estimate memory usage of a value
   * Note: This is a rough estimate, not precise measurement
   */
  estimateMemoryUsage(value: unknown): number {
    const seen = new WeakSet();

    const estimate = (val: unknown): number => {
      if (val === null || val === undefined) return 8;
      if (typeof val === 'boolean') return 4;
      if (typeof val === 'number') return 8;
      if (typeof val === 'string') return (val as string).length * 2 + 40; // UTF-16

      if (typeof val === 'object') {
        if (seen.has(val as object)) return 0; // Circular reference
        seen.add(val as object);

        if (Array.isArray(val)) {
          return val.reduce((acc, item) => acc + estimate(item), 40);
        }

        // Object
        let size = 40; // Object overhead
        for (const key in val) {
          if (Object.prototype.hasOwnProperty.call(val, key)) {
            size += key.length * 2 + estimate((val as Record<string, unknown>)[key]);
          }
        }
        return size;
      }

      return 8; // Default for functions, symbols, etc.
    };

    return estimate(value);
  }

  /**
   * Check if payload size is within limits
   */
  checkPayloadSize(payload: unknown, maxBytes: number): {
    allowed: boolean;
    actualBytes: number;
  } {
    if (maxBytes <= 0) {
      return { allowed: true, actualBytes: 0 };
    }

    const actualBytes = this.estimateMemoryUsage(payload);
    return {
      allowed: actualBytes <= maxBytes,
      actualBytes,
    };
  }

  /**
   * Get current memory usage (if available)
   */
  getCurrentMemoryUsage(): {
    available: boolean;
    usedBytes?: number;
    totalBytes?: number;
  } {
    // Check if we're in a browser with performance.memory
    if (
      typeof globalThis.performance !== 'undefined' &&
      'memory' in globalThis.performance
    ) {
      const memory = (globalThis.performance as Performance & {
        memory?: { usedJSHeapSize: number; totalJSHeapSize: number };
      }).memory;

      if (memory) {
        return {
          available: true,
          usedBytes: memory.usedJSHeapSize,
          totalBytes: memory.totalJSHeapSize,
        };
      }
    }

    // Node.js with process.memoryUsage
    if (typeof process !== 'undefined' && process.memoryUsage) {
      try {
        const usage = process.memoryUsage();
        return {
          available: true,
          usedBytes: usage.heapUsed,
          totalBytes: usage.heapTotal,
        };
      } catch {
        // May fail in some environments
      }
    }

    return { available: false };
  }

  /**
   * Record memory snapshot for a tool
   */
  recordMemorySnapshot(toolId: string, bytes: number): void {
    const snapshots = this.memorySnapshots.get(toolId) || [];
    snapshots.push(bytes);
    // Keep only last 100 snapshots
    if (snapshots.length > 100) {
      snapshots.shift();
    }
    this.memorySnapshots.set(toolId, snapshots);
  }

  /**
   * Get average memory usage for a tool
   */
  getAverageMemoryUsage(toolId: string): number | null {
    const snapshots = this.memorySnapshots.get(toolId);
    if (!snapshots || snapshots.length === 0) return null;
    return snapshots.reduce((a, b) => a + b, 0) / snapshots.length;
  }

  /**
   * Record a rate limit violation
   */
  private recordViolation(toolId: string, limit: number, actual: number): void {
    this.violations.push({
      toolId,
      timestamp: new Date(),
      limit,
      actual,
      windowMs: this.WINDOW_MS,
    });

    // Log the violation
    void auditLogger.warn('RATE_LIMIT_EXCEEDED', {
      toolId,
      limit,
      actual,
      windowMs: this.WINDOW_MS,
    });
  }

  /**
   * Get rate limit violations
   */
  getViolations(): RateLimitViolation[] {
    return [...this.violations];
  }

  /**
   * Clear old violations
   */
  clearOldViolations(olderThanMs: number): void {
    const cutoff = Date.now() - olderThanMs;
    this.violations = this.violations.filter(
      (v) => v.timestamp.getTime() > cutoff
    );
  }

  /**
   * Get resource usage summary for a tool
   */
  getResourceSummary(toolId: string): {
    executionsInWindow: number;
    averageMemoryBytes: number | null;
    violations: number;
  } {
    const history = this.executionHistory.get(toolId) || [];
    const now = Date.now();
    const recentExecutions = history.filter((ts) => now - ts < this.WINDOW_MS);

    return {
      executionsInWindow: recentExecutions.length,
      averageMemoryBytes: this.getAverageMemoryUsage(toolId),
      violations: this.violations.filter((v) => v.toolId === toolId).length,
    };
  }
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
  private resourceMonitor: ResourceMonitor;

  constructor(tokenManager: TokenManager, schemaValidator: SchemaValidator) {
    this.tokenManager = tokenManager;
    this.schemaValidator = schemaValidator;
    this.resourceMonitor = new ResourceMonitor();
  }

  /**
   * Get the resource monitor for external access
   */
  getResourceMonitor(): ResourceMonitor {
    return this.resourceMonitor;
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

      // 2. Check rate limits
      const rateCheck = this.resourceMonitor.checkRateLimit(
        tool.id,
        policy.resourceLimits.maxExecutionsPerMinute
      );
      if (!rateCheck.allowed) {
        await auditLogger.warn('TOOL_RATE_LIMITED', {
          toolId: tool.id,
          currentRate: rateCheck.currentRate,
          retryAfterMs: rateCheck.retryAfterMs,
        });
        throw new Error(
          `Rate limit exceeded for tool ${tool.id}. Current: ${rateCheck.currentRate}/min. ` +
          `Retry after ${Math.ceil((rateCheck.retryAfterMs || 0) / 1000)} seconds.`
        );
      }

      // 3. Check payload size
      const payloadCheck = this.resourceMonitor.checkPayloadSize(
        input,
        policy.resourceLimits.maxPayloadBytes
      );
      if (!payloadCheck.allowed) {
        await auditLogger.warn('TOOL_PAYLOAD_TOO_LARGE', {
          toolId: tool.id,
          actualBytes: payloadCheck.actualBytes,
          maxBytes: policy.resourceLimits.maxPayloadBytes,
        });
        throw new Error(
          `Payload too large for tool ${tool.id}. ` +
          `Size: ${payloadCheck.actualBytes} bytes, Max: ${policy.resourceLimits.maxPayloadBytes} bytes.`
        );
      }

      // 4. Validate token and scopes
      const tokenValidation = await this.tokenManager.validateToken(
        context.token,
        tool.requiredScopes
      );

      if (!tokenValidation.valid) {
        throw new Error(`Token validation failed: ${tokenValidation.errorMessage}`);
      }

      // 5. Check concurrency limits
      const currentConcurrency = this.activeExecutions.get(tool.id) || 0;
      if (currentConcurrency >= policy.maxConcurrency) {
        throw new Error(
          `Max concurrency (${policy.maxConcurrency}) reached for tool ${tool.id}`
        );
      }

      // 6. Record memory before execution
      const memoryBefore = this.resourceMonitor.getCurrentMemoryUsage();

      // 7. Increment active executions
      this.activeExecutions.set(tool.id, currentConcurrency + 1);

      // 8. Record execution for rate limiting
      this.resourceMonitor.recordExecution(tool.id);

      // 9. Create isolated execution context
      const isolatedExecutor = this.createIsolatedExecutor(
        tool,
        policy,
        executor,
        resourcesAccessed,
        egressCalls
      );

      // 10. Execute with timeout
      const timeout = context.timeout || policy.maxExecutionTime;
      const result = await this.executeWithTimeout(isolatedExecutor, input, timeout);

      // 11. Check response size
      const responseCheck = this.resourceMonitor.checkPayloadSize(
        result,
        policy.resourceLimits.maxResponseBytes
      );
      if (!responseCheck.allowed) {
        await auditLogger.warn('TOOL_RESPONSE_TOO_LARGE', {
          toolId: tool.id,
          actualBytes: responseCheck.actualBytes,
          maxBytes: policy.resourceLimits.maxResponseBytes,
        });
        throw new Error(
          `Response too large from tool ${tool.id}. ` +
          `Size: ${responseCheck.actualBytes} bytes, Max: ${policy.resourceLimits.maxResponseBytes} bytes.`
        );
      }

      // 12. Record memory after execution
      const memoryAfter = this.resourceMonitor.getCurrentMemoryUsage();
      if (memoryBefore.available && memoryAfter.available) {
        const memoryUsed = (memoryAfter.usedBytes || 0) - (memoryBefore.usedBytes || 0);
        if (memoryUsed > 0) {
          this.resourceMonitor.recordMemorySnapshot(tool.id, memoryUsed);
        }
      }

      // 13. Update stats (success)
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
 * Default resource limits for different tool types
 */
export const DEFAULT_RESOURCE_LIMITS: Record<string, ResourceLimits> = {
  // Minimal limits for internal tools
  minimal: {
    maxMemoryBytes: 10 * 1024 * 1024, // 10 MB
    maxCpuTimeMs: 5000, // 5 seconds
    maxExecutionsPerMinute: 60,
    maxPayloadBytes: 64 * 1024, // 64 KB
    maxResponseBytes: 256 * 1024, // 256 KB
  },
  // Standard limits for most tools
  standard: {
    maxMemoryBytes: 50 * 1024 * 1024, // 50 MB
    maxCpuTimeMs: 30000, // 30 seconds
    maxExecutionsPerMinute: 30,
    maxPayloadBytes: 1024 * 1024, // 1 MB
    maxResponseBytes: 5 * 1024 * 1024, // 5 MB
  },
  // Extended limits for data-intensive tools
  extended: {
    maxMemoryBytes: 100 * 1024 * 1024, // 100 MB
    maxCpuTimeMs: 60000, // 60 seconds
    maxExecutionsPerMinute: 10,
    maxPayloadBytes: 5 * 1024 * 1024, // 5 MB
    maxResponseBytes: 20 * 1024 * 1024, // 20 MB
  },
  // Unlimited (use with caution)
  unlimited: {
    maxMemoryBytes: 0, // No limit
    maxCpuTimeMs: 0, // No limit
    maxExecutionsPerMinute: 0, // No limit
    maxPayloadBytes: 0, // No limit
    maxResponseBytes: 0, // No limit
  },
};

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
      resourceLimits: DEFAULT_RESOURCE_LIMITS.standard,
    });

    // Circuit Breaker Tool - No external access (minimal resources)
    policies.set('guardian.circuit-breaker', {
      allowedDomains: [],
      allowedTables: [],
      allowedPaths: [],
      maxExecutionTime: 5000,
      maxConcurrency: 1,
      networkIsolation: true,
      fileSystemIsolation: true,
      resourceLimits: DEFAULT_RESOURCE_LIMITS.minimal,
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
      resourceLimits: DEFAULT_RESOURCE_LIMITS.standard,
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
      resourceLimits: DEFAULT_RESOURCE_LIMITS.standard,
    });

    // Resource Cleanup Tool - No external access (minimal resources)
    policies.set('guardian.resource-cleanup', {
      allowedDomains: [],
      allowedTables: [],
      allowedPaths: [],
      maxExecutionTime: 20000,
      maxConcurrency: 3,
      networkIsolation: true,
      fileSystemIsolation: true,
      resourceLimits: DEFAULT_RESOURCE_LIMITS.minimal,
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
      resourceLimits: DEFAULT_RESOURCE_LIMITS.standard,
    });

    // FHIR Observation Read Tool (extended for large datasets)
    policies.set('fhir.read-observation', {
      allowedDomains: ['https://fhir.wellfit.community'],
      allowedTables: ['fhir_observations'],
      allowedPaths: [],
      maxExecutionTime: 15000,
      maxConcurrency: 20,
      networkIsolation: true,
      fileSystemIsolation: true,
      resourceLimits: DEFAULT_RESOURCE_LIMITS.extended,
    });

    // EHR Note Writer Tool (standard limits)
    policies.set('ehr.write-note', {
      allowedDomains: ['https://ehr.wellfit.community'],
      allowedTables: ['clinical_notes', 'note_templates'],
      allowedPaths: [],
      maxExecutionTime: 20000,
      maxConcurrency: 10,
      networkIsolation: true,
      fileSystemIsolation: true,
      resourceLimits: DEFAULT_RESOURCE_LIMITS.standard,
    });

    return policies;
  }
}

/**
 * Implementation Status:
 *
 * ✅ IMPLEMENTED:
 * 1. Resource Limits:
 *    - Memory usage estimation and tracking
 *    - Payload/response size limits
 *    - Rate limiting per tool (executions per minute)
 *    - Default resource limit presets (minimal, standard, extended)
 *    - Memory snapshots for monitoring
 *
 * 2. Execution Monitoring:
 *    - Real-time execution statistics
 *    - Rate limit violation tracking
 *    - Resource usage summaries per tool
 *    - Audit logging for limit violations
 *
 * 3. Network Egress Control:
 *    - Domain allow-lists per tool
 *    - Fetch interception for egress enforcement
 *    - Access logging for all network calls
 *
 * 🔲 TODO (Future Enhancements):
 *
 * 1. True process isolation:
 *    - Use Web Workers for browser isolation
 *    - Use child_process/vm for Node.js isolation
 *    - Consider WASM sandboxing for untrusted code
 *
 * 2. Enhanced file system isolation:
 *    - Virtual file system for tools
 *    - Read-only mounts for sensitive paths
 *
 * 3. CPU time enforcement:
 *    - Use SharedArrayBuffer for time slicing (requires COOP/COEP)
 *    - Implement preemptive termination
 *
 * 4. Security scanning:
 *    - Integrate with SchemaValidator PHI/SQL/XSS detection
 *    - Detect command injection attempts
 *    - Monitor for data exfiltration patterns
 */
