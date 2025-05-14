// src/components/CheckInTracker.tsx
// Clean version – removed Excel *import* block and unused handleFile.

import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
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

  // Handle check‑in action
  const handleCheckIn = async (label: string) => {
    const isEmergency =
      label === '🚨 Fallen down & injured' || label === '🤒 Not Feeling Well';

    const timestamp = new Date().toISOString();
    const newEntry: CheckIn = { label, timestamp, is_emergency: isEmergency };
    setHistory((prev) => [...prev, newEntry]);

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

  // Export to Excel
  const exportXlsx = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('checkins')
      .select('*')
      .eq('user_id', user.id);
    if (error || !data) return;

    const records = data.map((c: CheckIn, i: number) => ({
      'Check-In #': i + 1,
      Activity: c.label,
      'Timestamp (ISO)': c.timestamp,
      'Timestamp (Local)': new Date(c.timestamp).toLocaleString(),
      Emergency: c.is_emergency ? 'Yes' : 'No',
    }));

    const ws = XLSX.utils.json_to_sheet(records);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CheckIns');

    const summary = XLSX.utils.aoa_to_sheet([
      ['Total Check-Ins', data.length],
      ['Exported At', new Date().toLocaleString()],
    ]);
    XLSX.utils.book_append_sheet(wb, summary, 'Summary');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([wbout], { type: 'application/octet-stream' }),
      `WellFit-CheckIns_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
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

      {/* History + export */}
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
          <button
            onClick={exportXlsx}
            className="w-full py-2 mb-4 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition text-sm"
          >
            Export History from Supabase (.xlsx)
          </button>
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

