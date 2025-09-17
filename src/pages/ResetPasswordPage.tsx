// src/pages/ResetPasswordPage.tsx — PRODUCTION-READY VERSION
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient } from '../contexts/AuthContext';

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const supabase = useSupabaseClient();

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    const value = email.trim().toLowerCase();
    if (!value) {
      setErr('Please enter your email.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      setErr('Please enter a valid email address.');
      return;
    }

    setBusy(true);
    try {
      // Safer redirect URL construction
      const redirectTo = new URL('/change-password', window.location.origin).toString();

      const { error } = await supabase.auth.resetPasswordForEmail(value, { redirectTo });

      // Always use neutral messaging to avoid leaking whether an email exists
      const genericMsg =
        'If that email exists in our system, we sent a reset link. Check your inbox and spam folder.';

      if (error) {
        // Handle common throttling error without leaking existence
        if (error.message.toLowerCase().includes('rate') || error.message.toLowerCase().includes('limit')) {
          setErr('Too many reset attempts. Please wait a few minutes before trying again.');
        } else {
          setMsg(genericMsg);
        }
      } else {
        setMsg(genericMsg);
        // Optional: gentle redirect back to login after 5s
        setTimeout(() => navigate('/login', { replace: true }), 5000);
      }
    } catch (e: unknown) {
      console.error('Reset password error:', e);
      setErr('Could not send reset email. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-16 p-8 bg-white rounded-xl shadow-md">
      <div className="text-center mb-6">
        <img
          src="/android-chrome-512x512.png"
          alt="WellFit Logo"
          className="h-16 w-auto mx-auto mb-4"
        />
        <h1 className="text-2xl font-bold mb-2">Reset Your Password</h1>
        <p className="text-sm text-gray-600">
          Enter your account email address and we'll send you a secure link to reset your password.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email-input" className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <input
            id="email-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="you@example.com"
            autoComplete="email"
            required
            disabled={busy}
            aria-required="true"
            aria-invalid={Boolean(err)}
          />
        </div>

        {err && (
          <div className="p-3 bg-red-50 border border-red-200 rounded" role="alert" aria-live="assertive">
            <p className="text-red-600 text-sm">{err}</p>
          </div>
        )}

        {msg && (
          <div className="p-3 bg-green-50 border border-green-200 rounded" role="status" aria-live="polite">
            <p className="text-green-700 text-sm">{msg}</p>
          </div>
        )}

        <button
          type="submit"
          className="w-full py-3 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
          disabled={busy || !email.trim()}
        >
          {busy ? 'Sending Reset Link…' : 'Send Reset Link'}
        </button>

        <div className="text-center space-y-2">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-sm text-gray-600 hover:text-gray-800 underline"
          >
            Back to Login
          </button>
        </div>
      </form>

      {msg && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
          <p className="text-blue-800">
            <strong>Next steps:</strong>
          </p>
          <ul className="text-blue-700 mt-2 list-disc list-inside">
            <li>Check your email inbox (and spam folder)</li>
            <li>Click the reset link in the email</li>
            <li>Set your new password</li>
            <li>Log in with your new password</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default ResetPasswordPage;
