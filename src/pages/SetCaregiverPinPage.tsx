// src/pages/SetCaregiverPinPage.tsx
// Allows seniors to set a 4-digit PIN for caregiver access
// This PIN is separate from their login password and is used ONLY for caregiver access

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useSupabaseClient } from '../contexts/AuthContext';
import { useBranding } from '../BrandingContext';

const SetCaregiverPinPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const { branding } = useBranding();

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [existingPin, setExistingPin] = useState(false);
  const [skipAllowed, setSkipAllowed] = useState(false);
  const [userRole, setUserRole] = useState('');

  // Check if user already has a PIN set
  useEffect(() => {
    (async () => {
      if (!user?.id) return;

      try {
        // Get user profile to check role
        const { data: profileData } = await supabase
          .from('profiles')
          .select('role, role_code')
          .eq('user_id', user.id)
          .single();

        if (profileData) {
          setUserRole(profileData.role || '');

          // Only seniors need caregiver PINs
          const isSenior = profileData.role === 'senior' || profileData.role_code === 4;
          setSkipAllowed(!isSenior); // Allow skip for non-seniors
        }

        // Check if PIN already exists
        const { data, error } = await supabase
          .from('caregiver_pins')
          .select('senior_user_id')
          .eq('senior_user_id', user.id)
          .maybeSingle();

        if (!error && data) {
          setExistingPin(true);
        }
      } catch (e) {
        console.error('Error checking PIN status:', e);
      }
    })();
  }, [user?.id, supabase]);

  const handlePinChange = (value: string) => {
    // Only allow digits
    const digits = value.replace(/\D/g, '').slice(0, 4);
    setPin(digits);
  };

  const handleConfirmPinChange = (value: string) => {
    // Only allow digits
    const digits = value.replace(/\D/g, '').slice(0, 4);
    setConfirmPin(digits);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (pin.length !== 4) {
      setError('PIN must be exactly 4 digits');
      return;
    }

    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    // Weak PIN check
    if (pin === '0000' || pin === '1234' || pin === '1111' || pin === '2222' || pin === '3333' || pin === '4444' || pin === '5555' || pin === '6666' || pin === '7777' || pin === '8888' || pin === '9999') {
      setError('Please choose a more secure PIN (avoid 0000, 1234, etc.)');
      return;
    }

    setLoading(true);

    try {
      // Hash the PIN using PBKDF2 via edge function
      const { data: hashData, error: hashError } = await supabase.functions.invoke('hash-pin', {
        body: { pin }
      });

      if (hashError) throw hashError;

      const pinHash = hashData?.hashed;
      if (!pinHash) throw new Error('Failed to hash PIN');

      // Store the hashed PIN
      if (existingPin) {
        // Update existing PIN
        const { error: updateError } = await supabase
          .from('caregiver_pins')
          .update({
            pin_hash: pinHash,
            updated_at: new Date().toISOString(),
            updated_by: user?.id
          })
          .eq('senior_user_id', user?.id);

        if (updateError) throw updateError;
      } else {
        // Insert new PIN
        const { error: insertError } = await supabase
          .from('caregiver_pins')
          .insert({
            senior_user_id: user?.id,
            pin_hash: pinHash,
            updated_at: new Date().toISOString(),
            updated_by: user?.id
          });

        if (insertError) throw insertError;
      }

      // Success! Continue to next step in onboarding
      navigate('/dashboard');
    } catch (e: any) {
      console.error('Error setting PIN:', e);
      setError(e?.message || 'Failed to set PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    if (skipAllowed) {
      navigate('/dashboard');
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: branding.gradient }}
    >
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-4">🔐</div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: branding.primaryColor }}>
            {existingPin ? 'Update' : 'Set'} Caregiver PIN
          </h1>
          <p className="text-gray-600">
            {existingPin
              ? 'Update your 4-digit PIN that caregivers will use to access your health information'
              : 'Create a 4-digit PIN that caregivers can use to access your health information'
            }
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <div className="text-blue-600 text-xl mr-3">ℹ️</div>
            <div className="text-sm text-blue-800">
              <strong>What is this PIN for?</strong>
              <p className="mt-1">
                This PIN is different from your password. Your caregivers will use your phone number
                and this PIN to view your health information and help coordinate your care.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="pin" className="block text-lg font-medium text-gray-700 mb-2">
              Enter 4-Digit PIN
            </label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              placeholder="••••"
              maxLength={4}
              value={pin}
              onChange={(e) => handlePinChange(e.target.value)}
              className="w-full p-4 text-2xl text-center border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 tracking-widest"
              required
              autoComplete="off"
            />
            <p className="text-sm text-gray-500 mt-1 text-center">
              {pin.length}/4 digits
            </p>
          </div>

          <div>
            <label htmlFor="confirmPin" className="block text-lg font-medium text-gray-700 mb-2">
              Confirm PIN
            </label>
            <input
              id="confirmPin"
              type="password"
              inputMode="numeric"
              placeholder="••••"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => handleConfirmPinChange(e.target.value)}
              className="w-full p-4 text-2xl text-center border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 tracking-widest"
              required
              autoComplete="off"
            />
            <p className="text-sm text-gray-500 mt-1 text-center">
              {confirmPin.length}/4 digits
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700 text-center">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || pin.length !== 4 || confirmPin.length !== 4}
            className="w-full py-4 text-xl font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{
              backgroundColor: branding.primaryColor,
              color: 'white',
            }}
          >
            {loading ? 'Setting PIN...' : existingPin ? 'Update PIN' : 'Set PIN & Continue'}
          </button>

          {skipAllowed && (
            <button
              type="button"
              onClick={handleSkip}
              className="w-full py-3 text-lg text-gray-600 hover:text-gray-800 underline"
            >
              Skip for now
            </button>
          )}
        </form>

        {/* Security Notice */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="text-yellow-600 mr-3">⚠️</div>
            <div className="text-sm text-yellow-800">
              <strong>Keep your PIN secure:</strong>
              <ul className="list-disc ml-4 mt-1">
                <li>Don't use obvious numbers like 0000 or 1234</li>
                <li>Only share this PIN with trusted caregivers</li>
                <li>You can update this PIN anytime from Settings</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetCaregiverPinPage;
