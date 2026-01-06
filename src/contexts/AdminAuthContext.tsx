import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react';
import { supabase } from '../lib/supabaseClient';
import { StaffRole, RoleAccessScopes, roleHasAccess, ROLE_DISPLAY_NAMES as _ROLE_DISPLAY_NAMES } from '../types/roles';
import { prepareAdminPinForVerification } from '../services/pinHashingService';
import { auditLogger } from '../services/auditLogger';

// Backwards compatibility: AdminRole is now StaffRole
export type AdminRole = StaffRole;

interface AdminAuthContextType {
  isAdminAuthenticated: boolean;
  adminRole: StaffRole | null;
  accessScopes: RoleAccessScopes | null;
  isLoading: boolean;
  error: string | null;

  // PIN flow
  verifyPinAndLogin: (pin: string, role: StaffRole) => Promise<boolean>;
  logoutAdmin: () => void;

  // Super admin bypass (for Envision portal users)
  autoAuthenticateAsSuperAdmin: () => Promise<boolean>;

  // Permission checks
  hasAccess: (requiredRole: StaffRole) => boolean;
  canViewNurse: boolean;
  canViewPhysician: boolean;
  canViewAdmin: boolean;
  canSupervise: boolean;
  canManageDepartment: boolean;

  // Use this to call admin-only Edge Functions (adds admin token header)
  invokeAdminFunction: <T = unknown>(
    fnName: string,
    body?: Record<string, unknown>
  ) => Promise<{ data: T | null; error: Error | null }>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

// HIPAA-safe: keep admin token in memory only
const adminTokenRefGlobal: { current: string | null } = { current: null };

const SESSION_STORAGE_KEY = 'wellfit_admin_auth';
interface AdminSessionData {
  isAuthenticated: boolean;
  role: StaffRole | null;
  expires_at: string | null; // ISO
}

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminRole, setAdminRole] = useState<StaffRole | null>(null);
  const [accessScopes, setAccessScopes] = useState<RoleAccessScopes | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [_expiresAt, setExpiresAt] = useState<string | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persistSession(isAuthenticated: boolean, role: StaffRole | null, expires_at: string | null) {
    if (isAuthenticated && role && expires_at) {
      const data: AdminSessionData = { isAuthenticated, role, expires_at };
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  // Fetch access scopes from database
  const fetchAccessScopes = useCallback(async (userId: string): Promise<RoleAccessScopes | null> => {
    try {
      const { data, error} = await supabase.rpc('get_role_access_scopes', {
        check_user_id: userId,
      });

      if (error) {

        return null;
      }

      return data as RoleAccessScopes;
    } catch (e) {

      return null;
    }
     
  }, []);

  const verifyPinAndLogin = useCallback(async (pin: string, role: StaffRole): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      // Must be logged-in user; invoke sends the bearer access token automatically
      // Check session before calling edge function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Use static import - no await on audit logger (fire-and-forget)
        auditLogger.error('ADMIN_PIN_VERIFICATION_NO_SESSION', new Error('No active session'), { role }).catch(() => {});
        setError('Session expired. Please log in again.');
        setIsAdminAuthenticated(false); setAdminRole(null); setExpiresAt(null);
        persistSession(false, null, null); clearExpiryTimer();
        adminTokenRef.current = null; adminTokenRefGlobal.current = null;
        return false;
      }

      // SECURITY: Hash PIN client-side before transmission (defense-in-depth)
      // This prevents plaintext PINs from appearing in logs, dev tools, or memory dumps
      const { hashedPin, tenantCode, format } = await prepareAdminPinForVerification(pin);

      // Explicitly pass the access token to ensure it's attached
      // (supabase.functions.invoke should auto-attach, but we force it for reliability)
      const accessToken = session.access_token;

      const { data, error: fnErr } = await supabase.functions.invoke('verify-admin-pin', {
        body: {
          pin: hashedPin,
          role,
          tenantCode,
          pinFormat: format
        },
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (fnErr) {
        // Fire-and-forget audit logging - don't block on it
        auditLogger.error('ADMIN_PIN_VERIFICATION_FAILED', fnErr, {
          role,
          errorMessage: fnErr.message,
          userEmail: session.user?.email
        }).catch(() => {});
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
          auditLogger.error('ADMIN_PIN_VERIFICATION_INCOMPLETE_RESPONSE', new Error('Missing token or expiry'), {
            role,
            hasToken: !!token,
            hasExpiry: !!exp
          }).catch(() => {});
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

        // Fetch access scopes for this user
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const scopes = await fetchAccessScopes(user.id);
          setAccessScopes(scopes);

          // Fire-and-forget audit logging
          auditLogger.info('ADMIN_PIN_VERIFICATION_SUCCESS', {
            role,
            userId: user.id,
            userEmail: user.email,
            expiresAt: exp
          }).catch(() => {});
        }

        return true;
      } else {
        auditLogger.error('ADMIN_PIN_VERIFICATION_REJECTED', new Error(data?.error || 'Invalid PIN'), {
          role,
          errorMessage: data?.error
        }).catch(() => {});
        setError(data?.error || 'Invalid PIN or unexpected response.');
        setIsAdminAuthenticated(false); setAdminRole(null); setExpiresAt(null);
        persistSession(false, null, null); clearExpiryTimer();
        adminTokenRef.current = null; adminTokenRefGlobal.current = null;
        return false;
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      auditLogger.error('ADMIN_PIN_VERIFICATION_EXCEPTION', e instanceof Error ? e : new Error(errorMessage), {
        role,
        errorMessage
      }).catch(() => {});
      setError(errorMessage || 'An unexpected error occurred.');
      setIsAdminAuthenticated(false); setAdminRole(null); setExpiresAt(null);
      persistSession(false, null, null); clearExpiryTimer();
      adminTokenRef.current = null; adminTokenRefGlobal.current = null;
      return false;
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-authenticate super admins coming from Envision portal (no PIN required)
  const autoAuthenticateAsSuperAdmin = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      // Check if user has an active Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('No active session. Please log in first.');
        return false;
      }

      // Verify this user is actually a super_admin in the database
      const { data: superAdminRecord, error: saError } = await supabase
        .from('super_admin_users')
        .select('id, user_id, is_active, role')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (saError || !superAdminRecord) {
        // Fire-and-forget audit logging
        auditLogger.warn('SUPER_ADMIN_AUTO_AUTH_DENIED', {
          userId: session.user.id,
          userEmail: session.user.email,
          reason: saError?.message || 'Not a super admin'
        }).catch(() => {});
        setError('You are not authorized as a super admin.');
        return false;
      }

      // Set 8-hour session (standard work day)
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

      setIsAdminAuthenticated(true);
      setAdminRole('super_admin');
      setExpiresAt(expiresAt);
      persistSession(true, 'super_admin', expiresAt);
      scheduleExpiryTimer(expiresAt);

      // Note: No admin_token for this flow - super admins use their Supabase session directly
      // This means invokeAdminFunction won't work, but super admins have direct DB access anyway
      adminTokenRef.current = null;
      adminTokenRefGlobal.current = null;

      // Fetch access scopes
      const scopes = await fetchAccessScopes(session.user.id);
      setAccessScopes(scopes);

      // Fire-and-forget audit logging
      auditLogger.info('SUPER_ADMIN_AUTO_AUTH_SUCCESS', {
        userId: session.user.id,
        userEmail: session.user.email,
        expiresAt,
        method: 'envision_portal_bypass'
      }).catch(() => {});

      return true;
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      auditLogger.error('SUPER_ADMIN_AUTO_AUTH_ERROR', e instanceof Error ? e : new Error(errorMessage), {
        errorMessage
      }).catch(() => {});
      setError(errorMessage || 'Auto-authentication failed.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchAccessScopes]);

  const logoutAdmin = useCallback(() => {
    setIsAdminAuthenticated(false);
    setAdminRole(null);
    setAccessScopes(null);
    setError(null);
    setExpiresAt(null);
    persistSession(false, null, null);
    clearExpiryTimer();
    adminTokenRef.current = null;
    adminTokenRefGlobal.current = null;
  }, []);

  // Permission check helper
  const hasAccess = useCallback(
    (requiredRole: StaffRole): boolean => {
      if (!adminRole) return false;
      return roleHasAccess(adminRole, requiredRole);
    },
    [adminRole]
  );

  // Computed permission flags
  const canViewNurse = accessScopes?.canViewNurse ?? false;
  const canViewPhysician = accessScopes?.canViewPhysician ?? false;
  const canViewAdmin = accessScopes?.canViewAdmin ?? false;
  const canSupervise = accessScopes?.canSupervise ?? false;
  const canManageDepartment = accessScopes?.canManageDepartment ?? false;

  // All admin-only functions should be called through this helper.
  // It adds the short-lived admin token in a header the server validates.
  const invokeAdminFunction = useCallback(
    async <T = unknown>(fnName: string, body?: Record<string, unknown>): Promise<{ data: T | null; error: Error | null }> => {
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
      } catch (e: unknown) {
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
        accessScopes,
        isLoading,
        error,
        verifyPinAndLogin,
        logoutAdmin,
        autoAuthenticateAsSuperAdmin,
        hasAccess,
        canViewNurse,
        canViewPhysician,
        canViewAdmin,
        canSupervise,
        canManageDepartment,
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
