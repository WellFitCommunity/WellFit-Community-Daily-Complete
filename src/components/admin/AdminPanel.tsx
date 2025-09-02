import React from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import RequireAdminAuth from 'components/auth/RequireAdminAuth';

import UsersList from './UsersList';
import ReportsSection from './ReportsSection';
import ExportCheckIns from './ExportCheckIns';
import ApiKeyManager from './ApiKeyManager';

type _AdminRole = 'admin' | 'super_admin';

function EnrollPatientSection() {
  const [first, setFirst] = React.useState('');
  const [last, setLast] = React.useState('');
  const [phone, setPhone] = React.useState(''); // +E.164
  const [email, setEmail] = React.useState('');
  const [temp, setTemp] = React.useState(genTemp());
  const [busy, setBusy] = React.useState(false);

  const canEnroll = first.trim() && last.trim() && isE164(phone) && temp.trim();

  async function enroll() {
    if (!canEnroll) {
      alert('Fill first/last, +E.164 phone, and a temp password.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke('enrollClient', {
        body: {
          phone,
          password: temp,
          first_name: first,
          last_name: last,
          email: email || undefined,
        },
      });
      if (error) {
        alert('Enroll failed: ' + (error.message ?? 'Unknown error'));
        return;
      }
      alert(`Enrolled!\n\nTemp password:\n${temp}\n\nThey must change it on first login.`);
      setFirst(''); setLast(''); setPhone(''); setEmail(''); setTemp(genTemp());
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 border rounded-xl p-4">
      <h2 className="text-xl font-semibold text-blue-800 mb-3">Enroll a Patient</h2>
      <div className="grid gap-2 max-w-sm">
        <div className="grid grid-cols-2 gap-2">
          <input className="border p-2 rounded" placeholder="First name" value={first} onChange={e=>setFirst(e.target.value)} />
          <input className="border p-2 rounded" placeholder="Last name"  value={last}  onChange={e=>setLast(e.target.value)} />
        </div>
        <input className="border p-2 rounded" placeholder="Phone (+E.164 e.g. +15551234567)" value={phone} onChange={e=>setPhone(e.target.value)} type="tel" pattern="^\+\d{10,15}$" />
        <input className="border p-2 rounded" placeholder="Email (optional)" value={email} onChange={e=>setEmail(e.target.value)} />

        <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
          <input className="border p-2 rounded" placeholder="Temp password" value={temp} onChange={e=>setTemp(e.target.value)} />
          <button type="button" className="border rounded px-3 py-2" onClick={()=>setTemp(genTemp())}>New temp</button>
        </div>

        <button
          type="button"
          className="bg-green-600 text-white rounded p-2 disabled:opacity-50"
          disabled={!!busy || !canEnroll}
          onClick={enroll}
        >
          {busy ? 'Enrolling…' : 'Enroll'}
        </button>
      </div>
    </section>
  );
}

// helpers
function isE164(s: string) { return /^\+\d{10,15}$/.test(s); }
function genTemp(len: number = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const AdminPanel: React.FC = () => {
  const { adminRole, logoutAdmin } = useAdminAuth();

  return (
    <RequireAdminAuth allowedRoles={['admin', 'super_admin']}>
      <div className="p-6 max-w-7xl mx-auto bg-white rounded shadow space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-900">
            Admin Panel &ndash; {adminRole === 'super_admin' ? 'Super Admin' : 'Admin'}
          </h1>
          <button
            onClick={logoutAdmin}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
          >
            Logout Admin
          </button>
        </div>

        <UsersList />
        <ReportsSection />
        <ExportCheckIns />
        <EnrollPatientSection />

        {adminRole === 'super_admin' && (
          <section className="mt-6">
            <h2 className="text-xl font-semibold text-blue-800 mb-4">API Key Management</h2>
            <ApiKeyManager />
          </section>
        )}
      </div>
    </RequireAdminAuth>
  );
};

export default AdminPanel;
