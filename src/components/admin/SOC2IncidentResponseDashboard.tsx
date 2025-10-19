/**
 * SOC 2 Incident Response Dashboard
 *
 * Manages security incident investigation queue with SLA tracking.
 * Allows security team to investigate and resolve incidents.
 *
 * Zero tech debt - clean implementation respecting existing patterns
 */

import React, { useState, useEffect } from 'react';
import { useSupabaseClient } from '../../contexts/AuthContext';
import { createSOC2MonitoringService, IncidentResponseItem } from '../../services/soc2MonitoringService';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';

export const SOC2IncidentResponseDashboard: React.FC = () => {
  const supabase = useSupabaseClient();
  const [incidents, setIncidents] = useState<IncidentResponseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [filterSeverity, setFilterSeverity] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('OPEN');
  const [selectedIncident, setSelectedIncident] = useState<IncidentResponseItem | null>(null);
  const [resolution, setResolution] = useState('');
  const [submittingResolution, setSubmittingResolution] = useState(false);

  const loadIncidents = async () => {
    try {
      setError(null);
      const service = createSOC2MonitoringService(supabase);
      const data = await service.getIncidentResponseQueue();
      setIncidents(data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error loading incidents:', err);
      setError('Failed to load incident response queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadIncidents, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleResolveIncident = async () => {
    if (!selectedIncident || !resolution.trim()) {
      alert('Please provide a resolution description');
      return;
    }

    setSubmittingResolution(true);
    try {
      const service = createSOC2MonitoringService(supabase);
      const success = await service.markEventInvestigated(selectedIncident.id, resolution);

      if (success) {
        alert('Incident marked as resolved');
        setSelectedIncident(null);
        setResolution('');
        await loadIncidents();
      } else {
        alert('Failed to resolve incident');
      }
    } catch (err) {
      console.error('Error resolving incident:', err);
      alert('Error resolving incident');
    } finally {
      setSubmittingResolution(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'LOW':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getSLAColor = (slaStatus: string) => {
    switch (slaStatus) {
      case 'SLA_BREACH':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'WITHIN_SLA':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'RESOLVED':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const formatHoursSince = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m ago`;
    if (hours < 24) return `${Math.round(hours)}h ago`;
    return `${Math.round(hours / 24)}d ago`;
  };

  const filteredIncidents = incidents.filter(incident => {
    const severityMatch = filterSeverity === 'ALL' || incident.severity === filterSeverity;
    const statusMatch = filterStatus === 'ALL' ||
      (filterStatus === 'OPEN' && !incident.investigated) ||
      (filterStatus === 'RESOLVED' && incident.investigated);
    return severityMatch && statusMatch;
  });

  const slaBreachCount = incidents.filter(i => i.sla_status === 'SLA_BREACH' && !i.investigated).length;
  const criticalOpenCount = incidents.filter(i => i.severity === 'CRITICAL' && !i.investigated).length;
  const highOpenCount = incidents.filter(i => i.severity === 'HIGH' && !i.investigated).length;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Incident Response Center</h2>
          <p className="text-sm text-gray-600 mt-1">
            Security incident investigation queue • Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={loadIncidents}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {error && (
        <Alert className="bg-red-50 border-red-200">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Alert for SLA Breaches */}
      {slaBreachCount > 0 && (
        <Alert className="bg-red-50 border-red-300">
          <AlertDescription className="text-red-900">
            <strong>SLA Breach Alert:</strong> {slaBreachCount} incident(s) have exceeded response time SLA.
            Immediate action required.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={criticalOpenCount > 0 ? 'border-red-500 border-2' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Critical Open</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{criticalOpenCount}</div>
            <p className="text-xs text-gray-500 mt-1">1 hour SLA</p>
          </CardContent>
        </Card>

        <Card className={highOpenCount > 0 ? 'border-orange-500 border-2' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">High Priority Open</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{highOpenCount}</div>
            <p className="text-xs text-gray-500 mt-1">4 hour SLA</p>
          </CardContent>
        </Card>

        <Card className={slaBreachCount > 0 ? 'border-red-500 border-2' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">SLA Breaches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{slaBreachCount}</div>
            <p className="text-xs text-gray-500 mt-1">Overdue incidents</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Open</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {incidents.filter(i => !i.investigated).length}
            </div>
            <p className="text-xs text-gray-500 mt-1">Requires investigation</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label className="text-sm font-medium text-gray-700 mr-2">Severity:</label>
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value as any)}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
              >
                <option value="ALL">All</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mr-2">Status:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
              >
                <option value="ALL">All</option>
                <option value="OPEN">Open</option>
                <option value="RESOLVED">Resolved</option>
              </select>
            </div>
            <div className="ml-auto text-sm text-gray-600">
              Showing {filteredIncidents.length} of {incidents.length} incidents
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Incidents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Investigation Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredIncidents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No incidents matching filters
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Event Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time Since
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SLA Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredIncidents.map((incident) => (
                    <tr
                      key={incident.id}
                      className={`hover:bg-gray-50 ${
                        incident.sla_status === 'SLA_BREACH' && !incident.investigated ? 'bg-red-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getSeverityColor(incident.severity)}`}>
                          {incident.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {incident.event_type.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-md">
                        {incident.description}
                        {incident.auto_blocked && (
                          <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded">
                            AUTO-BLOCKED
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {formatHoursSince(incident.hours_since_event)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getSLAColor(incident.sla_status)}`}>
                          {incident.sla_status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {!incident.investigated ? (
                          <button
                            onClick={() => setSelectedIncident(incident)}
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Investigate
                          </button>
                        ) : (
                          <button
                            onClick={() => setSelectedIncident(incident)}
                            className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                          >
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">Incident Details</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    ID: {selectedIncident.id.substring(0, 8)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedIncident(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Severity</label>
                  <div className="mt-1">
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full border ${getSeverityColor(selectedIncident.severity)}`}>
                      {selectedIncident.severity}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">SLA Status</label>
                  <div className="mt-1">
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full border ${getSLAColor(selectedIncident.sla_status)}`}>
                      {selectedIncident.sla_status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Event Type</label>
                <p className="mt-1 text-gray-900">{selectedIncident.event_type.replace(/_/g, ' ')}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Description</label>
                <p className="mt-1 text-gray-900">{selectedIncident.description}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Timestamp</label>
                <p className="mt-1 text-gray-900">{formatTimestamp(selectedIncident.timestamp)}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Source IP</label>
                <p className="mt-1 font-mono text-gray-900">{selectedIncident.actor_ip_address || 'N/A'}</p>
              </div>

              {selectedIncident.metadata && Object.keys(selectedIncident.metadata).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Additional Details</label>
                  <pre className="mt-1 p-3 bg-gray-50 rounded text-xs overflow-auto">
                    {JSON.stringify(selectedIncident.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {selectedIncident.investigated ? (
                <div className="border-t pt-4">
                  <div className="bg-green-50 border border-green-200 rounded p-4">
                    <h4 className="text-sm font-semibold text-green-900 mb-2">Resolved</h4>
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>Investigated by:</strong> {selectedIncident.investigated_by || 'Unknown'}
                    </p>
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>Resolved at:</strong> {selectedIncident.investigated_at ? formatTimestamp(selectedIncident.investigated_at) : 'N/A'}
                    </p>
                    <p className="text-sm text-gray-700">
                      <strong>Resolution:</strong> {selectedIncident.resolution}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="border-t pt-4">
                  <label className="text-sm font-medium text-gray-600">Resolution Notes</label>
                  <textarea
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={4}
                    placeholder="Describe the investigation findings and resolution..."
                  />
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={handleResolveIncident}
                      disabled={submittingResolution || !resolution.trim()}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {submittingResolution ? 'Resolving...' : 'Mark as Resolved'}
                    </button>
                    <button
                      onClick={() => setSelectedIncident(null)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
