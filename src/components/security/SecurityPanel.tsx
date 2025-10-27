/**
 * Security Panel - Guardian Alert Dashboard
 *
 * Central security dashboard showing all Guardian Agent alerts,
 * including links to Guardian Eyes recordings and generated healing fixes.
 */

import React, { useState, useEffect } from 'react';
import { GuardianAlertService, GuardianAlert, AlertSeverity } from '../../services/guardian-agent/GuardianAlertService';
import { useAuth } from '../../contexts/AuthContext';

export const SecurityPanel: React.FC = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<GuardianAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'critical'>('pending');
  const [selectedAlert, setSelectedAlert] = useState<GuardianAlert | null>(null);

  useEffect(() => {
    loadAlerts();

    // Subscribe to real-time alerts
    const unsubscribe = GuardianAlertService.subscribeToAlerts((newAlert) => {
      setAlerts((prev) => [newAlert, ...prev]);
      showNotification(newAlert);
    });

    return () => unsubscribe();
  }, []);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const pendingAlerts = await GuardianAlertService.getPendingAlerts();
      setAlerts(pendingAlerts);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (alert: GuardianAlert) => {
    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`${getSeverityEmoji(alert.severity)} ${alert.title}`, {
        body: alert.description,
        icon: '/guardian-icon.png',
        tag: alert.id,
      });
    }

    // Play sound for critical alerts
    if (alert.severity === 'critical' || alert.severity === 'emergency') {
      const audio = new Audio('/alert-sound.mp3');
      audio.play().catch(() => {});
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    if (!user) return;
    await GuardianAlertService.acknowledgeAlert(alertId, user.id);
    loadAlerts();
  };

  const handleResolve = async (alertId: string, notes: string) => {
    if (!user) return;
    await GuardianAlertService.resolveAlert(alertId, user.id, notes);
    setSelectedAlert(null);
    loadAlerts();
  };

  const handleApproveFix = async (guardianAlert: GuardianAlert) => {
    if (!user) return;

    if (!guardianAlert.generated_fix) {
      window.alert('No fix available for this alert');
      return;
    }

    const confirmed = window.confirm(
      `Create Pull Request to fix ${guardianAlert.title}?\n\n` +
      `File: ${guardianAlert.generated_fix.file_path}\n\n` +
      `This will:\n` +
      `1. Create a new Git branch\n` +
      `2. Apply the generated code fix\n` +
      `3. Commit the changes\n` +
      `4. Create a pull request for review\n\n` +
      `Continue?`
    );

    if (!confirmed) return;

    try {
      // Show loading state
      const loadingMessage = document.createElement('div');
      loadingMessage.className = 'fixed top-4 right-4 p-4 bg-blue-600 text-white rounded-lg shadow-lg z-50';
      loadingMessage.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="animate-spin w-6 h-6 border-4 border-white border-t-transparent rounded-full"></div>
          <div>
            <div class="font-bold">Creating Pull Request...</div>
            <div class="text-sm">This may take a minute</div>
          </div>
        </div>
      `;
      document.body.appendChild(loadingMessage);

      // Call the approve & create PR service
      const result = await GuardianAlertService.approveAndCreatePR(guardianAlert.id, user.id);

      // Remove loading message
      document.body.removeChild(loadingMessage);

      if (result.success) {
        // Show success message
        window.alert(
          `✅ Pull Request Created!\n\n` +
          `PR URL: ${result.prUrl}\n` +
          `PR #${result.prNumber}\n\n` +
          `Opening pull request in new tab...`
        );

        // Open PR in new tab
        window.open(result.prUrl, '_blank');

        // Reload alerts to show updated status
        loadAlerts();
      } else {
        // Show error message
        window.alert(
          `❌ Failed to Create PR\n\n` +
          `Error: ${result.message}\n\n` +
          `${result.error || ''}\n\n` +
          `Please check:\n` +
          `1. GitHub CLI is installed (gh)\n` +
          `2. You are authenticated (gh auth login)\n` +
          `3. You have write access to the repository`
        );
      }
    } catch (error) {
      window.alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const getSeverityEmoji = (severity: AlertSeverity) => {
    const emojis = {
      info: 'ℹ️',
      warning: '⚠️',
      critical: '🚨',
      emergency: '🆘',
    };
    return emojis[severity];
  };

  const getSeverityColor = (severity: AlertSeverity) => {
    const colors = {
      info: 'bg-blue-50 border-blue-300 text-blue-900',
      warning: 'bg-yellow-50 border-yellow-300 text-yellow-900',
      critical: 'bg-red-50 border-red-300 text-red-900',
      emergency: 'bg-purple-50 border-purple-300 text-purple-900',
    };
    return colors[severity];
  };

  const getSeverityBadge = (severity: AlertSeverity) => {
    const badges = {
      info: 'bg-blue-600 text-white',
      warning: 'bg-yellow-600 text-white',
      critical: 'bg-red-600 text-white',
      emergency: 'bg-purple-600 text-white animate-pulse',
    };
    return badges[severity];
  };

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === 'pending') return alert.status === 'pending';
    if (filter === 'critical') return alert.severity === 'critical' || alert.severity === 'emergency';
    return true;
  });

  const pendingCount = alerts.filter((a) => a.status === 'pending').length;
  const criticalCount = alerts.filter((a) => a.severity === 'critical' || a.severity === 'emergency').length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              🛡️ Security Panel
              {criticalCount > 0 && (
                <span className="px-3 py-1 bg-red-600 text-white text-lg rounded-full animate-pulse">
                  {criticalCount} Critical
                </span>
              )}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Guardian Agent alerts and security monitoring
            </p>
          </div>
          <button
            onClick={loadAlerts}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-white rounded-lg shadow border-2 border-gray-200">
          <div className="text-sm text-gray-600">Total Alerts</div>
          <div className="text-3xl font-bold text-gray-900">{alerts.length}</div>
        </div>
        <div className="p-4 bg-yellow-50 rounded-lg shadow border-2 border-yellow-300">
          <div className="text-sm text-yellow-800">Pending Review</div>
          <div className="text-3xl font-bold text-yellow-900">{pendingCount}</div>
        </div>
        <div className="p-4 bg-red-50 rounded-lg shadow border-2 border-red-300">
          <div className="text-sm text-red-800">Critical Alerts</div>
          <div className="text-3xl font-bold text-red-900">{criticalCount}</div>
        </div>
        <div className="p-4 bg-green-50 rounded-lg shadow border-2 border-green-300">
          <div className="text-sm text-green-800">Auto-Healable</div>
          <div className="text-3xl font-bold text-green-900">
            {alerts.filter((a) => a.metadata.auto_healable).length}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          All ({alerts.length})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 rounded-lg font-medium ${
            filter === 'pending'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          Pending ({pendingCount})
        </button>
        <button
          onClick={() => setFilter('critical')}
          className={`px-4 py-2 rounded-lg font-medium ${
            filter === 'critical'
              ? 'bg-red-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          Critical ({criticalCount})
        </button>
      </div>

      {/* Alerts List */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin inline-block w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          <p className="mt-4 text-gray-600">Loading alerts...</p>
        </div>
      )}

      {!loading && filteredAlerts.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <div className="text-6xl mb-4">✅</div>
          <p className="text-xl font-semibold text-gray-900">All Clear!</p>
          <p className="text-gray-600 mt-2">No alerts matching your filter</p>
        </div>
      )}

      {!loading && filteredAlerts.length > 0 && (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-6 rounded-xl shadow-lg border-2 ${getSeverityColor(alert.severity)}`}
            >
              {/* Alert Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">{getSeverityEmoji(alert.severity)}</span>
                    <div>
                      <h3 className="text-xl font-bold">{alert.title}</h3>
                      <p className="text-sm opacity-75">
                        {new Date(alert.timestamp).toLocaleString()} • {alert.category}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm mt-2">{alert.description}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${getSeverityBadge(alert.severity)}`}>
                  {alert.severity.toUpperCase()}
                </span>
              </div>

              {/* Alert Metadata */}
              {alert.metadata.estimated_impact && (
                <div className="mb-4 p-3 bg-white bg-opacity-50 rounded border border-current">
                  <div className="text-xs font-semibold mb-1">IMPACT ASSESSMENT</div>
                  <div className="text-sm">{alert.metadata.estimated_impact}</div>
                </div>
              )}

              {/* Guardian Eyes Recording Link */}
              {alert.session_recording_url && (
                <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">👁️</span>
                    <div className="flex-1">
                      <div className="font-bold text-purple-900">Guardian Eyes Recording Available</div>
                      <div className="text-sm text-purple-700">
                        Watch the exact moment this issue occurred
                        {alert.video_timestamp && ` at ${Math.floor(alert.video_timestamp / 1000)}s`}
                      </div>
                    </div>
                    <a
                      href={alert.session_recording_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg"
                    >
                      🎥 Watch Recording
                    </a>
                  </div>
                </div>
              )}

              {/* Generated Fix Preview */}
              {alert.generated_fix && (
                <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">🤖</span>
                    <div className="flex-1">
                      <div className="font-bold text-green-900">Guardian Generated a Fix</div>
                      <div className="text-sm text-green-700">
                        {alert.generated_fix.file_path}:{alert.generated_fix.line_number}
                      </div>
                    </div>
                  </div>

                  {/* Code Diff */}
                  <div className="grid grid-cols-2 gap-4">
                    {alert.generated_fix.original_code && (
                      <div>
                        <div className="text-xs font-bold text-red-700 mb-1">BEFORE (VULNERABLE)</div>
                        <pre className="p-3 bg-red-100 border border-red-300 rounded text-xs overflow-x-auto">
                          <code>{alert.generated_fix.original_code}</code>
                        </pre>
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-bold text-green-700 mb-1">AFTER (FIXED)</div>
                      <pre className="p-3 bg-green-100 border border-green-300 rounded text-xs overflow-x-auto">
                        <code>{alert.generated_fix.fixed_code}</code>
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 mb-3">
                {alert.actions.map((action) => (
                  <button
                    key={action.id}
                    onClick={async () => {
                      if (action.type === 'view_recording' && action.url) {
                        window.open(action.url, '_blank');
                      } else if (action.type === 'review_fix') {
                        setSelectedAlert(alert);
                      } else if (action.type === 'approve_fix') {
                        await handleApproveFix(alert);
                      } else if (action.type === 'dismiss') {
                        if (confirm('Dismiss this alert?')) {
                          handleResolve(alert.id, 'Dismissed by user');
                        }
                      }
                    }}
                    className={`px-4 py-2 rounded-lg font-medium ${
                      action.danger
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : action.type === 'approve_fix'
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {action.label}
                  </button>
                ))}

                {alert.status === 'pending' && (
                  <button
                    onClick={() => handleAcknowledge(alert.id)}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg"
                  >
                    ✓ Acknowledge
                  </button>
                )}
              </div>

              {/* PR Link (if PR was created) */}
              {alert.metadata?.pr_url && (
                <div className="mb-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🔀</span>
                    <div className="flex-1">
                      <div className="font-bold text-green-900">Pull Request Created</div>
                      <div className="text-sm text-green-700">
                        PR #{alert.metadata.pr_number} is ready for review
                      </div>
                    </div>
                    <a
                      href={alert.metadata.pr_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg"
                    >
                      View PR →
                    </a>
                  </div>
                </div>
              )}

              {/* Status Badge */}
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold">Status:</span>
                <span
                  className={`px-2 py-1 rounded ${
                    alert.status === 'pending'
                      ? 'bg-yellow-200 text-yellow-900'
                      : alert.status === 'acknowledged'
                      ? 'bg-blue-200 text-blue-900'
                      : 'bg-green-200 text-green-900'
                  }`}
                >
                  {alert.status.toUpperCase()}
                </span>
                {alert.acknowledged_by && (
                  <span className="text-gray-600">
                    Acknowledged at {new Date(alert.acknowledged_at!).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SecurityPanel;
