// src/pages/ReportsPrintPage.tsx
// Print-optimized reports page with optional date range, engagement summary,
// self-reports table, and Excel export (via lazy-loaded exceljs).
// - Safe for CRA/Vite. Uses Tailwind but prints fine without it.
// - Guard this route with RequireAuth + (optionally) RequireAdminAuth in App.tsx.

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { saveAs } from 'file-saver';
import { useBranding } from '../BrandingContext';

// Types
interface EngagementStats {
  totalCheckIns: number;
  mealsPrepared: number; // placeholder until implemented
  techTipsViewed: number; // placeholder until implemented
  activeUsers: number;
}

type SourceType = 'self' | 'staff';

interface SelfReportRow {
  id: number;
  user_id: string;
  created_at: string; // ISO
  mood: string;
  symptoms?: string | null;
  activity_description?: string | null;
  submitted_by: string;
  entry_type: string;
  source_type: SourceType; // derived client-side
}

const DEFAULT_LIMIT = 1000; // print cap

function isoDay(d: Date): string {
  // yyyy-mm-dd
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function startOfDayIso(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toISOString();
}

function endOfDayIso(dateStr: string): string {
  return new Date(dateStr + 'T23:59:59.999').toISOString();
}

const ReportsPrintPage: React.FC = () => {
  const supabase = useSupabaseClient();
  const branding = useBranding();

  // Date range: default last 30 days
  const [from, setFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return isoDay(d);
  });
  const [to, setTo] = useState<string>(() => isoDay(new Date()));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<EngagementStats>({
    totalCheckIns: 0,
    mealsPrepared: 0,
    techTipsViewed: 0,
    activeUsers: 0,
  });
  const [rows, setRows] = useState<SelfReportRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Derived quick summary by mood
  const moodCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      map.set(r.mood, (map.get(r.mood) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const fetchEngagement = useCallback(async () => {
    try {
      const [{ count: totalCheckInsCount, error: e1 }] = await Promise.all([
        supabase.from('check_ins').select('*', { head: true, count: 'exact' }),
      ]);

      let totalUsersCount = 0;
      const viewTry = await supabase
        .from('profiles_with_user_id')
        .select('user_id', { head: true, count: 'exact' });
      if (viewTry.error) {
        const profTry = await supabase
          .from('profiles')
          .select('user_id', { head: true, count: 'exact' });
        if (!profTry.error) totalUsersCount = profTry.count ?? 0;
      } else {
        totalUsersCount = viewTry.count ?? 0;
      }

      if (e1) {
        // log, but don’t fail the whole page
        // eslint-disable-next-line no-console
        console.error('check_ins count error:', e1.message);
      }

      setStats(s => ({
        ...s,
        totalCheckIns: totalCheckInsCount ?? 0,
        activeUsers: totalUsersCount,
      }));
    } catch (e: any) {
      setError('Failed to load engagement stats.');
    }
  }, [supabase]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Range guard
      if (!from || !to) {
        setRows([]);
        setTruncated(false);
        setLoading(false);
        return;
      }
      const fromIso = startOfDayIso(from);
      const toIso = endOfDayIso(to);

      const { data, error: err } = await supabase
        .from('self_reports')
        .select('id, user_id, created_at, mood, symptoms, activity_description, submitted_by, entry_type')
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at', { ascending: true })
        .limit(DEFAULT_LIMIT + 1); // fetch one extra to detect truncation

      if (err) throw err;
      const list = (data ?? []).map((r: any) => ({
        ...r,
        source_type: r.user_id === r.submitted_by ? 'self' : 'staff',
      })) as SelfReportRow[];

      if (list.length > DEFAULT_LIMIT) {
        setRows(list.slice(0, DEFAULT_LIMIT));
        setTruncated(true);
      } else {
        setRows(list);
        setTruncated(false);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load reports.');
      setRows([]);
      setTruncated(false);
    } finally {
      setLoading(false);
    }
  }, [supabase, from, to]);

  useEffect(() => {
    fetchEngagement();
  }, [fetchEngagement]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportXlsx = async () => {
    setExporting(true);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();

      // Sheet 1: Engagement Summary
      const s1 = wb.addWorksheet('Engagement Summary');
      s1.columns = [
        { header: 'Metric', key: 'metric', width: 28 },
        { header: 'Value', key: 'value', width: 18 },
      ];
      s1.getRow(1).font = { bold: true };
      s1.addRow({ metric: 'Total Check-Ins', value: stats.totalCheckIns });
      s1.addRow({ metric: 'Meals Prepared', value: stats.mealsPrepared });
      s1.addRow({ metric: 'Tech Tips Viewed', value: stats.techTipsViewed });
      s1.addRow({ metric: 'Registered Users', value: stats.activeUsers });
      s1.addRow({ metric: 'From', value: from });
      s1.addRow({ metric: 'To', value: to });
      s1.addRow({ metric: 'Generated At', value: new Date() });

      // Sheet 2: Mood Summary
      const s2 = wb.addWorksheet('Mood Summary');
      s2.columns = [
        { header: 'Mood', key: 'mood', width: 22 },
        { header: 'Count', key: 'count', width: 12 },
      ];
      s2.getRow(1).font = { bold: true };
      moodCounts.forEach(([mood, count]) => s2.addRow({ mood, count }));

      // Sheet 3: Self Reports
      const s3 = wb.addWorksheet('Self Reports');
      s3.columns = [
        { header: 'Created', key: 'created_at', width: 24 },
        { header: 'User', key: 'user_id', width: 36 },
        { header: 'Mood', key: 'mood', width: 14 },
        { header: 'Symptoms', key: 'symptoms', width: 50 },
        { header: 'Activity', key: 'activity_description', width: 50 },
        { header: 'Source', key: 'source_type', width: 12 },
        { header: 'Submitted By', key: 'submitted_by', width: 36 },
        { header: 'Entry Type', key: 'entry_type', width: 16 },
        { header: 'ID', key: 'id', width: 24 },
      ];
      s3.getRow(1).font = { bold: true };
      s3.views = [{ state: 'frozen', ySplit: 1 }];

      rows.forEach(r => {
        s3.addRow({
          ...r,
          created_at: new Date(r.created_at),
          symptoms: r.symptoms ?? '',
          activity_description: r.activity_description ?? '',
        });
      });
      // Wrap long text
      s3.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          row.getCell(4).alignment = { wrapText: true, vertical: 'top' }; // Symptoms
          row.getCell(5).alignment = { wrapText: true, vertical: 'top' }; // Activity
        }
      });

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      saveAs(blob, `wellfit_reports_${from}_to_${to}.xlsx`);
    } catch (e: any) {
      const msg = e?.message || String(e);
      // eslint-disable-next-line no-alert
      alert(
        msg.includes("Cannot find module 'exceljs'")
          ? 'Excel export requires exceljs. Install with: npm i exceljs'
          : `Failed to export Excel: ${msg}`
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 print:p-0">
      {/* Print styles */}
      <style>{`
        @page { size: auto; margin: 12mm; }
        @media print {
          .no-print { display: none !important; }
          .print-card { box-shadow: none !important; border: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          a[href]:after { content: ''; }
        }
      `}</style>

      {/* Controls (hidden on print) */}
      <div className="no-print flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: branding.primaryColor }}>WellFit Reports</h1>
          <p className="text-sm text-gray-600">Printable summary and detailed self-reports</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-sm text-gray-700">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm text-gray-700">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border rounded px-2 py-1" />
          </div>
          <button onClick={fetchReports} className="px-3 py-2 rounded bg-gray-100 border hover:bg-gray-200">Refresh</button>
          <button onClick={handleExportXlsx} disabled={exporting} className="px-3 py-2 rounded bg-[#003865] text-white disabled:opacity-60">{exporting ? 'Exporting…' : 'Export .xlsx'}</button>
          <button onClick={handlePrint} className="px-3 py-2 rounded bg-[#8cc63f] text-white">Print</button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="no-print mb-3 p-2 rounded bg-red-100 text-red-700">{error}</div>
      )}

      {/* Engagement Summary */}
      <div className="print-card bg-white rounded-xl shadow p-4 mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold" style={{ color: branding.primaryColor }}>Engagement Summary</h2>
          <div className="text-sm text-gray-500">Range: {from} → {to}</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center mt-3">
          <div className="p-3 border rounded">
            <div className="text-sm text-gray-500">Total Check-Ins</div>
            <div className="text-2xl font-bold">{stats.totalCheckIns}</div>
          </div>
          <div className="p-3 border rounded">
            <div className="text-sm text-gray-500">Meals Prepared</div>
            <div className="text-2xl font-bold">{stats.mealsPrepared}</div>
          </div>
          <div className="p-3 border rounded">
            <div className="text-sm text-gray-500">Tech Tips Viewed</div>
            <div className="text-2xl font-bold">{stats.techTipsViewed}</div>
          </div>
          <div className="p-3 border rounded">
            <div className="text-sm text-gray-500">Registered Users</div>
            <div className="text-2xl font-bold">{stats.activeUsers}</div>
          </div>
        </div>

        {/* Mood breakdown (nice on print) */}
        {moodCounts.length > 0 && (
          <div className="mt-4">
            <h3 className="font-semibold mb-2">Mood Breakdown</h3>
            <table className="w-full border text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border px-2 py-1 text-left">Mood</th>
                  <th className="border px-2 py-1 text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {moodCounts.map(([m, c]) => (
                  <tr key={m}>
                    <td className="border px-2 py-1">{m}</td>
                    <td className="border px-2 py-1 text-right">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Self Reports Table */}
      <div className="print-card bg-white rounded-xl shadow p-4">
        <h2 className="text-xl font-semibold mb-2" style={{ color: branding.primaryColor }}>Self Reports</h2>
        {loading ? (
          <div className="text-gray-500">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-gray-500">No self-reports in this range.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border px-2 py-1 text-left">Created</th>
                  <th className="border px-2 py-1 text-left">User</th>
                  <th className="border px-2 py-1 text-left">Mood</th>
                  <th className="border px-2 py-1 text-left">Symptoms</th>
                  <th className="border px-2 py-1 text-left">Activity</th>
                  <th className="border px-2 py-1 text-left">Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td className="border px-2 py-1">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="border px-2 py-1">{r.user_id}</td>
                    <td className="border px-2 py-1">{r.mood}</td>
                    <td className="border px-2 py-1 whitespace-pre-wrap">{r.symptoms || '—'}</td>
                    <td className="border px-2 py-1 whitespace-pre-wrap">{r.activity_description || '—'}</td>
                    <td className="border px-2 py-1">{r.source_type === 'self' ? 'Self' : 'Staff'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {truncated && (
          <div className="mt-2 text-xs text-gray-500">Showing first {DEFAULT_LIMIT} rows (truncated). Narrow the date range to include all rows.</div>
        )}
        <div className="mt-3 text-xs text-gray-500">Generated at {new Date().toLocaleString()}</div>
      </div>
    </div>
  );
};

export default ReportsPrintPage;
