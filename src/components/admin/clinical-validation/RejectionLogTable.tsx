/**
 * RejectionLogTable — Sortable/filterable table of rejected AI codes
 *
 * Shows: date, AI function, code, system, reason, detail
 * Sortable by column. Filterable by system and reason from parent.
 */

import React, { useState, useMemo } from 'react';
import { EACard, EACardHeader, EACardContent } from '../../envision-atlus/EACard';
import { EABadge } from '../../envision-atlus/EABadge';
import type { RejectionLogEntry } from './ClinicalValidationDashboard.types';

interface RejectionLogTableProps {
  entries: RejectionLogEntry[];
}

type SortField = 'date' | 'sourceFunction' | 'code' | 'system' | 'reason';
type SortDirection = 'asc' | 'desc';

/** Badge variant for code system */
function systemBadgeVariant(system: string): 'critical' | 'high' | 'elevated' | 'info' | 'neutral' {
  switch (system) {
    case 'icd10': return 'info';
    case 'cpt': return 'elevated';
    case 'hcpcs': return 'high';
    case 'drg': return 'critical';
    case 'z-code': return 'info';
    case 'rxnorm': return 'neutral';
    default: return 'neutral';
  }
}

/** Format a source function name for display */
function formatSource(source: string): string {
  return source
    .replace(/^(ai-|mcp-)/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Format date for display */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const RejectionLogTable: React.FC<RejectionLogTableProps> = ({ entries }) => {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const sorted = useMemo(() => {
    const copy = [...entries];
    copy.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [entries, sortField, sortDir]);

  const paged = useMemo(() => {
    const start = page * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page]);

  const totalPages = Math.ceil(sorted.length / pageSize);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  function sortIcon(field: SortField) {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' \u2191' : ' \u2193';
  }

  if (entries.length === 0) {
    return (
      <EACard>
        <EACardHeader>
          <h3 className="text-lg font-bold text-white">Rejection Log</h3>
        </EACardHeader>
        <EACardContent>
          <p className="text-slate-400 text-center py-8">
            No rejected codes in this time period. AI output validation is clean.
          </p>
        </EACardContent>
      </EACard>
    );
  }

  return (
    <EACard>
      <EACardHeader>
        <div className="flex items-center justify-between w-full">
          <h3 className="text-lg font-bold text-white">
            Rejection Log ({entries.length} entries)
          </h3>
        </div>
      </EACardHeader>
      <EACardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Rejection log">
            <thead>
              <tr className="border-b border-slate-700">
                <th
                  className="text-left px-3 py-2 text-slate-400 cursor-pointer hover:text-white"
                  onClick={() => handleSort('date')}
                >
                  Date{sortIcon('date')}
                </th>
                <th
                  className="text-left px-3 py-2 text-slate-400 cursor-pointer hover:text-white"
                  onClick={() => handleSort('sourceFunction')}
                >
                  AI Function{sortIcon('sourceFunction')}
                </th>
                <th
                  className="text-left px-3 py-2 text-slate-400 cursor-pointer hover:text-white"
                  onClick={() => handleSort('code')}
                >
                  Code{sortIcon('code')}
                </th>
                <th
                  className="text-left px-3 py-2 text-slate-400 cursor-pointer hover:text-white"
                  onClick={() => handleSort('system')}
                >
                  System{sortIcon('system')}
                </th>
                <th
                  className="text-left px-3 py-2 text-slate-400 cursor-pointer hover:text-white"
                  onClick={() => handleSort('reason')}
                >
                  Reason{sortIcon('reason')}
                </th>
                <th className="text-left px-3 py-2 text-slate-400">
                  Detail
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-slate-800 hover:bg-slate-900/50"
                >
                  <td className="px-3 py-2 text-slate-300 whitespace-nowrap">
                    {formatDate(entry.date)}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {formatSource(entry.sourceFunction)}
                  </td>
                  <td className="px-3 py-2 font-mono text-white font-medium">
                    {entry.code}
                  </td>
                  <td className="px-3 py-2">
                    <EABadge variant={systemBadgeVariant(entry.system)} size="sm">
                      {entry.system.toUpperCase()}
                    </EABadge>
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {entry.reason.replace(/_/g, ' ')}
                  </td>
                  <td className="px-3 py-2 text-slate-400 max-w-xs truncate">
                    {entry.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-700">
            <span className="text-xs text-slate-400">
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 text-sm rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1 text-sm rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </EACardContent>
    </EACard>
  );
};

export default RejectionLogTable;
