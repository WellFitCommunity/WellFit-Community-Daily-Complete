/**
 * Guardian Approval Types
 *
 * Type definitions for the Guardian Agent pool report / approval system.
 * These types mirror the database schema and provide type safety for
 * the review workflow.
 */

import { HealingStrategy, SeverityLevel, ErrorCategory } from '../services/guardian-agent/types';

// ============================================================================
// Review Ticket Types
// ============================================================================

export type TicketStatus =
  | 'pending'      // Awaiting review
  | 'in_review'    // Someone opened the review form
  | 'approved'     // Approved, ready to apply
  | 'rejected'     // Rejected, will not apply
  | 'applied'      // Fix was applied successfully
  | 'failed'       // Fix application failed
  | 'rolled_back'; // Fix was applied but rolled back

export interface HealingStepData {
  id: string;
  order: number;
  action: string;
  target: string;
  parameters: Record<string, unknown>;
  validation?: {
    type: string;
    condition: string;
    expectedValue?: unknown;
    threshold?: number;
  };
  timeout?: number;
}

export interface SandboxTestResults {
  passed: boolean;
  tests_run: number;
  tests_passed: number;
  tests_failed: number;
  execution_time_ms: number;
  error_message?: string;
  test_details?: Array<{
    name: string;
    passed: boolean;
    duration_ms: number;
    error?: string;
  }>;
}

export interface DetectionContext {
  component?: string;
  filePath?: string;
  lineNumber?: number;
  userId?: string;
  sessionId?: string;
  apiEndpoint?: string;
  databaseQuery?: string;
  environmentState?: Record<string, unknown>;
  recentActions?: string[];
}

export interface ApplicationResult {
  success: boolean;
  steps_completed: number;
  total_steps: number;
  execution_time_ms: number;
  changes_applied?: string[];
  error?: string;
}

// ============================================================================
// Main Review Ticket Interface
// ============================================================================

export interface GuardianReviewTicket {
  id: string;
  security_alert_id: string | null;

  // Issue details
  issue_id: string;
  issue_category: string;
  issue_severity: SeverityLevel;
  issue_description: string | null;
  affected_component: string | null;
  affected_resources: string[] | null;
  stack_trace: string | null;
  detection_context: DetectionContext;

  // Proposed fix
  action_id: string;
  healing_strategy: HealingStrategy;
  healing_description: string;
  healing_steps: HealingStepData[];
  rollback_plan: HealingStepData[];
  expected_outcome: string | null;

  // Sandbox testing
  sandbox_tested: boolean;
  sandbox_test_results: SandboxTestResults;
  sandbox_passed: boolean | null;

  // Status
  status: TicketStatus;

  // Review form data
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_name: string | null;
  code_reviewed: boolean;
  impact_understood: boolean;
  rollback_understood: boolean;
  review_notes: string | null;
  review_metadata: Record<string, unknown>;

  // Application tracking
  applied_at: string | null;
  applied_by: string | null;
  application_result: ApplicationResult;
  application_error: string | null;

