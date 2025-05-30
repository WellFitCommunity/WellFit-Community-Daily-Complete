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

<<<<<<< HEAD
    const signatureData = localStorage.getItem('photoSignature');
    const firstName = localStorage.getItem('firstName');
    const lastName = localStorage.getItem('lastName');

    if (!signatureData || !firstName || !lastName) {
      setError('Missing signature or name from previous step.');
=======
    const photoConsentSignature = localStorage.getItem('photoConsentSignature');
    const photoConsentFullName = localStorage.getItem('photoConsentFullName');

    if (!photoConsentSignature || !photoConsentFullName) {
      setError('Missing photo consent data from the previous step. Please go back and complete the photo consent first.');
>>>>>>> merge-consent-selfreport-trivia
      return;
    }

    setSubmitting(true);
    setError('');
    setFeedback('');

    try {
<<<<<<< HEAD
      const blob = await (await fetch(signatureData)).blob();
      const fullName = `${firstName} ${lastName}`;
      const fileName = `signatures/${firstName}_${lastName}_${Date.now()}_final.png`;
=======
      const blob = await (await fetch(photoConsentSignature)).blob();
      const fileName = `privacy-signatures/${photoConsentFullName.replace(/\s+/g, '_')}_${Date.now()}_privacy_consent.png`;
>>>>>>> merge-consent-selfreport-trivia

      const { error: uploadError } = await supabase.storage
        .from('consent-signatures') // Assuming this is the correct bucket for privacy signatures as well
        .upload(fileName, blob);

      if (uploadError) {
        setError('Failed to upload privacy consent signature. Please try again.');
        setSubmitting(false);
        return;
      }

<<<<<<< HEAD
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
=======
      alert('Your privacy consent has been recorded. Thank you!');
      localStorage.removeItem('photoConsentSignature');
      localStorage.removeItem('photoConsentFullName');
      navigate('/dashboard');
>>>>>>> merge-consent-selfreport-trivia
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
<<<<<<< HEAD
        At WellFit Community, Inc., Vital Edge Healthcare Consulting, LLC, and Envision VirtualEdge Group, LLC, we take your privacy seriously and treat your information with care and respect. Our team follows privacy-conscious practices inspired by HIPAA principles, ensuring your health information is stored securely, only shared with trusted individuals as needed, and used solely to support your wellness. We do not sell or misuse your data, and we are committed to protecting your dignity, your safety, and your trust.
=======
        By checking the box below, you confirm that you have read, understood, and agree to the terms of our Privacy Policy. This includes how we collect, use, and protect your personal information, including the photo and likeness you previously consented to. Your participation in the WellFit Community program is contingent upon this agreement. We are committed to never sharing your personal data without your explicit permission. Note: this platform is for wellness community purposes and is not a substitute for professional medical advice or care.
>>>>>>> merge-consent-selfreport-trivia
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

      {feedback && <p className="text-green-600 text-sm mt-2">{feedback}</p>}
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
};

export default ConsentPrivacyPage;
