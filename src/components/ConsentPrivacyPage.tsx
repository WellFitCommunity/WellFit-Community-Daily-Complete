// src/components/ConsentPrivacyPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const ConsentPrivacyPage: React.FC = () => {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!confirm) {
      setError('Please confirm your agreement to proceed.');
      return;
    }

    const photoConsentSignature = localStorage.getItem('photoConsentSignature');
    const photoConsentFullName = localStorage.getItem('photoConsentFullName');

    if (!photoConsentSignature || !photoConsentFullName) {
      setError('Missing photo consent data from the previous step. Please go back and complete the photo consent first.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const blob = await (await fetch(photoConsentSignature)).blob();
      const fileName = `privacy-signatures/${photoConsentFullName.replace(/\s+/g, '_')}_${Date.now()}_privacy_consent.png`;

      const { error: uploadError } = await supabase.storage
        .from('consent-signatures') // Assuming this is the correct bucket for privacy signatures as well
        .upload(fileName, blob);

      if (uploadError) {
        setError('Failed to upload privacy consent signature. Please try again.');
        setSubmitting(false);
        return;
      }

      alert('Your privacy consent has been recorded. Thank you!');
      localStorage.removeItem('photoConsentSignature');
      localStorage.removeItem('photoConsentFullName');
      navigate('/dashboard');
    } catch (err) {
      console.error('Error submitting privacy consent:', err);
      setError('An unexpected error occurred while processing your privacy consent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-white rounded shadow text-black">
      <h2 className="text-2xl font-bold text-center text-[#003865] mb-4">Privacy Policy Agreement</h2>

      <p className="mb-4 text-sm">
        By checking the box below, you confirm that you have read, understood, and agree to the terms of our Privacy Policy. This includes how we collect, use, and protect your personal information, including the photo and likeness you previously consented to. Your participation in the WellFit Community program is contingent upon this agreement. We are committed to never sharing your personal data without your explicit permission. Note: this platform is for wellness community purposes and is not a substitute for professional medical advice or care.
      </p>

      <label className="flex items-center mb-4">
        <input
          type="checkbox"
          className="mr-2"
          checked={confirm}
          onChange={() => setConfirm(!confirm)}
        />
        <span className="text-sm">I have read, understood, and agree to the Privacy Policy.</span>
      </label>

      <button
        onClick={handleSubmit}
        disabled={!confirm || submitting}
        className="w-full py-2 bg-[#003865] text-white rounded hover:bg-[#8cc63f] disabled:opacity-50"
      >
        {submitting ? 'Submitting Agreement...' : 'Agree and Complete Registration'}
      </button>

      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
};

export default ConsentPrivacyPage;
