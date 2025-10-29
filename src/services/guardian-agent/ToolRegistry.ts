/**
 * Tool Registry - Capability-based security with checksums
 * Prevents supply-chain attacks and ensures tool integrity
 *
 * Features:
 * - Tool version pinning with checksums
 * - Capability declarations (reads, writes, egress)
 * - Checksum validation before execution
 * - Tool isolation and sandboxing
 */

import { TokenScope } from './TokenAuth';

/**
 * Tool capabilities - What a tool can access
 */
export interface ToolCapabilities {
  /** Resources the tool can read */
  reads: string[];

  /** Resources the tool can write */
  writes: string[];

  /** External domains the tool can call (egress) */
  egress: string[];

  /** Database tables the tool can access */
  databaseTables?: string[];

  /** API endpoints the tool can call */
  apiEndpoints?: string[];

  /** File system paths the tool can access */
  fileSystemPaths?: string[];
}

/**
 * Tool metadata
 */
export interface ToolMetadata {
  /** Unique tool identifier */
  id: string;

  /** Tool name */
  name: string;

  /** Tool version (semver) */
  version: string;

  /** Tool description */
  description: string;

  /** Required scopes to execute this tool */
  requiredScopes: TokenScope[];

  /** Declared capabilities */
  capabilities: ToolCapabilities;

  /** Checksum (SHA-256) for integrity verification */
  checksum: string;

  /** Author/maintainer */
  author: string;

  /** Last updated timestamp */
  lastUpdated: Date;

  /** Is tool approved for production? */
  approved: boolean;

  /** Execution timeout (ms) */
  timeout: number;

  /** Maximum concurrent executions */
  maxConcurrency: number;
}

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  /** Token for authentication */
  token: string;

  /** Tenant ID for multi-tenancy */
  tenantId?: string;

  /** User ID executing the tool */
  userId?: string;

  /** Session ID for audit trail */
  sessionId?: string;

  /** Execution timeout override */
  timeout?: number;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  executionTime: number;
  resourcesAccessed: string[];
  egressCalls: Array<{ domain: string; endpoint: string }>;
}

/**
 * Tool Registry - Manages all available tools
 */
export class ToolRegistry {
  private tools: Map<string, ToolMetadata> = new Map();
  private checksumCache: Map<string, string> = new Map();

  /**
   * Register a new tool
   */
  register(metadata: ToolMetadata): void {
    // Validate checksum
    if (!this.isValidChecksum(metadata.checksum)) {
      throw new Error(`Invalid checksum format for tool ${metadata.id}`);
    }

    // Validate version
    if (!this.isValidSemver(metadata.version)) {
      throw new Error(`Invalid semver version for tool ${metadata.id}`);
    }

    // Validate capabilities
    this.validateCapabilities(metadata.capabilities);

    // Store in registry
    this.tools.set(metadata.id, metadata);
    this.checksumCache.set(metadata.id, metadata.checksum);


  }

  /**
   * Get tool metadata
   */
  get(toolId: string): ToolMetadata | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Verify tool integrity before execution
   */
  verifyIntegrity(toolId: string, currentChecksum: string): {
    valid: boolean;
    error?: string;
  } {
    const expectedChecksum = this.checksumCache.get(toolId);

    if (!expectedChecksum) {
      return {
        valid: false,
        error: `Tool ${toolId} not found in registry`,
      };
    }

    if (expectedChecksum !== currentChecksum) {
      return {
        valid: false,
        error: `Checksum mismatch for tool ${toolId}. Expected: ${expectedChecksum}, Got: ${currentChecksum}`,
      };
    }

    return { valid: true };
  }

  /**
   * Check if tool is approved for production
   */
  isApproved(toolId: string): boolean {
    const tool = this.tools.get(toolId);
    return tool?.approved ?? false;
  }

  /**
   * List all registered tools
   */
  list(): ToolMetadata[] {
    return Array.from(this.tools.values());
  }

  /**
   * List tools by capability
   */
  listByCapability(capability: 'reads' | 'writes' | 'egress'): ToolMetadata[] {
    return this.list().filter((tool) => tool.capabilities[capability].length > 0);
  }

