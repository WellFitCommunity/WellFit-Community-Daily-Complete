// src/pages/LoginPage.tsx - PRODUCTION-READY with hCaptcha (CRA + Supabase v2)
// Uses credentials.options.captchaToken to satisfy TypeScript, no casts needed.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSupabaseClient } from '../contexts/AuthContext';
import { WELLFIT_COLORS, APP_INFO } from '../settings/settings';
import HCaptchaWidget, { HCaptchaRef } from '../components/HCaptchaWidget';
import { isPasskeySupported, authenticateWithPasskey } from '../services/passkeyService';

type Mode = 'senior' | 'admin';

const isPhone = (val: string) => /^\d{10,15}$/.test(val.replace(/[^\d]/g, ''));

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const supabase = useSupabaseClient();

  const [mode, setMode] = useState<Mode>('senior');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // senior fields
  const [phone, setPhone] = useState('+1 ');
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

  // colors
  const primary = WELLFIT_COLORS.blue;   // #003865
  const accent  = WELLFIT_COLORS.green;  // #8cc63f

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
    let value = e.target.value;

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
      .select('force_password_change, consent, data_consent, demographics_complete, demographic_complete, onboarded, role, role_code')
      .eq('user_id', uid)
      .maybeSingle();

    if (error) {
      console.warn('[LoginPage] Profile fetch error:', error.message);
      return '/dashboard';
    }

    // If no profile exists, go to dashboard and let AuthGate handle it
    if (!data) {
      console.warn('[LoginPage] No profile found for user, redirecting to dashboard');
      return '/dashboard';
    }

    const forcePwd = (data as any)?.force_password_change ?? false;
    const consent  = (data as any)?.consent ?? (data as any)?.data_consent ?? false;
    const demoDone = (data as any)?.demographics_complete ?? (data as any)?.demographic_complete ?? false;
    const onboard  = (data as any)?.onboarded ?? false;
    const role = (data as any)?.role || '';
    const roleCode = (data as any)?.role_code || 0;

    console.log('[LoginPage] Profile data:', { forcePwd, consent, demoDone, onboard, role, roleCode });

    // 1. Forced password change applies to everyone (including admins)
    if (forcePwd) return '/change-password';

    // 2. Check if user has any staff role (admin, nurse, physician, etc.)
    // All staff bypass demographics and consent - go straight to PIN verification
    const staffRoles = [
      'admin', 'super_admin', 'nurse', 'physician', 'doctor',
      'nurse_practitioner', 'physician_assistant', 'clinical_supervisor',
      'department_head', 'physical_therapist'
    ];

    const staffRoleCodes = [1, 2, 3, 5, 8, 9, 10, 11, 12]; // All staff role codes

    if (staffRoles.includes(role) || staffRoleCodes.includes(roleCode)) {
      console.log('[LoginPage] Staff role detected:', role, 'code:', roleCode, '- redirecting to admin-login for PIN');
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

    // 5. All onboarding complete - go to dashboard
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
        console.log('[LoginPage] User already logged in');
        setAlreadyLoggedIn(true);
        setExistingUserEmail(session.user?.email || session.user?.phone || 'current user');
      }
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAlreadyLoggedIn(false);
    setExistingUserEmail('');
  };

  const handleContinueAsLoggedIn = async () => {
    console.log('[LoginPage] Continuing as logged-in user...');
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
      console.error('hCaptcha execution failed:', error);
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
      console.error('Passkey login failed:', err);
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
      const token = await ensureCaptcha().catch(() => '');

      console.log('[LoginPage] Login attempt:', { phone: e164, hasToken: !!token, tokenPrefix: token?.substring(0, 20) });

      const { error: signInError } = await supabase.auth.signInWithPassword({
        phone: e164,
        password: seniorPassword,
        options: token ? { captchaToken: token } : {},
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
          // For debugging: show actual error in console
          console.error('[LoginPage] Unhandled auth error:', signInError.message);
          setError('An error occurred during login. Please try again.');
        }
        return;
      }

      console.log('[LoginPage] Senior login successful, determining route...');
      const route = await nextRouteForUser();
      console.log('[LoginPage] Senior navigating to:', route);
      navigate(route, { replace: true });
    } catch (err: any) {
      console.error('[LoginPage] Senior login error:', err);
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
      const token = await ensureCaptcha().catch(() => '');

      console.log('[LoginPage] Admin login attempt:', { email: adminEmail, hasToken: !!token, tokenPrefix: token?.substring(0, 20) });

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: adminEmail.trim(),
        password: adminPassword,
        options: token ? { captchaToken: token } : {},
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
          // For debugging: show actual error in console
          console.error('[LoginPage] Unhandled admin auth error:', signInError.message);
          setError('An error occurred during admin login. Please try again.');
        }
        return;
      }

      console.log('[LoginPage] Admin login successful, determining route...');
      const route = await nextRouteForUser();
      console.log('[LoginPage] Admin navigating to:', route);
      navigate(route, { replace: true });
    } catch (err: any) {
      console.error('[LoginPage] Admin login error:', err);
      setError(err?.message || 'Unexpected error during admin login.');
    } finally {
      setLoading(false);
    }
  };

  // If already logged in, show message with options
  if (alreadyLoggedIn) {
    return (
      <div
        className="max-w-md mx-auto mt-16 p-6 bg-white rounded-xl shadow-md"
        style={{ borderColor: accent, borderWidth: '2px' }}
      >
        <img
          src="/android-chrome-512x512.png"
          alt={`${APP_INFO.name} Logo`}
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
    );
  }

  return (
    <div
      className="max-w-md mx-auto mt-16 p-6 bg-white rounded-xl shadow-md"
      style={{ borderColor: accent, borderWidth: '2px' }}
    >
      <img
        src="/android-chrome-512x512.png"
        alt={`${APP_INFO.name} Logo`}
        className="h-16 w-auto mx-auto mb-4"
      />

      <h1 className="text-2xl font-bold text-center mb-2" style={{ color: primary }}>
        {APP_INFO.name}
      </h1>

      {/* Mode Toggle */}
      <div className="flex justify-center gap-2 mb-6">
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
      </div>

      {/* Forms */}
      {mode === 'senior' ? (
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
          {process.env.NODE_ENV !== 'production' && (
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
            onError={(msg: string) => console.error('hCaptcha error:', msg)}
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
          {process.env.NODE_ENV !== 'production' && (
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
            onError={(msg: string) => console.error('hCaptcha error:', msg)}
          />
        </form>
      )}
    </div>
  );
};

export default LoginPage;
