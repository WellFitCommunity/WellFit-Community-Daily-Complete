/**
 * ReferenceDataHealthPanel — Reference data freshness status
 *
 * Shows each data source (NLM, CMS, RxNorm), last updated,
 * freshness status (current/warning/stale/critical),
 * and next expected update date.
 *
 * Akima can see at a glance whether validation data is current.
 */

import React from 'react';
import { EACard, EACardHeader, EACardContent } from '../../envision-atlus/EACard';
import { EABadge } from '../../envision-atlus/EABadge';
import type { ReferenceDataSource } from './ClinicalValidationDashboard.types';

interface ReferenceDataHealthPanelProps {
  sources: ReferenceDataSource[];
}

/** Map freshness status to EABadge variant */
function statusToBadgeVariant(status: string): 'critical' | 'high' | 'elevated' | 'normal' {
  switch (status) {
    case 'critical': return 'critical';
    case 'stale': return 'high';
    case 'warning': return 'elevated';
    case 'current': return 'normal';
    default: return 'neutral' as 'normal';
  }
}

/** Format date for display */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Calculate days since last update */
function daysSince(iso: string): number {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export const ReferenceDataHealthPanel: React.FC<ReferenceDataHealthPanelProps> = ({ sources }) => {
  if (sources.length === 0) {
    return (
      <EACard>
        <EACardHeader>
          <h3 className="text-lg font-bold text-white">Reference Data Health</h3>
        </EACardHeader>
        <EACardContent>
          <p className="text-slate-400 text-center py-6">
            No reference data sources configured. Run the reference data seeding migration.
          </p>
        </EACardContent>
      </EACard>
    );
  }

  const criticalCount = sources.filter((s) => s.status === 'critical' || s.status === 'stale').length;

  return (
    <EACard variant={criticalCount > 0 ? 'highlight' : 'default'} aria-label="Reference Data Health Panel">
      <EACardHeader>
        <div className="flex items-center justify-between w-full">
          <h3 className="text-lg font-bold text-white">
            Reference Data Health
          </h3>
          {criticalCount > 0 && (
            <EABadge variant="critical" pulse>
              {criticalCount} stale
            </EABadge>
          )}
        </div>
      </EACardHeader>
      <EACardContent>
        <div className="space-y-3">
          {sources.map((source) => (
            <div
              key={source.id}
              className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-800"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">{source.source_name}</span>
                  <EABadge variant={statusToBadgeVariant(source.status)} size="sm">
                    {source.status}
                  </EABadge>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {source.source_type}
                  {source.version && <span> &middot; v{source.version}</span>}
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm text-slate-300">
                  Updated: {formatDate(source.last_updated)}
                </div>
                <div className="text-xs text-slate-500">
                  {daysSince(source.last_updated)} days ago
                  {source.next_expected_update && (
                    <span> &middot; Next: {formatDate(source.next_expected_update)}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {sources.some((s) => s.notes) && (
          <div className="mt-4 pt-3 border-t border-slate-700">
            <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Notes</h4>
            {sources
              .filter((s) => s.notes)
              .map((s) => (
                <p key={s.id} className="text-xs text-slate-500 mb-1">
                  <span className="text-slate-400">{s.source_name}:</span> {s.notes}
                </p>
              ))}
          </div>
        )}
      </EACardContent>
    </EACard>
  );
};

export default ReferenceDataHealthPanel;
