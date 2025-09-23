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

const HealthHistory: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [checkIns, setCheckIns] = useState<CheckInEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchCheckIns = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('check_ins')
          .select('*')
          .eq('user_id', user.id)
          .order('timestamp', { ascending: false })
          .limit(10);

        if (fetchError) throw fetchError;

        setCheckIns(data || []);
      } catch (err: any) {
        console.error('Error fetching check-ins:', err);
        setError('Unable to load your health history');
      } finally {
        setLoading(false);
      }
    };

    fetchCheckIns();
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

  if (checkIns.length === 0) {
    return (
      <div className="text-center p-4">
        <div className="text-4xl mb-3">📋</div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">No Check-ins Yet</h3>
        <p className="text-gray-600">Your check-in history will appear here once you start logging your daily health status.</p>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (isEmergency: boolean, emotionalState?: string) => {
    if (isEmergency) return 'bg-red-100 border-red-300 text-red-800';
    if (emotionalState === 'Happy' || emotionalState === 'Energetic') return 'bg-green-100 border-green-300 text-green-800';
    if (emotionalState === 'Anxious' || emotionalState === 'Sad') return 'bg-yellow-100 border-yellow-300 text-yellow-800';
    return 'bg-blue-100 border-blue-300 text-blue-800';
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-xl font-bold text-gray-800 mb-2">📊 Your Health History</h3>
        <p className="text-gray-600">Recent check-ins and health data</p>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {checkIns.map((checkIn) => (
          <div
            key={checkIn.id}
            className={`p-4 rounded-lg border-2 ${getStatusColor(checkIn.is_emergency, checkIn.emotional_state)}`}
          >
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-semibold text-sm">
                {checkIn.is_emergency && '🚨 '}
                {checkIn.label}
              </h4>
              <span className="text-xs opacity-75">
                {formatDate(checkIn.timestamp)}
              </span>
            </div>

            {checkIn.emotional_state && (
              <div className="text-sm mb-2">
                <strong>Feeling:</strong> {checkIn.emotional_state}
              </div>
            )}

            {/* Vitals Display */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              {checkIn.heart_rate && (
                <div className="bg-white bg-opacity-50 p-2 rounded">
                  <div className="font-medium">❤️ Heart Rate</div>
                  <div>{checkIn.heart_rate} BPM</div>
                </div>
              )}
              {checkIn.pulse_oximeter && (
                <div className="bg-white bg-opacity-50 p-2 rounded">
                  <div className="font-medium">🫁 Oxygen</div>
                  <div>{checkIn.pulse_oximeter}%</div>
                </div>
              )}
              {checkIn.bp_systolic && checkIn.bp_diastolic && (
                <div className="bg-white bg-opacity-50 p-2 rounded">
                  <div className="font-medium">🩺 Blood Pressure</div>
                  <div>{checkIn.bp_systolic}/{checkIn.bp_diastolic}</div>
                </div>
              )}
              {checkIn.glucose_mg_dl && (
                <div className="bg-white bg-opacity-50 p-2 rounded">
                  <div className="font-medium">🍯 Glucose</div>
                  <div>{checkIn.glucose_mg_dl} mg/dL</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="text-center text-sm text-gray-500">
        Showing your last 10 check-ins
      </div>
    </div>
  );
};

export default HealthHistory;