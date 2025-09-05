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

// Defaults (safe fallbacks)
const DEFAULT_TIMEOUT_MS = toMs(process.env.REACT_APP_INACTIVITY_TIMEOUT_MS, 2 * 24 * 60 * 60 * 1000); // 2 days
const DEFAULT_WARNING_MS = toMs(process.env.REACT_APP_TIMEOUT_WARNING_MS, 5 * 60 * 1000);              // 5 minutes
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
  timeoutMs?: number;          // total inactivity before logout
  warningMs?: number;          // time before logout to trigger a warning
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

  // Use browser-safe timer types
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(0);

  // Multi-tab sync
  const bcRef = useRef<BroadcastChannel | null>(null);
  if (typeof window !== 'undefined' && !bcRef.current && 'BroadcastChannel' in window) {
    bcRef.current = new BroadcastChannel('session-timeout');
  }

  const clearTimers = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    timeoutRef.current = null;
    warningRef.current = null;
  };

  const logout = useCallback(async () => {
    // Avoid loops: if already on /login, skip navigating again
    const alreadyOnLogin = location.pathname.startsWith('/login');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.error('Supabase signOut error:', error);
    } catch (err) {
      console.error('Unexpected logout error:', err);
    }
    // Tell other tabs
    bcRef.current?.postMessage({ type: 'LOGOUT' });
    if (!alreadyOnLogin) navigate('/login', { replace: true });
  }, [navigate, location.pathname]);

  const scheduleTimeouts = useCallback(() => {
    clearTimers();

    // Guard invalid combos
    const effectiveWarning =
      typeof warningMs === 'number' && warningMs > 0 && warningMs < timeoutMs ? warningMs : 0;

    if (onTimeoutWarning && effectiveWarning > 0) {
      warningRef.current = setTimeout(onTimeoutWarning, timeoutMs - effectiveWarning);
    }

    timeoutRef.current = setTimeout(logout, timeoutMs);
  }, [logout, onTimeoutWarning, timeoutMs, warningMs]);

  const resetTimeout = useCallback(() => {
    const now = Date.now();
    if (now - lastActivityRef.current < THROTTLE_MS) return;
    lastActivityRef.current = now;

    scheduleTimeouts();
    // Let other tabs know there was activity (optional; comment out if you don't want cross-tab resets)
    bcRef.current?.postMessage({ type: 'ACTIVITY' });
  }, [scheduleTimeouts]);

  useEffect(() => {
    const activityEvents: (keyof WindowEventMap)[] = [
      'mousemove',
      'mousedown',
      'keypress',
      'touchstart',
      'scroll',
    ];

    const handleActivity = () => resetTimeout();

    // Start timers
    scheduleTimeouts();

    // Attach listeners (passive where it makes sense)
    activityEvents.forEach((evt) =>
      window.addEventListener(evt, handleActivity, { passive: evt !== 'keypress' })
    );

    // BroadcastChannel listeners
    const bc = bcRef.current;
    if (bc) {
      bc.onmessage = (ev) => {
        if (!ev?.data) return;
        const { type } = ev.data as { type: 'LOGOUT' | 'ACTIVITY' };
        if (type === 'LOGOUT') logout();
        if (type === 'ACTIVITY') scheduleTimeouts();
      };
    }

    return () => {
      clearTimers();
      activityEvents.forEach((evt) => window.removeEventListener(evt, handleActivity as any));
      if (bc) bc.onmessage = null;
    };
  }, [resetTimeout, scheduleTimeouts, logout]);

  return (
    <SessionTimeoutContext.Provider value={{ resetTimeout }}>
      {children}
    </SessionTimeoutContext.Provider>
  );
};
