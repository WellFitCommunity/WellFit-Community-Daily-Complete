/**
 * useMfaEnrollment - Hook for MFA enrollment status
 *
 * Returns MFA enrollment state for the current user,
 * including grace period info and enforcement status.
 */

import { useState, useEffect, useCallback } from 'react';
import { getMfaStatus } from '../services/mfaEnrollmentService';
import type { MfaEnrollmentStatus } from '../services/mfaEnrollmentService.types';

interface UseMfaEnrollmentResult {
  status: MfaEnrollmentStatus | null;
  isLoading: boolean;
  error: string | null;
  requiresSetup: boolean;
  isInGracePeriod: boolean;
  daysRemaining: number;
  isEnforced: boolean;
  isExempt: boolean;
  refresh: () => void;
}

export function useMfaEnrollment(
  userId: string | undefined
): UseMfaEnrollmentResult {
  const [status, setStatus] = useState<MfaEnrollmentStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const fetchStatus = async () => {
      setIsLoading(true);
      setError(null);

      const result = await getMfaStatus(userId);

      if (cancelled) return;

      if (result.success) {
        setStatus(result.data);
      } else {
        setError(result.error.message);
      }

      setIsLoading(false);
    };

    fetchStatus();

    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);

  const requiresSetup =
    status !== null &&
    status.mfa_required &&
    !status.mfa_enabled &&
    status.enforcement_status !== 'exempt';

  const isInGracePeriod =
    status !== null &&
    status.enforcement_status === 'grace_period' &&
    !status.mfa_enabled;

  const daysRemaining = status?.days_remaining ?? 0;

  const isEnforced =
    status !== null &&
    status.mfa_required &&
    !status.mfa_enabled &&
    status.enforcement_status !== 'exempt' &&
    status.enforcement_status !== 'grace_period';

  const isExempt =
    status !== null && status.enforcement_status === 'exempt';

  return {
    status,
    isLoading,
    error,
    requiresSetup,
    isInGracePeriod,
    daysRemaining,
    isEnforced,
    isExempt,
    refresh,
  };
}
