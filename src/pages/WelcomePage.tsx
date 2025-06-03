
// src/components/WelcomePage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import PageLayout from '../components/ui/PageLayout';

const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);

  return (
    <PageLayout>
      {/* Welcome Card */}
      <Card className="max-w-lg w-full p-6 mb-8 bg-white shadow-xl flex flex-col items-center">
        <img
          src="/android-chrome-512x512.png"
          alt="WellFit Community Logo"
          className="w-28 md:w-36 mb-4 mx-auto"
        />
        <h1 className="text-3xl md:text-4xl font-bold mb-2 text-[#003865]">WellFit Community</h1>
        <p className="text-lg mt-2 max-w-xl leading-relaxed text-[#003865]">
          Welcome to WellFit Community where we are revolutionizing aging WELL! It is our hope that you
          feel appreciated and respected as we partner with you in the best years of your life.
          Thank you for allowing us the privilege of your company. <strong>Strong Seniors, Stronger Community.</strong>
        </p>
      </Card>

      {/* Privacy Statement Card */}
      <Card className="max-w-lg w-full p-6 bg-white shadow-xl flex flex-col items-center">
        <h2 className="text-2xl font-semibold mb-3 text-[#003865]">Privacy Statement</h2>
        <p className="text-lg leading-relaxed mb-6 text-[#003865]">
          Your privacy matters. All personal information you provide is securely stored in our
          database and will never be shared without your consent. We use industry‑standard
          encryption to protect your data. By continuing, you agree to our Terms of Service and
          Privacy Policy.
        </p>
        <div className="flex items-center mb-4">
          <input
            id="privacyAgree"
            type="checkbox"
            checked={agreed}
            onChange={() => setAgreed(!agreed)}
            className="mr-2"
          />
          <label htmlFor="privacyAgree" className="text-base text-[#003865]">
            I have read and agree to the <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline text-[#003865]">Privacy Policy</a> and <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline text-[#003865]">Terms of Service</a>.
          </label>
        </div>
        <button
          onClick={() => {
          localStorage.setItem('privacyConsent', 'true');  
          navigate('/register');
          }}
          disabled={!agreed}
          className={`mt-2 px-6 py-3 font-semibold rounded-xl shadow-md transition focus:outline-none focus:ring-2 focus:ring-[#003865]
            ${agreed ? 'bg-[#8cc63f] hover:bg-[#003865] text-white' : 'bg-gray-300 text-gray-400 cursor-not-allowed'}
          `}
        >
          Continue
        </button>
      </Card>
    </PageLayout>
  );
};

export default WelcomePage;