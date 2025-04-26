// src/components/WelcomeScreen.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning ☀️';
  if (hour < 18) return 'Good Afternoon 🌤️';
  return 'Good Evening 🌙';
};

const WelcomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [pin, setPin]     = useState('');

  // If they’re already logged in, go straight to dashboard
  useEffect(() => {
    const ph = localStorage.getItem('wellfitPhone');
    const pn = localStorage.getItem('wellfitPin');
    if (ph && pn) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !pin) {
      return alert('Please enter both phone and PIN.');
    }
    // Persist the exact keys RequireAuth expects
    localStorage.setItem('wellfitPhone', phone);
    localStorage.setItem('wellfitPin',   pin);
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="max-w-md mx-auto mt-16 p-8 bg-white rounded-xl shadow-md border-2 border-wellfitGreen text-center">
      <h1 className="text-3xl font-bold mb-4">Welcome to Our App</h1>
      <h2 className="text-xl mb-6 text-wellfit-blue">{getGreeting()}</h2>
      <p className="text-gray-700 mb-6">
        Strong Seniors. Stronger Community.  We’re thrilled you’re here!
      </p>

      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="tel"
          placeholder="Phone number"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <input
          type="password"
          placeholder="4-digit PIN"
          maxLength={4}
          value={pin}
          onChange={e => setPin(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <button
          type="submit"
          className="w-full py-2 bg-wellfit-blue text-white font-semibold rounded"
        >
          Log In
        </button>
      </form>
    </div>
  );
};

export default WelcomeScreen;
