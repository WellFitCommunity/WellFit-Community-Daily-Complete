// src/contexts/SessionTimeoutContext.tsx
import React, { createContext, useContext, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

// Default timeouts; can override via props or environment variables
const DEFAULT_TIMEOUT_MS = process.env.REACT_APP_INACTIVITY_TIMEOUT_MS
  ? parseInt(process.env.REACT_APP_INACTIVITY_TIMEOUT_MS)
  : 2 * 24 * 60 * 60 * 1000; // 2 days
const DEFAULT_WARNING_MS = process.env.REACT_APP_TIMEOUT_WARNING_MS
  ? parseInt(process.env.REACT_APP_TIMEOUT_WARNING_MS)
  : 5 * 60 * 1000; // 5 minutes before logout
const THROTTLE_MS = 500; // throttle activity events

interface SessionTimeoutContextType {
  /**
   * Manually reset the inactivity timeout (e.g., on user interaction)
   */
  resetTimeout: () => void;
}

const SessionTimeoutContext = createContext<SessionTimeoutContextType | undefined>(undefined);

export const useSessionTimeout = (): SessionTimeoutContextType => {
  const context = useContext(SessionTimeoutContext);
  if (!context) {
    throw new Error('useSessionTimeout must be used within a SessionTimeoutProvider');
  }
  return context;
};

interface SessionTimeoutProviderProps {
  children: React.ReactNode;
  /**
   * Total inactivity timeout before logout
   */
  timeoutMs?: number;
  /**
   * Time before actual logout to trigger warning callback
   */
  warningMs?: number;
  /**
   * Callback invoked warningMs before logout to show a warning UI
   */
  onTimeoutWarning?: () => void;
}

export const SessionTimeoutProvider: React.FC<SessionTimeoutProviderProps> = ({
  children,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  warningMs = DEFAULT_WARNING_MS,
  onTimeoutWarning,
}) => {
  const navigate = useNavigate();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(0);

  const logout = useCallback(async () => {
    console.log('Session timed out. Logging out...');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.error('Error logging out from Supabase:', error);
    } catch (err: any) {
      console.error('Unexpected logout error:', err);
    }
    navigate('/login', { replace: true });
  }, [navigate]);

  const scheduleTimeouts = useCallback(() => {
    // Clear existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);

    // Schedule warning callback
    if (onTimeoutWarning) {
      warningRef.current = setTimeout(
        onTimeoutWarning,
        timeoutMs - warningMs
      );
    }

    // Schedule actual logout
    timeoutRef.current = setTimeout(logout, timeoutMs);
  }, [logout, onTimeoutWarning, timeoutMs, warningMs]);

  /**
   * Public method to reset the inactivity timers
   */
  const resetTimeout = useCallback(() => {
    const now = Date.now();
    if (now - lastActivityRef.current < THROTTLE_MS) return;
    lastActivityRef.current = now;
    scheduleTimeouts();
  }, [scheduleTimeouts]);

  useEffect(() => {
    const activityEvents = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];

    // Reset timers on user activity
    const handleActivity = () => resetTimeout();

    // Initialize timers
    scheduleTimeouts();

    // Attach listeners
    activityEvents.forEach(evt => window.addEventListener(evt, handleActivity));

    return () => {
      // Cleanup on unmount
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      activityEvents.forEach(evt => window.removeEventListener(evt, handleActivity));
    };
  }, [resetTimeout, scheduleTimeouts]);

  return (
    <SessionTimeoutContext.Provider value={{ resetTimeout }}>
      {children}
    </SessionTimeoutContext.Provider>
  );
};
