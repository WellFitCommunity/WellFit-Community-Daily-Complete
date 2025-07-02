// src/pages/VerifyCodePage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const VerifyCodePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [phone, setPhone] = useState<string>(location.state?.phone || '');
  const [code, setCode] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    // If already logged in, redirect
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/dashboard', { replace: true });
    });
  }, [navigate]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Use Supabase OTP verification
      const { error: otpError } = await supabase.auth.verifyOtp({
        phone: phone,
        token: code,
        type: 'sms',
      });

      if (otpError) throw otpError;

      setLoading(false);
      // Proceed to next step in your flow
      navigate('/demographics');
    } catch (e: any) {
      setLoading(false);
      setError(e.message || 'Invalid code. Please try again.');
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6 bg-white shadow-xl rounded-xl flex flex-col items-center">
      <h2 className="text-2xl font-bold mb-6 text-[#003865]">Verify Your Phone</h2>
      <form className="w-full" onSubmit={handleVerify}>
        {!location.state?.phone && (
          <div className="mb-4">
            <label htmlFor="phone" className="block font-semibold mb-1 text-[#003865]">
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              required
              className="w-full p-3 border-2 border-[#003865] rounded text-lg"
              placeholder="+15555551234"
              inputMode="numeric"
              pattern="[0-9+]*"
            />
          </div>
        )}
        <div className="mb-4">
          <label htmlFor="code" className="block font-semibold mb-1 text-[#003865]">
            Verification Code
          </label>
          <input
            id="code"
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            required
            className="w-full p-3 border-2 border-[#003865] rounded text-lg"
            autoComplete="one-time-code"
            placeholder="Enter the code you received"
            maxLength={6}
          />
        </div>
        {error && <div className="text-red-600 mb-2">{error}</div>}
        <button
          type="submit"
          disabled={loading || !code || !phone}
          className="bg-[#003865] hover:bg-[#8cc63f] text-white font-bold px-6 py-3 rounded shadow w-full mt-2 transition disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </form>
    </div>
  );
};

export default VerifyCodePage;

