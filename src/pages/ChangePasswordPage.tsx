// src/pages/ChangePasswordPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient } from '../contexts/AuthContext';

function readHashParams(): Record<string, string> {
  const hash = (typeof window !== 'undefined' && window.location.hash) || '';
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const out: Record<string, string> = {};
  params.forEach((v, k) => (out[k] = v));
  return out;
}

function readQueryParams(): Record<string, string> {
  const search = (typeof window !== 'undefined' && window.location.search) || '';
  const params = new URLSearchParams(search);
  const out: Record<string, string> = {};
  params.forEach((v, k) => (out[k] = v));
  return out;
}

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
  const [sessionReady, setSessionReady] = useState(false);

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

  // 1) Claim/establish session from the reset link, then mark sessionReady=true
  useEffect(() => {
    let did = false;

    (async () => {
      try {
        // A) Newer flow: query param with code
        const q = readQueryParams();
if (q.type === 'recovery' && q.code) {
  // Exchange code for a session (must pass full URL, not just code)
  const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);
  if (error) throw error;

  // Clean the URL (remove code/type)
  window.history.replaceState({}, document.title, window.location.pathname);

  setSessionReady(true);
  did = true;
  return;
}

        // B) Legacy flow: tokens in the hash
        const h = readHashParams();
        if (h.type === 'recovery' && h.access_token && h.refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token: h.access_token,
            refresh_token: h.refresh_token,
          });
          if (error) throw error;
          // Clean the hash
          window.history.replaceState({}, document.title, window.location.pathname);
          setSessionReady(true);
          did = true;
          return;
        }

        // C) No tokens provided; check if we already have a session
        const { data: { session } } = await supabase.auth.getSession();
        setSessionReady(!!session);
      } catch (e: any) {
        setError(e?.message || 'Could not establish session from reset link.');
        setSessionReady(false);
      }
    })();

    return () => { did = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // Guard: ensure we really have a session (should be set by effect above)
      const { data: { session }, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw sessErr;
      const uid = session?.user?.id;
      if (!uid) {
        setError('Session expired or invalid. Please click the reset link again.');
        return;
      }

      // 1) Update Supabase Auth password
      const { error: upErr } = await supabase.auth.updateUser({ password: clean1 });
      if (upErr) throw upErr;

      // 2) (Optional) Clear your force-change flag if you use it
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
        {sessionReady
          ? 'For your security, please set a new password to continue.'
          : 'We’re preparing your reset session. If this stalls, re-open the link from your email.'}
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
            disabled={!sessionReady || busy}
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
            disabled={!sessionReady || busy}
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
          disabled={!ok || busy || !sessionReady}
          className="w-full py-3 bg-black text-white rounded disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save New Password'}
        </button>
      </form>
    </div>
  );
}
