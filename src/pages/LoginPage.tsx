// src/pages/LoginPage.tsx - PRODUCTION-READY with hCaptcha (CRA + Supabase v2)
// Uses credentials.options.captchaToken to satisfy TypeScript, no casts needed.
// SOC2 CC6.1: Includes rate limiting and account lockout protection

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useSupabaseClient } from '../contexts/AuthContext';
// Branding config replaces hardcoded WELLFIT_COLORS and APP_INFO
import HCaptchaWidget, { HCaptchaRef } from '../components/HCaptchaWidget';
import { isPasskeySupported, authenticateWithPasskey } from '../services/passkeyService';
import { useBranding } from '../BrandingContext';
import {
  isAccountLocked,
  formatLockoutMessage,
  recordLoginAttempt,
} from '../services/loginSecurityService';
import { auditLogger } from '../services/auditLogger';

type Mode = 'senior' | 'patient' | 'admin';

const isPhone = (val: string) => /^\d{10,15}$/.test(val.replace(/[^\d]/g, ''));

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const supabase = useSupabaseClient();
  const { branding } = useBranding();

  // Check for redirect message from registration
  const locationState = location.state as { message?: string; phone?: string } | null;
  const redirectMessage = locationState?.message;
  const prefillPhone = locationState?.phone;

  // Default to admin mode for easier staff access, but switch to senior if coming from register
  const [mode, setMode] = useState<Mode>(prefillPhone ? 'senior' : 'admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // senior fields - prefill phone if coming from register redirect
  const [phone, setPhone] = useState(prefillPhone || '+1 ');
  const [seniorPassword, setSeniorPassword] = useState('');

  // admin fields
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // captcha state
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptchaRef>(null);

  // password visibility state
  const [showSeniorPassword, setShowSeniorPassword] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // passkey state
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  // colors from branding config
  const primary = branding.primaryColor;
  const accent = branding.secondaryColor;

  // Debug info (dev only)
  const debug = useMemo(() => {
    try {
      const client: any = supabase as any;
      return {
        url: client?.rest?.url ?? 'n/a',
        hasAuth: !!client?.auth,
      };
    } catch {
      return { url: 'n/a', hasAuth: false };
    }
  }, [supabase]);

  // Normalize phone to +E.164-ish
  const normalizeToE164 = (raw: string): string => {
    const digits = raw.replace(/[^\d]/g, '');
    if (!/^\d{10,15}$/.test(digits)) throw new Error('Invalid phone');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return raw.startsWith('+') ? raw : `+${digits}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Remove all non-digits to get clean number (ONLY numbers allowed)
    const digits = value.replace(/[^\d]/g, '');

    // Always format with +1 prefix
    if (digits.length === 0) {
      // Keep the +1 prefix even when empty
      setPhone('+1 ');
      return;
    }

    // Extract phone digits (removing country code if typed)
    const phoneDigits = digits.startsWith('1') && digits.length > 1 ? digits.slice(1) : digits;

    // Limit to 10 digits
    const limitedDigits = phoneDigits.slice(0, 10);

    // Format as +1 XXX-XXX-XXXX
    let formatted = '+1 ';
    if (limitedDigits.length > 0) {
      formatted += limitedDigits.slice(0, 3);
    }
    if (limitedDigits.length > 3) {
      formatted += '-' + limitedDigits.slice(3, 6);
    }
    if (limitedDigits.length > 6) {
      formatted += '-' + limitedDigits.slice(6, 10);
    }

    setPhone(formatted);
  };

  // ---- PROFILE GATE --------------------------------------------------------
  const nextRouteForUser = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return '/login';

    const { data, error } = await supabase
      .from('profiles')
      .select('force_password_change, consent, demographics_complete, onboarded, role, role_code')
      .eq('user_id', uid)
      .maybeSingle();

    if (error) {
      auditLogger.warn('PROFILE_FETCH_ERROR', { error: error.message, userId: uid });
      return '/dashboard';
    }

    // If no profile exists, go to dashboard and let AuthGate handle it
    if (!data) {
      auditLogger.warn('NO_PROFILE_FOUND', { userId: uid, redirectTo: '/dashboard' });
      return '/dashboard';
    }

    const forcePwd = (data as any)?.force_password_change ?? false;
    const consent  = (data as any)?.consent ?? false;
    const demoDone = (data as any)?.demographics_complete ?? false;
    const onboard  = (data as any)?.onboarded ?? false;
    const role = (data as any)?.role || '';
    const roleCode = (data as any)?.role_code || 0;

    auditLogger.debug('Login page profile data loaded', { forcePwd, consent, demoDone, onboard, role, roleCode });

    // 1. Forced password change applies to everyone (including admins)
    if (forcePwd) return '/change-password';

    // 2. Check if user has any staff role (admin, nurse, physician, etc.)
    // All staff bypass demographics and consent - go straight to PIN verification
    const staffRoles = [
      'super_admin',           // 1: Platform administrators
      'admin',                 // 2: Facility administrators
      'nurse',                 // 3: RN, LPN
      'physician',             // 5: Attending physicians
      'doctor',                // 5: Synonym for physician
      'nurse_practitioner',    // 8: Advanced practice provider
      'physician_assistant',   // 9: Advanced practice provider
      'clinical_supervisor',   // 10: Operational managers
      'department_head',       // 11: Executive leadership (CNO, CMO)
      'physical_therapist',    // 12: Allied health
      'case_manager',          // 14: Care coordination
      'social_worker',         // 15: Psychosocial services
      'community_health_worker', // 17: CHW field workers
      'chw',                   // 18: Synonym for CHW
      'it_admin',              // 19: Tenant IT administrators
    ];

    // All staff role codes (matches roles above)
    const staffRoleCodes = [1, 2, 3, 5, 8, 9, 10, 11, 12, 14, 15, 17, 18, 19];

    if (staffRoles.includes(role) || staffRoleCodes.includes(roleCode)) {
      auditLogger.auth('LOGIN', true, { userType: 'staff', role, roleCode, redirectTo: '/admin-login' });
      return '/admin-login';
    }

    // 3. Caregiver role routing
    if (role === 'caregiver' || roleCode === 6) {
      return '/caregiver-dashboard';
    }

    // 4. Regular users (seniors) must complete onboarding flow
    // Demographics/onboarding MUST come before consent
    if (!onboard || !demoDone) return '/demographics';

    // Only check consent after demographics is complete
    if (!consent) return '/consent-photo';

    // 5. Seniors should set caregiver PIN after consent (optional but recommended)
    // Check if senior has set caregiver PIN - only for seniors (role_code 4)
    const isSenior = role === 'senior' || roleCode === 4;
    if (isSenior) {
      const { data: pinData } = await supabase
        .from('caregiver_pins')
        .select('senior_user_id')
        .eq('senior_user_id', uid)
        .maybeSingle();

      if (!pinData) {
        auditLogger.info('SENIOR_CAREGIVER_PIN_SETUP_REQUIRED', { userId: uid, redirectTo: '/set-caregiver-pin' });
        return '/set-caregiver-pin';
      }
    }

    // 6. All onboarding complete - go to dashboard
    return '/dashboard';
  };
  // --------------------------------------------------------------------------

  // Check if already logged in - show message instead of auto-redirecting (prevents loop)
  const [alreadyLoggedIn, setAlreadyLoggedIn] = useState(false);
  const [existingUserEmail, setExistingUserEmail] = useState('');

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!cancel && session) {
        auditLogger.info('USER_ALREADY_LOGGED_IN', { userId: session.user?.id });
        setAlreadyLoggedIn(true);
        setExistingUserEmail(session.user?.email || session.user?.phone || 'current user');
      }
    })();
    return () => { cancel = true; };
  }, [supabase.auth]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAlreadyLoggedIn(false);
    setExistingUserEmail('');
  };

  const handleContinueAsLoggedIn = async () => {
    auditLogger.info('USER_CONTINUING_EXISTING_SESSION', {});
    const route = await nextRouteForUser();
    navigate(route, { replace: true });
  };

  // Check passkey support
  useEffect(() => {
    setPasskeySupported(isPasskeySupported());
  }, []);

  // Captcha helpers
  const refreshCaptcha = () => {
    captchaRef.current?.reset();
    setCaptchaToken(null);
  };
  const ensureCaptcha = async (): Promise<string> => {
    if (captchaToken) return captchaToken;
    try {
      const t = await captchaRef.current?.execute();
      return t || '';
    } catch (error) {
      auditLogger.error('HCAPTCHA_EXECUTION_FAILED', error instanceof Error ? error : new Error(String(error)));
      return '';
    }
  };

  // Passkey login handler
  const handlePasskeyLogin = async () => {
    setError('');
    setPasskeyLoading(true);

    try {
      await authenticateWithPasskey();

      // Navigate to appropriate page
      const route = await nextRouteForUser();
      navigate(route, { replace: true });
    } catch (err: any) {
      auditLogger.auth('LOGIN_FAILED', false, { method: 'passkey', error: err.message });
      setError(err.message || 'Biometric login failed. Please try password login instead.');
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleSeniorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!phone || !seniorPassword) {
      setError('Please enter both phone number and password.');
      return;
    }
    if (!isPhone(phone)) {
      setError('Please enter a valid phone number.');
      return;
    }

    setLoading(true);
    try {
      const e164 = normalizeToE164(phone);

      // SOC2 CC6.1: Check if account is locked before attempting login
      // Uses Edge Function for server-side check (no JWT required)
      const lockoutInfo = await isAccountLocked(e164);
      if (lockoutInfo.isLocked) {
        setError(formatLockoutMessage(lockoutInfo));
        setLoading(false);
        return;
      }

      // SOC2 CC6.1: Require valid captcha before allowing login attempt
      let token = '';
      try {
        token = await ensureCaptcha();
      } catch {
        // Captcha failed - do not allow login
      }

      if (!token) {
        setError('Please complete the captcha verification.');
        refreshCaptcha();
        setLoading(false);
        return;
      }

      // Silently skip audit logging to avoid hanging
      try {
        auditLogger.auth('LOGIN', true, { method: 'phone_password', hasToken: !!token, phoneLength: e164?.length });
      } catch {
        // Ignore audit logging errors
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        phone: e164,
        password: seniorPassword,
        options: { captchaToken: token },
      });

      // SOC2 CC6.1: Record login attempt via Edge Function (works for both success/failure)
      recordLoginAttempt({
        identifier: e164,
        attemptType: 'password',
        success: !signInError,
        userId: data?.user?.id,
        errorMessage: signInError?.message,
      });

      if (signInError) {
        const msg = (signInError.message || '').toLowerCase();

        // Check for invalid credentials FIRST (most common case)
        if (msg.includes('invalid login credentials') || msg.includes('invalid password')) {
          setError('Login failed. Check your phone number and password.');
        } else if (msg.includes('captcha verification') || msg.includes('captcha token')) {
          // Only treat as captcha error if explicitly about captcha verification
          refreshCaptcha();
          setError('Captcha failed. Please try again.');
        } else if (msg.includes('confirm')) {
          setError('Account not confirmed. Please complete verification.');
        } else {
          setError('An error occurred during login. Please try again.');
        }
        return;
      }

      auditLogger.auth('LOGIN', true, { method: 'phone_password', userType: mode });
      const route = await nextRouteForUser();
      auditLogger.info('CARE_RECIPIENT_LOGIN_NAVIGATION', { route, mode });
      navigate(route, { replace: true });
    } catch (err: any) {
      auditLogger.auth('LOGIN_FAILED', false, { method: 'phone_password', error: err?.message });
      setError(err?.message || 'Unexpected error during login.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!adminEmail || !adminPassword) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const emailTrimmed = adminEmail.trim();

      // SOC2 CC6.1: Check if account is locked before attempting login
      // Uses Edge Function for server-side check (no JWT required)
      const lockoutInfo = await isAccountLocked(emailTrimmed);
      if (lockoutInfo.isLocked) {
        setError(formatLockoutMessage(lockoutInfo));
        setLoading(false);
        return;
      }

      // SOC2 CC6.1: Require valid captcha before allowing login attempt
      let token = '';
      try {
        token = await ensureCaptcha();
      } catch {
        // Captcha failed - do not allow login
      }

      if (!token) {
        setError('Please complete the captcha verification.');
        refreshCaptcha();
        setLoading(false);
        return;
      }

      // Silently skip audit logging to avoid hanging
      try {
        auditLogger.auth('LOGIN', true, { method: 'email_password', userType: 'admin', hasToken: !!token, emailLength: emailTrimmed?.length });
      } catch {
        // Ignore audit logging errors
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: emailTrimmed,
        password: adminPassword,
        options: { captchaToken: token },
      });

      // SOC2 CC6.1: Record login attempt via Edge Function (works for both success/failure)
      recordLoginAttempt({
        identifier: emailTrimmed,
        attemptType: 'password',
        success: !signInError,
        userId: data?.user?.id,
        errorMessage: signInError?.message,
      });

      if (signInError) {
        const msg = (signInError.message || '').toLowerCase();

        // Check for invalid credentials FIRST (most common case)
        if (msg.includes('invalid login credentials') || msg.includes('invalid password')) {
          setError('Admin login failed. Check your email and password.');
        } else if (msg.includes('captcha verification') || msg.includes('captcha token')) {
          // Only treat as captcha error if explicitly about captcha verification
          refreshCaptcha();
          setError('Captcha failed. Please try again.');
        } else if (msg.includes('confirm')) {
          setError('Email not confirmed. Please check your inbox.');
        } else {
          setError('An error occurred during admin login. Please try again.');
        }
        return;
      }

      auditLogger.auth('LOGIN', true, { method: 'email_password', userType: 'admin' });
      const route = await nextRouteForUser();
      auditLogger.info('ADMIN_LOGIN_NAVIGATION', { route });
      navigate(route, { replace: true });
    } catch (err: any) {
      auditLogger.auth('LOGIN_FAILED', false, { method: 'email_password', userType: 'admin', error: err?.message });
      setError(err?.message || 'Unexpected error during admin login.');
    } finally {
      setLoading(false);
    }
  };

  // If already logged in, show message with options
  if (alreadyLoggedIn) {
    return (
      <div className="min-h-screen py-16 px-4" style={{ background: branding.gradient }}>
        <div
          className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-md"
          style={{ borderColor: accent, borderWidth: '2px' }}
        >
          <img
            src={branding.logoUrl}
            alt={`${branding.appName} Logo`}
            className="h-16 w-auto mx-auto mb-4"
          />

          <h1 className="text-2xl font-bold text-center mb-4" style={{ color: primary }}>
            Already Logged In
          </h1>

          <p className="text-center text-gray-700 mb-6">
            You are currently logged in as <strong>{existingUserEmail}</strong>
          </p>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleContinueAsLoggedIn}
              className="w-full py-3 font-semibold rounded hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 text-white"
              style={{ backgroundColor: primary }}
            >
              Continue to Dashboard
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-3 font-semibold rounded border-2 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{ borderColor: accent, color: primary }}
            >
              Logout and Login as Different User
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-16 px-4" style={{ background: branding.gradient }}>
      <div
        className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-md"
        style={{ borderColor: accent, borderWidth: '2px' }}
      >
        <img
          src={branding.logoUrl}
          alt={`${branding.appName} Logo`}
          className="h-16 w-auto mx-auto mb-4"
        />

        <h1 className="text-2xl font-bold text-center mb-2" style={{ color: primary }}>
          {branding.appName}
        </h1>

      {/* Mode Toggle */}
      <div className="flex justify-center gap-2 mb-6 flex-wrap">
        <button
          type="button"
          onClick={() => { setMode('patient'); setError(''); }}
          className={`px-3 py-1 rounded ${mode === 'patient' ? 'bg-gray-900 text-white' : 'bg-gray-200'}`}
          aria-pressed={mode === 'patient'}
        >
          Patient Login (Phone)
        </button>
        <button
          type="button"
          onClick={() => { setMode('senior'); setError(''); }}
          className={`px-3 py-1 rounded ${mode === 'senior' ? 'bg-gray-900 text-white' : 'bg-gray-200'}`}
          aria-pressed={mode === 'senior'}
        >
          Senior Login (Phone)
        </button>
        <button
          type="button"
          onClick={() => { setMode('admin'); setError(''); }}
          className={`px-3 py-1 rounded ${mode === 'admin' ? 'bg-gray-900 text-white' : 'bg-gray-200'}`}
          aria-pressed={mode === 'admin'}
        >
          Admin Login (Email)
        </button>
        <button
          type="button"
          onClick={() => navigate('/caregiver-access')}
          className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700 transition-colors"
        >
          Caregiver Access
        </button>
      </div>

      {/* Forms */}
      {/* Show redirect message from registration */}
      {redirectMessage && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800 text-center font-medium">{redirectMessage}</p>
        </div>
      )}

      {(mode === 'senior' || mode === 'patient') ? (
        <form onSubmit={handleSeniorLogin} className="space-y-4" noValidate>
          <div>
            <label htmlFor="phone-input" className="block text-sm font-medium text-gray-700 mb-1 text-left">
              Phone Number
            </label>
            <input
              id="phone-input"
              type="tel"
              placeholder="+1 555-555-5555"
              value={phone}
              onChange={handlePhoneChange}
              required
              aria-required="true"
              aria-invalid={Boolean(error && phone.trim() === '')}
              className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:outline-none"
              style={{ borderColor: accent, outlineColor: primary } as React.CSSProperties}
              autoComplete="tel"
              inputMode="tel"
            />
            <p className="text-xs text-left mt-1 text-gray-500">
              You don't need to type "+1". We add it for you.
            </p>
          </div>

          <div>
            <label htmlFor="senior-password-input" className="block text-sm font-medium text-gray-700 mb-1 text-left">
              Password
            </label>
            <div className="relative">
              <input
                id="senior-password-input"
                type={showSeniorPassword ? "text" : "password"}
                placeholder="Password"
                value={seniorPassword}
                onChange={e => setSeniorPassword(e.target.value)}
                required
                aria-required="true"
                aria-invalid={Boolean(error && seniorPassword.trim() === '')}
                className="w-full p-3 pr-12 border border-gray-300 rounded focus:ring-2 focus:outline-none"
                style={{ borderColor: accent, outlineColor: primary } as React.CSSProperties}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowSeniorPassword(!showSeniorPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                aria-label={showSeniorPassword ? "Hide password" : "Show password"}
              >
                {showSeniorPassword ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && <p role="alert" className="text-red-500 text-sm font-semibold">{error}</p>}

          <button
            type="submit"
            className="w-full py-3 font-semibold rounded hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 text-white"
            style={{ backgroundColor: primary }}
            disabled={loading}
          >
            {loading ? 'Logging In...' : 'Log In'}
          </button>

          {/* Passkey Login Button */}
          {passkeySupported && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">OR</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handlePasskeyLogin}
                disabled={passkeyLoading || loading}
                className="w-full py-3 font-semibold rounded border-2 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                style={{ borderColor: accent, color: primary }}
              >
                {passkeyLoading ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Authenticating...
                  </>
                ) : (
                  <>
                    <span className="mr-2">🔐</span>
                    Login with Biometrics
                  </>
                )}
              </button>
            </>
          )}

          <div className="mt-2 text-center space-y-2">
            <Link to="/register" className="block text-sm underline" style={{ color: primary }}>
              Don't have an account? Register here
            </Link>
            <Link
              to="/phone-reset"
              className="block text-sm underline"
              style={{ color: primary }}
            >
              Forgot your password?
            </Link>
          </div>

          {/* Dev-only debug canary */}
          {import.meta.env.MODE !== 'production' && (
            <div className="mt-3 text-xs text-gray-500 text-center">
              <div>Auth URL: {debug.url}</div>
              <div>Client Ready: {String(debug.hasAuth)}</div>
            </div>
          )}

          <HCaptchaWidget
            ref={captchaRef}
            size="invisible"
            onVerify={(t: string) => setCaptchaToken(t)}
            onExpire={() => setCaptchaToken(null)}
            onError={(msg: string) => auditLogger.error('HCAPTCHA_ERROR', new Error(msg))}
          />
        </form>
      ) : (
        <form onSubmit={handleAdminLogin} className="space-y-4" noValidate>
          <div>
            <label htmlFor="admin-email-input" className="block text-sm font-medium text-gray-700 mb-1 text-left">
              Admin Email
            </label>
            <input
              id="admin-email-input"
              type="email"
              placeholder="you@org.com"
              value={adminEmail}
              onChange={e => {
                // Only allow email format - no phone numbers
                const value = e.target.value;
                // Allow only valid email characters: letters, numbers, @, ., -, _
                const emailValue = value.replace(/[^a-zA-Z0-9@.\-_]/g, '');
                setAdminEmail(emailValue);
              }}
              required
              aria-required="true"
              aria-invalid={Boolean(error && adminEmail.trim() === '')}
              className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:outline-none"
              style={{ borderColor: accent, outlineColor: primary } as React.CSSProperties}
              autoComplete="email"
              inputMode="email"
            />
          </div>

          <div>
            <label htmlFor="admin-password-input" className="block text-sm font-medium text-gray-700 mb-1 text-left">
              Password
            </label>
            <div className="relative">
              <input
                id="admin-password-input"
                type={showAdminPassword ? "text" : "password"}
                placeholder="Password"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                required
                aria-required="true"
                aria-invalid={Boolean(error && adminPassword.trim() === '')}
                className="w-full p-3 pr-12 border border-gray-300 rounded focus:ring-2 focus:outline-none"
                style={{ borderColor: accent, outlineColor: primary } as React.CSSProperties}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowAdminPassword(!showAdminPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                aria-label={showAdminPassword ? "Hide password" : "Show password"}
              >
                {showAdminPassword ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && <p role="alert" className="text-red-500 text-sm font-semibold">{error}</p>}

          <div className="flex items-center justify-between">
            <Link to="/reset-password" className="text-sm underline" style={{ color: primary }}>
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            className="w-full py-3 font-semibold rounded hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 text-white"
            style={{ backgroundColor: primary }}
            disabled={loading}
          >
            {loading ? 'Logging In...' : 'Log In as Admin'}
          </button>

          <div className="mt-2 text-center">
            <p className="text-xs text-gray-600">
              After email login, you'll need to enter your admin PIN
            </p>
          </div>

          {/* Dev-only debug canary */}
          {import.meta.env.MODE !== 'production' && (
            <div className="mt-3 text-xs text-gray-500 text-center">
              <div>Auth URL: {debug.url}</div>
              <div>Client Ready: {String(debug.hasAuth)}</div>
            </div>
          )}

          <HCaptchaWidget
            ref={captchaRef}
            size="invisible"
            onVerify={(t: string) => setCaptchaToken(t)}
            onExpire={() => setCaptchaToken(null)}
            onError={(msg: string) => auditLogger.error('HCAPTCHA_ERROR', new Error(msg))}
          />
        </form>
      )}

        {/* Hidden Envision login link - if you know, you know */}
        <div className="mt-6 text-center">
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
  );
};

export default LoginPage;
