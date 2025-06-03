// src/components/LockScreenUser.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import bcrypt from 'bcryptjs';

const LockScreenUser: React.FC = () => {
  const navigate = useNavigate();
  const [method, setMethod] = useState<'email' | 'phone' | null>(null);
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [unlockClicked, setUnlockClicked] = useState(false);
  const [fingerprintClicked, setFingerprintClicked] = useState(false);
  const [successSound] = useState(() => new Audio('/sounds/success.mp3'));

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        setMethod('email');
        navigate('/dashboard');
      } else {
        setMethod('phone');
      }
    };
    checkSession();
  }, [navigate]);

  const handleUnlock = async () => {
    setLoading(true);
    setUnlockClicked(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('phone_auth')
      .select('pin_hash')
      .eq('phone', phone)
      .single();

    if (fetchError || !data) {
      setError('Phone not found.');
      setLoading(false);
      return;
    }

    const isValid = await bcrypt.compare(pin, data.pin_hash);

    if (isValid) {
      localStorage.setItem('userPhone', phone);
      successSound.play();
      document.body.classList.add('animate-pulse');
      setTimeout(() => {
        document.body.classList.remove('animate-pulse');
        navigate('/dashboard');
      }, 500);
    } else {
      setError('Invalid PIN.');
    }

    setLoading(false);
  };

  const handleFingerprint = async () => {
    setFingerprintClicked(true);
    if (!window.PublicKeyCredential) {
      alert('Fingerprint login not supported on this browser.');
      return;
    }

    try {
      const cred = await navigator.credentials.get({
        publicKey: {
          challenge: new Uint8Array(32),
          timeout: 60000,
          userVerification: 'preferred',
        },
      });

      if (cred) {
        const savedPhone = localStorage.getItem('userPhone');
        if (savedPhone) {
          successSound.play();
          document.body.classList.add('animate-pulse');
          setTimeout(() => {
            document.body.classList.remove('animate-pulse');
            navigate('/dashboard');
          }, 500);
        } else {
          alert('No fingerprint-linked user. Please login with PIN first.');
        }
      }
    } catch (err) {
      console.error('Fingerprint error:', err);
      alert('Fingerprint failed or was canceled.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-6 rounded-xl shadow-md w-full max-w-sm text-center">
        <img
          src="/android-chrome-512x512.png"
          alt="WellFit Logo"
          className="mx-auto mb-4 w-20 h-20"
        />
        <h2 className="text-xl font-semibold text-wellfit-blue mb-4">
          Unlock Your Dashboard
        </h2>

        {method === 'phone' && (
          <>
            <input
              type="tel"
              placeholder="Phone Number"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full p-2 border rounded mb-2"
              required
            />
            <input
              type="password"
              placeholder="Enter 4-digit PIN"
              value={pin}
              onChange={e => setPin(e.target.value)}
              className="w-full p-2 border rounded mb-2"
              required
            />
            {error && <p className="text-red-500 mb-2">{error}</p>}
            <button
              onClick={handleUnlock}
              className={`w-full py-2 font-semibold rounded mb-2 transition-colors duration-300 ${
                unlockClicked ? 'bg-wellfit-blue text-white' : 'bg-wellfit-green text-white'
              }`}
              disabled={loading}
            >
              {loading ? 'Checking...' : 'Unlock with PIN'}
            </button>
            <button
              onClick={handleFingerprint}
              className={`w-full py-2 font-semibold rounded transition-colors duration-300 ${
                fingerprintClicked ? 'bg-wellfit-green text-white' : 'bg-wellfit-blue text-white'
              }`}
            >
              Use Fingerprint (Optional)
            </button>
          </>
        )}

        {method === null && (
          <p className="text-center text-gray-500">Checking session...</p>
        )}
      </div>
    </div>
  );
};

export default LockScreenUser;

