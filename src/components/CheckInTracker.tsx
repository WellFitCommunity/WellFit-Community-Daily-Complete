import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface CheckIn {
  timestamp: string;
  label: string;
  is_emergency: boolean;
}

const STORAGE_KEY = 'wellfitCheckIns';

export default function CheckInTracker() {
  const [history, setHistory] = useState<CheckIn[]>([]);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

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

  // Feedback messages
  const checkInFeedback: { [label: string]: string } = {
    '😊 Feeling Great Today': 'Awesome! Enjoy your day. 🌞',
    '📅 Feeling fine & have a Dr. Appt today': "Don't forget to show your log to the doctor. 🩺",
    '🏥 In the hospital': 'We’re thinking of you. Please call us if we can help. ❤️',
    '🧭 Need Healthcare Navigation Assistance': 'Hang tight—we will call you shortly. ☎️',
  };

  // Handle check‑in action
  const handleCheckIn = async (label: string) => {
    const isEmergency =
      label === '🚨 Fallen down & injured' || label === '🤒 Not Feeling Well';

    const timestamp = new Date().toISOString();
    const newEntry: CheckIn = { label, timestamp, is_emergency: isEmergency };
    setHistory((prev) => [...prev, newEntry]);

    // Show info message
    if (checkInFeedback[label]) {
      setInfoMessage(checkInFeedback[label]);
      setTimeout(() => setInfoMessage(null), 5000);
    }

    // Emergency popup
    if (isEmergency) {
      setShowEmergencyModal(true);
      setTimeout(() => setShowEmergencyModal(false), 5000);
    }

    // Save to Supabase if user logged in
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('checkins').insert({
      user_id: user.id,
      timestamp,
      label,
      is_emergency: isEmergency,
    });
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

  return (
    <div className="relative max-w-xl mx-auto p-6 bg-white rounded-xl shadow-md border-2 border-wellfitGreen">
      <h2 className="text-2xl font-bold mb-4 text-center text-wellfit-blue">
        Check-In Center
      </h2>

      {/* Check-in buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {checkInButtons.map((label) => (
          <button
            key={label}
            onClick={(e) => {
              handleCheckIn(label);
              const btn = e.currentTarget;
              btn.style.backgroundColor = '#003865';
              setTimeout(() => (btn.style.backgroundColor = '#8cc63f'), 2000);
            }}
            className="w-full py-3 px-4 bg-[#8cc63f] border-2 border-[#003865] text-white font-semibold rounded-lg shadow-md hover:bg-[#77aa36] transition"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Feedback Message */}
      {infoMessage && (
        <div className="mb-4 p-4 text-white bg-[#003865] rounded text-center font-medium">
          {infoMessage}
        </div>
      )}

      {/* History display */}
      {history.length > 0 && (
        <>
          <h3 className="text-lg font-semibold mb-2 text-center">
            Your Check‑In History
          </h3>
          <ul className="mb-4 space-y-1 text-sm text-gray-700 max-h-40 overflow-y-auto">
            {history.map((h, i) => (
              <li key={i}>
                <strong>{h.label}</strong> —{' '}
                {new Date(h.timestamp).toLocaleString()}
              </li>
            ))}
          </ul>
          <p className="text-sm text-center text-gray-500 mb-4">
            🛈 Export feature will be available soon. Please show this screen to your doctor or caregiver.
          </p>
        </>
      )}

      {/* Emergency Overlay */}
      {showEmergencyModal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-red-600 text-white p-6 rounded-xl shadow-lg max-w-sm text-center animate-pulse">
            <h3 className="text-xl font-bold mb-2">🚨 Emergency Alert</h3>
            <p>
              If this is an emergency, please call <strong>911</strong> immediately.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

