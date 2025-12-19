// src/components/OfflineIndicator.tsx - Shows offline status and pending syncs

import React, { useState, useEffect, useCallback } from 'react';
import { WifiOff, Wifi, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { offlineStorage, isOnline } from '../utils/offlineStorage';
import { useUser, useSupabaseClient } from '../contexts/AuthContext';
import { auditLogger } from '../services/auditLogger';

const OfflineIndicator: React.FC = () => {
  const user = useUser();
  const supabase = useSupabaseClient();
  const [online, setOnline] = useState(isOnline());
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{ success: number; failed: number } | null>(null);

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

  // Check pending count
  useEffect(() => {
    const checkPending = async () => {
      if (user?.id) {
        try {
          const count = await offlineStorage.getPendingCount(user.id);
          setPendingCount(count);
        } catch (error) {
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

      // Update pending count after sync
      const count = await offlineStorage.getPendingCount(user.id);
      setPendingCount(count);

      if (result.success > 0) {
        auditLogger.info('Offline sync completed', {
          userId: user.id,
          success: result.success,
          failed: result.failed,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      auditLogger.error('Offline sync error', message, { userId: user.id });
    } finally {
      setSyncing(false);
    }
  };

  // Don't show if online and no pending reports
  if (online && pendingCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg font-medium text-white transition-all duration-300 ${
          online
            ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
            : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 animate-pulse'
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

        {pendingCount > 0 && (
          <span className="bg-white text-red-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
            {pendingCount}
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
                  lastSyncResult.failed === 0
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                }`}>
                  {lastSyncResult.success > 0 && (
                    <p>✅ {lastSyncResult.success} report{lastSyncResult.success !== 1 ? 's' : ''} synced successfully</p>
                  )}
                  {lastSyncResult.failed > 0 && (
                    <p>⚠️ {lastSyncResult.failed} report{lastSyncResult.failed !== 1 ? 's' : ''} failed to sync</p>
                  )}
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
