// ============================================================================
// Wellness Report Page
// ============================================================================
// Purpose: Manager-level wellness dashboard. Embeds the existing
// AdminBurnoutRadar (unmodified) and provides CSV/PDF export of aggregate
// wellness signals across a 30/60/90 day window.
//
// Privacy posture:
//   - CSV export is DAILY AGGREGATE only — no per-provider rows, no names,
//     no identifiers. Tenant isolation is enforced by RLS, not by client
//     filters.
//   - PDF export is a print-to-PDF flow via window.print() with a print-
//     scoped stylesheet — avoids adding html2canvas/jspdf dependencies.
//   - Every export click is audit-logged so wellness data extraction is
//     traceable for HR/SOC2.
// ============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../../services/auditLogger';
import { AdminBurnoutRadar } from './AdminBurnoutRadar';

type Timeframe = 30 | 60 | 90;

interface RawCheckin {
  checkin_date: string;
  stress_level: number | null;
  energy_level: number | null;
  mood_rating: number | null;
  missed_break: boolean | null;
}

interface RawAssessment {
  assessment_date: string;
  risk_level: string | null;
}

interface DailyAggregate {
  date: string;
  checkin_count: number;
  avg_stress: number | null;
  avg_energy: number | null;
  avg_mood: number | null;
  missed_break_count: number;
  risk_low: number;
  risk_moderate: number;
  risk_high: number;
  risk_critical: number;
}

type ToastTone = 'info' | 'error';
interface ToastState {
  message: string;
  tone: ToastTone;
}

