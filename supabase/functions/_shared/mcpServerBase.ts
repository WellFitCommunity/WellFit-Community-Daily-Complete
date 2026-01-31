/**
 * MCP Server Base Utilities
 *
 * Provides tiered initialization for MCP servers:
 * - Tier 1 (External API): No Supabase needed
 * - Tier 2 (User-scoped): ANON key + RLS
 * - Tier 3 (Admin): Service role key required
 *
 * KEY FALLBACK CHAINS (future-proofed for Supabase key migration):
 *
 * SB_SECRET_KEY (admin/service role):
 *   1. SB_SECRET_KEY      (new sb_secret_* format)
 *   2. SB_SERVICE_ROLE_KEY (legacy JWT service role)
 *   3. SUPABASE_SERVICE_ROLE_KEY (legacy alias)
 *
 * SB_ANON_KEY (user/anon):
 *   1. SB_ANON_KEY        (JWT format - required for auth until SDK update)
 *   2. SUPABASE_ANON_KEY  (legacy alias)
 *   3. SB_PUBLISHABLE_API_KEY (new sb_publishable_* format)
 *
 * When Supabase retires legacy keys, the new format will be primary.
 * Configure BOTH formats in secrets to ensure zero-downtime migration.
 *
 * @module mcpServerBase
 */

import { SUPABASE_URL, SB_ANON_KEY, SB_SECRET_KEY } from "./env.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger, EdgeFunctionLogger } from "./auditLogger.ts";

export type MCPTier = "external_api" | "user_scoped" | "admin";

export interface MCPServerConfig {
  name: string;
  version: string;
  tier: MCPTier;
  logger?: EdgeFunctionLogger;
}

