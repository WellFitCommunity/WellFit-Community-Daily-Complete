// src/components/AdminPanel.tsx
import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient'; // Import Supabase client
import UsersList from './UsersList';
import ReportsSection from './ReportsSection';
import ExportCheckIns from './ExportCheckIns';
import ApiKeyManager from './ApiKeyManager';

const AdminPanel: React.FC = () => {
  const [pin, setPin] = useState('');
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); // For loading state

  const handleUnlock = async () => {
    setError('');
    setLoading(true);
    try {
      // Ensure ADMIN_PANEL_PIN is set in your Supabase project's environment variables for the function
      const { data, error: functionError } = await supabase.functions.invoke('verify-admin-pin', {
        body: { pin },
      });

      if (functionError) {
        console.error('Error invoking verify-admin-pin function:', functionError);
        // If functionError exists, data might be null or not what we expect for app-level errors.
        // Prioritize functionError.message.
        const message = functionError.message || 'Server error during PIN verification.';
        throw new Error(message);
      }

      // The function executed successfully, now check the application-level response in 'data'
      if (data?.success) {
        setAuthed(true);
      } else {
        setError(data?.error || 'Incorrect PIN.'); // Use error from function response if available
      }
    } catch (e: any) {
      console.error('PIN verification failed:', e);
      // Check for network-like errors specifically if needed, otherwise use e.message
      if (e.message?.toLowerCase().includes('failed to fetch') || e.message?.toLowerCase().includes('networkerror')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(e.message || 'An unexpected error occurred during PIN verification.');
      }
    } finally {
      setLoading(false);
    }
    setUpdating(null);
  };

  const exportToExcel = () => {
  const exportData = profiles.map(({ id, notes, ...rest }) => ({ ...rest, notes }));
  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Profiles');

  const binary = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
  const s2ab = (s: string) => {
    const buf = new ArrayBuffer(s.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < s.length; ++i) view[i] = s.charCodeAt(i) & 0xff;
    return buf;
  };

  const blob = new Blob([s2ab(binary)], { type: 'application/octet-stream' });
  saveAs(blob, 'wellfit_profiles.xlsx');
};

  return (
    <div className="p-6 max-w-7xl mx-auto bg-white rounded shadow space-y-4">
      <h1 className="text-2xl font-bold text-blue-900">Admin Panel</h1>

      {loading && <p>Loading profiles…</p>}
      {error && <p className="text-red-600">Error: {error}</p>}

      <button
        onClick={exportToExcel}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        Export to Excel
      </button>

      <table className="min-w-full border mt-4 text-sm">
        <thead className="bg-gray-100 text-gray-700 uppercase">
          <tr>
            <th className="border px-4 py-2">Name</th>
            <th className="border px-4 py-2">Phone</th>
            <th className="border px-4 py-2">Email</th>
            <th className="border px-4 py-2">Consent</th>
            <th className="border px-4 py-2">Notes</th>
            <th className="border px-4 py-2">Joined</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map(profile => (
            <tr key={profile.id} className="hover:bg-gray-50">
              <td className="border px-4 py-2">{profile.first_name} {profile.last_name}</td>
              <td className="border px-4 py-2">{profile.phone}</td>
              <td className="border px-4 py-2">{profile.email || '—'}</td>
              <td className="border px-4 py-2">{profile.consent ? '✅' : '❌'}</td>
              <td className="border px-4 py-2">
                <textarea
                  className="w-full border rounded p-1 text-sm"
                  rows={2}
                  defaultValue={profile.notes ?? ''}
                  onBlur={(e) => updateNote(profile.id, e.target.value)}
                  disabled={updating === profile.id}
                />
              </td>
              <td className="border px-4 py-2 text-gray-400">
                {new Date(profile.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AdminPanel;
