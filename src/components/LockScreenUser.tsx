// src/components/LockScreenUser.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import bcrypt from 'bcryptjs';
import { useInactivityLock } from '../contexts/InactivityLockContext'; // Import the new context

interface PhoneAuthData {
  pin_hash: string;
}

const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

const LockScreenUser: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { unlock: unlockSession } = useInactivityLock();

  const [phoneForPin, setPhoneForPin] = useState(''); // Stores the phone number of the locked account
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successSound] = useState(() => new Audio('/sounds/success.mp3'));

  const [pinAttempts, setPinAttempts] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState(0);

  // Determine if this is an inactivity lock or initial phone login
  const isForInactivityLock = location.pathname === '/lock-screen';

  useEffect(() => {
    // If it's an inactivity lock, try to get the phone from localStorage
    // This implies the user was previously logged in with a phone number.
    if (isForInactivityLock) {
      const storedPhone = localStorage.getItem('userPhone');
      if (storedPhone) {
        setPhoneForPin(storedPhone);
      } else {
        // Handle case where lock screen is shown but no userPhone (e.g. email user, or localStorage cleared)
        // For now, PIN will likely fail or be disabled if phoneForPin is not set.
        setError('Cannot identify user for PIN unlock. Please log in again if issue persists.');
      }
    } else {
      // This is the initial phone login flow (not /lock-screen)
      // Check if there's an active Supabase email session
      const checkEmailSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && location.pathname !== '/lock-screen') { // Ensure not an inactivity lock
          navigate('/dashboard'); // Navigate if full user session exists
        }
        // If no email session, it remains on this screen for phone login
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
            setPinAttempts(0); // Reset attempts after lockout
            if (interval) clearInterval(interval);
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLockedOut]);


  const handleUnlock = async () => {
    if (isLockedOut) {
      setError(`Too many attempts. Try again in ${Math.ceil(lockoutTimeLeft / 60000)} minute(s).`);
      return;
    }

    setLoading(true);
    setError('');

    const targetPhone = isForInactivityLock ? phoneForPin : phoneForPin; // In this version, phoneForPin is used for both. User types phone if not inactivity lock.
    if (!targetPhone) {
      setError(isForInactivityLock ? 'User identity not found for unlock.' : 'Please enter your phone number.');
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from('phone_auth')
      .select('pin_hash')
      .eq('phone', targetPhone)
      .single<PhoneAuthData>();

    if (fetchError || !data?.pin_hash) {
      setError('Phone not found or PIN not set up.');
      setLoading(false);
      return;
    }

    const isValid = await bcrypt.compare(pin, data.pin_hash);

    if (isValid) {
      setPinAttempts(0); // Reset attempts on success
      successSound.play();
      document.body.classList.add('animate-pulse'); // Visual feedback

      if (isForInactivityLock) {
        unlockSession(); // Signal to InactivityLockContext
      } else {
        // This is an initial phone login
        localStorage.setItem('userPhone', targetPhone);
      }

      setTimeout(() => {
        document.body.classList.remove('animate-pulse');
        // Navigate to previous page if inactivity lock, else to dashboard
        if (isForInactivityLock && location.key !== "default") { // Check if there's history to go back to
            navigate(-1);
        } else {
            navigate('/dashboard');
        }
      }, 500);

    } else {
      const newAttempts = pinAttempts + 1;
      setPinAttempts(newAttempts);
      if (newAttempts >= MAX_PIN_ATTEMPTS) {
        setIsLockedOut(true);
        setLockoutTimeLeft(LOCKOUT_DURATION_MS);
        setError(`Too many incorrect attempts. Locked out for ${LOCKOUT_DURATION_MS / 60000} minutes.`);
      } else {
        setError(`Invalid PIN. ${MAX_PIN_ATTEMPTS - newAttempts} attempts remaining.`);
      }
    }
    setLoading(false);
  };

  const handleFingerprint = async () => {
    if (!window.PublicKeyCredential) {
      setError('Fingerprint login not supported on this browser.');
      return;
    }
    if (!phoneForPin && isForInactivityLock) {
        setError('User context for fingerprint unclear. Try PIN or re-login.');
        return;
    }
    // IMPORTANT: This is NOT a secure fingerprint authentication.
    // It only checks if the browser can perform a WebAuthn ceremony and if a phone number (from PIN login) is known.
    // True WebAuthn requires registration of credentials and server-side verification.
    console.warn("Current fingerprint 'authentication' is for UX demo only and NOT secure.");

    try {
      // Simplified challenge, real implementation needs server-generated challenge
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const cred = await navigator.credentials.get({
        publicKey: {
          challenge,
          timeout: 60000,
          userVerification: 'preferred',
          // rpId: window.location.hostname, // Should be set if you have registered credentials
          // allowCredentials: [], // Should list registered credential IDs for this user
        },
      });

      if (cred) {
        // In a real scenario, you'd send `cred` to a server to verify against a stored public key.
        // For this subtask, if a credential is returned AND we are in an "inactivity lock" state for a known phone user, we proceed.
        if (isForInactivityLock && phoneForPin) {
          successSound.play();
          document.body.classList.add('animate-pulse');
          unlockSession();
          setTimeout(() => {
            document.body.classList.remove('animate-pulse');
            if (location.key !== "default") navigate(-1); else navigate('/dashboard');
          }, 500);
        } else if (!isForInactivityLock && phoneForPin) {
            // This case is for initial login with fingerprint if phone is already entered
            // This part of the logic is less clear and might be removed if fingerprint is only for unlock
            setError("Please use PIN for initial login with phone number.");
        } else {
          setError('Fingerprint unlock condition not met (e.g., not an inactivity lock for a known phone user).');
        }
      } else {
        setError('Fingerprint authentication failed or no credential returned.');
      }
    } catch (err) {
      console.error('Fingerprint error:', err);
      setError('Fingerprint authentication failed or was canceled.');
    }
  };

  const displayPhoneNumber = isForInactivityLock && phoneForPin
    ? phoneForPin.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-****') // Mask part of it
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
            id="phone-lock" // Keep ID for label if any, or remove label
            placeholder="Enter Your Phone Number"
            value={phoneForPin} // Bind to phoneForPin for initial login scenario
            onChange={(e) => setPhoneForPin(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md mb-3 focus:ring-2 focus:ring-indigo-500"
            required
            aria-label="Phone Number"
          />
        )}

        <label htmlFor="pin-lock" className="sr-only">PIN</label>
        <input
          type="password" // Use password type for masking
          id="pin-lock"
          placeholder="Enter 4-digit PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} // Allow only digits, max 4
          maxLength={4}
          inputMode="numeric"
          pattern="[0-9]*"
          className="w-full p-3 border border-gray-300 rounded-md mb-3 focus:ring-2 focus:ring-indigo-500 text-center tracking-widest text-lg"
          required
          aria-label="PIN"
          disabled={isLockedOut || (!phoneForPin && isForInactivityLock)} // Disable if no phone identified for lock
        />

        {error && <p className="text-red-500 mb-2 text-sm">{error}</p>}

        <button
          onClick={handleUnlock}
          className="w-full py-3 font-semibold rounded mb-3 bg-wellfit-green text-white hover:bg-wellfit-blue transition-colors duration-300 disabled:bg-gray-400"
          disabled={loading || isLockedOut || (!phoneForPin && isForInactivityLock)}
        >
          {loading ? 'Checking...' : (isLockedOut ? 'Locked Out' : 'Unlock with PIN')}
        </button>

        {(isForInactivityLock && phoneForPin) && ( // Only show fingerprint for inactivity lock if phone was identified
          <button
            onClick={handleFingerprint}
            className="w-full py-3 font-semibold rounded bg-wellfit-blue text-white hover:bg-opacity-80 transition-colors duration-300 disabled:bg-gray-400"
            // disabled={isLockedOut} // Optionally disable during PIN lockout
          >
            Use Fingerprint
          </button>
        )}
        {!isForInactivityLock && (
             <p className="text-xs text-gray-400 mt-2">Fingerprint can be used after initial PIN login if screen locks due to inactivity.</p>
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

