import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const ResetPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (!email.trim()) {
      setErr('Please enter your email.');
      return;
    }
    setBusy(true);
    try {
      const redirectTo = `${window.location.origin}/change-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw error;
      setMsg('If that email exists, we sent a reset link. Check your inbox.');
      // Optional: after a few seconds, send them back to login
      setTimeout(() => navigate('/login', { replace: true }), 3000);
    } catch (e: any) {
      setErr(e?.message || 'Could not send reset email. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-16 p-8 bg-white rounded-xl shadow-md text-center">
      <h1 className="text-2xl font-bold mb-4">Reset your password</h1>
      <p className="text-sm text-gray-600 mb-4">
        Enter your account email. We’ll send you a secure link to set a new password.
      </p>

      <form onSubmit={onSubmit} className="space-y-3 text-left" noValidate>
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full p-3 border border-gray-300 rounded"
            autoComplete="email"
            required
          />
        </label>

        {err && <p className="text-red-600 text-sm">{err}</p>}
        {msg && <p className="text-green-600 text-sm">{msg}</p>}

        <button
          type="submit"
          className="w-full py-3 bg-black text-white rounded disabled:opacity-50"
          disabled={busy}
        >
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
    </div>
  );
};

export default ResetPasswordPage;
