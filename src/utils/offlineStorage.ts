// src/utils/offlineStorage.ts - Offline Storage for Rural Healthcare
// Stores health reports locally when offline, syncs when online

const DB_NAME = 'WellFitOfflineDB';
const DB_VERSION = 3; // v3: Added synced index to measurements for background sync
const REPORTS_STORE = 'pendingReports';
const MEASUREMENTS_STORE = 'measurements';

// Sync configuration
const MAX_SYNC_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 1000; // 1 second base
const MAX_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes max

interface PendingReport {
  id: string;
  timestamp: number;
  userId: string;
  data: Record<string, unknown>;
  synced: boolean;
  attempts: number;
  lastAttemptTime?: number;
  permanentlyFailed?: boolean;
}

interface OfflineMeasurement {
  id: string;
  userId: string;
  heartRate: number;
  spo2: number;
  timestamp: number;
  synced: boolean;
  syncedAt?: string;
}

class OfflineStorage {
  private db: IDBDatabase | null = null;
  private syncInProgress = false;

  /**
   * Calculate exponential backoff delay based on attempt count
   * Uses exponential backoff: delay = base * 2^attempts, capped at MAX_BACKOFF_MS
   */
  private calculateBackoffDelay(attempts: number): number {
    const delay = BASE_BACKOFF_MS * Math.pow(2, attempts);
    return Math.min(delay, MAX_BACKOFF_MS);
  }

