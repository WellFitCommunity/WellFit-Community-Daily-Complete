/**
 * RemindersView — Upcoming dose reminders display
 *
 * Shows next 24 hours of scheduled medication doses with "Mark Taken" actions.
 * Used in the "Reminders" tab.
 */

import React from 'react';
import { Clock, Bell, CheckCircle } from 'lucide-react';
import { RemindersViewProps, UpcomingDose } from './MedicineCabinet.types';

export const RemindersView: React.FC<RemindersViewProps> = ({ upcomingDoses, onTakeDose }) => {
  return (
    <div className="bg-white rounded-xl shadow-md p-8">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Bell className="w-6 h-6 text-purple-600" />
        Upcoming Doses (Next 24 Hours)
      </h2>

      <div className="space-y-3">
        {upcomingDoses.map((dose: UpcomingDose, idx: number) => (
          <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 rounded-full p-2">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{dose.medication_name}</h3>
                <p className="text-sm text-gray-600">{dose.dosage} - {dose.instructions}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(dose.next_reminder_at).toLocaleString()}
                </p>
              </div>
            </div>
            <button
              onClick={() => onTakeDose(dose.medication_id)}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Mark Taken
            </button>
          </div>
        ))}

        {upcomingDoses.length === 0 && (
          <div className="text-center py-12">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No upcoming doses</p>
            <p className="text-gray-400 text-sm">You're all caught up!</p>
          </div>
        )}
      </div>
    </div>
  );
};
