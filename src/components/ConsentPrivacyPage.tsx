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

    const signatureData = localStorage.getItem('photoSignature');
    const fullName = localStorage.getItem('fullName');

    if (!signatureData || !fullName) {
      setError('Missing signature or name from previous step.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const blob = await (await fetch(signatureData)).blob();
      const fileName = `signatures/${fullName.replace(/\s+/g, '_')}_${Date.now()}_final.png`;

      const { error: uploadError } = await supabase.storage
        .from('consent-signatures')
        .upload(fileName, blob);

      if (uploadError) {
        setError('Failed to upload final consent.');
        setSubmitting(false);
        return;
      }

      alert('Your consent has been recorded. Thank you!');
      localStorage.removeItem('photoSignature');
      localStorage.removeItem('fullName');
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      setError('An error occurred while processing your consent.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-white rounded shadow text-black">
      <h2 className="text-2xl font-bold text-center text-[#003865] mb-4">Final Privacy & Participation Consent</h2>

      <p className="mb-4 text-sm">
        By checking the box below, you agree to the secure handling of your data for participation in the WellFit Community program. We will never share your personal data without permission. This is not a substitute for medical care.
      </p>

      <label className="flex items-center mb-4">
        <input
          type="checkbox"
          className="mr-2"
          checked={confirm}
          onChange={() => setConfirm(!confirm)}
        />
        <span className="text-sm">I understand and agree to the terms above.</span>
      </label>

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full py-2 bg-[#003865] text-white rounded hover:bg-[#8cc63f]"
      >
        {submitting ? 'Submitting...' : 'Submit Final Consent'}
      </button>

      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
};

export default ConsentPrivacyPage;
