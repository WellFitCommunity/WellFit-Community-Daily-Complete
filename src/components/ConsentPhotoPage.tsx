// src/components/ConsentPhotoPage.tsx
import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { useNavigate } from 'react-router-dom';

const ConsentPhotoPage: React.FC = () => {
  const sigCanvasRef = useRef<SignatureCanvas | null>(null);
  const [fullName, setFullName] = useState(localStorage.getItem('photoConsentFullName') || '');
  const [error, setError] = useState('');
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

    try {
      const signatureDataUrl = sigCanvasRef.current?.toDataURL();
      if (signatureDataUrl) {
        localStorage.setItem('photoConsentFullName', fullName);
        localStorage.setItem('photoConsentSignature', signatureDataUrl);
        // alert('Photo consent saved locally. Proceed to privacy agreement.'); // Optional: for debugging or user feedback
        navigate('/consent-privacy');
      } else {
        setError('Failed to capture signature. Please try again.');
      }
    } catch (err) {
      console.error('Error saving photo consent data:', err);
      setError('An unexpected error occurred while saving your consent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-white rounded shadow text-black">
      <h2 className="text-2xl font-bold text-center text-[#003865] mb-4">Photo and Likeness Consent</h2>
      <p className="mb-4 text-sm">
        By signing this form, you consent to the use of your photo and likeness by the WellFit Community platform
        for community wellness purposes. This may include display within the platform, promotional materials,
        and other related activities. Your data will be handled in accordance with our privacy policy,
        which you will have the opportunity to review and agree to in the next step.
        Participation is voluntary and you can revoke your consent at any time by contacting us.
      </p>

      <label className="block font-semibold mb-2">Full Name</label>
      <input
        type="text"
        value={fullName}
        onChange={e => setFullName(e.target.value)}
        className="w-full p-2 border border-gray-400 rounded mb-4"
        placeholder="Enter your full name"
      />

      <label className="block font-semibold mb-2">Signature</label>
      <div className="border border-gray-500 rounded mb-4">
        <SignatureCanvas
          penColor="black"
          canvasProps={{ width: 500, height: 200, className: 'bg-gray-100 w-full' }}
          ref={sigCanvasRef}
        />
      </div>

      <div className="flex justify-between mb-4">
        <button
          onClick={handleClear}
          className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
        >
          Clear Signature
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-[#003865] text-white rounded hover:bg-[#8cc63f]"
          disabled={submitting}
        >
          {submitting ? 'Saving...' : 'Save and Proceed to Privacy Consent'}
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
};

export default ConsentPhotoPage;
