/**
 * SOC2 Compliance Dashboard - Incident Response Tab
 *
 * Displays incident summary metrics, filters, investigation queue,
 * and incident detail/resolution modal.
 */

import React from 'react';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
} from '../../envision-atlus';
import { Clock } from 'lucide-react';
import { MetricCard, SeverityBadge, SLABadge } from './helpers';
import type { SOC2DashboardState } from './SOC2ComplianceDashboard.types';
import type { FilterSeverity, FilterStatus } from './SOC2ComplianceDashboard.types';

type IncidentsTabProps = Pick<
  SOC2DashboardState,
  | 'criticalOpenCount'
  | 'highOpenCount'
  | 'slaBreachCount'
  | 'totalOpenIncidents'
  | 'filteredIncidents'
  | 'incidents'
  | 'filterSeverity'
  | 'setFilterSeverity'
  | 'filterStatus'
  | 'setFilterStatus'
  | 'selectedIncident'
  | 'setSelectedIncident'
  | 'resolution'
  | 'setResolution'
  | 'submittingResolution'
  | 'handleResolveIncident'
  | 'formatTimestamp'
  | 'formatHoursSince'
>;

export const IncidentsTab: React.FC<IncidentsTabProps> = ({
  criticalOpenCount,
  highOpenCount,
  slaBreachCount,
  totalOpenIncidents,
  filteredIncidents,
  incidents,
  filterSeverity,
  setFilterSeverity,
  filterStatus,
  setFilterStatus,
  selectedIncident,
  setSelectedIncident,
  resolution,
  setResolution,
  submittingResolution,
  handleResolveIncident,
  formatTimestamp,
  formatHoursSince,
}) => {
  return (
    <div className="space-y-6">
      {/* Incident Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Critical Open"
          value={criticalOpenCount}
          subValue="1 hour SLA"
          color="red"
          highlight={criticalOpenCount > 0}
        />
        <MetricCard
          label="High Priority Open"
          value={highOpenCount}
          subValue="4 hour SLA"
          color="orange"
          highlight={highOpenCount > 0}
        />
        <MetricCard
          label="SLA Breaches"
          value={slaBreachCount}
          subValue="Overdue incidents"
          color="red"
          highlight={slaBreachCount > 0}
        />
        <MetricCard
          label="Total Open"
          value={totalOpenIncidents}
          subValue="Requires investigation"
          color="blue"
        />
      </div>

      {/* Filters */}
      <EACard>
        <EACardContent className="py-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-400">Severity:</label>
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value as FilterSeverity)}
                className="px-3 py-1 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white"
              >
                <option value="ALL">All</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-400">Status:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                className="px-3 py-1 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white"
              >
                <option value="ALL">All</option>
                <option value="OPEN">Open</option>
                <option value="RESOLVED">Resolved</option>
              </select>
            </div>
            <div className="ml-auto text-sm text-slate-500">
              Showing {filteredIncidents.length} of {incidents.length} incidents
            </div>
          </div>
        </EACardContent>
      </EACard>

      {/* Investigation Queue */}
      <EACard>
        <EACardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-[var(--ea-primary)]" />
            <h2 className="text-lg font-semibold text-white">Investigation Queue</h2>
          </div>
        </EACardHeader>
        <EACardContent>
          {filteredIncidents.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No incidents matching filters</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Priority</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                      Event Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                      Time Since
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                      SLA Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredIncidents.map((incident) => (
                    <tr
                      key={incident.id}
                      className={`hover:bg-slate-800/50 ${
                        incident.sla_status === 'SLA_BREACH' && !incident.investigated ? 'bg-red-900/20' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <SeverityBadge severity={incident.severity} />
                      </td>
                      <td className="px-4 py-3 text-sm text-white">{incident.event_type.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 text-sm text-slate-400 max-w-md">
                        {incident.description}
                        {incident.auto_blocked && (
                          <span className="ml-2 px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded">
                            AUTO-BLOCKED
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {formatHoursSince(incident.hours_since_event)}
                      </td>
                      <td className="px-4 py-3">
                        <SLABadge slaStatus={incident.sla_status} />
                      </td>
                      <td className="px-4 py-3">
                        <EAButton
                          variant={incident.investigated ? 'secondary' : 'primary'}
                          size="sm"
                          onClick={() => setSelectedIncident(incident)}
                        >
                          {incident.investigated ? 'View' : 'Investigate'}
                        </EAButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </EACardContent>
      </EACard>

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <IncidentDetailModal
          selectedIncident={selectedIncident}
          setSelectedIncident={setSelectedIncident}
          resolution={resolution}
          setResolution={setResolution}
          submittingResolution={submittingResolution}
          handleResolveIncident={handleResolveIncident}
          formatTimestamp={formatTimestamp}
        />
      )}
    </div>
  );
};

// ============================================================================
// Incident Detail Modal (private to this module)
// ============================================================================

interface IncidentDetailModalProps {
  selectedIncident: NonNullable<SOC2DashboardState['selectedIncident']>;
  setSelectedIncident: SOC2DashboardState['setSelectedIncident'];
  resolution: string;
  setResolution: (resolution: string) => void;
  submittingResolution: boolean;
  handleResolveIncident: () => Promise<void>;
  formatTimestamp: (timestamp: string) => string;
}

const IncidentDetailModal: React.FC<IncidentDetailModalProps> = ({
  selectedIncident,
  setSelectedIncident,
  resolution,
  setResolution,
  submittingResolution,
  handleResolveIncident,
  formatTimestamp,
}) => {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <EACard className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <EACardHeader className="border-b border-slate-700">
          <div className="flex justify-between items-start w-full">
            <div>
              <h2 className="text-xl font-semibold text-white">Incident Details</h2>
              <p className="text-sm text-slate-400 mt-1">ID: {selectedIncident.id.substring(0, 8)}</p>
            </div>
            <button
              onClick={() => setSelectedIncident(null)}
              className="text-slate-400 hover:text-white text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </EACardHeader>
        <EACardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-400">Severity</label>
              <div className="mt-1">
                <SeverityBadge severity={selectedIncident.severity} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-400">SLA Status</label>
              <div className="mt-1">
                <SLABadge slaStatus={selectedIncident.sla_status} />
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-400">Event Type</label>
            <p className="mt-1 text-white">{selectedIncident.event_type.replace(/_/g, ' ')}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-400">Description</label>
            <p className="mt-1 text-white">{selectedIncident.description}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-400">Timestamp</label>
            <p className="mt-1 text-white">{formatTimestamp(selectedIncident.timestamp)}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-400">Source IP</label>
            <p className="mt-1 font-mono text-white">{selectedIncident.actor_ip_address || 'N/A'}</p>
          </div>

          {selectedIncident.metadata && Object.keys(selectedIncident.metadata).length > 0 && (
            <div>
              <label className="text-sm font-medium text-slate-400">Additional Details</label>
              <pre className="mt-1 p-3 bg-slate-800 rounded-lg text-xs text-slate-300 overflow-auto">
                {JSON.stringify(selectedIncident.metadata, null, 2)}
              </pre>
            </div>
          )}

          {selectedIncident.investigated ? (
            <div className="border-t border-slate-700 pt-4">
              <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-green-400 mb-2">Resolved</h4>
                <p className="text-sm text-slate-300 mb-2">
                  <strong>Investigated by:</strong> {selectedIncident.investigated_by || 'Unknown'}
                </p>
                <p className="text-sm text-slate-300 mb-2">
                  <strong>Resolved at:</strong>{' '}
                  {selectedIncident.investigated_at ? formatTimestamp(selectedIncident.investigated_at) : 'N/A'}
                </p>
                <p className="text-sm text-slate-300">
                  <strong>Resolution:</strong> {selectedIncident.resolution}
                </p>
              </div>
            </div>
          ) : (
            <div className="border-t border-slate-700 pt-4">
              <label className="text-sm font-medium text-slate-400">Resolution Notes</label>
              <textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                rows={4}
                placeholder="Describe the investigation findings and resolution..."
              />
              <div className="mt-4 flex gap-2">
                <EAButton
                  variant="primary"
                  onClick={handleResolveIncident}
                  disabled={submittingResolution || !resolution.trim()}
                >
                  {submittingResolution ? 'Resolving...' : 'Mark as Resolved'}
                </EAButton>
                <EAButton variant="secondary" onClick={() => setSelectedIncident(null)}>
                  Cancel
                </EAButton>
              </div>
            </div>
          )}
        </EACardContent>
      </EACard>
    </div>
  );
};
