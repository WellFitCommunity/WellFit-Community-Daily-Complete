// src/components/OfflineIndicator.tsx - Shows offline status and pending syncs

import React, { useState, useEffect, useCallback } from 'react';
import { WifiOff, Wifi, Cloud, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { offlineStorage, isOnline } from '../utils/offlineStorage';
import { useUser, useSupabaseClient } from '../contexts/AuthContext';
import { auditLogger } from '../services/auditLogger';

interface SyncResult {
  success: number;
  failed: number;
  skipped: number;
  permanentlyFailed: number;
}

const OfflineIndicator: React.FC = () => {
  const user = useUser();
  const supabase = useSupabaseClient();
  const [online, setOnline] = useState(isOnline());
  const [pendingCount, setPendingCount] = useState(0);
  const [permanentlyFailedCount, setPermanentlyFailedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  // Check online status
  useEffect(() => {
    const updateOnlineStatus = () => {
      setOnline(isOnline());
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Check every 10 seconds
    const interval = setInterval(updateOnlineStatus, 10000);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      clearInterval(interval);
    };
  }, []);

  // Listen for SYNC_REQUESTED messages from service worker (background sync delegation)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleSWMessage = (event: MessageEvent) => {
      const data = event.data;
      if (typeof data === 'object' && data !== null) {
        // SW is requesting we perform the sync (we have auth context)
        if (data.type === 'SYNC_REQUESTED' && data.count > 0) {
          auditLogger.info('Background sync requested by service worker', {
            pendingCount: data.count,
            reports: data.reports,
            measurements: data.measurements
          });
          // Trigger sync if not already syncing
          if (!syncing && isOnline()) {
            handleSync();
          }
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSWMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSWMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncing]);

  // Check pending count and permanently failed count
  useEffect(() => {
    const checkPending = async () => {
      if (user?.id) {
        try {
          const [pending, failed] = await Promise.all([
            offlineStorage.getPendingCount(user.id),
            offlineStorage.getPermanentlyFailedCount(user.id)
          ]);
          setPendingCount(pending);
          setPermanentlyFailedCount(failed);
        } catch (err: unknown) {
          auditLogger.warn('Failed to check pending reports', {
            error: err instanceof Error ? err.message : 'Unknown error'
          });
        }
      }
    };

    checkPending();

    // Check every 30 seconds
    const interval = setInterval(checkPending, 30000);

    return () => clearInterval(interval);
  }, [user?.id, online]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (online && pendingCount > 0 && !syncing) {
      // Wait a moment for connection to stabilize
      const timeout = setTimeout(() => {
        handleSync();
      }, 2000);

      return () => clearTimeout(timeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, pendingCount]);

  /**
   * Sync callback that inserts a single report into self_reports table
   */
  const syncReportToSupabase = useCallback(async (reportData: Record<string, unknown>): Promise<boolean> => {
    try {
      // Add metadata to track this was an offline sync
      const dataWithMeta = {
        ...reportData,
        metadata: {
          ...(typeof reportData.metadata === 'object' ? reportData.metadata : {}),
          source: 'offline_sync',
          synced_at: new Date().toISOString(),
        },
      };

      const { error } = await supabase.from('self_reports').insert([dataWithMeta]);

      if (error) {
        auditLogger.warn('Offline sync failed for report', {
          error: error.message,
          userId: reportData.user_id,
        });
        return false;
      }

      auditLogger.info('Offline report synced successfully', {
        userId: reportData.user_id,
      });
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      auditLogger.error('Exception during offline sync', message);
      return false;
    }
  }, [supabase]);

  const handleSync = async () => {
    if (!user?.id || syncing) return;

    setSyncing(true);
    setLastSyncResult(null);

    try {
      // Actually sync pending reports to Supabase
      const result = await offlineStorage.syncPendingReports(user.id, syncReportToSupabase);

      setLastSyncResult(result);

      // Update counts after sync
      const [pending, failed] = await Promise.all([
        offlineStorage.getPendingCount(user.id),
        offlineStorage.getPermanentlyFailedCount(user.id)
      ]);
      setPendingCount(pending);
      setPermanentlyFailedCount(failed);

      if (result.success > 0 || result.permanentlyFailed > 0) {
        auditLogger.info('Offline sync completed', {
          userId: user.id,
          success: result.success,
          failed: result.failed,
          skipped: result.skipped,
          permanentlyFailed: result.permanentlyFailed,
        });

        // Notify service worker that sync is complete (clears any pending notifications)
        try {
          const registration = await navigator.serviceWorker?.ready;
          registration?.active?.postMessage({ type: 'SYNC_COMPLETE_ACK' });
        } catch {
          // SW not available - ignore
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      auditLogger.error('Offline sync error', message, { userId: user.id });
    } finally {
      setSyncing(false);
    }
  };

  const handleRetryFailed = async () => {
    if (!user?.id || syncing) return;

    try {
      const count = await offlineStorage.retryAllFailedReports(user.id);
      if (count > 0) {
        auditLogger.info('Reset failed reports for retry', {
          userId: user.id,
          count,
        });
        // Trigger a sync after resetting
        await handleSync();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      auditLogger.error('Failed to retry failed reports', message, { userId: user.id });
    }
  };

  // Don't show if online and no pending or failed reports
  if (online && pendingCount === 0 && permanentlyFailedCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg font-medium text-white transition-all duration-300 ${
          online
            ? 'bg-linear-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
            : 'bg-linear-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 animate-pulse'
        }`}
      >
        {syncing ? (
          <RefreshCw size={20} className="animate-spin" />
        ) : online ? (
          <Wifi size={20} />
        ) : (
          <WifiOff size={20} />
        )}

        <span className="text-sm font-bold">
          {syncing ? 'Syncing...' : online ? 'Online' : 'Offline Mode'}
        </span>

        {(pendingCount > 0 || permanentlyFailedCount > 0) && (
          <span className={`bg-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold ${
            permanentlyFailedCount > 0 ? 'text-red-600' : 'text-orange-600'
          }`}>
            {pendingCount + permanentlyFailedCount}
          </span>
        )}
      </button>

      {showDetails && (
        <div className="mt-2 bg-white rounded-lg shadow-xl p-4 w-80 border-2 border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            {online ? (
              <Cloud className="text-green-600" size={24} />
            ) : (
              <CloudOff className="text-orange-600" size={24} />
            )}
            <h3 className="font-bold text-gray-900">
              {online ? 'Connected' : 'Working Offline'}
            </h3>
          </div>

          {online ? (
            <div className="text-sm text-gray-700">
              <p className="mb-2">✅ You're connected to the internet.</p>
              {pendingCount > 0 && (
                <>
                  <p className="mb-3 font-medium text-orange-600">
                    📤 You have {pendingCount} health report{pendingCount !== 1 ? 's' : ''} waiting to upload.
                  </p>
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="w-full bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    {syncing ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw size={16} />
                        Sync Now
                      </>
                    )}
                  </button>
                </>
              )}
              {lastSyncResult && (
                <div className={`mt-3 p-2 rounded-lg text-sm ${
                  lastSyncResult.failed === 0 && lastSyncResult.permanentlyFailed === 0
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                }`}>
                  {lastSyncResult.success > 0 && (
                    <p>✅ {lastSyncResult.success} report{lastSyncResult.success !== 1 ? 's' : ''} synced</p>
                  )}
                  {lastSyncResult.skipped > 0 && (
                    <p>⏳ {lastSyncResult.skipped} report{lastSyncResult.skipped !== 1 ? 's' : ''} waiting (backoff)</p>
                  )}
                  {lastSyncResult.failed > 0 && (
                    <p>⚠️ {lastSyncResult.failed} report{lastSyncResult.failed !== 1 ? 's' : ''} will retry</p>
                  )}
                  {lastSyncResult.permanentlyFailed > 0 && (
                    <p>❌ {lastSyncResult.permanentlyFailed} report{lastSyncResult.permanentlyFailed !== 1 ? 's' : ''} failed permanently</p>
                  )}
                </div>
              )}
              {permanentlyFailedCount > 0 && (
                <div className="mt-3 bg-red-50 border-2 border-red-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="text-red-600" size={18} />
                    <p className="font-medium text-red-900">
                      {permanentlyFailedCount} report{permanentlyFailedCount !== 1 ? 's' : ''} failed after multiple attempts
                    </p>
                  </div>
                  <p className="text-xs text-red-700 mb-2">
                    These reports could not be synced. You can try again or contact support.
                  </p>
                  <button
                    onClick={handleRetryFailed}
                    disabled={syncing}
                    className="w-full bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={16} />
                    Retry Failed Reports
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-700">
              <p className="mb-2">
                📱 Don't worry! You can still use the app and track your health.
              </p>
              <p className="mb-2">
                All your data is saved on your device and will automatically upload when you're back online.
              </p>
              {pendingCount > 0 && (
                <div className="mt-3 bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
                  <p className="font-medium text-blue-900">
                    💾 {pendingCount} report{pendingCount !== 1 ? 's' : ''} saved locally
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Will sync automatically when online
                  </p>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setShowDetails(false)}
            className="mt-3 w-full text-gray-600 hover:text-gray-800 text-sm font-medium"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};

export default OfflineIndicator;
