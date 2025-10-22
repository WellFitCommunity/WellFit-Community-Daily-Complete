/**
 * Comprehensive Error Signature Library
 * Contains patterns for all common healthcare software errors
 */

import { ErrorSignature, ErrorCategory, SeverityLevel } from './types';

export class ErrorSignatureLibrary {
  private signatures: Map<string, ErrorSignature> = new Map();

  constructor() {
    this.initializeSignatures();
  }

  private initializeSignatures(): void {
    // Type Mismatch Errors
    this.addSignature({
      id: 'type-mismatch-undefined',
      category: 'type_mismatch',
      pattern: /Cannot read propert(y|ies) of undefined/i,
      stackTracePattern: /\.tsx?:\d+:\d+/,
      severity: 'high',
      description: 'Attempting to access property of undefined object',
      commonCauses: [
        'API response not validated before use',
        'Component rendered before data loaded',
        'Missing null checks',
        'Async timing issues'
      ],
      healingStrategies: ['fallback_to_cache', 'graceful_degradation', 'state_rollback'],
      estimatedImpact: {
        usersFacing: true,
        dataIntegrity: false,
        securityRisk: false,
        availabilityImpact: 60
      }
    });

    this.addSignature({
      id: 'type-mismatch-null',
      category: 'type_mismatch',
      pattern: /Cannot read propert(y|ies) of null/i,
      severity: 'high',
      description: 'Attempting to access property of null object',
      commonCauses: [
        'Database query returned null',
        'Optional chaining not used',
        'State not initialized properly'
      ],
      healingStrategies: ['state_rollback', 'graceful_degradation', 'fallback_to_cache'],
      estimatedImpact: {
        usersFacing: true,
        dataIntegrity: false,
        securityRisk: false,
        availabilityImpact: 50
      }
    });

    // API Failures
    this.addSignature({
      id: 'api-401-unauthorized',
      category: 'authentication_failure',
      pattern: /401|Unauthorized|Authentication failed/i,
      severity: 'critical',
      description: 'Authentication token expired or invalid',
      commonCauses: [
        'Session timeout',
        'Token not refreshed',
        'Invalid credentials',
        'Token storage cleared'
      ],
      healingStrategies: ['session_recovery', 'retry_with_backoff', 'configuration_reset'],
      estimatedImpact: {
        usersFacing: true,
        dataIntegrity: false,
        securityRisk: true,
        availabilityImpact: 90
      }
    });

    this.addSignature({
      id: 'api-403-forbidden',
      category: 'authorization_breach',
      pattern: /403|Forbidden|Access denied/i,
      severity: 'critical',
      description: 'User lacks required permissions',
      commonCauses: [
        'Role-based access control failure',
        'Permission escalation attempt',
        'RLS policy blocking access'
      ],
      healingStrategies: ['security_lockdown', 'session_recovery', 'graceful_degradation'],
      estimatedImpact: {
        usersFacing: true,
        dataIntegrity: false,
        securityRisk: true,
        availabilityImpact: 70
      }
    });

    this.addSignature({
      id: 'api-429-rate-limit',
      category: 'api_failure',
      pattern: /429|Too many requests|Rate limit/i,
      severity: 'medium',
      description: 'Rate limit exceeded',
      commonCauses: [
        'Excessive API calls in loop',
        'No request throttling',
        'DDoS or abuse attempt'
      ],
      healingStrategies: ['circuit_breaker', 'retry_with_backoff', 'fallback_to_cache'],
      estimatedImpact: {
        usersFacing: true,
        dataIntegrity: false,
        securityRisk: false,
        availabilityImpact: 40
      }
    });

    this.addSignature({
      id: 'api-500-server-error',
      category: 'api_failure',
      pattern: /500|Internal server error|Server error/i,
      severity: 'high',
      description: 'Backend service failure',
      commonCauses: [
        'Database connection lost',
        'Unhandled exception in API',
        'Resource exhaustion',
        'Configuration error'
      ],
      healingStrategies: ['retry_with_backoff', 'circuit_breaker', 'fallback_to_cache'],
      estimatedImpact: {
        usersFacing: true,
        dataIntegrity: false,
        securityRisk: false,
        availabilityImpact: 80
      }
    });

    this.addSignature({
      id: 'api-504-timeout',
      category: 'api_failure',
      pattern: /504|Gateway timeout|Request timeout/i,
      severity: 'high',
      description: 'API request timed out',
      commonCauses: [
        'Slow database query',
        'Network latency',
        'Resource contention',
        'Infinite loop in handler'
      ],
      healingStrategies: ['circuit_breaker', 'retry_with_backoff', 'dependency_isolation'],
      estimatedImpact: {
        usersFacing: true,
        dataIntegrity: false,
        securityRisk: false,
        availabilityImpact: 70
      }
    });

    // Database Issues
    this.addSignature({
      id: 'db-connection-lost',
      category: 'database_inconsistency',
      pattern: /Connection lost|ECONNREFUSED|Connection terminated/i,
      severity: 'critical',
      description: 'Database connection lost',
      commonCauses: [
        'Network partition',
        'Database server down',
        'Connection pool exhausted',
        'Firewall blocking connection'
      ],
      healingStrategies: ['retry_with_backoff', 'circuit_breaker', 'fallback_to_cache'],
      estimatedImpact: {
        usersFacing: true,
        dataIntegrity: true,
        securityRisk: false,
        availabilityImpact: 100
      }
    });

    this.addSignature({
      id: 'db-constraint-violation',
      category: 'database_inconsistency',
      pattern: /unique constraint|foreign key constraint|check constraint/i,
      severity: 'high',
      description: 'Database constraint violation',
      commonCauses: [
        'Duplicate key insertion',
        'Referential integrity violation',
        'Data validation failure'
      ],
      healingStrategies: ['data_reconciliation', 'state_rollback', 'graceful_degradation'],
      estimatedImpact: {
        usersFacing: true,
        dataIntegrity: true,
        securityRisk: false,
        availabilityImpact: 50
      }
    });

    this.addSignature({
      id: 'db-deadlock',
      category: 'deadlock',
      pattern: /deadlock detected|lock timeout/i,
      severity: 'high',
      description: 'Database deadlock detected',
      commonCauses: [
        'Concurrent transactions',
        'Lock escalation',
        'Poor query design'
      ],
      healingStrategies: ['retry_with_backoff', 'dependency_isolation', 'state_rollback'],
      estimatedImpact: {
        usersFacing: true,
        dataIntegrity: true,
        securityRisk: false,
        availabilityImpact: 60
      }
    });

    // Security Vulnerabilities
    this.addSignature({
      id: 'security-xss-attempt',
      category: 'security_vulnerability',
      pattern: /<script|javascript:|onerror=|onclick=/i,
      severity: 'critical',
      description: 'Potential XSS attack detected',
      commonCauses: [
        'Unescaped user input',
        'Missing input sanitization',
        'Malicious payload injection'
      ],
      healingStrategies: ['security_lockdown', 'auto_patch', 'data_reconciliation'],
      estimatedImpact: {
        usersFacing: false,
        dataIntegrity: true,
        securityRisk: true,
        availabilityImpact: 30
      }
    });

    this.addSignature({
      id: 'security-sql-injection',
      category: 'security_vulnerability',
      pattern: /'; DROP TABLE|1=1|UNION SELECT/i,
      severity: 'critical',
      description: 'SQL injection attempt detected',
      commonCauses: [
        'Unsanitized query parameters',
        'String concatenation in queries',
        'Missing prepared statements'
      ],
      healingStrategies: ['security_lockdown', 'auto_patch', 'emergency_shutdown'],
      estimatedImpact: {
        usersFacing: false,
        dataIntegrity: true,
        securityRisk: true,
        availabilityImpact: 100
      }
    });

    this.addSignature({
      id: 'security-phi-exposure',
      category: 'phi_exposure_risk',
      pattern: /PHI|SSN|medical record number|diagnosis|medication/i,
      severity: 'critical',
      description: 'Potential PHI exposure in logs or errors',
      commonCauses: [
        'Logging sensitive data',
        'Error messages containing PHI',
        'Insufficient data masking'
      ],
      healingStrategies: ['security_lockdown', 'resource_cleanup', 'auto_patch'],
      estimatedImpact: {
        usersFacing: false,
        dataIntegrity: true,
        securityRisk: true,
        availabilityImpact: 50
      }
    });

    this.addSignature({
      id: 'security-hipaa-audit-missing',
      category: 'hipaa_violation',
      pattern: /audit log failed|audit trail missing/i,
      severity: 'critical',
      description: 'HIPAA audit trail compromised',
      commonCauses: [
        'Audit function not called',
        'Database audit table unavailable',
        'Permission issues on audit writes'
      ],
      healingStrategies: ['security_lockdown', 'data_reconciliation', 'emergency_shutdown'],
      estimatedImpact: {
        usersFacing: false,
        dataIntegrity: true,
        securityRisk: true,
        availabilityImpact: 90
      }
    });

    // State Management Issues
    this.addSignature({
      id: 'state-corruption',
      category: 'state_corruption',
      pattern: /Invalid state|State mismatch|Corrupted state/i,
      severity: 'high',
      description: 'Application state corrupted',
      commonCauses: [
        'Race condition in state updates',
        'Direct state mutation',
        'Async state update conflicts'
      ],
      healingStrategies: ['state_rollback', 'session_recovery', 'graceful_degradation'],
      estimatedImpact: {
        usersFacing: true,
        dataIntegrity: true,
        securityRisk: false,
        availabilityImpact: 70
      }
    });

    this.addSignature({
      id: 'state-race-condition',
      category: 'race_condition',
      pattern: /race condition|concurrent modification/i,
      severity: 'high',
      description: 'Race condition in state updates',
      commonCauses: [
        'Multiple async updates',
        'Missing locking mechanism',
        'Optimistic concurrency failure'
      ],
      healingStrategies: ['state_rollback', 'retry_with_backoff', 'dependency_isolation'],
      estimatedImpact: {
        usersFacing: true,
        dataIntegrity: true,
        securityRisk: false,
        availabilityImpact: 60
      }
    });

    // Memory and Performance Issues
    this.addSignature({
      id: 'memory-leak',
      category: 'memory_leak',
      pattern: /out of memory|heap limit|memory exhausted/i,
      severity: 'critical',
      description: 'Memory leak detected',
      commonCauses: [
        'Event listeners not cleaned up',
        'Circular references',
        'Large objects in closure',
        'Unsubscribed observables'
      ],
      healingStrategies: ['resource_cleanup', 'emergency_shutdown', 'circuit_breaker'],
      estimatedImpact: {
        usersFacing: true,
        dataIntegrity: false,
        securityRisk: false,
        availabilityImpact: 90
      }
    });

    this.addSignature({
      id: 'performance-degradation',
      category: 'performance_degradation',
      pattern: /slow query|performance degraded|high cpu/i,
      severity: 'medium',
      description: 'System performance degraded',
      commonCauses: [
        'Inefficient query',
        'Missing database index',
        'Resource contention',
        'N+1 query problem'
      ],
      healingStrategies: ['circuit_breaker', 'fallback_to_cache', 'dependency_isolation'],
      estimatedImpact: {
        usersFacing: true,
        dataIntegrity: false,
        securityRisk: false,
        availabilityImpact: 50
      }
    });

    this.addSignature({
      id: 'infinite-loop',
      category: 'infinite_loop',
      pattern: /Maximum call stack|Infinite loop|Too much recursion/i,
      severity: 'critical',
      description: 'Infinite loop or recursion detected',
      commonCauses: [
        'Recursive function without base case',
        'Circular dependency',
        'useEffect dependency loop'
      ],
      healingStrategies: ['emergency_shutdown', 'circuit_breaker', 'auto_patch'],
      estimatedImpact: {
        usersFacing: true,
        dataIntegrity: false,
        securityRisk: false,
        availabilityImpact: 100
      }
    });

    // Network Issues
    this.addSignature({
      id: 'network-partition',
      category: 'network_partition',
      pattern: /network error|ETIMEDOUT|ECONNRESET/i,
      severity: 'high',
      description: 'Network connectivity issue',
      commonCauses: [
        'Network partition',
        'DNS resolution failure',
        'Firewall blocking',
        'Service unavailable'
      ],
      healingStrategies: ['retry_with_backoff', 'circuit_breaker', 'fallback_to_cache'],
      estimatedImpact: {
        usersFacing: true,
        dataIntegrity: false,
        securityRisk: false,
        availabilityImpact: 80
      }
    });

    // Configuration Errors
    this.addSignature({
      id: 'config-missing-env',
      category: 'configuration_error',
      pattern: /environment variable not set|missing configuration|SUPABASE_URL|SUPABASE_ANON_KEY/i,
      severity: 'critical',
      description: 'Missing environment configuration',
      commonCauses: [
        'Environment variables not set',
        'Configuration file missing',
        'Build-time vs runtime config mismatch'
      ],
      healingStrategies: ['configuration_reset', 'graceful_degradation', 'emergency_shutdown'],
      estimatedImpact: {
        usersFacing: true,
        dataIntegrity: false,
        securityRisk: true,
        availabilityImpact: 100
      }
    });

    // Cascade Failures
    this.addSignature({
      id: 'cascade-failure',
      category: 'cascade_failure',
      pattern: /multiple services failing|cascading failure/i,
      severity: 'critical',
      description: 'Multiple dependent services failing',
      commonCauses: [
        'Single point of failure',
        'No circuit breaker',
        'Lack of fallback mechanisms'
      ],
      healingStrategies: ['circuit_breaker', 'dependency_isolation', 'graceful_degradation'],
      estimatedImpact: {
        usersFacing: true,
        dataIntegrity: true,
        securityRisk: false,
        availabilityImpact: 100
      }
    });

    // React-specific Issues
    this.addSignature({
      id: 'react-hydration-mismatch',
      category: 'state_corruption',
      pattern: /Hydration failed|Text content does not match/i,
      severity: 'medium',
      description: 'React hydration mismatch',
      commonCauses: [
        'Server/client rendering difference',
        'Date/time format inconsistency',
        'Conditional rendering issue'
      ],
      healingStrategies: ['state_rollback', 'graceful_degradation', 'auto_patch'],
      estimatedImpact: {
        usersFacing: true,
        dataIntegrity: false,
        securityRisk: false,
        availabilityImpact: 30
      }
    });

    this.addSignature({
      id: 'react-hook-rules-violation',
      category: 'type_mismatch',
      pattern: /Rendered (more|fewer) hooks|Invalid hook call/i,
      severity: 'high',
      description: 'React hooks rules violated',
      commonCauses: [
        'Hooks called conditionally',
        'Hooks in loops',
        'Hooks in nested functions'
      ],
      healingStrategies: ['auto_patch', 'graceful_degradation', 'state_rollback'],
      estimatedImpact: {
        usersFacing: true,
        dataIntegrity: false,
        securityRisk: false,
        availabilityImpact: 60
      }
    });
  }

  private addSignature(signature: ErrorSignature): void {
    this.signatures.set(signature.id, signature);
  }

  getSignature(id: string): ErrorSignature | null {
    return this.signatures.get(id) || null;
  }

  getAllSignatures(): ErrorSignature[] {
    return Array.from(this.signatures.values());
  }

  getSignaturesByCategory(category: ErrorCategory): ErrorSignature[] {
    return Array.from(this.signatures.values()).filter(s => s.category === category);
  }

  getSignaturesBySeverity(severity: SeverityLevel): ErrorSignature[] {
    return Array.from(this.signatures.values()).filter(s => s.severity === severity);
  }
}
