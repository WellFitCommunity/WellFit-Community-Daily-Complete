// src/components/LockScreenUser.tsx

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import bcrypt from 'bcryptjs';
import { useInactivityLock } from '../contexts/InactivityLockContext';

interface PhoneAuthData {
  password_hash: string;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

const LockScreenUser: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { unlock: unlockSession } = useInactivityLock();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successSound] = useState(() => new Audio('/sounds/success.mp3'));

  const [attempts, setAttempts] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState(0);

  const isForInactivityLock = location.pathname === '/lock-screen';

  useEffect(() => {
    if (isForInactivityLock) {
      const storedPhone = localStorage.getItem('userPhone');
      if (storedPhone) {
        setPhone(storedPhone);
      } else {
        setError('Cannot identify user for unlock. Please log in again.');
      }
    } else {
      // Initial login, check if session exists for email users
      const checkEmailSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && location.pathname !== '/lock-screen') {
          navigate('/dashboard');
        }
      };
      checkEmailSession();
    }
  }, [isForInactivityLock, navigate, location.pathname]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isLockedOut) {
      interval = setInterval(() => {
        setLockoutTimeLeft(prev => {
          if (prev <= 1000) {
            setIsLockedOut(false);
            setAttempts(0);
            if (interval) clearInterval(interval);
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isLockedOut]);

  const handleUnlock = async () => {
    if (isLockedOut) {
      setError(`Too many attempts. Try again in ${Math.ceil(lockoutTimeLeft / 60000)} minute(s).`);
      return;
    }
    setLoading(true);
    setError('');

    const targetPhone = phone;
    if (!targetPhone) {
      setError('Please enter your phone number.');
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from('phone_auth')
      .select('password_hash')
      .eq('phone', targetPhone)
      .single<PhoneAuthData>();

    if (fetchError || !data?.password_hash) {
      setError('Phone not found or password not set up.');
      setLoading(false);
      return;
    }

    const isValid = await bcrypt.compare(password, data.password_hash);

    if (isValid) {
      setAttempts(0);
      successSound.play();
      document.body.classList.add('animate-pulse');
      if (isForInactivityLock) {
        unlockSession();
      } else {
        localStorage.setItem('userPhone', targetPhone);
      }
      setTimeout(() => {
        document.body.classList.remove('animate-pulse');
        if (isForInactivityLock && location.key !== "default") {
          navigate(-1);
        } else {
          navigate('/dashboard');
        }
      }, 500);
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= MAX_ATTEMPTS) {
        setIsLockedOut(true);
        setLockoutTimeLeft(LOCKOUT_DURATION_MS);
        setError(`Too many incorrect attempts. Locked out for ${LOCKOUT_DURATION_MS / 60000} minutes.`);
      } else {
        setError(`Invalid password. ${MAX_ATTEMPTS - newAttempts} attempts remaining.`);
      }
    }
    setLoading(false);
  };

  // FINGERPRINT: still demo-only, not secure—leave in or remove as desired
  const handleFingerprint = async () => {
    if (!window.PublicKeyCredential) {
      setError('Fingerprint login not supported on this browser.');
      return;
    }
    if (!phone && isForInactivityLock) {
      setError('User context for fingerprint unclear. Try password or re-login.');
      return;
    }
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const cred = await navigator.credentials.get({
        publicKey: {
          challenge,
          timeout: 60000,
          userVerification: 'preferred',
        },
      });
      if (cred) {
        if (isForInactivityLock && phone) {
          successSound.play();
          document.body.classList.add('animate-pulse');
          unlockSession();
          setTimeout(() => {
            document.body.classList.remove('animate-pulse');
            if (location.key !== "default") navigate(-1); else navigate('/dashboard');
          }, 500);
        } else if (!isForInactivityLock && phone) {
          setError("Please use password for initial login with phone number.");
        } else {
          setError('Fingerprint unlock condition not met.');
        }
      } else {
        setError('Fingerprint authentication failed or no credential returned.');
      }
    } catch (err) {
      setError('Fingerprint authentication failed or was canceled.');
    }
  };

  const displayPhoneNumber = isForInactivityLock && phone
    ? phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-****')
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-6 rounded-xl shadow-md w-full max-w-sm text-center">
        <img
          src="/android-chrome-512x512.png"
          alt="WellFit Logo"
          className="mx-auto mb-4 w-20 h-20"
        />
        <h2 className="text-xl font-semibold text-wellfit-blue mb-1">
          {isForInactivityLock ? 'Screen Locked' : 'Welcome Back'}
        </h2>
        {displayPhoneNumber && (
          <p className="text-sm text-gray-600 mb-3">Unlocking for: {displayPhoneNumber}</p>
        )}

        {!isForInactivityLock && (
          <input
            type="tel"
            id="phone-lock"
            placeholder="Enter Your Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md mb-3 focus:ring-2 focus:ring-indigo-500"
            required
            aria-label="Phone Number"
          />
        )}

        <label htmlFor="password-lock" className="sr-only">Password</label>
        <input
          type="password"
          id="password-lock"
          placeholder="Enter Your Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-md mb-3 focus:ring-2 focus:ring-indigo-500 text-center tracking-widest text-lg"
          required
          aria-label="Password"
          disabled={isLockedOut || (!phone && isForInactivityLock)}
        />

        {error && <p className="text-red-500 mb-2 text-sm">{error}</p>}

        <button
          onClick={handleUnlock}
          className="w-full py-3 font-semibold rounded mb-3 bg-wellfit-green text-white hover:bg-wellfit-blue transition-colors duration-300 disabled:bg-gray-400"
          disabled={loading || isLockedOut || (!phone && isForInactivityLock)}
        >
          {loading ? 'Checking...' : (isLockedOut ? 'Locked Out' : 'Unlock with Password')}
        </button>

        {(isForInactivityLock && phone) && (
          <button
            onClick={handleFingerprint}
            className="w-full py-3 font-semibold rounded bg-wellfit-blue text-white hover:bg-opacity-80 transition-colors duration-300 disabled:bg-gray-400"
          >
            Use Fingerprint
          </button>
        )}
        {!isForInactivityLock && (
          <p className="text-xs text-gray-400 mt-2">
            Fingerprint can be used after initial login if screen locks due to inactivity.
          </p>
        )}

        {isLockedOut && lockoutTimeLeft > 0 && (
          <p className="text-sm text-orange-500 mt-2">
            Try again in {Math.ceil(lockoutTimeLeft / 60000)} minute(s).
          </p>
        )}
      </div>
    </div>
  );
};

export default LockScreenUser;
