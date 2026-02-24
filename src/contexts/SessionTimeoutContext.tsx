// src/contexts/SessionTimeoutContext.tsx
import React, { createContext, useContext, useEffect, useCallback, useRef, useState } from 'react';
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
// - All Users: 30 minutes of inactivity before auto-logout (HIPAA compliant)
// - Staff/Admin: Additional PIN verification at admin panel level
// - Override via VITE_INACTIVITY_TIMEOUT_MS env var if needed
// - Admin-configurable via admin_settings.session_timeout (15/30/60/120 min)
const DEFAULT_TIMEOUT_MS = toMs(import.meta.env.VITE_INACTIVITY_TIMEOUT_MS, 30 * 60 * 1000); // 30 minutes
const DEFAULT_WARNING_MS = toMs(import.meta.env.VITE_TIMEOUT_WARNING_MS, 5 * 60 * 1000);        // 5 minutes warning
const THROTTLE_MS = 500;

// Valid timeout values from admin_settings (minutes)
const VALID_TIMEOUT_MINUTES = [15, 30, 60, 120];

// ---------- types ----------
interface SessionTimeoutContextType {
  resetTimeout: () => void;
}

interface BroadcastMessage {
  type: 'LOGOUT' | 'ACTIVITY';
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
  timeoutMs: propTimeoutMs,
  warningMs = DEFAULT_WARNING_MS,
  onTimeoutWarning,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Dynamic timeout: admin_settings > prop > env > default (30 min)
  const [adminTimeoutMs, setAdminTimeoutMs] = useState<number | null>(null);
  const timeoutMs = adminTimeoutMs ?? propTimeoutMs ?? DEFAULT_TIMEOUT_MS;

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

  const safePostMessage = useCallback((message: BroadcastMessage) => {
    try {
      if (bcRef.current && !isChannelClosedRef.current) {
        bcRef.current.postMessage(message);
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'InvalidStateError') {
        // Channel is closed - mark it as such
        isChannelClosedRef.current = true;
      }
      // Other errors are silently ignored for session management
    }
  }, []);

  const logout = useCallback(async () => {
    const alreadyOnLogin = location.pathname.startsWith('/login');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        // Signout error - handled silently
      }
    } catch (err: unknown) {
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

  // Fetch admin-configured session timeout from admin_settings table
  useEffect(() => {
    let cancelled = false;

    const fetchAdminTimeout = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) return;

        const { data, error } = await supabase
          .from('admin_settings')
          .select('session_timeout')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (cancelled) return;
        if (error || !data?.session_timeout) return; // Keep default

        const minutes = data.session_timeout;
        if (VALID_TIMEOUT_MINUTES.includes(minutes)) {
          setAdminTimeoutMs(minutes * 60 * 1000);
        }
      } catch {
        // Non-critical — fall through to default timeout
      }
    };

    fetchAdminTimeout();

    return () => { cancelled = true; };
  }, []);

  // Init listeners
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window && !bcRef.current) {
      try {
        bcRef.current = new BroadcastChannel('session-timeout');
        isChannelClosedRef.current = false;
      } catch (error: unknown) {

      }
    }

    const windowEvents: (keyof WindowEventMap)[] = [
      'mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll',
    ];

    // Typed as EventListener to avoid any casts in removeEventListener
    const handleActivity: EventListener = () => resetTimeout();

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
      bc.onmessage = (ev: MessageEvent<unknown>) => {
        const data = ev?.data;
        const isBroadcastMessage = (d: unknown): d is BroadcastMessage =>
          typeof d === 'object' && d !== null && 'type' in d &&
          (d.type === 'LOGOUT' || d.type === 'ACTIVITY');
        if (isBroadcastMessage(data)) {
          if (data.type === 'LOGOUT') logout();
          if (data.type === 'ACTIVITY') scheduleTimeouts();
        }
      };
    }

    return () => {
      windowEvents.forEach((evt) => window.removeEventListener(evt, handleActivity));
      document.removeEventListener('visibilitychange', handleVisibility);
      if (bc) {
        bc.onmessage = null;
        try {
          bc.close();
        } catch (error: unknown) {

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <SessionTimeoutContext.Provider value={{ resetTimeout }}>
      {children}
    </SessionTimeoutContext.Provider>
  );
};
