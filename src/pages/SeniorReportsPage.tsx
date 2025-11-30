/**
 * SeniorReportsPage - Printable health reports for caregivers
 *
 * This page generates printable/PDF-ready health reports for seniors.
 * Designed for caregivers to share with doctors or keep for records.
 *
 * Features:
 * - Summary report with trends
 * - Detailed check-in history
 * - Vitals summary
 * - Print-optimized styling
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBranding } from '../BrandingContext';
import { auditLogger } from '../services/auditLogger';
import { createClient } from '@supabase/supabase-js';

// Create anonymous Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || '';
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
  dob: string | null;
}

interface ReportPeriod {
  label: string;
  days: number;
}

const REPORT_PERIODS: ReportPeriod[] = [
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 14 Days', days: 14 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 90 Days', days: 90 },
];

const SeniorReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const { seniorId } = useParams<{ seniorId: string }>();
  const { branding } = useBranding();

  // Session state
  const [session, setSession] = useState<CaregiverSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Data state
  const [seniorProfile, setSeniorProfile] = useState<SeniorProfile | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>(REPORT_PERIODS[2]); // Default 30 days

  // Validate session
  const validateSession = useCallback(async () => {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) {
        setError('No active session. Please log in again.');
        setLoading(false);
        return false;
      }

      const sessionData: CaregiverSession = JSON.parse(stored);

      if (sessionData.seniorId !== seniorId) {
        setError('Session does not match requested senior.');
        setLoading(false);
        return false;
      }

      if (new Date(sessionData.expiresAt) < new Date()) {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        setError('Session expired. Please log in again.');
        setLoading(false);
        return false;
      }

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
      return true;
    } catch (err) {
      auditLogger.error('CAREGIVER_REPORTS_SESSION_ERROR', err instanceof Error ? err : new Error(String(err)));
      setError('Unable to validate session.');
      setLoading(false);
      return false;
    }
  }, [seniorId]);

  // Load data for report
  const loadReportData = useCallback(async () => {
    if (!session || !seniorId) return;

    try {
      // Log page view
      await anonSupabase.rpc('log_caregiver_page_view', {
        p_session_token: session.sessionToken,
        p_page_name: 'senior_reports'
      });

      // Load profile
      const { data: profileData } = await anonSupabase
        .from('profiles')
        .select('first_name, last_name, phone, dob')
        .eq('user_id', seniorId)
        .maybeSingle();

      if (profileData) {
        setSeniorProfile(profileData);
      }

      // Load check-ins for selected period
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - selectedPeriod.days);

      const { data: checkInData } = await anonSupabase
        .from('check_ins')
        .select('*')
        .eq('user_id', seniorId)
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: false });

      if (checkInData) {
        setCheckIns(checkInData);
      }

      setLoading(false);
    } catch (err) {
      auditLogger.error('CAREGIVER_REPORTS_LOAD_ERROR', err instanceof Error ? err : new Error(String(err)));
      setLoading(false);
    }
  }, [session, seniorId, selectedPeriod]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      const valid = await validateSession();
      if (valid) {
        await loadReportData();
      }
    };
    init();
  }, [validateSession, loadReportData]);

  // Handle print
  const handlePrint = () => {
    auditLogger.info('CAREGIVER_REPORT_PRINTED', {
      seniorId,
      caregiverName: session?.caregiverName,
      period: selectedPeriod.label
    });
    window.print();
  };

  // Calculate statistics
  const calculateStats = () => {
    if (checkIns.length === 0) {
      return {
        totalCheckIns: 0,
        avgHeartRate: null,
        avgBpSystolic: null,
        avgBpDiastolic: null,
        avgOxygen: null,
        avgGlucose: null,
        moodBreakdown: {} as Record<string, number>,
        emergencyCount: 0
      };
    }

    const heartRates = checkIns.filter(c => c.heart_rate).map(c => c.heart_rate!);
    const bpSystolic = checkIns.filter(c => c.bp_systolic).map(c => c.bp_systolic!);
    const bpDiastolic = checkIns.filter(c => c.bp_diastolic).map(c => c.bp_diastolic!);
    const oxygen = checkIns.filter(c => c.pulse_oximeter).map(c => c.pulse_oximeter!);
    const glucose = checkIns.filter(c => c.glucose_mg_dl).map(c => c.glucose_mg_dl!);

    const moodBreakdown: Record<string, number> = {};
    checkIns.forEach(c => {
      const mood = categorizeMood(c.label);
      moodBreakdown[mood] = (moodBreakdown[mood] || 0) + 1;
    });

    return {
      totalCheckIns: checkIns.length,
      avgHeartRate: heartRates.length ? Math.round(heartRates.reduce((a, b) => a + b, 0) / heartRates.length) : null,
      avgBpSystolic: bpSystolic.length ? Math.round(bpSystolic.reduce((a, b) => a + b, 0) / bpSystolic.length) : null,
      avgBpDiastolic: bpDiastolic.length ? Math.round(bpDiastolic.reduce((a, b) => a + b, 0) / bpDiastolic.length) : null,
      avgOxygen: oxygen.length ? Math.round(oxygen.reduce((a, b) => a + b, 0) / oxygen.length) : null,
      avgGlucose: glucose.length ? Math.round(glucose.reduce((a, b) => a + b, 0) / glucose.length) : null,
      moodBreakdown,
      emergencyCount: checkIns.filter(c => c.label.toLowerCase().includes('emergency') || c.label.toLowerCase().includes('help')).length
    };
  };

  // Categorize mood from label
  const categorizeMood = (label: string): string => {
    const lower = label.toLowerCase();
    if (lower.includes('great') || lower.includes('excellent')) return 'Excellent';
    if (lower.includes('good') || lower.includes('fine')) return 'Good';
    if (lower.includes('okay') || lower.includes('so-so')) return 'Okay';
    if (lower.includes('not') || lower.includes('bad') || lower.includes('tired')) return 'Poor';
    if (lower.includes('emergency') || lower.includes('help')) return 'Emergency';
    return 'Other';
  };

  // Format date for display
  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // Calculate age from DOB
  const calculateAge = (dob: string): number => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
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
          <p className="text-lg">Generating report...</p>
        </div>
      </div>
    );
  }

  const stats = calculateStats();
  const reportDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <>
      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          body { font-size: 12pt; }
          .container { max-width: 100% !important; }
        }
      `}</style>

      <div className="min-h-screen bg-white">
        {/* Action Bar (hidden when printing) */}
        <div className="no-print bg-gray-100 border-b sticky top-0 z-10">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(`/senior-view/${seniorId}`)}
                className="text-gray-600 hover:text-gray-800"
              >
                ← Back to Dashboard
              </button>
              <select
                value={selectedPeriod.days}
                onChange={(e) => {
                  const period = REPORT_PERIODS.find(p => p.days === parseInt(e.target.value));
                  if (period) setSelectedPeriod(period);
                }}
                className="border rounded-lg px-3 py-2"
              >
                {REPORT_PERIODS.map(period => (
                  <option key={period.days} value={period.days}>
                    {period.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handlePrint}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
            >
              <span className="mr-2">🖨️</span> Print Report
            </button>
          </div>
        </div>

        {/* Report Content */}
        <div className="container mx-auto px-8 py-8 max-w-4xl">
          {/* Header */}
          <div className="text-center border-b-2 border-gray-300 pb-6 mb-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Health & Wellness Report
            </h1>
            <p className="text-lg text-gray-600">
              {seniorProfile ? `${seniorProfile.first_name} ${seniorProfile.last_name}` : session?.seniorName}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Report Period: {selectedPeriod.label} | Generated: {reportDate}
            </p>
          </div>

          {/* Patient Information */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Patient Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Full Name</p>
                <p className="font-medium">
                  {seniorProfile ? `${seniorProfile.first_name} ${seniorProfile.last_name}` : session?.seniorName}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium">{seniorProfile?.phone || 'N/A'}</p>
              </div>
              {seniorProfile?.dob && (
                <>
                  <div>
                    <p className="text-sm text-gray-500">Date of Birth</p>
                    <p className="font-medium">{new Date(seniorProfile.dob).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Age</p>
                    <p className="font-medium">{calculateAge(seniorProfile.dob)} years</p>
                  </div>
                </>
              )}
            </div>
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500">Report Prepared By</p>
              <p className="font-medium">{session?.caregiverName} (Caregiver)</p>
            </div>
          </div>

          {/* Summary Statistics */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Summary Statistics</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-blue-800">{stats.totalCheckIns}</p>
                <p className="text-sm text-blue-600">Total Check-ins</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-green-800">
                  {stats.avgHeartRate ? `${stats.avgHeartRate}` : 'N/A'}
                </p>
                <p className="text-sm text-green-600">Avg Heart Rate (bpm)</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-purple-800">
                  {stats.avgBpSystolic && stats.avgBpDiastolic
                    ? `${stats.avgBpSystolic}/${stats.avgBpDiastolic}`
                    : 'N/A'}
                </p>
                <p className="text-sm text-purple-600">Avg Blood Pressure</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-orange-800">
                  {stats.avgOxygen ? `${stats.avgOxygen}%` : 'N/A'}
                </p>
                <p className="text-sm text-orange-600">Avg Oxygen Level</p>
              </div>
            </div>

            {stats.emergencyCount > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-800 font-semibold">
                  ⚠️ {stats.emergencyCount} emergency or distress check-in(s) recorded during this period
                </p>
              </div>
            )}
          </div>

          {/* Mood Distribution */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Mood Distribution</h2>
            <div className="bg-gray-50 rounded-lg p-6">
              {Object.keys(stats.moodBreakdown).length === 0 ? (
                <p className="text-gray-500 text-center">No mood data available</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(stats.moodBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([mood, count]) => {
                      const percentage = Math.round((count / stats.totalCheckIns) * 100);
                      let color = 'bg-gray-400';
                      if (mood === 'Excellent') color = 'bg-green-500';
                      else if (mood === 'Good') color = 'bg-green-400';
                      else if (mood === 'Okay') color = 'bg-yellow-400';
                      else if (mood === 'Poor') color = 'bg-orange-400';
                      else if (mood === 'Emergency') color = 'bg-red-500';

                      return (
                        <div key={mood} className="flex items-center">
                          <div className="w-24 text-sm font-medium text-gray-700">{mood}</div>
                          <div className="flex-1 bg-gray-200 rounded-full h-6 mx-4">
                            <div
                              className={`${color} h-6 rounded-full flex items-center justify-end pr-2`}
                              style={{ width: `${Math.max(percentage, 10)}%` }}
                            >
                              <span className="text-xs text-white font-semibold">{percentage}%</span>
                            </div>
                          </div>
                          <div className="w-12 text-sm text-gray-600 text-right">{count}</div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* Detailed Check-in History */}
          <div className="print-break">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Check-in History</h2>

            {checkIns.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No check-ins during this period</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date & Time</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Vitals</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {checkIns.map((checkIn) => (
                      <tr key={checkIn.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatDate(checkIn.timestamp)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            checkIn.label.toLowerCase().includes('great') ? 'bg-green-100 text-green-800' :
                            checkIn.label.toLowerCase().includes('good') ? 'bg-green-50 text-green-700' :
                            checkIn.label.toLowerCase().includes('okay') ? 'bg-yellow-100 text-yellow-800' :
                            checkIn.label.toLowerCase().includes('not') ? 'bg-orange-100 text-orange-800' :
                            checkIn.label.toLowerCase().includes('emergency') ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {checkIn.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <div className="space-y-1">
                            {checkIn.heart_rate && (
                              <div>❤️ {checkIn.heart_rate} bpm</div>
                            )}
                            {checkIn.bp_systolic && checkIn.bp_diastolic && (
                              <div>🩺 {checkIn.bp_systolic}/{checkIn.bp_diastolic}</div>
                            )}
                            {checkIn.pulse_oximeter && (
                              <div>🫁 {checkIn.pulse_oximeter}%</div>
                            )}
                            {checkIn.glucose_mg_dl && (
                              <div>🩸 {checkIn.glucose_mg_dl} mg/dL</div>
                            )}
                            {!checkIn.heart_rate && !checkIn.bp_systolic && !checkIn.pulse_oximeter && !checkIn.glucose_mg_dl && (
                              <span className="text-gray-400">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                          {checkIn.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-12 pt-6 border-t text-center text-sm text-gray-500">
            <p>This report was generated from WellFit Community health tracking data.</p>
            <p className="mt-1">
              Report generated on {reportDate} by {session?.caregiverName}
            </p>
            <p className="mt-2 text-xs">
              CONFIDENTIAL: This document contains protected health information (PHI).
              Handle in accordance with HIPAA regulations.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default SeniorReportsPage;
