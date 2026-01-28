/**
 * Health Monitor Edge Function
 *
 * Watchdog service that monitors all agents, detects failures,
 * and triggers recovery actions.
 *
 * Actions:
 * - check_all: Run health checks on all agents
 * - check_one: Run health check on specific agent
 * - get_status: Get current health summary
 * - recover: Attempt to recover a failed agent
 * - health: Health check endpoint for this function
 *
 * Copyright (c) 2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const logger = createLogger("health-monitor");

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

interface Agent {
  id: string;
  agent_name: string;
  agent_type: string;
  endpoint: string;
  is_critical: boolean;
  health_check_interval_seconds: number;
  max_consecutive_failures: number;
}

interface HealthCheckResult {
  agent_id: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unreachable';
  response_time_ms: number;
  error_message?: string;
  metadata?: Record<string, unknown>;
}

interface HealthMonitorRequest {
  action: 'check_all' | 'check_one' | 'get_status' | 'recover' | 'health';
  agent_name?: string;
}

// =============================================================================
// HEALTH CHECK LOGIC
// =============================================================================

async function checkAgentHealth(
  supabaseUrl: string,
  serviceKey: string,
  agent: Agent
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const endpoint = `${supabaseUrl}/functions/v1/${agent.endpoint}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'x-health-check': 'true'
      },
      body: JSON.stringify({ action: 'health' }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      return {
        agent_id: agent.id,
        status: response.status >= 500 ? 'unhealthy' : 'degraded',
        response_time_ms: responseTime,
        error_message: `HTTP ${response.status}`,
        metadata: { status_code: response.status }
      };
    }

    // Check response time thresholds
    let status: 'healthy' | 'degraded' = 'healthy';
    if (responseTime > 5000) {
      status = 'degraded';
    }

    return {
      agent_id: agent.id,
      status,
      response_time_ms: responseTime,
      metadata: { status_code: response.status }
    };

  } catch (err: unknown) {
    const responseTime = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);
    const isTimeout = errorMessage.includes('abort') || errorMessage.includes('timeout');

    return {
      agent_id: agent.id,
      status: 'unreachable',
      response_time_ms: responseTime,
      error_message: isTimeout ? 'Timeout after 10s' : errorMessage
    };
  }
}

async function recordHealthCheck(
  supabase: SupabaseClient,
  result: HealthCheckResult
): Promise<void> {
  const { error } = await supabase.from('agent_health_checks').insert({
    agent_id: result.agent_id,
    status: result.status,
    response_time_ms: result.response_time_ms,
    error_message: result.error_message,
    metadata: result.metadata || {}
  });

  if (error) {
    logger.warn("Failed to record health check", { error: error.message });
  }
}

async function checkForIncident(
  supabase: SupabaseClient,
  agent: Agent,
  result: HealthCheckResult
): Promise<void> {
  if (result.status === 'healthy') {
    // Check if there's an open incident to resolve
    const { data: openIncident } = await supabase
      .from('agent_incidents')
      .select('id')
      .eq('agent_id', agent.id)
      .is('resolved_at', null)
      .limit(1)
      .single();

    if (openIncident) {
      // Resolve the open incident
      await supabase
        .from('agent_incidents')
        .update({ resolved_at: new Date().toISOString() })
        .eq('id', openIncident.id);

      // Log recovery incident
      await supabase.from('agent_incidents').insert({
        agent_id: agent.id,
        incident_type: 'recovered',
        severity: 'low',
        message: `Agent ${agent.agent_name} has recovered`,
        metadata: { recovery_response_time_ms: result.response_time_ms }
      });

      logger.info("Agent recovered", { agent: agent.agent_name });
    }
    return;
  }

  // Check consecutive failures
  const { data: recentChecks } = await supabase
    .from('agent_health_checks')
    .select('status')
    .eq('agent_id', agent.id)
    .order('checked_at', { ascending: false })
    .limit(agent.max_consecutive_failures);

  const consecutiveFailures = recentChecks?.filter(
    c => c.status === 'unhealthy' || c.status === 'unreachable'
  ).length || 0;

  if (consecutiveFailures >= agent.max_consecutive_failures) {
    // Check if incident already open
    const { data: existingIncident } = await supabase
      .from('agent_incidents')
      .select('id')
      .eq('agent_id', agent.id)
      .is('resolved_at', null)
      .limit(1)
      .single();

    if (!existingIncident) {
      // Create new incident
      const severity = agent.is_critical ? 'critical' : 'high';

      await supabase.from('agent_incidents').insert({
        agent_id: agent.id,
        incident_type: result.status === 'unreachable' ? 'timeout' : 'failure',
        severity,
        message: `Agent ${agent.agent_name} has failed ${consecutiveFailures} consecutive health checks`,
        metadata: {
          last_error: result.error_message,
          last_response_time_ms: result.response_time_ms
        }
      });

      logger.error("Agent incident created", {
        agent: agent.agent_name,
        severity,
        consecutive_failures: consecutiveFailures
      });

      // Alert via Guardian Agent for critical agents
      if (agent.is_critical) {
        await notifyGuardian(getEnv("SUPABASE_URL"), getEnv("SB_SECRET_KEY", "SB_SERVICE_ROLE_KEY"), agent, result);
      }
    }
  }
}

async function notifyGuardian(
  supabaseUrl: string,
  serviceKey: string,
  agent: Agent,
  result: HealthCheckResult
): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/functions/v1/guardian-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey
      },
      body: JSON.stringify({
        action: 'record',
        data: {
          timestamp: new Date().toISOString(),
          type: 'error',
          component: 'health-monitor',
          action: `Agent ${agent.agent_name} health check failed`,
          severity: agent.is_critical ? 'critical' : 'high',
          metadata: {
            agent_name: agent.agent_name,
            agent_type: agent.agent_type,
            last_error: result.error_message,
            status: result.status
          }
        }
      })
    });
  } catch (err: unknown) {
    // Guardian itself might be down - just log
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Failed to notify Guardian", { agent: agent.agent_name, error: errorMessage });
  }
}

async function attemptRecovery(
  supabaseUrl: string,
  serviceKey: string,
  agent: Agent
): Promise<{ success: boolean; message: string }> {
  logger.info("Attempting recovery", { agent: agent.agent_name });

  // For Edge Functions, "recovery" means making a fresh health check
  // and checking if the agent is responding
  const result = await checkAgentHealth(supabaseUrl, serviceKey, agent);

  if (result.status === 'healthy' || result.status === 'degraded') {
    return {
      success: true,
      message: `Agent ${agent.agent_name} is responding (${result.status})`
    };
  }

  return {
    success: false,
    message: `Agent ${agent.agent_name} recovery failed: ${result.error_message}`
  };
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
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Create Supabase client with service role
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    const body: HealthMonitorRequest = await req.json().catch(() => ({ action: 'get_status' as const }));
    const { action } = body;

    switch (action) {
      case 'health': {
        // Health check for this function itself
        return new Response(
          JSON.stringify({ status: 'healthy', agent: 'health-monitor' }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'check_all': {
        // Get all agents
        const { data: agents, error } = await supabase
          .from('agent_registry')
          .select('*');

        if (error || !agents) {
          logger.error("Failed to fetch agents", { error: error?.message });
          return new Response(
            JSON.stringify({ error: "Failed to fetch agents" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Skip checking ourselves to avoid infinite loop
        const agentsToCheck = agents.filter((a: Agent) => a.agent_name !== 'health-monitor');

        // Check all in parallel
        const results = await Promise.all(
          agentsToCheck.map(async (agent: Agent) => {
            const result = await checkAgentHealth(SUPABASE_URL, SERVICE_KEY, agent);
            await recordHealthCheck(supabase, result);
            await checkForIncident(supabase, agent, result);
            return { agent: agent.agent_name, ...result };
          })
        );

        const healthy = results.filter(r => r.status === 'healthy').length;
        const degraded = results.filter(r => r.status === 'degraded').length;
        const unhealthy = results.filter(r => r.status === 'unhealthy' || r.status === 'unreachable').length;

        logger.info("Health check complete", { healthy, degraded, unhealthy });

        return new Response(
          JSON.stringify({
            success: true,
            summary: { healthy, degraded, unhealthy, total: results.length },
            results
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'check_one': {
        if (!body.agent_name) {
          return new Response(
            JSON.stringify({ error: "agent_name required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: agent, error: agentError } = await supabase
          .from('agent_registry')
          .select('*')
          .eq('agent_name', body.agent_name)
          .limit(1)
          .single();

        if (agentError || !agent) {
          return new Response(
            JSON.stringify({ error: "Agent not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const result = await checkAgentHealth(SUPABASE_URL, SERVICE_KEY, agent);
        await recordHealthCheck(supabase, result);
        await checkForIncident(supabase, agent, result);

        return new Response(
          JSON.stringify({ success: true, agent: agent.agent_name, ...result }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'get_status': {
        const { data: summary, error: summaryError } = await supabase.rpc('get_agent_health_summary');

        if (summaryError) {
          // Fall back to basic query if function doesn't exist yet
          const { data: agents } = await supabase
            .from('agent_registry')
            .select('agent_name, agent_type, is_critical')
            .order('agent_name');

          return new Response(
            JSON.stringify({
              success: true,
              agents: agents || [],
              note: "Health summary function not available, showing registry only"
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, agents: summary }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'recover': {
        if (!body.agent_name) {
          return new Response(
            JSON.stringify({ error: "agent_name required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: agent, error: agentError } = await supabase
          .from('agent_registry')
          .select('*')
          .eq('agent_name', body.agent_name)
          .limit(1)
          .single();

        if (agentError || !agent) {
          return new Response(
            JSON.stringify({ error: "Agent not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const result = await attemptRecovery(SUPABASE_URL, SERVICE_KEY, agent);

        return new Response(
          JSON.stringify(result),
          {
            status: result.success ? 200 : 503,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      default:
        return new Response(
          JSON.stringify({
            error: "Invalid action",
            valid_actions: ['check_all', 'check_one', 'get_status', 'recover', 'health']
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Health monitor error", { error: errorMessage });

    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
