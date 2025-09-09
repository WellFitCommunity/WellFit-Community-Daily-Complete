// src/contexts/AuthContext.tsx
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

  // Convenience (keeps your old call sites working)
  signIn: (opts: { phone?: string; email?: string; password?: string; otp?: string; captchaToken?: string }) => Promise<void>;
  signUp: (opts: { phone?: string; email?: string; password?: string; captchaToken?: string }) => Promise<void>;

  signOut: () => Promise<void>;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // derive admin flag from app_metadata.role === 'admin' OR is_admin === true
  const computeIsAdmin = (u: User | null) => {
    const role = (u?.app_metadata as any)?.role;
    const flag = Boolean((u?.app_metadata as any)?.is_admin);
    return role === 'admin' || flag;
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.error('[Auth] getSession error:', error.message);
        if (!cancelled) {
          setSession(data.session ?? null);
          const u = data.session?.user ?? null;
          setUser(u);
          setIsAdmin(computeIsAdmin(u));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, newSession: Session | null) => {
        setSession(newSession);
        const u = newSession?.user ?? null;
        setUser(u);
        setIsAdmin(computeIsAdmin(u));
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // ---------- Auth API (simple, covers both worlds) ----------

  const signInEmailPassword = async (email: string, password: string) => {
    setLoading(true); setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (e: any) {
      setError(e); throw e;
    } finally { setLoading(false); }
  };

  // Step 1: send OTP (SMS)
  const sendPhoneOtp = async (phone: string, captchaToken?: string) => {
    setLoading(true); setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: captchaToken ? { captchaToken } : undefined,
      });
      if (error) throw error;
    } catch (e: any) {
      setError(e); throw e;
    } finally { setLoading(false); }
  };

  // Step 2: verify OTP
  const verifyPhoneOtp = async (phone: string, token: string) => {
    setLoading(true); setError(null);
    try {
      const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
      if (error) throw error;
    } catch (e: any) {
      setError(e); throw e;
    } finally { setLoading(false); }
  };

  // Backward-compatible helper (routes to the right flow)
  const signIn = async (opts: { phone?: string; email?: string; password?: string; otp?: string; captchaToken?: string }) => {
    const { phone, email, password, otp, captchaToken } = opts || {};
    if (email && password) return signInEmailPassword(email, password);
    if (phone && otp) return verifyPhoneOtp(phone, otp);
    if (phone && !otp) return sendPhoneOtp(phone, captchaToken);
    throw new Error('Provide (email+password) or (phone) or (phone+otp).');
  };

  // Sign up (email/password) OR (phone via OTP)
  const signUp = async (opts: { phone?: string; email?: string; password?: string; captchaToken?: string }) => {
    const { phone, email, password, captchaToken } = opts || {};
    setLoading(true); setError(null);
    try {
      if (email && password) {
        const { error } = await supabase.auth.signUp({ email, password, options: captchaToken ? { captchaToken } : undefined });
        if (error) throw error;
      } else if (phone) {
        // For phone, we use OTP sign-in to provision the user (no password UX).
        const { error } = await supabase.auth.signInWithOtp({ phone, options: captchaToken ? { captchaToken } : undefined });
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
