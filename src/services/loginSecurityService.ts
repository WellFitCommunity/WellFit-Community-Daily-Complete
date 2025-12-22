// src/services/loginSecurityService.ts
// SOC2 CC6.1: Login security helpers for rate limiting and account lockout
// Uses Edge Function for server-side enforcement (no client-side RLS issues)

import { supabase } from '../lib/supabaseClient';

export interface LoginAttemptData {
  identifier: string; // email or phone
  attemptType: 'password' | 'pin' | 'mfa';
  success: boolean;
  userId?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AccountLockoutInfo {
  isLocked: boolean;
  lockedUntil?: string;
  failedAttempts?: number;
  minutesRemaining?: number;
}

/**
 * Check if an account is currently locked due to failed login attempts
 * Uses Edge Function for server-side check (works before authentication)
 */
export async function isAccountLocked(identifier: string): Promise<AccountLockoutInfo> {
  try {
    const { data, error } = await supabase.functions.invoke('login-security', {
      body: {
        action: 'check_lock',
        identifier,
      },
    });

    if (error) {
      // Fail open - don't block login if check fails
      return { isLocked: false };
    }

    return {
      isLocked: data?.isLocked ?? false,
      lockedUntil: data?.lockedUntil,
      failedAttempts: data?.failedAttempts,
      minutesRemaining: data?.minutesRemaining,
    };
  } catch {
    // Fail open - don't block login if check fails
    return { isLocked: false };
  }
}

/**
 * Record a login attempt (success or failure)
 * Uses Edge Function for server-side recording (works before/after authentication)
 */
export async function recordLoginAttempt(attempt: LoginAttemptData): Promise<void> {
  try {
    await supabase.functions.invoke('login-security', {
      body: {
        action: 'record_attempt',
        identifier: attempt.identifier,
        attemptType: attempt.attemptType,
        success: attempt.success,
        userId: attempt.userId || null,
        errorMessage: attempt.errorMessage || null,
        metadata: attempt.metadata || {},
      },
    });
  } catch {
    // Don't fail login flow if audit logging fails
  }
}

/**
 * Format lockout message for user display
 */
export function formatLockoutMessage(lockoutInfo: AccountLockoutInfo): string {
  if (!lockoutInfo.isLocked) {
    return '';
  }

  const minutes = lockoutInfo.minutesRemaining || 15;
  return `Account temporarily locked due to multiple failed login attempts. Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`;
}
