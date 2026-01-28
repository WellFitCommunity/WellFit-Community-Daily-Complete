/**
 * Agent Orchestrator Types
 *
 * TypeScript interfaces for the agent framework orchestration system.
 * Defines routing, classification, and health monitoring types.
 *
 * Copyright © 2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

// =============================================================================
// AGENT TYPES
// =============================================================================

/**
 * Available agent types in the framework
 */
export type AgentType =
  | 'guardian'
  | 'bed-management'
  | 'bed-optimizer'
  | 'mcp-fhir'
  | 'mcp-billing'
  | 'mcp-clearinghouse'
  | 'mcp-medical-codes'
  | 'mcp-npi'
  | 'mcp-hl7-x12'
  | 'unknown';

/**
 * Categories of requests for classification
 */
export type RequestCategory =
  | 'security'
  | 'compliance'
  | 'bed-operations'
  | 'bed-analytics'
  | 'clinical-data'
  | 'billing'
  | 'interoperability'
  | 'system-health';

/**
 * Priority levels for request processing
 */
export type RequestPriority = 'low' | 'normal' | 'high' | 'critical';

// =============================================================================
// REQUEST/RESPONSE TYPES
// =============================================================================

/**
 * Incoming request to the agent orchestrator
 */
export interface AgentRequest {
  /** Unique request ID for tracing */
  request_id?: string;
  /** ISO timestamp */
  timestamp?: string;
  /** Tenant context */
  tenant_id?: string;
  /** User making request (if authenticated) */
  user_id?: string;
  /** The action being requested */
  action: string;
  /** Request payload */
  payload: Record<string, unknown>;
  /** Optional hints for routing */
  hints?: {
    preferred_agent?: AgentType;
    priority?: RequestPriority;
    timeout_ms?: number;
  };
}

/**
 * Response from the agent orchestrator
 */
export interface AgentResponse<T = unknown> {
  /** Request ID for correlation */
  request_id: string;
  /** Agent that handled the request */
  agent: AgentType;
  /** Whether the request succeeded */
  success: boolean;
  /** Response data from the agent */
  data?: T;
  /** Error details if failed */
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  /** Processing metadata */
  metadata: {
    processing_time_ms: number;
    routing_confidence: number;
    routed_to: string;
    routed_at?: string;
    completed_at?: string;
  };
}

/**
 * Routing decision made by the orchestrator
 */
export interface RoutingDecision {
  /** Target agent */
  agent: AgentType;
  /** Edge function endpoint */
  endpoint: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Explanation of why this agent was chosen */
  reason: string;
}

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

/**
 * Routing rule for classifying requests
 */
export interface RoutingRule {
  /** Pattern to match against action */
  action_pattern: RegExp;
  /** Keywords in payload that indicate this agent */
  payload_keywords?: string[];
  /** Target agent */
  agent: AgentType;
  /** Priority (higher = checked first) */
  priority: number;
}

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  /** Default timeout for agent calls */
  default_timeout_ms: number;
  /** Max retries for failed requests */
  max_retries: number;
  /** Enable request logging */
  log_requests: boolean;
  /** Minimum confidence to route (0-1) */
  min_routing_confidence: number;
  /** Routing rules */
  routing_rules: RoutingRule[];
}

// =============================================================================
// HEALTH MONITORING TYPES
// =============================================================================

/**
 * Agent health status
 */
export type AgentHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unreachable';

/**
 * Agent registry entry
 */
export interface AgentRegistryEntry {
  id: string;
  agent_name: string;
  agent_type: 'system' | 'domain' | 'business' | 'mcp';
  endpoint: string;
  is_critical: boolean;
  health_check_interval_seconds: number;
  max_consecutive_failures: number;
  created_at: string;
  updated_at: string;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  agent_id: string;
  agent_name?: string;
  status: AgentHealthStatus;
  response_time_ms: number;
  error_message?: string;
  metadata?: Record<string, unknown>;
  checked_at?: string;
}

/**
 * Agent incident (failure requiring attention)
 */
export interface AgentIncident {
  id: string;
  agent_id: string;
  incident_type: 'failure' | 'timeout' | 'degraded' | 'recovered';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metadata?: Record<string, unknown>;
  resolved_at?: string | null;
  created_at: string;
}

/**
 * Health summary for an agent
 */
export interface AgentHealthSummary {
  agent_name: string;
  agent_type: string;
  is_critical: boolean;
  current_status: AgentHealthStatus | 'unknown';
  last_check: string | null;
  avg_response_time_ms: number;
  failure_count_24h: number;
  has_open_incident: boolean;
}

/**
 * Health monitor actions
 */
export type HealthMonitorAction = 'check_all' | 'check_one' | 'get_status' | 'recover';

/**
 * Health monitor request
 */
export interface HealthMonitorRequest {
  action: HealthMonitorAction;
  agent_name?: string;
}

/**
 * Health check summary response
 */
export interface HealthCheckSummary {
  healthy: number;
  degraded: number;
  unhealthy: number;
  total: number;
}

// =============================================================================
// BED OPTIMIZER TYPES
// =============================================================================

/**
 * Length of Stay prediction
 */
export interface LOSPrediction {
  predicted_los_hours: number;
  confidence_interval: {
    lower: number;
    upper: number;
  };
  based_on_samples: number;
  diagnosis_category: string;
}

/**
 * Capacity forecast for a specific hour
 */
export interface CapacityForecast {
  hour: number;
  date: string;
  predicted_census: number;
  predicted_available: number;
  confidence: {
    lower: number;
    upper: number;
  };
  risk_level: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Surge status for a facility
 */
export interface SurgeStatus {
  is_surge: boolean;
  level: 'normal' | 'warning' | 'critical' | 'diversion';
  current_occupancy_pct: number;
  threshold_pct: number;
  affected_units: string[];
  recommended_actions: string[];
}

/**
 * Placement recommendation factors
 */
export interface PlacementFactors {
  availability: number;
  requirements_match: number;
  unit_load_balance: number;
  predicted_turnover: number;
}

/**
 * Bed placement recommendation
 */
export interface PlacementRecommendation {
  bed_id: string;
  unit_id: string;
  unit_name: string;
  room_number: string;
  score: number;
  factors: PlacementFactors;
}

/**
 * Bed optimizer request
 */
export interface BedOptimizerRequest {
  action:
    | 'predict_los'
    | 'forecast_capacity'
    | 'check_surge'
    | 'recommend_placement'
    | 'optimize_throughput'
    | 'health';
  tenant_id?: string;
  unit_id?: string;
  facility_id?: string;
  patient_id?: string;
  diagnosis_category?: string;
  forecast_hours?: number;
  requirements?: BedRequirements;
}

/**
 * Bed requirements for placement
 */
export interface BedRequirements {
  bed_type?: string;
  requires_telemetry?: boolean;
  requires_isolation?: boolean;
  requires_negative_pressure?: boolean;
  preferred_unit?: string;
}
