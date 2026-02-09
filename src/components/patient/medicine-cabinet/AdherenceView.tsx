/**
 * AdherenceView — Medication adherence tracking display
 *
 * Shows per-medication adherence rates with progress bars.
 * Used in the "Adherence" tab.
 */

import React from 'react';
import { TrendingUp, Activity } from 'lucide-react';
import { AdherenceViewProps, AdherenceDataItem } from './MedicineCabinet.types';

export const AdherenceView: React.FC<AdherenceViewProps> = ({ adherenceData, medications: _medications }) => {
  // medications prop available for future enhancements
  void _medications;

  return (
    <div className="bg-white rounded-xl shadow-md p-8">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <TrendingUp className="w-6 h-6 text-green-600" />
        Medication Adherence
      </h2>

      <div className="space-y-4">
        {adherenceData.map((item: AdherenceDataItem) => {
          const rate = item.adherence_rate || 0;
          const color = rate >= 80 ? 'green' : rate >= 60 ? 'yellow' : 'red';

          return (
            <div key={item.medication_id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{item.medication_name}</h3>
                <span className={`text-${color}-600 font-bold text-lg`}>{rate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden mb-2">
                <div
                  className={`bg-${color}-500 h-full transition-all`}
                  style={{ width: `${rate}%` }}
                />
              </div>
              <p className="text-sm text-gray-600">
                {item.total_taken} of {item.total_scheduled} doses taken
              </p>
            </div>
          );
        })}

        {adherenceData.length === 0 && (
          <div className="text-center py-12">
            <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No adherence data yet</p>
            <p className="text-gray-400 text-sm">Start recording doses to see your progress</p>
          </div>
        )}
      </div>
    </div>
  );
};
