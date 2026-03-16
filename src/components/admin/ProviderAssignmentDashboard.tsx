/**
 * ProviderAssignmentDashboard - Dashboard for Managing Encounter Provider Assignments
 *
 * Purpose: Shows encounters needing/having provider assignments with metric cards,
 * a filterable encounter queue, and expandable rows that embed EncounterProviderPanel.
 *
 * Used by: sectionDefinitions.tsx (patient-care category)
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useDashboardTheme } from '../../hooks/useDashboardTheme';
import {
  Users,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Filter,
  Calendar,
} from 'lucide-react';
import {
  EACard,
  EACardContent,
  EACardHeader,
  EAButton,
  EAAlert,
  EABadge,
} from '../envision-atlus';
import { EncounterProviderPanel } from './EncounterProviderPanel';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../../services/auditLogger';
import { STATUS_DISPLAY } from '../../types/encounterStatus';
import type { EncounterStatus } from '../../types/encounterStatus';

// =============================================================================
// TYPES
// =============================================================================

interface EncounterRow {
  id: string;
  patient_id: string;
  date_of_service: string;
  status: EncounterStatus;
  created_at: string;
  patient: { first_name: string; last_name: string } | null;
  providers: EncounterProviderRef[];
}

interface EncounterProviderRef {
  id: string;
  role: string;
  provider_id: string;
  removed_at: string | null;
}

type StatusFilter = 'all' | EncounterStatus;

// Active statuses that appear in the encounter queue
const ACTIVE_STATUSES: EncounterStatus[] = [
  'draft', 'scheduled', 'arrived', 'triaged', 'in_progress', 'ready_for_sign',
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getActiveProviders(providers: EncounterProviderRef[]): EncounterProviderRef[] {
  return providers.filter(p => p.removed_at === null);
}

function hasAttendingProvider(providers: EncounterProviderRef[]): boolean {
  return getActiveProviders(providers).some(p => p.role === 'attending');
}

function formatPatientName(patient: { first_name: string; last_name: string } | null): string {
  if (!patient) return 'Unknown';
  const firstInitial = patient.first_name ? patient.first_name.charAt(0) + '.' : '';
  return `${firstInitial} ${patient.last_name}`.trim();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function MetricCard({ label, value, variant }: {
  label: string;
  value: number;
  variant: 'default' | 'warning' | 'success';
}) {
  const colors = {
    default: 'bg-white border-gray-200 text-gray-900',
    warning: 'bg-red-50 border-red-200 text-red-900',
    success: 'bg-green-50 border-green-200 text-green-900',
  };

  return (
    <div className={`rounded-lg border p-4 ${colors[variant]}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: EncounterStatus }) {
  const meta = STATUS_DISPLAY[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${meta.bgColor} ${meta.color}`}>
      {meta.label}
    </span>
  );
}

function EncounterQueueRow({ encounter, expanded, onToggle }: {
  encounter: EncounterRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const activeProviders = getActiveProviders(encounter.providers);
  const hasAttending = hasAttendingProvider(encounter.providers);
  const providerCount = activeProviders.length;

  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
        type="button"
      >
        <span className="text-gray-400 flex-shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>

        <span className="text-sm font-medium text-gray-900 w-32 truncate">
          {formatPatientName(encounter.patient)}
        </span>

        <span className="text-sm text-gray-500 w-28 flex-shrink-0">
          {formatDate(encounter.date_of_service)}
        </span>

        <span className="w-28 flex-shrink-0">
          <StatusBadge status={encounter.status} />
        </span>

        <span className="flex-1">
          {hasAttending ? (
            <span className="inline-flex items-center gap-1 text-green-700 text-xs">
              <CheckCircle className="w-3.5 h-3.5" />
              {providerCount} Provider{providerCount !== 1 ? 's' : ''}
            </span>
          ) : (
            <EABadge variant="critical" size="sm">Needs Attending</EABadge>
          )}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 bg-gray-50">
          <EncounterProviderPanel
            encounterId={encounter.id}
            encounterStatus={encounter.status}
            onProviderChange={onToggle}
          />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const ProviderAssignmentDashboard: React.FC = () => {
  useDashboardTheme();
  const [encounters, setEncounters] = useState<EncounterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [needsProviderOnly, setNeedsProviderOnly] = useState(false);

  const fetchEncounters = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchErr } = await supabase
        .from('encounters')
        .select(`
          id, patient_id, date_of_service, status, created_at,
          patient:profiles!encounters_patient_id_fkey(first_name, last_name),
          providers:encounter_providers(id, role, provider_id, removed_at)
        `)
        .in('status', ACTIVE_STATUSES)
        .order('date_of_service', { ascending: false })
        .limit(50);

      if (fetchErr) {
        await auditLogger.error('PROVIDER_DASHBOARD_FETCH_FAILED', fetchErr);
        setError('Failed to load encounters. Please try again.');
        setEncounters([]);
      } else {
        const rows = (data ?? []).map((row: Record<string, unknown>) => ({
          id: row.id as string,
          patient_id: row.patient_id as string,
          date_of_service: row.date_of_service as string,
          status: row.status as EncounterStatus,
          created_at: row.created_at as string,
          patient: row.patient as { first_name: string; last_name: string } | null,
          providers: (row.providers ?? []) as EncounterProviderRef[],
        }));
        setEncounters(rows);
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('PROVIDER_DASHBOARD_FETCH_FAILED', error);
      setError('Failed to load encounters. Please try again.');
      setEncounters([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEncounters();
  }, [fetchEncounters]);

  // Derived data
  const filteredEncounters = encounters.filter(enc => {
    if (statusFilter !== 'all' && enc.status !== statusFilter) return false;
    if (needsProviderOnly && hasAttendingProvider(enc.providers)) return false;
    return true;
  });

  const totalCount = encounters.length;
  const missingAttending = encounters.filter(e => !hasAttendingProvider(e.providers)).length;
  const assignedCount = totalCount - missingAttending;

  const handleToggle = (encounterId: string) => {
    setExpandedId(prev => prev === encounterId ? null : encounterId);
  };

  // ---- Loading state ----
  if (loading) {
    return (
      <EACard>
        <EACardContent className="flex items-center justify-center p-12">
          <RefreshCw className="w-5 h-5 animate-spin text-[var(--ea-primary,#00857a)] mr-3" />
          <span className="text-gray-600">Loading encounters...</span>
        </EACardContent>
      </EACard>
    );
  }

  return (
    <div className="space-y-4" aria-label="Provider Assignment Dashboard">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard label="Active Encounters" value={totalCount} variant="default" />
        <MetricCard label="Missing Attending" value={missingAttending} variant={missingAttending > 0 ? 'warning' : 'default'} />
        <MetricCard label="Providers Assigned" value={assignedCount} variant="success" />
      </div>

      {/* Error */}
      {error && (
        <EAAlert variant="critical" dismissible onDismiss={() => setError(null)}>
          {error}
        </EAAlert>
      )}

      {/* Warning for missing attending */}
      {missingAttending > 0 && (
        <EAAlert variant="warning">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              {missingAttending} encounter{missingAttending !== 1 ? 's' : ''} missing an attending provider.
              Encounters cannot advance past draft without an attending.
            </span>
          </div>
        </EAAlert>
      )}

      {/* Encounter Queue */}
      <EACard>
        <EACardHeader
          icon={<Users className="w-5 h-5" />}
          action={
            <EAButton variant="ghost" size="sm" onClick={fetchEncounters}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </EAButton>
          }
        >
          Encounter Provider Queue
        </EACardHeader>

        <EACardContent className="p-0">
          {/* Filter Bar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b bg-gray-50">
            <Filter className="w-4 h-4 text-gray-400" />

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="text-sm rounded-md border-gray-300 shadow-sm focus-visible:ring-[var(--ea-primary,#00857a)] focus-visible:border-[var(--ea-primary,#00857a)]"
              aria-label="Filter by status"
            >
              <option value="all">All Statuses</option>
              {ACTIVE_STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_DISPLAY[s].label}</option>
              ))}
            </select>

            <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={needsProviderOnly}
                onChange={e => setNeedsProviderOnly(e.target.checked)}
                className="rounded border-gray-300 text-[var(--ea-primary,#00857a)] focus-visible:ring-[var(--ea-primary,#00857a)]"
              />
              Needs provider only
            </label>
          </div>

          {/* Table Header */}
          <div className="flex items-center gap-4 px-4 py-2 border-b text-xs font-medium text-gray-500 uppercase tracking-wider bg-white">
            <span className="w-4" />
            <span className="w-32">Patient</span>
            <span className="w-28 flex-shrink-0 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Date
            </span>
            <span className="w-28 flex-shrink-0">Status</span>
            <span className="flex-1">Provider</span>
          </div>

          {/* Encounter Rows */}
          {filteredEncounters.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm font-medium">No encounters found</p>
              <p className="text-xs mt-1">
                {needsProviderOnly
                  ? 'All active encounters have an attending provider assigned.'
                  : 'No active encounters match the current filters.'}
              </p>
            </div>
          ) : (
            filteredEncounters.map(encounter => (
              <EncounterQueueRow
                key={encounter.id}
                encounter={encounter}
                expanded={expandedId === encounter.id}
                onToggle={() => handleToggle(encounter.id)}
              />
            ))
          )}
        </EACardContent>
      </EACard>
    </div>
  );
};

export default ProviderAssignmentDashboard;
