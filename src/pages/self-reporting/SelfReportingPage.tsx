/**
 * Self Reporting Page — Main Orchestrator
 *
 * Daily health check-in with mood, vitals, activity, social engagement,
 * symptoms, and AI-powered health insights. Supports offline submission
 * and voice input.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useSupabaseClient, useSession } from '../../contexts/AuthContext';
import { useBranding } from '../../BrandingContext';
import HealthInsightsWidget from '../../components/HealthInsightsWidget';
import PulseOximeter from '../../components/PulseOximeter';
import { offlineStorage, isOnline } from '../../utils/offlineStorage';
import HealthMetricsForm from './HealthMetricsForm';
import ActivityNotesForm from './ActivityNotesForm';
import ReportHistory from './ReportHistory';
import { MOOD_OPTIONS, SELF_REPORTS_SELECT, normalizeReportRow } from './types';
import type { SelfReportLog, SelfReportDbRow } from './types';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';

const SelfReportingPage: React.FC = () => {
  const { branding } = useBranding();
  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  const session = useSession();

  const [currentUser, setCurrentUser] = useState<User | null>(session?.user ?? null);

  // Health Metrics
  const [mood, setMood] = useState('');
  const [bloodPressureSystolic, setBloodPressureSystolic] = useState('');
  const [bloodPressureDiastolic, setBloodPressureDiastolic] = useState('');
  const [bloodSugar, setBloodSugar] = useState('');
  const [bloodOxygen, setBloodOxygen] = useState('');
  const [weight, setWeight] = useState('');
  const [physicalActivity, setPhysicalActivity] = useState('');
  const [socialEngagement, setSocialEngagement] = useState('');

  // Advanced Reporting
  const [symptoms, setSymptoms] = useState('');
  const [activity, setActivity] = useState('');

  // Speech to text
  const [isListening, setIsListening] = useState(false);
  const [currentField, setCurrentField] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [selfReports, setSelfReports] = useState<SelfReportLog[]>([]);
  const [showPulseOximeter, setShowPulseOximeter] = useState(false);

  // Auth bootstrap
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!mounted) return;
        if (error) {
          setErrorMessage('Error fetching user: ' + error.message);
          setCurrentUser(null);
        } else {
          setCurrentUser(data.user ?? null);
        }
      } catch (e: unknown) {
        if (!mounted) return;
        const err = e instanceof Error ? e : new Error('An unexpected error occurred.');
        setErrorMessage(err.message);
        setCurrentUser(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, newSession: Session | null) => {
        if (!mounted) return;
        setCurrentUser(newSession?.user ?? null);
      }
    );

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [supabase]);

  // Speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      type SpeechRecognitionConstructor = new () => SpeechRecognition;
      const SpeechRecognitionClass =
        ((window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition ||
        (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition) as SpeechRecognitionConstructor;
      recognitionRef.current = new SpeechRecognitionClass();

      if (recognitionRef.current) {
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = event.results[0][0].transcript;
          if (currentField === 'symptoms') {
            setSymptoms((prev) => prev + (prev ? ' ' : '') + transcript);
          } else if (currentField === 'activity') {
            setActivity((prev) => prev + (prev ? ' ' : '') + transcript);
          }
          setIsListening(false);
          setCurrentField(null);
        };

        recognitionRef.current.onend = () => { setIsListening(false); setCurrentField(null); };
        recognitionRef.current.onerror = () => { setIsListening(false); setCurrentField(null); };
      }
    }
  }, [currentField]);

  const startVoiceRecognition = (fieldName: string) => {
    if (recognitionRef.current) {
      setCurrentField(fieldName);
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopVoiceRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      setCurrentField(null);
    }
  };

  // Fetch self reports
  const fetchReports = useCallback(
    async (uid: string) => {
      try {
        const { data, error } = await supabase
          .from('self_reports')
          .select(SELF_REPORTS_SELECT)
          .eq('user_id', uid)
          .order('created_at', { ascending: false });

        if (error) {
          setErrorMessage('Error loading reports: ' + error.message);
          setSelfReports([]);
          return;
        }

        setSelfReports((data ?? []).map((r: SelfReportDbRow) => normalizeReportRow(r)));
      } catch (e: unknown) {
        const err = e instanceof Error ? e : new Error('An unexpected error occurred while fetching reports.');
        setErrorMessage(err.message);
        setSelfReports([]);
      }
    },
    [supabase]
  );

  useEffect(() => {
    if (!currentUser?.id) return;
    fetchReports(currentUser.id);
  }, [currentUser?.id, fetchReports]);

  // Pulse oximeter
  const handlePulseOximeterComplete = (heartRate: number, spo2: number) => {
    setBloodOxygen(spo2.toString());
    setShowPulseOximeter(false);
    setFeedbackMessage(`Measurement complete! Heart Rate: ${heartRate} BPM, Blood Oxygen: ${spo2}%`);
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setFeedbackMessage(null);
    setErrorMessage(null);

    if (!currentUser?.id) {
      setErrorMessage('You must be logged in to submit a report.');
      return;
    }

    const chosenMood = mood.trim();
    if (!chosenMood) { setErrorMessage('Please select your current mood.'); return; }
    if (!MOOD_OPTIONS.includes(chosenMood as (typeof MOOD_OPTIONS)[number])) {
      setErrorMessage('Invalid mood selection.');
      return;
    }

    setIsLoading(true);

    const payload = {
      user_id: currentUser.id,
      mood: chosenMood,
      bp_systolic: bloodPressureSystolic ? parseInt(bloodPressureSystolic) : null,
      bp_diastolic: bloodPressureDiastolic ? parseInt(bloodPressureDiastolic) : null,
      spo2: bloodOxygen ? parseInt(bloodOxygen) : null,
      blood_oxygen: bloodOxygen ? parseInt(bloodOxygen) : null,
      blood_sugar: bloodSugar ? parseInt(bloodSugar) : null,
      weight: weight ? parseFloat(weight) : null,
      physical_activity: physicalActivity.trim() || null,
      social_engagement: socialEngagement.trim() || null,
      symptoms: symptoms.trim() || null,
      activity_description: activity.trim() || null,
    };

    try {
      const online = isOnline();

      if (online) {
        try {
          const { error } = await supabase.from('self_reports').insert([payload]);
          if (error) throw error;
          setFeedbackMessage('✅ Report saved successfully!');
        } catch (error: unknown) {
          await offlineStorage.savePendingReport(currentUser.id, payload);
          setFeedbackMessage('✅ Report saved! Will sync when connection improves.');
        }
      } else {
        await offlineStorage.savePendingReport(currentUser.id, payload);
        setFeedbackMessage('💾 Saved offline! Will upload automatically when you\'re back online.');
      }

      // Reset form
      setMood(''); setBloodPressureSystolic(''); setBloodPressureDiastolic('');
      setBloodSugar(''); setBloodOxygen(''); setWeight('');
      setPhysicalActivity(''); setSocialEngagement('');
      setSymptoms(''); setActivity('');

      if (online) {
        try { await fetchReports(currentUser.id); } catch (error: unknown) { /* no-op */ }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred.';
      setErrorMessage(`Error saving report: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{
        background: branding.gradient || `linear-gradient(to bottom right, ${branding.primaryColor}, ${branding.secondaryColor})`
      }}>
        <div className="text-center p-8 text-xl text-white">Loading...</div>
      </div>
    );
  }

  if (!currentUser && errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{
        background: branding.gradient || `linear-gradient(to bottom right, ${branding.primaryColor}, ${branding.secondaryColor})`
      }}>
        <div className="flex flex-col items-center justify-center p-6 text-center bg-white rounded-xl shadow-md max-w-lg w-full">
          <p className="text-2xl font-semibold mb-4" style={{ color: branding.primaryColor }}>Access Denied</p>
          <p className="text-lg text-gray-700">{errorMessage}</p>
          <p className="text-md mt-4 text-gray-700">
            Please{' '}
            <a href="/" className="underline" style={{ color: branding.secondaryColor }}>log in</a>
            {' '}to access this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full py-6 sm:py-10"
      style={{
        background: branding.gradient || `linear-gradient(to bottom right, ${branding.primaryColor}, ${branding.secondaryColor})`,
      }}
    >
      <div className="max-w-3xl mx-auto px-4">
        {/* CARD */}
        <div className="rounded-xl shadow-md border border-white/20 bg-white">
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-gray-200">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center mb-4 px-3 py-2 bg-white rounded-lg shadow-xs hover:shadow-md transition-shadow border border-gray-200"
              style={{ color: branding.primaryColor }}
            >
              <ArrowLeft size={20} className="mr-2" />
              Back to Dashboard
            </button>
            <h1
              className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2"
              style={{ color: branding.primaryColor }}
            >
              📊 My Daily Health Check-In
            </h1>
            <p className="text-gray-700">Track your health every day — you can report twice daily!</p>
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit} className="space-y-6 p-4 sm:p-6 text-gray-900">
            <HealthMetricsForm
              mood={mood} setMood={setMood}
              bloodPressureSystolic={bloodPressureSystolic} setBloodPressureSystolic={setBloodPressureSystolic}
              bloodPressureDiastolic={bloodPressureDiastolic} setBloodPressureDiastolic={setBloodPressureDiastolic}
              bloodSugar={bloodSugar} setBloodSugar={setBloodSugar}
              bloodOxygen={bloodOxygen} setBloodOxygen={setBloodOxygen}
              weight={weight} setWeight={setWeight}
              isLoading={isLoading}
              onShowPulseOximeter={() => setShowPulseOximeter(true)}
            />

            <ActivityNotesForm
              physicalActivity={physicalActivity} setPhysicalActivity={setPhysicalActivity}
              socialEngagement={socialEngagement} setSocialEngagement={setSocialEngagement}
              symptoms={symptoms} setSymptoms={setSymptoms}
              activity={activity} setActivity={setActivity}
              isLoading={isLoading}
              isListening={isListening}
              currentField={currentField}
              startVoiceRecognition={startVoiceRecognition}
              stopVoiceRecognition={stopVoiceRecognition}
            />

            {/* Feedback */}
            {feedbackMessage && (
              <p role="status" className="text-green-700 bg-green-100 p-3 rounded-lg text-base sm:text-lg text-center font-medium">
                {feedbackMessage}
              </p>
            )}
            {errorMessage && !feedbackMessage && (
              <p role="alert" className="text-red-700 bg-red-100 p-3 rounded-lg text-base sm:text-lg text-center font-medium">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading || !currentUser || !mood}
              className="w-full text-white font-bold py-4 px-6 rounded-lg text-2xl shadow-lg transition-all duration-300 disabled:opacity-50 focus:outline-hidden focus:ring-4 focus:ring-offset-2 focus:ring-white hover:shadow-xl"
              style={{
                background: branding.gradient || `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor})`,
                color: 'white',
                border: 'none',
              }}
            >
              {isLoading ? '📤 Submitting...' : '✅ Save My Health Report'}
            </button>

            {!mood && (
              <p className="text-center text-red-600 font-medium">
                📌 Please select your mood before submitting
              </p>
            )}
          </form>
        </div>

        {/* Health Insights Widget */}
        <div className="mt-8">
          <HealthInsightsWidget
            healthData={{
              mood,
              bp_systolic: bloodPressureSystolic ? parseInt(bloodPressureSystolic) : null,
              bp_diastolic: bloodPressureDiastolic ? parseInt(bloodPressureDiastolic) : null,
              blood_sugar: bloodSugar ? parseInt(bloodSugar) : null,
              blood_oxygen: bloodOxygen ? parseInt(bloodOxygen) : null,
              weight: weight ? parseFloat(weight) : null,
              symptoms,
              physical_activity: physicalActivity,
            }}
            historicalReports={selfReports.map((r) => ({
              created_at: r.created_at,
              mood: r.mood,
              bp_systolic: r.bp_systolic,
              bp_diastolic: r.bp_diastolic,
              blood_sugar: r.blood_sugar,
              blood_oxygen: r.blood_oxygen,
              heart_rate: r.heart_rate,
              weight: r.weight,
            }))}
          />
        </div>

        {/* History */}
        <ReportHistory reports={selfReports} />
      </div>

      {/* Pulse Oximeter Modal */}
      {showPulseOximeter && (
        <PulseOximeter
          onMeasurementComplete={handlePulseOximeterComplete}
          onClose={() => setShowPulseOximeter(false)}
        />
      )}
    </div>
  );
};

export default SelfReportingPage;
