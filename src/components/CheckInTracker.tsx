// src/components/CheckInTracker.tsx
// Comprehensive Daily Check-In with all health metrics + quick buttons + crisis support
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient, useUser } from '../contexts/AuthContext';
import { useBranding } from '../BrandingContext';
import { ArrowLeft, Mic, MicOff, Heart } from 'lucide-react';
import HealthInsightsWidget from './HealthInsightsWidget';
import PulseOximeter from './PulseOximeter';
import { offlineStorage, isOnline } from '../utils/offlineStorage';

const ENABLE_LOCAL_HISTORY = false; // HIPAA: keep PHI out of localStorage

type CheckIn = {
  timestamp: string;
  label: string;
  is_emergency: boolean;
  emotional_state?: string;
  heart_rate?: number | null;
  pulse_oximeter?: number | null;
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  glucose_mg_dl?: number | null;
  weight?: number | null;
  physical_activity?: string | null;
  social_engagement?: string | null;
  symptoms?: string | null;
  activity_notes?: string | null;
};

const STORAGE_KEY = 'wellfitCheckIns';
const LOCAL_HISTORY_CAP = 200;

type Toast = { type?: 'success' | 'error' | 'info'; text?: string } | null;
type CrisisOption = 'speak_someone' | 'fallen_injured' | 'lost' | null;

