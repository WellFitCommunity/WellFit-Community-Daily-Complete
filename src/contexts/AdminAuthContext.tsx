// src/contexts/AdminAuthContext.tsx
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type AdminRole = 'admin' | 'super_admin';

interface AdminAuthContextType {
  isAdminAuthenticated: boolean;
  adminRole: AdminRole | null;
  isLoading: boolean;
  error: string | null;
  verifyPinAndLogin: (pin: string, role: AdminRole) => Promise<boolean>;
  logoutAdmin: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);
const SESSION_STORAGE_KEY = 'wellfit_admin_auth';

interface AdminSessionData {
  isAuthenticated: boolean;
  role: AdminRole | null;
  expires_at: string | null;
}

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const expiryTimerRef = useRef<number | null>(null);

  function clearExpiryTimer() {
    if (expiryTimerRef.current) {
      window.clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  }
  function scheduleExpiryTimer(expiresISO: string | null) {
    clearExpiryTimer();
    if (!expiresISO) return;
    const ms = new Date(expiresISO).getTime() - Date.now();
    if (ms <= 0) return logoutAdmin();
    expiryTimerRef.current = window.setTimeout(() => logoutAdmin(), ms);
  }

  useEffect(() => {
    try {
      const persisted = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (persisted) {
        const s = JSON.parse(persisted) as AdminSessionData;
        if (s.isAuthenticated && s.role && s.expires_at && new Date(s.expires_at).getTime() > Date.now()) {
          setIsAdminAuthenticated(true);
          setAdminRole(s.role);
          setExpiresAt(s.expires_at);
          scheduleExpiryTimer(s.expires_at);
        } else {
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }
    } catch {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
    return () => clearExpiryTimer();
  }, []);

  function persistSession(isAuthenticated: boolean, role: AdminRole | null, expires_at: string | null) {
    if (isAuthenticated && role && expires_at) {
      const data: AdminSessionData = { isAuthenticated, role, expires_at };
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  const verifyPinAndLogin = useCallback(async (pin: string, role: AdminRole): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('verify-admin-pin', { body: { pin, role } });
      if (fnErr) {
        setError(fnErr.message || 'PIN verification failed.');
        setIsAdminAuthenticated(false); setAdminRole(null); setExpiresAt(null);
        persistSession(false, null, null); clearExpiryTimer();
        return false;
      }
      if (data?.success) {
        const exp = data.expires_at ?? null;
        setIsAdminAuthenticated(true); setAdminRole(role); setExpiresAt(exp);
        persistSession(true, role, exp); scheduleExpiryTimer(exp);
        return true;
      } else {
        setError(data?.error || 'Invalid PIN or unexpected response.');
        setIsAdminAuthenticated(false); setAdminRole(null); setExpiresAt(null);
        persistSession(false, null, null); clearExpiryTimer();
        return false;
      }
    } catch (e: any) {
      setError(e?.message || 'An unexpected error occurred.');
      setIsAdminAuthenticated(false); setAdminRole(null); setExpiresAt(null);
      persistSession(false, null, null); clearExpiryTimer();
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logoutAdmin = useCallback(() => {
    setIsAdminAuthenticated(false);
    setAdminRole(null);
    setError(null);
    setExpiresAt(null);
    persistSession(false, null, null);
    clearExpiryTimer();
  }, []);

  return (
    <AdminAuthContext.Provider
      value={{ isAdminAuthenticated, adminRole, isLoading, error, verifyPinAndLogin, logoutAdmin }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  return ctx;
};
