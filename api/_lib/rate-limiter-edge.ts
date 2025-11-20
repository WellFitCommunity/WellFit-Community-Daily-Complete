/**
 * Edge Runtime Rate Limiter
 *
 * Simple in-memory rate limiting for Edge Runtime endpoints
 * Compatible with Vercel Edge Functions (different from Node.js runtime)
 *
 * HIPAA Compliance: Prevents brute force attacks and service abuse
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (will reset on cold start - acceptable for basic protection)
const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Custom error message */
  message?: string;
}

/**
 * Get client identifier for rate limiting from Edge Request
 */
function getClientId(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback
  return 'unknown';
}

/**
 * Rate limiting for Edge Runtime
 *
 * @returns Response if rate limited, null if allowed
 */
export async function rateLimitEdge(
  req: Request,
  config: RateLimitConfig
): Promise<Response | null> {
  const {
    maxRequests,
    windowMs,
    message = 'Too many requests, please try again later'
  } = config;

  const key = getClientId(req);
  const now = Date.now();

  // Get or create rate limit entry
  let entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    // Create new window
    entry = {
      count: 0,
      resetAt: now + windowMs
    };
    rateLimitStore.set(key, entry);
  }

  // Increment request count
  entry.count++;

  // Check if limit exceeded
  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return new Response(
      JSON.stringify({
        error: message,
        retryAfter
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.floor(entry.resetAt / 1000).toString(),
          'Retry-After': retryAfter.toString()
        }
      }
    );
  }

  return null; // Not rate limited
}

/**
 * Preset rate limit configurations
 */
export const RateLimitPresetsEdge = {
  /** Strict limit for authentication endpoints */
  auth: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: 'Too many authentication attempts. Please try again in 15 minutes.'
  },

  /** Standard API endpoints */
  api: {
    maxRequests: 60,
    windowMs: 60 * 1000, // 1 minute
  },

  /** Email/SMS sending */
  messaging: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many messages sent. Please wait before sending more.'
  }
} as const;
