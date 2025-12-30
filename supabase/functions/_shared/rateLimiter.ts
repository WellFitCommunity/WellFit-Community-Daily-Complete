// supabase/functions/_shared/rateLimiter.ts
// Distributed rate limiting for edge functions using Supabase database
// Zero tech debt - leverages existing rate_limit_attempts table

import { supabaseAdmin } from "./auth.ts";
import { createLogger } from "./auditLogger.ts";

const logger = createLogger("rateLimiter");

interface RateLimitConfig {
  maxAttempts: number;
  windowSeconds: number;
  keyPrefix: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

/**
 * Check rate limit for a given identifier (user_id, IP, etc.)
 * Uses existing rate_limit_attempts table for persistence
 *
 * @param identifier - Unique identifier (user_id, IP address, etc.)
 * @param config - Rate limit configuration
 * @returns RateLimitResult with allow/deny decision
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - (config.windowSeconds * 1000));
  const key = `${config.keyPrefix}:${identifier}`;

  try {
    // Count attempts in current window
    const { data: attempts, error: countError } = await supabaseAdmin
      .from('rate_limit_attempts')
      .select('id, attempted_at')
      .eq('identifier', key)
      .gte('attempted_at', windowStart.toISOString())
      .order('attempted_at', { ascending: false });

    if (countError) {
      logger.error("Rate limit check error", { error: countError.message });
      // Fail open - allow request but log error
      return {
        allowed: true,
        remaining: config.maxAttempts,
        resetAt: new Date(now.getTime() + (config.windowSeconds * 1000))
      };
    }

    const attemptCount = attempts?.length || 0;
    const remaining = Math.max(0, config.maxAttempts - attemptCount);

    // Find oldest attempt to calculate reset time
    const oldestAttempt = attempts && attempts.length > 0
      ? new Date(attempts[attempts.length - 1].attempted_at)
      : now;
    const resetAt = new Date(oldestAttempt.getTime() + (config.windowSeconds * 1000));

    if (attemptCount >= config.maxAttempts) {
      // Rate limit exceeded
      const retryAfter = Math.ceil((resetAt.getTime() - now.getTime()) / 1000);

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter
      };
    }

    // Record this attempt
    const { error: insertError } = await supabaseAdmin
      .from('rate_limit_attempts')
      .insert({
        identifier: key,
        attempted_at: now.toISOString(),
        metadata: {
          keyPrefix: config.keyPrefix,
          windowSeconds: config.windowSeconds,
          maxAttempts: config.maxAttempts
        }
      });

    if (insertError) {
      logger.warn("Failed to record rate limit attempt", { error: insertError.message });
    }

    return {
      allowed: true,
      remaining: remaining - 1, // Account for current request
      resetAt
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Rate limit exception", { error: errorMessage });
    // Fail open on errors
    return {
      allowed: true,
      remaining: config.maxAttempts,
      resetAt: new Date(now.getTime() + (config.windowSeconds * 1000))
    };
  }
}

/**
 * Cleanup old rate limit attempts (run periodically)
 * Removes attempts older than 24 hours
 */
export async function cleanupRateLimitAttempts(): Promise<void> {
  const cutoff = new Date(Date.now() - (24 * 60 * 60 * 1000)); // 24 hours ago

  const { error } = await supabaseAdmin
    .from('rate_limit_attempts')
    .delete()
    .lt('attempted_at', cutoff.toISOString());

  if (error) {
    logger.error("Failed to cleanup rate limit attempts", { error: error.message });
  }
}

/**
 * Wrap a handler with rate limiting
 *
 * @param handler - Original request handler
 * @param config - Rate limit configuration
 * @param getIdentifier - Function to extract identifier from request (defaults to IP)
 * @returns Wrapped handler with rate limiting
 */
export function withRateLimit(
  handler: (req: Request) => Promise<Response> | Response,
  config: RateLimitConfig,
  getIdentifier: (req: Request) => string = (req) => {
    // Default: use IP address from X-Forwarded-For or connection
    const forwarded = req.headers.get('x-forwarded-for');
    return forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  }
) {
  return async (req: Request): Promise<Response> => {
    const identifier = getIdentifier(req);

    if (!identifier || identifier === 'unknown') {
      // No identifier - allow but log warning
      logger.warn("Rate limit: No identifier found, allowing request");
      return handler(req);
    }

    const result = await checkRateLimit(identifier, config);

    if (!result.allowed) {
      // Rate limited
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again in ${result.retryAfter} seconds.`,
          retryAfter: result.retryAfter,
          resetAt: result.resetAt.toISOString()
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(result.retryAfter || config.windowSeconds),
            'X-RateLimit-Limit': String(config.maxAttempts),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.floor(result.resetAt.getTime() / 1000))
          }
        }
      );
    }

    // Add rate limit headers to response
    const response = await handler(req);
    const headers = new Headers(response.headers);
    headers.set('X-RateLimit-Limit', String(config.maxAttempts));
    headers.set('X-RateLimit-Remaining', String(result.remaining));
    headers.set('X-RateLimit-Reset', String(Math.floor(result.resetAt.getTime() / 1000)));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  };
}

// Common rate limit configurations
export const RATE_LIMITS = {
  // Strict limits for authentication endpoints
  AUTH: {
    maxAttempts: 5,
    windowSeconds: 300, // 5 minutes
    keyPrefix: 'auth'
  },

  // Moderate limits for API endpoints
  API: {
    maxAttempts: 60,
    windowSeconds: 60, // 1 minute
    keyPrefix: 'api'
  },

  // Generous limits for read-only operations
  READ: {
    maxAttempts: 100,
    windowSeconds: 60, // 1 minute
    keyPrefix: 'read'
  },

  // Very strict for expensive operations
  EXPENSIVE: {
    maxAttempts: 10,
    windowSeconds: 600, // 10 minutes
    keyPrefix: 'expensive'
  },

  // AI/Claude API calls
  AI: {
    maxAttempts: 30,
    windowSeconds: 60, // 1 minute
    keyPrefix: 'ai'
  }
};
