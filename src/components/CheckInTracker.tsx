import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface CheckIn {
  timestamp: string;
  label: string;
  is_emergency: boolean;
  emotional_state?: string;
  heart_rate?: number | null;
  pulse_oximeter?: number | null;
}

const STORAGE_KEY = 'wellfitCheckIns';

export default function CheckInTracker() {
  const [history, setHistory] = useState<CheckIn[]>([]);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // New state variables for form fields
  const [emotionalState, setEmotionalState] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [pulseOximeter, setPulseOximeter] = useState('');

  // Load stored history
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setHistory(JSON.parse(raw));
      } catch {
        setHistory([]);
      }
    }
  }, []);

  // Persist on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  // Feedback messages - can be adapted or expanded
  const checkInFeedback: { [label: string]: string } = {
    '😊 Feeling Great Today': 'Awesome! Enjoy your day. 🌞',
    '📅 Feeling fine & have a Dr. Appt today': "Don't forget to show your log to the doctor. 🩺",
    '🏥 In the hospital': 'We’re thinking of you. Please call us if we can help. ❤️',
    '🧭 Need Healthcare Navigation Assistance': 'Hang tight—we will call you shortly. ☎️',
    'DefaultSuccess': 'Check-in submitted successfully!', // New default success message
  };

  // Handle check‑in action (now unified)
  const handleCheckIn = async (label: string, isEmergencyButton: boolean = false) => {
    if (!emotionalState) {
      setInfoMessage('Please select your emotional state.');
      setTimeout(() => setInfoMessage(null), 3000);
      return;
    }

    const isEmergency =
      isEmergencyButton && (label === '🚨 Fallen down & injured' || label === '🤒 Not Feeling Well');

    const timestamp = new Date().toISOString();
    const parsedHeartRate = heartRate ? parseInt(heartRate, 10) : null;
    const parsedPulseOximeter = pulseOximeter ? parseInt(pulseOximeter, 10) : null;

    const newEntry: CheckIn = {
      label,
      timestamp,
      is_emergency: isEmergency,
      emotional_state: emotionalState,
      heart_rate: parsedHeartRate,
      pulse_oximeter: parsedPulseOximeter,
    };
    setHistory((prev) => [...prev, newEntry]);

    // Show info message
    const feedbackMessage = checkInFeedback[label] || checkInFeedback['DefaultSuccess'];
    setInfoMessage(feedbackMessage);
    setTimeout(() => setInfoMessage(null), 5000);


    // Emergency popup
    if (isEmergency) {
      setShowEmergencyModal(true);
      setTimeout(() => setShowEmergencyModal(false), 5000);
    }

    // Save to Supabase if user logged in
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        // Optionally, inform user they need to be logged in to save to cloud
        // For now, it saves locally regardless.
        return;
    }

    await supabase.from('checkins').insert({
      user_id: user.id,
      timestamp,
      label,
      is_emergency: isEmergency,
      emotional_state: emotionalState,
      heart_rate: parsedHeartRate,
      pulse_oximeter: parsedPulseOximeter,
    });

    // Clear fields after successful submission
    setEmotionalState('');
    setHeartRate('');
    setPulseOximeter('');
  };

  const checkInButtons = [
    '😊 Feeling Great Today',
    '📅 Feeling fine & have a Dr. Appt today',
    '🏥 In the hospital',
    '🚨 Fallen down & injured',
    '🤒 Not Feeling Well',
    '🧭 Need Healthcare Navigation Assistance',
    '⭐ Attending the event today',
  ];

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
      <h2 className="text-2xl font-bold mb-6 text-center text-wellfit-blue">
        Check-In Center
      </h2>

      {/* New Form Fields */}
      <div className="space-y-4 mb-6">
        <div>
          <label htmlFor="emotionalState" className="block text-sm font-medium text-gray-700 mb-1">
            Emotional State <span className="text-red-500">*</span>
          </label>
          <select
            id="emotionalState"
            value={emotionalState}
            onChange={(e) => setEmotionalState(e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            {emotionalStateOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

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
            className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
            className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      {/* General Submit Button for new fields */}
      <button
        onClick={() => handleCheckIn('Daily Self-Report')}
        className="w-full py-3 px-4 mb-6 bg-wellfit-blue text-white font-semibold rounded-lg shadow-md hover:bg-opacity-90 transition"
        disabled={!emotionalState} // Disable if emotional state is not selected
      >
        Submit Check-In Details
      </button>


      {/* Quick Check-in buttons */}
      <h3 className="text-lg font-semibold mb-3 text-center text-gray-700">Or Quick Status Update:</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {checkInButtons.map((label) => (
          <button
            key={label}
            onClick={(e) => {
              handleCheckIn(label, true); // Pass true for isEmergencyButton context
              const btn = e.currentTarget;
              btn.classList.add('bg-wellfit-blue'); // Change color
              btn.classList.remove('bg-[#8cc63f]');
              setTimeout(() => {
                btn.classList.remove('bg-wellfit-blue');
                btn.classList.add('bg-[#8cc63f]');
              }, 2000);
            }}
            className="w-full py-3 px-4 bg-[#8cc63f] border-2 border-[#003865] text-white font-semibold rounded-lg shadow-md hover:bg-[#77aa36] transition"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Feedback Message */}
      {infoMessage && (
        <div className={`mb-4 p-4 text-white ${infoMessage.includes('Please select') ? 'bg-red-500' : 'bg-[#003865]'} rounded text-center font-medium`}>
          {infoMessage}
        </div>
      )}

      {/* History display */}
      {history.length > 0 && (
        <>
          <h3 className="text-lg font-semibold mb-2 text-center">
            Your Recent Check‑Ins
          </h3>
          <ul className="mb-4 space-y-2 text-sm text-gray-700 max-h-48 overflow-y-auto p-2 border rounded-md bg-gray-50">
            {history.slice().reverse().map((h, i) => ( // Show newest first
              <li key={i} className="p-2 border-b last:border-b-0">
                <strong>{h.label}</strong> — {new Date(h.timestamp).toLocaleString()}
                {h.emotional_state && <div className="text-xs">Feeling: {h.emotional_state}</div>}
                {h.heart_rate !== null && typeof h.heart_rate !== 'undefined' && <div className="text-xs">HR: {h.heart_rate} BPM</div>}
                {h.pulse_oximeter !== null && typeof h.pulse_oximeter !== 'undefined' && <div className="text-xs">SpO2: {h.pulse_oximeter}%</div>}
              </li>
            ))}
          </ul>
          <p className="text-sm text-center text-gray-500 mb-4">
            🛈 This is a local log. Full history is saved if you are logged in. Export feature will be available soon.
          </p>
        </>
      )}

      {/* Emergency Overlay */}
      {showEmergencyModal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-red-600 text-white p-6 rounded-xl shadow-lg max-w-sm text-center animate-pulse">
            <h3 className="text-xl font-bold mb-2">🚨 Emergency Alert Triggered</h3>
            <p className="mb-3">
              Your check-in indicated an emergency. We've logged this.
            </p>
            <p>
              If you are in immediate danger or need urgent medical attention, please call <strong>911</strong> or your local emergency number now.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

