import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ADMIN_KEY = 'WF_ADMIN_KEY'; // localStorage key

const LockScreen: React.FC = () => {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleUnlock = () => {
    // Replace this check with your own remote-validated value
    const validKey = process.env.REACT_APP_ADMIN_SECRET;
    if (input === validKey) {
      localStorage.setItem(ADMIN_KEY, input);
      navigate('/admin');
    } else {
      setError('Invalid key—access denied');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-6 rounded-xl shadow-md w-full max-w-sm">
        <h2 className="text-xl font-semibold text-wellfit-blue mb-4 text-center">
          Admin Access
        </h2>
        <input
          type="password"
          placeholder="Enter Admin Key"
          value={input}
          onChange={e => setInput(e.target.value)}
          className="w-full p-2 border rounded mb-2"
        />
        {error && <p className="text-red-500 mb-2">{error}</p>}
        <button
          onClick={handleUnlock}
          className="w-full py-2 bg-wellfit-green text-white font-semibold rounded"
        >
          Unlock
        </button>
      </div>
    </div>
  );
};

export default LockScreen;
