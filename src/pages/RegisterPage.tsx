// src/pages/RegisterPage.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import PrettyCard from '../components/ui/PrettyCard';

type FormValues = {
  firstName: string;
  lastName: string;
  phone: string;          // Always +1XXXXXXXXXX
  email?: string;
  password: string;
  confirmPassword: string;
  consent: boolean;
  hcaptchaToken: string;
};

const WELLFIT_BLUE = '#003865';

// IMPORTANT: must be defined in your frontend build for prod.
// For local dev this default is fine.
const HCAPTCHA_SITE_KEY = process.env.REACT_APP_HCAPTCHA_SITE_KEY || '';
const API_ENDPOINT =
  process.env.REACT_APP_API_ENDPOINT ??
  'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/register';

// --- hCaptcha handle type (for the ref)
type HCaptchaHandle = {
  execute?: () => void;
  resetCaptcha: () => void;
  remove?: () => void;
};

// Strict US-only E.164 (+1 + 10 digits)
const schema: yup.ObjectSchema<FormValues> = yup
  .object({
    firstName: yup.string().required('First name is required.'),
    lastName: yup.string().required('Last name is required.'),
    phone: yup
      .string()
      .required('Phone number is required.')
      .matches(/^\+1\d{10}$/, 'Enter a valid US number like +1XXXXXXXXXX.'),
    email: yup
      .string()
      .trim()
      .transform((v) => (v === '' ? undefined : v))
      .optional()
      .email('Invalid email address.'),
    password: yup
      .string()
      .required('Password is required.')
      .min(8, 'At least 8 characters.')
      .matches(/[A-Z]/, 'One uppercase letter.')
      .matches(/\d/, 'One number.')
      .matches(/[^A-Za-z0-9]/, 'One special character.'),
    confirmPassword: yup
      .string()
      .oneOf([yup.ref('password')], 'Passwords must match.')
      .required('Please confirm your password.'),
    consent: yup.boolean().oneOf([true], 'You must agree to proceed.').required(),
    hcaptchaToken: yup.string().required('Captcha verification is required.'),
  })
  .required();

