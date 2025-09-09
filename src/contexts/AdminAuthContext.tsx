import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react';
import { supabase } from '../lib/supabaseClient';

type AdminRole = 'admin' | 'super_admin';

interface AdminAuthContextType {
  isAdminAuthenticated: boolean;
  adminRole: AdminRole | null;
  isLoading: boolean;
  error: string | null;

  // PIN flow
  verifyPinAndLogin: (pin: string, role: AdminRole) => Promise<boolean>;
  logoutAdmin: () => void;

  // Use this to call admin-only Edge Functions (adds admin token header)
  invokeAdminFunction: <T = any>(
    fnName: string,
    body?: any
  ) => Promise<{ data: T | null; error: Error | null }>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

// HIPAA-safe: keep admin token in memory only
const adminTokenRefGlobal: { current: string | null } = { current: null };

const SESSION_STORAGE_KEY = 'wellfit_admin_auth';
interface AdminSessionData {
  isAuthenticated: boolean;
  role: AdminRole | null;
  expires_at: string | null; // ISO
}

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const expiryTimerRef = useRef<number | null>(null);
  const adminTokenRef = useRef<string | null>(adminTokenRefGlobal.current);

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

  // Restore only non-sensitive admin session flags (not the token)
  useEffect(() => {
    try {
      const persisted = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (persisted) {
        const s = JSON.parse(persisted) as AdminSessionData;
        const stillValid = !!s.expires_at && new Date(s.expires_at).getTime() > Date.now();
        if (s.isAuthenticated && s.role && stillValid) {
          setIsAdminAuthenticated(true);
          setAdminRole(s.role);
          setExpiresAt(s.expires_at);
          scheduleExpiryTimer(s.expires_at);
          // Token is NOT persisted: require a fresh PIN after reload for server work
          adminTokenRef.current = null;
          adminTokenRefGlobal.current = null;
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
      // Must be logged-in user; invoke sends the bearer access token automatically
      const { data, error: fnErr } = await supabase.functions.invoke('verify-admin-pin', {
        body: { pin, role }
      });

      if (fnErr) {
        setError(fnErr.message || 'PIN verification failed.');
        setIsAdminAuthenticated(false); setAdminRole(null); setExpiresAt(null);
        persistSession(false, null, null); clearExpiryTimer();
        adminTokenRef.current = null; adminTokenRefGlobal.current = null;
        return false;
      }

      // Expected response contract:
      // { success: true, expires_at: ISO string, admin_token: string }
      if (data?.success) {
        const exp: string | null = data.expires_at ?? null;
        const token: string | null = data.admin_token ?? null;

        if (!token || !exp) {
          setError('Server did not return admin token or expiry.');
          setIsAdminAuthenticated(false); setAdminRole(null); setExpiresAt(null);
          persistSession(false, null, null); clearExpiryTimer();
          return false;
        }

        setIsAdminAuthenticated(true);
        setAdminRole(role);
        setExpiresAt(exp);
        persistSession(true, role, exp);
        scheduleExpiryTimer(exp);

        // Keep token in memory only (per tab)
        adminTokenRef.current = token;
        adminTokenRefGlobal.current = token;

        return true;
      } else {
        setError(data?.error || 'Invalid PIN or unexpected response.');
        setIsAdminAuthenticated(false); setAdminRole(null); setExpiresAt(null);
        persistSession(false, null, null); clearExpiryTimer();
        adminTokenRef.current = null; adminTokenRefGlobal.current = null;
        return false;
      }
    } catch (e: any) {
      setError(e?.message || 'An unexpected error occurred.');
      setIsAdminAuthenticated(false); setAdminRole(null); setExpiresAt(null);
      persistSession(false, null, null); clearExpiryTimer();
      adminTokenRef.current = null; adminTokenRefGlobal.current = null;
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
    adminTokenRef.current = null;
    adminTokenRefGlobal.current = null;
  }, []);

  // All admin-only functions should be called through this helper.
  // It adds the short-lived admin token in a header the server validates.
  const invokeAdminFunction = useCallback(
    async <T = any>(fnName: string, body?: any): Promise<{ data: T | null; error: Error | null }> => {
      if (!isAdminAuthenticated || !adminTokenRef.current) {
        return { data: null, error: new Error('Admin session required. Re-enter PIN.') };
      }
      try {
        const { data, error } = await supabase.functions.invoke(fnName, {
          body,
          headers: { 'X-Admin-Token': adminTokenRef.current },
        });
        if (error) return { data: null, error };
        return { data: (data as T) ?? null, error: null };
      } catch (e: any) {
        return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
      }
    },
    [isAdminAuthenticated]
  );

  return (
    <AdminAuthContext.Provider
      value={{
        isAdminAuthenticated,
        adminRole,
        isLoading,
        error,
        verifyPinAndLogin,
        logoutAdmin,
        invokeAdminFunction,
      }}
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
