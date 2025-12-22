/**
 * Envision Auth Context
 *
 * Manages authentication state for Envision portal (super admin access).
 * Uses envision_sessions table via Edge Functions, independent of Supabase JWT auth.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';

interface EnvisionUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  permissions: string[];
}

interface EnvisionAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: EnvisionUser | null;
  sessionToken: string | null;
  error: string | null;
}

interface EnvisionAuthContextType extends EnvisionAuthState {
  login: (sessionToken: string, user?: Partial<EnvisionUser>) => void;
  logout: () => Promise<void>;
  validateSession: () => Promise<boolean>;
}

const STORAGE_KEY = 'envision_session';
const STORAGE_USER_KEY = 'envision_user';

const EnvisionAuthContext = createContext<EnvisionAuthContextType | null>(null);

export function EnvisionAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EnvisionAuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    sessionToken: null,
    error: null
  });

  // Validate session on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem(STORAGE_KEY);
      const storedUser = localStorage.getItem(STORAGE_USER_KEY);

      if (!storedToken) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Validate the session token
      try {
        const { data, error } = await supabase.functions.invoke('envision-verify-pin', {
          body: {
            session_token: storedToken,
            validate_only: true  // Just validate, don't verify PIN
          }
        });

        if (error || !data?.valid) {
          // Invalid session, clear storage
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(STORAGE_USER_KEY);
          setState(prev => ({ ...prev, isLoading: false }));
          return;
        }

        // Valid session
        const user = storedUser ? JSON.parse(storedUser) : data.user;
        setState({
          isAuthenticated: true,
          isLoading: false,
          user,
          sessionToken: storedToken,
          error: null
        });
      } catch (err: unknown) {
        // Session validation failed, but don't block - allow re-login
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_USER_KEY);
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    initAuth();
  }, []);

  const login = useCallback((sessionToken: string, user?: Partial<EnvisionUser>) => {
    localStorage.setItem(STORAGE_KEY, sessionToken);

    const fullUser: EnvisionUser = {
      id: user?.id || '',
      email: user?.email || '',
      full_name: user?.full_name || '',
      role: user?.role || 'super_admin',
      permissions: user?.permissions || []
    };

    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(fullUser));

    setState({
      isAuthenticated: true,
      isLoading: false,
      user: fullUser,
      sessionToken,
      error: null
    });
  }, []);

  const logout = useCallback(async () => {
    const token = localStorage.getItem(STORAGE_KEY);

    // End session on server
    if (token) {
      try {
        await supabase.functions.invoke('admin_end_session', {
          body: { session_token: token }
        });
      } catch {
        // Ignore errors - still clear local state
      }
    }

    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
    localStorage.removeItem('envision_totp_verified');

    setState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      sessionToken: null,
      error: null
    });
  }, []);

  const validateSession = useCallback(async (): Promise<boolean> => {
    const token = localStorage.getItem(STORAGE_KEY);
    if (!token) return false;

    try {
      const { data, error } = await supabase.functions.invoke('envision-verify-pin', {
        body: {
          session_token: token,
          validate_only: true
        }
      });

      return !error && data?.valid === true;
    } catch {
      return false;
    }
  }, []);

  return (
    <EnvisionAuthContext.Provider value={{ ...state, login, logout, validateSession }}>
      {children}
    </EnvisionAuthContext.Provider>
  );
}

export function useEnvisionAuth() {
  const context = useContext(EnvisionAuthContext);
  if (!context) {
    throw new Error('useEnvisionAuth must be used within an EnvisionAuthProvider');
  }
  return context;
}

// Optional hook for just checking if user is authenticated (non-throwing)
export function useEnvisionUser(): EnvisionUser | null {
  const context = useContext(EnvisionAuthContext);
  return context?.user || null;
}
