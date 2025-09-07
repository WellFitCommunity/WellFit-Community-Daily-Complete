// src/components/auth/HcaptchaGate.tsx
import React, { useState } from 'react';
import { useHcaptcha } from 'hooks/useHcaptcha';
import { verifyHcaptchaToken } from 'utils/verifyHcaptcha';

type Props = {
  onVerified: () => Promise<void>; // run your real action only after hCaptcha passes
};

export default function HcaptchaGate({ onVerified }: Props) {
  const siteKey = process.env.REACT_APP_HCAPTCHA_SITE_KEY as string;
  const { HCaptcha, captchaRef, execute } = useHcaptcha(siteKey);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const token = await execute();
      await verifyHcaptchaToken(token, siteKey);
      await onVerified(); // only now perform your sensitive action
    } catch (err: any) {
      setError(err?.message || 'Verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Invisible widget; auto-executes on submit */}
      <HCaptcha sitekey={siteKey} size="invisible" ref={captchaRef} />

      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
      >
        {submitting ? 'Verifying…' : 'Submit'}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
