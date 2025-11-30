/**
 * CaregiverAccessPage - Public entry point for caregiver access
 *
 * This page allows caregivers to access senior health information using:
 * - Senior's phone number
 * - Senior's 4-digit PIN (shared by senior)
 * - Caregiver's name and phone (for audit logging)
 *
 * NO REGISTRATION REQUIRED - PIN is the authorization mechanism.
 * The senior controls access by sharing their PIN.
 *
 * HIPAA Compliance:
 * - All access is logged with caregiver identity
 * - 30-minute session timeout
 * - Senior can view access history in settings
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBranding } from '../BrandingContext';
import { auditLogger } from '../services/auditLogger';
import { createClient } from '@supabase/supabase-js';

// Create anonymous Supabase client for public access
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || '';
const anonSupabase = createClient(supabaseUrl, supabaseAnonKey);

// Session duration in minutes
const SESSION_DURATION_MINUTES = 30;

// Storage key for session
const SESSION_STORAGE_KEY = 'caregiver_session';

interface CaregiverSession {
  sessionToken: string;
  seniorId: string;
  seniorName: string;
  caregiverName: string;
  caregiverPhone: string;
  expiresAt: string;
}

const CaregiverAccessPage: React.FC = () => {
  const navigate = useNavigate();
  const { branding } = useBranding();

  // Form state
  const [seniorPhone, setSeniorPhone] = useState('+1 ');
  const [seniorPin, setSeniorPin] = useState('');
  const [caregiverName, setCaregiverName] = useState('');
  const [caregiverPhone, setCaregiverPhone] = useState('+1 ');

  // UI state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [existingSession, setExistingSession] = useState<CaregiverSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // Check for existing valid session on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (!stored) {
          setCheckingSession(false);
          return;
        }

        const session: CaregiverSession = JSON.parse(stored);

        // Check if session is expired
        if (new Date(session.expiresAt) < new Date()) {
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
          setCheckingSession(false);
          return;
        }

        // Validate session with backend
        const { data, error } = await anonSupabase.rpc('validate_caregiver_session', {
          p_session_token: session.sessionToken
        });

        if (error || !data?.valid) {
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
          setCheckingSession(false);
          return;
        }

        // Session is valid
        setExistingSession(session);
        setCheckingSession(false);
      } catch (err) {
        auditLogger.error('CAREGIVER_SESSION_CHECK_ERROR', err instanceof Error ? err : new Error(String(err)));
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        setCheckingSession(false);
      }
    };

    checkExistingSession();
  }, []);

  // Format phone number input
  const handlePhoneChange = useCallback((
    value: string,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const digits = value.replace(/[^\d]/g, '');

    if (digits.length === 0) {
      setter('+1 ');
      return;
    }

    const phoneDigits = digits.startsWith('1') && digits.length > 1 ? digits.slice(1) : digits;
    const limitedDigits = phoneDigits.slice(0, 10);

    let formatted = '+1 ';
    if (limitedDigits.length > 0) {
      formatted += limitedDigits.slice(0, 3);
    }
    if (limitedDigits.length > 3) {
      formatted += '-' + limitedDigits.slice(3, 6);
    }
    if (limitedDigits.length > 6) {
      formatted += '-' + limitedDigits.slice(6, 10);
    }

    setter(formatted);
  }, []);

  // Normalize phone to E.164 format
  const normalizePhone = (phone: string): string => {
    const digits = phone.replace(/[^\d]/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return `+${digits}`;
  };

  // Validate form
  const validateForm = (): string | null => {
    const seniorDigits = seniorPhone.replace(/[^\d]/g, '');
    if (seniorDigits.length < 10) {
      return 'Please enter the senior\'s full phone number';
    }

    if (seniorPin.length !== 4) {
      return 'Please enter the 4-digit PIN';
    }

    if (!caregiverName.trim() || caregiverName.trim().length < 2) {
      return 'Please enter your full name';
    }

    const caregiverDigits = caregiverPhone.replace(/[^\d]/g, '');
    if (caregiverDigits.length < 10) {
      return 'Please enter your phone number';
    }

    return null;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const normalizedSeniorPhone = normalizePhone(seniorPhone);
      const normalizedCaregiverPhone = normalizePhone(caregiverPhone);

      auditLogger.info('CAREGIVER_ACCESS_ATTEMPT', {
        seniorPhone: normalizedSeniorPhone.slice(-4), // Only log last 4 digits
        caregiverName: caregiverName.trim()
      });

      // Step 1: Find senior by phone number
      const { data: seniorData, error: seniorError } = await anonSupabase
        .from('profiles')
        .select('user_id, first_name, last_name, phone, role')
        .eq('phone', normalizedSeniorPhone)
        .eq('role', 'senior')
        .maybeSingle();

      if (seniorError) {
        auditLogger.error('CAREGIVER_SENIOR_LOOKUP_ERROR', seniorError);
        setError('Unable to verify senior. Please try again.');
        return;
      }

      if (!seniorData) {
        auditLogger.warn('CAREGIVER_SENIOR_NOT_FOUND', {
          phoneLastFour: normalizedSeniorPhone.slice(-4)
        });
        setError('Senior not found. Please check the phone number.');
        return;
      }

      // Step 2: Verify PIN
      const { data: pinData, error: pinError } = await anonSupabase
        .from('caregiver_pins')
        .select('pin_hash')
        .eq('senior_user_id', seniorData.user_id)
        .maybeSingle();

      if (pinError || !pinData) {
        auditLogger.warn('CAREGIVER_PIN_NOT_SET', {
          seniorId: seniorData.user_id
        });
        setError('This senior has not set up a caregiver PIN. Please ask them to set one in their Settings.');
        return;
      }

      // Step 3: Verify PIN using edge function
      const { data: verifyData, error: verifyError } = await anonSupabase.functions.invoke('hash-pin', {
        body: {
          pin: seniorPin,
          action: 'verify',
          storedHash: pinData.pin_hash
        }
      });

      if (verifyError || !verifyData?.valid) {
        auditLogger.warn('CAREGIVER_PIN_INVALID', {
          seniorId: seniorData.user_id,
          caregiverName: caregiverName.trim()
        });
        setError('Invalid PIN. Please try again.');
        return;
      }

      // Step 4: Create session
      const seniorFullName = `${seniorData.first_name} ${seniorData.last_name}`.trim();

      const { data: sessionData, error: sessionError } = await anonSupabase.rpc('create_caregiver_session', {
        p_senior_id: seniorData.user_id,
        p_senior_name: seniorFullName,
        p_senior_phone: normalizedSeniorPhone,
        p_caregiver_name: caregiverName.trim(),
        p_caregiver_phone: normalizedCaregiverPhone,
        p_session_duration_minutes: SESSION_DURATION_MINUTES
      });

      if (sessionError || !sessionData?.success) {
        auditLogger.error('CAREGIVER_SESSION_CREATE_ERROR', sessionError || new Error('Session creation failed'));
        setError('Unable to create session. Please try again.');
        return;
      }

      // Step 5: Store session and navigate
      const session: CaregiverSession = {
        sessionToken: sessionData.session_token,
        seniorId: seniorData.user_id,
        seniorName: seniorFullName,
        caregiverName: caregiverName.trim(),
        caregiverPhone: normalizedCaregiverPhone,
        expiresAt: sessionData.expires_at
      };

      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

      auditLogger.info('CAREGIVER_ACCESS_GRANTED', {
        seniorId: seniorData.user_id,
        caregiverName: caregiverName.trim(),
        expiresAt: sessionData.expires_at
      });

      // Navigate to senior view
      navigate(`/senior-view/${seniorData.user_id}`);

    } catch (err) {
      auditLogger.error('CAREGIVER_ACCESS_ERROR', err instanceof Error ? err : new Error(String(err)));
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle continuing existing session
  const handleContinueSession = () => {
    if (existingSession) {
      navigate(`/senior-view/${existingSession.seniorId}`);
    }
  };

  // Handle ending existing session
  const handleEndSession = async () => {
    if (!existingSession) return;

    try {
      await anonSupabase.rpc('end_caregiver_session', {
        p_session_token: existingSession.sessionToken
      });

      auditLogger.info('CAREGIVER_SESSION_ENDED', {
        caregiverName: existingSession.caregiverName
      });
    } catch (err) {
      auditLogger.error('CAREGIVER_SESSION_END_ERROR', err instanceof Error ? err : new Error(String(err)));
    }

    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setExistingSession(null);
  };

  // Loading state while checking session
  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: branding.gradient }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: branding.gradient }}>
      <div className="container mx-auto px-4 py-8 max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">👨‍👩‍👧‍👦</div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Caregiver Access
          </h1>
          <p className="text-white/90 text-lg">
            View your loved one's health information
          </p>
        </div>

        {/* Existing Session Card */}
        {existingSession && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="text-center mb-4">
              <div className="text-3xl mb-2">✅</div>
              <h2 className="text-xl font-bold text-gray-800">Active Session</h2>
              <p className="text-gray-600">
                You have an active session for {existingSession.seniorName}
              </p>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800">
                <strong>Session expires:</strong>{' '}
                {new Date(existingSession.expiresAt).toLocaleTimeString()}
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleContinueSession}
                className="w-full py-3 text-lg font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Continue Viewing
              </button>
              <button
                onClick={handleEndSession}
                className="w-full py-3 text-lg font-semibold bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                End Session & Start New
              </button>
            </div>
          </div>
        )}

        {/* Access Form */}
        {!existingSession && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Senior's Information Section */}
              <div className="border-b pb-4 mb-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Senior's Information
                </h3>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="seniorPhone" className="block text-sm font-medium text-gray-700 mb-1">
                      Senior's Phone Number
                    </label>
                    <input
                      id="seniorPhone"
                      type="tel"
                      value={seniorPhone}
                      onChange={(e) => handlePhoneChange(e.target.value, setSeniorPhone)}
                      className="w-full p-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="+1 555-123-4567"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="seniorPin" className="block text-sm font-medium text-gray-700 mb-1">
                      4-Digit PIN
                    </label>
                    <input
                      id="seniorPin"
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={seniorPin}
                      onChange={(e) => setSeniorPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full p-3 text-lg text-center tracking-widest border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="••••"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      The PIN should have been shared with you by the senior
                    </p>
                  </div>
                </div>
              </div>

              {/* Caregiver's Information Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Your Information (for logging)
                </h3>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="caregiverName" className="block text-sm font-medium text-gray-700 mb-1">
                      Your Full Name
                    </label>
                    <input
                      id="caregiverName"
                      type="text"
                      value={caregiverName}
                      onChange={(e) => setCaregiverName(e.target.value)}
                      className="w-full p-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Jane Doe"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="caregiverPhone" className="block text-sm font-medium text-gray-700 mb-1">
                      Your Phone Number
                    </label>
                    <input
                      id="caregiverPhone"
                      type="tel"
                      value={caregiverPhone}
                      onChange={(e) => handlePhoneChange(e.target.value, setCaregiverPhone)}
                      className="w-full p-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="+1 555-987-6543"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Security Notice */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <span className="text-yellow-600 mr-2">⚠️</span>
                  <div className="text-sm text-yellow-800">
                    <strong>Security Notice:</strong> Your access will be logged for security
                    and compliance purposes. The senior can see who viewed their information.
                  </div>
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-700 text-center">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 text-xl font-semibold bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <span className="animate-spin mr-2">⏳</span>
                    Verifying...
                  </span>
                ) : (
                  'Access Senior\'s Information'
                )}
              </button>
            </form>

            {/* Back to Login */}
            <div className="mt-6 text-center">
              <button
                onClick={() => navigate('/login')}
                className="text-gray-600 hover:text-gray-800 underline"
              >
                Back to Login
              </button>
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-8 bg-white/10 rounded-xl p-6 text-white">
          <h3 className="font-semibold mb-3">How Caregiver Access Works</h3>
          <ul className="space-y-2 text-sm text-white/90">
            <li className="flex items-start">
              <span className="mr-2">1.</span>
              <span>The senior shares their 4-digit PIN with trusted caregivers</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">2.</span>
              <span>You enter the senior's phone and PIN to access their health information</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">3.</span>
              <span>Your access is logged and visible to the senior</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">4.</span>
              <span>Sessions automatically expire after {SESSION_DURATION_MINUTES} minutes</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CaregiverAccessPage;