// --- Helpers: keep phone input locked to +1 and digits only ---
function normalizeUSPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  let core = digits.startsWith('1') ? digits : `1${digits}`;
  core = core.slice(0, 11);
  return `+${core}`;
}

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const hcaptchaRef = useRef<HCaptchaHandle | null>(null);

  const [isCaptchaConfigured, setIsCaptchaConfigured] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  useEffect(() => {
    if (!HCAPTCHA_SITE_KEY) {
      console.error('Missing REACT_APP_HCAPTCHA_SITE_KEY — captcha disabled.');
      setIsCaptchaConfigured(false);
    }
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '+1',
      email: '',
      password: '',
      confirmPassword: '',
      consent: false,
      hcaptchaToken: '',
    },
    resolver: yupResolver<FormValues>(schema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  // Keep the phone input sticky to +1 prefix, digits only, max length 12 (+ + 11 digits)
  const phoneVal = watch('phone');
  useEffect(() => {
    if (!phoneVal) {
      setValue('phone', '+1', { shouldValidate: true, shouldDirty: true });
      return;
    }
    const normalized = normalizeUSPhoneInput(phoneVal);
    if (normalized !== phoneVal) {
      setValue('phone', normalized, { shouldValidate: true, shouldDirty: true });
    }
  }, [phoneVal, setValue]);

  const onVerify = (token: string) => {
    setValue('hcaptchaToken', token, { shouldValidate: true });
    clearErrors('hcaptchaToken');
  };

  const onExpire = () => {
    setValue('hcaptchaToken', '', { shouldValidate: true });
    setError('hcaptchaToken', { type: 'manual', message: 'Captcha expired. Please try again.' });
  };

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    try {
      setSubmitError(null);
      clearErrors();

      if (!isCaptchaConfigured) throw new Error('Captcha not configured.');
      if (!data.hcaptchaToken) throw new Error('Please complete the captcha.');

      // Build payload for the Edge Function
      const payload = {
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone,
        email: data.email ?? null,
        password: data.password,
        consent: data.consent,
        // hcaptcha_token is OPTIONAL in body (server also accepts header),
        // But sending both is fine.
        hcaptcha_token: data.hcaptchaToken,
      };

      // ✅ This is the missing part: actually perform the fetch
      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Important: browser sets Origin automatically; do NOT add it yourself.
          'x-hcaptcha-token': data.hcaptchaToken,
        },
        body: JSON.stringify(payload),
      });

      // Read raw once, then try JSON
      const raw = await res.text();
      let js: any = null;
      try { js = raw ? JSON.parse(raw) : null; } catch { /* not JSON */ }

      if (!res.ok) {
        const serverMsg = js?.error || js?.message || js?.detail || raw || `${res.status} ${res.statusText}`;
        console.error('REGISTER ERROR', {
          status: res.status,
          statusText: res.statusText,
          serverMsg,
          raw,
        });
        throw new Error(serverMsg);
      }

      toast.success('Registration successful! Verify your phone next.');
      navigate('/verify', { replace: true, state: { phone: data.phone } });
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Unknown error');
      console.error(e);
      setSubmitError(e.message);
      setError('root' as any, { type: 'manual', message: e.message });
      hcaptchaRef.current?.resetCaptcha?.();
      setValue('hcaptchaToken', '', { shouldValidate: true });
      toast.error(e.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-lg w-full">
        <PrettyCard>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
            aria-labelledby="form-title"
          >
            <h2 id="form-title" className="text-2xl font-bold text-center" style={{ color: WELLFIT_BLUE }}>
              WellFit Registration
            </h2>

            {!isCaptchaConfigured && (
              <div role="alert" className="bg-red-100 border-l-4 border-red-700 p-4 text-red-700 font-semibold">
                Registration is unavailable due to a configuration issue (hCaptcha Site Key missing).
              </div>
            )}

            {submitError && (
              <div role="alert" className="bg-red-50 text-red-700 border border-red-200 p-3 rounded">
                {submitError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              <label className="flex flex-col text-sm">
                <span className="font-medium">First name</span>
                <input
                  {...register('firstName')}
                  className="mt-1 rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[#8cc63f]"
                  autoComplete="given-name"
                />
                {errors.firstName && <span className="text-red-600">{errors.firstName.message}</span>}
              </label>

              <label className="flex flex-col text-sm">
                <span className="font-medium">Last name</span>
                <input
                  {...register('lastName')}
                  className="mt-1 rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[#8cc63f]"
                  autoComplete="family-name"
                />
                {errors.lastName && <span className="text-red-600">{errors.lastName.message}</span>}
              </label>

              <label className="flex flex-col text-sm">
                <span className="font-medium">Phone (US only)</span>
                <input
                  {...register('phone')}
                  inputMode="tel"
                  className="mt-1 rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[#8cc63f]"
                  placeholder="+1XXXXXXXXXX"
                  autoComplete="tel"
                  maxLength={12}
                />
                <span className="text-xs text-gray-500 mt-1">
                  We auto-format to <code>+1</code>. Type only your 10-digit US number.
                </span>
                {errors.phone && <span className="text-red-600">{errors.phone.message}</span>}
              </label>

              <label className="flex flex-col text-sm">
                <span className="font-medium">Email (optional)</span>
                <input
                  {...register('email')}
                  type="email"
                  className="mt-1 rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[#8cc63f]"
                  autoComplete="email"
                />
                {errors.email && <span className="text-red-600">{errors.email.message}</span>}
              </label>

              <label className="flex flex-col text-sm">
                <span className="font-medium">Password</span>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPw ? 'text' : 'password'}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 pr-16 outline-none focus:ring-2 focus:ring-[#8cc63f]"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-blue-600 underline"
                  >
                    {showPw ? 'Hide' : 'Show'}
                  </button>
                </div>
                {errors.password && <span className="text-red-600">{errors.password.message}</span>}
              </label>

              <label className="flex flex-col text-sm">
                <span className="font-medium">Confirm Password</span>
                <div className="relative">
                  <input
                    {...register('confirmPassword')}
                    type={showPw2 ? 'text' : 'password'}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 pr-16 outline-none focus:ring-2 focus:ring-[#8cc63f]"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw2((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-blue-600 underline"
                  >
                    {showPw2 ? 'Hide' : 'Show'}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <span className="text-red-600">{errors.confirmPassword.message}</span>
                )}
              </label>

              <label className="flex items-start gap-2 text-sm leading-5">
                <input type="checkbox" {...register('consent')} className="mt-1" />
                <span>
                  I agree to receive automated messages from WellFit Community for reminders and program
                  updates. Message &amp; data rates may apply. Reply STOP to opt out. Read our{' '}
                  <Link to="/terms" className="text-blue-700 underline">Terms of Service</Link> and{' '}
                  <Link to="/privacy-policy" className="text-blue-700 underline">Privacy Policy</Link>.
                </span>
              </label>
              {errors.consent && <span className="text-red-600">{errors.consent.message}</span>}
            </div>

            {isCaptchaConfigured && (
              <div className="pt-1">
                <HCaptcha
                  ref={hcaptchaRef as any}
                  sitekey={HCAPTCHA_SITE_KEY}
                  onVerify={onVerify}
                  onExpire={onExpire}
                />
                {errors.hcaptchaToken && (
                  <span className="text-red-600">{errors.hcaptchaToken.message}</span>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !isCaptchaConfigured}
              className="w-full mt-2 rounded-md px-4 py-2 text-white shadow disabled:opacity-60"
              style={{ backgroundColor: WELLFIT_BLUE }}
            >
              {isSubmitting ? 'Submitting…' : 'Register'}
            </button>

            <p className="text-center text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 underline">
                Log in
              </Link>
            </p>
          </form>
        </PrettyCard>
      </div>
    </div>
  );
};

export default RegisterPage;
