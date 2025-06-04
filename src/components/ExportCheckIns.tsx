// src/components/ExportCheckIns.tsx

import React, { useState, useEffect } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Define the structure of the check-in data we expect to work with
interface CheckInData {
  id: string; // Or number, depending on your DB schema for checkins PK
  user_id: string;
  timestamp: string;
  label: string;
  emotional_state?: string;
  heart_rate?: number | null;
  pulse_oximeter?: number | null;
  // Fields from profiles table
  first_name?: string;
  last_name?: string;
  phone?: string;
}

const ExportCheckIns: React.FC = () => {
  const supabase = useSupabaseClient();
  const [checkInData, setCheckInData] = useState<CheckInData[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch check-in data
  const fetchCheckInData = async () => {
    setLoading(true);
    setError(null);
    // Simulate fetching data for now
    // Replace with actual Supabase query later
    console.log("Fetching check-in data...");
    try {
      const { data, error: fetchError } = await supabase
        .from('checkins')
        .select(`
          id,
          user_id,
          timestamp,
          label,
          emotional_state,
          heart_rate,
          pulse_oximeter,
          profiles (
            first_name,
            last_name,
            phone
          )
        `)
        .order('timestamp', { ascending: false });

      if (fetchError) throw fetchError;

      // Process the data to flatten the nested profile information
      const processedData = data.map((item: any) => ({
        ...item,
        first_name: item.profiles?.first_name,
        last_name: item.profiles?.last_name,
        phone: item.profiles?.phone,
        profiles: undefined, // Remove the nested profiles object
      }));

      setCheckInData(processedData as CheckInData[] || []);
      console.log("Fetched data:", processedData);

    } catch (err) {
      const e = err as Error;
      console.error('Error fetching check-in data:', e.message);
      setError(`Failed to fetch check-in data: ${e.message}`);
      setCheckInData([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchCheckInData();
  }, [supabase]); // Dependency on supabase client

  const processDataForExport = (data: CheckInData[]) => {
    return data.map(item => ({
      'Full Name': `${item.first_name || ''} ${item.last_name || ''}`.trim(),
      'Phone': item.phone || 'N/A',
      'Check-In Date': new Date(item.timestamp).toLocaleDateString(),
      'Check-In Time': new Date(item.timestamp).toLocaleTimeString(),
      'Status/Label': item.label,
      'Emotional State': item.emotional_state || 'N/A',
      'Heart Rate (BPM)': item.heart_rate ?? 'N/A',
      'Pulse Oximeter (%)': item.pulse_oximeter ?? 'N/A',
    }));
  };

  const handleExport = async (format: 'xlsx' | 'ods') => {
    if (checkInData.length === 0) {
      setError("No data available to export. Please fetch data first.");
      // Or trigger fetchCheckInData() again if appropriate
      // await fetchCheckInData(); // an option, but be careful with UI loops
      // if (checkInData.length === 0) return; // check again after fetch attempt
      return;
    }

    setExporting(true);
    setError(null);
    try {
      const processedData = processDataForExport(checkInData);
      const worksheet = XLSX.utils.json_to_sheet(processedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'CheckIns');

      const fileType = format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/vnd.oasis.opendocument.spreadsheet';
      const fileName = `wellfit-checkins.${format}`;

      const wbout = XLSX.write(workbook, { bookType: format, type: 'array' });
      const blob = new Blob([wbout], { type: fileType });
      saveAs(blob, fileName);

    } catch (err) {
      const e = err as Error;
      console.error(`Error exporting to ${format}:`, e.message);
      setError(`Failed to export to ${format}: ${e.message}`);
    } finally {
      setExporting(false);
    }
  };


  return (
    <div className="bg-white p-6 rounded-xl shadow-lg space-y-4">
      <h3 className="text-xl font-semibold text-wellfit-blue">Export Check-In Data</h3>

      {loading && <p className="text-gray-500">Loading check-in data...</p>}
      {error && <p className="text-red-500 bg-red-100 p-3 rounded-md">{error}</p>}

      {checkInData.length > 0 && !loading && (
        <p className="text-sm text-gray-600">
          {checkInData.length} check-in record(s) loaded. Ready to export.
        </p>
      )}
       {checkInData.length === 0 && !loading && !error && (
        <p className="text-sm text-gray-600">
          No check-in data found. Try refreshing or check back later.
        </p>
      )}

      <div className="flex space-x-4">
        <button
          onClick={() => handleExport('xlsx')}
          disabled={loading || exporting || checkInData.length === 0}
          className="bg-wellfit-green text-white px-6 py-3 rounded-lg shadow hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {exporting ? 'Exporting...' : '📤 Export to Excel (XLSX)'}
        </button>
        <button
          onClick={() => handleExport('ods')}
          disabled={loading || exporting || checkInData.length === 0}
          className="bg-wellfit-orange text-white px-6 py-3 rounded-lg shadow hover:bg-orange-600 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {exporting ? 'Exporting...' : '📤 Export to ODS'}
        </button>
      </div>
      <button
        onClick={fetchCheckInData}
        disabled={loading || exporting}
        className="mt-2 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg shadow hover:bg-gray-300 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {loading ? 'Refreshing...' : '🔄 Refresh Data'}
      </button>
    </div>
  );
};

export default ExportCheckIns;
