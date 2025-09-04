import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { supabase } from '../lib/supabaseClient'; // your shared client

type AdminRole = 'admin' | 'super_admin';

interface AdminAuthContextType {
  isAdminAuthenticated: boolean;
  adminRole: AdminRole | null;
  isLoading: boolean;
  error: string | null;
  verifyPinAndLogin: (pin: string, role: AdminRole) => Promise<boolean>; // ❌ no userId
  logoutAdmin: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = 'wellfit_admin_auth';

interface AdminSessionData {
  isAuthenticated: boolean;
  role: AdminRole | null;
  expires_at: string | null; // ISO string
}

export const AdminAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  // keep a timer to auto-logout on expiry
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
    if (ms <= 0) {
      // already expired
      logoutAdmin();
      return;
    }
    expiryTimerRef.current = window.setTimeout(() => {
      // auto-lock when server session expires
      logoutAdmin();
    }, ms);
  }

  // Load persisted state on boot
  useEffect(() => {
    try {
      const persisted = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (persisted) {
        const sessionData = JSON.parse(persisted) as AdminSessionData;
        if (sessionData.isAuthenticated && sessionData.role && sessionData.expires_at) {
          // check whether it’s still valid right now
          if (new Date(sessionData.expires_at).getTime() > Date.now()) {
            setIsAdminAuthenticated(true);
            setAdminRole(sessionData.role);
            setExpiresAt(sessionData.expires_at);
            scheduleExpiryTimer(sessionData.expires_at);
            // console.log('Admin session restored from sessionStorage');
          } else {
            // expired → clear it
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
          }
        }
      }
    } catch (e) {
      console.error('Failed to parse admin session from sessionStorage', e);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
    // cleanup timer on unmount
    return () => clearExpiryTimer();
  }, []);

  function persistSession(isAuthenticated: boolean, role: AdminRole | null, expires_at: string | null) {
    if (isAuthenticated && role && expires_at) {
      const sessionData: AdminSessionData = { isAuthenticated, role, expires_at };
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  const verifyPinAndLogin = useCallback(async (pin: string, role: AdminRole): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      // 🔒 Do NOT send userId. The Edge function reads the auth user from the Supabase JWT automatically.
      const { data, error: fnErr } = await supabase.functions.invoke('verify-admin-pin', {
        body: { pin, role },
      });

      if (fnErr) {
        const msg = fnErr.message || 'PIN verification failed.';
        setError(msg);
        setIsAdminAuthenticated(false);
        setAdminRole(null);
        setExpiresAt(null);
        persistSession(false, null, null);
        clearExpiryTimer();
        return false;
      }

      if (data?.success) {
        const exp = data.expires_at ?? null;
        setIsAdminAuthenticated(true);
        setAdminRole(role);
        setExpiresAt(exp);
        persistSession(true, role, exp);
        scheduleExpiryTimer(exp);
        return true;
      } else {
        const msg = data?.error || 'Invalid PIN or unexpected response.';
        setError(msg);
        setIsAdminAuthenticated(false);
        setAdminRole(null);
        setExpiresAt(null);
        persistSession(false, null, null);
        clearExpiryTimer();
        return false;
      }
    } catch (e: any) {
      setError(e?.message || 'An unexpected error occurred.');
      setIsAdminAuthenticated(false);
      setAdminRole(null);
      setExpiresAt(null);
      persistSession(false, null, null);
      clearExpiryTimer();
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
    // optional: navigate('/admin/login');
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
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return ctx;
};
