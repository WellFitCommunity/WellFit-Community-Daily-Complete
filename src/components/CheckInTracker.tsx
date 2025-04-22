// File: src/components/CheckInTracker.tsx
import React, { useState, useEffect } from 'react';
import {
  Smile,
  CalendarCheck,
  Hospital,
  AlertCircle,
  Thermometer,
  Compass,
  Calendar as CalendarIcon,
  CheckCircle
} from 'lucide-react';

const options = [
  { label: "I'm feeling great today", icon: Smile },
  { label: "I'm feeling fine & I have a Dr. Appt today", icon: CalendarCheck },
  { label: "I'm in the Hospital", icon: Hospital },
  { label: "I have fallen down & I injured myself", icon: AlertCircle },
  { label: "I don't feel well", icon: Thermometer },
  { label: "I need Healthcare Navigation Assistance", icon: Compass },
  { label: "I will be attending the event today", icon: CalendarIcon },
];

const CheckInTracker: React.FC = () => {
  const [lastChoice, setLastChoice] = useState<string | null>(null);
  const [activeBtn, setActiveBtn] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('lastCheckIn');
    if (stored) setLastChoice(stored);
  }, []);

  const handleClick = (idx: number) => {
    const choice = options[idx].label;
    const entry = `${new Date().toLocaleString()}: ${choice}`;
    localStorage.setItem('lastCheckIn', entry);
    setLastChoice(entry);

    setActiveBtn(idx);
    setTimeout(() => setActiveBtn(null), 2000);
  };

  return (
    <div className="max-w-md mx-auto mt-6">
      <section className="bg-white border-2 border-wellfit-blue p-6 rounded-2xl shadow-lg">
        <h2 className="text-2xl font-semibold text-wellfit-blue mb-4 text-center">
          Daily Check‑In
        </h2>

        <div className="space-y-3">
          {options.map(({ label, icon: Icon }, i) => (
            <button
              key={i}
              onClick={() => handleClick(i)}
              className={`
                flex items-center w-full px-6 py-3 text-lg rounded-2xl shadow-lg border-2 border-wellfit-blue
                ${activeBtn === i ? 'bg-wellfit-blue text-white' : 'bg-wellfit-green text-white'}
                transition-colors duration-200
              `}
            >
              <Icon className="inline-block w-6 h-6 mr-3" />
              {label}
            </button>
          ))}
        </div>

        {lastChoice && (
          <p className="mt-6 text-gray-700 flex items-center">
            <CheckCircle className="inline-block w-6 h-6 text-green-500 mr-2" />
            <span>
              Last check‑in recorded:<br />
              <strong>{lastChoice}</strong>
            </span>
          </p>
        )}
      </section>
    </div>
  );
};

export default CheckInTracker;
