// src/contexts/SessionTimeoutContext.tsx
import React, { createContext, useContext, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

// ---------- helpers ----------
const toMs = (val: string | undefined, fallback: number) => {
  if (!val) return fallback;
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// SOC2-Compliant Session Timeouts
// CC6.1: Reasonable session timeout periods to prevent unauthorized access
// - Standard Users: 20 minutes - enhanced security for healthcare B2B2C platform
// - Staff/Admin: 30 minutes enforced at admin PIN level (see verify-admin-pin Edge Function)
const DEFAULT_TIMEOUT_MS = toMs(process.env.REACT_APP_INACTIVITY_TIMEOUT_MS, 20 * 60 * 1000); // 20 minutes
const DEFAULT_WARNING_MS = toMs(process.env.REACT_APP_TIMEOUT_WARNING_MS, 5 * 60 * 1000);         // 5 minutes
const THROTTLE_MS = 500;

// ---------- types ----------
interface SessionTimeoutContextType {
  resetTimeout: () => void;
}

const SessionTimeoutContext = createContext<SessionTimeoutContextType | undefined>(undefined);

export const useSessionTimeout = (): SessionTimeoutContextType => {
  const ctx = useContext(SessionTimeoutContext);
  if (!ctx) throw new Error('useSessionTimeout must be used within a SessionTimeoutProvider');
  return ctx;
};

interface SessionTimeoutProviderProps {
  children: React.ReactNode;
  timeoutMs?: number;
  warningMs?: number;
  onTimeoutWarning?: () => void;
}

export const SessionTimeoutProvider: React.FC<SessionTimeoutProviderProps> = ({
  children,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  warningMs = DEFAULT_WARNING_MS,
  onTimeoutWarning,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(0);
  const isAuthedRef = useRef<boolean>(false);

  const bcRef = useRef<BroadcastChannel | null>(null);
  const isChannelClosedRef = useRef<boolean>(false);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    timeoutRef.current = null;
    warningRef.current = null;
  }, []);

  const safePostMessage = useCallback((message: any) => {
    try {
      if (bcRef.current && !isChannelClosedRef.current) {
        bcRef.current.postMessage(message);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'InvalidStateError') {

        isChannelClosedRef.current = true;
      } else {

      }
    }
  }, []);

  const logout = useCallback(async () => {
    const alreadyOnLogin = location.pathname.startsWith('/login');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        // Signout error - handled silently
      }
    } catch (err) {
      // Signout error - handled silently
    }
    safePostMessage({ type: 'LOGOUT' });
    if (!alreadyOnLogin) navigate('/login', { replace: true });
  }, [navigate, location.pathname, safePostMessage]);

  const scheduleTimeouts = useCallback(() => {
    clearTimers();
    if (!isAuthedRef.current) return;

    const effectiveWarning =
      typeof warningMs === 'number' && warningMs > 0 && warningMs < timeoutMs ? warningMs : 0;

    if (onTimeoutWarning && effectiveWarning > 0) {
      warningRef.current = setTimeout(onTimeoutWarning, timeoutMs - effectiveWarning);
    }

    timeoutRef.current = setTimeout(logout, timeoutMs);
  }, [logout, onTimeoutWarning, timeoutMs, warningMs, clearTimers]);

  const resetTimeout = useCallback(() => {
    if (!isAuthedRef.current) return;
    const now = Date.now();
    if (now - lastActivityRef.current < THROTTLE_MS) return;
    lastActivityRef.current = now;

    scheduleTimeouts();
    safePostMessage({ type: 'ACTIVITY' });
  }, [scheduleTimeouts, safePostMessage]);

  // Init listeners
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window && !bcRef.current) {
      try {
        bcRef.current = new BroadcastChannel('session-timeout');
        isChannelClosedRef.current = false;
      } catch (error) {

      }
    }

    const windowEvents: (keyof WindowEventMap)[] = [
      'mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll',
    ];

    const handleActivity = () => resetTimeout();

    // Window activity listeners
    windowEvents.forEach((evt) =>
      window.addEventListener(evt, handleActivity, { passive: evt !== 'keypress' })
    );

    // Document visibility (separate target & typing)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') resetTimeout();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // BroadcastChannel listeners
    const bc = bcRef.current;
    if (bc) {
      bc.onmessage = (ev) => {
        const type = (ev?.data && (ev.data as any).type) as 'LOGOUT' | 'ACTIVITY' | undefined;
        if (type === 'LOGOUT') logout();
        if (type === 'ACTIVITY') scheduleTimeouts();
      };
    }

    return () => {
      windowEvents.forEach((evt) => window.removeEventListener(evt, handleActivity as any));
      document.removeEventListener('visibilitychange', handleVisibility);
      if (bc) {
        bc.onmessage = null;
        try {
          bc.close();
        } catch (error) {

        }
        isChannelClosedRef.current = true;
      }
      clearTimers();
    };
  }, [resetTimeout, scheduleTimeouts, logout, clearTimers]);

  // Start/stop timers based on Supabase auth
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      isAuthedRef.current = !!data.session;
      clearTimers();
      if (isAuthedRef.current) scheduleTimeouts();
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      isAuthedRef.current = !!s;
      clearTimers();
      if (isAuthedRef.current) scheduleTimeouts();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [scheduleTimeouts, clearTimers]);

  // Treat route changes as activity
  useEffect(() => {
    resetTimeout();
     
  }, [location.pathname]);

  return (
    <SessionTimeoutContext.Provider value={{ resetTimeout }}>
      {children}
    </SessionTimeoutContext.Provider>
  );
};
