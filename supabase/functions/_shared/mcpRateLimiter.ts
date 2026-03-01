// =====================================================
// MCP Rate Limiter
// Purpose: Persistent rate limiting for MCP servers (P3-1)
// Strategy: In-memory fast path + Supabase persistence via check_rate_limit() RPC
// Features: Fast in-memory checks, persistent cross-instance limits, cleanup
// =====================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// In-memory rate limit store (per-instance fast path)
interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupOldEntries(windowMs: number): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart > windowMs * 2) {
      rateLimitStore.delete(key);
    }
  }
}

// Rate limit configurations for MCP tools
export const MCP_RATE_LIMITS = {
  // PostgreSQL MCP - moderate limits
  postgres: {
    maxRequests: 60,
    windowMs: 60 * 1000, // 1 minute
    keyPrefix: 'mcp:postgres'
  },

  // FHIR MCP - moderate limits (external API calls)
  fhir: {
    maxRequests: 30,
    windowMs: 60 * 1000,
    keyPrefix: 'mcp:fhir'
  },

  // Clearinghouse MCP - strict limits (expensive external calls)
  clearinghouse: {
    maxRequests: 20,
    windowMs: 60 * 1000,
    keyPrefix: 'mcp:clearinghouse'
  },

  // Medical Codes MCP - generous limits (read-only lookups)
  medicalCodes: {
    maxRequests: 100,
    windowMs: 60 * 1000,
    keyPrefix: 'mcp:codes'
  },

  // HL7/X12 MCP - moderate limits
  hl7x12: {
    maxRequests: 40,
    windowMs: 60 * 1000,
    keyPrefix: 'mcp:hl7x12'
  },

  // Claude MCP - strict limits (expensive AI calls)
  claude: {
    maxRequests: 15,
    windowMs: 60 * 1000,
    keyPrefix: 'mcp:claude'
  },

  // Edge Functions MCP - moderate limits
  edgeFunctions: {
    maxRequests: 50,
    windowMs: 60 * 1000,
    keyPrefix: 'mcp:edge'
  },

  // Prior Authorization MCP - moderate limits
  prior_auth: {
    maxRequests: 40,
    windowMs: 60 * 1000,
    keyPrefix: 'mcp:prior_auth'
  },

  // CMS Coverage MCP - generous limits (read-only lookups)
  cms_coverage: {
    maxRequests: 100,
    windowMs: 60 * 1000,
    keyPrefix: 'mcp:cms_coverage'
  },

  // NPI Registry MCP - generous limits (read-only lookups)
  npi_registry: {
    maxRequests: 100,
    windowMs: 60 * 1000,
    keyPrefix: 'mcp:npi'
  }
};

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs?: number;
}

/**
 * Check rate limit using in-memory store
 * @param identifier - Unique identifier (IP, user ID, tenant ID)
 * @param config - Rate limit configuration
 * @returns RateLimitResult
 */
export function checkMCPRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = `${config.keyPrefix}:${identifier}`;

  // Cleanup old entries periodically
  cleanupOldEntries(config.windowMs);

  const entry = rateLimitStore.get(key);

  // Check if window has expired
  if (!entry || now - entry.windowStart >= config.windowMs) {
    // New window
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs
    };
  }

  // Existing window
  if (entry.count >= config.maxRequests) {
    // Rate limited
    const retryAfterMs = config.windowMs - (now - entry.windowStart);
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.windowStart + config.windowMs,
      retryAfterMs
    };
  }

  // Increment counter
  entry.count++;
  rateLimitStore.set(key, entry);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.windowStart + config.windowMs
  };
}

/**
 * Persistent rate limit check via Supabase RPC (P3-1).
 *
 * Uses the `check_rate_limit()` database function for cross-instance
 * persistence. Falls back to in-memory if the RPC fails (graceful degradation).
 *
 * Call this for identity-based limits (after auth) to enforce limits across
 * all edge function instances. The in-memory `checkMCPRateLimit` remains
 * the fast path for IP-based DoS protection.
 *
 * @param sb - Supabase client (service role)
 * @param identifier - Rate limit key (from getCallerRateLimitId)
 * @param config - Rate limit configuration
 * @returns RateLimitResult
 */
