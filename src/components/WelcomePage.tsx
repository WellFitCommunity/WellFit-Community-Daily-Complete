import React, { useState, useEffect } from 'react';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning ☀️';
  if (hour < 18) return 'Good Afternoon 🌤️';
  return 'Good Evening 🌙';
};

const WelcomePage: React.FC = () => {
  const [phone, setPhone] = useState(localStorage.getItem('phone') || '');
  const [pin, setPin] = useState(localStorage.getItem('pin') || '');
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    if (phone && pin) setLoggedIn(true);
  }, [phone, pin]);

  const handleLogin = () => {
    if (phone && pin) {
      localStorage.setItem('phone', phone);
      localStorage.setItem('pin', pin);
      setLoggedIn(true);
    } else {
      alert('Please enter both phone and PIN.');
    }
  };

  return (
    <section className="bg-white border-2 border-wellfit-green p-6 rounded-xl shadow-md">
      <h2 className="text-2xl font-semibold text-wellfit-blue mb-4">{getGreeting()}</h2>

      {loggedIn ? (
        <p className="text-gray-700">
          You’re logged in as <strong>{phone}</strong>. Let’s get moving today!
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-gray-700">Please log in to continue:</p>
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
            className="w-full py-2 bg-wellfitBlue text-white font-semibold rounded"
          >
            Log In
          </button>
        </div>
      )}
    </section>
  );
};

export default WelcomePage;

