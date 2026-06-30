/**
 * VitalsWeeklySummary - Doctor-facing weekly-average vitals view
 *
 * Purpose: Replace the raw 90-point reading dump with one average per week so a
 * clinician can scan a month / quarter / half-year at a glance, while keeping
 * every out-of-range reading and statistical outlier always visible (they are
 * never hidden behind the "average"). A "View complete list" expander reveals
 * the full reading history on demand.
 *
 * Scope: the four senior BLE devices only (BP cuff, glucometer, pulse-ox,
 * scale). See vitalsSummaryService.
 *
 * Used by: RpmPatientDetail, DoctorsViewPage.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { AlertTriangle, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import {
  vitalsSummaryService,
  clinicalRangeFor,
  type VitalKind,
  type SummaryWindow,
  type VitalsSummary,
} from '../../services/vitalsSummaryService';

interface VitalsWeeklySummaryProps {
  patientId: string;
  /** Initial vital to display (default blood pressure). */
  initialVital?: VitalKind;
  /** Initial window (default 3 months). */
  initialWindow?: SummaryWindow;
}

const WINDOW_LABELS: Record<SummaryWindow, string> = {
  '1m': '1 Month',
  '3m': '3 Months',
  '6m': '6 Months',
};

const PRIMARY = '#00857a';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const VitalsWeeklySummary: React.FC<VitalsWeeklySummaryProps> = ({
  patientId,
  initialVital = 'blood_pressure',
  initialWindow = '3m',
}) => {
  const [vital, setVital] = useState<VitalKind>(initialVital);
  const [window, setWindow] = useState<SummaryWindow>(initialWindow);
  const [summary, setSummary] = useState<VitalsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullList, setShowFullList] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    vitalsSummaryService
      .getWeeklyVitalsSummary(patientId, vital, window)
      .then((result) => {
        if (!active) return;
        if (result.success) {
          setSummary(result.data);
        } else {
          setSummary(null);
          setError(result.error.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [patientId, vital, window]);

  const chartData = useMemo(
    () =>
      (summary?.buckets ?? []).map((b) => ({
        weekLabel: b.weekLabel,
        avg: b.avg,
      })),
    [summary]
  );

  const range = clinicalRangeFor(vital);

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
      {/* Header + controls */}
      <div className="flex flex-col gap-4 mb-5">
        <h2 className="text-xl font-bold text-gray-900 flex items-center">
          <Activity className="w-6 h-6 mr-2" style={{ color: PRIMARY }} />
          Weekly Vital Averages
        </h2>

        <div className="flex flex-wrap gap-2">
          {vitalsSummaryService.SUPPORTED_VITALS.map((v) => (
            <button
              key={v.kind}
              type="button"
              onClick={() => setVital(v.kind)}
              className={`px-4 py-2 rounded-lg text-sm font-medium min-h-[44px] transition-colors ${
                vital === v.kind
                  ? 'text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              style={vital === v.kind ? { backgroundColor: PRIMARY } : {}}
              aria-pressed={vital === v.kind}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {(['1m', '3m', '6m'] as SummaryWindow[]).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWindow(w)}
              className={`px-4 py-2 rounded-lg text-sm font-medium min-h-[44px] transition-colors ${
                window === w
                  ? 'text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              style={window === w ? { backgroundColor: PRIMARY } : {}}
              aria-pressed={window === w}
            >
              {WINDOW_LABELS[w]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-56 text-gray-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400" />
          <span className="ml-3">Loading vitals…</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : !summary || summary.totalCount === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg">No {summary?.label ?? 'vital'} readings in this window</p>
          <p className="text-sm mt-1">
            Readings from the patient's device will appear here once captured.
          </p>
        </div>
      ) : (
        <>
          {/* Weekly average chart */}
          <p className="text-sm text-gray-500 mb-2">
            {summary.label} — one point per week ({summary.unit})
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 16, left: 0, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="weekLabel" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip
                formatter={(value: number) => [`${value} ${summary.unit}`, 'Weekly avg']}
              />
              {typeof range.high === 'number' && (
                <ReferenceLine
                  y={range.high}
                  stroke="#f59e0b"
                  strokeDasharray="5 5"
                  label={{ value: `High (${range.high})`, position: 'insideTopRight', fill: '#f59e0b', fontSize: 11 }}
                />
              )}
              {typeof range.low === 'number' && (
                <ReferenceLine
                  y={range.low}
                  stroke="#3b82f6"
                  strokeDasharray="5 5"
                  label={{ value: `Low (${range.low})`, position: 'insideBottomRight', fill: '#3b82f6', fontSize: 11 }}
                />
              )}
              <Line
                type="monotone"
                dataKey="avg"
                name="Weekly avg"
                stroke={PRIMARY}
                strokeWidth={2}
                dot={{ r: 4, fill: PRIMARY }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>

          {/* Always-visible: out of range + outliers */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-red-800 flex items-center mb-2">
                <AlertTriangle className="w-4 h-4 mr-1.5" />
                Out of Range ({summary.outOfRange.length})
              </p>
              {summary.outOfRange.length === 0 ? (
                <p className="text-sm text-gray-600">No out-of-range readings.</p>
              ) : (
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {summary.outOfRange.map((r, i) => (
                    <li key={`oor-${i}`} className="text-sm text-red-900">
                      <span className="font-semibold">{r.value} {r.unit}</span>
                      <span className="text-red-700"> · {formatTime(r.measuredAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-amber-800 flex items-center mb-2">
                <Activity className="w-4 h-4 mr-1.5" />
                Outliers ({summary.outliers.length})
              </p>
              {summary.outliers.length === 0 ? (
                <p className="text-sm text-gray-600">No statistical outliers.</p>
              ) : (
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {summary.outliers.map((r, i) => (
                    <li key={`out-${i}`} className="text-sm text-amber-900">
                      <span className="font-semibold">{r.value} {r.unit}</span>
                      <span className="text-amber-700"> · {formatTime(r.measuredAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Complete list expander */}
          <button
            type="button"
            onClick={() => setShowFullList((s) => !s)}
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium min-h-[44px]"
            style={{ color: PRIMARY }}
            aria-expanded={showFullList}
          >
            {showFullList ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            {showFullList
              ? 'Hide complete reading list'
              : `View complete list (${summary.totalCount} readings)`}
          </button>

          {showFullList && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Date</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Value</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.readings
                    .slice()
                    .reverse()
                    .map((r, i) => (
                      <tr key={`row-${i}`} className="border-b border-gray-100">
                        <td className="py-2 px-3 text-gray-700">{formatTime(r.measuredAt)}</td>
                        <td className="py-2 px-3 text-gray-900 font-medium">
                          {r.value} {r.unit}
                        </td>
                        <td className="py-2 px-3">
                          {r.outOfRange && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-red-100 text-red-800 mr-1">
                              Out of range
                            </span>
                          )}
                          {r.isOutlier && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                              Outlier
                            </span>
                          )}
                          {!r.outOfRange && !r.isOutlier && (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default VitalsWeeklySummary;
