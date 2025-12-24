/**
 * CaregiverDashboardPage - Legacy authenticated caregiver dashboard
 *
 * This page is for registered caregivers (role_code 6) who have accounts.
 * It provides a streamlined flow using the new PIN-based session system.
 *
 * For unauthenticated caregiver access, use /caregiver-access instead.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useSupabaseClient } from '../contexts/AuthContext';
import { useBranding } from '../BrandingContext';
import { auditLogger } from '../services/auditLogger';

interface CaregiverProfile {
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
  role_code: number;
}

const SESSION_DURATION_MINUTES = 30;

const CaregiverDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const { branding } = useBranding();

  const [seniorPhone, setSeniorPhone] = useState('+1 ');
  const [seniorPin, setSeniorPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [caregiverProfile, setCaregiverProfile] = useState<CaregiverProfile | null>(null);
  const [verifying, setVerifying] = useState(true);

  // Load and verify caregiver profile
  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) {
        navigate('/login');
        return;
      }

      try {
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('first_name, last_name, phone, role, role_code')
          .eq('user_id', user.id)
          .single();

        if (profileError) {
          auditLogger.error('CAREGIVER_PROFILE_LOAD_ERROR', profileError);
          navigate('/login');
          return;
        }

        // Verify this is actually a caregiver
        if (data.role !== 'caregiver' && data.role_code !== 6) {
          auditLogger.warn('CAREGIVER_ACCESS_NON_CAREGIVER', {
            userId: user.id,
            role: data.role,
            roleCode: data.role_code
          });
          navigate('/dashboard');
          return;
        }

        setCaregiverProfile(data);
      } catch (err) {
        auditLogger.error('CAREGIVER_PROFILE_EXCEPTION', err instanceof Error ? err : new Error(String(err)));
        navigate('/login');
      } finally {
        setVerifying(false);
      }
    };

    loadProfile();
  }, [user?.id, supabase, navigate]);

  // Format phone number input
  const handlePhoneChange = useCallback((value: string) => {
    const digits = value.replace(/[^\d]/g, '');

    if (digits.length === 0) {
      setSeniorPhone('+1 ');
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

    setSeniorPhone(formatted);
  }, []);

  // Normalize phone to E.164
  const normalizePhone = (phone: string): string => {
    const digits = phone.replace(/[^\d]/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return `+${digits}`;
  };

  // Handle form submission
  const handleSeniorAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const normalizedSeniorPhone = normalizePhone(seniorPhone);
      const caregiverName = caregiverProfile
        ? `${caregiverProfile.first_name} ${caregiverProfile.last_name}`.trim()
        : 'Unknown Caregiver';
      const caregiverPhone = caregiverProfile?.phone || '';

      auditLogger.info('CAREGIVER_DASHBOARD_ACCESS_ATTEMPT', {
        caregiverId: user?.id,
        seniorPhoneLastFour: normalizedSeniorPhone.slice(-4)
      });

      // Step 1: Find senior by phone number
      const { data: seniorData, error: seniorError } = await supabase
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
        setError('Senior not found. Please check the phone number.');
        return;
      }

      // Step 2: Verify PIN
      const { data: pinData, error: pinError } = await supabase
        .from('caregiver_pins')
        .select('pin_hash')
        .eq('senior_user_id', seniorData.user_id)
        .maybeSingle();

      if (pinError || !pinData) {
        setError('This senior has not set up a caregiver PIN. Please ask them to set one in their Settings.');
        return;
      }

      // Step 3: Verify PIN using edge function
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('hash-pin', {
        body: {
          pin: seniorPin,
          action: 'verify',
          storedHash: pinData.pin_hash
        }
      });

      if (verifyError || !verifyData?.valid) {
        auditLogger.warn('CAREGIVER_PIN_INVALID', {
          caregiverId: user?.id,
          seniorId: seniorData.user_id
        });
        setError('Invalid PIN. Please try again.');
        return;
      }

      // Step 4: Create session using RPC
      const seniorFullName = `${seniorData.first_name} ${seniorData.last_name}`.trim();

      const { data: sessionData, error: sessionError } = await supabase.rpc('create_caregiver_session', {
        p_senior_id: seniorData.user_id,
        p_senior_name: seniorFullName,
        p_senior_phone: normalizedSeniorPhone,
        p_caregiver_name: caregiverName,
        p_caregiver_phone: caregiverPhone,
        p_session_duration_minutes: SESSION_DURATION_MINUTES
      });

      if (sessionError || !sessionData?.success) {
        auditLogger.error('CAREGIVER_SESSION_CREATE_ERROR', sessionError || new Error('Session creation failed'));
        setError('Unable to create session. Please try again.');
        return;
      }

      // Step 5: Store session and navigate
      const session = {
        sessionToken: sessionData.session_token,
        seniorId: seniorData.user_id,
        seniorName: seniorFullName,
        caregiverName: caregiverName,
        caregiverPhone: caregiverPhone,
        expiresAt: sessionData.expires_at
      };

      sessionStorage.setItem('caregiver_session', JSON.stringify(session));

      auditLogger.info('CAREGIVER_DASHBOARD_ACCESS_GRANTED', {
        caregiverId: user?.id,
        seniorId: seniorData.user_id,
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

  // Loading state
  if (verifying) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  // Not a caregiver - this shouldn't happen due to useEffect redirect
  if (!caregiverProfile) {
    return null;
  }

  return (
    <div className="min-h-screen" style={{ background: branding.gradient }}>
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: branding.primaryColor }}>
            Caregiver Access
          </h1>
          <p className="text-lg text-gray-700">
            Welcome, {caregiverProfile.first_name} {caregiverProfile.last_name}
          </p>
        </div>

        {/* PIN Entry Form */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="text-4xl mb-4">👨‍👩‍👧‍👦</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Senior Information</h2>
            <p className="text-gray-600">
              Enter the senior's phone number and PIN to view their health information
            </p>
          </div>

          <form onSubmit={handleSeniorAccess} className="space-y-6">
            <div>
              <label htmlFor="seniorPhone" className="block text-lg font-medium text-gray-700 mb-2">
                Senior's Phone Number
              </label>
              <input
                id="seniorPhone"
                type="tel"
                placeholder="+1 555-123-4567"
                value={seniorPhone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className="w-full p-4 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                required
              />
            </div>

            <div>
              <label htmlFor="seniorPin" className="block text-lg font-medium text-gray-700 mb-2">
                Senior's 4-Digit PIN
              </label>
              <input
                id="seniorPin"
                type="password"
                inputMode="numeric"
                placeholder="••••"
                maxLength={4}
                value={seniorPin}
                onChange={(e) => setSeniorPin(e.target.value.replace(/\D/g, ''))}
                className="w-full p-4 text-lg text-center tracking-widest border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-700 text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || seniorPhone.replace(/\D/g, '').length < 10 || seniorPin.length !== 4}
              className="w-full py-4 text-xl font-semibold bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Verifying...' : 'Access Senior Information'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-600 hover:text-gray-800 underline"
            >
              Back to My Dashboard
            </button>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="text-yellow-600 mr-3">⚠️</div>
            <div className="text-sm text-yellow-800">
              <strong>Security Notice:</strong> You are accessing sensitive health information.
              This access is logged for security and compliance purposes. Only access information
              necessary for providing care. Sessions expire after {SESSION_DURATION_MINUTES} minutes.
            </div>
          </div>
        </div>

        {/* Alternative Access */}
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600 mb-2">
            Not a registered caregiver? Family members can also access senior information:
          </p>
          <button
            onClick={() => navigate('/caregiver-access')}
            className="text-blue-600 hover:text-blue-800 underline text-sm"
          >
            Use Caregiver Access (no account needed)
          </button>
        </div>
      </div>
    </div>
  );
};

export default CaregiverDashboardPage;
