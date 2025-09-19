// Caregiver Dashboard with Senior PIN Entry
// Allows caregivers to access senior information by entering the senior's PIN

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useSupabaseClient } from '../contexts/AuthContext';
import { useBranding } from '../BrandingContext';

interface SeniorProfile {
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  dob?: string;
  role_code: number;
}

const CaregiverDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const { branding } = useBranding();

  const [seniorPhone, setSeniorPhone] = useState('');
  const [seniorPin, setSeniorPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentSenior, setCurrentSenior] = useState<SeniorProfile | null>(null);
  const [caregiverProfile, setCaregiverProfile] = useState<any>(null);

  // Load caregiver profile
  useEffect(() => {
    (async () => {
      if (!user?.id) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;

        // Verify this is actually a caregiver
        if (data.role !== 'caregiver' && data.role_code !== 6) {
          navigate('/dashboard');
          return;
        }

        setCaregiverProfile(data);
      } catch (e) {
        console.error('Error loading caregiver profile:', e);
        navigate('/login');
      }
    })();
  }, [user?.id, supabase, navigate]);

  const handleSeniorAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Normalize phone number
      const cleanPhone = seniorPhone.replace(/\D/g, '');
      const e164Phone = cleanPhone.length === 10 ? `+1${cleanPhone}` : `+${cleanPhone}`;

      // Find senior by phone number
      const { data: seniorData, error: seniorError } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone', e164Phone)
        .eq('role', 'senior')
        .single();

      if (seniorError || !seniorData) {
        setError('Senior not found. Please check the phone number.');
        return;
      }

      // Validate PIN against senior's stored PIN
      const { data: authData, error: authError } = await supabase
        .from('phone_auth')
        .select('pin')
        .eq('user_id', seniorData.user_id)
        .single();

      if (authError || !authData) {
        setError('Senior PIN not set up. Please contact support.');
        return;
      }

      // Check PIN (Note: In production, this should be hashed comparison)
      if (authData.pin !== seniorPin) {
        setError('Invalid PIN. Please try again.');
        return;
      }

      // Success - store senior info and show dashboard
      setCurrentSenior(seniorData);
      setError('');

      // Log the access for audit purposes
      await supabase.from('caregiver_access_log').insert({
        caregiver_id: user?.id,
        senior_id: seniorData.user_id,
        access_time: new Date().toISOString(),
        caregiver_name: `${caregiverProfile?.first_name} ${caregiverProfile?.last_name}`,
        senior_name: `${seniorData.first_name} ${seniorData.last_name}`
      }).catch(() => {}); // Best effort logging

    } catch (e: any) {
      setError(e?.message || 'Access failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentSenior(null);
    setSeniorPhone('');
    setSeniorPin('');
  };

  const viewSeniorDashboard = () => {
    if (currentSenior) {
      // Navigate to senior's dashboard view
      navigate(`/senior-view/${currentSenior.user_id}`);
    }
  };

  if (!caregiverProfile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
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

        {!currentSenior ? (
          /* PIN Entry Form */
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="text-center mb-6">
              <div className="text-4xl mb-4">👩‍⚕️</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Senior Information</h2>
              <p className="text-gray-600">Enter the senior's phone number and PIN to view their health information</p>
            </div>

            <form onSubmit={handleSeniorAccess} className="space-y-6">
              <div>
                <label htmlFor="seniorPhone" className="block text-lg font-medium text-gray-700 mb-2">
                  Senior's Phone Number
                </label>
                <input
                  id="seniorPhone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={seniorPhone}
                  onChange={(e) => setSeniorPhone(e.target.value)}
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
                  placeholder="••••"
                  maxLength={4}
                  value={seniorPin}
                  onChange={(e) => setSeniorPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full p-4 text-lg text-center border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
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
                disabled={loading || !seniorPhone || seniorPin.length !== 4}
                className="w-full py-4 text-xl font-semibold bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
        ) : (
          /* Senior Access Granted */
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="text-center mb-6">
              <div className="text-4xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-green-800 mb-2">Access Granted</h2>
              <p className="text-gray-700">
                You now have access to {currentSenior.first_name} {currentSenior.last_name}'s health information
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-green-800 mb-2">Senior Information:</h3>
              <p><strong>Name:</strong> {currentSenior.first_name} {currentSenior.last_name}</p>
              <p><strong>Phone:</strong> {currentSenior.phone}</p>
              {currentSenior.email && <p><strong>Email:</strong> {currentSenior.email}</p>}
              {currentSenior.dob && <p><strong>Date of Birth:</strong> {currentSenior.dob}</p>}
            </div>

            <div className="space-y-4">
              <button
                onClick={viewSeniorDashboard}
                className="w-full py-4 text-xl font-semibold bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                📊 View Health Dashboard
              </button>

              <button
                onClick={() => navigate(`/senior-reports/${currentSenior.user_id}`)}
                className="w-full py-4 text-xl font-semibold bg-purple-600 text-white rounded-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
              >
                📋 View Health Reports
              </button>

              <button
                onClick={handleLogout}
                className="w-full py-4 text-xl font-semibold bg-gray-600 text-white rounded-lg shadow-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
              >
                🔒 End Session
              </button>
            </div>
          </div>
        )}

        {/* Security Notice */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="text-yellow-600 mr-3">⚠️</div>
            <div className="text-sm text-yellow-800">
              <strong>Security Notice:</strong> You are accessing sensitive health information.
              This access is logged for security and compliance purposes. Only access information
              necessary for providing care.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CaregiverDashboardPage;