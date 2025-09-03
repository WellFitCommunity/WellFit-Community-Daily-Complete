// src/components/ExportCheckIns.tsx
import React, { useState } from 'react';
import { useSupabaseClient } from '../../lib/supabaseClient';

   // ✅ correct path
import { saveAs } from 'file-saver';

type ProfileRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
};

type CheckInRow = {
  user_id: string;
  created_at: string;
  label: string;
  is_emergency: boolean;
};

const ExportCheckIns: React.FC = () => {
  const supabase = useSupabaseClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchAll(): Promise<Array<CheckInRow & { full_name: string; phone: string }>> {
    // 1) Fetch and assert the row type so `ci` is typed in .map
    const { data: rawCheckIns, error: e1 } = await supabase
      .from('check_ins')
      .select('user_id, created_at, label, is_emergency')
      .order('created_at', { ascending: false });

    if (e1) throw new Error(`Failed to fetch check-ins: ${e1.message}`);

    const checkIns: CheckInRow[] = (rawCheckIns ?? []) as CheckInRow[];   // ✅ type the array

    if (checkIns.length === 0) return [];

    // 2) Now `ci` is typed here
    const userIds: string[] = Array.from(new Set(checkIns.map((ci: CheckInRow) => ci.user_id))); // ✅

    // Default typed map
    let profileMap: Map<string, ProfileRow> = new Map();

    if (userIds.length > 0) {
      const { data: rawProfiles, error: e2 } = await supabase
        .from('profiles_with_user_id')
        .select('user_id, first_name, last_name, phone')
        .in('user_id', userIds);

      if (!e2 && rawProfiles) {
        const profiles: ProfileRow[] = rawProfiles as ProfileRow[];       // ✅ type the array
        profileMap = new Map<string, ProfileRow>(
          profiles.map((pr: ProfileRow) => [pr.user_id, pr])              // ✅ `pr` typed
        );
      }
    }

    // 3) `ci` typed here too
    return checkIns.map((ci: CheckInRow) => {                              // ✅
      const p = profileMap.get(ci.user_id);
      const full_name = ((p?.first_name ?? '') + ' ' + (p?.last_name ?? '')).trim() || 'N/A';
      const phone = p?.phone ?? 'N/A';
      return { ...ci, full_name, phone };
    });
  }

  async function handleExport() {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchAll();
      if (rows.length === 0) {
        alert('No check-in data available to export.');
        return;
      }
      const header = ['Full Name', 'Phone', 'Date/Time', 'Label', 'Emergency'];
      const csvRows = rows.map((r) => [
        `"${r.full_name.replace(/"/g, '""')}"`,
        `"${r.phone.replace(/"/g, '""')}"`,
        `"${new Date(r.created_at).toLocaleString()}"`,
        `"${r.label.replace(/"/g, '""')}"`,
        `"${r.is_emergency ? 'Yes' : 'No'}"`,
      ]);
      const csv = [header.join(','), ...csvRows.map((c) => c.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `wellfit-checkins-${new Date().toISOString().split('T')[0]}.csv`);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Export failed');
      alert(`Export failed: ${e.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

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
        Note: For large datasets, consider server-side CSV generation.
      </p>
    </div>
  );
};

export default ExportCheckIns;
