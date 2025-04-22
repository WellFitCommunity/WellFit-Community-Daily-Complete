// File: src/components/CheckInTracker.tsx
// src/components/CheckInTracker.tsx
import React, { useState, useEffect } from 'react';

const CheckInTracker: React.FC = () => {
  const [checkedIn, setCheckedIn] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('lastCheckIn');
    if (stored) {
      setLastCheckIn(stored);
      setCheckedIn(stored === new Date().toDateString());
    }
  }, []);

  const handleCheckIn = () => {
    const today = new Date().toDateString();
    localStorage.setItem('lastCheckIn', today);
    setLastCheckIn(today);
    setCheckedIn(true);
  };

  return (
    <section className="bg-white border-2 border-[#8cc63f] p-4 rounded-xl shadow">
      <h2 className="text-xl font-semibold text-[#003865] mb-2">Daily Check‑In</h2>
      {checkedIn ? (
        <p className="text-gray-700">You checked in today. Great job!</p>
      ) : (
        <button
          onClick={handleCheckIn}
          className="px-4 py-2 bg-[#003865] text-white rounded"
        >
          Check In
        </button>
      )}
      {lastCheckIn && (
        <p className="text-gray-500 text-sm mt-2">
          Last check‑in: {lastCheckIn}
        </p>
      )}
    </section>
  );
};

export default CheckInTracker;
