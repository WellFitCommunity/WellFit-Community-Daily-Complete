/**
 * CheckInHistory — Session-only check-in history list.
 */

import React from 'react';
import { LOCAL_HISTORY_CAP } from './CheckIn.types';
import type { CheckInHistoryProps } from './CheckIn.types';

export const CheckInHistory: React.FC<CheckInHistoryProps> = ({ history, branding }) => {
  if (history.length === 0) return null;

  return (
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
              <span className="text-gray-500 ml-2">&mdash; {new Date(h.timestamp).toLocaleString()}</span>
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
  );
};

export default CheckInHistory;
