// Box Breathing Exercise — Interactive resilience module content
// Used by Navy SEALs to reduce stress in high-pressure situations

import React, { useState, useEffect } from 'react';

type BreathPhase = 'inhale' | 'hold1' | 'exhale' | 'hold2';

export const BoxBreathingExercise: React.FC = () => {
  const [phase, setPhase] = useState<BreathPhase>('inhale');
  const [count, setCount] = useState(4);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!isRunning) return;

    const timer = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          setPhase((currentPhase) => {
            switch (currentPhase) {
              case 'inhale': return 'hold1';
              case 'hold1': return 'exhale';
              case 'exhale': return 'hold2';
              case 'hold2': return 'inhale';
              default: return 'inhale';
            }
          });
          return 4;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning]);

  const phaseText: Record<BreathPhase, string> = {
    inhale: 'Breathe In',
    hold1: 'Hold',
    exhale: 'Breathe Out',
    hold2: 'Hold',
  };

  return (
    <div className="text-center">
      <div className="mb-6">
        <div
          className="w-48 h-48 mx-auto rounded-full bg-blue-100 flex items-center justify-center mb-4 transition-all duration-1000"
          style={{
            transform: phase === 'inhale' || phase === 'hold1' ? 'scale(1.2)' : 'scale(1)',
            backgroundColor: phase === 'inhale' ? '#DBEAFE' : phase === 'exhale' ? '#FEF3C7' : '#E5E7EB',
          }}
        >
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-800 mb-2">{count}</div>
            <div className="text-lg text-gray-600">{phaseText[phase]}</div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setIsRunning(!isRunning)}
        className={`px-6 py-3 rounded-lg font-medium ${
          isRunning
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {isRunning ? 'Stop' : 'Start Exercise'}
      </button>

      <div className="mt-4 text-sm text-gray-600">
        <p>Follow the circle: Inhale for 4, Hold for 4, Exhale for 4, Hold for 4</p>
        <p className="mt-2">Used by Navy SEALs to reduce stress in high-pressure situations.</p>
      </div>
    </div>
  );
};
