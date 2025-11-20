/**
 * Rate Limiter Middleware
 *
 * Simple in-memory rate limiting for API endpoints
 * Production: Replace with Redis-based solution for distributed rate limiting
 *
 * HIPAA Compliance: Prevents brute force attacks and service abuse
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (will reset on serverless function cold start - acceptable for basic protection)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Custom key generator (defaults to IP address) */
  keyGenerator?: (req: VercelRequest) => string;
  /** Custom error message */
  message?: string;
}

/**
 * Get client identifier for rate limiting
 * Priority: X-Forwarded-For (behind proxy) > X-Real-IP > Remote Address
 */
function getClientId(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string') {
    return realIp;
  }

  // Fallback to connection remote address
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Rate limiting middleware
 *
 * @example
 * ```typescript
 * export default async function handler(req: VercelRequest, res: VercelResponse) {
 *   const limited = await rateLimit(req, res, {
 *     maxRequests: 10,
 *     windowMs: 60 * 1000, // 1 minute
 *   });
 *   if (limited) return; // Response already sent
 *
 *   // Continue with request handling
 * }
 * ```
 */
export async function rateLimit(
  req: VercelRequest,
  res: VercelResponse,
  config: RateLimitConfig
): Promise<boolean> {
  const {
    maxRequests,
    windowMs,
    keyGenerator = getClientId,
    message = 'Too many requests, please try again later'
  } = config;

  const key = keyGenerator(req);
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

  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', maxRequests.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count).toString());
  res.setHeader('X-RateLimit-Reset', Math.floor(entry.resetAt / 1000).toString());

  // Check if limit exceeded
  if (entry.count > maxRequests) {
    res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000).toString());
    res.status(429).json({
      error: message,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000)
    });
    return true; // Rate limited
  }

  return false; // Not rate limited
}

/**
 * Preset rate limit configurations for common use cases
 */
export const RateLimitPresets = {
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

  /** Expensive operations (AI, analytics) */
  expensive: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
  },

  /** Email/SMS sending */
  messaging: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many messages sent. Please wait before sending more.'
  }
} as const;
