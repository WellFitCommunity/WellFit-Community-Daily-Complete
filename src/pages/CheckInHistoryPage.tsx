// src/pages/CheckInHistoryPage.tsx
// Displays real check-in history from Supabase — senior-friendly, clean layout.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient, useUser } from '../contexts/AuthContext';
import { useBranding } from '../BrandingContext';
import { ArrowLeft, Calendar, Heart, Droplets, Activity, Weight, ThermometerSun, Smile } from 'lucide-react';

interface CheckInRecord {
  id: number;
  timestamp: string;
  emotional_state: string | null;
  heart_rate: number | null;
  pulse_oximeter: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  glucose_mg_dl: number | null;
  weight: number | null;
  physical_activity: string | null;
  social_engagement: string | null;
  symptoms: string | null;
  notes: string | null;
  label: string | null;
}

const MOOD_EMOJI: Record<string, string> = {
  'Great': '😄',
  'Good': '🙂',
  'Okay': '😐',
  'Not Great': '😔',
  'Sad': '😢',
  'Anxious': '😰',
  'Tired': '😴',
  'Stressed': '😤',
};

export default function CheckInHistoryPage() {
  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  const user = useUser();
  const { branding } = useBranding();
  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [daysFilter, setDaysFilter] = useState(7);

  useEffect(() => {
    if (!user?.id) return;

    const fetchHistory = async () => {
      setIsLoading(true);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysFilter);

      const { data, error } = await supabase
        .from('check_ins')
        .select('id, timestamp, emotional_state, heart_rate, pulse_oximeter, bp_systolic, bp_diastolic, glucose_mg_dl, weight, physical_activity, social_engagement, symptoms, notes, label')
        .eq('user_id', user.id)
        .gte('timestamp', cutoff.toISOString())
        .order('timestamp', { ascending: false })
        .limit(50);

      if (!error && data) {
        setRecords(data as CheckInRecord[]);
      }
      setIsLoading(false);
    };

    fetchHistory();
  }, [user?.id, daysFilter, supabase]);

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div
      className="min-h-screen w-full py-6 sm:py-10"
      style={{
        background:
          branding.gradient ||
          `linear-gradient(to bottom right, ${branding.primaryColor || '#003865'}, ${branding.secondaryColor || '#8cc63f'})`,
      }}
    >
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 mb-6">
          <button
            onClick={() => navigate('/check-in')}
            className="flex items-center mb-4 px-3 py-2 bg-white rounded-lg shadow-xs hover:shadow-md transition-shadow border border-gray-200"
            style={{ color: branding.primaryColor || '#003865' }}
            aria-label="Back to check-in"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back to Check-In
          </button>

          <h1
            className="text-2xl sm:text-3xl font-bold mb-2 text-center"
            style={{ color: branding.primaryColor || '#003865' }}
          >
            📋 Your Check-In History
          </h1>
          <p className="text-gray-600 text-center text-lg">
            See what you reported over the past days
          </p>

          {/* Time Filter */}
          <div className="flex justify-center gap-3 mt-4">
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                onClick={() => setDaysFilter(days)}
                className={`px-4 py-2 rounded-full text-base font-medium transition-all min-h-[44px] ${
                  daysFilter === days
                    ? 'text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                style={daysFilter === days ? { backgroundColor: branding.primaryColor || '#003865' } : undefined}
              >
                {days} Days
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p className="text-gray-600 text-lg">Loading your check-ins...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && records.length === 0 && (
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <span className="text-5xl mb-4 block">📝</span>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">No Check-Ins Yet</h2>
            <p className="text-gray-600 text-lg mb-4">
              You haven&apos;t recorded any check-ins in the last {daysFilter} days.
            </p>
            <button
              onClick={() => navigate('/check-in')}
              className="px-6 py-3 rounded-xl text-lg font-semibold text-white shadow-md hover:shadow-lg transition-all min-h-[44px]"
              style={{ backgroundColor: branding.primaryColor || '#003865' }}
            >
              Start Your First Check-In
            </button>
          </div>
        )}

        {/* Check-In Cards */}
        {!isLoading && records.length > 0 && (
          <div className="space-y-4">
            <p className="text-white text-center text-lg font-medium">
              {records.length} check-in{records.length !== 1 ? 's' : ''} in the last {daysFilter} days
            </p>

            {records.map((record) => (
              <div key={record.id} className="bg-white rounded-xl shadow-md p-4 sm:p-5 border-l-4" style={{ borderLeftColor: branding.primaryColor || '#003865' }}>
                {/* Date & Mood Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar size={18} className="text-gray-400" />
                    <span className="font-semibold text-gray-800 text-lg">{formatDate(record.timestamp)}</span>
                    <span className="text-gray-500">{formatTime(record.timestamp)}</span>
                  </div>
                  {record.emotional_state && (
                    <span className="text-2xl" title={record.emotional_state}>
                      {MOOD_EMOJI[record.emotional_state] || '😊'}
                    </span>
                  )}
                </div>

                {/* Mood */}
                {record.emotional_state && (
                  <div className="mb-3 flex items-center gap-2">
                    <Smile size={18} className="text-[#8cc63f]" />
                    <span className="text-gray-700 text-base">Mood: <strong>{record.emotional_state}</strong></span>
                  </div>
                )}

                {/* Vitals Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                  {record.bp_systolic != null && record.bp_diastolic != null && (
                    <div className="bg-red-50 rounded-lg p-2 flex items-center gap-2">
                      <Droplets size={16} className="text-red-500" />
                      <div>
                        <div className="text-xs text-gray-500">Blood Pressure</div>
                        <div className="font-semibold text-gray-800">{record.bp_systolic}/{record.bp_diastolic}</div>
                      </div>
                    </div>
                  )}
                  {record.heart_rate != null && (
                    <div className="bg-pink-50 rounded-lg p-2 flex items-center gap-2">
                      <Heart size={16} className="text-pink-500" />
                      <div>
                        <div className="text-xs text-gray-500">Heart Rate</div>
                        <div className="font-semibold text-gray-800">{record.heart_rate} BPM</div>
                      </div>
                    </div>
                  )}
                  {record.pulse_oximeter != null && (
                    <div className="bg-blue-50 rounded-lg p-2 flex items-center gap-2">
                      <ThermometerSun size={16} className="text-blue-500" />
                      <div>
                        <div className="text-xs text-gray-500">SpO2</div>
                        <div className="font-semibold text-gray-800">{record.pulse_oximeter}%</div>
                      </div>
                    </div>
                  )}
                  {record.glucose_mg_dl != null && (
                    <div className="bg-amber-50 rounded-lg p-2 flex items-center gap-2">
                      <Droplets size={16} className="text-amber-500" />
                      <div>
                        <div className="text-xs text-gray-500">Glucose</div>
                        <div className="font-semibold text-gray-800">{record.glucose_mg_dl} mg/dL</div>
                      </div>
                    </div>
                  )}
                  {record.weight != null && (
                    <div className="bg-green-50 rounded-lg p-2 flex items-center gap-2">
                      <Weight size={16} className="text-green-500" />
                      <div>
                        <div className="text-xs text-gray-500">Weight</div>
                        <div className="font-semibold text-gray-800">{record.weight} lbs</div>
                      </div>
                    </div>
                  )}
                  {record.physical_activity && (
                    <div className="bg-emerald-50 rounded-lg p-2 flex items-center gap-2">
                      <Activity size={16} className="text-emerald-500" />
                      <div>
                        <div className="text-xs text-gray-500">Activity</div>
                        <div className="font-semibold text-gray-800 truncate">{record.physical_activity}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes / Symptoms */}
                {record.symptoms && (
                  <div className="bg-orange-50 rounded-lg p-2 mb-2">
                    <span className="text-xs text-gray-500">Symptoms: </span>
                    <span className="text-gray-800">{record.symptoms}</span>
                  </div>
                )}
                {record.notes && (
                  <div className="bg-gray-50 rounded-lg p-2">
                    <span className="text-xs text-gray-500">Notes: </span>
                    <span className="text-gray-800">{record.notes}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
