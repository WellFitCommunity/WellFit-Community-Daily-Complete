// src/services/loginSecurityService.ts
// SOC2 CC6.1: Login security helpers for rate limiting and account lockout

import { supabase } from '../lib/supabaseClient';

export interface LoginAttemptData {
  identifier: string; // email or phone
  attemptType: 'password' | 'pin' | 'mfa';
  success: boolean;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, any>;
}

export interface AccountLockoutInfo {
  isLocked: boolean;
  lockedUntil?: string;
  failedAttempts?: number;
  minutesRemaining?: number;
}

/**
 * Check if an account is currently locked due to failed login attempts
 */
export async function isAccountLocked(identifier: string): Promise<AccountLockoutInfo> {
  try {
    const { data, error } = await supabase.rpc('is_account_locked', {
      p_identifier: identifier,
    });

    if (error) {

      return { isLocked: false };
    }

    if (!data) {
      return { isLocked: false };
    }

    // If locked, get lockout details
    const { data: lockoutData } = await supabase
      .from('account_lockouts')
      .select('locked_until, metadata')
      .eq('identifier', identifier)
      .is('unlocked_at', null)
      .gte('locked_until', new Date().toISOString())
      .single();

    if (lockoutData) {
      const lockedUntil = new Date(lockoutData.locked_until);
      const now = new Date();
      const minutesRemaining = Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000);

      return {
        isLocked: true,
        lockedUntil: lockoutData.locked_until,
        failedAttempts: lockoutData.metadata?.failed_attempts,
        minutesRemaining: Math.max(0, minutesRemaining),
      };
    }

    return { isLocked: data };
  } catch (err) {

    return { isLocked: false };
  }
}

/**
 * Get count of failed login attempts in the last N minutes
 */
export async function getFailedLoginCount(
  identifier: string,
  minutes: number = 15
): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('get_failed_login_count', {
      p_identifier: identifier,
      p_minutes: minutes,
    });

    if (error) {

      return 0;
    }

    return data || 0;
  } catch (err) {

    return 0;
  }
}

/**
 * Record a login attempt (success or failure)
 * This is called client-side for visibility, but the server should also log
 */
export async function recordLoginAttempt(attempt: LoginAttemptData): Promise<void> {
  try {
    // Get client info
    const ipAddress = attempt.ipAddress || await getClientIP();
    const userAgent = attempt.userAgent || navigator.userAgent;

    const { error } = await supabase.rpc('record_login_attempt', {
      p_identifier: attempt.identifier,
      p_attempt_type: attempt.attemptType,
      p_success: attempt.success,
      p_user_id: attempt.userId || null,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_error_message: attempt.errorMessage || null,
      p_metadata: attempt.metadata || {},
    });

    if (error) {

    }
  } catch (err) {

  }
}

/**
 * Get client IP address (best effort)
 */
async function getClientIP(): Promise<string | null> {
  // In production, this would be set by your Edge Function or API Gateway
  // For now, return null and let the backend handle it
  return null;
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
