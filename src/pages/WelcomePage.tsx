import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * WelcomePage
 * Entry point for users to start the onboarding process.
 */
const WelcomePage: React.FC = () => {
  const navigate = useNavigate();

  const handleContinue = () => {
    navigate('/register');
  };

  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-gradient-to-b from-[#003865] to-[#8cc63f]">
      <div className="bg-white shadow-xl rounded-2xl p-8 max-w-md w-full m-4 flex flex-col items-center">
        {/* Logo */}
        <img
          src="/android-chrome-512x512.png"
          alt="WellFit Community Logo"
          loading="lazy"
          className="w-28 h-28 mb-4 rounded-full shadow"
        />

        {/* App Name */}
        <h1 className="text-3xl font-extrabold text-[#003865] mb-4 text-center">
          WellFit Community
        </h1>

        {/* Welcome Message */}
        <p className="text-lg text-gray-700 text-center mb-6">
          Welcome to WellFit Community where we are revolutionizing aging WELL! It is our hope that you feel appreciated and respected as we partner with you in the best years of your life. Thank you for allowing us the privilege of your company.<br />
          <span className="font-semibold">Strong Seniors, Stronger Community.</span>
        </p>

        {/* Continue Button */}
        <button
          type="button"
          onClick={handleContinue}
          aria-label="Continue to Registration"
          className="w-full py-3 rounded-2xl text-white text-lg font-bold bg-[#003865] hover:bg-[#8cc63f] transition duration-200 focus:outline-none focus:ring-2 focus:ring-[#003865]"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default WelcomePage;
