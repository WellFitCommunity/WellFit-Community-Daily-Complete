// src/components/HealthHistory.tsx
import React, { useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '../contexts/AuthContext';

type CheckInEntry = {
  id: number;
  timestamp: string;
  label: string;
  is_emergency: boolean;
  emotional_state?: string;
  heart_rate?: number;
  pulse_oximeter?: number;
  bp_systolic?: number;
  bp_diastolic?: number;
  glucose_mg_dl?: number;
  created_at: string;
};

type SelfReportEntry = {
  id: string;
  created_at: string;
  mood: string;
  bp_systolic?: number;
  bp_diastolic?: number;
  blood_sugar?: number;
  blood_oxygen?: number;
  weight?: number;
  physical_activity?: string;
  social_engagement?: string;
  // Added fields for display compatibility
  label?: string;
  timestamp?: string;
  is_emergency?: boolean;
  emotional_state?: string;
  glucose_mg_dl?: number;
  pulse_oximeter?: number;
};

type HealthEntry = CheckInEntry | (SelfReportEntry & { source_type: 'self_report' });

const HealthHistory: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [healthEntries, setHealthEntries] = useState<HealthEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchHealthData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch check-ins
        const { data: checkInsData, error: checkInsError } = await supabase
          .from('check_ins')
          .select('*')
          .eq('user_id', user.id)
          .order('timestamp', { ascending: false })
          .limit(10);

        // Fetch self-reports
        const { data: selfReportsData, error: selfReportsError } = await supabase
          .from('self_reports')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        // Combine both datasets
        const combinedEntries: HealthEntry[] = [];

        // Add check-ins as they are
        if (checkInsData && !checkInsError) {
          combinedEntries.push(...checkInsData);
        }

        // Add self-reports with source_type marker
        if (selfReportsData && !selfReportsError) {
          const selfReportsWithType = selfReportsData.map(report => ({
            ...report,
            source_type: 'self_report' as const,
            // Map fields for consistent display
            timestamp: report.created_at,
            label: `Daily Health Check-In - ${report.mood}`,
            is_emergency: false,
            emotional_state: report.mood,
            glucose_mg_dl: report.blood_sugar,
            pulse_oximeter: report.blood_oxygen || report.spo2,
          }));
          combinedEntries.push(...selfReportsWithType);
        }

        // Sort all entries by date (most recent first)
        combinedEntries.sort((a, b) => {
          const dateA = new Date('timestamp' in a && a.timestamp ? a.timestamp : a.created_at);
          const dateB = new Date('timestamp' in b && b.timestamp ? b.timestamp : b.created_at);
          return dateB.getTime() - dateA.getTime();
        });

        // Limit to 10 total entries
        setHealthEntries(combinedEntries.slice(0, 10));

        // Set error only if both queries failed
        if (checkInsError && selfReportsError) {
          throw new Error('Unable to load health data');
        }
      } catch (err: any) {

        setError('Unable to load your health history');
      } finally {
        setLoading(false);
      }
    };

    fetchHealthData();
  }, [user, supabase]);

  if (!user) {
    return (
      <div className="text-center p-4">
        <p className="text-gray-600">Please log in to view your health history</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-3/4 mx-auto mb-2"></div>
          <div className="h-4 bg-gray-300 rounded w-1/2 mx-auto"></div>
        </div>
        <p className="text-gray-600 mt-2">Loading your health history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-4">
        <div className="text-red-600 mb-2">⚠️</div>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (healthEntries.length === 0) {
    return (
      <div className="text-center p-4">
        <div className="text-4xl mb-3">📋</div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">No Health Data Yet</h3>
        <p className="text-gray-600">Your health history will appear here once you start logging your daily check-ins or self-reports.</p>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (entry: HealthEntry) => {
    // Check if it's a self-report
    if ('source_type' in entry && entry.source_type === 'self_report') {
      return 'bg-purple-100 border-purple-300 text-purple-800';
    }

    // Original check-in logic
    const checkIn = entry as CheckInEntry;
    if (checkIn.is_emergency) return 'bg-red-100 border-red-300 text-red-800';
    if (checkIn.emotional_state === 'Happy' || checkIn.emotional_state === 'Energetic') return 'bg-green-100 border-green-300 text-green-800';
    if (checkIn.emotional_state === 'Anxious' || checkIn.emotional_state === 'Sad') return 'bg-yellow-100 border-yellow-300 text-yellow-800';
    return 'bg-blue-100 border-blue-300 text-blue-800';
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-xl font-bold text-gray-800 mb-2">📊 Your Health History</h3>
        <p className="text-gray-600">Recent check-ins and health data</p>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {healthEntries.map((entry) => {
          const isCheckIn = !('source_type' in entry);
          const checkIn = entry as CheckInEntry;
          const selfReport = entry as SelfReportEntry & { source_type: 'self_report' };

          return (
            <div
              key={entry.id}
              className={`p-4 rounded-lg border-2 ${getStatusColor(entry)}`}
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-sm">
                  {isCheckIn && checkIn.is_emergency && '🚨 '}
                  {isCheckIn ? checkIn.label : selfReport.label}
                  {!isCheckIn && (
                    <span className="ml-2 text-xs bg-purple-200 px-2 py-1 rounded">
                      Self-Report
                    </span>
                  )}
                </h4>
                <span className="text-xs opacity-75">
                  {formatDate(isCheckIn ? checkIn.timestamp : selfReport.created_at)}
                </span>
              </div>

              {entry.emotional_state && (
                <div className="text-sm mb-2">
                  <strong>Feeling:</strong> {entry.emotional_state}
                </div>
              )}

              {/* Vitals Display */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                {(isCheckIn ? checkIn.heart_rate : null) && (
                  <div className="bg-white bg-opacity-50 p-2 rounded">
                    <div className="font-medium">❤️ Heart Rate</div>
                    <div>{checkIn.heart_rate} BPM</div>
                  </div>
                )}
                {entry.pulse_oximeter && (
                  <div className="bg-white bg-opacity-50 p-2 rounded">
                    <div className="font-medium">🫁 Oxygen</div>
                    <div>{entry.pulse_oximeter}%</div>
                  </div>
                )}
                {entry.bp_systolic && entry.bp_diastolic && (
                  <div className="bg-white bg-opacity-50 p-2 rounded">
                    <div className="font-medium">🩺 Blood Pressure</div>
                    <div>{entry.bp_systolic}/{entry.bp_diastolic}</div>
                  </div>
                )}
                {entry.glucose_mg_dl && (
                  <div className="bg-white bg-opacity-50 p-2 rounded">
                    <div className="font-medium">🍯 Glucose</div>
                    <div>{entry.glucose_mg_dl} mg/dL</div>
                  </div>
                )}
                {!isCheckIn && selfReport.weight && (
                  <div className="bg-white bg-opacity-50 p-2 rounded">
                    <div className="font-medium">⚖️ Weight</div>
                    <div>{selfReport.weight} lbs</div>
                  </div>
                )}
                {!isCheckIn && selfReport.physical_activity && (
                  <div className="bg-white bg-opacity-50 p-2 rounded col-span-2">
                    <div className="font-medium">🏃‍♀️ Activity</div>
                    <div>{selfReport.physical_activity}</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center text-sm text-gray-500">
        Showing your last 10 health entries
      </div>
    </div>
  );
};

export default HealthHistory;