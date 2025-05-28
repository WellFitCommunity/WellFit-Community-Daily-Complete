import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const ConsentPrivacyPage: React.FC = () => {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const handleSubmit = async () => {
    if (!confirm) {
      setError('Please confirm your agreement to proceed.');
      return;
    }

    const signatureData = localStorage.getItem('photoSignature');
    const firstName = localStorage.getItem('firstName');
    const lastName = localStorage.getItem('lastName');

    if (!signatureData || !firstName || !lastName) {
      setError('Missing signature or name from previous step.');
      return;
    }

    setSubmitting(true);
    setError('');
    setFeedback('');

    try {
      const blob = await (await fetch(signatureData)).blob();
      const fullName = `${firstName} ${lastName}`;
      const fileName = `signatures/${firstName}_${lastName}_${Date.now()}_final.png`;

      const { error: uploadError } = await supabase.storage
        .from('consent-signatures')
        .upload(fileName, blob);

      if (uploadError) {
        setError('Failed to upload final consent.');
        setSubmitting(false);
        return;
      }

      const { error: dbError } = await supabase.from('photo_consent').insert([
        {
          first_name: firstName,
          last_name: lastName,
          file_path: fileName,
          consented_at: new Date().toISOString(),
        }
      ]);

      if (dbError) {
        setError('Upload succeeded, but database log failed.');
        setSubmitting(false);
        return;
      }

      setFeedback('Your consent has been recorded. Thank you!');
      localStorage.removeItem('photoSignature');
      localStorage.removeItem('firstName');
      localStorage.removeItem('lastName');

      setTimeout(() => navigate('/dashboard'), 2000);
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
        At WellFit Community, Inc., Vital Edge Healthcare Consulting, LLC, and Envision VirtualEdge Group, LLC, we take your privacy seriously and treat your information with care and respect. Our team follows privacy-conscious practices inspired by HIPAA principles, ensuring your health information is stored securely, only shared with trusted individuals as needed, and used solely to support your wellness. We do not sell or misuse your data, and we are committed to protecting your dignity, your safety, and your trust.
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

      {feedback && <p className="text-green-600 text-sm mt-2">{feedback}</p>}
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
};

export default ConsentPrivacyPage;
