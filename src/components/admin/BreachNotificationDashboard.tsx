/**
 * BreachNotificationDashboard - HIPAA Breach Incident Management
 *
 * Purpose: Admin dashboard for managing breach incidents per 45 CFR 164.400-414
 * Used by: Admin compliance section (sectionDefinitions.tsx)
 * Auth: admin/super_admin/compliance_officer only
 *
 * Features:
 *  - List active breach incidents with status badges
 *  - Stats: total, open, awaiting notification, resolved
 *  - Status update workflow with resolution notes
 *  - Severity color coding (low=green, medium=yellow, high=orange, critical=red)
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  breachNotificationService,
  type BreachIncident,
  type BreachStatus,
  type BreachSeverity,
} from '../../services/breachNotificationService';
import { auditLogger } from '../../services/auditLogger';
import { useDashboardTheme } from '../../hooks/useDashboardTheme';

// =============================================================================
// TYPES
// =============================================================================

interface BreachStats {
  total: number;
  open: number;
  awaitingNotification: number;
  resolved: number;
}

type StatusFilter = 'all' | 'open' | 'notification' | 'resolved';

// =============================================================================
// CONSTANTS
// =============================================================================

const SEVERITY_STYLES: Record<BreachSeverity, { bg: string; text: string; label: string }> = {
  low: { bg: 'bg-green-100', text: 'text-green-800', label: 'Low' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Medium' },
  high: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'High' },
  critical: { bg: 'bg-red-100', text: 'text-red-800', label: 'Critical' },
};

const STATUS_LABELS: Record<BreachStatus, string> = {
  reported: 'Reported',
  investigating: 'Investigating',
  risk_assessment: 'Risk Assessment',
  notification_required: 'Notification Required',
  notification_in_progress: 'Notification In Progress',
  resolved: 'Resolved',
  closed_no_notification: 'Closed (No Notification)',
};

const STATUS_STYLES: Record<BreachStatus, { bg: string; text: string }> = {
  reported: { bg: 'bg-[var(--ea-primary,#00857a)]/15', text: 'text-[var(--ea-primary,#00857a)]' },
  investigating: { bg: 'bg-[var(--ea-primary,#00857a)]/25', text: 'text-[var(--ea-primary,#00857a)]' },
  risk_assessment: { bg: 'bg-[var(--ea-secondary,#FF6B35)]/15', text: 'text-[var(--ea-secondary,#FF6B35)]' },
  notification_required: { bg: 'bg-red-100', text: 'text-red-800' },
  notification_in_progress: { bg: 'bg-orange-100', text: 'text-orange-800' },
  resolved: { bg: 'bg-green-100', text: 'text-green-800' },
  closed_no_notification: { bg: 'bg-gray-100', text: 'text-gray-800' },
};

const OPEN_STATUSES: BreachStatus[] = ['reported', 'investigating', 'risk_assessment'];
const NOTIFICATION_STATUSES: BreachStatus[] = ['notification_required', 'notification_in_progress'];
const RESOLVED_STATUSES: BreachStatus[] = ['resolved', 'closed_no_notification'];

// =============================================================================
// HELPERS
// =============================================================================

function computeStats(incidents: BreachIncident[]): BreachStats {
  return {
    total: incidents.length,
    open: incidents.filter(i => OPEN_STATUSES.includes(i.status)).length,
    awaitingNotification: incidents.filter(i => NOTIFICATION_STATUSES.includes(i.status)).length,
    resolved: incidents.filter(i => RESOLVED_STATUSES.includes(i.status)).length,
  };
}

function filterIncidents(incidents: BreachIncident[], filter: StatusFilter): BreachIncident[] {
  switch (filter) {
    case 'open':
      return incidents.filter(i => OPEN_STATUSES.includes(i.status));
    case 'notification':
      return incidents.filter(i => NOTIFICATION_STATUSES.includes(i.status));
    case 'resolved':
      return incidents.filter(i => RESOLVED_STATUSES.includes(i.status));
    default:
      return incidents;
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// =============================================================================
// COMPONENT
// =============================================================================

const BreachNotificationDashboard: React.FC = () => {
  const { theme } = useDashboardTheme();
  const [incidents, setIncidents] = useState<BreachIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusChangeTarget, setStatusChangeTarget] = useState<{
    id: string;
    status: BreachStatus;
  } | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const loadIncidents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await breachNotificationService.listBreachIncidents();
      if (!result.success) {
        setError(result.error.message);
        return;
      }

      setIncidents(result.data);
      await auditLogger.info('BREACH_DASHBOARD_LOADED', {
        incidentCount: result.data.length,
      });
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('BREACH_DASHBOARD_LOAD_FAILED', e);
      setError('Failed to load breach incidents. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  const handleStatusUpdate = useCallback(async () => {
    if (!statusChangeTarget) return;

    try {
      setUpdatingId(statusChangeTarget.id);
      const notes = statusChangeTarget.status === 'resolved' ? resolutionNotes : undefined;
      const result = await breachNotificationService.updateBreachStatus(
        statusChangeTarget.id,
        statusChangeTarget.status,
        notes
      );

      if (!result.success) {
        setError(result.error.message);
        return;
      }

      setIncidents(prev =>
        prev.map(i => (i.id === statusChangeTarget.id ? result.data : i))
      );
      setStatusChangeTarget(null);
      setResolutionNotes('');
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('BREACH_STATUS_UPDATE_UI_FAILED', e);
      setError('Failed to update breach status.');
    } finally {
      setUpdatingId(null);
    }
  }, [statusChangeTarget, resolutionNotes]);

  const stats = computeStats(incidents);
  const filteredIncidents = filterIncidents(incidents, statusFilter);

  // -- Loading State --
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12" role="status" aria-label="Loading breach incidents">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--ea-primary,#00857a)]" />
        <span className="ml-3 text-gray-600 text-lg">Loading breach incidents...</span>
      </div>
    );
  }

  // -- Error State (no data) --
  if (error && incidents.length === 0) {
    return (
      <div className="p-6" role="alert">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Unable to load breach incidents</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={loadIncidents}
            className="mt-3 min-h-[44px] min-w-[44px] px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 text-base font-medium"
            aria-label="Retry loading breach incidents"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Breach Notification Dashboard</h2>
          <p className="text-gray-500 mt-1">45 CFR 164.400-414 Compliance</p>
        </div>
        <button
          onClick={loadIncidents}
          disabled={loading}
          className={`min-h-[44px] min-w-[44px] px-4 py-2 ${theme.buttonPrimary} rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--ea-primary,#00857a)] text-base font-medium disabled:opacity-50`}
          aria-label="Refresh breach incidents"
        >
          Refresh
        </button>
      </div>

      {/* Inline error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3" role="alert">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => setStatusFilter('all')}
          className={`p-4 rounded-lg border-2 text-left min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--ea-primary,#00857a)] ${
            statusFilter === 'all' ? 'border-[var(--ea-primary,#00857a)] bg-[var(--ea-primary,#00857a)]/10' : 'border-gray-200 bg-white'
          }`}
          aria-pressed={statusFilter === 'all'}
          aria-label={`Show all incidents: ${stats.total}`}
        >
          <p className="text-sm text-gray-500">Total Incidents</p>
          <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
        </button>

        <button
          onClick={() => setStatusFilter('open')}
          className={`p-4 rounded-lg border-2 text-left min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--ea-primary,#00857a)] ${
            statusFilter === 'open' ? 'border-[var(--ea-primary,#00857a)] bg-[var(--ea-primary,#00857a)]/10' : 'border-gray-200 bg-white'
          }`}
          aria-pressed={statusFilter === 'open'}
          aria-label={`Show open incidents: ${stats.open}`}
        >
          <p className="text-sm text-gray-500">Open</p>
          <p className="text-3xl font-bold text-[var(--ea-primary,#00857a)]">{stats.open}</p>
        </button>

        <button
          onClick={() => setStatusFilter('notification')}
          className={`p-4 rounded-lg border-2 text-left min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--ea-primary,#00857a)] ${
            statusFilter === 'notification' ? 'border-[var(--ea-primary,#00857a)] bg-[var(--ea-primary,#00857a)]/10' : 'border-gray-200 bg-white'
          }`}
          aria-pressed={statusFilter === 'notification'}
          aria-label={`Show awaiting notification: ${stats.awaitingNotification}`}
        >
          <p className="text-sm text-gray-500">Awaiting Notification</p>
          <p className="text-3xl font-bold text-orange-600">{stats.awaitingNotification}</p>
        </button>

        <button
          onClick={() => setStatusFilter('resolved')}
          className={`p-4 rounded-lg border-2 text-left min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--ea-primary,#00857a)] ${
            statusFilter === 'resolved' ? 'border-[var(--ea-primary,#00857a)] bg-[var(--ea-primary,#00857a)]/10' : 'border-gray-200 bg-white'
          }`}
          aria-pressed={statusFilter === 'resolved'}
          aria-label={`Show resolved incidents: ${stats.resolved}`}
        >
          <p className="text-sm text-gray-500">Resolved</p>
          <p className="text-3xl font-bold text-green-600">{stats.resolved}</p>
        </button>
      </div>

      {/* Status Change Modal */}
      {statusChangeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-label="Update breach status"
        >
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Update Status to: {STATUS_LABELS[statusChangeTarget.status]}
            </h3>
            {statusChangeTarget.status === 'resolved' && (
              <div className="mb-4">
                <label htmlFor="resolution-notes" className="block text-sm font-medium text-gray-700 mb-1">
                  Resolution Notes
                </label>
                <textarea
                  id="resolution-notes"
                  value={resolutionNotes}
                  onChange={e => setResolutionNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg p-3 text-base focus:ring-2 focus:ring-[var(--ea-primary,#00857a)] focus:border-[var(--ea-primary,#00857a)]"
                  placeholder="Describe how this incident was resolved..."
                />
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setStatusChangeTarget(null); setResolutionNotes(''); }}
                className="min-h-[44px] min-w-[44px] px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 text-base font-medium"
                aria-label="Cancel status update"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusUpdate}
                disabled={updatingId !== null}
                className={`min-h-[44px] min-w-[44px] px-4 py-2 ${theme.buttonPrimary} rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--ea-primary,#00857a)] text-base font-medium disabled:opacity-50`}
                aria-label="Confirm status update"
              >
                {updatingId ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredIncidents.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-500 text-lg">No breach incidents found for this filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredIncidents.map(incident => {
            const sevStyle = SEVERITY_STYLES[incident.severity];
            const statStyle = STATUS_STYLES[incident.status];

            return (
              <div key={incident.id} className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {incident.incident_number || 'Pending'} - {incident.title}
                      </h3>
                      <span
                        className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${sevStyle.bg} ${sevStyle.text}`}
                        aria-label={`Severity: ${sevStyle.label}`}
                      >
                        {sevStyle.label}
                      </span>
                      <span
                        className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${statStyle.bg} ${statStyle.text}`}
                        aria-label={`Status: ${STATUS_LABELS[incident.status]}`}
                      >
                        {STATUS_LABELS[incident.status]}
                      </span>
                    </div>
                    <p className="text-gray-600 mt-1 text-sm">{incident.description}</p>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                      <span>Discovered: {formatDate(incident.discovered_date)}</span>
                      <span>
                        Affected: {incident.individuals_affected} individual
                        {incident.individuals_affected !== 1 ? 's' : ''}
                      </span>
                      {incident.individual_notification_deadline && (
                        <span className="text-red-600 font-medium">
                          Deadline: {formatDate(incident.individual_notification_deadline)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status transition buttons */}
                  {!RESOLVED_STATUSES.includes(incident.status) && (
                    <div className="flex gap-2 flex-shrink-0 flex-wrap">
                      {incident.status === 'reported' && (
                        <button
                          onClick={() => setStatusChangeTarget({ id: incident.id, status: 'investigating' })}
                          disabled={updatingId === incident.id}
                          className={`min-h-[44px] min-w-[44px] px-3 py-2 ${theme.buttonPrimary} rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--ea-primary,#00857a)] text-sm font-medium disabled:opacity-50`}
                          aria-label={`Start investigation for ${incident.title}`}
                        >
                          Investigate
                        </button>
                      )}
                      {incident.status === 'investigating' && (
                        <button
                          onClick={() => setStatusChangeTarget({ id: incident.id, status: 'risk_assessment' })}
                          disabled={updatingId === incident.id}
                          className="min-h-[44px] min-w-[44px] px-3 py-2 bg-[var(--ea-secondary,#FF6B35)] hover:opacity-90 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--ea-secondary,#FF6B35)] text-sm font-medium disabled:opacity-50"
                          aria-label={`Move to risk assessment for ${incident.title}`}
                        >
                          Risk Assess
                        </button>
                      )}
                      {NOTIFICATION_STATUSES.includes(incident.status) && (
                        <button
                          onClick={() => setStatusChangeTarget({ id: incident.id, status: 'notification_in_progress' })}
                          disabled={updatingId === incident.id || incident.status === 'notification_in_progress'}
                          className="min-h-[44px] min-w-[44px] px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm font-medium disabled:opacity-50"
                          aria-label={`Begin notifications for ${incident.title}`}
                        >
                          Begin Notify
                        </button>
                      )}
                      <button
                        onClick={() => setStatusChangeTarget({ id: incident.id, status: 'resolved' })}
                        disabled={updatingId === incident.id}
                        className="min-h-[44px] min-w-[44px] px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-medium disabled:opacity-50"
                        aria-label={`Resolve incident ${incident.title}`}
                      >
                        Resolve
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BreachNotificationDashboard;
