// src/components/ExportCheckIns.tsx
import React, { useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { saveAs } from 'file-saver';

interface CheckInRecord {
  user_id: string;
  check_in_date: string; // Assuming ISO date string
  status: string;
  // Optional profile data after joining/fetching
  full_name?: string;
  phone?: string;
}

const ExportCheckIns: React.FC = () => {
  const supabase = useSupabaseClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAllCheckInsWithProfiles = async (): Promise<CheckInRecord[]> => {
    // Fetch all check-ins
    // Note: For large datasets, consider pagination or server-side CSV generation.
    const { data: checkIns, error: checkInsError } = await supabase
      .from('check_ins') // Assumption: 'check_ins' table exists
      .select('user_id, check_in_date, status')
      .order('check_in_date', { ascending: false });

    if (checkInsError) {
      console.error('Error fetching check-ins:', checkInsError.message);
      throw new Error(`Failed to fetch check-in data: ${checkInsError.message}`);
    }
    if (!checkIns) return [];

    // Get unique user_ids from check-ins to fetch profiles
    const userIds = [...new Set(checkIns.map(ci => ci.user_id))];

    if (userIds.length === 0) return checkIns as CheckInRecord[];

    // Fetch profiles for these user_ids
    // Note: This is an N+1 pattern if many users. Better to use a view or function in Supabase.
    // For this component, we'll proceed but acknowledge this limitation.
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles_with_user_id') // Assumption: 'profiles_with_user_id' view/table exists
      .select('user_id, first_name, last_name, phone')
      .in('user_id', userIds);

    if (profilesError) {
      console.error('Error fetching profiles for check-ins:', profilesError.message);
      // Proceed with check-ins but profile data will be missing
    }

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]));

    return checkIns.map(ci => {
      const profile = profileMap.get(ci.user_id);
      return {
        ...ci,
        full_name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'N/A',
        phone: profile?.phone || 'N/A',
      };
    });
  };


  const handleExport = async () => {
    setLoading(true);
    setError(null);
    try {
      const recordsToExport = await fetchAllCheckInsWithProfiles();

      if (recordsToExport.length === 0) {
        alert('No check-in data available to export.'); // Or use a more integrated notification
        setLoading(false);
        return;
      }

      const csvHeader = ['Full Name', 'Phone', 'Check-In Date', 'Status'];
      const csvRows = recordsToExport.map(record => [
        `"${record.full_name?.replace(/"/g, '""') || 'N/A'}"`, // Escape quotes
        `"${record.phone?.replace(/"/g, '""') || 'N/A'}"`,
        `"${new Date(record.check_in_date).toLocaleDateString()}"`, // Format date
        `"${record.status?.replace(/"/g, '""') || 'N/A'}"`,
      ]);

      const csvContent = [csvHeader.join(','), ...csvRows.map(row => row.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `wellfit-checkins-${new Date().toISOString().split('T')[0]}.csv`);

    } catch (e: any) {
      console.error('Export failed:', e);
      setError(`Export failed: ${e.message}`);
      // Consider showing error via toast or a more visible UI element
      alert(`Export failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-center p-4">
      <button
        onClick={handleExport}
        disabled={loading}
        className="bg-wellfit-green text-white px-6 py-3 rounded-lg shadow hover:bg-wellfit-blue transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? '📤 Exporting...' : '📤 Export Check-In Data'}
      </button>
      {error && <p className="text-red-500 mt-2 bg-red-100 p-2 rounded-md">{error}</p>}
      <p className="text-xs text-gray-500 mt-2">
        Note: For large datasets, consider alternative export methods for performance.
      </p>
    </div>
  );
};

export default ExportCheckIns;
