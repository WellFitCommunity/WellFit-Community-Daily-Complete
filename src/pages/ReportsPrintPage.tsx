// src/pages/ReportsPrintPage.tsx
// Print-optimized reports page with optional date range, engagement summary,
// self-reports (from self_reports table), and CSV export.
// Uses custom Supabase client/hooks from ../../lib/supabaseClient (adjust depth if needed).

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useSupabaseClient } from '../contexts/AuthContext'; // ← per your request; change to '../lib/...' if your path differs
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
  const { branding } = useBranding();

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

      // Pull self-reports from self_reports table with direct columns
      const { data, error: err } = await supabase
        .from('self_reports')
        .select('id, user_id, created_at, mood, symptoms, activity_description, bp_systolic, bp_diastolic, heart_rate, blood_sugar, blood_oxygen, weight, physical_activity, social_engagement')
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at', { ascending: true })
        .limit(DEFAULT_LIMIT + 1); // one extra to detect truncation

      if (err) throw err;

      const list: SelfReportRow[] = (data ?? []).map((r: any) => {
        // Direct column access from self_reports table
        const mood = (r.mood ?? '').toString();
        const symptoms = r.symptoms ?? null;
        const activity_description = r.activity_description ?? null;

        // Health metrics from direct columns
        const bp_systolic = numberOrNull(r.bp_systolic);
        const bp_diastolic = numberOrNull(r.bp_diastolic);
        const pulse = numberOrNull(r.heart_rate);
        const glucose = numberOrNull(r.blood_sugar);

        // Additional metrics from self_reports table
        const blood_oxygen = numberOrNull(r.blood_oxygen);
        const weight = numberOrNull(r.weight);
        const physical_activity = r.physical_activity ?? null;
        const social_engagement = r.social_engagement ?? null;

        // self_reports table tracks user_id as the submitter
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

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      // Helper function to escape CSV values
      const escapeCsvValue = (value: any): string => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };

      // Helper function to convert array of objects to CSV
      const arrayToCsv = (data: any[], headers: string[]): string => {
        const headerRow = headers.map(escapeCsvValue).join(',');
        const dataRows = data.map(row =>
          headers.map(header => escapeCsvValue(row[header])).join(',')
        );
        return [headerRow, ...dataRows].join('\n');
      };

      // Engagement Summary CSV
      const engagementData = [
        { metric: 'Total Check-Ins', value: stats.totalCheckIns },
        { metric: 'Meals Prepared', value: stats.mealsPrepared },
        { metric: 'Tech Tips Viewed', value: stats.techTipsViewed },
        { metric: 'Registered Users', value: stats.activeUsers },
        { metric: 'From', value: from },
        { metric: 'To', value: to },
        { metric: 'Generated At', value: new Date().toISOString() }
      ];
      const engagementCsv = arrayToCsv(engagementData, ['metric', 'value']);

      // Mood Summary CSV
      const moodData = moodCounts.map(([mood, count]) => ({ mood, count }));
      const moodCsv = arrayToCsv(moodData, ['mood', 'count']);

      // Self Reports CSV
      const reportsData = rows.map((r) => ({
        created_at: new Date(r.created_at).toISOString(),
        user_id: r.user_id,
        mood: r.mood || '',
        bp_systolic: r.bp_systolic ?? '',
        bp_diastolic: r.bp_diastolic ?? '',
        pulse: r.pulse ?? '',
        glucose: r.glucose ?? '',
        symptoms: r.symptoms ?? '',
        activity_description: r.activity_description ?? '',
        source_type: r.source_type,
        entry_type: r.entry_type,
        id: r.id
      }));
      const reportsCsv = arrayToCsv(reportsData, [
        'created_at', 'user_id', 'mood', 'bp_systolic', 'bp_diastolic',
        'pulse', 'glucose', 'symptoms', 'activity_description', 'source_type', 'entry_type', 'id'
      ]);

      // Combine all data into one CSV with section headers
      const combinedCsv = [
        '# WellFit Reports Export',
        `# Generated: ${new Date().toISOString()}`,
        `# Date Range: ${from} to ${to}`,
        '',
        '# Engagement Summary',
        engagementCsv,
        '',
        '# Mood Summary',
        moodCsv,
        '',
        '# Self Reports',
        reportsCsv
      ].join('\n');

      const blob = new Blob([combinedCsv], { type: 'text/csv;charset=utf-8' });
      saveAs(blob, `wellfit_reports_${from}_to_${to}.csv`);
    } catch (e: any) {
      const msg = e?.message || String(e);
      alert(`Failed to export CSV: ${msg}`);
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
          <button onClick={handleExportCsv} disabled={exporting} className="px-3 py-2 rounded bg-[#003865] text-white disabled:opacity-60">{exporting ? 'Exporting…' : 'Export .csv'}</button>
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

