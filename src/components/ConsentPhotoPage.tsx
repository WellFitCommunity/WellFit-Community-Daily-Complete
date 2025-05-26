import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

const ConsentPrivacyPage: React.FC = () => {
  const sigCanvasRef = useRef<SignatureCanvas | null>(null);
  const [fullName, setFullName] = useState(localStorage.getItem('fullName') || '');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleClear = () => {
    sigCanvasRef.current?.clear();
  };

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      setError('Full name is required.');
      return;
    }
    if (sigCanvasRef.current?.isEmpty()) {
      setError('Signature is required.');
      return;
    }

    setSubmitting(true);
    setError('');
    setFeedback('');

    try {
      const dataUrl = sigCanvasRef.current?.toDataURL();
      const blob = await (await fetch(dataUrl)).blob();
      const fileName = `privacy-signatures/${fullName.replace(/\s+/g, '_')}_${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from('consent-signatures')
        .upload(fileName, blob);

      if (uploadError) {
        setError('Failed to upload signature.');
        setSubmitting(false);
        return;
      }

      const { error: dbError } = await supabase.from('privacy_consent').insert([
        {
          full_name: fullName,
          file_path: fileName,
          signed_at: new Date().toISOString(),
        },
      ]);

      if (dbError) {
        setError('Signature saved, but logging consent failed.');
        setSubmitting(false);
        return;
      }

      setFeedback('Privacy consent submitted. Thank you!');
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err) {
      console.error(err);
      setError('Unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-white rounded shadow text-black">
      <h2 className="text-2xl font-bold text-center text-[#003865] mb-4">Privacy & Participation Agreement</h2>
      <p className="mb-4 text-sm">
        At WellFit Community, Inc., Vital Edge Healthcare Consulting, LLC, and Envision VirtualEdge Group, LLC, we take your privacy seriously and treat your information with care and respect. Our team follows privacy-conscious practices inspired by HIPAA principles, ensuring your health information is stored securely, only shared with trusted individuals as needed, and used solely to support your wellness. We do not sell or misuse your data, and we are committed to protecting your dignity, your safety, and your trust.
      </p>

      <p className="mb-4 text-sm">
        By signing this agreement, you confirm that you have read and understand how photos, videos, or stories shared through the WellFit Community platform may be used. Your likeness or story may appear in program materials, community newsletters, grant reports, or other wellness-related promotions to highlight the impact of this work. Participation is entirely voluntary and may be withdrawn at any time by contacting our team.
      </p>

      <label htmlFor="fullName" className="block font-semibold mb-2">Full Name</label>
      <input
        id="fullName"
        type="text"
        value={fullName}
        onChange={e => setFullName(e.target.value)}
        className="w-full p-2 border border-gray-400 rounded mb-4"
      />

      <label className="block font-semibold mb-2">Final Signature</label>
      <div className="border border-gray-500 rounded mb-4">
        <SignatureCanvas
          penColor="black"
          canvasProps={{ width: 500, height: 200, className: 'bg-gray-100' }}
          ref={sigCanvasRef}
        />
      </div>

      <div className="flex justify-between mb-4">
        <button
          onClick={handleClear}
          className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
        >
          Clear
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-[#003865] text-white rounded hover:bg-[#8cc63f]"
          disabled={submitting}
        >
          {submitting ? 'Submitting...' : 'Submit Final Consent'}
        </button>
      </div>

      {feedback && <p className="text-green-600 text-sm mt-2">{feedback}</p>}
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
};

export default ConsentPrivacyPage;
