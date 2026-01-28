/**
 * Agent Orchestrator Edge Function
 *
 * Single entry point for all agent requests. Classifies and routes
 * to the appropriate specialized agent.
 *
 * Actions:
 * - Automatic routing based on action patterns and payload keywords
 * - Hint-based routing for explicit agent selection
 * - Timeout handling and retry logic
 *
 * Copyright (c) 2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const logger = createLogger("agent-orchestrator");

// =============================================================================
// ENVIRONMENT HELPERS
// =============================================================================

const getEnv = (...keys: string[]): string => {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
};

// =============================================================================
// TYPES
// =============================================================================

type AgentType =
  | 'guardian'
  | 'bed-management'
  | 'bed-optimizer'
  | 'bed-capacity-monitor'
  | 'mcp-fhir'
  | 'mcp-billing'
  | 'mcp-clearinghouse'
  | 'mcp-medical-codes'
  | 'mcp-npi'
  | 'health-monitor'
  | 'unknown';

interface AgentRequest {
  request_id?: string;
  action: string;
  payload?: Record<string, unknown>;
  hints?: {
    preferred_agent?: AgentType;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    timeout_ms?: number;
  };
}

interface RoutingDecision {
  agent: AgentType;
  endpoint: string;
  confidence: number;
  reason: string;
}

interface RoutingConfig {
  patterns: RegExp[];
  keywords: string[];
  agent: AgentType;
  endpoint: string;
}

// =============================================================================
// ROUTING CONFIGURATION
// =============================================================================

const ROUTING_CONFIG: RoutingConfig[] = [
  // Security & Compliance -> Guardian Agent
  {
    patterns: [/^monitor$/, /^security/, /^audit/, /^heal$/, /^record$/, /^analyze$/],
    keywords: ['security', 'alert', 'phi', 'hipaa', 'compliance', 'vulnerability', 'guardian'],
    agent: 'guardian',
    endpoint: 'guardian-agent'
  },
  // Health Monitoring -> Health Monitor
  {
    patterns: [/^check_all$/, /^check_one$/, /^get_status$/, /^recover$/, /^health_check/],
    keywords: ['health', 'monitor', 'agent_status', 'watchdog', 'heartbeat'],
    agent: 'health-monitor',
    endpoint: 'health-monitor'
  },
  // Bed Operations (CRUD) -> Bed Management
  {
    patterns: [/^get_bed/, /^assign/, /^discharge$/, /^update_status$/, /^find_available$/, /^get_census$/, /^get_unit/],
    keywords: ['bed', 'room', 'unit', 'census', 'admission', 'discharge', 'assign', 'bed_board'],
    agent: 'bed-management',
    endpoint: 'bed-management'
  },
  // Bed Analytics & Prediction -> Bed Optimizer
  {
    patterns: [/^forecast/, /^predict/, /^optimize/, /^capacity_plan/, /^surge/, /^recommend_placement/, /^predict_los$/],
    keywords: ['forecast', 'prediction', 'optimization', 'capacity', 'los', 'throughput', 'placement', 'surge'],
    agent: 'bed-optimizer',
    endpoint: 'bed-optimizer'
  },
  // Capacity Monitoring -> Bed Capacity Monitor
  {
    patterns: [/^capacity_monitor/, /^check_capacity/, /^divert/],
    keywords: ['capacity_alert', 'divert', 'occupancy_threshold'],
    agent: 'bed-capacity-monitor',
    endpoint: 'bed-capacity-monitor'
  },
  // Clinical Data -> MCP FHIR
  {
    patterns: [/^fhir/, /^patient_data/, /^condition/, /^observation/, /^encounter/, /^medication/],
    keywords: ['fhir', 'patient', 'condition', 'medication', 'observation', 'encounter', 'allergy', 'procedure'],
    agent: 'mcp-fhir',
    endpoint: 'mcp-fhir-server'
  },
  // Billing -> MCP Clearinghouse
  {
    patterns: [/^claim/, /^billing/, /^837/, /^835/, /^prior_auth/, /^eligibility/],
    keywords: ['claim', 'billing', 'reimbursement', 'denial', 'remittance', 'era', 'eligibility'],
    agent: 'mcp-clearinghouse',
    endpoint: 'mcp-clearinghouse-server'
  },
  // Medical Codes -> MCP Medical Codes
  {
    patterns: [/^lookup_code/, /^search_icd/, /^search_cpt/, /^code_/, /^validate_code/],
    keywords: ['icd10', 'cpt', 'hcpcs', 'snomed', 'loinc', 'rxnorm', 'drg', 'diagnosis_code'],
    agent: 'mcp-medical-codes',
    endpoint: 'mcp-medical-codes-server'
  },
  // NPI Lookup -> MCP NPI
  {
    patterns: [/^npi/, /^provider_lookup/, /^validate_npi/],
    keywords: ['npi', 'provider', 'taxonomy', 'practitioner'],
    agent: 'mcp-npi',
    endpoint: 'mcp-npi-server'
  }
];

// =============================================================================
// ROUTING LOGIC
// =============================================================================

function classifyRequest(request: AgentRequest): RoutingDecision {
  const action = (request.action || '').toLowerCase();
  const payloadStr = JSON.stringify(request.payload || {}).toLowerCase();

  // Check if hint provided
  if (request.hints?.preferred_agent && request.hints.preferred_agent !== 'unknown') {
    const config = ROUTING_CONFIG.find(c => c.agent === request.hints?.preferred_agent);
    if (config) {
      return {
        agent: config.agent,
        endpoint: config.endpoint,
        confidence: 1.0,
        reason: 'Explicit hint provided'
      };
    }
  }

  // Score each route
  let bestMatch: RoutingDecision = {
    agent: 'unknown',
    endpoint: '',
    confidence: 0,
    reason: 'No matching route found'
  };

  for (const config of ROUTING_CONFIG) {
    let score = 0;
    const reasons: string[] = [];

    // Check action patterns (higher weight)
    for (const pattern of config.patterns) {
      if (pattern.test(action)) {
        score += 0.6;
        reasons.push(`Action matches ${pattern}`);
        break; // Only count once per config
      }
    }

    // Check keywords in payload
    for (const keyword of config.keywords) {
      if (payloadStr.includes(keyword)) {
        score += 0.15;
        reasons.push(`Keyword: ${keyword}`);
      }
    }

    // Check keywords in action
    for (const keyword of config.keywords) {
      if (action.includes(keyword)) {
        score += 0.2;
        reasons.push(`Action contains: ${keyword}`);
        break; // Only count once per config
      }
    }

    if (score > bestMatch.confidence) {
      bestMatch = {
        agent: config.agent,
        endpoint: config.endpoint,
        confidence: Math.min(score, 1.0),
        reason: reasons.slice(0, 3).join('; ')
      };
    }
  }

  return bestMatch;
}

async function routeToAgent(
  supabaseUrl: string,
  serviceKey: string,
  authHeader: string,
  decision: RoutingDecision,
  request: AgentRequest
): Promise<Response> {
  const timeout = request.hints?.timeout_ms || 30000;
  const endpoint = `${supabaseUrl}/functions/v1/${decision.endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'apikey': serviceKey,
        'x-request-id': request.request_id || crypto.randomUUID(),
        'x-routed-by': 'agent-orchestrator',
        'x-routing-confidence': String(decision.confidence)
      },
      body: JSON.stringify({
        action: request.action,
        ...(request.payload || {})
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders, allowed } = corsFromRequest(req);
  const startTime = Date.now();

  // Reject unauthorized origins
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: "Origin not allowed" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Environment variables
  const SUPABASE_URL = getEnv("SUPABASE_URL");
  const SERVICE_KEY = getEnv("SB_SECRET_KEY", "SB_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SERVICE_KEY) {
    logger.error("Missing environment variables", {});
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get auth header (use provided or service key)
  const authHeader = req.headers.get('Authorization') || `Bearer ${SERVICE_KEY}`;

  try {
    const body: AgentRequest = await req.json();

    if (!body.action) {
      return new Response(
        JSON.stringify({ error: "Missing required field: action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate request ID if not provided
    const request_id = body.request_id || crypto.randomUUID();
    body.request_id = request_id;

    // Classify and route
    const decision = classifyRequest(body);

    logger.info("Request classified", {
      request_id,
      action: body.action,
      agent: decision.agent,
      confidence: decision.confidence,
      reason: decision.reason
    });

    // Check if we can route
    if (decision.agent === 'unknown' || decision.confidence < 0.3) {
      return new Response(
        JSON.stringify({
          error: "Unable to route request",
          request_id,
          classification: {
            agent: decision.agent,
            confidence: decision.confidence,
            reason: decision.reason
          },
          hint: "Provide hints.preferred_agent or use a more specific action name",
          available_agents: ROUTING_CONFIG.map(c => c.agent)
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Route to agent
    const agentResponse = await routeToAgent(
      SUPABASE_URL,
      SERVICE_KEY,
      authHeader,
      decision,
      body
    );

    const agentData = await agentResponse.json().catch(() => ({}));
    const processingTime = Date.now() - startTime;

    // Log completion
    logger.info("Request completed", {
      request_id,
      agent: decision.agent,
      status: agentResponse.status,
      processing_time_ms: processingTime
    });

    // Return wrapped response
    return new Response(
      JSON.stringify({
        request_id,
        agent: decision.agent,
        success: agentResponse.ok,
        data: agentData,
        metadata: {
          processing_time_ms: processingTime,
          routing_confidence: decision.confidence,
          routed_to: decision.endpoint
        }
      }),
      {
        status: agentResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const isTimeout = errorMessage.includes('abort') || errorMessage.includes('timeout');
    const processingTime = Date.now() - startTime;

    logger.error("Orchestrator error", {
      error: errorMessage,
      is_timeout: isTimeout,
      processing_time_ms: processingTime
    });

    return new Response(
      JSON.stringify({
        error: isTimeout ? "Request timeout" : "Internal error",
        retryable: isTimeout,
        processing_time_ms: processingTime
      }),
      {
        status: isTimeout ? 504 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
