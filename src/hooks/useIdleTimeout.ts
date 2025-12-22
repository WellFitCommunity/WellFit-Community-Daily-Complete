/**
 * useIdleTimeout Hook
 *
 * Auto-logout after period of inactivity for HIPAA compliance.
 * Tracks user activity (mouse, keyboard, touch, scroll) and
 * logs out when idle timeout is reached.
 *
 * Features:
 * - Configurable timeout (default 15 minutes)
 * - Warning modal before logout (default 2 minutes before)
 * - Activity tracking across mouse, keyboard, touch, scroll
 * - Persists last activity time to handle page refreshes
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { auditLogger } from '../services/auditLogger';

// Configuration
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_BEFORE_MS = 2 * 60 * 1000; // Show warning 2 minutes before logout
const ACTIVITY_THROTTLE_MS = 30 * 1000; // Only update activity timestamp every 30 seconds
const LAST_ACTIVITY_KEY = 'wf_last_activity';

interface UseIdleTimeoutOptions {
  /** Timeout in milliseconds before auto-logout (default: 15 min) */
  timeoutMs?: number;
  /** Time before logout to show warning (default: 2 min) */
  warningBeforeMs?: number;
  /** Whether idle timeout is enabled (default: true when logged in) */
  enabled?: boolean;
  /** Callback when warning should be shown */
  onWarning?: (secondsRemaining: number) => void;
  /** Callback when user is logged out due to idle */
  onLogout?: () => void;
}

interface UseIdleTimeoutReturn {
  /** Whether the warning modal should be shown */
  showWarning: boolean;
  /** Seconds remaining before logout (only valid when showWarning is true) */
  secondsRemaining: number;
  /** Call this to extend the session (e.g., when user clicks "Stay Logged In") */
  extendSession: () => void;
  /** Call this to immediately logout */
  logoutNow: () => void;
}

export function useIdleTimeout(options: UseIdleTimeoutOptions = {}): UseIdleTimeoutReturn {
  const {
    timeoutMs = IDLE_TIMEOUT_MS,
    warningBeforeMs = WARNING_BEFORE_MS,
    enabled = true,
    onWarning,
    onLogout,
  } = options;

  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  const lastActivityRef = useRef<number>(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const throttleRef = useRef<number>(0);

  // Update last activity timestamp
  const updateActivity = useCallback(() => {
    const now = Date.now();

    // Throttle updates to avoid excessive writes
    if (now - throttleRef.current < ACTIVITY_THROTTLE_MS) {
      return;
    }

    throttleRef.current = now;
    lastActivityRef.current = now;
    localStorage.setItem(LAST_ACTIVITY_KEY, String(now));

    // If warning is showing and user is active, hide it and reset
    if (showWarning) {
      setShowWarning(false);
      setSecondsRemaining(0);
    }
  }, [showWarning]);

  // Perform logout
  const performLogout = useCallback(async () => {
    auditLogger.auth('LOGOUT', true, { reason: 'idle_timeout', idleMinutes: timeoutMs / 60000 });

    // Clear the activity timestamp
    localStorage.removeItem(LAST_ACTIVITY_KEY);

    // Sign out from Supabase
    try {
      await supabase.auth.signOut();
    } catch (error) {
      auditLogger.error('IDLE_LOGOUT_ERROR', error instanceof Error ? error : new Error(String(error)));
    }

    // Call custom callback if provided
    onLogout?.();

    // Navigate to login with message
    navigate('/login', {
      state: {
        message: 'You were logged out due to inactivity. Please log in again.'
      },
      replace: true
    });
  }, [navigate, onLogout, timeoutMs]);

  // Extend session (called when user clicks "Stay Logged In")
  const extendSession = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    setShowWarning(false);
    setSecondsRemaining(0);
    auditLogger.info('SESSION_EXTENDED', { reason: 'user_action' });
  }, []);

  // Immediate logout
  const logoutNow = useCallback(() => {
    setShowWarning(false);
    performLogout();
  }, [performLogout]);

  // Check idle status
  const checkIdleStatus = useCallback(() => {
    // Get last activity from localStorage (handles page refresh)
    const storedActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    const lastActivity = storedActivity
      ? parseInt(storedActivity, 10)
      : lastActivityRef.current;

    const now = Date.now();
    const idleTime = now - lastActivity;
    const timeUntilLogout = timeoutMs - idleTime;

    if (timeUntilLogout <= 0) {
      // Time's up - logout
      performLogout();
    } else if (timeUntilLogout <= warningBeforeMs) {
      // Show warning
      const seconds = Math.ceil(timeUntilLogout / 1000);
      setSecondsRemaining(seconds);
      setShowWarning(true);
      onWarning?.(seconds);
    }
  }, [timeoutMs, warningBeforeMs, performLogout, onWarning]);

  // Set up activity listeners and timeout checker
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Initialize last activity
    const storedActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!storedActivity) {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    }

    // Activity events to track
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    // Check idle status every 10 seconds
    timeoutRef.current = setInterval(checkIdleStatus, 10000);

    // Update countdown every second when warning is shown
    warningIntervalRef.current = setInterval(() => {
      if (showWarning) {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            performLogout();
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity);
      });

      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
      }
      if (warningIntervalRef.current) {
        clearInterval(warningIntervalRef.current);
      }
    };
  }, [enabled, updateActivity, checkIdleStatus, showWarning, performLogout]);

  return {
    showWarning,
    secondsRemaining,
    extendSession,
    logoutNow,
  };
}

export default useIdleTimeout;