function parseIntOrNull(v: string): number | null {
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

function parseFloatOrNull(v: string): number | null {
  if (!v) return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

// client-side sanity (server also clamps)
function clampVitals(
  hr: number | null,
  spo2: number | null,
  sys: number | null,
  dia: number | null,
  glu: number | null,
  weight: number | null
) {
  function safe<T extends number | null>(val: T, lo: number, hi: number): T | null {
    return val != null && val >= lo && val <= hi ? val : null;
  }
  return {
    hr: safe(hr, 30, 220),
    spo2: safe(spo2, 50, 100),
    sys: safe(sys, 70, 250),
    dia: safe(dia, 40, 150),
    glu: safe(glu, 40, 600),
    weight: safe(weight, 50, 500),
  };
}

const MOOD_OPTIONS = ['Great', 'Good', 'Okay', 'Not Great', 'Sad', 'Anxious', 'Tired', 'Stressed'] as const;

const PHYSICAL_ACTIVITY_OPTIONS = [
  'Walking',
  'Gym/Fitness Center',
  'YMCA',
  'Silver Sneakers',
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

interface CheckInTrackerProps {
  showBackButton?: boolean;
}

export default function CheckInTracker({ showBackButton = false }: CheckInTrackerProps = {}) {
  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  const user = useUser();
  const userId = user?.id ?? null;
  const { branding } = useBranding();

  const [history, setHistory] = useState<CheckIn[]>([]);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showCrisisOptions, setShowCrisisOptions] = useState(false);
  const [selectedCrisisOption, setSelectedCrisisOption] = useState<CrisisOption>(null);
  const [showCrisisMessage, setShowCrisisMessage] = useState(false);
  const [emergencyContactPhone, setEmergencyContactPhone] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<Toast>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPulseOximeter, setShowPulseOximeter] = useState(false);

  // Ref for feedback message to scroll to
  const feedbackRef = useRef<HTMLDivElement>(null);

  // Voice recognition refs
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [currentField, setCurrentField] = useState<string | null>(null);

  // Form fields - Mood/Emotional
  const [mood, setMood] = useState('');

  // Vitals
  const [heartRate, setHeartRate] = useState('');
  const [pulseOximeter, setPulseOximeter] = useState('');
  const [bpSystolic, setBpSystolic] = useState('');
  const [bpDiastolic, setBpDiastolic] = useState('');
  const [glucose, setGlucose] = useState('');
  const [weight, setWeight] = useState('');

  // Activity & Social
  const [physicalActivity, setPhysicalActivity] = useState('');
  const [socialEngagement, setSocialEngagement] = useState('');

  // Notes with voice
  const [symptoms, setSymptoms] = useState('');
  const [activityNotes, setActivityNotes] = useState('');

  // Load stored history (disabled for HIPAA)
  useEffect(() => {
    if (!ENABLE_LOCAL_HISTORY) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setHistory(parsed);
    } catch {
      setHistory([]);
    }
  }, []);

  // Load emergency contact phone
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('emergency_contact_phone')
        .eq('user_id', userId)
        .single();
      if (data?.emergency_contact_phone) {
        setEmergencyContactPhone(data.emergency_contact_phone);
      }
    })();
  }, [userId, supabase]);

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
          } else if (currentField === 'activityNotes') {
            setActivityNotes((prev) => prev + (prev ? ' ' : '') + transcript);
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

  // Scroll to feedback message when it appears
  useEffect(() => {
    if (infoMessage && feedbackRef.current) {
      feedbackRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [infoMessage]);

  // Persist on change (disabled for HIPAA)
  useEffect(() => {
    if (!ENABLE_LOCAL_HISTORY) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-LOCAL_HISTORY_CAP)));
  }, [history]);

  const checkInButtons = [
    '😊 Feeling Great Today',
    '📅 Feeling fine & have a Dr. Appt today',
    '🏥 In the hospital',
    '🤒 Not Feeling My Best',
    '🧭 Need Healthcare Navigation Assistance',
    '⭐ Attending the event today',
  ];

  const feedbackCopy: Record<string, string> = {
    '😊 Feeling Great Today': 'Awesome! Enjoy your day. 🌞',
    '📅 Feeling fine & have a Dr. Appt today': 'Do not forget to show your log to the doctor. 🩺',
    '🏥 In the hospital': 'We are thinking of you. Please call us if we can help. ❤️',
    '🤒 Not Feeling My Best': 'We understand. Please let us know how we can help.',
    '🧭 Need Healthcare Navigation Assistance': 'Hang tight—we will call you shortly. ☎️',
    '⭐ Attending the event today': 'Great! Have a wonderful time at the event. Enjoy yourself! ✨',
    DefaultSuccess: 'Check-in submitted successfully!',
  };

  const handleCrisisOption = (option: CrisisOption) => {
    setSelectedCrisisOption(option);
    setShowCrisisOptions(false);
    setShowCrisisMessage(true);

    // Show message for 7 seconds
    setTimeout(() => {
      setShowCrisisMessage(false);
      setSelectedCrisisOption(null);
    }, 7000);
  };

  // Handle pulse oximeter measurement from camera
  const handlePulseOximeterComplete = (heartRateVal: number, spo2Val: number) => {
    setPulseOximeter(spo2Val.toString());
    setHeartRate(heartRateVal.toString());
    setShowPulseOximeter(false);
    setInfoMessage({
      type: 'success',
      text: `Measurement complete! Heart Rate: ${heartRateVal} BPM, Blood Oxygen: ${spo2Val}%`
    });
    setTimeout(() => setInfoMessage(null), 5000);
  };

  async function handleCheckIn(label: string, isQuickButton = false): Promise<void> {
    // Show crisis options for "Not Feeling My Best"
    if (label === '🤒 Not Feeling My Best' && isQuickButton) {
      setShowCrisisOptions(true);
      return;
    }

    // For detailed form, require mood.
    if (!isQuickButton && !mood) {
      setInfoMessage({ type: 'error', text: 'Please select how you are feeling today.' });
      setTimeout(() => setInfoMessage(null), 3000);
      return;
    }

    setIsSubmitting(true);
    setInfoMessage(null);

    const isEmergency = false; // Emergency handling moved to crisis options
    const timestamp = new Date().toISOString();

    const parsedHr = parseIntOrNull(heartRate);
    const parsedSpO2 = parseIntOrNull(pulseOximeter);
    const parsedSys = parseIntOrNull(bpSystolic);
    const parsedDia = parseIntOrNull(bpDiastolic);
    const parsedGlu = parseIntOrNull(glucose);
    const parsedWeight = parseFloatOrNull(weight);

    const { hr, spo2, sys, dia, glu, weight: clampedWeight } = clampVitals(
      parsedHr,
      parsedSpO2,
      parsedSys,
      parsedDia,
      parsedGlu,
      parsedWeight
    );

    // Optimistic local append (session-only)
    const newEntry: CheckIn = {
      label,
      timestamp,
      is_emergency: isEmergency,
      emotional_state: isQuickButton ? undefined : mood,
      heart_rate: isQuickButton ? null : hr,
      pulse_oximeter: isQuickButton ? null : spo2,
      bp_systolic: isQuickButton ? null : sys,
      bp_diastolic: isQuickButton ? null : dia,
      glucose_mg_dl: isQuickButton ? null : glu,
      weight: isQuickButton ? null : clampedWeight,
      physical_activity: isQuickButton ? null : (physicalActivity || null),
      social_engagement: isQuickButton ? null : (socialEngagement || null),
      symptoms: isQuickButton ? null : (symptoms.trim() || null),
      activity_notes: isQuickButton ? null : (activityNotes.trim() || null),
    };
    setHistory((prev) => [...prev.slice(-LOCAL_HISTORY_CAP + 1), newEntry]);

    const toast = feedbackCopy[label] || feedbackCopy.DefaultSuccess;
    if (isEmergency) setShowEmergencyModal(true);

    try {
      // Check if online
      const online = isOnline();

      if (userId && online) {
        const body = {
          label,
          is_quick: isQuickButton,
          is_emergency: isEmergency,
          emotional_state: isQuickButton ? undefined : mood,
          heart_rate: isQuickButton ? null : hr,
          pulse_oximeter: isQuickButton ? null : spo2,
          bp_systolic: isQuickButton ? null : sys,
          bp_diastolic: isQuickButton ? null : dia,
          glucose_mg_dl: isQuickButton ? null : glu,
          weight: isQuickButton ? null : clampedWeight,
          physical_activity: isQuickButton ? null : (physicalActivity || null),
          social_engagement: isQuickButton ? null : (socialEngagement || null),
          symptoms: isQuickButton ? null : (symptoms.trim() || null),
          activity_notes: isQuickButton ? null : (activityNotes.trim() || null),
        };

        // Try edge function first
        const { error } = await supabase.functions.invoke('create-checkin', { body });

        if (error) {
          // Fallback: save to self_reports table directly
          const { error: insertError } = await supabase.from('self_reports').insert([{
            user_id: userId,
            mood: mood || label,
            bp_systolic: sys,
            bp_diastolic: dia,
            spo2: spo2,
            blood_oxygen: spo2,
            blood_sugar: glu,
            weight: clampedWeight,
            heart_rate: hr,
            physical_activity: physicalActivity || null,
            social_engagement: socialEngagement || null,
            symptoms: symptoms.trim() || null,
            activity_description: activityNotes.trim() || null,
          }]);

          if (insertError) throw insertError;
        }

        setInfoMessage({ type: 'success', text: `${toast} (Saved to cloud)` });
      } else if (userId && !online) {
        // Offline - save locally
        await offlineStorage.savePendingReport(userId, {
          user_id: userId,
          mood: mood || label,
          bp_systolic: sys,
          bp_diastolic: dia,
          spo2: spo2,
          blood_oxygen: spo2,
          blood_sugar: glu,
          weight: clampedWeight,
          physical_activity: physicalActivity || null,
          social_engagement: socialEngagement || null,
          symptoms: symptoms.trim() || null,
          activity_description: activityNotes.trim() || null,
        });
        setInfoMessage({
          type: 'info',
          text: `💾 Saved offline! Will upload automatically when you're back online.`,
        });
      } else {
        setInfoMessage({
          type: 'info',
          text: `${toast} (Saved locally. Log in to save to cloud.)`,
        });
      }

      // Clear detailed fields after full form submission
      if (!isQuickButton) {
        setMood('');
        setHeartRate('');
        setPulseOximeter('');
        setBpSystolic('');
        setBpDiastolic('');
        setGlucose('');
        setWeight('');
        setPhysicalActivity('');
        setSocialEngagement('');
        setSymptoms('');
        setActivityNotes('');
      }
    } catch (e: any) {
      // Try offline save as fallback
      if (userId) {
        try {
          await offlineStorage.savePendingReport(userId, {
            user_id: userId,
            mood: mood || label,
            bp_systolic: sys,
            bp_diastolic: dia,
            spo2: spo2,
            blood_sugar: glu,
            weight: clampedWeight,
          });
          setInfoMessage({
            type: 'info',
            text: `✅ Saved offline! Will sync when connection improves.`,
          });
        } catch {
          setInfoMessage({
            type: 'error',
            text: `Save failed: ${e?.message || 'Unknown error'}`,
          });
        }
      } else {
        setInfoMessage({
          type: 'error',
          text: `Local save OK. Cloud save failed: ${e?.message || 'Unknown error'}`,
        });
      }
    } finally {
      setIsSubmitting(false);
      if (isEmergency) setTimeout(() => setShowEmergencyModal(false), 7000);
      setTimeout(() => setInfoMessage(null), 5000);
    }
  }

  return (
    // FULL-BLEED GRADIENT BACKGROUND
    <div
      className="min-h-screen w-full py-6 sm:py-10"
      style={{
        background:
          branding.gradient ||
          `linear-gradient(to bottom right, ${branding.primaryColor || '#003865'}, ${branding.secondaryColor || '#8cc63f'})`,
      }}
    >
      <div className="max-w-3xl mx-auto px-4">
        {/* CARD */}
        <div className="rounded-xl shadow-md border border-white/20 bg-white">
          {/* Header / Back */}
          <div className="p-4 sm:p-6 border-b border-gray-200">
            {showBackButton && (
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center mb-4 px-3 py-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200"
                style={{ color: branding.primaryColor || '#003865' }}
                aria-label="Go back"
              >
                <ArrowLeft size={20} className="mr-2" />
                Back to Dashboard
              </button>
            )}

            <h1
              className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 text-center"
              style={{ color: branding.primaryColor || '#003865' }}
            >
              📊 Daily Check-In Center
            </h1>
            <p className="text-gray-700 text-center">Track your health every day — you can report twice daily!</p>
          </div>

          {/* FORM */}
          <div className="space-y-6 p-4 sm:p-6 text-gray-900">
            {/* Mood Section */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">😊 How Are You Feeling?</h2>

              <div className="mb-4">
                <label htmlFor="mood" className="block text-lg font-medium text-gray-700 mb-2">
                  Select your mood today <span className="text-red-500">*</span>
                </label>
                <select
                  id="mood"
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  disabled={isSubmitting}
                  aria-required="true"
                  className="mt-1 block w-full py-3 px-4 text-lg border-2 border-gray-300 bg-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 text-gray-900"
                  style={{ minHeight: '48px', fontSize: '16px' }}
                >
                  <option value="" disabled className="text-gray-500 bg-gray-50">
                    -- Select your mood --
                  </option>
                  {MOOD_OPTIONS.map((option) => (
                    <option key={option} value={option} className="text-gray-900 bg-white">
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Health Metrics Section */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">📈 Today's Health Numbers</h2>

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
                      value={bpSystolic}
                      onChange={(e) => setBpSystolic(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full py-3 px-4 text-lg border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400 bg-white disabled:bg-gray-100"
                      min={70}
                      max={250}
                    />
                    <span className="text-sm text-gray-600">Systolic (top)</span>
                  </div>
                  <div>
                    <input
                      type="number"
                      placeholder="Bottom number"
                      value={bpDiastolic}
                      onChange={(e) => setBpDiastolic(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full py-3 px-4 text-lg border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400 bg-white disabled:bg-gray-100"
                      min={40}
                      max={150}
                    />
                    <span className="text-sm text-gray-600">Diastolic (bottom)</span>
                  </div>
                </div>
              </div>

              {/* Heart Rate & Blood Oxygen with Pulse Oximeter */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-lg font-medium text-gray-700 mb-2">
                    ❤️ Heart Rate (BPM)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 70"
                    value={heartRate}
                    onChange={(e) => setHeartRate(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 text-lg border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400 bg-white disabled:bg-gray-100"
                    min={30}
                    max={220}
                  />
                </div>
                <div>
                  <label className="block text-lg font-medium text-gray-700 mb-2">
                    🫁 Blood Oxygen (%)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="e.g., 98"
                      value={pulseOximeter}
                      onChange={(e) => setPulseOximeter(e.target.value)}
                      disabled={isSubmitting}
                      className="flex-1 py-3 px-4 text-lg border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400 bg-white disabled:bg-gray-100"
                      min={50}
                      max={100}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPulseOximeter(true)}
                      className="px-3 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-1 whitespace-nowrap"
                      title="Measure with your camera"
                    >
                      <Heart size={18} />
                      <span className="hidden sm:inline text-sm">Measure</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Pulse Oximeter Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-gray-700">
                  <strong>📱 New!</strong> Use your phone camera to measure your pulse and blood oxygen.
                  Tap the <Heart size={14} className="inline text-red-500" /> button to get started!
                </p>
              </div>

              {/* Blood Sugar & Weight */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-lg font-medium text-gray-700 mb-2">
                    🍯 Blood Sugar (mg/dL)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 120"
                    value={glucose}
                    onChange={(e) => setGlucose(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 text-lg border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400 bg-white disabled:bg-gray-100"
                    min={40}
                    max={600}
                  />
                </div>
                <div>
                  <label className="block text-lg font-medium text-gray-700 mb-2">
                    ⚖️ Weight (lbs)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g., 165"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 text-lg border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400 bg-white disabled:bg-gray-100"
                    min={50}
                    max={500}
                  />
                </div>
              </div>
            </div>

            {/* Activity & Social Section */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">🏃‍♀️ Today's Activities</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-lg font-medium text-gray-700 mb-2">
                    🏃‍♀️ Physical Activity
                  </label>
                  <select
                    value={physicalActivity}
                    onChange={(e) => setPhysicalActivity(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 text-lg border-2 border-gray-300 bg-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 disabled:bg-gray-100"
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

                <div>
                  <label className="block text-lg font-medium text-gray-700 mb-2">
                    👥 Social Connection
                  </label>
                  <select
                    value={socialEngagement}
                    onChange={(e) => setSocialEngagement(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 text-lg border-2 border-gray-300 bg-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 disabled:bg-gray-100"
                    style={{ minHeight: '48px', fontSize: '16px' }}
                  >
                    <option value="" className="text-gray-500 bg-gray-50">
                      How did you connect?
                    </option>
                    {SOCIAL_ENGAGEMENT_OPTIONS.map((option) => (
                      <option key={option} value={option} className="text-gray-900 bg-white">
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Notes Section with Voice */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">📝 Additional Notes (Optional)</h2>

              <div className="mb-4">
                <label htmlFor="symptoms" className="block text-lg font-medium text-gray-700 mb-2">
                  🤒 Any symptoms you're experiencing?
                </label>
                <div className="relative">
                  <textarea
                    id="symptoms"
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    rows={3}
                    disabled={isSubmitting}
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
                <label htmlFor="activityNotes" className="block text-lg font-medium text-gray-700 mb-2">
                  📓 Tell us more about your day
                </label>
                <div className="relative">
                  <textarea
                    id="activityNotes"
                    value={activityNotes}
                    onChange={(e) => setActivityNotes(e.target.value)}
                    rows={3}
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 text-lg border border-gray-300 bg-white rounded-lg shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 disabled:bg-gray-50 pr-14 text-gray-900 placeholder-gray-400"
                    placeholder="Tell us about your day, any concerns, or how you're feeling..."
                    maxLength={500}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      isListening && currentField === 'activityNotes'
                        ? stopVoiceRecognition()
                        : startVoiceRecognition('activityNotes')
                    }
                    className={`absolute right-3 top-3 p-2 rounded-full transition ${
                      isListening && currentField === 'activityNotes'
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                    title={
                      isListening && currentField === 'activityNotes' ? 'Stop recording' : 'Click to speak'
                    }
                  >
                    {isListening && currentField === 'activityNotes' ? <Mic size={20} /> : <MicOff size={20} />}
                  </button>
                </div>
                {isListening && currentField === 'activityNotes' && (
                  <p className="text-red-600 text-sm mt-1 animate-pulse">🎤 Listening... Speak now!</p>
                )}
              </div>
            </div>

            {/* Submit detailed check-in */}
            <button
              onClick={() => handleCheckIn('Daily Self-Report', false)}
              className="w-full text-white font-bold py-4 px-6 rounded-lg text-xl shadow-lg transition-all duration-300 disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-white hover:shadow-xl"
              style={{
                background:
                  branding.gradient ||
                  `linear-gradient(to right, ${branding.primaryColor || '#003865'}, ${branding.secondaryColor || '#8cc63f'})`,
              }}
              disabled={!mood || isSubmitting}
            >
              {isSubmitting ? '📤 Submitting...' : '✅ Save My Health Report'}
            </button>

            {!mood && (
              <p className="text-center text-red-600 font-medium">
                📌 Please select your mood before submitting
              </p>
            )}

            {/* Quick Check-ins */}
            <div className="pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold mb-3 text-center text-gray-700">Or Quick Status Update:</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {checkInButtons.map((label) => (
                  <button
                    key={label}
                    onClick={() => handleCheckIn(label, true)}
                    className="w-full py-3 px-4 bg-[#8cc63f] border-2 border-[#003865] text-white font-semibold rounded-lg shadow-md hover:bg-[#77aa36] transition disabled:bg-gray-400 disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8cc63f]"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Processing…' : label}
                  </button>
                ))}
              </div>
            </div>

            {/* Feedback */}
            {infoMessage?.text && (
              <div
                ref={feedbackRef}
                role="status"
                aria-live={infoMessage.type === 'error' ? 'assertive' : 'polite'}
                className={`p-4 text-white rounded-lg text-center font-medium scroll-mt-4 ${
                  infoMessage.type === 'error'
                    ? 'bg-red-500'
                    : infoMessage.type === 'success'
                    ? 'bg-green-500'
                    : 'bg-[#003865]'
                }`}
              >
                {infoMessage.text}
              </div>
            )}
          </div>
        </div>

        {/* Health Insights Widget */}
        <div className="mt-8">
          <HealthInsightsWidget
            healthData={{
              mood,
              bp_systolic: bpSystolic ? parseInt(bpSystolic) : null,
              bp_diastolic: bpDiastolic ? parseInt(bpDiastolic) : null,
              blood_sugar: glucose ? parseInt(glucose) : null,
              blood_oxygen: pulseOximeter ? parseInt(pulseOximeter) : null,
              weight: weight ? parseFloat(weight) : null,
              symptoms,
              physical_activity: physicalActivity,
            }}
          />
        </div>

        {/* History (session only) */}
        {history.length > 0 && (
          <div className="mt-8 bg-white rounded-xl shadow-md p-4 sm:p-6">
            <h3 className="text-lg font-semibold mb-4 text-center" style={{ color: branding.primaryColor || '#003865' }}>
              Your Recent Check-Ins
            </h3>
            <ul className="space-y-3 text-sm text-gray-700 max-h-64 overflow-y-auto">
              {history
                .slice(-LOCAL_HISTORY_CAP)
                .slice()
                .reverse()
                .map((h, i) => (
                  <li key={`${h.timestamp}-${i}`} className="p-3 border-l-4 border-[#8cc63f] bg-gray-50 rounded-r-lg">
                    <strong className="text-gray-900">{h.label}</strong>
                    <span className="text-gray-500 ml-2">— {new Date(h.timestamp).toLocaleString()}</span>
                    {h.emotional_state && <div className="text-xs mt-1">😊 Mood: {h.emotional_state}</div>}
                    {h.heart_rate != null && <div className="text-xs">❤️ HR: {h.heart_rate} BPM</div>}
                    {h.pulse_oximeter != null && <div className="text-xs">🫁 SpO₂: {h.pulse_oximeter}%</div>}
                    {h.bp_systolic != null && h.bp_diastolic != null && (
                      <div className="text-xs">🩸 BP: {h.bp_systolic}/{h.bp_diastolic} mmHg</div>
                    )}
                    {h.glucose_mg_dl != null && <div className="text-xs">🍯 Glucose: {h.glucose_mg_dl} mg/dL</div>}
                    {h.weight != null && <div className="text-xs">⚖️ Weight: {h.weight} lbs</div>}
                    {h.physical_activity && <div className="text-xs">🏃‍♀️ Activity: {h.physical_activity}</div>}
                    {h.social_engagement && <div className="text-xs">👥 Social: {h.social_engagement}</div>}
                    {h.symptoms && <div className="text-xs">🤒 Symptoms: {h.symptoms}</div>}
                    {h.activity_notes && <div className="text-xs">📓 Notes: {h.activity_notes}</div>}
                  </li>
                ))}
            </ul>
            <p className="text-sm text-center text-gray-500 mt-4">
              🛈 This is a session log. Full history is saved if you are logged in.
            </p>
          </div>
        )}
      </div>

      {/* Pulse Oximeter Modal */}
      {showPulseOximeter && (
        <PulseOximeter
          onMeasurementComplete={handlePulseOximeterComplete}
          onClose={() => setShowPulseOximeter(false)}
        />
      )}

      {/* Crisis Options Modal */}
      {showCrisisOptions && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="crisis-options-title"
        >
          <div className="bg-white p-6 rounded-xl shadow-lg max-w-md w-full mx-4">
            <h3 id="crisis-options-title" className="text-xl font-bold mb-4 text-[#003865] text-center">
              How can we help you?
            </h3>
            <div className="space-y-4">
              <button
                onClick={() => handleCrisisOption('speak_someone')}
                className="w-full py-6 px-6 text-2xl bg-[#8cc63f] text-white font-bold rounded-xl hover:bg-[#77aa36] hover:scale-105 transform transition shadow-2xl"
              >
                <span className="text-4xl mb-2 block">💬</span>
                <span className="block leading-relaxed">Would you like to speak to someone?</span>
              </button>
              <button
                onClick={() => handleCrisisOption('fallen_injured')}
                className="w-full py-6 px-6 text-2xl bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 hover:scale-105 transform transition shadow-2xl"
              >
                <span className="text-4xl mb-2 block">🚑</span>
                <span className="block leading-relaxed">I have fallen and injured myself</span>
              </button>
              <button
                onClick={() => handleCrisisOption('lost')}
                className="w-full py-6 px-6 text-2xl bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 hover:scale-105 transform transition shadow-2xl"
              >
                <span className="text-4xl mb-2 block">🧭</span>
                <span className="block leading-relaxed">I am lost</span>
              </button>
              <button
                onClick={() => setShowCrisisOptions(false)}
                className="w-full py-4 px-6 text-xl bg-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-400 transition mt-6"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crisis Message Display */}
      {showCrisisMessage && selectedCrisisOption && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center"
          role="alert"
          aria-live="assertive"
        >
          <div className="bg-white p-6 rounded-xl shadow-lg max-w-md w-full mx-4 text-center">
            {selectedCrisisOption === 'speak_someone' && (
              <>
                <h3 className="text-xl font-bold mb-4 text-[#003865]">Crisis Support Available</h3>
                <p className="text-lg mb-4">
                  If you're in crisis or need emotional support, please call or text the 988 Suicide & Crisis Lifeline:
                </p>
                <a
                  href="tel:988"
                  className="inline-block py-3 px-6 bg-[#8cc63f] text-white font-bold text-xl rounded-lg shadow-md hover:bg-[#77aa36] transition mb-2"
                >
                  📞 Call or Text 988
                </a>
                <p className="text-sm text-gray-600 mt-2">Available 24/7 for free, confidential support</p>
              </>
            )}
            {selectedCrisisOption === 'fallen_injured' && (
              <>
                <h3 className="text-xl font-bold mb-4 text-red-600">🚨 Emergency - Call 911</h3>
                <p className="text-lg mb-4">
                  If you've fallen and are injured, please call 911 immediately for emergency medical assistance.
                </p>
                <a
                  href="tel:911"
                  className="inline-block py-3 px-6 bg-red-600 text-white font-bold text-xl rounded-lg shadow-md hover:bg-red-700 transition"
                >
                  📞 Call 911
                </a>
              </>
            )}
            {selectedCrisisOption === 'lost' && (
              <>
                <h3 className="text-xl font-bold mb-4 text-orange-600">🧭 You're Lost - Contact Emergency Contact</h3>
                <p className="text-lg mb-4">
                  Please contact your emergency contact for help with directions and assistance.
                </p>
                {emergencyContactPhone ? (
                  <a
                    href={`tel:${emergencyContactPhone}`}
                    className="inline-block py-3 px-6 bg-orange-500 text-white font-bold text-xl rounded-lg shadow-md hover:bg-orange-600 transition"
                  >
                    📞 Call Emergency Contact
                  </a>
                ) : (
                  <p className="text-red-600 font-semibold">
                    No emergency contact phone number on file. Please call 911 if you need immediate assistance.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Emergency Overlay (Legacy - kept for compatibility) */}
      {showEmergencyModal && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="emergency-modal-title"
        >
          <div className="bg-red-600 text-white p-6 rounded-xl shadow-lg max-w-sm text-center animate-pulse">
            <h3 id="emergency-modal-title" className="text-xl font-bold mb-2">
              🚨 Emergency Alert Triggered
            </h3>
            <p className="mb-3">Your check-in indicated an emergency. We've logged this.</p>
            <p>
              If you are in immediate danger or need urgent medical attention, please call{' '}
              <strong>911</strong> or your local emergency number now.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
