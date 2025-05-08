// src/components/WelcomePage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ hasEmail: false });

  // We define handleChange for future use — suppressed to prevent build failure
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = e.target;
    const { name, value, type, checked } = target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleContinue = () => {
    navigate('/senior-enrollment');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8 bg-white text-center">
      <img src="/android-chrome-512x512.png" alt="WellFit Community Logo" className="w-28 md:w-36 mb-4" />
      <h1 className="text-3xl md:text-4xl font-bold text-wellfit-blue">WellFit Community</h1>
      <p className="text-lg text-gray-700 mt-2 max-w-xl">
        Welcome to WellFit Community where we are revolutionizing aging WELL! It is our hope that you feel appreciated and respected as we partner with you in the best years of your life. Thank you for allowing us the privilege of your company. <strong>Strong Seniors, Stronger Community.</strong>
      </p>

      <div className="mt-6">
        <button
          onClick={handleContinue}
          className="px-6 py-3 bg-[#003865] hover:bg-[#8cc63f] text-white font-semibold rounded-xl shadow-md transition"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default WelcomePage;