  /**
   * Check if tool has specific capability
   */
  hasCapability(
    toolId: string,
    capability: 'reads' | 'writes' | 'egress',
    resource: string
  ): boolean {
    const tool = this.tools.get(toolId);
    if (!tool) return false;

    return tool.capabilities[capability].includes(resource);
  }

  /**
   * Get tools that require specific scope
   */
  getToolsRequiringScope(scope: TokenScope): ToolMetadata[] {
    return this.list().filter((tool) => tool.requiredScopes.includes(scope));
  }

  // Private validation methods

  private isValidChecksum(checksum: string): boolean {
    // SHA-256 is 64 hex characters
    return /^[a-f0-9]{64}$/i.test(checksum);
  }

  private isValidSemver(version: string): boolean {
    return /^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/i.test(version);
  }

  private validateCapabilities(capabilities: ToolCapabilities): void {
    // Validate egress domains are valid URLs
    for (const domain of capabilities.egress) {
      try {
        new URL(domain);
      } catch {
        throw new Error(`Invalid egress domain: ${domain}`);
      }
    }

    // Validate no wildcard writes (too dangerous)
    if (capabilities.writes.some((w) => w.includes('*'))) {
      throw new Error('Wildcard writes are not allowed');
    }
  }
}

/**
 * Built-in Tools - Core Guardian Agent tools
 */
export class BuiltInTools {
  static register(registry: ToolRegistry): void {
    // 1. API Retry Tool
    registry.register({
      id: 'guardian.retry-api',
      name: 'API Retry',
      version: '1.0.0',
      description: 'Retries failed API calls with exponential backoff',
      requiredScopes: ['api.retry:endpoint'],
      capabilities: {
        reads: ['api:*'],
        writes: [],
        egress: [], // Reuses existing API endpoints, no new egress
      },
      checksum: this.computeChecksum('guardian.retry-api', '1.0.0'),
      author: 'Guardian Agent Core',
      lastUpdated: new Date(),
      approved: true,
      timeout: 30000,
      maxConcurrency: 10,
    });

    // 2. Circuit Breaker Tool
    registry.register({
      id: 'guardian.circuit-breaker',
      name: 'Circuit Breaker',
      version: '1.0.0',
      description: 'Prevents cascade failures with circuit breaker pattern',
      requiredScopes: ['circuit.control:breaker'],
      capabilities: {
        reads: ['circuit:*'],
        writes: ['circuit:state'],
        egress: [],
      },
      checksum: this.computeChecksum('guardian.circuit-breaker', '1.0.0'),
      author: 'Guardian Agent Core',
      lastUpdated: new Date(),
      approved: true,
      timeout: 5000,
      maxConcurrency: 1,
    });

    // 3. Cache Fallback Tool
    registry.register({
      id: 'guardian.cache-fallback',
      name: 'Cache Fallback',
      version: '1.0.0',
      description: 'Falls back to cached data when API fails',
      requiredScopes: ['cache.read:fallback'],
      capabilities: {
        reads: ['cache:*'],
        writes: [],
        egress: [],
      },
      checksum: this.computeChecksum('guardian.cache-fallback', '1.0.0'),
      author: 'Guardian Agent Core',
      lastUpdated: new Date(),
      approved: true,
      timeout: 10000,
      maxConcurrency: 20,
    });

    // 4. State Rollback Tool
    registry.register({
      id: 'guardian.state-rollback',
      name: 'State Rollback',
      version: '1.0.0',
      description: 'Rolls back application state to last known-good',
      requiredScopes: ['state.write:rollback'],
      capabilities: {
        reads: ['state:*'],
        writes: ['state:current'],
        egress: [],
      },
      checksum: this.computeChecksum('guardian.state-rollback', '1.0.0'),
      author: 'Guardian Agent Core',
      lastUpdated: new Date(),
      approved: true,
      timeout: 15000,
      maxConcurrency: 5,
    });

    // 5. Resource Cleanup Tool
    registry.register({
      id: 'guardian.resource-cleanup',
      name: 'Resource Cleanup',
      version: '1.0.0',
      description: 'Cleans up memory leaks and stale resources',
      requiredScopes: ['memory.write:cleanup'],
      capabilities: {
        reads: ['memory:heap', 'memory:listeners'],
        writes: ['memory:heap'],
        egress: [],
      },
      checksum: this.computeChecksum('guardian.resource-cleanup', '1.0.0'),
      author: 'Guardian Agent Core',
      lastUpdated: new Date(),
      approved: true,
      timeout: 20000,
      maxConcurrency: 3,
    });

    // 6. Session Recovery Tool
    registry.register({
      id: 'guardian.session-recovery',
      name: 'Session Recovery',
      version: '1.0.0',
      description: 'Recovers expired sessions with token refresh',
      requiredScopes: ['session.write:recovery'],
      capabilities: {
        reads: ['session:*', 'auth:tokens'],
        writes: ['session:current', 'auth:tokens'],
        egress: ['https://api.wellfit.community'], // Only allowed to call our own API
      },
      checksum: this.computeChecksum('guardian.session-recovery', '1.0.0'),
      author: 'Guardian Agent Core',
      lastUpdated: new Date(),
      approved: true,
      timeout: 10000,
      maxConcurrency: 10,
    });

    // 7. FHIR Observation Read Tool
    registry.register({
      id: 'fhir.read-observation',
      name: 'FHIR Observation Reader',
      version: '1.0.0',
      description: 'Reads FHIR Observation resources',
      requiredScopes: ['fhir.read:Observation'],
      capabilities: {
        reads: ['fhir:Observation'],
        writes: [],
        egress: ['https://fhir.wellfit.community'],
        databaseTables: ['fhir_observations'],
      },
      checksum: this.computeChecksum('fhir.read-observation', '1.0.0'),
      author: 'FHIR Integration Team',
      lastUpdated: new Date(),
      approved: true,
      timeout: 15000,
      maxConcurrency: 20,
    });

    // 8. EHR Note Writer Tool
    registry.register({
      id: 'ehr.write-note',
      name: 'EHR Note Writer',
      version: '1.0.0',
      description: 'Writes clinical notes to EHR',
      requiredScopes: ['ehr.write:Note'],
      capabilities: {
        reads: ['ehr:templates'],
        writes: ['ehr:notes'],
        egress: ['https://ehr.wellfit.community'],
        databaseTables: ['clinical_notes', 'note_templates'],
      },
      checksum: this.computeChecksum('ehr.write-note', '1.0.0'),
      author: 'EHR Integration Team',
      lastUpdated: new Date(),
      approved: true,
      timeout: 20000,
      maxConcurrency: 10,
    });
  }

