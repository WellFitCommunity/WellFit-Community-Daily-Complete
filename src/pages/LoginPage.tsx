// src/pages/LoginPage.tsx - PRODUCTION-READY (TS-safe profile gate)
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSupabaseClient } from '../contexts/AuthContext';
import { WELLFIT_COLORS, APP_INFO } from '../settings/settings';

type Mode = 'senior' | 'admin';

const isPhone = (val: string) => /^\d{10,15}$/.test(val.replace(/[^\d]/g, ''));

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const supabase = useSupabaseClient();

  const [mode, setMode] = useState<Mode>('senior');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // senior fields
  const [phone, setPhone] = useState('');
  const [seniorPassword, setSeniorPassword] = useState('');

  // admin fields
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

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

  // ---- TS-SAFE PROFILE GATE -----------------------------------------------
  // Avoids .returns<T>() issues and tolerates column name drift.
  const nextRouteForUser = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return '/login';

    // Fetch loosely (no .returns<T>(), no compile-time shape)
    const { data, error } = await supabase
      .from('profiles')
      .select('force_password_change, consent, data_consent, demographics_complete, demographic_complete, onboarded, role, role_code')
      .eq('user_id', uid)
      .maybeSingle();

    if (error) {
      console.warn('Profile fetch error:', error.message);
      // Fail-open to dashboard; RLS still protects sensitive things.
      return '/dashboard';
    }

    // Defensive mapping in case your actual column names differ
    const forcePwd = (data as any)?.force_password_change ?? false;
    const consent  = (data as any)?.consent ?? (data as any)?.data_consent ?? false;
    const demoDone = (data as any)?.demographics_complete ?? (data as any)?.demographic_complete ?? false;
    const onboard  = (data as any)?.onboarded ?? false;
    const role = (data as any)?.role || '';
    const roleCode = (data as any)?.role_code || 0;

    if (forcePwd) return '/change-password';
    if (!consent)  return '/consent-photo';
    if (!onboard || !demoDone) return '/demographics';

    // Role-based routing after profile completion
    // Admin users need PIN authentication
    if (role === 'admin' || role === 'super_admin' || roleCode === 1 || roleCode === 2) {
      return '/admin-login';
    }

    // Caregivers get special dashboard with senior PIN entry
    if (role === 'caregiver' || roleCode === 6) {
      return '/caregiver-dashboard';
    }

    // Seniors and other users get standard dashboard
    return '/dashboard';
  };
  // -------------------------------------------------------------------------

  // If already signed in, route immediately
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!cancel && session) {
        const route = await nextRouteForUser();
        navigate(route, { replace: true });
      }
    })();
    return () => { cancel = true; };
  }, [navigate, supabase]);

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

      const { error: signInError } = await supabase.auth.signInWithPassword({
        phone: e164,
        password: seniorPassword,
      });

      if (signInError) {
        const msg = (signInError.message || '').toLowerCase();
        if (msg.includes('invalid login credentials')) {
          setError('Login failed. Check your phone number and password.');
        } else if (msg.includes('confirm')) {
          setError('Account not confirmed. Please complete phone verification if required.');
        } else if (msg.includes('internal') || msg.includes('server')) {
          setError('Auth service error. Please try again shortly.');
        } else {
          setError('An error occurred during login. Please try again.');
        }
        return;
      }

      const route = await nextRouteForUser();
      navigate(route, { replace: true });
    } catch (err: any) {
      const msg = String(err?.message ?? '');
      if (msg.includes('fetch') || msg.includes('network')) {
        setError('Could not connect to the server. Please try again.');
      } else if (msg.includes('Invalid phone')) {
        setError('Please enter a valid phone number.');
      } else {
        setError('Unexpected error during login. Please try again.');
      }
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
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: adminEmail.trim(),
        password: adminPassword,
      });

      if (signInError) {
        const msg = (signInError.message || '').toLowerCase();
        if (msg.includes('invalid login credentials')) {
          setError('Admin login failed. Check your email and password.');
        } else if (msg.includes('email not confirmed') || msg.includes('confirm')) {
          setError('Email not confirmed. Please check your inbox.');
        } else if (msg.includes('internal') || msg.includes('server')) {
          setError('Auth service error. Please try again shortly.');
        } else {
          setError('An error occurred during admin login. Please try again.');
        }
        return;
      }

      // After email login, route to Admin PIN verification
      navigate('/admin-login', { replace: true });
    } catch (err: any) {
      const msg = String(err?.message ?? '');
      if (msg.includes('fetch') || msg.includes('network')) {
        setError('Could not connect to the server. Please try again.');
      } else {
        setError('Unexpected error during admin login. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

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
              placeholder="(###) ###-####"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              required
              aria-required="true"
              aria-invalid={Boolean(error && !adminEmail)}
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
            <input
              id="senior-password-input"
              type="password"
              placeholder="Password"
              value={seniorPassword}
              onChange={e => setSeniorPassword(e.target.value)}
              required
              aria-required="true"
              aria-invalid={Boolean(error && !adminEmail)}
              className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:outline-none"
              style={{ borderColor: accent, outlineColor: primary } as React.CSSProperties}
              autoComplete="current-password"
            />
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

          <div className="mt-2 text-center space-y-2">
            <Link to="/register" className="block text-sm underline" style={{ color: primary }}>
              Don't have an account? Register here
            </Link>
            <Link
              to={mode === 'senior' ? '/phone-reset' : '/reset-password'}
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
              onChange={e => setAdminEmail(e.target.value)}
              required
              aria-required="true"
              aria-invalid={Boolean(error && !phone)}
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
            <input
              id="admin-password-input"
              type="password"
              placeholder="Password"
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              required
              aria-required="true"
              aria-invalid={Boolean(error && !phone)}
              className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:outline-none"
              style={{ borderColor: accent, outlineColor: primary } as React.CSSProperties}
              autoComplete="current-password"
            />
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
        </form>
      )}
    </div>
  );
};

export default LoginPage;

