// src/pages/SelfReportingPage.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mic, MicOff, Heart } from 'lucide-react';
import { useSupabaseClient, useSession } from '../contexts/AuthContext';
import { useBranding } from '../BrandingContext';
import HealthInsightsWidget from '../components/HealthInsightsWidget';
import PulseOximeter from '../components/PulseOximeter';
import { offlineStorage, isOnline } from '../utils/offlineStorage';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';

type SourceType = 'self' | 'staff';

interface SelfReportData {
  id: string;
  created_at: string;
  mood: string;
  symptoms?: string | null;
  activity_description?: string | null;
  // Health metrics that map directly to self_reports table columns
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  blood_sugar?: number | null;
  blood_oxygen?: number | null;
  weight?: number | null;
  physical_activity?: string | null;
  social_engagement?: string | null;
  user_id: string;
  // Additional fields from self_reports table
  heart_rate?: number | null;
  spo2?: number | null;
}

interface SelfReportLog extends SelfReportData {
  source_type: SourceType; // client-added for color coding
  // Legacy field names for display compatibility
  blood_pressure_systolic?: number | null;
  blood_pressure_diastolic?: number | null;
}

const MOOD_OPTIONS = ['Great', 'Good', 'Okay', 'Not Great', 'Sad', 'Anxious', 'Tired', 'Stressed'] as const;

const PHYSICAL_ACTIVITY_OPTIONS = [
  'Walking',
  'Gym/Fitness Center',
  'YMCA',
  'Swimming',
  'Yoga/Stretching',
  'Dancing',
  'Gardening',
  'Housework',
  'Resting/No Activity'
] as const;

