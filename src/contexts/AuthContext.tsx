import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: Error | null;
  signIn: (options: { phone?: string; email?: string; password: string }) => Promise<void>;
  signUp: (options: { phone?: string; email?: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Load initial session and user
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsAdmin(!!session?.user?.app_metadata?.is_admin);
      })
      .catch(err => setError(err))
      .finally(() => setInitializing(false));

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsAdmin(!!session?.user?.app_metadata?.is_admin);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async ({ phone, email, password }: { phone?: string; email?: string; password: string }) => {
    setInitializing(true);
    setError(null);
    try {
      let res;
      if (phone && !email) {
        res = await supabase.auth.signInWithPassword({ phone, password });
      } else if (email) {
        res = await supabase.auth.signInWithPassword({ email, password });
      } else {
        throw new Error('Email or phone is required for sign in');
      }
      if (res.error) throw res.error;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setInitializing(false);
    }
  };

  const signUp = async ({ phone, email, password }: { phone?: string; email?: string; password: string }) => {
    setInitializing(true);
    setError(null);
    try {
      let res;
      if (phone && !email) {
        res = await supabase.auth.signUp({ phone, password });
      } else if (email) {
        res = await supabase.auth.signUp({ email, password });
      } else {
        throw new Error('Email or phone is required for sign up');
      }
      if (res.error) throw res.error;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setInitializing(false);
    }
  };

  const signOut = async () => {
    setInitializing(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setInitializing(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, session, isLoading: initializing, error, signIn, signUp, signOut, isAdmin }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
