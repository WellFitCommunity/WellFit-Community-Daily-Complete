// src/pages/ConsentPrivacyPage.tsx
import { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient, useUser } from '../contexts/AuthContext';

const BUCKET = 'consent-signatures';

const ConsentPrivacyPage: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const userId = user?.id ?? null;

  const sigCanvasRef = useRef<SignatureCanvas | null>(null);
  const [firstName, setFirstName] = useState(localStorage.getItem('firstName') || '');
  const [lastName, setLastName] = useState(localStorage.getItem('lastName') || '');
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleClear = () => {
    sigCanvasRef.current?.clear();
  };

  async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
    // robust conversion without relying on fetch data URL
    const [meta, base64] = dataUrl.split(',');
    const mime = meta.match(/data:(.*);base64/)?.[1] || 'image/png';
    const binStr = atob(base64);
    const len = binStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  const handleSubmit = async () => {
    setError('');
    setFeedback('');

    const fn = firstName.trim();
    const ln = lastName.trim();

    if (!fn || !ln) {
      setError('First and last name are required.');
      return;
    }
    if (!userId) {
      setError('You must be logged in to submit your consent.');
      return;
    }
    if (!confirm) {
      setError('Please confirm your agreement to proceed.');
      return;
    }
    if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) {
      setError('Signature is required.');
      return;
    }

    setSubmitting(true);
    try {
      // capture signature
      const dataUrl = sigCanvasRef.current.toDataURL('image/png');
      const blob = await dataUrlToBlob(dataUrl);

      // filename: under the user's folder for easier management
      const ts = Date.now();
      const safeFn = fn.replace(/[^a-zA-Z0-9._-]/g, '_');
      const safeLn = ln.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${userId}/privacy_${safeFn}_${safeLn}_${ts}.png`;

      // upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, blob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/png',
        });
      if (uploadError) {
        setError('Failed to upload signature. Please try again.');
        setSubmitting(false);
        return;
      }

      // log in DB
      const { error: dbError } = await supabase.from('privacy_consent').insert([
        {
          user_id: userId,
          consent_type: 'privacy',
          first_name: fn,
          last_name: ln,
          file_path: filePath,
          consented_at: new Date().toISOString(),
          consented: true,
          consent_method: 'electronic_signature',
        },
      ]);
      if (dbError) {
        setError('Signature saved, but logging consent failed. Please contact support.');
        setSubmitting(false);
        return;
      }

      // Mark consent as complete in profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ consent: true })
        .eq('user_id', userId);

      if (profileError) {

        // Don't fail the whole process, just warn
      }

      // Clear local cache
      localStorage.removeItem('firstName');
      localStorage.removeItem('lastName');

      setFeedback('Privacy consent submitted. Thank you!');
      // Move to PIN setup for caregiver access
      setTimeout(() => navigate('/set-caregiver-pin'), 1200);
    } catch (err) {

      setError('An unexpected error occurred while saving your consent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-white rounded-sm shadow-sm text-black">
      <h2 className="text-2xl font-bold text-center text-[#003865] mb-4">Privacy Policy Agreement</h2>

      <p className="mb-4 text-sm">
        At WellFit Community, Inc., Vital Edge Healthcare Consulting, LLC, and Envision VirtualEdge Group, LLC, we take your privacy seriously and treat your information with care and respect. Our team follows privacy-conscious practices inspired by HIPAA principles, ensuring your health information is stored securely, only shared with trusted individuals as needed, and used solely to support your wellness. We do not sell or misuse your data, and we are committed to protecting your dignity, your safety, and your trust.
      </p>

      <p className="mb-4 text-sm">
        By signing below and checking the box, you confirm that you have read, understood, and agree to the terms of our{' '}
        <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
          Privacy Policy
        </a>. This includes how we collect, use, and protect your personal information, including the photo and likeness you previously consented to. Your participation in the WellFit Community program is contingent upon this agreement.
      </p>

      <p className="mb-4 text-xs text-gray-600">
        <strong>Note:</strong> This platform is for wellness community purposes and is not a substitute for professional medical advice or care.
      </p>

      <label htmlFor="firstName" className="block font-semibold mb-2">First Name</label>
      <input
        id="firstName"
        type="text"
        value={firstName}
        onChange={e => setFirstName(e.target.value)}
        className="w-full p-2 border border-gray-400 rounded-sm mb-4"
        autoComplete="given-name"
      />

      <label htmlFor="lastName" className="block font-semibold mb-2">Last Name</label>
      <input
        id="lastName"
        type="text"
        value={lastName}
        onChange={e => setLastName(e.target.value)}
        className="w-full p-2 border border-gray-400 rounded-sm mb-4"
        autoComplete="family-name"
      />

      <label className="block font-semibold mb-2" htmlFor="signature">Signature</label>
      <div className="border border-gray-500 rounded-sm mb-4" id="signature">
        <SignatureCanvas
          penColor="black"
          canvasProps={{ width: 500, height: 200, className: 'bg-gray-100 w-full' }}
          ref={sigCanvasRef}
        />
      </div>

      <div className="flex items-start gap-2 mb-4 p-3 border border-gray-300 rounded-sm bg-gray-50">
        <input
          type="checkbox"
          id="confirmPrivacy"
          checked={confirm}
          onChange={(e) => setConfirm(e.target.checked)}
          className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded-sm focus:ring-2 focus:ring-blue-500"
          disabled={submitting}
        />
        <label htmlFor="confirmPrivacy" className="text-sm text-gray-700">
          I have read and agree to the{' '}
          <a
            href="/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-800"
          >
            Privacy Policy
          </a>
        </label>
      </div>

      <div className="flex justify-between mb-4">
        <button
          onClick={handleClear}
          className="px-4 py-2 bg-gray-400 text-white rounded-sm hover:bg-gray-500"
          type="button"
          disabled={submitting}
        >
          Clear Signature
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-[#003865] text-white rounded-sm hover:bg-[#8cc63f] disabled:opacity-60"
          disabled={submitting}
          type="button"
          aria-busy={submitting}
        >
          {submitting ? 'Saving…' : 'Agree and Complete Registration'}
        </button>
      </div>

      {feedback && <p className="text-green-600 text-sm mt-2" role="status">{feedback}</p>}
      {error && <p className="text-red-600 text-sm mt-2" role="alert">{error}</p>}
    </div>
  );
};

export default ConsentPrivacyPage;
