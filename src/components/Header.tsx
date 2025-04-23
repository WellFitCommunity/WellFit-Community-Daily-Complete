// src/components/Header.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

const Header: React.FC = () => {
  const navigate = useNavigate();

  // Opens your public website
  const handleVisitSite = () => {
    window.open('https://www.theWellFitCommunity.org', '_blank');
  };

  // Logs the user out and returns to WelcomePage
  const handleLogout = () => {
    localStorage.removeItem('phone');
    localStorage.removeItem('pin');
    navigate('/');
  };

  return (
    <header className="bg-gradient-to-r from-wellfit-blue to-wellfit-green text-white p-4 flex items-center justify-between rounded-b-xl shadow-lg">
      <div className="flex items-center">
        <img src="/logo.png" alt="WellFit Logo" className="h-12 w-auto mr-3" />
        <div>
          <h1 className="text-2xl font-bold">WellFit Community Daily</h1>
          <p className="text-wellfit-green text-sm italic">Strong Seniors. Stronger Community.</p>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={handleVisitSite}
          className="bg-white bg-opacity-20 hover:bg-opacity-40 text-white font-semibold px-4 py-2 rounded transition"
        >
          Visit Our Website
        </button>
        <button
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded transition"
        >
          Log Out
        </button>
      </div>
    </header>
  );
};

export default Header;