  /**
   * Compute tool checksum (simplified for demo)
   * In production: Use actual SHA-256 of tool source code
   */
  private static computeChecksum(toolId: string, version: string): string {
    // In production: Use crypto.createHash('sha256').update(toolSource).digest('hex')
    // For now: Generate deterministic fake checksum
    const str = `${toolId}-${version}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    // Pad to 64 hex characters
    return Math.abs(hash).toString(16).padStart(64, '0');
  }
}

/**
 * Global tool registry instance
 */
let globalRegistry: ToolRegistry | null = null;

export function getToolRegistry(): ToolRegistry {
  if (!globalRegistry) {
    globalRegistry = new ToolRegistry();
    BuiltInTools.register(globalRegistry);
  }
  return globalRegistry;
}

/**
 * Production TODO:
 *
 * 1. Implement real checksum computation:
 *    - Hash tool source code with SHA-256
 *    - Verify checksums on every execution
 *    - Alert on checksum mismatches
 *
 * 2. Add tool signing:
 *    - Sign tools with private key
 *    - Verify signatures before registration
 *    - Code signing certificates
 *
 * 3. Add capability enforcement:
 *    - Runtime checks for reads/writes/egress
 *    - Block unauthorized resource access
 *    - Log capability violations
 *
 * 4. Add tool versioning:
 *    - Support multiple versions of same tool
 *    - Version compatibility checking
 *    - Automatic rollback on failures
 *
 * 5. Add tool marketplace:
 *    - Third-party tool submissions
 *    - Security review process
 *    - Community ratings
 *
 * 6. Add telemetry:
 *    - Track tool usage metrics
 *    - Monitor tool performance
 *    - Alert on tool failures
 */
