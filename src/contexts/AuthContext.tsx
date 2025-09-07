// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient'; // ✅ fix the import

type AuthContextValue = {
  supabase: typeof supabase;
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: Error | null;
  signIn: (opts: { phone?: string; email?: string; password: string }) => Promise<void>;
  signUp: (opts: { phone?: string; email?: string; password: string }) => Promise<void>;
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

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.error('[Auth] getSession error:', error.message);
        if (!cancelled) {
          setSession(data.session ?? null);
          setUser(data.session?.user ?? null);
          setIsAdmin(!!data.session?.user?.app_metadata?.is_admin);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();

    // ✅ correct return shape & unsubscribe
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, newSession: Session | null) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setIsAdmin(!!newSession?.user?.app_metadata?.is_admin);
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async ({ phone, email, password }: { phone?: string; email?: string; password: string }) => {
    setLoading(true);
    setError(null);
    try {
      const res = email
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signInWithPassword({ phone: phone!, password });
      if (res.error) throw res.error;
    } catch (e: any) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async ({ phone, email, password }: { phone?: string; email?: string; password: string }) => {
    setLoading(true);
    setError(null);
    try {
      const res = email
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signUp({ phone: phone!, password });
      if (res.error) throw res.error;
    } catch (e: any) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (e: any) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      supabase,
      session,
      user,
      loading,
      error,
      signIn,
      signUp,
      signOut,
      isAdmin,
    }),
    [session, user, loading, error, isAdmin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ----- Hooks expected across your app (drop-in replacements) ----------------
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
