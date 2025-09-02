// src/pages/ChangePasswordPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient } from '../lib/supabaseClient';

export default function ChangePasswordPage() {
  const supabase = useSupabaseClient();
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const ok =
    pw1.length >= 8 &&
    /[A-Z]/.test(pw1) &&
    /\d/.test(pw1) &&
    /[^A-Za-z0-9]/.test(pw1) &&
    pw1 === pw2;

  async function submit() {
    setError('');
    if (!ok) {
      setError('Passwords must match and meet all rules.');
      return;
    }
    setBusy(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) {
        setError('Session expired. Please log in again.');
        navigate('/login', { replace: true });
        return;
      }

      // 1) Update Supabase Auth password
      const { error: upErr } = await supabase.auth.updateUser({ password: pw1 });
      if (upErr) throw upErr;

      // 2) Clear the force-change flag
      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ force_password_change: false })
        .eq('id', uid);
      if (dbErr) throw dbErr;

      // 3) Move to next step in onboarding
      navigate('/demographics', { replace: true });
    } catch (e: any) {
      setError(e?.message || 'Could not change password. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-16 p-8 bg-white rounded-xl shadow-md text-center">
      <h1 className="text-2xl font-bold mb-4">Set a New Password</h1>
      <p className="text-sm text-gray-600 mb-4">
        For your security, please set a new password to continue.
      </p>

      <div className="space-y-3 text-left">
        <input
          type="password"
          placeholder="New password"
          value={pw1}
          onChange={(e) => setPw1(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded"
          autoComplete="new-password"
        />
        <input
          type="password"
          placeholder="Confirm new password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded"
          autoComplete="new-password"
        />
        <ul className="text-xs text-gray-600">
          <li>{pw1.length >= 8 ? '✓' : '✗'} At least 8 characters</li>
          <li>{/[A-Z]/.test(pw1) ? '✓' : '✗'} At least 1 capital letter</li>
          <li>{/\d/.test(pw1) ? '✓' : '✗'} At least 1 number</li>
          <li>{/[^A-Za-z0-9]/.test(pw1) ? '✓' : '✗'} At least 1 special character</li>
          <li>{pw1 && pw1 === pw2 ? '✓' : '✗'} Passwords match</li>
        </ul>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          onClick={submit}
          disabled={!ok || busy}
          className="w-full py-3 bg-black text-white rounded disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save New Password'}
        </button>
      </div>
    </div>
  );
}
