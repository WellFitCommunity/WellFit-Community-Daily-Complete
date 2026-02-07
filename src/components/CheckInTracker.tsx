// src/components/CheckInTracker.tsx
// Comprehensive Daily Check-In — orchestrator delegates rendering to sub-components.

import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient, useUser } from '../contexts/AuthContext';
import { useBranding } from '../BrandingContext';
import { ArrowLeft } from 'lucide-react';
import HealthInsightsWidget from './HealthInsightsWidget';
import { offlineStorage, isOnline } from '../utils/offlineStorage';
import { CheckInFormBody, CheckInModals, CheckInHistory } from './check-in';
import {
  ENABLE_LOCAL_HISTORY,
  STORAGE_KEY,
  LOCAL_HISTORY_CAP,
  FEEDBACK_COPY,
  parseIntOrNull,
  parseFloatOrNull,
  clampVitals,
} from './check-in';
import type {
  CheckInEntry,
  Toast,
  CrisisOption,
  WindowWithSpeechRecognition,
  WebSpeechRecognitionEvent,
  WebSpeechRecognitionInstance,
} from './check-in';

// ============================================================================
// PROPS
// ============================================================================

interface CheckInTrackerProps {
  showBackButton?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function CheckInTracker({ showBackButton = false }: CheckInTrackerProps = {}) {
  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  const user = useUser();
  const userId = user?.id ?? null;
  const { branding } = useBranding();

  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------

  const [history, setHistory] = useState<CheckInEntry[]>([]);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showCrisisOptions, setShowCrisisOptions] = useState(false);
  const [selectedCrisisOption, setSelectedCrisisOption] = useState<CrisisOption>(null);
  const [showCrisisMessage, setShowCrisisMessage] = useState(false);
  const [emergencyContactPhone, setEmergencyContactPhone] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<Toast>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPulseOximeter, setShowPulseOximeter] = useState(false);

  const feedbackRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<WebSpeechRecognitionInstance | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [currentField, setCurrentField] = useState<string | null>(null);

  // Form fields
  const [mood, setMood] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [pulseOximeter, setPulseOximeter] = useState('');
  const [bpSystolic, setBpSystolic] = useState('');
  const [bpDiastolic, setBpDiastolic] = useState('');
  const [glucose, setGlucose] = useState('');
  const [weight, setWeight] = useState('');
  const [physicalActivity, setPhysicalActivity] = useState('');
  const [socialEngagement, setSocialEngagement] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [activityNotes, setActivityNotes] = useState('');

  // ---------------------------------------------------------------------------
  // EFFECTS
  // ---------------------------------------------------------------------------

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
    const speechWindow = window as unknown as WindowWithSpeechRecognition;
    if (speechWindow.webkitSpeechRecognition || speechWindow.SpeechRecognition) {
      const SpeechRecognitionClass =
        speechWindow.webkitSpeechRecognition || speechWindow.SpeechRecognition;
      if (SpeechRecognitionClass) {
        recognitionRef.current = new SpeechRecognitionClass() as unknown as WebSpeechRecognitionInstance;
      }

      if (recognitionRef.current) {
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: WebSpeechRecognitionEvent) => {
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

  // Scroll to feedback message
  useEffect(() => {
    if (infoMessage && feedbackRef.current) {
      feedbackRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [infoMessage]);

  // Persist on change (disabled for HIPAA)
  useEffect(() => {
    if (!ENABLE_LOCAL_HISTORY) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-LOCAL_HISTORY_CAP)));
  }, [history]);

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------

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

  const handleCrisisOption = (option: CrisisOption) => {
    setSelectedCrisisOption(option);
    setShowCrisisOptions(false);
    setShowCrisisMessage(true);
    setTimeout(() => {
      setShowCrisisMessage(false);
      setSelectedCrisisOption(null);
    }, 7000);
  };

  const handlePulseOximeterComplete = (heartRateVal: number, spo2Val: number) => {
    setPulseOximeter(spo2Val.toString());
    setHeartRate(heartRateVal.toString());
    setShowPulseOximeter(false);
    setInfoMessage({
      type: 'success',
      text: `Measurement complete! Heart Rate: ${heartRateVal} BPM, Blood Oxygen: ${spo2Val}%`,
    });
    setTimeout(() => setInfoMessage(null), 5000);
  };

  async function handleCheckIn(label: string, isQuickButton = false): Promise<void> {
    // Show crisis options for "Not Feeling My Best"
    if (label === '🤒 Not Feeling My Best' && isQuickButton) {
      setShowCrisisOptions(true);
      return;
    }

    // For detailed form, require mood
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
      parsedHr, parsedSpO2, parsedSys, parsedDia, parsedGlu, parsedWeight,
    );

    // Optimistic local append (session-only)
    const newEntry: CheckInEntry = {
      label, timestamp, is_emergency: isEmergency,
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

    const toast = FEEDBACK_COPY[label] || FEEDBACK_COPY.DefaultSuccess;
    if (isEmergency) setShowEmergencyModal(true);

    try {
      const online = isOnline();

      if (userId && online) {
        const body = {
          label, is_quick: isQuickButton, is_emergency: isEmergency,
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
    } catch (e: unknown) {
      // Try offline save as fallback
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
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
            text: `Save failed: ${errorMessage}`,
          });
        }
      } else {
        setInfoMessage({
          type: 'error',
          text: `Local save OK. Cloud save failed: ${errorMessage}`,
        });
      }
    } finally {
      setIsSubmitting(false);
      if (isEmergency) setTimeout(() => setShowEmergencyModal(false), 7000);
      setTimeout(() => setInfoMessage(null), 5000);
    }
  }

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

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
        {/* CARD */}
        <div className="rounded-xl shadow-md border border-white/20 bg-white">
          {/* Header / Back */}
          <div className="p-4 sm:p-6 border-b border-gray-200">
            {showBackButton && (
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center mb-4 px-3 py-2 bg-white rounded-lg shadow-xs hover:shadow-md transition-shadow border border-gray-200"
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

          {/* Form Body */}
          <CheckInFormBody
            mood={mood} heartRate={heartRate} pulseOximeter={pulseOximeter}
            bpSystolic={bpSystolic} bpDiastolic={bpDiastolic} glucose={glucose}
            weight={weight} physicalActivity={physicalActivity}
            socialEngagement={socialEngagement} symptoms={symptoms}
            activityNotes={activityNotes} isSubmitting={isSubmitting}
            isListening={isListening} currentField={currentField}
            infoMessage={infoMessage} feedbackRef={feedbackRef} branding={branding}
            onSetMood={setMood} onSetHeartRate={setHeartRate}
            onSetPulseOximeter={setPulseOximeter} onSetBpSystolic={setBpSystolic}
            onSetBpDiastolic={setBpDiastolic} onSetGlucose={setGlucose}
            onSetWeight={setWeight} onSetPhysicalActivity={setPhysicalActivity}
            onSetSocialEngagement={setSocialEngagement} onSetSymptoms={setSymptoms}
            onSetActivityNotes={setActivityNotes}
            onStartVoice={startVoiceRecognition} onStopVoice={stopVoiceRecognition}
            onShowPulseOximeter={() => setShowPulseOximeter(true)}
            onCheckIn={handleCheckIn}
          />
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

        {/* History */}
        <CheckInHistory history={history} branding={branding} />
      </div>

      {/* Modals */}
      <CheckInModals
        showPulseOximeter={showPulseOximeter}
        showCrisisOptions={showCrisisOptions}
        showCrisisMessage={showCrisisMessage}
        selectedCrisisOption={selectedCrisisOption}
        showEmergencyModal={showEmergencyModal}
        emergencyContactPhone={emergencyContactPhone}
        onPulseOximeterComplete={handlePulseOximeterComplete}
        onClosePulseOximeter={() => setShowPulseOximeter(false)}
        onCrisisOption={handleCrisisOption}
        onCloseCrisis={() => setShowCrisisOptions(false)}
      />
    </div>
  );
}
