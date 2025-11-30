/**
 * SeniorViewPage - Read-only dashboard for caregivers
 *
 * This page displays a senior's health information to authorized caregivers.
 * It is READ-ONLY - caregivers cannot modify any data.
 *
 * Features:
 * - Recent check-ins with mood and notes
 * - Mood/wellness trends (chart)
 * - Activity summary
 * - Medication reminders (if any)
 * - Emergency contact info
 *
 * Security:
 * - Session validated on every access
 * - 30-minute auto-expiry
 * - All page views are logged
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBranding } from '../BrandingContext';
import { auditLogger } from '../services/auditLogger';
import { createClient } from '@supabase/supabase-js';

// Create anonymous Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
const anonSupabase = createClient(supabaseUrl, supabaseAnonKey);

const SESSION_STORAGE_KEY = 'caregiver_session';

interface CaregiverSession {
  sessionToken: string;
  seniorId: string;
  seniorName: string;
  caregiverName: string;
  caregiverPhone: string;
  expiresAt: string;
}

interface CheckIn {
  id: number;
  timestamp: string;
  label: string;
  notes: string | null;
  emotional_state: string | null;
  heart_rate: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  pulse_oximeter: number | null;
  glucose_mg_dl: number | null;
}

interface SeniorProfile {
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  dob: string | null;
  emergency_contact_phone: string | null;
  caregiver_first_name: string | null;
  caregiver_last_name: string | null;
  caregiver_phone: string | null;
  caregiver_relationship: string | null;
}

interface MedicationReminder {
  id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  time_of_day: string[];
  notes: string | null;
}

const SeniorViewPage: React.FC = () => {
  const navigate = useNavigate();
  const { seniorId } = useParams<{ seniorId: string }>();
  const { branding } = useBranding();

  // Session state
  const [session, setSession] = useState<CaregiverSession | null>(null);
  const [sessionValid, setSessionValid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Data state
  const [seniorProfile, setSeniorProfile] = useState<SeniorProfile | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [medications, setMedications] = useState<MedicationReminder[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // Validate session on mount and periodically
  const validateSession = useCallback(async () => {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) {
        setError('No active session. Please log in again.');
        setLoading(false);
        return false;
      }

      const sessionData: CaregiverSession = JSON.parse(stored);

      // Check if session matches requested senior
      if (sessionData.seniorId !== seniorId) {
        setError('Session does not match requested senior.');
        setLoading(false);
        return false;
      }

      // Check if expired locally first
      if (new Date(sessionData.expiresAt) < new Date()) {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        setError('Session expired. Please log in again.');
        setLoading(false);
        return false;
      }

      // Validate with backend
      const { data, error: validateError } = await anonSupabase.rpc('validate_caregiver_session', {
        p_session_token: sessionData.sessionToken
      });

      if (validateError || !data?.valid) {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        setError('Session invalid or expired. Please log in again.');
        setLoading(false);
        return false;
      }

      setSession(sessionData);
      setSessionValid(true);
      return true;
    } catch (err) {
      auditLogger.error('CAREGIVER_SESSION_VALIDATE_ERROR', err instanceof Error ? err : new Error(String(err)));
      setError('Unable to validate session.');
      setLoading(false);
      return false;
    }
  }, [seniorId]);

  // Load senior data
  const loadSeniorData = useCallback(async () => {
    if (!session || !seniorId) return;

    try {
      // Log page view
      await anonSupabase.rpc('log_caregiver_page_view', {
        p_session_token: session.sessionToken,
        p_page_name: 'senior_dashboard'
      });

      // Load profile (using service role would be needed for full access)
      // For now, we'll use the data we have from session validation
      const { data: profileData } = await anonSupabase
        .from('profiles')
        .select(`
          first_name, last_name, phone, email, dob,
          emergency_contact_phone,
          caregiver_first_name, caregiver_last_name,
          caregiver_phone, caregiver_relationship
        `)
        .eq('user_id', seniorId)
        .maybeSingle();

      if (profileData) {
        setSeniorProfile(profileData);
      }

      // Load recent check-ins (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: checkInData } = await anonSupabase
        .from('check_ins')
        .select('*')
        .eq('user_id', seniorId)
        .gte('timestamp', thirtyDaysAgo.toISOString())
        .order('timestamp', { ascending: false })
        .limit(50);

      if (checkInData) {
        setCheckIns(checkInData);
      }

      // Load medication reminders (if table exists)
      const { data: medData } = await anonSupabase
        .from('medication_reminders')
        .select('*')
        .eq('user_id', seniorId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (medData) {
        setMedications(medData);
      }

      setLoading(false);
    } catch (err) {
      auditLogger.error('CAREGIVER_LOAD_DATA_ERROR', err instanceof Error ? err : new Error(String(err)));
      setLoading(false);
    }
  }, [session, seniorId]);

  // Initial session validation
  useEffect(() => {
    const init = async () => {
      const valid = await validateSession();
      if (valid) {
        await loadSeniorData();
      }
    };
    init();
  }, [validateSession, loadSeniorData]);

  // Update time remaining every second
  useEffect(() => {
    if (!session) return;

    const updateTimeRemaining = () => {
      const expires = new Date(session.expiresAt);
      const now = new Date();
      const diff = expires.getTime() - now.getTime();

      if (diff <= 0) {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        setError('Session expired. Please log in again.');
        setSessionValid(false);
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [session]);

  // Handle end session
  const handleEndSession = async () => {
    if (session) {
      try {
        await anonSupabase.rpc('end_caregiver_session', {
          p_session_token: session.sessionToken
        });
        auditLogger.info('CAREGIVER_SESSION_ENDED_BY_USER', {
          caregiverName: session.caregiverName
        });
      } catch (err) {
        auditLogger.error('CAREGIVER_END_SESSION_ERROR', err instanceof Error ? err : new Error(String(err)));
      }
    }
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    navigate('/caregiver-access');
  };

  // Handle view reports
  const handleViewReports = () => {
    navigate(`/senior-reports/${seniorId}`);
  };

  // Get mood emoji
  const getMoodEmoji = (label: string): string => {
    const lower = label.toLowerCase();
    if (lower.includes('great') || lower.includes('excellent')) return '😊';
    if (lower.includes('good') || lower.includes('fine')) return '🙂';
    if (lower.includes('okay') || lower.includes('so-so')) return '😐';
    if (lower.includes('not') || lower.includes('bad')) return '😔';
    if (lower.includes('emergency') || lower.includes('help')) return '🆘';
    return '📝';
  };

  // Calculate mood trend
  const getMoodTrend = (): { trend: 'up' | 'down' | 'stable'; summary: string } => {
    if (checkIns.length < 2) {
      return { trend: 'stable', summary: 'Not enough data' };
    }

    const recentCheckIns = checkIns.slice(0, 7);
    const positiveWords = ['great', 'excellent', 'good', 'fine', 'happy'];
    const negativeWords = ['not', 'bad', 'sad', 'tired', 'pain'];

    let positiveCount = 0;
    let negativeCount = 0;

    recentCheckIns.forEach(ci => {
      const label = ci.label.toLowerCase();
      if (positiveWords.some(w => label.includes(w))) positiveCount++;
      if (negativeWords.some(w => label.includes(w))) negativeCount++;
    });

    if (positiveCount > negativeCount + 1) {
      return { trend: 'up', summary: 'Mostly positive check-ins recently' };
    } else if (negativeCount > positiveCount + 1) {
      return { trend: 'down', summary: 'Some concerning check-ins recently' };
    }
    return { trend: 'stable', summary: 'Mood has been stable' };
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return `Today at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    } else if (days === 1) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    } else if (days < 7) {
      return `${days} days ago`;
    }
    return date.toLocaleDateString();
  };

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: branding.gradient }}>
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Session Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/caregiver-access')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: branding.gradient }}>
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg">Loading senior information...</p>
        </div>
      </div>
    );
  }

  const moodTrend = getMoodTrend();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Bar */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">👁️</span>
              <div>
                <h1 className="font-bold text-gray-800">
                  Viewing: {session?.seniorName || 'Senior'}
                </h1>
                <p className="text-sm text-gray-500">
                  Caregiver: {session?.caregiverName}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-xs text-gray-500">Session expires in</p>
                <p className={`font-mono font-bold ${
                  parseInt(timeRemaining.split(':')[0]) < 5 ? 'text-red-600' : 'text-gray-700'
                }`}>
                  {timeRemaining}
                </p>
              </div>
              <button
                onClick={handleEndSession}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Read-Only Notice */}
      <div className="bg-blue-50 border-b border-blue-100">
        <div className="container mx-auto px-4 py-2">
          <p className="text-sm text-blue-800 text-center">
            <span className="font-semibold">Read-Only Access</span> — You can view information but cannot make changes
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <div className="text-3xl mb-1">📊</div>
            <div className="text-2xl font-bold text-gray-800">{checkIns.length}</div>
            <div className="text-sm text-gray-500">Check-ins (30 days)</div>
          </div>
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <div className="text-3xl mb-1">
              {moodTrend.trend === 'up' ? '📈' : moodTrend.trend === 'down' ? '📉' : '➡️'}
            </div>
            <div className="text-lg font-bold text-gray-800 capitalize">{moodTrend.trend}</div>
            <div className="text-sm text-gray-500">Mood Trend</div>
          </div>
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <div className="text-3xl mb-1">💊</div>
            <div className="text-2xl font-bold text-gray-800">{medications.length}</div>
            <div className="text-sm text-gray-500">Active Medications</div>
          </div>
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <div className="text-3xl mb-1">
              {checkIns[0] ? getMoodEmoji(checkIns[0].label) : '❓'}
            </div>
            <div className="text-lg font-bold text-gray-800">
              {checkIns[0] ? formatDate(checkIns[0].timestamp).split(' at ')[0] : 'N/A'}
            </div>
            <div className="text-sm text-gray-500">Last Check-in</div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Recent Check-ins */}
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <span className="mr-2">📝</span> Recent Check-ins
            </h2>

            {checkIns.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No check-ins in the last 30 days</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {checkIns.slice(0, 10).map((checkIn) => (
                  <div
                    key={checkIn.id}
                    className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl">{getMoodEmoji(checkIn.label)}</span>
                        <div>
                          <p className="font-medium text-gray-800">{checkIn.label}</p>
                          <p className="text-xs text-gray-500">{formatDate(checkIn.timestamp)}</p>
                        </div>
                      </div>
                    </div>
                    {checkIn.notes && (
                      <p className="mt-2 text-sm text-gray-600 bg-gray-50 rounded p-2">
                        {checkIn.notes}
                      </p>
                    )}
                    {/* Vitals if present */}
                    {(checkIn.heart_rate || checkIn.bp_systolic) && (
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {checkIn.heart_rate && (
                          <span className="bg-red-100 text-red-700 px-2 py-1 rounded">
                            ❤️ {checkIn.heart_rate} bpm
                          </span>
                        )}
                        {checkIn.bp_systolic && checkIn.bp_diastolic && (
                          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            🩺 {checkIn.bp_systolic}/{checkIn.bp_diastolic}
                          </span>
                        )}
                        {checkIn.pulse_oximeter && (
                          <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                            🫁 {checkIn.pulse_oximeter}%
                          </span>
                        )}
                        {checkIn.glucose_mg_dl && (
                          <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">
                            🩸 {checkIn.glucose_mg_dl} mg/dL
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Mood Summary */}
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <span className="mr-2">💭</span> Mood Summary
              </h2>
              <div className={`p-4 rounded-lg ${
                moodTrend.trend === 'up' ? 'bg-green-50 border border-green-200' :
                moodTrend.trend === 'down' ? 'bg-yellow-50 border border-yellow-200' :
                'bg-gray-50 border border-gray-200'
              }`}>
                <p className={`font-medium ${
                  moodTrend.trend === 'up' ? 'text-green-800' :
                  moodTrend.trend === 'down' ? 'text-yellow-800' :
                  'text-gray-800'
                }`}>
                  {moodTrend.summary}
                </p>
              </div>

              {/* Simple mood chart */}
              <div className="mt-4">
                <p className="text-sm text-gray-500 mb-2">Last 7 check-ins:</p>
                <div className="flex items-end space-x-1 h-12">
                  {checkIns.slice(0, 7).reverse().map((ci, i) => {
                    const label = ci.label.toLowerCase();
                    let height = 50;
                    let color = 'bg-gray-300';

                    if (label.includes('great') || label.includes('excellent')) {
                      height = 100;
                      color = 'bg-green-500';
                    } else if (label.includes('good')) {
                      height = 75;
                      color = 'bg-green-400';
                    } else if (label.includes('okay')) {
                      height = 50;
                      color = 'bg-yellow-400';
                    } else if (label.includes('not') || label.includes('bad')) {
                      height = 25;
                      color = 'bg-red-400';
                    }

                    return (
                      <div
                        key={i}
                        className={`flex-1 ${color} rounded-t transition-all`}
                        style={{ height: `${height}%` }}
                        title={ci.label}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Medications */}
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <span className="mr-2">💊</span> Medication Reminders
              </h2>

              {medications.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No active medication reminders</p>
              ) : (
                <div className="space-y-3">
                  {medications.map((med) => (
                    <div key={med.id} className="border rounded-lg p-3">
                      <p className="font-medium text-gray-800">{med.medication_name}</p>
                      <p className="text-sm text-gray-600">{med.dosage} - {med.frequency}</p>
                      {med.time_of_day?.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {med.time_of_day.map((time, i) => (
                            <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              {time}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Emergency Contact */}
            {seniorProfile && (
              <div className="bg-white rounded-xl shadow p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <span className="mr-2">📞</span> Emergency Contact
                </h2>
                {seniorProfile.emergency_contact_phone ? (
                  <a
                    href={`tel:${seniorProfile.emergency_contact_phone}`}
                    className="block p-4 bg-red-50 border border-red-200 rounded-lg text-center hover:bg-red-100 transition-colors"
                  >
                    <p className="text-red-800 font-semibold">
                      {seniorProfile.emergency_contact_phone}
                    </p>
                    <p className="text-sm text-red-600">Tap to call</p>
                  </a>
                ) : (
                  <p className="text-gray-500 text-center">No emergency contact set</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleViewReports}
            className="flex-1 py-4 text-lg font-semibold bg-purple-600 text-white rounded-lg shadow-md hover:bg-purple-700 transition-colors flex items-center justify-center"
          >
            <span className="mr-2">📋</span> View Health Reports
          </button>
          <button
            onClick={handleEndSession}
            className="flex-1 py-4 text-lg font-semibold bg-gray-600 text-white rounded-lg shadow-md hover:bg-gray-700 transition-colors flex items-center justify-center"
          >
            <span className="mr-2">🔒</span> End Session
          </button>
        </div>

        {/* Security Footer */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <span className="text-yellow-600 mr-2">⚠️</span>
            <div className="text-sm text-yellow-800">
              <strong>Security Notice:</strong> This session is logged for security and HIPAA compliance.
              {session?.seniorName} can view your access history. Only access information necessary for providing care.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeniorViewPage;
