// src/pages/LoginPage.tsx
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { WELLFIT_COLORS, APP_INFO, HCAPTCHA_SITE_KEY } from '../settings/settings';
import HCaptcha from '@hcaptcha/react-hcaptcha';

const isPhone = (val: string) => /^\d{10,15}$/.test(val.replace(/[^\d]/g, ''));

async function nextRouteForUser(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return '/login';

  const { data } = await supabase
    .from('profiles')
    .select('force_password_change, consent, demographics_complete')
    .eq('id', uid)
    .single();

  if (!data) return '/login';
  if (data.force_password_change) return '/change-password';
  if (!data.consent) return '/consent';
  if (!data.demographics_complete) return '/demographics';
  return '/dashboard';
}

type Mode = 'senior' | 'admin';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();

  // mode toggle
  const [mode, setMode] = useState<Mode>('senior');

  // shared
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const captchaRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // senior fields
  const [phone, setPhone] = useState('');
  const [seniorPassword, setSeniorPassword] = useState('');

  // admin fields
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && !cancel) {
        const route = await nextRouteForUser();
        navigate(route, { replace: true });
      }
    })();
    return () => { cancel = true; };
  }, [navigate]);

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
    if (!captchaToken && HCAPTCHA_SITE_KEY) {
      setError('Please complete the captcha.');
      return;
    }

    setLoading(true);
    try {
      // Normalize to E.164; seniors never need to type "+1"
      const digits = phone.replace(/[^\d]/g, '');
      const e164 =
        digits.length === 10 ? `+1${digits}` :
        (digits.length === 11 && digits.startsWith('1')) ? `+${digits}` :
        phone.startsWith('+') ? phone : `+${digits}`;

      const { error: signInError } = await supabase.auth.signInWithPassword({
        phone: e164,
        password: seniorPassword,
        options: captchaToken ? { captchaToken } : undefined,
      });

      if (signInError) {
        const msg = signInError.message.toLowerCase();
        if (msg.includes('invalid login credentials')) {
          setError('Login failed. Please check your phone number and password.');
        } else if (msg.includes('captcha')) {
          setError('Captcha verification failed. Please try again.');
          captchaRef.current?.resetCaptcha?.();
          setCaptchaToken('');
        } else if (msg.includes('confirm')) {
          setError('Account not confirmed. Please complete phone verification if required.');
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
    // optional: require captcha for admin too
    if (!captchaToken && HCAPTCHA_SITE_KEY) {
      setError('Please complete the captcha.');
      return;
    }

    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: adminEmail.trim(),
        password: adminPassword,
        options: captchaToken ? { captchaToken } : undefined,
      });

      if (signInError) {
        const msg = signInError.message.toLowerCase();
        if (msg.includes('invalid login credentials')) {
          setError('Admin login failed. Check your email and password.');
        } else if (msg.includes('captcha')) {
          setError('Captcha verification failed. Please try again.');
          captchaRef.current?.resetCaptcha?.();
          setCaptchaToken('');
        } else if (msg.includes('email not confirmed') || msg.includes('confirm')) {
          setError('Email not confirmed. Please check your inbox for the confirmation link.');
        } else {
          setError('An error occurred during admin login. Please try again.');
        }
        return;
      }

      // After admin email login, send them to your admin area (change if needed)
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

  const handleAdminResetPassword = async () => {
    setError('');
    if (!adminEmail) {
      setError('Enter your email, then click “Reset password”.');
      return;
    }
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(adminEmail.trim(), { redirectTo });
      if (error) throw error;
      alert('Password reset email sent. Check your inbox.');
    } catch (e: any) {
      setError(e?.message || 'Could not send reset email.');
    }
  };

  const primary = WELLFIT_COLORS.blue;   // #003865
  const accent = WELLFIT_COLORS.green;   // #8cc63f

  return (
    <div
      className="max-w-md mx-auto mt-16 p-6 bg-white rounded-xl shadow-md"
      style={{ borderColor: accent, borderWidth: '2px' }}
    >
      <img src="/android-chrome-512x512.png" alt={`${APP_INFO.name} Logo`} className="h-16 w-auto mx-auto mb-4" />
      <h1 className="text-2xl font-bold text-center mb-2" style={{ color: primary }}>
        {APP_INFO.name}
      </h1>

      {/* Toggle */}
      <div className="flex justify-center gap-2 mb-6">
        <button
          type="button"
          onClick={() => { setMode('senior'); setError(''); }}
          className={`px-3 py-1 rounded ${mode === 'senior' ? 'bg-gray-900 text-white' : 'bg-gray-200'}`}
        >
          Senior Login (Phone)
        </button>
        <button
          type="button"
          onClick={() => { setMode('admin'); setError(''); }}
          className={`px-3 py-1 rounded ${mode === 'admin' ? 'bg-gray-900 text-white' : 'bg-gray-200'}`}
        >
          Admin Login (Email)
        </button>
      </div>

      {mode === 'senior' ? (
        <form onSubmit={handleSeniorLogin} className="space-y-4">
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
              aria-invalid={!!error}
              className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:outline-none"
              style={{ borderColor: accent, outlineColor: primary } as React.CSSProperties}
              autoComplete="tel"
              inputMode="tel"
            />
            <p className="text-xs text-left mt-1 text-gray-500">You don’t need to type “+1”. We add it for you.</p>
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
              aria-invalid={!!error}
              className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:outline-none"
              style={{ borderColor: accent, outlineColor: primary } as React.CSSProperties}
              autoComplete="current-password"
            />
          </div>

          {HCAPTCHA_SITE_KEY && (
            <div className="pt-2">
              <HCaptcha
                ref={captchaRef}
                sitekey={HCAPTCHA_SITE_KEY}
                onVerify={(token) => setCaptchaToken(token)}
                onExpire={() => setCaptchaToken('')}
                onError={() => setCaptchaToken('')}
              />
            </div>
          )}

          {error && <p role="alert" className="text-red-500 text-sm font-semibold">{error}</p>}

          <button
            type="submit"
            className="w-full py-3 font-semibold rounded hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 text-white"
            style={{ backgroundColor: primary }}
            disabled={loading}
          >
            {loading ? 'Logging In...' : 'Log In'}
          </button>

          <div className="mt-2 text-center">
            <Link to="/admin-login" className="text-sm underline" style={{ color: primary }}>
              Admin PIN (for already-logged-in admins)
            </Link>
          </div>
        </form>
      ) : (
        <form onSubmit={handleAdminLogin} className="space-y-4">
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
              aria-invalid={!!error}
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
              aria-invalid={!!error}
              className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:outline-none"
              style={{ borderColor: accent, outlineColor: primary } as React.CSSProperties}
              autoComplete="current-password"
            />
          </div>

          {HCAPTCHA_SITE_KEY && (
            <div className="pt-2">
              <HCaptcha
                ref={captchaRef}
                sitekey={HCAPTCHA_SITE_KEY}
                onVerify={(token) => setCaptchaToken(token)}
                onExpire={() => setCaptchaToken('')}
                onError={() => setCaptchaToken('')}
              />
            </div>
          )}

          {error && <p role="alert" className="text-red-500 text-sm font-semibold">{error}</p>}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleAdminResetPassword}
              className="text-sm underline"
              style={{ color: primary }}
              disabled={!adminEmail || loading}
            >
              Forgot password?
            </button>
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
            <Link to="/admin-login" className="text-sm underline" style={{ color: primary }}>
              Admin PIN (after email login)
            </Link>
          </div>
        </form>
      )}
    </div>
  );
};

export default LoginPage;
