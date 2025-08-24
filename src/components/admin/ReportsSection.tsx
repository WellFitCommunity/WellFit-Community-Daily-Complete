// src/components/ReportsSection.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { saveAs } from 'file-saver';

interface EngagementStats {
  totalCheckIns: number;
  mealsPrepared: number;   // Placeholder until you wire a real table
  techTipsViewed: number;  // Placeholder until you wire a real table
  activeUsers: number;
}

const ReportsSection: React.FC = () => {
  const supabase = useSupabaseClient();

  const [stats, setStats] = useState<EngagementStats>({
    totalCheckIns: 0,
    mealsPrepared: 0,
    techTipsViewed: 0,
    activeUsers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<null | 'summary' | 'self'>(null);

  const fetchReportStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Total check-ins (count only)
      const { count: totalCheckInsCount, error: checkInsError } = await supabase
        .from('check_ins')
        .select('*', { count: 'exact', head: true });

      // Registered users: try a view first, fall back to profiles
      let totalUsersCount = 0;
      const tryView = await supabase
        .from('profiles_with_user_id')
        .select('user_id', { count: 'exact', head: true });

      if (tryView.error) {
        const tryProfiles = await supabase
          .from('profiles')
          .select('user_id', { count: 'exact', head: true });
        if (tryProfiles.error) {
          console.error('Error fetching total users:', tryProfiles.error.message);
        } else {
          totalUsersCount = tryProfiles.count ?? 0;
        }
      } else {
        totalUsersCount = tryView.count ?? 0;
      }

      setStats(prev => ({
        ...prev,
        totalCheckIns: totalCheckInsCount ?? 0,
        activeUsers: totalUsersCount,
      }));

      if (checkInsError) {
        console.error('Error fetching total check-ins:', checkInsError.message);
        setError('Some stats failed to load.');
      }
    } catch (e: any) {
      console.error('Error fetching report stats:', e?.message || e);
      setError('Failed to load some report statistics.');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchReportStats();
  }, [fetchReportStats]);

  // -------- Excel Exports (lazy-load exceljs) --------
  const exportEngagementSummaryXlsx = async () => {
    setExporting('summary');
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Engagement Summary');
      ws.columns = [
        { header: 'Metric', key: 'metric', width: 28 },
        { header: 'Value', key: 'value', width: 18 },
      ];
      ws.getRow(1).font = { bold: true };

      const rows: Array<{ metric: string; value: any }> = [
        { metric: 'Total Check-Ins', value: stats.totalCheckIns },
        { metric: 'Meals Prepared', value: stats.mealsPrepared },
        { metric: 'Tech Tips Viewed', value: stats.techTipsViewed },
        { metric: 'Registered Users', value: stats.activeUsers },
        { metric: 'Generated At', value: new Date() },
      ];
      rows.forEach(r => ws.addRow(r));

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      saveAs(blob, `engagement_summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e: any) {
      const msg = e?.message || String(e);
      setError(
        msg.includes("Cannot find module 'exceljs'")
          ? 'Excel export requires exceljs. Install with: npm i exceljs'
          : `Failed to export Excel: ${msg}`
      );
    } finally {
      setExporting(null);
    }
  };

  const exportSelfReportsXlsx = async () => {
    setExporting('self');
    try {
      const { data, error: fetchError } = await supabase
        .from('self_reports')
        .select('id, user_id, created_at, mood, symptoms, activity_description, submitted_by, entry_type')
        .order('created_at', { ascending: false })
        .limit(5000); // adjust as needed

      if (fetchError) throw fetchError;

      const rows = data ?? [];

      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Self Reports');

      ws.columns = [
        { header: 'ID', key: 'id', width: 28 },
        { header: 'User', key: 'user_id', width: 36 },
        { header: 'Created', key: 'created_at', width: 24 },
        { header: 'Mood', key: 'mood', width: 14 },
        { header: 'Symptoms', key: 'symptoms', width: 50 },
        { header: 'Activity', key: 'activity_description', width: 50 },
        { header: 'Submitted By', key: 'submitted_by', width: 36 },
        { header: 'Entry Type', key: 'entry_type', width: 16 },
      ];
      ws.getRow(1).font = { bold: true };
      ws.views = [{ state: 'frozen', ySplit: 1 }];

      rows.forEach(r => {
        ws.addRow({
          ...r,
          created_at: new Date(r.created_at),
          symptoms: r.symptoms ?? '',
          activity_description: r.activity_description ?? '',
        });
      });

      // Wrap long text for readability
      ws.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          row.getCell(5).alignment = { wrapText: true, vertical: 'top' }; // Symptoms
          row.getCell(6).alignment = { wrapText: true, vertical: 'top' }; // Activity
        }
      });

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      saveAs(blob, `self_reports_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e: any) {
      const msg = e?.message || String(e);
      setError(
        msg.includes("Cannot find module 'exceljs'")
          ? 'Excel export requires exceljs. Install with: npm i exceljs'
          : `Failed to export Excel: ${msg}`
      );
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow p-4 space-y-3 text-center">
        <p className="text-gray-500">Loading reports...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-wellfit-blue">Engagement Summary</h3>
        <div className="flex gap-2">
          <button
            onClick={exportEngagementSummaryXlsx}
            disabled={!!exporting}
            className="px-3 py-1.5 rounded-md bg-[#003865] text-white text-sm font-semibold disabled:opacity-60"
            title="Export engagement metrics to Excel"
          >
            {exporting === 'summary' ? 'Exporting…' : 'Export Summary (.xlsx)'}
          </button>
          <button
            onClick={exportSelfReportsXlsx}
            disabled={!!exporting}
            className="px-3 py-1.5 rounded-md bg-[#8cc63f] text-white text-sm font-semibold disabled:opacity-60"
            title="Export self reports to Excel"
          >
            {exporting === 'self' ? 'Exporting…' : 'Export Self Reports (.xlsx)'}
          </button>
        </div>
      </div>

      {error && <p className="text-red-600 bg-red-100 p-2 rounded-md text-center">{error}</p>}

      <div className="grid grid-cols-2 gap-4 text-center text-lg font-semibold">
        <div>
          ✅ <span className="block text-sm font-normal text-gray-500">Total Check-Ins</span>
          {stats.totalCheckIns}
        </div>
        <div>
          🍽️ <span className="block text-sm font-normal text-gray-500">Meals Prepared</span>
          {stats.mealsPrepared} <em className="text-xs text-gray-400">(requires setup)</em>
        </div>
        <div>
          💡 <span className="block text-sm font-normal text-gray-500">Tech Tips Viewed</span>
          {stats.techTipsViewed} <em className="text-xs text-gray-400">(requires setup)</em>
        </div>
        <div>
          🧓 <span className="block text-sm font-normal text-gray-500">Registered Users</span>
          {stats.activeUsers}
        </div>
      </div>
    </div>
  );
};

export default ReportsSection;
