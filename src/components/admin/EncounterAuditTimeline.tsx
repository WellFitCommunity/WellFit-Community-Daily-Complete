/**
 * EncounterAuditTimeline - Encounter-Level Audit Trail Viewer
 *
 * Purpose: Displays a unified chronological timeline of all events for
 * a given encounter: status changes, field edits, amendments, lock actions,
 * and audit log entries. Supports filtering and CSV/JSON export.
 *
 * Used by: sectionDefinitions.tsx (security/compliance category)
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  Filter,
  Download,
  ChevronDown,
  ChevronRight,
  Clock,
  FileEdit,
  Shield,
  Lock,
  FileText,
} from 'lucide-react';
import {
  EACard,
  EACardContent,
  EACardHeader,
  EAButton,
  EAAlert,
  EABadge,
} from '../envision-atlus';
import { encounterAuditService } from '../../services/encounterAuditService';
import type {
  EncounterTimelineEntry,
  EncounterHeader,
  TimelineSource,
  TimelineSeverity,
} from '../../services/encounterAuditService';
import { auditLogger } from '../../services/auditLogger';

// =============================================================================
// TYPES
// =============================================================================

type SourceFilter = 'all' | TimelineSource;
type SeverityFilter = 'all' | TimelineSeverity;

// =============================================================================
// HELPERS
// =============================================================================

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getSourceIcon(source: TimelineSource) {
  switch (source) {
    case 'status_change': return <Clock className="w-4 h-4" />;
    case 'field_edit': return <FileEdit className="w-4 h-4" />;
    case 'amendment': return <FileText className="w-4 h-4" />;
    case 'lock_action': return <Lock className="w-4 h-4" />;
    case 'audit_log': return <Shield className="w-4 h-4" />;
  }
}

function getSourceColor(source: TimelineSource): string {
  switch (source) {
    case 'status_change': return 'border-blue-400 bg-blue-50';
    case 'field_edit': return 'border-green-400 bg-green-50';
    case 'amendment': return 'border-yellow-400 bg-yellow-50';
    case 'lock_action': return 'border-red-400 bg-red-50';
    case 'audit_log': return 'border-gray-400 bg-gray-50';
  }
}

function getSourceDotColor(source: TimelineSource): string {
  switch (source) {
    case 'status_change': return 'bg-blue-500';
    case 'field_edit': return 'bg-green-500';
    case 'amendment': return 'bg-yellow-500';
    case 'lock_action': return 'bg-red-500';
    case 'audit_log': return 'bg-gray-500';
  }
}

function getSeverityVariant(severity: TimelineSeverity): 'info' | 'elevated' | 'high' | 'critical' {
  switch (severity) {
    case 'info': return 'info';
    case 'warning': return 'elevated';
    case 'error': return 'high';
    case 'critical': return 'critical';
  }
}

const SOURCE_LABELS: Record<TimelineSource, string> = {
  status_change: 'Status Change',
  field_edit: 'Field Edit',
  amendment: 'Amendment',
  lock_action: 'Lock Action',
  audit_log: 'Audit Log',
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function TimelineEntry({ entry, isExpanded, onToggle }: {
  entry: EncounterTimelineEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex gap-3 group">
      {/* Timeline dot */}
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full mt-1.5 ${getSourceDotColor(entry.source)}`} />
        <div className="w-px flex-1 bg-gray-200 group-last:hidden" />
      </div>

      {/* Content */}
      <div className={`flex-1 mb-4 rounded-md border-l-4 p-3 ${getSourceColor(entry.source)}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getSourceIcon(entry.source)}
            <span className="text-sm font-medium text-gray-900">{entry.summary}</span>
          </div>
          <div className="flex items-center gap-2">
            <EABadge variant={getSeverityVariant(entry.severity)} size="sm">
              {entry.severity}
            </EABadge>
            <button
              onClick={onToggle}
              className="text-gray-400 hover:text-gray-600 p-1"
              type="button"
              aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
          <span>{formatTimestamp(entry.timestamp)}</span>
          <span>{SOURCE_LABELS[entry.source]}</span>
          {entry.actor_id && (
            <span>Actor: {entry.actor_id.substring(0, 8)}...</span>
          )}
        </div>

        {/* Expanded details */}
        {isExpanded && Object.keys(entry.details).length > 0 && (
          <div className="mt-3 p-2 bg-white rounded border text-xs font-mono text-gray-700 overflow-x-auto">
            <pre>{JSON.stringify(entry.details, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const EncounterAuditTimeline: React.FC = () => {
  const [encounterId, setEncounterId] = useState('');
  const [header, setHeader] = useState<EncounterHeader | null>(null);
  const [timeline, setTimeline] = useState<EncounterTimelineEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const loadEncounter = useCallback(async () => {
    if (!encounterId.trim()) {
      setError('Please enter an encounter ID.');
      return;
    }

    setLoading(true);
    setError(null);
    setTimeline([]);
    setHeader(null);
    setExpandedIds(new Set());

    const [headerRes, timelineRes] = await Promise.all([
      encounterAuditService.getEncounterHeader(encounterId.trim()),
      encounterAuditService.getEncounterTimeline(encounterId.trim()),
    ]);

    if (!headerRes.success) {
      setError(headerRes.error.message);
      setLoading(false);
      return;
    }

    setHeader(headerRes.data);

    if (!timelineRes.success) {
      setError(timelineRes.error.message);
    } else {
      setTimeline(timelineRes.data);
    }

    setLoading(false);
  }, [encounterId]);

  const handleExport = async (format: 'json' | 'csv') => {
    if (!encounterId.trim()) return;

    try {
      const result = await encounterAuditService.exportEncounterAudit(encounterId.trim(), format);
      if (!result.success) {
        setError(result.error.message);
        return;
      }

      // Trigger download
      const blob = new Blob([result.data], { type: format === 'csv' ? 'text/csv' : 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `encounter-audit-${encounterId.trim().substring(0, 8)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('ENCOUNTER_AUDIT_EXPORT_UI_FAILED', e);
      setError('Export failed. Please try again.');
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Client-side filtering
  const filteredTimeline = timeline.filter(entry => {
    if (sourceFilter !== 'all' && entry.source !== sourceFilter) return false;
    if (severityFilter !== 'all' && entry.severity !== severityFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4" aria-label="Encounter Audit Timeline">
      {/* Search Bar */}
      <EACard>
        <EACardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[250px]">
              <label htmlFor="encounter-id-input" className="sr-only">Encounter ID</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="encounter-id-input"
                  type="text"
                  value={encounterId}
                  onChange={e => setEncounterId(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') loadEncounter(); }}
                  placeholder="Enter encounter ID (UUID)..."
                  className="w-full pl-10 pr-4 py-2 text-sm rounded-md border-gray-300 shadow-sm focus-visible:ring-[var(--ea-primary)] focus-visible:border-[var(--ea-primary)]"
                />
              </div>
            </div>
            <EAButton
              variant="primary"
              size="sm"
              onClick={loadEncounter}
              loading={loading}
            >
              Load Audit Trail
            </EAButton>
          </div>
        </EACardContent>
      </EACard>

      {/* Error */}
      {error && (
        <EAAlert variant="critical" dismissible onDismiss={() => setError(null)}>
          {error}
        </EAAlert>
      )}

      {/* Encounter Header */}
      {header && (
        <EACard>
          <EACardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Encounter</p>
                <p className="text-sm font-mono text-gray-900">{header.encounter_id.substring(0, 8)}...</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
                <EABadge variant="info" size="sm">{header.status}</EABadge>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Patient</p>
                <p className="text-sm text-gray-700">{header.patient_id ? header.patient_id.substring(0, 8) + '...' : 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Provider</p>
                <p className="text-sm text-gray-700">{header.provider_id ? header.provider_id.substring(0, 8) + '...' : 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Date</p>
                <p className="text-sm text-gray-700">{header.encounter_date || 'N/A'}</p>
              </div>
              <div className="ml-auto flex gap-2">
                <EAButton variant="ghost" size="sm" onClick={() => handleExport('csv')}>
                  <Download className="w-3 h-3 mr-1" />
                  CSV
                </EAButton>
                <EAButton variant="ghost" size="sm" onClick={() => handleExport('json')}>
                  <Download className="w-3 h-3 mr-1" />
                  JSON
                </EAButton>
              </div>
            </div>
          </EACardContent>
        </EACard>
      )}

      {/* Timeline */}
      {header && (
        <EACard>
          <EACardHeader
            icon={<Clock className="w-5 h-5" />}
            action={
              <EAButton variant="ghost" size="sm" onClick={loadEncounter}>
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </EAButton>
            }
          >
            Audit Timeline ({filteredTimeline.length} events)
          </EACardHeader>

          <EACardContent className="p-0">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b bg-gray-50">
              <Filter className="w-4 h-4 text-gray-400" />

              <select
                value={sourceFilter}
                onChange={e => setSourceFilter(e.target.value as SourceFilter)}
                className="text-sm rounded-md border-gray-300 shadow-sm focus-visible:ring-[var(--ea-primary)] focus-visible:border-[var(--ea-primary)]"
                aria-label="Filter by source"
              >
                <option value="all">All Sources</option>
                <option value="status_change">Status Changes</option>
                <option value="field_edit">Field Edits</option>
                <option value="amendment">Amendments</option>
                <option value="lock_action">Lock Actions</option>
                <option value="audit_log">Audit Logs</option>
              </select>

              <select
                value={severityFilter}
                onChange={e => setSeverityFilter(e.target.value as SeverityFilter)}
                className="text-sm rounded-md border-gray-300 shadow-sm focus-visible:ring-[var(--ea-primary)] focus-visible:border-[var(--ea-primary)]"
                aria-label="Filter by severity"
              >
                <option value="all">All Severities</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            {/* Timeline content */}
            <div className="p-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-5 h-5 animate-spin text-[var(--ea-primary)] mr-3" />
                  <span className="text-gray-600">Loading audit trail...</span>
                </div>
              ) : filteredTimeline.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Shield className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm font-medium">
                    {timeline.length === 0
                      ? 'No audit events found for this encounter.'
                      : 'No events match the current filters.'}
                  </p>
                </div>
              ) : (
                filteredTimeline.map(entry => (
                  <TimelineEntry
                    key={entry.id}
                    entry={entry}
                    isExpanded={expandedIds.has(entry.id)}
                    onToggle={() => toggleExpanded(entry.id)}
                  />
                ))
              )}
            </div>
          </EACardContent>
        </EACard>
      )}

      {/* Empty state when no encounter loaded */}
      {!header && !loading && !error && (
        <EACard>
          <EACardContent className="p-12 text-center text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-sm font-medium">Enter an encounter ID to view its audit trail</p>
            <p className="text-xs mt-2">
              The timeline shows all status changes, field edits, amendments, lock actions, and audit events.
            </p>
          </EACardContent>
        </EACard>
      )}
    </div>
  );
};

export default EncounterAuditTimeline;
