// src/components/admin/AdminPanel.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { useAdminAuth } from '../../contexts/AdminAuthContext'; // Import useAdminAuth
import { useAuth } from '../../contexts/AuthContext'; // Import general useAuth
import UsersList from './UsersList';
// The XLSX export functionality has been extracted into the ExportCheckIns component,
// which handles all necessary imports (xlsx, file-saver) and export logic.
import ReportsSection from './ReportsSection';
import ExportCheckIns from './ExportCheckIns';
import ApiKeyManager from './ApiKeyManager';

type AdminRole = 'admin' | 'super_admin'; // Renamed Role to AdminRole for clarity with context

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
