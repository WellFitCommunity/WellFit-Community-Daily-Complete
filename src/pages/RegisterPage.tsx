// src/pages/RegisterPage.tsx
import React, { useRef, useState } from 'react';
import {
  useForm,
  SubmitHandler,
  Resolver
} from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { AsYouType, isValidPhoneNumber } from 'libphonenumber-js';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface FormValues {
  firstName:      string;
  lastName:       string;
  phone:          string;
  email?:         string | null;
  password:       string;
  confirmPassword:string;
  consent:        boolean;
  hcaptchaToken:  string;
}

const HCAPTCHA_SITE_KEY = process.env.REACT_APP_HCAPTCHA_SITE_KEY!;
const API_ENDPOINT =
  process.env.REACT_APP_API_ENDPOINT ||
  'https://xkybsjnvuohpqpbkikyn.functions.supabase.co/register';

const schema = yup
  .object()
  .shape({
    firstName: yup
      .string()
      .required('First name is required.'),
    lastName: yup
      .string()
      .required('Last name is required.'),
    phone: yup
      .string()
      .required('Phone number is required.')
      .test(
        'valid-phone',
        'Invalid phone number.',
        value => isValidPhoneNumber(value || '')
      ),
    email: yup
      .string()
      .email('Invalid email address.')
      .nullable(),
    password: yup
      .string()
      .required('Password is required.')
      .min(8, 'At least 8 characters.')
      .matches(/[A-Z]/, 'One uppercase letter.')
      .matches(/\d/, 'One number.')
      .matches(/[^A-Za-z0-9]/, 'One special character.'),
    confirmPassword: yup
      .string()
      .oneOf(
        [yup.ref('password')],
        'Passwords must match.'
      )
      .required('Please confirm your password.'),
    consent: yup
      .boolean()
      .oneOf(
        [true],
        'You must agree to receive automated messages to proceed.'
      )
      .required(),
    hcaptchaToken: yup
      .string()
      .required('Captcha verification is required.')
  })
  .required();

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
    formState: {
      errors,
      isSubmitting,
      isValid,
      isDirty
    }
  } = useForm<FormValues>({
    defaultValues: {
      firstName:      '',
      lastName:       '',
      phone:          '',
      email:          null,
      password:       '',
      confirmPassword:'',
      consent:        false,
      hcaptchaToken:  ''
    },
    resolver: yupResolver(schema) as Resolver<FormValues>,
    mode:           'onBlur',
    reValidateMode: 'onChange'
  });

  const onSubmit: SubmitHandler<FormValues> = async (
    data
  ) => {
    try {
      setSubmitError(null);
      clearErrors();

      const payload = {
        first_name:    data.firstName,
        last_name:     data.lastName,
        phone:         data.phone,
        email:         data.email,
        password:      data.password,
        consent:       data.consent,
        hcaptcha_token:data.hcaptchaToken
      };

      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const result = await res.json();

      if (!res.ok)
        throw new Error(
          result.error || 'Registration failed.'
        );

      toast.success('Registration successful!');
      navigate('/check-your-email', {
        state: {
          userId: result.user_id,
          email:  data.email
        },
        replace: true
      });
    } catch (err) {
      const error =
        err instanceof Error
          ? err
          : new Error('Unknown error');
      console.error(error);
      setSubmitError(error.message);
      setError('root', {
        type: 'manual',
        message: error.message
      });
      hcaptchaRef.current?.resetCaptcha();
      toast.error(error.message);
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
        <h2
          id="form-title"
          className="text-2xl font-bold text-center text-[#003865]"
        >
          WellFit Registration
        </h2>

        {submitError && (
          <div
            role="alert"
            className="bg-red-50 border-l-4 border-red-500 p-3 text-red-700"
          >
            {submitError}
          </div>
        )}

        {/* First Name */}
        <div>
          <label
            htmlFor="firstName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            First Name*
          </label>
          <input
            id="firstName"
            {...register('firstName')}
            className="w-full border border-gray-300 rounded-md p-2 focus:ring-[#003865] focus:border-[#003865]"
            aria-invalid={!!errors.firstName}
            aria-describedby="firstName-error"
          />
          {errors.firstName && (
            <p
              id="firstName-error"
              className="mt-1 text-sm text-red-600"
            >
              {errors.firstName.message}
            </p>
          )}
        </div>

        {/* Last Name */}
        <div>
          <label
            htmlFor="lastName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Last Name*
          </label>
          <input
            id="lastName"
            {...register('lastName')}
            className="w-full border border-gray-300 rounded-md p-2 focus:ring-[#003865] focus:border-[#003865]"
            aria-invalid={!!errors.lastName}
            aria-describedby="lastName-error"
          />
          {errors.lastName && (
            <p
              id="lastName-error"
              className="mt-1 text-sm text-red-600"
            >
              {errors.lastName.message}
            </p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Phone Number*
          </label>
          <input
            id="phone"
            {...register('phone')}
            placeholder="+1 (555) 555-5555"
            className="w-full border border-gray-300 rounded-md p-2 focus:ring-[#003865] focus:border-[#003865]"
            aria-invalid={!!errors.phone}
            aria-describedby="phone-error"
            onChange={e => {
              e.target.value = new AsYouType().input(
                e.target.value
              );
            }}
          />
          {errors.phone && (
            <p
              id="phone-error"
              className="mt-1 text-sm text-red-600"
            >
              {errors.phone.message}
            </p>
          )}
        </div>

        {/* Email (optional) */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email (optional)
          </label>
          <input
            id="email"
            type="email"
            {...register('email')}
            className="w-full border border-gray-300 rounded-md p-2 focus:ring-[#003865] focus:border-[#003865]"
            aria-invalid={!!errors.email}
            aria-describedby="email-error"
          />
          {errors.email && (
            <p
              id="email-error"
              className="mt-1 text-sm text-red-600"
            >
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Password*
          </label>
          <input
            id="password"
            type="password"
            {...register('password')}
            className="w-full border border-gray-300 rounded-md p-2 focus:ring-[#003865] focus:border-[#003865]"
            aria-invalid={!!errors.password}
            aria-describedby="password-error"
          />
          {errors.password && (
            <p
              id="password-error"
              className="mt-1 text-sm text-red-600"
            >
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Confirm Password*
          </label>
          <input
            id="confirmPassword"
            type="password"
            {...register('confirmPassword')}
            className="w-full border border-gray-300 rounded-md p-2 focus:ring-[#003865] focus:border-[#003865]"
            aria-invalid={!!errors.confirmPassword}
            aria-describedby="confirmPassword-error"
          />
          {errors.confirmPassword && (
            <p
              id="confirmPassword-error"
              className="mt-1 text-sm text-red-600"
            >
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {/* Consent Checkbox */}
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="consent"
              type="checkbox"
              {...register('consent')}
              className="focus:ring-[#003865] h-4 w-4 text-[#003865] border-gray-300 rounded"
            />
          </div>
          <div className="ml-3 text-sm">
            <label
              htmlFor="consent"
              className="text-gray-700"
            >
              I agree to receive recurring automated messages (including SMS and email) from WellFit Community. Message and data rates may apply. Consent is not a condition of purchase.
            </label>
          </div>
        </div>
        {errors.consent && (
          <p className="mt-1 text-sm text-red-600" role="alert">
            {errors.consent.message}
          </p>
        )}

        {/* hCaptcha */}
        <div className="mt-4">
          <HCaptcha
            sitekey={HCAPTCHA_SITE_KEY}
            onVerify={token => {
              setValue('hcaptchaToken', token);
              clearErrors('hcaptchaToken');
            }}
            onError={() =>
              setError('hcaptchaToken', {
                type: 'manual',
                message: 'Captcha verification failed.'
              })
            }
            ref={hcaptchaRef}
          />
          {errors.hcaptchaToken && (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {errors.hcaptchaToken.message}
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting || !isValid || !isDirty}
          className={`w-full py-2 px-4 rounded-md text-white font-medium ${
            isSubmitting || !isValid || !isDirty
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-[#003865] hover:bg-[#8cc63f] focus:ring-2 focus:ring-offset-2 focus:ring-[#003865]'
          }`}
        >
          {isSubmitting ? (
            <span className="inline-flex items-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              Processing…
            </span>
          ) : (
            'Register'
          )}
        </button>
      </form>
    </div>
  );
};

export default RegisterPage;
