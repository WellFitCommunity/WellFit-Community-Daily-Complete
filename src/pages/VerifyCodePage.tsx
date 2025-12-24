// src/pages/VerifyCodePage.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSupabaseClient } from '../contexts/AuthContext';

type LocState = { phone?: string } | null;

const WELLFIT_BLUE = '#003865';
const WELLFIT_GREEN = '#8cc63f';
const E164 = /^\+\d{10,15}$/;
const RESEND_COOLDOWN = 45;

export default function VerifyCodePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const supabase = useSupabaseClient();
  const state = (location.state as LocState) || null;

  const [phone, setPhone] = useState<string>(state?.phone ?? '');
  const [code, setCode] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const [cooldown, setCooldown] = useState<number>(RESEND_COOLDOWN);
  const timerRef = useRef<number | null>(null);
  const codeInputRef = useRef<HTMLInputElement | null>(null);

  const phoneIsValid = useMemo(() => E164.test(phone.trim()), [phone]);

  // Redirect if already logged in
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session) navigate('/dashboard', { replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session) navigate('/dashboard', { replace: true });
    });
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [navigate, supabase.auth]);

  // Start cooldown if we arrived with a phone from prior step
  useEffect(() => {
    if (!state?.phone) return;
    startCooldown();
     
  }, [state?.phone]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const startCooldown = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setCooldown(RESEND_COOLDOWN);
    timerRef.current = window.setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const normalizeCode = (v: string) => v.replace(/\D/g, '').slice(0, 6);

  const handleVerify = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault?.();
    setError('');

    const cleanPhone = phone.trim();
    const cleanCode = normalizeCode(code);

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
      const { data, error } = await supabase.functions.invoke('sms-verify-code', {
        body: { phone: cleanPhone, code: cleanCode },
      });

      if (error || !data?.ok) {
        // Keep this generic to avoid leaking verification detail
        throw new Error('Invalid or expired code.');
      }

      // IMPORTANT: Don't use server-generated tokens directly
      // The edge function uses service_role which can cause session issues
      // Instead, sign in fresh on the client side with the user's credentials
      if (data?.access_token && data?.refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });

        if (sessionError) {
          // If setSession fails, the user can still login manually
          // Silent fail - will be caught by session check below
        }

        // Wait for session to be established before navigating
        // This ensures auth.uid() is available in the next page
        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify session is actually set
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          // Session not set - user needs to login manually
          navigate('/login', {
            replace: true,
            state: { message: 'Registration complete! Please log in to continue.' }
          });
          return;
        }
      }
      // Note: User data (first_name, last_name) is available via profile lookup
      // Do NOT store PHI in localStorage per HIPAA §164.312

      // Post-verify flow you specified:
      navigate('/demographics', { replace: true });
    } catch (e: any) {
      setError(e?.message || 'Invalid or expired code. Please try again.');
      // Focus code to re-try quickly
      codeInputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }, [phone, code, supabase, navigate]);

  const handleResend = async () => {
    setError('');
    const cleanPhone = phone.trim();
    if (!E164.test(cleanPhone)) {
      setError('Enter a valid phone number in E.164 format (e.g. +15551234567).');
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('sms-send-code', {
        body: { phone: cleanPhone },
      });
      if (error) throw error;
      startCooldown();
      // Place cursor in code field for quick entry
      setTimeout(() => codeInputRef.current?.focus(), 0);
    } catch (e: any) {
      setError(e?.message || 'Could not resend code. Please wait a minute and try again.');
    }
  };

  // Optional: auto-submit when 6 digits present
  useEffect(() => {
    if (!loading && code.length === 6 && phoneIsValid) {
      // Don't auto-submit if an error is currently shown; let user correct first
      if (!error) handleVerify();
    }
  }, [code, phoneIsValid, error, handleVerify, loading]);

  return (
    <div className="max-w-lg mx-auto p-6 bg-white shadow-xl rounded-xl flex flex-col items-center">
      <h2 className="text-2xl font-bold mb-6" style={{ color: WELLFIT_BLUE }}>
        Verify Your Phone
      </h2>

      <form className="w-full space-y-4" onSubmit={handleVerify} noValidate>
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
            className="w-full p-3 border-2 rounded-sm text-lg"
            style={{ borderColor: WELLFIT_BLUE }}
            placeholder="+15551234567"
            inputMode="tel"
            pattern="^\+\d{10,15}$"
            aria-invalid={!phoneIsValid}
            aria-describedby="phone-help"
          />
          <p id="phone-help" className="mt-1 text-sm text-gray-500">
            Use +country code (e.g., +1 for U.S.).
          </p>
          {!phoneIsValid && phone && (
            <p className="mt-1 text-sm text-red-600" role="alert" aria-live="polite">
              Format must be +countrycode and digits (e.g. +15551234567).
            </p>
          )}
        </div>

        <div>
          <label htmlFor="code" className="block font-semibold mb-1" style={{ color: WELLFIT_BLUE }}>
            Verification Code
          </label>
          <input
            id="code"
            ref={codeInputRef}
            type="text"
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value))}
            onPaste={(e) => {
              e.preventDefault();
              const text = (e.clipboardData.getData('text') || '').toString();
              setCode(normalizeCode(text));
            }}
            required
            className="w-full p-3 border-2 rounded-sm text-lg tracking-widest"
            style={{ borderColor: WELLFIT_BLUE }}
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="\d{6}"
            placeholder="6-digit code"
            maxLength={6}
            autoFocus
            aria-describedby="code-help"
          />
          <p id="code-help" className="mt-1 text-sm text-gray-500">
            We sent a 6-digit code by SMS.
          </p>
        </div>

        {error && (
          <div className="text-red-600" role="alert" aria-live="assertive">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !phoneIsValid || code.length !== 6}
          className="w-full font-bold px-6 py-3 rounded-sm shadow-sm transition disabled:opacity-50"
          style={{ backgroundColor: loading ? '#7aa7c4' : WELLFIT_BLUE, color: '#fff' }}
        >
          {loading ? 'Verifying…' : 'Verify'}
        </button>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || !phoneIsValid}
            className="px-4 py-2 rounded-sm font-medium transition disabled:opacity-50"
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

