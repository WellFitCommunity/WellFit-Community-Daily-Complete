// src/pages/LoginPage.tsx
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { useSupabaseClient } from '../lib/supabaseClient';
import { useState } from 'react';

type Form = { email: string; password: string };

export default function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<Form>({ defaultValues: { email: '', password: '' }, mode: 'onBlur' });

  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const onSubmit = async (raw: Form) => {
    setServerError(null);

    const email = raw.email.trim().toLowerCase();
    const password = raw.password;

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        // route common auth errors into UI
        if (error.message?.toLowerCase().includes('invalid')) {
          setError('password', { type: 'manual', message: 'Invalid email or password.' });
        } else {
          setServerError(error.message || 'Sign-in failed.');
        }
        return;
      }
      navigate('/dashboard', { replace: true });
    } catch (e: any) {
      setServerError(e?.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white w-full max-w-sm p-6 rounded-xl shadow space-y-4"
        noValidate
      >
        <h1 className="text-xl font-bold text-center text-[#003865]">Sign In</h1>

        <div>
          <input
            {...register('email', {
              required: 'Email is required',
              pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' },
            })}
            type="email"
            placeholder="Email"
            className="w-full border rounded px-3 py-2"
            autoComplete="email"
            inputMode="email"
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <div>
          <input
            {...register('password', {
              required: 'Password is required',
              minLength: { value: 6, message: 'Password must be at least 6 characters' },
            })}
            type="password"
            placeholder="Password"
            className="w-full border rounded px-3 py-2"
            autoComplete="current-password"
          />
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>

        {serverError && (
          <p className="text-sm text-red-700 bg-red-100 border border-red-200 rounded p-2">{serverError}</p>
        )}

        <button
          className="w-full rounded bg-[#003865] text-white py-2 disabled:opacity-60"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Signing in…' : 'Sign In'}
        </button>

        <div className="flex items-center justify-between text-sm text-gray-600">
          <Link className="text-blue-600 hover:underline" to="/reset-password">
            Forgot password?
          </Link>
          <span>
            Don’t have an account?{' '}
            <Link className="text-blue-600 hover:underline" to="/register">
              Register
            </Link>
          </span>
        </div>
      </form>
    </div>
  );
}
