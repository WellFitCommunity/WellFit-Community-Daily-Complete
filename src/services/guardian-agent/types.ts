/**
 * WellFit Guardian Agent - Self-Healing System Types
 * An autonomous agent that monitors, detects, and fixes issues in healthcare software
 */

export type ErrorCategory =
  | 'type_mismatch'
  | 'null_reference'
  | 'api_failure'
  | 'state_corruption'
  | 'security_vulnerability'
  | 'performance_degradation'
  | 'memory_leak'
  | 'database_inconsistency'
  | 'authentication_failure'
  | 'authorization_breach'
  | 'phi_exposure_risk'
  | 'infinite_loop'
  | 'race_condition'
  | 'deadlock'
  | 'cascade_failure'
  | 'dependency_failure'
  | 'configuration_error'
  | 'network_partition'
  | 'data_corruption'
  | 'hipaa_violation';

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type HealingStrategy =
  | 'retry_with_backoff'
  | 'circuit_breaker'
  | 'fallback_to_cache'
  | 'graceful_degradation'
  | 'state_rollback'
  | 'auto_patch'
  | 'dependency_isolation'
  | 'resource_cleanup'
  | 'configuration_reset'
  | 'session_recovery'
  | 'data_reconciliation'
  | 'security_lockdown'
  | 'emergency_shutdown';

export interface ErrorSignature {
  id: string;
  category: ErrorCategory;
  pattern: RegExp | string;
  stackTracePattern?: RegExp;
  severity: SeverityLevel;
  description: string;
  commonCauses: string[];
  healingStrategies: HealingStrategy[];
  estimatedImpact: {
    usersFacing?: boolean;
    dataIntegrity?: boolean;
    securityRisk?: boolean;
    availabilityImpact?: number; // 0-100
  };
}

export interface DetectedIssue {
  id: string;
  timestamp: Date;
  signature: ErrorSignature;
  context: ErrorContext;
  severity: SeverityLevel;
  affectedResources: string[];
  stackTrace?: string;
  metadata: Record<string, unknown>;
}

export interface ErrorContext {
  component?: string;
  filePath?: string;
  lineNumber?: number;
  userId?: string;
  sessionId?: string;
  apiEndpoint?: string;
  databaseQuery?: string;
  environmentState: Record<string, unknown>;
  recentActions: string[];
}

export interface HealingAction {
  id: string;
  issueId: string;
  strategy: HealingStrategy;
  timestamp: Date;
  description: string;
  steps: HealingStep[];
  expectedOutcome: string;
  rollbackPlan?: HealingStep[];
  requiresApproval: boolean;
}

export interface HealingStep {
  id: string;
  order: number;
  action: string;
  target: string;
  parameters: Record<string, unknown>;
  validation: ValidationRule;
  timeout: number;
}

export interface ValidationRule {
  type: 'assertion' | 'metric' | 'state_check';
  condition: string;
  expectedValue?: unknown;
  threshold?: number;
}

export interface HealingResult {
  actionId: string;
  success: boolean;
  timestamp: Date;
  stepsCompleted: number;
  totalSteps: number;
  outcomeDescription: string;
  metrics: {
    timeToDetect: number;
    timeToHeal: number;
    resourcesAffected: number;
    usersImpacted: number;
  };
  lessons: string[];
  preventiveMeasures?: string[];
}

export interface AgentState {
  isActive: boolean;
  mode: 'monitor' | 'diagnostic' | 'healing' | 'learning' | 'standby';
  activeIssues: DetectedIssue[];
  healingInProgress: HealingAction[];
  recentHealings: HealingResult[];
  knowledgeBase: KnowledgeEntry[];
  performanceMetrics: PerformanceMetrics;
}

export interface KnowledgeEntry {
  id: string;
  pattern: string;
  solution: string;
  successRate: number;
  timesEncountered: number;
  lastSeen: Date;
  effectiveness: number; // 0-100
  adaptations: string[];
}

export interface PerformanceMetrics {
  uptime: number;
  issuesDetected: number;
  issuesHealed: number;
  successRate: number;
  avgTimeToDetect: number;
  avgTimeToHeal: number;
  falsePositives: number;
  adaptationsApplied: number;
}

export interface AgentConfig {
  autoHealEnabled: boolean;
  requireApprovalForCritical: boolean;
  maxConcurrentHealings: number;
  learningEnabled: boolean;
  monitoringIntervalMs: number;
  securityScanIntervalMs: number;
  memoryCheckIntervalMs: number;
  hipaaComplianceMode: boolean;
  notificationChannels: NotificationChannel[];
}

export interface NotificationChannel {
  type: 'email' | 'slack' | 'sms' | 'pagerduty' | 'dashboard';
  severity: SeverityLevel[];
  config: Record<string, unknown>;
}
