
// src/components/WelcomePage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import PageLayout from '../components/ui/PageLayout';

const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const [privacyConsentAgreed, setPrivacyConsentAgreed] = useState(false);
  const [communicationConsentAgreed, setCommunicationConsentAgreed] = useState(false);

  // Effect for redirecting authenticated users
  useEffect(() => {
    if (localStorage.getItem('wellfitUserId')) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  // Load consent states from local storage on component mount
  useEffect(() => {
    // This effect should not run if redirecting, so check auth status again or ensure it's benign.
    // However, the redirect should happen before these states are set if user is authenticated.
    const storedPrivacyConsent = localStorage.getItem('privacyConsent');
    if (storedPrivacyConsent === 'true') {
      setPrivacyConsentAgreed(true);
    }
    const storedCommunicationConsent = localStorage.getItem('communicationConsent');
    if (storedCommunicationConsent === 'true') {
      setCommunicationConsentAgreed(true);
    }
  }, []); // Empty dependency array if these only run on mount and don't depend on navigate

  // Update local storage when consent states change
  useEffect(() => {
    localStorage.setItem('privacyConsent', privacyConsentAgreed ? 'true' : 'false');
  }, [privacyConsentAgreed]);

  useEffect(() => {
    localStorage.setItem('communicationConsent', communicationConsentAgreed ? 'true' : 'false');
  }, [communicationConsentAgreed]);

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
            checked={privacyConsentAgreed}
            onChange={() => setPrivacyConsentAgreed(!privacyConsentAgreed)}
            aria-required="true"
            className="mr-2 h-4 w-4 text-[#003865] border-gray-300 rounded focus:ring-2 focus:ring-offset-1 focus:ring-[#003865] focus:outline-none"
          />
          <label htmlFor="privacyAgree" className="text-base text-[#003865]">
            I have read and agree to the <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline text-[#003865]">Privacy Policy</a> and <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline text-[#003865]">Terms of Service</a>.
          </label>
        </div>
        <div className="flex items-center mb-4">
          <input
            id="communicationAgree"
            type="checkbox"
            checked={communicationConsentAgreed}
            onChange={() => setCommunicationConsentAgreed(!communicationConsentAgreed)}
            aria-required="true"
            className="mr-2 h-4 w-4 text-[#003865] border-gray-300 rounded focus:ring-2 focus:ring-offset-1 focus:ring-[#003865] focus:outline-none"
          />
          <label htmlFor="communicationAgree" className="text-base text-[#003865]">
            I consent to receive text messages, emails, and all other forms of mediated communication.
          </label>
        </div>
        <button
          onClick={() => {
          // Note: Local storage is already updated by useEffect hooks
          navigate('/register');
          }}
          disabled={!privacyConsentAgreed || !communicationConsentAgreed}
          className={`mt-2 px-6 py-3 font-semibold rounded-xl shadow-md transition focus:outline-none focus:ring-2 focus:ring-[#003865]
            ${privacyConsentAgreed && communicationConsentAgreed ? 'bg-[#8cc63f] hover:bg-[#003865] text-white' : 'bg-gray-300 text-gray-400 cursor-not-allowed'}
          `}
        >
          Continue
        </button>
      </Card>
    </PageLayout>
  );
};

export default WelcomePage;