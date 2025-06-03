// src/components/ExportCheckIns.tsx

import React from 'react';
import { saveAs } from 'file-saver';

const ExportCheckIns: React.FC = () => {
  const handleExport = () => {
    // Simulated CSV content – replace with real check-in data later
    const csvContent = [
      ['Full Name', 'Phone', 'Check-In Date', 'Status'],
      ['John Doe', '555-123-4567', '2025-05-07', 'Checked In'],
      ['Jane Smith', '555-987-6543', '2025-05-07', 'Missed'],
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, 'wellfit-checkins.csv');
  };

  return (
    <div className="text-center">
      <button
        onClick={handleExport}
        className="bg-wellfit-green text-white px-6 py-3 rounded-lg shadow hover:bg-wellfit-blue transition"
      >
        📤 Export Check-In Data
      </button>
    </div>
  );
};

export default ExportCheckIns;
