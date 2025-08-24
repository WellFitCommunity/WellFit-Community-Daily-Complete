// src/components/admin/AdminPanel.tsx
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useAdminAuth } from '../../contexts/AdminAuthContext'; // Import useAdminAuth
import { useAuth } from '../../contexts/AuthContext'; // Import general useAuth
import { supabase } from '../../lib/supabaseClient';
import UsersList from './UsersList';
// The XLSX export functionality has been extracted into the ExportCheckIns component,
// which handles all necessary imports (xlsx, file-saver) and export logic.
import ReportsSection from './ReportsSection';
import ExportCheckIns from './ExportCheckIns';
import ApiKeyManager from './ApiKeyManager';

type AdminRole = 'admin' | 'super_admin'; // Renamed Role to AdminRole for clarity with context

function EnrollPatientSection() {
  const [first, setFirst] = React.useState('');
  const [last, setLast] = React.useState('');
  const [phone, setPhone] = React.useState('');         // must be +E.164
  const [email, setEmail] = React.useState('');
  const [temp, setTemp] = React.useState(genTemp());
  const [busy, setBusy] = React.useState(false);

  const canEnroll = useMemo(() => {
    return first.trim() && last.trim() && isE164(phone) && temp.trim();
  }, [first, last, phone, temp]);

  async function enroll() {
    if (!canEnroll) {
      alert('Fill first/last, +E.164 phone, and a temp password.');
      return;
    }
    setBusy(true);
    try {
      // Uses the admin's current JWT from supabase.auth
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
        <input className="border p-2 rounded" placeholder="Phone (+E.164 e.g. +15551234567)" value={phone} onChange={e=>setPhone(e.target.value)} />
        <input className="border p-2 rounded" placeholder="Email (optional)" value={email} onChange={e=>setEmail(e.target.value)} />

        <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
          <input className="border p-2 rounded" placeholder="Temp password" value={temp} onChange={e=>setTemp(e.target.value)} />
          <button type="button" className="border rounded px-3 py-2" onClick={()=>setTemp(genTemp())}>New temp</button>
        </div>

        <button
          type="button"
          className="bg-green-600 text-white rounded p-2 disabled:opacity-50"
          disabled={busy || !canEnroll}
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
function genTemp(len = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}


const AdminPanel: React.FC = () => {
  const {
    isAdminAuthenticated,
    adminRole: contextAdminRole, // Renamed to avoid conflict with local 'role' state
    isLoading: authLoading,
    error: authError,
    verifyPinAndLogin,
    logoutAdmin
  } = useAdminAuth();
  const { user, isAdmin: isSupabaseAdmin } = useAuth(); // Get user and isAdmin status from general AuthContext

  const [pin, setPin] = useState<string>('');
  const [role, setRole] = useState<AdminRole>('admin'); // Local state for role selection in form
  const [localError, setLocalError] = useState<string | null>(null); // For form-specific errors

  // Effect to clear localError if authError from context changes (e.g. global logout)
  useEffect(() => {
    if (authError) {
      setLocalError(authError);
    }
  }, [authError]);

  const handleUnlock = useCallback(async () => {
    if (!user || !isSupabaseAdmin) {
      setLocalError('You are not authorized to perform this action. Please ensure you are logged in as an admin.');
      return;
    }
    if (!pin.trim()) {
      setLocalError('Please enter a PIN');
      return;
    }
    setLocalError(null); // Clear previous local errors

    // Pass the user ID from the general AuthContext to the verifyPinAndLogin function
    const success = await verifyPinAndLogin(pin, role, user.id);
    if (success) {
      setPin(''); // Clear PIN input on successful login
    }
    // Error handling is managed by verifyPinAndLogin and synced via useEffect
  }, [pin, role, verifyPinAndLogin, user, isSupabaseAdmin]);

  const handleLogout = () => {
    logoutAdmin();
    // No navigation needed here as this component will re-render to show login form
  };

  // First, check if the user is logged in via Supabase Auth and has admin privileges
  if (!user || !isSupabaseAdmin) {
    return (
      <div className="p-6 max-w-md mx-auto bg-white rounded shadow text-center">
        <h1 className="text-xl font-semibold mb-4 text-red-600">Access Denied</h1>
        <p className="text-gray-700">
          You must be logged in with an administrator account to access the admin panel.
        </p>
        {/* Optionally, provide a link to the main login page or contact support */}
      </div>
    );
  }

  // If Supabase admin is logged in, then check for PIN authentication
  if (!isAdminAuthenticated) {
    return (
      <div className="p-6 max-w-md mx-auto bg-white rounded shadow">
        <h1 className="text-2xl font-semibold mb-4">Admin Panel Access</h1>
        <p className="text-sm text-gray-600 mb-4">
          Logged in as: {user.email || user.phone}. You have admin privileges. Please enter your PIN.
        </p>
        {(localError || authError) && <p className="text-red-600 mb-2">{localError || authError}</p>}
        <label className="block mb-2 text-sm font-medium text-gray-700">Select Role for this session:</label>
        <select
          value={role}
          onChange={e => setRole(e.target.value as AdminRole)}
          className="w-full p-2 border rounded mb-4"
          disabled={authLoading}
        >
          <option value="admin">Admin</option>
          <option value="super_admin">Super Admin</option>
        </select>
        <label className="block mb-2 text-sm font-medium text-gray-700">Enter PIN:</label>
        <input
          type="password"
          value={pin}
          onChange={e => setPin(e.target.value)}
          className="w-full p-2 border rounded mb-4"
          placeholder="PIN"
          disabled={authLoading}
        />
        <button
          onClick={handleUnlock}
          disabled={authLoading}
          className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {authLoading ? 'Verifying…' : 'Unlock'}
        </button>
      </div>
    );
  }

  // If both Supabase admin and PIN auth are successful, show the admin panel
  return (
    <div className="p-6 max-w-7xl mx-auto bg-white rounded shadow space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-900">
          Admin Panel &ndash; {contextAdminRole === 'super_admin' ? 'Super Admin' : 'Admin'}
        </h1>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
        >
          Logout Admin
        </button>
      </div>

      <UsersList />
      <ReportsSection />
      <ExportCheckIns />
      <EnrollPatientSection />

      {/* Show API Key management only for super admins */}

      {contextAdminRole === 'super_admin' && (
        <section className="mt-6">
          <h2 className="text-xl font-semibold text-blue-800 mb-4">API Key Management</h2>
          <ApiKeyManager />
        </section>
      )}
    </div>
  );
};

export default AdminPanel;
