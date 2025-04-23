import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning ☀️';
  if (hour < 18) return 'Good Afternoon 🌤️';
  return 'Good Evening 🌙';
};

const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    const ph = localStorage.getItem('phone');
    const pn = localStorage.getItem('pin');
    if (ph && pn) navigate('/dashboard');
  }, [navigate]);

  const handleLogin = () => {
    if (phone && pin) {
      localStorage.setItem('phone', phone);
      localStorage.setItem('pin', pin);
      navigate('/dashboard');
    } else {
      alert('Please enter both phone and PIN.');
    }
  };

  return (
    <section className="bg-white border-2 border-wellfit-green p-6 rounded-xl shadow-md max-w-md mx-auto mt-16">
      {/* Logo */}
      <div className="flex justify-center mb-4">
        <img src="/logo.png" alt="WellFit Community Logo" className="h-20" />
      </div>

      {/* Time-based greeting */}
      <h2 className="text-2xl font-semibold text-wellfit-blue mb-2 text-center">
        {getGreeting()}
      </h2>

      {/* Website welcome message */}
      <p className="text-gray-700 mb-6 text-center">
        Welcome to WellFit Community! Strong Seniors. Stronger Community!  
        Where we help revolutionize aging well. It is our pleasure to serve you as you commit to aging well.
      </p>

      {/* Login form */}
      <div className="space-y-4">
        <input
          type="tel"
          placeholder="Phone number"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <input
          type="password"
          placeholder="4‑digit PIN"
          maxLength={4}
          value={pin}
          onChange={e => setPin(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <button
          onClick={handleLogin}
          className="w-full py-2 bg-wellfit-blue text-white font-semibold rounded"
        >
          Log In
        </button>
      </div>
    </section>
  );
};

export default WelcomePage;
