/**
 * TimeClockContext
 *
 * Provides automatic time clock integration with login/logout:
 * - Auto clock-in when user logs in
 * - Prompt for clock-out on logout
 * - Track current clock-in status across the app
 *
 * This is feature-flagged - only active when time clock module is enabled.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useUser, useSession } from './AuthContext';
import { TimeClockService } from '../services/timeClockService';
import { auditLogger } from '../services/auditLogger';
import { featureFlags } from '../config/featureFlags';
import { supabase } from '../lib/supabaseClient';
import type { TodayEntry } from '../types/timeClock';

interface TimeClockContextValue {
  // Current state
  isClockedIn: boolean;
  todayEntry: TodayEntry | null;
  loading: boolean;
  tenantId: string | null;

  // Actions
  clockIn: () => Promise<{ success: boolean; wasOnTime?: boolean; streak?: number }>;
  clockOut: (notes?: string) => Promise<{ success: boolean; totalHours?: number }>;
  refreshStatus: () => Promise<void>;

  // Logout flow
  pendingLogout: boolean;
  showClockOutPrompt: boolean;
  confirmLogout: (clockOut: boolean) => Promise<void>;
  cancelLogout: () => void;
  initiateLogout: () => void;
}

const TimeClockContext = createContext<TimeClockContextValue | undefined>(undefined);

export const TimeClockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useUser();
  const session = useSession();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [todayEntry, setTodayEntry] = useState<TodayEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingLogout, setPendingLogout] = useState(false);
  const [showClockOutPrompt, setShowClockOutPrompt] = useState(false);

  // Track if we've already auto-clocked in for this session
  const hasAutoClocked = useRef(false);
  const prevUserId = useRef<string | null>(null);

  const isClockedIn = todayEntry?.status === 'clocked_in';

  // Load tenant ID when user changes
  useEffect(() => {
    const loadTenantId = async () => {
      if (!user?.id) {
        setTenantId(null);
        return;
      }

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('user_id', user.id)
          .single();

        if (profile?.tenant_id) {
          setTenantId(profile.tenant_id);
        }
      } catch (error) {
        await auditLogger.error('TIME_CLOCK_CONTEXT_TENANT_LOAD_FAILED', error as Error);
      }
    };

    loadTenantId();
  }, [user?.id]);

  // Refresh clock-in status
  const refreshStatus = useCallback(async () => {
    if (!user?.id || !tenantId || !featureFlags.timeClock) return;

    try {
      setLoading(true);
      const result = await TimeClockService.getTodayEntry(user.id, tenantId);
      if (result.success) {
        setTodayEntry(result.data);
      }
    } catch (error) {
      await auditLogger.error('TIME_CLOCK_STATUS_REFRESH_FAILED', error as Error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, tenantId]);

  // Clock in
  const clockIn = useCallback(async () => {
    if (!user?.id || !tenantId) {
      return { success: false };
    }

    try {
      const result = await TimeClockService.clockIn(user.id, tenantId);
      if (result.success) {
        await refreshStatus();
        return {
          success: true,
          wasOnTime: result.data.was_on_time,
          streak: result.data.current_streak,
        };
      }
      return { success: false };
    } catch (error) {
      await auditLogger.error('TIME_CLOCK_AUTO_CLOCK_IN_FAILED', error as Error);
      return { success: false };
    }
  }, [user?.id, tenantId, refreshStatus]);

  // Clock out
  const clockOut = useCallback(async (notes?: string) => {
    if (!todayEntry?.id) {
      return { success: false };
    }

    try {
      const result = await TimeClockService.clockOut(todayEntry.id, notes);
      if (result.success) {
        await refreshStatus();
        return {
          success: true,
          totalHours: result.data.total_hours,
        };
      }
      return { success: false };
    } catch (error) {
      await auditLogger.error('TIME_CLOCK_CLOCK_OUT_FAILED', error as Error);
      return { success: false };
    }
  }, [todayEntry?.id, refreshStatus]);

  // Auto clock-in on login
  useEffect(() => {
    if (!featureFlags.timeClock) return;
    if (!user?.id || !tenantId || !session) return;

    // Check if this is a new user login (not just a page refresh)
    const isNewLogin = prevUserId.current !== user.id;
    prevUserId.current = user.id;

    // Only auto-clock-in on new logins
    if (isNewLogin && !hasAutoClocked.current) {
      const autoClockIn = async () => {
        // First check if already clocked in
        const statusResult = await TimeClockService.getTodayEntry(user.id, tenantId);

        if (statusResult.success) {
          setTodayEntry(statusResult.data);

          // Only auto-clock-in if not already clocked in today
          if (!statusResult.data || statusResult.data.status !== 'clocked_in') {
            hasAutoClocked.current = true;
            const clockInResult = await TimeClockService.clockIn(user.id, tenantId);

            if (clockInResult.success) {
              await auditLogger.info('TIME_CLOCK_AUTO_CLOCK_IN', {
                was_on_time: clockInResult.data.was_on_time,
                streak: clockInResult.data.current_streak,
              });
              // Refresh to get updated entry
              await refreshStatus();
            }
          }
        }
      };

      autoClockIn();
    } else if (!isNewLogin && tenantId) {
      // Just refresh status on tenant ID load
      refreshStatus();
    }
  }, [user?.id, tenantId, session, refreshStatus]);

  // Reset auto-clock flag when user logs out
  useEffect(() => {
    if (!user?.id) {
      hasAutoClocked.current = false;
      prevUserId.current = null;
      setTodayEntry(null);
    }
  }, [user?.id]);

  // Initiate logout - shows prompt if clocked in
  const initiateLogout = useCallback(() => {
    if (isClockedIn && featureFlags.timeClock) {
      setShowClockOutPrompt(true);
      setPendingLogout(true);
    } else {
      // Not clocked in, just proceed with logout
      setPendingLogout(true);
      setShowClockOutPrompt(false);
      // Navigate to logout will happen in the component
    }
  }, [isClockedIn]);

  // Confirm logout (with or without clock out)
  const confirmLogout = useCallback(async (shouldClockOut: boolean) => {
    if (shouldClockOut && todayEntry?.id) {
      await clockOut('Shift completed - logged out');
    }
    setShowClockOutPrompt(false);
    // pendingLogout stays true to trigger navigation
  }, [todayEntry?.id, clockOut]);

  // Cancel logout
  const cancelLogout = useCallback(() => {
    setPendingLogout(false);
    setShowClockOutPrompt(false);
  }, []);

  const value: TimeClockContextValue = {
    isClockedIn,
    todayEntry,
    loading,
    tenantId,
    clockIn,
    clockOut,
    refreshStatus,
    pendingLogout,
    showClockOutPrompt,
    confirmLogout,
    cancelLogout,
    initiateLogout,
  };

  return (
    <TimeClockContext.Provider value={value}>
      {children}
    </TimeClockContext.Provider>
  );
};

export function useTimeClock() {
  const ctx = useContext(TimeClockContext);
  if (!ctx) {
    throw new Error('useTimeClock must be used within TimeClockProvider');
  }
  return ctx;
}

// Safe hook that returns null if not within provider (for optional usage)
export function useTimeClockOptional() {
  return useContext(TimeClockContext);
}

export default TimeClockContext;
