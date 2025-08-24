import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

type LocState = { phone?: string } | null;

const WELLFIT_BLUE = '#003865';
const WELLFIT_GREEN = '#8cc63f';

const E164 = /^\+\d{10,15}$/;

export default function VerifyCodePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocState) || null;

  // Prefer phone passed from the previous step, allow manual entry as fallback
  const [phone, setPhone] = useState<string>(state?.phone ?? '');
  const [code, setCode] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Resend cooldown (in seconds)
  const RESEND_COOLDOWN = 45;
  const [cooldown, setCooldown] = useState<number>(RESEND_COOLDOWN);

  const phoneIsValid = useMemo(() => E164.test(phone.trim()), [phone]);

  // If already logged in, skip
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/dashboard', { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start a cooldown timer only if we got here with a phone from the previous step
  useEffect(() => {
    if (!state?.phone) return;
    setCooldown(RESEND_COOLDOWN);
    const t = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phone]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanPhone = phone.trim();
    const cleanCode = code.replace(/\D/g, '').trim(); // digits only

    if (!E164.test(cleanPhone)) {
      setError('Enter a valid phone number in E.164 format (e.g. +15551234567).');
      return;
    }
    if (cleanCode.length !== 6) {
      setError('Enter the 6-digit code we sent.');
      return;
    }

    setLoading(true);
    try {
      const { error: otpError } = await supabase.auth.verifyOtp({
        phone: cleanPhone,
        token: cleanCode,
        type: 'sms',
      });
      if (otpError) throw otpError;

      // Double-check we actually have a session
      const { data: { session }, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw sessErr;
      if (!session) throw new Error('Verification succeeded but no session was created.');

      navigate('/demographics', { replace: true });
    } catch (e: any) {
      const msg = e?.message || 'Invalid or expired code. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    const cleanPhone = phone.trim();
    if (!E164.test(cleanPhone)) {
      setError('Enter a valid phone number in E.164 format (e.g. +15551234567).');
      return;
    }

    try {
      // Re-send OTP. Adjust shouldCreateUser depending on your signup flow.
      const { error: sendErr } = await supabase.auth.signInWithOtp({
        phone: cleanPhone,
        options: { channel: 'sms', shouldCreateUser: true },
      });
      if (sendErr) throw sendErr;

      setCooldown(RESEND_COOLDOWN);
    } catch (e: any) {
      setError(e?.message || 'Could not resend code. Please wait a minute and try again.');
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6 bg-white shadow-xl rounded-xl flex flex-col items-center">
      <h2 className="text-2xl font-bold mb-6" style={{ color: WELLFIT_BLUE }}>
        Verify Your Phone
      </h2>

      <form className="w-full space-y-4" onSubmit={handleVerify} noValidate>
        {/* Phone field only if not provided by previous step, but always editable if they need to fix it */}
        <div>
          <label htmlFor="phone" className="block font-semibold mb-1" style={{ color: WELLFIT_BLUE }}>
            Phone Number (E.164)
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className="w-full p-3 border-2 rounded text-lg"
            style={{ borderColor: WELLFIT_BLUE }}
            placeholder="+15551234567"
            inputMode="numeric"
            pattern="^\+\d{10,15}$"
            aria-invalid={!phoneIsValid}
          />
          {!phoneIsValid && phone && (
            <p className="mt-1 text-sm text-red-600">Format must be +countrycode and digits (e.g. +15551234567).</p>
          )}
        </div>

        <div>
          <label htmlFor="code" className="block font-semibold mb-1" style={{ color: WELLFIT_BLUE }}>
            Verification Code
          </label>
          <input
            id="code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
            className="w-full p-3 border-2 rounded text-lg tracking-widest"
            style={{ borderColor: WELLFIT_BLUE }}
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="\d{6}"
            placeholder="6-digit code"
            maxLength={6}
            autoFocus
          />
        </div>

        {error && <div className="text-red-600">{error}</div>}

        <button
          type="submit"
          disabled={loading || !phoneIsValid || code.length !== 6}
          className="w-full font-bold px-6 py-3 rounded shadow transition disabled:opacity-50"
          style={{ backgroundColor: loading ? '#7aa7c4' : WELLFIT_BLUE, color: '#fff' }}
        >
          {loading ? 'Verifying…' : 'Verify'}
        </button>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || !phoneIsValid}
            className="px-4 py-2 rounded font-medium transition disabled:opacity-50"
            style={{
              backgroundColor: cooldown > 0 || !phoneIsValid ? '#d1d5db' : WELLFIT_GREEN,
              color: cooldown > 0 || !phoneIsValid ? '#6b7280' : '#fff',
            }}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-sm underline text-gray-600 hover:text-gray-800"
          >
            Use a different method
          </button>
        </div>
      </form>
    </div>
  );
}
