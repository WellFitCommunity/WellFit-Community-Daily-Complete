// src/pages/AdminLoginPage.tsx — Clean, Professional Admin PIN Page
// Purpose: Second-factor staff gate (PIN) after staff email/phone login.

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

/**
 * Normalize phone number to E.164 format with +1 for US numbers
 */
function normalizePhoneForTwilio(phone: string): string {
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // If it starts with +, keep it as-is (already international format)
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // Remove leading 1 if present (US country code without +)
  if (cleaned.startsWith('1') && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }

  // If 10 digits, assume US and add +1
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  // If 11 digits starting with 1, add +
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }

  // Return as-is with + prefix if not already there
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

/**
 * Format phone for display
 */
function formatPhoneDisplay(phone: string): string {
  const cleaned = phone.replace(/[^\d]/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState) || {};
  const supabase = useSupabaseClient();
  const { branding } = useBranding();

  const { user, isAdmin } = useAuth();
  const { verifyPinAndLogin, isLoading, error } = useAdminAuth();

  const [mode, setMode] = useState<PageMode>('unlock');
  const [role, setRole] = useState<StaffRole>('admin');
  const [detectedRole, setDetectedRole] = useState<StaffRole | null>(null);
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [localErr, setLocalErr] = useState<string | null>(state.message || null);
  const [busy, setBusy] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [resetPhone, setResetPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [otpToken, setOtpToken] = useState<string | null>(null);

  const [dbIsAdmin, setDbIsAdmin] = useState<boolean | null>(null);
  const [userTenantId, setUserTenantId] = useState<string | null>(null);
  const [userTenantCode, setUserTenantCode] = useState<string | null>(null);

  const userLabel = useMemo(() => {
    return user?.email || (user as any)?.phone || user?.user_metadata?.email || 'Unknown user';
  }, [user]);

  // Fetch admin status and role from DB
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
          setDbIsAdmin(null);
          setDetectedRole(null);
          setUserTenantId(null);
          setUserTenantCode(null);
        } else {
          setDbIsAdmin(Boolean(data?.is_admin));
          const userRole = (data?.role || null) as StaffRole | null;
          setDetectedRole(userRole);
          setUserTenantId(data?.tenant_id || null);
          if (userRole) setRole(userRole);

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
  }, [supabase, supabase.auth, user?.id]);

  const isUserAdmin = useMemo(() => {
    if (!user) return false;
    if (dbIsAdmin === true) return true;
    if (dbIsAdmin === false) return false;
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

  // Not signed in
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-6V4" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Authentication Required</h1>
          <p className="text-gray-600 mb-6">Please log in to access the admin panel.</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Not admin
  if (!isUserAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-2">Administrator privileges required.</p>
          <p className="text-sm text-gray-500 mb-6">{userLabel}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  function cleanPin(raw: string) {
    return raw.replace(/[^\d]/g, '').slice(0, 8);
  }

  const clearMessages = () => {
    setLocalErr(null);
    setSuccessMsg(null);
  };

  // Get dashboard route for role
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
        return '/it-admin';
      case 'super_admin':
      case 'admin':
      case 'department_head':
      default:
        return '/admin';
    }
  };

  // === HANDLERS ===

  async function handleUnlock(e?: React.FormEvent) {
    e?.preventDefault();
    clearMessages();

    const cleanedPin = cleanPin(pin);
    if (!/^\d{4,8}$/.test(cleanedPin)) {
      setLocalErr('Enter your 4-8 digit PIN.');
      return;
    }

    const credential = (userTenantId && userTenantCode)
      ? `${userTenantCode}-${cleanedPin}`
      : cleanedPin;

    try {
      const success = await verifyPinAndLogin(credential, role);
      if (!success) {
        setLocalErr('Incorrect PIN.');
        return;
      }
      const defaultDashboard = getDashboardForRole(role);
      const intendedPath = state.from?.pathname || defaultDashboard;
      navigate(intendedPath, { replace: true });
    } catch (err: any) {
      setLocalErr(err?.message || 'Verification failed.');
    }
  }

  async function handleSetPin(e?: React.FormEvent) {
    e?.preventDefault();
    clearMessages();
    const p1 = cleanPin(pin);
    const p2 = cleanPin(pin2);

    if (!/^\d{4,8}$/.test(p1)) {
      setLocalErr('PIN must be 4-8 digits.');
      return;
    }
    if (p1 !== p2) {
      setLocalErr('PINs do not match.');
      return;
    }

    setBusy(true);
    try {
      const hashedPin = await hashPinForTransmission(p1);
      const { error: fnErr } = await supabase.functions.invoke('admin_set_pin', {
        body: { pin: hashedPin, role }
      });

      if (fnErr) {
        setLocalErr(fnErr.message || 'Could not set PIN.');
        return;
      }
      setSuccessMsg('PIN saved successfully.');
      setMode('unlock');
      setPin('');
      setPin2('');
    } catch (e: any) {
      setLocalErr(e?.message || 'Could not set PIN.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestReset(e?: React.FormEvent) {
    e?.preventDefault();
    clearMessages();

    const cleaned = resetPhone.replace(/[^\d]/g, '');
    if (cleaned.length < 10) {
      setLocalErr('Enter a valid 10-digit phone number.');
      return;
    }

    // Normalize to E.164 with +1 for Twilio
    const normalizedPhone = normalizePhoneForTwilio(resetPhone);

    setBusy(true);
    try {
      await supabase.functions.invoke('request-pin-reset', {
        body: { phone: normalizedPhone }
      });
      // Always show success to prevent phone enumeration
      setSuccessMsg('If this phone is registered, a code has been sent.');
      setMode('verify');
    } catch {
      setSuccessMsg('If this phone is registered, a code has been sent.');
      setMode('verify');
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyCode(e?: React.FormEvent) {
    e?.preventDefault();
    clearMessages();

    if (!/^\d{4,8}$/.test(smsCode)) {
      setLocalErr('Enter the verification code.');
      return;
    }

    const normalizedPhone = normalizePhoneForTwilio(resetPhone);

    setBusy(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('verify-pin-reset', {
        body: { phone: normalizedPhone, code: smsCode }
      });

      if (fnErr || !data?.otp_token) {
        setLocalErr('Invalid or expired code.');
        return;
      }

      setOtpToken(data.otp_token);
      setSuccessMsg('Verified! Set your new PIN.');
      setSmsCode('');
      setMode('reset');
    } catch (e: any) {
      setLocalErr(e?.message || 'Verification failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPin(e?: React.FormEvent) {
    e?.preventDefault();
    clearMessages();
    const p1 = cleanPin(pin);
    const p2 = cleanPin(pin2);

    if (!/^\d{4,8}$/.test(p1)) {
      setLocalErr('PIN must be 4-8 digits.');
      return;
    }
    if (p1 !== p2) {
      setLocalErr('PINs do not match.');
      return;
    }
    if (!otpToken) {
      setLocalErr('Session expired. Start over.');
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

      setOtpToken(null);
      setResetPhone('');
      setPin('');
      setPin2('');
      setSuccessMsg('PIN reset successfully!');
      setMode('unlock');
    } catch (e: any) {
      setLocalErr(e?.message || 'Could not reset PIN.');
    } finally {
      setBusy(false);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (mode === 'unlock') handleUnlock();
      else if (mode === 'setpin') handleSetPin();
      else if (mode === 'forgot') handleRequestReset();
      else if (mode === 'verify') handleVerifyCode();
      else if (mode === 'reset') handleResetPin();
    }
  };

  // === RENDER ===

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div
          className="text-white text-center py-8 px-6 rounded-t-2xl"
          style={{ background: branding.gradient || 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)' }}
        >
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Admin Access</h1>
          <p className="text-blue-100 text-sm mt-1">{branding.appName || 'WellFit'}</p>
        </div>

        {/* Card */}
        <div className="bg-white p-6 rounded-b-2xl shadow-xl">
          {/* User info */}
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-semibold text-sm">
                {userLabel.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{userLabel}</p>
              {detectedRole && (
                <p className="text-xs text-gray-500">{ROLE_DISPLAY_NAMES[detectedRole] || detectedRole}</p>
              )}
            </div>
            {userTenantCode && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                {userTenantCode}
              </span>
            )}
          </div>

          {/* Messages */}
          {localErr && (
            <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 rounded-r">
              <p className="text-red-700 text-sm">{localErr}</p>
            </div>
          )}
          {(error && !localErr) && (
            <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 rounded-r">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
          {successMsg && (
            <div className="mb-4 p-3 bg-green-50 border-l-4 border-green-500 rounded-r">
              <p className="text-green-700 text-sm">{successMsg}</p>
            </div>
          )}

          {/* === UNLOCK MODE === */}
          {mode === 'unlock' && (
            <form onSubmit={handleUnlock} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-[0.5em] font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(cleanPin(e.target.value))}
                  onKeyDown={handleKeyDown}
                  maxLength={8}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !pin.trim()}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Verifying...' : 'Unlock'}
              </button>

              <div className="flex justify-between text-sm pt-2">
                <button
                  type="button"
                  onClick={() => { clearMessages(); setMode('forgot'); setPin(''); }}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Forgot PIN?
                </button>
                <button
                  type="button"
                  onClick={() => { clearMessages(); setMode('setpin'); setPin(''); }}
                  className="text-gray-600 hover:text-gray-800"
                >
                  Set/Change PIN
                </button>
              </div>
            </form>
          )}

          {/* === SET PIN MODE === */}
          {mode === 'setpin' && (
            <form onSubmit={handleSetPin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-xl tracking-[0.3em] font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="4-8 digits"
                  value={pin}
                  onChange={(e) => setPin(cleanPin(e.target.value))}
                  onKeyDown={handleKeyDown}
                  maxLength={8}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-xl tracking-[0.3em] font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Confirm"
                  value={pin2}
                  onChange={(e) => setPin2(cleanPin(e.target.value))}
                  onKeyDown={handleKeyDown}
                  maxLength={8}
                />
              </div>

              <button
                type="submit"
                disabled={busy || !pin.trim() || !pin2.trim()}
                className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {busy ? 'Saving...' : 'Save PIN'}
              </button>

              <button
                type="button"
                onClick={() => { clearMessages(); setMode('unlock'); setPin(''); setPin2(''); }}
                className="w-full py-2 text-gray-600 hover:text-gray-800 text-sm"
              >
                Back to Unlock
              </button>
            </form>
          )}

          {/* === FORGOT PIN MODE === */}
          {mode === 'forgot' && (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Enter your phone number to receive a verification code.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                <input
                  type="tel"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="(555) 123-4567"
                  value={resetPhone}
                  onChange={(e) => setResetPhone(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">US numbers only. We'll add +1 automatically.</p>
              </div>

              <button
                type="submit"
                disabled={busy || !resetPhone.trim()}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {busy ? 'Sending...' : 'Send Code'}
              </button>

              <button
                type="button"
                onClick={() => { clearMessages(); setMode('unlock'); setResetPhone(''); }}
                className="w-full py-2 text-gray-600 hover:text-gray-800 text-sm"
              >
                Back to Unlock
              </button>
            </form>
          )}

          {/* === VERIFY CODE MODE === */}
          {mode === 'verify' && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="text-center mb-4">
                <p className="text-sm text-gray-600">Code sent to:</p>
                <p className="font-medium text-gray-900">{formatPhoneDisplay(resetPhone)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Verification Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="w-full px-4 py-4 border border-gray-300 rounded-lg text-center text-2xl tracking-[0.5em] font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••"
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value.replace(/[^\d]/g, '').slice(0, 8))}
                  onKeyDown={handleKeyDown}
                  maxLength={8}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={busy || !smsCode.trim()}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {busy ? 'Verifying...' : 'Verify'}
              </button>

              <div className="flex justify-between text-sm pt-2">
                <button
                  type="button"
                  onClick={() => { clearMessages(); setMode('forgot'); setSmsCode(''); }}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Resend Code
                </button>
                <button
                  type="button"
                  onClick={() => { clearMessages(); setMode('unlock'); setSmsCode(''); setResetPhone(''); }}
                  className="text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* === RESET PIN MODE === */}
          {mode === 'reset' && (
            <form onSubmit={handleResetPin} className="space-y-4">
              <div className="text-center mb-4 p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-700 font-medium">Code verified! Set your new PIN.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-xl tracking-[0.3em] font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="4-8 digits"
                  value={pin}
                  onChange={(e) => setPin(cleanPin(e.target.value))}
                  onKeyDown={handleKeyDown}
                  maxLength={8}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-xl tracking-[0.3em] font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Confirm"
                  value={pin2}
                  onChange={(e) => setPin2(cleanPin(e.target.value))}
                  onKeyDown={handleKeyDown}
                  maxLength={8}
                />
              </div>

              <button
                type="submit"
                disabled={busy || !pin.trim() || !pin2.trim()}
                className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {busy ? 'Saving...' : 'Set New PIN'}
              </button>

              <button
                type="button"
                onClick={() => { clearMessages(); setMode('unlock'); setPin(''); setPin2(''); setOtpToken(null); }}
                className="w-full py-2 text-gray-600 hover:text-gray-800 text-sm"
              >
                Cancel
              </button>
            </form>
          )}

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 text-center">
              Session expires after 30 minutes of inactivity.
            </p>
            <div className="mt-3 flex justify-center gap-4">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Return to Dashboard
              </button>
              <button
                type="button"
                onClick={() => navigate('/envision')}
                className="text-xs text-gray-400 hover:text-teal-600"
              >
                Envision
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
