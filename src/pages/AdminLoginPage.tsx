// src/pages/AdminLoginPage.tsx — PRODUCTION-READY with full role-based routing
// Purpose: Second-factor staff gate (PIN) after staff email/phone login.
// Notes:
// - Confirms staff/admin via multiple sources, including a DB check on profiles.is_admin.
// - Two modes: "unlock" (enter PIN) and "setpin" (create/update PIN).
// - Uses useAdminAuth().verifyPinAndLogin(pin, role) to unlock session.
// - Expects an Edge Function 'admin_set_pin' to store hashed PIN server-side.
// - Routes users to appropriate dashboard based on their role after PIN verification

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, useSupabaseClient } from '../contexts/AuthContext';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { StaffRole, ROLE_DISPLAY_NAMES } from '../types/roles';
import { useBranding } from '../BrandingContext';

type LocationState = {
  message?: string;
  from?: { pathname?: string };
};

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState) || {};
  const supabase = useSupabaseClient();
  const { branding } = useBranding();

  // App auth contexts
  const { user, isAdmin } = useAuth();
  const { verifyPinAndLogin, isLoading, error } = useAdminAuth();

  // UI state
  const [mode, setMode] = useState<'unlock' | 'setpin'>('unlock');
  const [role, setRole] = useState<StaffRole>('admin');
  const [detectedRole, setDetectedRole] = useState<StaffRole | null>(null);
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [localErr, setLocalErr] = useState<string | null>(state.message || null);
  const [busy, setBusy] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // DB-backed admin flag
  const [dbIsAdmin, setDbIsAdmin] = useState<boolean | null>(null);
  // Tenant info for TenantCode-PIN authentication
  const [userTenantId, setUserTenantId] = useState<string | null>(null);
  const [userTenantCode, setUserTenantCode] = useState<string | null>(null);

  const userLabel = useMemo(() => {
    return user?.email || (user as any)?.phone || user?.user_metadata?.email || 'Unknown user';
  }, [user]);

  // Fetch admin flag AND role from DB (authoritative within app schema)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) {
        setDbIsAdmin(false);
        setDetectedRole(null);
        return;
      }

      const { data, error: selErr } = await supabase
        .from('profiles')
        .select('is_admin, role, tenant_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!cancelled) {
        if (selErr) {

          setDbIsAdmin(null); // fall back to other checks
          setDetectedRole(null);
          setUserTenantId(null);
          setUserTenantCode(null);
        } else {
          setDbIsAdmin(Boolean(data?.is_admin));
          const userRole = (data?.role || null) as StaffRole | null;
          setDetectedRole(userRole);
          setUserTenantId(data?.tenant_id || null);

          // Auto-select detected role
          if (userRole) {
            setRole(userRole);
          }

          // Fetch tenant code if user has a tenant
          if (data?.tenant_id) {
            const { data: tenantData } = await supabase
              .from('tenants')
              .select('tenant_code')
              .eq('id', data.tenant_id)
              .single();

            if (tenantData?.tenant_code && !cancelled) {
              setUserTenantCode(tenantData.tenant_code);
            }
          }
        }
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, user?.id]);

  // ✅ Consolidated admin decision:
  const isUserAdmin = useMemo(() => {
    if (!user) return false;
    // DB is preferred when known
    if (dbIsAdmin === true) return true;
    if (dbIsAdmin === false) {
      // explicit false from DB dominates
      return false;
    }
    // Fallbacks: app context + app_metadata
    const appMetaRole = (user as any)?.app_metadata?.role;
    const appMetaIsAdmin = (user as any)?.app_metadata?.is_admin;
    return Boolean(
      isAdmin ||
      appMetaIsAdmin === true ||
      appMetaRole === 'admin' ||
      appMetaRole === 'super_admin'
    );
  }, [user, isAdmin, dbIsAdmin]);

  // Not signed in → redirect to login
  if (!user) {
    return (
      <div className="p-6 max-w-md mx-auto bg-white rounded shadow text-center">
        <h1 className="text-xl font-semibold mb-4 text-red-600">Authentication Required</h1>
        <p className="mb-4">You must be logged in to access the admin panel.</p>
        <button
          onClick={() => navigate('/login')}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          type="button"
        >
          Go to Login
        </button>
      </div>
    );
  }

  // Signed in but not admin
  if (!isUserAdmin) {
    return (
      <div className="p-6 max-w-md mx-auto bg-white rounded shadow text-center">
        <h1 className="text-xl font-semibold mb-4 text-red-600">Access Denied</h1>
        <p className="mb-4">You must have administrator privileges to access this page.</p>
        <p className="text-sm text-gray-600 mb-4">
          Logged in as: {userLabel}
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          type="button"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  function cleanPin(raw: string) {
    return raw.replace(/[^\d]/g, '').slice(0, 8);
  }

  async function handleSetPin(e?: React.FormEvent) {
    e?.preventDefault();
    setLocalErr(null);
    setSuccessMsg(null);
    const p1 = cleanPin(pin);
    const p2 = cleanPin(pin2);

    if (!/^\d{4,8}$/.test(p1)) {
      setLocalErr('PIN must be 4–8 digits.');
      return;
    }
    if (p1 !== p2) {
      setLocalErr('PINs do not match.');
      return;
    }

    setBusy(true);
    try {
      const { error: fnErr } = await supabase.functions.invoke('admin_set_pin', {
        body: { pin: p1, role }
      });

      if (fnErr) {
        setLocalErr(fnErr.message || 'Could not set PIN.');
        return;
      }
      setSuccessMsg('PIN saved successfully. You can now unlock the Admin Panel.');
      setMode('unlock');
      setPin('');
      setPin2('');
    } catch (e: any) {
      setLocalErr(e?.message || 'Could not set PIN.');
    } finally {
      setBusy(false);
    }
  }

  // Helper function to get dashboard route for a role
  const getDashboardForRole = (staffRole: StaffRole): string => {
    switch (staffRole) {
      case 'nurse':
      case 'nurse_practitioner':
      case 'clinical_supervisor':
        return '/nurse-dashboard';
      case 'physician':
      case 'doctor':
        return '/physician-dashboard';
      case 'admin':
      case 'super_admin':
      case 'department_head':
        return '/admin';
      default:
        return '/admin'; // Fallback to admin panel
    }
  };

  async function handleUnlock(e?: React.FormEvent) {
    e?.preventDefault();
    setLocalErr(null);
    setSuccessMsg(null);

    // Validate format based on whether user has tenant CODE assigned
    // Only require TenantCode-PIN if tenant has a code assigned
    if (userTenantId && userTenantCode) {
      // Tenant users WITH CODE must use TenantCode-PIN format (e.g., MH-6702-1234)
      // TenantCode format: PREFIX-NUMBER (e.g., MH-6702)
      // Full format: PREFIX-NUMBER-PIN (e.g., MH-6702-1234)
      const codePattern = /^[A-Z]{1,4}-[0-9]{4,6}-[0-9]{4,8}$/;
      if (!codePattern.test(pin)) {
        setLocalErr('Invalid format. Use TENANTCODE-PIN (e.g., MH-6702-1234)');
        return;
      }
      // Verify tenant code matches
      const parts = pin.split('-');
      if (parts.length !== 3) {
        setLocalErr(`Invalid format. Use ${userTenantCode}-XXXX`);
        return;
      }
      const inputTenantCode = `${parts[0]}-${parts[1]}`; // e.g., "MH-6702"
      if (inputTenantCode !== userTenantCode) {
        setLocalErr(`Incorrect tenant code. Use ${userTenantCode}-XXXX`);
        return;
      }
    } else {
      // PIN only for: master admins (no tenant) OR tenants without codes assigned
      const p = cleanPin(pin);
      if (!/^\d{4,8}$/.test(p)) {
        setLocalErr('Enter your 4–8 digit PIN.');
        return;
      }
    }

    try {
      // Send the full input (PIN or TenantCode-PIN) - server will parse it
      const success = await verifyPinAndLogin(pin, role);
      if (!success) {
        setLocalErr('Incorrect PIN or verification failed.');
        return;
      }

      // Redirect to role-specific dashboard
      const defaultDashboard = getDashboardForRole(role);
      const intendedPath = state.from?.pathname || defaultDashboard;


      navigate(intendedPath, { replace: true });
    } catch (err: any) {
      setLocalErr(err?.message || 'Unable to verify PIN. Please try again.');
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (mode === 'unlock') {
        void handleUnlock();
      } else {
        void handleSetPin();
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md">
        {/* Simple Banner Header */}
        <div
          className="text-white text-center py-6 px-6 rounded-t-lg shadow-lg"
          style={{ background: branding.gradient }}
        >
          <h1 className="text-2xl font-bold">Envision Atlus - Admin Login</h1>
          <p className="text-sm text-blue-100 mt-1">Envision VirtualEdge Group LLC</p>
        </div>

        {/* Card Content */}
        <div className="bg-white p-6 rounded-b-lg shadow-lg">
          <p className="text-sm text-gray-600 mb-4">Logged in as: {userLabel}</p>

      {state.message && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm">
          {state.message}
        </div>
      )}

      <div className="flex gap-2 mb-4" role="tablist" aria-label="Admin security mode">
        <button
          className={`px-3 py-2 rounded text-sm ${mode === 'unlock' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          onClick={() => {
            setMode('unlock');
            setLocalErr(null);
            setSuccessMsg(null);
            setPin('');
          }}
          type="button"
          role="tab"
          aria-selected={mode === 'unlock'}
        >
          Unlock Admin Panel
        </button>
        <button
          className={`px-3 py-2 rounded text-sm ${mode === 'setpin' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          onClick={() => {
            setMode('setpin');
            setLocalErr(null);
            setSuccessMsg(null);
            setPin('');
            setPin2('');
          }}
          type="button"
          role="tab"
          aria-selected={mode === 'setpin'}
        >
          Set/Update PIN
        </button>
      </div>

      {mode === 'unlock' ? (
        <form className="grid gap-3" onSubmit={handleUnlock} noValidate>
          <div>
            <label htmlFor="role-select" className="block text-sm font-medium text-gray-700 mb-1">
              Your Role {detectedRole && <span className="text-xs text-gray-500">(detected: {ROLE_DISPLAY_NAMES[detectedRole]})</span>}
            </label>
            <select
              id="role-select"
              className="border border-gray-300 p-2 rounded w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
            >
              <option value="admin">Administrator</option>
              <option value="super_admin">Master Administrator</option>
              <option value="nurse">Nurse (RN/LPN)</option>
              <option value="nurse_practitioner">Nurse Practitioner</option>
              <option value="physician">Physician</option>
              <option value="doctor">Doctor</option>
              <option value="physician_assistant">Physician Assistant</option>
              <option value="clinical_supervisor">Clinical Supervisor</option>
              <option value="department_head">Department Head</option>
              <option value="physical_therapist">Physical Therapist</option>
            </select>
          </div>

          <div>
            <label htmlFor="pin-input" className="block text-sm font-medium text-gray-700 mb-1">
              {(userTenantId && userTenantCode) ? 'Enter Tenant Code + PIN' : 'Enter Admin PIN'}
            </label>
            <input
              id="pin-input"
              className="border border-gray-300 p-3 rounded w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              type={(userTenantId && userTenantCode) ? "text" : "password"}
              inputMode={(userTenantId && userTenantCode) ? "text" : "numeric"}
              pattern={(userTenantId && userTenantCode) ? undefined : "\\d{4,8}"}
              placeholder={(userTenantId && userTenantCode)
                ? `${userTenantCode}-XXXX`
                : "Enter PIN (4–8 digits)"}
              value={pin}
              onChange={(e) => setPin((userTenantId && userTenantCode) ? e.target.value.toUpperCase() : cleanPin(e.target.value))}
              onKeyDown={handleKeyDown}
              autoComplete="one-time-code"
              required
              maxLength={(userTenantId && userTenantCode) ? 15 : 8}
              autoFocus
            />
            {userTenantId && userTenantCode && (
              <p className="text-xs text-blue-600 mt-1">
                Your tenant code is <strong>{userTenantCode}</strong>. Enter it with your PIN (e.g., {userTenantCode}-1234)
              </p>
            )}
          </div>

          {(localErr || error) && (
            <div className="p-3 bg-red-50 border border-red-200 rounded" role="alert">
              <p className="text-red-600 text-sm">{localErr || error}</p>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-green-50 border border-green-200 rounded" role="status">
              <p className="text-green-700 text-sm">{successMsg}</p>
            </div>
          )}

          <button
            className="w-full py-2 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            disabled={isLoading || !pin.trim()}
            type="submit"
          >
            {isLoading ? 'Verifying…' : 'Unlock Admin Panel'}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="text-sm text-gray-600 hover:text-gray-800 underline"
            >
              Cancel and return to dashboard
            </button>
          </div>
        </form>
      ) : (
        <form className="grid gap-3" onSubmit={handleSetPin} noValidate>
          <div>
            <label htmlFor="role-select-set" className="block text-sm font-medium text-gray-700 mb-1">
              Set PIN for Role {detectedRole && <span className="text-xs text-gray-500">(detected: {ROLE_DISPLAY_NAMES[detectedRole]})</span>}
            </label>
            <select
              id="role-select-set"
              className="border border-gray-300 p-2 rounded w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
            >
              <option value="admin">Administrator</option>
              <option value="super_admin">Master Administrator</option>
              <option value="nurse">Nurse (RN/LPN)</option>
              <option value="nurse_practitioner">Nurse Practitioner</option>
              <option value="physician">Physician</option>
              <option value="doctor">Doctor</option>
              <option value="physician_assistant">Physician Assistant</option>
              <option value="clinical_supervisor">Clinical Supervisor</option>
              <option value="department_head">Department Head</option>
              <option value="physical_therapist">Physical Therapist</option>
            </select>
          </div>

          <div>
            <label htmlFor="new-pin-input" className="block text-sm font-medium text-gray-700 mb-1">
              New PIN
            </label>
            <input
              id="new-pin-input"
              className="border border-gray-300 p-3 rounded w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              type="password"
              inputMode="numeric"
              pattern="\\d{4,8}"
              placeholder="New PIN (4–8 digits)"
              value={pin}
              onChange={(e) => setPin(cleanPin(e.target.value))}
              onKeyDown={handleKeyDown}
              required
              maxLength={8}
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="confirm-pin-input" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm PIN
            </label>
            <input
              id="confirm-pin-input"
              className="border border-gray-300 p-3 rounded w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              type="password"
              inputMode="numeric"
              pattern="\\d{4,8}"
              placeholder="Confirm PIN"
              value={pin2}
              onChange={(e) => setPin2(cleanPin(e.target.value))}
              onKeyDown={handleKeyDown}
              required
              maxLength={8}
            />
          </div>

          {(localErr || error) && (
            <div className="p-3 bg-red-50 border border-red-200 rounded" role="alert">
              <p className="text-red-600 text-sm">{localErr || error}</p>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-green-50 border border-green-200 rounded" role="status">
              <p className="text-green-700 text-sm">{successMsg}</p>
            </div>
          )}

          <button
            className="w-full py-2 bg-green-600 text-white rounded disabled:opacity-50 hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            disabled={busy || !pin.trim() || !pin2.trim()}
            type="submit"
          >
            {busy ? 'Saving…' : 'Save PIN'}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="text-sm text-gray-600 hover:text-gray-800 underline"
            >
              Cancel and return to dashboard
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
        <p className="text-blue-800">
          <strong>Security Note:</strong> Your admin PIN provides an additional layer of security for administrative functions.
          It expires after 2 hours of inactivity.
        </p>
      </div>
        </div>
      </div>
    </div>
  );
}
