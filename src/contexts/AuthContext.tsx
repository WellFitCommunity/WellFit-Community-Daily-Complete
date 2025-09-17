// src/contexts/AuthContext.tsx — PRODUCTION-READY (roles-based admin)
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

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
  isAdmin: boolean; // computed from metadata + DB user_roles
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ---- helpers ----
function metaIsAdmin(u: User | null): boolean {
  if (!u) return false;
  const app: any = u.app_metadata || {};
  const usr: any = u.user_metadata || {};
  return Boolean(
    app.role === 'admin' ||
    app.role === 'super_admin' ||
    app.is_admin === true ||
    usr.role === 'admin' ||
    usr.role === 'super_admin'
  );
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [metaAdmin, setMetaAdmin] = useState(false);
  const [dbAdmin, setDbAdmin] = useState<boolean | null>(null); // null = unknown, true/false when known

  async function refreshDbRoles(u: User | null) {
    try {
      if (!u?.id) {
        setDbAdmin(null);
        return;
      }
      // Expect table: public.user_roles(user_id uuid, role text) with RLS allowing self-read
      const { data, error: selErr } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', u.id);

      if (selErr) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Auth] user_roles fetch failed:', selErr.message);
        }
        setDbAdmin(null);
        return;
      }

      const roles = (data || []).map((r: any) => String(r.role));
      const hasAdmin = roles.includes('admin') || roles.includes('super_admin');
      setDbAdmin(hasAdmin);
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Auth] refreshDbRoles exception:', e);
      }
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
        if (error && process.env.NODE_ENV !== 'production') {
          console.error('[Auth] getSession error:', error.message);
        }
        if (cancelled) return;

        const s = data?.session ?? null;
        const u = s?.user ?? null;

        setSession(s);
        setUser(u);
        const m = metaIsAdmin(u);
        setMetaAdmin(m);
        refreshDbRoles(u); // async, non-blocking
      } catch (e: any) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // Subscribe to auth changes
    const { data: sub } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, newSession: Session | null) => {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[Auth] State change:', event, Boolean(newSession));
        }
        const u = newSession?.user ?? null;
        setSession(newSession);
        setUser(u);
        const m = metaIsAdmin(u);
        setMetaAdmin(m);
        refreshDbRoles(u);
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') setError(null);
      }
    );

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe?.();
      // @ts-ignore different bundle shapes
      sub?.unsubscribe?.();
    };
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
    } catch (e: any) {
      setError(e); throw e;
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
    } catch (e: any) {
      setError(e); throw e;
    } finally { setLoading(false); }
  };

  const verifyPhoneOtp = async (phone: string, token: string) => {
    setLoading(true); setError(null);
    try {
      const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
      if (error) throw error;
    } catch (e: any) {
      setError(e); throw e;
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
    } catch (e: any) {
      setError(e); throw e;
    } finally { setLoading(false); }
  };

  const signOut = async () => {
    setLoading(true); setError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (e: any) {
      setError(e); throw e;
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
  }), [session, user, loading, error, isAdmin]);

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
