// src/components/admin/AdminPanel.tsx
import React, { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import UsersList from './UsersList';
// The XLSX export functionality has been extracted into the ExportCheckIns component,
// which handles all necessary imports (xlsx, file-saver) and export logic.
import ReportsSection from './ReportsSection';
import ExportCheckIns from './ExportCheckIns';
import ApiKeyManager from './ApiKeyManager';

type Role = 'admin' | 'super_admin';

const AdminPanel: React.FC = () => {
  const [pin, setPin] = useState<string>('');
  const [role, setRole] = useState<Role>('admin');
  const [authedRole, setAuthedRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnlock = useCallback(async () => {
    if (!pin.trim()) {
      setError('Please enter a PIN');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('verify-admin-pin', {
        body: JSON.stringify({ pin, role }),
      });
      if (fnError) throw new Error(fnError.message);
      if (!data?.success) throw new Error(data.error || 'Invalid PIN');
      setAuthedRole(role);
    } catch (err: any) {
      setError(err.message || 'PIN verification failed');
    } finally {
      setLoading(false);
    }
  }, [pin, role]);

  if (!authedRole) {
    return (
      <div className="p-6 max-w-md mx-auto bg-white rounded shadow">
        <h1 className="text-2xl font-semibold mb-4">Admin Panel Access</h1>
        {error && <p className="text-red-600 mb-2">{error}</p>}
        <label className="block mb-2 text-sm font-medium text-gray-700">Select Role:</label>
        <select
          value={role}
          onChange={e => setRole(e.target.value as Role)}
          className="w-full p-2 border rounded mb-4"
          disabled={loading}
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
          disabled={loading}
        />
        <button
          onClick={handleUnlock}
          disabled={loading}
          className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Verifying…' : 'Unlock'}
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto bg-white rounded shadow space-y-6">
      <h1 className="text-2xl font-bold text-blue-900">
        Admin Panel &ndash; {authedRole === 'super_admin' ? 'Super Admin' : 'Admin'}
      </h1>

      <UsersList />
      <ReportsSection />
      <ExportCheckIns />

      {authedRole === 'super_admin' && (
        <section className="mt-6">
          <h2 className="text-xl font-semibold text-blue-800 mb-4">API Key Management</h2>
          <ApiKeyManager />
        </section>
      )}
    </div>
  );
};

export default AdminPanel;
