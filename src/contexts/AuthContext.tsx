// src/contexts/AuthContext.tsx — PRODUCTION-READY (centralized role authority)
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { auditLogger } from '../services/auditLogger';
import { resetAuthFailureFlag } from '../lib/authAwareFetch';
import {
  checkAdminFromMetadata,
  checkAdminFromUserRoles,
  type UserRoleData,
} from '../lib/roleAuthority';

type AuthContextValue = {
  supabase: typeof supabase;
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: Error | null;

  // Admin email/password
  signInEmailPassword: (email: string, password: string) => Promise<void>;

  // Phone OTP (seniors/admins)
  sendPhoneOtp: (phone: string, captchaToken?: string) => Promise<void>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<void>;

  // Convenience
  signIn: (opts: { phone?: string; email?: string; password?: string; otp?: string; captchaToken?: string }) => Promise<void>;
  signUp: (opts: { phone?: string; email?: string; password?: string; captchaToken?: string }) => Promise<void>;

  signOut: () => Promise<void>;
  isAdmin: boolean; // computed from DB user_roles (authoritative) + metadata fallback

  // Error handling
  handleAuthError: (error: unknown) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ---- helpers using centralized role authority ----
function metaIsAdmin(u: User | null): boolean {
  if (!u) return false;
  const app = (u.app_metadata || {}) as Record<string, unknown>;
  const usr = (u.user_metadata || {}) as Record<string, unknown>;
  return checkAdminFromMetadata(app, usr);
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [metaAdmin, setMetaAdmin] = useState(false);
  const [dbAdmin, setDbAdmin] = useState<boolean | null>(null); // null = unknown, true/false when known

  // Handle session expiry gracefully
  const handleSessionExpiry = React.useCallback(async () => {
    try {
      auditLogger.auth('LOGOUT', true, { reason: 'session_expiry', action: 'clearing_auth_state' });

      // Clear all auth state
      setSession(null);
      setUser(null);
      setMetaAdmin(false);
      setDbAdmin(null);
      setError(null);

      // Clear auth tokens from localStorage (where Supabase stores them)
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Also clear any legacy sessionStorage keys (from previous HIPAA config)
      const sessionKeysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('sb-')) {
          sessionKeysToRemove.push(key);
        }
      }
      sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));

      // Sign out cleanly from Supabase
      await supabase.auth.signOut({ scope: 'local' });

      // Redirect to login if not already there
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/register' && currentPath !== '/') {
        auditLogger.auth('LOGOUT', true, { reason: 'session_expiry', action: 'redirect_to_login', from_path: currentPath });
        window.location.href = '/login';
      }
    } catch (error) {
      auditLogger.error('SESSION_EXPIRY_HANDLING_FAILED', error instanceof Error ? error : new Error(String(error)));
      // Force redirect even if cleanup fails
      window.location.href = '/login';
    }
  }, []);

  // Global error handler for auth-related errors
  const handleAuthError = React.useCallback(async (error: unknown) => {
    const err = error as { message?: string; status?: number } | null;
    const errorMessage = err?.message || '';

    if (errorMessage.includes('Invalid Refresh Token') ||
        errorMessage.includes('Session Expired') ||
        errorMessage.includes('Revoked by Newer Login') ||
        err?.status === 400) {
      await handleSessionExpiry();
      return true; // Handled
    }

    return false; // Not handled
  }, [handleSessionExpiry]);

  async function refreshDbRoles(u: User | null) {
    try {
      if (!u?.id) {
        setDbAdmin(null);
        return;
      }
      // Fetch from user_roles table (authoritative source)
      const { data, error: selErr } = await supabase
        .from('user_roles')
        .select('role, created_at')
        .eq('user_id', u.id);

      if (selErr) {
        // Check if this is a session expiry error
        if (selErr.message?.includes('Invalid Refresh Token') ||
            selErr.message?.includes('Session Expired') ||
            selErr.code === 'PGRST301') {
          await handleSessionExpiry();
          return;
        }

        auditLogger.warn('USER_ROLES_FETCH_FAILED', { error: selErr.message, userId: u.id });
        setDbAdmin(null);
        return;
      }

      // Use centralized role authority to check admin access
      const userRoles = (data || []) as UserRoleData[];
      const hasAdmin = checkAdminFromUserRoles(userRoles);
      setDbAdmin(hasAdmin);
    } catch (e: unknown) {
      const err = e as { message?: string } | null;
      // Check if this is a session expiry error
      if (err?.message?.includes('Invalid Refresh Token') ||
          err?.message?.includes('Session Expired')) {
        await handleSessionExpiry();
        return;
      }

      auditLogger.warn('REFRESH_DB_ROLES_EXCEPTION', { error: err?.message });
      setDbAdmin(null);
    }
  }


  // Initial session
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.auth.getSession();

        // Handle session expiry errors during initial load
        if (error) {
          if (error.message?.includes('Invalid Refresh Token') ||
              error.message?.includes('Session Expired')) {
            await handleSessionExpiry();
            return;
          }

          auditLogger.error('AUTH_GET_SESSION_ERROR', new Error(error.message), { context: 'initial_load' });
        }

        if (cancelled) return;

        const s = data?.session ?? null;
        const u = s?.user ?? null;

        setSession(s);
        setUser(u);
        const m = metaIsAdmin(u);
        setMetaAdmin(m);
        refreshDbRoles(u); // async, non-blocking
      } catch (e: unknown) {
        const err = e as { message?: string } | null;
        // Handle session expiry errors in catch block too
        if (err?.message?.includes('Invalid Refresh Token') ||
            err?.message?.includes('Session Expired')) {
          if (!cancelled) await handleSessionExpiry();
          return;
        }

        if (!cancelled) setError(e as Error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // Subscribe to auth changes
    const { data: sub } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, newSession: Session | null) => {
        auditLogger.debug(`Auth state change: ${event}`, { hasSession: Boolean(newSession) });

        // Handle session expiry/refresh token errors
        if (event === 'TOKEN_REFRESHED' && !newSession) {
          auditLogger.auth('LOGOUT', false, { reason: 'token_refresh_failed', event });
          await handleSessionExpiry();
          return;
        }

        if (event === 'SIGNED_OUT' && session) {
          // Clear any stored tokens on explicit sign out
          localStorage.removeItem('supabase.auth.token');
          sessionStorage.removeItem('supabase.auth.token');
        }

        const u = newSession?.user ?? null;
        setSession(newSession);
        setUser(u);
        const m = metaIsAdmin(u);
        setMetaAdmin(m);
        refreshDbRoles(u);
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setError(null);
          // Reset auth failure flag so future failures can be handled
          resetAuthFailureFlag();
        }
      }
    );

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe?.();
      // @ts-ignore different bundle shapes
      sub?.unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Final isAdmin: DB (when known) overrides metadata
  const isAdmin = dbAdmin === null ? metaAdmin : dbAdmin;

  // ---------- Auth API ----------

  const signInEmailPassword = async (email: string, password: string) => {
    setLoading(true); setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
    } catch (e: unknown) {
      setError(e as Error); throw e;
    } finally { setLoading(false); }
  };

  const sendPhoneOtp = async (phone: string, captchaToken?: string) => {
    setLoading(true); setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: { channel: 'sms', ...(captchaToken ? { captchaToken } : {}) },
      });
      if (error) throw error;
    } catch (e: unknown) {
      setError(e as Error); throw e;
    } finally { setLoading(false); }
  };

  const verifyPhoneOtp = async (phone: string, token: string) => {
    setLoading(true); setError(null);
    try {
      const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
      if (error) throw error;
    } catch (e: unknown) {
      setError(e as Error); throw e;
    } finally { setLoading(false); }
  };

  const signIn = async (opts: { phone?: string; email?: string; password?: string; otp?: string; captchaToken?: string }) => {
    const { phone, email, password, otp, captchaToken } = opts || {};
    if (email && password) return signInEmailPassword(email, password);
    if (phone && otp) return verifyPhoneOtp(phone, otp);
    if (phone && !otp) return sendPhoneOtp(phone, captchaToken);
    throw new Error('Provide (email+password) or (phone) or (phone+otp).');
  };

  const signUp = async (opts: { phone?: string; email?: string; password?: string; captchaToken?: string }) => {
    const { phone, email, password, captchaToken } = opts || {};
    setLoading(true); setError(null);
    try {
      if (email && password) {
        const { error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: captchaToken ? { captchaToken } : undefined,
        });
        if (error) throw error;
      } else if (phone) {
        const { error } = await supabase.auth.signInWithOtp({
          phone,
          options: { channel: 'sms', ...(captchaToken ? { captchaToken } : {}) },
        });
        if (error) throw error;
      } else {
        throw new Error('Provide (email+password) or (phone).');
      }
    } catch (e: unknown) {
      setError(e as Error); throw e;
    } finally { setLoading(false); }
  };

  const signOut = async () => {
    setLoading(true); setError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (e: unknown) {
      setError(e as Error); throw e;
    } finally { setLoading(false); }
  };

  const value = useMemo<AuthContextValue>(() => ({
    supabase,
    session,
    user,
    loading,
    error,
    signInEmailPassword,
    sendPhoneOtp,
    verifyPhoneOtp,
    signIn,
    signUp,
    signOut,
    isAdmin,
    handleAuthError,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [session, user, loading, error, isAdmin, handleAuthError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ----- Hooks -----
export function useSupabaseClient() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useSupabaseClient must be used within <AuthProvider>');
  return ctx.supabase;
}
export function useSession() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useSession must be used within <AuthProvider>');
  return ctx.session;
}
export function useUser() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useUser must be used within <AuthProvider>');
  return ctx.user;
}
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

// Helper hook for automatic auth error handling
export function useAuthErrorHandler() {
  const { handleAuthError } = useAuth();

  return React.useCallback(async (error: unknown) => {
    const handled = await handleAuthError(error);
    if (!handled) {
      // If not an auth error, rethrow for normal error handling
      throw error;
    }
  }, [handleAuthError]);
}

// Higher-order function to wrap API calls with auth error handling
export function withAuthErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(fn: T): T {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (error: unknown) {
      const err = error as { message?: string; status?: number } | null;
      // Check if this looks like an auth error
      const errorMessage = err?.message || '';
      if (errorMessage.includes('Invalid Refresh Token') ||
          errorMessage.includes('Session Expired') ||
          errorMessage.includes('Revoked by Newer Login') ||
          err?.status === 400) {

        // Try to get auth context
        try {
          const authContext = document.querySelector('[data-auth-provider]') as HTMLElement & { _authContext?: { handleAuthError?: (e: unknown) => Promise<boolean> } } | null;
          if (authContext?._authContext?.handleAuthError) {
            const handled = await authContext._authContext.handleAuthError(error);
            if (handled) return;
          }
        } catch (e) {
          auditLogger.warn('AUTH_ERROR_HANDLER_UNAVAILABLE', { error: e instanceof Error ? e.message : String(e) });
        }

        // Fallback: clear storage and redirect
        localStorage.removeItem('supabase.auth.token');
        sessionStorage.removeItem('supabase.auth.token');
        window.location.href = '/login';
        return;
      }

      throw error;
    }
  }) as T;
}
