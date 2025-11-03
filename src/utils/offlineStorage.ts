// src/utils/offlineStorage.ts - Offline Storage for Rural Healthcare
// Stores health reports locally when offline, syncs when online

const DB_NAME = 'WellFitOfflineDB';
const DB_VERSION = 1;
const REPORTS_STORE = 'pendingReports';
const MEASUREMENTS_STORE = 'measurements';

interface PendingReport {
  id: string;
  timestamp: number;
  userId: string;
  data: any;
  synced: boolean;
  attempts: number;
}


class OfflineStorage {
  private db: IDBDatabase | null = null;
  private syncInProgress = false;

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
        }

      };
    });
  }

  // Save a health report for later sync
  async savePendingReport(userId: string, reportData: any): Promise<string> {
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
      // Safe: initialize() was called above if db was null
      const transaction = this.db!.transaction([REPORTS_STORE], 'readwrite');
      const store = transaction.objectStore(REPORTS_STORE);
      const request = store.add(report);

      request.onsuccess = () => {
        resolve(report.id);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Get all pending (unsynced) reports
  async getPendingReports(userId?: string): Promise<PendingReport[]> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      // Safe: initialize() was called above if db was null
      const transaction = this.db!.transaction([REPORTS_STORE], 'readonly');
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
      // Safe: initialize() was called above if db was null
      const transaction = this.db!.transaction([REPORTS_STORE], 'readwrite');
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
      // Safe: initialize() was called above if db was null
      const transaction = this.db!.transaction([REPORTS_STORE], 'readwrite');
      const store = transaction.objectStore(REPORTS_STORE);
      const request = store.delete(reportId);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Increment attempt count for a report
  async incrementAttempts(reportId: string): Promise<void> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      // Safe: initialize() was called above if db was null
      const transaction = this.db!.transaction([REPORTS_STORE], 'readwrite');
      const store = transaction.objectStore(REPORTS_STORE);
      const getRequest = store.get(reportId);

      getRequest.onsuccess = () => {
        const report = getRequest.result;
        if (report) {
          report.attempts += 1;
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

  // Get count of pending reports
  async getPendingCount(userId?: string): Promise<number> {
    const reports = await this.getPendingReports(userId);
    return reports.length;
  }

  // Sync all pending reports (call when online)
  async syncPendingReports(
    userId: string,
    syncFunction: (reportData: any) => Promise<boolean>
  ): Promise<{ success: number; failed: number }> {
    if (this.syncInProgress) {
      return { success: 0, failed: 0 };
    }

    this.syncInProgress = true;
    const pending = await this.getPendingReports(userId);
    let success = 0;
    let failed = 0;


    for (const report of pending) {
      try {
        // Attempt to sync
        const synced = await syncFunction(report.data);

        if (synced) {
          await this.deleteReport(report.id);
          success++;
        } else {
          await this.incrementAttempts(report.id);
          failed++;
        }
      } catch (error) {
        await this.incrementAttempts(report.id);
        failed++;
      }
    }

    this.syncInProgress = false;

    return { success, failed };
  }

  // Save a pulse oximeter measurement offline
  async saveMeasurement(userId: string, heartRate: number, spo2: number): Promise<string> {
    if (!this.db) await this.initialize();

    const measurement = {
      id: `measurement_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      userId,
      heartRate,
      spo2,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      // Safe: initialize() was called above if db was null
      const transaction = this.db!.transaction([MEASUREMENTS_STORE], 'readwrite');
      const store = transaction.objectStore(MEASUREMENTS_STORE);
      const request = store.add(measurement);

      request.onsuccess = () => {
        resolve(measurement.id);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Get recent measurements
  async getRecentMeasurements(userId: string, limit: number = 10): Promise<any[]> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      // Safe: initialize() was called above if db was null
      const transaction = this.db!.transaction([MEASUREMENTS_STORE], 'readonly');
      const store = transaction.objectStore(MEASUREMENTS_STORE);
      const index = store.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = () => {
        const measurements = request.result
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, limit);
        resolve(measurements);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Clear all data (for testing or user logout)
  async clearAllData(): Promise<void> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      // Safe: initialize() was called above if db was null
      const transaction = this.db!.transaction([REPORTS_STORE, MEASUREMENTS_STORE], 'readwrite');

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
