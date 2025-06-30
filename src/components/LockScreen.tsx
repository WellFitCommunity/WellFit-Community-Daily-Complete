import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// const ADMIN_KEY = 'WF_ADMIN_KEY'; // localStorage key - To be removed

const LockScreen: React.FC = () => {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); // Added loading state
  const navigate = useNavigate();

  const handleUnlock = async () => {
    setError('');
    setLoading(true);

    if (!input) {
      setError('Admin key cannot be empty.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/functions/v1/admin-login', { // Updated endpoint
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminKey: input }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // localStorage.setItem(ADMIN_KEY, input); // Removed: No localStorage
        console.log('// JULES: Admin login successful. Token:', result.token);
        console.log('// JULES: NOTE: Admin Token is not stored in localStorage anymore.');
        console.log('// JULES: Full admin auth state management will be handled in Step 7.');
        // TODO: Implement admin session management (e.g., using Context API) in Step 7
        // For now, navigate to admin, but it will likely fail without auth context.
        navigate('/admin'); // Or to a specific admin dashboard page
      } else {
        setError(result.error || 'Invalid admin key—access denied');
      }
    } catch (err: any) {
      console.error('Admin login request failed:', err);
      setError('Failed to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-6 rounded-xl shadow-md w-full max-w-sm">
        <h2 className="text-xl font-semibold text-wellfit-blue mb-4 text-center">
          Admin Access
        </h2>
        <form onSubmit={(e) => { e.preventDefault(); handleUnlock(); }} className="space-y-4">
          <div>
            <label htmlFor="admin-key-input" className="sr-only">Admin Key</label>
            <input
              id="admin-key-input"
              type="password"
              placeholder="Enter Admin Key"
              value={input}
              onChange={e => setInput(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-wellfit-blue"
              required
            />
          </div>
          {error && <p role="alert" className="text-red-500 text-sm font-semibold">{error}</p>}
          <button
            type="submit"
            onClick={handleUnlock}
            className="w-full py-2 bg-wellfit-green text-white font-semibold rounded hover:bg-opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-wellfit-green"
            disabled={loading}
          >
            {loading ? 'Unlocking...' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LockScreen;
