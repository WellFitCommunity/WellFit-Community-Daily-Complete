// src/components/WelcomePage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from './Card';

const WelcomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen px-4 py-8
                 bg-gradient-to-b from-[#003865]/20 to-[#8cc63f]/30 text-[#003865]"
    >
      {/* Welcome Card (original text unchanged) */}
      <Card className="max-w-lg w-full p-6 mb-8">
        <img
          src="/android-chrome-512x512.png"
          alt="WellFit Community Logo"
          className="w-28 md:w-36 mb-4 mx-auto"
        />
        <h1 className="text-3xl md:text-4xl font-bold mb-2">WellFit Community</h1>
        <p className="text-lg mt-2 max-w-xl leading-relaxed">
          Welcome to WellFit Community where we are revolutionizing aging WELL! It is our hope that you
          feel appreciated and respected as we partner with you in the best years of your life.
          Thank you for allowing us the privilege of your company. <strong>Strong Seniors, Stronger Community.</strong>
        </p>
        <button
          onClick={() => navigate('/senior-enrollment')}
          className="mt-6 px-6 py-3 bg-[#8cc63f] hover:bg-[#003865] text-white font-semibold
                     rounded-xl shadow-md transition focus:outline-none focus:ring-2 focus:ring-[#003865]"
        >
          Continue
        </button>
      </Card>

      {/* Privacy Statement Card */}
      <Card className="max-w-lg w-full p-6">
        <h2 className="text-2xl font-semibold mb-3">Privacy Statement</h2>
        <p className="text-lg leading-relaxed">
          Your privacy matters. All personal information you provide is securely stored in our
          database and will never be shared without your consent. We use industry‑standard
          encryption to protect your data. By continuing, you agree to our Terms of Service and
          Privacy Policy.
        </p>
      </Card>
    </div>
  );
};

export default WelcomePage;



