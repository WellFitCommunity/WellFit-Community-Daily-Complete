// src/pages/ConsentPrivacyPage.tsx
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient, useUser } from '../contexts/AuthContext';

const BUCKET = 'consent-signatures';

export default function ConsentPrivacyPage() {
  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  const user = useUser();
  const userId = user?.id ?? null;

  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);

  function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to capture signature.'))), type, quality);
    });
  }

  const handleSubmit = async () => {
    setError('');
    setFeedback('');

    if (!confirm) {
      setError('Please confirm your agreement to proceed.');
      return;
    }
    if (!userId) {
      setError('You must be logged in to submit consent.');
      return;
    }
    const firstName = (localStorage.getItem('firstName') || '').trim();
    const lastName = (localStorage.getItem('lastName') || '').trim();
    if (!firstName || !lastName) {
      setError('Missing name from previous step.');
      return;
    }
    const canvas = sigCanvasRef.current;
    if (!canvas) {
      setError('No signature area found.');
      return;
    }

    setSubmitting(true);
    try {
      // Convert canvas drawing to a PNG Blob
      const blob = await canvasToBlob(canvas, 'image/png');

      // Safe filename under the user’s folder
      const ts = Date.now();
      const safe = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${userId}/${safe(firstName)}_${safe(lastName)}_${ts}.png`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(`privacy-signatures/${filePath}`, blob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/png',
        });

      if (uploadError) {
        setError('Failed to upload privacy consent signature. Please try again.');
        setSubmitting(false);
        return;
      }

      // Log consent in DB
      const { error: dbError } = await supabase.from('privacy_consent').insert([
        {
          user_id: userId,
          first_name: firstName,
          last_name: lastName,
          file_path: `privacy-signatures/${filePath}`,
          consented_at: new Date().toISOString(),
        },
      ]);

      if (dbError) {
        setError('Upload succeeded, but database log failed.');
        setSubmitting(false);
        return;
      }

      // Mark consent as complete in profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ consent: true })
        .eq('user_id', userId);

      if (profileError) {
        console.warn('Failed to update consent status in profiles:', profileError);
        // Don't fail the whole process, just warn
      }

      setFeedback('Your consent has been recorded. Thank you!');
      localStorage.removeItem('firstName');
      localStorage.removeItem('lastName');

      setTimeout(() => navigate('/dashboard'), 1200);
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
        At WellFit Community, Inc., Vital Edge Healthcare Consulting, LLC, and Envision VirtualEdge Group, LLC, we take your privacy seriously and treat your information with care and respect.
        Our team follows privacy-conscious practices inspired by HIPAA principles, ensuring your health information is stored securely, only shared with trusted individuals as needed, and used solely to support your wellness.
        We do not sell or misuse your data, and we are committed to protecting your dignity, your safety, and your trust.
      </p>
      <p className="mb-4 text-sm">
        By checking the box below, you confirm that you have read, understood, and agree to the terms of our Privacy Policy.
        This includes how we collect, use, and protect your personal information, including the photo and likeness you previously consented to.
        Your participation in the WellFit Community program is contingent upon this agreement.
        Note: This platform is for wellness community purposes and is not a substitute for professional medical advice or care.
      </p>

      <div className="mb-4">
        <label className="block mb-2 font-semibold">Signature (draw below):</label>
        <canvas
          ref={sigCanvasRef}
          width={400}
          height={120}
          style={{ border: '1px solid #ccc', background: '#f9f9f9', width: '100%' }}
        />
      </div>

      <label className="flex items-center mb-4">
        <input
          type="checkbox"
          className="mr-2"
          checked={confirm}
          onChange={() => setConfirm((v) => !v)}
          disabled={submitting}
        />
        I have read and agree to the Privacy Policy.
      </label>

      <button
        onClick={handleSubmit}
        disabled={!confirm || submitting}
        className="w-full py-2 bg-[#003865] text-white rounded hover:bg-[#8cc63f] disabled:opacity-50"
      >
        {submitting ? 'Submitting Agreement…' : 'Agree and Complete Registration'}
      </button>

      {feedback && <p className="text-green-600 text-sm mt-2">{feedback}</p>}
      {error && <p className="text-red-600 text-sm mt-2" role="alert">{error}</p>}
    </div>
  );
}
