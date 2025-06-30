import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient'; // Ensure this path is correct

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isAdmin: boolean; // Simple admin flag for now
  isLoading: boolean;
  login: (phone_number: string, password_str: string) => Promise<void>;
  adminLogin: (admin_key: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false); // Basic admin state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log('Auth state change event:', _event, session);
        setSession(session);
        setUser(session?.user ?? null);
        // Admin status will be determined by the nature of the session or a specific admin login flow.
        // If the session's user has admin privileges (e.g. via custom claims), set isAdmin.
        // For now, isAdmin is primarily managed by the adminLogin function's success.
        // It will not persist across page refreshes without a JWT that reflects admin status.
        if (session?.user?.app_metadata?.role === 'admin') { // Example: checking custom claims
            setIsAdmin(true);
        } else {
            // If not explicitly an admin session, ensure isAdmin is false,
            // unless adminLogin just set it. This part is tricky without persisted admin state.
            // The adminLogin function will explicitly set isAdmin.
            // Here, we mostly handle transitions away from admin state if the session changes to non-admin.
            if (!session && isAdmin) { // If session is lost, and user was admin, reset.
                 // setIsAdmin(false); // This might be too aggressive if admin state is purely component-driven after adminLogin
            }
        }
        setUser(session?.user ?? null);
        setSession(session);
        setIsLoading(false);
      }
    );

    // Check initial session
    const checkInitialSession = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      // Check if the initial session user has admin privileges
      if (initialSession?.user?.app_metadata?.role === 'admin') {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
      setIsLoading(false);
    };
    checkInitialSession();

    return () => {
      authListener?.unsubscribe();
    };
  }, []);

  const clearError = () => setError(null);

  const login = async (phone_number: string, password_str: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/functions/v1/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone_number, password: password_str }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Login failed');
      }

      if (result.data && result.data.token && result.data.refreshToken) {
        // Set the session for the Supabase client
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: result.data.token,
          refresh_token: result.data.refreshToken,
        });
        if (sessionError) {
          console.error("Error setting session in Supabase client:", sessionError);
          throw new Error("Failed to initialize session with Supabase.");
        }
        // The onAuthStateChange listener should pick up the new session.
        // setUser(result.data.user); // User object might come from setSession via onAuthStateChange
        // setSession(result.data.session); // Session object might come from setSession via onAuthStateChange
        setIsAdmin(false); // Ensure admin is false on normal user login
        // localStorage.removeItem('isAdminSession'); // Removed
      } else {
        throw new Error('Login successful, but token data missing in response.');
      }
    } catch (e: any) {
      console.error('Login function error:', e);
      setError(e.message || 'An unexpected error occurred during login.');
      // Ensure user/session state is cleared on error
      setUser(null);
      setSession(null);
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  };

  const adminLogin = async (admin_key: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/functions/v1/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminKey: admin_key }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Admin login failed');
      }

      // For admin, we might not have a Supabase user/session in the same way,
      // or we might use a dedicated admin Supabase user.
      // For now, just setting a flag.
      // The admin-login function returns a placeholder token.
      // If this token were a real Supabase JWT for an admin user, we'd use setSession.
      // Since it's not, we manage admin state separately for now.
      // This is a temporary solution for admin state.
      console.log("Admin login successful (placeholder token):", result.token);
      setIsAdmin(true);
      setUser(null); // Clear regular user session if any
      setSession(null); // Clear regular user session if any
      // Still using localStorage for this simple admin flag as a temporary measure for differentiating.
      // This specific part needs refinement if localStorage is absolutely forbidden for all cases.
      localStorage.setItem('isAdminSession', 'true');

    } catch (e: any) {
      console.error('Admin login function error:', e);
      setError(e.message || 'An unexpected error occurred during admin login.');
      setIsAdmin(false);
      localStorage.removeItem('isAdminSession');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    setError(null);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      console.error('Error logging out:', signOutError);
      setError(signOutError.message);
    }
    // onAuthStateChange will handle setting user/session to null
    setIsAdmin(false); // Clear admin flag on logout
    localStorage.removeItem('isAdminSession');
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, isLoading, login, adminLogin, logout, error, clearError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
