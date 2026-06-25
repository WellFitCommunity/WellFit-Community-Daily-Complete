/**
 * EquityResults — renders an equity-analytics report.
 *
 * Report-generated data only (counts/%, distributions, cross-tabs). Small cells are shown and
 * visibly FLAGGED (never hidden) — surfacing small/underserved groups is the point. A thin or empty
 * result renders as an explained "insufficient data" state, never a broken-looking empty chart.
 */

import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EAAlert } from '../../envision-atlus/EAAlert';
import { EABadge } from '../../envision-atlus/EABadge';
import { EACard } from '../../envision-atlus/EACard';
import { EAMetricCard } from '../../envision-atlus/EAMetricCard';
import type { EquityCell, EquityReport } from '../../../services/equityAnalytics/types';

interface EquityResultsProps {
  report: EquityReport | null;
  loading: boolean;
  error: string | null;
}

const RESERVED = new Set(['value', 'cell_n', 'low_n']);
const LOW_N_COLOR = '#b45309'; // amber-700 — flagged small group
const BAR_COLOR = '#0e7490'; // cyan-700

function humanize(key: string): string {
  if (key === 'time_bucket') return 'Period';
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function dimensionKeys(rows: EquityCell[]): string[] {
  if (!rows.length) return [];
  return Object.keys(rows[0]).filter((k) => !RESERVED.has(k));
}

function fmt(value: number | null): string {
  if (value == null) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export const EquityResults: React.FC<EquityResultsProps> = ({ report, loading, error }) => {
  if (loading) {
    return <p className="text-lg text-gray-600 py-8" role="status">Compiling report…</p>;
  }
  if (error) {
    return <EAAlert variant="critical" title="Could not run report">{error}</EAAlert>;
  }
  if (!report) {
    return (
      <p className="text-lg text-gray-500 py-8">
        Ask a question or build a query above to see a report.
      </p>
    );
  }

  const { rows, meta } = report;
  const dimKeys = dimensionKeys(rows);
  const measureLabel = humanize(meta.measure);

  // Graceful low-N / empty: an intentional, explained state — not a broken chart.
  if (rows.length === 0) {
    return (
      <EAAlert variant="info" title="Insufficient data for this breakdown">
        No records match this query yet. As demographic, SDOH, and clinical data fill in over time,
        results for this breakdown will appear here.
      </EAAlert>
    );
  }

  const lowNCount = meta.lowNCellCount;

  return (
    <div className="space-y-6">
      {/* Interpretation banner when this came from a plain-language question */}
      {meta.interpretedFrom && (
        <EAAlert variant="info" title="Interpreted your question as">
          <span className="font-medium">{measureLabel}</span>
          {dimKeys.length > 0 && <> by {dimKeys.map(humanize).join(' × ')}</>}
          {' '}— from {humanize(meta.source)}.
        </EAAlert>
      )}

      {/* Single total — no dimensions */}
      {dimKeys.length === 0 && (
        <div className="max-w-xs">
          <EAMetricCard
            label={measureLabel}
            value={fmt(rows[0]?.value ?? null)}
            sublabel={`n = ${rows[0]?.cell_n ?? 0}`}
          />
        </div>
      )}

      {/* One dimension — bar chart */}
      {dimKeys.length === 1 && <SingleDimChart rows={rows} dim={dimKeys[0]} measureLabel={measureLabel} />}

      {/* Two dimensions — grouped bar chart */}
      {dimKeys.length === 2 && (
        <GroupedDimChart rows={rows} dims={[dimKeys[0], dimKeys[1]]} measureLabel={measureLabel} />
      )}

      {/* Always provide the underlying table (and it's the only view for 3 dimensions) */}
      {dimKeys.length >= 1 && (
        <DataTable rows={rows} dimKeys={dimKeys} measureLabel={measureLabel} />
      )}

      {/* Low-N legend — flagged, not hidden */}
      {lowNCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <EABadge variant="elevated" size="sm">small group</EABadge>
          <span>
            {lowNCount} group{lowNCount === 1 ? '' : 's'} below {11} records — shown, not hidden, so small
            populations stay visible. {meta.smallCellsDropped && '(Some small groups excluded by this report’s filter.)'}
          </span>
        </div>
      )}
    </div>
  );
};

const SingleDimChart: React.FC<{ rows: EquityCell[]; dim: string; measureLabel: string }> = ({
  rows,
  dim,
  measureLabel,
}) => {
  const data = rows.map((r) => ({
    name: String(r[dim] ?? 'Unknown'),
    value: r.value ?? 0,
    low_n: r.low_n,
  }));
  return (
    <EACard className="p-4">
      <h3 className="text-lg font-semibold mb-3">{measureLabel} by {humanize(dim)}</h3>
      <ResponsiveContainer width="100%" height={Math.max(240, data.length * 36)}>
        <BarChart data={data} layout="vertical" margin={{ left: 24, right: 24 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" />
          <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 14 }} />
          <Tooltip formatter={(v: number, _n, p) => [`${fmt(v)}${(p?.payload as { low_n?: boolean })?.low_n ? '  (small group)' : ''}`, measureLabel]} />
          <Bar dataKey="value" name={measureLabel} radius={[0, 4, 4, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.low_n ? LOW_N_COLOR : BAR_COLOR} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </EACard>
  );
};

const GroupedDimChart: React.FC<{ rows: EquityCell[]; dims: [string, string]; measureLabel: string }> = ({
  rows,
  dims,
  measureLabel,
}) => {
  const [d0, d1] = dims;
  const series = Array.from(new Set(rows.map((r) => String(r[d1] ?? 'Unknown')))).slice(0, 12);
  const byGroup = new Map<string, Record<string, number | string>>();
  for (const r of rows) {
    const g = String(r[d0] ?? 'Unknown');
    let groupRow = byGroup.get(g);
    if (!groupRow) {
      groupRow = { name: g };
      byGroup.set(g, groupRow);
    }
    groupRow[String(r[d1] ?? 'Unknown')] = r.value ?? 0;
  }
  const data = Array.from(byGroup.values());
  const palette = ['#0e7490', '#7c3aed', '#b45309', '#15803d', '#be123c', '#4338ca', '#0f766e', '#a16207', '#9333ea', '#dc2626', '#2563eb', '#65a30d'];
  return (
    <EACard className="p-4">
      <h3 className="text-lg font-semibold mb-3">
        {measureLabel} by {humanize(d0)} × {humanize(d1)}
      </h3>
      <ResponsiveContainer width="100%" height={Math.max(280, data.length * 44)}>
        <BarChart data={data} margin={{ left: 8, right: 24, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 13 }} />
          <YAxis />
          <Tooltip />
          <Legend />
          {series.map((s, i) => (
            <Bar key={s} dataKey={s} name={s} fill={palette[i % palette.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </EACard>
  );
};

const DataTable: React.FC<{ rows: EquityCell[]; dimKeys: string[]; measureLabel: string }> = ({
  rows,
  dimKeys,
  measureLabel,
}) => (
  <EACard className="p-0 overflow-x-auto">
    <table className="w-full text-left text-sm">
      <thead className="bg-gray-50 border-b">
        <tr>
          {dimKeys.map((k) => (
            <th key={k} scope="col" className="px-4 py-2 font-semibold">{humanize(k)}</th>
          ))}
          <th scope="col" className="px-4 py-2 font-semibold text-right">{measureLabel}</th>
          <th scope="col" className="px-4 py-2 font-semibold text-right">Records (n)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={`border-b ${r.low_n ? 'bg-amber-50' : ''}`}>
            {dimKeys.map((k) => (
              <td key={k} className="px-4 py-2">{String(r[k] ?? 'Unknown')}</td>
            ))}
            <td className="px-4 py-2 text-right tabular-nums">{fmt(r.value)}</td>
            <td className="px-4 py-2 text-right tabular-nums">
              {r.cell_n}
              {r.low_n && <span className="ml-2 align-middle"><EABadge variant="elevated" size="sm">small</EABadge></span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </EACard>
);

export default EquityResults;
