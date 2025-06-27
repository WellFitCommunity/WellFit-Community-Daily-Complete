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
  };

  return authed ? (
    <section className="bg-white border-2 border-[#8cc63f] p-4 rounded-xl shadow space-y-6">
      <h2 className="text-xl font-semibold text-[#003865] mb-2">Admin Panel ✅</h2>

      <UsersList />
      <ReportsSection />
      <ExportCheckIns />
      <ApiKeyManager /> {/* Add the ApiKeyManager component here */}
    </section>
  ) : (
    <section className="bg-white border-2 border-[#8cc63f] p-4 rounded-xl shadow">
      <h2 className="text-xl font-semibold text-[#003865] mb-2">Admin Panel 🔒</h2>
      <input
        type="password"
        value={pin}
        onChange={e => setPin(e.target.value)}
        placeholder="Enter staff PIN"
        className="border p-1 rounded"
      />
      <button
        onClick={handleUnlock}
        className="ml-2 px-3 py-1 bg-[#003865] text-white rounded"
      >
        Unlock
      </button>
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </section>
  );
};

export default AdminPanel;
