// src/components/AdminPanel.tsx

// src/components/AdminPanel.tsx

import { useState } from 'react';
import UsersList from './UsersList';
import ReportsSection from './ReportsSection';
import ExportCheckIns from './ExportCheckIns';
import ApiKeyManager from './ApiKeyManager'; // Import the new component

const AdminPanel: React.FC = () => {
  const [pin, setPin] = useState('');
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState('');

  const handleUnlock = () => {
    if (pin === '1234') {  // TODO: replace with secure backend check
      setAuthed(true);
      setError('');
    } else {
      setError('Incorrect PIN');
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