const SOCIAL_ENGAGEMENT_OPTIONS = [
  'Spent time with family',
  'Called/texted friends',
  'Attended social event',
  'Volunteered',
  'Went to religious service',
  'Participated in group activity',
  'Had visitors',
  'Went out with others',
  'Stayed home alone',
  'Connected online/video call'
] as const;

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

  // Advanced Reporting (existing fields)
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

  // --- Auth bootstrap + listener (uses single app client)
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
      } catch (e) {
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

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition =
        (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();

      if (recognitionRef.current) {
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;

          if (currentField === 'symptoms') {
            setSymptoms((prev) => prev + (prev ? ' ' : '') + transcript);
          } else if (currentField === 'activity') {
            setActivity((prev) => prev + (prev ? ' ' : '') + transcript);
          }

          setIsListening(false);
          setCurrentField(null);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
          setCurrentField(null);
        };

        recognitionRef.current.onerror = () => {
          setIsListening(false);
          setCurrentField(null);
        };
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

  // --- Fetch self reports for the current user
  const fetchReports = useCallback(
    async (uid: string) => {
      try {
        const { data, error } = await supabase
          .from('self_reports')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false });

        if (error) {
          setErrorMessage('Error loading reports: ' + error.message);
          setSelfReports([]);
          return;
        }

        const reports: SelfReportLog[] = (data ?? []).map((r: any) => ({
          id: r.id,
          created_at: r.created_at,
          user_id: r.user_id,
          mood: String(r.mood ?? ''),
          symptoms: r.symptoms ?? null,
          activity_description: r.activity_description ?? null,
          // direct
          bp_systolic: r.bp_systolic ?? null,
          bp_diastolic: r.bp_diastolic ?? null,
          // legacy aliases
          blood_pressure_systolic: r.bp_systolic ?? null,
          blood_pressure_diastolic: r.bp_diastolic ?? null,
          blood_sugar: r.blood_sugar ?? null,
          blood_oxygen: r.blood_oxygen ?? null,
          weight: r.weight ?? null,
          physical_activity: r.physical_activity ?? null,
          social_engagement: r.social_engagement ?? null,
          spo2: r.spo2 ?? null,
          heart_rate: r.heart_rate ?? null,
          source_type: 'self',
        }));

        setSelfReports(reports);
      } catch (e) {
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

  // --- Handle pulse oximeter measurement
  const handlePulseOximeterComplete = (heartRate: number, spo2: number) => {
    setBloodOxygen(spo2.toString());
    // Note: We're not storing heart_rate separately in this form, but it could be added
    setShowPulseOximeter(false);
    setFeedbackMessage(`Measurement complete! Heart Rate: ${heartRate} BPM, Blood Oxygen: ${spo2}%`);
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  // --- Submit (with offline support)
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setFeedbackMessage(null);
    setErrorMessage(null);

    if (!currentUser?.id) {
      setErrorMessage('You must be logged in to submit a report.');
      return;
    }

    const chosenMood = mood.trim();
    if (!chosenMood) {
      setErrorMessage('Please select your current mood.');
      return;
    }
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
      // Check if online
      const online = isOnline();

      if (online) {
        // Try to save to database
        try {
          const { error } = await supabase.from('self_reports').insert([payload]);
          if (error) throw error;

          setFeedbackMessage('✅ Report saved successfully!');
        } catch (error) {
          // If online but save failed, save offline
          console.warn('[SelfReporting] Online save failed, saving offline:', error);
          await offlineStorage.savePendingReport(currentUser.id, payload);
          setFeedbackMessage('✅ Report saved! Will sync when connection improves.');
        }
      } else {
        // Offline - save locally
        await offlineStorage.savePendingReport(currentUser.id, payload);
        setFeedbackMessage('💾 Saved offline! Will upload automatically when you\'re back online.');
      }

      // reset form
      setMood('');
      setBloodPressureSystolic('');
      setBloodPressureDiastolic('');
      setBloodSugar('');
      setBloodOxygen('');
      setWeight('');
      setPhysicalActivity('');
      setSocialEngagement('');
      setSymptoms('');
      setActivity('');

      // Refresh reports if online
      if (online) {
        try {
          await fetchReports(currentUser.id);
        } catch (error) {
          console.warn('[SelfReporting] Failed to refresh reports:', error);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred.';
      setErrorMessage(`Error saving report: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // UI helpers
  const colorForSource = (type: SourceType | string): string => {
    if (type === 'self') return '#8cc63f'; // WellFit Green
    if (type === 'staff') return '#ff9800'; // Orange
    return '#bdbdbd';
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
          <p className="text-2xl font-semibold mb-4" style={{ color: branding.primaryColor }}>
            Access Denied
          </p>
          <p className="text-lg text-gray-700">{errorMessage}</p>
          <p className="text-md mt-4 text-gray-700">
            Please{' '}
            <a href="/" className="underline" style={{ color: branding.secondaryColor }}>
              log in
            </a>{' '}
            to access this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    // FULL-BLEED GRADIENT BACKGROUND
    <div
      className="min-h-screen w-full py-6 sm:py-10"
      style={{
        background:
          branding.gradient ||
          `linear-gradient(to bottom right, ${branding.primaryColor}, ${branding.secondaryColor})`,
      }}
    >
      <div className="max-w-3xl mx-auto px-4">
        {/* CARD */}
        <div className="rounded-xl shadow-md border border-white/20 bg-white">
          {/* Header / Back */}
          <div className="p-4 sm:p-6 border-b border-gray-200">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center mb-4 px-3 py-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200"
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
            {/* Daily Health Metrics Section */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">📈 Today&apos;s Health Numbers</h2>

              {/* Mood */}
              <div className="mb-4">
                <label htmlFor="mood" className="block text-lg font-medium text-gray-700 mb-2">
                  😊 How are you feeling today?
                </label>
                <select
                  id="mood"
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  disabled={isLoading}
                  aria-required="true"
                  className="mt-1 block w-full py-3 px-4 text-lg border-2 border-gray-300 bg-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 text-gray-900 placeholder-gray-400"
                  style={{ minHeight: '48px', fontSize: '16px' }}
                >
                  <option value="" disabled className="text-gray-500 bg-gray-50">
                    Select your mood...
                  </option>
                  {MOOD_OPTIONS.map((option) => (
                    <option key={option} value={option} className="text-gray-900 bg-white">
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {/* Blood Pressure */}
              <div className="mb-4">
                <label className="block text-lg font-medium text-gray-700 mb-2">
                  🩸 Blood Pressure (if you took it today)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input
                      type="number"
                      placeholder="Top number"
                      value={bloodPressureSystolic}
                      onChange={(e) => setBloodPressureSystolic(e.target.value)}
                      className="w-full py-3 px-4 text-lg border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400 bg-white"
                      min={70}
                      max={250}
                    />
                    <span className="text-sm text-gray-600">Systolic (top)</span>
                  </div>
                  <div>
                    <input
                      type="number"
                      placeholder="Bottom number"
                      value={bloodPressureDiastolic}
                      onChange={(e) => setBloodPressureDiastolic(e.target.value)}
                      className="w-full py-3 px-4 text-lg border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400 bg-white"
                      min={40}
                      max={150}
                    />
                    <span className="text-sm text-gray-600">Diastolic (bottom)</span>
                  </div>
                </div>
              </div>

              {/* Blood Sugar */}
              <div className="mb-4">
                <label className="block text-lg font-medium text-gray-700 mb-2">
                  🍯 Blood Sugar (if you checked it)
                </label>
                <input
                  type="number"
                  placeholder="mg/dL"
                  value={bloodSugar}
                  onChange={(e) => setBloodSugar(e.target.value)}
                  className="w-full py-3 px-4 text-lg border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400 bg-white"
                  min={50}
                  max={500}
                />
                <span className="text-sm text-gray-600">Enter number only (like 120)</span>
              </div>

              {/* Blood Oxygen with Pulse Oximeter */}
              <div className="mb-4">
                <label className="block text-lg font-medium text-gray-700 mb-2">
                  🫁 Blood Oxygen Level (if you measured it)
                </label>

                <div className="flex gap-2 mb-2">
                  <input
                    type="number"
                    placeholder="% (like 98)"
                    value={bloodOxygen}
                    onChange={(e) => setBloodOxygen(e.target.value)}
                    className="flex-1 py-3 px-4 text-lg border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400 bg-white"
                    min={70}
                    max={100}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPulseOximeter(true)}
                    className="px-4 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 whitespace-nowrap"
                    title="Measure with your camera"
                  >
                    <Heart size={20} />
                    <span className="hidden sm:inline">Measure Now</span>
                    <span className="sm:hidden">Measure</span>
                  </button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                  <p className="text-sm text-gray-700">
                    <strong>📱 New!</strong> Use your phone camera to measure your pulse and blood oxygen.
                    Tap "Measure Now" to get started!
                  </p>
                </div>

                <span className="text-sm text-gray-600">Percentage (normal is 95–100%)</span>
              </div>

              {/* Weight */}
              <div className="mb-4">
                <label className="block text-lg font-medium text-gray-700 mb-2">
                  ⚖️ Weight (if you weighed yourself)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="pounds"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full py-3 px-4 text-lg border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400 bg-white"
                  min={50}
                  max={500}
                />
                <span className="text-sm text-gray-600">Enter your weight in pounds</span>
              </div>
            </div>

            {/* Activity & Social Section */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">🏃‍♀️ Today&apos;s Activities</h2>

              {/* Physical Activity */}
              <div className="mb-4">
                <label className="block text-lg font-medium text-gray-700 mb-2">
                  🏃‍♀️ What physical activity did you do today?
                </label>
                <select
                  value={physicalActivity}
                  onChange={(e) => setPhysicalActivity(e.target.value)}
                  className="w-full py-3 px-4 text-lg border-2 border-gray-300 bg-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400"
                  style={{ minHeight: '48px', fontSize: '16px' }}
                >
                  <option value="" className="text-gray-500 bg-gray-50">
                    Select an activity...
                  </option>
                  {PHYSICAL_ACTIVITY_OPTIONS.map((option) => (
                    <option key={option} value={option} className="text-gray-900 bg-white">
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {/* Social Engagement */}
              <div className="mb-4">
                <label className="block text-lg font-medium text-gray-700 mb-2">
                  👥 How did you connect with others today?
                </label>
                <select
                  value={socialEngagement}
                  onChange={(e) => setSocialEngagement(e.target.value)}
                  className="w-full py-3 px-4 text-lg border-2 border-gray-300 bg-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400"
                  style={{ minHeight: '48px', fontSize: '16px' }}
                >
                  <option value="" className="text-gray-500 bg-gray-50">
                    Tell us about your social time...
                  </option>
                  {SOCIAL_ENGAGEMENT_OPTIONS.map((option) => (
                    <option key={option} value={option} className="text-gray-900 bg-white">
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Advanced Reporting Section */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">📝 Additional Notes (Optional)</h2>

              <div className="mb-4">
                <label htmlFor="symptoms" className="block text-lg font-medium text-gray-700 mb-2">
                  🤒 Any symptoms you&apos;re experiencing?
                </label>
                <div className="relative">
                  <textarea
                    id="symptoms"
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    rows={3}
                    disabled={isLoading}
                    className="w-full py-3 px-4 text-lg border border-gray-300 bg-white rounded-lg shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 disabled:bg-gray-50 pr-14 text-gray-900 placeholder-gray-400"
                    placeholder="e.g., headache, fatigue, feeling dizzy..."
                    maxLength={500}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      isListening && currentField === 'symptoms'
                        ? stopVoiceRecognition()
                        : startVoiceRecognition('symptoms')
                    }
                    className={`absolute right-3 top-3 p-2 rounded-full transition ${
                      isListening && currentField === 'symptoms'
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                    title={
                      isListening && currentField === 'symptoms' ? 'Stop recording' : 'Click to speak'
                    }
                  >
                    {isListening && currentField === 'symptoms' ? <Mic size={20} /> : <MicOff size={20} />}
                  </button>
                </div>
                {isListening && currentField === 'symptoms' && (
                  <p className="text-red-600 text-sm mt-1 animate-pulse">🎤 Listening... Speak now!</p>
                )}
              </div>

              <div className="mb-4">
                <label htmlFor="activity" className="block text-lg font-medium text-gray-700 mb-2">
                  📓 Tell us more about your day
                </label>
                <div className="relative">
                  <textarea
                    id="activity"
                    value={activity}
                    onChange={(e) => setActivity(e.target.value)}
                    rows={3}
                    disabled={isLoading}
                    className="w-full py-3 px-4 text-lg border border-gray-300 bg-white rounded-lg shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 disabled:bg-gray-50 pr-14 text-gray-900 placeholder-gray-400"
                    placeholder="Tell us about your day, any concerns, or how you're feeling..."
                    maxLength={500}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      isListening && currentField === 'activity'
                        ? stopVoiceRecognition()
                        : startVoiceRecognition('activity')
                    }
                    className={`absolute right-3 top-3 p-2 rounded-full transition ${
                      isListening && currentField === 'activity'
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                    title={
                      isListening && currentField === 'activity' ? 'Stop recording' : 'Click to speak'
                    }
                  >
                    {isListening && currentField === 'activity' ? <Mic size={20} /> : <MicOff size={20} />}
                  </button>
                </div>
                {isListening && currentField === 'activity' && (
                  <p className="text-red-600 text-sm mt-1 animate-pulse">🎤 Listening... Speak now!</p>
                )}
              </div>
            </div>

            {/* Feedback messages */}
            {feedbackMessage && (
              <p
                role="status"
                className="text-green-700 bg-green-100 p-3 rounded-lg text-base sm:text-lg text-center font-medium"
              >
                {feedbackMessage}
              </p>
            )}
            {errorMessage && !feedbackMessage && (
              <p
                role="alert"
                className="text-red-700 bg-red-100 p-3 rounded-lg text-base sm:text-lg text-center font-medium"
              >
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading || !currentUser || !mood}
              className="w-full text-white font-bold py-4 px-6 rounded-lg text-2xl shadow-lg transition-all duration-300 disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-white hover:shadow-xl"
              style={{
                background:
                  branding.gradient ||
                  `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor})`,
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
          />
        </div>

        {/* History */}
        <div className="mt-8">
          <h2 className="text-lg sm:text-xl font-semibold mb-4" style={{ color: branding.primaryColor }}>
            Your Previous Reports
          </h2>
          {selfReports.length === 0 ? (
            <p className="text-white/90">No reports yet.</p>
          ) : (
            selfReports.map((log) => (
              <div
                key={log.id}
                style={{
                  borderLeft: `8px solid ${colorForSource(log.source_type)}`,
                  padding: '8px',
                  marginBottom: '8px',
                  background: '#fff',
                }}
                className="rounded-md shadow-sm"
              >
                <strong>{new Date(log.created_at).toLocaleString()}</strong>
                <span
                  style={{ color: colorForSource(log.source_type), fontWeight: 'bold', marginLeft: 8 }}
                >
                  {log.source_type === 'self' ? 'Self' : 'Staff'}
                </span>
                <br />
                <strong>😊 Mood:</strong> {log.mood}
                {log.blood_pressure_systolic && log.blood_pressure_diastolic && (
                  <>
                    <br />
                    <strong>🩸 Blood Pressure:</strong> {log.blood_pressure_systolic}/{log.blood_pressure_diastolic}
                  </>
                )}
                {log.blood_sugar && (
                  <>
                    <br />
                    <strong>🍯 Blood Sugar:</strong> {log.blood_sugar} mg/dL
                  </>
                )}
                {log.blood_oxygen && (
                  <>
                    <br />
                    <strong>🫁 Blood Oxygen:</strong> {log.blood_oxygen}%
                  </>
                )}
                {log.weight && (
                  <>
                    <br />
                    <strong>⚖️ Weight:</strong> {log.weight} lbs
                  </>
                )}
                {log.physical_activity && (
                  <>
                    <br />
                    <strong>🏃‍♀️ Activity:</strong> {log.physical_activity}
                  </>
                )}
                {log.social_engagement && (
                  <>
                    <br />
                    <strong>👥 Social:</strong> {log.social_engagement}
                  </>
                )}
                {log.symptoms && (
                  <>
                    <br />
                    <strong>🤒 Symptoms:</strong> {log.symptoms}
                  </>
                )}
                {log.activity_description && (
                  <>
                    <br />
                    <strong>📓 Notes:</strong> {log.activity_description}
                  </>
                )}
              </div>
            ))
          )}
        </div>
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
