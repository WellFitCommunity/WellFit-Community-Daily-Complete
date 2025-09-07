// src/pages/AdminLoginPage.tsx
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useSupabaseClient } from '../contexts/AuthContext';

type AdminRole = 'admin' | 'super_admin';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const supabase = useSupabaseClient();

  // App auth contexts
  const { user, isAdmin } = useAuth();
  const { verifyPinAndLogin, isLoading, error } = useAdminAuth();

  const [mode, setMode] = useState<'unlock' | 'setpin'>('unlock');
  const [role, setRole] = useState<AdminRole>('admin');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const userLabel = useMemo(() => user?.email || user?.phone || 'Unknown user', [user]);

  if (!user || !isAdmin) {
    return (
      <div className="p-6 max-w-md mx-auto bg-white rounded shadow text-center">
        <h1 className="text-xl font-semibold mb-4 text-red-600">Access Denied</h1>
        <p>You must be logged in with an administrator account to manage admin PINs.</p>
      </div>
    );
  }

  function cleanPin(raw: string) {
    return raw.replace(/[^\d]/g, '').slice(0, 8);
  }

  async function handleSetPin(e?: React.FormEvent) {
    e?.preventDefault();
    setLocalErr(null);
    setSuccessMsg(null);
    const p1 = cleanPin(pin);
    const p2 = cleanPin(pin2);

    if (!/^\d{4,8}$/.test(p1)) return setLocalErr('PIN must be 4–8 digits.');
    if (p1 !== p2) return setLocalErr('PINs do not match.');

    setBusy(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('admin_set_pin', { body: { pin: p1, role } });
      if (fnErr) return setLocalErr(fnErr.message || 'Could not set PIN.');
      setSuccessMsg('PIN saved. You can now unlock the Admin Panel.');
      setMode('unlock');
      setPin('');
      setPin2('');
    } catch (e: any) {
      setLocalErr(e?.message || 'Could not set PIN.');
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock(e?: React.FormEvent) {
    e?.preventDefault();
    setLocalErr(null);
    setSuccessMsg(null);

    const p = cleanPin(pin);
    if (!/^\d{4,8}$/.test(p)) return setLocalErr('Enter your 4–8 digit PIN.');
    if (!user) return setLocalErr('User not found. Please log in again.');

    try {
      const ok = await verifyPinAndLogin(p, role);
      if (!ok) return setLocalErr('Incorrect PIN.');
      navigate('/admin', { replace: true });
    } catch (err: any) {
      setLocalErr(err?.message || 'Unable to unlock admin panel.');
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded shadow">
      <h1 className="text-2xl font-semibold mb-2">Admin Security</h1>
      <p className="text-sm text-gray-600 mb-4">Logged in as {userLabel}</p>

      <div className="flex gap-2 mb-4" role="tablist" aria-label="Admin security mode">
        <button
          className={`px-3 py-2 rounded ${mode === 'unlock' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => { setMode('unlock'); setLocalErr(null); setSuccessMsg(null); }}
          type="button"
          role="tab"
          aria-selected={mode === 'unlock'}
        >
          Unlock
        </button>
        <button
          className={`px-3 py-2 rounded ${mode === 'setpin' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => { setMode('setpin'); setLocalErr(null); setSuccessMsg(null); }}
          type="button"
          role="tab"
          aria-selected={mode === 'setpin'}
        >
          Set / Update PIN
        </button>
      </div>

      {mode === 'unlock' ? (
        <form className="grid gap-3" onSubmit={handleUnlock} noValidate>
          <label className="text-sm">Role for this session</label>
          <select
            className="border p-2 rounded"
            value={role}
            onChange={(e) => setRole(e.target.value as AdminRole)}
          >
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>

          <input
            className="border p-2 rounded"
            type="password"
            inputMode="numeric"
            pattern="\\d{4,8}"          
            placeholder="Enter PIN (4–8 digits)"
            value={pin}
            onChange={(e) => setPin(cleanPin(e.target.value))}
            autoComplete="one-time-code"
            required
          />

          {(localErr || error) && <p className="text-red-600 text-sm">{localErr || error}</p>}
          {successMsg && <p className="text-green-700 text-sm">{successMsg}</p>}

          <button
            className="w-full py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            disabled={isLoading}
            type="submit"
          >
            {isLoading ? 'Verifying…' : 'Unlock Admin Panel'}
          </button>
        </form>
      ) : (
        <form className="grid gap-3" onSubmit={handleSetPin} noValidate>
          <input
            className="border p-2 rounded"
            type="password"
            inputMode="numeric"
            pattern="\\d{4,8}" 
            
            placeholder="New PIN (4–8 digits)"
            value={pin}
            onChange={(e) => setPin(cleanPin(e.target.value))}
            required
          />
          <input
            className="border p-2 rounded"
            type="password"
            inputMode="numeric"
            pattern="\\d{4,8}"        
            placeholder="Confirm PIN"
            value={pin2}
            onChange={(e) => setPin2(cleanPin(e.target.value))}
            required
          />
          {(localErr || error) && <p className="text-red-600 text-sm">{localErr || error}</p>}
          {successMsg && <p className="text-green-700 text-sm">{successMsg}</p>}
          <button
            className="w-full py-2 bg-green-600 text-white rounded disabled:opacity-50"
            disabled={busy}
            type="submit"
          >
            {busy ? 'Saving…' : 'Save PIN'}
          </button>
        </form>
      )}
    </div>
  );
}
