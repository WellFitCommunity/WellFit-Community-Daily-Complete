import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../contexts/AuthContext';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL as string,
  process.env.REACT_APP_SUPABASE_ANON_KEY as string
);

type AdminRole = 'admin' | 'super_admin';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();                // Supabase session + admin flag
  const { verifyPinAndLogin, isLoading, error } = useAdminAuth(); // your existing context

  const [mode, setMode]   = useState<'unlock' | 'setpin'>('unlock');
  const [role, setRole]   = useState<AdminRole>('admin');
  const [pin, setPin]     = useState('');
  const [pin2, setPin2]   = useState('');
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user || !isAdmin) {
    return (
      <div className="p-6 max-w-md mx-auto bg-white rounded shadow text-center">
        <h1 className="text-xl font-semibold mb-4 text-red-600">Access Denied</h1>
        <p>You must be logged in with an administrator account to manage admin PINs.</p>
      </div>
    );
  }

  async function handleSetPin() {
    setLocalErr(null);
    if (!/^\d{4,8}$/.test(pin)) return setLocalErr('PIN must be 4–8 digits.');
    if (pin !== pin2) return setLocalErr('PINs do not match.');

    setBusy(true);
    try {
      const { error: fnErr } = await supabase.functions.invoke('admin_set_pin', { body: { pin } });
      if (fnErr) return setLocalErr(fnErr.message || 'Could not set PIN.');
      alert('PIN saved. You can now unlock Admin Panel.');
      setMode('unlock'); setPin(''); setPin2('');
    } catch (e: any) {
      setLocalErr(e?.message || 'Could not set PIN.');
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock() {
    setLocalErr(null);
    if (!/^\d{4,8}$/.test(pin)) return setLocalErr('Enter your 4–8 digit PIN.');
    if (!user) {
      setLocalErr('User not found. Please log in again.');
      return;
    }

    const ok = await verifyPinAndLogin(pin, role, user.id);
    if (!ok) {
      setLocalErr('Incorrect PIN.');
      return;
    }
    // Unlocked; go to Admin Panel
    navigate('/admin', { replace: true });
  }

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded shadow">
      <h1 className="text-2xl font-semibold mb-2">Admin Security</h1>
      <p className="text-sm text-gray-600 mb-4">Logged in as {user.email || user.phone}</p>

      <div className="flex gap-2 mb-4">
        <button
          className={`px-3 py-2 rounded ${mode==='unlock' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => { setMode('unlock'); setLocalErr(null); }}
        >Unlock</button>
        <button
          className={`px-3 py-2 rounded ${mode==='setpin' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => { setMode('setpin'); setLocalErr(null); }}
        >Set / Update PIN</button>
      </div>

      {mode === 'unlock' ? (
        <div className="grid gap-3">
          <label className="text-sm">Role for this session</label>
          <select className="border p-2 rounded" value={role} onChange={e=>setRole(e.target.value as AdminRole)}>
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>

          <input className="border p-2 rounded" type="password" placeholder="Enter PIN" value={pin} onChange={e=>setPin(e.target.value)} />
          {(localErr || error) && <p className="text-red-600 text-sm">{localErr || error}</p>}

          <button
            className="w-full py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            disabled={isLoading}
            onClick={handleUnlock}
          >{isLoading ? 'Verifying…' : 'Unlock Admin Panel'}</button>
        </div>
      ) : (
        <div className="grid gap-3">
          <input className="border p-2 rounded" type="password" placeholder="New PIN (4–8 digits)" value={pin} onChange={e=>setPin(e.target.value)} />
          <input className="border p-2 rounded" type="password" placeholder="Confirm PIN" value={pin2} onChange={e=>setPin2(e.target.value)} />
          {localErr && <p className="text-red-600 text-sm">{localErr}</p>}
          <button
            className="w-full py-2 bg-green-600 text-white rounded disabled:opacity-50"
            disabled={busy}
            onClick={handleSetPin}
          >{busy ? 'Saving…' : 'Save PIN'}</button>
        </div>
      )}
    </div>
  );
}

