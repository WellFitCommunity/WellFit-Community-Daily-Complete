// Micro-Break Routine — Quick exercises between patients
// Research shows micro-breaks reduce fatigue and improve focus

import React from 'react';

const exercises = [
  { name: 'Neck Rolls', duration: '30 seconds', instruction: 'Slowly roll your head in circles, 3 times each direction' },
  { name: 'Shoulder Shrugs', duration: '30 seconds', instruction: 'Raise shoulders to ears, hold 3 seconds, release. Repeat 5 times.' },
  { name: 'Hand Massage', duration: '1 minute', instruction: 'Massage each hand, focusing on thumb and palm pressure points' },
  { name: 'Deep Breaths', duration: '1 minute', instruction: 'Take 5 deep belly breaths, exhaling slowly' },
];

export const MicroBreakRoutine: React.FC = () => {
  return (
    <div>
      <p className="text-gray-700 mb-4">
        These quick exercises can be done between patients or during short breaks. Research shows micro-breaks reduce fatigue and improve focus.
      </p>
      <div className="space-y-4">
        {exercises.map((exercise, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-semibold text-gray-800">{idx + 1}. {exercise.name}</h4>
              <span className="text-sm text-blue-600 font-medium">{exercise.duration}</span>
            </div>
            <p className="text-sm text-gray-600">{exercise.instruction}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
