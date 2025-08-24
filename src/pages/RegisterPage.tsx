import React, { useEffect, useRef, useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';

type FormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  password: string;
  confirmPassword: string;
  consent: boolean;
  hcaptchaToken: string;
};

// ----- ENV -----
const HCAPTCHA_SITE_KEY = process.env.REACT_APP_HCAPTCHA_SITE_KEY || '';
const API_ENDPOINT =
  process.env.REACT_APP_API_ENDPOINT ??
  'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/register';

if (!process.env.REACT_APP_API_ENDPOINT) {
  console.warn('REACT_APP_API_ENDPOINT not set—using fallback URL.');
}

// ----- SCHEMA (no tricky generics) -----
const schema = yup.object().shape({
  firstName: yup.string().required('First name is required.'),
  lastName: yup.string().required('Last name is required.'),
  phone: yup
    .string()
    .required('Phone number is required.')
    .matches(
      /^(?:\d{10}|\+1\d{10})$/,
      'Enter a 10-digit number (e.g. 5551234567) or +1 plus 10 digits (e.g. +15551234567).'
    ),
  email: yup
    .string()
    .transform((v) => (v === '' ? null : v))
    .nullable()
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
  consent: yup
    .boolean()
    .oneOf([true], 'You must agree to receive automated messages to proceed.')
    .required(),
  hcaptchaToken: yup.string().required('Captcha verification is required.'),
});

// Safer for mixed versions: cast once, move on.
const resolver = yupResolver(schema) as any;

// ----- COMPONENT -----
const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const hcaptchaRef = useRef<HCaptcha>(null);
  const [isCaptchaConfigured, setIsCaptchaConfigured] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      email: null,
      password: '',
      confirmPassword: '',
      consent: false,
      hcaptchaToken: '',
    },
    resolver,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

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

      const payload = {
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone,
        email: data.email,
        password: data.password,
        consent: data.consent,
        hcaptcha_token: data.hcaptchaToken,
      };

      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let msg = res.statusText || 'Registration failed.';
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch { /* ignore */ }
        throw new Error(msg);
      }

      toast.success('Registration successful! Please log in.');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Unknown error');
      console.error(e);
      setSubmitError(e.message);
      setError('root', { type: 'manual', message: e.message });
      hcaptchaRef.current?.resetCaptcha();
      toast.error(e.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white w-full max-w-md p-6 rounded-lg shadow-lg space-y-4"
        noValidate
        aria-labelledby="form-title"
      >
        <h2 id="form-title" className="text-2xl font-bold text-center text-[#003865]">
          WellFit Registration
        </h2>

        {!isCaptchaConfigured && (
          <div role="alert" className="bg-red-100 border-l-4 border-red-700 p-4 text-red-700 font-semibold">
            Registration is unavailable due to a configuration issue (hCaptcha Site Key missing). Please contact support.
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
            <span className="font-medium">Phone</span>
            <input
              {...register('phone')}
              inputMode="tel"
              className="mt-1 rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[#8cc63f]"
              placeholder="5551234567 or +15551234567"
              autoComplete="tel"
            />
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
            <input
              {...register('password')}
              type="password"
              className="mt-1 rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[#8cc63f]"
              autoComplete="new-password"
            />
            {errors.password && <span className="text-red-600">{errors.password.message}</span>}
          </label>

          <label className="flex flex-col text-sm">
            <span className="font-medium">Confirm Password</span>
            <input
              {...register('confirmPassword')}
              type="password"
              className="mt-1 rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[#8cc63f]"
              autoComplete="new-password"
            />
            {errors.confirmPassword && (
              <span className="text-red-600">{errors.confirmPassword.message}</span>
            )}
          </label>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" {...register('consent')} className="mt-1" />
            <span>I agree to receive automated messages from WellFit for reminders and program updates.</span>
          </label>
          {errors.consent && <span className="text-red-600">{errors.consent.message}</span>}
        </div>

        {isCaptchaConfigured && (
          <div className="pt-1">
            <HCaptcha
              ref={hcaptchaRef}
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
          className="w-full mt-2 rounded-md bg-[#003865] px-4 py-2 text-white shadow disabled:opacity-60"
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
    </div>
  );
};

export default RegisterPage;
