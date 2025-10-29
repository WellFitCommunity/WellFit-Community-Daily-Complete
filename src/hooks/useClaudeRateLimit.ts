// UI Rate Limiting Hook for Claude Service
// Prevents excessive API calls from the UI layer
// Complements server-side rate limiting in claudeService.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { claudeService } from '../services/claudeService';

interface RateLimitState {
  remaining: number;
  resetTime: Date;
  isLimited: boolean;
  canMakeRequest: boolean;
}

interface UseClaudeRateLimitOptions {
  userId: string;
  maxRequests?: number;
  windowMs?: number;
  onLimitExceeded?: (resetTime: Date) => void;
}

/**
 * Hook to enforce UI-side rate limiting for Claude AI requests
 *
 * Features:
 * - Client-side request tracking
 * - Automatic UI blocking when limits exceeded
 * - Reset timer display
 * - Integration with server-side limits
 *
 * @example
 * ```tsx
 * const { canMakeRequest, remaining, resetTime, checkRateLimit } = useClaudeRateLimit({
 *   userId: currentUser.id,
 *   onLimitExceeded: (resetTime) => {
 *     toast.error(`Rate limit exceeded. Try again at ${resetTime.toLocaleTimeString()}`);
 *   }
 * });
 *
 * const handleAskClaude = async () => {
 *   if (!checkRateLimit()) {
 *     return; // Blocked by rate limit
 *   }
 *   // Make Claude request...
 * };
 * ```
 */
export function useClaudeRateLimit({
  userId,
  maxRequests = 60,
  windowMs = 60000, // 1 minute
  onLimitExceeded
}: UseClaudeRateLimitOptions) {
  const [rateLimitState, setRateLimitState] = useState<RateLimitState>({
    remaining: maxRequests,
    resetTime: new Date(Date.now() + windowMs),
    isLimited: false,
    canMakeRequest: true
  });

  // Track requests in-memory (UI-side only)
  const requestTimestamps = useRef<number[]>([]);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Update rate limit state based on tracked requests
   */
  const updateRateLimitState = useCallback(() => {
    const now = Date.now();

    // Remove expired timestamps
    const validTimestamps = requestTimestamps.current.filter(
      timestamp => now - timestamp < windowMs
    );
    requestTimestamps.current = validTimestamps;

    const remaining = Math.max(0, maxRequests - validTimestamps.length);
    const isLimited = remaining === 0;
    const oldestTimestamp = validTimestamps[0];
    const resetTime = oldestTimestamp
      ? new Date(oldestTimestamp + windowMs)
      : new Date(now + windowMs);

    setRateLimitState({
      remaining,
      resetTime,
      isLimited,
      canMakeRequest: !isLimited
    });

    // Trigger callback if newly limited
    if (isLimited && onLimitExceeded) {
      onLimitExceeded(resetTime);
    }
  }, [maxRequests, windowMs, onLimitExceeded]);

  /**
   * Check if request can be made and record it
   * Returns true if allowed, false if rate limited
   */
  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    const validTimestamps = requestTimestamps.current.filter(
      timestamp => now - timestamp < windowMs
    );

    if (validTimestamps.length >= maxRequests) {
      updateRateLimitState();
      return false;
    }

    // Record this request
    requestTimestamps.current.push(now);
    updateRateLimitState();
    return true;
  }, [maxRequests, windowMs, updateRateLimitState]);

  /**
   * Get server-side rate limit info from claudeService
   */
  const syncWithServer = useCallback(async () => {
    try {
      const serverLimits = claudeService.getRateLimitInfo(userId);

      // Update local state to match server if server is more restrictive
      if (serverLimits.remaining < rateLimitState.remaining) {
        setRateLimitState({
          remaining: serverLimits.remaining,
          resetTime: serverLimits.resetTime,
          isLimited: serverLimits.remaining === 0,
          canMakeRequest: serverLimits.remaining > 0
        });
      }
    } catch (error) {

    }
  }, [userId, rateLimitState.remaining]);

  /**
   * Reset rate limit (admin/testing only)
   */
  const resetRateLimit = useCallback(() => {
    requestTimestamps.current = [];
    updateRateLimitState();
  }, [updateRateLimitState]);

  /**
   * Get time until rate limit resets (in seconds)
   */
  const getTimeUntilReset = useCallback((): number => {
    const now = Date.now();
    const resetMs = rateLimitState.resetTime.getTime();
    return Math.max(0, Math.ceil((resetMs - now) / 1000));
  }, [rateLimitState.resetTime]);

  // Set up periodic state updates
  useEffect(() => {
    updateIntervalRef.current = setInterval(() => {
      updateRateLimitState();
    }, 5000); // Update every 5 seconds

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [updateRateLimitState]);

  // Sync with server on mount and periodically
  useEffect(() => {
    syncWithServer();
    const syncInterval = setInterval(syncWithServer, 30000); // Sync every 30 seconds

    return () => clearInterval(syncInterval);
  }, [syncWithServer]);

  return {
    // State
    remaining: rateLimitState.remaining,
    resetTime: rateLimitState.resetTime,
    isLimited: rateLimitState.isLimited,
    canMakeRequest: rateLimitState.canMakeRequest,

    // Methods
    checkRateLimit,
    resetRateLimit,
    syncWithServer,
    getTimeUntilReset,

    // Formatted helpers
    remainingDisplay: `${rateLimitState.remaining}/${maxRequests}`,
    resetTimeDisplay: rateLimitState.resetTime.toLocaleTimeString(),
    secondsUntilReset: getTimeUntilReset()
  };
}

export default useClaudeRateLimit;