  // Rollback tracking
  rolled_back_at: string | null;
  rolled_back_by: string | null;
  rollback_reason: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Form Types
// ============================================================================

export interface ReviewChecklist {
  code_reviewed: boolean;
  impact_understood: boolean;
  rollback_understood: boolean;
}

export interface ApprovalFormData extends ReviewChecklist {
  review_notes: string;
}

export interface RejectionFormData {
  review_notes: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApprovalResult {
  success: boolean;
  ticket_id?: string;
  status?: TicketStatus;
  message?: string;
  error?: string;
}

export interface CreateTicketParams {
  issue_id: string;
  issue_category: ErrorCategory;
  issue_severity: SeverityLevel;
  issue_description?: string;
  affected_component?: string;
  affected_resources?: string[];
  stack_trace?: string;
  detection_context?: DetectionContext;
  action_id: string;
  healing_strategy: HealingStrategy;
  healing_description: string;
  healing_steps: HealingStepData[];
  rollback_plan?: HealingStepData[];
  expected_outcome?: string;
  sandbox_tested?: boolean;
  sandbox_results?: SandboxTestResults;
  sandbox_passed?: boolean;
}

// ============================================================================
// List View Types (for dashboard)
// ============================================================================

export interface TicketListItem {
  id: string;
  issue_id: string;
  issue_category: string;
  issue_severity: SeverityLevel;
  issue_description: string | null;
  affected_component: string | null;
  healing_strategy: HealingStrategy;
  healing_description: string;
  sandbox_passed: boolean | null;
  status: TicketStatus;
  created_at: string;
  security_alert_id: string | null;
}

export interface TicketStats {
  pending_count: number;
  in_review_count: number;
  approved_today: number;
  rejected_today: number;
  applied_today: number;
  failed_today: number;
}

// ============================================================================
// Filter Types
// ============================================================================

export interface TicketFilters {
  status?: TicketStatus[];
  severity?: SeverityLevel[];
  strategy?: HealingStrategy[];
  date_range?: {
    start: string;
    end: string;
  };
  search?: string;
}

// ============================================================================
// Status Configuration
// ============================================================================

export const TICKET_STATUS_CONFIG: Record<TicketStatus, {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
  description: string;
}> = {
  pending: {
    label: 'Pending Review',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    icon: '⏳',
    description: 'Awaiting human review',
  },
  in_review: {
    label: 'In Review',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    icon: '👀',
    description: 'Currently being reviewed',
  },
  approved: {
    label: 'Approved',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    icon: '✅',
    description: 'Approved, ready to apply',
  },
  rejected: {
    label: 'Rejected',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    icon: '❌',
    description: 'Rejected, will not apply',
  },
  applied: {
    label: 'Applied',
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/20',
    icon: '🚀',
    description: 'Fix successfully applied',
  },
  failed: {
    label: 'Failed',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    icon: '💥',
    description: 'Fix application failed',
  },
  rolled_back: {
    label: 'Rolled Back',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    icon: '↩️',
    description: 'Fix was rolled back',
  },
};

export const HEALING_STRATEGY_CONFIG: Record<HealingStrategy, {
  label: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
}> = {
  retry_with_backoff: {
    label: 'Retry with Backoff',
    description: 'Retry the failed operation with exponential backoff',
    risk: 'low',
  },
  circuit_breaker: {
    label: 'Circuit Breaker',
    description: 'Temporarily disable failing service to prevent cascade',
    risk: 'medium',
  },
  fallback_to_cache: {
    label: 'Fallback to Cache',
    description: 'Use cached data when live data is unavailable',
    risk: 'low',
  },
  graceful_degradation: {
    label: 'Graceful Degradation',
    description: 'Reduce functionality to maintain core services',
    risk: 'low',
  },
  state_rollback: {
    label: 'State Rollback',
    description: 'Revert application state to last known good state',
    risk: 'medium',
  },
  auto_patch: {
    label: 'Auto Patch',
    description: 'Apply automated code fix',
    risk: 'high',
  },
  dependency_isolation: {
    label: 'Dependency Isolation',
    description: 'Isolate failing dependency from healthy services',
    risk: 'medium',
  },
  resource_cleanup: {
    label: 'Resource Cleanup',
    description: 'Clean up leaked resources (memory, connections)',
    risk: 'low',
  },
  configuration_reset: {
    label: 'Configuration Reset',
    description: 'Reset configuration to default values',
    risk: 'medium',
  },
  session_recovery: {
    label: 'Session Recovery',
    description: 'Recover or recreate user sessions',
    risk: 'low',
  },
  data_reconciliation: {
    label: 'Data Reconciliation',
    description: 'Reconcile inconsistent data between systems',
    risk: 'high',
  },
  security_lockdown: {
    label: 'Security Lockdown',
    description: 'Lock down system in response to security threat',
    risk: 'high',
  },
  emergency_shutdown: {
    label: 'Emergency Shutdown',
    description: 'Shut down affected services to prevent damage',
    risk: 'high',
  },
};
