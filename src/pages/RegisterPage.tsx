import React, { useRef, useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { AsYouType, isValidPhoneNumber } from 'libphonenumber-js';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface FormValues {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  password: string;
  confirmPassword: string;
  consent: boolean;
  hcaptchaToken: string;
}

// Environment variables
const HCAPTCHA_SITE_KEY = process.env.REACT_APP_HCAPTCHA_SITE_KEY || '';
const API_ENDPOINT =
  process.env.REACT_APP_API_ENDPOINT ||
  'https://xkybsjnvuohpqpbkikyn.functions.supabase.co/register';

// Validation schema
const schema = yup.object<FormValues>().shape({
  firstName: yup.string().required('First name is required.'),
  lastName: yup.string().required('Last name is required.'),
  phone: yup
    .string()
    .required('Phone number is required.')
    .test('valid-phone', 'Invalid phone number.', value =>
      isValidPhoneNumber(value || '')
    ),
  email: yup.string().email('Invalid email address.').nullable().notRequired(),
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
    .oneOf([true],
      'You must agree to receive automated messages to proceed.'
    )
    .required(),
  hcaptchaToken: yup.string().required('Captcha verification is required.'),
});

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const hcaptchaRef = useRef<HCaptcha>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting, isValid, isDirty },
  } = useForm<FormValues>({
    resolver: yupResolver(schema),
    mode: 'onBlur',
    defaultValues: { consent: false, email: '' },
  });

  const onSubmit: SubmitHandler<FormValues> = async data => {
    try {
      setSubmitError(null);
      clearErrors();

      const payload = {
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone,
        email: data.email || null,
        password: data.password,
        consent: data.consent,
        hcaptcha_token: data.hcaptchaToken,
      };

      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Registration failed.');
      }

      toast.success('Registration successful! Please check your email.');
      navigate('/check-your-email', {
        state: { userId: result.user_id, email: data.email },
        replace: true,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      console.error('Registration error', error);
      setSubmitError(error.message);
      setError('root', { type: 'manual', message: error.message });
      hcaptchaRef.current?.resetCaptcha();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white w-full max-w-md p-6 rounded-lg shadow-lg space-y-6"
        noValidate
      >
        <h2 className="text-2xl font-bold text-center text-[#003865]">
          WellFit Registration
        </h2>

        {submitError && (
          <div role="alert" className="text-red-600">
            {submitError}
          </div>
        )}

        {/* First Name */}
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
            First Name*
          </label>
          <input
            id="firstName"
            {...register('firstName')}
            className="mt-1 w-full border border-gray-300 p-2 rounded"
            aria-invalid={errors.firstName ? 'true' : 'false'}
            aria-describedby="firstName-error"
          />
          {errors.firstName && (
            <p id="firstName-error" className="text-red-600 text-sm mt-1">
              {errors.firstName.message}
            </p>
          )}
        </div>

        {/* Last Name */}
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
            Last Name*
          </label>
          <input
            id="lastName"
            {...register('lastName')}
            className="mt-1 w-full border border-gray-300 p-2 rounded"
            aria-invalid={errors.lastName ? 'true' : 'false'}
            aria-describedby="lastName-error"
          />
          {errors.lastName && (
            <p id="lastName-error" className="text-red-600 text-sm mt-1">
              {errors.lastName.message}
            </p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
            Phone Number*
          </label>
          <input
            id="phone"
            {...register('phone')}
            className="mt-1 w-full border border-gray-300 p-2 rounded"
            placeholder="+1 (555) 555-5555"
            aria-invalid={errors.phone ? 'true' : 'false'}
            aria-describedby="phone-error"
            onInput={e => {
              const formatted = new AsYouType().input(e.currentTarget.value);
              e.currentTarget.value = formatted;
            }}
          />
          {errors.phone && (
            <p id="phone-error" className="text-red-600 text-sm mt-1">
              {errors.phone.message}
            </p>
          )}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email (optional)
          </label>
          <input
            id="email"
            {...register('email')}
            className="mt-1 w-full border border-gray-300 p-2 rounded"
            aria-invalid={errors.email ? 'true' : 'false'}
            aria-describedby="email-error"
          />
          {errors.email && (
            <p id="email-error" className="text-red-600 text-sm mt-1">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password*
          </label>
          <input
            id="password"
            type="password"
            {...register('password')}
            className="mt-1 w-full border border-gray-300 p-2 rounded"
            aria-invalid={errors.password ? 'true' : 'false'}
            aria-describedby="password-error"
          />
          {errors.password && (
            <p id="password-error" className="text-red-600 text-sm mt-1">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
            Confirm Password*
          </label>
          <input
            id="confirmPassword"
            type="password"
            {...register('confirmPassword')}
            className="mt-1 w-full border border-gray-300 p-2 rounded"
            aria-invalid={errors.confirmPassword ? 'true' : 'false'}
            aria-describedby="confirmPassword-error"
          />
          {errors.confirmPassword && (
            <p id="confirmPassword-error" className="text-red-600 text-sm mt-1">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {/* Consent */}
        <div className="mt-4">
          <label className="flex items-start space-x-2">
            <input
              type="checkbox"
              {...register('consent')}
              className="mt-1"
            />
            <span className="text-sm text-gray-700">
              I agree to receive recurring automated messages (including SMS and email) from WellFit Community.
              Message and data rates may apply. Consent is not a condition of purchase.
            </span>
          </label>
          {errors.consent && (
            <p className="text-red-600 text-sm mt-1" role="alert">
              {errors.consent.message}
            </p>
          )}
        </div>

        {/* hCaptcha */}
        <div className="mt-4">
          <HCaptcha
            sitekey={HCAPTCHA_SITE_KEY}
            onVerify={token => {
              setValue('hcaptchaToken', token);
              clearErrors('hcaptchaToken');
            }}
            onError={() => setError('hcaptchaToken', { type: 'manual', message: 'Captcha verification failed.' })}
            ref={hcaptchaRef}
          />
          {errors.hcaptchaToken && (
            <p className="text-red-600 text-sm mt-1" role="alert">
              {errors.hcaptchaToken.message}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !isValid || !isDirty}
          className={`w-full py-2 px-4 rounded text-white ${
            isSubmitting || !isValid || !isDirty
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-[#003865] hover:bg-[#8cc63f]'
          }`}
        >
          {isSubmitting ? 'Processing...' : 'Register'}
        </button>
      </form>
    </div>
  );
};

export default RegisterPage;
