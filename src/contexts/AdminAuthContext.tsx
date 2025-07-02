import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient'; // Assuming supabase client is here

type AdminRole = 'admin' | 'super_admin';

interface AdminAuthContextType {
  isAdminAuthenticated: boolean;
  adminRole: AdminRole | null;
  isLoading: boolean;
  error: string | null;
  verifyPinAndLogin: (pin: string, role: AdminRole, userId: string) => Promise<boolean>; // Added userId
  logoutAdmin: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = 'wellfit_admin_auth';

interface AdminSessionData {
  isAuthenticated: boolean;
  role: AdminRole | null;
  // Could add expiry here if needed
}

export const AdminAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load persisted state from session storage on initial load
  useEffect(() => {
    try {
      const persistedState = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (persistedState) {
        const sessionData = JSON.parse(persistedState) as AdminSessionData;
        if (sessionData.isAuthenticated && sessionData.role) {
          setIsAdminAuthenticated(true);
          setAdminRole(sessionData.role);
          console.log('Admin session restored from sessionStorage');
        }
      }
    } catch (e) {
      console.error("Failed to parse admin session from sessionStorage", e);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  const persistSession = (isAuthenticated: boolean, role: AdminRole | null) => {
    if (isAuthenticated && role) {
      const sessionData: AdminSessionData = { isAuthenticated, role };
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  };

  const verifyPinAndLogin = useCallback(async (pin: string, role: AdminRole, userId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      // Ensure userId is passed to the serverless function for logging purposes
      const { data, error: functionError } = await supabase.functions.invoke('verify-admin-pin', {
        body: { pin, role, userId }, // Pass userId along with pin and role
      });

      if (functionError) {
        console.error('verify-admin-pin function error:', functionError.message);
        let displayError = functionError.message;
        // Attempt to parse more specific error from function context if available
        try {
          const contextError = JSON.parse(functionError.context || '{}');
          if (contextError.error) displayError = contextError.error;
        } catch (_) { /* ignore parsing error */ }
        setError(displayError || 'PIN verification failed.');
        setIsAdminAuthenticated(false);
        setAdminRole(null);
        persistSession(false, null);
        return false;
      }

      if (data && data.success) {
        setIsAdminAuthenticated(true);
        setAdminRole(role);
        persistSession(true, role);
        console.log(`Admin authenticated as ${role}`);
        return true;
      } else {
        // Handle cases where function returns success: false or unexpected data
        const errorMessage = data?.error || 'Invalid PIN or unexpected response.';
        setError(errorMessage);
        setIsAdminAuthenticated(false);
        setAdminRole(null);
        persistSession(false, null);
        return false;
      }
    } catch (e: any) {
      console.error('Client-side error during PIN verification:', e);
      setError(e.message || 'An unexpected error occurred.');
      setIsAdminAuthenticated(false);
      setAdminRole(null);
      persistSession(false, null);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logoutAdmin = useCallback(() => {
    setIsAdminAuthenticated(false);
    setAdminRole(null);
    setError(null);
    persistSession(false, null);
    console.log('Admin logged out');
    // Optionally, redirect to a public page or admin login
    // navigate('/admin/login'); // if using react-router navigate
  }, []);

  return (
    <AdminAuthContext.Provider
      value={{ isAdminAuthenticated, adminRole, isLoading, error, verifyPinAndLogin, logoutAdmin }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = (): AdminAuthContextType => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};
