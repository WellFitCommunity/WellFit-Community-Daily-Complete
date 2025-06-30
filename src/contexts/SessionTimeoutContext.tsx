// src/contexts/SessionTimeoutContext.tsx
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient'; // Assuming supabase is used for logout

const INACTIVITY_TIMEOUT_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

interface SessionTimeoutContextType {
  resetTimeout: () => void;
}

const SessionTimeoutContext = createContext<SessionTimeoutContextType | undefined>(undefined);

export const useSessionTimeout = () => {
  const context = useContext(SessionTimeoutContext);
  if (!context) {
    throw new Error('useSessionTimeout must be used within a SessionTimeoutProvider');
  }
  return context;
};

interface SessionTimeoutProviderProps {
  children: React.ReactNode;
}

export const SessionTimeoutProvider: React.FC<SessionTimeoutProviderProps> = ({ children }) => {
  const navigate = useNavigate();
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  const logout = useCallback(async () => {
    console.log('Session timed out. Logging out...');
    // Clear local storage - REMOVED specific app keys. Supabase signOut handles its own storage.
    // localStorage.removeItem('wellfitUserId'); // Removed
    // localStorage.removeItem('wellfitPhone'); // Removed
    // localStorage.removeItem('wellfitPin'); // Removed
    // localStorage.removeItem('communicationConsent'); // Removed
    // Clear other potential session-related items if any
    // Example: localStorage.removeItem('supabase.auth.token'); // Supabase's signOut should handle this.

    // Sign out from Supabase - this will trigger AuthContext to update state
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error logging out from Supabase:', error);
    }

    // Navigate to login page
    navigate('/login', { replace: true });
  }, [navigate]);

  const resetTimeout = useCallback(() => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }
    timeoutIdRef.current = setTimeout(logout, INACTIVITY_TIMEOUT_MS);
  }, [logout]);

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];

    const handleActivity = () => {
      resetTimeout();
    };

    // Initialize timeout on mount
    resetTimeout();

    events.forEach(event => window.addEventListener(event, handleActivity));

    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      events.forEach(event => window.removeEventListener(event, handleActivity));
    };
  }, [resetTimeout]);

  return (
    <SessionTimeoutContext.Provider value={{ resetTimeout }}>
      {children}
    </SessionTimeoutContext.Provider>
  );
};