  /**
   * Check if a report is ready to retry (backoff period has passed)
   */
  private isReadyToRetry(report: PendingReport): boolean {
    if (!report.lastAttemptTime || report.attempts === 0) {
      return true;
    }
    const backoffDelay = this.calculateBackoffDelay(report.attempts);
    const timeSinceLastAttempt = Date.now() - report.lastAttemptTime;
    return timeSinceLastAttempt >= backoffDelay;
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains(REPORTS_STORE)) {
          const reportsStore = db.createObjectStore(REPORTS_STORE, { keyPath: 'id' });
          reportsStore.createIndex('userId', 'userId', { unique: false });
          reportsStore.createIndex('synced', 'synced', { unique: false });
          reportsStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains(MEASUREMENTS_STORE)) {
          const measurementsStore = db.createObjectStore(MEASUREMENTS_STORE, { keyPath: 'id' });
          measurementsStore.createIndex('userId', 'userId', { unique: false });
          measurementsStore.createIndex('timestamp', 'timestamp', { unique: false });
          measurementsStore.createIndex('synced', 'synced', { unique: false });
        } else {
          // Migration: add synced index if upgrading from v2
          const transaction = (event.target as IDBOpenDBRequest).transaction;
          if (transaction) {
            const measurementsStore = transaction.objectStore(MEASUREMENTS_STORE);
            if (!measurementsStore.indexNames.contains('synced')) {
              measurementsStore.createIndex('synced', 'synced', { unique: false });
            }
          }
        }

      };
    });
  }

  // Save a health report for later sync
  async savePendingReport(userId: string, reportData: Record<string, unknown>): Promise<string> {
    if (!this.db) await this.initialize();

    const report: PendingReport = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: Date.now(),
      userId,
      data: reportData,
      synced: false,
      attempts: 0
    };

    return new Promise((resolve, reject) => {
      const db = this.db;
      if (!db) {
        reject(new Error('OfflineStorage database not initialized'));
        return;
      }

      const transaction = db.transaction([REPORTS_STORE], 'readwrite');
      const store = transaction.objectStore(REPORTS_STORE);
      const request = store.add(report);

      request.onsuccess = () => {
        // Register for background sync so data syncs even if tab closes
        // This is fire-and-forget - we don't block on it
        void this.triggerBackgroundSync();
        resolve(report.id);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Trigger background sync registration.
   * Called internally after saving offline data.
   */
  private async triggerBackgroundSync(): Promise<void> {
    // Check if Background Sync API is supported
    if (!('serviceWorker' in navigator)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      // Check if sync is supported
      if ('sync' in registration) {
        const syncManager = registration as ServiceWorkerRegistration & {
          sync: { register: (tag: string) => Promise<void> };
        };
        await syncManager.sync.register('sync-pending-data');
      }
    } catch {
      // Background Sync registration failed - not critical
      // Data will sync when user returns online via OfflineIndicator
    }
  }

  // Get all pending (unsynced) reports
  async getPendingReports(userId?: string): Promise<PendingReport[]> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const db = this.db;
      if (!db) {
        reject(new Error('OfflineStorage database not initialized'));
        return;
      }

      const transaction = db.transaction([REPORTS_STORE], 'readonly');
      const store = transaction.objectStore(REPORTS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        let reports = request.result as PendingReport[];

        // Filter by synced status and userId
        reports = reports.filter(r => !r.synced);

        if (userId) {
          reports = reports.filter(r => r.userId === userId);
        }

        resolve(reports);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Mark a report as synced
  async markReportAsSynced(reportId: string): Promise<void> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const db = this.db;
      if (!db) {
        reject(new Error('OfflineStorage database not initialized'));
        return;
      }

      const transaction = db.transaction([REPORTS_STORE], 'readwrite');
      const store = transaction.objectStore(REPORTS_STORE);
      const getRequest = store.get(reportId);

      getRequest.onsuccess = () => {
        const report = getRequest.result;
        if (report) {
          report.synced = true;
          const updateRequest = store.put(report);

          updateRequest.onsuccess = () => {
            resolve();
          };

          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve(); // Report doesn't exist, consider it synced
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Delete a report (after successful sync)
  async deleteReport(reportId: string): Promise<void> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const db = this.db;
      if (!db) {
        reject(new Error('OfflineStorage database not initialized'));
        return;
      }

      const transaction = db.transaction([REPORTS_STORE], 'readwrite');
      const store = transaction.objectStore(REPORTS_STORE);
      const request = store.delete(reportId);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Increment attempt count for a report and track timing for backoff
  async incrementAttempts(reportId: string): Promise<{ permanentlyFailed: boolean }> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const db = this.db;
      if (!db) {
        reject(new Error('OfflineStorage database not initialized'));
        return;
      }

      const transaction = db.transaction([REPORTS_STORE], 'readwrite');
      const store = transaction.objectStore(REPORTS_STORE);
      const getRequest = store.get(reportId);

      getRequest.onsuccess = () => {
        const report = getRequest.result as PendingReport | undefined;
        if (report) {
          report.attempts += 1;
          report.lastAttemptTime = Date.now();

          // Mark as permanently failed if max attempts exceeded
          if (report.attempts >= MAX_SYNC_ATTEMPTS) {
            report.permanentlyFailed = true;
          }

          const updateRequest = store.put(report);
          updateRequest.onsuccess = () => resolve({
            permanentlyFailed: report.permanentlyFailed || false
          });
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve({ permanentlyFailed: false });
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Get count of pending reports
  async getPendingCount(userId?: string): Promise<number> {
    const reports = await this.getPendingReports(userId);
    return reports.length;
  }

  // Sync all pending reports (call when online)
  async syncPendingReports(
    userId: string,
    syncFunction: (reportData: Record<string, unknown>) => Promise<boolean>
  ): Promise<{ success: number; failed: number; skipped: number; permanentlyFailed: number }> {
    if (this.syncInProgress) {
      return { success: 0, failed: 0, skipped: 0, permanentlyFailed: 0 };
    }

    this.syncInProgress = true;
    const pending = await this.getPendingReports(userId);
    let success = 0;
    let failed = 0;
    let skipped = 0;
    let permanentlyFailedCount = 0;

    for (const report of pending) {
      // Skip permanently failed reports
      if (report.permanentlyFailed) {
        permanentlyFailedCount++;
        continue;
      }

      // Skip reports still in backoff period
      if (!this.isReadyToRetry(report)) {
        skipped++;
        continue;
      }

      try {
        // Attempt to sync
        const synced = await syncFunction(report.data);

        if (synced) {
          await this.deleteReport(report.id);
          success++;
        } else {
          const result = await this.incrementAttempts(report.id);
          if (result.permanentlyFailed) {
            permanentlyFailedCount++;
          } else {
            failed++;
          }
        }
      } catch (_err: unknown) {
        const result = await this.incrementAttempts(report.id);
        if (result.permanentlyFailed) {
          permanentlyFailedCount++;
        } else {
          failed++;
        }
      }
    }

    this.syncInProgress = false;

    return { success, failed, skipped, permanentlyFailed: permanentlyFailedCount };
  }

  // Save a pulse oximeter measurement offline
  async saveMeasurement(userId: string, heartRate: number, spo2: number): Promise<string> {
    if (!this.db) await this.initialize();

    const measurement: OfflineMeasurement = {
      id: `measurement_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      userId,
      heartRate,
      spo2,
      timestamp: Date.now(),
      synced: false
    };

    return new Promise((resolve, reject) => {
      const db = this.db;
      if (!db) {
        reject(new Error('OfflineStorage database not initialized'));
        return;
      }

      const transaction = db.transaction([MEASUREMENTS_STORE], 'readwrite');
      const store = transaction.objectStore(MEASUREMENTS_STORE);
      const request = store.add(measurement);

      request.onsuccess = () => {
        // Register for background sync so measurement syncs even if tab closes
        void this.triggerBackgroundSync();
        resolve(measurement.id);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Get recent measurements
  async getRecentMeasurements(userId: string, limit: number = 10): Promise<OfflineMeasurement[]> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const db = this.db;
      if (!db) {
        reject(new Error('OfflineStorage database not initialized'));
        return;
      }

      const transaction = db.transaction([MEASUREMENTS_STORE], 'readonly');
      const store = transaction.objectStore(MEASUREMENTS_STORE);
      const index = store.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = () => {
        const measurements = (request.result as OfflineMeasurement[])
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, limit);
        resolve(measurements);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Get permanently failed reports for a user
  async getPermanentlyFailedReports(userId?: string): Promise<PendingReport[]> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const db = this.db;
      if (!db) {
        reject(new Error('OfflineStorage database not initialized'));
        return;
      }

      const transaction = db.transaction([REPORTS_STORE], 'readonly');
      const store = transaction.objectStore(REPORTS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        let reports = request.result as PendingReport[];
        reports = reports.filter(r => r.permanentlyFailed === true);

        if (userId) {
          reports = reports.filter(r => r.userId === userId);
        }

        resolve(reports);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Get count of permanently failed reports
  async getPermanentlyFailedCount(userId?: string): Promise<number> {
    const reports = await this.getPermanentlyFailedReports(userId);
    return reports.length;
  }

  // Retry a permanently failed report (reset attempts and remove failure flag)
  async retryFailedReport(reportId: string): Promise<void> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const db = this.db;
      if (!db) {
        reject(new Error('OfflineStorage database not initialized'));
        return;
      }

      const transaction = db.transaction([REPORTS_STORE], 'readwrite');
      const store = transaction.objectStore(REPORTS_STORE);
      const getRequest = store.get(reportId);

      getRequest.onsuccess = () => {
        const report = getRequest.result as PendingReport | undefined;
        if (report) {
          report.attempts = 0;
          report.permanentlyFailed = false;
          report.lastAttemptTime = undefined;

          const updateRequest = store.put(report);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Retry all permanently failed reports for a user
  async retryAllFailedReports(userId: string): Promise<number> {
    const failed = await this.getPermanentlyFailedReports(userId);
    let count = 0;

    for (const report of failed) {
      await this.retryFailedReport(report.id);
      count++;
    }

    return count;
  }

  // Clear all data (for testing or user logout)
  async clearAllData(): Promise<void> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const db = this.db;
      if (!db) {
        reject(new Error('OfflineStorage database not initialized'));
        return;
      }

      const transaction = db.transaction([REPORTS_STORE, MEASUREMENTS_STORE], 'readwrite');

      transaction.objectStore(REPORTS_STORE).clear();
      transaction.objectStore(MEASUREMENTS_STORE).clear();

      transaction.oncomplete = () => {
        resolve();
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }
}

// Singleton instance
export const offlineStorage = new OfflineStorage();

// Helper to check if online
export const isOnline = (): boolean => {
  return navigator.onLine;
};

// Helper to wait for online connection
export const waitForOnline = (): Promise<void> => {
  return new Promise((resolve) => {
    if (isOnline()) {
      resolve();
    } else {
      const handleOnline = () => {
        window.removeEventListener('online', handleOnline);
        resolve();
      };
      window.addEventListener('online', handleOnline);
    }
  });
};

// Background Sync registration tags - must match service-worker.js
const SYNC_TAG_DATA = 'sync-pending-data';
const SYNC_TAG_REPORTS = 'sync-pending-reports';

/**
 * Register for Background Sync to sync pending data when connection returns.
 * This enables sync even if the tab is closed (browser permitting).
 *
 * @param tag - The sync tag to register ('data' for all, 'reports' for reports only)
 * @returns Promise resolving to true if registration succeeded, false otherwise
 */
export const registerBackgroundSync = async (
  tag: 'data' | 'reports' = 'data'
): Promise<boolean> => {
  // Check if Background Sync API is supported
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Check if sync is supported (it's not in all browsers)
    if (!('sync' in registration)) {
      // Fallback: try to sync immediately if online
      if (isOnline()) {
        // Post message to SW to trigger sync
        registration.active?.postMessage({ type: 'SYNC_NOW' });
      }
      return false;
    }

    // Register the sync event
    const syncTag = tag === 'reports' ? SYNC_TAG_REPORTS : SYNC_TAG_DATA;
    await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register(syncTag);

    return true;
  } catch (err: unknown) {
    // Background Sync may be blocked by user or not supported
    // This is not an error - we'll fall back to online sync
    return false;
  }
};

/**
 * Request an immediate sync by posting a message to the service worker.
 * Use this when the user explicitly taps "Sync Now" in the UI.
 */
export const requestImmediateSync = async (): Promise<void> => {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: 'SYNC_NOW' });
  } catch {
    // Ignore - SW not available
  }
};

/**
 * Listen for sync completion messages from the service worker.
 *
 * @param callback - Function to call when sync completes
 * @returns Cleanup function to remove the listener
 */
export const onSyncComplete = (
  callback: (result: { synced: number; failed: number }) => void
): (() => void) => {
  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'SYNC_COMPLETE') {
      callback({
        synced: event.data.synced ?? 0,
        failed: event.data.failed ?? 0
      });
    }
  };

  navigator.serviceWorker?.addEventListener('message', handler);

  return () => {
    navigator.serviceWorker?.removeEventListener('message', handler);
  };
};
