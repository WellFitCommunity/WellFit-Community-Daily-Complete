import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { WELLFIT_COLORS, APP_INFO, HCAPTCHA_SITE_KEY } from '../settings/settings';
// If you added the local shim, TS is happy. If not, it's still fine at runtime.
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

const LoginPage: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const captchaRef = useRef<any>(null);
  const navigate = useNavigate();

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!phone || !password) {
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
        password,
        // Pass captcha token so Auth Captcha stops 500'ing
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

  const primary = WELLFIT_COLORS.blue;   // #003865
  const accent = WELLFIT_COLORS.green;   // #8cc63f

  return (
    <div
      className="max-w-md mx-auto mt-16 p-8 bg-white rounded-xl shadow-md text-center"
      style={{ borderColor: accent, borderWidth: '2px' }}
    >
      <img src="/android-chrome-512x512.png" alt={`${APP_INFO.name} Logo`} className="h-16 w-auto mx-auto mb-4" />
      <h1 className="text-2xl font-bold mb-6" style={{ color: primary }}>
        {APP_INFO.name} - Senior Login
      </h1>

      <form onSubmit={handleLogin} className="space-y-4">
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
          <label htmlFor="password-input" className="block text-sm font-medium text-gray-700 mb-1 text-left">
            Password
          </label>
          <input
            id="password-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
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
      </form>

      <div className="mt-4">
        <Link to="/admin-login" className="text-sm underline" style={{ color: primary }}>
          Admin Login
        </Link>
      </div>
    </div>
  );
};

export default LoginPage;
