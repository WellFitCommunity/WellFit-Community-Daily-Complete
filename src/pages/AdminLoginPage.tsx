// src/pages/AdminLoginPage.tsx — PRODUCTION-READY with full role-based routing
// Purpose: Second-factor staff gate (PIN) after staff email/phone login.
// Notes:
// - Confirms staff/admin via multiple sources, including a DB check on profiles.is_admin.
// - Modes: "unlock" (enter PIN), "setpin" (create/update PIN), "forgot" (request reset),
//          "verify" (enter SMS code), "reset" (set new PIN with OTP token).
// - Uses useAdminAuth().verifyPinAndLogin(pin, role) to unlock session.
// - Expects Edge Functions: 'admin_set_pin', 'request-pin-reset', 'verify-pin-reset'
// - Routes users to appropriate dashboard based on their role after PIN verification

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, useSupabaseClient } from '../contexts/AuthContext';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { StaffRole, ROLE_DISPLAY_NAMES } from '../types/roles';
import { useBranding } from '../BrandingContext';
import { hashPinForTransmission } from '../services/pinHashingService';

type LocationState = {
  message?: string;
  from?: { pathname?: string };
};

type PageMode = 'unlock' | 'setpin' | 'forgot' | 'verify' | 'reset';

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
  const [mode, setMode] = useState<PageMode>('unlock');
  const [role, setRole] = useState<StaffRole>('admin');
  const [detectedRole, setDetectedRole] = useState<StaffRole | null>(null);
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [localErr, setLocalErr] = useState<string | null>(state.message || null);
  const [busy, setBusy] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // PIN Reset flow state
  const [resetPhone, setResetPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [resetCodeSent, setResetCodeSent] = useState(false);

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
      appMetaRole === 'super_admin' ||
      appMetaRole === 'it_admin'
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
      // SECURITY: Hash PIN client-side before transmission (defense-in-depth)
      // This prevents plaintext PINs from appearing in logs, dev tools, or memory dumps
      const hashedPin = await hashPinForTransmission(p1);

      const { error: fnErr } = await supabase.functions.invoke('admin_set_pin', {
        body: { pin: hashedPin, role }
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

  // Request PIN reset - sends SMS code
  async function handleRequestReset(e?: React.FormEvent) {
    e?.preventDefault();
    setLocalErr(null);
    setSuccessMsg(null);

    // Simple phone validation
    const cleanedPhone = resetPhone.replace(/[^\d+]/g, '');
    if (cleanedPhone.length < 10) {
      setLocalErr('Please enter a valid phone number.');
      return;
    }

    setBusy(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('request-pin-reset', {
        body: { phone: cleanedPhone }
      });

      if (fnErr) {
        // Still show success message to prevent phone enumeration
        setSuccessMsg('If this phone is registered to an admin account, a verification code has been sent.');
        setResetCodeSent(true);
        setMode('verify');
        return;
      }

      setSuccessMsg(data?.message || 'If this phone is registered to an admin account, a verification code has been sent.');
      setResetCodeSent(true);
      setMode('verify');
    } catch (e: any) {
      // Still show generic success to prevent enumeration
      setSuccessMsg('If this phone is registered to an admin account, a verification code has been sent.');
      setResetCodeSent(true);
      setMode('verify');
    } finally {
      setBusy(false);
    }
  }

  // Verify SMS code and get OTP token
  async function handleVerifyCode(e?: React.FormEvent) {
    e?.preventDefault();
    setLocalErr(null);
    setSuccessMsg(null);

    if (!/^\d{4,8}$/.test(smsCode)) {
      setLocalErr('Please enter the verification code from your SMS.');
      return;
    }

    const cleanedPhone = resetPhone.replace(/[^\d+]/g, '');

    setBusy(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('verify-pin-reset', {
        body: { phone: cleanedPhone, code: smsCode }
      });

      if (fnErr) {
        setLocalErr(fnErr.message || 'Invalid or expired verification code.');
        return;
      }

      if (!data?.otp_token) {
        setLocalErr('Verification failed. Please try again.');
        return;
      }

      // Store OTP token and move to reset mode
      setOtpToken(data.otp_token);
      setSuccessMsg('Code verified! Please set your new PIN.');
      setSmsCode('');
      setMode('reset');
    } catch (e: any) {
      setLocalErr(e?.message || 'Could not verify code.');
    } finally {
      setBusy(false);
    }
  }

  // Set new PIN using OTP token
  async function handleResetPin(e?: React.FormEvent) {
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

    if (!otpToken) {
      setLocalErr('Reset session expired. Please start over.');
      setMode('forgot');
      return;
    }

    setBusy(true);
    try {
      const hashedPin = await hashPinForTransmission(p1);

      const { error: fnErr } = await supabase.functions.invoke('admin_set_pin', {
        body: { pin: hashedPin, role, otp_token: otpToken }
      });

      if (fnErr) {
        setLocalErr(fnErr.message || 'Could not reset PIN.');
        return;
      }

      // Clear reset state
      setOtpToken(null);
      setResetPhone('');
      setSmsCode('');
      setResetCodeSent(false);
      setPin('');
      setPin2('');

      setSuccessMsg('PIN reset successfully! You can now unlock with your new PIN.');
      setMode('unlock');
    } catch (e: any) {
      setLocalErr(e?.message || 'Could not reset PIN.');
    } finally {
      setBusy(false);
    }
  }

  // Helper function to get dashboard route for a role
  // NOTE: This is the WellFit Facility Admin login, NOT the Envision portal.
  // Super admins accessing via this route should go to the WellFit admin panel,
  // not the Envision platform system. Envision portal is accessed via /envision login.
  const getDashboardForRole = (staffRole: StaffRole): string => {
    switch (staffRole) {
      case 'nurse':
      case 'nurse_practitioner':
      case 'clinical_supervisor':
        return '/nurse-dashboard';
      case 'physician':
      case 'doctor':
        return '/physician-dashboard';
      case 'it_admin':
        return '/it-admin'; // Tenant IT Administration Dashboard
      case 'super_admin':
      case 'admin':
      case 'department_head':
        // All admin roles go to the WellFit admin panel when using facility login
        // Envision platform access requires /envision login route
        return '/admin';
      default:
        return '/admin'; // Fallback to admin panel
    }
  };

  async function handleUnlock(e?: React.FormEvent) {
    e?.preventDefault();
    setLocalErr(null);
    setSuccessMsg(null);

    // Validate PIN format (always 4-8 digits, regardless of tenant)
    const cleanedPin = cleanPin(pin);
    if (!/^\d{4,8}$/.test(cleanedPin)) {
      setLocalErr('Enter your 4–8 digit PIN.');
      return;
    }

    // Construct the full credential to send to the server
    // If user has a tenant code, combine it with the PIN (e.g., "MH-6702-1234")
    // Otherwise, just send the PIN
    const credential = (userTenantId && userTenantCode)
      ? `${userTenantCode}-${cleanedPin}`
      : cleanedPin;

    try {
      // Send the full credential (PIN or TenantCode-PIN) - server will parse it
      const success = await verifyPinAndLogin(credential, role);
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
      switch (mode) {
        case 'unlock':
          void handleUnlock();
          break;
        case 'setpin':
          void handleSetPin();
          break;
        case 'forgot':
          void handleRequestReset();
          break;
        case 'verify':
          void handleVerifyCode();
          break;
        case 'reset':
          void handleResetPin();
          break;
      }
    }
  };

  // Helper to reset to forgot mode
  const goToForgotMode = () => {
    setMode('forgot');
    setLocalErr(null);
    setSuccessMsg(null);
    setPin('');
    setPin2('');
    setResetPhone('');
    setSmsCode('');
    setOtpToken(null);
    setResetCodeSent(false);
  };

  // Helper to go back to unlock mode
  const goToUnlockMode = () => {
    setMode('unlock');
    setLocalErr(null);
    setSuccessMsg(null);
    setPin('');
    setResetPhone('');
    setSmsCode('');
    setOtpToken(null);
    setResetCodeSent(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md">
        {/* Simple Banner Header */}
        <div
          className="text-white text-center py-6 px-6 rounded-t-lg shadow-lg"
          style={{ background: branding.gradient }}
        >
          <h1 className="text-2xl font-bold">Facility Admin Login</h1>
          <p className="text-sm text-blue-100 mt-1">{branding.appName} - Staff PIN Verification</p>
        </div>

        {/* Card Content */}
        <div className="bg-white p-6 rounded-b-lg shadow-lg">
          <p className="text-sm text-gray-600 mb-2">Logged in as: {userLabel}</p>

          {/* Tenant Badge - Smart Recognition */}
          {userTenantCode && (
            <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-600 rounded">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <div className="flex-1">
                  <p className="text-xs text-blue-700 font-medium">Managing Facility:</p>
                  <p className="text-sm font-semibold text-blue-900">{userTenantCode}</p>
                </div>
                <div className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">
                  {userTenantCode}
                </div>
              </div>
            </div>
          )}

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
          {/* Role Display - Auto-detected from profile */}
          {detectedRole && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded">
              <p className="text-xs text-gray-500 mb-1">Your Role</p>
              <p className="text-sm font-medium text-gray-900">{ROLE_DISPLAY_NAMES[detectedRole] || detectedRole}</p>
            </div>
          )}

          {/* PIN Input - Always masked for security */}
          <div>
            <label htmlFor="pin-input" className="block text-sm font-medium text-gray-700 mb-1">
              Enter Admin PIN
            </label>
            <input
              id="pin-input"
              className="border border-gray-300 p-3 rounded w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono tracking-widest"
              type="password"
              inputMode="numeric"
              pattern="\d{4,8}"
              placeholder="Enter PIN (4–8 digits)"
              value={pin}
              onChange={(e) => setPin(cleanPin(e.target.value))}
              onKeyDown={handleKeyDown}
              autoComplete="one-time-code"
              required
              maxLength={8}
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter your 4-8 digit admin PIN
            </p>
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

          <div className="text-center space-y-2">
            <button
              type="button"
              onClick={goToForgotMode}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Forgot PIN?
            </button>
            <br />
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="text-sm text-gray-600 hover:text-gray-800 underline"
            >
              Cancel and return to dashboard
            </button>
          </div>
        </form>
      ) : mode === 'setpin' ? (
        <form className="grid gap-3" onSubmit={handleSetPin} noValidate>
          {/* Role Display - Auto-detected from profile */}
          {detectedRole && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded">
              <p className="text-xs text-gray-500 mb-1">Setting PIN for Role</p>
              <p className="text-sm font-medium text-gray-900">{ROLE_DISPLAY_NAMES[detectedRole] || detectedRole}</p>
            </div>
          )}

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
      ) : mode === 'forgot' ? (
        /* Forgot PIN - Enter phone number */
        <form className="grid gap-3" onSubmit={handleRequestReset} noValidate>
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              Enter the phone number associated with your admin account. We'll send you a verification code.
            </p>
          </div>

          <div>
            <label htmlFor="reset-phone-input" className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              id="reset-phone-input"
              className="border border-gray-300 p-3 rounded w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              type="tel"
              inputMode="tel"
              placeholder="(555) 123-4567"
              value={resetPhone}
              onChange={(e) => setResetPhone(e.target.value)}
              onKeyDown={handleKeyDown}
              required
              autoFocus
            />
          </div>

          {localErr && (
            <div className="p-3 bg-red-50 border border-red-200 rounded" role="alert">
              <p className="text-red-600 text-sm">{localErr}</p>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-green-50 border border-green-200 rounded" role="status">
              <p className="text-green-700 text-sm">{successMsg}</p>
            </div>
          )}

          <button
            className="w-full py-2 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            disabled={busy || !resetPhone.trim()}
            type="submit"
          >
            {busy ? 'Sending…' : 'Send Verification Code'}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={goToUnlockMode}
              className="text-sm text-gray-600 hover:text-gray-800 underline"
            >
              Back to PIN entry
            </button>
          </div>
        </form>
      ) : mode === 'verify' ? (
        /* Verify SMS code */
        <form className="grid gap-3" onSubmit={handleVerifyCode} noValidate>
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-800">
              Enter the verification code sent to your phone.
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Phone: {resetPhone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')}
            </p>
          </div>

          <div>
            <label htmlFor="sms-code-input" className="block text-sm font-medium text-gray-700 mb-1">
              Verification Code
            </label>
            <input
              id="sms-code-input"
              className="border border-gray-300 p-3 rounded w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono tracking-widest text-center text-xl"
              type="text"
              inputMode="numeric"
              pattern="\d{4,8}"
              placeholder="Enter code"
              value={smsCode}
              onChange={(e) => setSmsCode(e.target.value.replace(/[^\d]/g, '').slice(0, 8))}
              onKeyDown={handleKeyDown}
              required
              maxLength={8}
              autoFocus
            />
          </div>

          {localErr && (
            <div className="p-3 bg-red-50 border border-red-200 rounded" role="alert">
              <p className="text-red-600 text-sm">{localErr}</p>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-green-50 border border-green-200 rounded" role="status">
              <p className="text-green-700 text-sm">{successMsg}</p>
            </div>
          )}

          <button
            className="w-full py-2 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            disabled={busy || !smsCode.trim()}
            type="submit"
          >
            {busy ? 'Verifying…' : 'Verify Code'}
          </button>

          <div className="text-center space-y-2">
            <button
              type="button"
              onClick={() => {
                setMode('forgot');
                setSmsCode('');
                setLocalErr(null);
                setSuccessMsg(null);
              }}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Resend code
            </button>
            <br />
            <button
              type="button"
              onClick={goToUnlockMode}
              className="text-sm text-gray-600 hover:text-gray-800 underline"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : mode === 'reset' ? (
        /* Set new PIN with OTP token */
        <form className="grid gap-3" onSubmit={handleResetPin} noValidate>
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-sm text-green-800">
              Code verified! Please set your new PIN.
            </p>
          </div>

          <div>
            <label htmlFor="new-reset-pin-input" className="block text-sm font-medium text-gray-700 mb-1">
              New PIN
            </label>
            <input
              id="new-reset-pin-input"
              className="border border-gray-300 p-3 rounded w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              type="password"
              inputMode="numeric"
              pattern="\d{4,8}"
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
            <label htmlFor="confirm-reset-pin-input" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm PIN
            </label>
            <input
              id="confirm-reset-pin-input"
              className="border border-gray-300 p-3 rounded w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              type="password"
              inputMode="numeric"
              pattern="\d{4,8}"
              placeholder="Confirm PIN"
              value={pin2}
              onChange={(e) => setPin2(cleanPin(e.target.value))}
              onKeyDown={handleKeyDown}
              required
              maxLength={8}
            />
          </div>

          {localErr && (
            <div className="p-3 bg-red-50 border border-red-200 rounded" role="alert">
              <p className="text-red-600 text-sm">{localErr}</p>
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
            {busy ? 'Saving…' : 'Set New PIN'}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={goToUnlockMode}
              className="text-sm text-gray-600 hover:text-gray-800 underline"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
        <p className="text-blue-800">
          <strong>Security Note:</strong> Your admin PIN provides an additional layer of security for administrative functions.
          Session expires after 30 minutes of inactivity.
        </p>
      </div>

      {/* Subtle Envision link at bottom - visible to all, understood by Envision staff */}
      <div className="mt-6 pt-4 border-t border-gray-100 text-center">
        <button
          type="button"
          onClick={() => navigate('/envision')}
          className="text-xs text-gray-400 hover:text-teal-600 transition-colors"
        >
          Envision
        </button>
      </div>
        </div>
      </div>
    </div>
  );
}
