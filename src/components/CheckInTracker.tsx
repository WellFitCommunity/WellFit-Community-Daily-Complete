// src/components/CheckInTracker.tsx
import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

type CheckIn = {
  timestamp: string;
};

const STORAGE_KEY = 'wellfitCheckIns';

const CheckInTracker: React.FC = () => {
  const [history, setHistory] = useState<CheckIn[]>([]);

  // 1) Load existing check-ins from localStorage on mount
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

  // 2) Persist history on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  // 3) Add a new check-in
  const handleCheckIn = () => {
    const now = new Date().toISOString();
    setHistory(prev => [...prev, { timestamp: now }]);
  };

  // 4) Export history as a real .xlsx workbook
  const exportXlsx = () => {
    // Build records with human-friendly fields
    const records = history.map((h, i) => ({
      'Check-In #': i + 1,
      'Timestamp (ISO)': h.timestamp,
      'Timestamp (Local)': new Date(h.timestamp).toLocaleString(),
    }));

    // Create worksheet & workbook
    const ws = XLSX.utils.json_to_sheet(records, {
      header: ['Check-In #', 'Timestamp (ISO)', 'Timestamp (Local)']
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CheckIns');

    // Optional summary sheet
    const summary = XLSX.utils.aoa_to_sheet([
      ['Total Check-Ins', history.length],
      ['Exported At', new Date().toLocaleString()]
    ]);
    XLSX.utils.book_append_sheet(wb, summary, 'Summary');

    // Write workbook and trigger download
    const wbout = XLSX.write(wb, {
      bookType: 'xlsx',
      type: 'array',
      cellStyles: true
    });
    saveAs(
      new Blob([wbout], { type: 'application/octet-stream' }),
      `WellFit-CheckIns_${new Date().toISOString().slice(0,10)}.xlsx`
    );
  };

  // 5) Import from Excel or LibreOffice ODS
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      const data = evt.target.result as ArrayBuffer;
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      // Map rows back into our CheckIn shape
      const imported = rows
        .map(r => ({
          timestamp: r['Timestamp (ISO)'] || r['Timestamp'] || ''
        }))
        .filter(r => Boolean(r.timestamp));
      setHistory(imported);
    };
    reader.readAsArrayBuffer(file);
    // clear the input so the same file can be re-selected if needed
    e.target.value = '';
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-md border-2 border-wellfitGreen">
      <h2 className="text-2xl font-bold mb-4">Daily Check-In</h2>

      <button
        onClick={handleCheckIn}
        className="w-full py-2 mb-4 bg-wellfit-blue text-white rounded hover:bg-wellfit-green transition"
      >
        Check In Now
      </button>

      {history.length > 0 && (
        <>
          <h3 className="text-lg font-semibold mb-2">Your Check-In History</h3>
          <ul className="mb-4 space-y-1 text-sm text-gray-700 max-h-40 overflow-y-auto">
            {history.map((h, i) => (
              <li key={i}>{new Date(h.timestamp).toLocaleString()}</li>
            ))}
          </ul>
          <button
            onClick={exportXlsx}
            className="w-full py-2 mb-4 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition text-sm"
          >
            Export History as Excel (.xlsx)
          </button>
        </>
      )}

      <div className="mt-4">
        <label className="block mb-1 font-medium">Import from file:</label>
        <input
          type="file"
          accept=".xlsx,.xls,.ods"
          onChange={handleFile}
          className="w-full p-2 border rounded"
        />
      </div>
    </div>
  );
};

export default CheckInTracker;
