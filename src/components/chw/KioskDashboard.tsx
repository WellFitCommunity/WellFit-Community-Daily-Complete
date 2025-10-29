/**
 * Kiosk Dashboard Component
 * Admin view for CHW/library staff to monitor kiosk status
 */

import React, { useState, useEffect } from 'react';
import { chwService } from '../../services/chwService';

interface KioskDashboardProps {
  kioskId: string;
  locationName: string;
}

export const KioskDashboard: React.FC<KioskDashboardProps> = ({
  kioskId,
  locationName
}) => {
  const [syncStatus, setSyncStatus] = useState<{
    pending: { visits: number; assessments: number; photos: number; alerts: number };
    lastSync?: number;
  }>({
    pending: { visits: 0, assessments: 0, photos: 0, alerts: 0 }
  });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<any>(null);

  useEffect(() => {
    // Update online status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load initial sync status
    loadSyncStatus();

    // Refresh sync status every 10 seconds
    const interval = setInterval(loadSyncStatus, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const loadSyncStatus = async () => {
    try {
      const status = await chwService.getSyncStatus();
      setSyncStatus(status);
    } catch (err) {

    }
  };

  const handleManualSync = async () => {
    if (!isOnline) {
      alert('Cannot sync while offline. Please check your internet connection.');
      return;
    }

    setSyncing(true);
    try {
      const result = await chwService.syncOfflineData();
      setLastSyncResult(result);
      await loadSyncStatus();
    } catch (err) {

    } finally {
      setSyncing(false);
    }
  };

  const totalPending = syncStatus.pending.visits + syncStatus.pending.assessments +
                       syncStatus.pending.photos + syncStatus.pending.alerts;

  const getConnectionStatusColor = () => {
    if (!isOnline) return 'bg-red-500';
    if (syncing) return 'bg-yellow-500 animate-pulse';
    if (totalPending > 0) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getConnectionStatusText = () => {
    if (!isOnline) return 'Offline';
    if (syncing) return 'Syncing...';
    if (totalPending > 0) return `${totalPending} Pending`;
    return 'All Synced';
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-800">Kiosk Dashboard</h1>
              <p className="text-xl text-gray-600 mt-2">{locationName}</p>
              <p className="text-lg text-gray-500">ID: {kioskId}</p>
            </div>

            {/* Connection status indicator */}
            <div className="text-right">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-6 h-6 rounded-full ${getConnectionStatusColor()}`} />
                <span className="text-2xl font-bold text-gray-800">
                  {getConnectionStatusText()}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {syncStatus.lastSync
                  ? `Last sync: ${new Date(syncStatus.lastSync).toLocaleTimeString()}`
                  : 'Never synced'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Sync Status Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-6">
          {/* Visits */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-600">Visits</h3>
              {syncStatus.pending.visits > 0 && (
                <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1 rounded-full">
                  Pending
                </span>
              )}
            </div>
            <p className="text-4xl font-bold text-blue-600">{syncStatus.pending.visits}</p>
            <p className="text-sm text-gray-500 mt-1">waiting to sync</p>
          </div>

          {/* Assessments */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-600">Assessments</h3>
              {syncStatus.pending.assessments > 0 && (
                <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1 rounded-full">
                  Pending
                </span>
              )}
            </div>
            <p className="text-4xl font-bold text-purple-600">{syncStatus.pending.assessments}</p>
            <p className="text-sm text-gray-500 mt-1">waiting to sync</p>
          </div>

          {/* Photos */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-600">Photos</h3>
              {syncStatus.pending.photos > 0 && (
                <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1 rounded-full">
                  Pending
                </span>
              )}
            </div>
            <p className="text-4xl font-bold text-green-600">{syncStatus.pending.photos}</p>
            <p className="text-sm text-gray-500 mt-1">waiting to sync</p>
          </div>

          {/* Alerts */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-600">Alerts</h3>
              {syncStatus.pending.alerts > 0 && (
                <span className="bg-red-100 text-red-800 text-xs font-bold px-3 py-1 rounded-full">
                  Pending
                </span>
              )}
            </div>
            <p className="text-4xl font-bold text-red-600">{syncStatus.pending.alerts}</p>
            <p className="text-sm text-gray-500 mt-1">waiting to sync</p>
          </div>
        </div>

        {/* Manual Sync Button */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Manual Sync</h3>
              <p className="text-gray-600">
                Click to manually sync all pending data to the server
              </p>
            </div>

            <button
              onClick={handleManualSync}
              disabled={syncing || !isOnline || totalPending === 0}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xl font-bold py-4 px-12 rounded-xl transition-all"
            >
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>

          {/* Last sync result */}
          {lastSyncResult && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="font-semibold text-gray-700 mb-3">Last Sync Result:</h4>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{lastSyncResult.visits}</p>
                  <p className="text-sm text-gray-600">Visits Synced</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">{lastSyncResult.assessments}</p>
                  <p className="text-sm text-gray-600">Assessments Synced</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{lastSyncResult.photos}</p>
                  <p className="text-sm text-gray-600">Photos Synced</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{lastSyncResult.alerts}</p>
                  <p className="text-sm text-gray-600">Alerts Synced</p>
                </div>
              </div>

              {lastSyncResult.errors && lastSyncResult.errors.length > 0 && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="font-semibold text-red-800 mb-2">Errors:</p>
                  <ul className="list-disc list-inside text-sm text-red-700">
                    {lastSyncResult.errors.map((error: string, index: number) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* System Information */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Network Status */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Network Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Connection:</span>
                <span className={`font-bold ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Auto-Sync:</span>
                <span className="font-bold text-blue-600">Every 30 seconds</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Offline Mode:</span>
                <span className="font-bold text-green-600">Enabled</span>
              </div>
            </div>
          </div>

          {/* Storage Information */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Storage</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Database:</span>
                <span className="font-bold text-blue-600">IndexedDB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Retention:</span>
                <span className="font-bold text-blue-600">7 days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className="font-bold text-green-600">Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Offline Warning */}
        {!isOnline && (
          <div className="mt-6 bg-red-50 border-4 border-red-300 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="bg-red-500 text-white w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold">
                !
              </div>
              <div>
                <h3 className="text-2xl font-bold text-red-800 mb-2">Offline Mode Active</h3>
                <p className="text-lg text-red-700">
                  The kiosk is currently offline. All data will be saved locally and automatically synced when the connection is restored.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