export interface MCPToolDefinition {
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface MCPInitResult {
  supabase: SupabaseClient | null;
  logger: EdgeFunctionLogger;
  canRateLimit: boolean;
  error?: string;
}

/**
 * Initialize MCP server based on tier
 *
 * - external_api: Does not require Supabase, graceful degradation
 * - user_scoped: Uses ANON key, requires SUPABASE_URL
 * - admin: Requires SERVICE_KEY
 */
export function initMCPServer(config: MCPServerConfig): MCPInitResult {
  const logger = config.logger || createLogger(config.name);

  switch (config.tier) {
    case "external_api": {
      // External API tier - Supabase is optional for rate limiting
      if (SUPABASE_URL && SB_ANON_KEY) {
        try {
          const supabase = createClient(SUPABASE_URL, SB_ANON_KEY, {
            auth: { persistSession: false }
          });
          logger.info("MCP server initialized with rate limiting", { tier: config.tier });
          return { supabase, logger, canRateLimit: true };
        } catch (err) {
          logger.warn("Supabase client creation failed, rate limiting disabled", {
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
      // Graceful degradation - works without Supabase
      logger.info("MCP server initialized without rate limiting", { tier: config.tier });
      return { supabase: null, logger, canRateLimit: false };
    }

    case "user_scoped": {
      // User-scoped tier - requires ANON key for RLS
      if (!SUPABASE_URL || !SB_ANON_KEY) {
        const error = "Missing SUPABASE_URL or SB_ANON_KEY";
        logger.error("MCP server initialization failed", { tier: config.tier, error });
        return { supabase: null, logger, canRateLimit: false, error };
      }

      const supabase = createClient(SUPABASE_URL, SB_ANON_KEY, {
        auth: { persistSession: false }
      });
      logger.info("MCP server initialized with user scope", { tier: config.tier });
      return { supabase, logger, canRateLimit: true };
    }

    case "admin": {
      // Admin tier - requires SERVICE_KEY
      if (!SUPABASE_URL || !SB_SECRET_KEY) {
        const error = "Missing SUPABASE_URL or SB_SECRET_KEY";
        logger.error("MCP server initialization failed", { tier: config.tier, error });
        return { supabase: null, logger, canRateLimit: false, error };
      }

      const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY, {
        auth: { persistSession: false }
      });
      logger.info("MCP server initialized with admin access", { tier: config.tier });
      return { supabase, logger, canRateLimit: true };
    }

    default:
      return { supabase: null, logger, canRateLimit: false, error: "Unknown tier" };
  }
}

/**
 * Create standard MCP initialize response
 */
export function createInitializeResponse(
  config: MCPServerConfig,
  id: unknown
): Record<string, unknown> {
  return {
    jsonrpc: "2.0",
    result: {
      protocolVersion: "2024-11-05",
      serverInfo: {
        name: config.name,
        version: config.version
      },
      capabilities: {
        tools: {}
      }
    },
    id
  };
}

/**
 * Create standard MCP tools/list response
 */
export function createToolsListResponse(
  tools: Record<string, MCPToolDefinition>,
  id: unknown
): Record<string, unknown> {
  return {
    jsonrpc: "2.0",
    result: {
      tools: Object.entries(tools).map(([name, def]) => ({
        name,
        description: def.description,
        inputSchema: def.inputSchema
      }))
    },
    id
  };
}

/**
 * Create standard MCP error response
 */
export function createErrorResponse(
  code: number,
  message: string,
  id: unknown
): Record<string, unknown> {
  return {
    jsonrpc: "2.0",
    error: { code, message },
    id
  };
}

/**
 * Standard ping tool for health checks
 * Add this to every MCP server's TOOLS
 */
export const PING_TOOL: MCPToolDefinition = {
  description: "Health check - returns server status",
  inputSchema: {
    type: "object",
    properties: {},
    required: []
  }
};

/**
 * Handle ping request (via MCP tools/call)
 */
export function handlePing(config: MCPServerConfig, initResult: MCPInitResult): Record<string, unknown> {
  return {
    status: "ok",
    server: config.name,
    version: config.version,
    tier: config.tier,
    timestamp: new Date().toISOString(),
    capabilities: {
      supabase: initResult.supabase !== null,
      rateLimit: initResult.canRateLimit
    }
  };
}

/**
 * Extended health check for infrastructure monitoring
 *
 * Returns detailed status including:
 * - Build version (from env or git SHA)
 * - Dependency readiness (boolean flags only, never values)
 * - Server tier and capabilities
 *
 * @param config - Server configuration
 * @param initResult - MCP initialization result
 * @param externalDeps - Optional external dependency checks
 */
export interface ExternalDependency {
  name: string;
  ready: boolean;
}

export function createHealthResponse(
  config: MCPServerConfig,
  initResult: MCPInitResult,
  externalDeps?: ExternalDependency[]
): Record<string, unknown> {
  // Get build version from env or default to version
  const buildVersion = Deno.env.get("BUILD_VERSION") ||
                       Deno.env.get("GIT_SHA") ||
                       config.version;

  const deps: Record<string, boolean> = {
    supabase: initResult.supabase !== null,
    rateLimit: initResult.canRateLimit
  };

  // Add external dependencies if provided
  if (externalDeps) {
    for (const dep of externalDeps) {
      deps[dep.name] = dep.ready;
    }
  }

  return {
    ok: !initResult.error,
    server: config.name,
    version: buildVersion,
    tier: config.tier,
    deps,
    timestamp: new Date().toISOString(),
    error: initResult.error || undefined
  };
}

/**
 * HTTP handler for /health endpoint (infrastructure monitoring)
 *
 * This is a standalone HTTP handler, not an MCP method.
 * Use for load balancer health checks, uptime monitoring, etc.
 */
export function handleHealthCheck(
  req: Request,
  config: MCPServerConfig,
  initResult: MCPInitResult,
  corsHeaders: Record<string, string>,
  externalDeps?: ExternalDependency[]
): Response {
  const health = createHealthResponse(config, initResult, externalDeps);

  return new Response(JSON.stringify(health), {
    status: health.ok ? 200 : 503,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

/**
 * Simple in-memory rate limiter for when Supabase is unavailable
 * This is a fallback - not as sophisticated as the Supabase-backed limiter
 */
const inMemoryRateLimits: Map<string, { count: number; resetAt: number }> = new Map();

export function checkInMemoryRateLimit(
  identifier: string,
  limit: number = 60,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const existing = inMemoryRateLimits.get(identifier);

  if (!existing || now >= existing.resetAt) {
    // New window
    inMemoryRateLimits.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count++;
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

// Clean up old entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of inMemoryRateLimits.entries()) {
    if (now >= value.resetAt) {
      inMemoryRateLimits.delete(key);
    }
  }
}, 5 * 60 * 1000);

export default {
  initMCPServer,
  createInitializeResponse,
  createToolsListResponse,
  createErrorResponse,
  handlePing,
  createHealthResponse,
  handleHealthCheck,
  checkInMemoryRateLimit,
  PING_TOOL
};
