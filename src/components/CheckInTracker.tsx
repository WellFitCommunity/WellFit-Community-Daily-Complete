// src/components/CheckInTracker.tsx
import { useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '../contexts/AuthContext';

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
};

const STORAGE_KEY = 'wellfitCheckIns';
const LOCAL_HISTORY_CAP = 200;

type Toast = { type?: 'success' | 'error' | 'info'; text?: string } | null;

function parseIntOrNull(v: string): number | null {
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

// client-side sanity (server also clamps)
function clampVitals(
  hr: number | null,
  spo2: number | null,
  sys: number | null,
  dia: number | null,
  glu: number | null
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
  };
}

interface CheckInTrackerProps {
  showBackButton?: boolean;
}

export default function CheckInTracker({ showBackButton = false }: CheckInTrackerProps = {}) {
  const supabase = useSupabaseClient();
  const user = useUser();
  const userId = user?.id ?? null;

  const [history, setHistory] = useState<CheckIn[]>([]);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [infoMessage, setInfoMessage] = useState<Toast>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detailed form fields
  const [emotionalState, setEmotionalState] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [pulseOximeter, setPulseOximeter] = useState('');
  const [bpSystolic, setBpSystolic] = useState('');
  const [bpDiastolic, setBpDiastolic] = useState('');
  const [glucose, setGlucose] = useState('');

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

  // Persist on change (disabled for HIPAA)
  useEffect(() => {
    if (!ENABLE_LOCAL_HISTORY) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-LOCAL_HISTORY_CAP)));
  }, [history]);

  const checkInButtons = [
    '😊 Feeling Great Today',
    '📅 Feeling fine & have a Dr. Appt today',
    '🏥 In the hospital',
    '🚨 Fallen down & injured',
    '🤒 Not Feeling Well',
    '🧭 Need Healthcare Navigation Assistance',
    '⭐ Attending the event today',
  ];

  const feedbackCopy: Record<string, string> = {
    '😊 Feeling Great Today': 'Awesome! Enjoy your day. 🌞',
    '📅 Feeling fine & have a Dr. Appt today': "Don’t forget to show your log to the doctor. 🩺",
    '🏥 In the hospital': 'We’re thinking of you. Please call us if we can help. ❤️',
    '🧭 Need Healthcare Navigation Assistance': 'Hang tight—we will call you shortly. ☎️',
    DefaultSuccess: 'Check-in submitted successfully!',
  };

  async function handleCheckIn(label: string, isQuickButton = false): Promise<void> {
    // For detailed form, require emotional state.
    if (!isQuickButton && !emotionalState) {
      setInfoMessage({ type: 'error', text: 'Please select your emotional state.' });
      setTimeout(() => setInfoMessage(null), 3000);
      return;
    }

    setIsSubmitting(true);
    setInfoMessage(null);

    const isEmergency =
      isQuickButton && (label === '🚨 Fallen down & injured' || label === '🤒 Not Feeling Well');
    const timestamp = new Date().toISOString();

    const parsedHr = parseIntOrNull(heartRate);
    const parsedSpO2 = parseIntOrNull(pulseOximeter);
    const parsedSys = parseIntOrNull(bpSystolic);
    const parsedDia = parseIntOrNull(bpDiastolic);
    const parsedGlu = parseIntOrNull(glucose);
    const { hr, spo2, sys, dia, glu } = clampVitals(
      parsedHr,
      parsedSpO2,
      parsedSys,
      parsedDia,
      parsedGlu
    );

    // Optimistic local append (session-only)
    const newEntry: CheckIn = {
      label,
      timestamp,
      is_emergency: isEmergency,
      emotional_state: isQuickButton ? undefined : emotionalState,
      heart_rate: isQuickButton ? null : hr,
      pulse_oximeter: isQuickButton ? null : spo2,
      bp_systolic: isQuickButton ? null : sys,
      bp_diastolic: isQuickButton ? null : dia,
      glucose_mg_dl: isQuickButton ? null : glu,
    };
    setHistory((prev) => [...prev.slice(-LOCAL_HISTORY_CAP + 1), newEntry]);

    const toast = feedbackCopy[label] || feedbackCopy.DefaultSuccess;
    if (isEmergency) setShowEmergencyModal(true);

    try {
      if (userId) {
        const body = {
          label,
          is_quick: isQuickButton,
          is_emergency: isEmergency, // optional; server also computes
          emotional_state: isQuickButton ? undefined : emotionalState,
          heart_rate: isQuickButton ? null : hr,
          pulse_oximeter: isQuickButton ? null : spo2,
          bp_systolic: isQuickButton ? null : sys,
          bp_diastolic: isQuickButton ? null : dia,
          glucose_mg_dl: isQuickButton ? null : glu,
        };

        // ✅ Automatically sends Authorization: Bearer <access_token>
        const { error } = await supabase.functions.invoke('create-checkin', { body });
        if (error) throw error;

        setInfoMessage({ type: 'success', text: `${toast} (Saved to cloud)` });
      } else {
        setInfoMessage({
          type: 'info',
          text: `${toast} (Saved locally. Log in to save to cloud.)`,
        });
      }

      // Clear detailed fields after full form submission
      if (!isQuickButton) {
        setEmotionalState('');
        setHeartRate('');
        setPulseOximeter('');
        setBpSystolic('');
        setBpDiastolic('');
        setGlucose('');
      }
    } catch (e: any) {
      console.error('create-checkin error:', e);
      setInfoMessage({
        type: 'error',
        text: `Local save OK. Cloud save failed: ${e?.message || 'Unknown error'}`,
      });
    } finally {
      setIsSubmitting(false);
      if (isEmergency) setTimeout(() => setShowEmergencyModal(false), 7000);
      setTimeout(() => setInfoMessage(null), 5000);
    }
  }

  const emotionalStateOptions = [
    { value: '', label: '-- Select your emotional state --' },
    { value: 'Happy', label: '😊 Happy' },
    { value: 'Calm', label: '😌 Calm' },
    { value: 'Anxious', label: '😟 Anxious' },
    { value: 'Sad', label: '😢 Sad' },
    { value: 'Energetic', label: '⚡ Energetic' },
    { value: 'Tired', label: '😴 Tired' },
    { value: 'Neutral', label: '😐 Neutral' },
    { value: 'Other', label: '🤔 Other' },
  ];

  return (
    <div className="relative max-w-xl mx-auto p-6 bg-white rounded-xl shadow-md border-2 border-wellfitGreen">
      {showBackButton && (
        <button
          onClick={() => window.history.back()}
          className="text-sm text-[#8cc63f] hover:underline mb-4"
          aria-label="Go back"
        >
          ← Back
        </button>
      )}
      <h2 className="text-2xl font-bold mb-6 text-center text-wellfit-blue">Check-In Center</h2>

      {/* Details Form */}
      <div className="space-y-4 mb-6">
        <div>
          <label htmlFor="emotionalState" className="block text-sm font-medium text-gray-700 mb-1">
            Emotional State <span className="text-red-500">*</span>
          </label>
          <select
            id="emotionalState"
            value={emotionalState}
            onChange={(e) => setEmotionalState(e.target.value)}
            disabled={isSubmitting}
            aria-required="true"
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
          >
            {emotionalStateOptions.map((option) => (
              <option key={option.value} value={option.value} disabled={option.value === ''}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Vitals (optional) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="heartRate" className="block text-sm font-medium text-gray-700 mb-1">
              Heart Rate (BPM)
            </label>
            <input
              type="number"
              id="heartRate"
              value={heartRate}
              onChange={(e) => setHeartRate(e.target.value)}
              placeholder="e.g., 70"
              disabled={isSubmitting}
              className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
            />
          </div>
          <div>
            <label htmlFor="pulseOximeter" className="block text-sm font-medium text-gray-700 mb-1">
              Pulse Oximeter (%)
            </label>
            <input
              type="number"
              id="pulseOximeter"
              value={pulseOximeter}
              onChange={(e) => setPulseOximeter(e.target.value)}
              placeholder="e.g., 98"
              disabled={isSubmitting}
              className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
            />
          </div>
          <div>
            <label htmlFor="bpSys" className="block text-sm font-medium text-gray-700 mb-1">
              Blood Pressure — Systolic
            </label>
            <input
              type="number"
              id="bpSys"
              value={bpSystolic}
              onChange={(e) => setBpSystolic(e.target.value)}
              placeholder="e.g., 120"
              disabled={isSubmitting}
              className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
            />
          </div>
          <div>
            <label htmlFor="bpDia" className="block text-sm font-medium text-gray-700 mb-1">
              Blood Pressure — Diastolic
            </label>
            <input
              type="number"
              id="bpDia"
              value={bpDiastolic}
              onChange={(e) => setBpDiastolic(e.target.value)}
              placeholder="e.g., 80"
              disabled={isSubmitting}
              className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="glucose" className="block text-sm font-medium text-gray-700 mb-1">
              Glucose (mg/dL)
            </label>
            <input
              type="number"
              id="glucose"
              value={glucose}
              onChange={(e) => setGlucose(e.target.value)}
              placeholder="e.g., 110"
              disabled={isSubmitting}
              className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
            />
          </div>
        </div>
      </div>

      {/* Submit detailed check-in */}
      <button
        onClick={() => handleCheckIn('Daily Self-Report', false)}
        className="w-full py-3 px-4 mb-6 bg-wellfit-blue text-white font-semibold rounded-lg shadow-md hover:bg-opacity-90 transition disabled:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-wellfit-blue"
        disabled={!emotionalState || isSubmitting}
      >
        {isSubmitting ? 'Submitting…' : 'Submit Check-In Details'}
      </button>

      {/* Quick Check-ins */}
      <h3 className="text-lg font-semibold mb-3 text-center text-gray-700">Or Quick Status Update:</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
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

      {/* Feedback */}
      {infoMessage?.text && (
        <div
          role="status"
          aria-live={infoMessage.type === 'error' ? 'assertive' : 'polite'}
          className={`mb-4 p-4 text-white rounded text-center font-medium ${
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

      {/* History (session only) */}
      {history.length > 0 && (
        <>
          <h3 className="text-lg font-semibold mb-2 text-center">Your Recent Check-Ins</h3>
          <ul className="mb-4 space-y-2 text-sm text-gray-700 max-h-48 overflow-y-auto p-2 border rounded-md bg-gray-50">
            {history
              .slice(-LOCAL_HISTORY_CAP)
              .slice()
              .reverse()
              .map((h, i) => (
                <li key={`${h.timestamp}-${i}`} className="p-2 border-b last:border-b-0">
                  <strong>{h.label}</strong> — {new Date(h.timestamp).toLocaleString()}
                  {h.emotional_state && <div className="text-xs">Feeling: {h.emotional_state}</div>}
                  {h.heart_rate != null && <div className="text-xs">HR: {h.heart_rate} BPM</div>}
                  {h.pulse_oximeter != null && <div className="text-xs">SpO₂: {h.pulse_oximeter}%</div>}
                  {h.bp_systolic != null && h.bp_diastolic != null && (
                    <div className="text-xs">BP: {h.bp_systolic}/{h.bp_diastolic} mmHg</div>
                  )}
                  {h.glucose_mg_dl != null && (
                    <div className="text-xs">Glucose: {h.glucose_mg_dl} mg/dL</div>
                  )}
                </li>
              ))}
          </ul>
          <p className="text-sm text-center text-gray-500 mb-4">
            🛈 This is a local log. Full history is saved if you are logged in.
          </p>
        </>
      )}

      {/* Emergency Overlay */}
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
            <p className="mb-3">Your check-in indicated an emergency. We’ve logged this.</p>
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