export async function checkPersistentRateLimit(
  sb: SupabaseClient,
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const rateKey = `${config.keyPrefix}:${identifier}`;

  try {
    const { data, error } = await sb.rpc("check_rate_limit", {
      p_rate_key: rateKey,
      p_max_requests: config.maxRequests,
      p_window_ms: config.windowMs
    });

    if (error || !data || !Array.isArray(data) || data.length === 0) {
      // Fallback to in-memory on RPC failure
      return checkMCPRateLimit(identifier, config);
    }

    const row = data[0] as { allowed: boolean; remaining: number; reset_at: string };
    const resetAt = new Date(row.reset_at).getTime();

    return {
      allowed: row.allowed,
      remaining: row.remaining,
      resetAt,
      ...(!row.allowed ? { retryAfterMs: Math.max(resetAt - Date.now(), 1000) } : {})
    };
  } catch {
    // Graceful degradation: use in-memory on any failure
    return checkMCPRateLimit(identifier, config);
  }
}

/**
 * Caller identity shape (matches CallerIdentity from mcpAuthGate)
 * Redefined here to avoid circular imports.
 */
interface RateLimitCallerIdentity {
  userId: string;
  tenantId: string | null;
  authMethod: 'user_jwt' | 'mcp_key';
  mcpKeyId?: string;
}

/**
 * Get identity-based rate limit identifier from authenticated caller (P1-3).
 *
 * Use this AFTER the auth gate succeeds to rate-limit per user/key
 * instead of per IP. Provides fairer limits behind shared IPs (corporate NAT)
 * and prevents a single MCP key from consuming another key's quota.
 *
 * @param caller - The authenticated caller identity
 * @returns A stable identifier string for rate limiting
 */
export function getCallerRateLimitId(caller: RateLimitCallerIdentity): string {
  if (caller.authMethod === 'mcp_key' && caller.mcpKeyId) {
    return `mcp_key:${caller.mcpKeyId}`;
  }
  // User JWT: scope by userId + tenantId for multi-tenant fairness
  const tenantSuffix = caller.tenantId ? `:${caller.tenantId}` : '';
  return `user:${caller.userId}${tenantSuffix}`;
}

/**
 * Extract identifier from request (IP-based fallback for unauthenticated paths)
 */
export function getRequestIdentifier(req: Request): string {
  // Try various headers for identifier
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Try to get user ID from auth header
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    // Use a hash of the token as identifier
    const token = authHeader.slice(7);
    return `token:${simpleHash(token)}`;
  }

  return 'unknown';
}

/**
 * Simple hash function for tokens
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Create rate limit headers for response
 */
export function createRateLimitHeaders(result: RateLimitResult, config: RateLimitConfig): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(config.maxRequests),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000)),
    ...(result.retryAfterMs ? { 'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)) } : {})
  };
}

/**
 * Create rate limit error response
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  config: RateLimitConfig,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      error: {
        code: 'rate_limit_exceeded',
        message: `Too many requests. Please try again in ${Math.ceil((result.retryAfterMs || 60000) / 1000)} seconds.`,
        retryAfterSeconds: Math.ceil((result.retryAfterMs || 60000) / 1000)
      }
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        ...createRateLimitHeaders(result, config),
        'Content-Type': 'application/json'
      }
    }
  );
}

/**
 * Wrap an MCP handler with rate limiting
 */
export function withMCPRateLimit(
  handler: (req: Request) => Promise<Response>,
  config: RateLimitConfig,
  getCorsHeaders: (req: Request) => Record<string, string>
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    // Skip rate limiting for OPTIONS (CORS preflight)
    if (req.method === 'OPTIONS') {
      return handler(req);
    }

    const identifier = getRequestIdentifier(req);
    const result = checkMCPRateLimit(identifier, config);
    const corsHeaders = getCorsHeaders(req);

    if (!result.allowed) {
      return createRateLimitResponse(result, config, corsHeaders);
    }

    // Execute handler and add rate limit headers
    const response = await handler(req);
    const headers = new Headers(response.headers);

    const rateLimitHeaders = createRateLimitHeaders(result, config);
    for (const [key, value] of Object.entries(rateLimitHeaders)) {
      headers.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  };
}

/**
 * Get current rate limit stats (for monitoring)
 */
export function getRateLimitStats(): { totalKeys: number; entries: Array<{ key: string; count: number; windowStart: number }> } {
  const entries = Array.from(rateLimitStore.entries()).map(([key, entry]) => ({
    key,
    count: entry.count,
    windowStart: entry.windowStart
  }));

  return {
    totalKeys: rateLimitStore.size,
    entries
  };
}
