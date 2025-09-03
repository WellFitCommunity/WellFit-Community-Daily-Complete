// src/pages/ReportsPrintPage.tsx
// Print-optimized reports page with optional date range, engagement summary,
// self-reports (from health_entries), and Excel export (lazy exceljs).
// Uses custom Supabase client/hooks from ../../lib/supabaseClient (adjust depth if needed).

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useSupabaseClient } from '../lib/supabaseClient'; // ← per your request; change to '../lib/...' if your path differs
import { saveAs } from 'file-saver';
import { useBranding } from '../BrandingContext';

// Types
interface EngagementStats {
  totalCheckIns: number;
  mealsPrepared: number;   // placeholder for future wiring
  techTipsViewed: number;  // placeholder for future wiring
  activeUsers: number;
}

type SourceType = 'self' | 'staff';

interface SelfReportRow {
  id: string | number;
  user_id: string;
  created_at: string; // ISO
  mood: string;
  symptoms?: string | null;
  activity_description?: string | null;
  // Added health metrics
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  pulse?: number | null;
  glucose?: number | null;
  submitted_by: string | null; // inferred for now
  entry_type: string;
  source_type: SourceType; // derived client-side
}

const DEFAULT_LIMIT = 1000; // print cap

function isoDay(d: Date): string {
  // yyyy-mm-dd (local)
  const dt = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return dt.toISOString().slice(0, 10);
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

  // Date range: last 30 days
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

  // Derived mood summary
  const moodCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const key = r.mood || 'Unknown';
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const fetchEngagement = useCallback(async () => {
    try {
      const [{ count: checkInCount, error: e1 }] = await Promise.all([
        supabase.from('check_ins').select('*', { head: true, count: 'exact' }),
      ]);

      // Count users: prefer view if present, otherwise profiles(id)
      let totalUsersCount = 0;
      const viewTry = await supabase
        .from('profiles_with_user_id')
        .select('user_id', { head: true, count: 'exact' });
      if (!viewTry.error) {
        totalUsersCount = viewTry.count ?? 0;
      } else {
        const profTry = await supabase
          .from('profiles')
          .select('id', { head: true, count: 'exact' });
        if (!profTry.error) totalUsersCount = profTry.count ?? 0;
      }

      if (e1) {
        console.error('check_ins count error:', e1.message);
      }

      setStats((s) => ({
        ...s,
        totalCheckIns: checkInCount ?? 0,
        activeUsers: totalUsersCount,
      }));
    } catch (e: any) {
      console.error(e);
      setError('Failed to load engagement stats.');
    }
  }, [supabase]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!from || !to) {
        setRows([]);
        setTruncated(false);
        setLoading(false);
        return;
      }
      const fromIso = startOfDayIso(from);
      const toIso = endOfDayIso(to);

      // Pull self-reports from health_entries; `data` JSON holds fields
      const { data, error: err } = await supabase
        .from('health_entries')
        .select('id, user_id, created_at, entry_type, data')
        .eq('entry_type', 'self_report')
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at', { ascending: true })
        .limit(DEFAULT_LIMIT + 1); // one extra to detect truncation

      if (err) throw err;

      const list: SelfReportRow[] = (data ?? []).map((r: any) => {
        const d = r?.data || {};

        // Mood + narrative fields
        const mood = (d.mood ?? '').toString();
        const symptoms = d.symptoms ?? null;
        const activity_description = d.activity_description ?? null;

        // Health metrics (defensive aliases)
        const bp_systolic =
          numberOrNull(d.bp_systolic) ??
          numberOrNull(d.systolic) ??
          numberOrNull(d.blood_pressure_systolic);

        const bp_diastolic =
          numberOrNull(d.bp_diastolic) ??
          numberOrNull(d.diastolic) ??
          numberOrNull(d.blood_pressure_diastolic);

        const pulse =
          numberOrNull(d.pulse) ??
          numberOrNull(d.heart_rate) ??
          numberOrNull(d.hr);

        const glucose =
          numberOrNull(d.glucose) ??
          numberOrNull(d.blood_glucose) ??
          numberOrNull(d.blood_sugar) ??
          numberOrNull(d.bg);

        // We don't have submitted_by in health_entries by default; assume self
        const submitted_by = r.user_id as string;
        const source_type: SourceType = 'self';

        return {
          id: r.id,
          user_id: r.user_id,
          created_at: r.created_at,
          entry_type: r.entry_type,
          mood,
          symptoms,
          activity_description,
          bp_systolic,
          bp_diastolic,
          pulse,
          glucose,
          submitted_by,
          source_type,
        };
      });

      if (list.length > DEFAULT_LIMIT) {
        setRows(list.slice(0, DEFAULT_LIMIT));
        setTruncated(true);
      } else {
        setRows(list);
        setTruncated(false);
      }
    } catch (e: any) {
      console.error(e);
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

  const handlePrint = () => window.print();

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

      // Sheet 3: Self Reports (detailed)
      const s3 = wb.addWorksheet('Self Reports');
      s3.columns = [
        { header: 'Created', key: 'created_at', width: 24 },
        { header: 'User', key: 'user_id', width: 36 },
        { header: 'Mood', key: 'mood', width: 16 },
        { header: 'BP Systolic', key: 'bp_systolic', width: 12 },
        { header: 'BP Diastolic', key: 'bp_diastolic', width: 12 },
        { header: 'Pulse', key: 'pulse', width: 12 },
        { header: 'Glucose', key: 'glucose', width: 12 },
        { header: 'Symptoms', key: 'symptoms', width: 42 },
        { header: 'Activity', key: 'activity_description', width: 42 },
        { header: 'Source', key: 'source_type', width: 10 },
        { header: 'Entry Type', key: 'entry_type', width: 14 },
        { header: 'ID', key: 'id', width: 24 },
      ];
      s3.getRow(1).font = { bold: true };
      s3.views = [{ state: 'frozen', ySplit: 1 }];

      rows.forEach((r) => {
        s3.addRow({
          ...r,
          created_at: new Date(r.created_at),
          symptoms: r.symptoms ?? '',
          activity_description: r.activity_description ?? '',
        });
      });

      // Wrap long text
      s3.eachRow((row, idx) => {
        if (idx > 1) {
          row.getCell(8).alignment = { wrapText: true, vertical: 'top' }; // Symptoms
          row.getCell(9).alignment = { wrapText: true, vertical: 'top' }; // Activity
        }
      });

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      saveAs(blob, `wellfit_reports_${from}_to_${to}.xlsx`);
    } catch (e: any) {
      const msg = e?.message || String(e);
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
          <button onClick={() => fetchReports()} className="px-3 py-2 rounded bg-gray-100 border hover:bg-gray-200">Refresh</button>
          <button onClick={handleExportXlsx} disabled={exporting} className="px-3 py-2 rounded bg-[#003865] text-white disabled:opacity-60">{exporting ? 'Exporting…' : 'Export .xlsx'}</button>
          <button onClick={handlePrint} className="px-3 py-2 rounded bg-[#8cc63f] text-white">Print</button>
        </div>
      </div>

      {/* Error */}
      {error && <div className="no-print mb-3 p-2 rounded bg-red-100 text-red-700">{error}</div>}

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

        {/* Mood breakdown */}
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
                  <th className="border px-2 py-1 text-left">BP (Sys/Dia)</th>
                  <th className="border px-2 py-1 text-left">Pulse</th>
                  <th className="border px-2 py-1 text-left">Glucose</th>
                  <th className="border px-2 py-1 text-left">Symptoms</th>
                  <th className="border px-2 py-1 text-left">Activity</th>
                  <th className="border px-2 py-1 text-left">Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="border px-2 py-1">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="border px-2 py-1">{r.user_id}</td>
                    <td className="border px-2 py-1">{r.mood || '—'}</td>
                    <td className="border px-2 py-1">
                      {(r.bp_systolic ?? '') || (r.bp_diastolic ?? '') ? `${r.bp_systolic ?? '—'}/${r.bp_diastolic ?? '—'}` : '—'}
                    </td>
                    <td className="border px-2 py-1">{r.pulse ?? '—'}</td>
                    <td className="border px-2 py-1">{r.glucose ?? '—'}</td>
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
          <div className="mt-2 text-xs text-gray-500">
            Showing first {DEFAULT_LIMIT} rows (truncated). Narrow the date range to include all rows.
          </div>
        )}
        <div className="mt-3 text-xs text-gray-500">Generated at {new Date().toLocaleString()}</div>
      </div>
    </div>
  );
};

// Helpers
function numberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default ReportsPrintPage;