export const WellnessReportPage: React.FC = () => {
  const [timeframe, setTimeframe] = useState<Timeframe>(30);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Resolve caller's tenant for audit metadata only (RLS handles isolation)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('user_id', user.id)
          .single();
        if (!cancelled && profile?.tenant_id) setTenantId(profile.tenant_id);
      } catch {
        // Non-fatal; tenant is only used for audit metadata
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const showToast = (message: string, tone: ToastTone = 'info') => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 3500);
  };

  const buildAggregates = useCallback(
    async (days: Timeframe): Promise<DailyAggregate[]> => {
      const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const startDate = start.toISOString().split('T')[0];

      const [checkinResp, assessmentResp] = await Promise.all([
        supabase
          .from('provider_daily_checkins')
          .select('checkin_date, stress_level, energy_level, mood_rating, missed_break')
          .gte('checkin_date', startDate),
        supabase
          .from('provider_burnout_assessments')
          .select('assessment_date, risk_level')
          .gte('assessment_date', start.toISOString()),
      ]);

      if (checkinResp.error) throw checkinResp.error;

      const checkins: RawCheckin[] = checkinResp.data ?? [];
      const assessments: RawAssessment[] = assessmentResp.data ?? [];

      // Build day buckets
      const byDay = new Map<string, RawCheckin[]>();
      for (const c of checkins) {
        const arr = byDay.get(c.checkin_date) ?? [];
        arr.push(c);
        byDay.set(c.checkin_date, arr);
      }

      const riskByDay = new Map<
        string,
        { low: number; moderate: number; high: number; critical: number }
      >();
      for (const a of assessments) {
        const day = a.assessment_date.split('T')[0];
        const entry = riskByDay.get(day) ?? {
          low: 0,
          moderate: 0,
          high: 0,
          critical: 0,
        };
        const lvl = (a.risk_level ?? '').toLowerCase();
        if (lvl === 'low') entry.low++;
        else if (lvl === 'moderate') entry.moderate++;
        else if (lvl === 'high') entry.high++;
        else if (lvl === 'critical') entry.critical++;
        riskByDay.set(day, entry);
      }

      const days_ = Array.from(byDay.keys()).sort();
      const result: DailyAggregate[] = days_.map((day) => {
        const rows = byDay.get(day) ?? [];
        const stress = rows.map((r) => r.stress_level).filter((v): v is number => v != null);
        const energy = rows.map((r) => r.energy_level).filter((v): v is number => v != null);
        const mood = rows.map((r) => r.mood_rating).filter((v): v is number => v != null);
        const missed = rows.filter((r) => r.missed_break === true).length;
        const risk = riskByDay.get(day) ?? { low: 0, moderate: 0, high: 0, critical: 0 };

        const avg = (arr: number[]): number | null =>
          arr.length === 0 ? null : Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2));

        return {
          date: day,
          checkin_count: rows.length,
          avg_stress: avg(stress),
          avg_energy: avg(energy),
          avg_mood: avg(mood),
          missed_break_count: missed,
          risk_low: risk.low,
          risk_moderate: risk.moderate,
          risk_high: risk.high,
          risk_critical: risk.critical,
        };
      });
      return result;
    },
    []
  );

  const handleCsvDownload = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const aggregates = await buildAggregates(timeframe);
      const header = [
        'date',
        'checkin_count',
        'avg_stress',
        'avg_energy',
        'avg_mood',
        'missed_break_count',
        'risk_low',
        'risk_moderate',
        'risk_high',
        'risk_critical',
      ].join(',');
      const body = aggregates
        .map((a) =>
          [
            a.date,
            a.checkin_count,
            a.avg_stress ?? '',
            a.avg_energy ?? '',
            a.avg_mood ?? '',
            a.missed_break_count,
            a.risk_low,
            a.risk_moderate,
            a.risk_high,
            a.risk_critical,
          ].join(',')
        )
        .join('\n');
      const csv = `${header}\n${body}\n`;

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const filename = `wellness-report-${new Date().toISOString().split('T')[0]}-${timeframe}d.csv`;
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      await auditLogger.info('WELLNESS_REPORT_EXPORTED', {
        format: 'csv',
        timeframe,
        tenantId,
        rows: aggregates.length,
      });
      showToast(`Downloaded ${aggregates.length} daily aggregate rows.`);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('WELLNESS_REPORT_CSV_FAILED', error);
      showToast('Could not generate CSV. Please try again.', 'error');
    } finally {
      if (mountedRef.current) setExporting(false);
    }
  };

  const handlePdfDownload = async () => {
    await auditLogger.info('WELLNESS_REPORT_EXPORTED', {
      format: 'pdf',
      timeframe,
      tenantId,
    });
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Print-only styles: hide chrome, expand cards */}
      <style>{`
        @media print {
          .wr-print-hide { display: none !important; }
          .wr-print-expand { box-shadow: none !important; border: 1px solid #ccc !important; }
        }
      `}</style>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6 wr-print-hide">
          <Link
            to="/staff-wellness"
            className="inline-flex items-center gap-2 text-base text-indigo-700 hover:underline focus:outline-hidden focus:ring-2 focus:ring-indigo-500 rounded-sm px-1 py-1 min-h-[44px]"
          >
            <span aria-hidden="true">←</span>
            <span>Back to wellness radar</span>
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Wellness Report
        </h1>
        <p className="text-lg text-gray-700 mb-6">
          Aggregate, anonymized wellness signals for export. Choose a timeframe,
          then download as CSV or print-to-PDF.
        </p>

        {/* Timeframe toggle */}
        <fieldset className="mb-6 wr-print-hide">
          <legend className="text-base font-medium text-gray-800 mb-2">
            Timeframe
          </legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Report timeframe">
            {[30, 60, 90].map((d) => {
              const active = timeframe === d;
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTimeframe(d as Timeframe)}
                  className={`min-h-[44px] min-w-[88px] px-4 py-2 rounded-lg text-base font-semibold border-2 focus:outline-hidden focus:ring-2 focus:ring-indigo-400 ${
                    active
                      ? 'bg-indigo-600 text-white border-indigo-700'
                      : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Last {d} days
                </button>
              );
            })}
          </div>
        </fieldset>

        {toast && (
          <div
            role="status"
            aria-live="polite"
            className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-base font-medium wr-print-hide ${
              toast.tone === 'error'
                ? 'bg-red-100 text-red-800 border-2 border-red-300'
                : 'bg-indigo-100 text-indigo-800 border-2 border-indigo-300'
            }`}
          >
            {toast.message}
          </div>
        )}

        {/* Embedded radar */}
        <div className="mb-8 wr-print-expand">
          <AdminBurnoutRadar />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 wr-print-hide">
          <button
            type="button"
            onClick={handleCsvDownload}
            disabled={exporting}
            aria-label="Download wellness report as CSV"
            className="min-h-[44px] min-w-[44px] px-5 py-2 rounded-lg bg-indigo-600 text-white text-base font-semibold hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {exporting ? 'Preparing CSV…' : 'Download CSV'}
          </button>
          <button
            type="button"
            onClick={handlePdfDownload}
            aria-label="Download wellness report as PDF via print dialog"
            title="Opens print dialog — choose 'Save as PDF' as the destination."
            className="min-h-[44px] min-w-[44px] px-5 py-2 rounded-lg bg-white border-2 border-indigo-600 text-indigo-700 text-base font-semibold hover:bg-indigo-50 focus:outline-hidden focus:ring-2 focus:ring-indigo-400"
          >
            Download PDF
          </button>
        </div>
        <p className="mt-2 text-sm text-gray-600 wr-print-hide">
          PDF export opens the browser print dialog — choose “Save as PDF” as
          the destination. CSV rows are daily aggregates, not per-provider, so
          no identifiers are leaked.
        </p>
      </div>
    </div>
  );
};

export default WellnessReportPage;
