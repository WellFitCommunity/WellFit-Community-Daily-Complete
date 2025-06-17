import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// No import for the logo—just reference it in the JSX!

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);

  // Verification state
  const [phoneSent, setPhoneSent] = useState(false);
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);

  // UX state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Validation helpers
  const isEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  const isPhone = (val: string) => /^\d{10,15}$/.test(val.replace(/[^\d]/g, ''));

  const canRegister =
    firstName.trim() &&
    lastName.trim() &&
    isPhone(phone) &&
    password.length >= 6 &&
    password === confirmPassword &&
    (!email || isEmail(email)) &&
    consent;

  // Registration Handler
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!canRegister) {
      setError('Please complete all required fields and check the consent box.');
      return;
    }

    setLoading(true);
    // JULES: Define request body
    const requestBody = {
      phone,
      password,
      first_name: firstName,
      last_name: lastName,
      email,
      consent,
    };
    // JULES: Log request details
    console.log('Registration Request:', {
      url: '/functions/v1/register',
      method: 'POST',
      body: requestBody,
    });
    try {
      // Send registration to your Edge Function (NOT directly to Supabase table)
      const response = await fetch('/functions/v1/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // JULES: Use defined requestBody
        body: JSON.stringify(requestBody),
      });
      // JULES: Log response status
      console.log('Registration Response Status:', response.status);

      // JULES: Check if response.ok is true
      if (response.ok) {
        let result;
        try {
          // JULES: Attempt to parse JSON
          result = await response.json();
          // JULES: Log parsed result
          console.log('Registration Response JSON:', result);
        } catch (parseError: any) {
          // JULES: Handle JSON parsing error
          console.error('JSON parsing error:', parseError);
          setError('Invalid response from server.');
          setLoading(false); // JULES: Ensure loading is set to false
          return; // JULES: Exit if parsing fails
        }
        // JULES: Check result.success
        if (!result.success) {
          // JULES: Prioritize result.error if available and user-friendly, otherwise a generic message.
          throw new Error(result.error || 'Registration attempt failed. Please check your information.');
        }
        // Simulate sending phone verification code (replace with your real logic!)
        setPhoneSent(true);
        // Optionally, send verification email in the background
        // (Do this in your backend for real, if needed)
      } else {
        // JULES: Handle non-ok responses (4xx or 5xx errors)
        // JULES: Check for 5xx server errors
        if (response.status >= 500) {
          console.error('Server error:', response.status, response.statusText); // JULES: Log details
          // JULES: Set user-friendly message for 5xx errors
          throw new Error('Something went wrong on our end. Please try again later.');
        }

        // JULES: For 4xx errors, try to get details from response body
        let errorDetails = '';
        try {
          const errorResult = await response.json();
          if (errorResult && errorResult.error) {
            errorDetails = errorResult.error; // JULES: Assumed to be user-friendly
          }
        } catch (jsonError) {
          // JULES: If JSON parsing fails, try to get text
          try {
            errorDetails = await response.text();
          } catch (textError) {
            // JULES: If text parsing also fails, log it but don't show raw text to user
            console.error('Failed to parse error response text:', textError);
          }
        }
        // JULES: Construct and throw error message for 4xx
        // JULES: Use errorDetails if available, otherwise a more generic message for 4xx
        const message = errorDetails 
          ? `Registration failed: ${errorDetails}` 
          : `Registration failed: ${response.status} ${response.statusText}. Please check your input.`;
        throw new Error(message);
      }
    } catch (err: any) {
      // JULES: Log the error
      console.error('Registration Error:', err);
      // JULES: Handle network error
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        // JULES: Updated network error message
        setError('Could not connect to the server. Please check your internet connection and try again.');
      } else {
        // JULES: Use err.message (which might be from the new Error thrown above) or a refined generic error
        // JULES: Updated generic fallback message
        setError(err.message || 'An unexpected error occurred during registration. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Phone Code Verification Handler (replace with your real backend logic!)
  const handleVerifyPhone = async () => {
    setError('');
    setLoading(true);
    try {
      // For production: send phone and code to an Edge Function that validates
      // Here, simulate a 6-digit code (for now use 123456 as the correct code)
      if (phoneCode === '123456') {
        setPhoneVerified(true);
        // Optionally update backend to mark as verified
      } else {
        setError('Invalid phone verification code.');
      }
    } catch (err: any) {
      setError(err.message || 'Error verifying code.');
    } finally {
      setLoading(false);
    }
  };

  // Proceed after verification
  useEffect(() => {
    if (phoneVerified) {
      // Save minimal info (never password) and go to next step
      localStorage.setItem('phone', phone);
      localStorage.setItem('firstName', firstName);
      localStorage.setItem('lastName', lastName);
      if (email) localStorage.setItem('email', email);
      navigate('/demographics');
    }
  }, [phoneVerified, phone, firstName, lastName, email, navigate]);

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-50 py-8">
      {/* WellFit Logo at the top, no import needed */}
      <img src="/android-chrome-512x512.png" alt="WellFit Logo" className="w-24 h-24 mb-4" />
      <form
        className="bg-white shadow-lg rounded-lg p-8 max-w-md w-full space-y-4"
        onSubmit={handleRegister}
        autoComplete="on"
      >
        <h1 className="text-2xl font-bold text-center text-[#003865] mb-2">WellFit Registration</h1>

        <label className="block text-sm font-medium text-gray-700">
          First Name
          <input
            type="text"
            className="mt-1 w-full border border-gray-300 rounded p-2"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            autoComplete="given-name"
            required
            disabled={phoneSent}
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Last Name
          <input
            type="text"
            className="mt-1 w-full border border-gray-300 rounded p-2"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            autoComplete="family-name"
            required
            disabled={phoneSent}
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Phone Number
          <input
            type="tel"
            className="mt-1 w-full border border-gray-300 rounded p-2"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            autoComplete="tel"
            placeholder="e.g. 7135551212"
            required
            disabled={phoneSent}
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Password (min 6 characters)
          <input
            type="password"
            className="mt-1 w-full border border-gray-300 rounded p-2"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={6}
            disabled={phoneSent}
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Confirm Password
          <input
            type="password"
            className="mt-1 w-full border border-gray-300 rounded p-2"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={6}
            disabled={phoneSent}
          />
          {password && confirmPassword && password !== confirmPassword && (
            <span className="text-xs text-red-500">Passwords do not match.</span>
          )}
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Email (optional)
          <input
            type="email"
            className="mt-1 w-full border border-gray-300 rounded p-2"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            disabled={phoneSent}
          />
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={consent}
            onChange={() => setConsent(!consent)}
            required
            disabled={phoneSent}
          />
          <span>
            I consent to receive text messages, emails, and other mediated options from WellFit Community.
          </span>
        </label>

        {/* Register button */}
        {!phoneSent && (
          <button
            type="submit"
            className="w-full py-2 bg-[#003865] text-white rounded hover:bg-[#8cc63f] transition"
            disabled={!canRegister || loading}
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        )}

        {/* Phone code input */}
        {phoneSent && !phoneVerified && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Enter SMS Code
              <input
                type="text"
                className="mt-1 w-full border border-gray-300 rounded p-2"
                value={phoneCode}
                onChange={e => setPhoneCode(e.target.value)}
                maxLength={6}
                autoComplete="one-time-code"
              />
            </label>
            <button
              type="button"
              className="w-full py-2 bg-[#003865] text-white rounded hover:bg-[#8cc63f] transition"
              onClick={handleVerifyPhone}
              disabled={loading || phoneVerified}
            >
              Verify Phone
            </button>
          </div>
        )}

        {error && <p className="text-red-600 mt-2">{error}</p>}
      </form>
    </div>
  );
};

export default RegisterPage;
