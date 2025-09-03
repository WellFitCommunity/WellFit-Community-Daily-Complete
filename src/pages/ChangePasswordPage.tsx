// src/pages/ChangePasswordPage.tsx
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient } from '../lib/supabaseClient';

export default function ChangePasswordPage() {
  const supabase = useSupabaseClient();
  const navigate = useNavigate();

  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPw1, setShowPw1] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const clean1 = pw1.trim();
  const clean2 = pw2.trim();

  const ok = useMemo(() => {
    return (
      clean1.length >= 8 &&
      /[A-Z]/.test(clean1) &&
      /\d/.test(clean1) &&
      /[^A-Za-z0-9]/.test(clean1) &&
      clean1 === clean2
    );
  }, [clean1, clean2]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setError('');
    setSuccess(null);

    if (!ok) {
      setError('Passwords must match and meet all rules.');
      return;
    }

    setBusy(true);
    try {
      const { data: { session }, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw sessErr;
      const uid = session?.user?.id;
      if (!uid) {
        setError('Session expired. Please log in again.');
        navigate('/login', { replace: true });
        return;
      }

      // 1) Update Supabase Auth password
      const { error: upErr } = await supabase.auth.updateUser({ password: clean1 });
      if (upErr) throw upErr;

      // 2) Clear the force-change flag in your profile
      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ force_password_change: false })
        .eq('id', uid);
      if (dbErr) throw dbErr;

      // 3) Notify & route forward
      setSuccess('Password updated successfully.');
      setTimeout(() => navigate('/demographics', { replace: true }), 900);
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

      <form className="space-y-3 text-left" onSubmit={submit} noValidate>
        <div className="relative">
          <input
            type={showPw1 ? 'text' : 'password'}
            placeholder="New password"
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded pr-12"
            autoComplete="new-password"
            required
            minLength={8}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-600"
            onClick={() => setShowPw1((s) => !s)}
            aria-label={showPw1 ? 'Hide password' : 'Show password'}
          >
            {showPw1 ? 'Hide' : 'Show'}
          </button>
        </div>

        <div className="relative">
          <input
            type={showPw2 ? 'text' : 'password'}
            placeholder="Confirm new password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded pr-12"
            autoComplete="new-password"
            required
            minLength={8}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-600"
            onClick={() => setShowPw2((s) => !s)}
            aria-label={showPw2 ? 'Hide password' : 'Show password'}
          >
            {showPw2 ? 'Hide' : 'Show'}
          </button>
        </div>

        <ul className="text-xs text-gray-600">
          <li>{clean1.length >= 8 ? '✓' : '✗'} At least 8 characters</li>
          <li>{/[A-Z]/.test(clean1) ? '✓' : '✗'} At least 1 capital letter</li>
          <li>{/\d/.test(clean1) ? '✓' : '✗'} At least 1 number</li>
          <li>{/[^A-Za-z0-9]/.test(clean1) ? '✓' : '✗'} At least 1 special character</li>
          <li>{clean1 && clean1 === clean2 ? '✓' : '✗'} Passwords match</li>
        </ul>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {success && <p className="text-green-600 text-sm">{success}</p>}

        <button
          type="submit"
          disabled={!ok || busy}
          className="w-full py-3 bg-black text-white rounded disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save New Password'}
        </button>
      </form>
    </div>
  );
}
